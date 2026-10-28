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
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, type Table } from './lib/supabase'
import { nowIso } from './lib/util'
import { enqueue, isRetryable, overlay, settle, type Queue, type QueueEntry } from './lib/syncQueue'

type Entity = Exercise | Session | Mesocycle | Match | Player | Evaluation
type Key = keyof DB

interface State extends DB {
  seedVersion: number
  cloudSeedVersion: number
  userId: string | null
  syncError: string | null
  /** modifiche locali non ancora salvate sul cloud */
  queue: Queue
  /** invia la coda al cloud; senza rete resta in attesa */
  flush: () => Promise<void>
  setUser: (id: string | null) => void
  upsert: <K extends Key>(k: K, v: DB[K][number]) => void
  remove: (k: Key, id: string) => void
  replaceAll: (db: Partial<DB>) => void
  resetSeed: () => void
  pullCloud: () => Promise<void>
  pushAllToCloud: () => Promise<void>
  /** applica un evento realtime; false = payload incompleto, serve un pullCloud */
  applyRemote: (k: Key, p: RealtimePostgresChangesPayload<Record<string, unknown>>) => boolean
}

/** riusa gli oggetti già in memoria se non sono cambiati: i componenti memo (campetti) non si ridisegnano */
function keepSame<T extends Entity>(prev: T[], next: T[]): T[] {
  const old = new Map(prev.map((x) => [x.id, x]))
  let same = prev.length === next.length
  const out = next.map((x, i) => {
    const o = old.get(x.id)
    const keep = o && o.updatedAt === x.updatedAt && o.ownerId === x.ownerId ? o : x
    if (keep !== prev[i]) same = false
    return keep
  })
  return same ? prev : out
}

const TABLE: Record<Key, Table> = { exercises: 'exercises', sessions: 'sessions', cycles: 'cycles', matches: 'matches', players: 'players', evaluations: 'evaluations' }

let pushing = false
let seededOnce = false
let flushing: Promise<void> | null = null

/** invia una voce della coda; true = fatto (o da scartare), false = riprovare più tardi */
async function send(e: QueueEntry): Promise<boolean> {
  if (!supabase) return true
  const k = e.k as Key
  if (e.op === 'delete') {
    const { error } = await supabase.from(TABLE[k]).delete().eq('id', e.id)
    if (error && isRetryable(error)) return false
    if (error) useStore.setState({ syncError: error.message })
    return true
  }
  const v = (useStore.getState()[k] as Entity[]).find((x) => x.id === e.id)
  if (!v) return true // riga eliminata nel frattempo: ci pensa la voce di cancellazione
  const { error } = await supabase.from(TABLE[k]).upsert({ id: v.id, data: v, updated_at: v.updatedAt })
  if (error && isRetryable(error)) return false
  if (error) useStore.setState({ syncError: error.message })
  return true
}

async function runFlush() {
  if (!supabase) return
  for (;;) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const entries = Object.values(useStore.getState().queue)
    if (!entries.length) return
    let sent = 0
    for (const e of entries) {
      if (!(await send(e))) return // rete assente: si riprova al ritorno online
      useStore.setState((s) => ({ queue: settle(s.queue, e) }))
      sent++
    }
    if (!sent) return
  }
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
      queue: {},

      flush: () => {
        if (!flushing) flushing = runFlush().finally(() => (flushing = null))
        return flushing
      },
      setUser: (id) => set({ userId: id }),

      upsert: (k, v) => {
        const ent = { ...(v as Entity), updatedAt: nowIso() } as Entity
        if (!ent.ownerId && get().userId) ent.ownerId = get().userId!
        const list = get()[k] as Entity[]
        const i = list.findIndex((x) => x.id === ent.id)
        const next = i >= 0 ? list.map((x) => (x.id === ent.id ? ent : x)) : [...list, ent]
        set({ [k]: next, queue: supabase ? enqueue(get().queue, { k, id: ent.id, op: 'upsert', at: ent.updatedAt }) : get().queue } as Partial<State>)
        void get().flush()
      },

      remove: (k, id) => {
        const list = get()[k] as Entity[]
        set({ [k]: list.filter((x) => x.id !== id), queue: supabase ? enqueue(get().queue, { k, id, op: 'delete', at: nowIso() }) : get().queue } as Partial<State>)
        if (k === 'exercises') {
          // pulisci riferimenti nelle sedute
          get().sessions.forEach((s) => {
            if (s.items.some((it) => it.exerciseId === id)) {
              get().upsert('sessions', { ...s, items: s.items.filter((it) => it.exerciseId !== id) })
            }
          })
        }
        void get().flush()
      },

      replaceAll: (db) => set({ ...db }),

      resetSeed: () =>
        set({ exercises: SEED_EXERCISES, sessions: SEED_SESSIONS, cycles: SEED_CYCLES, seedVersion: SEED_VERSION }),

      pullCloud: async () => {
        if (!supabase || pushing) return
        // prima le modifiche fatte senza rete, così il cloud è aggiornato
        await get().flush()
        const out: Partial<DB> = {}
        const keys = Object.keys(TABLE) as Key[]
        const res = await Promise.all(keys.map((k) => supabase!.from(TABLE[k]).select('data, owner_id')))
        for (const [i, k] of keys.entries()) {
          const { data, error } = res[i]
          if (error) {
            set({ syncError: error.message })
            return
          }
          const rows: Entity[] = (data ?? []).map((r) => ({ ...(r.data as Entity), ownerId: r.owner_id }))
          // modifiche locali ancora in coda (rete caduta durante l'invio): non vanno perse
          const merged = overlay(rows, get()[k] as Entity[], get().queue, k)
          ;(out as Record<Key, Entity[]>)[k] = keepSame(get()[k] as Entity[], merged)
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

      applyRemote: (k, p) => {
        const list = get()[k] as Entity[]
        const rid = ((p.new as { id?: string } | undefined)?.id ?? (p.old as { id?: string } | undefined)?.id) as string | undefined
        // riga con una modifica locale non ancora inviata: vale la versione locale
        if (rid && get().queue[`${k}:${rid}`]) return true
        if (p.eventType === 'DELETE') {
          const id = p.old?.id as string | undefined
          if (!id) return false
          if (list.some((x) => x.id === id)) set({ [k]: list.filter((x) => x.id !== id) } as Partial<State>)
          return true
        }
        const row = p.new as { data?: Entity; owner_id?: string } | undefined
        if (!row?.data?.id) return false
        const ent = { ...row.data, ownerId: row.owner_id } as Entity
        const i = list.findIndex((x) => x.id === ent.id)
        // eco di una modifica locale, o evento più vecchio di quanto già in memoria
        if (i >= 0 && list[i].updatedAt >= ent.updatedAt) return true
        set({ [k]: i >= 0 ? list.map((x, j) => (j === i ? ent : x)) : [...list, ent] } as Partial<State>)
        return true
      },
    }),
    {
      name: 'gsd-coach-db-v1',
      version: 4,
      partialize: (s) => ({ exercises: s.exercises, sessions: s.sessions, cycles: s.cycles, matches: s.matches, players: s.players, evaluations: s.evaluations, seedVersion: s.seedVersion, cloudSeedVersion: s.cloudSeedVersion, queue: s.queue }),
      // dati salvati prima della libreria estesa: seedVersion assente = 1
      migrate: (persisted) => {
        const p = persisted as Partial<State>
        return { ...p, matches: p.matches ?? [], players: p.players ?? [], evaluations: p.evaluations ?? [], seedVersion: p.seedVersion ?? 1, cloudSeedVersion: p.cloudSeedVersion ?? 1, queue: p.queue ?? {} } as State
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

// ritorno della rete: invia le modifiche fatte offline; controllo periodico finché la coda non è vuota
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void useStore.getState().flush())
  setInterval(() => {
    if (Object.keys(useStore.getState().queue).length) void useStore.getState().flush()
  }, 30_000)
}
