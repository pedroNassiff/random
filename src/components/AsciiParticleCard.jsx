import { useRef, useEffect, useState, useCallback, forwardRef } from 'react'

// lightest → densest. Bright image areas become dense chars (read as bright on black bg)
const RAMP  = ' .:-=+*#%@'
const BAYER = [0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v => (v + 0.5) / 16)

const DEFAULTS = {
  cols: 110,        // resolution. 100–130 is the sweet spot for cards
  fontSize: 13,     // intrinsic cell px (canvas is downscaled via object-fit → crisp)
  contrast: 1.45,
  gamma: 1.5,       // >1 lifts shadows so dark images (ADA) stay legible
  binary: false,    // true = 0/1 Bayer-dithered "matrix" look
}

const AsciiCard = forwardRef(function AsciiCard(
  { image, title, onClick, className, style, children, options },
  forwardedRef
) {
  const opts = { ...DEFAULTS, ...options }
  const containerRef = useRef(null)
  const imgRef       = useRef(null)
  const canvasRef    = useRef(null)
  const stateRef     = useRef(null)   // { ctx, cols, rows, cellW, cellH, lum, disp }
  const rafRef       = useRef(null)
  const hoveredRef   = useRef(false)
  const cursorRef    = useRef({ x: -1, y: -1 })   // in cell coords
  const [hovered, setHovered] = useState(false)

  const setContainerRef = useCallback((node) => {
    containerRef.current = node
    if (typeof forwardedRef === 'function') forwardedRef(node)
    else if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  // ── build luminance grid + size the canvas to match card aspect ──
  const build = useCallback(() => {
    const img = imgRef.current, canvas = canvasRef.current, c = containerRef.current
    if (!img || !canvas || !c || !img.naturalWidth) return
    const W = c.offsetWidth, H = c.offsetHeight
    const ctx = canvas.getContext('2d')

    ctx.font = `${opts.fontSize}px "Courier New", monospace`
    const cellW = ctx.measureText('@').width
    const cellH = opts.fontSize
    const cols  = opts.cols
    const rows  = Math.max(1, Math.round(cols * (H / W) * (cellW / cellH)))

    // cover-crop source to card aspect, downscale to cols×rows
    const off = document.createElement('canvas')
    off.width = cols; off.height = rows
    const octx = off.getContext('2d')
    octx.filter = `contrast(${opts.contrast})`
    const ia = img.naturalWidth / img.naturalHeight, ca = W / H
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
      v = Math.pow(v, 1 / opts.gamma)                          // lift shadows
      v = Math.min(1, Math.max(0, (v - 0.5) * opts.contrast + 0.5))
      lum[i] = v
    }

    canvas.width  = Math.round(cols * cellW)
    canvas.height = Math.round(rows * cellH)
    ctx.font = `${opts.fontSize}px "Courier New", monospace`
    ctx.textBaseline = 'top'

    stateRef.current = { ctx, cols, rows, cellW, cellH, lum, disp: new Float32Array(cols * rows) }
    drawFrame()
  }, [image, opts.cols, opts.fontSize, opts.contrast, opts.gamma, opts.binary])

  // ── render one frame (disp grid = cursor energy) ──
  const drawFrame = useCallback(() => {
    const s = stateRef.current; if (!s) return
    const { ctx, cols, rows, cellW, cellH, lum, disp } = s
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x, v = lum[i], e = disp[i]
        let ch, on = true

        if (opts.binary) {
          const t = BAYER[(y & 3) * 4 + (x & 3)]
          on = (v + e * 0.4) > t
          ch = on ? '1' : '0'
        } else {
          ch = RAMP[Math.round(Math.min(1, v + e * 0.5) * (RAMP.length - 1))]
        }

        const base = 150 + Math.round(v * 60)
        const g = Math.min(255, base + Math.round(e * 255))
        ctx.fillStyle = (opts.binary && !on)
          ? `rgba(120,120,120,${0.12 + e * 0.4})`
          : `rgb(${g},${g},${g})`

        let ox = 0, oy = 0                                     // outward scatter near cursor
        if (e > 0.001 && cursorRef.current.x >= 0) {
          const dx = x - cursorRef.current.x, dy = y - cursorRef.current.y
          const len = Math.hypot(dx, dy) || 1, push = e * cellW * 1.3
          ox = (dx / len) * push; oy = (dy / len) * push
        }
        ctx.fillText(ch, x * cellW + ox, y * cellH + oy)
      }
    }
  }, [opts.binary])

  // ── hover loop: decaying glow trail (your original concept, now on the ASCII) ──
  const loop = useCallback(() => {
    const s = stateRef.current
    if (!s || !hoveredRef.current) { rafRef.current = null; return }
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
    drawFrame()
    rafRef.current = requestAnimationFrame(loop)
  }, [drawFrame])

  useEffect(() => {
    const img = imgRef.current; if (!img) return
    const onLoad = () => requestAnimationFrame(build)
    if (img.complete && img.naturalWidth) onLoad()
    else { img.addEventListener('load', onLoad); return () => img.removeEventListener('load', onLoad) }
  }, [image, build])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(() => build())
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [build])

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), [])

  const onEnter = useCallback(() => {
    hoveredRef.current = true; setHovered(true)
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop)
  }, [loop])
  const onLeave = useCallback(() => {
    hoveredRef.current = false; setHovered(false); cursorRef.current = { x: -1, y: -1 }
  }, [])
  const onMove = useCallback((e) => {
    const s = stateRef.current, c = containerRef.current; if (!s || !c) return
    const r = c.getBoundingClientRect()
    cursorRef.current = {
      x: ((e.clientX - r.left) / r.width) * s.cols,
      y: ((e.clientY - r.top) / r.height) * s.rows,
    }
  }, [])

  return (
    <div ref={setContainerRef} className={className} style={style}
         onMouseEnter={onEnter} onMouseLeave={onLeave} onMouseMove={onMove} onClick={onClick}>
      <img ref={imgRef} src={image} alt={title} crossOrigin="anonymous"
           className="absolute inset-0 w-full h-full object-cover"
           style={{ transition: 'opacity .45s ease', opacity: hovered ? 0 : 1 }} />
      <canvas ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', background: '#0a0a0a',
                       transition: 'opacity .4s ease', opacity: hovered ? 1 : 0, pointerEvents: 'none' }} />
      {children}
    </div>
  )
})

export default AsciiCard