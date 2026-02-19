import { useAudioFeedback } from '../hooks/useAudioFeedback'
import { useBrainStore } from '../store'

// Iconos SVG modernos
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const WaveIcon = ({ animate }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

  // Calcular frecuencia aproximada para mostrar
  const baseFreq = 200 + (coherence * 100)
  const binauralOffset = 5 + (coherence * 15)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          color: 'rgba(255,255,255,0.35)', fontSize: '0.55rem',
          letterSpacing: '0.25em', textTransform: 'uppercase', fontFamily: 'monospace'
        }}>
          Binaural
        </span>
      </div>

      <button
        onClick={toggleAudio}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: isPlaying ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
          border: isPlaying ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          color: isPlaying ? '#fff' : 'rgba(255,255,255,0.5)',
          fontSize: '0.65rem',
          fontWeight: 500,
          fontFamily: 'monospace',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          cursor: 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isPlaying ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = isPlaying ? '#fff' : 'rgba(255,255,255,0.5)' }}
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
          marginTop: 10, fontSize: '0.55rem', fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.3)',
          display: 'flex', justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '6px', letterSpacing: '0.15em'
        }}>
          <span>L · <span style={{ color: 'rgba(255,255,255,0.6)' }}>{baseFreq.toFixed(0)} Hz</span></span>
          <span>Δ {binauralOffset.toFixed(1)} Hz</span>
          <span><span style={{ color: 'rgba(255,255,255,0.6)' }}>{(baseFreq + binauralOffset).toFixed(0)} Hz</span> · R</span>
        </div>
      )}
    </div>
  )
}
