/**
 * Syntergic Brain Store — main app version
 * 
 * Same shape as brain-prototype/brainStore.js but pointing to the production backend.
 * WebSocket: wss://api.random-lab.es/ws/brain-state
 * REST API : https://api.random-lab.es
 */
import { create } from 'zustand'

// Lee de variables de entorno Vite:
//   .env.development  → localhost:8000  (npm run dev)
//   .env.production   → api.random-lab.es  (Vercel build)
export const API_BASE = import.meta.env.VITE_BRAIN_API_BASE || 'http://localhost:8000'
export const WS_URL   = import.meta.env.VITE_BRAIN_WS_URL   || 'ws://localhost:8000/ws/brain-state'

console.log(`[Brain Store] API_BASE=${API_BASE}`)

export const useBrainStore = create((set) => ({
  // Syntergic parameters
  coherence:     0.0,
  entropy:       1.0,
  focalPoint:    { x: 0, y: 0, z: 0 },
  activeRegion:  null,
  isPlaying:     true,

  // Scientific metrics
  bands:        { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
  // 1/f-corrected for visualization (see spectral.py — compensates the natural
  // 1/f^1.5 EEG power law so delta doesn't always dominate the bar chart)
  bandsDisplay: { delta: 0.2, theta: 0.2, alpha: 0.2, beta: 0.2, gamma: 0.2 },
  state:     'unknown',
  plv:       0.0,
  frequency: 0.0,

  // Session playback state
  source:           null,
  sessionProgress:  null,
  sessionTimestamp: null,
  sessionPaused:    false,
  _msgCount:        0,

  // Actions
  togglePlay:       () => set((s) => ({ isPlaying: !s.isPlaying })),
  setSessionPaused: (paused) => set({ sessionPaused: paused }),

  setBrainState: (newState) => set({
    coherence:        newState.coherence,
    entropy:          newState.entropy,
    focalPoint:       newState.focal_point,
    frequency:        newState.frequency        || 0,
    bands:            newState.bands            || { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
    bandsDisplay:     newState.bands_display    || newState.bands || { delta: 0.2, theta: 0.2, alpha: 0.2, beta: 0.2, gamma: 0.2 },
    state:            newState.state            || 'unknown',
    plv:              newState.plv              || 0,
    source:           newState.source           || null,
    sessionProgress:  newState.session_progress || null,
    sessionTimestamp: newState.session_timestamp|| null,
  }),

  socket: null,

  connectToField: () => {
    const existing = useBrainStore.getState().socket
    if (existing && existing.readyState === WebSocket.OPEN) return

    const connect = () => {
      const socket = new WebSocket(WS_URL)

      socket.onopen = () => {
        console.log('✓ Syntergic Field connected (production)')
        set({ socket })
      }

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)

        // Debug: log every 10th WS message (~2s at 5Hz) to see if values are actually changing
        const count = (useBrainStore.getState()._msgCount || 0) + 1
        if (count === 1 || count % 10 === 0) {
          const b = data.bands || {}
          const bd = data.bands_display || {}
          console.log(
            `%c[Brain WS #${count}]%c source=${data.source || '?'}  coherence=${(data.coherence||0).toFixed(3)}` +
            `  δ=${(b.delta||0).toFixed(3)} θ=${(b.theta||0).toFixed(3)} α=${(b.alpha||0).toFixed(3)}` +
            `  β=${(b.beta||0).toFixed(3)} γ=${(b.gamma||0).toFixed(3)}` +
            `  state=${data.state || '?'}` +
            `\n  display: δ=${(bd.delta||0).toFixed(3)} θ=${(bd.theta||0).toFixed(3)} α=${(bd.alpha||0).toFixed(3)} β=${(bd.beta||0).toFixed(3)} γ=${(bd.gamma||0).toFixed(3)}`,
            'background:#6366f1;color:#fff;font-weight:bold;border-radius:3px;padding:1px 4px',
            'color:#aaa'
          )
        }
        set({ _msgCount: count })

        useBrainStore.getState().setBrainState(data)
      }

      socket.onclose = () => {
        console.warn('⚠️ Field connection lost — reconnecting in 2s')
        set({ socket: null })
        setTimeout(() => useBrainStore.getState().connectToField(), 2000)
      }

      socket.onerror = (err) => {
        console.error('WebSocket error:', err)
        socket.close()
      }
    }

    connect()
  },

  disconnectFromField: () => {
    const socket = useBrainStore.getState().socket
    if (socket) {
      socket.close()
      set({ socket: null })
    }
  },
}))
