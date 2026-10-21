// Consigli di allenamento a partire dalle partite ufficiali.
// Funziona anche senza AI: valutazioni + parole chiave nelle note → obiettivi carenti → esercizi di libreria.
// Se c'è l'analisi AI, le sue carenze vengono unite (pesate) a quelle calcolate qui.
import type { Exercise, Match, Session } from '../types'
import { ASPETTI, OBIETTIVI } from '../types'
import { addDays } from './util'

/** parole del parlato/scritto dell'allenatore → obiettivo di allenamento */
const KEYWORDS: [RegExp, string][] = [
  [/\b(tir[oai]|tirare|conclu[ds]|segnare|sotto porta|gol sbagliat)/i, 'tiro'],
  [/\b(passagg|passare|appoggi)/i, 'passaggio'],
  [/\b(stop|controllo|ricev|ricezion|primo tocco)/i, 'ricezione'],
  [/\b(controllo orientat|girarsi|orientat)/i, 'controllo orientato'],
  [/\b(dribbl|saltare l.uomo|1 ?c(ontro)? ?1|uno contro uno|finte?)\b/i, 'dribbling'],
  [/\b(conduzion|portare palla|condu)/i, 'conduzione'],
  [/\b(press(ing|ione|are)|aggredi|riaggre)/i, 'pressione'],
  [/\b(marcat|marcare|perdiamo l.uomo|lasciamo liber)/i, 'marcatura'],
  [/\b(copertur|coprire|scalare|diagonal)/i, 'copertura'],
  [/\b(smarc|nascond|non si (fanno vedere|smarcano)|linee di passaggio|dare soluzion)/i, 'smarcamento'],
  [/\b(transizion|ripartenz|contropiede|rientr|recuper)/i, 'transizione'],
  [/\b(cross|fondo campo|traversone)/i, 'cross'],
  [/\b(di testa|colpo di testa|palle alte)/i, 'colpo di testa'],
  [/\b(uno.due|triangol|dai e vai)/i, 'uno-due'],
  [/\b(terzo uomo|3° uomo)/i, '3° uomo'],
  [/\b(sovrappos)/i, 'sovrapposizione'],
  [/\b(possesso|giro palla|teniamo palla|perdiamo (palla|il pallone)|buttiamo via)/i, 'possesso palla'],
  [/\b(portiere|parat|uscit[ae] (alt|bass))/i, 'parata'],
  [/\b(lent[io]|velocit|scatt)/i, 'velocità'],
  [/\b(reazion|reattiv|svegli|addormentat)/i, 'reattività'],
  [/\b(postura|corpo|posizione del corpo|di fianco)/i, 'postura del corpo'],
  [/\b(lettura|leggere il gioco|scelt[ae] sbagliat|decision)/i, 'lettura di gioco'],
  [/\b(equilibri|cadono|coordinaz)/i, 'equilibrio'],
]

export function obiettiviDaTesto(t: string): string[] {
  const out: string[] = []
  for (const [re, ob] of KEYWORDS) if (re.test(t) && !out.includes(ob)) out.push(ob)
  return out
}

export interface Carenza {
  obiettivo: string
  peso: number // più alto = più urgente
  fonti: string[]
}

/** Obiettivi da allenare, ordinati per urgenza, a partire da una o più partite (le più recenti pesano di più). */
export function carenzeDaPartite(matches: Match[]): Carenza[] {
  const map = new Map<string, Carenza>()
  const add = (ob: string, peso: number, fonte: string) => {
    if (!(OBIETTIVI as readonly string[]).includes(ob)) return
    const c = map.get(ob) ?? { obiettivo: ob, peso: 0, fonti: [] }
    c.peso += peso
    if (!c.fonti.includes(fonte)) c.fonti.push(fonte)
    map.set(ob, c)
  }
  const sorted = [...matches].sort((a, b) => b.data.localeCompare(a.data))
  sorted.forEach((m, idx) => {
    const k = 1 / (1 + idx * 0.6) // la partita più recente conta di più
    for (const a of ASPETTI) {
      const v = m.valutazioni[a.id]
      if (v && v <= 2) for (const ob of a.obiettivi) add(ob, (v === 1 ? 3 : 2) * k, a.label)
    }
    for (const ob of obiettiviDaTesto(m.carenze)) add(ob, 2.5 * k, 'note carenze')
    for (const c of m.analisi?.carenze ?? []) add(c.obiettivo, (c.priorita + 0.5) * k, 'analisi AI')
  })
  // i punti di forza abbassano la priorità
  const forti = new Set(sorted.slice(0, 1).flatMap((m) => [...obiettiviDaTesto(m.puntiForza), ...ASPETTI.filter((a) => (m.valutazioni[a.id] ?? 0) >= 4).flatMap((a) => a.obiettivi)]))
  for (const c of map.values()) if (forti.has(c.obiettivo)) c.peso *= 0.5
  return [...map.values()].sort((a, b) => b.peso - a.peso)
}

export interface Consiglio {
  exercise: Exercise
  score: number
  obiettivi: string[]
  usatoDiRecente: boolean
}

/** Esercizi di libreria che lavorano sulle carenze, evitando quelli usati negli ultimi 14 giorni. */
export function eserciziConsigliati(carenze: Carenza[], exercises: Exercise[], sessions: Session[], today: string, n = 6): Consiglio[] {
  if (!carenze.length) return []
  const peso = new Map(carenze.map((c) => [c.obiettivo, c.peso]))
  const recenti = new Set(sessions.filter((s) => s.data >= addDays(today, -14) && s.data <= addDays(today, 14)).flatMap((s) => s.items.map((i) => i.exerciseId)))
  const out: Consiglio[] = []
  for (const e of exercises) {
    const hit = e.obiettivi.filter((o) => peso.has(o))
    if (!hit.length) continue
    let score = hit.reduce((a, o) => a + (peso.get(o) ?? 0), 0) / Math.sqrt(e.obiettivi.length)
    // le situazioni e le partite a tema trasferiscono meglio in gara
    if (['situazioni', 'partita', 'possesso', 'finalizzazione'].includes(e.area)) score *= 1.15
    const usato = recenti.has(e.id)
    if (usato) score *= 0.6
    out.push({ exercise: e, score, obiettivi: hit, usatoDiRecente: usato })
  }
  out.sort((a, b) => b.score - a.score)
  // varietà: massimo 2 esercizi per area
  const perArea = new Map<string, number>()
  return out.filter((c) => {
    const k = perArea.get(c.exercise.area) ?? 0
    if (k >= 2) return false
    perArea.set(c.exercise.area, k + 1)
    return true
  }).slice(0, n)
}

/** Ultima partita giocata prima (o il giorno stesso) della data indicata, entro 21 giorni. */
export function ultimaPartitaPrima(matches: Match[], date: string): Match | undefined {
  return [...matches]
    .filter((m) => m.data <= date && m.data >= addDays(date, -21))
    .sort((a, b) => b.data.localeCompare(a.data))[0]
}
