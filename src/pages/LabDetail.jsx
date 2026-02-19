import React, { Suspense, useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageTracking, useEventTracking } from '../lib/useAnalytics.jsx'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import HolographicModel from '../components/HolographicModel'
import TesseractModel from '../lab-core/tesseract/TesseractModel'
import GalaxyModel from '../lab-core/galaxy/GalaxyModel'
import RetratarteDetail from './RetratarteDetail'
import BrainDetail from './BrainDetail'

// ─────────────────────────────────────────────
// Config full-screen por experimento
// Camera ligeramente más cerca que en la card → llena bien el viewport
// ─────────────────────────────────────────────
const DETAIL_CONFIG = {
  holographic: {
    name: 'HOLOGRAPHIC',
    Component: HolographicModel,
    camera: { position: [0, 0.5, 7], fov: 44 },
    model: { scale: 0.17, position: [0, -1.5, 0], autoRotate: true, opacity: 0.9 },
    bg: '#000308',
    lights: [
      { type: 'ambient', intensity: 0.3 },
      { type: 'point', pos: [2, 3, 2], intensity: 2.2, color: '#70c1ff' },
      { type: 'point', pos: [-2, -1, 1], intensity: 0.8, color: '#3040ff' },
    ],
    desc: 'Human form, rendered in light.',
    tags: ['glitch', 'shaders', 'chakras'],
  },
  tesseract: {
    name: 'TESSERACT',
    Component: TesseractModel,
    camera: { position: [0, 0.3, 2.8], fov: 38 },
    model: { scale: 0.5, position: [0, 0, 0], autoRotate: true, opacity: 1 },
    bg: '#020201',
    lights: [
      { type: 'ambient', intensity: 0.4 },
      { type: 'point', pos: [3, 3, 3], intensity: 1.2, color: '#FFD700' },
    ],
    desc: '4D hypercube projected into 3-space.',
    tags: ['4D geometry', 'projection', 'shaders'],
  },
  galaxy: {
    name: 'GALAXY',
    Component: GalaxyModel,
    camera: { position: [0, 3, 6], fov: 52 },
    model: { scale: 2, position: [0, 0, 0], autoRotate: true, opacity: 1 },
    bg: '#000005',
    lights: [
      { type: 'ambient', intensity: 0.1 },
    ],
    desc: '25,000 particles in orbit.',
    tags: ['25k particles', 'noise field', 'orbit'],
  },
}

// Placeholders para los complejos
const PLACEHOLDER_IDS = []

// ─────────────────────────────────────────────
// Lights helper
// ─────────────────────────────────────────────
function SceneLights({ lights }) {
  return lights.map((l, i) =>
    l.type === 'ambient'
      ? <ambientLight key={i} intensity={l.intensity} />
      : <pointLight key={i} position={l.pos} intensity={l.intensity} color={l.color} />
  )
}

// ─────────────────────────────────────────────
// Custom cursor (igual que en Lab.jsx)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Placeholder page para experimentos en desarrollo
// ─────────────────────────────────────────────
function ComingSoon({ id, onBack }) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center" style={{ cursor: 'none' }}>
      <CustomCursor />
      <p className="text-white/20 text-[10px] tracking-[0.5em] uppercase font-mono mb-6">.RANDOM() / LAB</p>
      <h1 className="text-white text-2xl tracking-[0.3em] uppercase font-mono mb-3">{id.toUpperCase()}</h1>
      <p className="text-white/30 text-[11px] tracking-[0.3em] uppercase font-mono">In development</p>

      <button
        onClick={onBack}
        className="fixed top-8 left-8 text-white/40 hover:text-white text-[10px] tracking-[0.4em] uppercase font-mono transition-colors duration-200"
        style={{ cursor: 'none' }}
      >
        ← Back
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// LabDetail — full screen experiment viewer
// ─────────────────────────────────────────────
export default function LabDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [hint, setHint] = useState(true)
  usePageTracking(`lab/${id}`);
  const { trackClick } = useEventTracking();

  const back = () => {
    trackClick('lab_back_click', id);
    navigate('/lab');
  }

  // Ocultar el drag hint tras 3s
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 3000)
    return () => clearTimeout(t)
  }, [])

  // Retratarte tiene su propio viewer
  if (id === 'retratarte') return <RetratarteDetail />

  // Brain viewer — WebSocket to Syntergic VAE
  if (id === 'brain') return <BrainDetail />

  // Placeholder (none currently)
  if (PLACEHOLDER_IDS.includes(id)) return <ComingSoon id={id} onBack={back} />

  const config = DETAIL_CONFIG[id]
  if (!config) {
    navigate('/lab', { replace: true })
    return null
  }

  const { name, Component, camera, model, lights, bg, desc } = config

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      <CustomCursor />

      {/* Full screen canvas */}
      <Canvas
        camera={{ position: camera.position, fov: camera.fov, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bg]} />
        <SceneLights lights={lights} />

        <Suspense fallback={null}>
          <Component
            scale={model.scale}
            position={model.position}
            autoRotate={model.autoRotate}
            opacity={model.opacity ?? 1}
            wireframe={model.wireframe ?? false}
            hovered={false}
            isVisible={true}
          />
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={1}
          maxDistance={30}
        />
      </Canvas>

      {/* Back button */}
      <button
        onClick={back}
        className="fixed top-8 left-8 z-50 text-white/40 hover:text-white text-[14px] tracking-[0.4em] uppercase font-mono transition-colors duration-200"
        style={{ cursor: 'none' }}
      >
        ← Back
      </button>

      {/* Experiment name — top center */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center">
        <p className="text-white/20 text-[10px] tracking-[0.5em] uppercase font-mono">.RANDOM() / LAB</p>
        <p className="text-white/60 text-[12px] tracking-[0.4em] uppercase font-mono mt-1">{name}</p>
      </div>

      {/* Description + tags — bottom center */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center space-y-2">
        <p className="text-white/75 text-[12px] tracking-[0.3em] uppercase font-mono">{desc}</p>
        {config.tags?.length > 0 && (
          <div className="flex justify-center gap-2">
            {config.tags.map(tag => (
              <span key={tag} className="text-white/65 text-[10px] tracking-[0.3em] uppercase font-mono border border-white/10 px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Drag hint */}
      <div
        className="fixed bottom-8 right-8 z-50 pointer-events-none transition-opacity duration-700"
        style={{ opacity: hint ? 0.4 : 0 }}
      >
        <p className="text-white text-[8px] tracking-[0.35em] uppercase font-mono">Drag to explore</p>
      </div>
    </div>
  )
}
