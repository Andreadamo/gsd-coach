import { useEffect, useState } from 'react'
import { cloudEnabled } from '../lib/supabase'
import { authState } from '../components/AuthGate'
import { cx } from '../lib/util'
import { TIPO_LABEL, targetKey, useComments, useFeed, type TargetType, type Tipo } from './useComments'

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'adesso'
  if (s < 3600) return `${Math.floor(s / 60)} min fa`
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

const initials = (n: string) =>
  n
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('') || '?'

export function FeedbackPanel({ type, id, riferimenti }: { type: TargetType; id: string; riferimenti?: { code: string; title: string }[] }) {
  const { list, loading, add, setRisolto, remove } = useComments(type, id)
  const markSeen = useFeed((s) => s.markSeen)
  const [body, setBody] = useState('')
  const [tipo, setTipo] = useState<Tipo>('commento')
  const [rif, setRif] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const me = authState.member

  // aprire il pannello = feedback letti
  useEffect(() => {
    markSeen(targetKey(type, id))
  }, [type, id, list.length, markSeen])

  if (!cloudEnabled) return null

  const send = async () => {
    const t = body.trim()
    if (!t) return
    setBusy(true)
    const e = await add(rif ? `[${rif}] ${t}` : t, tipo)
    setBusy(false)
    if (e) setErr(e)
    else {
      setBody('')
      setRif('')
      setTipo('commento')
      setErr(null)
    }
  }

  const aperti = list.filter((c) => !c.risolto)
  const visibili = showResolved ? list : aperti
  const risolti = list.length - aperti.length

  return (
    <section className="card feedback" aria-label="Feedback dello staff">
      <header className="row between wrap gap-s">
        <h3>
          Feedback staff {aperti.length > 0 && <span className="count">{aperti.length}</span>}
        </h3>
        {risolti > 0 && (
          <button className="btn ghost sm" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? 'Nascondi risolti' : `Mostra risolti (${risolti})`}
          </button>
        )}
      </header>

      {loading ? (
        <p className="muted sm">Caricamento…</p>
      ) : visibili.length === 0 ? (
        <p className="muted sm">{list.length ? 'Tutti i feedback sono risolti.' : 'Nessun feedback. Lascia uno spunto o proponi una modifica agli altri mister.'}</p>
      ) : (
        <ul className="fb-list">
          {visibili.map((c) => {
            const mine = c.author_id === me?.user_id
            return (
              <li key={c.id} className={cx('fb', `fb-${c.tipo}`, c.risolto && 'done', mine && 'mine')}>
                <span className="avatar" aria-hidden>
                  {initials(c.author_name)}
                </span>
                <div className="grow">
                  <div className="row wrap gap-s fb-meta">
                    <b>{mine ? 'Tu' : c.author_name}</b>
                    {c.tipo !== 'commento' && <span className={cx('fb-tipo', c.tipo)}>{TIPO_LABEL[c.tipo]}</span>}
                    <span className="muted">{ago(c.created_at)}</span>
                  </div>
                  <p className="fb-body">{c.body}</p>
                  <div className="row gap-s">
                    <button className="btn ghost sm" onClick={() => setRisolto(c, !c.risolto)}>
                      {c.risolto ? '↺ Riapri' : '✓ Risolto'}
                    </button>
                    {(mine || me?.ruolo === 'admin') && (
                      <button
                        className="btn ghost sm danger"
                        onClick={() => {
                          if (confirm('Eliminare questo feedback?')) void remove(c)
                        }}
                      >
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="fb-compose">
        <div className="seg sm" role="radiogroup" aria-label="Tipo di feedback">
          {(['commento', 'spunto', 'modifica'] as Tipo[]).map((t) => (
            <button key={t} role="radio" aria-checked={tipo === t} className={cx(tipo === t && 'on')} onClick={() => setTipo(t)}>
              {t === 'modifica' ? 'Modifica' : TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        {riferimenti && riferimenti.length > 0 && (
          <select value={rif} onChange={(e) => setRif(e.target.value)} aria-label="Esercizio di riferimento">
            <option value="">Riguarda tutta la seduta</option>
            {riferimenti.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} · {r.title}
              </option>
            ))}
          </select>
        )}
        <textarea
          rows={2}
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
          }}
          placeholder={tipo === 'modifica' ? 'Es. “Nel 5 contro 4 allargherei a 15x20, sono troppo stretti”' : tipo === 'spunto' ? 'Es. “Proviamo la variante a 2 tocchi”' : 'Scrivi agli altri mister…'}
        />
        {err && <p className="msg">{err}</p>}
        <div className="row">
          <span className="grow muted sm">Visibile a tutto lo staff</span>
          <button className="btn primary sm" onClick={send} disabled={busy || !body.trim()}>
            {busy ? 'Invio…' : 'Invia'}
          </button>
        </div>
      </div>
    </section>
  )
}
