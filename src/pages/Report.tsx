import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { AREE, AREA_COLOR, AREA_LABEL, OBIETTIVI } from '../types'
import { PageHead } from '../components/common'
import { aggregate, pct } from '../lib/stats'
import { addDays, fmtDate, monthKey, monthLabel, todayStr } from '../lib/util'

type Period = 'mese' | '3mesi' | 'stagione' | 'meso' | 'custom'

function seasonStart(today: string) {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  return `${m >= 8 ? y : y - 1}-08-01`
}

export default function Report() {
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  const cycles = useStore((s) => s.cycles)
  const today = todayStr()
  const [period, setPeriod] = useState<Period>('stagione')
  const [mesoId, setMesoId] = useState(cycles[0]?.id ?? '')
  const [from, setFrom] = useState(addDays(today, -30))
  const [to, setTo] = useState(today)
  const gruppi = useMemo(() => [...new Set(sessions.map((s) => s.gruppo))], [sessions])
  const [gruppo, setGruppo] = useState('')

  const range = useMemo((): [string, string] => {
    if (period === 'mese') return [today.slice(0, 8) + '01', today]
    if (period === '3mesi') return [addDays(today, -90), today]
    if (period === 'stagione') return [seasonStart(today), today]
    if (period === 'meso') {
      const m = cycles.find((c) => c.id === mesoId)
      return m ? [m.inizio, m.fine] : [today, today]
    }
    return [from, to]
  }, [period, today, cycles, mesoId, from, to])

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const done = useMemo(
    () => sessions.filter((s) => s.stato === 'svolta' && s.data >= range[0] && s.data <= range[1] && (!gruppo || s.gruppo === gruppo)).sort((a, b) => a.data.localeCompare(b.data)),
    [sessions, range, gruppo],
  )
  const planned = sessions.filter((s) => s.stato === 'pianificata' && s.data >= range[0] && s.data <= range[1] && (!gruppo || s.gruppo === gruppo))
  const agg = useMemo(() => aggregate(done, exMap), [done, exMap])

  const areaData = AREE.map((a) => ({ name: AREA_LABEL[a].split(' ')[0], area: a, min: agg.perArea[a], pct: pct(agg.perArea[a], agg.minutiTot) })).filter((x) => x.min > 0)

  const monthData = useMemo(() => {
    const m = new Map<string, Record<string, number>>()
    for (const s of done) {
      const k = monthKey(s.data)
      const row = m.get(k) ?? {}
      for (const it of s.items) {
        const e = exMap.get(it.exerciseId)
        if (e) row[e.area] = (row[e.area] ?? 0) + it.minuti
      }
      m.set(k, row)
    }
    return [...m.entries()].sort().map(([k, v]) => ({ mese: monthLabel(k), ...v }))
  }, [done, exMap])

  const obData = Object.entries(agg.perObiettivo)
    .map(([o, v]) => ({ o, min: Math.round(v) }))
    .sort((a, b) => b.min - a.min)
  const mai = OBIETTIVI.filter((o) => !agg.perObiettivo[o])
  const topEx = Object.entries(agg.perEsercizio)
    .map(([id, v]) => ({ e: exMap.get(id)!, ...v }))
    .filter((x) => x.e)
    .sort((a, b) => b.min - a.min)
    .slice(0, 8)
  const presenze = done.filter((s) => s.presenti).map((s) => s.presenti!)
  const avgPres = presenze.length ? Math.round((presenze.reduce((a, b) => a + b, 0) / presenze.length) * 10) / 10 : null

  // confronto con target del meso (se periodo = meso)
  const meso = period === 'meso' ? cycles.find((c) => c.id === mesoId) : undefined
  const scost = meso
    ? AREE.map((a) => ({ a, t: meso.target[a] ?? 0, r: pct(agg.perArea[a], agg.minutiTot) }))
        .map((x) => ({ ...x, d: x.r - x.t }))
        .filter((x) => Math.abs(x.d) >= 10)
    : []

  const top = [...areaData].sort((a, b) => b.min - a.min)[0]
  const summary = done.length
    ? [
        `${done.length} sedute svolte, ${agg.minutiTot} minuti di lavoro (media ${Math.round(agg.minutiTot / done.length)}′/seduta).`,
        top ? `Area prevalente: ${AREA_LABEL[top.area]} (${top.pct}%).` : '',
        obData.length ? `Obiettivi più allenati: ${obData.slice(0, 3).map((x) => x.o).join(', ')}.` : '',
        scost.length ? `Scostamenti dal target: ${scost.map((x) => `${AREA_LABEL[x.a]} ${x.d > 0 ? '+' : ''}${x.d}%`).join(', ')}.` : meso ? 'Distribuzione in linea con il target del mesociclo.' : '',
        mai.length ? `Mai allenati nel periodo: ${mai.slice(0, 8).join(', ')}${mai.length > 8 ? '…' : ''}.` : '',
      ].filter(Boolean)
    : []

  return (
    <div className="report">
      <PageHead title="Report" sub={`${fmtDate(range[0], false)} → ${fmtDate(range[1], false)}`}>
        <button className="btn no-print" onClick={() => window.print()}>
          ⎙ Stampa report
        </button>
      </PageHead>

      <div className="card row wrap gap-s mb no-print">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          <option value="mese">Mese corrente</option>
          <option value="3mesi">Ultimi 3 mesi</option>
          <option value="stagione">Stagione</option>
          <option value="meso">Mesociclo</option>
          <option value="custom">Personalizzato</option>
        </select>
        {period === 'meso' && (
          <select value={mesoId} onChange={(e) => setMesoId(e.target.value)}>
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <select value={gruppo} onChange={(e) => setGruppo(e.target.value)}>
          <option value="">Tutti i gruppi</option>
          {gruppi.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="kpis">
        <div className="kpi">
          <small>Sedute svolte</small>
          <b>{done.length}</b>
          <span className="muted sm">+{planned.length} pianificate</span>
        </div>
        <div className="kpi">
          <small>Minuti allenati</small>
          <b>{agg.minutiTot}</b>
          <span className="muted sm">{done.length ? Math.round(agg.minutiTot / done.length) : 0}′ medi</span>
        </div>
        <div className="kpi">
          <small>Presenze medie</small>
          <b>{avgPres ?? '—'}</b>
        </div>
        <div className="kpi">
          <small>Esercizi diversi</small>
          <b>{Object.keys(agg.perEsercizio).length}</b>
          <span className="muted sm">su {exercises.length} in libreria</span>
        </div>
      </div>

      {summary.length > 0 ? (
        <section className="card summary mb">
          <h3>Sintesi automatica</h3>
          <ul>
            {summary.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="card mb">
          <p className="muted">Nessuna seduta segnata come “svolta” nel periodo. Imposta lo stato nella seduta per includerla nel report.</p>
        </section>
      )}

      <div className="report-grid">
        <section className="card">
          <h3>Minuti per area</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={areaData} layout="vertical" margin={{ left: 8, right: 30 }}>
                <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, _n, p) => [`${v}′ (${(p.payload as { pct: number }).pct}%)`, 'Minuti']} />
                <Bar dataKey="min" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, formatter: (v: unknown) => `${v}′` }}>
                  {areaData.map((d) => (
                    <Cell key={d.area} fill={AREA_COLOR[d.area]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <h3>Andamento mensile</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={monthData}>
                <CartesianGrid vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="mese" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                {AREE.map((a, i) => (
                  <Bar key={a} dataKey={a} name={AREA_LABEL[a]} stackId="m" fill={AREA_COLOR[a]} radius={i === AREE.length - 1 ? [4, 4, 0, 0] : undefined} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="row wrap gap-s sm">
            {AREE.map((a) => (
              <span key={a} className="muted">
                <i className="dot-c" style={{ background: AREA_COLOR[a] }} /> {AREA_LABEL[a].split(' ')[0]}
              </span>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Obiettivi allenati (minuti)</h3>
          <div className="ob-list">
            {obData.map((x) => (
              <div key={x.o} className="ob-row">
                <span>{x.o}</span>
                <div className="ob-bar">
                  <span style={{ width: `${(x.min / (obData[0]?.min || 1)) * 100}%` }} />
                </div>
                <b>{x.min}′</b>
              </div>
            ))}
            {!obData.length && <p className="muted">—</p>}
          </div>
          {mai.length > 0 && done.length > 0 && (
            <p className="muted sm mt-s">
              <b>Mai allenati:</b> {mai.join(', ')}
            </p>
          )}
        </section>

        <section className="card">
          <h3>Esercizi più usati</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Esercizio</th>
                <th>Volte</th>
                <th>Min</th>
              </tr>
            </thead>
            <tbody>
              {topEx.map((x) => (
                <tr key={x.e.id}>
                  <td>
                    <Link to={`/esercizio/${x.e.id}`}>
                      <b>{x.e.code}</b> {x.e.title}
                    </Link>
                  </td>
                  <td>{x.n}</td>
                  <td>{x.min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card span-all">
          <h3>Registro sedute</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Data</th>
                <th>Seduta</th>
                <th>Aree</th>
                <th>Min</th>
                <th>Presenti</th>
              </tr>
            </thead>
            <tbody>
              {done.map((s) => {
                const areas = [...new Set(s.items.map((i) => exMap.get(i.exerciseId)?.area).filter(Boolean))] as (typeof AREE)[number][]
                return (
                  <tr key={s.id}>
                    <td>{fmtDate(s.data)}</td>
                    <td>
                      <Link to={`/seduta/${s.id}`}>{s.titolo}</Link>
                    </td>
                    <td>
                      {areas.map((a) => (
                        <i key={a} className="dot-c" title={AREA_LABEL[a]} style={{ background: AREA_COLOR[a] }} />
                      ))}
                    </td>
                    <td>{s.items.reduce((a, b) => a + b.minuti, 0)}</td>
                    <td>{s.presenti ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
