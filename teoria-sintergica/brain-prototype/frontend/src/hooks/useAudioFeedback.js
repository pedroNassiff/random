import { useEffect, useRef, useState } from 'react'
import { useBrainStore } from '../store/brainStore'

/**
 * Hook para feedback auditivo binaural basado en coherencia inter-hemisférica
 * 
 * Funcionamiento:
 * - Oído izquierdo: frecuencia base
 * - Oído derecho: frecuencia base + offset (crea efecto binaural)
 * - El offset se ajusta según la coherencia (más coherencia = mayor diferencia)
 * 
 * Fundamento científico:
 * - Tonos binaurales pueden inducir estados de sincronización cerebral
 * - Frecuencias Alpha (8-13 Hz) asociadas con meditación y coherencia
 * - El cerebro "percibe" la diferencia entre los dos tonos
 */
export function useAudioFeedback() {
  const coherence = useBrainStore((state) => state.coherence)
  const bands = useBrainStore((state) => state.bands)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const audioContextRef = useRef(null)
  const leftOscillatorRef = useRef(null)
  const rightOscillatorRef = useRef(null)
  const leftGainRef = useRef(null)
  const rightGainRef = useRef(null)
  const pannerLeftRef = useRef(null)
  const pannerRightRef = useRef(null)

  // Inicializar contexto de audio (solo una vez)
  useEffect(() => {
    // Crear AudioContext (compatible con Safari)
    const AudioContext = window.AudioContext || window.webkitAudioContext
    audioContextRef.current = new AudioContext()

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Actualizar frecuencias según coherencia
  useEffect(() => {
    if (!isPlaying || !leftOscillatorRef.current || !rightOscillatorRef.current) return

    // Frecuencia base ajustada por banda Alpha (estado sintérgico)
    const alphaInfluence = bands?.alpha || 0
    const baseFrequency = 200 + (alphaInfluence * 100) // 200-300 Hz

    // Offset binaural basado en coherencia
    // Alta coherencia = mayor diferencia = efecto binaural más fuerte
    const binauralOffset = 5 + (coherence * 15) // 5-20 Hz de diferencia

    // Aplicar frecuencias
    leftOscillatorRef.current.frequency.setTargetAtTime(
      baseFrequency,
      audioContextRef.current.currentTime,
      0.1 // Suavizar transición
    )

    rightOscillatorRef.current.frequency.setTargetAtTime(
      baseFrequency + binauralOffset,
      audioContextRef.current.currentTime,
      0.1
    )

    // Volumen también responde a coherencia (más coherencia = más volumen)
    const volume = 0.05 + (coherence * 0.15) // 0.05-0.20 (suave)
    leftGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current.currentTime, 0.1)
    rightGainRef.current.gain.setTargetAtTime(volume, audioContextRef.current.currentTime, 0.1)

  }, [coherence, bands, isPlaying])

  const startAudio = () => {
    if (!audioContextRef.current) return

    const ctx = audioContextRef.current

    // Reanudar contexto si está suspendido (requerimiento de navegadores)
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    // Crear osciladores (generadores de tono)
    const leftOsc = ctx.createOscillator()
    const rightOsc = ctx.createOscillator()
    
    leftOsc.type = 'sine' // Onda sinusoidal pura (más suave)
    rightOsc.type = 'sine'

    // Crear nodos de ganancia (volumen)
    const leftGain = ctx.createGain()
    const rightGain = ctx.createGain()
    
    leftGain.gain.value = 0.1
    rightGain.gain.value = 0.1

    // Crear panners para separación estéreo
    const pannerLeft = ctx.createStereoPanner()
    const pannerRight = ctx.createStereoPanner()
    
    pannerLeft.pan.value = -1 // Completamente a la izquierda
    pannerRight.pan.value = 1  // Completamente a la derecha

    // Conectar el grafo de audio
    // leftOsc -> leftGain -> pannerLeft -> destination
    leftOsc.connect(leftGain)
    leftGain.connect(pannerLeft)
    pannerLeft.connect(ctx.destination)

    // rightOsc -> rightGain -> pannerRight -> destination
    rightOsc.connect(rightGain)
    rightGain.connect(pannerRight)
    pannerRight.connect(ctx.destination)

    // Iniciar osciladores
    leftOsc.start()
    rightOsc.start()

    // Guardar referencias
    leftOscillatorRef.current = leftOsc
    rightOscillatorRef.current = rightOsc
    leftGainRef.current = leftGain
    rightGainRef.current = rightGain
    pannerLeftRef.current = pannerLeft
    pannerRightRef.current = pannerRight

    setIsPlaying(true)
  }

  const stopAudio = () => {
    if (leftOscillatorRef.current) {
      leftOscillatorRef.current.stop()
      leftOscillatorRef.current = null
    }

    if (rightOscillatorRef.current) {
      rightOscillatorRef.current.stop()
      rightOscillatorRef.current = null
    }

    setIsPlaying(false)
  }

  const toggleAudio = () => {
    if (isPlaying) {
      stopAudio()
    } else {
      startAudio()
    }
  }

  return {
    isPlaying,
    toggleAudio,
    startAudio,
    stopAudio
  }
}
