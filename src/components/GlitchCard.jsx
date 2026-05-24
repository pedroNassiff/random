import { useState, useEffect, useRef, useCallback } from 'react'

// ── ASCII constants (same params as AsciiParticleCard) ──────────────────────
const RAMP  = ' .:-=+*#%@'
const ASCII_DEFAULTS = { cols: 110, fontSize: 13, contrast: 1.45, gamma: 1.5 }

function buildAsciiState(img, canvas, containerW, containerH, opts) {
  const ctx = canvas.getContext('2d')
  ctx.font = `${opts.fontSize}px "Courier New", monospace`
  const cellW = ctx.measureText('@').width
  const cellH = opts.fontSize
  const cols  = opts.cols
  const rows  = Math.max(1, Math.round(cols * (containerH / containerW) * (cellW / cellH)))

  const off = document.createElement('canvas')
  off.width = cols; off.height = rows
  const octx = off.getContext('2d')
  octx.filter = `contrast(${opts.contrast})`
  const ia = img.naturalWidth / img.naturalHeight
  const ca = containerW / containerH
  let sw, sh, sx, sy
  if (ia > ca) { sh = img.naturalHeight; sw = sh * ca; sx = (img.naturalWidth - sw) / 2; sy = 0 }
  else         { sw = img.naturalWidth;  sh = sw / ca; sx = 0; sy = (img.naturalHeight - sh) / 2 }
  octx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows)

  const data = octx.getImageData(0, 0, cols, rows).data
  const lum = new Float32Array(cols * rows)
  let min = 1, max = 0
  for (let i = 0; i < lum.length; i++) {
    const p = i * 4
    const l = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255
    lum[i] = l; if (l < min) min = l; if (l > max) max = l
  }
  const range = (max - min) || 1
  for (let i = 0; i < lum.length; i++) {
    let v = (lum[i] - min) / range
    v = Math.pow(v, 1 / opts.gamma)
    v = Math.min(1, Math.max(0, (v - 0.5) * opts.contrast + 0.5))
    lum[i] = v
  }

  canvas.width  = Math.round(cols * cellW)
  canvas.height = Math.round(rows * cellH)
  ctx.font = `${opts.fontSize}px "Courier New", monospace`
  ctx.textBaseline = 'top'

  return { ctx, cols, rows, cellW, cellH, lum, disp: new Float32Array(cols * rows) }
}

function drawAsciiFrame(state, cursorRef) {
  const { ctx, cols, rows, cellW, cellH, lum, disp } = state
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const v = lum[i], e = disp[i]
      const ch = RAMP[Math.round(Math.min(1, v + e * 0.5) * (RAMP.length - 1))]
      const base = 150 + Math.round(v * 60)
      const g    = Math.min(255, base + Math.round(e * 255))
      ctx.fillStyle = `rgb(${g},${g},${g})`
      let ox = 0, oy = 0
      if (e > 0.001 && cursorRef.x >= 0) {
        const dx = x - cursorRef.x, dy = y - cursorRef.y
        const len = Math.hypot(dx, dy) || 1
        ox = (dx / len) * e * cellW * 1.3
        oy = (dy / len) * e * cellH * 1.3
      }
      ctx.fillText(ch, x * cellW + ox, y * cellH + oy)
    }
  }
}

/**
 * GlitchCard — CSS glitch effect + optional ASCII hover.
 *
 * Props:
 *   color     — hex del color de acento (borde, glow, texto)
 *   image     — optional image URL: shows as background, replaces with ASCII on hover
 *   children  — contenido de la card
 *   className — clases extra opcionales
 */
export default function GlitchCard({ color = '#ffffff', image, children, className = '' }) {
  const [isGlitching, setIsGlitching] = useState(false)
  const [shakeX, setShakeX] = useState(0)
  const [clipSlice, setClipSlice] = useState(null)
  const [asciiVisible, setAsciiVisible] = useState(false)
  const hovered      = useRef(false)
  const timerRef     = useRef(null)
  // ASCII refs
  const containerRef = useRef(null)
  const imgRef       = useRef(null)
  const canvasRef    = useRef(null)
  const asciiState   = useRef(null)
  const rafRef       = useRef(null)
  const cursorRef    = useRef({ x: -1, y: -1 })

  // Color en rgba para el glow
  const hex = color.replace('#', '')
  const r   = parseInt(hex.slice(0, 2), 16)
  const g   = parseInt(hex.slice(2, 4), 16)
  const b   = parseInt(hex.slice(4, 6), 16)
  const rgba = (a) => `rgba(${r},${g},${b},${a})`

  // ── Glitch scheduler ────────────────────────────────────────────────
  useEffect(() => {
    const scheduleGlitch = () => {
      const delay = 2500 + Math.random() * 4500
      timerRef.current = setTimeout(() => {
        if (hovered.current) { scheduleGlitch(); return }
        const frames = 3 + Math.floor(Math.random() * 3)
        let f = 0
        const tick = () => {
          if (f >= frames) {
            setIsGlitching(false); setShakeX(0); setClipSlice(null)
            scheduleGlitch(); return
          }
          setIsGlitching(true)
          setShakeX((Math.random() - 0.5) * 10)
          const top    = Math.floor(Math.random() * 80)
          const bottom = Math.floor(Math.random() * (100 - top - 5))
          setClipSlice(`inset(${top}% 0 ${bottom}% 0)`)
          f++; setTimeout(tick, 60 + Math.random() * 60)
        }
        tick()
      }, delay)
    }
    scheduleGlitch()
    return () => clearTimeout(timerRef.current)
  }, [])

  // ── ASCII: build luminance grid when image loads ─────────────────────
  const build = useCallback(() => {
    const img = imgRef.current, canvas = canvasRef.current, c = containerRef.current
    if (!img || !canvas || !c || !img.naturalWidth) return
    asciiState.current = buildAsciiState(img, canvas, c.offsetWidth, c.offsetHeight, ASCII_DEFAULTS)
    drawAsciiFrame(asciiState.current, cursorRef.current)
  }, [])

  useEffect(() => {
    if (!image) return
    const img = imgRef.current; if (!img) return
    const onLoad = () => requestAnimationFrame(build)
    if (img.complete && img.naturalWidth) onLoad()
    else { img.addEventListener('load', onLoad); return () => img.removeEventListener('load', onLoad) }
  }, [image, build])

  useEffect(() => {
    if (!image || !containerRef.current) return
    const ro = new ResizeObserver(() => build())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [image, build])

  useEffect(() => () => { rafRef.current && cancelAnimationFrame(rafRef.current) }, [])

  // ── ASCII: hover animation loop ──────────────────────────────────────
  const startAsciiLoop = useCallback(() => {
    const loop = () => {
      const s = asciiState.current
      if (!s || !hovered.current) { rafRef.current = null; return }
      const { cols, rows, disp } = s, cur = cursorRef.current, R = 8
      for (let i = 0; i < disp.length; i++) disp[i] *= 0.9
      if (cur.x >= 0) {
        const x0 = Math.max(0, (cur.x - R) | 0), x1 = Math.min(cols - 1, (cur.x + R) | 0)
        const y0 = Math.max(0, (cur.y - R) | 0), y1 = Math.min(rows - 1, (cur.y + R) | 0)
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const dd = Math.hypot(x - cur.x, y - cur.y)
          if (dd <= R) disp[y * cols + x] = Math.min(1, disp[y * cols + x] + (1 - dd / R) * 0.55)
        }
      }
      drawAsciiFrame(s, cursorRef.current)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  const onEnter = useCallback(() => {
    hovered.current = true
    if (image) { setAsciiVisible(true); if (!rafRef.current) startAsciiLoop() }
  }, [image, startAsciiLoop])

  const onLeave = useCallback(() => {
    hovered.current = false
    if (image) { setAsciiVisible(false); cursorRef.current = { x: -1, y: -1 } }
  }, [image])

  const onMove = useCallback((e) => {
    if (!image) return
    const s = asciiState.current, c = containerRef.current; if (!s || !c) return
    const rect = c.getBoundingClientRect()
    cursorRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * s.cols,
      y: ((e.clientY - rect.top) / rect.height) * s.rows,
    }
  }, [image])

  return (
    <>
      <style>{`
        @keyframes svc-scan {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
        @keyframes svc-flicker {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.97; }
        }
      `}</style>

      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-2xl ${className}`}
        style={{ minHeight: 340 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onMouseMove={onMove}
      >
        {/* ── Fondo base ── */}
        <div className="absolute inset-0" style={{ background: '#0a0a0a' }} />

        {/* ── Image background (when image prop provided) ── */}
        {image && (
          <>
            {/* Hidden img for pixel sampling */}
            <img ref={imgRef} src={image} alt="" crossOrigin="anonymous"
                 className="absolute inset-0 w-full h-full object-cover"
                 style={{ transition: 'opacity .45s ease', opacity: asciiVisible ? 0 : 0.35 }} />
            {/* ASCII canvas */}
            <canvas ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ objectFit: 'cover', transition: 'opacity .4s ease',
                             opacity: asciiVisible ? 1 : 0, pointerEvents: 'none' }} />
          </>
        )}

        {/* ── Scanlines — siempre presentes, muy sutiles ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              ${rgba(0.025)} 2px,
              ${rgba(0.025)} 4px
            )`,
            animation: 'svc-scan 12s linear infinite',
          }}
        />

        {/* ── Scanlines extra durante glitch ── */}
        {isGlitching && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 1px,
                ${rgba(0.12)} 1px,
                ${rgba(0.12)} 2px
              )`,
              animation: 'svc-scan 1.5s linear infinite',
              clipPath: clipSlice || undefined,
            }}
          />
        )}

        {/* ── Borde glow ── */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: `1px solid ${isGlitching ? rgba(0.8) : rgba(0.12)}`,
            boxShadow: isGlitching
              ? `0 0 24px ${rgba(0.35)}, inset 0 0 16px ${rgba(0.08)}`
              : `0 0 0px ${rgba(0)}, inset 0 0 0px ${rgba(0)}`,
            transition: isGlitching ? 'none' : 'border-color 0.6s ease, box-shadow 0.6s ease',
          }}
        />

        {/* ── Contenido — se mueve en glitch ── */}
        <div
          className="relative z-10 flex flex-col justify-between p-8 h-full"
          style={{
            minHeight: 340,
            transform: isGlitching ? `translateX(${shakeX}px)` : 'none',
            transition: isGlitching ? 'none' : 'transform 0.15s ease',
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}
