// Abilità valutabili per categoria (annata → categoria FIGC) e calcolo del radar stile "card FIFA".
// Per cambiare/aggiungere abilità basta modificare CATEGORIE: tutto il resto (form, radar, overall) si adatta.
import type { Evaluation, Exercise, Player } from '../types'
import { addDays, todayStr } from './util'

export interface Skill {
  id: string
  sigla: string // 3 lettere, come sulle card
  label: string
  descr: string
  obiettivi: string[] // obiettivi degli esercizi che alimentano questa abilità
}

export interface Categoria {
  id: string
  nome: string
  eta: [number, number]
  skills: Skill[]
}

const S = (id: string, sigla: string, label: string, descr: string, obiettivi: string[]): Skill => ({ id, sigla, label, descr, obiettivi })

// --- abilità comuni ---
const COO = S('coordinazione', 'COO', 'Coordinazione', 'Equilibrio, ritmo, rapidità dei piedi, cambi di direzione', ['equilibrio', 'rapidità piedi', 'cambi di direzione', 'reattività'])
const CON = S('conduzione', 'CON', 'Conduzione', 'Palla vicina, testa alta, uso di entrambi i piedi', ['conduzione', 'cambi di direzione', 'protezione palla'])
const TIR = S('tiro', 'TIR', 'Tiro', 'Calciare in porta con precisione e forza, con entrambi i piedi', ['tiro', 'colpo di testa', 'cross'])
const PAS = S('passaggio', 'PAS', 'Passaggio', 'Passaggio preciso e dosato, ricezione e stop', ['passaggio', 'ricezione', 'controllo orientato', 'uno-due'])
const DRI = S('dribbling', 'DRI', 'Dribbling', '1c1 offensivo, finte, protezione della palla', ['dribbling', 'protezione palla', 'conduzione'])
const DIF = S('difesa', 'DIF', 'Difesa', '1c1 difensivo, postura, contrasto, recupero palla', ['marcatura', 'pressione', 'copertura', 'postura del corpo'])
const VEL = S('velocita', 'VEL', 'Velocità / agilità', 'Rapidità di partenza, accelerazione, reattività', ['velocità', 'reattività', 'rapidità piedi', 'transizione'])
const VIS = S('visione', 'VIS', 'Lettura di gioco', 'Smarcamento, scelte, posizione rispetto a palla e compagni', ['smarcamento', 'lettura di gioco', '3° uomo', 'sovrapposizione', 'possesso palla'])
const GIO = S('gioco', 'GIO', 'Gioco con i compagni', 'Partecipa, si fa vedere, collabora', ['smarcamento', 'possesso palla', 'uno-due'])
const ATT = S('atteggiamento', 'ATT', 'Atteggiamento', 'Impegno, attenzione, rispetto di regole e compagni', [])
const FIS = S('fisico', 'FIS', 'Fisico', 'Resistenza, forza nei contrasti, tenuta', ['velocità', 'transizione'])

// --- portiere ---
export const SKILLS_PORTIERE: Skill[] = [
  S('presa', 'PRE', 'Presa', 'Prese alte e basse sicure', ['parata']),
  S('tuffo', 'TUF', 'Tuffo', 'Tecnica e coraggio nel tuffo', ['parata', 'reattività']),
  S('uscite', 'USC', 'Uscite', 'Uscite alte e basse, 1c1 col portiere', ['parata']),
  S('piedi', 'PIE', 'Gioco con i piedi', 'Rilanci, passaggi, costruzione', ['passaggio', 'ricezione']),
  S('posizione', 'POS', 'Posizione', 'Piazzamento tra i pali e rispetto alla palla', ['lettura di gioco']),
  S('reattivita_p', 'REA', 'Reattività', 'Riflessi e prontezza', ['reattività', 'parata']),
]

export const CATEGORIE: Categoria[] = [
  { id: 'piccoli', nome: 'Piccoli Amici', eta: [5, 6], skills: [COO, CON, TIR, GIO, ATT] },
  { id: 'primi', nome: 'Primi Calci', eta: [7, 8], skills: [COO, CON, TIR, PAS, GIO, ATT] },
  { id: 'pulcini', nome: 'Pulcini', eta: [9, 10], skills: [VEL, TIR, PAS, DRI, DIF, VIS, ATT] },
  { id: 'esordienti', nome: 'Esordienti', eta: [11, 12], skills: [VEL, TIR, PAS, DRI, DIF, VIS, FIS] },
  { id: 'giovanissimi', nome: 'Giovanissimi', eta: [13, 14], skills: [VEL, TIR, PAS, DRI, DIF, VIS, FIS] },
  { id: 'agonistica', nome: 'Allievi e oltre', eta: [15, 99], skills: [VEL, TIR, PAS, DRI, DIF, VIS, FIS] },
]

/** Anno di inizio della stagione sportiva (da settembre). */
export function stagione(today = todayStr()) {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  return m >= 7 ? y : y - 1
}

/** Età "di categoria": anni compiuti nell'anno solare in cui inizia la stagione. */
export function etaCategoria(annata: number, today = todayStr()) {
  return stagione(today) - annata
}

export function categoriaDi(annata: number, today = todayStr()): Categoria {
  const eta = etaCategoria(annata, today)
  return CATEGORIE.find((c) => eta >= c.eta[0] && eta <= c.eta[1]) ?? (eta < 5 ? CATEGORIE[0] : CATEGORIE[CATEGORIE.length - 1])
}

export function skillsDi(p: Player, today = todayStr()): Skill[] {
  return p.ruolo === 'portiere' ? SKILLS_PORTIERE : categoriaDi(p.annata, today).skills
}

export interface SkillValue {
  skill: Skill
  valore: number | null // 1-10
  daAbilita: number
  daEsecuzioni: number
  trend: number // differenza rispetto a 60 giorni prima
}

/** Media pesata: le valutazioni recenti contano di più (dimezzamento ogni 45 giorni). */
function weighted(items: { v: number; data: string }[], ref: string) {
  if (!items.length) return null
  const t0 = new Date(ref).getTime()
  let s = 0
  let w = 0
  for (const it of items) {
    const days = Math.max(0, (t0 - new Date(it.data).getTime()) / 864e5)
    const k = Math.pow(0.5, days / 45)
    s += it.v * k
    w += k
  }
  return w ? s / w : null
}

/** Valori del radar: voti abilità dei mister (70%) + esecuzioni negli esercizi collegati (30%). */
export function radar(p: Player, evals: Evaluation[], exMap: Map<string, Exercise>, ref = todayStr()): SkillValue[] {
  const mine = evals.filter((e) => e.playerId === p.id && e.data <= ref)
  const skills = skillsDi(p, ref)
  const calc = (until: string) =>
    skills.map((sk) => {
      const ab = mine.filter((e) => e.tipo === 'abilita' && e.data <= until && e.valori?.[sk.id] != null).map((e) => ({ v: e.valori![sk.id], data: e.data }))
      const ex = mine
        .filter((e) => e.tipo === 'esecuzione' && e.data <= until && e.voto != null && e.exerciseId)
        .filter((e) => (exMap.get(e.exerciseId!)?.obiettivi ?? []).some((o) => sk.obiettivi.includes(o)))
        .map((e) => ({ v: e.voto! * 2, data: e.data })) // 1-5 → 2-10
      const a = weighted(ab, until)
      const x = weighted(ex, until)
      const valore = a != null && x != null ? a * 0.7 + x * 0.3 : (a ?? x)
      return { skill: sk, valore, daAbilita: ab.length, daEsecuzioni: ex.length }
    })
  const now = calc(ref)
  const before = calc(addDays(ref, -60))
  return now.map((v, i) => ({ ...v, trend: v.valore != null && before[i].valore != null ? v.valore - before[i].valore! : 0 }))
}

/** Valore 1-10 → scala card (40-99). */
export const toCard = (v: number | null) => (v == null ? null : Math.round(40 + ((v - 1) / 9) * 59))

export function overall(values: SkillValue[]) {
  const v = values.filter((x) => x.valore != null && x.skill.id !== 'atteggiamento').map((x) => x.valore!)
  if (!v.length) return null
  return toCard(v.reduce((a, b) => a + b, 0) / v.length)
}

export const nomeBreve = (p: Player) => `${p.nome} ${p.cognome ? p.cognome[0] + '.' : ''}`.trim()
