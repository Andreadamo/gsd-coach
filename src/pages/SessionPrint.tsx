import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { AREA_COLOR, AREA_LABEL, FASI, FASE_LABEL } from '../types'
import { PitchView } from '../pitch/PitchView'
import { fmtDate } from '../lib/util'
import { findMeso } from '../lib/stats'
import { sessionMinutes } from './Sessions'

export default function SessionPrint() {
  const { id } = useParams()
  const s = useStore((st) => st.sessions.find((x) => x.id === id))
  const exercises = useStore((st) => st.exercises)
  const cycles = useStore((st) => st.cycles)
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  if (!s) return <p style={{ padding: 20 }}>Seduta non trovata.</p>
  const ctx = findMeso(cycles, s.data, s.gruppo)
  let n = 0
  let clock = 0

  return (
    <div className="print-page">
      <div className="no-print print-bar">
        <Link to={`/seduta/${s.id}`} className="btn">
          ← Torna alla seduta
        </Link>
        <button className="btn primary" onClick={() => window.print()}>
          ⎙ Stampa / Salva PDF
        </button>
      </div>
      <header className="p-head">
        <div>
          <div className="p-club">GSD Rosignano Solvay 1922 · Scuola Calcio</div>
          <h1>{s.titolo}</h1>
          <div className="p-meta">
            {fmtDate(s.data)} · {s.gruppo} · {sessionMinutes(s)} min
            {s.obiettivo && <> · Obiettivo: <b>{s.obiettivo}</b></>}
          </div>
          {ctx && (
            <div className="p-meta">
              {ctx.meso.nome} — settimana {ctx.week}
              {ctx.micro ? ` · focus ${ctx.micro.focus}` : ''}
            </div>
          )}
        </div>
        <img src="./favicon.svg" width={56} height={56} alt="" />
      </header>

      <table className="p-summary">
        <thead>
          <tr>
            <th>#</th>
            <th>Orario</th>
            <th>Fase</th>
            <th>Esercizio</th>
            <th>Area</th>
            <th>Min</th>
          </tr>
        </thead>
        <tbody>
          {FASI.flatMap((f) =>
            s.items
              .filter((i) => i.fase === f)
              .map((it) => {
                const e = exMap.get(it.exerciseId)
                if (!e) return null
                const start = clock
                clock += it.minuti
                n++
                return (
                  <tr key={it.uid}>
                    <td>{n}</td>
                    <td>
                      {start}′–{clock}′
                    </td>
                    <td>{FASE_LABEL[f]}</td>
                    <td>
                      <b>{e.code}</b> {e.title}
                    </td>
                    <td style={{ color: AREA_COLOR[e.area] }}>{AREA_LABEL[e.area]}</td>
                    <td>{it.minuti}</td>
                  </tr>
                )
              }),
          )}
        </tbody>
      </table>

      {FASI.map((f) => {
        const items = s.items.filter((i) => i.fase === f)
        if (!items.length) return null
        return (
          <section key={f}>
            <h2 className="p-phase">{FASE_LABEL[f]}</h2>
            {items.map((it) => {
              const e = exMap.get(it.exerciseId)
              if (!e) return null
              return (
                <article key={it.uid} className="p-ex">
                  <div className="p-ex-head">
                    <span className="p-code" style={{ background: AREA_COLOR[e.area] }}>
                      {e.code}
                    </span>
                    <h3>{e.title}</h3>
                    <span className="p-min">{it.minuti}′</span>
                  </div>
                  <div className="p-ex-body">
                    <div className="p-diagram">
                      <PitchView d={e.diagram} overlay />
                    </div>
                    <div className="p-text">
                      <p>
                        <b>Perché:</b> {e.perche}
                      </p>
                      <p>
                        <b>Come:</b> {e.descrizione}
                      </p>
                      {e.diagram.steps.length > 1 && (
                        <ol className="p-steps">
                          {e.diagram.steps.slice(0, -1).map((st, i) => (
                            <li key={i}>
                              {st.title}
                              {st.note ? ` — ${st.note}` : ''}
                            </li>
                          ))}
                        </ol>
                      )}
                      {e.rotazione && (
                        <p>
                          <b>Rotazione:</b> {e.rotazione}
                        </p>
                      )}
                      {e.coaching && (
                        <p>
                          <b>Coaching:</b> {e.coaching}
                        </p>
                      )}
                      <p className="p-small">
                        <b>Materiale:</b> {e.materiale || '—'} · <b>Spazio:</b> {e.spazio} · <b>Giocatori:</b> {e.giocatori}
                      </p>
                      {it.note && <p className="p-note">📝 {it.note}</p>}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )
      })}
      {s.noteFinali && (
        <section className="p-ex">
          <h3>Note</h3>
          <p>{s.noteFinali}</p>
        </section>
      )}
      <footer className="p-foot">Legenda: linea bianca = passaggio · tratteggio giallo = movimento senza palla · linea ondulata = conduzione · rosso = tiro</footer>
    </div>
  )
}
