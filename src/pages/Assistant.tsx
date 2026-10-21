import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store'
import { AREE, AREA_LABEL, FASI, FASE_LABEL, type Area, type Fase } from '../types'
import { PageHead, AreaBadge } from '../components/common'
import { PitchView } from '../pitch/PitchView'
import { cloudEnabled, supabase } from '../lib/supabase'
import { cx, fmtDate, todayStr } from '../lib/util'
import { apply, buildContext, buildDiagram, giocatoriLabel, normalize, type Azione, type Esito, type NuovoSpec, type Piano, type RawRisposta } from '../assistant/plan'
import { useDictation } from '../assistant/useDictation'

const ESEMPI = [
  'Giovedì, parte centrale: 5 contro 4 di possesso in un 10 per 15, 15 minuti',
  'Martedì prossimo attivazione con il rondo 4 contro 1, poi 1 contro 1 a porticine e partita a 4 porticine',
  'La settimana del 26 ottobre il focus è il tiro e la finalizzazione',
]
const PORTE_LABEL: Record<NuovoSpec['porte'], string> = {
  nessuna: 'Nessuna porta (possesso)',
  porticine_2: '2 porticine',
  porticine_4: '4 porticine',
  porta_1: '1 porta + portiere',
  porte_2: '2 porte + portieri',
  mete: 'Linee di meta',
}
const HIST_KEY = 'gsd-assistente-storia'

function loadHist(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIST_KEY) ?? '[]')
  } catch {
    return []
  }
}

export default function Assistant() {
  const [params] = useSearchParams()
  const forDate = params.get('data')
  const exercises = useStore((s) => s.exercises)
  const [testo, setTesto] = useState(forDate ? `Seduta di ${fmtDate(forDate)}: ` : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [piano, setPiano] = useState<Piano | null>(null)
  const [esiti, setEsiti] = useState<Esito[] | null>(null)
  const [hist, setHist] = useState<string[]>(loadHist)
  const fileRef = useRef<HTMLInputElement>(null)
  const dict = useDictation((t) => setTesto((p) => (p && !p.endsWith(' ') ? p + ' ' : p) + t))
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const elabora = async () => {
    if (dict.listening) dict.stop()
    const t = testo.trim()
    if (!t || !supabase) return
    setBusy(true)
    setErr(null)
    setPiano(null)
    setEsiti(null)
    try {
      const st = useStore.getState()
      const today = todayStr()
      const contesto = buildContext(st, today) + (forDate ? `\nSEDUTA DI RIFERIMENTO (se il comando non indica il giorno): ${forDate}` : '')
      const { data, error } = await supabase.functions.invoke('assistente', { body: { testo: t, contesto } })
      if (error) {
        let msg = error.message
        try {
          const ctx = (error as { context?: Response }).context
          if (ctx) msg = (await ctx.json()).error ?? msg
        } catch {
          /* risposta non JSON */
        }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      const p = normalize(data.risultato as RawRisposta, st, today)
      if (forDate)
        for (const a of p.azioni) if (a.kind === 'add' && a.avvisi.some((x) => x.startsWith('Giorno non indicato'))) {
          a.data = forDate
          a.avvisi = a.avvisi.filter((x) => !x.startsWith('Giorno non indicato'))
        }
      setPiano(p)
      const h = [t, ...hist.filter((x) => x !== t)].slice(0, 8)
      setHist(h)
      try {
        localStorage.setItem(HIST_KEY, JSON.stringify(h))
      } catch {
        /* storage non disponibile */
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const patch = (id: string, p: Partial<Azione>) => setPiano((pl) => (pl ? { ...pl, azioni: pl.azioni.map((a) => (a.id === id ? ({ ...a, ...p } as Azione) : a)) } : pl))
  const patchNuovo = (a: Azione, p: Partial<NuovoSpec>) => a.kind === 'add' && a.nuovo && patch(a.id, { nuovo: { ...a.nuovo, ...p } } as Partial<Azione>)

  const conferma = () => {
    if (!piano) return
    const res = apply(piano, () => useStore.getState())
    setEsiti(res)
    setPiano(null)
    setTesto('')
  }

  const attive = piano?.azioni.filter((a) => a.on).length ?? 0

  return (
    <div className="assistant">
      <PageHead title="Assistente" sub="Detta o scrivi cosa vuoi fare: l’assistente prepara le modifiche, tu controlli e confermi." />

      {!cloudEnabled && <p className="msg">L’assistente funziona solo con il cloud attivo (accesso con account).</p>}

      <section className="card stack">
        <label className="lbl" htmlFor="as-testo">
          Comando
        </label>
        <textarea
          id="as-testo"
          rows={5}
          value={testo + (dict.interim ? (testo ? ' ' : '') + dict.interim : '')}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Es. “Giovedì parte centrale 5 contro 4 in 10 per 15, 15 minuti, tema pressione”"
          readOnly={dict.listening}
        />
        <div className="row wrap gap-s">
          {dict.supported ? (
            <button className={cx('btn', dict.listening ? 'danger rec' : '')} onClick={dict.listening ? dict.stop : dict.start} disabled={busy}>
              {dict.listening ? '■ Stop dettatura' : '🎙 Detta'}
            </button>
          ) : (
            <span className="muted sm">Dettatura non disponibile in questo browser: usa il microfono della tastiera.</span>
          )}
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            Importa testo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) {
                const txt = (await f.text()).slice(0, 6000)
                setTesto((p) => (p ? p + '\n' : '') + txt)
              }
              e.target.value = ''
            }}
          />
          {testo && (
            <button className="btn ghost" onClick={() => setTesto('')} disabled={busy}>
              Svuota
            </button>
          )}
          <span className="grow" />
          <button className="btn primary" onClick={elabora} disabled={busy || !testo.trim() || !cloudEnabled}>
            {busy ? 'Elaboro…' : 'Prepara modifiche'}
          </button>
        </div>
        {dict.listening && <p className="listening">● In ascolto… parla pure, premi Stop quando hai finito.</p>}
        {dict.error && <p className="msg">{dict.error}</p>}
        {!testo && !piano && (
          <div className="row wrap gap-xs">
            {[...hist.slice(0, 3), ...ESEMPI].slice(0, 5).map((x) => (
              <button key={x} className="chip sm" onClick={() => setTesto(x)}>
                {x.length > 60 ? x.slice(0, 58) + '…' : x}
              </button>
            ))}
          </div>
        )}
      </section>

      {err && <p className="msg mt">Errore: {err}</p>}

      {esiti && (
        <section className="card mt ok-card">
          <h3>Fatto</h3>
          <ul className="esiti">
            {esiti.map((e, i) => (
              <li key={i}>{e.link ? <Link to={e.link}>{e.testo}</Link> : e.testo}</li>
            ))}
            {!esiti.length && <li>Nessuna modifica applicata.</li>}
          </ul>
        </section>
      )}

      {piano && (
        <section className="mt stack">
          {piano.riepilogo && (
            <div className="card">
              <b>Ho capito così:</b> {piano.riepilogo}
            </div>
          )}
          {piano.dubbi.length > 0 && (
            <div className="msg">
              <b>Da chiarire:</b>
              <ul>
                {piano.dubbi.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {piano.azioni.map((a) => (
            <article key={a.id} className={cx('card action', !a.on && 'off')}>
              <header className="row between gap-s">
                <label className="check">
                  <input type="checkbox" checked={a.on} onChange={(e) => patch(a.id, { on: e.target.checked })} />
                  <b>{a.kind === 'add' ? (a.nuovo ? 'Nuovo esercizio in seduta' : 'Esercizio in seduta') : a.kind === 'seduta' ? 'Seduta' : 'Microciclo'}</b>
                </label>
                <input type="date" className="date-sm" value={a.data} onChange={(e) => e.target.value && patch(a.id, { data: e.target.value })} aria-label="Data" />
              </header>

              {a.kind === 'add' && (
                <div className="action-body">
                  <div className="action-pitch">
                    <PitchView d={a.nuovo ? buildDiagram(a.nuovo) : exMap.get(a.exerciseId!)!.diagram} overlay />
                  </div>
                  <div className="stack grow">
                    {a.nuovo ? (
                      <>
                        <input className="title-input sm" value={a.nuovo.titolo} onChange={(e) => patchNuovo(a, { titolo: e.target.value })} aria-label="Titolo" />
                        <div className="grid-4">
                          <label>
                            Attaccanti
                            <input type="number" min={0} max={12} value={a.nuovo.att} onChange={(e) => patchNuovo(a, { att: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })} />
                          </label>
                          <label>
                            Difensori
                            <input type="number" min={0} max={12} value={a.nuovo.dif} onChange={(e) => patchNuovo(a, { dif: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })} />
                          </label>
                          <label>
                            Jolly
                            <input type="number" min={0} max={4} value={a.nuovo.jolly} onChange={(e) => patchNuovo(a, { jolly: Math.max(0, Math.min(4, Number(e.target.value) || 0)) })} />
                          </label>
                          <label>
                            Spazio (m)
                            <span className="row gap-xs">
                              <input type="number" min={5} max={70} value={a.nuovo.L} onChange={(e) => patchNuovo(a, { L: Math.max(5, Math.min(70, Number(e.target.value) || 5)) })} />
                              ×
                              <input type="number" min={5} max={50} value={a.nuovo.W} onChange={(e) => patchNuovo(a, { W: Math.max(5, Math.min(50, Number(e.target.value) || 5)) })} />
                            </span>
                          </label>
                        </div>
                        <div className="grid-4">
                          <label>
                            Area
                            <select value={a.nuovo.area} onChange={(e) => patchNuovo(a, { area: e.target.value as Area })}>
                              {AREE.map((x) => (
                                <option key={x} value={x}>
                                  {AREA_LABEL[x]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Porte
                            <select
                              value={a.nuovo.porte}
                              onChange={(e) => {
                                const porte = e.target.value as NuovoSpec['porte']
                                patchNuovo(a, { porte, gk: porte === 'porte_2' ? 2 : porte === 'porta_1' ? 1 : 0 })
                              }}
                            >
                              {Object.entries(PORTE_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <FaseMin a={a} patch={patch} />
                        </div>
                        <p className="sm muted">
                          {giocatoriLabel(a.nuovo)} · {a.nuovo.obiettivi.join(', ') || 'nessun obiettivo'}
                        </p>
                        <details>
                          <summary>Descrizione generata</summary>
                          <label className="lbl">Perché</label>
                          <textarea rows={2} value={a.nuovo.perche} onChange={(e) => patchNuovo(a, { perche: e.target.value })} />
                          <label className="lbl">Come si fa</label>
                          <textarea rows={4} value={a.nuovo.descrizione} onChange={(e) => patchNuovo(a, { descrizione: e.target.value })} />
                          {a.nuovo.regole && <p className="sm">Regole: {a.nuovo.regole}</p>}
                          {a.nuovo.coaching && <p className="sm">Coaching: {a.nuovo.coaching}</p>}
                        </details>
                      </>
                    ) : (
                      (() => {
                        const e = exMap.get(a.exerciseId!)!
                        return (
                          <>
                            <div className="row gap-s wrap">
                              <span className="code">{e.code}</span>
                              <AreaBadge area={e.area} short />
                            </div>
                            <b>{e.title}</b>
                            <span className="sm muted">
                              {e.giocatori} · {e.spazio}
                            </span>
                            <div className="grid-4">
                              <FaseMin a={a} patch={patch} />
                            </div>
                          </>
                        )
                      })()
                    )}
                    <input className="note-input" placeholder="Nota" value={a.nota} onChange={(e) => patch(a.id, { nota: e.target.value })} />
                  </div>
                </div>
              )}

              {a.kind === 'seduta' && (
                <div className="grid-4">
                  <label className="span2">
                    Titolo
                    <input value={a.titolo} onChange={(e) => patch(a.id, { titolo: e.target.value })} />
                  </label>
                  <label className="span2">
                    Obiettivo
                    <input value={a.obiettivo} onChange={(e) => patch(a.id, { obiettivo: e.target.value })} />
                  </label>
                </div>
              )}

              {a.kind === 'micro' && (
                <div className="stack">
                  <p className="sm">
                    Settimana {a.week ?? '?'} dal {fmtDate(a.data, false)}
                  </p>
                  <input value={a.focus} onChange={(e) => patch(a.id, { focus: e.target.value })} aria-label="Focus" />
                  <span className="sm muted">Obiettivi: {a.obiettivi.join(', ') || '—'}</span>
                </div>
              )}

              {a.avvisi.length > 0 && (
                <ul className="avvisi">
                  {a.avvisi.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}

          <div className="row gap-s wrap sticky-confirm">
            <button className="btn" onClick={() => setPiano(null)}>
              Annulla
            </button>
            <span className="grow" />
            <button className="btn primary lg" onClick={conferma} disabled={!attive}>
              Conferma {attive} {attive === 1 ? 'modifica' : 'modifiche'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function FaseMin({ a, patch }: { a: Extract<Azione, { kind: 'add' }>; patch: (id: string, p: Partial<Azione>) => void }) {
  return (
    <>
      <label>
        Fase
        <select value={a.fase} onChange={(e) => patch(a.id, { fase: e.target.value as Fase })}>
          {FASI.map((f) => (
            <option key={f} value={f}>
              {FASE_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Minuti
        <input type="number" min={3} max={60} value={a.minuti} onChange={(e) => patch(a.id, { minuti: Math.max(3, Math.min(60, Number(e.target.value) || 3)) })} />
      </label>
    </>
  )
}
