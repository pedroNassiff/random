import React, { Suspense, useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { usePageTracking } from '../lib/useAnalytics.jsx'
import PanspermiaGame from '../lab-core/games/panspermia/PanspermiaGame'
import { useGameStore } from '../lab-core/engine/GameStore'

// Custom cursor — mismo patrón que LabDetail/Lab
function CustomCursor() {
  const ref = useRef(null)
  const pos = useRef({ x: -100, y: -100 })
  const raf = useRef(null)

  useEffect(() => {
    const move = (e) => { pos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', move)
    const tick = () => {
      if (ref.current) ref.current.style.transform = `translate(${pos.current.x - 6}px, ${pos.current.y - 6}px)`
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', move); cancelAnimationFrame(raf.current) }
  }, [])

  return (
    <div ref={ref} className="pointer-events-none fixed top-0 left-0 z-[9999] mix-blend-difference" style={{ willChange: 'transform' }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffffff' }} />
    </div>
  )
}

// HUD de dev — cambio manual de escena mientras no existe el flujo real
// (viaje por galaxia / descenso). Se saca cuando Fase 4 cierre el loop.
function DevSceneHud() {
  const currentScene = useGameStore((s) => s.currentScene)
  const setScene = useGameStore((s) => s.setScene)
  const resetProgress = useGameStore((s) => s.resetProgress)

  const scenes = [
    { id: 'nexus', label: 'Nexus' },
    { id: 'galaxy-travel', label: 'Galaxy Travel' },
    { id: 'planet-surface', label: 'Planet Surface' },
    { id: 'planet-test', label: 'Planet Test' },
  ]

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
      <p className="text-white/20 text-[9px] tracking-[0.4em] uppercase font-mono">dev · scene</p>
      <div className="flex gap-2" style={{ cursor: 'none' }}>
        {scenes.map((s) => (
          <button
            key={s.id}
            onClick={() => setScene(s.id)}
            className={`text-[10px] tracking-[0.2em] uppercase font-mono px-3 py-1.5 border transition-colors duration-200 ${
              currentScene === s.id
                ? 'border-white/60 text-white'
                : 'border-white/15 text-white/40 hover:text-white/70 hover:border-white/30'
            }`}
            style={{ cursor: 'none' }}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={resetProgress}
          className="text-[10px] tracking-[0.2em] uppercase font-mono px-3 py-1.5 border border-white/15 text-white/30 hover:text-white/60 hover:border-white/30 transition-colors duration-200"
          style={{ cursor: 'none' }}
        >
          reset
        </button>
      </div>
    </div>
  )
}

export default function PanspermiaDetail() {
  const navigate = useNavigate()
  usePageTracking('lab/panspermia')
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 4000)
    return () => clearTimeout(t)
  }, [])

  const back = () => navigate('/lab')

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      <CustomCursor />

      <Canvas
        camera={{ position: [0, 0.5, 3.5], fov: 42, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        frameloop="always"
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#000308']} />
        <ambientLight intensity={0.3} />
        <pointLight position={[2, 3, 2]} intensity={1.6} color="#70c1ff" />
        <pointLight position={[-2, -1, 1]} intensity={0.6} color="#3040ff" />

        <Suspense fallback={null}>
          <PanspermiaGame />
        </Suspense>

        <OrbitControls
          enableZoom
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={1.5}
          maxDistance={20}
        />
      </Canvas>

      <button
        onClick={back}
        className="fixed top-8 left-8 z-50 text-white/40 hover:text-white text-[14px] tracking-[0.4em] uppercase font-mono transition-colors duration-200"
        style={{ cursor: 'none' }}
      >
        ← Back
      </button>

      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center">
        <p className="text-white/20 text-[14px] tracking-[0.5em] uppercase font-mono">.RANDOM() / LAB</p>
        <p className="text-white/60 text-[14px] tracking-[0.4em] uppercase font-mono mt-1">PANSPERMIA</p>
      </div>

      {hint && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center">
          <p className="text-white/30 text-[10px] tracking-[0.3em] uppercase font-mono">
            in development — engine scaffold
          </p>
        </div>
      )}

      <DevSceneHud />
    </div>
  )
}
