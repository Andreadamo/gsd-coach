// ===== Tassonomia =====
export const AREE = [
  'tecnica',
  'coordinativa',
  'situazioni',
  'tattica',
  'possesso',
  'finalizzazione',
  'partita',
  'portiere',
] as const
export type Area = (typeof AREE)[number]

export const AREA_LABEL: Record<Area, string> = {
  tecnica: 'Tecnica individuale',
  coordinativa: 'Coordinativa / motoria',
  situazioni: 'Situazioni 1v1 · 2v1',
  tattica: 'Tattica / smarcamento',
  possesso: 'Possesso / rondo',
  finalizzazione: 'Finalizzazione',
  partita: 'Partita a tema',
  portiere: 'Portiere',
}

export const AREA_COLOR: Record<Area, string> = {
  tecnica: '#2563eb',
  coordinativa: '#0d9488',
  situazioni: '#d97706',
  tattica: '#7c3aed',
  possesso: '#db2777',
  finalizzazione: '#dc2626',
  partita: '#16a34a',
  portiere: '#64748b',
}

export const FASI = ['attivazione', 'centrale', 'finale'] as const
export type Fase = (typeof FASI)[number]
export const FASE_LABEL: Record<Fase, string> = {
  attivazione: 'Attivazione',
  centrale: 'Parte centrale',
  finale: 'Partita / defaticamento',
}

export const OBIETTIVI = [
  'conduzione',
  'dribbling',
  'passaggio',
  'ricezione',
  'controllo orientato',
  'tiro',
  'colpo di testa',
  'palleggio',
  'protezione palla',
  'smarcamento',
  'uno-due',
  '3° uomo',
  'sovrapposizione',
  'pressione',
  'copertura',
  'marcatura',
  'postura del corpo',
  'equilibrio',
  'rapidità piedi',
  'cambi di direzione',
  'transizione',
  'possesso palla',
  'lettura di gioco',
  'reattività',
  'velocità',
  'parata',
  'cross',
] as const

// ===== Campetto =====
export type FieldPreset = 'spazio' | 'campo7' | 'metacampo' | 'area'
export interface FieldConfig {
  preset: FieldPreset
  w: number // metri (asse x)
  h: number // metri (asse y)
  scala?: number // ingrandimento pedine (lavagna tattica)
}

export type ItemType =
  | 'playerA'
  | 'playerB'
  | 'jolly'
  | 'gk'
  | 'coach'
  | 'ball'
  | 'cone'
  | 'disc'
  | 'pole'
  | 'mannequin'
  | 'hoop'
  | 'board'
  | 'minigoal'
  | 'goal'
  | 'hurdle'

export interface Pt {
  x: number
  y: number
}

export interface PitchItem {
  id: string
  type: ItemType
  label?: string
  rot?: number // gradi, per porte
  pos: Record<number, Pt> // keyframe per step
}

export type ArrowKind = 'pass' | 'run' | 'dribble' | 'shot'
export interface PitchArrow {
  id: string
  kind: ArrowKind
  step: number
  from: Pt
  to: Pt
  label?: string
  curve?: number // offset curvatura (metri)
}

export interface PitchStep {
  title: string
  note?: string
}

export interface Diagram {
  field: FieldConfig
  items: PitchItem[]
  arrows: PitchArrow[]
  steps: PitchStep[]
}

// ===== Esercizio =====
export interface Exercise {
  id: string
  code: string
  title: string
  area: Area
  fase: Fase[]
  obiettivi: string[]
  eta: string // es. "U9-U10"
  giocatori: string // es. "8-12"
  spazio: string // es. "20x15 m"
  durata: number // minuti consigliati
  materiale: string
  perche: string
  descrizione: string
  rotazione?: string
  varianti?: string
  coaching?: string
  fonte?: string
  diagram: Diagram
  ownerId?: string
  updatedAt: string
}

// ===== Seduta =====
export interface SessionItem {
  uid: string
  exerciseId: string
  fase: Fase
  minuti: number
  note?: string
}

export interface Session {
  id: string
  data: string // YYYY-MM-DD
  titolo: string
  gruppo: string
  durataTarget: number
  obiettivo: string
  items: SessionItem[]
  presenti?: number
  presentiIds?: string[]
  noteFinali?: string
  stato: 'pianificata' | 'svolta'
  ownerId?: string
  updatedAt: string
}

// ===== Cicli =====
export interface Microcycle {
  week: number // 1..n
  focus: string
  obiettivi: string[]
}

export interface Mesocycle {
  id: string
  nome: string
  gruppo: string
  inizio: string
  fine: string
  obiettivoGenerale: string
  target: Partial<Record<Area, number>> // % minuti
  micro: Microcycle[]
  ownerId?: string
  updatedAt: string
}

// ===== Partita ufficiale =====
/** Aspetti valutati dopo la partita (1 = molto carente … 5 = punto di forza). */
export const ASPETTI = [
  { id: 'costruzione', label: 'Costruzione dal basso', obiettivi: ['passaggio', 'smarcamento', 'controllo orientato'] },
  { id: 'possesso', label: 'Possesso e circolazione', obiettivi: ['possesso palla', 'smarcamento', 'lettura di gioco'] },
  { id: 'uno_contro_uno_off', label: '1c1 offensivo / dribbling', obiettivi: ['dribbling', 'conduzione', 'postura del corpo'] },
  { id: 'uno_contro_uno_dif', label: '1c1 difensivo', obiettivi: ['marcatura', 'postura del corpo', 'pressione'] },
  { id: 'collaborazione', label: 'Collaborazione (uno-due, sostegno)', obiettivi: ['uno-due', 'smarcamento', '3° uomo'] },
  { id: 'finalizzazione', label: 'Finalizzazione', obiettivi: ['tiro', 'cross', 'smarcamento'] },
  { id: 'non_possesso', label: 'Non possesso (pressione, coperture)', obiettivi: ['pressione', 'copertura', 'marcatura'] },
  { id: 'transizioni', label: 'Transizioni', obiettivi: ['transizione', 'reattività', 'velocità'] },
  { id: 'tecnica', label: 'Tecnica di base (stop, passaggio)', obiettivi: ['ricezione', 'passaggio', 'conduzione'] },
  { id: 'portiere', label: 'Portiere', obiettivi: ['parata', 'reattività'] },
] as const
export type AspettoId = (typeof ASPETTI)[number]['id']

export interface MatchAnalisi {
  sintesi: string
  puntiForza: string[]
  carenze: { obiettivo: string; motivo: string; priorita: 1 | 2 | 3 }[]
  consigli: { titolo: string; perche: string; exerciseIds: string[] }[]
  focusSettimana: string
  generataIl: string
  modello?: string
}

export interface Match {
  id: string
  data: string
  avversario: string
  casa: boolean
  gruppo: string
  formato: string // es. "7 contro 7"
  golFatti?: number
  golSubiti?: number
  valutazioni: Partial<Record<AspettoId, number>>
  puntiForza: string
  carenze: string
  note: string
  analisi?: MatchAnalisi
  convocati?: string[] // playerId
  titolari?: string[] // playerId (sottoinsieme dei convocati)
  modulo?: string
  lavagna?: Diagram
  ownerId?: string
  updatedAt: string
}

// ===== Rosa e valutazioni =====
export type Piede = 'destro' | 'sinistro' | 'entrambi'
export type Ruolo = 'portiere' | 'difensore' | 'centrocampista' | 'attaccante' | 'jolly'

export interface Player {
  id: string
  nome: string
  cognome: string
  annata: number // anno di nascita
  numero?: number
  ruolo?: Ruolo
  piede?: Piede
  gruppo: string
  attivo: boolean
  note?: string
  ownerId?: string
  updatedAt: string
}

/** Voto di un mister: abilità di campo (scala 1-10) o esecuzione di un esercizio (scala 1-5). */
export interface Evaluation {
  id: string
  playerId: string
  data: string
  tipo: 'abilita' | 'esecuzione'
  valori?: Record<string, number> // tipo abilita: skillId → 1-10
  exerciseId?: string // tipo esecuzione
  sessionId?: string
  voto?: number // tipo esecuzione: 1-5
  nota?: string
  autore?: string
  ownerId?: string
  updatedAt: string
}

export interface DB {
  exercises: Exercise[]
  sessions: Session[]
  cycles: Mesocycle[]
  matches: Match[]
  players: Player[]
  evaluations: Evaluation[]
}
