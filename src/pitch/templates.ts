// Strutture base per l'editor: le disposizioni più ricorrenti nella libreria
// (porta con portiere, file di partenza, quadrati/rondo, porticine, slalom, corsie, mete, settori, cerchio).
// Si inseriscono in un colpo solo e restano pedine singole, modificabili una per una.
import type { Diagram, FieldConfig, ItemType, PitchItem } from '../types'
import { uid } from '../lib/util'

type T = [ItemType, string | undefined, number, number, number?]

export interface Template {
  id: string
  nome: string
  nota: string
  field: FieldConfig
  items: T[]
}

const ring = (n: number, cx: number, cy: number, r: number, type: ItemType, start = -Math.PI / 2): T[] =>
  Array.from({ length: n }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / n
    return [type, undefined, Math.round((cx + r * Math.cos(a)) * 10) / 10, Math.round((cy + r * Math.sin(a)) * 10) / 10]
  })
const line = (type: ItemType, x1: number, y1: number, x2: number, y2: number, n: number): T[] =>
  Array.from({ length: n }, (_, i) => [type, undefined, x1 + ((x2 - x1) * i) / (n - 1), y1 + ((y2 - y1) * i) / (n - 1)])
const gate = (x: number, y: number, vert = true): T[] => (vert ? [['cone', undefined, x, y - 0.8], ['cone', undefined, x, y + 0.8]] : [['cone', undefined, x - 0.8, y], ['cone', undefined, x + 0.8, y]])

export const TEMPLATES: Template[] = [
  {
    id: 'porta-2file',
    nome: 'Porta + portiere, 2 file',
    nota: 'Finalizzazione: due file con palla verso la porta',
    field: { preset: 'metacampo', w: 30, h: 30 },
    items: [
      ['gk', undefined, 29, 15],
      ['disc', undefined, 9, 9], ['disc', undefined, 9, 21],
      ['playerA', 'A', 8, 9], ['playerA', 'B', 6.3, 9], ['playerA', 'C', 8, 21], ['playerA', 'D', 6.3, 21],
      ['ball', undefined, 8.6, 9.4], ['ball', undefined, 8.6, 21.4],
    ],
  },
  {
    id: 'file-staffetta',
    nome: '3 file di partenza',
    nota: 'Staffette e circuiti: 3 file con cono di arrivo',
    field: { preset: 'spazio', w: 20, h: 12 },
    items: [
      ['disc', undefined, 2.5, 3], ['disc', undefined, 2.5, 6], ['disc', undefined, 2.5, 9],
      ['cone', undefined, 17, 3], ['cone', undefined, 17, 6], ['cone', undefined, 17, 9],
      ['playerA', 'A', 2, 3], ['playerA', 'B', 0.6, 3], ['playerA', 'C', 2, 6], ['playerA', 'D', 0.6, 6], ['playerA', 'E', 2, 9], ['playerA', 'F', 0.6, 9],
    ],
  },
  {
    id: 'quadrato-rondo',
    nome: 'Quadrato · rondo 4v1',
    nota: '4 sui lati, 1 in mezzo',
    field: { preset: 'spazio', w: 12, h: 12 },
    items: [
      ['disc', undefined, 2, 2], ['disc', undefined, 10, 2], ['disc', undefined, 10, 10], ['disc', undefined, 2, 10],
      ['playerA', 'A', 6, 1.4], ['playerA', 'B', 10.6, 6], ['playerA', 'C', 6, 10.6], ['playerA', 'D', 1.4, 6],
      ['playerB', '1', 6, 6.2],
      ['ball', undefined, 6.6, 2],
    ],
  },
  {
    id: 'triangolo',
    nome: 'Triangolo',
    nota: 'Passaggi a 3 cinesini (pass and press, triangolo di passaggi)',
    field: { preset: 'spazio', w: 12, h: 12 },
    items: [
      ['disc', undefined, 2, 10.6], ['disc', undefined, 10, 10.6], ['disc', undefined, 6, 3.7],
      ['playerA', 'A', 2, 9.5], ['playerA', 'B', 10, 9.5], ['playerA', 'C', 6, 2.6],
      ['ball', undefined, 2.6, 9.1],
    ],
  },
  {
    id: 'rondo-3v1',
    nome: 'Rondo 3v1 a triangolo',
    nota: '3 sui vertici, 1 a recuperare',
    field: { preset: 'spazio', w: 10, h: 10 },
    items: [
      ['disc', undefined, 1.5, 8.5], ['disc', undefined, 8.5, 8.5], ['disc', undefined, 5, 2],
      ['playerA', 'A', 1.5, 7.4], ['playerA', 'B', 8.5, 7.4], ['playerA', 'C', 5, 3.1],
      ['playerB', '1', 5, 6.3],
      ['ball', undefined, 2.1, 7],
    ],
  },
  {
    id: 'rombo',
    nome: 'Rombo',
    nota: 'Ricezione e trasmissione su 4 vertici',
    field: { preset: 'spazio', w: 16, h: 16 },
    items: [
      ['disc', undefined, 8, 2.5], ['disc', undefined, 13.5, 8], ['disc', undefined, 8, 13.5], ['disc', undefined, 2.5, 8],
      ['playerA', 'A', 8, 1.4], ['playerA', 'B', 14.6, 8], ['playerA', 'C', 8, 14.6], ['playerA', 'D', 1.4, 8],
      ['ball', undefined, 8.6, 1.8],
    ],
  },
  {
    id: 'slalom',
    nome: 'Slalom di paletti',
    nota: '6 paletti in linea, partenza e arrivo',
    field: { preset: 'spazio', w: 20, h: 8 },
    items: [
      ['disc', undefined, 2.5, 4], ...line('pole', 5, 4, 15, 4, 6), ['disc', undefined, 17.5, 4],
      ['playerA', 'A', 1.2, 4], ['ball', undefined, 1.8, 4.4],
    ],
  },
  {
    id: 'coni-zigzag',
    nome: 'Conduzione a zig-zag',
    nota: 'Coni sfalsati per cambi di direzione',
    field: { preset: 'spazio', w: 20, h: 8 },
    items: [
      ...Array.from({ length: 6 }, (_, i): T => ['cone', undefined, 4 + i * 2.5, i % 2 ? 5.5 : 2.5]),
      ['playerA', 'A', 1.2, 4], ['ball', undefined, 1.8, 4.4],
    ],
  },
  {
    id: 'corsia-1v1',
    nome: '1v1 in corsia',
    nota: 'Corsia di coni con porticina in fondo',
    field: { preset: 'spazio', w: 20, h: 10 },
    items: [
      ...line('disc', 0.5, 1, 19.5, 1, 6), ...line('disc', 0.5, 9, 19.5, 9, 6),
      ['minigoal', undefined, 19.4, 5, 0],
      ['playerA', 'A', 1.5, 5], ['ball', undefined, 2.1, 5.4], ['playerB', '1', 8, 1.8],
    ],
  },
  {
    id: 'partita-2-porticine',
    nome: 'Partita 3v3 · 2 porticine',
    nota: 'Una porticina per lato',
    field: { preset: 'spazio', w: 25, h: 18 },
    items: [
      ['minigoal', undefined, 0.6, 9, 180], ['minigoal', undefined, 24.4, 9, 0],
      ['playerA', 'A', 5, 5], ['playerA', 'B', 5, 13], ['playerA', 'C', 9.5, 9],
      ['playerB', '1', 20, 5], ['playerB', '2', 20, 13], ['playerB', '3', 15.5, 9],
      ['ball', undefined, 12.5, 9],
    ],
  },
  {
    id: 'partita-4-porticine',
    nome: 'Partita 3v3 · 4 porticine',
    nota: 'Due porticine per lato: scegli quella libera',
    field: { preset: 'spazio', w: 25, h: 20 },
    items: [
      ['minigoal', undefined, 0.6, 5, 180], ['minigoal', undefined, 0.6, 15, 180], ['minigoal', undefined, 24.4, 5, 0], ['minigoal', undefined, 24.4, 15, 0],
      ['playerA', 'A', 5, 6], ['playerA', 'B', 5, 14], ['playerA', 'C', 9.5, 10],
      ['playerB', '1', 20, 6], ['playerB', '2', 20, 14], ['playerB', '3', 15.5, 10],
      ['ball', undefined, 12.5, 10],
    ],
  },
  {
    id: 'mete',
    nome: 'Partita a mete',
    nota: 'Linea di meta su ogni lato corto',
    field: { preset: 'spazio', w: 25, h: 18 },
    items: [
      ...line('disc', 1.5, 1, 1.5, 17, 6), ...line('disc', 23.5, 1, 23.5, 17, 6),
      ['playerA', 'A', 7, 5], ['playerA', 'B', 7, 13], ['playerA', 'C', 10, 9],
      ['playerB', '1', 18, 5], ['playerB', '2', 18, 13], ['playerB', '3', 15, 9],
      ['ball', undefined, 12.5, 9],
    ],
  },
  {
    id: 'settori',
    nome: '3 settori',
    nota: 'Campo diviso in 3 zone con cinesini',
    field: { preset: 'spazio', w: 30, h: 20 },
    items: [...line('disc', 10, 1, 10, 19, 6), ...line('disc', 20, 1, 20, 19, 6)],
  },
  {
    id: 'cerchio',
    nome: 'Cerchio',
    nota: 'Cerchio di cinesini (giochi di reazione, stregone)',
    field: { preset: 'spazio', w: 16, h: 16 },
    items: [
      ...ring(10, 8, 8, 6.5, 'disc'),
      ['playerA', 'A', 5.5, 6], ['playerA', 'B', 10.5, 6], ['playerA', 'C', 6, 10.5], ['playerA', 'D', 10.5, 10.5],
      ['playerB', '1', 8, 8.2],
    ],
  },
  {
    id: 'porticine-coni',
    nome: 'Porticine di coni sparse',
    nota: 'Conduzione libera attraverso le porticine',
    field: { preset: 'spazio', w: 20, h: 15 },
    items: [
      ...gate(4, 4), ...gate(10, 3, false), ...gate(16, 5), ...gate(5, 11, false), ...gate(11, 9), ...gate(16, 12, false),
      ['playerA', 'A', 2, 7.5], ['ball', undefined, 2.6, 7.9], ['playerA', 'B', 13.5, 7], ['ball', undefined, 14.1, 7.4],
    ],
  },
  {
    id: 'campo7-portieri',
    nome: 'Campo a 7 con portieri',
    nota: 'Partita: due portieri e pallone al centro',
    field: { preset: 'campo7', w: 55, h: 35 },
    items: [['gk', undefined, 1.5, 17.5], ['gk', undefined, 53.5, 17.5], ['ball', undefined, 27.5, 17.5]],
  },
]

const toItems = (t: Template, ox = 0, oy = 0, s = 1): PitchItem[] =>
  t.items.map(([type, label, x, y, rot]) => ({ id: uid(), type, label, rot, pos: { 0: { x: Math.round((ox + x * s) * 10) / 10, y: Math.round((oy + y * s) * 10) / 10 } } }))

/** Anteprima della struttura (per le miniature). */
export function templatePreview(t: Template): Diagram {
  return { field: t.field, items: toItems(t), arrows: [], steps: [{ title: t.nome }] }
}

/**
 * Applica la struttura al disegno.
 * - sostituisci (o campo vuoto): prende anche il campo della struttura e toglie frecce e pedine esistenti;
 * - aggiungi: tiene campo e contenuto, centra la struttura e la rimpicciolisce se non ci sta.
 */
export function applyTemplate(d: Diagram, t: Template, sostituisci: boolean): Diagram {
  if (sostituisci || d.items.length === 0) {
    return { ...d, field: { ...t.field, scala: d.field.scala }, items: toItems(t), arrows: sostituisci ? [] : d.arrows }
  }
  const s = Math.min(1, d.field.w / t.field.w, d.field.h / t.field.h)
  const ox = (d.field.w - t.field.w * s) / 2
  const oy = (d.field.h - t.field.h * s) / 2
  return { ...d, items: [...d.items, ...rietichetta(d.items, toItems(t, ox, oy, s))] }
}

/** Evita doppioni di etichetta (due "A") quando si aggiunge a un disegno già pieno. */
function rietichetta(esistenti: PitchItem[], nuovi: PitchItem[]): PitchItem[] {
  const usate = new Set(esistenti.filter((i) => i.label).map((i) => `${i.type === 'playerA' ? 'L' : 'N'}:${i.label}`))
  const prossima = (type: ItemType) => {
    const lettere = type === 'playerA'
    for (let i = 0; i < 60; i++) {
      const l = lettere ? (i < 26 ? String.fromCharCode(65 + i) : 'A' + (i - 25)) : String(i + 1)
      const k = `${lettere ? 'L' : 'N'}:${l}`
      if (!usate.has(k)) {
        usate.add(k)
        return l
      }
    }
    return undefined
  }
  return nuovi.map((it) => {
    if (!it.label || !['playerA', 'playerB', 'jolly'].includes(it.type)) return it
    const k = `${it.type === 'playerA' ? 'L' : 'N'}:${it.label}`
    if (!usate.has(k)) {
      usate.add(k)
      return it
    }
    return { ...it, label: prossima(it.type) }
  })
}
