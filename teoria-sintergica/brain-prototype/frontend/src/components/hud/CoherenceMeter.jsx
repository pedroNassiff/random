import { useBrainStore } from '../../store/brainStore'
import { useEffect, useRef, useState } from 'react'

export function CoherenceMeter() {
  const { coherence, plv } = useBrainStore()
  const [history, setHistory] = useState([])
  const [showTooltip, setShowTooltip] = useState(false)
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
      background: 'rgba(10,10,15,0.7)',
      padding: '15px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)',
      backdropFilter: 'blur(10px)',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.65rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: "'Courier New', Courier, monospace"
        }}>
          Inter-Hemispheric Coherence
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            color: coherenceColor,
            fontSize: '0.75rem',
            fontWeight: 'bold',
            fontFamily: "'Courier New', Courier, monospace"
          }}>
            {coherenceLevel}
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
      </div>

      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: '12px',
          padding: '12px',
          background: 'rgba(0,0,0,0.95)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          minWidth: '300px',
          maxWidth: '320px',
          zIndex: 1000,
          fontSize: '0.85rem',
          lineHeight: '1.4',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>
            Coherencia Sintérgica
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Sincronización entre hemisferios cerebrales en la banda Alpha (8-13 Hz).
          </div>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'rgba(255,255,255,0.7)' }}>
            <li style={{ margin: '4px 0' }}><strong>&gt; 0.7:</strong> Alta sintergia - Hemisferios unificados</li>
            <li style={{ margin: '4px 0' }}><strong>0.4-0.7:</strong> Sintergia moderada</li>
            <li style={{ margin: '4px 0' }}><strong>&lt; 0.4:</strong> Baja sintergia - Hemisferios independientes</li>
          </ul>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
            MSC = Magnitude Squared Coherence<br/>
            PLV = Phase Locking Value (más sensible)
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={280}
        height={80}
        style={{ display: 'block', marginBottom: '8px' }}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.7rem',
        fontFamily: "'Courier New', Courier, monospace",
        color: 'rgba(255,255,255,0.8)'
      }}>
        <div>
          MSC: <span style={{ color: 'white', fontWeight: 'bold' }}>{coherence.toFixed(3)}</span>
        </div>
        <div>
          PLV: <span style={{ color: 'white', fontWeight: 'bold' }}>{plv.toFixed(3)}</span>
        </div>
      </div>

      <div style={{
        marginTop: '6px',
        fontSize: '0.6rem',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'Courier New', Courier, monospace",
        textAlign: 'center'
      }}>
        {coherence > 0.7 ? '⚡ Sintergia detectada' : 'Sincronización en progreso...'}
      </div>
    </div>
  )
}
