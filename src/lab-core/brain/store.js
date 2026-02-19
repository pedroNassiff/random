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
