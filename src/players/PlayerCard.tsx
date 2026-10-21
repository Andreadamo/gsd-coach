import type { Player } from '../types'
import { categoriaDi, overall, toCard, type SkillValue } from '../lib/skills'
import { cx } from '../lib/util'

const RUOLO_SIGLA: Record<string, string> = { portiere: 'POR', difensore: 'DIF', centrocampista: 'CEN', attaccante: 'ATT', jolly: 'JOL' }

/** Radar poligonale: un asse per abilità, scala 1-10. */
export function Radar({ values, size = 240, compare }: { values: SkillValue[]; size?: number; compare?: (number | null)[] }) {
  const n = values.length
  const c = size / 2
  const R = size / 2 - 34
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [c + Math.cos(a) * r, c + Math.sin(a) * r] as const
  }
  const ring = (k: number) => values.map((_, i) => pt(i, (R * k) / 10).join(',')).join(' ')
  const poly = (vals: (number | null)[]) => vals.map((v, i) => pt(i, (R * Math.max(0.5, v ?? 0)) / 10).join(',')).join(' ')
  const has = values.some((v) => v.valore != null)
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label={values.map((v) => `${v.skill.label} ${toCard(v.valore) ?? 'n.d.'}`).join(', ')}>
      {[2, 4, 6, 8, 10].map((k) => (
        <polygon key={k} points={ring(k)} className={cx('r-ring', k === 10 && 'outer')} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="r-axis" />
      })}
      {compare && <polygon points={poly(compare)} className="r-prev" />}
      {has && <polygon points={poly(values.map((v) => v.valore))} className="r-val" />}
      {values.map((v, i) => {
        const [x, y] = pt(i, R + 18)
        const card = toCard(v.valore)
        return (
          <g key={v.skill.id}>
            <text x={x} y={y - 5} textAnchor="middle" className="r-lbl">
              {v.skill.sigla}
            </text>
            <text x={x} y={y + 9} textAnchor="middle" className={cx('r-num', card != null && card >= 75 && 'hi', card != null && card < 55 && 'lo')}>
              {card ?? '–'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Card stile videogioco: overall, ruolo, nome e statistiche. */
export function PlayerCard({ p, values, small }: { p: Player; values: SkillValue[]; small?: boolean }) {
  const ovr = overall(values)
  const cat = categoriaDi(p.annata)
  const tier = ovr == null ? 'none' : ovr >= 80 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze'
  return (
    <div className={cx('fut', `t-${tier}`, small && 'small')}>
      <div className="fut-top">
        <div className="fut-ovr">
          <b>{ovr ?? '–'}</b>
          <span>{RUOLO_SIGLA[p.ruolo ?? ''] ?? '—'}</span>
          {p.numero != null && <span className="fut-num">#{p.numero}</span>}
        </div>
        <div className="fut-name">
          <b>{p.nome}</b>
          <span>{p.cognome}</span>
          <small>
            {p.annata} · {cat.nome}
          </small>
        </div>
      </div>
      {!small && <Radar values={values} />}
      <div className="fut-stats">
        {values.map((v) => (
          <div key={v.skill.id} title={v.skill.label}>
            <b>{toCard(v.valore) ?? '–'}</b>
            <span>{v.skill.sigla}</span>
            {!small && v.trend !== 0 && v.valore != null && <i className={v.trend > 0 ? 'up' : 'down'}>{v.trend > 0 ? '▲' : '▼'}</i>}
          </div>
        ))}
      </div>
    </div>
  )
}
