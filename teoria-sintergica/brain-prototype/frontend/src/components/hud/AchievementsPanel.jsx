/**
 * AchievementsPanel - Muestra logros desbloqueados y en progreso
 * 
 * Features:
 * - Lista de todos los achievements
 * - Indicadores de progreso
 * - Notificaciones cuando se desbloquea
 * - Estadísticas generales
 */

import { useState, useEffect } from 'react'
import { usePracticeStore } from '../../store/achievementsStore'

export default function AchievementsPanel({ onPracticeModeToggle, isPracticeMode }) {
  const { achievements, stats, getAchievementProgress } = usePracticeStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [recentUnlock, setRecentUnlock] = useState(null)
  
  // Detectar nuevos unlocks para mostrar notificación
  useEffect(() => {
    const justUnlocked = achievements.find(a => {
      if (!a.unlocked || !a.unlockedAt) return false
      const timeSinceUnlock = Date.now() - a.unlockedAt
      return timeSinceUnlock < 5000 // Últimos 5 segundos
    })
    
    if (justUnlocked && recentUnlock?.id !== justUnlocked.id) {
      setRecentUnlock(justUnlocked)
      
      // Auto-hide después de 5 segundos
      setTimeout(() => {
        setRecentUnlock(null)
      }, 5000)
    }
  }, [achievements, recentUnlock])
  
  const unlockedCount = achievements.filter(a => a.unlocked).length
  const totalCount = achievements.length
  const completionPercentage = (unlockedCount / totalCount) * 100
  
  // Formato de tiempo
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  
  return (
    <>
      {/* Notification Toast */}
      {recentUnlock && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          width: '350px',
          background: 'linear-gradient(135deg, rgba(0,255,136,0.95), rgba(0,136,255,0.95))',
          backdropFilter: 'blur(15px)',
          border: '2px solid rgba(255,255,255,0.3)',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 8px 32px rgba(0,255,136,0.4)',
          zIndex: 10000,
          animation: 'slideInRight 0.4s ease-out, pulse 2s ease-in-out infinite',
          fontFamily: "'Inter', -apple-system, sans-serif"
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            {recentUnlock.icon}
          </div>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Achievement Unlocked!
          </div>
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#fff',
            textAlign: 'center',
            marginBottom: '8px'
          }}>
            {recentUnlock.name}
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.8)',
            textAlign: 'center'
          }}>
            {recentUnlock.description}
          </div>
        </div>
      )}
      
      {/* Main Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: isExpanded ? '340px' : '340px', // Siempre fuera del sidebar derecho
        width: isExpanded ? '400px' : '60px',
        maxHeight: isExpanded ? '80vh' : '60px',
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '12px',
        padding: isExpanded ? '20px' : '10px',
        overflow: isExpanded ? 'auto' : 'hidden',
        transition: 'all 0.3s ease-out',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: '#fff',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        zIndex: 100
      }}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            position: isExpanded ? 'static' : 'absolute',
            top: isExpanded ? 'auto' : '50%',
            left: isExpanded ? 'auto' : '50%',
            transform: isExpanded ? 'none' : 'translate(-50%, -50%)',
            width: isExpanded ? '100%' : '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.5rem',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            marginBottom: isExpanded ? '15px' : 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.target.style.transform = isExpanded ? 'scale(1.02)' : 'translate(-50%, -50%) scale(1.1)'}
          onMouseLeave={(e) => e.target.style.transform = isExpanded ? 'scale(1)' : 'translate(-50%, -50%)'}
        >
          <span>🏆</span>
          {isExpanded && (
            <span style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#000'
            }}>
              {unlockedCount}/{totalCount} Achievements
            </span>
          )}
        </button>
        
        {isExpanded && (
          <>
            {/* Practice Mode Toggle */}
            <button
              onClick={onPracticeModeToggle}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '20px',
                background: isPracticeMode 
                  ? 'linear-gradient(135deg, #00ffaa, #0088ff)'
                  : 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isPracticeMode ? '🎯 Practice Mode Active' : '🌊 Start Practice Mode'}
            </button>
            
            {/* Progress Bar */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '20px',
              height: '8px',
              marginBottom: '20px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #ffd700, #ffaa00)',
                height: '100%',
                width: `${completionPercentage}%`,
                transition: 'width 0.5s ease-out',
                borderRadius: '20px'
              }} />
            </div>
            
            {/* Stats Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px'
                }}>
                  Sessions
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#00ffaa'
                }}>
                  {stats.totalSessions}
                </div>
              </div>
              
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px'
                }}>
                  Total Time
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#0088ff'
                }}>
                  {formatDuration(Math.floor(stats.totalPracticeTime))}
                </div>
              </div>
              
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px'
                }}>
                  Peak Coherence
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#ff00ff'
                }}>
                  {Math.round(stats.highestCoherence * 100)}%
                </div>
              </div>
              
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px'
                }}>
                  States Reached
                </div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#ffaa00'
                }}>
                  {stats.statesReached.length}
                </div>
              </div>
            </div>
            
            {/* Achievements List */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '15px'
            }}>
              <h3 style={{
                margin: '0 0 15px 0',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.8)'
              }}>
                Achievements
              </h3>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {achievements.map(achievement => {
                  const progress = getAchievementProgress(achievement.id)
                  
                  return (
                    <div
                      key={achievement.id}
                      style={{
                        background: achievement.unlocked 
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,170,0,0.2))'
                          : 'rgba(255,255,255,0.05)',
                        border: achievement.unlocked 
                          ? '1px solid rgba(255,215,0,0.4)'
                          : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        opacity: achievement.unlocked ? 1 : 0.7,
                        transition: 'all 0.3s'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <div style={{
                          fontSize: '2rem',
                          filter: achievement.unlocked ? 'none' : 'grayscale(1)'
                        }}>
                          {achievement.icon}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            marginBottom: '4px',
                            color: achievement.unlocked ? '#ffd700' : 'rgba(255,255,255,0.8)'
                          }}>
                            {achievement.name}
                          </div>
                          <div style={{
                            fontSize: '0.8rem',
                            color: 'rgba(255,255,255,0.6)',
                            marginBottom: progress ? '8px' : 0
                          }}>
                            {achievement.description}
                          </div>
                          
                          {/* Progress Bar para achievements en progreso */}
                          {progress && !achievement.unlocked && (
                            <div style={{
                              background: 'rgba(0,0,0,0.3)',
                              borderRadius: '10px',
                              height: '6px',
                              overflow: 'hidden',
                              marginTop: '8px'
                            }}>
                              <div style={{
                                background: 'linear-gradient(90deg, #00ffaa, #0088ff)',
                                height: '100%',
                                width: `${Math.min(progress.percentage, 100)}%`,
                                borderRadius: '10px',
                                transition: 'width 0.3s ease-out'
                              }} />
                            </div>
                          )}
                          
                          {progress && !achievement.unlocked && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: 'rgba(255,255,255,0.5)',
                              marginTop: '4px'
                            }}>
                              {achievement.type.includes('sustained') || achievement.type === 'total_time'
                                ? `${formatDuration(Math.floor(progress.current))} / ${formatDuration(progress.target)}`
                                : `${Math.floor(progress.current)} / ${progress.target}`
                              }
                            </div>
                          )}
                        </div>
                        
                        {achievement.unlocked && (
                          <div style={{
                            fontSize: '1.2rem',
                            color: '#ffd700'
                          }}>
                            ✓
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* Reset Button (solo para debug) */}
            <button
              onClick={() => {
                if (window.confirm('Reset all achievements? This cannot be undone.')) {
                  usePracticeStore.getState().resetAchievements()
                }
              }}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '10px',
                background: 'rgba(255,68,68,0.2)',
                border: '1px solid rgba(255,68,68,0.4)',
                borderRadius: '6px',
                color: '#ff4444',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              🔄 Reset Achievements (Debug)
            </button>
          </>
        )}
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 8px 32px rgba(0,255,136,0.4);
          }
          50% {
            box-shadow: 0 8px 48px rgba(0,255,136,0.7);
          }
        }
      `}</style>
    </>
  )
}
