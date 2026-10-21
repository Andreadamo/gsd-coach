import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { AREE, AREA_COLOR, AREA_LABEL, FASI, FASE_LABEL, type Exercise, type Fase, type Session, type SessionItem } from '../types'
import { AreaBadge, Empty } from '../components/common'
import { PitchView } from '../pitch/PitchView'
import { FilterBar, useExerciseFilter } from './Library'
import { clone, cx, fmtDate, uid } from '../lib/util'
import { findMeso } from '../lib/stats'
import { sessionMinutes } from './Sessions'

export default function SessionBuilder() {
  const { id } = useParams()
  const stored = useStore((s) => s.sessions.find((x) => x.id === id))
  const exercises = useStore((s) => s.exercises)
  const cycles = useStore((s) => s.cycles)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const nav = useNavigate()
  const [s, setS] = useState<Session | undefined>(() => (stored ? clone(stored) : undefined))
  const [target, setTarget] = useState<Fase>('centrale')
  const [pickerOpen, setPickerOpen] = useState(false)
  const dragRef = useRef<{ kind: 'lib'; exId: string } | { kind: 'item'; uid: string } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const f = useExerciseFilter()
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const dirty = useRef(false)

  // sincronizza se cambia dal cloud e non ho modifiche locali
  useEffect(() => {
    if (stored && !dirty.current) setS(clone(stored))
  }, [stored])

  // autosalvataggio
  useEffect(() => {
    if (!s || !dirty.current) return
    const t = setTimeout(() => {
      upsert('sessions', s)
      dirty.current = false
    }, 600)
    return () => clearTimeout(t)
  }, [s, upsert])

  // salva subito se si esce dalla pagina con modifiche pendenti
  const latest = useRef(s)
  latest.current = s
  useEffect(
    () => () => {
      if (dirty.current && latest.current) upsert('sessions', latest.current)
    },
    [upsert],
  )

  if (!s) return <Empty>Seduta non trovata.</Empty>

  const update = (patch: Partial<Session>) => {
    dirty.current = true
    setS((p) => (p ? { ...p, ...patch } : p))
  }
  const setItems = (items: SessionItem[]) => update({ items })

  const addEx = (e: Exercise, fase: Fase = target, beforeUid?: string) => {
    const it: SessionItem = { uid: uid(), exerciseId: e.id, fase, minuti: e.durata }
    const items = [...s.items]
    const idx = beforeUid ? items.findIndex((x) => x.uid === beforeUid) : -1
    if (idx >= 0) items.splice(idx, 0, it)
    else items.push(it)
    setItems(items)
  }

  const moveItem = (u: string, fase: Fase, beforeUid?: string) => {
    const it = s.items.find((x) => x.uid === u)
    if (!it) return
    const rest = s.items.filter((x) => x.uid !== u)
    const moved = { ...it, fase }
    const idx = beforeUid ? rest.findIndex((x) => x.uid === beforeUid) : -1
    if (idx >= 0) rest.splice(idx, 0, moved)
    else rest.push(moved)
    setItems(rest)
  }

  const shift = (u: string, dir: -1 | 1) => {
    const it = s.items.find((x) => x.uid === u)!
    const same = s.items.filter((x) => x.fase === it.fase)
    const i = same.findIndex((x) => x.uid === u)
    const j = i + dir
    if (j < 0 || j >= same.length) {
      // passa alla fase adiacente
      const fi = FASI.indexOf(it.fase) + dir
      if (fi >= 0 && fi < FASI.length) moveItem(u, FASI[fi])
      return
    }
    const other = same[j]
    const items = [...s.items]
    const a = items.findIndex((x) => x.uid === u)
    const b = items.findIndex((x) => x.uid === other.uid)
    ;[items[a], items[b]] = [items[b], items[a]]
    setItems(items)
  }

  const onDrop = (fase: Fase, beforeUid?: string) => {
    const d = dragRef.current
    dragRef.current = null
    setOver(null)
    if (!d) return
    if (d.kind === 'lib') {
      const e = exMap.get(d.exId)
      if (e) addEx(e, fase, beforeUid)
    } else if (d.uid !== beforeUid) moveItem(d.uid, fase, beforeUid)
  }

  const tot = sessionMinutes(s)
  const ctx = findMeso(cycles, s.data, s.gruppo)
  const areaMin = AREE.map((a) => ({ a, m: s.items.filter((i) => exMap.get(i.exerciseId)?.area === a).reduce((x, y) => x + y.minuti, 0) })).filter((x) => x.m > 0)

  const duplicate = () => {
    const c: Session = { ...clone(s), id: uid(), titolo: s.titolo + ' (copia)', stato: 'pianificata', presenti: undefined, ownerId: undefined, items: s.items.map((i) => ({ ...i, uid: uid() })) }
    upsert('sessions', c)
    nav(`/seduta/${c.id}`)
  }

  return (
    <div className="builder">
      <div className="row between wrap gap-s mb">
        <Link to="/sedute" className="muted">
          ← Sedute
        </Link>
        <div className="row gap-s wrap">
          <Link to={`/seduta/${s.id}/stampa`} className="btn primary" onClick={() => s && upsert('sessions', s)}>
            ⎙ Stampa / PDF
          </Link>
          <button className="btn" onClick={duplicate}>
            Duplica
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('Eliminare la seduta?')) {
                remove('sessions', s.id)
                nav('/sedute')
              }
            }}
          >
            Elimina
          </button>
        </div>
      </div>

      <div className="card session-head">
        <input className="title-input" value={s.titolo} onChange={(e) => update({ titolo: e.target.value })} placeholder="Titolo seduta" />
        <div className="head-grid">
          <label>
            Data
            <input type="date" value={s.data} onChange={(e) => update({ data: e.target.value })} />
          </label>
          <label>
            Gruppo
            <input value={s.gruppo} onChange={(e) => update({ gruppo: e.target.value })} />
          </label>
          <label>
            Durata (min)
            <input type="number" min={15} step={5} value={s.durataTarget} onChange={(e) => update({ durataTarget: Number(e.target.value) || 60 })} />
          </label>
          <label>
            Stato
            <select value={s.stato} onChange={(e) => update({ stato: e.target.value as Session['stato'] })}>
              <option value="pianificata">Pianificata</option>
              <option value="svolta">Svolta</option>
            </select>
          </label>
          {s.stato === 'svolta' && (
            <label>
              Presenti
              <input type="number" min={0} value={s.presenti ?? ''} onChange={(e) => update({ presenti: Number(e.target.value) || undefined })} />
            </label>
          )}
          <label className="span2">
            Obiettivo della seduta
            <input value={s.obiettivo} onChange={(e) => update({ obiettivo: e.target.value })} placeholder="Es. postura del corpo nell'1c1" />
          </label>
        </div>
        {ctx && (
          <div className="meso-ctx">
            <b>{ctx.meso.nome}</b> · settimana {ctx.week}
            {ctx.micro && (
              <>
                {' '}
                — focus: <b>{ctx.micro.focus}</b> {ctx.micro.obiettivi.length > 0 && <span className="muted">({ctx.micro.obiettivi.join(', ')})</span>}
              </>
            )}
          </div>
        )}
        <div className="timebar" title={`${tot} di ${s.durataTarget} minuti`}>
          {areaMin.map(({ a, m }) => (
            <span key={a} style={{ width: `${(m / Math.max(tot, s.durataTarget)) * 100}%`, background: AREA_COLOR[a] }} title={`${AREA_LABEL[a]}: ${m}′`} />
          ))}
        </div>
        <div className="row between wrap sm">
          <div className="row wrap gap-s">
            {areaMin.map(({ a, m }) => (
              <span key={a} className="muted">
                <i className="dot-c" style={{ background: AREA_COLOR[a] }} /> {AREA_LABEL[a].split(' ')[0]} {m}′
              </span>
            ))}
          </div>
          <b className={cx(tot > s.durataTarget && 'over-txt')}>
            {tot}/{s.durataTarget} min {tot > s.durataTarget ? `(+${tot - s.durataTarget})` : tot < s.durataTarget ? `(−${s.durataTarget - tot})` : '✓'}
          </b>
        </div>
      </div>

      <div className={cx('builder-grid', pickerOpen && 'picker-open')}>
        <div className="phases">
          {FASI.map((fase) => {
            const items = s.items.filter((i) => i.fase === fase)
            const min = items.reduce((a, b) => a + b.minuti, 0)
            return (
              <section
                key={fase}
                className={cx('phase', over === fase && 'over', target === fase && 'target')}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(fase)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={() => onDrop(fase)}
                onClick={() => setTarget(fase)}
              >
                <header>
                  <h3>{FASE_LABEL[fase]}</h3>
                  <span className="muted">{min}′</span>
                </header>
                {items.length === 0 && <div className="drop-hint">Trascina qui un esercizio o tocca “+ Aggiungi”</div>}
                {items.map((it) => {
                  const e = exMap.get(it.exerciseId)
                  if (!e) return null
                  return (
                    <div
                      key={it.uid}
                      className="s-item"
                      draggable
                      onDragStart={() => (dragRef.current = { kind: 'item', uid: it.uid })}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={(ev) => {
                        ev.stopPropagation()
                        onDrop(fase, it.uid)
                      }}
                    >
                      <Link to={`/esercizio/${e.id}`} className="s-thumb">
                        <PitchView d={e.diagram} overlay />
                      </Link>
                      <div className="grow">
                        <div className="row gap-s wrap">
                          <span className="code">{e.code}</span>
                          <AreaBadge area={e.area} short />
                        </div>
                        <b className="s-title">{e.title}</b>
                        <input className="note-input" placeholder="Nota (varianti, gruppi, regole…)" value={it.note ?? ''} onChange={(ev) => setItems(s.items.map((x) => (x.uid === it.uid ? { ...x, note: ev.target.value } : x)))} />
                      </div>
                      <div className="s-ctrl">
                        <label className="mins-in">
                          <input type="number" min={1} value={it.minuti} onChange={(ev) => setItems(s.items.map((x) => (x.uid === it.uid ? { ...x, minuti: Number(ev.target.value) || 1 } : x)))} />′
                        </label>
                        <div className="row gap-xs">
                          <button className="btn icon sm" onClick={() => shift(it.uid, -1)} aria-label="Su">
                            ↑
                          </button>
                          <button className="btn icon sm" onClick={() => shift(it.uid, 1)} aria-label="Giù">
                            ↓
                          </button>
                          <button className="btn icon sm danger" onClick={() => setItems(s.items.filter((x) => x.uid !== it.uid))} aria-label="Rimuovi">
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <button
                  className="btn ghost sm add-btn"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setTarget(fase)
                    setPickerOpen(true)
                  }}
                >
                  + Aggiungi esercizio
                </button>
              </section>
            )
          })}
          <section className="card">
            <label className="lbl">Note finali / valutazione seduta</label>
            <textarea rows={3} value={s.noteFinali ?? ''} onChange={(e) => update({ noteFinali: e.target.value })} placeholder="Cosa ha funzionato, cosa riproporre, giocatori da seguire…" />
          </section>
        </div>

        <aside className="picker">
          <div className="row between mb-s">
            <b>
              Libreria → <span className="accent">{FASE_LABEL[target]}</span>
            </b>
            <button className="btn sm picker-close" onClick={() => setPickerOpen(false)}>
              Chiudi
            </button>
          </div>
          <FilterBar f={f} compact />
          <div className="picker-list">
            {f.list.map((e) => (
              <div key={e.id} className="p-item" draggable onDragStart={() => (dragRef.current = { kind: 'lib', exId: e.id })}>
                <div className="p-thumb">
                  <PitchView d={e.diagram} overlay />
                </div>
                <div className="grow">
                  <div className="row gap-s">
                    <span className="code">{e.code}</span>
                    <span className="muted sm">{e.durata}′</span>
                  </div>
                  <div className="p-title">{e.title}</div>
                  <AreaBadge area={e.area} short />
                </div>
                <button className="btn sm primary" onClick={() => addEx(e)}>
                  +
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <p className="muted sm mt">{fmtDate(s.data)} · salvataggio automatico</p>
    </div>
  )
}
