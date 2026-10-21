import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import type { Diagram, Match, Player } from '../types'
import { PitchEditor } from '../pitch/PitchEditor'
import { cx } from '../lib/util'
import { nomeBreve } from '../lib/skills'

/** Moduli per formato: numero di giocatori di movimento per linea (difesa → attacco). */
export const MODULI: Record<string, string[]> = {
  '5 contro 5': ['1-2-1', '2-2', '2-1-1'],
  '7 contro 7': ['2-3-1', '3-2-1', '2-1-2-1', '3-1-2'],
  '9 contro 9': ['3-3-2', '3-4-1', '3-2-3'],
  '11 contro 11': ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1'],
}
const CAMPO: Record<string, [number, number]> = { '5 contro 5': [40, 25], '7 contro 7': [55, 35], '9 contro 9': [65, 45], '11 contro 11': [100, 64] }

const etichetta = (p: Player) => (p.numero != null ? String(p.numero) : (p.nome[0] ?? '?') + (p.cognome[0] ?? ''))

export function schiera(formato: string, modulo: string, titolari: Player[]): Diagram {
  const [w, h] = CAMPO[formato] ?? CAMPO['7 contro 7']
  const linee = modulo.split('-').map(Number).filter((n) => n > 0)
  const items: Diagram['items'] = []
  const portiere = titolari.find((p) => p.ruolo === 'portiere') ?? titolari[0]
  const altri = titolari.filter((p) => p !== portiere)
  if (portiere) items.push({ id: `p-${portiere.id}`, type: 'gk', label: etichetta(portiere), pos: { 0: { x: w * 0.05, y: h / 2 } } })
  let k = 0
  linee.forEach((n, li) => {
    const x = linee.length === 1 ? w * 0.5 : w * (0.22 + (0.6 * li) / (linee.length - 1))
    for (let i = 0; i < n; i++) {
      const p = altri[k++]
      const y = (h * (i + 1)) / (n + 1)
      items.push({ id: p ? `p-${p.id}` : `slot-${li}-${i}`, type: 'playerA', label: p ? etichetta(p) : '?', pos: { 0: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } } })
    }
  })
  items.push({ id: 'ball', type: 'ball', pos: { 0: { x: w / 2 - 2, y: h / 2 + 3 } } })
  return { field: { preset: 'campo7', w, h, scala: 1.6 }, items, arrows: [], steps: [{ title: `Modulo ${modulo}` }] }
}

export function MatchSquad({ m, set }: { m: Match; set: (patch: Partial<Match>) => void }) {
  const players = useStore((s) => s.players)
  const rosa = useMemo(() => players.filter((p) => p.attivo && p.gruppo === m.gruppo).sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.nome.localeCompare(b.nome)), [players, m.gruppo])
  const convocati = m.convocati ?? []
  const titolari = m.titolari ?? []
  const nInCampo = Number(m.formato.match(/^(\d+)/)?.[1] ?? 7)
  const moduli = MODULI[m.formato] ?? MODULI['7 contro 7']
  const modulo = m.modulo && moduli.includes(m.modulo) ? m.modulo : moduli[0]
  const [showBoard, setShowBoard] = useState(!!m.lavagna)

  const toggleConv = (id: string) => {
    const c = convocati.includes(id) ? convocati.filter((x) => x !== id) : [...convocati, id]
    set({ convocati: c, titolari: titolari.filter((t) => c.includes(t)) })
  }
  const toggleTit = (id: string) => {
    if (!convocati.includes(id)) return
    set({ titolari: titolari.includes(id) ? titolari.filter((x) => x !== id) : [...titolari, id] })
  }
  const byId = new Map(rosa.map((p) => [p.id, p]))
  const tit = titolari.map((id) => byId.get(id)).filter((p): p is Player => !!p)
  const panchina = convocati.filter((id) => !titolari.includes(id)).map((id) => byId.get(id)).filter((p): p is Player => !!p)

  const genera = () => {
    set({ modulo, lavagna: schiera(m.formato, modulo, tit) })
    setShowBoard(true)
  }

  return (
    <section className="card stack">
      <div className="row between wrap gap-s">
        <h3>Convocazioni</h3>
        <span className="muted sm">
          {convocati.length} convocati · {titolari.length}/{nInCampo} titolari
        </span>
      </div>
      {rosa.length === 0 ? (
        <p className="muted sm">
          Nessun giocatore nel gruppo “{m.gruppo}”. <Link to="/rosa">Aggiungi la rosa</Link>.
        </p>
      ) : (
        <>
          <p className="muted sm">Tocca il nome per convocare. Tocca ★ per metterlo titolare.</p>
          <div className="conv-list">
            {rosa.map((p) => {
              const c = convocati.includes(p.id)
              const t = titolari.includes(p.id)
              return (
                <div key={p.id} className={cx('conv', c && 'on')}>
                  <button className="conv-name" onClick={() => toggleConv(p.id)} aria-pressed={c}>
                    {p.numero != null && <small>{p.numero}</small>} {nomeBreve(p)}
                    {p.ruolo === 'portiere' && <span className="tag">POR</span>}
                  </button>
                  <button className={cx('conv-star', t && 'on')} onClick={() => toggleTit(p.id)} disabled={!c} aria-pressed={t} aria-label={`Titolare ${p.nome}`}>
                    ★
                  </button>
                </div>
              )
            })}
          </div>
          <div className="row gap-s wrap">
            <button className="btn ghost sm" onClick={() => set({ convocati: rosa.map((p) => p.id) })}>
              Convoca tutti
            </button>
            {titolari.length > nInCampo && <span className="over-txt sm">Troppi titolari per il {m.formato}</span>}
          </div>
        </>
      )}

      <div className="row between wrap gap-s mt-s">
        <h3>Lavagna tattica</h3>
        <div className="row gap-s wrap">
          <select value={modulo} onChange={(e) => set({ modulo: e.target.value })} aria-label="Modulo">
            {moduli.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <button className="btn primary sm" onClick={genera} disabled={!tit.length}>
            {m.lavagna ? 'Rischiera i titolari' : 'Schiera i titolari'}
          </button>
        </div>
      </div>
      {!tit.length && !m.lavagna && <p className="muted sm">Scegli i titolari (★) e premi “Schiera”: puoi poi spostare i giocatori e disegnare movimenti e frecce.</p>}
      {m.lavagna && showBoard && (
        <>
          <PitchEditor value={m.lavagna} onChange={(d) => set({ lavagna: d })} />
          <div className="legend-players">
            {tit.map((p) => (
              <span key={p.id}>
                <b>{etichetta(p)}</b> {nomeBreve(p)}
              </span>
            ))}
          </div>
          {panchina.length > 0 && (
            <p className="sm">
              <b>Panchina:</b> {panchina.map((p) => `${p.numero != null ? p.numero + ' ' : ''}${nomeBreve(p)}`).join(', ')}
            </p>
          )}
        </>
      )}
      {m.lavagna && !showBoard && (
        <button className="btn" onClick={() => setShowBoard(true)}>
          Apri lavagna
        </button>
      )}
    </section>
  )
}
