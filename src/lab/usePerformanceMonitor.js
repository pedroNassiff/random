import { useState, useEffect, useRef } from 'react'

/**
 * usePerformanceMonitor - Hook para detectar problemas de rendimiento
 * 
 * Uso:
 * const { fps, isLowPerformance, quality } = usePerformanceMonitor()
 * 
 * quality: 'high' | 'medium' | 'low'
 */
export function usePerformanceMonitor(options = {}) {
  const { 
    sampleSize = 60, // Cantidad de frames para calcular FPS
    lowFpsThreshold = 30,
    mediumFpsThreshold = 45
  } = options

  const [fps, setFps] = useState(60)
  const [quality, setQuality] = useState('high')
  
  const frameTimesRef = useRef([])
  const lastTimeRef = useRef(performance.now())
  const rafRef = useRef(null)

  useEffect(() => {
    const measureFps = () => {
      const now = performance.now()
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      frameTimesRef.current.push(delta)
      
      // Mantener solo los últimos N frames
      if (frameTimesRef.current.length > sampleSize) {
        frameTimesRef.current.shift()
      }

      // Calcular FPS promedio cada 30 frames
      if (frameTimesRef.current.length >= 30 && frameTimesRef.current.length % 30 === 0) {
        const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
        const currentFps = Math.round(1000 / avgDelta)
        
        setFps(currentFps)
        
        // Determinar calidad
        if (currentFps < lowFpsThreshold) {
          setQuality('low')
        } else if (currentFps < mediumFpsThreshold) {
          setQuality('medium')
        } else {
          setQuality('high')
        }
      }

      rafRef.current = requestAnimationFrame(measureFps)
    }

    rafRef.current = requestAnimationFrame(measureFps)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [sampleSize, lowFpsThreshold, mediumFpsThreshold])

  return {
    fps,
    quality,
    isLowPerformance: quality === 'low',
    isMediumPerformance: quality === 'medium',
    isHighPerformance: quality === 'high'
  }
}

/**
 * Configuraciones de calidad para diferentes niveles de rendimiento
 */
export const QUALITY_SETTINGS = {
  high: {
    particleCount: 25000,
    geometrySegments: 32,
    dpr: [1, 2],
    shadows: true
  },
  medium: {
    particleCount: 15000,
    geometrySegments: 16,
    dpr: [1, 1.5],
    shadows: false
  },
  low: {
    particleCount: 8000,
    geometrySegments: 8,
    dpr: [1, 1],
    shadows: false
  }
}

export default usePerformanceMonitor
