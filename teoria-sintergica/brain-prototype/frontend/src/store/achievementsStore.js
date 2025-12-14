/**
 * Store de Achievements & Practice Progress
 * 
 * Gestiona:
 * - Logros desbloqueables
 * - Progreso de sesiones de práctica
 * - Estadísticas históricas
 * - Persistencia en localStorage
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Definición de achievements
export const ACHIEVEMENTS = [
  {
    id: 'first_contact',
    name: 'First Contact',
    description: 'Reach 60% coherence for the first time',
    icon: '🌟',
    threshold: 0.6,
    type: 'coherence_peak',
    unlocked: false
  },
  {
    id: 'steady_mind',
    name: 'Steady Mind',
    description: 'Maintain 70% coherence for 30 seconds',
    icon: '🧘',
    threshold: 0.7,
    duration: 30, // segundos
    type: 'coherence_sustained',
    unlocked: false
  },
  {
    id: 'flow_state',
    name: 'Flow State',
    description: 'Maintain 75% coherence for 1 minute',
    icon: '🌊',
    threshold: 0.75,
    duration: 60,
    type: 'coherence_sustained',
    unlocked: false
  },
  {
    id: 'unified_field',
    name: 'Unified Field',
    description: 'Reach 90% coherence',
    icon: '✨',
    threshold: 0.9,
    type: 'coherence_peak',
    unlocked: false
  },
  {
    id: 'alpha_master',
    name: 'Alpha Master',
    description: 'Maintain Alpha dominance (>0.6) for 2 minutes',
    icon: '⚡',
    threshold: 0.6,
    duration: 120,
    type: 'alpha_sustained',
    unlocked: false
  },
  {
    id: 'theta_explorer',
    name: 'Theta Explorer',
    description: 'Enter deep Theta state (>0.5) for 1 minute',
    icon: '🌙',
    threshold: 0.5,
    duration: 60,
    type: 'theta_sustained',
    unlocked: false
  },
  {
    id: 'practice_warrior',
    name: 'Practice Warrior',
    description: 'Complete 10 practice sessions',
    icon: '🏆',
    count: 10,
    type: 'session_count',
    unlocked: false
  },
  {
    id: 'dedicated_practitioner',
    name: 'Dedicated Practitioner',
    description: 'Practice for a total of 1 hour',
    icon: '⏱️',
    duration: 3600, // segundos
    type: 'total_time',
    unlocked: false
  },
  {
    id: 'gamma_insight',
    name: 'Gamma Insight',
    description: 'Reach high Gamma activity (>0.4)',
    icon: '💡',
    threshold: 0.4,
    type: 'gamma_peak',
    unlocked: false
  },
  {
    id: 'meditation_master',
    name: 'Meditation State',
    description: 'Enter meditation state classification',
    icon: '🕉️',
    type: 'state_reached',
    targetState: 'meditation',
    unlocked: false
  }
]

export const usePracticeStore = create(
  persist(
    (set, get) => ({
      // --- ACHIEVEMENTS ---
      achievements: ACHIEVEMENTS,
      
      // --- TRACKING DE SUSTAINING ---
      // Para achievements que requieren mantener un valor por X segundos
      sustainedTrackers: {}, // { achievement_id: { startTime, currentDuration, isActive } }
      
      // --- ESTADÍSTICAS ---
      stats: {
        totalSessions: 0,
        totalPracticeTime: 0, // segundos
        highestCoherence: 0,
        highestAlpha: 0,
        highestTheta: 0,
        highestGamma: 0,
        statesReached: [] // ['meditation', 'focused', ...]
      },
      
      // --- SESIÓN ACTUAL ---
      currentSession: {
        isActive: false,
        startTime: null,
        duration: 0,
        targetCoherence: 0.7,
        peakCoherence: 0,
        averageCoherence: 0,
        coherenceSamples: []
      },
      
      // --- ACTIONS ---
      
      /**
       * Inicia sesión de práctica
       */
      startPracticeSession: (targetCoherence = 0.7) => {
        set({
          currentSession: {
            isActive: true,
            startTime: Date.now(),
            duration: 0,
            targetCoherence,
            peakCoherence: 0,
            averageCoherence: 0,
            coherenceSamples: []
          }
        })
      },
      
      /**
       * Finaliza sesión de práctica
       */
      endPracticeSession: () => {
        const { currentSession, stats } = get()
        
        if (!currentSession.isActive) return
        
        const sessionDuration = (Date.now() - currentSession.startTime) / 1000
        
        set({
          currentSession: {
            ...currentSession,
            isActive: false,
            duration: sessionDuration
          },
          stats: {
            ...stats,
            totalSessions: stats.totalSessions + 1,
            totalPracticeTime: stats.totalPracticeTime + sessionDuration
          },
          sustainedTrackers: {} // Reset trackers
        })
        
        // Check achievements que dependen de conteo de sesiones o tiempo total
        get().checkAchievements()
      },
      
      /**
       * Update en tiempo real durante sesión
       */
      updateSessionMetrics: (brainState) => {
        const { currentSession, sustainedTrackers } = get()
        
        if (!currentSession.isActive) return
        
        const coherence = brainState.coherence || 0
        const bands = brainState.bands || {}
        const state = brainState.state || 'transitioning'
        
        // Update session stats
        const samples = [...currentSession.coherenceSamples, coherence]
        const avgCoherence = samples.reduce((a, b) => a + b, 0) / samples.length
        
        set({
          currentSession: {
            ...currentSession,
            peakCoherence: Math.max(currentSession.peakCoherence, coherence),
            averageCoherence: avgCoherence,
            coherenceSamples: samples
          }
        })
        
        // Update global stats
        const { stats } = get()
        set({
          stats: {
            ...stats,
            highestCoherence: Math.max(stats.highestCoherence, coherence),
            highestAlpha: Math.max(stats.highestAlpha, bands.alpha || 0),
            highestTheta: Math.max(stats.highestTheta, bands.theta || 0),
            highestGamma: Math.max(stats.highestGamma, bands.gamma || 0),
            statesReached: stats.statesReached.includes(state) 
              ? stats.statesReached 
              : [...stats.statesReached, state]
          }
        })
        
        // Check achievements
        get().checkAchievements(brainState)
      },
      
      /**
       * Verifica y desbloquea achievements
       */
      checkAchievements: (brainState = null) => {
        const { achievements, stats, currentSession, sustainedTrackers } = get()
        const now = Date.now()
        
        const updatedAchievements = achievements.map(achievement => {
          // Ya desbloqueado
          if (achievement.unlocked) return achievement
          
          let shouldUnlock = false
          
          switch (achievement.type) {
            case 'coherence_peak':
              if (brainState && brainState.coherence >= achievement.threshold) {
                shouldUnlock = true
              }
              break
              
            case 'coherence_sustained':
              if (brainState && brainState.coherence >= achievement.threshold) {
                // Iniciar o continuar tracking
                if (!sustainedTrackers[achievement.id]) {
                  sustainedTrackers[achievement.id] = {
                    startTime: now,
                    currentDuration: 0,
                    isActive: true
                  }
                } else {
                  const elapsed = (now - sustainedTrackers[achievement.id].startTime) / 1000
                  sustainedTrackers[achievement.id].currentDuration = elapsed
                  
                  if (elapsed >= achievement.duration) {
                    shouldUnlock = true
                  }
                }
              } else {
                // Reset si cae debajo del threshold
                if (sustainedTrackers[achievement.id]) {
                  delete sustainedTrackers[achievement.id]
                }
              }
              break
              
            case 'alpha_sustained':
              if (brainState && brainState.bands?.alpha >= achievement.threshold) {
                if (!sustainedTrackers[achievement.id]) {
                  sustainedTrackers[achievement.id] = {
                    startTime: now,
                    currentDuration: 0,
                    isActive: true
                  }
                } else {
                  const elapsed = (now - sustainedTrackers[achievement.id].startTime) / 1000
                  sustainedTrackers[achievement.id].currentDuration = elapsed
                  
                  if (elapsed >= achievement.duration) {
                    shouldUnlock = true
                  }
                }
              } else {
                if (sustainedTrackers[achievement.id]) {
                  delete sustainedTrackers[achievement.id]
                }
              }
              break
              
            case 'theta_sustained':
              if (brainState && brainState.bands?.theta >= achievement.threshold) {
                if (!sustainedTrackers[achievement.id]) {
                  sustainedTrackers[achievement.id] = {
                    startTime: now,
                    currentDuration: 0,
                    isActive: true
                  }
                } else {
                  const elapsed = (now - sustainedTrackers[achievement.id].startTime) / 1000
                  sustainedTrackers[achievement.id].currentDuration = elapsed
                  
                  if (elapsed >= achievement.duration) {
                    shouldUnlock = true
                  }
                }
              } else {
                if (sustainedTrackers[achievement.id]) {
                  delete sustainedTrackers[achievement.id]
                }
              }
              break
              
            case 'gamma_peak':
              if (brainState && brainState.bands?.gamma >= achievement.threshold) {
                shouldUnlock = true
              }
              break
              
            case 'state_reached':
              if (brainState && brainState.state === achievement.targetState) {
                shouldUnlock = true
              }
              break
              
            case 'session_count':
              if (stats.totalSessions >= achievement.count) {
                shouldUnlock = true
              }
              break
              
            case 'total_time':
              if (stats.totalPracticeTime >= achievement.duration) {
                shouldUnlock = true
              }
              break
              
            default:
              break
          }
          
          if (shouldUnlock) {
            console.log(`🎉 Achievement unlocked: ${achievement.name}`)
            // Aquí podrías agregar sonido o animación
            return { ...achievement, unlocked: true, unlockedAt: now }
          }
          
          return achievement
        })
        
        set({ achievements: updatedAchievements, sustainedTrackers })
      },
      
      /**
       * Reset achievements (para testing)
       */
      resetAchievements: () => {
        set({
          achievements: ACHIEVEMENTS.map(a => ({ ...a, unlocked: false })),
          stats: {
            totalSessions: 0,
            totalPracticeTime: 0,
            highestCoherence: 0,
            highestAlpha: 0,
            highestTheta: 0,
            highestGamma: 0,
            statesReached: []
          },
          sustainedTrackers: {}
        })
      },
      
      /**
       * Obtener progreso de achievement activo
       */
      getAchievementProgress: (achievementId) => {
        const { sustainedTrackers } = get()
        const achievement = get().achievements.find(a => a.id === achievementId)
        
        if (!achievement || achievement.unlocked) return null
        
        // Si es tipo sustained y está activo
        if (sustainedTrackers[achievementId]) {
          const { currentDuration } = sustainedTrackers[achievementId]
          return {
            current: currentDuration,
            target: achievement.duration,
            percentage: (currentDuration / achievement.duration) * 100
          }
        }
        
        // Si es tipo count
        if (achievement.type === 'session_count') {
          return {
            current: get().stats.totalSessions,
            target: achievement.count,
            percentage: (get().stats.totalSessions / achievement.count) * 100
          }
        }
        
        // Si es tipo total_time
        if (achievement.type === 'total_time') {
          return {
            current: get().stats.totalPracticeTime,
            target: achievement.duration,
            percentage: (get().stats.totalPracticeTime / achievement.duration) * 100
          }
        }
        
        return null
      }
    }),
    {
      name: 'syntergic-practice-storage', // localStorage key
      partialize: (state) => ({
        achievements: state.achievements,
        stats: state.stats
      })
    }
  )
)
