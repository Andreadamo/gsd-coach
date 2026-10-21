import { memo, type ReactNode } from 'react'
import type { Diagram, ItemType, PitchArrow, PitchItem, Pt } from '../types'
import { animPos, control, dist, posAt, quadPt, quadTan, unit } from './geom'

export const ITEM_LABEL: Record<ItemType, string> = {
  playerA: 'Giocatore A',
  playerB: 'Giocatore B',
  jolly: 'Jolly',
  gk: 'Portiere',
  coach: 'Mister',
  ball: 'Pallone',
  cone: 'Cono',
  disc: 'Cinesino',
  pole: 'Paletto',
  mannequin: 'Sagoma',
  hoop: 'Cerchio',
  board: 'Tavoletta',
  minigoal: 'Porticina',
  goal: 'Porta',
  hurdle: 'Ostacolo',
}

export const ARROW_STYLE = {
  pass: { color: '#ffffff', label: 'Passaggio' },
  run: { color: '#fde047', label: 'Movimento senza palla' },
  dribble: { color: '#fdba74', label: 'Conduzione / dribbling' },
  shot: { color: '#f87171', label: 'Tiro' },
} as const

const TEAM_FILL: Partial<Record<ItemType, string>> = {
  playerA: '#1d4ed8',
  playerB: '#dc2626',
  jolly: '#facc15',
  gk: '#111827',
  coach: '#f8fafc',
}

// ---------- Campo ----------
function FieldLines({ d, u }: { d: Diagram; u: number }) {
  const { w, h, preset } = d.field
  const lw = Math.max(0.08, u * 0.09)
  const s = { fill: 'none', stroke: 'rgba(255,255,255,.85)', strokeWidth: lw }
  const stripes: ReactNode[] = []
  const n = Math.max(6, Math.round(w / 5))
  for (let i = 0; i < n; i += 2)
    stripes.push(<rect key={i} x={(i * w) / n} y={0} width={w / n} height={h} fill="rgba(255,255,255,.045)" />)

  const goalW = Math.min(5, h * 0.18)
  const goal = (x: number, dir: 1 | -1) => (
    <rect x={dir === 1 ? x - 1.1 : x} y={h / 2 - goalW / 2} width={1.1} height={goalW} {...s} strokeWidth={lw * 1.4} />
  )
  const box = (x: number, dir: 1 | -1, bw: number, bh: number) => (
    <rect x={dir === 1 ? x : x - bw} y={h / 2 - bh / 2} width={bw} height={bh} {...s} />
  )

  return (
    <g>
      <rect x={0} y={0} width={w} height={h} fill="url(#grass)" />
      {stripes}
      <rect x={0} y={0} width={w} height={h} {...s} strokeDasharray={preset === 'spazio' ? `${u * 0.6} ${u * 0.4}` : undefined} />
      {preset === 'campo7' && (
        <>
          <line x1={w / 2} y1={0} x2={w / 2} y2={h} {...s} />
          <circle cx={w / 2} cy={h / 2} r={Math.min(6, h * 0.17)} {...s} />
          <circle cx={w / 2} cy={h / 2} r={lw * 2} fill="#fff" />
          {box(0, 1, Math.min(13, w * 0.22), Math.min(26, h * 0.7))}
          {box(w, -1, Math.min(13, w * 0.22), Math.min(26, h * 0.7))}
          <circle cx={9} cy={h / 2} r={lw * 2} fill="#fff" />
          <circle cx={w - 9} cy={h / 2} r={lw * 2} fill="#fff" />
          {goal(0, 1)}
          {goal(w, -1)}
        </>
      )}
      {preset === 'metacampo' && (
        <>
          <path d={`M ${0} ${h / 2 - Math.min(6, h * 0.17)} A ${Math.min(6, h * 0.17)} ${Math.min(6, h * 0.17)} 0 0 1 ${0} ${h / 2 + Math.min(6, h * 0.17)}`} {...s} />
          {box(w, -1, Math.min(13, w * 0.4), Math.min(26, h * 0.7))}
          {box(w, -1, Math.min(5, w * 0.16), Math.min(12, h * 0.34))}
          <circle cx={w - 9} cy={h / 2} r={lw * 2} fill="#fff" />
          {goal(w, -1)}
        </>
      )}
      {preset === 'area' && (
        <>
          {box(w, -1, Math.min(5, w * 0.25), Math.min(12, h * 0.45))}
          <circle cx={w - Math.min(9, w * 0.45)} cy={h / 2} r={lw * 2} fill="#fff" />
          {goal(w, -1)}
        </>
      )}
    </g>
  )
}

// ---------- Elementi ----------
export function ItemShape({ it, p, u, selected }: { it: PitchItem; p: Pt; u: number; selected?: boolean }) {
  const r = u * 0.85
  const sel = selected ? (
    <circle cx={p.x} cy={p.y} r={r * 1.55} fill="none" stroke="#38bdf8" strokeWidth={u * 0.14} strokeDasharray={`${u * 0.3} ${u * 0.2}`} />
  ) : null
  const t = it.type
  let body: ReactNode = null
  const fs = u * 0.95

  if (TEAM_FILL[t]) {
    const fill = TEAM_FILL[t]!
    const txt = t === 'jolly' || t === 'coach' ? '#111' : '#fff'
    body = (
      <g>
        <circle cx={p.x} cy={p.y + u * 0.08} r={r} fill="rgba(0,0,0,.28)" />
        <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={t === 'gk' ? '#4ade80' : '#fff'} strokeWidth={u * 0.13} />
        {(it.label || t === 'coach' || t === 'gk') && (
          <text x={p.x} y={p.y} dy="0.36em" textAnchor="middle" fontSize={fs * ((it.label ?? '').length > 2 ? 0.7 : 1)} fontWeight={700} fill={t === 'gk' ? '#4ade80' : txt} fontFamily="Inter, sans-serif">
            {it.label || (t === 'coach' ? 'M' : 'P')}
          </text>
        )}
      </g>
    )
  } else if (t === 'ball') {
    const br = u * 0.42
    body = (
      <g>
        <circle cx={p.x} cy={p.y} r={br} fill="#fff" stroke="#111" strokeWidth={u * 0.08} />
        <circle cx={p.x} cy={p.y} r={br * 0.38} fill="#111" />
      </g>
    )
  } else if (t === 'cone') {
    const s = u * 0.7
    body = <polygon points={`${p.x},${p.y - s} ${p.x - s * 0.85},${p.y + s * 0.6} ${p.x + s * 0.85},${p.y + s * 0.6}`} fill="#f97316" stroke="#7c2d12" strokeWidth={u * 0.07} />
  } else if (t === 'disc') {
    body = <ellipse cx={p.x} cy={p.y} rx={u * 0.5} ry={u * 0.32} fill="#facc15" stroke="#854d0e" strokeWidth={u * 0.07} />
  } else if (t === 'pole') {
    body = (
      <g>
        <circle cx={p.x} cy={p.y} r={u * 0.42} fill="#fde047" stroke="#1f2937" strokeWidth={u * 0.12} />
        <circle cx={p.x} cy={p.y} r={u * 0.14} fill="#1f2937" />
      </g>
    )
  } else if (t === 'mannequin') {
    body = (
      <g>
        <rect x={p.x - u * 0.55} y={p.y - u * 0.3} width={u * 1.1} height={u * 0.6} rx={u * 0.2} fill="#334155" stroke="#e2e8f0" strokeWidth={u * 0.07} />
        <circle cx={p.x} cy={p.y} r={u * 0.22} fill="#e2e8f0" />
      </g>
    )
  } else if (t === 'hoop') {
    body = <circle cx={p.x} cy={p.y} r={u * 0.75} fill="none" stroke={it.label === 'b' ? '#3b82f6' : it.label === 'r' ? '#ef4444' : '#a855f7'} strokeWidth={u * 0.17} />
  } else if (t === 'board') {
    body = <rect x={p.x - u * 0.5} y={p.y - u * 0.5} width={u} height={u} rx={u * 0.15} fill="#a16207" stroke="#fef3c7" strokeWidth={u * 0.08} />
  } else if (t === 'hurdle') {
    body = (
      <g transform={`rotate(${it.rot ?? 90} ${p.x} ${p.y})`}>
        <line x1={p.x - u * 0.7} y1={p.y} x2={p.x + u * 0.7} y2={p.y} stroke="#e11d48" strokeWidth={u * 0.18} strokeLinecap="round" />
      </g>
    )
  } else if (t === 'minigoal' || t === 'goal') {
    const gw = t === 'goal' ? Math.max(3, u * 4.2) : u * 2
    const gd = t === 'goal' ? u * 1.1 : u * 0.7
    body = (
      <g transform={`rotate(${it.rot ?? 0} ${p.x} ${p.y})`}>
        <rect x={p.x - gd / 2} y={p.y - gw / 2} width={gd} height={gw} fill="rgba(255,255,255,.25)" stroke="#fff" strokeWidth={u * 0.14} />
        <line x1={p.x - gd / 2} y1={p.y - gw / 2} x2={p.x - gd / 2} y2={p.y + gw / 2} stroke="#fff" strokeWidth={u * 0.28} />
      </g>
    )
  }

  return (
    <g>
      {sel}
      {body}
    </g>
  )
}

// ---------- Frecce ----------
export function ArrowShape({ ar, u, num, opacity = 1, selected, progress }: { ar: PitchArrow; u: number; num?: string; opacity?: number; selected?: boolean; progress?: number }) {
  const a = ar.from
  const b = ar.to
  const c = control(a, b, ar.curve)
  const col = ARROW_STYLE[ar.kind].color
  const sw = u * (ar.kind === 'shot' ? 0.2 : 0.14)
  const head = u * 0.62
  const tEnd = 1
  const tan = quadTan(a, c, b, tEnd)
  const L = Math.hypot(tan.x, tan.y) || 1
  const ux = tan.x / L
  const uy = tan.y / L
  const tip = b
  const base = { x: tip.x - ux * head, y: tip.y - uy * head }
  const hp = `${tip.x},${tip.y} ${base.x - uy * head * 0.5},${base.y + ux * head * 0.5} ${base.x + uy * head * 0.5},${base.y - ux * head * 0.5}`

  let d: string
  if (ar.kind === 'dribble') {
    const total = Math.hypot(b.x - a.x, b.y - a.y)
    const N = Math.max(24, Math.round(total * 6))
    const amp = u * 0.28
    const waves = Math.max(2, total / (u * 1.1))
    const pts: string[] = []
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * (1 - head / Math.max(total, 0.01))
      const p = quadPt(a, c, b, t)
      const tg = quadTan(a, c, b, t)
      const l = Math.hypot(tg.x, tg.y) || 1
      const off = Math.sin(t * waves * Math.PI * 2) * amp
      pts.push(`${(p.x + (-tg.y / l) * off).toFixed(3)},${(p.y + (tg.x / l) * off).toFixed(3)}`)
    }
    d = 'M ' + pts.join(' L ')
  } else {
    d = `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${base.x} ${base.y}`
  }
  const mid = quadPt(a, c, b, 0.5)
  return (
    <g opacity={opacity}>
      {selected && <path d={`M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`} fill="none" stroke="#38bdf8" strokeWidth={sw * 4} strokeOpacity={0.45} />}
      <path d={d} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth={sw * 1.9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ar.kind === 'run' ? `${u * 0.45} ${u * 0.32}` : undefined} />
      <path
        d={d}
        fill="none"
        stroke={col}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={ar.kind === 'run' ? `${u * 0.45} ${u * 0.32}` : undefined}
        pathLength={progress !== undefined ? 1 : undefined}
        style={progress !== undefined ? { strokeDasharray: ar.kind === 'run' ? undefined : '1', strokeDashoffset: 1 - progress } : undefined}
      />
      <polygon points={hp} fill={col} stroke="rgba(0,0,0,.35)" strokeWidth={u * 0.04} />
      {num && (
        <g>
          <circle cx={mid.x} cy={mid.y} r={u * 0.55} fill="#0f172a" stroke={col} strokeWidth={u * 0.08} />
          <text x={mid.x} y={mid.y} dy="0.36em" textAnchor="middle" fontSize={u * 0.7} fontWeight={700} fill="#fff" fontFamily="Inter, sans-serif">
            {num}
          </text>
        </g>
      )}
    </g>
  )
}

// ---------- Vista ----------
export interface ViewProps {
  d: Diagram
  step?: number
  t?: number // 0..1 transizione verso step+1
  overlay?: boolean // tutte le frecce numerate, posizioni step 0
  selectedId?: string | null
  children?: ReactNode
  className?: string
  svgRef?: React.Ref<SVGSVGElement>
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void
  onItemDown?: (e: React.PointerEvent, it: PitchItem) => void
  onArrowDown?: (e: React.PointerEvent, ar: PitchArrow) => void
  /** gesti touch consentiti al browser; default: scroll libero se il campo è solo da guardare */
  touchAction?: string
}

export const PitchView = memo(function PitchView({
  d,
  step = 0,
  t = 0,
  overlay,
  selectedId,
  children,
  className,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onItemDown,
  onArrowDown,
  touchAction,
}: ViewProps) {
  const u = unit(d)
  const pad = u * 1.6
  const { w, h } = d.field
  const vb = `${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`
  const tol = u * 2.2

  const arrows = overlay ? d.arrows : d.arrows.filter((a) => a.step === step)
  const arrowNum = (ar: PitchArrow) => {
    if (ar.label) return ar.label
    if (overlay) {
      // numerazione progressiva per step
      const sorted = [...d.arrows].sort((a, b) => a.step - b.step)
      return String(sorted.indexOf(ar) + 1)
    }
    return d.arrows.filter((a) => a.step === step).length > 1 ? String(arrows.indexOf(ar) + 1) : undefined
  }

  // accorcia le frecce che partono/arrivano su un giocatore (punta visibile)
  const r = u * 0.85
  const isPlayer = (it: PitchItem) => !!TEAM_FILL[it.type]
  const trim = (ar: PitchArrow): PitchArrow => {
    const players = d.items.filter(isPlayer)
    const near = (q: Pt, k: number) => players.some((it) => dist(posAt(it, k), q) < 0.35)
    const L = dist(ar.from, ar.to)
    if (L < r * 3) return ar
    const dx = (ar.to.x - ar.from.x) / L
    const dy = (ar.to.y - ar.from.y) / L
    let from = ar.from
    let to = ar.to
    if (near(ar.from, ar.step)) from = { x: from.x + dx * r * 1.05, y: from.y + dy * r * 1.05 }
    if (near(ar.to, ar.step + 1) || near(ar.to, ar.step)) to = { x: to.x - dx * r * 1.2, y: to.y - dy * r * 1.2 }
    return from === ar.from && to === ar.to ? ar : { ...ar, from, to }
  }
  // pallone ai piedi: spostato se sovrapposto a un giocatore
  const ballPos = (p: Pt, k: number): Pt => {
    for (const it of d.items) if (isPlayer(it) && dist(posAt(it, k), p) < u * 0.6) return { x: p.x + u * 0.75, y: p.y + u * 0.6 }
    return p
  }

  // ordine: attrezzi sotto, giocatori sopra, palla in cima
  const z = (it: PitchItem) => (it.type === 'ball' ? 3 : TEAM_FILL[it.type] ? 2 : it.type === 'goal' || it.type === 'minigoal' ? 0 : 1)
  const items = [...d.items].sort((a, b) => z(a) - z(b))

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ touchAction: touchAction ?? (onPointerDown ? 'none' : 'pan-x pan-y pinch-zoom'), display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id="grass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2f8a3e" />
          <stop offset="1" stopColor="#25732f" />
        </linearGradient>
      </defs>
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill="#1f5f29" rx={u * 0.6} />
      <FieldLines d={d} u={u} />
      {arrows.map((ar) => (
        <g key={ar.id} data-hit={onArrowDown ? '' : undefined} onPointerDown={onArrowDown ? (e) => onArrowDown(e, ar) : undefined} style={{ cursor: onArrowDown ? 'pointer' : undefined }}>
          <ArrowShape ar={trim(ar)} u={u} num={arrowNum(ar)} opacity={t > 0 ? Math.max(0.15, 1 - t * 1.2) : 1} selected={selectedId === ar.id} />
        </g>
      ))}
      {items.map((it) => {
        let p = overlay ? posAt(it, 0) : animPos(it, step, t, d.arrows, tol)
        if (it.type === 'ball' && (overlay || t === 0)) p = ballPos(p, step)
        return (
          <g key={it.id} data-hit={onItemDown ? '' : undefined} onPointerDown={onItemDown ? (e) => onItemDown(e, it) : undefined} style={{ cursor: onItemDown ? 'grab' : undefined }}>
            <ItemShape it={it} p={p} u={u} selected={selectedId === it.id} />
          </g>
        )
      })}
      {children}
    </svg>
  )
})
