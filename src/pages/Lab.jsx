import React, { Suspense, useState, useRef, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { usePageTracking, useConversionTracking, useEventTracking } from '../lib/useAnalytics.jsx'

// Models — import directos para uso dentro de Canvas
import HolographicModel from '../components/HolographicModel'
import BrainModel from '../lab-core/brain/BrainModel'
import GalaxyModel from '../lab-core/galaxy/GalaxyModel'
import TesseractModel from '../lab-core/tesseract/TesseractModel'
import RetratatarteModel from '../lab-core/retratarte/RetratatarteModel'

// ─────────────────────────────────────────────
// EXPERIMENTS — config completo por experimento
// camera más alejada → modelos caben enteros dentro del cuadrado
// ─────────────────────────────────────────────
const EXPERIMENTS = [
  {
    id: 'brain',
    name: 'HERMES',
    Component: BrainModel,
    camera: { position: [0, 0, 7], fov: 32 },
    model: { scale: 1.5, position: [0, 0, 0], autoRotate: true, opacity: 1, wireframe: true },
    bg: '#00050a',
    tags: ['wireframe', 'neural mesh', 'EEG'],
    lights: [
      { type: 'ambient', intensity: 0.2 },
      { type: 'point', pos: [3, 3, 3], intensity: 1.8, color: '#00E5FF' },
      { type: 'point', pos: [-3, -2, 1], intensity: 0.7, color: '#E040FB' },
    ],
  },
  {
    id: 'tesseract',
    name: 'TESSERACT',
    Component: TesseractModel,
    camera: { position: [0, 0.3, 3.2], fov: 34 },
    model: { scale: 0.5, position: [0, 0, 0], autoRotate: true, opacity: 1 },
    bg: '#020201',
    tags: ['4D geometry', 'projection', 'shaders'],
    lights: [
      { type: 'ambient', intensity: 0.4 },
      { type: 'point', pos: [3, 3, 3], intensity: 1.2, color: '#FFD700' },
    ],
  },
  {
    id: 'holographic',
    name: 'HOLOGRAPHIC',
    Component: HolographicModel,
    camera: { position: [0, 0.5, 9], fov: 40 },
    model: { scale: 0.20, position: [0, -1.7, 0], autoRotate: true, opacity: 0.9 },
    bg: '#000308',
    tags: ['glitch', 'shaders', 'chakras'],
    lights: [
      { type: 'ambient', intensity: 0.3 },
      { type: 'point', pos: [2, 3, 2], intensity: 2.2, color: '#70c1ff' },
      { type: 'point', pos: [-2, -1, 1], intensity: 0.8, color: '#3040ff' },
    ],
  },
  {
    id: 'retratarte',
    name: 'RETRATARTE',
    Component: RetratatarteModel,
    camera: { position: [0, 0, 3.2], fov: 36 },
    model: { scale: 0.9, position: [0, 0, 0], autoRotate: false, opacity: 1 },
    bg: '#050200',
    tags: ['face tracking', 'audio reactive', 'GLSL'],
    lights: [
      { type: 'ambient', intensity: 0.5 },
      { type: 'point', pos: [2, 2, 2], intensity: 1.2, color: '#FFD700' },
    ],
  },
  {
    id: 'galaxy',
    name: 'GALAXY',
    Component: GalaxyModel,
    camera: { position: [0, 3.5, 7], fov: 48 },
    model: { scale: 2, position: [0, 0, 0], autoRotate: true, opacity: 1 },
    bg: '#000005',
    tags: ['25k particles', 'noise field', 'orbit'],
    lights: [
      { type: 'ambient', intensity: 0.1 },
    ],
  },
]

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
// ExperimentCanvas — canvas directo con config tuneada por experimento
// ─────────────────────────────────────────────
const ExperimentCanvas = memo(function ExperimentCanvas({ exp, isHovered, inView }) {
  const { Component, camera, model, lights, bg } = exp
  return (
    <Canvas
      camera={{ position: camera.position, fov: camera.fov, near: 0.01, far: 100 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false }}
      dpr={[1, 1.5]}
      frameloop={inView ? 'always' : 'demand'}
      performance={{ min: 0.5 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
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
          hovered={isHovered}
          isVisible={inView}
        />
      </Suspense>

      {isHovered && (
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
        />
      )}
    </Canvas>
  )
})

// ─────────────────────────────────────────────
// ExperimentSlot — un experimento sin marco
// ─────────────────────────────────────────────
const ExperimentSlot = memo(function ExperimentSlot({ exp, itemIndex }) {
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const { trackClick } = useEventTracking()
  const [inView, setInView] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setInView(true); setLoaded(true) }
        else setInView(false)
      },
      { threshold: 0.05, rootMargin: '250px' }
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={containerRef}
      className="relative group"
      data-lab-item={itemIndex}
      style={{ width: '100%', aspectRatio: '1 / 1', cursor: 'none' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onClick={() => {
        trackClick('lab_experiment_click', exp.id);
        navigate(`/lab/${exp.id}`);
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        {loaded && <ExperimentCanvas exp={exp} isHovered={isHovered} inView={inView} />}
      </div>

      {/* Label que sigue al cursor dentro del contenedor */}
      <div
        className="pointer-events-none absolute z-20 transition-opacity duration-200"
        style={{
          left: mousePos.x + 14,
          top: mousePos.y - 10,
          opacity: isHovered ? 1 : 0,
          whiteSpace: 'nowrap',
        }}
      >
        <span className="text-white/70 text-[9px] tracking-[0.3em] uppercase font-mono">
          {exp.name}
        </span>
      </div>

    </div>
  )
})

// ─────────────────────────────────────────────
// CustomCursor — cursor global que sigue el mouse
// ─────────────────────────────────────────────
function CustomCursor() {
  const cursorRef = useRef(null)
  const pos = useRef({ x: -100, y: -100 })
  const raf = useRef(null)

  useEffect(() => {
    const onMove = (e) => { pos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)

    const tick = () => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${pos.current.x - 6}px, ${pos.current.y - 6}px)`
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <div
      ref={cursorRef}
      className="pointer-events-none fixed top-0 left-0 z-[9999] mix-blend-difference"
      style={{ willChange: 'transform' }}
    >
      {/* Círculo pequeño estilo sileent */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#ffffff',
        }}
      />
    </div>
  )
}

export default function Lab() {
  usePageTracking('lab');
  const { trackLabVisit } = useConversionTracking();

  useEffect(() => {
    trackLabVisit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <CustomCursor />
      <Navbar />

      {/*
        Sileent-style: cuadrados compactos centrados.
        Desktop: fila de 5 cuadrados (max ~220px cada uno) centrados en pantalla.
        Mobile: 2 columnas, scroll vertical.
        Footer debajo del fold — requiere scroll.
      */}
      <section className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 24px', cursor: 'none' }}>
        {/*
          Mobile: columna única, stack vertical.
          Desktop: 5 cols × 2 filas, items en zigzag:
            col1→row1, col2→row2, col3→row1, col4→row2, col5→row1
        */}
        <style>{`
          @media (min-width: 768px) {
            #lab-grid {
              grid-template-columns: repeat(5, 1fr);
              grid-template-rows: repeat(2, auto);
            }
            #lab-grid [data-lab-item="0"] { grid-column: 1; grid-row: 1; }
            #lab-grid [data-lab-item="1"] { grid-column: 2; grid-row: 2; }
            #lab-grid [data-lab-item="2"] { grid-column: 3; grid-row: 1; }
            #lab-grid [data-lab-item="3"] { grid-column: 4; grid-row: 2; }
            #lab-grid [data-lab-item="4"] { grid-column: 5; grid-row: 1; }
          }
        `}</style>
        <div
          id="lab-grid"
          className="grid grid-cols-1 gap-3"
          style={{ width: '100%', maxWidth: '1160px' }}
        >
          {EXPERIMENTS.map((exp, i) => (
            <ExperimentSlot key={exp.id} exp={exp} itemIndex={i} />
          ))}
        </div>
      </section>

      {/* <Footer /> */}
    </div>
  )
}
