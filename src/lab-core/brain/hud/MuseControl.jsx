/**
 * MuseControl - Control de conexión y calibración del Muse 2
 * 
 * Calibración mejorada con detección de parpadeos:
 * 1. Calidad de señal (verificar contacto) - 3s
 * 2. Parpadeos (detectar 5 parpadeos) - validación precisa
 * 3. Relajación (ojos cerrados) - baseline de alpha - 5s
 * 
 * También incluye grabación de sesiones EEG para reproducción posterior.
 */

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, useBrainStore } from '../store';

const MUSE_STATUS = {
  DISCONNECTED: 'disconnected',
  SCANNING: 'scanning',
  CONNECTED: 'connected',
  STREAMING: 'streaming',
  CALIBRATING: 'calibrating',
  ERROR: 'error'
};

const CALIBRATION_STEPS = {
  IDLE: 'idle',
  SIGNAL_CHECK: 'signal_check',
  BLINK_TEST: 'blink_test',
  RELAXATION: 'relaxation',
  COMPLETE: 'complete',
  FAILED: 'failed'
};

export default function MuseControl({ onModeChange }) {
  const [status, setStatus] = useState(MUSE_STATUS.DISCONNECTED);
  const [error, setError] = useState(null);
  const [signalQuality, setSignalQuality] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // Live EEG bands from WebSocket store
  const bands = useBrainStore(s => s.bands);
  const bandsDisplay = useBrainStore(s => s.bandsDisplay);
  const wsSource = useBrainStore(s => s.source);
  const wsCoherence = useBrainStore(s => s.coherence);
  
  // Calibración
  const [calibrationStep, setCalibrationStep] = useState(CALIBRATION_STEPS.IDLE);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationResults, setCalibrationResults] = useState(null);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [targetBlinks] = useState(5);
  const [baselineAlpha, setBaselineAlpha] = useState(null);
  const [relaxationPhase, setRelaxationPhase] = useState('open'); // 'open' o 'closed'
  const calibrationInterval = useRef(null);
  const confirmedBlinksRef = useRef(0); // Guardar blinks confirmados para evitar problemas de sincronización
  
  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSessionId, setRecordingSessionId] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef(null);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  
  // Audio context para sonidos
  const audioContextRef = useRef(null);

  // Función para reproducir un "pip"
  const playBeep = (frequency = 880, duration = 0.15) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio not available');
    }
  };

  // Polling del estado
  useEffect(() => {
    if (status !== MUSE_STATUS.STREAMING && status !== MUSE_STATUS.CALIBRATING) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/hardware/status`);
        const data = await res.json();
        if (data.signal_quality) {
          setSignalQuality(data.signal_quality);
        }
      } catch (err) {
        console.error('Error fetching status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      if (calibrationInterval.current) clearInterval(calibrationInterval.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);
  
  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const scanDevices = async () => {
    console.log('[MuseControl] scanDevices → POST', `${API_BASE}/hardware/connect-stream`);
    setStatus(MUSE_STATUS.SCANNING);
    setError(null);
    
    try {
      const streamRes = await fetch(`${API_BASE}/hardware/connect-stream`, { method: 'POST' });
      const streamData = await streamRes.json();
      console.log('[MuseControl] connect-stream response:', streamData);
      
      if (streamData.status === 'success') {
        setStatus(MUSE_STATUS.CONNECTED);
        return;
      }
    } catch (err) {
      console.warn('[MuseControl] connect-stream failed (no existing stream):', err.message);
    }
    
    try {
      console.log('[MuseControl] GET', `${API_BASE}/hardware/devices`);
      const res = await fetch(`${API_BASE}/hardware/devices`);
      const data = await res.json();
      console.log('[MuseControl] devices response:', data);
      
      if (data.devices?.length > 0) {
        setStatus(MUSE_STATUS.DISCONNECTED);
      } else {
        setError('No se encontró stream. Ejecuta: ./scripts/start_muse.sh');
        setStatus(MUSE_STATUS.ERROR);
      }
    } catch (err) {
      console.error('[MuseControl] devices fetch error:', err.message);
      setError('Error al conectar. ¿Backend corriendo?');
      setStatus(MUSE_STATUS.ERROR);
    }
  };

  const startStream = async () => {
    console.log('[MuseControl] startStream → POST', `${API_BASE}/hardware/stream/start`);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/hardware/stream/start`, { method: 'POST' });
      const data = await res.json();
      console.log('[MuseControl] stream/start response:', data);
      
      if (data.status === 'success') {
        setStatus(MUSE_STATUS.STREAMING);
        // Activar modo muse inmediatamente — el brain 3D muestra señal real durante calibración
        try {
          await fetch(`${API_BASE}/set-mode/muse`, { method: 'POST' });
          console.log('[MuseControl] WS switched to live Muse EEG');
          if (onModeChange) onModeChange('muse');
        } catch (e) {
          console.warn('[MuseControl] set-mode/muse failed:', e.message);
        }
        startCalibration();
      } else {
        console.error('[MuseControl] stream/start failed:', data);
        setError(data.message || 'Error al iniciar streaming');
      }
    } catch (err) {
      console.error('[MuseControl] stream/start error:', err.message);
      setError('Error al iniciar streaming');
    }
  };

  const disconnect = async () => {
    if (calibrationInterval.current) clearInterval(calibrationInterval.current);
    try {
      await fetch(`${API_BASE}/hardware/disconnect`, { method: 'POST' });
      setStatus(MUSE_STATUS.DISCONNECTED);
      setSignalQuality(null);
      setCalibrationStep(CALIBRATION_STEPS.IDLE);
      setCalibrationResults(null);
      if (onModeChange) onModeChange('dataset');
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  // ==================== CALIBRACIÓN ====================

  /**
   * logCal — fire-and-forget: envía un evento al backend para logging.
   * No bloquea — no afecta el timing de la calibración.
   */
  const logCal = (event, phase, data = {}) => {
    fetch(`${API_BASE}/hardware/calibration/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, phase, data }),
    }).catch(() => {}); // intencionalmente ignorado
  };
  
  const startCalibration = () => {
    setStatus(MUSE_STATUS.CALIBRATING);
    setCalibrationStep(CALIBRATION_STEPS.SIGNAL_CHECK);
    setCalibrationProgress(0);
    setCalibrationResults(null);
    setBlinkCount(0);
    setBaselineAlpha(null);
    setRelaxationPhase('open');
    logCal('calibration_start', 'init', {
      timestamp_iso: new Date().toISOString(),
      api_base: API_BASE,
    });
    runSignalCheck();
  };

  const runSignalCheck = async () => {
    setCalibrationStep(CALIBRATION_STEPS.SIGNAL_CHECK);
    let samples = [];
    let elapsed = 0;
    const duration = 3000;
    
    calibrationInterval.current = setInterval(async () => {
      elapsed += 200;
      setCalibrationProgress((elapsed / duration) * 100);
      
      try {
        const res = await fetch(`${API_BASE}/hardware/calibration/snapshot`);
        const data = await res.json();
        if (data.status === 'success') {
          samples.push(data);
          setCurrentMetrics(data);
          // Log every snapshot with full signal quality + bands
          logCal('signal_check_sample', 'signal_check', {
            elapsed_ms: elapsed,
            bands: data.bands,
            signal_quality: data.signal_quality,
            coherence: data.coherence,
          });
        }
      } catch (err) {}
      
      if (elapsed >= duration) {
        clearInterval(calibrationInterval.current);
        
        const avgQuality = samples.reduce((acc, s) => {
          const qualities = Object.values(s.signal_quality || {});
          return acc + (qualities.reduce((a, b) => a + b, 0) / qualities.length || 0);
        }, 0) / (samples.length || 1);
        
        logCal('signal_check_result', 'signal_check', {
          avgQuality: parseFloat(avgQuality.toFixed(4)),
          samplesCollected: samples.length,
          passed: avgQuality >= 0.2,
          threshold: 0.2,
          perElectrode_last: samples.at(-1)?.signal_quality || null,
        });

        if (avgQuality < 0.2) {
          setCalibrationStep(CALIBRATION_STEPS.FAILED);
          setCalibrationResults({ passed: false, reason: 'Señal muy débil. Ajusta la diadema.' });
          setStatus(MUSE_STATUS.STREAMING);
          logCal('calibration_failed', 'result', { reason: 'signal_too_weak', avgQuality });
        } else {
          setTimeout(() => runBlinkTest(), 500);
        }
      }
    }, 200);
  };

  const runBlinkTest = async () => {
    setCalibrationStep(CALIBRATION_STEPS.BLINK_TEST);
    setCalibrationProgress(0);
    setBlinkCount(0);
    confirmedBlinksRef.current = 0; // Reset ref
    let elapsed = 0;
    const duration = 20000; // 20 segundos para pestañear 5 veces
    let cooldownUntil = 0; // Para evitar contar el mismo parpadeo múltiples veces

    logCal('blink_test_start', 'blink_test', {
      target_blinks: targetBlinks,
      duration_ms: duration,
      poll_interval_ms: 300,
    });
    
    calibrationInterval.current = setInterval(async () => {
      elapsed += 300;
      setCalibrationProgress((elapsed / duration) * 100);
      
      const currentTime = Date.now();
      
      // Si estamos en cooldown, no procesar
      if (currentTime < cooldownUntil) {
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/hardware/calibration/blinks`);
        const data = await res.json();

        // Log every poll — useful to see what the signal looked like when NOT blinking
        logCal('blink_poll', 'blink_test', {
          elapsed_ms: elapsed,
          blink_count: data.blink_count,
          avg_amplitude: data.avg_amplitude,
          max_amplitude: data.max_amplitude,
          threshold: data.threshold,
          baseline: data.baseline,
          noise_level: data.noise_level,
          blink_times: data.blink_times,
          signal_quality: data.signal_quality,
        });

        if (data.status === 'success' && data.blink_count > 0) {
          // Detectamos parpadeo(s) en esta ventana
          // Solo contamos 1 por detección (las ventanas se solapan)
          confirmedBlinksRef.current += 1;
          
          // Cooldown de 800ms para evitar contar el mismo parpadeo
          cooldownUntil = currentTime + 800;
          
          // Sonido de confirmación
          playBeep(660, 0.08);
          
          // Actualizar UI
          const newCount = Math.min(confirmedBlinksRef.current, targetBlinks);
          setBlinkCount(newCount);
          
          console.log(`👁️ Blink detected! Total: ${confirmedBlinksRef.current}, Amplitude: ${data.avg_amplitude?.toFixed(1)}µV`);

          logCal('blink_detected', 'blink_test', {
            elapsed_ms: elapsed,
            confirmed_total: confirmedBlinksRef.current,
            avg_amplitude: data.avg_amplitude,
            max_amplitude: data.max_amplitude,
            threshold: data.threshold,
          });
        }
        setCurrentMetrics(data);
      } catch (err) {
        console.error('Error detecting blinks:', err);
      }
      
      // Éxito si detectamos los 5 parpadeos
      if (confirmedBlinksRef.current >= targetBlinks) {
        clearInterval(calibrationInterval.current);
        playBeep(880, 0.2); // Sonido de éxito
        logCal('blink_test_result', 'blink_test', {
          outcome: 'success_target_reached',
          confirmed_blinks: confirmedBlinksRef.current,
          target: targetBlinks,
          elapsed_ms: elapsed,
        });
        setTimeout(() => runRelaxationTest(), 800);
        return;
      }
      
      // Timeout
      if (elapsed >= duration) {
        clearInterval(calibrationInterval.current);
        if (confirmedBlinksRef.current >= 3) {
          // Al menos 3 parpadeos detectados, continuar
          playBeep(880, 0.2);
          logCal('blink_test_result', 'blink_test', {
            outcome: 'success_partial',
            confirmed_blinks: confirmedBlinksRef.current,
            target: targetBlinks,
            elapsed_ms: elapsed,
          });
          setTimeout(() => runRelaxationTest(), 800);
        } else {
          playBeep(330, 0.3); // Sonido de fallo
          setCalibrationStep(CALIBRATION_STEPS.FAILED);
          setCalibrationResults({ 
            passed: false, 
            reason: `Solo se detectaron ${confirmedBlinksRef.current} parpadeos de ${targetBlinks}. Pestañea con más fuerza y espera el "pip" de confirmación.`,
            blinksDetected: confirmedBlinksRef.current
          });
          setStatus(MUSE_STATUS.STREAMING);
          logCal('blink_test_result', 'blink_test', {
            outcome: 'failed',
            confirmed_blinks: confirmedBlinksRef.current,
            target: targetBlinks,
            elapsed_ms: elapsed,
          });
          logCal('calibration_failed', 'result', {
            reason: 'insufficient_blinks',
            confirmed_blinks: confirmedBlinksRef.current,
            target: targetBlinks,
            passed: false,
          });
        }
      }
    }, 300); // Polling cada 300ms
  };

  const runRelaxationTest = async () => {
    // Primero: capturar baseline alpha con OJOS ABIERTOS (3 segundos)
    setCalibrationStep(CALIBRATION_STEPS.RELAXATION);
    setCalibrationProgress(0);
    let eyesOpenSamples = [];
    let eyesClosedSamples = [];
    let elapsed = 0;
    const eyesOpenDuration = 4500;  // 4.5s ojos abiertos (1.5s warmup + 3s útiles)
    const eyesClosedDuration = 7400; // 7.4s ojos cerrados: 2.2s warmup (11 samples × 200ms) + 5.2s útiles
    const totalDuration = eyesOpenDuration + eyesClosedDuration;
    let phase = 'open'; // 'open' -> 'closed'
    let phaseBeeped = false;
    
    // Mensaje inicial
    setRelaxationPhase?.('open');

    logCal('relaxation_start', 'eyes_open', {
      eyes_open_duration_ms: eyesOpenDuration,
      eyes_closed_duration_ms: eyesClosedDuration,
      warmup_open_skip_ms: 1500,
      warmup_open_stable_n: 7,
      warmup_closed_skip_ms: 2200,
      poll_interval_ms: 200,
    });
    
    calibrationInterval.current = setInterval(async () => {
      elapsed += 200;
      setCalibrationProgress((elapsed / totalDuration) * 100);
      
      // Cambiar de fase: ojos abiertos -> ojos cerrados
      if (phase === 'open' && elapsed >= eyesOpenDuration) {
        phase = 'closed';
        playBeep(440, 0.3); // Pip grave para cerrar ojos
        setRelaxationPhase?.('closed');
        logCal('phase_changed', 'transition', {
          from: 'eyes_open',
          to: 'eyes_closed',
          elapsed_ms: elapsed,
          open_samples_collected: eyesOpenSamples.length,
          open_alpha_values: eyesOpenSamples.map(s => s.bands?.alpha),
        });
      }
      
      // Pip antes de terminar para abrir ojos
      if (phase === 'closed' && !phaseBeeped && elapsed >= totalDuration - 500) {
        playBeep(1200, 0.25); // Pip agudo para abrir ojos
        phaseBeeped = true;
      }
      
      try {
        const res = await fetch(`${API_BASE}/hardware/calibration/snapshot`);
        const data = await res.json();
        if (data.status === 'success') {
          if (phase === 'open') {
            eyesOpenSamples.push(data);
          } else {
            eyesClosedSamples.push(data);
          }
          setCurrentMetrics(data);
          console.log(`📊 Alpha snapshot [${phase}]: alpha=${data.bands?.alpha?.toFixed(1)}, beta=${data.bands?.beta?.toFixed(1)}`);

          // Log every sample with full bands + quality
          logCal('relaxation_sample', phase === 'open' ? 'eyes_open' : 'eyes_closed', {
            elapsed_ms: elapsed,
            phase,
            bands: data.bands,
            coherence: data.coherence,
            signal_quality: data.signal_quality,
          });
        }
      } catch (err) {
        console.error('Error fetching snapshot:', err);
      }
      
      if (elapsed >= totalDuration) {
        clearInterval(calibrationInterval.current);
        
        // --- WARMUP OJOS ABIERTOS ---
        // Descartar primeros 1500ms (artefactos del test de parpadeos al inicio)
        const warmupOpen   = Math.ceil(1500 / 200); // 8 muestras
        // Solo usar las primeras 7 muestras estables post-warmup (baseline real).
        // Log3 mostró un 'posterior alpha drift': tras 3-4s de ojos abiertos quieto,
        // el alpha posterior sube de 9µV² a 57-101µV² naturalmente.
        // Si incluimos esas muestras tardías, alpha_open queda inflado (26.7 vs 9.2 µV² real)
        // y el ratio aparece invertido (0.51x en vez de 1.44x).
        const openStableN  = 7;

        // --- WARMUP OJOS CERRADOS ---
        // La ventana Welch usa los últimos 2s del buffer.
        // La fase eyes_closed empieza en elapsed_ms ~4600.
        // Con warmup=8 (1600ms), el primer sample usado tiene ventana [4200-6200ms] → incluye 400ms
        // de la fase anterior → artefactos de transición (90, 46µV² en log3).
        // Para que la ventana esté ENTERAMENTE en eyes_closed: necesitamos t > transition + 2000ms.
        // Con margen de 200ms: warmup = 11 samples = 2200ms → ventana [4800, 6800ms] ≡ todo closed. ✅
        const warmupClosed = Math.ceil(2200 / 200); // 11 muestras

        const openFiltered   = eyesOpenSamples.slice(warmupOpen, warmupOpen + openStableN);
        const closedFiltered = eyesClosedSamples.slice(warmupClosed);
        const openToUse   = openFiltered.length > 2   ? openFiltered   : eyesOpenSamples.slice(warmupOpen);
        const closedToUse = closedFiltered.length > 2 ? closedFiltered : eyesClosedSamples;
        
        // Media recortada: descartar top 20% más altos (spikes)
        const trimmedMean = (arr, key, trimTop = 0.2) => {
          const vals = arr.map(s => s.bands?.[key] || 0).sort((a, b) => a - b);
          const cutoff = Math.floor(vals.length * (1 - trimTop));
          const trimmed = vals.slice(0, cutoff);
          return trimmed.reduce((a, b) => a + b, 0) / (trimmed.length || 1);
        };
        
        const avgAlphaOpen   = trimmedMean(openToUse, 'alpha');
        const avgAlphaClosed = trimmedMean(closedToUse, 'alpha');
        
        console.log(`📊 Alpha after warmup trim: open=${avgAlphaOpen.toFixed(1)} (${openToUse.length} samples, skipped ${warmupOpen}), closed=${avgAlphaClosed.toFixed(1)} (${closedToUse.length} samples, skipped ${warmupClosed})`);

        // Log complete computed analysis — the key diagnostic data
        logCal('relaxation_computed', 'analysis', {
          eyes_open: {
            raw_samples_count: eyesOpenSamples.length,
            warmup_skipped: warmupOpen,
            used_samples_count: openToUse.length,
            alpha_all_values: eyesOpenSamples.map(s => s.bands?.alpha),
            alpha_used_values: openToUse.map(s => s.bands?.alpha),
            avgAlpha: parseFloat(avgAlphaOpen.toFixed(3)),
            avgBeta: parseFloat(trimmedMean(openToUse, 'beta').toFixed(3)),
            avgTheta: parseFloat(trimmedMean(openToUse, 'theta').toFixed(3)),
            avgDelta: parseFloat(trimmedMean(openToUse, 'delta').toFixed(3)),
            avgGamma: parseFloat(trimmedMean(openToUse, 'gamma').toFixed(3)),
          },
          eyes_closed: {
            raw_samples_count: eyesClosedSamples.length,
            warmup_skipped: warmupClosed,
            used_samples_count: closedToUse.length,
            alpha_all_values: eyesClosedSamples.map(s => s.bands?.alpha),
            alpha_used_values: closedToUse.map(s => s.bands?.alpha),
            avgAlpha: parseFloat(avgAlphaClosed.toFixed(3)),
            avgBeta: parseFloat(trimmedMean(closedToUse, 'beta').toFixed(3)),
            avgTheta: parseFloat(trimmedMean(closedToUse, 'theta').toFixed(3)),
            avgDelta: parseFloat(trimmedMean(closedToUse, 'delta').toFixed(3)),
            avgGamma: parseFloat(trimmedMean(closedToUse, 'gamma').toFixed(3)),
          },
          alpha_ratio: parseFloat((avgAlphaClosed / (avgAlphaOpen || 1)).toFixed(4)),
          threshold: 0.5,
        });
        
        setBaselineAlpha(avgAlphaOpen);
        evaluateCalibration(avgAlphaOpen, avgAlphaClosed);
      }
    }, 200);
  };

  const evaluateCalibration = (alphaOpen, alphaClosed) => {
    // La calibración es exitosa si:
    // 1. Detectamos suficientes parpadeos (ya validado antes)
    // 2. Alpha con ojos cerrados es MAYOR que con ojos abiertos (fisiología normal)
    // Esto valida que realmente cerró los ojos y la señal es real
    
    const detectedBlinks = confirmedBlinksRef.current; // Usar ref para valor actualizado
    const alphaRatio = alphaClosed / (alphaOpen || 1);
    // 0.5 = tolerante: cualquier señal razonablemente real pasa
    // (después del warmup trim los valores son mucho más realistas)
    const alphaOk = alphaRatio > 0.5;
    const alphaIncreased = alphaRatio > 1.0;
    const passed = detectedBlinks >= 3 && alphaOk;
    
    console.log(`📊 Calibration evaluation: blinks=${detectedBlinks}, alphaOpen=${alphaOpen.toFixed(2)}, alphaClosed=${alphaClosed.toFixed(2)}, ratio=${alphaRatio.toFixed(2)}`);
    
    let reason;
    if (passed) {
      if (alphaIncreased) {
        reason = `✓ Calibración exitosa: Alpha aumentó ${((alphaRatio - 1) * 100).toFixed(0)}% al cerrar ojos`;
      } else {
        reason = `✓ Calibración exitosa: Señal EEG válida detectada`;
      }
    } else if (detectedBlinks < 3) {
      reason = `✕ Pocos parpadeos detectados (${detectedBlinks}/${targetBlinks})`;
    } else if (!alphaOk) {
      reason = `✕ Alpha disminuyó mucho al cerrar ojos (ratio: ${alphaRatio.toFixed(2)}). Verifica que el sensor esté bien colocado.`;
    } else {
      reason = '✕ No se pudo completar la calibración';
    }

    const evalData = {
      passed,
      blinks_detected: detectedBlinks,
      target_blinks: targetBlinks,
      alpha_open: parseFloat(alphaOpen.toFixed(3)),
      alpha_closed: parseFloat(alphaClosed.toFixed(3)),
      alpha_ratio: parseFloat(alphaRatio.toFixed(4)),
      alpha_ok: alphaOk,
      alpha_increased: alphaIncreased,
      threshold_ratio: 0.5,
      reason,
    };

    logCal('calibration_evaluated', 'result', evalData);
    logCal(passed ? 'calibration_complete' : 'calibration_failed', 'final', evalData);
    
    setCalibrationResults({
      passed,
      blinksDetected: detectedBlinks,
      targetBlinks: targetBlinks,
      alphaOpen: alphaOpen.toFixed(1),
      alphaClosed: alphaClosed.toFixed(1),
      alphaRatio: alphaRatio.toFixed(2),
      baselineAlpha: alphaOpen.toFixed(1),
      reason
    });
    
    setCalibrationStep(CALIBRATION_STEPS.COMPLETE);
    setStatus(MUSE_STATUS.STREAMING);
    
    if (passed) {
      setTimeout(async () => {
        await fetch(`${API_BASE}/set-mode/muse`, { method: 'POST' });
        if (onModeChange) onModeChange('muse');
      }, 1000);
    }
  };

  const skipCalibration = async () => {
    if (calibrationInterval.current) clearInterval(calibrationInterval.current);
    setCalibrationStep(CALIBRATION_STEPS.IDLE);
    setStatus(MUSE_STATUS.STREAMING);
    await fetch(`${API_BASE}/set-mode/muse`, { method: 'POST' });
    if (onModeChange) onModeChange('muse');
  };

  // ==================== GRABACIÓN ====================
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const startRecording = async () => {
    try {
      const res = await fetch(`${API_BASE}/recording/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName || `Sesión ${new Date().toLocaleString()}`,
          notes: sessionNotes,
          tags: ''
        })
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setIsRecording(true);
        setRecordingSessionId(data.session_id);
        setShowRecordingModal(false);
        setSessionName('');
        setSessionNotes('');
      } else {
        setError(data.message || 'Error al iniciar grabación');
      }
    } catch (err) {
      setError('Error al iniciar grabación');
    }
  };
  
  const stopRecording = async () => {
    try {
      const res = await fetch(`${API_BASE}/recording/stop`, { method: 'POST' });
      const data = await res.json();
      
      if (data.status === 'success') {
        setIsRecording(false);
        setRecordingSessionId(null);
        // Mostrar resumen breve
        console.log('Recording saved:', data.session);
      }
    } catch (err) {
      setError('Error al detener grabación');
    }
  };
  
  const addMarker = async (label) => {
    if (!isRecording) return;
    try {
      await fetch(`${API_BASE}/recording/marker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, event_type: 'marker' })
      });
    } catch (err) {
      console.error('Error adding marker:', err);
    }
  };

  // ==================== UI ====================

  const getStatusColor = () => {
    switch (status) {
      case MUSE_STATUS.STREAMING: return '#00ff88';
      case MUSE_STATUS.CALIBRATING: return '#ffaa00';
      case MUSE_STATUS.CONNECTED: return '#00aaff';
      case MUSE_STATUS.SCANNING: return '#ffaa00';
      case MUSE_STATUS.ERROR: return '#ff4444';
      default: return '#666';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case MUSE_STATUS.STREAMING: return '● LIVE EEG';
      case MUSE_STATUS.CALIBRATING: return '◐ Calibrando...';
      case MUSE_STATUS.CONNECTED: return '● Conectado';
      case MUSE_STATUS.SCANNING: return '○ Buscando...';
      case MUSE_STATUS.ERROR: return '● Error';
      default: return '○ Desconectado';
    }
  };

  const getCalibrationInstruction = () => {
    // Calcular tiempo restante basado en progreso
    const getTimeRemaining = (durationMs) => {
      const remaining = Math.ceil((durationMs * (100 - calibrationProgress) / 100) / 1000);
      return remaining;
    };
    
    switch (calibrationStep) {
      case CALIBRATION_STEPS.SIGNAL_CHECK:
        return { 
          emoji: '📡', 
          text: 'Verificando señal...', 
          subtext: 'Quédate quieto',
          timeRemaining: getTimeRemaining(3000),
          showTimer: true
        };
      case CALIBRATION_STEPS.BLINK_TEST:
        return { 
          emoji: '👁️', 
          text: 'PESTAÑEA FUERTE', 
          subtext: `${blinkCount} de ${targetBlinks} parpadeos detectados`,
          showBlinks: true
        };
      case CALIBRATION_STEPS.RELAXATION:
        if (relaxationPhase === 'open') {
          return { 
            emoji: '👀', 
            text: 'MANTÉN OJOS ABIERTOS', 
            subtext: 'Midiendo baseline... escucha el pip',
            timeRemaining: getTimeRemaining(8000),
            showTimer: true
          };
        } else {
          return { 
            emoji: '😌', 
            text: 'CIERRA LOS OJOS', 
            subtext: 'Relájate... pip para abrirlos',
            timeRemaining: getTimeRemaining(8000),
            showTimer: true
          };
        }
      default:
        return null;
    }
  };

  const renderSignalQuality = () => {
    if (!signalQuality) return null;
    const channels = ['TP9', 'AF7', 'AF8', 'TP10'];
    
    return (
      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: '5px' }}>ELECTRODOS</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {channels.map(ch => {
            const quality = signalQuality[ch] || 0;
            const color = quality > 0.7 ? '#00ff88' : quality > 0.4 ? '#ffaa00' : '#ff4444';
            return (
              <div key={ch} style={{ textAlign: 'center' }}>
                <div style={{ width: '30px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${quality * 100}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: '0.55rem', opacity: 0.5, marginTop: '2px' }}>{ch}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLiveBands = () => {
    const source = bandsDisplay || bands;
    if (!source) return null;

    const bandDefs = [
      { key: 'delta', label: 'δ Delta',  color: '#6366f1', desc: '1-4 Hz' },
      { key: 'theta', label: 'θ Theta',  color: '#8b5cf6', desc: '4-8 Hz' },
      { key: 'alpha', label: 'α Alpha',  color: '#00ff88', desc: '8-13 Hz' },
      { key: 'beta',  label: 'β Beta',   color: '#00aaff', desc: '13-30 Hz' },
      { key: 'gamma', label: 'γ Gamma',  color: '#ff6b35', desc: '30-50 Hz' },
    ];

    return (
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.58rem', opacity: 0.45, letterSpacing: '0.18em' }}>BANDAS EEG EN VIVO</div>
          {wsSource && (
            <div style={{ fontSize: '0.55rem', opacity: 0.4, color: '#00ff88' }}>
              {wsSource}
            </div>
          )}
        </div>

        {bandDefs.map(({ key, label, color, desc }) => {
          const raw = source[key] ?? 0;
          // bandsDisplay values are 0-1 normalized; raw bands may be larger
          const pct = Math.min(raw * 100, 100);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
              <span style={{ width: '52px', fontSize: '0.6rem', color, opacity: 0.85, whiteSpace: 'nowrap' }}>{label}</span>
              <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: '3px',
                  transition: 'width 0.25s ease',
                  boxShadow: `0 0 6px ${color}66`,
                }} />
              </div>
              <span style={{ width: '30px', fontSize: '0.58rem', color, textAlign: 'right', opacity: 0.75 }}>
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}

        {(wsCoherence !== undefined && wsCoherence !== null) && (
          <div style={{ marginTop: '7px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.57rem', opacity: 0.4 }}>Coherencia hemisférica</span>
            <span style={{ fontSize: '0.57rem', color: wsCoherence > 0.5 ? '#00ff88' : '#ffaa00', opacity: 0.8 }}>
              {(wsCoherence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCalibration = () => {
    const instruction = getCalibrationInstruction();
    
    if (!instruction && calibrationStep !== CALIBRATION_STEPS.COMPLETE && calibrationStep !== CALIBRATION_STEPS.FAILED) {
      return null;
    }
    
    return (
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '15px', marginTop: '10px', textAlign: 'center' }}>
        {instruction && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '5px' }}>{instruction.emoji}</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: calibrationStep === CALIBRATION_STEPS.EYES_CLOSED ? '#ffaa00' : '#00aaff', marginBottom: '5px' }}>
              {instruction.text}
            </div>
            
            {/* Contador de segundos restantes (para tests con timer) */}
            {instruction.showTimer && (
              <div style={{ 
                fontSize: '2.5rem', 
                fontWeight: 'bold', 
                color: calibrationStep === CALIBRATION_STEPS.RELAXATION ? '#ffaa00' : '#00aaff',
                marginBottom: '5px',
                fontFamily: 'monospace',
                textShadow: `0 0 20px ${calibrationStep === CALIBRATION_STEPS.RELAXATION ? '#ffaa0050' : '#00aaff50'}`
              }}>
                {instruction.timeRemaining}s
              </div>
            )}
            
            {/* Contador de parpadeos */}
            {instruction.showBlinks && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
                  {[...Array(targetBlinks)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: i < blinkCount ? '#00ff88' : 'rgba(255,255,255,0.2)',
                        border: `2px solid ${i < blinkCount ? '#00ff88' : 'rgba(255,255,255,0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        transition: 'all 0.3s',
                        transform: i < blinkCount ? 'scale(1.1)' : 'scale(1)'
                      }}
                    >
                      {i < blinkCount ? '✓' : ''}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '1.5rem', color: '#00ff88', fontWeight: 'bold' }}>
                  {blinkCount} / {targetBlinks}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '10px' }}>{instruction.subtext}</div>
            
            {/* Calidad de electrodos durante calibración — siempre visible */}
            {currentMetrics?.signal_quality && (() => {
              const sq = currentMetrics.signal_quality;
              const channels = ['TP9', 'AF7', 'AF8', 'TP10'];
              
              // Durante relajación, alpha viene de TP9/TP10 (posteriores).
              // AF7/AF8 no importan para esta fase — no mostrar falsa alarma.
              const isRelaxationPhase = calibrationStep === CALIBRATION_STEPS.RELAXATION;
              const criticalChannels = isRelaxationPhase ? ['TP9', 'TP10'] : channels;
              const badChannels = criticalChannels.filter(ch => (sq[ch] || 0) < 0.5);
              
              return (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '4px' }}>
                    {channels.map(ch => {
                      const q = sq[ch] || 0;
                      const isCritical = criticalChannels.includes(ch);
                      // Canales no críticos en esta fase se muestran más atenuados
                      const color = !isCritical
                        ? 'rgba(255,255,255,0.25)'
                        : q > 0.7 ? '#00ff88' : q > 0.4 ? '#ffaa00' : '#ff4444';
                      return (
                        <div key={ch} style={{ textAlign: 'center', opacity: isCritical ? 1 : 0.4 }}>
                          <div style={{ width: '28px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${q * 100}%`, height: '100%', background: color, transition: 'width 0.5s' }} />
                          </div>
                          <div style={{ fontSize: '0.5rem', marginTop: '2px', color }}>{ch}</div>
                        </div>
                      );
                    })}
                  </div>
                  {isRelaxationPhase && (
                    <div style={{ fontSize: '0.48rem', opacity: 0.35, marginBottom: '3px' }}>
                      Alpha medido desde TP9 + TP10
                    </div>
                  )}
                  {badChannels.length > 0 && (
                    <div style={{ fontSize: '0.6rem', color: '#ff6644', background: 'rgba(255,60,0,0.12)', borderRadius: '4px', padding: '3px 8px', display: 'inline-block' }}>
                      ⚠️ {badChannels.join(', ')} — señal débil, ajusta la diadema
                    </div>
                  )}
                </div>
              );
            })()}
            
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ width: `${calibrationStep === CALIBRATION_STEPS.BLINK_TEST ? (blinkCount / targetBlinks) * 100 : calibrationProgress}%`, height: '100%', background: calibrationStep === CALIBRATION_STEPS.RELAXATION ? '#ffaa00' : '#00aaff', transition: 'width 0.2s' }} />
            </div>
            
            {currentMetrics?.bands && calibrationStep === CALIBRATION_STEPS.RELAXATION && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  padding: '4px 12px', 
                  borderRadius: '12px',
                  background: relaxationPhase === 'closed' ? 'rgba(255,170,0,0.2)' : 'rgba(0,170,255,0.2)',
                  color: relaxationPhase === 'closed' ? '#ffaa00' : '#00aaff',
                  fontWeight: 'bold'
                }}>
                  {relaxationPhase === 'open' ? '👁️ OJOS ABIERTOS' : '😌 OJOS CERRADOS'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ opacity: 0.5 }}>α </span>
                    <span style={{ color: '#ffaa00', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {currentMetrics.bands.alpha?.toFixed(1) || '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ opacity: 0.5 }}>β </span>
                    <span style={{ color: '#00aaff' }}>
                      {currentMetrics.bands.beta?.toFixed(1) || '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <button onClick={skipCalibration} style={{ marginTop: '10px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', cursor: 'pointer' }}>
              Saltar →
            </button>
          </>
        )}
        
        {calibrationStep === CALIBRATION_STEPS.COMPLETE && calibrationResults && (
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>{calibrationResults.passed ? '✅' : '⚠️'}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: calibrationResults.passed ? '#00ff88' : '#ffaa00', marginBottom: '10px' }}>
              {calibrationResults.passed ? 'CALIBRACIÓN EXITOSA' : 'CALIBRACIÓN PARCIAL'}
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '10px' }}>{calibrationResults.reason}</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.7rem', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
              <div>
                <div style={{ opacity: 0.5 }}>Parpadeos</div>
                <div style={{ color: '#00ff88', fontWeight: 'bold' }}>{calibrationResults.blinksDetected} / {calibrationResults.targetBlinks}</div>
              </div>
              <div>
                <div style={{ opacity: 0.5 }}>Alpha ratio</div>
                <div style={{ color: parseFloat(calibrationResults.alphaRatio) > 1 ? '#00ff88' : '#ffaa00', fontWeight: 'bold' }}>
                  {calibrationResults.alphaRatio}x
                </div>
              </div>
              <div>
                <div style={{ opacity: 0.5 }}>α ojos abiertos</div>
                <div style={{ color: '#00aaff' }}>{calibrationResults.alphaOpen}</div>
              </div>
              <div>
                <div style={{ opacity: 0.5 }}>α ojos cerrados</div>
                <div style={{ color: '#ffaa00' }}>{calibrationResults.alphaClosed}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <ActionButton onClick={startCalibration} color="#ffaa00">↺ Recalibrar</ActionButton>
              <ActionButton onClick={async () => {
                await fetch(`${API_BASE}/set-mode/muse`, { method: 'POST' });
                if (onModeChange) onModeChange('muse');
                setCalibrationStep(CALIBRATION_STEPS.IDLE);
              }} color="#00ff88">▶ Continuar</ActionButton>
            </div>
          </div>
        )}
        
        {calibrationStep === CALIBRATION_STEPS.FAILED && calibrationResults && (
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>❌</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ff4444', marginBottom: '10px' }}>CALIBRACIÓN FALLIDA</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '15px' }}>{calibrationResults.reason}</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <ActionButton onClick={startCalibration} color="#ffaa00">↺ Reintentar</ActionButton>
              <ActionButton onClick={skipCalibration} color="#666">Continuar igual</ActionButton>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: 'rgba(0, 20, 40, 0.9)', border: `1px solid ${getStatusColor()}40`, borderRadius: '12px', padding: '15px', fontFamily: 'monospace', color: '#fff', minWidth: '280px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>🎧</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>MUSE 2 EEG</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: getStatusColor() }}>{getStatusText()}</div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(255, 50, 50, 0.2)', border: '1px solid rgba(255, 50, 50, 0.5)', borderRadius: '6px', padding: '8px', fontSize: '0.7rem', marginBottom: '10px', color: '#ff8888' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Instrucciones */}
      {status === MUSE_STATUS.DISCONNECTED && (
        <div style={{ marginBottom: '10px' }}>
          <button onClick={() => setShowInstructions(!showInstructions)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}>
            {showInstructions ? '▼' : '▶'} Instrucciones
          </button>
          
          {showInstructions && (
            <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,100,200,0.1)', borderRadius: '6px', fontSize: '0.65rem', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 5px 0' }}>1. Enciende el Muse (LED azul)</p>
              <p style={{ margin: '0 0 5px 0' }}>2. En terminal:</p>
              <code style={{ display: 'block', background: 'rgba(0,0,0,0.3)', padding: '5px', borderRadius: '4px', fontSize: '0.6rem', marginBottom: '5px' }}>
                cd backend && ./scripts/start_muse.sh
              </code>
              <p style={{ margin: '0' }}>3. Cuando veas "Streaming...", click Conectar</p>
            </div>
          )}
        </div>
      )}

      {/* Calibración */}
      {(status === MUSE_STATUS.CALIBRATING || calibrationStep === CALIBRATION_STEPS.COMPLETE || calibrationStep === CALIBRATION_STEPS.FAILED) && renderCalibration()}

      {/* Signal quality */}
      {status === MUSE_STATUS.STREAMING && calibrationStep === CALIBRATION_STEPS.IDLE && renderSignalQuality()}

      {/* Live EEG bands — visible while streaming (idle OR calibrating) */}
      {status === MUSE_STATUS.STREAMING && renderLiveBands()}
      {status === MUSE_STATUS.CALIBRATING && renderLiveBands()}

      {/* Recording section */}
      {status === MUSE_STATUS.STREAMING && calibrationStep === CALIBRATION_STEPS.IDLE && (
        <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
          {isRecording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Recording indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  background: '#ff4444',
                  animation: 'pulse 1s infinite'
                }} />
                <span style={{ fontSize: '0.75rem', color: '#ff4444', fontWeight: 'bold' }}>
                  ● REC {formatTime(recordingTime)}
                </span>
              </div>
              
              {/* Quick markers */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => addMarker('evento')} 
                  style={{ 
                    background: 'rgba(255,170,0,0.2)', 
                    border: '1px solid rgba(255,170,0,0.5)', 
                    borderRadius: '4px', 
                    padding: '4px 8px', 
                    fontSize: '0.6rem', 
                    color: '#ffaa00', 
                    cursor: 'pointer' 
                  }}
                  title="Agregar marcador"
                >
                  📍
                </button>
              </div>
              
              {/* Stop button */}
              <button
                onClick={stopRecording}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 12px',
                  background: 'rgba(255,68,68,0.2)',
                  border: '1px solid #ff4444',
                  borderRadius: '6px',
                  color: '#ff4444',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                ⏹ Detener
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowRecordingModal(true)}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,68,68,0.1)',
                border: '1px dashed rgba(255,68,68,0.5)',
                borderRadius: '8px',
                color: '#ff6666',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🔴 Grabar Sesión
            </button>
          )}
          
          {/* Recording modal */}
          {showRecordingModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div style={{
                background: 'rgba(0, 20, 40, 0.95)',
                border: '1px solid rgba(255,68,68,0.5)',
                borderRadius: '12px',
                padding: '20px',
                maxWidth: '350px',
                width: '90%'
              }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#ff6666' }}>
                  🔴 Nueva Grabación
                </h3>
                
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.7rem', opacity: 0.7, display: 'block', marginBottom: '5px' }}>
                    Nombre de la sesión
                  </label>
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Mi sesión de meditación..."
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.7rem', opacity: 0.7, display: 'block', marginBottom: '5px' }}>
                    Notas (opcional)
                  </label>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Experimento con respiración profunda..."
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowRecordingModal(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'rgba(100,100,100,0.2)',
                      border: '1px solid rgba(100,100,100,0.5)',
                      borderRadius: '6px',
                      color: '#888',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={startRecording}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'rgba(255,68,68,0.2)',
                      border: '1px solid #ff4444',
                      borderRadius: '6px',
                      color: '#ff4444',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🔴 Iniciar
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
          `}</style>
        </div>
      )}

      {/* Botones */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
        {status === MUSE_STATUS.DISCONNECTED && (
          <ActionButton onClick={scanDevices} color="#00aaff">🔌 Conectar</ActionButton>
        )}
        
        {status === MUSE_STATUS.SCANNING && (
          <ActionButton disabled color="#666">⏳ Buscando...</ActionButton>
        )}
        
        {status === MUSE_STATUS.CONNECTED && (
          <>
            <ActionButton onClick={startStream} color="#00ff88">▶ Iniciar + Calibrar</ActionButton>
            <ActionButton onClick={disconnect} color="#ff6666">✕</ActionButton>
          </>
        )}
        
        {status === MUSE_STATUS.STREAMING && calibrationStep === CALIBRATION_STEPS.IDLE && (
          <>
            <ActionButton onClick={startCalibration} color="#ffaa00">🎯 Recalibrar</ActionButton>
            <ActionButton onClick={disconnect} color="#ff6666">✕ Desconectar</ActionButton>
          </>
        )}
        
        {status === MUSE_STATUS.ERROR && (
          <ActionButton onClick={() => { setStatus(MUSE_STATUS.DISCONNECTED); setError(null); }} color="#666">↺ Reintentar</ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({ children, onClick, color, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        minWidth: '80px',
        padding: '10px 12px',
        background: disabled ? 'rgba(100,100,100,0.3)' : `${color}20`,
        border: `1px solid ${disabled ? 'rgba(100,100,100,0.3)' : color}`,
        borderRadius: '8px',
        color: disabled ? '#666' : color,
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        fontWeight: 'bold'
      }}
      onMouseEnter={(e) => { if (!disabled) e.target.style.background = `${color}40`; }}
      onMouseLeave={(e) => { if (!disabled) e.target.style.background = `${color}20`; }}
    >
      {children}
    </button>
  );
}
