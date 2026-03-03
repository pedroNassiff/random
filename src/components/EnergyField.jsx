import { useRef, useEffect } from 'react'

export default function EnergyField({
  color = '#ffffff',
  profile = 'web',
  cardIndex = 0,
  sharedScan = null,
}) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const timeRef   = useRef(Math.random() * 80)
  const hoverRef  = useRef(false)
  const calmRef   = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let iW = 0, iH = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      // 40% del CSS — suficiente textura, rendimiento full-card
      iW = Math.max(1, Math.floor(rect.width  * 0.40))
      iH = Math.max(1, Math.floor(rect.height * 0.40))
      canvas.width  = iW
      canvas.height = iH
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const onEnter = () => { hoverRef.current = true }
    const onLeave = () => { hoverRef.current = false }
    canvas.addEventListener('mouseenter', onEnter)
    canvas.addEventListener('mouseleave', onLeave)

    const hex = color.replace('#', '')
    const sR  = parseInt(hex.slice(0, 2), 16)
    const sG  = parseInt(hex.slice(2, 4), 16)
    const sB  = parseInt(hex.slice(4, 6), 16)
    const dR  = Math.round(sR * 0.05)
    const dG  = Math.round(sG * 0.05)
    const dB  = Math.round(sB * 0.07)

    const profiles = {
      web: {
        bigEle: 0.38, bigFreqX: 5.0, bigFreqY: 2.2, bigSpeed: 1.1,
        smallEle: 0.22, smallFreq: 4.0, smallSpeed: 0.28, smallIter: 4,
        colorOffset: 0.82, colorMult: 1.3,
        stripeFreq: 22, stripeSpeed: 0.08,
        glitchProb: 0.14, glitchMax: 30,
      },
      cloud: {
        bigEle: 0.20, bigFreqX: 2.2, bigFreqY: 1.0, bigSpeed: 0.35,
        smallEle: 0.10, smallFreq: 1.8, smallSpeed: 0.08, smallIter: 3,
        colorOffset: 0.88, colorMult: 0.95,
        stripeFreq: 8,  stripeSpeed: 0.025,
        glitchProb: 0.04, glitchMax: 6,
      },
      ai: {
        bigEle: 0.30, bigFreqX: 7.0, bigFreqY: 3.5, bigSpeed: 1.5,
        smallEle: 0.24, smallFreq: 5.5, smallSpeed: 0.45, smallIter: 4,
        colorOffset: 0.80, colorMult: 1.5,
        stripeFreq: 30, stripeSpeed: 0.12,
        glitchProb: 0.20, glitchMax: 42,
      },
      '3d': {
        bigEle: 0.26, bigFreqX: 3.5, bigFreqY: 2.8, bigSpeed: 0.65,
        smallEle: 0.15, smallFreq: 3.2, smallSpeed: 0.16, smallIter: 4,
        colorOffset: 0.86, colorMult: 1.1,
        stripeFreq: 14, stripeSpeed: 0.04,
        glitchProb: 0.09, glitchMax: 18,
      },
    }
    const p = profiles[profile] || profiles.web

    const smoothstep = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
      return t * t * (3 - 2 * t)
    }
    const fract = (x) => x - Math.floor(x)
    const r2D   = (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)

    const smallWaves = (xn, yn, t, iter) => {
      let e = 0
      for (let i = 1; i <= iter; i++) {
        const fi = p.smallFreq * i
        const ti = t * p.smallSpeed * i
        e -= Math.abs(
          (Math.sin(xn * fi * 1.31 + yn * fi * 0.71 + ti) * 0.5 +
           Math.sin(xn * fi * 0.71 - yn * fi * 1.13 + ti * 0.8) * 0.5) *
          p.smallEle / i
        )
      }
      return e
    }

    const getElevation = (xn, yn, t) => {
      let e = Math.sin(xn * p.bigFreqX + t * p.bigSpeed) *
              Math.sin(yn * p.bigFreqY + t * p.bigSpeed) *
              p.bigEle
      e += smallWaves(xn, yn, t, p.smallIter)
      return e
    }

    let lastTs = 0

    const draw = (ts) => {
      const dt = Math.min((ts - lastTs) / 1000, 0.05)
      lastTs = ts

      if (iW < 1 || iH < 1) { rafRef.current = requestAnimationFrame(draw); return }

      if (hoverRef.current) calmRef.current = Math.min(1, calmRef.current + dt / 2.0)
      else                  calmRef.current = Math.max(0, calmRef.current - dt / 0.8)
      const calm = calmRef.current
      timeRef.current += dt * (1 - calm * 0.68)
      const T = timeRef.current

      let scanY = -1
      if (sharedScan?.current !== undefined) {
        const g = sharedScan.current
        if (Math.floor(g) % 4 === cardIndex) scanY = Math.floor((g % 1) * iH)
      }

      const imgData = ctx.createImageData(iW, iH)
      const data    = imgData.data

      for (let py = 0; py < iH; py++) {
        const yn = py / iH

        // GLITCH por scanline — THORUS vertex.glsl logic
        const glitchTime = T * 0.8 - yn * 3.0
        const gs = (Math.sin(glitchTime) + Math.sin(glitchTime * 1.45) + Math.sin(glitchTime * 2.13)) / 3.0
        const baseGlitch  = smoothstep(0.3, 1.0, gs) * p.glitchMax
        const prob        = p.glitchProb ?? 0.10
        const glitchSeed  = r2D(yn * 9.1, Math.floor(T * 6.0) * 0.07)
        const lineXOffset = (glitchSeed < prob && calm < 0.7)
          ? (r2D(yn * 3.7, T * 0.3) - 0.5) * baseGlitch * (1 - calm * 0.95)
          : 0

        for (let px = 0; px < iW; px++) {
          const rawX = (px + lineXOffset + iW) % iW
          const xn   = rawX / iW

          // Elevación del mar (raging sea vertex.glsl)
          const elev = getElevation(xn, yn, T)

          // Base siempre negra — el color SOLO aparece via holoBright (stripes + fresnel + glitch)
          // usamos elev solo para calcular el brillo en crestas, no para colorear el fondo

          // THORUS stripes — en calma, frecuencia baja
          const calmStripeFreq = p.stripeFreq * (1 - calm * 0.55)
          let stripe = fract(yn * calmStripeFreq - T * p.stripeSpeed)
          // pow 2 en lugar de 3: franjas más anchas y visibles
          stripe = stripe * stripe

          // Fresnel: brillo en las crestas de las olas (abs(elev) alto = cresta)
          const fresnel    = smoothstep(0, 0.35, Math.abs(elev))
          const holoBright = (stripe * fresnel * 1.2 + fresnel * 1.0) * (1 - calm * 0.70)

          // Fondo negro + color solo en stripes/crestas
          let fR = Math.min(255, holoBright * sR * 0.9)
          let fG = Math.min(255, holoBright * sG * 0.9)
          let fB = Math.min(255, holoBright * sB * 0.9)

          // Scan line boost
          if (scanY >= 0 && Math.abs(py - scanY) <= 1) {
            const boost = py === scanY ? 0.4 : 0.12
            fR = Math.min(255, fR + sR * boost)
            fG = Math.min(255, fG + sG * boost)
            fB = Math.min(255, fB + sB * boost)
          }

          // Opacidad: siempre opaco — fondo negro, color solo en crestas/glitch
          const alpha = 255
          const idx   = (py * iW + px) * 4
          data[idx]     = fR
          data[idx + 1] = fG
          data[idx + 2] = fB
          data[idx + 3] = alpha
        }
      }

      ctx.putImageData(imgData, 0, 0)
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.removeEventListener('mouseenter', onEnter)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [color, profile, cardIndex])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        imageRendering: 'auto',
      }}
    />
  )
}