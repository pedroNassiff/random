import { useBrainStore } from '../../store/brainStore'
import { useEffect, useState } from 'react'

export function DebugPanel() {
  const { coherence, entropy, bands, state, frequency, plv } = useBrainStore()
  const [logs, setLogs] = useState([])
  const [expandedSections, setExpandedSections] = useState({
    metrics: false,
    shader: false,
    bands: false,
    log: false
  })

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString()
    const newLog = {
      timestamp,
      coherence: coherence.toFixed(3),
      entropy: entropy.toFixed(3),
      alpha: bands?.alpha.toFixed(3) || '0',
      state: state || 'unknown',
      freq: frequency.toFixed(1)
    }
    
    setLogs(prev => [newLog, ...prev.slice(0, 9)]) // Keep last 10
  }, [coherence, entropy, bands, state, frequency])

  // Calcular el valor que recibe el shader
  const shaderCoherence = ((1.0 + (coherence * 3.0)) - 1.0) / 3.0
  const shaderChaos = 1.0 - shaderCoherence

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: 40,
      width: '280px',
      background: 'rgba(0,0,0,0.85)',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.3)',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '0.65rem',
      color: '#00ff00',
      maxHeight: '70vh',
      overflowY: 'auto',
      zIndex: 100,
      pointerEvents: 'auto'
    }}>
      <div style={{ 
        marginBottom: '8px', 
        paddingBottom: '8px', 
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        color: '#00dcff',
        fontWeight: 'bold',
        fontSize: '0.75rem'
      }}>
        🔬 DEBUG
      </div>
      {/* Current Values - Collapsible */}
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => toggleSection('metrics')}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#ffb700',
            fontWeight: 'bold',
            fontSize: '0.7rem',
            cursor: 'pointer',
            padding: '6px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'Courier New', Courier, monospace",
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,183,0,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
        >
          <span>📊 METRICS</span>
          <span style={{ fontSize: '0.8rem' }}>{expandedSections.metrics ? '▼' : '▶'}</span>
        </button>
        
        {expandedSections.metrics && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '4px', 
            fontSize: '0.6rem',
            padding: '6px 8px',
            background: 'rgba(255,183,0,0.05)',
            borderRadius: '4px',
            marginTop: '4px'
          }}>
            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Coherence:</span>
              <span style={{ 
                color: coherence > 0.7 ? '#00ff9d' : coherence > 0.4 ? '#ffd700' : '#ff0055',
                fontWeight: 'bold',
                marginLeft: '4px'
              }}>
                {coherence.toFixed(3)}
              </span>
            </div>
            
            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>PLV:</span>
              <span style={{ color: '#00dcff', fontWeight: 'bold', marginLeft: '4px' }}>
                {plv.toFixed(3)}
              </span>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Entropy:</span>
              <span style={{ color: '#ff00ff', fontWeight: 'bold', marginLeft: '4px' }}>
                {entropy.toFixed(3)}
              </span>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>State:</span>
              <span style={{ color: '#00ff9d', fontWeight: 'bold', marginLeft: '4px', fontSize: '0.55rem' }}>
                {state || 'N/A'}
              </span>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Freq:</span>
              <span style={{ color: '#ffd700', fontWeight: 'bold', marginLeft: '4px' }}>
                {frequency.toFixed(1)} Hz
              </span>
            </div>

            <div>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Alpha:</span>
              <span style={{ color: '#10b981', fontWeight: 'bold', marginLeft: '4px' }}>
                {((bands?.alpha || 0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Shader Calculations - Collapsible */}
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => toggleSection('shader')}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#ff00ff',
            fontWeight: 'bold',
            fontSize: '0.7rem',
            cursor: 'pointer',
            padding: '6px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'Courier New', Courier, monospace",
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,0,255,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
        >
          <span>🎨 SHADER</span>
          <span style={{ fontSize: '0.8rem' }}>{expandedSections.shader ? '▼' : '▶'}</span>
        </button>
        
        {expandedSections.shader && (
          <div style={{ 
            fontSize: '0.6rem',
            padding: '6px 8px',
            background: 'rgba(255,0,255,0.05)',
            borderRadius: '4px',
            marginTop: '4px'
          }}>
            <div style={{ marginBottom: '3px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>uHoverIntensity:</span>
              <span style={{ color: 'white', fontWeight: 'bold', marginLeft: '4px' }}>
                {(1.0 + (coherence * 3.0)).toFixed(3)}
              </span>
            </div>

            <div style={{ marginBottom: '3px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Coherence:</span>
              <span style={{ color: '#00ff9d', fontWeight: 'bold', marginLeft: '4px' }}>
                {shaderCoherence.toFixed(3)}
              </span>
            </div>

            <div style={{ marginBottom: '6px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Chaos:</span>
              <span style={{ color: '#ff0055', fontWeight: 'bold', marginLeft: '4px' }}>
                {shaderChaos.toFixed(3)}
              </span>
            </div>

            <div style={{ 
              marginTop: '6px', 
              padding: '4px', 
              background: shaderChaos > 0.6 ? 'rgba(255,0,85,0.2)' : 'rgba(0,255,157,0.2)',
              borderRadius: '3px',
              textAlign: 'center',
              fontSize: '0.55rem'
            }}>
              {shaderChaos > 0.6 ? '⚡ CHAOS' : '✨ COLLAPSED'}
            </div>
          </div>
        )}
      </div>

      {/* Frequency Bands - Collapsible */}
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => toggleSection('bands')}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#00dcff',
            fontWeight: 'bold',
            fontSize: '0.7rem',
            cursor: 'pointer',
            padding: '6px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'Courier New', Courier, monospace",
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(0,220,255,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
        >
          <span>📡 BANDS</span>
          <span style={{ fontSize: '0.8rem' }}>{expandedSections.bands ? '▼' : '▶'}</span>
        </button>
        
        {expandedSections.bands && bands && (
          <div style={{ 
            fontSize: '0.55rem',
            padding: '6px 8px',
            background: 'rgba(0,220,255,0.05)',
            borderRadius: '4px',
            marginTop: '4px'
          }}>
            {Object.entries(bands).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '3px', display: 'flex', alignItems: 'center' }}>
                <span style={{ 
                  width: '50px', 
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  fontSize: '0.5rem'
                }}>
                  {key}:
                </span>
                <div style={{ 
                  flex: 1, 
                  height: '6px', 
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginRight: '6px'
                }}>
                  <div style={{
                    width: `${value * 100}%`,
                    height: '100%',
                    background: key === 'alpha' ? '#10b981' : 
                               key === 'beta' ? '#f59e0b' : 
                               key === 'gamma' ? '#ef4444' :
                               key === 'theta' ? '#3b82f6' : '#8b5cf6',
                    transition: 'width 0.3s'
                  }} />
                </div>
                <span style={{ 
                  width: '35px', 
                  textAlign: 'right',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stream Log - Collapsible */}
      <div>
        <button
          onClick={() => toggleSection('log')}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#ffd700',
            fontWeight: 'bold',
            fontSize: '0.7rem',
            cursor: 'pointer',
            padding: '6px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: "'Courier New', Courier, monospace",
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,215,0,0.1)'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
        >
          <span>📜 LOG</span>
          <span style={{ fontSize: '0.8rem' }}>{expandedSections.log ? '▼' : '▶'}</span>
        </button>
        
        {expandedSections.log && (
          <div style={{ 
            fontSize: '0.5rem', 
            maxHeight: '120px', 
            overflowY: 'auto',
            padding: '6px 8px',
            background: 'rgba(255,215,0,0.05)',
            borderRadius: '4px',
            marginTop: '4px'
          }}>
            {logs.map((log, i) => (
              <div 
                key={i} 
                style={{ 
                  marginBottom: '2px', 
                  padding: '2px',
                  background: i === 0 ? 'rgba(0,255,157,0.1)' : 'transparent',
                  borderLeft: i === 0 ? '2px solid #00ff9d' : 'none',
                  paddingLeft: i === 0 ? '4px' : '2px'
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>[{log.timestamp}]</span>
                {' '}
                <span style={{ color: '#00ff9d' }}>C:{log.coherence}</span>
                {' '}
                <span style={{ color: '#ff00ff' }}>E:{log.entropy}</span>
                {' '}
                <span style={{ color: '#10b981' }}>α:{log.alpha}</span>
                {' '}
                <span style={{ color: '#ffd700' }}>{log.freq}Hz</span>
                {' '}
                <span style={{ color: '#00dcff' }}>{log.state}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
