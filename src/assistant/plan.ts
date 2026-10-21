// Logica dell'assistente, indipendente da React:
// contesto da mandare al modello → validazione rigida della risposta → anteprima → applicazione.
// Il modello propone, ma qui ogni valore viene controllato e corretto; nulla si salva senza conferma.
import type { Area, DB, Diagram, Exercise, Fase, ItemType, Mesocycle, PitchItem, Session } from '../types'
import { AREE, AREA_LABEL, FASI, OBIETTIVI } from '../types'
import { addDays, fmtDate, mondayOf, nowIso, parseDate, toDateStr, uid, weeksBetween } from '../lib/util'
import { nextCode } from '../lib/codes'

export const GRUPPO_DEFAULT = '2017 Pulcini'
const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const PORTE = ['nessuna', 'porticine_2', 'porticine_4', 'porta_1', 'porte_2', 'mete'] as const
type Porte = (typeof PORTE)[number]

// ---------- contesto ----------
export function buildContext(db: DB, today: string, gruppo = GRUPPO_DEFAULT): string {
  const d = parseDate(today)
  const lines: string[] = []
  lines.push(`OGGI: ${today} (${GIORNI[d.getDay()]})`)
  lines.push(`GRUPPO: ${gruppo}`)
  lines.push(`AREE AMMESSE: ${AREE.join(', ')}`)
  lines.push(`OBIETTIVI AMMESSI: ${OBIETTIVI.join(', ')}`)
  const limit = addDays(today, 60)
  const next = db.sessions
    .filter((s) => s.data >= today && s.data <= limit && s.stato === 'pianificata')
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 20)
  lines.push('SEDUTE PIANIFICATE:')
  if (!next.length) lines.push('- nessuna')
  for (const s of next) {
    const codes = s.items.map((i) => db.exercises.find((e) => e.id === i.exerciseId)?.code).filter(Boolean)
    lines.push(`- ${s.data} (${GIORNI[parseDate(s.data).getDay()]}) "${s.titolo}" gruppo ${s.gruppo}; esercizi: ${codes.join(', ') || 'nessuno'}`)
  }
  const meso = db.cycles.find((c) => today >= c.inizio && today <= c.fine) ?? [...db.cycles].sort((a, b) => b.inizio.localeCompare(a.inizio))[0]
  if (meso) {
    lines.push(`MESOCICLO: "${meso.nome}" dal ${meso.inizio} al ${meso.fine}`)
    for (const m of meso.micro) lines.push(`- settimana ${m.week} (lunedì ${addDays(mondayOf(meso.inizio), (m.week - 1) * 7)}): ${m.focus || '—'}`)
  }
  lines.push('LIBRERIA ESERCIZI (codice | titolo | area | giocatori | spazio | minuti | obiettivi):')
  for (const e of [...db.exercises].sort((a, b) => a.code.localeCompare(b.code)))
    lines.push(`${e.code} | ${e.title} | ${e.area} | ${e.giocatori} | ${e.spazio} | ${e.durata} | ${e.obiettivi.join(', ')}`)
  return lines.join('\n')
}

// ---------- tipi della risposta ----------
interface RawNuovo {
  titolo?: string
  area?: string
  obiettivi?: string[]
  attaccanti?: number
  difensori?: number
  jolly?: number
  portieri?: number
  lunghezza_m?: number
  larghezza_m?: number
  porte?: string
  perche?: string
  descrizione?: string
  regole?: string
  varianti?: string
  coaching?: string
}
interface RawAzione {
  tipo?: string
  data?: string
  fase?: string
  minuti?: number
  nota?: string
  esercizio_codice?: string
  nuovo?: RawNuovo
  seduta_titolo?: string
  seduta_obiettivo?: string
  seduta_durata?: number
  micro_focus?: string
  micro_obiettivi?: string[]
}
export interface RawRisposta {
  riepilogo?: string
  dubbi?: string[]
  azioni?: RawAzione[]
}

export interface NuovoSpec {
  titolo: string
  area: Area
  obiettivi: string[]
  att: number
  dif: number
  jolly: number
  gk: number
  L: number
  W: number
  porte: Porte
  perche: string
  descrizione: string
  regole: string
  varianti: string
  coaching: string
}

export type Azione =
  | { id: string; kind: 'add'; on: boolean; data: string; fase: Fase; minuti: number; nota: string; exerciseId?: string; nuovo?: NuovoSpec; avvisi: string[] }
  | { id: string; kind: 'seduta'; on: boolean; data: string; titolo: string; obiettivo: string; durata: number; avvisi: string[] }
  | { id: string; kind: 'micro'; on: boolean; data: string; focus: string; obiettivi: string[]; mesoId?: string; week?: number; avvisi: string[] }

export interface Piano {
  riepilogo: string
  dubbi: string[]
  azioni: Azione[]
}

// ---------- utilità di validazione ----------
const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function validDate(v: unknown, today: string): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = parseDate(v)
  if (isNaN(d.getTime()) || toDateStr(d) !== v) return null
  if (v < addDays(today, -365) || v > addDays(today, 365)) return null
  return v
}

const OB_SET = new Set<string>(OBIETTIVI)
function cleanObiettivi(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const x of v) {
    const k = String(x).toLowerCase().trim()
    const hit = OBIETTIVI.find((o) => o === k) ?? OBIETTIVI.find((o) => k.includes(o) || o.includes(k))
    if (hit && OB_SET.has(hit) && !out.includes(hit)) out.push(hit)
  }
  return out.slice(0, 5)
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bvs\b|\bc\b|\bcontro\b/g, ' contro ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Esercizio di libreria equivalente a quello proposto (evita doppioni). */
function findDuplicate(db: DB, n: RawNuovo): Exercise | undefined {
  const t = norm(n.titolo ?? '')
  if (!t) return undefined
  const att = Number(n.attaccanti)
  const dif = Number(n.difensori)
  return db.exercises.find((e) => {
    const et = norm(e.title)
    if (et === t) return true
    // titolo di libreria contenuto in quello proposto (es. "Rondo 4 contro 1" in "Rondo 4 contro 1 di attivazione")
    if (et.length >= 8 && t.includes(et)) return true
    // stessi numeri e stessa parola chiave di gioco (rondo / possesso / partita)
    const key = ['rondo', 'possesso', 'partita'].find((k) => t.includes(k) && et.includes(k))
    const nums = et.match(/(\d+) contro (\d+)/)
    return !!key && !!nums && Number(nums[1]) === att && Number(nums[2]) === dif && e.area === n.area
  })
}

function nextPlannedDate(db: DB, today: string): string | undefined {
  return db.sessions.filter((s) => s.data >= today && s.stato === 'pianificata').sort((a, b) => a.data.localeCompare(b.data))[0]?.data
}

// ---------- normalizzazione ----------
export function normalize(raw: RawRisposta, db: DB, today: string): Piano {
  const dubbi = Array.isArray(raw?.dubbi) ? raw.dubbi.map((d) => str(d, 300)).filter(Boolean) : []
  const azioni: Azione[] = []
  const list = Array.isArray(raw?.azioni) ? raw.azioni.slice(0, 20) : []

  for (const a of list) {
    const avvisi: string[] = []
    const tipo = a?.tipo
    let data = validDate(a?.data, today)

    if (tipo === 'aggiungi_esercizio') {
      if (!data) {
        const nd = nextPlannedDate(db, today)
        data = nd ?? today
        avvisi.push(nd ? `Giorno non indicato: uso la prossima seduta (${fmtDate(nd)}).` : 'Giorno non indicato: uso oggi, controlla la data.')
      }
      const fase: Fase = (FASI as readonly string[]).includes(a.fase ?? '') ? (a.fase as Fase) : 'centrale'
      if (!a.fase) avvisi.push('Fase non indicata: parte centrale.')
      const code = str(a.esercizio_codice, 20).toUpperCase()
      let esistente = code ? db.exercises.find((e) => e.code.toUpperCase() === code) : undefined
      if (!esistente && a.nuovo) {
        const dup = findDuplicate(db, a.nuovo)
        if (dup) {
          esistente = dup
          avvisi.push(`Uso ${dup.code} «${dup.title}» già presente in libreria invece di crearne uno nuovo.`)
        }
      }
      let nuovo: NuovoSpec | undefined
      if (!esistente) {
        if (code) avvisi.push(`Il codice ${code} non esiste in libreria: creo un esercizio nuovo.`)
        const n = a.nuovo
        if (!n || !str(n.titolo)) {
          dubbi.push('Un esercizio richiesto non è stato capito: riformula indicando tipo di gioco, numeri e spazio.')
          continue
        }
        const area: Area = (AREE as readonly string[]).includes(n.area ?? '') ? (n.area as Area) : 'situazioni'
        let L = clampInt(n.lunghezza_m, 5, 70, 20)
        let W = clampInt(n.larghezza_m, 5, 50, 15)
        if (W > L) [L, W] = [W, L]
        const porte: Porte = (PORTE as readonly string[]).includes(n.porte ?? '') ? (n.porte as Porte) : 'nessuna'
        nuovo = {
          titolo: str(n.titolo, 80),
          area,
          obiettivi: cleanObiettivi(n.obiettivi),
          att: clampInt(n.attaccanti, 0, 12, 0),
          dif: clampInt(n.difensori, 0, 12, 0),
          jolly: clampInt(n.jolly, 0, 4, 0),
          gk: clampInt(n.portieri, 0, 2, porte === 'porte_2' ? 2 : porte === 'porta_1' ? 1 : 0),
          L,
          W,
          porte,
          perche: str(n.perche),
          descrizione: str(n.descrizione, 1200),
          regole: str(n.regole),
          varianti: str(n.varianti),
          coaching: str(n.coaching),
        }
        if (nuovo.att + nuovo.dif === 0) avvisi.push('Numero di giocatori non capito: controlla il campetto.')
        if (!nuovo.obiettivi.length) avvisi.push('Nessun obiettivo riconosciuto: aggiungili dalla scheda.')
      }
      const defMin = esistente?.durata ?? (fase === 'attivazione' ? 10 : 15)
      azioni.push({
        id: uid(),
        kind: 'add',
        on: true,
        data,
        fase,
        minuti: clampInt(a.minuti, 3, 60, defMin),
        nota: str(a.nota, 300),
        exerciseId: esistente?.id,
        nuovo,
        avvisi,
      })
    } else if (tipo === 'crea_seduta') {
      if (!data) {
        dubbi.push('Seduta senza data: indica il giorno.')
        continue
      }
      azioni.push({
        id: uid(),
        kind: 'seduta',
        on: true,
        data,
        titolo: str(a.seduta_titolo, 80) || 'Nuova seduta',
        obiettivo: str(a.seduta_obiettivo, 160),
        durata: clampInt(a.seduta_durata, 30, 150, 90),
        avvisi,
      })
    } else if (tipo === 'imposta_microciclo') {
      if (!data) {
        dubbi.push('Microciclo senza settimana: indica di quale settimana si tratta.')
        continue
      }
      const monday = mondayOf(data)
      const meso = db.cycles.find((c) => monday >= mondayOf(c.inizio) && monday <= c.fine)
      if (!meso) avvisi.push('Nessun mesociclo copre questa settimana: crealo prima nel Planner.')
      azioni.push({
        id: uid(),
        kind: 'micro',
        on: !!meso,
        data: monday,
        focus: str(a.micro_focus, 120),
        obiettivi: cleanObiettivi(a.micro_obiettivi),
        mesoId: meso?.id,
        week: meso ? weeksBetween(meso.inizio, monday) : undefined,
        avvisi,
      })
    }
  }
  if (!azioni.length && !dubbi.length) dubbi.push('Nessuna azione riconosciuta nel testo.')
  return { riepilogo: str(raw?.riepilogo, 500), dubbi, azioni }
}

// ---------- campetto generato (deterministico) ----------
function spread(n: number, x0: number, x1: number, y0: number, y1: number): [number, number][] {
  if (n <= 0) return []
  const cols = Math.ceil(Math.sqrt(n * ((x1 - x0) / Math.max(1, y1 - y0))))
  const c = Math.max(1, Math.min(n, cols))
  const rows = Math.ceil(n / c)
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / c)
    const k = i % c
    const inRow = r === rows - 1 ? n - r * c : c
    const x = x0 + ((k + 0.5) / inRow) * (x1 - x0)
    const y = y0 + ((r + 0.5) / rows) * (y1 - y0)
    out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10])
  }
  return out
}

/** n punti distribuiti lungo il perimetro di un rettangolo, rientrati di m */
function ring(n: number, L: number, W: number, m: number): [number, number][] {
  if (n <= 0) return []
  const w = L - 2 * m
  const h = W - 2 * m
  const per = 2 * (w + h)
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * per
    let x: number, y: number
    if (d < w) [x, y] = [m + d, m]
    else if ((d -= w) < h) [x, y] = [L - m, m + d]
    else if ((d -= h) < w) [x, y] = [L - m - d, W - m]
    else [x, y] = [m, W - m - (d - w)]
    out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10])
  }
  return out
}

export function buildDiagram(s: NuovoSpec): Diagram {
  const L = s.L
  const W = s.W
  const items: PitchItem[] = []
  let n = 0
  const add = (type: ItemType, x: number, y: number, label?: string, rot?: number) => items.push({ id: `g${++n}`, type, label, rot, pos: { 0: { x, y } } })
  const preset = s.porte === 'porta_1' ? 'area' : 'spazio'

  // delimitazione
  if (preset === 'spazio') for (const [x, y] of [[0.4, 0.4], [L - 0.4, 0.4], [0.4, W - 0.4], [L - 0.4, W - 0.4]]) add('disc', x, y)

  // porte
  if (s.porte === 'porticine_2') {
    add('minigoal', 0.6, W / 2, undefined, 180)
    add('minigoal', L - 0.6, W / 2, undefined, 0)
  } else if (s.porte === 'porticine_4') {
    for (const y of [W * 0.25, W * 0.75]) {
      add('minigoal', 0.6, y, undefined, 180)
      add('minigoal', L - 0.6, y, undefined, 0)
    }
  } else if (s.porte === 'porte_2') {
    add('goal', 0.4, W / 2, undefined, 180)
    add('goal', L - 0.4, W / 2, undefined, 0)
  } else if (s.porte === 'mete') {
    for (const y of [W * 0.2, W * 0.4, W * 0.6, W * 0.8]) {
      add('disc', 1.5, y)
      add('disc', L - 1.5, y)
    }
  }
  // portieri
  if (s.gk >= 1 && s.porte !== 'nessuna') add('gk', L - 1.2, W / 2)
  if (s.gk >= 2 && s.porte === 'porte_2') add('gk', 1.2, W / 2)

  // squadre: attaccanti a sinistra, difensori a destra (verso la porta se c'è)
  const m = Math.max(1.2, Math.min(L, W) * 0.12)
  let attack: [number, number][]
  let defend: [number, number][]
  if (s.porte === 'nessuna') {
    // possesso: chi ha palla sul perimetro, chi difende dentro
    attack = ring(s.att, L, W, m * 0.8)
    defend = spread(s.dif, L * 0.3, L * 0.7, W * 0.3, W * 0.7)
  } else {
    attack = spread(s.att, m, L * 0.45, m, W - m)
    defend = spread(s.dif, L * 0.55, L - m - (s.gk ? 1.5 : 0), m, W - m)
  }
  attack.forEach(([x, y], i) => add('playerA', x, y, String.fromCharCode(65 + i)))
  defend.forEach(([x, y], i) => add('playerB', x, y, String(i + 1)))
  // jolly sui lati lunghi (o sui corti nel possesso)
  const jollyPos: [number, number][] =
    s.porte === 'nessuna' ? [[-0.4, W / 2], [L + 0.4, W / 2], [L / 2, -0.4], [L / 2, W + 0.4]] : [[L / 2, -0.4], [L / 2, W + 0.4], [L * 0.25, -0.4], [L * 0.75, W + 0.4]]
  for (let i = 0; i < s.jolly; i++) add('jolly', jollyPos[i][0], jollyPos[i][1], 'J')
  // pallone al primo attaccante
  if (attack.length) add('ball', attack[0][0] + 0.6, attack[0][1] + 0.4)
  else add('ball', L / 2, W / 2)

  return {
    field: { preset, w: L, h: W },
    items,
    arrows: [],
    steps: [{ title: 'Disposizione', note: 'Creato dall’assistente: aggiungi frecce e step dall’editor se vuoi animarlo.' }],
  }
}

export function giocatoriLabel(s: NuovoSpec) {
  const parts = [`${s.att} contro ${s.dif}`]
  if (s.jolly) parts.push(`+${s.jolly} jolly`)
  if (s.gk) parts.push(`+${s.gk} portier${s.gk > 1 ? 'i' : 'e'}`)
  return parts.join(' ')
}

export function specToExercise(s: NuovoSpec, all: Exercise[], fase: Fase, minuti: number): Exercise {
  const desc = [s.descrizione, s.regole && `Regole: ${s.regole}`].filter(Boolean).join('\n')
  return {
    id: uid(),
    code: nextCode(all, s.area),
    title: s.titolo,
    area: s.area,
    fase: [fase],
    obiettivi: s.obiettivi,
    eta: 'U9-U10',
    giocatori: giocatoriLabel(s),
    spazio: `${s.L}x${s.W} m`,
    durata: minuti,
    materiale: [s.porte !== 'nessuna' && s.porte !== 'mete' ? (s.porte.startsWith('porticine') ? 'porticine' : 'porte') : '', 'cinesini', 'casacche', 'palloni'].filter(Boolean).join(', '),
    perche: s.perche,
    descrizione: desc,
    varianti: s.varianti || undefined,
    coaching: s.coaching || undefined,
    fonte: 'Assistente (dettato)',
    diagram: buildDiagram(s),
    updatedAt: nowIso(),
  }
}

// ---------- applicazione ----------
export interface Store {
  exercises: Exercise[]
  sessions: Session[]
  cycles: Mesocycle[]
  upsert: <K extends keyof DB>(k: K, v: DB[K][number]) => void
}

export interface Esito {
  testo: string
  link?: string
}

export function apply(piano: Piano, st: () => Store, gruppo = GRUPPO_DEFAULT): Esito[] {
  const out: Esito[] = []
  const sessionFor = (data: string, extra?: Partial<Session>): Session => {
    const ex = st().sessions.find((s) => s.data === data && s.gruppo === gruppo) ?? st().sessions.find((s) => s.data === data)
    if (ex) return ex
    const s: Session = { id: uid(), data, titolo: extra?.titolo ?? 'Nuova seduta', gruppo, durataTarget: extra?.durataTarget ?? 90, obiettivo: extra?.obiettivo ?? '', items: [], stato: 'pianificata', updatedAt: nowIso() }
    st().upsert('sessions', s)
    out.push({ testo: `Creata seduta ${fmtDate(data)}`, link: `/seduta/${s.id}` })
    return s
  }

  for (const a of piano.azioni) {
    if (!a.on) continue
    if (a.kind === 'seduta') {
      const esiste = st().sessions.find((s) => s.data === a.data && s.gruppo === gruppo)
      if (esiste) {
        st().upsert('sessions', { ...esiste, titolo: a.titolo || esiste.titolo, obiettivo: a.obiettivo || esiste.obiettivo, durataTarget: a.durata })
        out.push({ testo: `Aggiornata seduta ${fmtDate(a.data)}`, link: `/seduta/${esiste.id}` })
      } else sessionFor(a.data, { titolo: a.titolo, obiettivo: a.obiettivo, durataTarget: a.durata })
    } else if (a.kind === 'add') {
      let exId = a.exerciseId
      if (!exId && a.nuovo) {
        const e = specToExercise(a.nuovo, st().exercises, a.fase, a.minuti)
        st().upsert('exercises', e)
        exId = e.id
        out.push({ testo: `Nuovo esercizio ${e.code} · ${e.title}`, link: `/esercizio/${e.id}` })
      }
      if (!exId) continue
      const s = sessionFor(a.data)
      const fresh = st().sessions.find((x) => x.id === s.id) ?? s
      st().upsert('sessions', { ...fresh, items: [...fresh.items, { uid: uid(), exerciseId: exId, fase: a.fase, minuti: a.minuti, note: a.nota || undefined }] })
      const e = st().exercises.find((x) => x.id === exId)
      out.push({ testo: `${e?.code ?? ''} aggiunto a ${fmtDate(a.data)} (${a.fase}, ${a.minuti}′)`, link: `/seduta/${s.id}` })
    } else if (a.kind === 'micro' && a.mesoId && a.week) {
      const m = st().cycles.find((c) => c.id === a.mesoId)
      if (!m) continue
      const micro = m.micro.some((x) => x.week === a.week)
        ? m.micro.map((x) => (x.week === a.week ? { ...x, focus: a.focus || x.focus, obiettivi: a.obiettivi.length ? a.obiettivi : x.obiettivi } : x))
        : [...m.micro, { week: a.week, focus: a.focus, obiettivi: a.obiettivi }]
      st().upsert('cycles', { ...m, micro })
      out.push({ testo: `${m.nome}: settimana ${a.week} → ${a.focus}`, link: '/planner' })
    }
  }
  return out
}

export const AREA_NAMES = AREA_LABEL
