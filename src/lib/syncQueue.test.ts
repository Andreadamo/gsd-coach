import { describe, expect, it } from 'vitest'
import { enqueue, isRetryable, overlay, qkey, settle, type Queue } from './syncQueue'

const e = (id: string, op: 'upsert' | 'delete' = 'upsert', at = 't1') => ({ k: 'sessions', id, op, at })

describe('coda di sincronizzazione', () => {
  it('tiene solo l’ultima operazione per riga', () => {
    let q: Queue = {}
    q = enqueue(q, e('a', 'upsert', 't1'))
    q = enqueue(q, e('a', 'delete', 't2'))
    expect(Object.keys(q)).toEqual([qkey('sessions', 'a')])
    expect(q[qkey('sessions', 'a')].op).toBe('delete')
  })

  it('non toglie una voce modificata durante l’invio', () => {
    const sent = e('a', 'upsert', 't1')
    const q = enqueue({}, e('a', 'upsert', 't2'))
    expect(settle(q, sent)).toBe(q)
    expect(settle(q, e('a', 'upsert', 't2'))).toEqual({})
  })

  it('le modifiche locali in coda vincono sul cloud', () => {
    const cloud = [
      { id: 'a', v: 'cloud' },
      { id: 'b', v: 'cloud' },
      { id: 'c', v: 'cloud' },
    ]
    const local = [
      { id: 'a', v: 'locale' },
      { id: 'c', v: 'cloud' },
      { id: 'n', v: 'nuova offline' },
    ]
    let q: Queue = {}
    q = enqueue(q, e('a'))
    q = enqueue(q, e('b', 'delete'))
    q = enqueue(q, e('n'))
    expect(overlay(cloud, local, q, 'sessions')).toEqual([
      { id: 'a', v: 'locale' },
      { id: 'c', v: 'cloud' },
      { id: 'n', v: 'nuova offline' },
    ])
  })

  it('coda vuota: restituisce le righe del cloud così come sono', () => {
    const cloud = [{ id: 'a' }]
    expect(overlay(cloud, [], {}, 'sessions')).toBe(cloud)
    expect(overlay(cloud, [], enqueue({}, { k: 'exercises', id: 'x', op: 'delete', at: 't' }), 'sessions')).toBe(cloud)
  })

  it('riconosce gli errori di rete da riprovare', () => {
    expect(isRetryable({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true)
    expect(isRetryable({ message: 'JWT expired', code: 'PGRST301' })).toBe(true)
    expect(isRetryable({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false)
    expect(isRetryable(null)).toBe(false)
  })
})
