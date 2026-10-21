import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API: Chrome (Android/desktop) e Safari (iOS ≥ 14.5). Gratis, lingua italiana.
type Rec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start: () => void
  stop: () => void
}

function getCtor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useDictation(onFinal: (text: string) => void) {
  const [supported] = useState(() => typeof window !== 'undefined' && !!getCtor())
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Rec | null>(null)
  const want = useRef(false)
  const cb = useRef(onFinal)
  cb.current = onFinal

  const start = useCallback(() => {
    const C = getCtor()
    if (!C) return
    setError(null)
    const r = new C()
    r.lang = 'it-IT'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) cb.current(res[0].transcript.trim())
        else tmp += res[0].transcript
      }
      setInterim(tmp)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        want.current = false
        setError('Microfono non autorizzato: consenti l’accesso al microfono nelle impostazioni del browser.')
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Dettatura interrotta: ' + e.error)
    }
    // Android chiude la sessione dopo una pausa: riparte finché l'utente non preme stop
    r.onend = () => {
      setInterim('')
      if (want.current) {
        try {
          r.start()
          return
        } catch {
          /* già avviato */
        }
      }
      setListening(false)
    }
    rec.current = r
    want.current = true
    try {
      r.start()
      setListening(true)
    } catch {
      setError('Impossibile avviare il microfono.')
    }
  }, [])

  const stop = useCallback(() => {
    want.current = false
    rec.current?.stop()
    setListening(false)
  }, [])

  useEffect(() => () => {
    want.current = false
    rec.current?.stop()
  }, [])

  return { supported, listening, interim, error, start, stop }
}
