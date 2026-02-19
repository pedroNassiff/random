/**
 * BrainDetail — /lab/brain  (HERMES)
 *
 * Full feature parity with brain-prototype:
 *  - Live 3D SyntergicBrain (R3F) fed by Zustand store
 *  - Right sidebar: StateIndicator, FrequencySpectrum, CoherenceMeter, AudioControl
 *  - Bottom panel: SessionControl (dataset replay) or MuseControl (live EEG)
 *  - Source tabs: Dataset | Muse 2
 *  - WebSocket: wss://api.random-lab.es (via Zustand store)
 */

import React, { Suspense, useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'

import { useBrainStore }     from '../lab-core/brain/store'
import { SyntergicBrain }    from '../lab-core/brain/SyntergicBrain'
import { FrequencySpectrum } from '../lab-core/brain/hud/FrequencySpectrum'
import { CoherenceMeter }    from '../lab-core/brain/hud/CoherenceMeter'
import { StateIndicator }    from '../lab-core/brain/hud/StateIndicator'
import { AudioControl }      from '../lab-core/brain/hud/AudioControl'
import SessionControl        from '../lab-core/brain/hud/SessionControl'
import MuseControl           from '../lab-core/brain/hud/MuseControl'

// Bridge: reads Zustand store every frame and updates brainStateRef for R3F
function BrainBridge({ brainStateRef }) {
  useFrame(() => {
    const s = useBrainStore.getState()
    brainStateRef.current = {
      coherence:  s.coherence  || 0,
      focalPoint: s.focalPoint || { x: 0, y: 0, z: 0 },
      bands:      s.bands      || { delta: 0.1, theta: 0.1, alpha: 0.1, beta: 0.1, gamma: 0.1 },
    }
  })
  return null
}

// ─────────────────────────────────────────────
// Custom cursor
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Custom cursor
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
// BrainDetail
// ─────────────────────────────────────────────
export default function BrainDetail() {
  const navigate            = useNavigate()
  const connectToField      = useBrainStore((s) => s.connectToField)
  const disconnectFromField = useBrainStore((s) => s.disconnectFromField)

  const [dataSource, setDataSource] = useState('dataset') // 'dataset' | 'muse'

  // Ref for SyntergicBrain — updated each frame by BrainBridge
  const brainStateRef = useRef({
    coherence:  0,
    focalPoint: { x: 0, y: 0, z: 0 },
    bands:      { delta: 0.1, theta: 0.1, alpha: 0.1, beta: 0.1, gamma: 0.1 },
  })

  // Connect to backend WebSocket on mount
  useEffect(() => {
    connectToField()
    return () => disconnectFromField()
  }, []) // eslint-disable-line

  const tabStyle = (active, color = 'rgba(100,100,255,0.25)', border = 'rgba(100,100,255,0.5)') => ({
    flex: 1, padding: '8px 10px',
    background: active ? color : 'transparent',
    border: `1px solid ${active ? border : 'transparent'}`,
    borderRadius: 6,
    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
    fontSize: '0.68rem', fontFamily: 'monospace', cursor: 'none',
    transition: 'all 0.2s', letterSpacing: '0.04em',
  })

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#00050a', cursor: 'none', position: 'relative', overflow: 'hidden' }}>
      <CustomCursor />

      {/* ── Canvas (full screen background) ── */}
      <Canvas
        camera={{ position: [0, 0, 1.5], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ position: 'absolute', inset: 0 }}
      >
        <color attach="background" args={['#00050a']} />
        <ambientLight intensity={0.5} />
        <Environment preset="city" background={false} />

        {/* Zustand → brainStateRef bridge (runs inside R3F loop, zero re-renders) */}
        <BrainBridge brainStateRef={brainStateRef} />

        <Suspense fallback={null}>
          <SyntergicBrain brainStateRef={brainStateRef} scale={0.2} autoRotate />
        </Suspense>

        <OrbitControls enableZoom enablePan={false} enableDamping dampingFactor={0.06} minDistance={0.8} maxDistance={5} />
      </Canvas>

      {/* ── Back ── */}
      <button
        onClick={() => navigate('/lab')}
        style={{
          position: 'fixed', top: 32, left: 32, zIndex: 200,
          background: 'transparent', border: 'none', padding: 0,
          color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem',
          letterSpacing: '0.4em', textTransform: 'uppercase',
          fontFamily: 'monospace', cursor: 'none', transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
      >
        ← Back
      </button>

      {/* ── Header ── */}
      <div style={{
        position: 'fixed', top: 32, left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, pointerEvents: 'none', textAlign: 'center', fontFamily: 'monospace',
      }}>
        <p style={{ fontSize: '0.55rem', letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', margin: 0 }}>
          .RANDOM() / LAB
        </p>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0' }}>
          HERMES
        </p>
      </div>

      {/* ── Right sidebar — live EEG metrics ── */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh', width: 310,
        background: 'linear-gradient(270deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 100%)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(100, 200, 255, 0.12)',
        overflowY: 'auto', overflowX: 'hidden',
        padding: '80px 16px 160px',
        zIndex: 100, pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column', gap: 14,
        scrollbarWidth: 'none',
      }}>
        {/* Sidebar header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 2 }}>
          <p style={{ margin: 0, fontSize: '0.6rem', letterSpacing: '0.25em', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            {dataSource === 'muse' ? 'EEG en vivo' : 'Dataset'} · Tiempo Real
          </p>
        </div>

        {/* Source selector */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 4, gap: 4 }}>
          <button onClick={() => setDataSource('dataset')} style={tabStyle(dataSource === 'dataset')}>
            Dataset
          </button>
          <button
            disabled
            title="Muse 2 — próximamente"
            style={{
              ...tabStyle(false),
              opacity: 0.3,
              cursor: 'not-allowed',
              position: 'relative',
            }}
          >
            Muse 2
            <span style={{
              marginLeft: 5,
              fontSize: '0.55rem',
              letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.4)',
              verticalAlign: 'middle',
            }}>WIP</span>
          </button>
        </div>

        {/* HUD panels */}
        <StateIndicator />
        <FrequencySpectrum />
        <CoherenceMeter />
        <AudioControl />
      </div>

      {/* ── Bottom panel: SessionControl or MuseControl ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 310,
        zIndex: 150, pointerEvents: 'auto',
      }}>
        {dataSource === 'dataset' ? <SessionControl /> : <MuseControl />}
      </div>

      {/* ── Bottom tags (canvas area) ── */}
      {/* <div style={{
        position: 'fixed', bottom: 22, left: '50%',
        transform: 'translateX(-50%) translateX(-155px)',
        zIndex: 100, pointerEvents: 'none',
        display: 'flex', gap: 8,
      }}>
        {['neural mesh', 'EEG reactive', 'WebSocket'].map(tag => (
          <span key={tag} style={{
            fontSize: '0.42rem', letterSpacing: '0.3em', textTransform: 'uppercase',
            fontFamily: 'monospace', color: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px',
          }}>
            {tag}
          </span>
        ))}
      </div> */}

      <style>{`
        ::-webkit-scrollbar { display: none; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}
