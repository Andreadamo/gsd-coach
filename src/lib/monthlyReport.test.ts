import { describe, expect, it } from 'vitest'
import { buildMonthlyReport, monthRange } from './monthlyReport'
import { SEED_CYCLES, SEED_EXERCISES } from '../data/seed'
import type { Session } from '../types'

const ex = SEED_EXERCISES
const sess = (id: string, data: string, stato: Session['stato'], ids: string[], presentiIds?: string[]): Session => ({
  id,
  data,
  titolo: id,
  gruppo: '2017 Pulcini',
  durataTarget: 90,
  obiettivo: '',
  stato,
  presentiIds,
  items: ids.map((e, i) => ({ uid: id + i, exerciseId: e, fase: 'centrale', minuti: 20 })),
  updatedAt: '',
})

describe('monthlyReport', () => {
  it('monthRange', () => {
    expect(monthRange('2026-02')).toEqual(['2026-02-01', '2026-02-28'])
    expect(monthRange('2026-10')).toEqual(['2026-10-01', '2026-10-31'])
  })

  it('conta solo sedute svolte nel periodo e calcola presenze', () => {
    const players = ['a', 'b'].map((id) => ({ id, nome: id, cognome: id, annata: 2017, gruppo: '2017 Pulcini', attivo: true, updatedAt: '' }))
    const sessions = [
      sess('s1', '2026-10-06', 'svolta', [ex[0].id, ex[1].id], ['a', 'b']),
      sess('s2', '2026-10-08', 'svolta', [ex[0].id], ['a']),
      sess('s3', '2026-10-10', 'pianificata', [ex[2].id]),
      sess('s4', '2026-11-20', 'svolta', [ex[2].id]),
    ]
    const r = buildMonthlyReport({ sessions, exercises: ex, cycles: SEED_CYCLES, matches: [], players }, '2026-10-06', '2026-11-09')
    expect(r.done.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(r.nonSvolte.map((s) => s.id)).toEqual(['s3'])
    expect(r.agg.minutiTot).toBe(60)
    expect(r.presenzeMedie).toBe(1.5)
    expect(r.giocatori.find((g) => g.player.id === 'b')?.perc).toBe(50)
    expect(r.settimane[0].sedute).toBe(2)
    expect(r.esercizi[0].n).toBe(2)
    expect(r.mesocicli).toHaveLength(1)
    expect(r.aree.every((a) => a.target !== null)).toBe(true)
  })
})
