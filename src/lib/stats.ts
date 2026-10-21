import type { Area, Exercise, Mesocycle, Session } from '../types'
import { AREE } from '../types'
import { mondayOf, weeksBetween } from './util'

export function findMeso(cycles: Mesocycle[], date: string, gruppo?: string) {
  const m = cycles.find((c) => date >= c.inizio && date <= c.fine && (!gruppo || !c.gruppo || c.gruppo === gruppo))
  if (!m) return null
  const week = weeksBetween(m.inizio, date)
  return { meso: m, week, micro: m.micro.find((x) => x.week === week) }
}

export function mesoWeeks(m: Mesocycle) {
  return Math.max(1, weeksBetween(m.inizio, m.fine))
}

export function weekStart(m: Mesocycle, week: number) {
  const base = mondayOf(m.inizio)
  const d = new Date(base)
  d.setDate(d.getDate() + (week - 1) * 7)
  return d
}

export interface Agg {
  minutiTot: number
  sedute: number
  perArea: Record<Area, number>
  perObiettivo: Record<string, number>
  perEsercizio: Record<string, { n: number; min: number }>
}

/** Minuti per area/obiettivo. I minuti di un esercizio sono divisi tra i suoi obiettivi. */
export function aggregate(sessions: Session[], exMap: Map<string, Exercise>): Agg {
  const perArea = Object.fromEntries(AREE.map((a) => [a, 0])) as Record<Area, number>
  const perObiettivo: Record<string, number> = {}
  const perEsercizio: Record<string, { n: number; min: number }> = {}
  let minutiTot = 0
  for (const s of sessions) {
    for (const it of s.items) {
      const e = exMap.get(it.exerciseId)
      if (!e) continue
      minutiTot += it.minuti
      perArea[e.area] += it.minuti
      const share = e.obiettivi.length ? it.minuti / e.obiettivi.length : 0
      for (const o of e.obiettivi) perObiettivo[o] = (perObiettivo[o] ?? 0) + share
      const pe = (perEsercizio[e.id] ??= { n: 0, min: 0 })
      pe.n++
      pe.min += it.minuti
    }
  }
  return { minutiTot, sedute: sessions.length, perArea, perObiettivo, perEsercizio }
}

export const pct = (v: number, tot: number) => (tot ? Math.round((v / tot) * 100) : 0)
