/**
 * SessionControl - Control de reproducción de sesiones EEG completas
 * 
 * Permite reproducir sesiones longitudinales cronológicamente con controles
 * tipo media player moderno (Spotify/YouTube style).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBrainStore, API_BASE } from '../store';

/**
 * Hook que anima la barra de progreso directamente en el DOM (sin setState),
 * evitando 60 re-renders/segundo que freezeíian React.
 *
 * Uso: const fillRef = useProgressAnimation(currentPercent, totalDuration, isPlaying, playbackSpeed)
 * Asigna fillRef al elemento <div> del fill. El hook muta style.width directo.
 */
function useProgressAnimation(serverPercent, totalDuration, isPlaying, playbackSpeed = 1) {
  const fillRef   = useRef(null);
  const timeRef   = useRef(null);
  const anchorRef = useRef({ percent: serverPercent, time: performance.now() });
  const rafRef    = useRef(null);

  // Re-anclar cuando llega un nuevo valor del servidor
  useEffect(() => {
    anchorRef.current = { percent: serverPercent, time: performance.now() };
    // Actualizar también el texto del tiempo
    if (timeRef.current && totalDuration > 0) {
      timeRef.current.textContent = formatSeconds((serverPercent / 100) * totalDuration);
    }
  }, [serverPercent, totalDuration]);

  // rAF loop: muta el DOM directamente, sin setState
  useEffect(() => {
    if (!isPlaying || totalDuration <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      if (fillRef.current) {
        const elapsed   = (performance.now() - anchorRef.current.time) / 1000;
        const increment = (elapsed * playbackSpeed / totalDuration) * 100;
        const projected = Math.min(anchorRef.current.percent + increment, 100);
        fillRef.current.style.width = `${projected}%`;
        if (timeRef.current) {
          timeRef.current.textContent = formatSeconds((projected / 100) * totalDuration);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, totalDuration, playbackSpeed]);

  return { fillRef, timeRef };
}

function formatSeconds(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SessionControl() {
  const setSessionPaused = useBrainStore((state) => state.setSessionPaused);
  const [sessionActive, setSessionActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [hoveredSession, setHoveredSession] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState(null);  // mensaje de error al conectar
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Estado local para velocidad
  const progressBarRef = useRef(null);
  // Ref para el último sessionStatus — evita stale closure dentro del setInterval
  const sessionStatusRef = useRef(null);

  // Animación de la barra: muta DOM directamente (sin setState a 60fps)
  const targetProgress = sessionStatus?.progress_percent || 0;
  const { fillRef: progressFillRef, timeRef: currentTimeRef } = useProgressAnimation(
    targetProgress,
    sessionStatus?.total_duration || 0,
    isPlaying && !isDragging,
    playbackSpeed
  );

  // Progreso para display en drag (sí necesita React state porque afecta otros elementos)
  const [displayPercent, setDisplayPercent] = useState(0);

  // Fetch session status cada 2s (rate limit: 60 r/min → 1 req/seg máx)
  // La barra de progreso se interpola localmente para mantener fluidez visual
  useEffect(() => {
    if (!sessionActive) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/session/status`);
        if (res.status === 429) { console.warn('[SessionControl] 429 rate limited'); return; }
        const data = await res.json();
        console.log(`[SessionControl] poll → pos=${data.current_position?.toFixed(2)}s  progress=${data.progress_percent?.toFixed(2)}%  playing=${data.is_playing}  session_active=${data.session_active}`);
        if (data.session_active) {
          // Guard: ignorar lecturas glitch (playing=false, pos≈0 mientras estábamos reproduciendo)
          // Usa ref para prevStatus — el closure del setInterval es stale si usamos el state directamente
          const prevStatus = sessionStatusRef.current;
          const isGlitch = !data.is_playing
            && (data.current_position ?? 0) < 1.0
            && prevStatus?.is_playing === true
            && (prevStatus?.current_position ?? 0) > 5.0;
          if (isGlitch) {
            console.warn(`[SessionControl] Skipping glitch reading: playing=false pos=0 while was at ${prevStatus.current_position?.toFixed(1)}s`);
            return;
          }
          sessionStatusRef.current = data;  // actualizar ref antes del setState
          setSessionStatus(data);
          if (data.is_playing !== undefined) {
            setIsPlaying(data.is_playing);
          }
          // Sincronizar velocidad desde backend
          if (data.playback_speed !== undefined) {
            setPlaybackSpeed(data.playback_speed);
          }
        } else {
          // Backend dice que no hay sesión activa — puede que el backend local
          // no tenga ficheros EDF cargados. Reseteamos para no quedar en Loading…
          console.warn('[SessionControl] Backend reports session_active=false, resetting to idle.');
          setSessionActive(false);
          setSessionStatus(null);
          sessionStatusRef.current = null;
          setSessionError(`No session active on ${API_BASE}. Start a session on the backend first.`);
        }
      } catch (err) {
        console.error('Error fetching session status:', err);
      }
    }, 2000); // 2s → 30 req/min, bien bajo el límite de 60 r/min
    
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
    setSessionError(null);
    setIsLoadingSession(true);
    // Timeout de 8s para no quedarse en loading si el backend no responde
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${API_BASE}/set-mode/session`, { method: 'POST', signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      if (data.status === 'success') {
        setSessionActive(true);
        setIsPlaying(true);
      } else {
        setSessionError(`Backend error: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      clearTimeout(timeout);
      const msg = err.name === 'AbortError'
        ? `Timeout connecting to ${API_BASE}. Is the backend running?`
        : `Cannot connect to ${API_BASE}. Is the backend running?`;
      console.error('[SessionControl] activateSessionMode failed:', err);
      setSessionError(msg);
    } finally {
      setIsLoadingSession(false);
    }
  };
  
  const togglePlayPause = async () => {
    if (!sessionActive) {
      await activateSessionMode();
    } else {
      try {
        if (isPlaying) {
          const res = await fetch(`${API_BASE}/session/pause`, { method: 'POST' });
          const data = await res.json();
          if (data.status === 'success') {
            setIsPlaying(false);
            setSessionPaused(true);  // Notificar al store para pausar audio binaural
          }
        } else {
          const res = await fetch(`${API_BASE}/session/play`, { method: 'POST' });
          const data = await res.json();
          if (data.status === 'success') {
            setIsPlaying(true);
            setSessionPaused(false);  // Notificar al store para reanudar audio binaural
          }
        }
      } catch (err) {
        console.error('Error toggling play/pause:', err);
      }
    }
  };
  
  const stopSession = async () => {
    try {
      // Tell backend to go back to idle so next activate starts fresh
      await fetch(`${API_BASE}/set-mode/idle`, { method: 'POST' }).catch(() => {});
    } catch (_) {}
    setSessionActive(false);
    setIsPlaying(false);
    setSessionStatus(null);
    setSessionPaused(true);
    setShowPlaylist(false);
    console.log('[SessionControl] Session stopped, backend set to idle');
  };
  
  const seekTo = async (seconds) => {
    try {
      await fetch(`${API_BASE}/session/seek/${seconds}`, { method: 'POST' });
    } catch (err) {
      console.error('Error seeking:', err);
    }
  };
  
  const setSpeed = async (speed) => {
    setPlaybackSpeed(speed); // Actualizar UI inmediatamente
    try {
      await fetch(`${API_BASE}/session/speed/${speed}`, { method: 'POST' });
    } catch (err) {
      console.error('Error setting speed:', err);
    }
  };

  // Helper: refresh playlist and force play
  const refreshPlaylistAndPlay = async () => {
    const [playlistRes] = await Promise.all([
      fetch(`${API_BASE}/playlist`),
      fetch(`${API_BASE}/session/play`, { method: 'POST' }),
    ]);
    const playlistData = await playlistRes.json();
    if (playlistData.status === 'success') setPlaylist(playlistData);
    setIsPlaying(true);
    setSessionPaused(false);
  };

  // Seleccionar sesión directamente por índice
  const selectSession = async (index) => {
    setIsLoadingSession(true);
    setSessionStatus(null); // clear stale data before loading new session
    try {
      const res = await fetch(`${API_BASE}/playlist/select/${index}`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshPlaylistAndPlay();
        console.log(`[SessionControl] Switched to session index ${index}`);
      }
    } catch (err) {
      console.error('Error selecting session:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };
  
  const nextSession = async () => {
    setIsLoadingSession(true);
    setSessionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/playlist/next`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshPlaylistAndPlay();
        console.log('[SessionControl] Advanced to next session');
      }
    } catch (err) {
      console.error('Error advancing to next session:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };
  
  const previousSession = async () => {
    setIsLoadingSession(true);
    setSessionStatus(null);
    try {
      const res = await fetch(`${API_BASE}/playlist/previous`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshPlaylistAndPlay();
        console.log('[SessionControl] Went to previous session');
      }
    } catch (err) {
      console.error('Error going to previous session:', err);
    } finally {
      setIsLoadingSession(false);
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress bar drag handling
  const handleProgressMouseDown = useCallback((e) => {
    if (!sessionStatus) return;
    setIsDragging(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setDragPercent(percent);
    setDisplayPercent(percent);
    if (progressFillRef.current) progressFillRef.current.style.width = `${percent}%`;
  }, [sessionStatus, progressFillRef]);

  const handleProgressMouseMove = useCallback((e) => {
    if (!isDragging || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setDragPercent(percent);
    setDisplayPercent(percent);
    if (progressFillRef.current) progressFillRef.current.style.width = `${percent}%`;
  }, [isDragging, progressFillRef]);

  const handleProgressMouseUp = useCallback((e) => {
    if (!isDragging || !sessionStatus) return;
    setIsDragging(false);
    const seekTime = (dragPercent / 100) * sessionStatus.total_duration;
    seekTo(seekTime);
  }, [isDragging, dragPercent, sessionStatus]);

  // Click to seek
  const handleProgressClick = (e) => {
    if (!sessionStatus) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const seekTime = (percent / 100) * sessionStatus.total_duration;
    seekTo(seekTime);
  };

  // Global mouse events for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleProgressMouseMove);
      window.addEventListener('mouseup', handleProgressMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleProgressMouseMove);
        window.removeEventListener('mouseup', handleProgressMouseUp);
      };
    }
  }, [isDragging, handleProgressMouseMove, handleProgressMouseUp]);
  
  if (!sessionActive) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '50px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'rgba(18, 18, 18, 0.95)',
        backdropFilter: 'blur(10px)',
        border: `1px solid ${sessionError ? 'rgba(255,80,80,0.35)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '8px',
        padding: '12px 24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        minWidth: '280px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%', justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', opacity: 0.5, letterSpacing: '0.5px' }}>
            📼 SESSION PLAYER
          </div>
          <button
            onClick={togglePlayPause}
            disabled={isLoadingSession}
            style={{
              background: isLoadingSession ? 'rgba(255,255,255,0.3)' : 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '24px',
              color: 'black',
              cursor: isLoadingSession ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '13px',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              transform: 'scale(1)'
            }}
            onMouseEnter={(e) => !isLoadingSession && (e.target.style.transform = 'scale(1.04)')}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {isLoadingSession ? '⏳ Connecting...' : '▶ PLAY'}
          </button>
        </div>
        {sessionError && (
          <div style={{
            fontSize: '10px',
            color: 'rgba(255,120,120,0.9)',
            fontFamily: 'monospace',
            textAlign: 'center',
            maxWidth: '340px',
            lineHeight: '1.4',
          }}>
            ⚠ {sessionError}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '320px',
      zIndex: 100,
      background: 'linear-gradient(180deg, rgba(18, 18, 18, 0.95) 0%, rgba(0, 0, 0, 0.98) 100%)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '12px 20px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#fff'
    }}>
      {/* Progress bar - Top (Spotify style) */}
      {sessionStatus && (
        <div style={{ marginBottom: '12px' }}>
          <div 
            ref={progressBarRef}
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '2px',
              position: 'relative',
              cursor: 'pointer',
            }}
            onMouseDown={handleProgressMouseDown}
            onClick={handleProgressClick}
            onMouseEnter={(e) => {
              e.currentTarget.style.height = '6px';
              const knob = e.currentTarget.querySelector('.progress-knob');
              if (knob) knob.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              if (!isDragging) {
                e.currentTarget.style.height = '4px';
                const knob = e.currentTarget.querySelector('.progress-knob');
                if (knob) knob.style.opacity = '0';
              }
            }}
          >
            {/* Progress fill — width controlled directly by rAF hook (no React re-render) */}
            <div
              ref={progressFillRef}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: `${targetProgress}%`,
                height: '100%',
                background: 'white',
                borderRadius: '2px',
              }}
            />

            {/* Draggable knob */}
            <div
              className="progress-knob"
              style={{
                position: 'absolute',
                left: `${isDragging ? displayPercent : targetProgress}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '12px',
                height: '12px',
                background: '#fff',
                borderRadius: '50%',
                opacity: isDragging ? 1 : 0,
                transition: 'opacity 0.15s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                cursor: 'grab'
              }}
            />
          </div>

          {/* Time indicators */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {/* ref-driven current time (updated by rAF without React re-render) */}
            <span ref={currentTimeRef}>{formatSeconds((targetProgress / 100) * sessionStatus.total_duration)}</span>
            <span>{formatSeconds(sessionStatus.total_duration)}</span>
          </div>
        </div>
      )}

      {/* Main controls row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Session info */}
        <div style={{ 
          flex: '0 0 200px',
          overflow: 'hidden'
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {sessionStatus?.session_metadata?.name || 'Loading...'}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.5)',
            marginTop: '2px'
          }}>
            {playlist?.current?.category || 'Session'}
          </div>
        </div>

        {/* Playback controls - Center */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Previous */}
          <button
            onClick={previousSession}
            disabled={isLoadingSession}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              color: isLoadingSession ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
              cursor: isLoadingSession ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => !isLoadingSession && (e.target.style.color = '#fff')}
            onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.7)'}
          >
            ⏮
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlayPause}
            style={{
              background: '#fff',
              border: 'none',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              color: '#000',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s ease'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.06)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Next */}
          <button
            onClick={nextSession}
            disabled={isLoadingSession}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px',
              color: isLoadingSession ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)',
              cursor: isLoadingSession ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => !isLoadingSession && (e.target.style.color = '#fff')}
            onMouseLeave={(e) => e.target.style.color = 'rgba(255,255,255,0.7)'}
          >
            ⏭
          </button>
        </div>

        {/* Right controls */}
        <div style={{ 
          flex: '0 0 200px',
          display: 'flex', 
          gap: '12px', 
          alignItems: 'center',
          justifyContent: 'flex-end'
        }}>
          {/* Speed selector */}
          {sessionStatus && (
            <select
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              value={playbackSpeed}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '6px 10px',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value={0.5}>0.5x</option>
              <option value={1.0}>1.0x</option>
              <option value={2.0}>2.0x</option>
              <option value={5.0}>5.0x</option>
            </select>
          )}
          
          {/* Playlist toggle */}
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            style={{
              background: showPlaylist ? 'rgba(29, 185, 84, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: showPlaylist ? '1px solid rgba(29, 185, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
              padding: '6px 14px',
              borderRadius: '4px',
              color: showPlaylist ? '#1db954' : '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
          >
            ☰ Queue
          </button>

          {/* Stop */}
          <button
            onClick={stopSession}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 100, 100, 0.3)',
              padding: '6px 12px',
              borderRadius: '4px',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'inherit',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 100, 100, 0.1)';
              e.target.style.borderColor = 'rgba(255, 100, 100, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
              e.target.style.borderColor = 'rgba(255, 100, 100, 0.3)';
            }}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Playlist popup */}
      {showPlaylist && playlist && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: '20px',
          marginBottom: '8px',
          width: '380px',
          maxHeight: '400px',
          background: 'rgba(24, 24, 24, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Queue</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
              {playlist.playlist?.length || 0} sessions
            </span>
          </div>

          {/* Now playing */}
          {playlist.current && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(29, 185, 84, 0.1)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{ fontSize: '10px', color: '#1db954', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Now Playing
              </div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>{playlist.current.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                {playlist.current.category}
              </div>
            </div>
          )}
          
          {/* Session list - Scrollable */}
          <div style={{
            maxHeight: '280px',
            overflowY: 'auto'
          }}>
            {playlist.playlist?.map((session, idx) => {
              const isCurrent = idx === (playlist.current?.index - 1);
              const isHovered = hoveredSession === idx;
              
              return (
                <div
                  key={idx}
                  onClick={() => !isCurrent && selectSession(idx)}
                  onMouseEnter={() => setHoveredSession(idx)}
                  onMouseLeave={() => setHoveredSession(null)}
                  style={{
                    padding: '10px 16px',
                    borderBottom: idx < playlist.playlist.length - 1 
                      ? '1px solid rgba(255, 255, 255, 0.03)' 
                      : 'none',
                    background: isCurrent 
                      ? 'rgba(29, 185, 84, 0.15)' 
                      : isHovered 
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'transparent',
                    cursor: isCurrent ? 'default' : 'pointer',
                    transition: 'background 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  {/* Index or playing indicator */}
                  <div style={{
                    width: '24px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: isCurrent ? '#1db954' : 'rgba(255,255,255,0.4)'
                  }}>
                    {isCurrent ? (
                      <span style={{ 
                        display: 'inline-block',
                        animation: isPlaying ? 'pulse 1s infinite' : 'none'
                      }}>♫</span>
                    ) : isHovered ? (
                      '▶'
                    ) : (
                      idx + 1
                    )}
                  </div>
                  
                  {/* Session info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: '13px',
                      fontWeight: isCurrent ? '500' : '400',
                      color: isCurrent ? '#1db954' : '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {session.name}
                    </div>
                    <div style={{ 
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.4)',
                      marginTop: '2px'
                    }}>
                      {session.category}
                      {session.duration > 0 && ` • ${formatTime(session.duration)}`}
                    </div>
                  </div>

                  {/* Type badge */}
                  <div style={{
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: session.type === 'recorded' 
                      ? 'rgba(147, 112, 219, 0.2)' 
                      : 'rgba(255,255,255,0.1)',
                    color: session.type === 'recorded' 
                      ? '#b19cd9' 
                      : 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px'
                  }}>
                    {session.type === 'recorded' ? 'REC' : session.type === 'meditation' ? 'MED' : 'DS'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Loading overlay */}
          {isLoadingSession && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(2px)'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid rgba(29, 185, 84, 0.3)',
                borderTopColor: '#1db954',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            </div>
          )}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
