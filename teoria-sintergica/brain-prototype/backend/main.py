from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import time
import asyncio
import asyncpg
import os
from models import SyntergicState, FrequencyBands, Vector3
from ai.inference import SyntergicBrain
from hardware import MuseConnector, MuseToSyntergicAdapter
# Legacy SQLite (for backward compatibility)
from database import get_database, get_recorder, SessionRecorder
# New PostgreSQL + InfluxDB
from database import get_recorder_v2, SessionRecorderV2
# Analytics
from analytics.router import router as analytics_router
from analytics.service import AnalyticsService

from automation import router as automation_router
from automation.service import AutomationService

app = FastAPI(title="Syntergic Brain API v0.4")


# Pydantic models for requests
class RecordingStartRequest(BaseModel):
    name: Optional[str] = ""
    notes: Optional[str] = ""
    tags: Optional[str] = ""

class MarkerRequest(BaseModel):
    label: str
    event_type: Optional[str] = "marker"

# Inicializar el Cerebro Digital (Carga modelo y datos)
print("=" * 60)
print("SYNTERGIC BRAIN API - Initializing...")
print("=" * 60)
brain = SyntergicBrain()

# Inicializar conector Muse 2 (hardware)
print("✓ Initializing Muse 2 connector...")
muse_connector = MuseConnector()

# Inicializar recorder v2 (PostgreSQL + InfluxDB)
session_recorder: Optional[SessionRecorderV2] = None

# Legacy SQLite database (for old sessions)
print("✓ Initializing session database...")
session_db = get_database()
print("=" * 60)

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://random-studio.io",
        "https://www.random-studio.io"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Analytics Integration
# ============================================
@app.on_event("startup")
async def startup():
    """Initialize analytics database connection pool"""
    analytics_pool = await asyncpg.create_pool(
        host=os.getenv("ANALYTICS_DB_HOST", "localhost"),
        port=int(os.getenv("ANALYTICS_DB_PORT", "5432")),
        user=os.getenv("ANALYTICS_DB_USER", "analytics_user"),
        password=os.getenv("ANALYTICS_DB_PASSWORD", "random_sanyi_mapuche"),
        database=os.getenv("ANALYTICS_DB_NAME", "random_analytics"),
        min_size=10,
        max_size=20,
    )
    app.state.analytics_pool = analytics_pool
    app.state.db_pool = analytics_pool  # Alias para automation service
    app.state.analytics_service = AnalyticsService(analytics_pool)
    print("Analytics database pool created")

    app.state.automation_service = AutomationService(app.state.db_pool)
    print("Automation service initialized")


@app.on_event("shutdown")
async def shutdown():
    """Close analytics database connection pool"""
    if hasattr(app.state, "analytics_pool"):
        await app.state.analytics_pool.close()
        print("✓ Analytics database pool closed")

# Include analytics router
app.include_router(analytics_router)

# Include automation router
app.include_router(automation_router)

# ============================================
# Brain Endpoints
# ============================================

@app.get("/")
def read_root():
    return {"status": "active", "message": "Syntergic VAE Online"}

@app.post("/set-mode/{mode}")
async def set_mode(mode: str):
    """
    Cambia el estado cognitivo del cerebro digital.
    
    Modos disponibles:
    - 'relax': Dataset de ojos cerrados (relajación)
    - 'focus': Dataset de motor imagery (concentración)
    - 'session': Reproducción cronológica de sesión completa
    - 'muse': Hardware Muse 2 en vivo (requiere conexión activa)
    """
    # Muse mode requires passing the connector
    if mode == 'muse':
        if not muse_connector.is_streaming:
            return {"status": "error", "message": "Muse 2 not streaming. Connect and start stream first."}
        success = brain.set_mode('muse', muse_connector=muse_connector)
        if success:
            return {"status": "success", "mode": "muse", "message": "Now using LIVE EEG from Muse 2"}
        return {"status": "error", "message": "Failed to switch to Muse mode"}
    
    success = brain.set_mode(mode)
    if success:
        return {"status": "success", "mode": mode, "message": f"Brain switched to {mode} mode"}
    return {"status": "error", "message": "Invalid mode. Use 'relax', 'focus', 'session', or 'muse'"}

@app.get("/session/status")
async def get_session_status():
    """
    Obtiene estado actual del reproductor de sesiones.
    """
    if brain.session_mode_active:
        status = brain.session_player.get_status()
        return {
            "status": "success",
            "session_active": True,
            **status
        }
    return {
        "status": "success",
        "session_active": False,
        "message": "Session player not active. Use /set-mode/session to activate."
    }

@app.post("/session/seek/{position}")
async def seek_session(position: float):
    """
    Salta a posición específica en la sesión (segundos).
    """
    if not brain.session_mode_active:
        return {"status": "error", "message": "Session mode not active"}
    
    brain.session_player.seek(position)
    return {
        "status": "success",
        "message": f"Seeked to {position}s",
        "new_position": brain.session_player.current_position
    }

@app.post("/session/speed/{speed}")
async def set_session_speed(speed: float):
    """
    Ajusta velocidad de reproducción (0.5 = mitad, 1.0 = normal, 2.0 = doble).
    """
    if not brain.session_mode_active:
        return {"status": "error", "message": "Session mode not active"}
    
    brain.session_player.set_speed(speed)
    return {
        "status": "success",
        "playback_speed": brain.session_player.playback_speed
    }

@app.post("/session/play")
async def play_session():
    """
    Inicia/reanuda reproducción de la sesión.
    """
    if not brain.session_mode_active:
        return {"status": "error", "message": "Session mode not active"}
    
    brain.session_player.play()
    return {
        "status": "success",
        "message": "Session playing",
        "is_playing": brain.session_player.is_playing
    }

@app.post("/session/pause")
async def pause_session():
    """
    Pausa reproducción de la sesión.
    """
    if not brain.session_mode_active:
        return {"status": "error", "message": "Session mode not active"}
    
    brain.session_player.pause()
    return {
        "status": "success",
        "message": "Session paused",
        "is_playing": brain.session_player.is_playing
    }

@app.get("/session/timeline")
async def get_session_timeline():
    """
    Obtiene marcadores temporales de la sesión.
    """
    if not brain.session_mode_active:
        return {"status": "error", "message": "Session mode not active"}
    
    markers = brain.session_player.get_timeline_markers()
    return {
        "status": "success",
        "markers": markers,
        "total_duration": brain.session_player.total_duration
    }

# --- PLAYLIST ENDPOINTS ---

@app.get("/playlist")
async def get_playlist():
    """Lista todas las sesiones disponibles en el playlist."""
    playlist = brain.get_playlist()
    current_info = brain.get_current_playlist_info()
    return {
        "status": "success",
        "playlist": playlist,
        "current": current_info
    }

@app.post("/playlist/next")
async def playlist_next():
    """Avanza a la siguiente sesión del playlist."""
    session_info = brain.next_playlist_session()
    if session_info:
        return {
            "status": "success",
            "message": f"Advanced to {session_info['name']}",
            "session": session_info
        }
    return {
        "status": "error",
        "message": "Could not advance (end of playlist or error)"
    }

@app.post("/playlist/previous")
async def playlist_previous():
    """Retrocede a la sesión anterior del playlist."""
    session_info = brain.previous_playlist_session()
    if session_info:
        return {
            "status": "success",
            "message": f"Went back to {session_info['name']}",
            "session": session_info
        }
    return {
        "status": "error",
        "message": "Could not go back (start of playlist or error)"
    }

@app.post("/playlist/select/{index}")
async def playlist_select(index: int):
    """Selecciona una sesión específica del playlist por índice."""
    session_info = brain.select_playlist_session(index)
    if session_info:
        return {
            "status": "success",
            "message": f"Selected {session_info['name']}",
            "session": session_info
        }
    return {
        "status": "error",
        "message": f"Invalid session index: {index}"
    }

@app.post("/playlist/refresh")
async def refresh_playlist():
    """Recarga las sesiones grabadas en el playlist."""
    brain.playlist.refresh_recorded_sessions()
    playlist = brain.get_playlist()
    return {
        "status": "success",
        "message": "Playlist refreshed",
        "playlist": playlist,
        "count": len(playlist)
    }

# =============================================================================
# HARDWARE ENDPOINTS (Muse 2)
# =============================================================================

@app.get("/hardware/devices")
async def discover_devices():
    """
    Busca dispositivos Muse 2 disponibles vía Bluetooth.
    
    Returns:
        Lista de dispositivos encontrados con nombre, dirección y RSSI.
    """
    devices = muse_connector.discover(timeout=10.0)
    return {
        "status": "success",
        "devices": [d.to_dict() for d in devices],
        "count": len(devices)
    }

@app.post("/hardware/connect-stream")
async def connect_to_existing_stream():
    """
    Conecta a un stream LSL existente.
    
    Útil cuando el Muse ya está streameando via 'start_muse.sh' en otra terminal.
    No requiere descubrir ni conectar el dispositivo directamente.
    """
    success = muse_connector.connect_to_existing_stream()
    if success:
        return {
            "status": "success",
            "message": "Connected to existing LSL stream",
            "device": muse_connector.device_info.to_dict() if muse_connector.device_info else None
        }
    return {
        "status": "error",
        "message": muse_connector.error_message or "No stream found"
    }

@app.post("/hardware/connect/{address}")
async def connect_hardware(address: str):
    """
    Conecta a un Muse 2 específico.
    
    Args:
        address: MAC address del dispositivo (ej: "XX:XX:XX:XX:XX:XX")
    """
    # Decodificar address (puede venir URL-encoded)
    address = address.replace("-", ":")
    
    success = muse_connector.connect(address)
    if success:
        return {
            "status": "success",
            "message": f"Connected to Muse 2: {address}",
            "device": muse_connector.device_info.to_dict() if muse_connector.device_info else None
        }
    return {
        "status": "error",
        "message": muse_connector.error_message or "Connection failed"
    }

@app.post("/hardware/disconnect")
async def disconnect_hardware():
    """Desconecta del Muse 2 actual."""
    muse_connector.disconnect()
    # Si estaba en modo muse, volver a modo dataset
    if brain.current_mode == 'muse':
        brain.set_mode('focus')
    return {
        "status": "success",
        "message": "Disconnected from Muse 2"
    }

@app.get("/hardware/status")
async def hardware_status():
    """
    Obtiene estado completo del hardware Muse 2.
    
    Returns:
        Status, info del dispositivo, calidad de señal, estado del buffer.
    """
    status = muse_connector.get_status()
    
    # Agregar info adicional si está streaming
    if muse_connector.is_streaming:
        status['buffer'] = muse_connector.get_buffer_status()
        status['signal_quality'] = muse_connector.get_signal_quality()
    
    return {
        "status": "success",
        **status
    }

@app.post("/hardware/stream/start")
async def start_hardware_stream():
    """Inicia el streaming de datos EEG desde el Muse 2."""
    if not muse_connector.is_connected:
        return {
            "status": "error",
            "message": "No device connected. Use /hardware/connect first."
        }
    
    success = muse_connector.start_stream()
    if success:
        return {
            "status": "success",
            "message": "EEG streaming started"
        }
    return {
        "status": "error",
        "message": muse_connector.error_message or "Failed to start stream"
    }

@app.post("/hardware/stream/stop")
async def stop_hardware_stream():
    """Detiene el streaming de datos EEG."""
    muse_connector.stop_stream()
    return {
        "status": "success",
        "message": "EEG streaming stopped"
    }

@app.post("/set-mode/muse")
async def set_mode_muse():
    """
    Activa modo hardware Muse 2.
    
    Requiere que el Muse esté conectado y streameando.
    Las métricas se calcularán en tiempo real desde el EEG.
    """
    if not muse_connector.is_streaming:
        return {
            "status": "error",
            "message": "Muse 2 not streaming. Connect and start stream first."
        }
    
    success = brain.set_mode('muse', muse_connector=muse_connector)
    if success:
        return {
            "status": "success",
            "mode": "muse",
            "message": "Now using LIVE EEG from Muse 2"
        }
    return {
        "status": "error",
        "message": "Failed to switch to Muse mode"
    }


@app.get("/hardware/calibration/snapshot")
async def get_calibration_snapshot():
    """
    Obtiene una instantánea de métricas EEG para calibración.
    
    Devuelve las bandas de frecuencia y coherencia actuales.
    Usado para las pruebas rápidas de validación (ojos abiertos/cerrados).
    """
    if not muse_connector.is_streaming:
        return {
            "status": "error",
            "message": "Muse not streaming"
        }
    
    # Obtener ventana de datos (2 segundos)
    window = muse_connector.get_window(duration=2.0)
    
    if window is None:
        return {
            "status": "error",
            "message": "No data available yet"
        }
    
    try:
        import numpy as np
        from scipy.signal import welch
        
        data = window.data  # (n_channels, n_samples)
        fs = window.fs
        
        # Usar Welch para PSD más estable (reduce ruido)
        # Para alpha, los canales posteriores (TP9=0, TP10=3) son más relevantes
        # pero también incluimos frontales para una medida general
        
        # Calcular PSD por canal usando Welch
        all_psd = []
        posterior_psd = []  # TP9 y TP10 para alpha
        
        for ch_idx in range(data.shape[0]):
            freqs_welch, psd = welch(data[ch_idx], fs=fs, nperseg=min(256, data.shape[1]))
            all_psd.append(psd)
            # Canales posteriores: TP9 (0) y TP10 (3)
            if ch_idx == 0 or ch_idx == 3:
                posterior_psd.append(psd)
        
        # Promediar PSD
        psd_mean = np.mean(all_psd, axis=0)
        psd_posterior = np.mean(posterior_psd, axis=0) if posterior_psd else psd_mean
        
        freqs = freqs_welch
        
        # Función helper para calcular potencia en banda
        def band_power(psd, freqs, fmin, fmax):
            idx = (freqs >= fmin) & (freqs < fmax)
            return float(np.sum(psd[idx]))  # Suma de potencia en la banda
        
        # Bandas de frecuencia (usando todos los canales)
        bands = {
            'delta': band_power(psd_mean, freqs, 0.5, 4),
            'theta': band_power(psd_mean, freqs, 4, 8),
            'alpha': band_power(psd_posterior, freqs, 8, 13),  # Alpha desde canales posteriores!
            'beta': band_power(psd_mean, freqs, 13, 30),
            'gamma': band_power(psd_mean, freqs, 30, 50)
        }
        
        # Log periódico para monitoreo de alpha
        import random
        if random.random() < 0.1:
            print(f"📊 Alpha snapshot: alpha={bands['alpha']:.2f}, beta={bands['beta']:.2f}, theta={bands['theta']:.2f}")
        
        # Coherencia inter-hemisférica
        if data.shape[0] >= 4:
            left = np.mean(data[:2], axis=0)  # TP9, AF7
            right = np.mean(data[2:4], axis=0)  # AF8, TP10
            if np.std(left) > 0 and np.std(right) > 0:
                coherence = float((np.corrcoef(left, right)[0, 1] + 1) / 2)
            else:
                coherence = 0.5
        else:
            coherence = 0.5
        
        # Calidad de señal por canal
        signal_quality = muse_connector.get_signal_quality()
        
        return {
            "status": "success",
            "bands": bands,
            "coherence": coherence,
            "signal_quality": signal_quality,
            "timestamp": window.timestamp
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@app.get("/hardware/calibration/blinks")
async def detect_blinks():
    """
    Detecta parpadeos en la señal EEG.
    
    Los parpadeos generan artefactos muy distintivos en los canales frontales
    (AF7, AF8) - picos de alta amplitud fáciles de detectar.
    
    Returns:
        blink_count: Número de parpadeos detectados en la última ventana
        blink_times: Timestamps relativos de cada parpadeo
        avg_amplitude: Amplitud promedio de los parpadeos
    """
    if not muse_connector.is_streaming:
        return {
            "status": "error",
            "message": "Muse not streaming"
        }
    
    # Ventana de 1 segundo (más corta para detección más puntual)
    window = muse_connector.get_window(duration=1.0)
    
    if window is None:
        return {
            "status": "error",
            "message": "No data available yet"
        }
    
    try:
        import numpy as np
        from scipy.signal import find_peaks, butter, filtfilt
        
        data = window.data  # (n_channels, n_samples)
        fs = window.fs
        
        # Usar canales frontales (AF7=1, AF8=2) donde los parpadeos son más visibles
        if data.shape[0] >= 3:
            frontal = (data[1] + data[2]) / 2  # Promedio AF7 + AF8
        else:
            frontal = data[0]
        
        # Filtro paso banda para aislar frecuencias de parpadeo (0.5-10 Hz)
        # Los parpadeos tienen componentes de baja frecuencia
        try:
            b, a = butter(2, [0.5, 10], btype='band', fs=fs)
            frontal_filtered = filtfilt(b, a, frontal)
        except:
            frontal_filtered = frontal
        
        # Los parpadeos son artefactos MUY grandes (50-200 µV vs 10-20 µV señal normal)
        # Usamos la señal absoluta para detectar picos en ambas direcciones
        frontal_abs = np.abs(frontal_filtered)
        
        # Calcular estadísticas robustas usando PERCENTILES BAJOS
        # para excluir los propios parpadeos del cálculo de baseline
        baseline = np.percentile(frontal_abs, 50)  # Mediana como baseline
        noise_level = np.percentile(frontal_abs, 75) - np.percentile(frontal_abs, 25)  # IQR
        
        # UMBRAL FIJO - Los parpadeos reales son >100µV típicamente
        # Subimos el umbral para evitar falsos positivos por ruido
        threshold_fixed = 150.0  # µV - umbral absoluto para parpadeos (antes 75)
        threshold_adaptive = baseline + 4.0 * max(noise_level, 20.0)  # 4x ruido (antes 3x)
        
        # Usar el MAYOR de los dos para ser más estrictos
        min_amplitude = max(threshold_fixed, threshold_adaptive)
        # Pero nunca menos de 120µV para evitar falsos positivos con señal ruidosa
        min_amplitude = max(min_amplitude, 120.0)
        
        # Detectar picos (parpadeos)
        # distance: mínimo 400ms entre parpadeos (fisiológicamente realista)
        min_distance = int(0.4 * fs)
        peaks, properties = find_peaks(
            frontal_abs, 
            height=min_amplitude,
            distance=min_distance,
            prominence=50.0  # Prominencia más alta: 50µV (antes 25µV)
        )
        
        # Calcular timestamps relativos
        blink_times = (peaks / fs).tolist()
        
        # Amplitudes de los parpadeos detectados
        if len(peaks) > 0:
            amplitudes = frontal_abs[peaks]
            avg_amplitude = float(np.mean(amplitudes))
            max_amplitude = float(np.max(amplitudes))
            # Los parpadeos válidos deben tener amplitud significativa
            valid_peaks = [i for i, amp in enumerate(amplitudes) if amp > min_amplitude]
            valid_blinks = [blink_times[i] for i in valid_peaks]
            blink_count = len(valid_blinks)
            # Log para debug
            if blink_count > 0:
                print(f"👁️ BLINK DETECTED: count={blink_count}, max_amp={max_amplitude:.1f}µV, threshold={min_amplitude:.1f}µV")
        else:
            avg_amplitude = 0.0
            max_amplitude = 0.0
            valid_blinks = []
            blink_count = 0
        
        # Calidad de señal
        signal_quality = muse_connector.get_signal_quality()
        
        # Log periódico para monitoreo (solo cada 10 llamadas aprox)
        import random
        if random.random() < 0.1:
            print(f"📊 Blink monitor: max_signal={np.max(frontal_abs):.1f}µV, threshold={min_amplitude:.1f}µV, baseline={baseline:.1f}, noise={noise_level:.1f}")
        
        return {
            "status": "success",
            "blink_count": blink_count,
            "blink_times": valid_blinks,
            "avg_amplitude": avg_amplitude,
            "max_amplitude": max_amplitude if blink_count > 0 else float(np.max(frontal_abs)),
            "threshold": float(min_amplitude),
            "baseline": float(baseline),
            "noise_level": float(noise_level),
            "signal_quality": signal_quality,
            "window_duration": 1.0
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# =============================================================================
# RECORDING ENDPOINTS (Session Recording)
# =============================================================================

@app.post("/recording/start")
async def start_recording(request: RecordingStartRequest):
    """
    Inicia grabación de una sesión EEG.
    
    Requiere que el Muse esté streameando datos.
    Graba datos raw EEG y métricas calculadas.
    
    Almacena:
    - Metadata → PostgreSQL (eeg_recordings)
    - Samples + Metrics → InfluxDB
    
    Args:
        name: Nombre de la sesión (opcional)
        notes: Notas sobre la sesión
        tags: Tags separados por coma
    """
    global session_recorder
    
    if not muse_connector.is_streaming:
        return {
            "status": "error",
            "message": "Muse not streaming. Connect and start stream first."
        }
    
    # Crear recorder v2 si no existe (PostgreSQL + InfluxDB)
    if session_recorder is None:
        session_recorder = SessionRecorderV2(muse_connector)
    
    # Verificar que no esté grabando ya
    if session_recorder.is_recording:
        return {
            "status": "error", 
            "message": "Already recording",
            "recording_id": session_recorder.recording_id
        }
    
    try:
        recording_id = session_recorder.start(
            name=request.name or "",
            notes=request.notes or "",
            tags=request.tags or ""
        )
        return {
            "status": "success",
            "message": "Recording started (PostgreSQL + InfluxDB)",
            "recording_id": recording_id
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.post("/recording/stop")
async def stop_recording():
    """
    Detiene la grabación actual y finaliza la sesión.
    
    Returns:
        Resumen de la sesión grabada incluyendo duración y cantidad de muestras.
    """
    global session_recorder
    
    if session_recorder is None or not session_recorder.is_recording:
        return {
            "status": "error",
            "message": "Not recording"
        }
    
    summary = session_recorder.stop()
    
    # Refrescar playlist para incluir la nueva sesión
    brain.playlist.refresh_recorded_sessions()
    
    return {
        "status": "success",
        "message": "Recording stopped",
        "session": summary
    }

@app.get("/recording/status")
async def get_recording_status():
    """
    Obtiene estado actual de la grabación.
    """
    global session_recorder
    
    if session_recorder is None:
        return {
            "status": "success",
            "recording": False,
            "message": "Recorder not initialized"
        }
    
    return {
        "status": "success",
        **session_recorder.stats
    }

@app.post("/recording/marker")
async def add_recording_marker(request: MarkerRequest):
    """
    Agrega un marcador/evento a la grabación actual.
    
    Útil para marcar estímulos, cambios de estado, etc.
    
    Args:
        label: Etiqueta del marcador (ej: "eyes_closed", "stimulus_1")
        event_type: Tipo de evento (default: "marker")
    """
    global session_recorder
    
    if session_recorder is None or not session_recorder.is_recording:
        return {
            "status": "error",
            "message": "Not recording"
        }
    
    session_recorder.add_marker(request.label, request.event_type)
    return {
        "status": "success",
        "message": f"Marker '{request.label}' added"
    }


# =============================================================================
# SESSIONS ENDPOINTS (Session Management & Playback)
# =============================================================================

@app.get("/sessions")
async def list_sessions(limit: int = 50, offset: int = 0):
    """
    Lista todas las sesiones grabadas.
    
    Args:
        limit: Cantidad máxima de sesiones a devolver
        offset: Offset para paginación
    """
    sessions = session_db.list_sessions(limit, offset)
    return {
        "status": "success",
        "sessions": sessions,
        "count": len(sessions)
    }

@app.get("/sessions/{session_id}")
async def get_session(session_id: int):
    """
    Obtiene detalles de una sesión específica.
    """
    session = session_db.get_session(session_id)
    if session is None:
        return {
            "status": "error",
            "message": f"Session {session_id} not found"
        }
    
    summary = session_db.get_session_summary(session_id)
    return {
        "status": "success",
        "session": summary
    }

@app.get("/sessions/{session_id}/eeg")
async def get_session_eeg(session_id: int, start: float = 0, end: float = None):
    """
    Obtiene datos EEG de una sesión.
    
    Args:
        session_id: ID de la sesión
        start: Tiempo inicio en segundos
        end: Tiempo fin en segundos (None = hasta el final)
    """
    samples = session_db.get_eeg_samples(session_id, start, end)
    if not samples:
        return {
            "status": "error",
            "message": "No EEG data found"
        }
    
    return {
        "status": "success",
        "samples": samples,
        "count": len(samples)
    }

@app.get("/sessions/{session_id}/metrics")
async def get_session_metrics(session_id: int):
    """
    Obtiene todas las métricas de una sesión.
    """
    metrics = session_db.get_metrics(session_id)
    if not metrics:
        return {
            "status": "error", 
            "message": "No metrics found"
        }
    
    return {
        "status": "success",
        "metrics": metrics,
        "count": len(metrics)
    }

@app.get("/sessions/{session_id}/events")
async def get_session_events(session_id: int):
    """
    Obtiene todos los eventos/marcadores de una sesión.
    """
    events = session_db.get_events(session_id)
    return {
        "status": "success",
        "events": events,
        "count": len(events)
    }

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: int):
    """
    Elimina una sesión y todos sus datos asociados.
    """
    success = session_db.delete_session(session_id)
    if success:
        return {
            "status": "success",
            "message": f"Session {session_id} deleted"
        }
    return {
        "status": "error",
        "message": f"Session {session_id} not found"
    }


@app.websocket("/ws/brain-state")
async def websocket_endpoint(websocket: WebSocket):
    import math
    
    def sanitize_value(v, default=0.0):
        """Replace NaN/Infinity with default value."""
        if v is None:
            return default
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return default
        return v
    
    def sanitize_dict(d, default=0.0):
        """Recursively sanitize all values in a dict."""
        if d is None:
            return None
        return {k: sanitize_value(v, default) if not isinstance(v, dict) else sanitize_dict(v, default) 
                for k, v in d.items()}
    
    await websocket.accept()
    start_time = time.time()
    
    print(f"→ New WebSocket connection established")
    
    try:
        while True:
            # Calcular tiempo relativo
            current_t = time.time() - start_time
            
            # --- INFERENCIA SINTÉRGICA ---
            # Obtener estado con TODAS las métricas científicas
            ai_state = brain.next_state()
            
            # Sanitizar valores para evitar NaN/Infinity en JSON
            coherence = sanitize_value(ai_state.get("coherence", 0.5), 0.5)
            entropy = sanitize_value(ai_state.get("entropy", 0.5), 0.5)
            frequency = sanitize_value(ai_state.get("dominant_frequency", 10.0), 10.0)
            plv = sanitize_value(ai_state.get("plv"), None)
            
            focal_point = ai_state.get("focal_point", {"x": 0, "y": 0, "z": 0})
            focal_point = {
                "x": sanitize_value(focal_point.get("x", 0), 0),
                "y": sanitize_value(focal_point.get("y", 0), 0),
                "z": sanitize_value(focal_point.get("z", 0), 0)
            }
            
            bands = ai_state.get("bands")
            if bands:
                bands = {
                    "delta": sanitize_value(bands.get("delta", 0), 0),
                    "theta": sanitize_value(bands.get("theta", 0), 0),
                    "alpha": sanitize_value(bands.get("alpha", 0), 0),
                    "beta": sanitize_value(bands.get("beta", 0), 0),
                    "gamma": sanitize_value(bands.get("gamma", 0), 0)
                }
            
            # Construir objeto Pydantic con nuevos campos
            state = SyntergicState(
                timestamp=current_t,
                coherence=coherence,
                entropy=entropy,
                focal_point=Vector3(**focal_point),
                frequency=frequency,
                bands=FrequencyBands(**bands) if bands else None,
                state=ai_state.get("state", "neutral"),
                plv=plv,
                source=ai_state.get("source"),
                session_progress=ai_state.get("session_progress"),
                session_timestamp=ai_state.get("session_timestamp")
            )
            
            # Enviar al frontend
            await websocket.send_json(state.dict())
            
            # Tasa de refresco: 5Hz (0.2s)
            await asyncio.sleep(0.2)
            
    except Exception as e:
        print(f"✗ WebSocket connection closed: {e}")
