import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { AREE, AREA_COLOR, AREA_LABEL, OBIETTIVI, type Area, type Mesocycle, type Microcycle } from '../types'
import { Empty, PageHead } from '../components/common'
import { addDays, clone, cx, fmtDate, mondayOf, nowIso, todayStr, uid } from '../lib/util'
import { aggregate, mesoWeeks, pct } from '../lib/stats'
import { newSession } from './Sessions'

const GG = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function syncMicro(m: Mesocycle): Mesocycle {
  const n = mesoWeeks(m)
  const micro: Microcycle[] = []
  for (let w = 1; w <= n; w++) micro.push(m.micro.find((x) => x.week === w) ?? { week: w, focus: '', obiettivi: [] })
  return { ...m, micro }
}

export default function Planner() {
  const cycles = useStore((s) => s.cycles)
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const nav = useNavigate()
  const sorted = useMemo(() => [...cycles].sort((a, b) => b.inizio.localeCompare(a.inizio)), [cycles])
  const today = todayStr()
  const [selId, setSelId] = useState<string | null>(() => (cycles.find((c) => today >= c.inizio && today <= c.fine) ?? sorted[0])?.id ?? null)
  const stored = cycles.find((c) => c.id === selId)
  const [m, setM] = useState<Mesocycle | null>(stored ? syncMicro(clone(stored)) : null)
  const [days, setDays] = useState<number[]>([1, 3])

  useEffect(() => {
    setM(stored ? syncMicro(clone(stored)) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const save = (nm: Mesocycle) => {
    const s = syncMicro(nm)
    setM(s)
    upsert('cycles', s)
  }

  const create = () => {
    const start = mondayOf(today)
    const nm: Mesocycle = syncMicro({
      id: uid(),
      nome: `Meso ${cycles.length + 1}`,
      gruppo: '2017 Pulcini',
      inizio: start,
      fine: addDays(start, 27),
      obiettivoGenerale: '',
      target: { tecnica: 30, coordinativa: 15, situazioni: 20, finalizzazione: 10, partita: 25 },
      micro: [],
      updatedAt: nowIso(),
    })
    upsert('cycles', nm)
    setSelId(nm.id)
    setM(nm)
  }

  const inMeso = m ? sessions.filter((s) => s.data >= m.inizio && s.data <= m.fine && (!m.gruppo || s.gruppo === m.gruppo)) : []
  const done = inMeso.filter((s) => s.stato === 'svolta')
  const agg = aggregate(done, exMap)
  const targetSum = m ? AREE.reduce((a, k) => a + (m.target[k] ?? 0), 0) : 0

  const generate = () => {
    if (!m) return
    let created = 0
    for (const mc of m.micro) {
      const monday = addDays(mondayOf(m.inizio), (mc.week - 1) * 7)
      for (const d of days) {
        const date = addDays(monday, d - 1)
        if (date < m.inizio || date > m.fine) continue
        if (sessions.some((s) => s.data === date && s.gruppo === m.gruppo)) continue
        upsert('sessions', newSession(date, { gruppo: m.gruppo, titolo: mc.focus || `Settimana ${mc.week}`, obiettivo: mc.obiettivi.join(', ') }))
        created++
      }
    }
    alert(created ? `${created} sedute pianificate create.` : 'Nessuna nuova seduta: date già occupate.')
  }

  return (
    <div>
      <PageHead title="Planner" sub="Mesocicli → microcicli settimanali → sedute">
        <button className="btn primary" onClick={create}>
          + Nuovo mesociclo
        </button>
      </PageHead>

      <div className="chips-scroll mb">
        {sorted.map((c) => (
          <button key={c.id} className={cx('chip', c.id === selId && 'on')} onClick={() => setSelId(c.id)}>
            {c.nome} · {fmtDate(c.inizio, false).replace(/ \d{4}$/, '')}–{fmtDate(c.fine, false)}
          </button>
        ))}
      </div>

      {!m ? (
        <Empty>Nessun mesociclo. Creane uno per programmare gli obiettivi delle settimane.</Empty>
      ) : (
        <div className="planner-grid">
          <div className="stack">
            <section className="card stack">
              <input className="title-input" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} onBlur={() => save(m)} />
              <div className="head-grid">
                <label>
                  Inizio
                  <input type="date" value={m.inizio} onChange={(e) => save({ ...m, inizio: e.target.value })} />
                </label>
                <label>
                  Fine
                  <input type="date" value={m.fine} onChange={(e) => save({ ...m, fine: e.target.value })} />
                </label>
                <label>
                  Gruppo
                  <input value={m.gruppo} onChange={(e) => setM({ ...m, gruppo: e.target.value })} onBlur={() => save(m)} />
                </label>
                <label className="span2">
                  Obiettivo generale
                  <input value={m.obiettivoGenerale} onChange={(e) => setM({ ...m, obiettivoGenerale: e.target.value })} onBlur={() => save(m)} />
                </label>
              </div>
            </section>

            <section className="card">
              <div className="row between mb-s">
                <h3>Distribuzione target vs svolto</h3>
                <span className={cx('pill', targetSum === 100 ? 'ok' : 'warn')}>target {targetSum}%</span>
              </div>
              <div className="target-rows">
                {AREE.map((a) => {
                  const t = m.target[a] ?? 0
                  const real = pct(agg.perArea[a], agg.minutiTot)
                  return (
                    <div key={a} className="t-row">
                      <span className="t-lbl">
                        <i className="dot-c" style={{ background: AREA_COLOR[a] }} /> {AREA_LABEL[a]}
                      </span>
                      <input type="range" min={0} max={60} step={5} value={t} onChange={(e) => setM({ ...m, target: { ...m.target, [a]: Number(e.target.value) } as Partial<Record<Area, number>> })} onPointerUp={() => save(m)} onKeyUp={() => save(m)} />
                      <span className="t-val">{t}%</span>
                      <div className="t-bar">
                        <span className="t-real" style={{ width: `${Math.min(100, real)}%`, background: AREA_COLOR[a] }} />
                        <span className="t-mark" style={{ left: `${Math.min(100, t)}%` }} />
                      </div>
                      <span className={cx('t-val', Math.abs(real - t) > 10 && agg.minutiTot > 0 && 'over-txt')}>{real}%</span>
                    </div>
                  )
                })}
              </div>
              <p className="muted sm mt-s">
                Svolto: {done.length} sedute · {agg.minutiTot} min. Barra = svolto, tacca = target. Scostamento &gt;10% evidenziato.
              </p>
            </section>

            <section className="card">
              <h3>Genera sedute pianificate</h3>
              <div className="row wrap gap-xs mb-s">
                {GG.map((g, i) => (
                  <button key={g} className={cx('chip sm', days.includes(i + 1) && 'on')} onClick={() => setDays(days.includes(i + 1) ? days.filter((x) => x !== i + 1) : [...days, i + 1].sort())}>
                    {g}
                  </button>
                ))}
              </div>
              <button className="btn primary" onClick={generate} disabled={!days.length}>
                Crea sedute per tutte le settimane
              </button>
              <p className="muted sm mt-s">Titolo = focus del microciclo, obiettivo = obiettivi della settimana. Date già occupate saltate.</p>
              <button
                className="btn danger sm mt"
                onClick={() => {
                  if (confirm('Eliminare il mesociclo? Le sedute restano.')) {
                    remove('cycles', m.id)
                    setSelId(null)
                    setM(null)
                  }
                }}
              >
                Elimina mesociclo
              </button>
            </section>
          </div>

          <div className="stack">
            {m.micro.map((mc) => {
              const monday = addDays(mondayOf(m.inizio), (mc.week - 1) * 7)
              const weekSess = sessions.filter((s) => s.data >= monday && s.data <= addDays(monday, 6) && (!m.gruppo || s.gruppo === m.gruppo)).sort((a, b) => a.data.localeCompare(b.data))
              const isNow = today >= monday && today <= addDays(monday, 6)
              return (
                <section key={mc.week} className={cx('card micro', isNow && 'now')}>
                  <div className="row between wrap gap-s">
                    <h3>
                      Microciclo {mc.week} <span className="muted sm">{fmtDate(monday, false)} → {fmtDate(addDays(monday, 6), false)}</span>
                    </h3>
                    {isNow && <span className="pill ok">questa settimana</span>}
                  </div>
                  <input
                    value={mc.focus}
                    placeholder="Focus della settimana"
                    onChange={(e) => setM({ ...m, micro: m.micro.map((x) => (x.week === mc.week ? { ...x, focus: e.target.value } : x)) })}
                    onBlur={() => save(m)}
                  />
                  <div className="row wrap gap-xs mt-s">
                    {mc.obiettivi.map((o) => (
                      <button key={o} className="chip sm on" onClick={() => save({ ...m, micro: m.micro.map((x) => (x.week === mc.week ? { ...x, obiettivi: x.obiettivi.filter((y) => y !== o) } : x)) })}>
                        {o} ✕
                      </button>
                    ))}
                    <select
                      className="sm-select"
                      value=""
                      onChange={(e) => e.target.value && save({ ...m, micro: m.micro.map((x) => (x.week === mc.week ? { ...x, obiettivi: [...x.obiettivi, e.target.value] } : x)) })}
                    >
                      <option value="">+ obiettivo</option>
                      {OBIETTIVI.filter((o) => !mc.obiettivi.includes(o)).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="week-strip">
                    {GG.map((g, i) => {
                      const date = addDays(monday, i)
                      const ss = weekSess.filter((s) => s.data === date)
                      return (
                        <div key={g} className={cx('wday', date === today && 'today')}>
                          <small>
                            {g} {Number(date.slice(8))}
                          </small>
                          {ss.map((s) => (
                            <Link key={s.id} to={`/seduta/${s.id}`} className={cx('w-sess', s.stato)}>
                              {s.titolo}
                            </Link>
                          ))}
                          {!ss.length && date >= m.inizio && date <= m.fine && (
                            <button
                              className="w-add"
                              onClick={() => {
                                const s = newSession(date, { gruppo: m.gruppo, titolo: mc.focus || `Settimana ${mc.week}`, obiettivo: mc.obiettivi.join(', ') })
                                upsert('sessions', s)
                                nav(`/seduta/${s.id}`)
                              }}
                              aria-label={`Nuova seduta ${date}`}
                            >
                              +
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
