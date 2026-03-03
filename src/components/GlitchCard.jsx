import { useState, useEffect, useRef } from 'react'

/**
 * GlitchCard — CSS-only glitch effect inspirado en el CookieConsent.
 *
 * • Fondo negro/oscuro base
 * • Scanlines animadas (repeating-linear-gradient moviéndose)
 * • Borde que pulsa al color de la card en momentos de glitch
 * • boxShadow glow interno/externo cuando glitchea
 * • Shake (translateX) aleatorio breve
 * • Hover: calma el glitch, borde queda tenue
 *
 * Props:
 *   color     — hex del color de acento (borde, glow, texto)
 *   children  — contenido de la card
 *   className — clases extra opcionales
 */
export default function GlitchCard({ color = '#ffffff', children, className = '' }) {
  const [isGlitching, setIsGlitching] = useState(false)
  const [shakeX, setShakeX] = useState(0)
  const [clipSlice, setClipSlice] = useState(null)
  const hovered = useRef(false)
  const timerRef = useRef(null)

  // Color en rgba para el glow
  const hex = color.replace('#', '')
  const r   = parseInt(hex.slice(0, 2), 16)
  const g   = parseInt(hex.slice(2, 4), 16)
  const b   = parseInt(hex.slice(4, 6), 16)
  const rgba = (a) => `rgba(${r},${g},${b},${a})`

  useEffect(() => {
    const scheduleGlitch = () => {
      // Intervalo aleatorio entre 2.5s y 7s
      const delay = 2500 + Math.random() * 4500
      timerRef.current = setTimeout(() => {
        if (hovered.current) { scheduleGlitch(); return }

        // Secuencia de glitch: 3-5 frames rápidos
        const frames = 3 + Math.floor(Math.random() * 3)
        let f = 0
        const tick = () => {
          if (f >= frames) {
            setIsGlitching(false)
            setShakeX(0)
            setClipSlice(null)
            scheduleGlitch()
            return
          }
          setIsGlitching(true)
          setShakeX((Math.random() - 0.5) * 10)
          // clip-path slice random — igual que cookie-glitch-border
          const top    = Math.floor(Math.random() * 80)
          const bottom = Math.floor(Math.random() * (100 - top - 5))
          setClipSlice(`inset(${top}% 0 ${bottom}% 0)`)
          f++
          setTimeout(tick, 60 + Math.random() * 60)
        }
        tick()
      }, delay)
    }

    scheduleGlitch()
    return () => clearTimeout(timerRef.current)
  }, [])

  const onEnter = () => { hovered.current = true }
  const onLeave = () => { hovered.current = false }

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
        className={`relative overflow-hidden rounded-2xl ${className}`}
        style={{ minHeight: 340 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {/* ── Fondo base ── */}
        <div
          className="absolute inset-0"
          style={{ background: '#0a0a0a' }}
        />

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

        {/* ── Scanlines extra durante glitch (más rápidas) ── */}
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
