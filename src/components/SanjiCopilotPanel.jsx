/**
 * SanjiCopilotPanel — Chat clínico con el copiloto de SANJI-RX.
 * Historial persistido en localStorage. Contexto clínico enviado solo al inicio de sesión.
 * Soporta análisis visual de imágenes (Hermes Vision).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import VisionAnalysisCard from './VisionAnalysisCard';

const COPILOT_URL = (import.meta.env.VITE_SANJI_API || 'http://localhost:8001') + '/sanji/copilot/chat';
const VISION_URL  = (import.meta.env.VITE_SANJI_API || 'http://localhost:8001') + '/sanji/vision/analyze';
const STORAGE_KEY = 'sanji_hermes_v2';
const MAX_STORED = 80;
const NEW_SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 horas = nueva sesión clínica

const QUICK_ACTIONS = [
  '¿Cómo está Sanji esta semana?',
  '¿Hay algo que deba comunicarle al veterinario?',
  '¿Cómo va la adherencia a la medicación?',
  '¿Qué debería observar hoy?',
  '¿Hay alguna tendencia preocupante?',
];

const WELCOME_MSG = {
  role: 'assistant',
  text: 'Hola Pedro. Tengo acceso al historial de Sanji. ¿Qué querés saber?',
  ts: null,
};

function loadPersistedMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return null;
}

function saveMessages(msgs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_STORED)));
  } catch (_) {}
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SimpleMarkdown({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} className="text-white/90 font-semibold">{p.slice(2, -2)}</strong>
            : p
        );
        return (
          <p key={i} className="text-[12px] text-white/75 leading-relaxed">{rendered}</p>
        );
      })}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
          style={{ animation: 'sanji-bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
      ))}
      <style>{`@keyframes sanji-bounce{0%,60%,100%{opacity:.2;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  );
}

export default function SanjiCopilotPanel({ historyContext, onClose, logDate }) {
  const [messages, setMessages] = useState(() => loadPersistedMessages() ?? [WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Persist on every change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  const clearHistory = useCallback(() => {
    const fresh = [{ ...WELCOME_MSG, text: 'Historial borrado. ¿Qué querés preguntar?', ts: Date.now() }];
    setMessages(fresh);
    localStorage.removeItem(STORAGE_KEY);
    setConfirmClear(false);
  }, []);

  const send = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput('');
    setConfirmClear(false);

    const ts = Date.now();
    const userMsg = { role: 'user', text: msg, ts };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Decide if we need to send clinical historyContext:
    // - First user message ever, OR last user message was >2h ago (nueva sesión)
    const prevUserMsgs = messages.filter(m => m.role === 'user');
    const lastUserTs = prevUserMsgs.length > 0 ? (prevUserMsgs[prevUserMsgs.length - 1].ts ?? 0) : 0;
    const isNewSession = prevUserMsgs.length === 0 || (Date.now() - lastUserTs > NEW_SESSION_IDLE_MS);

    // Build conversation history = PREVIOUS turns only (backend appends current message itself)
    // Skip: welcome/greeting messages (no ts). Keep: actual Q&A pairs. Last 16 msgs (8 pairs).
    const convoHistory = messages
      .filter(m => m.ts != null)   // skip welcome msg (no ts)
      .slice(-16)
      .map(m => ({ role: m.role, content: m.text }));
    // NOTE: do NOT push current message here — backend appends it with context block

    try {
      const res = await fetch(COPILOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history_context: isNewSession ? (historyContext ?? null) : null,
          conversation_history: convoHistory,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.text, model: data.model, ts: Date.now() }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `❌ Error conectando con Hermes.\n\n${err.message}`,
        error: true,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, historyContext]);

  const sendImage = useCallback(async (file) => {
    if (!file || visionLoading || loading) return;
    setVisionLoading(true);
    setImagePreview(null);

    const ts = Date.now();
    // Show preview in chat immediately
    const previewUrl = URL.createObjectURL(file);
    setMessages(prev => [...prev, {
      role: 'user',
      text: `📷 ${file.name}`,
      imagePreview: previewUrl,
      ts,
    }]);

    try {
      // Convert to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let b of bytes) binary += String.fromCharCode(b);
      const b64 = btoa(binary);
      const mediaType = file.type || 'image/jpeg';

      const res = await fetch(VISION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_b64: b64,
          media_type: mediaType,
          context_note: null,
          log_date: logDate ?? null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        vision: data.analysis,
        model: data.model,
        imageUrl: data.image_url,
        ts: Date.now(),
      }]);
      // Notify bitácora gallery to refresh
      if (logDate && data.image_url) {
        window.dispatchEvent(new CustomEvent('sanji-vision-saved', { detail: { date: logDate } }));
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `❌ Error analizando imagen: ${err.message}`,
        error: true,
        ts: Date.now(),
      }]);
    } finally {
      setVisionLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [visionLoading, loading, logDate]);

  // Build list with day-separator markers
  const renderedItems = [];
  let lastDay = null;
  messages.forEach((msg, i) => {
    const label = dayLabel(msg.ts);
    if (label && label !== lastDay) {
      renderedItems.push({ type: 'separator', label, key: `sep-${i}` });
      lastDay = label;
    }
    renderedItems.push({ type: 'message', msg, key: i });
  });

  const userMsgCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-l border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-900/60 flex items-center justify-center text-[11px] text-cyan-300">
            ⬡
          </div>
          <span className="text-sm font-semibold text-white">HERMES</span>
          <span className="text-[9px] bg-cyan-900/40 text-cyan-400 px-1.5 py-0.5 rounded font-mono">
            clínico
          </span>
          {userMsgCount > 0 && (
            <span className="text-[9px] text-neutral-600 font-mono">{userMsgCount} msg</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Clear history */}
          {userMsgCount > 0 && !confirmClear && (
            <button
              onClick={() => setConfirmClear(true)}
              title="Borrar historial"
              className="text-neutral-600 hover:text-red-400 text-[11px] font-mono transition-colors"
            >
              limpiar
            </button>
          )}
          {confirmClear && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-500">¿Seguro?</span>
              <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-300 font-mono">sí</button>
              <button onClick={() => setConfirmClear(false)} className="text-[10px] text-neutral-500 hover:text-white font-mono">no</button>
            </div>
          )}
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-lg leading-none">×</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {renderedItems.map(item => {
          if (item.type === 'separator') {
            return (
              <div key={item.key} className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-neutral-800" />
                <span className="text-[9px] text-neutral-600 font-mono">{item.label}</span>
                <div className="flex-1 h-px bg-neutral-800" />
              </div>
            );
          }
          const { msg, key } = item;
          return (
            <div key={key} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] mt-0.5
                ${msg.role === 'user' ? 'bg-white/10 text-white/50' : 'bg-cyan-900/60 text-cyan-300'}`}>
                {msg.role === 'user' ? 'tú' : '⬡'}
              </div>
              <div className={`max-w-[85%] ${msg.vision ? 'w-full' : ''}`}>
                {/* Vision card (assistant) */}
                {msg.vision && (
                  <VisionAnalysisCard analysis={msg.vision} model={msg.model} />
                )}
                {/* Image preview (user) */}
                {msg.imagePreview && (
                  <div className={`rounded-xl overflow-hidden border border-white/10 mb-1 ${msg.vision ? '' : 'max-w-[140px]'}`}>
                    <img src={msg.imagePreview} alt="imagen" className="w-full object-cover rounded-xl" />
                  </div>
                )}
                {/* Regular text bubble */}
                {!msg.vision && (
                  <div className={`rounded-xl px-3 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-white/[0.06] border border-white/[0.08]'
                      : msg.error
                        ? 'bg-red-900/20 border border-red-500/20'
                        : 'bg-neutral-800 border border-neutral-700'
                  }`}>
                    {msg.role === 'user'
                      ? <p className="text-[12px] text-white/80">{msg.text}</p>
                      : <SimpleMarkdown text={msg.text} />
                    }
                    <p className="text-[9px] text-neutral-600 mt-1 font-mono leading-none">
                      {msg.model ? `${msg.model} · ` : ''}{fmtTime(msg.ts)}
                    </p>
                  </div>
                )}
                {msg.vision && (
                  <p className="text-[9px] text-neutral-600 mt-1 font-mono leading-none pl-1">
                    {msg.model ? `${msg.model} · ` : ''}{fmtTime(msg.ts)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {(loading || visionLoading) && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-cyan-900/60 flex items-center justify-center text-[10px] text-cyan-300">⬡</div>
            <div className="bg-neutral-800 border border-neutral-700 rounded-xl px-3">
              <TypingDots />
            </div>
            {visionLoading && (
              <span className="text-[9px] text-cyan-500 font-mono self-end pb-2">analizando imagen…</span>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {userMsgCount === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((q, i) => (
            <button key={i} onClick={() => send(q)}
              className="text-[10px] font-mono px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:border-cyan-600 hover:text-cyan-300 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input); }}
        className="px-4 pb-4 pt-2 border-t border-neutral-800 flex-shrink-0">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) sendImage(file);
          }}
        />
        <div className="flex gap-2">
          {/* Camera button */}
          <button
            type="button"
            disabled={loading || visionLoading}
            onClick={() => fileInputRef.current?.click()}
            title="Analizar imagen de Sanji"
            className="px-2.5 py-2 bg-neutral-800 border border-neutral-700 hover:border-cyan-600 text-neutral-400 hover:text-cyan-300 rounded-lg text-sm transition-colors disabled:opacity-40"
          >
            📷
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Preguntá sobre Sanji…"
            disabled={loading || visionLoading}
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-cyan-600 disabled:opacity-50"
          />
          <button type="submit" disabled={loading || visionLoading || !input.trim()}
            className="px-3 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-sm font-mono disabled:opacity-40 transition-colors">
            →
          </button>
        </div>
      </form>
    </div>
  );
}
