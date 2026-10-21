import { useEffect, useState, type ReactNode } from 'react'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { cloudEnabled, supabase } from '../lib/supabase'
import { useStore } from '../store'

export interface Member {
  user_id: string
  email: string
  nome: string
  ruolo: 'admin' | 'mister'
  approvato: boolean
}

export const authState: { member: Member | null } = { member: null }

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(cloudEnabled)
  const setUser = useStore((s) => s.setUser)
  const pull = useStore((s) => s.pullCloud)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    setUser(session.user.id)
    supabase
      .from('members')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        const m = (data as Member) ?? null
        setMember(m)
        authState.member = m
        if (m?.approvato) await pull()
        setLoading(false)
      })
    // realtime: ricarica quando un altro mister modifica
    const ch = supabase
      .channel('db')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => void pull())
      .subscribe()
    return () => {
      void supabase?.removeChannel(ch)
    }
  }, [session, setUser, pull])

  if (!cloudEnabled) return <>{children}</>
  if (loading) return <div className="center-screen">Caricamento…</div>
  if (!session) return <Login />
  if (!member?.approvato)
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h2>In attesa di approvazione</h2>
          <p>
            Account <b>{session.user.email}</b> registrato. Un amministratore deve approvarti dalla pagina Account.
          </p>
          <button className="btn" onClick={() => supabase!.auth.signOut()}>
            Esci
          </button>
        </div>
      </div>
    )
  return <>{children}</>
}

function Login() {
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg(null)
    const res =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password: pwd })
        : await supabase.auth.signUp({ email, password: pwd, options: { emailRedirectTo: window.location.href.split('#')[0] } })
    setBusy(false)
    if (res.error) setMsg(res.error.message)
    else if (mode === 'signup' && !res.data.session) setMsg('Controlla la mail per confermare la registrazione.')
  }

  return (
    <div className="center-screen login-bg">
      <form className="card narrow" onSubmit={submit}>
        <div className="row gap-s mb-s">
          <img src="./favicon.svg" width={40} height={40} alt="" />
          <h1 className="h-display" style={{ margin: 0 }}>
            GSD Coach
          </h1>
        </div>
        <p className="muted">Area staff tecnico — programmazione allenamenti.</p>
        <label className="lbl">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label className="lbl">Password</label>
        <input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {msg && <p className="msg">{msg}</p>}
        <button className="btn primary block mt" disabled={busy}>
          {mode === 'login' ? 'Accedi' : 'Registrati'}
        </button>
        <button type="button" className="btn ghost block" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Nuovo mister? Registrati' : 'Hai già un account? Accedi'}
        </button>
      </form>
    </div>
  )
}
