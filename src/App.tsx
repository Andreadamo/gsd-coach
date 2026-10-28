import { lazy, Suspense, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { SyncStatus } from './components/SyncStatus'
import Home from './pages/Home'
import Library from './pages/Library'
import ExerciseDetail from './pages/ExerciseDetail'
import ExerciseEdit from './pages/ExerciseEdit'
import Sessions from './pages/Sessions'
import SessionBuilder from './pages/SessionBuilder'
import Settings from './pages/Settings'
import Matches from './pages/Matches'
import Roster from './pages/Roster'

// pagine pesanti (grafici recharts, assistente) caricate solo quando servono
const SessionPrint = lazy(() => import('./pages/SessionPrint'))
const Planner = lazy(() => import('./pages/Planner'))
const Report = lazy(() => import('./pages/Report'))
const Assistant = lazy(() => import('./pages/Assistant'))
const MatchDetail = lazy(() => import('./pages/MatchDetail'))
const PlayerDetail = lazy(() => import('./pages/PlayerDetail'))

const NAV = [
  { to: '/', label: 'Home', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/></svg>), end: true },
  { to: '/libreria', label: 'Libreria', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="3"/></svg>) },
  { to: '/sedute', label: 'Sedute', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>) },
  { to: '/partite', label: 'Partite', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l3 4M9.5 14.5l-3 4M8 10L3.5 8.5"/></svg>) },
  { to: '/rosa', label: 'Rosa', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.7.2 4.6 2 5.2 5.4"/></svg>) },
  { to: '/assistente', label: 'Assistente', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>) },
  { to: '/planner', label: 'Planner', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>) },
  { to: '/report', label: 'Report', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>) },
  { to: '/impostazioni', label: 'Account', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>) },
]

export default function App() {
  const loc = useLocation()
  const printMode = loc.pathname.endsWith('/stampa')
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [loc.pathname])
  const MAIN = ['/', '/sedute', '/partite', '/rosa', '/libreria']
  const altro = NAV.filter((n) => !MAIN.includes(n.to))
  const altroAttivo = altro.some((n) => loc.pathname.startsWith(n.to))
  return (
    <AuthGate>
      {printMode ? (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/seduta/:id/stampa" element={<SessionPrint />} />
          </Routes>
        </Suspense>
      ) : (
        <div className="shell">
          <header className="topbar">
            <NavLink to="/" className="brand">
              <img src="./favicon.svg" alt="" width={30} height={30} />
              <span>
                GSD <b>Coach</b>
              </span>
            </NavLink>
            <nav className="topnav">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <SyncStatus />
            <NavLink to="/impostazioni" className="account-link" aria-label="Account">
              {NAV[NAV.length - 1].icon}
            </NavLink>
          </header>
          <main className="content">
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/libreria" element={<Library />} />
                <Route path="/esercizio/nuovo" element={<ExerciseEdit />} />
                <Route path="/esercizio/:id" element={<ExerciseDetail />} />
                <Route path="/esercizio/:id/modifica" element={<ExerciseEdit />} />
                <Route path="/sedute" element={<Sessions />} />
                <Route path="/seduta/:id" element={<SessionBuilder />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/report" element={<Report />} />
                <Route path="/impostazioni" element={<Settings />} />
                <Route path="/assistente" element={<Assistant />} />
                <Route path="/partite" element={<Matches />} />
                <Route path="/partita/:id" element={<MatchDetail />} />
                <Route path="/rosa" element={<Roster />} />
                <Route path="/giocatore/:id" element={<PlayerDetail />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Suspense>
          </main>
          <nav className="bottomnav">
            {MAIN.map((to) => NAV.find((n) => n.to === to)!).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <span className="ico">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
            <button className={altroAttivo || more ? 'active' : ''} onClick={() => setMore(!more)} aria-expanded={more}>
              <span className="ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </span>
              <span>Altro</span>
            </button>
          </nav>
          {more && (
            <>
              <div className="more-backdrop" onClick={() => setMore(false)} />
              <div className="more-sheet" role="menu">
                {altro.map((n) => (
                  <NavLink key={n.to} to={n.to} role="menuitem">
                    <span className="ico">{n.icon}</span>
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </AuthGate>
  )
}
