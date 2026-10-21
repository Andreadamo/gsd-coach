import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { AREA_COLOR, AREA_LABEL } from '../types'
import { aggregate, findMeso, pct } from '../lib/stats'
import { fmtDate, todayStr } from '../lib/util'
import { ExerciseCard } from '../components/common'
import { newSession, sessionMinutes } from './Sessions'
import { RecentFeedback } from '../feedback/RecentFeedback'

export default function Home() {
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  const cycles = useStore((s) => s.cycles)
  const upsert = useStore((s) => s.upsert)
  const nav = useNavigate()
  const today = todayStr()
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const next = sessions.filter((s) => s.data >= today && s.stato === 'pianificata').sort((a, b) => a.data.localeCompare(b.data))[0]
  const ctx = findMeso(cycles, today)
  const monthDone = sessions.filter((s) => s.stato === 'svolta' && s.data.slice(0, 7) === today.slice(0, 7))
  const agg = aggregate(monthDone, exMap)
  const recent = [...exercises].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)

  const quickSession = () => {
    const s = newSession(today, ctx ? { titolo: ctx.micro?.focus || 'Nuova seduta', gruppo: ctx.meso.gruppo, obiettivo: ctx.micro?.obiettivi.join(', ') ?? '' } : undefined)
    upsert('sessions', s)
    nav(`/seduta/${s.id}`)
  }

  return (
    <div className="home">
      <section className="hero">
        <div>
          <p className="eyebrow">{fmtDate(today)}</p>
          <h1 className="h-display">Area tecnica</h1>
          {ctx ? (
            <p>
              <b>{ctx.meso.nome}</b> · settimana {ctx.week}
              {ctx.micro?.focus ? (
                <>
                  {' '}
                  · focus <b>{ctx.micro.focus}</b>
                </>
              ) : null}
            </p>
          ) : (
            <p>Nessun mesociclo attivo oggi.</p>
          )}
        </div>
        <div className="row wrap gap-s">
          <button className="btn primary lg" onClick={quickSession}>
            + Seduta di oggi
          </button>
          <Link to="/esercizio/nuovo" className="btn lg on-dark">
            + Esercizio
          </Link>
        </div>
      </section>

      <div className="home-grid">
        <section className="card">
          <h3>Prossima seduta</h3>
          {next ? (
            <Link to={`/seduta/${next.id}`} className="next-s">
              <div className="date-box big">
                <b>{Number(next.data.slice(8))}</b>
                <small>{fmtDate(next.data).split(' ')[0]}</small>
              </div>
              <div>
                <b>{next.titolo}</b>
                <div className="muted sm">
                  {next.gruppo} · {next.items.length} esercizi · {sessionMinutes(next)}/{next.durataTarget}′
                </div>
                <div className="muted sm">{next.obiettivo}</div>
              </div>
            </Link>
          ) : (
            <p className="muted">
              Nessuna seduta pianificata. <Link to="/planner">Apri il planner</Link>
            </p>
          )}
        </section>

        <section className="card">
          <h3>Questo mese</h3>
          <div className="row gap wrap">
            <div className="kpi flat">
              <small>Sedute</small>
              <b>{monthDone.length}</b>
            </div>
            <div className="kpi flat">
              <small>Minuti</small>
              <b>{agg.minutiTot}</b>
            </div>
          </div>
          <div className="timebar mt-s">
            {Object.entries(agg.perArea)
              .filter(([, v]) => v > 0)
              .map(([a, v]) => (
                <span key={a} style={{ width: `${pct(v, agg.minutiTot)}%`, background: AREA_COLOR[a as keyof typeof AREA_COLOR] }} title={`${AREA_LABEL[a as keyof typeof AREA_LABEL]} ${v}′`} />
              ))}
          </div>
          <Link to="/report" className="sm">
            Report completo →
          </Link>
        </section>
      </div>

      <RecentFeedback />

      <div className="row between mt mb-s">
        <h3>Esercizi recenti</h3>
        <Link to="/libreria">Tutta la libreria →</Link>
      </div>
      <div className="grid-cards">
        {recent.map((e) => (
          <ExerciseCard key={e.id} e={e} />
        ))}
      </div>
    </div>
  )
}
