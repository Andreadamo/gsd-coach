import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { AREA_COLOR, AREA_LABEL, FASE_LABEL, FASI, type Area, type Exercise } from '../types'
import { PitchView } from '../pitch/PitchView'
import { buildMonthlyReport, monthRange, presenti, type MonthlyReport } from '../lib/monthlyReport'
import { addDays, fmtDate, monthKey, todayStr } from '../lib/util'

/** Pagina /report/riunione/stampa?da=YYYY-MM-DD&a=YYYY-MM-DD&gruppo=… */
export default function MonthlyReportPrint() {
  const [q] = useSearchParams()
  const sessions = useStore((s) => s.sessions)
  const exercises = useStore((s) => s.exercises)
  const cycles = useStore((s) => s.cycles)
  const matches = useStore((s) => s.matches)
  const players = useStore((s) => s.players)
  const [defFrom, defTo] = monthRange(monthKey(todayStr()))
  const from = q.get('da') || defFrom
  const to = q.get('a') || defTo
  const gruppo = q.get('gruppo') || ''
  const rep = useMemo(() => buildMonthlyReport({ sessions, exercises, cycles, matches, players }, from, to, gruppo), [sessions, exercises, cycles, matches, players, from, to, gruppo])

  return (
    <div className="print-page mr">
      <div className="no-print print-bar">
        <Link to="/report" className="btn">
          ← Report
        </Link>
        <button className="btn primary" onClick={() => window.print()}>
          ⎙ Stampa / Salva PDF
        </button>
      </div>
      <MonthlyReportView rep={rep} />
    </div>
  )
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const minutiSeduta = (items: { minuti: number }[]) => sum(items.map((i) => i.minuti))

export function MonthlyReportView({ rep, generato = todayStr() }: { rep: MonthlyReport; generato?: string }) {
  const exMap = new Map(rep.esercizi.map((x) => [x.e.id, x.e]))
  const giorni = Math.round((new Date(rep.to).getTime() - new Date(rep.from).getTime()) / 864e5) + 1
  const settimaneAttive = rep.settimane.filter((w) => w.sedute).length
  const maxW = Math.max(1, ...rep.settimane.map((w) => w.minuti))
  const maxOb = Math.max(1, ...rep.obiettivi.map((o) => o.min))
  const b = rep.bilancio

  return (
    <>
      <header className="p-head">
        <div>
          <div className="p-club">GSD Rosignano Solvay 1922 · Scuola Calcio · Riunione tecnica mensile</div>
          <h1>Report allenamenti</h1>
          <div className="p-meta">
            <b>
              {fmtDate(rep.from, false)} → {fmtDate(rep.to, false)}
            </b>{' '}
            ({giorni} giorni) · {rep.gruppo || 'tutti i gruppi'}
          </div>
          {rep.mesocicli.length > 0 && <div className="p-meta">Mesocicli: {rep.mesocicli.map((m) => `${m.nome} (${fmtDate(m.inizio, false)} – ${fmtDate(m.fine, false)})`).join(' · ')}</div>}
        </div>
        <img src="./favicon.svg" width={56} height={56} alt="" />
      </header>

      <div className="mr-kpis">
        <Kpi l="Sedute svolte" v={rep.done.length} s={rep.nonSvolte.length ? `${rep.nonSvolte.length} pianificate non chiuse` : `${settimaneAttive} settimane attive`} />
        <Kpi l="Minuti di lavoro" v={rep.agg.minutiTot} s={rep.done.length ? `${Math.round(rep.agg.minutiTot / rep.done.length)}′ medi a seduta` : ''} />
        <Kpi l="Presenze medie" v={rep.presenzeMedie ?? '—'} s={rep.presenzeRegistrate ? `appello in ${rep.presenzeRegistrate} sedute` : 'appello non registrato'} />
        <Kpi l="Esercizi diversi" v={rep.esercizi.length} s={`${rep.eserciziNuovi.length} nuovi nel periodo`} />
        <Kpi l="Partite" v={rep.partite.length} s={rep.partite.length ? `V${b.v} N${b.p} P${b.s} · gol ${b.gf}-${b.gs}` : '—'} />
      </div>

      <section className="mr-sec mr-points">
        <h2 className="p-phase">Punti per la riunione</h2>
        <ol>
          {rep.puntiRiunione.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </section>

      <div className="mr-2col">
        <section className="mr-sec">
          <h2 className="p-phase">Distribuzione per area</h2>
          <table className="p-summary">
            <thead>
              <tr>
                <th>Area</th>
                <th>Min</th>
                <th>%</th>
                {rep.mesocicli.length > 0 && <th>Target</th>}
                {rep.mesocicli.length > 0 && <th>Δ</th>}
              </tr>
            </thead>
            <tbody>
              {rep.aree.map((a) => (
                <tr key={a.area}>
                  <td>
                    <i className="dot-c" style={{ background: AREA_COLOR[a.area] }} /> {AREA_LABEL[a.area]}
                    <div className="mr-bar">
                      <span style={{ width: `${a.perc}%`, background: AREA_COLOR[a.area] }} />
                      {a.target !== null && <em style={{ left: `${a.target}%` }} />}
                    </div>
                  </td>
                  <td>{a.min}</td>
                  <td>{a.perc}%</td>
                  {a.target !== null && <td>{a.target}%</td>}
                  {a.delta !== null && <td className={Math.abs(a.delta) >= 8 ? 'mr-warn' : ''}>{a.delta > 0 ? `+${a.delta}` : a.delta}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-small">
            Fasi: {rep.perFase.map((f) => `${FASE_LABEL[f.fase]} ${f.min}′ (${f.perc}%)`).join(' · ')}
            {rep.mesocicli.length > 0 && ' · tacca nera = target del mesociclo'}
          </p>
        </section>

        <section className="mr-sec">
          <h2 className="p-phase">Obiettivi allenati</h2>
          <div className="mr-ob">
            {rep.obiettivi.slice(0, 14).map((o) => (
              <div key={o.o} className="mr-ob-row">
                <span>{o.o}</span>
                <div className="mr-bar">
                  <span style={{ width: `${(o.min / maxOb) * 100}%` }} />
                </div>
                <b>{o.min}′</b>
              </div>
            ))}
          </div>
          {rep.maiAllenati.length > 0 && (
            <p className="p-small">
              <b>Mai allenati:</b> {rep.maiAllenati.join(', ')}
            </p>
          )}
        </section>
      </div>

      <section className="mr-sec">
        <h2 className="p-phase">Andamento settimanale</h2>
        <table className="p-summary">
          <thead>
            <tr>
              <th>Settimana</th>
              <th>Sedute</th>
              <th>Minuti</th>
              <th style={{ width: '45%' }}>Aree</th>
              <th>Presenze medie</th>
            </tr>
          </thead>
          <tbody>
            {rep.settimane.map((w) => (
              <tr key={w.lunedi}>
                <td>
                  {fmtDate(w.lunedi, false)} – {fmtDate(addDays(w.lunedi, 6), false)}
                </td>
                <td>{w.sedute}</td>
                <td>{w.minuti}</td>
                <td>
                  <div className="mr-stack" style={{ width: `${(w.minuti / maxW) * 100}%` }}>
                    {(Object.entries(w.aree) as [Area, number][]).map(([a, m]) => (
                      <span key={a} title={AREA_LABEL[a]} style={{ flex: m, background: AREA_COLOR[a] }} />
                    ))}
                  </div>
                </td>
                <td>{w.presenzeMedie ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Legenda aree={[...new Set(rep.aree.filter((a) => a.min).map((a) => a.area))]} />
      </section>

      <section className="mr-sec mr-break">
        <h2 className="p-phase">Registro sedute</h2>
        {rep.done.map((s, i) => (
          <article key={s.id} className="mr-sess">
            <div className="mr-sess-head">
              <span className="mr-n">{i + 1}</span>
              <b>{fmtDate(s.data)}</b>
              <span className="mr-title">{s.titolo}</span>
              <span className="mr-meta">
                {minutiSeduta(s.items)}′ · presenti {presenti(s) ?? '—'}
              </span>
            </div>
            {s.obiettivo && (
              <div className="p-small">
                <b>Obiettivo:</b> {s.obiettivo}
              </div>
            )}
            <table className="mr-items">
              <tbody>
                {FASI.flatMap((f) =>
                  s.items
                    .filter((it) => it.fase === f)
                    .map((it) => {
                      const e = exMap.get(it.exerciseId)
                      return (
                        <tr key={it.uid}>
                          <td className="mr-fase">{FASE_LABEL[f]}</td>
                          <td>
                            {e ? (
                              <>
                                <span className="mr-code" style={{ background: AREA_COLOR[e.area] }}>
                                  {e.code}
                                </span>{' '}
                                {e.title}
                              </>
                            ) : (
                              <i>esercizio eliminato</i>
                            )}
                            {it.note && <span className="mr-note"> — {it.note}</span>}
                          </td>
                          <td className="mr-min">{it.minuti}′</td>
                        </tr>
                      )
                    }),
                )}
              </tbody>
            </table>
            {s.noteFinali && <p className="p-note">📝 {s.noteFinali}</p>}
          </article>
        ))}
        {!rep.done.length && <p>Nessuna seduta segnata come svolta nel periodo.</p>}
        {rep.nonSvolte.length > 0 && (
          <p className="p-small">
            <b>Pianificate non chiuse:</b> {rep.nonSvolte.map((s) => `${fmtDate(s.data, false)} ${s.titolo}`).join(' · ')}
          </p>
        )}
      </section>

      {rep.giocatori.length > 0 && (
        <section className="mr-sec">
          <h2 className="p-phase">Presenze per giocatore</h2>
          <div className="mr-players">
            {rep.giocatori.map((g) => (
              <div key={g.player.id} className={g.perc < 60 ? 'mr-warn' : ''}>
                <span>
                  {g.player.cognome} {g.player.nome}
                </span>
                <b>
                  {g.presenze}/{g.su} · {g.perc}%
                </b>
              </div>
            ))}
          </div>
        </section>
      )}

      {rep.partite.length > 0 && (
        <section className="mr-sec">
          <h2 className="p-phase">Partite del periodo</h2>
          <table className="p-summary">
            <thead>
              <tr>
                <th>Data</th>
                <th>Partita</th>
                <th>Risultato</th>
                <th>Punti di forza</th>
                <th>Carenze</th>
              </tr>
            </thead>
            <tbody>
              {rep.partite.map((m) => (
                <tr key={m.id}>
                  <td>{fmtDate(m.data, false)}</td>
                  <td>{m.casa ? `GSD – ${m.avversario}` : `${m.avversario} – GSD`}</td>
                  <td>{m.golFatti != null && m.golSubiti != null ? (m.casa ? `${m.golFatti}-${m.golSubiti}` : `${m.golSubiti}-${m.golFatti}`) : '—'}</td>
                  <td>{m.puntiForza || '—'}</td>
                  <td>{m.carenze || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {rep.esercizi.length > 0 && (
        <section className="mr-sec mr-break">
          <h2 className="p-phase">Esercizi utilizzati</h2>
          <div className="mr-exgrid">
            {rep.esercizi.map((x) => (
              <ExThumb key={x.e.id} e={x.e} n={x.n} min={x.min} nuovo={rep.eserciziNuovi.includes(x.e)} />
            ))}
          </div>
        </section>
      )}

      <section className="mr-sec mr-notes">
        <h2 className="p-phase">Note della riunione / decisioni</h2>
        <div className="mr-lines" />
      </section>

      <footer className="p-foot">Generato da GSD Coach il {fmtDate(generato, false)} · sono conteggiate solo le sedute in stato "svolta".</footer>
    </>
  )
}

function Kpi({ l, v, s }: { l: string; v: number | string; s?: string }) {
  return (
    <div className="mr-kpi">
      <small>{l}</small>
      <b>{v}</b>
      {s && <span>{s}</span>}
    </div>
  )
}

function Legenda({ aree }: { aree: Area[] }) {
  return (
    <p className="p-small">
      {aree.map((a) => (
        <span key={a} style={{ marginRight: 10 }}>
          <i className="dot-c" style={{ background: AREA_COLOR[a] }} /> {AREA_LABEL[a]}
        </span>
      ))}
    </p>
  )
}

function ExThumb({ e, n, min, nuovo }: { e: Exercise; n: number; min: number; nuovo: boolean }) {
  return (
    <div className="mr-ex">
      <div className="p-diagram">
        <PitchView d={e.diagram} overlay />
      </div>
      <div className="mr-ex-t">
        <span className="mr-code" style={{ background: AREA_COLOR[e.area] }}>
          {e.code}
        </span>{' '}
        <b>{e.title}</b>
        {nuovo && <span className="mr-new">nuovo</span>}
      </div>
      <div className="p-small">
        {n}× · {min}′ · {e.obiettivi.slice(0, 3).join(', ')}
      </div>
    </div>
  )
}
