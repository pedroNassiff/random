import { useBrainStore } from '../store'
import { useEffect, useRef, useState } from 'react'

export function CoherenceMeter() {
  const { coherence, plv } = useBrainStore()
  const [history, setHistory] = useState([])
  const canvasRef = useRef(null)
  const maxHistory = 50

  useEffect(() => {
    setHistory(prev => {
      const newHistory = [...prev, coherence]
      return newHistory.slice(-maxHistory)
    })
  }, [coherence])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw coherence threshold line (0.7 = alta sintergia)
    ctx.strokeStyle = 'rgba(255,215,0,0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    const thresholdY = height - (0.7 * height)
    ctx.beginPath()
    ctx.moveTo(0, thresholdY)
    ctx.lineTo(width, thresholdY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw coherence graph
    if (history.length > 1) {
      const stepX = width / maxHistory

      // Create gradient based on coherence level
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, '#00ff9d')  // High coherence (green)
      gradient.addColorStop(0.5, '#ffd700') // Medium (gold)
      gradient.addColorStop(1, '#ff0055')  // Low (red)

      ctx.strokeStyle = coherence > 0.7 ? '#00ff9d' : coherence > 0.4 ? '#ffd700' : '#ff0055'
      ctx.lineWidth = 2
      ctx.beginPath()

      history.forEach((value, i) => {
        const x = i * stepX
        const y = height - (value * height)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Fill area under curve
      ctx.lineTo(width, height)
      ctx.lineTo(0, height)
      ctx.closePath()
      ctx.fillStyle = coherence > 0.7 ? 'rgba(0,255,157,0.1)' : 'rgba(255,215,0,0.1)'
      ctx.fill()
    }
  }, [history, coherence])

  const coherenceLevel = coherence > 0.7 ? 'ALTA' : coherence > 0.4 ? 'MEDIA' : 'BAJA'
  const coherenceColor = coherence > 0.7 ? '#00ff9d' : coherence > 0.4 ? '#ffd700' : '#ff0055'

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
      }}>
        <span style={{
          color: 'rgba(255,255,255,0.35)', fontSize: '0.55rem',
          letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'monospace'
        }}>
          Coherencia
        </span>
        <span style={{
          color: coherenceColor, fontSize: '0.6rem',
          fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase'
        }}>
          {coherenceLevel}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={278}
        height={70}
        style={{ display: 'block', width: '100%', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
          MSC · <span style={{ color: 'rgba(255,255,255,0.6)' }}>{coherence.toFixed(3)}</span>
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem', fontFamily: 'monospace', letterSpacing: '0.15em' }}>
          PLV · <span style={{ color: 'rgba(255,255,255,0.6)' }}>{plv.toFixed(3)}</span>
        </span>
      </div>
    </div>
  )
}
