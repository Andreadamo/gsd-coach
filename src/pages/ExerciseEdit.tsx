import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { AREE, AREA_LABEL, FASI, FASE_LABEL, OBIETTIVI, type Area, type Exercise } from '../types'
import { PitchEditor } from '../pitch/PitchEditor'
import { clone, cx, nowIso, uid } from '../lib/util'
import { Empty } from '../components/common'

const PREFIX: Record<Area, string> = {
  tecnica: 'TEC',
  coordinativa: 'COO',
  situazioni: 'SIT',
  tattica: 'TAT',
  finalizzazione: 'FIN',
  partita: 'PAR',
  portiere: 'POR',
}

function nextCode(all: Exercise[], area: Area) {
  const p = PREFIX[area]
  const nums = all.filter((e) => e.code.startsWith(p + '-')).map((e) => parseInt(e.code.slice(p.length + 1)) || 0)
  return `${p}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`
}

function blank(all: Exercise[]): Exercise {
  return {
    id: uid(),
    code: nextCode(all, 'tecnica'),
    title: '',
    area: 'tecnica',
    fase: ['centrale'],
    obiettivi: [],
    eta: 'U9-U10',
    giocatori: '',
    spazio: '20x15 m',
    durata: 15,
    materiale: '',
    perche: '',
    descrizione: '',
    diagram: { field: { preset: 'spazio', w: 20, h: 15 }, items: [], arrows: [], steps: [{ title: 'Disposizione' }] },
    updatedAt: nowIso(),
  }
}

export default function ExerciseEdit() {
  const { id } = useParams()
  const all = useStore((s) => s.exercises)
  const upsert = useStore((s) => s.upsert)
  const nav = useNavigate()
  const existing = all.find((e) => e.id === id)
  const [e, setE] = useState<Exercise>(() => (existing ? clone(existing) : blank(all)))
  const [tab, setTab] = useState<'campo' | 'scheda'>('campo')

  if (id && !existing) return <Empty>Esercizio non trovato.</Empty>

  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setE((p) => ({ ...p, [k]: v }))
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const save = () => {
    if (!e.title.trim()) {
      alert('Inserisci un titolo.')
      setTab('scheda')
      return
    }
    upsert('exercises', e)
    nav(`/esercizio/${e.id}`)
  }

  return (
    <div>
      <div className="row between wrap gap-s mb">
        <Link to={existing ? `/esercizio/${e.id}` : '/libreria'} className="muted">
          ← Annulla
        </Link>
        <div className="seg">
          <button className={cx(tab === 'campo' && 'on')} onClick={() => setTab('campo')}>
            Campetto
          </button>
          <button className={cx(tab === 'scheda' && 'on')} onClick={() => setTab('scheda')}>
            Scheda
          </button>
        </div>
        <button className="btn primary" onClick={save}>
          Salva esercizio
        </button>
      </div>

      <div className="row gap-s wrap mb">
        <input className="title-input" value={e.title} onChange={(ev) => set('title', ev.target.value)} placeholder="Titolo esercizio" />
        <input className="code-input" value={e.code} onChange={(ev) => set('code', ev.target.value.toUpperCase())} />
      </div>

      {tab === 'campo' ? (
        <PitchEditor value={e.diagram} onChange={(d) => set('diagram', d)} />
      ) : (
        <div className="form-grid">
          <div className="card stack">
            <label className="lbl">Area</label>
            <select
              value={e.area}
              onChange={(ev) => {
                const a = ev.target.value as Area
                setE((p) => ({ ...p, area: a, code: existing ? p.code : nextCode(all, a) }))
              }}
            >
              {AREE.map((a) => (
                <option key={a} value={a}>
                  {AREA_LABEL[a]}
                </option>
              ))}
            </select>
            <label className="lbl">Fase della seduta</label>
            <div className="row wrap gap-xs">
              {FASI.map((f) => (
                <button key={f} type="button" className={cx('chip', e.fase.includes(f) && 'on')} onClick={() => set('fase', toggle(e.fase, f))}>
                  {FASE_LABEL[f]}
                </button>
              ))}
            </div>
            <label className="lbl">Obiettivi</label>
            <div className="row wrap gap-xs">
              {OBIETTIVI.map((o) => (
                <button key={o} type="button" className={cx('chip sm', e.obiettivi.includes(o) && 'on')} onClick={() => set('obiettivi', toggle(e.obiettivi, o))}>
                  {o}
                </button>
              ))}
            </div>
            <div className="grid-2">
              <div>
                <label className="lbl">Età</label>
                <input value={e.eta} onChange={(ev) => set('eta', ev.target.value)} />
              </div>
              <div>
                <label className="lbl">Giocatori</label>
                <input value={e.giocatori} onChange={(ev) => set('giocatori', ev.target.value)} />
              </div>
              <div>
                <label className="lbl">Spazio</label>
                <input value={e.spazio} onChange={(ev) => set('spazio', ev.target.value)} />
              </div>
              <div>
                <label className="lbl">Durata (min)</label>
                <input type="number" min={1} value={e.durata} onChange={(ev) => set('durata', Number(ev.target.value) || 1)} />
              </div>
            </div>
            <label className="lbl">Materiale</label>
            <input value={e.materiale} onChange={(ev) => set('materiale', ev.target.value)} />
          </div>
          <div className="card stack">
            <label className="lbl">Perché si fa</label>
            <textarea rows={3} value={e.perche} onChange={(ev) => set('perche', ev.target.value)} />
            <label className="lbl">Come si fa</label>
            <textarea rows={5} value={e.descrizione} onChange={(ev) => set('descrizione', ev.target.value)} />
            <label className="lbl">Rotazione</label>
            <input value={e.rotazione ?? ''} onChange={(ev) => set('rotazione', ev.target.value)} />
            <label className="lbl">Coaching points</label>
            <textarea rows={3} value={e.coaching ?? ''} onChange={(ev) => set('coaching', ev.target.value)} />
            <label className="lbl">Varianti / progressioni</label>
            <textarea rows={3} value={e.varianti ?? ''} onChange={(ev) => set('varianti', ev.target.value)} />
            <label className="lbl">Fonte</label>
            <input value={e.fonte ?? ''} onChange={(ev) => set('fonte', ev.target.value)} />
          </div>
        </div>
      )}
    </div>
  )
}
