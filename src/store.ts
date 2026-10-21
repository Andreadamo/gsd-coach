import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DB, Evaluation, Exercise, Match, Mesocycle, Player, Session } from './types'
import { SEED_EXERCISES as SEED_1, SEED_CYCLES, SEED_SESSIONS } from './data/seed'
import { SEED_EXERCISES_2 } from './data/seed2'

const SEED_EXERCISES = [...SEED_1, ...SEED_EXERCISES_2]
/** versione della libreria iniziale: alzarla quando si aggiungono esercizi seed */
export const SEED_VERSION = 2
const SEED_BATCHES: Record<number, Exercise[]> = { 1: SEED_1, 2: SEED_EXERCISES_2 }

/** esercizi seed delle versioni successive a `from` che mancano nella lista */
function missingSeeds(list: Exercise[], from: number): Exercise[] {
  const have = new Set(list.map((e) => e.id))
  const out: Exercise[] = []
  for (let v = from + 1; v <= SEED_VERSION; v++) for (const e of SEED_BATCHES[v] ?? []) if (!have.has(e.id)) out.push(e)
  return out
}
import { supabase, type Table } from './lib/supabase'
import { nowIso } from './lib/util'

type Entity = Exercise | Session | Mesocycle | Match | Player | Evaluation
type Key = keyof DB

interface State extends DB {
  seedVersion: number
  cloudSeedVersion: number
  userId: string | null
  syncError: string | null
  setUser: (id: string | null) => void
  upsert: <K extends Key>(k: K, v: DB[K][number]) => void
  remove: (k: Key, id: string) => void
  replaceAll: (db: Partial<DB>) => void
  resetSeed: () => void
  pullCloud: () => Promise<void>
  pushAllToCloud: () => Promise<void>
}

const TABLE: Record<Key, Table> = { exercises: 'exercises', sessions: 'sessions', cycles: 'cycles', matches: 'matches', players: 'players', evaluations: 'evaluations' }

let pushing = false
let seededOnce = false

async function cloudUpsert(k: Key, v: Entity) {
  if (!supabase) return
  const { error } = await supabase
    .from(TABLE[k])
    .upsert({ id: v.id, data: v, updated_at: v.updatedAt })
  if (error) useStore.setState({ syncError: error.message })
}

async function cloudDelete(k: Key, id: string) {
  if (!supabase) return
  const { error } = await supabase.from(TABLE[k]).delete().eq('id', id)
  if (error) useStore.setState({ syncError: error.message })
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      exercises: SEED_EXERCISES,
      sessions: SEED_SESSIONS,
      cycles: SEED_CYCLES,
      matches: [],
      players: [],
      evaluations: [],
      seedVersion: SEED_VERSION,
      cloudSeedVersion: 1,
      userId: null,
      syncError: null,
      setUser: (id) => set({ userId: id }),

      upsert: (k, v) => {
        const ent = { ...(v as Entity), updatedAt: nowIso() } as Entity
        if (!ent.ownerId && get().userId) ent.ownerId = get().userId!
        const list = get()[k] as Entity[]
        const i = list.findIndex((x) => x.id === ent.id)
        const next = i >= 0 ? list.map((x) => (x.id === ent.id ? ent : x)) : [...list, ent]
        set({ [k]: next } as Partial<State>)
        void cloudUpsert(k, ent)
      },

      remove: (k, id) => {
        const list = get()[k] as Entity[]
        set({ [k]: list.filter((x) => x.id !== id) } as Partial<State>)
        if (k === 'exercises') {
          // pulisci riferimenti nelle sedute
          get().sessions.forEach((s) => {
            if (s.items.some((it) => it.exerciseId === id)) {
              get().upsert('sessions', { ...s, items: s.items.filter((it) => it.exerciseId !== id) })
            }
          })
        }
        void cloudDelete(k, id)
      },

      replaceAll: (db) => set({ ...db }),

      resetSeed: () =>
        set({ exercises: SEED_EXERCISES, sessions: SEED_SESSIONS, cycles: SEED_CYCLES, seedVersion: SEED_VERSION }),

      pullCloud: async () => {
        if (!supabase || pushing) return
        const out: Partial<DB> = {}
        for (const k of Object.keys(TABLE) as Key[]) {
          const { data, error } = await supabase.from(TABLE[k]).select('data, owner_id')
          if (error) {
            set({ syncError: error.message })
            return
          }
          ;(out as Record<Key, Entity[]>)[k] = (data ?? []).map((r) => ({
            ...(r.data as Entity),
            ownerId: r.owner_id,
          }))
        }
        const empty = !out.exercises?.length && !out.sessions?.length && !out.cycles?.length
        if (empty) {
          // primo accesso a un database vuoto: carica i dati locali (libreria iniziale), una sola volta
          if (get().exercises.length && !seededOnce) {
            seededOnce = true
            set({ cloudSeedVersion: SEED_VERSION })
            await get().pushAllToCloud()
          }
          return
        }
        set({ ...out, syncError: null })
        // nuovi esercizi della libreria iniziale non ancora presenti nel cloud
        const v = get().cloudSeedVersion
        if (v < SEED_VERSION) {
          const add = missingSeeds(out.exercises ?? [], v)
          set({ cloudSeedVersion: SEED_VERSION })
          if (add.length) {
            set({ exercises: [...(out.exercises ?? []), ...add] })
            const { error } = await supabase.from('exercises').upsert(add.map((e) => ({ id: e.id, data: e, updated_at: e.updatedAt })), { ignoreDuplicates: true })
            if (error) set({ syncError: error.message })
          }
        }
      },

      pushAllToCloud: async () => {
        if (!supabase) return
        pushing = true
        const snap = { exercises: get().exercises, sessions: get().sessions, cycles: get().cycles, matches: get().matches, players: get().players, evaluations: get().evaluations }
        for (const k of Object.keys(TABLE) as Key[]) {
          const rows = (snap[k] as Entity[]).map((v) => ({
            id: v.id,
            data: v,
            updated_at: v.updatedAt,
          }))
          if (!rows.length) continue
          const { error } = await supabase.from(TABLE[k]).upsert(rows)
          if (error) {
            pushing = false
            set({ syncError: error.message })
            return
          }
        }
        pushing = false
        await get().pullCloud()
      },
    }),
    {
      name: 'gsd-coach-db-v1',
      version: 4,
      partialize: (s) => ({ exercises: s.exercises, sessions: s.sessions, cycles: s.cycles, matches: s.matches, players: s.players, evaluations: s.evaluations, seedVersion: s.seedVersion, cloudSeedVersion: s.cloudSeedVersion }),
      // dati salvati prima della libreria estesa: seedVersion assente = 1
      migrate: (persisted) => {
        const p = persisted as Partial<State>
        return { ...p, matches: p.matches ?? [], players: p.players ?? [], evaluations: p.evaluations ?? [], seedVersion: p.seedVersion ?? 1, cloudSeedVersion: p.cloudSeedVersion ?? 1 } as State
      },
      onRehydrateStorage: () => (state) => {
        if (!state || state.seedVersion >= SEED_VERSION) return
        const add = missingSeeds(state.exercises, state.seedVersion)
        useStore.setState({ exercises: [...state.exercises, ...add], seedVersion: SEED_VERSION })
      },
    },
  ),
)

export const useExercise = (id?: string) =>
  useStore((s) => s.exercises.find((e) => e.id === id))
