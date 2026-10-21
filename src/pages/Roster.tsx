import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import type { Player, Ruolo } from '../types'
import { Empty, PageHead } from '../components/common'
import { PlayerCard } from '../players/PlayerCard'
import { categoriaDi, overall, radar, stagione } from '../lib/skills'
import { cx, nowIso, uid } from '../lib/util'

export function newPlayer(gruppo: string, annata: number): Player {
  return { id: uid(), nome: '', cognome: '', annata, gruppo, attivo: true, updatedAt: nowIso() }
}

const RUOLI: Ruolo[] = ['portiere', 'difensore', 'centrocampista', 'attaccante', 'jolly']

export default function Roster() {
  const players = useStore((s) => s.players)
  const evaluations = useStore((s) => s.evaluations)
  const exercises = useStore((s) => s.exercises)
  const upsert = useStore((s) => s.upsert)
  const nav = useNavigate()
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const gruppi = useMemo(() => [...new Set(players.map((p) => p.gruppo))].sort(), [players])
  const [gruppo, setGruppo] = useState<string>(() => gruppi[0] ?? '2017 Pulcini')
  const [ordine, setOrdine] = useState<'numero' | 'nome' | 'ovr'>('numero')
  const [showInactive, setShowInactive] = useState(false)
  const [bulk, setBulk] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)

  const list = useMemo(() => {
    const l = players
      .filter((p) => (!gruppo || p.gruppo === gruppo) && (showInactive || p.attivo))
      .map((p) => {
        const v = radar(p, evaluations, exMap)
        return { p, v, ovr: overall(v) }
      })
    return l.sort((a, b) =>
      ordine === 'ovr' ? (b.ovr ?? 0) - (a.ovr ?? 0) : ordine === 'nome' ? a.p.nome.localeCompare(b.p.nome) : (a.p.numero ?? 999) - (b.p.numero ?? 999),
    )
  }, [players, evaluations, exMap, gruppo, ordine, showInactive])

  const annataDefault = () => {
    const m = gruppo.match(/(20\d\d)/)
    return m ? Number(m[1]) : stagione() - 9
  }

  const create = () => {
    const p = newPlayer(gruppo || '2017 Pulcini', annataDefault())
    upsert('players', p)
    nav(`/giocatore/${p.id}?nuovo=1`)
  }

  // "Mario Rossi 7" per riga → giocatori
  const importa = () => {
    const righe = bulk.split('\n').map((r) => r.trim()).filter(Boolean)
    for (const r of righe) {
      const num = r.match(/\b(\d{1,2})\s*$/)
      const nomi = r.replace(/\b\d{1,2}\s*$/, '').trim().split(/\s+/)
      const p = newPlayer(gruppo || '2017 Pulcini', annataDefault())
      p.nome = nomi[0] ?? ''
      p.cognome = nomi.slice(1).join(' ')
      if (num) p.numero = Number(num[1])
      if (p.nome) upsert('players', p)
    }
    setBulk('')
    setBulkOpen(false)
  }

  const cat = categoriaDi(annataDefault())
  const media = list.filter((x) => x.ovr != null)
  const ovrMedio = media.length ? Math.round(media.reduce((a, b) => a + (b.ovr ?? 0), 0) / media.length) : null

  return (
    <div>
      <PageHead title="Rosa" sub={`${list.length} giocatori · ${cat.nome}${ovrMedio ? ` · media squadra ${ovrMedio}` : ''}`}>
        <button className="btn" onClick={() => setBulkOpen(!bulkOpen)}>
          Importa elenco
        </button>
        <button className="btn primary" onClick={create}>
          + Giocatore
        </button>
      </PageHead>

      <div className="card row wrap gap-s mb">
        <label className="inline">
          Gruppo
          <input list="gruppi" value={gruppo} onChange={(e) => setGruppo(e.target.value)} style={{ width: 160 }} />
          <datalist id="gruppi">
            {gruppi.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <div className="seg sm">
          {(['numero', 'nome', 'ovr'] as const).map((o) => (
            <button key={o} className={cx(ordine === o && 'on')} onClick={() => setOrdine(o)}>
              {o === 'ovr' ? 'Valutazione' : o === 'nome' ? 'Nome' : 'Numero'}
            </button>
          ))}
        </div>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostra non attivi
        </label>
      </div>

      {bulkOpen && (
        <section className="card stack mb">
          <label className="lbl" htmlFor="bulk">
            Un giocatore per riga: nome, cognome e (facoltativo) numero di maglia
          </label>
          <textarea id="bulk" rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Marco Bianchi 7\nLuca Verdi 10\nTommaso Neri'} />
          <div className="row gap-s">
            <span className="grow muted sm">Annata {annataDefault()} · gruppo {gruppo}</span>
            <button className="btn primary" onClick={importa} disabled={!bulk.trim()}>
              Aggiungi alla rosa
            </button>
          </div>
        </section>
      )}

      {list.length === 0 ? (
        <Empty>Nessun giocatore in questo gruppo. Aggiungili uno per uno o incolla l’elenco con “Importa elenco”.</Empty>
      ) : (
        <div className="grid-fut">
          {list.map(({ p, v }) => (
            <Link key={p.id} to={`/giocatore/${p.id}`} className={cx('fut-link', !p.attivo && 'off')}>
              <PlayerCard p={p} values={v} small />
            </Link>
          ))}
        </div>
      )}
      <p className="muted sm mt">Ruoli disponibili: {RUOLI.join(', ')}. Le abilità valutate cambiano in base alla categoria dell’annata (e per i portieri).</p>
    </div>
  )
}
