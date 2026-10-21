import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import Home from './pages/Home'
import Library from './pages/Library'
import ExerciseDetail from './pages/ExerciseDetail'
import ExerciseEdit from './pages/ExerciseEdit'
import Sessions from './pages/Sessions'
import SessionBuilder from './pages/SessionBuilder'
import SessionPrint from './pages/SessionPrint'
import Planner from './pages/Planner'
import Report from './pages/Report'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Home', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/></svg>), end: true },
  { to: '/libreria', label: 'Libreria', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="3"/></svg>) },
  { to: '/sedute', label: 'Sedute', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>) },
  { to: '/planner', label: 'Planner', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>) },
  { to: '/report', label: 'Report', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>) },
  { to: '/impostazioni', label: 'Account', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>) },
]

export default function App() {
  const loc = useLocation()
  const printMode = loc.pathname.endsWith('/stampa')
  return (
    <AuthGate>
      {printMode ? (
        <Routes>
          <Route path="/seduta/:id/stampa" element={<SessionPrint />} />
        </Routes>
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
          </header>
          <main className="content">
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
              <Route path="*" element={<Home />} />
            </Routes>
          </main>
          <nav className="bottomnav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                <span className="ico">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </AuthGate>
  )
}
