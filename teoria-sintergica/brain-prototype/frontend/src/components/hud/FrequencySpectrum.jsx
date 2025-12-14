import { useBrainStore } from '../../store/brainStore'
import { useEffect, useRef, useState } from 'react'

export function FrequencySpectrum() {
  const { bands } = useBrainStore()
  const canvasRef = useRef(null)
  const [showTooltip, setShowTooltip] = useState(false)

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
      background: 'rgba(10,10,15,0.7)',
      padding: '15px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)',
      backdropFilter: 'blur(10px)',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.65rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: "'Courier New', Courier, monospace"
        }}>
          Frequency Bands
        </div>
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'help',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
        >
          ?
        </button>
      </div>
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: '8px',
          padding: '12px',
          background: 'rgba(0,0,0,0.95)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          minWidth: '280px',
          maxWidth: '320px',
          zIndex: 1000,
          fontSize: '0.85rem',
          lineHeight: '1.4',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>
            Bandas de Frecuencia EEG
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Descomposición espectral de la actividad cerebral:
          </div>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'rgba(255,255,255,0.7)' }}>
            <li style={{ margin: '4px 0' }}>
              <strong style={{ color: '#8b5cf6' }}>Delta (0.5-4 Hz)</strong> → Central/Tálamo: Sueño profundo
            </li>
            <li style={{ margin: '4px 0' }}>
              <strong style={{ color: '#3b82f6' }}>Theta (4-8 Hz)</strong> → Temporal/Hipocampo: Meditación, creatividad
            </li>
            <li style={{ margin: '4px 0' }}>
              <strong style={{ color: '#10b981' }}>Alpha (8-13 Hz)</strong> → Occipital: Relajación, coherencia sintérgica
            </li>
            <li style={{ margin: '4px 0' }}>
              <strong style={{ color: '#f59e0b' }}>Beta (13-30 Hz)</strong> → Frontal: Concentración activa
            </li>
            <li style={{ margin: '4px 0' }}>
              <strong style={{ color: '#ef4444' }}>Gamma (30-50 Hz)</strong> → Prefrontal: Insight, binding problem
            </li>
          </ul>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={200}
        height={100}
        style={{ display: 'block' }}
      />
    </div>
  )
}
