import { useAudioFeedback } from '../../hooks/useAudioFeedback'
import { useBrainStore } from '../../store/brainStore'
import { useState } from 'react'

// Iconos SVG modernos
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
  </svg>
)

const WaveIcon = ({ animate }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3v18" style={{ animation: animate ? 'wave1 0.5s ease-in-out infinite' : 'none' }}/>
    <path d="M8 7v10" style={{ animation: animate ? 'wave2 0.5s ease-in-out infinite 0.1s' : 'none' }}/>
    <path d="M16 7v10" style={{ animation: animate ? 'wave2 0.5s ease-in-out infinite 0.2s' : 'none' }}/>
    <path d="M4 10v4" style={{ animation: animate ? 'wave3 0.5s ease-in-out infinite 0.15s' : 'none' }}/>
    <path d="M20 10v4" style={{ animation: animate ? 'wave3 0.5s ease-in-out infinite 0.25s' : 'none' }}/>
  </svg>
)

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
          padding: '12px 16px',
          background: isPlaying 
            ? 'rgba(29, 185, 84, 0.15)'
            : 'rgba(255,255,255,0.08)',
          border: isPlaying 
            ? '1px solid rgba(29, 185, 84, 0.4)'
            : '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px',
          color: isPlaying ? '#1db954' : '#fff',
          fontSize: '13px',
          fontWeight: '500',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
        onMouseEnter={(e) => {
          if (!isPlaying) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
          } else {
            e.currentTarget.style.background = 'rgba(29, 185, 84, 0.25)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isPlaying) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
          } else {
            e.currentTarget.style.background = 'rgba(29, 185, 84, 0.15)'
          }
        }}
      >
        {isPlaying ? (
          <>
            <WaveIcon animate={true} />
            <span>Playing</span>
          </>
        ) : (
          <>
            <PlayIcon />
            <span>Start Audio</span>
          </>
        )}
      </button>

      {/* CSS Animations */}
      <style>{`
        @keyframes wave1 {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(0.5); }
        }
        @keyframes wave2 {
          0%, 100% { transform: scaleY(0.7); }
          50% { transform: scaleY(1); }
        }
        @keyframes wave3 {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(0.8); }
        }
      `}</style>

      {isPlaying && (
        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'rgba(255,255,255,0.6)',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '6px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>L</span>
            <span style={{ color: '#00dcff', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>
              {baseFreq.toFixed(0)} Hz
            </span>
          </div>
          <div style={{ 
            color: 'rgba(255,255,255,0.3)', 
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center'
          }}>
            Δ {binauralOffset.toFixed(1)} Hz
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#1db954', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }}>
              {(baseFreq + binauralOffset).toFixed(0)} Hz
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>R</span>
          </div>
        </div>
      )}
    </div>
  )
}
