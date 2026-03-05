import { useState, useRef, useEffect } from 'react'

/**
 * ProjectHoverOverlay
 * Drops inside a project card (position: relative, overflow: hidden).
 * Desktop: On hover shows title + CTA following cursor
 * Mobile: Always visible, centered in card
 */
export default function ProjectHoverOverlay({ title, viewLabel = 'ver proyecto' }) {
  const [isHovered, setIsHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleMouseMove = (e) => {
    if (isMobile) return
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // Mobile: always visible, centered
  // Desktop: visible on hover, follows cursor
  const isVisible = isMobile || isHovered
  const centerX = isMobile && ref.current ? ref.current.clientWidth / 2 : mousePos.x
  const centerY = isMobile && ref.current ? ref.current.clientHeight / 2 : mousePos.y

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0, zIndex: 10 }}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Project name — centered above the pill */}
      <div
        style={{
          position: 'absolute',
          left: centerX,
          top: centerY - (isMobile ? 32 : 64),
          transform: 'translateX(-50%)',
          opacity: isVisible ? 1 : 0,
          transition: isMobile ? 'none' : 'opacity 0.15s ease',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.95)',
            fontSize: isMobile ? '18px' : '23px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
            textShadow: '0 2px 12px rgba(0,0,0,0.9)',
            fontWeight: 600,
          }}
        >
          {title}
        </span>
      </div>

      {/* "ver proyecto" pill — centered on cursor or card center */}
      <div
        style={{
          position: 'absolute',
          left: centerX,
          top: centerY,
          transform: 'translate(-50%, -50%)',
          opacity: isVisible ? 1 : 0,
          transition: isMobile ? 'none' : 'opacity 0.15s ease',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: '#ffffff',
            color: '#1A1A1A',
            fontSize: isMobile ? '9px' : '10px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
            fontWeight: 700,
            padding: isMobile ? '8px 18px' : '9px 22px',
            borderRadius: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {viewLabel}
        </span>
      </div>
    </div>
  )
}
