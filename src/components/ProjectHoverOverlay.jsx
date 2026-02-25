import { useState, useRef } from 'react'

/**
 * ProjectHoverOverlay
 * Drops inside a project card (position: relative, overflow: hidden).
 * On hover shows:
 *   - Project name in Lab mono style, offset from cursor
 *   - "ver proyecto" pill button centered exactly on the cursor
 */
export default function ProjectHoverOverlay({ title, viewLabel = 'ver proyecto' }) {
  const [isHovered, setIsHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const ref = useRef(null)

  const handleMouseMove = (e) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0, zIndex: 10 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Project name — centered above the pill */}
      <div
        style={{
          position: 'absolute',
          left: mousePos.x,
          top: mousePos.y - 64,
          transform: 'translateX(-50%)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: '23px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
            textShadow: '0 1px 8px rgba(0,0,0,0.8)',
            fontWeight: 500,
          }}
        >
          {title}
        </span>
      </div>

      {/* "ver proyecto" pill — centered on cursor */}
      <div
        style={{
          position: 'absolute',
          left: mousePos.x,
          top: mousePos.y,
          transform: 'translate(-50%, -50%)',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 20,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: '#ffffff',
            color: '#1A1A1A',
            fontSize: '10px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
            fontWeight: 700,
            padding: '9px 22px',
            borderRadius: '24px',
          }}
        >
          {viewLabel}
        </span>
      </div>
    </div>
  )
}
