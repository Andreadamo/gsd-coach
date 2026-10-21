import { useEffect, useRef, useState } from 'react'
import type { Diagram } from '../types'
import { PitchView } from './PitchView'
import { fieldAspect } from './geom'

const MOVE_MS = 1400
const HOLD_MS = 900

export function usePlayer(d: Diagram) {
  const [step, setStep] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  const last = useRef(0)
  const hold = useRef(0)
  const n = d.steps.length

  useEffect(() => {
    if (step > n - 1) setStep(Math.max(0, n - 1))
  }, [n, step])

  const tRef = useRef(0)
  const sRef = useRef(0)
  sRef.current = step

  useEffect(() => {
    if (!playing) return
    last.current = performance.now()
    tRef.current = 0
    const tick = (now: number) => {
      const dt = Math.min(64, now - last.current)
      last.current = now
      if (hold.current > 0) {
        hold.current -= dt
      } else {
        tRef.current += dt / MOVE_MS
        if (tRef.current >= 1) {
          tRef.current = 0
          const ns = Math.min(sRef.current + 1, n - 1)
          sRef.current = ns
          setStep(ns)
          setT(0)
          hold.current = HOLD_MS
          if (ns >= n - 1) {
            setPlaying(false)
            return
          }
        } else {
          setT(tRef.current)
        }
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, n])

  const play = () => {
    if (n < 2) return
    if (step >= n - 1) {
      setStep(0)
      setT(0)
    }
    hold.current = HOLD_MS
    setPlaying(true)
  }
  const pause = () => setPlaying(false)
  const go = (s: number) => {
    setPlaying(false)
    setT(0)
    setStep(Math.max(0, Math.min(n - 1, s)))
  }
  return { step, t, playing, play, pause, go, n }
}

export function PlayerControls({ p, d, compact }: { p: ReturnType<typeof usePlayer>; d: Diagram; compact?: boolean }) {
  const cur = d.steps[p.step]
  return (
    <div className="player-ctrl">
      <div className="row gap-s">
        <button className="btn icon" onClick={() => p.go(p.step - 1)} disabled={p.step === 0} aria-label="Step precedente">
          ◀
        </button>
        {p.playing ? (
          <button className="btn primary" onClick={p.pause}>
            ❚❚ Pausa
          </button>
        ) : (
          <button className="btn primary" onClick={p.play} disabled={p.n < 2}>
            ▶ {p.step >= p.n - 1 && p.n > 1 ? 'Rivedi' : 'Anima'}
          </button>
        )}
        <button className="btn icon" onClick={() => p.go(p.step + 1)} disabled={p.step >= p.n - 1} aria-label="Step successivo">
          ▶
        </button>
        <div className="steps-dots">
          {d.steps.map((_, i) => (
            <button key={i} className={'dot' + (i === p.step ? ' on' : '')} onClick={() => p.go(i)} aria-label={`Step ${i + 1}`} />
          ))}
        </div>
      </div>
      {!compact && cur && (
        <div className="step-caption">
          <b>
            {p.step + 1}/{p.n} · {cur.title}
          </b>
          {cur.note && <span> — {cur.note}</span>}
        </div>
      )}
    </div>
  )
}

export function PitchPlayer({ d, className }: { d: Diagram; className?: string }) {
  const p = usePlayer(d)
  return (
    <div className={className}>
      <div className="pitch-frame" style={{ aspectRatio: fieldAspect(d) }}>
        <PitchView d={d} step={p.step} t={p.t} />
      </div>
      <PlayerControls p={p} d={d} />
    </div>
  )
}
