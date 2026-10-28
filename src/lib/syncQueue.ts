/** Coda delle modifiche locali non ancora salvate sul cloud (campo senza rete, connessione che cade).
 *  Una voce per riga: conta solo l'ultima operazione su quella riga. */

export type QueueOp = 'upsert' | 'delete'

export interface QueueEntry {
  k: string
  id: string
  op: QueueOp
  /** istante della modifica locale: la voce si toglie solo se nel frattempo non è cambiata */
  at: string
}

export type Queue = Record<string, QueueEntry>

export const qkey = (k: string, id: string) => `${k}:${id}`

export function enqueue(q: Queue, e: QueueEntry): Queue {
  return { ...q, [qkey(e.k, e.id)]: e }
}

/** toglie la voce solo se è ancora quella inviata (una modifica arrivata durante l'invio resta in coda) */
export function settle(q: Queue, e: QueueEntry): Queue {
  const key = qkey(e.k, e.id)
  const cur = q[key]
  if (!cur || cur.at !== e.at || cur.op !== e.op) return q
  const next = { ...q }
  delete next[key]
  return next
}

/** righe arrivate dal cloud + modifiche locali in coda: le modifiche locali vincono */
export function overlay<T extends { id: string }>(cloud: T[], local: T[], q: Queue, k: string): T[] {
  const pending = Object.values(q).filter((e) => e.k === k)
  if (!pending.length) return cloud
  const del = new Set(pending.filter((e) => e.op === 'delete').map((e) => e.id))
  const ups = new Map(local.filter((x) => pending.some((e) => e.op === 'upsert' && e.id === x.id)).map((x) => [x.id, x]))
  const out = cloud.filter((x) => !del.has(x.id)).map((x) => ups.get(x.id) ?? x)
  for (const [id, x] of ups) if (!cloud.some((c) => c.id === id)) out.push(x)
  return out
}

/** errore temporaneo (rete assente, sessione scaduta offline): la voce resta in coda e si riprova */
export function isRetryable(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  if (!err.code) return true
  if (err.code.startsWith('PGRST3')) return true // token JWT scaduto/non valido: si rinnova al ritorno online
  return /fetch|network|load failed|timeout/i.test(err.message ?? '')
}

export const queueSize = (q: Queue) => Object.keys(q).length
