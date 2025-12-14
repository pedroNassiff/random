/**
 * Hook para reproducción de meditaciones guiadas
 * 
 * Gestiona:
 * - Carga de audio
 * - Play/Pause/Stop
 * - Volumen
 * - Sincronización con sesión de práctica
 */

import { useState, useEffect, useRef } from 'react'

// Catálogo de meditaciones disponibles
export const GUIDED_MEDITATIONS = [
  {
    id: 'none',
    name: 'Sin guía',
    description: 'Práctica en silencio',
    duration: null,
    audioUrl: null
  },
  {
    id: 'vipassana',
    name: 'Vipassana',
    description: 'Observación ecuánime de sensaciones corporales',
    duration: 600, // 10 minutos
    audioUrl: '/audio/meditations/vipassana.mp3',
    instructor: 'Jacobo Grinberg'
  },
  {
    id: 'samadhi',
    name: 'Samadhi',
    description: 'Concentración en un punto focal',
    duration: 480, // 8 minutos
    audioUrl: '/audio/meditations/samadhi.mp3',
    instructor: 'Jacobo Grinberg'
  }
]

export const useGuidedMeditation = () => {
  const [selectedMeditation, setSelectedMeditation] = useState(GUIDED_MEDITATIONS[0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  
  const audioRef = useRef(null)
  const animationFrameRef = useRef(null)
  
  // Inicializar audio element
  useEffect(() => {
    if (selectedMeditation.audioUrl) {
      audioRef.current = new Audio(selectedMeditation.audioUrl)
      audioRef.current.volume = volume
      
      // Event listeners
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current.duration)
      })
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
        setCurrentTime(0)
      })
      
      audioRef.current.addEventListener('error', (e) => {
        console.error('Error loading meditation audio:', e)
      })
      
      return () => {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.src = ''
        }
      }
    }
  }, [selectedMeditation])
  
  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])
  
  // Track playback time
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      const updateTime = () => {
        setCurrentTime(audioRef.current.currentTime)
        animationFrameRef.current = requestAnimationFrame(updateTime)
      }
      animationFrameRef.current = requestAnimationFrame(updateTime)
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isPlaying])
  
  const play = () => {
    if (audioRef.current && selectedMeditation.audioUrl) {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }
  
  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }
  
  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }
  
  const seek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }
  
  const selectMeditation = (meditationId) => {
    stop() // Detener audio actual
    const meditation = GUIDED_MEDITATIONS.find(m => m.id === meditationId)
    if (meditation) {
      setSelectedMeditation(meditation)
    }
  }
  
  return {
    selectedMeditation,
    selectMeditation,
    isPlaying,
    play,
    pause,
    stop,
    volume,
    setVolume,
    currentTime,
    duration,
    seek,
    availableMeditations: GUIDED_MEDITATIONS
  }
}
