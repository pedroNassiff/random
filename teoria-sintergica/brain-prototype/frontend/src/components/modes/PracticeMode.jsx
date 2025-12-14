/**
 * PracticeMode - Modo de entrenamiento con objetivos y feedback
 * 
 * Permite practicar control consciente de coherencia con:
 * - Objetivos configurables
 * - Temporizador
 * - Feedback visual en tiempo real
 * - Tracking de progreso
 */

import { useState, useEffect } from 'react'
import { useBrainStore } from '../../store/brainStore'
import { usePracticeStore } from '../../store/achievementsStore'
import { useGuidedMeditation } from '../../hooks/useGuidedMeditation'

export default function PracticeMode({ onClose }) {
  const coherence = useBrainStore((state) => state.coherence)
  const bands = useBrainStore((state) => state.bands)
  const state = useBrainStore((state) => state.state)
  
  const {
    currentSession,
    startPracticeSession,
    endPracticeSession,
    updateSessionMetrics
  } = usePracticeStore()
  
  const {
    selectedMeditation,
    selectMeditation,
    isPlaying: audioIsPlaying,
    play: playAudio,
    pause: pauseAudio,
    stop: stopAudio,
    volume,
    setVolume,
    currentTime: audioTime,
    duration: audioDuration,
    availableMeditations
  } = useGuidedMeditation()
  
  const [targetCoherence, setTargetCoherence] = useState(0.7)
  const [sessionTimer, setSessionTimer] = useState(0)
  
  // Timer de sesión
  useEffect(() => {
    if (!currentSession.isActive) return
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - currentSession.startTime) / 1000
      setSessionTimer(elapsed)
    }, 100) // Update cada 100ms para smoothness
    
    return () => clearInterval(interval)
  }, [currentSession.isActive, currentSession.startTime])
  
  // Update metrics en tiempo real
  useEffect(() => {
    if (!currentSession.isActive) return
    
    updateSessionMetrics({
      coherence,
      bands,
      state
    })
  }, [coherence, bands, state, currentSession.isActive, updateSessionMetrics])
  
  // Handlers
  const handleStart = () => {
    startPracticeSession(targetCoherence)
    setSessionTimer(0)
    
    // Auto-play audio si hay meditación seleccionada
    if (selectedMeditation.audioUrl) {
      playAudio()
    }
  }
  
  const handleStop = () => {
    endPracticeSession()
    
    // Detener audio
    if (selectedMeditation.audioUrl) {
      stopAudio()
    }
  }
  
  // Formato de tiempo
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  // Calcular progreso hacia objetivo
  const progress = Math.min((coherence / targetCoherence) * 100, 100)
  const isTargetReached = coherence >= targetCoherence
  
  // Color dinámico basado en progreso
  const getProgressColor = () => {
    if (progress >= 100) return '#00ff88'
    if (progress >= 80) return '#88ff00'
    if (progress >= 60) return '#ffdd00'
    if (progress >= 40) return '#ff8800'
    return '#ff4444'
  }
  
  return (
    <div style={{
      position: 'absolute',
      top: '120px',
      left: '20px',
      width: '400px',
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(15px)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '12px',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      zIndex: 200
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #00ffaa, #0088ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Practice Mode
          </h2>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.5)'
          }}>
            Train your mind
          </p>
        </div>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px',
            color: 'rgba(255,255,255,0.7)',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255,68,68,0.3)'
            e.target.style.borderColor = 'rgba(255,68,68,0.5)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.1)'
            e.target.style.borderColor = 'rgba(255,255,255,0.3)'
          }}
        >
          ×
        </button>
        
        {/* Timer */}
        {currentSession.isActive && (
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            fontFamily: "'Courier New', monospace",
            color: '#00ffaa'
          }}>
            {formatTime(sessionTimer)}
          </div>
        )}
      </div>
      
      {/* Target Selection (solo cuando no está activa) */}
      {!currentSession.isActive && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '0.9rem',
            fontWeight: 500,
            marginBottom: '8px',
            color: 'rgba(255,255,255,0.8)'
          }}>
            Target Coherence
          </label>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[0.6, 0.7, 0.75, 0.8, 0.9].map(value => (
              <button
                key={value}
                onClick={() => setTargetCoherence(value)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: targetCoherence === value 
                    ? 'linear-gradient(135deg, #00ffaa, #0088ff)' 
                    : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {Math.round(value * 100)}%
              </button>
            ))}
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.6)'
          }}>
            💡 <strong>Tip:</strong> Start with 60-70% and gradually increase as you improve
          </div>
          
          {/* Guided Meditation Selector */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 500,
              marginBottom: '8px',
              color: 'rgba(255,255,255,0.8)'
            }}>
              🧘 Guided Meditation
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableMeditations.map(meditation => (
                <button
                  key={meditation.id}
                  onClick={() => selectMeditation(meditation.id)}
                  style={{
                    padding: '12px',
                    background: selectedMeditation.id === meditation.id
                      ? 'linear-gradient(135deg, rgba(138,43,226,0.3), rgba(75,0,130,0.3))'
                      : 'rgba(255,255,255,0.05)',
                    border: selectedMeditation.id === meditation.id
                      ? '1px solid rgba(138,43,226,0.5)'
                      : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedMeditation.id !== meditation.id) {
                      e.target.style.background = 'rgba(255,255,255,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedMeditation.id !== meditation.id) {
                      e.target.style.background = 'rgba(255,255,255,0.05)'
                    }
                  }}
                >
                  <div style={{
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    marginBottom: '4px'
                  }}>
                    {meditation.name}
                    {meditation.duration && (
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        marginLeft: '8px'
                      }}>
                        {Math.floor(meditation.duration / 60)} min
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.6)'
                  }}>
                    {meditation.description}
                  </div>
                  {meditation.instructor && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'rgba(138,43,226,0.8)',
                      marginTop: '4px',
                      fontStyle: 'italic'
                    }}>
                      Guiada por {meditation.instructor}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Progress Visualization */}
      {currentSession.isActive && (
        <div style={{ marginBottom: '20px' }}>
          {/* Target Line */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '0.9rem',
              color: 'rgba(255,255,255,0.7)'
            }}>
              Current Coherence
            </span>
            <span style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: getProgressColor(),
              fontFamily: "'Courier New', monospace"
            }}>
              {Math.round(coherence * 100)}%
            </span>
          </div>
          
          {/* Progress Bar */}
          <div style={{
            position: 'relative',
            height: '40px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.1)'
          }}>
            {/* Fill */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${getProgressColor()}, ${getProgressColor()}88)`,
              transition: 'width 0.3s ease-out, background 0.3s',
              boxShadow: isTargetReached ? `0 0 20px ${getProgressColor()}` : 'none'
            }} />
            
            {/* Target Marker */}
            <div style={{
              position: 'absolute',
              left: '100%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '3px',
              height: '60%',
              background: '#fff',
              opacity: 0.5,
              zIndex: 2
            }} />
            
            {/* Percentage Text */}
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              fontWeight: 700,
              fontSize: '1.1rem',
              zIndex: 3,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              color: '#fff'
            }}>
              {Math.round(progress)}%
            </div>
          </div>
          
          {/* Target Reached Indicator */}
          {isTargetReached && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,136,255,0.2))',
              border: '1px solid rgba(0,255,136,0.3)',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#00ffaa',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              🎯 Target Reached! Hold this state...
            </div>
          )}
          
          {/* Session Stats */}
          <div style={{
            marginTop: '15px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px'
          }}>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '10px',
              borderRadius: '6px'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '4px'
              }}>
                Peak
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#00ffaa'
              }}>
                {Math.round(currentSession.peakCoherence * 100)}%
              </div>
            </div>
            
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '10px',
              borderRadius: '6px'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.5)',
                marginBottom: '4px'
              }}>
                Average
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#0088ff'
              }}>
                {Math.round(currentSession.averageCoherence * 100)}%
              </div>
            </div>
          </div>
          
          {/* Audio Controls (si hay meditación seleccionada) */}
          {selectedMeditation.audioUrl && (
            <div style={{
              marginTop: '15px',
              background: 'rgba(138,43,226,0.1)',
              border: '1px solid rgba(138,43,226,0.3)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  color: 'rgba(255,255,255,0.8)',
                  fontWeight: 600
                }}>
                  🎧 {selectedMeditation.name}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: "'Courier New', monospace"
                }}>
                  {formatTime(Math.floor(audioTime))} / {formatTime(Math.floor(audioDuration))}
                </div>
              </div>
              
              {/* Audio Progress Bar */}
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                height: '4px',
                borderRadius: '2px',
                marginBottom: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, rgba(138,43,226,0.8), rgba(75,0,130,0.8))',
                  height: '100%',
                  width: `${audioDuration > 0 ? (audioTime / audioDuration) * 100 : 0}%`,
                  transition: 'width 0.3s ease-out'
                }} />
              </div>
              
              {/* Play/Pause Button */}
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <button
                  onClick={() => audioIsPlaying ? pauseAudio() : playAudio()}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: audioIsPlaying
                      ? 'rgba(255,170,0,0.3)'
                      : 'rgba(138,43,226,0.3)',
                    border: '1px solid rgba(138,43,226,0.5)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {audioIsPlaying ? '⏸ Pausar Audio' : '▶️ Reproducir Guía'}
                </button>
                
                {/* Volume Control */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '120px'
                }}>
                  <span style={{ fontSize: '0.9rem' }}>🔊</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: 'rgba(138,43,226,0.8)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Instructions */}
      {currentSession.isActive && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: '8px',
            color: 'rgba(255,255,255,0.8)'
          }}>
            💫 Techniques to increase coherence:
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: '20px',
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6
          }}>
            <li>Close your eyes and breathe slowly</li>
            <li>Focus on the center of your brain</li>
            <li>Visualize golden light spreading from focal point</li>
            <li>Let thoughts pass without attachment</li>
          </ul>
        </div>
      )}
      
      {/* Controls */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {!currentSession.isActive ? (
          <button
            onClick={handleStart}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #00ffaa, #0088ff)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.02)'
              e.target.style.boxShadow = '0 4px 20px rgba(0,255,170,0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)'
              e.target.style.boxShadow = 'none'
            }}
          >
            ▶️ Start Practice
          </button>
        ) : (
          <button
            onClick={handleStop}
            style={{
              flex: 1,
              padding: '14px',
              background: 'linear-gradient(135deg, #ff4444, #cc0000)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.02)'
              e.target.style.boxShadow = '0 4px 20px rgba(255,68,68,0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)'
              e.target.style.boxShadow = 'none'
            }}
          >
            ⏹️ End Session
          </button>
        )}
      </div>
      
      {/* CSS Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
