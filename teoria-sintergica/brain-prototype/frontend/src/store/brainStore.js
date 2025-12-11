import { create } from 'zustand'

export const useBrainStore = create((set) => ({
    // Syntergic parameters
    coherence: 0.5, // 0 to 1
    latticeDistortion: 0.1,
    activeRegion: null, // 'frontal', 'occipital', etc.

    // Actions
    setCoherence: (val) => set({ coherence: val }),
    setLatticeDistortion: (val) => set({ latticeDistortion: val }),
    setActiveRegion: (region) => set({ activeRegion: region }),
}))
