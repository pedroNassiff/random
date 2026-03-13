/**
 * CopilotPanelLabs — Panel de chat de ADA (copiloto EEG Labs).
 *
 * Se integra en AnalisisDatasets.jsx como overlay lateral.
 * Recibe `sessionContext` (sesión activa + análisis) desde el padre.
 * Usa el mismo sistema de diseño que AnalisisDatasets: Tailwind + paleta oscura.
 *
 * NO depende de react-query ni react-markdown para minimizar dependencias.
 * El análisis se computa en el padre (analyzeSession ya existe allí)
 * y se pasa como prop, evitando duplicar lógica.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useCopilotStore } from '../stores/copilotStore'

const API = import.meta.env.DEV
  ? 'http://localhost:8000'
  : 'https://api.random-lab.es'

const COPILOT_URL = `${API}/api/copilot/labs/chat`

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  '¿Cómo estuvo esta sesión?',
  '¿Estoy cerca del estado sintérgico?',
  '¿Qué mejorar en la próxima sesión?',
  'Explícame las fases detectadas',
]

// ── SimpleMarkdown (sin dependencias externas) ────────────────────────────────
function SimpleMarkdown({ text }) {
  // Convierte bullets y negritas básicos sin importar react-markdown
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        // Bold
        const parts = line.split(/(\*\*[^*]+\*\*)/g)
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="text-white/90 font-semibold">{p.slice(2, -2)}</strong>
            : p
        )
        return (
          <p key={i} className="text-[11px] text-white/70 leading-relaxed">
            {rendered}
          </p>
        )
      })}
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-purple-400"
          style={{
            animation: 'ada-bounce 1.2s infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes ada-bounce {
          0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  const isError = msg.error

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-mono mt-0.5
        ${isUser ? 'bg-white/10 text-white/50' : 'bg-purple-900/60 text-purple-300'}`}>
        {isUser ? 'tú' : '⬡'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] rounded-xl px-3 py-2.5
        ${isUser
          ? 'bg-white/[0.06] border border-white/[0.08]'
          : isError
            ? 'bg-red-900/20 border border-red-500/20'
            : 'bg-purple-900/20 border border-purple-500/[0.15]'
        }`}>
        {isUser
          ? <p className="text-[11px] text-white/80">{msg.text}</p>
          : <SimpleMarkdown text={msg.text} />
        }
        {msg.model_used && (
          <p className="text-[9px] text-white/20 mt-1.5 font-mono">
            {msg.model_used} · {msg.complexity}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Panel principal ───────────────────────────────────────────────────────────
export default function CopilotPanelLabs({ sessionContext }) {
  const { isOpen, isLoading, messages, setLoading, addMessage } = useCopilotStore()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  // Scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input al abrir
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  const send = useCallback(async (text) => {
    const msg = text.trim()
    if (!msg || isLoading) return

    setInput('')
    addMessage({ role: 'user', text: msg })
    setLoading(true)

    try {
      const res = await fetch(COPILOT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:         msg,
          session_context: sessionContext ?? null,
          user_tier:       'free',
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      addMessage({
        role:       'assistant',
        text:       data.text,
        model_used: data.model_used,
        complexity: data.complexity,
      })
    } catch (err) {
      addMessage({
        role:  'assistant',
        text:  `❌ No se pudo conectar con el copiloto. ¿Está el backend activo en \`localhost:8000\`?\n\nError: ${err.message}`,
        error: true,
      })
    } finally {
      setLoading(false)
    }
  }, [isLoading, sessionContext, addMessage, setLoading])

  const handleSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  if (!isOpen) return null

  return (
    <div className="flex flex-col h-full border-l border-white/[0.06] bg-black/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-purple-900/60 flex items-center justify-center text-[10px] text-purple-300">
            ⬡
          </div>
          <span className="text-xs font-medium text-white">ADA</span>
          <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded font-mono">
            Random chat
          </span>
        </div>
        {sessionContext && (
          <span className="text-[9px] text-white/25 font-mono max-w-[120px] truncate">
            {sessionContext.name || `#${sessionContext.id}`}
          </span>
        )}
      </div>

      {/* Sin sesión seleccionada — aviso */}
      {!sessionContext && (
        <div className="mx-3 mt-3 px-3 py-2 bg-amber-900/20 border border-amber-500/20 rounded text-[10px] text-amber-300/70">
          Selecciona una grabación para análisis.
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-900/60 flex items-center justify-center text-[10px] text-purple-300 flex-shrink-0 mt-0.5">
              ⬡
            </div>
            <div className="bg-purple-900/20 border border-purple-500/[0.15] rounded-xl px-3 py-2.5">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && !isLoading && (
        <div className="px-3 pb-2 flex-shrink-0">
          <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Acciones rápidas</p>
          <div className="flex flex-col gap-1">
            {QUICK_ACTIONS.map((qa) => (
              <button
                key={qa}
                onClick={() => send(qa)}
                disabled={!sessionContext}
                className="text-left text-[10px] text-purple-300/70 hover:text-purple-200 bg-purple-900/10
                  hover:bg-purple-900/20 border border-purple-500/10 hover:border-purple-500/25
                  rounded px-2.5 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {qa}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 px-3 py-3 border-t border-white/[0.06] flex-shrink-0"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={sessionContext ? 'Pregunta sobre esta sesión…' : 'Selecciona una sesión primero…'}
          disabled={isLoading}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-purple-500/50
            rounded-lg px-3 py-2 text-[11px] text-white/80 placeholder-white/20
            focus:outline-none transition-colors disabled:opacity-40 font-mono"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-white/5
            disabled:text-white/20 text-white rounded-lg text-[11px] font-medium
            transition-colors disabled:cursor-not-allowed flex-shrink-0"
        >
          ↑
        </button>
      </form>
    </div>
  )
}
