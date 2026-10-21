import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Empty, PageHead } from '../components/common'
import { cx, fmtDate, monthKey, monthLabel, nowIso, todayStr, uid } from '../lib/util'
import type { Session } from '../types'

export function newSession(data: string, extra?: Partial<Session>): Session {
  return {
    id: uid(),
    data,
    titolo: 'Nuova seduta',
    gruppo: '2017 Pulcini',
    durataTarget: 90,
    obiettivo: '',
    items: [],
    stato: 'pianificata',
    updatedAt: nowIso(),
    ...extra,
  }
}

export function sessionMinutes(s: Session) {
  return s.items.reduce((a, b) => a + b.minuti, 0)
}

export default function Sessions() {
  const sessions = useStore((s) => s.sessions)
  const upsert = useStore((s) => s.upsert)
  const nav = useNavigate()
  const [filter, setFilter] = useState<'tutte' | 'pianificata' | 'svolta'>('tutte')

  const groups = useMemo(() => {
    const list = sessions.filter((s) => filter === 'tutte' || s.stato === filter).sort((a, b) => b.data.localeCompare(a.data))
    const m = new Map<string, Session[]>()
    list.forEach((s) => {
      const k = monthKey(s.data)
      m.set(k, [...(m.get(k) ?? []), s])
    })
    return [...m.entries()]
  }, [sessions, filter])

  const create = () => {
    const s = newSession(todayStr())
    upsert('sessions', s)
    nav(`/seduta/${s.id}`)
  }

  return (
    <div>
      <PageHead title="Sedute" sub={`${sessions.length} sedute totali`}>
        <div className="seg">
          {(['tutte', 'pianificata', 'svolta'] as const).map((f) => (
            <button key={f} className={cx(filter === f && 'on')} onClick={() => setFilter(f)}>
              {f === 'tutte' ? 'Tutte' : f === 'pianificata' ? 'Pianificate' : 'Svolte'}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={create}>
          + Nuova seduta
        </button>
      </PageHead>
      {groups.length === 0 && <Empty>Nessuna seduta. Creane una o generala dal Planner.</Empty>}
      {groups.map(([k, list]) => (
        <section key={k} className="mb">
          <h3 className="month-h">{monthLabel(k)}</h3>
          <div className="list">
            {list.map((s) => {
              const tot = sessionMinutes(s)
              return (
                <Link key={s.id} to={`/seduta/${s.id}`} className="list-row">
                  <div className="date-box">
                    <b>{Number(s.data.slice(8))}</b>
                    <small>{fmtDate(s.data).split(' ')[0]}</small>
                  </div>
                  <div className="grow">
                    <div className="row gap-s wrap">
                      <b>{s.titolo}</b>
                      <span className={cx('pill', s.stato === 'svolta' ? 'ok' : 'plan')}>{s.stato}</span>
                    </div>
                    <div className="muted sm">
                      {s.gruppo} · {s.items.length} esercizi · {s.obiettivo || '—'}
                    </div>
                  </div>
                  <div className={cx('mins', tot > s.durataTarget && 'over')}>
                    {tot}/{s.durataTarget}′
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
