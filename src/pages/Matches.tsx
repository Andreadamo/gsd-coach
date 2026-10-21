import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { ASPETTI, type Match } from '../types'
import { Empty, PageHead } from '../components/common'
import { carenzeDaPartite } from '../lib/matchAdvice'
import { cx, fmtDate, nowIso, parseDate, todayStr, toDateStr, uid } from '../lib/util'

/** Prossimo sabato o domenica (oggi incluso se è weekend), altrimenti l'ultimo weekend passato se più vicino. */
function weekendDate(today: string) {
  const d = parseDate(today)
  const wd = d.getDay()
  if (wd === 0 || wd === 6) return today
  // lun-mer → weekend appena passato; gio-ven → prossimo sabato
  if (wd <= 3) d.setDate(d.getDate() - wd)
  else d.setDate(d.getDate() + (6 - wd))
  return toDateStr(d)
}

export function newMatch(data: string): Match {
  return { id: uid(), data, avversario: '', casa: true, gruppo: '2017 Pulcini', formato: '7 contro 7', valutazioni: {}, puntiForza: '', carenze: '', note: '', updatedAt: nowIso() }
}

export function media(m: Match) {
  const v = Object.values(m.valutazioni).filter((x): x is number => !!x)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export default function Matches() {
  const matches = useStore((s) => s.matches)
  const upsert = useStore((s) => s.upsert)
  const nav = useNavigate()
  const sorted = useMemo(() => [...matches].sort((a, b) => b.data.localeCompare(a.data)), [matches])
  const trend = useMemo(() => carenzeDaPartite(sorted.slice(0, 4)).slice(0, 6), [sorted])

  const create = () => {
    const m = newMatch(weekendDate(todayStr()))
    upsert('matches', m)
    nav(`/partita/${m.id}`)
  }

  return (
    <div>
      <PageHead title="Partite ufficiali" sub="Note partita → carenze e punti di forza → consigli per le prossime sedute">
        <Link to="/report" className="btn">
          Report allenamenti
        </Link>
        <button className="btn primary" onClick={create}>
          + Nota partita
        </button>
      </PageHead>

      {trend.length > 0 && (
        <section className="card mb">
          <h3>Da allenare (ultime {Math.min(4, sorted.length)} partite)</h3>
          <div className="row wrap gap-xs">
            {trend.map((c, i) => (
              <span key={c.obiettivo} className={cx('chip sm', i < 2 && 'warn-chip')} title={c.fonti.join(', ')}>
                {c.obiettivo}
              </span>
            ))}
          </div>
        </section>
      )}

      {sorted.length === 0 ? (
        <Empty>Nessuna partita. Dopo la gara del weekend crea una nota: valuta gli aspetti, scrivi punti di forza e carenze e l’app ti propone cosa allenare.</Empty>
      ) : (
        <div className="list">
          {sorted.map((m) => {
            const avg = media(m)
            const ris = m.golFatti != null && m.golSubiti != null ? `${m.golFatti}-${m.golSubiti}` : null
            const low = ASPETTI.filter((a) => (m.valutazioni[a.id] ?? 5) <= 2).map((a) => a.label)
            return (
              <Link key={m.id} to={`/partita/${m.id}`} className="list-row">
                <div className="date-box">
                  <b>{Number(m.data.slice(8))}</b>
                  <small>{fmtDate(m.data).split(' ')[0]}</small>
                </div>
                <div className="grow">
                  <div className="row gap-s wrap">
                    <b>{m.avversario ? `${m.casa ? 'vs' : '@'} ${m.avversario}` : 'Partita'}</b>
                    {ris && <span className="score">{ris}</span>}
                    {m.analisi && <span className="pill ok">analizzata</span>}
                  </div>
                  <div className="muted sm">{low.length ? `Carenze: ${low.slice(0, 3).join(', ')}` : m.carenze ? m.carenze.slice(0, 90) : 'Nessuna carenza segnata'}</div>
                </div>
                {avg != null && <div className={cx('mins', avg < 2.75 && 'over')}>{avg.toFixed(1)}</div>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
