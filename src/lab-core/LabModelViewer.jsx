import React, { Suspense, useState, useRef, useEffect, memo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// Importar componentes directamente (lazy no funciona bien dentro de R3F Canvas)
import BrainModel from './brain/BrainModel'
import GalaxyModel from './galaxy/GalaxyModel'
import TesseractModel from './tesseract/TesseractModel'
import RetratatarteModel from './retratarte/RetratatarteModel'

import { getExperiment } from './index'

// Mapa de componentes por ID
const EXPERIMENT_COMPONENTS = {
  brain: BrainModel,
  galaxy: GalaxyModel,
  tesseract: TesseractModel,
  retratarte: RetratatarteModel
}

/**
 * LabModelViewer - Componente optimizado para rendimiento
 */
const LabModelViewer = memo(function LabModelViewer({ 
  experimentId,
  interactive = true,
  showLabel = true,
  onClick,
  className = ''
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const containerRef = useRef(null)
  const hoverTimeoutRef = useRef(null)
  
  const experiment = getExperiment(experimentId)
  const ExperimentComponent = EXPERIMENT_COMPONENTS[experimentId]

  // Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
        if (entry.isIntersecting && !hasLoaded) {
          setHasLoaded(true)
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px'
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [hasLoaded])

  // Throttled hover handlers
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 50)
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])
  
  if (!experiment || !ExperimentComponent) {
    console.warn(`Experiment "${experimentId}" not found`)
    return null
  }

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {hasLoaded && (
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
          }}
          dpr={[1, 1.5]}
          frameloop={isVisible ? 'always' : 'demand'}
          performance={{ min: 0.5 }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <ambientLight intensity={0.3} />
          
          {interactive && (
            <OrbitControls 
              enableZoom={false} 
              enablePan={false}
              enableDamping={false}
            />
          )}
          
          <Suspense fallback={null}>
            <ExperimentComponent 
              scale={1.2}
              position={[0, 0, 0]}
              autoRotate={true}
              hovered={isHovered}
              onClick={onClick}
              isVisible={isVisible}
            />
          </Suspense>
        </Canvas>
      )}

      {!hasLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] rounded-xl">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      )}

      {showLabel && (
        <div 
          className={`
            absolute bottom-4 left-4 right-4 pointer-events-none
            transition-opacity duration-200
            ${isHovered ? 'opacity-100' : 'opacity-0'}
          `}
        >
          <h4 className="text-white text-lg font-semibold tracking-wide">
            {experiment.name}
          </h4>
          <p className="text-white/60 text-sm">
            {experiment.description}
          </p>
        </div>
      )}

      <div 
        className={`
          absolute inset-0 pointer-events-none rounded-2xl
          border-2 transition-colors duration-200
          ${isHovered ? 'border-white/30' : 'border-transparent'}
        `} 
      />
    </div>
  )
})

export default LabModelViewer
