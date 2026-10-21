import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { AREE, AREA_LABEL, FASI, FASE_LABEL, OBIETTIVI, type Area, type Fase } from '../types'
import { Empty, ExerciseCard, PageHead } from '../components/common'
import { cx } from '../lib/util'

export function useExerciseFilter() {
  const exercises = useStore((s) => s.exercises)
  const [q, setQ] = useState('')
  const [area, setArea] = useState<Area | ''>('')
  const [fase, setFase] = useState<Fase | ''>('')
  const [ob, setOb] = useState('')
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return exercises
      .filter((e) => !area || e.area === area)
      .filter((e) => !fase || e.fase.includes(fase))
      .filter((e) => !ob || e.obiettivi.includes(ob))
      .filter((e) => !qq || [e.title, e.code, e.descrizione, e.obiettivi.join(' ')].join(' ').toLowerCase().includes(qq))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [exercises, q, area, fase, ob])
  return { list, q, setQ, area, setArea, fase, setFase, ob, setOb, total: exercises.length }
}

export function FilterBar({ f, compact }: { f: ReturnType<typeof useExerciseFilter>; compact?: boolean }) {
  return (
    <div className={cx('filters', compact && 'compact')}>
      <input className="search" placeholder="Cerca esercizio, codice, obiettivo…" value={f.q} onChange={(e) => f.setQ(e.target.value)} />
      <div className="chips-scroll">
        <button className={cx('chip', !f.area && 'on')} onClick={() => f.setArea('')}>
          Tutte
        </button>
        {AREE.map((a) => (
          <button key={a} className={cx('chip', f.area === a && 'on')} onClick={() => f.setArea(f.area === a ? '' : a)}>
            {compact ? AREA_LABEL[a].split(' ')[0] : AREA_LABEL[a]}
          </button>
        ))}
      </div>
      <div className="row gap-s wrap">
        <select value={f.fase} onChange={(e) => f.setFase(e.target.value as Fase | '')}>
          <option value="">Tutte le fasi</option>
          {FASI.map((x) => (
            <option key={x} value={x}>
              {FASE_LABEL[x]}
            </option>
          ))}
        </select>
        <select value={f.ob} onChange={(e) => f.setOb(e.target.value)}>
          <option value="">Tutti gli obiettivi</option>
          {OBIETTIVI.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function Library() {
  const f = useExerciseFilter()
  return (
    <div>
      <PageHead title="Libreria esercizi" sub={`${f.list.length} di ${f.total} esercizi`}>
        <Link to="/esercizio/nuovo" className="btn primary">
          + Nuovo esercizio
        </Link>
      </PageHead>
      <FilterBar f={f} />
      {f.list.length ? (
        <div className="grid-cards">
          {f.list.map((e) => (
            <ExerciseCard key={e.id} e={e} />
          ))}
        </div>
      ) : (
        <Empty>Nessun esercizio con questi filtri.</Empty>
      )}
    </div>
  )
}
