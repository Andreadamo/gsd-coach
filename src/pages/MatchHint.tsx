import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { carenzeDaPartite, eserciziConsigliati, ultimaPartitaPrima } from '../lib/matchAdvice'
import { fmtDate } from '../lib/util'

/** Promemoria nella seduta: cosa è emerso dall'ultima partita e 3 esercizi da aggiungere al volo. */
export function MatchHint({ date, onAdd, presenti }: { date: string; onAdd: (exerciseId: string) => void; presenti: string[] }) {
  const matches = useStore((s) => s.matches)
  const exercises = useStore((s) => s.exercises)
  const sessions = useStore((s) => s.sessions)
  const m = useMemo(() => ultimaPartitaPrima(matches, date), [matches, date])
  const carenze = useMemo(() => (m ? carenzeDaPartite([m]) : []), [m])
  const consigli = useMemo(() => eserciziConsigliati(carenze, exercises, sessions, date, 6).filter((c) => !presenti.includes(c.exercise.id)).slice(0, 3), [carenze, exercises, sessions, date, presenti])
  if (!m || !carenze.length) return null
  return (
    <div className="match-hint">
      <div className="grow">
        <b>
          Dalla partita del {fmtDate(m.data, false)}
          {m.avversario ? ` vs ${m.avversario}` : ''}:
        </b>{' '}
        lavorare su {carenze.slice(0, 3).map((c) => c.obiettivo).join(', ')}.{' '}
        <Link to={`/partita/${m.id}`}>Apri nota</Link>
      </div>
      {consigli.length > 0 && (
        <div className="row wrap gap-xs">
          {consigli.map((c) => (
            <button key={c.exercise.id} className="chip sm" onClick={() => onAdd(c.exercise.id)} title={`Lavora su: ${c.obiettivi.join(', ')}`}>
              + {c.exercise.code} {c.exercise.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
