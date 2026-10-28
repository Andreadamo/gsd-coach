import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { cloudEnabled } from '../lib/supabase'
import { queueSize } from '../lib/syncQueue'

/** indicatore in alto: compare solo senza rete o con modifiche non ancora sul cloud */
export function SyncStatus() {
  const n = useStore((s) => queueSize(s.queue))
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (!cloudEnabled || (online && !n)) return null
  const label = online ? `${n} da sincronizzare` : n ? `Offline · ${n} in attesa` : 'Offline'
  return (
    <span className="pill warn sync-status" role="status" title="Le modifiche restano su questo dispositivo e vanno sul cloud appena torna la rete">
      {label}
    </span>
  )
}
