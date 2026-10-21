import { cloudEnabled } from '../lib/supabase'
import { authState } from '../components/AuthGate'
import { targetKey, unreadOf, useFeed, type TargetType } from './useComments'

/** Contatore feedback aperti; evidenziato se ci sono messaggi nuovi di altri mister. */
export function FeedbackBadge({ type, id, compact }: { type: TargetType; id: string; compact?: boolean }) {
  const recent = useFeed((s) => s.recent)
  const seen = useFeed((s) => s.seen)
  if (!cloudEnabled) return null
  const key = targetKey(type, id)
  const mine = recent.filter((c) => targetKey(c.target_type, c.target_id) === key)
  const aperti = mine.filter((c) => !c.risolto).length
  const nuovi = unreadOf(mine, seen, authState.member?.user_id).length
  if (!aperti && !nuovi) return null
  const label = `${aperti} feedback aperti${nuovi ? `, ${nuovi} nuovi` : ''}`

  if (compact)
    return (
      <span className={nuovi ? 'fb-badge new' : 'fb-badge'} title={label} aria-label={label}>
        💬 {nuovi || aperti}
      </span>
    )
  return (
    <a
      href="#feedback"
      className={nuovi ? 'btn fb-btn new' : 'btn fb-btn'}
      onClick={(e) => {
        e.preventDefault()
        document.getElementById('feedback')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      aria-label={label}
    >
      💬 {aperti}
      {nuovi > 0 && <span className="dot-new" />}
    </a>
  )
}
