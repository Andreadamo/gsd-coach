import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useExercise, useStore } from '../store'
import { AreaBadge, Empty } from '../components/common'
import { PitchPlayer } from '../pitch/PitchPlayer'
import { FASE_LABEL } from '../types'
import { clone, fmtDate, uid } from '../lib/util'
import { FeedbackPanel } from '../feedback/FeedbackPanel'

export default function ExerciseDetail() {
  const { id } = useParams()
  const e = useExercise(id)
  const nav = useNavigate()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const sessions = useStore((s) => s.sessions)
  const [addTo, setAddTo] = useState('')

  if (!e) return <Empty>Esercizio non trovato.</Empty>

  const usedIn = sessions.filter((s) => s.items.some((i) => i.exerciseId === e.id))
  const upcoming = sessions.filter((s) => s.stato === 'pianificata').sort((a, b) => a.data.localeCompare(b.data))

  const duplicate = () => {
    const c = { ...clone(e), id: uid(), code: e.code + '-B', title: e.title + ' (copia)', ownerId: undefined }
    upsert('exercises', c)
    nav(`/esercizio/${c.id}/modifica`)
  }

  const del = () => {
    if (!confirm(`Eliminare "${e.title}"? Verrà tolto anche dalle sedute.`)) return
    remove('exercises', e.id)
    nav('/libreria')
  }

  const addToSession = () => {
    const s = sessions.find((x) => x.id === addTo)
    if (!s) return
    upsert('sessions', { ...s, items: [...s.items, { uid: uid(), exerciseId: e.id, fase: e.fase.includes('centrale') ? 'centrale' : e.fase[0] ?? 'centrale', minuti: e.durata }] })
    nav(`/seduta/${s.id}`)
  }

  const info: [string, string | undefined][] = [
    ['Età', e.eta],
    ['Giocatori', e.giocatori],
    ['Spazio', e.spazio],
    ['Durata', e.durata + ' min'],
    ['Materiale', e.materiale],
    ['Fase seduta', e.fase.map((f) => FASE_LABEL[f]).join(', ')],
  ]

  return (
    <div className="detail">
      <div className="row between wrap gap-s mb">
        <Link to="/libreria" className="muted">
          ← Libreria
        </Link>
        <div className="row gap-s wrap">
          <Link to={`/esercizio/${e.id}/modifica`} className="btn primary">
            ✎ Modifica
          </Link>
          <button className="btn" onClick={duplicate}>
            Duplica
          </button>
          <button className="btn danger" onClick={del}>
            Elimina
          </button>
        </div>
      </div>
      <div className="row gap-s wrap mb-s">
        <span className="code lg">{e.code}</span>
        <AreaBadge area={e.area} />
      </div>
      <h1 className="h-display">{e.title}</h1>
      <div className="row wrap gap-xs mb">
        {e.obiettivi.map((o) => (
          <span key={o} className="tag">
            {o}
          </span>
        ))}
      </div>

      <div className="detail-grid">
        <div>
          <PitchPlayer d={e.diagram} className="card pad-s" />
          <div className="legend">
            <span>
              <i className="lg-pass" /> Passaggio
            </span>
            <span>
              <i className="lg-run" /> Movimento
            </span>
            <span>
              <i className="lg-dribble" /> Conduzione
            </span>
            <span>
              <i className="lg-shot" /> Tiro
            </span>
          </div>
        </div>
        <div className="stack">
          <section className="card">
            <h3>Perché</h3>
            <p>{e.perche}</p>
          </section>
          <section className="card">
            <h3>Come si fa</h3>
            <p className="pre">{e.descrizione}</p>
            {e.rotazione && (
              <p>
                <b>Rotazione:</b> {e.rotazione}
              </p>
            )}
          </section>
          {e.coaching && (
            <section className="card">
              <h3>Coaching points</h3>
              <p className="pre">{e.coaching}</p>
            </section>
          )}
          {e.varianti && (
            <section className="card">
              <h3>Varianti / progressioni</h3>
              <p className="pre">{e.varianti}</p>
            </section>
          )}
          <section className="card">
            <dl className="info">
              {info.map(([k, v]) =>
                v ? (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            {e.fonte && <p className="muted sm mt-s">Fonte: {e.fonte}</p>}
          </section>
          <FeedbackPanel type="exercise" id={e.id} />
          <section className="card">
            <h3>Usa in una seduta</h3>
            {upcoming.length ? (
              <div className="row gap-s wrap">
                <select value={addTo} onChange={(ev) => setAddTo(ev.target.value)}>
                  <option value="">Scegli seduta pianificata…</option>
                  {upcoming.map((s) => (
                    <option key={s.id} value={s.id}>
                      {fmtDate(s.data)} — {s.titolo}
                    </option>
                  ))}
                </select>
                <button className="btn primary" disabled={!addTo} onClick={addToSession}>
                  Aggiungi
                </button>
              </div>
            ) : (
              <p className="muted">Nessuna seduta pianificata.</p>
            )}
            {usedIn.length > 0 && <p className="muted sm mt-s">Usato in {usedIn.length} sedute.</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
