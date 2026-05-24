/**
 * QuickSessionOverlay — Sesión de calibración corta (~3.5 min, 3 fases).
 *
 * Usa el mismo backend de protocolo que ProtocolOverlay pero pasa quick=true:
 *   Fase 1 — baseline_open   60s  (ojos abiertos, drishti)
 *   Fase 2 — baseline_closed 90s  (ojos cerrados, key para T2 del pipeline)
 *   Fase 3 — recovery        60s  (breathing guide, bell al final)
 *
 * Sin sliders de metadatos — solo nombre de sesión opcional.
 * Al completar ofrece CTA para abrir la validación de pipeline.
 *
 * Se monta SOBRE el Canvas con pointer-events: none (igual que ProtocolOverlay).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE } from '../store'

// ── Singing Bowl (copiado de ProtocolOverlay) ────────────────────────────────

function useSingingBowl() {
  const ctxRef = useRef(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return ctxRef.current
  }, [])

  const playBell = useCallback((freq = 528, duration = 2.5) => {
    try {
      const ctx = getCtx()
      const t = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.12, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + duration)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.value = freq * 1.5
      gain2.gain.setValueAtTime(0.04, t)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.7)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(t)
      osc2.stop(t + duration * 0.7)
    } catch (e) {
      // Audio no disponible
    }
  }, [getCtx])

  return playBell
}

// ── TTS ──────────────────────────────────────────────────────────────────────

function useTTS() {
  const speaking = useRef(false)

  const speak = useCallback(async (text) => {
    if (!text || speaking.current) return
    speaking.current = true
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.volume = 0.6
        audio.onended = () => { speaking.current = false; URL.revokeObjectURL(url) }
        audio.onerror = () => { speaking.current = false }
        await audio.play()
      } else {
        speaking.current = false
      }
    } catch {
      speaking.current = false
    }
  }, [])

  return speak
}

// ── Drishti ──────────────────────────────────────────────────────────────────

function Drishti({ color = '#5DCAA5', progress = 0 }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference * (1 - progress / 100)

  return (
    <div style={{ position: 'relative', width: 90, height: 90 }}>
      <svg width={90} height={90} viewBox="0 0 90 90" style={{
        position: 'absolute', top: 0, left: 0,
        animation: 'qs-breathe 4s ease-in-out infinite',
      }}>
        <circle cx={45} cy={45} r={40} fill="none" stroke={color} strokeWidth={0.5} opacity={0.15} />
        <circle cx={45} cy={45} r={28} fill="none" stroke={color} strokeWidth={0.4} opacity={0.1} />
      </svg>
      <svg width={90} height={90} viewBox="0 0 90 90" style={{
        position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)',
      }}>
        <circle
          cx={45} cy={45} r={40}
          fill="none" stroke={color} strokeWidth={1.5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          opacity={0.3}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 6, height: 6, borderRadius: '50%',
        background: color,
        animation: 'qs-glow 3s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Breathing Guide ──────────────────────────────────────────────────────────

function BreathingGuide({ progress = 0 }) {
  const circumference = 2 * Math.PI * 50

  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{
        animation: 'qs-breathe 6s ease-in-out infinite',
      }}>
        <circle cx={60} cy={60} r={45} fill="none" stroke="rgba(93,202,165,0.12)" strokeWidth={0.5} />
        <circle cx={60} cy={60} r={30} fill="none" stroke="rgba(93,202,165,0.08)" strokeWidth={0.4} />
        <circle cx={60} cy={60} r={15} fill="rgba(93,202,165,0.03)" />
      </svg>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{
        position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)',
      }}>
        <circle
          cx={60} cy={60} r={50}
          fill="none" stroke="rgba(93,202,165,0.2)" strokeWidth={1}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuickSessionOverlay({ onClose, onRequestValidation }) {
  const [protocolState, setProtocolState] = useState(null)
  const [isStarted, setIsStarted] = useState(false)
  const [textVisible, setTextVisible] = useState(true)
  const [prevPhaseIdx, setPrevPhaseIdx] = useState(-1)
  const [showSetup, setShowSetup] = useState(true)
  const [sessionName, setSessionName] = useState('')

  const playBell = useSingingBowl()
  const speak = useTTS()
  const pollRef = useRef(null)

  useEffect(() => {
    if (!isStarted) return

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/protocol/state`)
        const data = await res.json()
        setProtocolState(data)

        if (data.phase_index !== undefined && data.phase_index !== prevPhaseIdx) {
          setTextVisible(false)
          setTimeout(() => setTextVisible(true), 300)

          if (data.phase?.audio_freq && data.phase?.bell_on_start !== false) {
            playBell(data.phase.audio_freq)
          }
          if (data.tts_text) {
            setTimeout(() => speak(data.tts_text), 800)
          }
          setPrevPhaseIdx(data.phase_index)
        }

        if (data.status === 'complete') {
          playBell(528, 4)
          clearInterval(pollRef.current)
        }
      } catch (e) {
        console.error('[QuickSessionOverlay] poll error:', e)
      }
    }

    poll()
    pollRef.current = setInterval(poll, 1000)
    return () => clearInterval(pollRef.current)
  }, [isStarted, prevPhaseIdx, playBell, speak])

  const startSession = async () => {
    try {
      await fetch(`${API_BASE}/set-mode/muse`, { method: 'POST' })

      const res = await fetch(`${API_BASE}/protocol/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quick: true,
          name: sessionName || `calibración-${new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`,
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setShowSetup(false)
        setIsStarted(true)
        setPrevPhaseIdx(-1)
      }
    } catch (e) {
      console.error('[QuickSessionOverlay] start error:', e)
    }
  }

  const stopSession = async () => {
    try {
      await fetch(`${API_BASE}/protocol/stop`, { method: 'POST' })
      setIsStarted(false)
      setProtocolState(null)
      if (onClose) onClose()
    } catch (e) {
      console.error('[QuickSessionOverlay] stop error:', e)
    }
  }

  const advancePhase = async () => {
    await fetch(`${API_BASE}/protocol/advance`, { method: 'POST' })
  }

  const togglePause = async () => {
    if (protocolState?.is_paused) {
      await fetch(`${API_BASE}/protocol/resume`, { method: 'POST' })
    } else {
      await fetch(`${API_BASE}/protocol/pause`, { method: 'POST' })
    }
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  if (showSetup) {
    return (
      <div style={overlayStyle}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 320, maxWidth: '90%',
          background: 'rgba(0, 10, 20, 0.92)',
          border: '1px solid rgba(130, 130, 255, 0.2)',
          borderRadius: 16, padding: 28,
          fontFamily: 'monospace', color: '#fff',
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase' }}>
            Calibración rápida
          </div>
          <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', marginBottom: 20, letterSpacing: '0.05em' }}>
            3 fases · 3.5 min · grabación automática
          </div>

          <input
            type="text" value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Nombre opcional..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', marginBottom: 20,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff',
              fontSize: '0.8rem', fontFamily: 'monospace',
              outline: 'none',
            }}
          />

          {/* Phase preview */}
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Ojos abiertos', dur: '1 min', color: '#5DCAA5' },
              { label: 'Ojos cerrados', dur: '1.5 min', color: '#818CF8' },
              { label: 'Recuperación', dur: '1 min', color: '#5DCAA5' },
            ].map(({ label, dur, color }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 5,
              }}>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span style={{ fontSize: '0.6rem', color, fontVariantNumeric: 'tabular-nums' }}>{dur}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnStyle, flex: 1, color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.1)' }}>
              Cancelar
            </button>
            <button onClick={startSession} style={{ ...btnStyle, flex: 2, color: '#818CF8', borderColor: 'rgba(130,130,255,0.4)', background: 'rgba(130,130,255,0.08)' }}>
              Iniciar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Completado ───────────────────────────────────────────────────────────

  if (protocolState?.status === 'complete') {
    return (
      <div style={overlayStyle}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 20, color: 'rgba(130,130,255,0.7)', fontWeight: 300, letterSpacing: '0.1em' }}>
            Sesión grabada
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
            Ahora podés verificar el pipeline
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ ...btnStyle, color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.1)' }}>
              Cerrar
            </button>
            {onRequestValidation && (
              <button
                onClick={() => { onClose(); onRequestValidation() }}
                style={{ ...btnStyle, color: '#818CF8', borderColor: 'rgba(130,130,255,0.4)', background: 'rgba(130,130,255,0.1)' }}
              >
                Validar pipeline
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── En curso ─────────────────────────────────────────────────────────────

  const phase = protocolState?.phase
  if (!phase || !protocolState?.is_running) return null

  const textColor = phase.text_color || 'rgba(255,255,255,0.55)'
  const remaining = protocolState.phase_remaining || 0

  return (
    <div style={overlayStyle}>
      {/* Top: dots + label + instrucción */}
      <div style={{
        position: 'absolute', top: 100, left: 300, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        {/* Phase dots */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
          {Array.from({ length: protocolState.total_phases }).map((_, i) => (
            <div key={i} style={{
              width: i === protocolState.phase_index ? 16 : 5,
              height: 5, borderRadius: 3,
              background: `rgba(255,255,255,${i === protocolState.phase_index ? 0.35 : i < protocolState.phase_index ? 0.15 : 0.06})`,
              transition: 'all 0.4s',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', letterSpacing: '0.3em', marginBottom: 12 }}>
          {phase.label}
        </div>

        <div style={{
          opacity: textVisible ? 1 : 0,
          transform: textVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            fontSize: phase.has_drishti || phase.breathing_guide ? 18 : 22,
            color: textColor, fontWeight: 300, letterSpacing: '0.08em',
            textAlign: 'center', marginBottom: 6,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            {phase.instruction}
          </div>

          {phase.sub_instruction && (
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.15)',
              letterSpacing: '0.15em', textAlign: 'center',
              maxWidth: 280, marginBottom: 12,
            }}>
              {phase.sub_instruction}
            </div>
          )}

          {phase.has_drishti && (
            <Drishti
              color={phase.drishti_color || '#5DCAA5'}
              progress={protocolState.phase_progress || 0}
            />
          )}

          {phase.breathing_guide && (
            <BreathingGuide progress={protocolState.phase_progress || 0} />
          )}
        </div>
      </div>

      {/* Timer */}
      <div style={{
        position: 'absolute', bottom: 72, left: 300, right: 0,
        display: 'flex', justifyContent: 'center',
        fontFamily: 'monospace', fontSize: 24, color: 'rgba(255,255,255,0.12)',
        letterSpacing: 4,
      }}>
        {formatTime(remaining)}
      </div>

      {/* Controles */}
      <div style={{
        position: 'absolute', bottom: 0, left: 300, right: 0, height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        pointerEvents: 'auto',
      }}>
        <button onClick={togglePause} style={{
          ...controlBtnStyle,
          color: protocolState.is_paused ? '#818CF8' : 'rgba(255,255,255,0.3)',
          borderColor: protocolState.is_paused ? 'rgba(130,130,255,0.3)' : 'rgba(255,255,255,0.1)',
        }}>
          {protocolState.is_paused ? '▶' : '⏸'}
        </button>
        <button onClick={advancePhase} style={controlBtnStyle} title="Saltar fase">
          ›
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />
        <button onClick={stopSession} style={{ ...controlBtnStyle, color: 'rgba(255,80,80,0.4)', borderColor: 'rgba(255,80,80,0.15)' }} title="Detener">
          ✕
        </button>
      </div>

      <style>{`
        @keyframes qs-breathe {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.08); opacity: 0.45; }
        }
        @keyframes qs-glow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

// ── Estilos compartidos ───────────────────────────────────────────────────────

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 50,
}

const btnStyle = {
  padding: '10px 16px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8,
  color: 'rgba(255,255,255,0.5)',
  fontSize: '0.75rem', fontFamily: 'monospace',
  cursor: 'pointer', letterSpacing: '0.04em',
  transition: 'all 0.2s',
}

const controlBtnStyle = {
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: 'rgba(255,255,255,0.3)',
  fontSize: '1rem', fontFamily: 'monospace',
  padding: '6px 14px',
  cursor: 'pointer',
  transition: 'all 0.15s',
}
