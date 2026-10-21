import type { Area, Exercise } from '../types'

export const PREFIX: Record<Area, string> = {
  tecnica: 'TEC',
  coordinativa: 'COO',
  situazioni: 'SIT',
  tattica: 'TAT',
  possesso: 'POS',
  finalizzazione: 'FIN',
  partita: 'PAR',
  portiere: 'POR',
}

export function nextCode(all: Exercise[], area: Area) {
  const p = PREFIX[area]
  const nums = all.filter((e) => e.code.startsWith(p + '-')).map((e) => parseInt(e.code.slice(p.length + 1)) || 0)
  return `${p}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`
}
