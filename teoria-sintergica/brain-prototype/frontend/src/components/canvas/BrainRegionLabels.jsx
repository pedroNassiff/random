import { Html } from '@react-three/drei'
import { useBrainStore } from '../../store/brainStore'

/**
 * Etiquetas 3D que muestran qué región se ilumina con cada frecuencia
 */

const REGION_LABELS = [
  {
    name: 'Prefrontal',
    position: [0, 0.6, 0.7],
    frequency: 'Gamma',
    color: '#ef4444',
    band: 'gamma'
  },
  {
    name: 'Frontal',
    position: [-0.3, 0.4, 0.6],
    frequency: 'Beta',
    color: '#f59e0b',
    band: 'beta'
  },
  {
    name: 'Occipital',
    position: [0, 0.3, -0.7],
    frequency: 'Alpha',
    color: '#10b981',
    band: 'alpha'
  },
  {
    name: 'Temporal',
    position: [0.5, -0.1, 0.1],
    frequency: 'Theta',
    color: '#3b82f6',
    band: 'theta'
  },
  {
    name: 'Central',
    position: [0, 0.1, 0],
    frequency: 'Delta',
    color: '#8b5cf6',
    band: 'delta'
  }
]

export function BrainRegionLabels({ visible = true }) {
  const { bands } = useBrainStore()
  
  if (!visible) return null
  
  return (
    <>
      {REGION_LABELS.map((label) => {
        const intensity = bands[label.band] || 0
        const opacity = 0.3 + (intensity * 0.7) // Más intensidad = más visible
        
        return (
          <Html
            key={label.name}
            position={label.position}
            center
            distanceFactor={0.5}
            style={{
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            <div
              style={{
                background: `${label.color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                padding: '4px 8px',
                borderRadius: '4px',
                border: `1px solid ${label.color}`,
                fontSize: '10px',
                fontWeight: 'bold',
                color: 'white',
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                transform: 'translate(-50%, -50%)',
                transition: 'all 0.3s ease',
                boxShadow: intensity > 0.3 ? `0 0 12px ${label.color}` : 'none'
              }}
            >
              {label.name}
              <div style={{ fontSize: '8px', opacity: 0.8, marginTop: '2px' }}>
                {label.frequency} {(intensity * 100).toFixed(0)}%
              </div>
            </div>
          </Html>
        )
      })}
    </>
  )
}
