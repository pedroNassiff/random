import { useBrainStore } from '../store'
import { useEffect, useRef } from 'react'

export function FrequencySpectrum() {
  // bandsDisplay: 1/f-corregido para visualización (delta ~22% en vez de ~60%)
  // bands: potencia relativa cruda (delta siempre domina por la física 1/f del EEG)
  const { bandsDisplay, bands } = useBrainStore()
  const canvasRef = useRef(null)

  // Usar bandsDisplay si disponible (backend nuevo), sino corregir client-side
  const displayBands = (bandsDisplay && bandsDisplay.delta < 0.55)
    ? bandsDisplay
    : (() => {
        // Correción 1/f client-side cuando el backend no envía bands_display
        const centres = { delta: 2.25, theta: 6, alpha: 10.5, beta: 21.5, gamma: 40 }
        const beta = 1.5
        const corrected = Object.fromEntries(
          Object.entries(bands).map(([k, v]) => [k, v * Math.pow(centres[k], beta)])
        )
        const total = Object.values(corrected).reduce((a, b) => a + b, 0)
        return total > 0
          ? Object.fromEntries(Object.entries(corrected).map(([k, v]) => [k, v / total]))
          : { delta: 0.2, theta: 0.2, alpha: 0.2, beta: 0.2, gamma: 0.2 }
      })()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Define band colors (neurociencia estándar)
    // Usar displayBands (1/f-corregido): todas las bandas en escala comparable
    const bandData = [
      { 
        name: 'Delta', 
        value: displayBands.delta, 
        color: '#8b5cf6',
        description: '0.5–4Hz'
      },
      { 
        name: 'Theta', 
        value: displayBands.theta, 
        color: '#3b82f6',
        description: '4–8Hz'
      },
      { 
        name: 'Alpha', 
        value: displayBands.alpha, 
        color: '#10b981',
        description: '8–13Hz'
      },
      { 
        name: 'Beta', 
        value: displayBands.beta, 
        color: '#f59e0b',
        description: '13–30Hz'
      },
      { 
        name: 'Gamma', 
        value: displayBands.gamma, 
        color: '#ef4444',
        description: '30–50Hz'
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
  }, [displayBands])

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
        <span style={{
          color: 'rgba(255,255,255,0.18)',
          fontSize: '0.45rem',
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
        }}>
          1/f corrected
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
