/**
 * Panspermia — GameStore
 *
 * Estado global del juego (zustand). Separa lo persistido (progresión,
 * ver SaveManager) de lo runtime-only (escena activa, planeta activo).
 */
import { create } from 'zustand'

export const PANSPERMIA_SAVE_DEFAULTS = {
  reincarnationLevel: 1,
  element: null,
  unlockedCenters: [],
  visitedPlanets: [],
  knowledge: [],
  energy: 0,
}

export const useGameStore = create((set, get) => ({
  // Progresión persistida — mismo shape que PANSPERMIA_SAVE_DEFAULTS
  ...PANSPERMIA_SAVE_DEFAULTS,

  // Runtime-only — no se persiste
  currentScene: 'nexus', // 'nexus' | 'galaxy-travel' | 'planet-surface'
  activePlanetId: null,

  // Flujo de escenas
  setScene: (sceneId) => set({ currentScene: sceneId }),
  enterPlanet: (planetId) => set({ activePlanetId: planetId, currentScene: 'planet-surface' }),
  leavePlanet: () => set({ activePlanetId: null, currentScene: 'galaxy-travel' }),

  // Progresión
  chooseElement: (elementId) => set({ element: elementId }),
  addEnergy: (amount) => set((s) => ({ energy: s.energy + amount })),
  spendEnergy: (amount) => {
    const { energy } = get()
    if (energy < amount) return false
    set({ energy: energy - amount })
    return true
  },
  unlockCenter: (centerId) => set((s) =>
    s.unlockedCenters.includes(centerId) ? s : { unlockedCenters: [...s.unlockedCenters, centerId] }
  ),
  visitPlanet: (planetId) => set((s) =>
    s.visitedPlanets.includes(planetId) ? s : { visitedPlanets: [...s.visitedPlanets, planetId] }
  ),
  addKnowledge: (fragmentId) => set((s) =>
    s.knowledge.includes(fragmentId) ? s : { knowledge: [...s.knowledge, fragmentId] }
  ),
  reincarnate: () => set((s) => ({
    reincarnationLevel: s.reincarnationLevel + 1,
    currentScene: 'nexus',
    activePlanetId: null,
  })),

  // Save I/O — sólo toca la porción persistida
  hydrateFromSave: (saveData) => set({ ...PANSPERMIA_SAVE_DEFAULTS, ...saveData }),
  getSaveSnapshot: () => {
    const s = get()
    return {
      reincarnationLevel: s.reincarnationLevel,
      element: s.element,
      unlockedCenters: s.unlockedCenters,
      visitedPlanets: s.visitedPlanets,
      knowledge: s.knowledge,
      energy: s.energy,
    }
  },
  resetProgress: () => set({ ...PANSPERMIA_SAVE_DEFAULTS, currentScene: 'nexus', activePlanetId: null }),
}))
