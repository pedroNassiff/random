/**
 * ProtocolOverlay — Overlay contemplativo para el protocolo de validación.
 *
 * Diseño contemplativo:
 *  - Instrucciones como susurro visual (fade in/out, opacidad baja)
 *  - Drishti (punto de foco) para fases de ojos abiertos
 *  - Breathing guide para shamatha/recovery
 *  - Singing bowl bell en cada transición
 *  - TTS whisper vía ElevenLabs para fases de ojos cerrados
 *  - Arco de progreso ultra-sutil alrededor del drishti
 *
 * Se monta SOBRE el Canvas de BrainDetail con pointer-events: none.
 * No interfiere con OrbitControls ni con el cerebro 3D.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { API_BASE } from '../store'

// ── Audio: Singing Bowl ─────────────────────────────────────────────────────

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

      // Fundamental
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

      // Armónico (timbre de cuenco tibetano)
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
      // Audio not available
    }
  }, [getCtx])

  return playBell
}

// ── TTS Whisper vía backend → ElevenLabs ────────────────────────────────────

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

// ── Drishti: punto de foco para meditación ojos abiertos ────────────────────

function Drishti({ color = '#5DCAA5', progress = 0 }) {
  const circumference = 2 * Math.PI * 40 // r=40
  const offset = circumference * (1 - progress / 100)

  return (
    <div style={{ position: 'relative', width: 90, height: 90 }}>
      {/* Breathing rings */}
      <svg width={90} height={90} viewBox="0 0 90 90" style={{
        position: 'absolute', top: 0, left: 0,
        animation: 'protocol-breathe 4s ease-in-out infinite',
      }}>
        <circle cx={45} cy={45} r={40} fill="none" stroke={color} strokeWidth={0.5} opacity={0.15} />
        <circle cx={45} cy={45} r={28} fill="none" stroke={color} strokeWidth={0.4} opacity={0.1} />
      </svg>
      {/* Progress arc */}
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
      {/* Center point */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 6, height: 6, borderRadius: '50%',
        background: color,
        animation: 'protocol-glow 3s ease-in-out infinite',
      }} />
    </div>
  )
}

// ── Breathing Guide: guía visual de respiración ─────────────────────────────

function BreathingGuide({ progress = 0 }) {
  const circumference = 2 * Math.PI * 50

  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg width={120} height={120} viewBox="0 0 120 120" style={{
        animation: 'protocol-breathe 6s ease-in-out infinite',
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

// ── Main Component ──────────────────────────────────────────────────────────

export default function ProtocolOverlay({ onClose }) {
  const [protocolState, setProtocolState] = useState(null)
  const [isStarted, setIsStarted] = useState(false)
  const [textVisible, setTextVisible] = useState(true)
  const [prevPhaseIdx, setPrevPhaseIdx] = useState(-1)

  // Metadata form
  const [showSetup, setShowSetup] = useState(true)
  const [sessionName, setSessionName] = useState('')
  const [sleepQuality, setSleepQuality] = useState(3)
  const [caffeine, setCaffeine] = useState(false)
  const [subjectivePre, setSubjectivePre] = useState(5)

  const playBell = useSingingBowl()
  const speak = useTTS()
  const pollRef = useRef(null)

  // Poll protocol state from backend
  useEffect(() => {
    if (!isStarted) return

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/protocol/state`)
        const data = await res.json()
        setProtocolState(data)

        // Detectar transición de fase → bell + TTS
        if (data.phase_index !== undefined && data.phase_index !== prevPhaseIdx) {
          // Fade out → fade in
          setTextVisible(false)
          setTimeout(() => setTextVisible(true), 300)

          if (data.phase?.audio_freq && data.phase?.bell_on_start !== false) {
            playBell(data.phase.audio_freq)
          }
          if (data.tts_text) {
            // Pequeño delay para que el bell suene primero
            setTimeout(() => speak(data.tts_text), 800)
          }
          setPrevPhaseIdx(data.phase_index)
        }

        // Protocolo completado
        if (data.status === 'complete') {
          playBell(528, 4)
          clearInterval(pollRef.current)
        }
      } catch (e) {
        console.error('[ProtocolOverlay] poll error:', e)
      }
    }

    poll()
    pollRef.current = setInterval(poll, 1000)
    return () => clearInterval(pollRef.current)
  }, [isStarted, prevPhaseIdx, playBell, speak])

  const startProtocol = async () => {
    try {
      // Asegurar modo Muse activo
      await fetch(`${API_BASE}/set-mode/muse`, { method: 'POST' })

      const res = await fetch(`${API_BASE}/protocol/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName || undefined,
          metadata: {
            sleep_quality: sleepQuality,
            caffeine,
            subjective_pre: subjectivePre,
            time_of_day: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening',
          },
        }),
      })
      const data = await res.json()
      if (data.status === 'success') {
        setShowSetup(false)
        setIsStarted(true)
        setPrevPhaseIdx(-1)
      }
    } catch (e) {
      console.error('[ProtocolOverlay] start error:', e)
    }
  }

  const stopProtocol = async () => {
    try {
      await fetch(`${API_BASE}/protocol/stop`, { method: 'POST' })
      setIsStarted(false)
      setProtocolState(null)
      if (onClose) onClose()
    } catch (e) {
      console.error('[ProtocolOverlay] stop error:', e)
    }
  }

  const advancePhase = async () => {
    await fetch(`${API_BASE}/protocol/advance`, { method: 'POST' })
  }

  const goBackPhase = async () => {
    await fetch(`${API_BASE}/protocol/back`, { method: 'POST' })
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

  // ── Setup screen (pre-protocol metadata) ─────────────────────────────────

  if (showSetup) {
    return (
      <div style={overlayStyle}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 340, maxWidth: '90%',
          background: 'rgba(0, 10, 20, 0.92)',
          border: '1px solid rgba(93, 202, 165, 0.2)',
          borderRadius: 16, padding: 28,
          fontFamily: 'monospace', color: '#fff',
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: '0.6rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.3)', marginBottom: 20, textTransform: 'uppercase' }}>
            Protocolo de validaciónn
          </div>

          <input
            type="text" value={sessionName}
            onChange={e => setSessionName(e.target.value)}
            placeholder="Nombre de la sesión..."
            style={inputStyle}
          />

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Sueño (1-5)</label>
              <input type="range" min={1} max={5} value={sleepQuality}
                onChange={e => setSleepQuality(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{sleepQuality}</div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Estado (1-10)</label>
              <input type="range" min={1} max={10} value={subjectivePre}
                onChange={e => setSubjectivePre(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>{subjectivePre}</div>
            </div>
          </div>

          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={caffeine} onChange={e => setCaffeine(e.target.checked)} />
            Café hoy
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnStyle, flex: 1, color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.1)' }}>
              Cancelar
            </button>
            <button onClick={startProtocol} style={{ ...btnStyle, flex: 2, color: '#5DCAA5', borderColor: 'rgba(93,202,165,0.4)', background: 'rgba(93,202,165,0.08)' }}>
              Iniciar protocolo
            </button>
          </div>

          <div style={{ marginTop: 16, fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            8 fases · 30 minutos · grabación automática
          </div>
        </div>
      </div>
    )
  }

  // ── Protocol completed ───────────────────────────────────────────────────

  if (protocolState?.status === 'complete') {
    return (
      <div style={overlayStyle}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: 22, color: 'rgba(93,202,165,0.7)', fontWeight: 300, letterSpacing: '0.1em', marginBottom: 12 }}>
            Protocolo completado
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginBottom: 24 }}>
            Sesión grabada y log guardado
          </div>
          <button onClick={onClose} style={{ ...btnStyle, color: '#5DCAA5', borderColor: 'rgba(93,202,165,0.3)', pointerEvents: 'auto' }}>
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  // ── Active protocol ──────────────────────────────────────────────────────

  const phase = protocolState?.phase
  if (!phase || !protocolState?.is_running) return null

  const textColor = phase.text_color || 'rgba(255,255,255,0.55)'
  const remaining = protocolState.phase_remaining || 0

  return (
    <div style={overlayStyle}>
      {/* Top area: phase dots + label + instruction (above the brain) */}
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

        {/* Phase label */}
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
          letterSpacing: '0.3em', marginBottom: 12,
        }}>
          {phase.label}
        </div>

        {/* Instruction + sub_instruction */}
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

          {/* Visual element: Drishti or Breathing Guide */}
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

      {/* Timer (above controls, below brain) */}
      <div style={{
        position: 'absolute', bottom: 72, left: 300, right: 0,
        display: 'flex', justifyContent: 'center',
        fontFamily: 'monospace', fontSize: 24, color: 'rgba(255,255,255,0.12)',
        letterSpacing: 4,
      }}>
        {formatTime(remaining)}
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'absolute', bottom: 0, left: 300, right: 0, height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        pointerEvents: 'auto',
      }}>
        <button onClick={goBackPhase} style={controlBtnStyle} title="Fase anterior">
          ‹
        </button>
        <button onClick={togglePause} style={{
          ...controlBtnStyle,
          color: protocolState.is_paused ? '#5DCAA5' : 'rgba(255,255,255,0.3)',
          borderColor: protocolState.is_paused ? 'rgba(93,202,165,0.3)' : 'rgba(255,255,255,0.1)',
        }}>
          {protocolState.is_paused ? '▶' : '⏸'}
        </button>
        <button onClick={advancePhase} style={controlBtnStyle} title="Siguiente fase">
          ›
        </button>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />
        <button onClick={stopProtocol} style={{ ...controlBtnStyle, color: 'rgba(255,80,80,0.4)', borderColor: 'rgba(255,80,80,0.15)' }} title="Detener">
          ✕
        </button>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes protocol-breathe {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.08); opacity: 0.45; }
        }
        @keyframes protocol-glow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

// ── Shared styles ───────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 50,
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', marginBottom: 16,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, color: '#fff',
  fontSize: '0.8rem', fontFamily: 'monospace',
  outline: 'none',
}

const labelStyle = {
  fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)',
  display: 'block', marginBottom: 6,
  letterSpacing: '0.15em', textTransform: 'uppercase',
  fontFamily: 'monospace',
}

const btnStyle = {
  padding: '10px 16px',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 8, color: 'rgba(255,255,255,0.5)',
  fontSize: '0.75rem', fontFamily: 'monospace',
  cursor: 'pointer', transition: 'all 0.2s',
}

const controlBtnStyle = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.3)',
  padding: '8px 14px',
  borderRadius: 6, fontSize: 14,
  cursor: 'pointer', fontFamily: 'monospace',
  transition: 'all 0.15s',
}
