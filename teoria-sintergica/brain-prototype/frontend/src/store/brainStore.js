import { create } from 'zustand'

export const useBrainStore = create((set) => ({
    // Syntergic parameters
    coherence: 0.0,
    entropy: 1.0,
    focalPoint: { x: 0, y: 0, z: 0 },
    activeRegion: null,
    isPlaying: true, // Auto-start
    
    // New scientific metrics
    bands: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
    state: 'unknown',
    plv: 0.0,
    frequency: 0.0,
    
    // Session playback state
    source: null,  // 'recorded', 'muse2', 'dataset', etc.
    sessionProgress: null,
    sessionTimestamp: null,
    sessionPaused: false,  // Para controlar el audio binaural

    // Actions
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })), // New action
    setSessionPaused: (paused) => set({ sessionPaused: paused }),
    setBrainState: (newState) => set({
        coherence: newState.coherence,
        entropy: newState.entropy,
        focalPoint: newState.focal_point,
        frequency: newState.frequency || 0,
        bands: newState.bands || { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
        state: newState.state || 'unknown',
        plv: newState.plv || 0,
        source: newState.source || null,
        sessionProgress: newState.session_progress || null,
        sessionTimestamp: newState.session_timestamp || null
    }),

    socket: null, // Guardamos referencia al socket

    // WebSocket Connection Logic with auto-reconnect
    connectToField: () => {
        // Evitar reconexiones si ya existe y está abierto
        const existingSocket = useBrainStore.getState().socket
        if (existingSocket && existingSocket.readyState === WebSocket.OPEN) return

        const connect = () => {
            const socket = new WebSocket('ws://localhost:8000/ws/brain-state')

            socket.onopen = () => {
                console.log('✓ Connected to Syntergic Field')
                set({ socket })
            }

            socket.onmessage = (event) => {
                const data = JSON.parse(event.data)
                useBrainStore.getState().setBrainState(data)
            }

            socket.onclose = () => {
                console.log('⚠️ Field connection lost - reconnecting in 2s...')
                set({ socket: null })
                // Auto-reconnect after 2 seconds
                setTimeout(() => {
                    console.log('🔄 Attempting reconnection...')
                    useBrainStore.getState().connectToField()
                }, 2000)
            }

            socket.onerror = (err) => {
                console.error('WebSocket error:', err)
                socket.close()
            }
        }

        connect()
    },

    setMode: async (mode) => {
        try {
            await fetch(`http://localhost:8000/set-mode/${mode}`, { method: 'POST' })
            console.log(`Experiment mode set to: ${mode}`)
        } catch (e) {
            console.error("Failed to switch mode:", e)
        }
    }
}))

