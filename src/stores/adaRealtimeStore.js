/**
 * adaRealtimeStore — estado del copiloto ADA en modo tiempo real (BrainDetail).
 *
 * Independiente de copilotStore (que es para AnalisisDatasets).
 * Mantiene:
 *  - Chat de mensajes
 *  - Buffer de muestras EEG (últimos 30s a 5Hz = 150 muestras)
 *  - Estado del auto-análisis (activo/inactivo)
 */
import { create } from 'zustand'

const BUFFER_SIZE = 150  // 30s × 5Hz

const WELCOME_MSG = {
  id:   'welcome',
  role: 'assistant',
  text: '⬡ Hola, soy ADA. Estoy monitorizando tu sesión en tiempo real.\n• Auto-análisis cada 30s cuando el dataset esté activo.\n• También puedes preguntarme en cualquier momento.',
}

export const useAdaRealtimeStore = create((set, get) => ({
  isOpen:        false,
  isLoading:     false,
  isAutoLoading: false,
  autoAnalyze:   true,
  messages:    [WELCOME_MSG],

  // Buffer circular de muestras EEG { alpha, theta, beta, gamma, delta, coherence, state }
  buffer: [],

  // Toggle panel
  open:   () => set({ isOpen: true }),
  close:  () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setLoading:     (v) => set({ isLoading: v }),
  setAutoLoading: (v) => set({ isAutoLoading: v }),
  toggleAutoAnalyze: () => set((s) => ({ autoAnalyze: !s.autoAnalyze })),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { id: Date.now().toString(), ...msg }] })),

  // Añade una muestra al buffer, descartando la más vieja si llena
  addSample: (sample) =>
    set((s) => {
      const next = [...s.buffer, sample]
      return { buffer: next.length > BUFFER_SIZE ? next.slice(-BUFFER_SIZE) : next }
    }),

  clearBuffer: () => set({ buffer: [] }),

  // Estadísticas del buffer para el prompt (sin exponer raw arrays al backend)
  getBufferSummary: () => {
    const { buffer } = get()
    if (buffer.length < 5) return null

    const avg = (key) => buffer.reduce((s, m) => s + (m[key] ?? 0), 0) / buffer.length

    const alphas = buffer.map((m) => m.alpha ?? 0)
    const n = alphas.length
    const firstHalf  = alphas.slice(0, Math.floor(n / 2))
    const secondHalf = alphas.slice(Math.floor(n / 2))
    const avgFirst  = firstHalf.reduce((s, v)  => s + v, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
    const diff = avgSecond - avgFirst
    const alphaTrend = Math.abs(diff) < 0.01 ? 'estable' : diff > 0 ? 'subiendo' : 'bajando'

    // Mind-wandering: caídas bruscas de α
    let wanderingEvents = 0
    const sw = Math.max(3, Math.floor(n / 20))
    for (let i = sw; i < n - sw; i++) {
      const before = firstHalf.slice(Math.max(0, i - sw), i).reduce((s, v) => s + v, 0) / sw || avgFirst
      const after  = alphas.slice(i, i + sw).reduce((s, v) => s + v, 0) / sw
      if (before > 0.08 && after < before * 0.5) { wanderingEvents++; i += sw }
    }

    return {
      n_samples:       buffer.length,
      avg_alpha:       avg('alpha'),
      avg_theta:       avg('theta'),
      avg_beta:        avg('beta'),
      avg_coherence:   avg('coherence'),
      alpha_trend:     alphaTrend,
      wandering_events: wanderingEvents,
    }
  },

  reset: () =>
    set({ messages: [WELCOME_MSG], buffer: [], isLoading: false }),
}))
