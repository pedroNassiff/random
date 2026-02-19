import { useBrainStore } from '../store'

export function StateIndicator() {
  const { state, frequency, bands } = useBrainStore()

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
      background: 'rgba(255,255,255,0.02)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      borderLeft: `2px solid ${config.color}`,
      transition: 'border-color 0.5s ease',
      position: 'relative'
    }}>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: config.color, display: 'block', flexShrink: 0
          }} />
          <div style={{
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
            textTransform: 'uppercase'
          }}>
            {config.label}
          </div>
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.6rem',
          fontFamily: 'monospace',
          marginTop: 6,
          letterSpacing: '0.08em'
        }}>
          {config.description}
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        paddingTop: 12, marginTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            Freq.
          </div>
          <div style={{ color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', marginTop: 3 }}>
            {frequency.toFixed(1)} Hz
          </div>
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.55rem', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            Banda
          </div>
          <div style={{ color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', marginTop: 3, textTransform: 'uppercase' }}>
            {dominantBand.key}
          </div>
        </div>
      </div>
    </div>
  )
}
