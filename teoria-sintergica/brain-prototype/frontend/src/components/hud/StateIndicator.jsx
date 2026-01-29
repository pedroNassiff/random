import { useBrainStore } from '../../store/brainStore'
import { useState } from 'react'

export function StateIndicator() {
  const { state, frequency, bands } = useBrainStore()
  const [showTooltip, setShowTooltip] = useState(false)

  // Map states to visual properties
  const stateConfig = {
    'meditation': {
      label: 'MEDITACIÓN',
      color: '#10b981',
      icon: '🧘',
      description: 'Alpha dominante',
      // glow: '0 0 20px rgba(16, 185, 129, 0.5)'
    },
    'focused': {
      label: 'CONCENTRACIÓN',
      color: '#f59e0b',
      description: 'Beta/Gamma activo',
      // glow: '0 0 20px rgba(245, 158, 11, 0.5)'
    },
    'relaxed': {
      label: 'RELAJACIÓN',
      color: '#3b82f6',
      description: 'Theta presente',
      // glow: '0 0 20px rgba(59, 130, 246, 0.5)'
    },
    'insight': {
      label: 'INSIGHT',
      color: '#ef4444',
      description: 'Gamma elevado',
      // glow: '0 0 20px rgba(239, 68, 68, 0.5)'
    },
    'deep_relaxation': {
      label: 'RELAJACIÓN PROFUNDA',
      color: '#8b5cf6',
      description: 'Delta presente',
      // glow: '0 0 20px rgba(139, 92, 246, 1)'
    },
    'unknown': {
      label: 'TRANSITORIO',
      color: '#6b7280',
      description: 'Analizando...',
      glow: '0 0 20px rgba(107, 114, 128, 0.3)'
    }
  }

  const config = stateConfig[state] || stateConfig['unknown']

  // Find dominant band
  const dominantBand = Object.entries(bands).reduce((max, [key, value]) => 
    value > max.value ? { key, value } : max
  , { key: 'none', value: 0 })

  return (
    <div style={{
      background: 'rgba(10,10,15,0.7)',
      padding: '20px',
      borderRadius: '8px',
      border: `2px solid ${config.color}`,
      backdropFilter: 'blur(10px)',
      // boxShadow: config.glow,
      transition: 'all 0.5s ease',
      position: 'relative'
    }}>
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255)',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'help',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          zIndex: 10
        }}
      >
        ?
      </button>

      {showTooltip && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '100%',
          marginLeft: '12px',
          padding: '12px',
          background: 'rgba(0,0,0,0.95)',
          border: '1px solid rgba(255,255,255)',
          borderRadius: '8px',
          minWidth: '280px',
          maxWidth: '320px',
          zIndex: 1000,
          fontSize: '0.85rem',
          lineHeight: '1.4',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: '#10b981', fontWeight: 'bold', marginBottom: '8px' }}>
            Estado Mental Inferido
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Detectado automáticamente desde patrones de frecuencia:
          </div>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'rgba(255,255,255,0.7)' }}>
            <li style={{ margin: '4px 0' }}><strong> MEDITACIÓN:</strong> Dominancia Alpha (8-13 Hz)</li>
            <li style={{ margin: '4px 0' }}><strong> CONCENTRACIÓN:</strong> Beta/Gamma activo (13-50 Hz)</li>
            <li style={{ margin: '4px 0' }}><strong> RELAJACIÓN:</strong> Theta elevado (4-8 Hz)</li>
            <li style={{ margin: '4px 0' }}><strong> INSIGHT:</strong> Gamma activo (30-50 Hz)</li>
            <li style={{ margin: '4px 0' }}><strong> PROFUNDO:</strong> Delta presente (0.5-4 Hz)</li>
          </ul>
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '12px'
      }}>
        <div style={{
          fontSize: '2rem',
          filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))'
        }}>
          {config.icon}
        </div>
        <div>
          <div style={{
            color: config.color,
            fontSize: '1rem',
            fontWeight: 'bold',
            fontFamily: "'Courier New', Courier, monospace",
            letterSpacing: '2px',
            textShadow: `0 0 10px ${config.color}`
          }}>
            {config.label}
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.65rem',
            fontFamily: "'Courier New', Courier, monospace",
            marginTop: '3px'
          }}>
            {config.description}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div>
          <div style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.6rem',
            fontFamily: "'Courier New', Courier, monospace",
            textTransform: 'uppercase'
          }}>
            Frecuencia Dom.
          </div>
          <div style={{
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            fontFamily: "'Courier New', Courier, monospace",
            marginTop: '2px'
          }}>
            {frequency.toFixed(1)} Hz
          </div>
        </div>

        <div>
          <div style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.6rem',
            fontFamily: "'Courier New', Courier, monospace",
            textTransform: 'uppercase'
          }}>
            Banda Principal
          </div>
          <div style={{
            color: 'white',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            fontFamily: "'Courier New', Courier, monospace",
            marginTop: '2px',
            textTransform: 'uppercase'
          }}>
            {dominantBand.key} ({(dominantBand.value * 100).toFixed(0)}%)
          </div>
        </div>
      </div>
    </div>
  )
}
