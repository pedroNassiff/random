import { useAudioFeedback } from '../../hooks/useAudioFeedback'
import { useBrainStore } from '../../store/brainStore'
import { useState } from 'react'

export function AudioControl() {
  const { isPlaying, toggleAudio } = useAudioFeedback()
  const coherence = useBrainStore((state) => state.coherence)
  const [showTooltip, setShowTooltip] = useState(false)

  // Calcular frecuencia aproximada para mostrar
  const baseFreq = 200 + (coherence * 100)
  const binauralOffset = 5 + (coherence * 15)

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
        marginBottom: '10px'
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.65rem',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontFamily: "'Courier New', Courier, monospace"
        }}>
          Binaural Audio
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
            Feedback Auditivo Binaural
          </div>
          <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
            Sonido estéreo que responde a tu coherencia cerebral en tiempo real.
          </div>
          <ul style={{ margin: '8px 0', paddingLeft: '20px', color: 'rgba(255,255,255,0.7)' }}>
            <li style={{ margin: '4px 0' }}><strong>Frecuencia base:</strong> Modulada por banda Alpha</li>
            <li style={{ margin: '4px 0' }}><strong>Offset binaural:</strong> Aumenta con coherencia</li>
            <li style={{ margin: '4px 0' }}><strong>Volumen:</strong> Más coherencia = más audible</li>
          </ul>
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
            Usa audífonos para mejor experiencia
          </div>
        </div>
      )}

      <button
        onClick={toggleAudio}
        style={{
          width: '100%',
          padding: '12px',
          background: isPlaying 
            ? 'linear-gradient(135deg, #00ff9d 0%, #00dcff 100%)'
            : 'rgba(255,255,255,0.1)',
          border: isPlaying 
            ? 'none'
            : '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          color: isPlaying ? '#000' : '#fff',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          fontFamily: "'Courier New', Courier, monospace",
          cursor: 'pointer',
          transition: 'all 0.3s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: isPlaying 
            ? '0 0 20px rgba(0,255,157,0.3)'
            : 'none'
        }}
        onMouseEnter={(e) => {
          if (!isPlaying) {
            e.target.style.background = 'rgba(255,255,255,0.2)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isPlaying) {
            e.target.style.background = 'rgba(255,255,255,0.1)'
          }
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>
          {isPlaying ? '🔊' : '🔇'}
        </span>
        {isPlaying ? 'PLAYING' : 'START AUDIO'}
      </button>

      {isPlaying && (
        <div style={{
          marginTop: '10px',
          fontSize: '0.7rem',
          fontFamily: "'Courier New', Courier, monospace",
          color: 'rgba(255,255,255,0.7)',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <div>
            L: <span style={{ color: '#00dcff', fontWeight: 'bold' }}>
              {baseFreq.toFixed(1)} Hz
            </span>
          </div>
          <div>
            R: <span style={{ color: '#00ff9d', fontWeight: 'bold' }}>
              {(baseFreq + binauralOffset).toFixed(1)} Hz
            </span>
          </div>
        </div>
      )}

      {isPlaying && (
        <div style={{
          marginTop: '6px',
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: "'Courier New', Courier, monospace",
          textAlign: 'center'
        }}>
          Δf = {binauralOffset.toFixed(1)} Hz
        </div>
      )}
    </div>
  )
}
