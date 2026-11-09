import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { AREA_COLOR, AREA_LABEL, FASE_LABEL, FASI, type Exercise, type Session, type SessionItem } from '../types'
import { PitchView } from '../pitch/PitchView'
import { buildMonthlyReport, monthRange, presenti, type MonthlyReport } from '../lib/monthlyReport'
import { monthKey, todayStr } from '../lib/util'

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
  const esterno = q.get('tipo') === 'esterno'
  const rep = useMemo(() => buildMonthlyReport({ sessions, exercises, cycles, matches, players }, from, to, gruppo), [sessions, exercises, cycles, matches, players, from, to, gruppo])

  return (
    <div className="print-page mr">
      <div className="no-print print-bar">
        <Link to="/report" className="btn">
          ← Report
        </Link>
        <span className="muted sm">{esterno ? 'Versione per esterni: senza valutazione, presenze nominative e note dello staff' : 'Versione interna staff'}</span>
        <button className="btn primary" onClick={() => window.print()}>
          ⎙ Stampa / Salva PDF
        </button>
      </div>
      <MonthlyReportView rep={rep} esterno={esterno} />
    </div>
  )
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const dd = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const ddy = (d: string) => `${dd(d)}/${d.slice(0, 4)}`

/** testo libero → elenco puntato (righe, altrimenti frasi) */
function bullets(t?: string): string[] {
  if (!t) return []
  const righe = t
    .split(/\n+/)
    .map((x) => x.replace(/^[-•·*]\s*/, '').trim())
    .filter(Boolean)
  if (righe.length > 1) return righe
  return t
    .split(/(?<=[.;!?])\s+(?=[A-ZÀ-Ü0-9«"])/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function ordered(s: Session): SessionItem[] {
  return FASI.flatMap((f) => s.items.filter((i) => i.fase === f))
}

/** Raccolta sedute del periodo: copertina con indice e minuti per area, valutazione, poi una scheda per seduta e una pagina per esercizio. */
/**
 * esterno = versione da condividere (famiglie, società): solo il lavoro svolto.
 * Niente pagina di valutazione, target, presenze nominative, partite e note dello staff.
 */
export function MonthlyReportView({ rep, generato = todayStr(), exercises, esterno = false }: { rep: MonthlyReport; generato?: string; exercises?: Exercise[]; esterno?: boolean }) {
  const exMap = new Map((exercises ?? rep.esercizi.map((x) => x.e)).map((e) => [e.id, e]))
  const gruppo = rep.gruppo || rep.done[0]?.gruppo || 'Scuola calcio'
  const N = rep.done.length
  // numeri di pagina: 1 copertina, 2 valutazione (solo interno), poi per seduta 1 scheda + 1 pagina per esercizio
  let pag = esterno ? 2 : 3
  const pagine = rep.done.map((s) => {
    const p = pag
    pag += 1 + s.items.filter((it) => exMap.has(it.exerciseId)).length
    return p
  })
  const maxTot = Math.max(1, ...rep.matrice.map((r) => r.tot))

  return (
    <>
      {/* ===== copertina ===== */}
      <section className="rs-page">
        <h1 className="rs-h1">{gruppo} · Raccolta sedute</h1>
        <p className="rs-sub">
          Dal {dd(rep.from)} al {ddy(rep.to)} · {N} sedute · {esterno ? 'sommario delle aree di lavoro' : 'sommario di valutazione delle aree di lavoro'}
        </p>
        <h3 className="rs-h3">Indice</h3>
        <table className="rs-tbl">
          <thead>
            <tr>
              <th>Data</th>
              <th>Focus seduta</th>
              <th>Durata</th>
              <th>Pres.</th>
              <th>Pag.</th>
            </tr>
          </thead>
          <tbody>
            {rep.done.map((s, i) => (
              <tr key={s.id}>
                <td>{dd(s.data)}</td>
                <td>{s.obiettivo ? `${s.titolo} — ${s.obiettivo}` : s.titolo}</td>
                <td>{sum(s.items.map((x) => x.minuti))}′</td>
                <td>{presenti(s) ?? '—'}</td>
                <td>{pagine[i]}</td>
              </tr>
            ))}
            {!N && (
              <tr>
                <td colSpan={5}>Nessuna seduta segnata come svolta nel periodo.</td>
              </tr>
            )}
          </tbody>
        </table>

        {N > 0 && (
          <>
            <h3 className="rs-h3">Minuti per area di lavoro</h3>
            <table className="rs-tbl rs-num">
              <thead>
                <tr>
                  <th>Area</th>
                  {rep.done.map((s) => (
                    <th key={s.id}>{s.data.slice(8, 10)}</th>
                  ))}
                  <th>Tot</th>
                  <th>%</th>
                  {!esterno && rep.mesocicli.length > 0 && <th>Target</th>}
                </tr>
              </thead>
              <tbody>
                {rep.matrice.map((r) => {
                  const a = rep.aree.find((x) => x.area === r.area)
                  return (
                    <tr key={r.area}>
                      <td>
                        <i className="dot-c" style={{ background: AREA_COLOR[r.area] }} /> {AREA_LABEL[r.area]}
                      </td>
                      {r.perSeduta.map((m, i) => (
                        <td key={i}>{m || '–'}</td>
                      ))}
                      <td>
                        <b>{r.tot}</b>
                      </td>
                      <td>{r.perc}%</td>
                      {!esterno && rep.mesocicli.length > 0 && <td className={a?.delta != null && Math.abs(a.delta) >= 8 ? 'mr-warn' : ''}>{a?.target ?? 0}%</td>}
                    </tr>
                  )
                })}
                <tr className="rs-tot">
                  <td>Totale</td>
                  {rep.done.map((s) => (
                    <td key={s.id}>{sum(s.items.filter((x) => exMap.has(x.exerciseId)).map((x) => x.minuti))}</td>
                  ))}
                  <td>{rep.agg.minutiTot}</td>
                  <td>100%</td>
                  {!esterno && rep.mesocicli.length > 0 && <td />}
                </tr>
              </tbody>
            </table>

            <div className="rs-chart">
              {rep.matrice.map((r) => (
                <div key={r.area} className="rs-chart-row">
                  <span>{AREA_LABEL[r.area]}</span>
                  <div>
                    <i style={{ width: `${(r.tot / maxTot) * 100}%`, background: AREA_COLOR[r.area] }} />
                    <b>{r.tot}′</b>
                  </div>
                </div>
              ))}
            </div>
            {rep.temi.length > 0 && (
              <p className="rs-small">
                <b>Temi trasversali dentro gli esercizi:</b> {rep.temi.slice(0, 10).map((t) => `${t.o} ${t.date.map((d) => d.slice(8, 10)).join('-')}`).join(' · ')}.
              </p>
            )}
            {rep.mesocicli.length > 0 && <p className="rs-small">Mesocicli: {rep.mesocicli.map((m) => `${m.nome} (${dd(m.inizio)}–${dd(m.fine)}) · ${m.obiettivoGenerale}`).join(' — ')}</p>}
          </>
        )}
      </section>

      {/* ===== valutazione (solo staff) ===== */}
      {!esterno && (
      <section className="rs-page">
        <h3 className="rs-h3">Valutazione</h3>
        <table className="rs-tbl">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Aspetto</th>
              <th style={{ width: '40%' }}>Esito</th>
              <th>Implicazione</th>
            </tr>
          </thead>
          <tbody>
            {rep.valutazione.map((v) => (
              <tr key={v.aspetto} className={v.alert ? 'rs-alert' : ''}>
                <td>{v.aspetto}</td>
                <td>{v.esito}</td>
                <td>{v.implicazione}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="rs-h3">Scostamenti rilevanti</h3>
        <ul className="rs-ul">
          {rep.puntiRiunione.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>

        {rep.azioni.length > 0 && (
          <>
            <h3 className="rs-h3">Azioni per le prossime sedute</h3>
            <ul className="rs-ul">
              {rep.azioni.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}

        {rep.partite.length > 0 && (
          <>
            <h3 className="rs-h3">Partite del periodo</h3>
            <table className="rs-tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Partita</th>
                  <th>Ris.</th>
                  <th>Punti di forza</th>
                  <th>Carenze</th>
                </tr>
              </thead>
              <tbody>
                {rep.partite.map((m) => (
                  <tr key={m.id}>
                    <td>{dd(m.data)}</td>
                    <td>{m.casa ? `GSD – ${m.avversario}` : `${m.avversario} – GSD`}</td>
                    <td>{m.golFatti != null && m.golSubiti != null ? (m.casa ? `${m.golFatti}-${m.golSubiti}` : `${m.golSubiti}-${m.golFatti}`) : '—'}</td>
                    <td>{m.puntiForza || '—'}</td>
                    <td>{m.carenze || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {rep.giocatori.length > 0 && (
          <>
            <h3 className="rs-h3">Presenze per bambino</h3>
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
          </>
        )}

        <h3 className="rs-h3">Limiti di questa valutazione</h3>
        <ul className="rs-ul">
          <li>Basata sulle sedute segnate come svolte in GSD Coach (esercizi e minuti registrati), non su cosa è successo in campo né sui singoli bambini.</li>
          <li>Minuti assegnati all'area principale di ogni esercizio; i minuti degli obiettivi sono divisi tra gli obiettivi dell'esercizio.</li>
          {rep.nonSvolte.length > 0 && <li>Sedute ancora "pianificate" escluse: {rep.nonSvolte.map((s) => `${dd(s.data)} ${s.titolo}`).join(' · ')}.</li>}
        </ul>

        <h3 className="rs-h3">Note della riunione / decisioni</h3>
        <div className="mr-lines" />
      </section>
      )}

      {/* ===== sedute ===== */}
      {rep.done.map((s) => (
        <SessionPages key={s.id} s={s} gruppo={gruppo} exMap={exMap} esterno={esterno} />
      ))}
      <p className="rs-small rs-foot">Generato da GSD Coach il {ddy(generato)}.</p>
    </>
  )
}

function SessionPages({ s, gruppo, exMap, esterno }: { s: Session; gruppo: string; exMap: Map<string, Exercise>; esterno: boolean }) {
  const items = ordered(s).filter((it) => exMap.has(it.exerciseId))
  let clock = 0
  const materiale = [...new Set(items.map((it) => exMap.get(it.exerciseId)!.materiale).filter(Boolean))]
  const chiavi = items.flatMap((it) => bullets(exMap.get(it.exerciseId)!.coaching).slice(0, 1))
  return (
    <>
      <section className="rs-page">
        <h1 className="rs-h1">
          Seduta {ddy(s.data)} · {gruppo}
        </h1>
        <p className="rs-sub">
          {s.obiettivo ? `Obiettivo: ${s.obiettivo} · ` : ''}
          {sum(s.items.map((x) => x.minuti))}′ · presenti {presenti(s) ?? '—'}
          {s.titolo ? ` · ${s.titolo}` : ''}
        </p>
        <table className="rs-tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>Min</th>
              <th>Fase</th>
              <th>Esercizio</th>
              <th>Durata</th>
              <th>Spazio</th>
              <th>Obiettivo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const e = exMap.get(it.exerciseId)!
              const a = clock
              clock += it.minuti
              return (
                <tr key={it.uid}>
                  <td>{i + 1}</td>
                  <td>
                    {a}–{clock}′
                  </td>
                  <td>{FASE_LABEL[it.fase]}</td>
                  <td>
                    <span className="mr-code" style={{ background: AREA_COLOR[e.area] }}>
                      {e.code}
                    </span>{' '}
                    {e.title}
                  </td>
                  <td>{it.minuti}′</td>
                  <td>{e.spazio}</td>
                  <td>{e.obiettivi.slice(0, 3).join(', ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {chiavi.length > 0 && (
          <>
            <h3 className="rs-h3">Chiavi di conduzione</h3>
            <ul className="rs-ul">
              {chiavi.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </>
        )}
        {materiale.length > 0 && (
          <>
            <h3 className="rs-h3">Materiale</h3>
            <ul className="rs-ul">
              <li>{materiale.join(' · ')}</li>
            </ul>
          </>
        )}
        <Legenda />
        {!esterno && s.noteFinali && <div className="rs-box">📝 {s.noteFinali}</div>}
      </section>
      {items.map((it, i) => (
        <ExercisePage key={it.uid} n={i + 1} it={it} e={exMap.get(it.exerciseId)!} esterno={esterno} />
      ))}
    </>
  )
}

function ExercisePage({ n, it, e, esterno }: { n: number; it: SessionItem; e: Exercise; esterno: boolean }) {
  const perche = bullets(e.perche)
  const come = bullets(e.descrizione)
  const punti = bullets(e.coaching)
  const varianti = bullets(e.varianti)
  const rot = bullets(e.rotazione)
  const steps = e.diagram.steps.length > 1 ? e.diagram.steps.slice(0, -1) : []
  return (
    <section className="rs-page">
      <div className="rs-exhead">
        <b>
          {n} · {e.title}
        </b>
        <span>
          {FASE_LABEL[it.fase]} · {it.minuti}′ · {e.spazio}
        </span>
      </div>
      <div className="rs-strip">
        <b>Codice</b> {e.code} · <b>Spazio</b> {e.spazio} · <b>Giocatori</b> {e.giocatori} · <b>Tempo</b> {it.minuti}′ · <b>Materiale</b> {e.materiale || '—'}
      </div>
      <div className="rs-pitch">
        <PitchView d={e.diagram} overlay />
      </div>
      {steps.length > 0 && (
        <p className="rs-small">
          {steps.map((st, i) => (
            <span key={i}>
              <b>{i + 1}</b> {st.title}
              {st.note ? ` — ${st.note}` : ''}
              {i < steps.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      )}
      <div className="rs-2col">
        <div>
          <Block t="Perché" xs={perche} />
          <Block t="Come si fa" xs={come} />
          <Block t="Rotazione" xs={rot} />
        </div>
        <div>
          <Block t="Punti da osservare" xs={punti} />
          <Block t="Varianti" xs={varianti} />
        </div>
      </div>
      {!esterno && it.note && <div className="rs-box">📝 {it.note}</div>}
    </section>
  )
}

function Block({ t, xs }: { t: string; xs: string[] }) {
  if (!xs.length) return null
  return (
    <>
      <h4 className="rs-h4">{t}</h4>
      <ul className="rs-ul">
        {xs.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </>
  )
}

function Legenda() {
  return <div className="rs-legend">Legenda campetto: linea bianca = passaggio · tratteggio giallo = movimento senza palla · linea ondulata = conduzione · rosso = tiro</div>
}
