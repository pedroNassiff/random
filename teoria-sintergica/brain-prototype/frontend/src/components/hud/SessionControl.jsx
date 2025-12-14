/**
 * SessionControl - Control de reproducción de sesiones EEG completas
 * 
 * Permite reproducir sesiones longitudinales cronológicamente con controles
 * tipo media player (play/pause/seek/speed).
 */

import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

export default function SessionControl() {
  const [sessionActive, setSessionActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  
  // Fetch session status cada 2 segundos si está activo
  useEffect(() => {
    if (!sessionActive) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/session/status`);
        const data = await res.json();
        if (data.session_active) {
          setSessionStatus(data);
          // Sincronizar estado de reproducción desde backend
          if (data.is_playing !== undefined) {
            setIsPlaying(data.is_playing);
          }
        }
      } catch (err) {
        console.error('Error fetching session status:', err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [sessionActive]);
  
  // Cargar timeline al activar
  useEffect(() => {
    if (!sessionActive) return;
    
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/session/timeline`);
        const data = await res.json();
        if (data.status === 'success') {
          setTimeline(data);
        }
      } catch (err) {
        console.error('Error fetching timeline:', err);
      }
    })();
  }, [sessionActive]);
  
  // Cargar playlist al activar
  useEffect(() => {
    if (!sessionActive) return;
    
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/playlist`);
        const data = await res.json();
        if (data.status === 'success') {
          setPlaylist(data);
        }
      } catch (err) {
        console.error('Error fetching playlist:', err);
      }
    })();
  }, [sessionActive]);
  
  const activateSessionMode = async () => {
    try {
      const res = await fetch(`${API_BASE}/set-mode/session`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        setSessionActive(true);
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error activating session mode:', err);
    }
  };
  
  const togglePlayPause = async () => {
    if (!sessionActive) {
      // Si no está activo, activar sesión
      await activateSessionMode();
    } else {
      // Toggle pause/play
      try {
        if (isPlaying) {
          // Pausar
          const res = await fetch(`${API_BASE}/session/pause`, { method: 'POST' });
          const data = await res.json();
          if (data.status === 'success') {
            setIsPlaying(false);
          }
        } else {
          // Reanudar
          const res = await fetch(`${API_BASE}/session/play`, { method: 'POST' });
          const data = await res.json();
          if (data.status === 'success') {
            setIsPlaying(true);
          }
        }
      } catch (err) {
        console.error('Error toggling play/pause:', err);
      }
    }
  };
  
  const stopSession = async () => {
    try {
      setSessionActive(false);
      setIsPlaying(false);
      setSessionStatus(null);
      // No hacer petición al backend, simplemente detener el polling
    } catch (err) {
      console.error('Error stopping session:', err);
    }
  };
  
  const seekTo = async (seconds) => {
    try {
      await fetch(`${API_BASE}/session/seek/${seconds}`, { method: 'POST' });
    } catch (err) {
      console.error('Error seeking:', err);
    }
  };
  
  const setSpeed = async (speed) => {
    try {
      await fetch(`${API_BASE}/session/speed/${speed}`, { method: 'POST' });
    } catch (err) {
      console.error('Error setting speed:', err);
    }
  };
  
  const nextSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/playlist/next`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        // Refresh playlist
        const playlistRes = await fetch(`${API_BASE}/playlist`);
        const playlistData = await playlistRes.json();
        if (playlistData.status === 'success') {
          setPlaylist(playlistData);
        }
      }
    } catch (err) {
      console.error('Error advancing to next session:', err);
    }
  };
  
  const previousSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/playlist/previous`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        // Refresh playlist
        const playlistRes = await fetch(`${API_BASE}/playlist`);
        const playlistData = await playlistRes.json();
        if (playlistData.status === 'success') {
          setPlaylist(playlistData);
        }
      }
    } catch (err) {
      console.error('Error going to previous session:', err);
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!sessionActive) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(100, 200, 255, 0.3)',
        borderRadius: '50px',
        padding: '12px 30px',
        fontFamily: 'monospace',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
      }}>
        <div style={{ fontSize: '10px', opacity: 0.6 }}>
          📼 SESSION PLAYER
        </div>
        <button
          onClick={togglePlayPause}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            padding: '8px 20px',
            borderRadius: '20px',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12px',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ▶️ PLAY
        </button>
      </div>
    );
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '320px', // Dejar espacio para el sidebar
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(100, 200, 255, 0.3)',
      padding: '15px 25px',
      fontFamily: 'monospace',
      color: '#fff'
    }}>
      {/* Controles principales en una fila */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
      }}>
        {/* Play/Pause y Stop */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={togglePlayPause}
            style={{
              background: isPlaying ? 'rgba(255, 200, 0, 0.2)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: isPlaying ? '1px solid rgba(255, 200, 0, 0.5)' : 'none',
              padding: '8px 16px',
              borderRadius: '20px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px',
              fontFamily: 'monospace',
              minWidth: '80px'
            }}
          >
            {isPlaying ? '⏸️ PAUSE' : '▶️ PLAY'}
          </button>
          <button
            onClick={stopSession}
            style={{
              background: 'rgba(255, 0, 0, 0.2)',
              border: '1px solid rgba(255, 0, 0, 0.4)',
              padding: '8px 16px',
              borderRadius: '20px',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}
          >
            ⏹️ STOP
          </button>
        </div>
        
        {/* Progress bar expandido */}
        {sessionStatus && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '9px',
              opacity: 0.6,
              marginBottom: '5px'
            }}>
              <span>{sessionStatus?.session_metadata?.name || 'Loading...'}</span>
              <span style={{ marginLeft: 'auto' }}>
                {formatTime(sessionStatus.current_position)} / {formatTime(sessionStatus.total_duration)}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percent = x / rect.width;
              const seekTime = percent * sessionStatus.total_duration;
              seekTo(seekTime);
            }}>
              <div style={{
                width: `${sessionStatus.progress_percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                transition: 'width 0.2s ease'
              }} />
            </div>
          </div>
        )}
        
        {/* Speed y Playlist compactos */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Speed selector mini */}
          {sessionStatus && (
            <select
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              value={sessionStatus.playback_speed}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                padding: '6px 10px',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '10px',
                fontFamily: 'monospace',
                cursor: 'pointer'
              }}
            >
              <option value="0.5">0.5x</option>
              <option value="1.0">1.0x</option>
              <option value="2.0">2.0x</option>
              <option value="5.0">5.0x</option>
            </select>
          )}
          
          {/* Playlist toggle */}
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            style={{
              background: showPlaylist ? 'rgba(100, 200, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '6px 12px',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '10px',
              fontFamily: 'monospace'
            }}
          >
            {showPlaylist ? '▼' : '▶'} PLAYLIST
          </button>
        </div>
      </div>
      
      {/* Playlist expandible popup */}
      {showPlaylist && playlist && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: '25px',
          marginBottom: '10px',
          width: '350px',
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid rgba(100, 200, 255, 0.3)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Current session */}
          {playlist.current && (
            <div style={{
              padding: '12px',
              background: 'linear-gradient(90deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2))',
              borderBottom: '1px solid rgba(100, 200, 255, 0.3)'
            }}>
              <div style={{ fontSize: '8px', opacity: 0.6, marginBottom: '4px' }}>NOW PLAYING:</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{playlist.current.name}</div>
              <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '3px' }}>
                {playlist.current.category} • {playlist.current.index}/{playlist.current.total}
              </div>
            </div>
          )}
          
          {/* Nav buttons */}
          <div style={{ 
            display: 'flex', 
            gap: '8px',
            padding: '10px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <button
              onClick={previousSession}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '6px',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: 'monospace'
              }}
            >
              ⏮️ PREV
            </button>
            <button
              onClick={nextSession}
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '6px',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '10px',
                fontFamily: 'monospace'
              }}
            >
              NEXT ⏭️
            </button>
          </div>
          
          {/* Session list */}
          <div style={{
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            {playlist.playlist?.map((session, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderBottom: idx < playlist.playlist.length - 1 
                    ? '1px solid rgba(255, 255, 255, 0.05)' 
                    : 'none',
                  background: idx === (playlist.current?.index - 1)
                    ? 'rgba(100, 200, 255, 0.1)' 
                    : 'transparent',
                  fontSize: '9px'
                }}
              >
                <div style={{ fontWeight: idx === (playlist.current?.index - 1) ? 'bold' : 'normal' }}>
                  {idx === (playlist.current?.index - 1) ? '▶️ ' : `${idx + 1}. `}
                  {session.name}
                </div>
                <div style={{ opacity: 0.4, marginTop: '2px', fontSize: '8px' }}>
                  {session.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
