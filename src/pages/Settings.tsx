import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { cloudEnabled, supabase } from '../lib/supabase'
import { PageHead } from '../components/common'
import { authState, type Member } from '../components/AuthGate'
import type { DB } from '../types'
import { todayStr } from '../lib/util'

export default function Settings() {
  const st = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [email, setEmail] = useState<string | null>(null)
  const me = authState.member

  const loadMembers = async () => {
    if (!supabase) return
    const { data } = await supabase.from('members').select('*').order('created_at')
    setMembers((data as Member[]) ?? [])
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    void loadMembers()
  }, [])

  const exportJson = () => {
    const db: DB = { exercises: st.exercises, sessions: st.sessions, cycles: st.cycles }
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gsd-coach-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = async (f: File) => {
    try {
      const db = JSON.parse(await f.text()) as DB
      if (!Array.isArray(db.exercises)) throw new Error('File non valido')
      if (!confirm(`Importare ${db.exercises.length} esercizi, ${db.sessions?.length ?? 0} sedute, ${db.cycles?.length ?? 0} cicli? I dati con lo stesso ID verranno sovrascritti.`)) return
      for (const e of db.exercises) st.upsert('exercises', e)
      for (const s of db.sessions ?? []) st.upsert('sessions', s)
      for (const c of db.cycles ?? []) st.upsert('cycles', c)
      alert('Import completato.')
    } catch (err) {
      alert('Errore: ' + (err as Error).message)
    }
  }

  const setMember = async (m: Member, patch: Partial<Member>) => {
    if (!supabase) return
    await supabase.from('members').update(patch).eq('user_id', m.user_id)
    void loadMembers()
  }

  return (
    <div className="settings">
      <PageHead title="Account e dati" />

      <section className="card mb">
        <h3>Modalità</h3>
        {cloudEnabled ? (
          <>
            <p>
              <span className="pill ok">Cloud</span> Dati condivisi tra i mister (Supabase). Accesso: <b>{email}</b> {me && <span className="muted">· {me.ruolo}</span>}
            </p>
            {st.syncError && <p className="msg">Errore sincronizzazione: {st.syncError}</p>}
            <div className="row gap-s wrap">
              <button className="btn" onClick={() => st.pullCloud()}>
                ↻ Ricarica dal cloud
              </button>
              <button className="btn" onClick={() => supabase!.auth.signOut()}>
                Esci
              </button>
            </div>
          </>
        ) : (
          <p>
            <span className="pill plan">Locale</span> Dati salvati solo in questo browser. Per condividerli con gli altri mister collega Supabase (vedi README del progetto) e usa “Carica dati locali nel cloud”.
          </p>
        )}
      </section>

      {cloudEnabled && me?.ruolo === 'admin' && (
        <section className="card mb">
          <h3>Staff</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Mister</th>
                <th>Ruolo</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <input value={m.nome ?? ''} onChange={(e) => setMembers(members.map((x) => (x.user_id === m.user_id ? { ...x, nome: e.target.value } : x)))} onBlur={(e) => setMember(m, { nome: e.target.value })} />
                    <div className="muted sm">{m.email}</div>
                  </td>
                  <td>
                    <select value={m.ruolo} onChange={(e) => setMember(m, { ruolo: e.target.value as Member['ruolo'] })} disabled={m.user_id === me.user_id}>
                      <option value="mister">Mister</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    {m.approvato ? (
                      <button className="btn sm" disabled={m.user_id === me.user_id} onClick={() => setMember(m, { approvato: false })}>
                        Sospendi
                      </button>
                    ) : (
                      <button className="btn sm primary" onClick={() => setMember(m, { approvato: true })}>
                        Approva
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card mb">
        <h3>Backup</h3>
        <div className="row gap-s wrap">
          <button className="btn" onClick={exportJson}>
            ⬇ Esporta JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Importa JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          {cloudEnabled && (
            <button
              className="btn"
              onClick={async () => {
                if (confirm('Caricare nel cloud tutti i dati presenti in questo dispositivo?')) {
                  await st.pushAllToCloud()
                  alert(st.syncError ? 'Errore: ' + st.syncError : 'Dati caricati.')
                }
              }}
            >
              ☁ Carica dati locali nel cloud
            </button>
          )}
        </div>
        <p className="muted sm mt-s">
          {st.exercises.length} esercizi · {st.sessions.length} sedute · {st.cycles.length} mesocicli
        </p>
        {!cloudEnabled && (
          <button
            className="btn danger sm mt"
            onClick={() => {
              if (confirm('Ripristinare i dati di esempio? Le modifiche locali verranno perse.')) st.resetSeed()
            }}
          >
            Ripristina dati di esempio
          </button>
        )}
      </section>
    </div>
  )
}
