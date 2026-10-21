import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store'
import { ASPETTI, OBIETTIVI, type Match, type MatchAnalisi } from '../types'
import { AreaBadge, Empty } from '../components/common'
import { PitchView } from '../pitch/PitchView'
import { cloudEnabled, supabase } from '../lib/supabase'
import { carenzeDaPartite, eserciziConsigliati } from '../lib/matchAdvice'
import { addDays, clone, cx, fmtDate, mondayOf, nowIso, todayStr, uid, weeksBetween } from '../lib/util'
import { newSession } from './Sessions'
import { useDictation } from '../assistant/useDictation'
import { FeedbackPanel } from '../feedback/FeedbackPanel'
import { MatchSquad, MODULI } from '../players/MatchSquad'

const VOTI = [
  { v: 1, l: 'Molto carente' },
  { v: 2, l: 'Carente' },
  { v: 3, l: 'Sufficiente' },
  { v: 4, l: 'Buono' },
  { v: 5, l: 'Punto di forza' },
]

function schedaTesto(m: Match) {
  const val = ASPETTI.map((a) => `- ${a.label}: ${m.valutazioni[a.id] ?? 'non valutato'}`).join('\n')
  return [
    `Data: ${m.data} · ${m.casa ? 'in casa' : 'in trasferta'} contro ${m.avversario || 'avversario non indicato'} · formato ${m.formato}`,
    m.golFatti != null && m.golSubiti != null ? `Risultato: ${m.golFatti}-${m.golSubiti}` : 'Risultato: non indicato',
    `VALUTAZIONI (1 molto carente – 5 punto di forza):\n${val}`,
    `PUNTI DI FORZA:\n${m.puntiForza || '—'}`,
    `CARENZE:\n${m.carenze || '—'}`,
    `NOTE:\n${m.note || '—'}`,
  ].join('\n\n')
}

function libreriaTesto(exs: { code: string; title: string; area: string; obiettivi: string[]; giocatori: string }[]) {
  return exs.map((e) => `${e.code} | ${e.title} | ${e.area} | ${e.giocatori} | ${e.obiettivi.join(', ')}`).join('\n')
}

export default function MatchDetail() {
  const { id } = useParams()
  const stored = useStore((s) => s.matches.find((m) => m.id === id))
  const exercises = useStore((s) => s.exercises)
  const sessions = useStore((s) => s.sessions)
  const cycles = useStore((s) => s.cycles)
  const matches = useStore((s) => s.matches)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const nav = useNavigate()
  const [m, setM] = useState<Match | undefined>(() => (stored ? clone(stored) : undefined))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const dirty = useRef(false)
  const [dictField, setDictField] = useState<'puntiForza' | 'carenze' | 'note' | null>(null)
  const dict = useDictation((t) => {
    if (!dictField) return
    setM((p) => {
      if (!p) return p
      dirty.current = true
      const cur = p[dictField]
      return { ...p, [dictField]: (cur && !cur.endsWith(' ') && !cur.endsWith('\n') ? cur + ' ' : cur) + t }
    })
  })

  useEffect(() => {
    if (stored && !dirty.current) setM(clone(stored))
  }, [stored])
  useEffect(() => {
    if (!m || !dirty.current) return
    const t = setTimeout(() => {
      upsert('matches', m)
      dirty.current = false
    }, 600)
    return () => clearTimeout(t)
  }, [m, upsert])

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const today = todayStr()
  const carenze = useMemo(() => (m ? carenzeDaPartite([m]) : []), [m])
  const consigli = useMemo(() => eserciziConsigliati(carenze, exercises, sessions, m?.data ?? today, 6), [carenze, exercises, sessions, m, today])
  const prossima = useMemo(
    () => sessions.filter((s) => s.data > (m?.data ?? today) && s.data >= today && s.stato === 'pianificata').sort((a, b) => a.data.localeCompare(b.data))[0],
    [sessions, m, today],
  )

  if (!m) return <Empty>Partita non trovata.</Empty>

  const set = (patch: Partial<Match>) => {
    dirty.current = true
    setM((p) => (p ? { ...p, ...patch } : p))
  }

  const toggleDict = (f: 'puntiForza' | 'carenze' | 'note') => {
    if (dict.listening) {
      dict.stop()
      if (dictField === f) {
        setDictField(null)
        return
      }
    }
    setDictField(f)
    dict.start()
  }

  const analizza = async () => {
    if (!supabase) return
    if (dict.listening) dict.stop()
    setBusy(true)
    setErr(null)
    try {
      upsert('matches', m)
      const lib = libreriaTesto(exercises)
      const contesto = `OBIETTIVI AMMESSI: ${OBIETTIVI.join(', ')}\nLIBRERIA ESERCIZI (codice | titolo | area | giocatori | obiettivi):\n${lib}`
      const { data, error } = await supabase.functions.invoke('assistente', { body: { modo: 'partita', testo: schedaTesto(m), contesto } })
      if (error) {
        let msg = error.message
        try {
          const ctx = (error as { context?: Response }).context
          if (ctx) msg = (await ctx.json()).error ?? msg
        } catch {
          /* non JSON */
        }
        throw new Error(msg)
      }
      if (data?.error) throw new Error(data.error)
      const r = data.risultato ?? {}
      const byCode = new Map(exercises.map((e) => [e.code.toUpperCase(), e.id]))
      const okOb = (o: unknown) => typeof o === 'string' && (OBIETTIVI as readonly string[]).includes(o.toLowerCase().trim())
      const analisi: MatchAnalisi = {
        sintesi: String(r.sintesi ?? '').slice(0, 800),
        puntiForza: (Array.isArray(r.punti_forza) ? r.punti_forza : []).map(String).slice(0, 6),
        carenze: (Array.isArray(r.carenze) ? r.carenze : [])
          .filter((c: { obiettivo?: unknown }) => okOb(c?.obiettivo))
          .slice(0, 5)
          .map((c: { obiettivo: string; motivo?: string; priorita?: number }) => ({
            obiettivo: c.obiettivo.toLowerCase().trim(),
            motivo: String(c.motivo ?? '').slice(0, 300),
            priorita: (Math.min(3, Math.max(1, Math.round(Number(c.priorita) || 2))) as 1 | 2 | 3),
          })),
        consigli: (Array.isArray(r.consigli) ? r.consigli : []).slice(0, 4).map((c: { titolo?: string; perche?: string; esercizi?: string[] }) => ({
          titolo: String(c.titolo ?? '').slice(0, 120),
          perche: String(c.perche ?? '').slice(0, 400),
          exerciseIds: (Array.isArray(c.esercizi) ? c.esercizi : []).map((x) => byCode.get(String(x).toUpperCase().trim())).filter((x): x is string => !!x).slice(0, 3),
        })),
        focusSettimana: String(r.focus_settimana ?? '').slice(0, 120),
        generataIl: nowIso(),
        modello: data.modello,
      }
      const next = { ...m, analisi }
      setM(next)
      upsert('matches', next)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const aggiungi = (exerciseId: string) => {
    const e = exMap.get(exerciseId)
    if (!e) return
    let s = prossima
    if (!s) {
      s = newSession(addDays(m.data, 2), { titolo: m.analisi?.focusSettimana || 'Lavoro post-partita', obiettivo: carenze.slice(0, 2).map((c) => c.obiettivo).join(', ') })
      upsert('sessions', s)
    }
    const fresh = useStore.getState().sessions.find((x) => x.id === s!.id) ?? s
    if (fresh.items.some((i) => i.exerciseId === exerciseId)) {
      setDone(`${e.code} è già nella seduta del ${fmtDate(fresh.data)}.`)
      return
    }
    upsert('sessions', { ...fresh, items: [...fresh.items, { uid: uid(), exerciseId, fase: e.fase.includes('centrale') ? 'centrale' : e.fase[0], minuti: e.durata, note: `Dalla partita vs ${m.avversario || '—'}` }] })
    setDone(`${e.code} aggiunto alla seduta del ${fmtDate(fresh.data)}.`)
  }

  const creaSeduta = () => {
    const ids = [...new Set([...(m.analisi?.consigli.flatMap((c) => c.exerciseIds) ?? []), ...consigli.map((c) => c.exercise.id)])].slice(0, 4)
    const items = ids
      .map((eid) => exMap.get(eid))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ uid: uid(), exerciseId: e.id, fase: (e.fase.includes('centrale') ? 'centrale' : e.fase[0]) as 'centrale', minuti: e.durata }))
    const data = sessions.some((s) => s.data === addDays(m.data, 2)) ? addDays(m.data, 3) : addDays(m.data, 2)
    const s = newSession(data, { titolo: m.analisi?.focusSettimana || `Dopo ${m.avversario || 'la partita'}`, obiettivo: carenze.slice(0, 3).map((c) => c.obiettivo).join(', '), items })
    upsert('sessions', s)
    nav(`/seduta/${s.id}`)
  }

  const focusMicro = () => {
    const monday = mondayOf(addDays(m.data, 1))
    const meso = cycles.find((c) => monday >= mondayOf(c.inizio) && monday <= c.fine)
    if (!meso) {
      setDone('Nessun mesociclo copre la settimana dopo la partita: crealo nel Planner.')
      return
    }
    const week = weeksBetween(meso.inizio, monday)
    const focus = m.analisi?.focusSettimana || carenze.slice(0, 2).map((c) => c.obiettivo).join(' e ')
    const obiettivi = carenze.slice(0, 3).map((c) => c.obiettivo)
    const micro = meso.micro.some((x) => x.week === week) ? meso.micro.map((x) => (x.week === week ? { ...x, focus, obiettivi } : x)) : [...meso.micro, { week, focus, obiettivi }]
    upsert('cycles', { ...meso, micro })
    setDone(`Focus della settimana ${week} (${meso.nome}): ${focus}.`)
  }

  const prev = [...matches].filter((x) => x.data < m.data).sort((a, b) => b.data.localeCompare(a.data))[0]

  const DictBtn = ({ f }: { f: 'puntiForza' | 'carenze' | 'note' }) =>
    dict.supported ? (
      <button type="button" className={cx('btn sm', dict.listening && dictField === f && 'danger rec')} onClick={() => toggleDict(f)}>
        {dict.listening && dictField === f ? '■ Stop' : '🎙 Detta'}
      </button>
    ) : null

  return (
    <div className="match">
      <div className="row between wrap gap-s mb">
        <Link to="/partite" className="muted">
          ← Partite
        </Link>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Eliminare la nota partita?')) {
              remove('matches', m.id)
              nav('/partite')
            }
          }}
        >
          Elimina
        </button>
      </div>

      <section className="card session-head">
        <div className="head-grid">
          <label>
            Data
            <input type="date" value={m.data} onChange={(e) => set({ data: e.target.value })} />
          </label>
          <label className="span2">
            Avversario
            <input value={m.avversario} onChange={(e) => set({ avversario: e.target.value })} placeholder="Es. Cecina 1919" />
          </label>
          <label>
            Campo
            <select value={m.casa ? 'casa' : 'fuori'} onChange={(e) => set({ casa: e.target.value === 'casa' })}>
              <option value="casa">In casa</option>
              <option value="fuori">In trasferta</option>
            </select>
          </label>
          <label>
            Formato
            <select value={m.formato} onChange={(e) => set({ formato: e.target.value, modulo: undefined })}>
              {Object.keys(MODULI).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Risultato
            <span className="row gap-xs">
              <input type="number" min={0} max={30} value={m.golFatti ?? ''} onChange={(e) => set({ golFatti: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label="Gol fatti" />
              –
              <input type="number" min={0} max={30} value={m.golSubiti ?? ''} onChange={(e) => set({ golSubiti: e.target.value === '' ? undefined : Number(e.target.value) })} aria-label="Gol subiti" />
            </span>
          </label>
        </div>
      </section>

      <div className="mt">
        <MatchSquad m={m} set={set} />
      </div>

      <div className="match-grid">
        <div className="stack">
          <section className="card">
            <h3>Valutazioni</h3>
            <p className="muted sm">1 = molto carente · 5 = punto di forza. Tocca di nuovo per togliere il voto.</p>
            <div className="aspetti">
              {ASPETTI.map((a) => {
                const v = m.valutazioni[a.id]
                const pv = prev?.valutazioni[a.id]
                return (
                  <div key={a.id} className="aspetto">
                    <span className="a-lbl">
                      {a.label}
                      {pv != null && v != null && v !== pv && <small className={v > pv ? 'up' : 'down'}>{v > pv ? '▲' : '▼'}</small>}
                    </span>
                    <div className="voti" role="radiogroup" aria-label={a.label}>
                      {VOTI.map((x) => (
                        <button
                          key={x.v}
                          role="radio"
                          aria-checked={v === x.v}
                          title={x.l}
                          className={cx('voto', `v${x.v}`, v === x.v && 'on')}
                          onClick={() => set({ valutazioni: { ...m.valutazioni, [a.id]: v === x.v ? undefined : x.v } })}
                        >
                          {x.v}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card stack">
            <div className="row between">
              <label className="lbl" htmlFor="m-forza">
                Punti di forza
              </label>
              <DictBtn f="puntiForza" />
            </div>
            <textarea id="m-forza" rows={3} value={m.puntiForza} onChange={(e) => set({ puntiForza: e.target.value })} placeholder="Es. Buona intensità in pressione, il portiere esce bene, coraggio nell’1c1" />
            <div className="row between">
              <label className="lbl" htmlFor="m-carenze">
                Carenze
              </label>
              <DictBtn f="carenze" />
            </div>
            <textarea id="m-carenze" rows={3} value={m.carenze} onChange={(e) => set({ carenze: e.target.value })} placeholder="Es. Non ci smarchiamo, perdiamo palla in uscita, tiriamo poco, stop lunghi" />
            <div className="row between">
              <label className="lbl" htmlFor="m-note">
                Note libere
              </label>
              <DictBtn f="note" />
            </div>
            <textarea id="m-note" rows={3} value={m.note} onChange={(e) => set({ note: e.target.value })} placeholder="Episodi, giocatori da seguire, aspetti mentali…" />
            {dict.listening && <p className="listening">● In ascolto…</p>}
            {dict.error && <p className="msg">{dict.error}</p>}
          </section>
        </div>

        <div className="stack">
          <section className="card stack">
            <div className="row between wrap gap-s">
              <h3>Cosa allenare</h3>
              {cloudEnabled && (
                <button className="btn primary" onClick={analizza} disabled={busy}>
                  {busy ? 'Analizzo…' : m.analisi ? '↻ Rianalizza con AI' : '✨ Analizza con AI'}
                </button>
              )}
            </div>
            {err && <p className="msg">Errore: {err}</p>}
            {carenze.length === 0 && !m.analisi ? (
              <p className="muted">Dai i voti agli aspetti (1-2 = carente) o scrivi le carenze: qui compaiono gli obiettivi da allenare e gli esercizi consigliati.</p>
            ) : (
              <div className="row wrap gap-xs">
                {carenze.slice(0, 6).map((c, i) => (
                  <span key={c.obiettivo} className={cx('chip sm', i < 2 && 'warn-chip')} title={c.fonti.join(', ')}>
                    {c.obiettivo}
                  </span>
                ))}
              </div>
            )}

            {m.analisi && (
              <div className="analisi">
                <p>{m.analisi.sintesi}</p>
                {m.analisi.puntiForza.length > 0 && (
                  <p className="sm">
                    <b>Da mantenere:</b> {m.analisi.puntiForza.join(' · ')}
                  </p>
                )}
                {m.analisi.carenze.length > 0 && (
                  <ul className="sm carenze-list">
                    {m.analisi.carenze.map((c) => (
                      <li key={c.obiettivo}>
                        <span className={cx('prio', `p${c.priorita}`)}>{c.priorita === 3 ? 'Urgente' : c.priorita === 2 ? 'Importante' : 'Da curare'}</span> <b>{c.obiettivo}</b> — {c.motivo}
                      </li>
                    ))}
                  </ul>
                )}
                {m.analisi.consigli.map((c, i) => (
                  <div key={i} className="consiglio">
                    <b>{c.titolo}</b>
                    <p className="sm">{c.perche}</p>
                    <div className="row wrap gap-xs">
                      {c.exerciseIds.map((eid) => {
                        const e = exMap.get(eid)
                        return e ? (
                          <button key={eid} className="chip sm" onClick={() => aggiungi(eid)} title="Aggiungi alla prossima seduta">
                            + {e.code} {e.title}
                          </button>
                        ) : null
                      })}
                    </div>
                  </div>
                ))}
                {m.analisi.focusSettimana && (
                  <p className="sm">
                    <b>Focus settimana:</b> {m.analisi.focusSettimana}
                  </p>
                )}
                <p className="muted sm">Analisi del {fmtDate(m.analisi.generataIl.slice(0, 10), false)}</p>
              </div>
            )}
          </section>

          {consigli.length > 0 && (
            <section className="card">
              <h3>Esercizi consigliati</h3>
              <p className="muted sm">
                Dalla libreria, in base a voti e carenze. {prossima ? `“Aggiungi” li mette nella prossima seduta (${fmtDate(prossima.data)}).` : '“Aggiungi” crea una seduta 2 giorni dopo la partita.'}
              </p>
              <div className="consigli-list">
                {consigli.map((c) => (
                  <div key={c.exercise.id} className="p-item">
                    <Link to={`/esercizio/${c.exercise.id}`} className="p-thumb">
                      <PitchView d={c.exercise.diagram} overlay />
                    </Link>
                    <div className="grow">
                      <div className="row gap-s wrap">
                        <span className="code">{c.exercise.code}</span>
                        <AreaBadge area={c.exercise.area} short />
                        {c.usatoDiRecente && <span className="tag">già fatto di recente</span>}
                      </div>
                      <div className="p-title">{c.exercise.title}</div>
                      <span className="muted sm">lavora su: {c.obiettivi.join(', ')}</span>
                    </div>
                    <button className="btn sm primary" onClick={() => aggiungi(c.exercise.id)}>
                      Aggiungi
                    </button>
                  </div>
                ))}
              </div>
              <div className="row wrap gap-s mt">
                <button className="btn primary" onClick={creaSeduta}>
                  Crea seduta post-partita
                </button>
                <button className="btn" onClick={focusMicro}>
                  Imposta focus settimana
                </button>
              </div>
            </section>
          )}
          {done && <p className="msg ok-msg">{done}</p>}
        </div>
      </div>

      <div id="feedback" className="mt">
        <FeedbackPanel type="match" id={m.id} />
      </div>
    </div>
  )
}
