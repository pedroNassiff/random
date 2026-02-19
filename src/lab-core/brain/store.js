/**
 * Syntergic Brain Store — main app version
 * 
 * Same shape as brain-prototype/brainStore.js but pointing to the production backend.
 * WebSocket: wss://api.random-lab.es/ws/brain-state
 * REST API : https://api.random-lab.es
 */
import { create } from 'zustand'

export const API_BASE = 'https://api.random-lab.es'
export const WS_URL   = 'wss://api.random-lab.es/ws/brain-state'

export const useBrainStore = create((set) => ({
  // Syntergic parameters
  coherence:     0.0,
  entropy:       1.0,
  focalPoint:    { x: 0, y: 0, z: 0 },
  activeRegion:  null,
  isPlaying:     true,

  // Scientific metrics
  bands:     { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
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

        // Debug: log first WS message and then every 100th to verify data pipeline
        const count = (useBrainStore.getState()._msgCount || 0) + 1
        if (count === 1 || count % 100 === 0) {
          const b = data.bands || {}
          console.log(
            `%c[Brain WS #${count}]%c source=${data.source || '?'}  coherence=${(data.coherence||0).toFixed(3)}` +
            `  δ=${(b.delta||0).toFixed(3)} θ=${(b.theta||0).toFixed(3)} α=${(b.alpha||0).toFixed(3)}` +
            `  β=${(b.beta||0).toFixed(3)} γ=${(b.gamma||0).toFixed(3)}`,
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
