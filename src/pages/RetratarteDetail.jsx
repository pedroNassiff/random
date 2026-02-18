import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { FaceTracker } from '../lab-core/retratarte/FaceTracker'
import { AudioAnalyzer } from '../lab-core/retratarte/AudioAnalyzer'

// Shader imports via vite-plugin-glsl
import vertexShader from '../lab-core/retratarte/shaders/patterns/vertex.glsl'
import fragmentShader from '../lab-core/retratarte/shaders/patterns/fragment.glsl'

// ─────────────────────────────────────────────
// All patterns — face-dependent ones degrade gracefully with hasFace=0
// ─────────────────────────────────────────────
const ALL_PATTERNS = [0, 1, 2, 3, 4, 6, 7, 11, 12, 13, 14, 15, 16, 17]
const PATTERN_NAMES = {
  0:  'LIQUID CRYSTAL',
  1:  'CHROMATIC FIELD',
  2:  'SIGNAL FLOW',
  3:  'WARP MESH',
  4:  'SPECTRAL TRACE',
  6:  'INTERFERENCE',
  7:  'KALEIDOSCOPE',
  11: 'MATTER WAVE',
  12: 'RESONANCE',
  13: 'FLUX LATTICE',
  14: 'NULL SPACE',
  15: 'VOID GRADIENT',
  16: 'EXPRESSION AURA',
  17: 'EMOTION FIELD',
}
const CYCLE_DURATION = 6000

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
// RetratarteDetail — vanilla Three.js viewer
// Square canvas centered, auto camera + mic
// ─────────────────────────────────────────────
export default function RetratarteDetail() {
  const navigate = useNavigate()
  const mountRef = useRef(null)
  const [patternName, setPatternName] = useState(PATTERN_NAMES[ALL_PATTERNS[0]])
  const [camStatus, setCamStatus] = useState('init')   // init | active | denied
  const [micStatus, setMicStatus] = useState('init')
  const patternIdxRef = useRef(0)
  const faceTrackerRef = useRef(null)
  const audioAnalyzerRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Square canvas size (portrait-safe) ──────
    const getSize = () => Math.min(mount.clientWidth, mount.clientHeight)

    // ── Renderer ──────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const applySize = () => {
      const s = getSize()
      renderer.setSize(s, s)
      renderer.domElement.style.position = 'absolute'
      renderer.domElement.style.left = `${(mount.clientWidth - s) / 2}px`
      renderer.domElement.style.top  = `${(mount.clientHeight - s) / 2}px`
      if (material) material.uniforms.uResolution.value.set(s, s)
    }
    mount.appendChild(renderer.domElement)

    // ── Scene + Camera (square ortho) ─────────
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10)
    camera.position.z = 1

    // ── Textures ──────────────────────────────
    const textureLoader = new THREE.TextureLoader()
    const portraitTexture = textureLoader.load('/retratarte-portrait.png')
    const blankTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat)
    blankTex.needsUpdate = true

    // ── Uniforms ──────────────────────────────
    const s0 = getSize()
    const uniforms = {
      uTime:                  { value: 0 },
      uTexture:               { value: portraitTexture },
      uPattern:               { value: ALL_PATTERNS[0] },
      uResolution:            { value: new THREE.Vector2(s0, s0) },
      uAudioBass:             { value: 0 },
      uAudioMid:              { value: 0 },
      uAudioTreble:           { value: 0 },
      uAudioVolume:           { value: 0 },
      uAudioBeat:             { value: 0 },
      uAudioSpectralCentroid: { value: 0 },
      uAudioSpectralFlux:     { value: 0 },
      uAudioSubBass:          { value: 0 },
      uAudioLowBass:          { value: 0 },
      uAudioPresence:         { value: 0 },
      uAudioBrilliance:       { value: 0 },
      uMoodColor1:            { value: new THREE.Vector3(0.4, 0.1, 0.8) },
      uMoodColor2:            { value: new THREE.Vector3(0.0, 0.6, 1.0) },
      uMoodColor3:            { value: new THREE.Vector3(1.0, 0.2, 0.4) },
      uMoodIntensity:         { value: 0.7 },
      uFaceTexture:           { value: blankTex },
      uHasFace:               { value: 0 },
      uVideoTexture:          { value: blankTex },
      uHasVideo:              { value: 0 },
      uSmile:                 { value: 0 },
      uMouthOpen:             { value: 0 },
      uEyebrowRaise:          { value: 0 },
      uEyebrowFrown:          { value: 0 },
      uLeftEyeOpen:           { value: 1 },
      uRightEyeOpen:          { value: 1 },
      uHeadPitch:             { value: 0 },
      uHeadYaw:               { value: 0 },
      uHeadRoll:              { value: 0 },
    }

    // ── Material + Mesh ───────────────────────
    var material  // hoisted so applySize can access it
    const geometry = new THREE.PlaneGeometry(2, 2, 128, 128)
    material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: false })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    // Apply initial size
    applySize()

    // ── Video texture for face ────────────────
    let videoTexture = null

    // ── Pattern cycling ───────────────────────
    const cyclePattern = () => {
      patternIdxRef.current = (patternIdxRef.current + 1) % ALL_PATTERNS.length
      const next = ALL_PATTERNS[patternIdxRef.current]
      uniforms.uPattern.value = next
      setPatternName(PATTERN_NAMES[next])
    }
    const cycleInterval = setInterval(cyclePattern, CYCLE_DURATION)

    // ── Smoothed mesh movement ────────────────
    let smoothedRotation = 0
    let smoothedScale    = 0.82
    const ROT_SMOOTH   = 0.1
    const SCALE_SMOOTH = 0.08

    // ── Animation loop ────────────────────────
    const clock = new THREE.Clock()
    let animId

    const animate = () => {
      animId = requestAnimationFrame(animate)
      uniforms.uTime.value = clock.getElapsedTime()

      // ── Audio uniforms ──────────────────────
      const audio = audioAnalyzerRef.current
      let smoothMid = 0, smoothBass = 0, beat = 0
      if (audio && audio.isListening) {
        const f = audio.getFrequencies()
        smoothMid  = f.smoothMid
        smoothBass = f.smoothBass
        beat       = f.beat
        uniforms.uAudioBass.value             = f.smoothBass
        uniforms.uAudioMid.value              = f.smoothMid
        uniforms.uAudioTreble.value           = f.smoothTreble
        uniforms.uAudioVolume.value           = f.volume
        uniforms.uAudioBeat.value             = f.beat
        uniforms.uAudioSpectralCentroid.value = f.spectralCentroid
        uniforms.uAudioSpectralFlux.value     = f.spectralFlux
        uniforms.uAudioSubBass.value          = f.subBass
        uniforms.uAudioLowBass.value          = f.lowBass
        uniforms.uAudioPresence.value         = f.presence
        uniforms.uAudioBrilliance.value       = f.brilliance
        uniforms.uMoodColor1.value.set(...f.moodColor1)
        uniforms.uMoodColor2.value.set(...f.moodColor2)
        uniforms.uMoodColor3.value.set(...f.moodColor3)
        uniforms.uMoodIntensity.value         = f.moodIntensity
      }

      // ── Face uniforms ───────────────────────
      const face = faceTrackerRef.current
      if (face && face.isTracking) {
        const detected = face.isFaceDetected()
        uniforms.uHasFace.value = detected ? 1 : 0
        if (detected) {
          const exp  = face.getExpressions()
          const pose = face.getHeadPose()
          uniforms.uSmile.value        = exp.smile
          uniforms.uMouthOpen.value    = exp.mouthOpen
          uniforms.uEyebrowRaise.value = exp.eyebrowRaise
          uniforms.uEyebrowFrown.value = exp.eyebrowFrown
          uniforms.uLeftEyeOpen.value  = exp.leftEyeOpen
          uniforms.uRightEyeOpen.value = exp.rightEyeOpen
          uniforms.uHeadPitch.value    = pose.pitch
          uniforms.uHeadYaw.value      = pose.yaw
          uniforms.uHeadRoll.value     = pose.roll
        }

        // Video texture
        const video = face.getVideoElement()
        if (video && video.readyState >= 2) {
          if (!videoTexture) {
            videoTexture = new THREE.VideoTexture(video)
            videoTexture.minFilter = THREE.LinearFilter
            uniforms.uVideoTexture.value = videoTexture
            uniforms.uHasVideo.value = 1
          }
          videoTexture.needsUpdate = true
        }
      }

      // ── Mesh: position from face, rotation + scale from pose + audio ──
      const face2 = faceTrackerRef.current
      if (face2 && face2.isTracking && face2.isFaceDetected()) {
        const facePos = face2.getPosition()
        const pose    = face2.getHeadPose()
        const exp     = face2.getExpressions()

        // Position (subtle parallax)
        mesh.position.x = facePos.x * 0.4
        mesh.position.y = facePos.y * - 0.5

        // Rotation: roll from head tilt + slight mid-audio wobble
        const targetRot = pose.roll + smoothMid * 0.03
        smoothedRotation += (targetRot - smoothedRotation) * ROT_SMOOTH
        mesh.rotation.z = smoothedRotation

        // Scale: expression + audio breathing
        const targetScale = 0.82
          + exp.mouthOpen * 0.05
          + exp.smile     * 0.03
          + smoothBass    * 0.10
          + beat          * 0.06
        smoothedScale += (targetScale - smoothedScale) * SCALE_SMOOTH
        mesh.scale.set(smoothedScale, smoothedScale, 1)
      } else {
        // No face → gently drift back to neutral
        smoothedRotation += (0 - smoothedRotation) * ROT_SMOOTH
        smoothedScale    += (0.82 - smoothedScale)  * SCALE_SMOOTH
        mesh.rotation.z   = smoothedRotation
        mesh.scale.set(smoothedScale, smoothedScale, 1)
      }

      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ────────────────────────────────
    const onResize = () => applySize()
    window.addEventListener('resize', onResize)

    // ── Auto-init camera (FaceTracker) ────────
    ;(async () => {
      try {
        const tracker = new FaceTracker()
        tracker.setDebug(false)
        faceTrackerRef.current = tracker
        const ok = await tracker.initialize()
        setCamStatus(ok ? 'active' : 'denied')
      } catch {
        setCamStatus('denied')
      }
    })()

    // ── Auto-init mic (AudioAnalyzer) ─────────
    ;(async () => {
      try {
        const analyzer = new AudioAnalyzer()
        analyzer.setDebug(false)
        audioAnalyzerRef.current = analyzer
        const ok = await analyzer.initialize()
        setMicStatus(ok ? 'active' : 'denied')
      } catch {
        setMicStatus('denied')
      }
    })()

    // ── Cleanup ───────────────────────────────
    return () => {
      clearInterval(cycleInterval)
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      faceTrackerRef.current?.dispose()
      audioAnalyzerRef.current?.dispose()
      if (videoTexture) videoTexture.dispose()
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      portraitTexture.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  // ── Status dot helper ─────────────────────
  const statusDot = (s) => {
    if (s === 'active')  return <span style={{ color: '#4ade80' }}>●</span>
    if (s === 'denied')  return <span style={{ color: '#f87171' }}>●</span>
    return <span style={{ color: 'rgba(255,255,255,0.2)', animation: 'pulse 1.5s ease infinite' }}>●</span>
  }

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      <CustomCursor />

      {/* Three.js square canvas */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Back */}
      <button
        onClick={() => navigate('/lab')}
        className="fixed top-8 left-8 z-50 text-white/40 hover:text-white text-[10px] tracking-[0.4em] uppercase font-mono transition-colors duration-200"
        style={{ cursor: 'none' }}
      >
        ← Back
      </button>

      {/* Header */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center">
        <p className="text-white/20 text-[9px] tracking-[0.5em] uppercase font-mono">.RANDOM() / LAB</p>
        <p className="text-white/60 text-[11px] tracking-[0.4em] uppercase font-mono mt-1">RETRATARTE</p>
      </div>

      {/* Bottom — pattern + description + status */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center space-y-2">
        <p
          key={patternName}
          className="text-white/50 text-[10px] tracking-[0.45em] uppercase font-mono"
          style={{ animation: 'fadeIn 0.8s ease' }}
        >
          {patternName}
        </p>
        <p className="text-white/20 text-[8px] tracking-[0.3em] uppercase font-mono leading-relaxed">
          Leyendo gestos · movimientos · respiración
        </p>
        <div className="flex justify-center gap-4 pt-1">
          <span className="text-[7px] tracking-[0.25em] uppercase font-mono text-white/20 flex items-center gap-1.5">
            {statusDot(camStatus)} cámara
          </span>
          <span className="text-[7px] tracking-[0.25em] uppercase font-mono text-white/20 flex items-center gap-1.5">
            {statusDot(micStatus)} micrófono
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pulse  { 0%,100% { opacity: 0.2 } 50% { opacity: 0.7 } }
      `}</style>
    </div>
  )
}
