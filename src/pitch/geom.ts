import type { Diagram, PitchArrow, PitchItem, Pt } from '../types'

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

/** Unità grafica in metri, scalata sulla dimensione del campo */
export function unit(d: Diagram) {
  const m = Math.min(d.field.w, d.field.h)
  return Math.max(0.45, Math.min(2.2, m / 24))
}

/** Posizione di un elemento allo step k (ultimo keyframe <= k) */
export function posAt(it: PitchItem, k: number): Pt {
  let best: Pt | undefined
  let bestK = -1
  for (const [ks, p] of Object.entries(it.pos)) {
    const kk = Number(ks)
    if (kk <= k && kk > bestK) {
      best = p
      bestK = kk
    }
  }
  if (best) return best
  // nessun keyframe <= k: usa il primo disponibile
  const first = Object.entries(it.pos).sort((a, b) => Number(a[0]) - Number(b[0]))[0]
  return first ? first[1] : { x: 0, y: 0 }
}

export function control(a: Pt, b: Pt, curve = 0): Pt {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = Math.hypot(dx, dy) || 1
  return { x: mx + (-dy / L) * curve, y: my + (dx / L) * curve }
}

export function quadPt(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

export function quadTan(a: Pt, c: Pt, b: Pt, t: number): Pt {
  return { x: 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), y: 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y) }
}

export function arrowPoint(ar: PitchArrow, t: number) {
  return quadPt(ar.from, control(ar.from, ar.to, ar.curve), ar.to, t)
}

/** Posizione interpolata dello step k → k+1, seguendo una freccia se combacia */
export function animPos(it: PitchItem, k: number, t: number, arrows: PitchArrow[], tol: number): Pt {
  const a = posAt(it, k)
  const b = posAt(it, k + 1)
  if (t <= 0) return a
  if (t >= 1) return b
  if (dist(a, b) < 0.01) return a
  const e = ease(t)
  const ar = arrows.find((x) => x.step === k && dist(x.from, a) < tol && dist(x.to, b) < tol)
  if (ar) return arrowPoint(ar, e)
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) }
}

/** Il pallone segue le frecce di passaggio/tiro/conduzione */
export function snapTo(p: Pt, d: Diagram, k: number, tol: number): Pt {
  let best = p
  let bd = tol
  for (const it of d.items) {
    if (it.type === 'ball') continue
    const q = posAt(it, k)
    const dd = dist(p, q)
    if (dd < bd) {
      bd = dd
      best = q
    }
  }
  return best
}

/** aspect-ratio CSS del campo (con margine) */
export function fieldAspect(d: Diagram) {
  const pad = unit(d) * 1.6 * 2
  return `${d.field.w + pad} / ${d.field.h + pad}`
}
