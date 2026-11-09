// Report mensile per la riunione dello staff: sedute svolte nel periodo, distribuzione del lavoro,
// presenze, partite e punti da discutere. Funzioni pure: usate dalla pagina e dagli script di export.
import type { Area, DB, Exercise, Fase, Match, Mesocycle, Player, Session } from '../types'
import { AREE, AREA_LABEL, FASI, OBIETTIVI } from '../types'
import { aggregate, pct, type Agg } from './stats'
import { addDays, fmtDate, mondayOf, parseDate, toDateStr } from './util'

export interface WeekRow {
  lunedi: string
  sedute: number
  minuti: number
  presenzeMedie: number | null
  aree: Partial<Record<Area, number>>
}

export interface PlayerAttendance {
  player: Player
  presenze: number
  su: number
  perc: number
}

export interface AreaRow {
  area: Area
  min: number
  perc: number
  target: number | null
  delta: number | null
}

export interface MonthlyReport {
  from: string
  to: string
  gruppo: string
  done: Session[]
  /** pianificate nel periodo e mai segnate come svolte */
  nonSvolte: Session[]
  agg: Agg
  aree: AreaRow[]
  perFase: { fase: Fase; min: number; perc: number }[]
  obiettivi: { o: string; min: number }[]
  maiAllenati: string[]
  esercizi: { e: Exercise; n: number; min: number }[]
  eserciziNuovi: Exercise[]
  settimane: WeekRow[]
  presenzeMedie: number | null
  presenzeRegistrate: number
  giocatori: PlayerAttendance[]
  partite: Match[]
  bilancio: { v: number; p: number; s: number; gf: number; gs: number }
  mesocicli: Mesocycle[]
  puntiRiunione: string[]
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** primo e ultimo giorno del mese "YYYY-MM" */
export function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number)
  return [`${ym}-01`, toDateStr(new Date(y, m, 0))]
}

export function buildMonthlyReport(db: Pick<DB, 'sessions' | 'exercises' | 'cycles' | 'matches' | 'players'>, from: string, to: string, gruppo = ''): MonthlyReport {
  const inRange = (d: string) => d >= from && d <= to
  const inGroup = (g?: string) => !gruppo || !g || g === gruppo
  const exMap = new Map(db.exercises.map((e) => [e.id, e]))

  const done = db.sessions.filter((s) => s.stato === 'svolta' && inRange(s.data) && inGroup(s.gruppo)).sort((a, b) => a.data.localeCompare(b.data))
  const nonSvolte = db.sessions.filter((s) => s.stato === 'pianificata' && inRange(s.data) && inGroup(s.gruppo)).sort((a, b) => a.data.localeCompare(b.data))
  const agg = aggregate(done, exMap)

  // mesocicli che si sovrappongono al periodo: target pesato sui giorni di sovrapposizione
  const mesocicli = db.cycles.filter((c) => c.inizio <= to && c.fine >= from && inGroup(c.gruppo)).sort((a, b) => a.inizio.localeCompare(b.inizio))
  const target: Partial<Record<Area, number>> = {}
  if (mesocicli.length) {
    let tot = 0
    for (const c of mesocicli) {
      const a = c.inizio > from ? c.inizio : from
      const b = c.fine < to ? c.fine : to
      const giorni = Math.max(1, Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 864e5) + 1)
      tot += giorni
      for (const ar of AREE) target[ar] = (target[ar] ?? 0) + (c.target[ar] ?? 0) * giorni
    }
    for (const ar of AREE) target[ar] = Math.round((target[ar] ?? 0) / tot)
  }
  const aree: AreaRow[] = AREE.map((a) => {
    const perc = pct(agg.perArea[a], agg.minutiTot)
    const t = mesocicli.length ? (target[a] ?? 0) : null
    return { area: a, min: agg.perArea[a], perc, target: t, delta: t === null ? null : perc - t }
  }).filter((x) => x.min > 0 || (x.target ?? 0) > 0)

  const faseMin: Record<Fase, number> = { attivazione: 0, centrale: 0, finale: 0 }
  for (const s of done) for (const it of s.items) if (exMap.has(it.exerciseId)) faseMin[it.fase] += it.minuti
  const perFase = FASI.map((f) => ({ fase: f, min: faseMin[f], perc: pct(faseMin[f], agg.minutiTot) }))

  const obiettivi = Object.entries(agg.perObiettivo)
    .map(([o, v]) => ({ o, min: Math.round(v) }))
    .sort((a, b) => b.min - a.min)
  const maiAllenati = OBIETTIVI.filter((o) => !agg.perObiettivo[o] && o !== 'parata')

  const esercizi = Object.entries(agg.perEsercizio)
    .map(([id, v]) => ({ e: exMap.get(id)!, ...v }))
    .filter((x) => x.e)
    .sort((a, b) => b.n - a.n || b.min - a.min)
  // esercizi usati per la prima volta in stagione in questo periodo
  const usatiPrima = new Set(db.sessions.filter((s) => s.stato === 'svolta' && s.data < from && inGroup(s.gruppo)).flatMap((s) => s.items.map((i) => i.exerciseId)))
  const eserciziNuovi = esercizi.filter((x) => !usatiPrima.has(x.e.id)).map((x) => x.e)

  const weeks = new Map<string, Session[]>()
  for (const s of done) {
    const k = mondayOf(s.data)
    weeks.set(k, [...(weeks.get(k) ?? []), s])
  }
  const settimane: WeekRow[] = []
  for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) {
    const ss = weeks.get(w) ?? []
    const a = aggregate(ss, exMap)
    const pres = ss.map(presenti).filter((x): x is number => x !== null)
    const areeW: Partial<Record<Area, number>> = {}
    for (const ar of AREE) if (a.perArea[ar]) areeW[ar] = a.perArea[ar]
    settimane.push({ lunedi: w, sedute: ss.length, minuti: a.minutiTot, presenzeMedie: pres.length ? r1(pres.reduce((x, y) => x + y, 0) / pres.length) : null, aree: areeW })
  }

  const pres = done.map(presenti).filter((x): x is number => x !== null)
  const presenzeMedie = pres.length ? r1(pres.reduce((a, b) => a + b, 0) / pres.length) : null

  // presenze per giocatore: solo sedute con l'appello registrato
  const conAppello = done.filter((s) => s.presentiIds && s.presentiIds.length)
  const giocatori: PlayerAttendance[] = conAppello.length
    ? db.players
        .filter((p) => p.attivo && inGroup(p.gruppo))
        .map((p) => {
          const n = conAppello.filter((s) => s.presentiIds!.includes(p.id)).length
          return { player: p, presenze: n, su: conAppello.length, perc: pct(n, conAppello.length) }
        })
        .sort((a, b) => a.perc - b.perc || a.player.cognome.localeCompare(b.player.cognome))
    : []

  const partite = db.matches.filter((m) => inRange(m.data) && inGroup(m.gruppo)).sort((a, b) => a.data.localeCompare(b.data))
  const bilancio = { v: 0, p: 0, s: 0, gf: 0, gs: 0 }
  for (const m of partite) {
    if (m.golFatti == null || m.golSubiti == null) continue
    bilancio.gf += m.golFatti
    bilancio.gs += m.golSubiti
    if (m.golFatti > m.golSubiti) bilancio.v++
    else if (m.golFatti < m.golSubiti) bilancio.s++
    else bilancio.p++
  }

  const puntiRiunione: string[] = []
  if (done.length) {
    for (const x of aree.filter((a) => a.delta !== null && Math.abs(a.delta) >= 8).sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!)).slice(0, 3))
      puntiRiunione.push(`${AREA_LABEL[x.area]}: ${x.perc}% del tempo contro target ${x.target}% (${x.delta! > 0 ? '+' : ''}${x.delta} punti) → ${x.delta! > 0 ? 'ridurre' : 'aumentare'} nel prossimo mese.`)
    const vuote = settimane.filter((w) => !w.sedute)
    if (vuote.length) puntiRiunione.push(`Settimane senza sedute registrate come svolte: ${vuote.map((w) => `sett. ${fmtDate(w.lunedi, false)}`).join(', ')} — verificare se mancano dati o se l'attività era sospesa.`)
    if (nonSvolte.length) puntiRiunione.push(`${nonSvolte.length} sedute ancora in stato "pianificata" nel periodo: aggiornare lo stato (svolta / annullata).`)
    const chiave = ['conduzione', 'dribbling', 'passaggio', 'ricezione', 'tiro', 'smarcamento', 'postura del corpo', 'uno-due']
    const scoperti = chiave.filter((o) => !agg.perObiettivo[o] || agg.perObiettivo[o] < 15)
    if (scoperti.length) puntiRiunione.push(`Obiettivi chiave della categoria poco allenati (<15′): ${scoperti.join(', ')}.`)
    const assenti = giocatori.filter((g) => g.perc < 60)
    if (assenti.length) puntiRiunione.push(`Presenze sotto il 60%: ${assenti.map((g) => `${g.player.nome} ${g.player.cognome} (${g.perc}%)`).join(', ')} — sentire le famiglie.`)
    if (!conAppello.length) puntiRiunione.push('Appello nominativo non registrato: segnare i presenti nella seduta per avere le presenze per bambino.')
    const ripetuti = esercizi.filter((x) => x.n >= Math.max(4, Math.ceil(done.length / 2)))
    if (ripetuti.length) puntiRiunione.push(`Esercizi molto ripetuti (${ripetuti.map((x) => `${x.e.code} ×${x.n}`).join(', ')}): valutare progressioni o varianti.`)
  } else {
    puntiRiunione.push('Nessuna seduta segnata come svolta nel periodo.')
  }

  return { from, to, gruppo, done, nonSvolte, agg, aree, perFase, obiettivi, maiAllenati, esercizi, eserciziNuovi, settimane, presenzeMedie, presenzeRegistrate: conAppello.length, giocatori, partite, bilancio, mesocicli, puntiRiunione }
}

export function presenti(s: Session): number | null {
  if (s.presentiIds && s.presentiIds.length) return s.presentiIds.length
  return s.presenti ?? null
}
