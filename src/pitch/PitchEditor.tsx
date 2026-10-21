import { useCallback, useEffect, useRef, useState } from 'react'
import type { ArrowKind, Diagram, FieldPreset, ItemType, PitchArrow, PitchItem, Pt } from '../types'
import { clone, uid } from '../lib/util'
import { ARROW_STYLE, ITEM_LABEL, ItemShape, PitchView } from './PitchView'
import { control, dist, fieldAspect, posAt, unit } from './geom'
import { PitchPlayer } from './PitchPlayer'

type Tool = 'select' | ItemType | `arrow:${ArrowKind}`

const PLAYERS: ItemType[] = ['playerA', 'playerB', 'jolly', 'gk', 'coach']
const GEAR: ItemType[] = ['ball', 'cone', 'disc', 'pole', 'mannequin', 'hoop', 'board', 'hurdle', 'minigoal', 'goal']
const ARROWS: ArrowKind[] = ['pass', 'run', 'dribble', 'shot']

export const FIELD_PRESETS: Record<FieldPreset, { label: string; w: number; h: number }> = {
  spazio: { label: 'Spazio libero', w: 20, h: 15 },
  campo7: { label: 'Campo a 7', w: 55, h: 35 },
  metacampo: { label: 'Metà campo', w: 30, h: 35 },
  area: { label: 'Area + porta', w: 20, h: 30 },
}

function nextLabel(items: PitchItem[], type: ItemType) {
  const used = new Set(items.filter((i) => i.type === type).map((i) => i.label))
  if (type === 'playerA') {
    for (let i = 0; i < 26; i++) {
      const l = String.fromCharCode(65 + i)
      if (!used.has(l)) return l
    }
  }
  if (type === 'playerB' || type === 'jolly') {
    for (let i = 1; i < 40; i++) if (!used.has(String(i))) return String(i)
  }
  return undefined
}

function MiniIcon({ type }: { type: ItemType }) {
  const d: Diagram = { field: { preset: 'spazio', w: 4, h: 4 }, items: [], arrows: [], steps: [] }
  return (
    <svg viewBox="-1.6 -1.6 3.2 3.2" width={26} height={26}>
      <ItemShape it={{ id: 'x', type, label: type === 'playerA' ? 'A' : type === 'playerB' ? '1' : undefined, pos: {} }} p={{ x: 0, y: 0 }} u={unit(d) * 1.4} />
    </svg>
  )
}

function ArrowIcon({ kind }: { kind: ArrowKind }) {
  const col = ARROW_STYLE[kind].color
  return (
    <svg viewBox="0 0 30 14" width={30} height={14}>
      <rect width="30" height="14" rx="3" fill="#1f5f29" />
      {kind === 'dribble' ? (
        <path d="M3 7 q2.5 -4 5 0 t5 0 t5 0 t4 0" fill="none" stroke={col} strokeWidth="1.8" />
      ) : (
        <line x1="3" y1="7" x2="22" y2="7" stroke={col} strokeWidth={kind === 'shot' ? 2.6 : 1.8} strokeDasharray={kind === 'run' ? '3 2' : undefined} />
      )}
      <polygon points="27,7 21,3.5 21,10.5" fill={col} />
    </svg>
  )
}

interface Drag {
  kind: 'item' | 'arrowNew' | 'from' | 'to' | 'curve'
  id: string
  start?: Pt
}

export function PitchEditor({ value, onChange }: { value: Diagram; onChange: (d: Diagram) => void }) {
  const d = value
  const [step, setStep] = useState(0)
  const [tool, setTool] = useState<Tool>('select')
  const [sel, setSel] = useState<string | null>(null)
  const [autoAnim, setAutoAnim] = useState(true)
  const [preview, setPreview] = useState(false)
  const [draft, setDraft] = useState<PitchArrow | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const hist = useRef<Diagram[]>([])
  const u = unit(d)

  const commit = useCallback(
    (nd: Diagram, pushHist = true) => {
      if (pushHist) {
        hist.current.push(clone(d))
        if (hist.current.length > 60) hist.current.shift()
      }
      onChange(nd)
    },
    [d, onChange],
  )

  const undo = useCallback(() => {
    const prev = hist.current.pop()
    if (prev) {
      onChange(prev)
      setSel(null)
    }
  }, [onChange])

  const toPt = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const r = pt.matrixTransform(m.inverse())
    return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10 }
  }

  const clampPt = (p: Pt): Pt => ({
    x: Math.max(-u, Math.min(d.field.w + u, p.x)),
    y: Math.max(-u, Math.min(d.field.h + u, p.y)),
  })

  const itemAt = (p: Pt, exclude?: string) => {
    let best: PitchItem | undefined
    let bd = u * 1.4
    for (const it of d.items) {
      if (it.id === exclude || it.type === 'ball') continue
      const dd = dist(posAt(it, step), p)
      if (dd < bd) {
        bd = dd
        best = it
      }
    }
    return best
  }

  // ---------- pointer ----------
  const onBgDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = clampPt(toPt(e))
    if (tool === 'select') {
      setSel(null)
      return
    }
    svgRef.current?.setPointerCapture(e.pointerId)
    if (tool.startsWith('arrow:')) {
      const kind = tool.slice(6) as ArrowKind
      const from = itemAt(p)
      const start = from ? posAt(from, step) : p
      setDraft({ id: uid(), kind, step, from: start, to: start, curve: 0 })
      drag.current = { kind: 'arrowNew', id: from?.id ?? '' }
      return
    }
    const type = tool as ItemType
    const it: PitchItem = { id: uid(), type, label: nextLabel(d.items, type), pos: { 0: p }, rot: type === 'goal' || type === 'minigoal' ? (p.x < d.field.w / 2 ? 180 : 0) : undefined }
    if (step > 0) it.pos = { 0: p }
    commit({ ...d, items: [...d.items, it] })
    setSel(it.id)
  }

  const onItemDown = (e: React.PointerEvent, it: PitchItem) => {
    if (tool !== 'select') return // inserimento/frecce gestiti dallo sfondo (snap)
    e.stopPropagation()
    if (tool !== 'select') setTool('select')
    setSel(it.id)
    svgRef.current?.setPointerCapture(e.pointerId)
    hist.current.push(clone(d))
    drag.current = { kind: 'item', id: it.id }
  }

  const onArrowDown = (e: React.PointerEvent, ar: PitchArrow) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSel(ar.id)
  }

  const onHandleDown = (e: React.PointerEvent, kind: Drag['kind'], id: string) => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    hist.current.push(clone(d))
    drag.current = { kind, id }
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = drag.current
    if (!g) return
    const p = clampPt(toPt(e))
    if (g.kind === 'arrowNew') {
      setDraft((dr) => (dr ? { ...dr, to: p } : dr))
      return
    }
    if (g.kind === 'item') {
      onChange({ ...d, items: d.items.map((it) => (it.id === g.id ? { ...it, pos: { ...it.pos, [step]: p } } : it)) })
      return
    }
    onChange({
      ...d,
      arrows: d.arrows.map((ar) => {
        if (ar.id !== g.id) return ar
        if (g.kind === 'from') return { ...ar, from: p }
        if (g.kind === 'to') return { ...ar, to: p }
        // curva: distanza firmata del punto dalla corda
        const dx = ar.to.x - ar.from.x
        const dy = ar.to.y - ar.from.y
        const L = Math.hypot(dx, dy) || 1
        const mx = (ar.from.x + ar.to.x) / 2
        const my = (ar.from.y + ar.to.y) / 2
        const off = ((p.x - mx) * -dy + (p.y - my) * dx) / L
        return { ...ar, curve: Math.round(off * 2 * 10) / 10 }
      }),
    })
  }

  const onUp = () => {
    const g = drag.current
    drag.current = null
    if (g?.kind === 'arrowNew' && draft) {
      if (dist(draft.from, draft.to) < u * 0.8) {
        setDraft(null)
        return
      }
      let nd: Diagram = { ...d, arrows: [...d.arrows, draft] }
      if (autoAnim) nd = applyAutoAnim(nd, draft, g.id, step)
      commit(nd)
      setSel(draft.id)
      setDraft(null)
    }
  }

  // ---------- auto animazione ----------
  function applyAutoAnim(nd: Diagram, ar: PitchArrow, fromId: string, k: number): Diagram {
    const fromItem = nd.items.find((i) => i.id === fromId)
    if (!fromItem) return nd
    const steps = nd.steps.length - 1 < k + 1 ? [...nd.steps, { title: `Fase ${k + 2}` }] : nd.steps
    const items = nd.items.map((it) => ({ ...it, pos: { ...it.pos } }))
    const ball = items.find((i) => i.type === 'ball' && dist(posAt(i, k), posAt(fromItem, k)) < u * 1.6)
    const mover = items.find((i) => i.id === fromId)!
    if (ar.kind === 'run' || ar.kind === 'dribble') {
      mover.pos[k + 1] = ar.to
      if (ar.kind === 'dribble' && ball) ball.pos[k + 1] = ar.to
    } else if (ball) {
      ball.pos[k + 1] = ar.to
    }
    return { ...nd, items, steps }
  }

  // ---------- step ----------
  const addStep = () => {
    const nd = { ...d, steps: [...d.steps, { title: `Fase ${d.steps.length + 1}` }] }
    commit(nd)
    setStep(nd.steps.length - 1)
  }
  const delStep = (k: number) => {
    if (d.steps.length < 2) return
    const items = d.items.map((it) => {
      const pos: Record<number, Pt> = {}
      for (const [ks, p] of Object.entries(it.pos)) {
        const kk = Number(ks)
        if (kk < k) pos[kk] = p
        else if (kk > k) pos[kk - 1] = p
        else if (k === 0) pos[0] = p // mantieni la posizione iniziale
      }
      return { ...it, pos }
    })
    const arrows = d.arrows.filter((a) => a.step !== k).map((a) => (a.step > k ? { ...a, step: a.step - 1 } : a))
    commit({ ...d, items, arrows, steps: d.steps.filter((_, i) => i !== k) })
    setStep(Math.max(0, Math.min(step, d.steps.length - 2)))
  }

  // ---------- tastiera ----------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        removeSel()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if (e.key === 'Escape') {
        setTool('select')
        setSel(null)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const removeSel = () => {
    if (!sel) return
    commit({ ...d, items: d.items.filter((i) => i.id !== sel), arrows: d.arrows.filter((a) => a.id !== sel) })
    setSel(null)
  }

  const selItem = d.items.find((i) => i.id === sel)
  const selArrow = d.arrows.find((a) => a.id === sel)

  const patchItem = (patch: Partial<PitchItem>) => commit({ ...d, items: d.items.map((i) => (i.id === sel ? { ...i, ...patch } : i)) })
  const patchArrow = (patch: Partial<PitchArrow>) => commit({ ...d, arrows: d.arrows.map((a) => (a.id === sel ? { ...a, ...patch } : a)) })

  const setField = (preset: FieldPreset) => {
    const f = FIELD_PRESETS[preset]
    commit({ ...d, field: { preset, w: f.w, h: f.h } })
  }

  if (preview) {
    return (
      <div className="editor">
        <div className="row between wrap gap-s mb-s">
          <b>Anteprima animazione</b>
          <button className="btn" onClick={() => setPreview(false)}>
            ✎ Torna all'editor
          </button>
        </div>
        <PitchPlayer d={d} />
      </div>
    )
  }

  const hr = u * 0.55

  return (
    <div className="editor">
      <div className="toolbar" role="toolbar" aria-label="Strumenti campetto">
        <button className={'tool' + (tool === 'select' ? ' on' : '')} onClick={() => setTool('select')} title="Seleziona / sposta (Esc)">
          <span style={{ fontSize: 18 }}>✋</span>
          <small>Sposta</small>
        </button>
        <span className="tsep" />
        {PLAYERS.map((t) => (
          <button key={t} className={'tool' + (tool === t ? ' on' : '')} onClick={() => setTool(t)} title={ITEM_LABEL[t]}>
            <MiniIcon type={t} />
            <small>{ITEM_LABEL[t].replace('Giocatore ', 'Squadra ')}</small>
          </button>
        ))}
        <span className="tsep" />
        {GEAR.map((t) => (
          <button key={t} className={'tool' + (tool === t ? ' on' : '')} onClick={() => setTool(t)} title={ITEM_LABEL[t]}>
            <MiniIcon type={t} />
            <small>{ITEM_LABEL[t]}</small>
          </button>
        ))}
        <span className="tsep" />
        {ARROWS.map((k) => (
          <button key={k} className={'tool' + (tool === `arrow:${k}` ? ' on' : '')} onClick={() => setTool(`arrow:${k}`)} title={ARROW_STYLE[k].label}>
            <ArrowIcon kind={k} />
            <small>{ARROW_STYLE[k].label.split(' ')[0]}</small>
          </button>
        ))}
      </div>

      <div className="steps-bar">
        {d.steps.map((s, i) => (
          <button key={i} className={'chip' + (i === step ? ' on' : '')} onClick={() => setStep(i)}>
            {i + 1}. {s.title}
          </button>
        ))}
        <button className="chip add" onClick={addStep}>
          + Step
        </button>
        <span className="grow" />
        <label className="check">
          <input type="checkbox" checked={autoAnim} onChange={(e) => setAutoAnim(e.target.checked)} /> Freccia = movimento
        </label>
        <button className="btn sm" onClick={undo} disabled={!hist.current.length} title="Annulla (Ctrl+Z)">
          ↶ Annulla
        </button>
        <button className="btn sm primary" onClick={() => setPreview(true)} disabled={d.steps.length < 2}>
          ▶ Anteprima
        </button>
      </div>

      <div className="editor-main">
        <div className="pitch-frame editing" style={{ ['--ar' as string]: fieldAspect(d) }}>
          <PitchView
            d={d}
            step={step}
            selectedId={sel}
            svgRef={svgRef}
            onPointerDown={onBgDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onItemDown={onItemDown}
            onArrowDown={onArrowDown}
          >
            {/* frecce dello step precedente in trasparenza, come guida */}
            {step > 0 &&
              d.arrows
                .filter((a) => a.step === step - 1)
                .map((a) => {
                  const c = control(a.from, a.to, a.curve)
                  return <path key={'g' + a.id} d={`M ${a.from.x} ${a.from.y} Q ${c.x} ${c.y} ${a.to.x} ${a.to.y}`} fill="none" stroke="#fff" strokeOpacity={0.18} strokeWidth={u * 0.1} strokeDasharray={`${u * 0.2} ${u * 0.2}`} pointerEvents="none" />
                })}
            {draft && (
              <g pointerEvents="none" opacity={0.85}>
                <line x1={draft.from.x} y1={draft.from.y} x2={draft.to.x} y2={draft.to.y} stroke={ARROW_STYLE[draft.kind].color} strokeWidth={u * 0.14} strokeDasharray={`${u * 0.3} ${u * 0.2}`} />
                <circle cx={draft.to.x} cy={draft.to.y} r={u * 0.3} fill={ARROW_STYLE[draft.kind].color} />
              </g>
            )}
            {selArrow && selArrow.step === step && tool === 'select' && (
              <g>
                {(['from', 'to'] as const).map((k) => (
                  <circle key={k} cx={selArrow[k].x} cy={selArrow[k].y} r={hr} fill="#38bdf8" stroke="#fff" strokeWidth={u * 0.08} style={{ cursor: 'move' }} onPointerDown={(e) => onHandleDown(e, k, selArrow.id)} />
                ))}
                {(() => {
                  const c = control(selArrow.from, selArrow.to, (selArrow.curve ?? 0) / 2)
                  return <rect x={c.x - hr} y={c.y - hr} width={hr * 2} height={hr * 2} rx={hr * 0.3} fill="#f472b6" stroke="#fff" strokeWidth={u * 0.08} style={{ cursor: 'move' }} onPointerDown={(e) => onHandleDown(e, 'curve', selArrow.id)} />
                })()}
              </g>
            )}
          </PitchView>
        </div>

        <aside className="inspector">
          <div className="field-group">
            <label>Campo</label>
            <select value={d.field.preset} onChange={(e) => setField(e.target.value as FieldPreset)}>
              {Object.entries(FIELD_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <div className="row gap-s">
              <label className="inline">
                L
                <input type="number" min={5} max={110} value={d.field.w} onChange={(e) => commit({ ...d, field: { ...d.field, w: Math.max(5, Number(e.target.value) || 5) } })} />
              </label>
              <label className="inline">
                H
                <input type="number" min={5} max={75} value={d.field.h} onChange={(e) => commit({ ...d, field: { ...d.field, h: Math.max(5, Number(e.target.value) || 5) } })} />
              </label>
              <small className="muted">metri</small>
            </div>
          </div>

          <div className="field-group">
            <label>Step {step + 1}</label>
            <input value={d.steps[step]?.title ?? ''} onChange={(e) => commit({ ...d, steps: d.steps.map((s, i) => (i === step ? { ...s, title: e.target.value } : s)) }, false)} placeholder="Titolo fase" />
            <textarea rows={2} value={d.steps[step]?.note ?? ''} onChange={(e) => commit({ ...d, steps: d.steps.map((s, i) => (i === step ? { ...s, note: e.target.value } : s)) }, false)} placeholder="Nota per l'allenatore" />
            {d.steps.length > 1 && (
              <button className="btn sm danger" onClick={() => delStep(step)}>
                Elimina step
              </button>
            )}
          </div>

          {selItem && (
            <div className="field-group">
              <label>{ITEM_LABEL[selItem.type]}</label>
              <input value={selItem.label ?? ''} maxLength={3} onChange={(e) => patchItem({ label: e.target.value })} placeholder="Etichetta" />
              {['goal', 'minigoal', 'hurdle'].includes(selItem.type) && (
                <label className="inline">
                  Rotazione
                  <input type="range" min={0} max={345} step={15} value={selItem.rot ?? 0} onChange={(e) => patchItem({ rot: Number(e.target.value) })} />
                </label>
              )}
              {step > 0 && selItem.pos[step] && (
                <button
                  className="btn sm"
                  onClick={() => {
                    const pos = { ...selItem.pos }
                    delete pos[step]
                    patchItem({ pos })
                  }}
                >
                  Resta fermo in questo step
                </button>
              )}
              <button className="btn sm danger" onClick={removeSel}>
                Elimina
              </button>
            </div>
          )}

          {selArrow && (
            <div className="field-group">
              <label>Freccia</label>
              <select value={selArrow.kind} onChange={(e) => patchArrow({ kind: e.target.value as ArrowKind })}>
                {ARROWS.map((k) => (
                  <option key={k} value={k}>
                    {ARROW_STYLE[k].label}
                  </option>
                ))}
              </select>
              <input value={selArrow.label ?? ''} maxLength={3} onChange={(e) => patchArrow({ label: e.target.value || undefined })} placeholder="Numero / etichetta" />
              <button className="btn sm" onClick={() => patchArrow({ curve: 0 })}>
                Raddrizza
              </button>
              <button className="btn sm danger" onClick={removeSel}>
                Elimina
              </button>
            </div>
          )}

          <div className="hint">
            {tool === 'select' && 'Trascina pedine e attrezzi. Tocca una freccia per modificarla (punti blu = estremi, rosa = curva).'}
            {!tool.startsWith('arrow:') && tool !== 'select' && `Tocca il campo per inserire: ${ITEM_LABEL[tool as ItemType]}.`}
            {tool.startsWith('arrow:') && 'Trascina partendo da un giocatore. Con "Freccia = movimento" il giocatore (o il pallone) si sposta nello step successivo.'}
          </div>
        </aside>
      </div>
    </div>
  )
}
