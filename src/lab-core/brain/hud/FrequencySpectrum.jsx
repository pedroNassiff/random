import { useBrainStore } from '../store'
import { useEffect, useRef } from 'react'

export function FrequencySpectrum() {
  const { bands } = useBrainStore()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Define band colors (neurociencia estándar)
    const bandData = [
      { 
        name: 'Delta', 
        value: bands.delta, 
        color: '#8b5cf6',
        region: 'Central/Tálamo',
        description: 'Sueño profundo'
      },
      { 
        name: 'Theta', 
        value: bands.theta, 
        color: '#3b82f6',
        region: 'Temporal/Hipocampo',
        description: 'Meditación, memoria'
      },
      { 
        name: 'Alpha', 
        value: bands.alpha, 
        color: '#10b981',
        region: 'Occipital',
        description: 'Relajación, coherencia'
      },
      { 
        name: 'Beta', 
        value: bands.beta, 
        color: '#f59e0b',
        region: 'Frontal',
        description: 'Concentración activa'
      },
      { 
        name: 'Gamma', 
        value: bands.gamma, 
        color: '#ef4444',
        region: 'Prefrontal',
        description: 'Insight, binding'
      }
    ]

    const barWidth = width / 5
    const maxHeight = height - 30

    bandData.forEach((band, i) => {
      const x = i * barWidth
      const barHeight = band.value * maxHeight
      const y = height - barHeight

      // Draw bar with gradient
      const gradient = ctx.createLinearGradient(0, height, 0, y)
      gradient.addColorStop(0, band.color)
      gradient.addColorStop(1, band.color + 'aa')

      ctx.fillStyle = gradient
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight)

      // Draw label
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '9px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText(band.name, x + barWidth / 2, height - 5)

      // Draw value
      ctx.fillStyle = 'white'
      ctx.font = 'bold 10px Courier New'
      if (barHeight > 15) {
        ctx.fillText((band.value * 100).toFixed(0) + '%', x + barWidth / 2, y + 12)
      }
    })
  }, [bands])

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12
      }}>
        <span style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.55rem',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          fontFamily: 'monospace'
        }}>
          Frequency Bands
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={278}
        height={90}
        style={{ display: 'block', width: '100%' }}
      />
    </div>
  )
}
