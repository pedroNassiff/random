import React, { useState, useRef, useEffect, memo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { getExperiment, EXPERIMENT_IDS } from './index'

// Importar el HolographicModel del hero
import HolographicModel from '../components/HolographicModel'

/**
 * ExperimentCard - Tarjeta individual para cada experimento
 */
const ExperimentCard = memo(function ExperimentCard({ 
  experimentId, 
  onHover,
  isGlobalHovered 
}) {
  const [isHovered, setIsHovered] = useState(false)
  const experiment = getExperiment(experimentId)
  
  if (!experiment) return null
  
  const ExperimentComponent = experiment.component

  const handleMouseEnter = () => {
    setIsHovered(true)
    onHover(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    onHover(false)
  }

  return (
    <div 
      className="relative w-[350px] h-[400px] flex-shrink-0 mx-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-full h-full rounded-2xl overflow-hidden bg-[#0a0a0a]">
        <Canvas
          camera={{ position: [0, 0, 3], fov: 50 }}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false
          }}
          dpr={[1, 1.5]}
          frameloop="always"
        >
          <color attach="background" args={['#0a0a0a']} />
          <ambientLight intensity={0.3} />
          
          <OrbitControls 
            enableZoom={false} 
            enablePan={false}
            enableDamping={false}
          />
          
          <Suspense fallback={null}>
            <ExperimentComponent 
              scale={1.2}
              position={[0, 0, 0]}
              autoRotate={true}
              hovered={isHovered}
              isVisible={true}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Label overlay */}
      <div 
        className={`
          absolute bottom-4 left-4 right-4 pointer-events-none
          transition-opacity duration-300
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

      {/* Hover border */}
      <div 
        className={`
          absolute inset-0 pointer-events-none rounded-2xl
          border-2 transition-all duration-300
          ${isHovered ? 'border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'border-transparent'}
        `} 
      />
    </div>
  )
})

/**
 * HolographicCard - Tarjeta para el modelo holográfico del hero
 */
const HolographicCard = memo(function HolographicCard({ onHover }) {
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => {
    setIsHovered(true)
    onHover(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    onHover(false)
  }

  return (
    <div 
      className="relative w-[350px] h-[400px] flex-shrink-0 mx-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-full h-full rounded-2xl overflow-hidden bg-[#0a0a0a]">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ 
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false
          }}
          dpr={[1, 1.5]}
          frameloop="always"
        >
          <color attach="background" args={['#0a0a0a']} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          
          <OrbitControls 
            enableZoom={false} 
            enablePan={false}
            enableDamping={false}
          />
          
          <HolographicModel 
            scale={isHovered ? 2.2 : 2}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            autoRotate={true}
          />
        </Canvas>
      </div>

      {/* Label overlay */}
      <div 
        className={`
          absolute bottom-4 left-4 right-4 pointer-events-none
          transition-opacity duration-300
          ${isHovered ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <h4 className="text-white text-lg font-semibold tracking-wide">
          HOLOGRAPHIC
        </h4>
        <p className="text-white/60 text-sm">
          Interactive 3D visualization
        </p>
      </div>

      {/* Hover border */}
      <div 
        className={`
          absolute inset-0 pointer-events-none rounded-2xl
          border-2 transition-all duration-300
          ${isHovered ? 'border-white/40 shadow-[0_0_30px_rgba(255,255,255,0.1)]' : 'border-transparent'}
        `} 
      />
    </div>
  )
})

/**
 * LabCarousel - Carrusel infinito de experimentos del Lab
 */
export default function LabCarousel({ speed = 30 }) {
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef(null)
  
  // Lista completa de experimentos (incluyendo holographic)
  const allItems = ['holographic', ...EXPERIMENT_IDS]
  
  // Duplicar para el loop infinito
  const items = [...allItems, ...allItems]

  const handleItemHover = (isHovering) => {
    setIsPaused(isHovering)
  }

  return (
    <div className="bg-[#0a0a0a] rounded-3xl p-8 overflow-hidden">
      <div 
        ref={containerRef}
        className="relative overflow-hidden"
      >
        <div 
          className="flex"
          style={{
            animation: `labScroll ${speed}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running'
          }}
        >
          {items.map((itemId, index) => (
            itemId === 'holographic' ? (
              <HolographicCard 
                key={`holographic-${index}`}
                onHover={handleItemHover}
              />
            ) : (
              <ExperimentCard 
                key={`${itemId}-${index}`}
                experimentId={itemId}
                onHover={handleItemHover}
                isGlobalHovered={isPaused}
              />
            )
          ))}
        </div>
      </div>

      <style>{`
        @keyframes labScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
