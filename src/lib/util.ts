export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

export const nowIso = () => new Date().toISOString()

export const todayStr = () => toDateStr(new Date())

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

export function mondayOf(s: string): string {
  const d = parseDate(s)
  const wd = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - wd)
  return toDateStr(d)
}

export function weeksBetween(a: string, b: string): number {
  const ms = parseDate(mondayOf(b)).getTime() - parseDate(mondayOf(a)).getTime()
  return Math.round(ms / (7 * 864e5)) + 1
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

export function fmtDate(s: string, withDay = true): string {
  if (!s) return ''
  const d = parseDate(s)
  return `${withDay ? GIORNI[d.getDay()] + ' ' : ''}${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`
}

export function monthKey(s: string) {
  return s.slice(0, 7)
}

export function monthLabel(k: string) {
  const [y, m] = k.split('-').map(Number)
  return `${MESI[m - 1]} ${String(y).slice(2)}`
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}
