/**
 * AdaRealtimePanel — Copiloto ADA en tiempo real para BrainDetail (/lab/brain).
 *
 * Dos capas de análisis:
 *  1. instant (rule-based): barra de estado con α/θ/coh + alertas inmediatas,
 *     sin latencia, sin LLM.
 *  2. deep (LLM): auto-análisis cada 30s + chat libre con ADA.
 *
 * Recibe datos en tiempo real de useBrainStore via props para evitar
 * suscripciones duplicadas y mantener el render cycle limpio.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAdaRealtimeStore }  from '../stores/adaRealtimeStore'
import { useBrainStore }         from '../lab-core/brain/store'
import { useBinauralBeats }      from '../hooks/useBinauralBeats'
import { getGuidance, classifyGuidanceState } from '../lib/adaGuidanceScripts'

const API = import.meta.env.DEV
  ? 'http://localhost:8000'
  : 'https://api.random-lab.es'

const COPILOT_URL = `${API}/api/copilot/labs/chat`

// ── Umbrales para feedback instantáneo (sin LLM) ─────────────────────────────
const ALPHA_GOOD       = 0.08
const ALPHA_DEEP       = 0.13
const ALPHA_SYNTERGIC  = 0.25
const COH_GOOD         = 0.50
const COH_SYNTERGIC    = 0.75
const BETA_HIGH        = 0.10

function getRuleBasedInsight(bands, coherence) {
  if (!bands) return null
  const { alpha = 0, theta = 0, beta = 0 } = bands

  if (alpha >= ALPHA_SYNTERGIC && coherence >= COH_SYNTERGIC)
    return { text: ' Estado sintérgico activo', color: '#a78bfa' }
  if (alpha >= ALPHA_DEEP)
    return { text: ' Meditación profunda · α en zona', color: '#34d399' }
  if (alpha >= ALPHA_GOOD && coherence >= COH_GOOD)
    return { text: ' Meditación estable', color: '#60a5fa' }
  if (beta >= BETA_HIGH)
    return { text: '⚠ β elevada · mente activa', color: '#fbbf24' }
  if (alpha < ALPHA_GOOD && coherence < COH_GOOD)
    return { text: '○ Estableciendo calma inicial', color: '#9ca3af' }
  return { text: '~ Transicionando', color: '#9ca3af' }
}

// ── Live status bar ───────────────────────────────────────────────────────────
function LiveStatusBar({ bands, coherence, sessionProgress }) {
  const insight = getRuleBasedInsight(bands, coherence)
  const alpha = bands?.alpha ?? 0
  const theta = bands?.theta ?? 0
  const beta  = bands?.beta  ?? 0
  const isActive = sessionProgress != null

  return (
    <div className="px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: isActive ? '#34d399' : '#4b5563' }}
        />
        <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">
          {isActive ? 'live' : 'sin sesión'}
        </span>
        {insight && (
          <span className="text-[9px] ml-auto" style={{ color: insight.color }}>
            {insight.text}
          </span>
        )}
      </div>
      {isActive && (
        <div className="flex gap-3">
          {[
            { label: 'α', value: alpha, color: '#a78bfa', threshold: ALPHA_DEEP },
            { label: 'θ', value: theta, color: '#34d399', threshold: 0.15 },
            { label: 'β', value: beta,  color: '#fbbf24', threshold: BETA_HIGH },
            { label: 'coh', value: coherence, color: '#60a5fa', threshold: COH_GOOD },
          ].map(({ label, value, color, threshold }) => (
            <div key={label} className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-mono" style={{ color }}>{label}</span>
                <span className="text-[8px] font-mono text-white/40">
                  {(value * 100).toFixed(1)}
                </span>
              </div>
              <div className="h-0.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (value / (threshold * 2)) * 100)}%`,
                    backgroundColor: color,
                    opacity: value >= threshold ? 1 : 0.4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-purple-400"
          style={{ animation: 'ada-rt-bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }}
        />
      ))}
      <style>{`@keyframes ada-rt-bounce { 0%, 60%, 100% { opacity: 0.2; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }`}</style>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg }) {
  const isUser = msg.role === 'user'
  const lines = msg.text.split('\n')
  return (
    <div className={`flex gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] mt-0.5
        ${isUser ? 'bg-white/[0.08] text-white/40' : 'bg-purple-900/60 text-purple-300'}`}>
        {isUser ? 'tú' : '⬡'}
      </div>
      <div className={`max-w-[88%] rounded-lg px-2.5 py-2 text-[10px] leading-relaxed
        ${isUser
          ? 'bg-white/[0.05] border border-white/[0.07] text-white/70'
          : msg.error
            ? 'bg-red-900/20 border border-red-500/20 text-red-300/80'
            : 'bg-purple-900/20 border border-purple-500/[0.15] text-white/70'
        }`}>
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-0.5" />
          const parts = line.split(/(\*\*[^*]+\*\*)/g)
          return (
            <p key={i} className="leading-relaxed">
              {parts.map((p, j) =>
                p.startsWith('**') && p.endsWith('**')
                  ? <strong key={j} className="text-white/90">{p.slice(2, -2)}</strong>
                  : p
              )}
            </p>
          )
        })}
        {msg.auto && (
          <p className="text-[8px] text-white/15 mt-1 font-mono">auto · {msg.model_used}</p>
        )}
      </div>
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────────────────────
export default function AdaRealtimePanel({ bands, coherence, sessionProgress, state: eegState, dataSource = 'dataset' }) {
  const {
    isOpen, isLoading, isAutoLoading, autoAnalyze, messages,
    toggle, setLoading, setAutoLoading, addMessage, addSample,
    getBufferSummary, clearBuffer, toggleAutoAnalyze,
  } = useAdaRealtimeStore()

  const sessionPaused = useBrainStore((s) => s.sessionPaused)

  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('auto')
  const bottomRef      = useRef(null)
  const inputRef       = useRef(null)
  const lastSampleAt   = useRef(0)
  const isAutoRunning  = useRef(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const voiceMutedRef = useRef(false)

  // ── Binaural beats ────────────────────────────────────────────────────────
  const binaural = useBinauralBeats()

  // ── TTS: ElevenLabs (voz Rachel) con fallback a Web Speech API ───────────
  const speakingRef = useRef(false)
  const audioRef    = useRef(null)

  const speak = useCallback(async (text) => {
    if (voiceMutedRef.current) return
    const clean = text
      .replace(/[⬡●•]/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/━+[^━]*━+/g, '')
      .trim()
    if (!clean) return

    // Cancelar cualquier locución anterior
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    window.speechSynthesis?.cancel()

    try {
      // Intentar ElevenLabs via backend
      const res = await fetch(`${API}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean }),
      })
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => URL.revokeObjectURL(url)
      audio.play()
    } catch {
      // Fallback: Web Speech API (voz del navegador)
      if (!window.speechSynthesis) return
      const utt = new SpeechSynthesisUtterance(clean)
      utt.lang = 'es-ES'
      utt.rate = 0.90
      utt.pitch = 1.05
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => v.lang.startsWith('es') && /Monica|Paulina|Lucia|Google/i.test(v.name))
        || voices.find(v => v.lang.startsWith('es'))
      if (preferred) utt.voice = preferred
      window.speechSynthesis.speak(utt)
    }
  }, [])

  const toggleMute = () => {
    const next = !voiceMutedRef.current
    voiceMutedRef.current = next
    setVoiceMuted(next)
    if (next) {
      window.speechSynthesis?.cancel()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }

  // ── Muse live mode: timer local de sesión (sessionProgress solo existe en dataset) ──
  const museLiveStartAt  = useRef(null)
  const [museLiveElapsed, setMuseLiveElapsed] = useState(null)

  useEffect(() => {
    if (dataSource !== 'muse') {
      museLiveStartAt.current = null
      setMuseLiveElapsed(null)
      return
    }
    // Arrancar timer al entrar en modo Muse — no depende de bands para evitar
    // que el interval se destruya cada vez que llega un mensaje WS
    if (!museLiveStartAt.current) museLiveStartAt.current = Date.now()
    const id = setInterval(() => {
      setMuseLiveElapsed(Math.floor((Date.now() - museLiveStartAt.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [dataSource]) // solo dataSource — nunca bands

  // Para Muse en vivo: usar timer local; para dataset: usar sessionProgress del WS
  const effectiveProgress = dataSource === 'muse' ? museLiveElapsed : sessionProgress

  // ── Guía adaptativa por estado EEG (cada 60s en modo Muse) ───────────────
  const lastGuidanceAt   = useRef(0)
  const lastWandering    = useRef(false)
  const guidanceOpeningDone = useRef(false)
  const isSessionActive  = useBrainStore((s) => s.isSessionActive)

  useEffect(() => {
    if (dataSource !== 'muse') return
    if (!isSessionActive) return  // No gastar TTS si no hay grabación/protocolo activo
    if (effectiveProgress == null || effectiveProgress < 3) return

    // Apertura: primera vez que hay datos
    if (!guidanceOpeningDone.current) {
      guidanceOpeningDone.current = true
      setTimeout(() => speak(getGuidance('opening')), 2000)
      lastGuidanceAt.current = Date.now()
      return
    }

    const now = Date.now()
    const secsSinceLast = (now - lastGuidanceAt.current) / 1000

    // Wandering: intervenir más rápido (15s) — estado sintérgico: silencio total
    const guidanceState = classifyGuidanceState(bands, coherence, lastWandering.current)
    const isWandering   = guidanceState === 'wandering'
    const isSyntergic   = (bands?.alpha ?? 0) >= 0.25 && coherence >= 0.75

    if (isSyntergic) return  // silencio total en estado sintérgico

    const minInterval = isWandering ? 15 : 60
    if (secsSinceLast < minInterval) return

    lastGuidanceAt.current = now
    lastWandering.current  = isWandering
    speak(getGuidance(guidanceState))
  }, [effectiveProgress, bands, coherence, dataSource, speak, isSessionActive])

  // Mantiene los props más recientes accesibles desde setInterval sin stale closures
  const liveRef = useRef({})
  liveRef.current = { bands, coherence, sessionProgress, eegState, sessionPaused, dataSource, museLiveElapsed }

  // ── Alimentar buffer (throttled a 1 muestra/s para no saturar) ─────────────
  useEffect(() => {
    if (effectiveProgress == null || !bands) return
    if (dataSource !== 'muse' && sessionPaused) return
    const now = Date.now()
    if (now - lastSampleAt.current < 1000) return
    lastSampleAt.current = now
    addSample({ ...bands, coherence })
  }, [effectiveProgress, bands, coherence, addSample, dataSource, sessionPaused])

  // ── Auto-análisis cada 30s — setInterval + liveRef (sin stale closures) ────────
  useEffect(() => {
    if (!autoAnalyze) return
    const id = setInterval(async () => {
      const { bands, coherence, sessionProgress, eegState, sessionPaused, dataSource, museLiveElapsed } = liveRef.current
      // No gastar LLM + TTS si no hay sesión activa (grabación, protocolo o dataset)
      const sessionActive = useBrainStore.getState().isSessionActive
      if (dataSource === 'muse' && !sessionActive) return
      const effectiveProg = dataSource === 'muse' ? museLiveElapsed : sessionProgress
      if (effectiveProg == null || (dataSource !== 'muse' && sessionPaused) || isAutoRunning.current) return
      const summary = useAdaRealtimeStore.getState().getBufferSummary()
      if (!summary || summary.n_samples < 10) return

      isAutoRunning.current = true
      setAutoLoading(true)
      const elapsed = dataSource === 'muse' ? (museLiveElapsed ?? 0) : Math.round(sessionProgress * 1000)
      try {
        const res = await fetch(COPILOT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message:         'Analiza el estado actual de la meditación y da una guía breve.',
            session_context: {
              mode:           'realtime',
              source:         dataSource,
              elapsed_s:      elapsed,
              live_snapshot:  { bands, coherence, state: eegState },
              buffer_summary: summary,
            },
            user_tier: 'free',
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        useAdaRealtimeStore.getState().addMessage({
          role:       'assistant',
          text:       data.text,
          model_used: data.model_used,
          auto:       true,
        })
        speak(data.text)
      } catch {
        // auto-análisis: fallo silencioso, no interrumpir al practicante
      } finally {
        isAutoRunning.current = false
        setAutoLoading(false)
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [autoAnalyze, setAutoLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  // ── Enviar pregunta del usuario al backend ────────────────────────────────
  // mode:'question' → ADA responde la pregunta con contexto EEG, sin límite de 45 palabras
  // No comparte estado isLoading con el auto-análisis → nunca se bloquean mutuamente
  const sendToAda = useCallback(async (text, context) => {
    if (isLoading) return  // sólo bloquear si hay otra pregunta del usuario en curso
    addMessage({ role: 'user', text })
    setLoading(true)

    try {
      const res = await fetch(COPILOT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:         text,
          session_context: context,
          user_tier:       'free',
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      addMessage({
        role:       'assistant',
        text:       data.text,
        model_used: data.model_used,
      })
      speak(data.text)
    } catch (err) {
      addMessage({
        role:  'assistant',
        text:  `Sin conexión con ADA. ¿Backend activo?\n${err.message}`,
        error: true,
      })
    } finally {
      setLoading(false)
    }
  }, [isLoading, addMessage, setLoading])

  const handleSubmit = (e) => {
    e.preventDefault()
    const msg = input.trim()
    if (!msg) return
    setInput('')
    const summary = getBufferSummary()
    const elapsed = dataSource === 'muse'
      ? (museLiveElapsed ?? 0)
      : (sessionProgress != null ? Math.round(sessionProgress * 1000) : 0)
    // mode:'question' → backend usa _SYSTEM_PROMPT (160 palabras) y responde la pregunta
    // incluyendo el snapshot EEG como contexto, no como objetivo de la respuesta
    sendToAda(msg, {
      mode:             'question',
      source:           dataSource,
      elapsed_s:        elapsed,
      model_preference: selectedModel,
      live_snapshot:    effectiveProgress != null ? { bands, coherence, state: eegState } : undefined,
      buffer_summary:   summary ?? undefined,
    })
  }

  return (
    <>
      {/* ── Toggle button ─────────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        title={isOpen ? 'Cerrar ADA' : 'Abrir ADA — copiloto en tiempo real'}
        style={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 300,
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: isOpen ? 'rgba(139,92,246,0.7)' : 'rgba(0,0,0,0.7)',
          border: `1px solid ${isOpen ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.1)'}`,
          color: isOpen ? '#fff' : 'rgba(167,139,250,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          cursor: 'none',
          transition: 'all 0.2s',
          backdropFilter: 'blur(8px)',
        }}
      >
        ⬡
      </button>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div style={{
          position:   'fixed',
          top:        0,
          left:       0,
          width:      278,
          height:     '100vh',
          zIndex:     200,
          display:    'flex',
          flexDirection: 'column',
          background: 'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 100%)',
          backdropFilter: 'blur(14px)',
          borderRight: '1px solid rgba(139,92,246,0.12)',
          fontFamily: 'monospace',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '44px 12px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ color: '#a78bfa', fontSize: 14 }}>⬡</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>ADA</span>
              <span style={{
                fontSize: 8, color: '#a78bfa',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.25)',
                padding: '1px 6px', borderRadius: 4,
              }}>
                tiempo real
              </span>
              {/* Auto toggle */}
              <button
                onClick={toggleAutoAnalyze}
                title="Auto-análisis cada 30s"
                style={{
                  marginLeft: 'auto',
                  fontSize: 8, padding: '2px 6px', borderRadius: 4, cursor: 'none',
                  background: autoAnalyze ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${autoAnalyze ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: autoAnalyze ? '#34d399' : 'rgba(255,255,255,0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {isAutoLoading ? '· · ·' : 'auto 30s'}
              </button>
              {/* Mute voz */}
              <button
                onClick={toggleMute}
                title={voiceMuted ? 'Activar voz de ADA' : 'Silenciar voz de ADA'}
                style={{
                  marginLeft: 4,
                  fontSize: 10, padding: '2px 5px', borderRadius: 4, cursor: 'none',
                  background: voiceMuted ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.15)',
                  border: `1px solid ${voiceMuted ? 'rgba(255,255,255,0.08)' : 'rgba(139,92,246,0.3)'}`,
                  color: voiceMuted ? 'rgba(255,255,255,0.2)' : '#a78bfa',
                  transition: 'all 0.2s',
                }}
              >
                {voiceMuted ? '🔇' : '🔊'}
              </button>
              {/* Binaural beats toggle */}
              <button
                onClick={() => binaural.active ? binaural.stop() : binaural.start('alpha')}
                title={binaural.active ? `Binaural activo: ${binaural.preset} — click para parar` : 'Activar beats binaurales (requiere auriculares)'}
                style={{
                  marginLeft: 4,
                  fontSize: 9, padding: '2px 5px', borderRadius: 4, cursor: 'none',
                  background: binaural.active ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${binaural.active ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: binaural.active ? '#34d399' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.2s',
                }}
              >
                {binaural.active ? `∿ ${binaural.preset}` : '∿'}
              </button>
            </div>
          </div>

          {/* Live status */}
          <LiveStatusBar
            bands={bands}
            coherence={coherence}
            sessionProgress={effectiveProgress}
          />

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 10px 4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            scrollbarWidth: 'none',
          }}>
            {messages.map((msg) => <MsgBubble key={msg.id} msg={msg} />)}
            {isLoading && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(139,92,246,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: '#a78bfa', flexShrink: 0,
                }}>⬡</div>
                <div style={{
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.15)',
                  borderRadius: 8, padding: '8px 10px',
                }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '8px 10px 12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flexShrink: 0,
            }}
          >
            {/* Model selector */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginRight: 2 }}>modelo</span>
              {[
                { id: 'auto',   label: '⚡ Auto',   title: 'Groq (llama) · gratis' },
                { id: 'gemini', label: '✦ Gemini',  title: 'Gemini 2.0 Flash · gratis' },
                { id: 'claude', label: '◆ Claude',  title: 'Claude 3.5 Haiku · pago' },
              ].map(({ id, label, title }) => (
                <button
                  key={id}
                  type="button"
                  title={title}
                  onClick={() => setSelectedModel(id)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 20,
                    fontSize: 9,
                    fontFamily: 'monospace',
                    border: selectedModel === id
                      ? '1px solid rgba(139,92,246,0.7)'
                      : '1px solid rgba(255,255,255,0.08)',
                    background: selectedModel === id
                      ? 'rgba(139,92,246,0.18)'
                      : 'rgba(255,255,255,0.03)',
                    color: selectedModel === id
                      ? 'rgba(167,139,250,0.95)'
                      : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Input row */}
            <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta a ADA..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '7px 10px',
                fontSize: 10,
                color: 'rgba(255,255,255,0.8)',
                outline: 'none',
                fontFamily: 'monospace',
                opacity: isLoading ? 0.4 : 1,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                background: !input.trim() || isLoading ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.7)',
                border: 'none',
                color: !input.trim() || isLoading ? 'rgba(255,255,255,0.2)' : '#fff',
                fontSize: 12,
                cursor: 'none',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              ↑
            </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
