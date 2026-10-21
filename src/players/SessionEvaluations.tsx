import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import type { Evaluation, Session } from '../types'
import { authState } from '../components/AuthGate'
import { cx, nowIso, uid } from '../lib/util'
import { nomeBreve } from '../lib/skills'

/** Presenze della seduta e voto (1-5) all'esecuzione di ogni esercizio per ogni giocatore presente. */
export function SessionEvaluations({ s, onPresenti }: { s: Session; onPresenti: (ids: string[]) => void }) {
  const players = useStore((st) => st.players)
  const evaluations = useStore((st) => st.evaluations)
  const exercises = useStore((st) => st.exercises)
  const upsert = useStore((st) => st.upsert)
  const remove = useStore((st) => st.remove)
  const me = useStore((st) => st.userId)
  const rosa = useMemo(() => players.filter((p) => p.attivo && (p.gruppo === s.gruppo || !s.gruppo)).sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.nome.localeCompare(b.nome)), [players, s.gruppo])
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const esercizi = useMemo(() => [...new Set(s.items.map((i) => i.exerciseId))].map((id) => exMap.get(id)).filter((e): e is NonNullable<typeof e> => !!e), [s.items, exMap])
  const [exSel, setExSel] = useState<string>(esercizi[0]?.id ?? '')
  const presenti = s.presentiIds ?? []
  const lista = rosa.filter((p) => presenti.includes(p.id))
  // ogni mister ha i suoi voti: il radar fa la media di quelli di tutto lo staff
  const voto = (playerId: string, exerciseId: string) =>
    evaluations.find((e) => e.tipo === 'esecuzione' && e.sessionId === s.id && e.playerId === playerId && e.exerciseId === exerciseId && (!me || !e.ownerId || e.ownerId === me))

  if (!rosa.length)
    return (
      <section className="card">
        <h3>Presenze e voti</h3>
        <p className="muted sm">
          Nessun giocatore nel gruppo “{s.gruppo}”. <Link to="/rosa">Aggiungi la rosa</Link> per segnare presenze e votare le esecuzioni.
        </p>
      </section>
    )

  const togglePres = (id: string) => onPresenti(presenti.includes(id) ? presenti.filter((x) => x !== id) : [...presenti, id])

  const setVoto = (playerId: string, v: number) => {
    const ex = voto(playerId, exSel)
    if (ex && ex.voto === v) {
      remove('evaluations', ex.id)
      return
    }
    const e: Evaluation = ex
      ? { ...ex, voto: v, updatedAt: nowIso() }
      : { id: uid(), playerId, data: s.data, tipo: 'esecuzione', exerciseId: exSel, sessionId: s.id, voto: v, autore: authState.member?.nome || authState.member?.email, updatedAt: nowIso() }
    upsert('evaluations', e)
  }

  const votati = (exId: string) => lista.filter((p) => voto(p.id, exId)).length

  return (
    <section className="card stack" id="valutazioni">
      <div className="row between wrap gap-s">
        <h3>Presenze e voti esecuzione</h3>
        <span className="muted sm">
          {presenti.length}/{rosa.length} presenti
        </span>
      </div>
      <div className="pres-grid">
        {rosa.map((p) => (
          <button key={p.id} className={cx('pres', presenti.includes(p.id) && 'on')} onClick={() => togglePres(p.id)} aria-pressed={presenti.includes(p.id)}>
            {p.numero != null && <small>{p.numero}</small>}
            {nomeBreve(p)}
          </button>
        ))}
      </div>
      <div className="row gap-s wrap">
        <button className="btn ghost sm" onClick={() => onPresenti(rosa.map((p) => p.id))}>
          Tutti presenti
        </button>
        <button className="btn ghost sm" onClick={() => onPresenti([])}>
          Azzera
        </button>
      </div>

      {esercizi.length > 0 && lista.length > 0 && (
        <>
          <label className="lbl" htmlFor="ev-ex">
            Esercizio da valutare
          </label>
          <select id="ev-ex" value={exSel} onChange={(e) => setExSel(e.target.value)}>
            {esercizi.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} · {e.title} ({votati(e.id)}/{lista.length} votati)
              </option>
            ))}
          </select>
          <p className="muted sm">1 = non riesce · 3 = esegue con qualche errore · 5 = esegue benissimo. Tocca di nuovo per togliere il voto. Ognuno vede e modifica i propri voti.</p>
          <div className="ev-list">
            {lista.map((p) => {
              const v = voto(p.id, exSel)?.voto ?? 0
              return (
                <div key={p.id} className="ev-row">
                  <span className="ev-name">
                    {p.numero != null && <small>{p.numero}</small>} {nomeBreve(p)}
                  </span>
                  <div className="stars" role="radiogroup" aria-label={`Voto ${p.nome}`}>
                    {[1, 2, 3, 4, 5].map((k) => (
                      <button key={k} role="radio" aria-checked={v === k} className={cx('star', k <= v && 'on')} onClick={() => setVoto(p.id, k)} aria-label={`${k}`}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
