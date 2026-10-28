import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase finto: "rete" accesa/spenta, righe salvate in memoria
const net = { up: true }
const cloud = new Map<string, Map<string, unknown>>()
const table = (t: string) => {
  if (!cloud.has(t)) cloud.set(t, new Map())
  return cloud.get(t)!
}
const offline = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }

vi.mock('./lib/supabase', () => ({
  cloudEnabled: true,
  supabase: {
    from: (t: string) => ({
      upsert: async (row: { id: string; data: unknown } | { id: string; data: unknown }[]) => {
        if (!net.up) return offline
        for (const r of Array.isArray(row) ? row : [row]) table(t).set(r.id, r.data)
        return { data: null, error: null }
      },
      delete: () => ({
        eq: async (_c: string, id: string) => {
          if (!net.up) return offline
          table(t).delete(id)
          return { data: null, error: null }
        },
      }),
      select: async () => {
        if (!net.up) return offline
        return { data: [...table(t).values()].map((d) => ({ data: d, owner_id: null })), error: null }
      },
    }),
  },
}))

const { useStore } = await import('./store')
import type { Session } from './types'

const seduta = (id: string, titolo: string) =>
  ({ id, data: '2026-10-28', titolo, gruppo: '2017 Pulcini', items: [], stato: 'pianificata', updatedAt: '' }) as unknown as Session

describe('modifiche senza rete', () => {
  beforeEach(() => {
    net.up = true
    cloud.clear()
    // cloud non vuoto: niente caricamento automatico della libreria iniziale
    table('exercises').set('e0', { id: 'e0', title: 'x', updatedAt: '2026-01-01' })
    useStore.setState({ sessions: [], queue: {}, syncError: null, cloudSeedVersion: 99 })
  })

  it('resta in coda offline e arriva al cloud al ritorno della rete', async () => {
    net.up = false
    useStore.getState().upsert('sessions', seduta('s1', 'Fatta in campo'))
    await useStore.getState().flush()
    expect(Object.keys(useStore.getState().queue)).toHaveLength(1)
    expect(table('sessions').has('s1')).toBe(false)
    expect(useStore.getState().syncError).toBeNull()

    net.up = true
    await useStore.getState().flush()
    expect(useStore.getState().queue).toEqual({})
    expect((table('sessions').get('s1') as Session).titolo).toBe('Fatta in campo')
  })

  it('il ricaricamento dal cloud non cancella le modifiche fatte offline', async () => {
    table('sessions').set('s1', seduta('s1', 'Versione cloud vecchia'))
    useStore.setState({ sessions: [seduta('s1', 'Versione cloud vecchia')] })

    net.up = false
    useStore.getState().upsert('sessions', seduta('s1', 'Modificata offline'))
    await useStore.getState().pullCloud() // fallisce: niente rete
    expect(useStore.getState().sessions[0].titolo).toBe('Modificata offline')

    net.up = true
    await useStore.getState().pullCloud()
    expect(useStore.getState().sessions[0].titolo).toBe('Modificata offline')
    expect((table('sessions').get('s1') as Session).titolo).toBe('Modificata offline')
    expect(useStore.getState().queue).toEqual({})
  })

  it('cancellazione offline applicata al ritorno della rete', async () => {
    table('sessions').set('s2', seduta('s2', 'Da togliere'))
    useStore.setState({ sessions: [seduta('s2', 'Da togliere')] })
    net.up = false
    useStore.getState().remove('sessions', 's2')
    await useStore.getState().flush()
    expect(table('sessions').has('s2')).toBe(true)
    net.up = true
    await useStore.getState().pullCloud()
    expect(table('sessions').has('s2')).toBe(false)
    expect(useStore.getState().sessions).toEqual([])
  })
})
