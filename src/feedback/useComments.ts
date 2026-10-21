import { useCallback, useEffect, useState } from 'react'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { authState } from '../components/AuthGate'

export type TargetType = 'session' | 'exercise'
export type Tipo = 'commento' | 'spunto' | 'modifica'

export interface Comment {
  id: string
  target_type: TargetType
  target_id: string
  author_id: string
  author_name: string
  tipo: Tipo
  body: string
  risolto: boolean
  created_at: string
}

export const TIPO_LABEL: Record<Tipo, string> = {
  commento: 'Commento',
  spunto: 'Spunto',
  modifica: 'Proposta di modifica',
}

// ---------- "letti": per mister, in questo browser ----------
const SEEN_KEY = 'gsd-feedback-visto'
function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}

interface FeedState {
  recent: Comment[]
  seen: Record<string, string>
  error: string | null
  loadRecent: () => Promise<void>
  markSeen: (key: string) => void
}

/** Ultimi feedback di tutto lo staff (per Home e contatori). */
export const useFeed = create<FeedState>((set, get) => ({
  recent: [],
  seen: readSeen(),
  error: null,
  loadRecent: async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) set({ error: error.message })
    else set({ recent: (data as Comment[]) ?? [], error: null })
  },
  markSeen: (key) => {
    const seen = { ...get().seen, [key]: new Date().toISOString() }
    set({ seen })
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
    } catch {
      /* storage non disponibile */
    }
  },
}))

export const targetKey = (t: TargetType, id: string) => `${t}:${id}`

/** Feedback non letti scritti da altri mister. */
export function unreadOf(list: Comment[], seen: Record<string, string>, me?: string | null, key?: string) {
  return list.filter((c) => {
    if (c.author_id === me) return false
    const k = targetKey(c.target_type, c.target_id)
    if (key && k !== key) return false
    const s = seen[k]
    return !s || c.created_at > s
  })
}

let channelStarted = false
/** Avvia una sola volta l'ascolto in tempo reale dei feedback. */
export function startFeedRealtime() {
  if (!supabase || channelStarted) return
  channelStarted = true
  void useFeed.getState().loadRecent()
  supabase
    .channel('comments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => void useFeed.getState().loadRecent())
    .subscribe()
}

/** Feedback di una seduta o di un esercizio. */
export function useComments(type: TargetType, id: string | undefined) {
  const recent = useFeed((s) => s.recent)
  const [list, setList] = useState<Comment[]>([])
  const [loading, setLoading] = useState(!!supabase)

  const load = useCallback(async () => {
    if (!supabase || !id) return
    const { data } = await supabase.from('comments').select('*').eq('target_type', type).eq('target_id', id).order('created_at')
    setList((data as Comment[]) ?? [])
    setLoading(false)
  }, [type, id])

  // ricarica quando arriva un cambiamento in tempo reale
  useEffect(() => {
    void load()
  }, [load, recent])

  const add = async (body: string, tipo: Tipo) => {
    if (!supabase || !id) return 'Cloud non attivo'
    const m = authState.member
    const { error } = await supabase.from('comments').insert({ target_type: type, target_id: id, body: body.trim(), tipo, author_name: m?.nome || m?.email || 'Mister' })
    if (error) return error.message
    await load()
    void useFeed.getState().loadRecent()
    return null
  }
  const setRisolto = async (c: Comment, risolto: boolean) => {
    if (!supabase) return
    setList((l) => l.map((x) => (x.id === c.id ? { ...x, risolto } : x)))
    await supabase.from('comments').update({ risolto }).eq('id', c.id)
    void useFeed.getState().loadRecent()
  }
  const remove = async (c: Comment) => {
    if (!supabase) return
    setList((l) => l.filter((x) => x.id !== c.id))
    await supabase.from('comments').delete().eq('id', c.id)
    void useFeed.getState().loadRecent()
  }
  return { list, loading, add, setRisolto, remove }
}
