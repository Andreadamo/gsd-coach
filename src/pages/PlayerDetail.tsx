import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import type { Evaluation, Player, Piede, Ruolo } from '../types'
import { Empty } from '../components/common'
import { PlayerCard, Radar } from '../players/PlayerCard'
import { categoriaDi, radar, skillsDi, toCard } from '../lib/skills'
import { authState } from '../components/AuthGate'
import { clone, cx, fmtDate, nowIso, todayStr, uid } from '../lib/util'

const LINE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#db2777']

export default function PlayerDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const stored = useStore((s) => s.players.find((p) => p.id === id))
  const evaluations = useStore((s) => s.evaluations)
  const exercises = useStore((s) => s.exercises)
  const sessions = useStore((s) => s.sessions)
  const matches = useStore((s) => s.matches)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const nav = useNavigate()
  const [p, setP] = useState<Player | undefined>(() => (stored ? clone(stored) : undefined))
  const [editing, setEditing] = useState(params.get('nuovo') === '1')
  const [voti, setVoti] = useState<Record<string, number>>({})
  const [nota, setNota] = useState('')
  const [saved, setSaved] = useState(false)
  const dirty = useRef(false)
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  useEffect(() => {
    if (stored && !dirty.current) setP(clone(stored))
  }, [stored])
  useEffect(() => {
    if (!p || !dirty.current) return
    const t = setTimeout(() => {
      upsert('players', p)
      dirty.current = false
    }, 500)
    return () => clearTimeout(t)
  }, [p, upsert])

  const values = useMemo(() => (p ? radar(p, evaluations, exMap) : []), [p, evaluations, exMap])
  const prev = useMemo(() => (p ? radar(p, evaluations, exMap, new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)).map((v) => v.valore) : []), [p, evaluations, exMap])
  const mine = useMemo(() => evaluations.filter((e) => e.playerId === id).sort((a, b) => b.data.localeCompare(a.data)), [evaluations, id])

  if (!p) return <Empty>Giocatore non trovato.</Empty>

  const set = (patch: Partial<Player>) => {
    dirty.current = true
    setP((x) => (x ? { ...x, ...patch } : x))
  }
  const skills = skillsDi(p)
  const cat = categoriaDi(p.annata)

  const salvaVoti = () => {
    const valori = Object.fromEntries(Object.entries(voti).filter(([, v]) => v >= 1))
    if (!Object.keys(valori).length) return
    const e: Evaluation = { id: uid(), playerId: p.id, data: todayStr(), tipo: 'abilita', valori, nota: nota.trim() || undefined, autore: authState.member?.nome || authState.member?.email, updatedAt: nowIso() }
    upsert('evaluations', e)
    setVoti({})
    setNota('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  // storico per il grafico: valutazioni abilità per data
  const abilita = mine.filter((e) => e.tipo === 'abilita').slice().reverse()
  const chart = abilita.map((e) => ({ data: fmtDate(e.data, false).replace(/ \d{4}$/, ''), ...Object.fromEntries(skills.map((s) => [s.sigla, e.valori?.[s.id] != null ? toCard(e.valori[s.id]) : null])) }))
  const esecuzioni = mine.filter((e) => e.tipo === 'esecuzione')
  const presenze = sessions.filter((s) => s.stato === 'svolta' && s.presentiIds?.length)
  const presente = presenze.filter((s) => s.presentiIds!.includes(p.id)).length
  const convocazioni = matches.filter((m) => m.convocati?.includes(p.id)).length

  return (
    <div className="player">
      <div className="row between wrap gap-s mb">
        <Link to="/rosa" className="muted">
          ← Rosa
        </Link>
        <div className="row gap-s">
          <button className="btn" onClick={() => setEditing(!editing)}>
            {editing ? 'Chiudi scheda' : '✎ Dati giocatore'}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm(`Eliminare ${p.nome} e tutte le sue valutazioni?`)) {
                mine.forEach((e) => remove('evaluations', e.id))
                remove('players', p.id)
                nav('/rosa')
              }
            }}
          >
            Elimina
          </button>
        </div>
      </div>

      {editing && (
        <section className="card mb">
          <div className="head-grid">
            <label>
              Nome
              <input value={p.nome} onChange={(e) => set({ nome: e.target.value })} autoFocus={!p.nome} />
            </label>
            <label>
              Cognome
              <input value={p.cognome} onChange={(e) => set({ cognome: e.target.value })} />
            </label>
            <label>
              Annata
              <input type="number" min={2000} max={2030} value={p.annata} onChange={(e) => set({ annata: Number(e.target.value) || p.annata })} />
            </label>
            <label>
              Numero
              <input type="number" min={1} max={99} value={p.numero ?? ''} onChange={(e) => set({ numero: e.target.value ? Number(e.target.value) : undefined })} />
            </label>
            <label>
              Ruolo
              <select value={p.ruolo ?? ''} onChange={(e) => set({ ruolo: (e.target.value || undefined) as Ruolo | undefined })}>
                <option value="">—</option>
                <option value="portiere">Portiere</option>
                <option value="difensore">Difensore</option>
                <option value="centrocampista">Centrocampista</option>
                <option value="attaccante">Attaccante</option>
                <option value="jolly">Jolly / tutti i ruoli</option>
              </select>
            </label>
            <label>
              Piede
              <select value={p.piede ?? ''} onChange={(e) => set({ piede: (e.target.value || undefined) as Piede | undefined })}>
                <option value="">—</option>
                <option value="destro">Destro</option>
                <option value="sinistro">Sinistro</option>
                <option value="entrambi">Entrambi</option>
              </select>
            </label>
            <label>
              Gruppo
              <input value={p.gruppo} onChange={(e) => set({ gruppo: e.target.value })} />
            </label>
            <label className="check" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={p.attivo} onChange={(e) => set({ attivo: e.target.checked })} /> Attivo in rosa
            </label>
            <label className="span2">
              Note
              <input value={p.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Caratteristiche, cosa migliorare…" />
            </label>
          </div>
          <p className="muted sm mt-s">Categoria: {cat.nome} · abilità valutate: {skills.map((s) => s.label).join(', ')}</p>
        </section>
      )}

      <div className="player-grid">
        <div className="stack">
          <PlayerCard p={p} values={values} />
          <section className="card">
            <h3>Andamento rispetto a 2 mesi fa</h3>
            <div className="radar-wrap">
              <Radar values={values} size={260} compare={prev} />
            </div>
            <p className="muted sm">Area verde = oggi · tratteggio = 60 giorni fa</p>
          </section>
          <section className="card">
            <dl className="info">
              <div>
                <dt>Presenze (sedute segnate)</dt>
                <dd>
                  {presente}/{presenze.length}
                </dd>
              </div>
              <div>
                <dt>Convocazioni</dt>
                <dd>{convocazioni}</dd>
              </div>
              <div>
                <dt>Valutazioni abilità</dt>
                <dd>{abilita.length}</dd>
              </div>
              <div>
                <dt>Voti esecuzione</dt>
                <dd>{esecuzioni.length}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="stack">
          <section className="card stack">
            <h3>Nuova valutazione abilità</h3>
            <p className="muted sm">Voto da 1 a 10. Lascia vuoto ciò che non hai osservato. Il radar fa la media pesata dei voti di tutti i mister (i più recenti contano di più).</p>
            {skills.map((s) => (
              <div key={s.id} className="skill-row">
                <div className="skill-lbl">
                  <b>{s.label}</b>
                  <small className="muted">{s.descr}</small>
                </div>
                <div className="voti ten" role="radiogroup" aria-label={s.label}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                    <button key={v} role="radio" aria-checked={voti[s.id] === v} className={cx('voto', voti[s.id] === v && 'on', `s${Math.ceil(v / 2)}`)} onClick={() => setVoti({ ...voti, [s.id]: voti[s.id] === v ? 0 : v })}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (facoltativa)" />
            <div className="row gap-s">
              {saved && <span className="ok-txt">Valutazione salvata ✓</span>}
              <span className="grow" />
              <button className="btn primary" onClick={salvaVoti} disabled={!Object.values(voti).some((v) => v >= 1)}>
                Salva valutazione
              </button>
            </div>
          </section>

          {chart.length > 1 && (
            <section className="card">
              <h3>Storico valutazioni</h3>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis domain={[40, 99]} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {skills.map((s, i) => (
                      <Line key={s.id} dataKey={s.sigla} stroke={LINE_COLORS[i % LINE_COLORS.length]} connectNulls dot={{ r: 2 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section className="card">
            <h3>Ultimi voti</h3>
            {mine.length === 0 ? (
              <p className="muted sm">Nessun voto ancora. Valuta le abilità qui sopra o dai i voti agli esercizi nella pagina della seduta.</p>
            ) : (
              <ul className="voti-list">
                {mine.slice(0, 15).map((e) => (
                  <li key={e.id}>
                    <span className="muted sm">{fmtDate(e.data, false)}</span>{' '}
                    {e.tipo === 'abilita' ? (
                      <>
                        <b>Abilità</b>: {Object.entries(e.valori ?? {}).map(([k, v]) => `${skills.find((s) => s.id === k)?.sigla ?? k} ${v}`).join(' · ')}
                      </>
                    ) : (
                      <>
                        <b>{exMap.get(e.exerciseId ?? '')?.code ?? 'Esercizio'}</b> {exMap.get(e.exerciseId ?? '')?.title}: {'★'.repeat(e.voto ?? 0)}
                        {'☆'.repeat(5 - (e.voto ?? 0))}
                      </>
                    )}
                    {e.autore && <span className="muted sm"> · {e.autore}</span>}
                    {e.nota && <div className="sm">“{e.nota}”</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
