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

    // Actions
    togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })), // New action
    setBrainState: (newState) => set({
        coherence: newState.coherence,
        entropy: newState.entropy,
        focalPoint: newState.focal_point,
        frequency: newState.frequency || 0,
        bands: newState.bands || { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
        state: newState.state || 'unknown',
        plv: newState.plv || 0
    }),

    socket: null, // Guardamos referencia al socket

    // WebSocket Connection Logic
    connectToField: () => {
        // Evitar reconexiones si ya existe
        if (useBrainStore.getState().socket) return

        const socket = new WebSocket('ws://localhost:8000/ws/brain-state')

        socket.onopen = () => console.log('Connected to Syntergic Field')

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data)
            // setBrainState no causa re-render en componentes que no usan hooks selectores
            useBrainStore.getState().setBrainState(data)
        }

        socket.onclose = () => {
            console.log('Field connection lost')
            set({ socket: null })
        }

        set({ socket })
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

