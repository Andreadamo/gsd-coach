import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DB, Exercise, Mesocycle, Session } from './types'
import { SEED_EXERCISES, SEED_CYCLES, SEED_SESSIONS } from './data/seed'
import { supabase, type Table } from './lib/supabase'
import { nowIso } from './lib/util'

type Entity = Exercise | Session | Mesocycle
type Key = keyof DB

interface State extends DB {
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

const TABLE: Record<Key, Table> = { exercises: 'exercises', sessions: 'sessions', cycles: 'cycles' }

let pushing = false

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
        set({ exercises: SEED_EXERCISES, sessions: SEED_SESSIONS, cycles: SEED_CYCLES }),

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
          // primo accesso a un database vuoto: carica i dati locali (libreria iniziale)
          if (get().exercises.length) await get().pushAllToCloud()
          return
        }
        set({ ...out, syncError: null })
      },

      pushAllToCloud: async () => {
        if (!supabase) return
        pushing = true
        const snap = { exercises: get().exercises, sessions: get().sessions, cycles: get().cycles }
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
      partialize: (s) => ({ exercises: s.exercises, sessions: s.sessions, cycles: s.cycles }),
    },
  ),
)

export const useExercise = (id?: string) =>
  useStore((s) => s.exercises.find((e) => e.id === id))
