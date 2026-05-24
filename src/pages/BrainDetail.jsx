/**
 * BrainDetail — /lab/brain  (ADA)
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
import AdaRealtimePanel      from '../components/AdaRealtimePanel'
import { FrequencySpectrum } from '../lab-core/brain/hud/FrequencySpectrum'
import { CoherenceMeter }    from '../lab-core/brain/hud/CoherenceMeter'
import { StateIndicator }    from '../lab-core/brain/hud/StateIndicator'
import { AudioControl }      from '../lab-core/brain/hud/AudioControl'
import SessionControl        from '../lab-core/brain/hud/SessionControl'
import MuseControl           from '../lab-core/brain/hud/MuseControl'
import ProtocolOverlay       from '../lab-core/brain/hud/ProtocolOverlay'
import QuickSessionOverlay   from '../lab-core/brain/hud/QuickSessionOverlay'
import PipelineValidation    from '../lab-core/brain/hud/PipelineValidation'

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
  const [isMobile, setIsMobile] = useState(false)
  const [showProtocol, setShowProtocol] = useState(false)
  const [showQuickSession, setShowQuickSession] = useState(false)
  const [showPipelineValidation, setShowPipelineValidation] = useState(false)

  // Real-time EEG data for ADA panel
  const bands           = useBrainStore((s) => s.bands)
  const coherence       = useBrainStore((s) => s.coherence)
  const sessionProgress = useBrainStore((s) => s.sessionProgress)
  const eegState        = useBrainStore((s) => s.state)

  // Ref for SyntergicBrain — updated each frame by BrainBridge
  const brainStateRef = useRef({
    coherence:  0,
    focalPoint: { x: 0, y: 0, z: 0 },
    bands:      { delta: 0.1, theta: 0.1, alpha: 0.1, beta: 0.1, gamma: 0.1 },
  })

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Connect to backend WebSocket on mount
  useEffect(() => {
    connectToField()
    return () => disconnectFromField()
  }, []) // eslint-disable-line

  const tabStyle = (active, isMobile, color = 'rgba(100,100,255,0.25)', border = 'rgba(100,100,255,0.5)') => ({
    flex: 1, padding: '8px 10px',
    background: active ? color : 'transparent',
    border: `1px solid ${active ? border : 'transparent'}`,
    borderRadius: 6,
    color: active ? '#fff' : 'rgba(255,255,255,0.4)',
    fontSize: '0.68rem', fontFamily: 'monospace',
    cursor: isMobile ? 'pointer' : 'none',
    transition: 'all 0.2s', letterSpacing: '0.04em',
  })

  return (
    <div style={{ width: '100vw', background: '#00050a', cursor: isMobile ? 'auto' : 'none', position: 'relative', overflow: isMobile ? 'auto' : 'hidden', height: isMobile ? 'auto' : '100vh', minHeight: '100vh' }}>
      {!isMobile && <CustomCursor />}

      {/* ── Canvas (full screen on desktop, fixed top section on mobile) ── */}
      <Canvas
        camera={{ position: [0, 0, 1.5], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        frameloop="always"
        style={{
          position: isMobile ? 'fixed' : 'absolute',
          top: 0,
          left: 0,
          inset: isMobile ? 'auto' : 0,
          height: isMobile ? '42vh' : '100vh',
          width: '100%',
          zIndex: isMobile ? 1 : 'auto',
        }}
      >
        <color attach="background" args={['#00050a']} />
        <ambientLight intensity={0.5} />
        <Environment preset="city" background={false} />

        {/* Zustand → brainStateRef bridge (runs inside R3F loop, zero re-renders) */}
        <BrainBridge brainStateRef={brainStateRef} />

        <Suspense fallback={null}>
          <SyntergicBrain brainStateRef={brainStateRef} scale={isMobile ? 0.28 : 0.2} position={[0, -0.05, 0]} autoRotate />
        </Suspense>

        <OrbitControls enableZoom enablePan={false} enableDamping dampingFactor={0.06} minDistance={0.8} maxDistance={5} />
      </Canvas>

      {/* ── Pipeline Validation Modal ── */}
      {showPipelineValidation && (
        <PipelineValidation onClose={() => setShowPipelineValidation(false)} />
      )}

      {/* ── Quick Session Overlay (sobre el Canvas) ── */}
      {showQuickSession && (
        <div style={{
          position: isMobile ? 'fixed' : 'absolute',
          top: 0, left: 0,
          width: isMobile ? '100%' : `calc(100% - 310px)`,
          height: isMobile ? '42vh' : '100vh',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          <QuickSessionOverlay
            onClose={() => setShowQuickSession(false)}
            onRequestValidation={() => setShowPipelineValidation(true)}
          />
        </div>
      )}

      {/* ── Protocol Overlay (sobre el Canvas, pointer-events: none) ── */}
      {showProtocol && (
        <div style={{
          position: isMobile ? 'fixed' : 'absolute',
          top: 0, left: 0,
          width: isMobile ? '100%' : `calc(100% - 310px)`,
          height: isMobile ? '42vh' : '100vh',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          <ProtocolOverlay onClose={() => setShowProtocol(false)} />
        </div>
      )}

      {/* ── Spacer so content starts below fixed canvas on mobile ── */}
      {isMobile && <div style={{ height: '42vh' }} />}

      {/* ── Back ── */}
      <button
        onClick={() => navigate('/lab')}
        style={{
          position: 'fixed',
          top: isMobile ? 16 : 32,
          left: isMobile ? 16 : 32,
          zIndex: 200,
          background: 'transparent', border: 'none', padding: 0,
          color: 'rgba(255,255,255,0.3)',
          fontSize: isMobile ? '0.55rem' : '0.62rem',
          letterSpacing: '0.4em', textTransform: 'uppercase',
          fontFamily: 'monospace',
          cursor: isMobile ? 'pointer' : 'none',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => !isMobile && (e.currentTarget.style.color = '#fff')}
        onMouseLeave={(e) => !isMobile && (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
      >
        ← Back
      </button>

      {/* ── Header ── */}
      <div style={{
        position: 'fixed',
        top: isMobile ? 16 : 32,
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, pointerEvents: 'none', textAlign: 'center', fontFamily: 'monospace',
      }}>
        <p style={{
          fontSize: isMobile ? '0.48rem' : '0.55rem',
          letterSpacing: '0.5em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.2)', margin: 0
        }}>
          .RANDOM() / LAB
        </p>
        <p style={{
          fontSize: isMobile ? '0.6rem' : '0.7rem',
          letterSpacing: '0.4em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)', margin: '4px 0 0'
        }}>
          ADA
        </p>
      </div>

      {/* ── Right sidebar (desktop) / Content area (mobile) — live EEG metrics ── */}
      <div style={{
        position: isMobile ? 'relative' : 'fixed',
        top: isMobile ? 0 : 0,
        right: isMobile ? 0 : 0,
        left: isMobile ? 0 : 'auto',
        height: isMobile ? 'auto' : '100vh',
        width: isMobile ? '100%' : 310,
        background: isMobile
          ? 'rgba(0,5,10,1)'
          : 'linear-gradient(270deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 100%)',
        backdropFilter: isMobile ? 'none' : 'blur(12px)',
        borderLeft: isMobile ? 'none' : '1px solid rgba(100, 200, 255, 0.12)',
        overflowY: isMobile ? 'visible' : 'auto',
        overflowX: 'hidden',
        /* On mobile: extra bottom padding = height of SessionControl so last chart is fully visible */
        padding: isMobile ? '24px 16px 180px' : '80px 16px 160px',
        zIndex: isMobile ? 5 : 100,
        pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 14,
        scrollbarWidth: 'none',
      }}>
        {/* Sidebar header */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 2 }}>
          <p style={{
            margin: 0,
            fontSize: isMobile ? '0.58rem' : '0.6rem',
            letterSpacing: '0.25em', fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase'
          }}>
            {dataSource === 'muse' ? 'EEG en vivo' : 'Dataset'} · Tiempo Real
          </p>
        </div>

        {/* Source selector */}
        <div style={{
          display: 'flex',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 8, padding: 4, gap: 4
        }}>
          <button onClick={() => setDataSource('dataset')} style={tabStyle(dataSource === 'dataset', isMobile)}>
            Dataset
          </button>
          <button
            onClick={() => setDataSource('muse')}
            style={tabStyle(dataSource === 'muse', isMobile)}
          >
            Muse 2
          </button>
          <button
            onClick={() => navigate('/lab/brain/doc')}
            style={tabStyle(false, isMobile, 'rgba(99,102,241,0.25)', 'rgba(99,102,241,0.5)')}
          >
            DOC
          </button>
        </div>

        {/* HUD panels */}
        {dataSource === 'muse' && <MuseControl />}
        {dataSource === 'muse' && !showProtocol && (
          <button
            onClick={() => setShowProtocol(true)}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(93,202,165,0.08)',
              border: '1px dashed rgba(93,202,165,0.35)',
              borderRadius: 8,
              color: '#5DCAA5', fontSize: '0.72rem',
              fontFamily: 'monospace', fontWeight: 'bold',
              cursor: isMobile ? 'pointer' : 'none',
              letterSpacing: '0.08em',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(93,202,165,0.15)'}
            onMouseLeave={e => e.target.style.background = 'rgba(93,202,165,0.08)'}
          >
            Protocolo de validación
          </button>
        )}
        {dataSource === 'muse' && !showProtocol && !showQuickSession && (
          <button
            onClick={() => setShowQuickSession(true)}
            style={{
              width: '100%', padding: '12px',
              background: 'rgba(130,130,255,0.06)',
              border: '1px dashed rgba(130,130,255,0.3)',
              borderRadius: 8,
              color: '#818CF8', fontSize: '0.72rem',
              fontFamily: 'monospace',
              cursor: isMobile ? 'pointer' : 'none',
              letterSpacing: '0.08em',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(130,130,255,0.13)'}
            onMouseLeave={e => e.target.style.background = 'rgba(130,130,255,0.06)'}
          >
            Calibración rápida
          </button>
        )}
        {dataSource === 'muse' && (
          <button
            onClick={() => setShowPipelineValidation(true)}
            style={{
              width: '100%', padding: '10px',
              background: 'transparent',
              border: '1px solid rgba(130,130,255,0.15)',
              borderRadius: 8,
              color: 'rgba(130,130,255,0.5)', fontSize: '0.65rem',
              fontFamily: 'monospace',
              cursor: isMobile ? 'pointer' : 'none',
              letterSpacing: '0.08em',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.target.style.color = '#818CF8'}
            onMouseLeave={e => e.target.style.color = 'rgba(130,130,255,0.5)'}
          >
            Validar pipeline
          </button>
        )}
        <StateIndicator />
        <FrequencySpectrum />
        <CoherenceMeter />
        <AudioControl />
      </div>

      {/* ── Bottom panel: SessionControl (dataset only, fixed bottom) ── */}
      {dataSource === 'dataset' && <SessionControl isMobile={isMobile} />}

      {/* ── ADA Realtime Panel (desktop only) ── */}
      {!isMobile && (
        <AdaRealtimePanel
          bands={bands}
          coherence={coherence}
          sessionProgress={sessionProgress}
          state={eegState}
          dataSource={dataSource}
        />
      )}

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
