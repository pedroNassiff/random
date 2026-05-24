import { useRef, useEffect, useState, useCallback, forwardRef } from 'react'
import * as THREE from 'three'

/**
 * AsciiParticleCard
 *
 * Hybrid effect that combines two layers on hover:
 *   1. ASCII art  — image converted to monospace chars via canvas (low opacity base)
 *   2. Particles  — WebGL ShaderMaterial points that form the image and scatter under the cursor
 *
 * Drop-in replacement for the project card divs in Work.jsx.
 * Accepts a `ref` (forwarded) for GSAP scroll animations.
 */

// ---------------------------------------------------------------------------
// ASCII helpers
// ---------------------------------------------------------------------------

// 12 characters with deliberately wide perceptual-weight steps.
// Fewer chars = bigger luminance bands = much more legible output.
// Order: darkest (dense) → lightest (empty)
const CHARS = '@#S%?*+;:,. '

const ASCII_COLS = 55 // sweet-spot: large enough chars, enough detail

function imageToAscii(imgEl, cols, offscreenCanvas) {
  const ctx = offscreenCanvas.getContext('2d')
  const aspect = imgEl.naturalHeight / imgEl.naturalWidth
  const rows = Math.max(1, Math.floor(cols * aspect * 0.45))
  offscreenCanvas.width = cols
  offscreenCanvas.height = rows

  // Boost contrast in-canvas before sampling
  ctx.filter = 'contrast(1.4) brightness(1.05)'
  ctx.drawImage(imgEl, 0, 0, cols, rows)
  ctx.filter = 'none'

  const { data } = ctx.getImageData(0, 0, cols, rows)
  const len = cols * rows

  // Pass 1 — collect luminance values and find actual min/max
  const lums = new Float32Array(len)
  let minL = 255, maxL = 0
  for (let i = 0; i < len; i++) {
    const p = i * 4
    const l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    lums[i] = l
    if (l < minL) minL = l
    if (l > maxL) maxL = l
  }

  // Pass 2 — stretch contrast to full 0-255 range, map to char
  const range = maxL - minL || 1
  let out = ''
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const stretched = (lums[y * cols + x] - minL) / range // 0..1
      const idx = Math.floor(stretched * (CHARS.length - 1))
      // idx=0 → lightest pixel → empty char (space)
      // idx=max → darkest pixel → dense char (@)
      out += CHARS[CHARS.length - 1 - idx]
    }
    out += '\n'
  }
  return out
}

function scaleAsciiText(pre, ascii, w, h) {
  const lines = ascii.split('\n').filter(Boolean)
  if (!lines.length) return
  const numCols = lines[0].length
  const numRows = lines.length
  // Reference metrics at fontSize 10px in Courier New:
  //   char width ≈ 6px, line height ≈ 12px
  const scaleX = w / (numCols * 6)
  const scaleY = h / (numRows * 12)
  const scale = Math.min(scaleX, scaleY)
  pre.style.fontSize = `${10 * scale}px`
  pre.style.lineHeight = `${12 * scale}px`
}

// ---------------------------------------------------------------------------
// GLSL shaders (inline — no external file dep needed)
// ---------------------------------------------------------------------------
const VERTEX_SHADER = /* glsl */ `
  uniform vec2 uResolution;
  uniform sampler2D uPictureTexture;
  uniform sampler2D uDisplacementTexture;

  attribute float aIntensity;
  attribute float aAngle;

  varying vec3 vColor;
  varying float vPicIntensity;

  void main() {
    vec3 newPosition = position;

    // Cursor displacement: smoothstep so faint glow areas don't move particles
    float dispIntensity = texture2D(uDisplacementTexture, uv).r;
    dispIntensity = smoothstep(0.1, 0.3, dispIntensity);

    vec3 disp = normalize(vec3(cos(aAngle) * 0.2, sin(aAngle) * 0.2, 1.0));
    disp *= dispIntensity * 3.0 * aIntensity;
    newPosition += disp;

    vec4 mvPos = modelViewMatrix * vec4(newPosition, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Particle size driven by image brightness
    float picIntensity = texture2D(uPictureTexture, uv).r;
    vPicIntensity = picIntensity;
    gl_PointSize = 0.15 * picIntensity * uResolution.y;
    gl_PointSize *= (1.0 / -mvPos.z);

    // Gamma-correct brightness → perceived contrast
    vColor = pow(vec3(picIntensity), vec3(2.2));
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vPicIntensity;

  void main() {
    // Circular point — discard corners for round particles
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    // Soft feathered edge
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha);
  }
`

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const AsciiParticleCard = forwardRef(function AsciiParticleCard(
  { image, title, onClick, className, style, children },
  forwardedRef
) {
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const asciiPreRef = useRef(null)
  const particleCanvasRef = useRef(null)
  const offscreenRef = useRef(null)
  const threeRef = useRef(null)
  const animFrameRef = useRef(null)
  const hoveredRef = useRef(false)
  const pointerRef = useRef({
    screen: new THREE.Vector2(9999, 9999),
    canvas: new THREE.Vector2(9999, 9999),
    prev: new THREE.Vector2(9999, 9999),
  })

  const [hovered, setHovered] = useState(false)

  // Merge forwarded ref + internal ref
  const setContainerRef = useCallback((node) => {
    containerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  // ── ASCII generation ────────────────────────────────────────────────────
  const generateAscii = useCallback(() => {
    const img = imgRef.current
    const pre = asciiPreRef.current
    const container = containerRef.current
    const offscreen = offscreenRef.current
    if (!img || !pre || !container || !offscreen) return
    const ascii = imageToAscii(img, ASCII_COLS, offscreen)
    pre.textContent = ascii
    scaleAsciiText(pre, ascii, container.offsetWidth, container.offsetHeight)
  }, [])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (img.complete && img.naturalWidth > 0) {
      setTimeout(generateAscii, 0)
    } else {
      img.addEventListener('load', generateAscii)
      return () => img.removeEventListener('load', generateAscii)
    }
  }, [image, generateAscii])

  // ── Three.js init ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = particleCanvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !image) return

    const w = container.offsetWidth
    const h = container.offsetHeight

    // Scene + camera
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100)
    camera.position.set(0, 0, 18)
    scene.add(camera)

    // Renderer — alpha: true so the canvas background is transparent
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setSize(w, h, false) // false = don't override CSS size
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // ── Displacement 2D canvas (cursor glow trail) ──────────────────────
    const dispCanvas = document.createElement('canvas')
    dispCanvas.width = 128
    dispCanvas.height = 128
    const dispCtx = dispCanvas.getContext('2d')
    dispCtx.fillStyle = '#000'
    dispCtx.fillRect(0, 0, 128, 128)

    // Glow brush — radial gradient drawn at cursor position each frame
    const glowCvs = document.createElement('canvas')
    glowCvs.width = 128
    glowCvs.height = 128
    const glowCtx = glowCvs.getContext('2d')
    const grad = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.5)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    glowCtx.fillStyle = grad
    glowCtx.fillRect(0, 0, 128, 128)

    const dispTexture = new THREE.CanvasTexture(dispCanvas)

    // ── Project image → particle texture ───────────────────────────────
    const textureLoader = new THREE.TextureLoader()
    const picTexture = textureLoader.load(image)

    // ── Particle geometry ───────────────────────────────────────────────
    const SEG = 128
    const geometry = new THREE.PlaneGeometry(10, 10, SEG, SEG)
    geometry.setIndex(null)
    geometry.deleteAttribute('normal')

    const count = geometry.attributes.position.count
    const intensities = new Float32Array(count)
    const angles = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      intensities[i] = Math.random()
      angles[i] = Math.random() * Math.PI * 2
    }
    geometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensities, 1))
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uResolution: new THREE.Uniform(new THREE.Vector2(w, h)),
        uPictureTexture: new THREE.Uniform(picTexture),
        uDisplacementTexture: new THREE.Uniform(dispTexture),
      },
      transparent: true,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // Invisible plane for raycasting (cursor → UV coords)
    const interactivePlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    )
    scene.add(interactivePlane)

    const raycaster = new THREE.Raycaster()

    // Store Three.js state for use in event handlers / loop
    threeRef.current = {
      renderer, scene, camera,
      dispCanvas, dispCtx, glowCvs,
      dispTexture, raycaster, interactivePlane,
      material,
    }

    // Initial render so the scene is ready when hover kicks in
    renderer.render(scene, camera)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      picTexture.dispose()
      dispTexture.dispose()
    }
  }, [image]) // re-init only when image changes

  // ── Animation loop (runs only while hovered) ─────────────────────────
  const startLoop = useCallback(() => {
    const three = threeRef.current
    if (!three) return

    const loop = () => {
      if (!hoveredRef.current) return // auto-stop when cursor leaves

      const { renderer, scene, camera, dispCtx, glowCvs, dispTexture, raycaster, interactivePlane } = three
      const ptr = pointerRef.current

      // Raycast cursor position → UV → displacement canvas coords
      raycaster.setFromCamera(ptr.screen, camera)
      const hits = raycaster.intersectObject(interactivePlane)
      if (hits.length) {
        const uv = hits[0].uv
        ptr.canvas.x = uv.x * 128
        ptr.canvas.y = (1 - uv.y) * 128
      }

      // Fade displacement canvas toward black each frame (trail decay)
      dispCtx.globalCompositeOperation = 'source-over'
      dispCtx.globalAlpha = 0.02
      dispCtx.fillStyle = '#000'
      dispCtx.fillRect(0, 0, 128, 128)

      // Draw glow at cursor — alpha proportional to movement speed
      const dist = ptr.canvas.distanceTo(ptr.prev)
      ptr.prev.copy(ptr.canvas)
      const alpha = Math.min(dist * 0.1, 1)
      const glowSize = 128 * 0.25
      dispCtx.globalCompositeOperation = 'lighten'
      dispCtx.globalAlpha = alpha
      dispCtx.drawImage(glowCvs, ptr.canvas.x - glowSize * 0.5, ptr.canvas.y - glowSize * 0.5, glowSize, glowSize)

      dispTexture.needsUpdate = true
      renderer.render(scene, camera)

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
  }, [])

  // ── Pointer events ────────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    hoveredRef.current = true
    setHovered(true)
    startLoop()
  }, [startLoop])

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = false
    setHovered(false)
    // Reset cursor to off-screen so displacement fades cleanly
    pointerRef.current.screen.set(9999, 9999)
    pointerRef.current.canvas.set(9999, 9999)
    pointerRef.current.prev.set(9999, 9999)
  }, [])

  const handleMouseMove = useCallback((e) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    pointerRef.current.screen.x = (x / rect.width) * 2 - 1
    pointerRef.current.screen.y = -(y / rect.height) * 2 + 1
  }, [])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      ref={setContainerRef}
      className={className}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={onClick}
    >
      {/* Original project image — fades out on hover */}
      <img
        ref={imgRef}
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transition: 'opacity 0.45s ease',
          opacity: hovered ? 0 : 1,
        }}
      />

      {/* ASCII layer — full opacity base, particles float on top */}
      <div
        className="absolute inset-0 overflow-hidden flex items-center justify-center"
        style={{
          background: '#0a0a0a',
          transition: 'opacity 0.4s ease',
          opacity: hovered ? 1 : 0,
          pointerEvents: 'none',
        }}
      >
        <pre
          ref={asciiPreRef}
          style={{
            fontFamily: '"Courier New", Courier, monospace',
            whiteSpace: 'pre',
            lineHeight: 1.15,
            // High-contrast white on near-black — maximum legibility
            color: '#e8e8e8',
            letterSpacing: '0.02em',
            userSelect: 'none',
            transformOrigin: 'top left',
          }}
        />
      </div>

      {/* Three.js particle canvas — mix-blend-mode screen so it adds light
          on top of the ASCII without fully covering it */}
      <canvas
        ref={particleCanvasRef}
        className="absolute inset-0"
        style={{
          width: '100%',
          height: '100%',
          transition: 'opacity 0.45s ease',
          opacity: hovered ? 0.7 : 0,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* Hidden offscreen canvas for ASCII pixel sampling */}
      <canvas ref={offscreenRef} style={{ display: 'none' }} />

      {/* Pass-through children (ProjectHoverOverlay, badges, etc.) */}
      {children}
    </div>
  )
})

export default AsciiParticleCard
