import { Link } from 'react-router-dom'
import type { Area, Exercise } from '../types'
import { AREA_COLOR, AREA_LABEL, type Fase } from '../types'

const FASE_SHORT: Record<Fase, string> = { attivazione: 'Attivazione', centrale: 'Centrale', finale: 'Partita' }
import { PitchView } from '../pitch/PitchView'

export function AreaBadge({ area, short }: { area: Area; short?: boolean }) {
  return (
    <span className="badge" style={{ background: AREA_COLOR[area] + '1a', color: AREA_COLOR[area], borderColor: AREA_COLOR[area] + '55' }}>
      <i style={{ background: AREA_COLOR[area] }} />
      {short ? AREA_LABEL[area].split(' ')[0] : AREA_LABEL[area]}
    </span>
  )
}

export function ExerciseCard({ e, action }: { e: Exercise; action?: React.ReactNode }) {
  return (
    <article className="ex-card">
      <Link to={`/esercizio/${e.id}`} className="ex-thumb" aria-label={e.title}>
        <PitchView d={e.diagram} overlay />
      </Link>
      <div className="ex-body">
        <div className="row between gap-s">
          <span className="code">{e.code}</span>
          <span className="muted sm">{e.durata}′</span>
        </div>
        <Link to={`/esercizio/${e.id}`} className="ex-title">
          {e.title}
        </Link>
        <div className="row wrap gap-xs">
          <AreaBadge area={e.area} short />
          {e.fase.map((f) => (
            <span key={f} className="tag">
              {FASE_SHORT[f]}
            </span>
          ))}
        </div>
        <div className="tags-line muted sm">{e.obiettivi.slice(0, 4).join(' · ')}</div>
        {action}
      </div>
    </article>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>
}

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="h-display">{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="row wrap gap-s">{children}</div>}
    </div>
  )
}
