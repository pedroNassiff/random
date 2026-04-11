/**
 * CopilotStore — estado local del panel de chat de ADA.
 * Completamente independiente de useBrainStore.
 */
import { create } from 'zustand'

export const useCopilotStore = create((set) => ({
  isOpen:    false,
  isLoading: false,
  messages: [
    {
      id:   'initial',
      role: 'assistant',
      text: '👋 Hola, soy ADA. Puedo analizar tus sesiones EEG y ayudarte a entender tu progreso meditativo. Selecciona una grabación y pregúntame lo que quieras.',
    },
  ],

  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setLoading: (v) => set({ isLoading: v }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, { id: Date.now().toString(), ...msg }] })),

  clear: () =>
    set({
      messages: [
        {
          id:   'initial',
          role: 'assistant',
          text: '👋 Hola, soy ADA. Puedo analizar tus sesiones EEG y ayudarte a entender tu progreso meditativo. Selecciona una grabación y pregúntame lo que quieras.',
        },
      ],
    }),
}))
