import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { cloudEnabled } from '../lib/supabase'
import { authState } from '../components/AuthGate'
import { fmtDate } from '../lib/util'
import { TIPO_LABEL, unreadOf, useFeed } from './useComments'

/** Home: ultimi feedback aperti dello staff, con i nuovi in evidenza. */
export function RecentFeedback() {
  const recent = useFeed((s) => s.recent)
  const seen = useFeed((s) => s.seen)
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  if (!cloudEnabled) return null
  const me = authState.member?.user_id
  const nuovi = new Set(unreadOf(recent, seen, me).map((c) => c.id))
  const list = recent.filter((c) => !c.risolto).slice(0, 6)

  return (
    <section className="card mt">
      <div className="row between">
        <h3>
          Feedback staff {nuovi.size > 0 && <span className="count">{nuovi.size} nuovi</span>}
        </h3>
      </div>
      {list.length === 0 ? (
        <p className="muted sm">Nessun feedback aperto. Aprite una seduta o un esercizio per lasciare spunti e proposte di modifica.</p>
      ) : (
        <ul className="fb-recent">
          {list.map((c) => {
            const s = c.target_type === 'session' ? sessions.find((x) => x.id === c.target_id) : undefined
            const e = c.target_type === 'exercise' ? exercises.find((x) => x.id === c.target_id) : undefined
            const to = s ? `/seduta/${s.id}` : e ? `/esercizio/${e.id}` : undefined
            const what = s ? `Seduta ${fmtDate(s.data)} · ${s.titolo}` : e ? `${e.code} · ${e.title}` : 'Elemento eliminato'
            const inner = (
              <>
                <div className="row wrap gap-s sm">
                  {nuovi.has(c.id) && <span className="dot-new" aria-label="nuovo" />}
                  <b>{c.author_id === me ? 'Tu' : c.author_name}</b>
                  {c.tipo !== 'commento' && <span className={`fb-tipo ${c.tipo}`}>{TIPO_LABEL[c.tipo]}</span>}
                  <span className="muted">su {what}</span>
                </div>
                <p className="fb-body clamp">{c.body}</p>
              </>
            )
            return <li key={c.id}>{to ? <Link to={to}>{inner}</Link> : inner}</li>
          })}
        </ul>
      )}
    </section>
  )
}
