from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
import time
import asyncio
import asyncpg
import os
import json
import random
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from security import SecurityMiddleware

# Load environment variables
load_dotenv()

from models import SyntergicState, FrequencyBands, Vector3
from ai.inference import SyntergicBrain
from hardware import MuseConnector, MuseToSyntergicAdapter, EOGDetector
# Legacy SQLite (for backward compatibility)
from database import get_database, get_recorder, SessionRecorder
# New PostgreSQL + InfluxDB
from database import get_recorder_v2, SessionRecorderV2, get_postgres_client_sync, get_influx_client
from dataclasses import asdict
# Analytics
from analytics.router import router as analytics_router
from analytics.service import AnalyticsService

from automation import router as automation_router
from automation.service import AutomationService

# AI Copilot
from ai.copilot_labs_service import CopilotLabsService
from ai.sanji_copilot_service import SanjiCopilotService
from recording.validation_protocol import ValidationProtocol
from recording.validation import run_all_tests, SessionQualityScore
from prospecting_router import router as prospecting_router

from prospecting_analysis import router as analysis_router
from prospecting_pitch import router as pitch_router
from prospecting_groups import router as groups_router
from audit.router import router as audit_router

app = FastAPI(title="Syntergic Brain API v0.4")


# Pydantic models for requests
class RecordingStartRequest(BaseModel):
    name: Optional[str] = ""
    notes: Optional[str] = ""
    tags: Optional[str] = ""

class CalibrationEventRequest(BaseModel):
    event: str          # e.g. 'blink_detected', 'relaxation_sample', 'calibration_complete'
    phase: str          # e.g. 'blink_test', 'eyes_open', 'eyes_closed', 'result'
    data: dict          # arbitrary payload from frontend

# ---- Calibration Session Log (in-memory, saved to disk on complete/failed) ----
_calib_log: List[dict] = []
_calib_log_start_ts: Optional[float] = None
_CALIB_LOGS_DIR = Path(__file__).parent / "calibration_logs"
_CALIB_LOGS_DIR.mkdir(exist_ok=True)

def _save_calib_log(label: str) -> str:
    """Serialize current calibration log to JSON file and return path."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = _CALIB_LOGS_DIR / f"calib_{ts}_{label}.json"
    payload = {
        "session_start": _calib_log_start_ts,
        "session_start_iso": datetime.fromtimestamp(_calib_log_start_ts).isoformat() if _calib_log_start_ts else None,
        "total_events": len(_calib_log),
        "events": _calib_log,
    }
    with open(filename, "w") as f:
        json.dump(payload, f, indent=2, default=str)
    print(f"📁 [Calibration Log] Saved {len(_calib_log)} events → {filename}")
    return str(filename)

class MarkerRequest(BaseModel):
    label: str
    event_type: Optional[str] = "marker"

# ── Copilot Pydantic models ───────────────────────────────────────────────────
class CopilotChatRequest(BaseModel):
    message: str
    session_context: Optional[Any] = None  # pre-computed analysis from frontend
    user_tier: str = "free"

class CopilotChatResponse(BaseModel):
    text: str
    model_used: str
    complexity: str
    widgets: List[Any] = []

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

# Validation protocol (scientific recording)
print("✓ Initializing validation protocol...")
validation_protocol = ValidationProtocol(recorder=None)  # recorder set when Muse connects
print("=" * 60)

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://random-studio.io",
        "https://www.random-studio.io",
        "https://random-lab.es",
        "https://www.random-lab.es"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security: bot protection + rate limiting
# Must come AFTER CORSMiddleware (starlette applies middleware in reverse order)
app.add_middleware(SecurityMiddleware)

# Trusted host guard — rejects requests with unknown Host headers
_extra_hosts = [h.strip() for h in os.getenv("EXTRA_ALLOWED_HOSTS", "").split(",") if h.strip()]
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "api.random-lab.es",
        "api.random-studio.io",
        "localhost",
        "127.0.0.1",
        "*.trycloudflare.com",
        *_extra_hosts,
    ],
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

    app.state.copilot_service = CopilotLabsService()
    print("✅ Copilot Labs service initialized")

    app.state.sanji_copilot = SanjiCopilotService()
    print("✅ Sanji Copilot service initialized")


@app.on_event("shutdown")
async def shutdown():
    """Close analytics database connection pool"""
    if hasattr(app.state, "analytics_pool"):
        await app.state.analytics_pool.close()
        print("✓ Analytics database pool closed")

    if hasattr(app.state, "copilot_service"):
        await app.state.copilot_service.aclose()

    if hasattr(app.state, "sanji_copilot"):
        await app.state.sanji_copilot.aclose()

# Include analytics router
app.include_router(analytics_router)

app.include_router(analysis_router)

# Include automation router
app.include_router(automation_router)

# Include prospecting CRM router
app.include_router(prospecting_router)
app.include_router(pitch_router)
app.include_router(groups_router)

# Audit Express
app.include_router(audit_router)

# ============================================
# Copilot Labs Endpoint
# ============================================

@app.post("/api/copilot/labs/chat", response_model=CopilotChatResponse)
async def copilot_labs_chat(request: CopilotChatRequest):
    """
    Procesa un mensaje del copiloto AI para Labs/ADA.

    El frontend envía el contexto de la sesión ya analizado
    (análisis pre-computado), evitando necesidad de acceso a DB
    desde este endpoint.

    Body:
        message:         Pregunta del usuario.
        session_context: Dict con 'analysis', 'name', 'duration_seconds', etc.
        user_tier:       'free' | 'premium'.
    """
    service: CopilotLabsService = app.state.copilot_service
    try:
        result = await service.process_message(
            message=request.message,
            session_context=request.session_context,
            user_tier=request.user_tier,
        )
        return CopilotChatResponse(**result)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("Copilot error: %s", exc)
        return CopilotChatResponse(
            text="❌ Error interno del copiloto. Revisa los logs del backend.",
            model_used="none",
            complexity="unknown",
            widgets=[],
        )


# ============================================
# Sanji Copilot Endpoint
# ============================================

@app.post("/api/copilot/sanji/chat")
async def sanji_copilot_chat(request: Request):
    """
    Copiloto clínico para SANJI-RX.
    Body: { message, history_context, conversation_history }
    """
    body = await request.json()
    service: SanjiCopilotService = app.state.sanji_copilot
    result = await service.chat(
        message=body.get("message", ""),
        history_context=body.get("history_context"),
        conversation_history=body.get("conversation_history"),
    )
    return result


@app.post("/api/tts")
async def text_to_speech(request: Request):
    """
    Convierte texto a voz con ElevenLabs (Rachel, ES).
    Devuelve audio/mpeg stream listo para reproducir en el frontend.    
    Body JSON: { "text": "...", "voice_id": "..." (opcional) }
    """
    import os, httpx
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"error": "ELEVENLABS_API_KEY no configurado"})

    body = await request.json()
    text = body.get("text", "").strip()
    if not text:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"error": "text requerido"})

    # Rachel (voz femenina, cálida, contemplativa) — multilingual v2
    voice_id = body.get("voice_id", "21m00Tcm4TlvDq8ikWAM")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.85,
            "similarity_boost": 0.75,
            "style": 0.15,
            "use_speaker_boost": True,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"xi-api-key": api_key, "Accept": "audio/mpeg"},
            )
            resp.raise_for_status()

        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="audio/mpeg",
            headers={"Cache-Control": "no-store"},
        )
    except httpx.HTTPStatusError as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=502, content={"error": f"ElevenLabs HTTP {exc.response.status_code}"})
    except Exception as exc:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": str(exc)})

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
    muselsl.list_muses() usa asyncio.run() internamente — si se llama desde
    el event loop de FastAPI falla silenciosamente devolviendo lista vacía.
    Solución: ejecutar discover() en un thread separado con asyncio.to_thread().
    """
    import logging
    log = logging.getLogger("discover_devices")
    log.info("[/hardware/devices] Iniciando BLE scan en thread separado...")
    print("[/hardware/devices] Iniciando BLE scan (thread separado)...")

    try:
        # Correr en thread para que list_muses() pueda usar asyncio.run() sin conflicto
        devices = await asyncio.to_thread(muse_connector.discover, 10.0)
    except Exception as exc:
        log.exception("[/hardware/devices] Error en discover: %s", exc)
        print(f"[/hardware/devices] ERROR en discover: {exc}")
        return {"status": "error", "devices": [], "count": 0, "error": str(exc)}

    print(f"[/hardware/devices] Scan terminado. Dispositivos encontrados: {len(devices)}")
    for d in devices:
        info = d.to_dict()
        print(f"  └─ {info.get('name')} | {info.get('address')} | RSSI: {info.get('rssi')}")

    return {
        "status": "success",
        "devices": [d.to_dict() for d in devices],
        "count": len(devices)
    }

@app.get("/hardware/battery/{address}")
async def get_device_battery(address: str):
    """
    Lee el nivel de batería del Muse vía BLE.

    Conecta brevemente al dispositivo para leer la característica de telemetría.
    Llamar ANTES de /hardware/connect (muselsl ocupa la conexión BLE después).

    Returns:
        battery_level: 0-100 o null si no se pudo leer.
    """
    # On macOS, BLE addresses are UUIDs with dashes (e.g. 6D5F179A-C0AF-...-293F).
    # BleakClient needs the dashed format — do NOT convert to colons here.
    # (Only the muselsl connect endpoint needs the colon-separated format.)
    print(f"[/hardware/battery] Leyendo batería de {address}...")
    try:
        battery = await asyncio.to_thread(muse_connector.read_battery, address)
        return {
            "status": "success" if battery is not None else "timeout",
            "battery_level": battery,
            "address": address
        }
    except Exception as exc:
        print(f"[/hardware/battery] Error: {exc}")
        return {"status": "error", "battery_level": None, "address": address, "error": str(exc)}

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
        address: UUID del dispositivo macOS (ej: "6D5F179A-C0AF-DCA5-3B60-7812EF8E293F")
                 Se mantiene en formato UUID con guiones — es el formato que Bleak/CoreBluetooth
                 usa en macOS. NO convertir a colons (eso rompe la conexión BLE).
    """
    # Ejecutar en thread separado: connect() llama read_battery() que crea su propio
    # event loop con asyncio.new_event_loop(). Si se llama desde el event loop de
    # FastAPI (sin thread), el new_event_loop() entra en conflicto y la coroutine
    # queda sin awaitar. Mismo patrón que discover().
    success = await asyncio.to_thread(muse_connector.connect, address)
    if success:
        device_dict = muse_connector.device_info.to_dict() if muse_connector.device_info else None
        return {
            "status": "success",
            "message": f"Connected to Muse 2: {address}",
            "device": device_dict
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
        status['data_stale'] = muse_connector.is_data_stale
        # Tiempo desde la última muestra real (para diagnosticar drops)
        if muse_connector._last_sample_time > 0:
            status['seconds_since_last_sample'] = round(
                time.time() - muse_connector._last_sample_time, 2
            )
    
    # Estado del proceso muselsl
    if muse_connector._muselsl_process:
        poll = muse_connector._muselsl_process.poll()
        status['muselsl_alive'] = poll is None
        if poll is not None:
            status['muselsl_exit_code'] = poll
    
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


@app.post("/hardware/calibration/event")
async def log_calibration_event(request: CalibrationEventRequest):
    """
    Recibe un evento de calibración desde el frontend y lo acumula en memoria.
    Cuando el evento es 'calibration_complete' o 'calibration_failed', guarda
    el log completo a un archivo JSON en calibration_logs/.
    """
    global _calib_log, _calib_log_start_ts

    now = time.time()
    elapsed = round(now - _calib_log_start_ts, 3) if _calib_log_start_ts else 0.0

    entry = {
        "ts": now,
        "elapsed_s": elapsed,
        "event": request.event,
        "phase": request.phase,
        "data": request.data,
    }
    _calib_log.append(entry)

    # Reset log on session start
    if request.event == "calibration_start":
        _calib_log = [entry]
        _calib_log_start_ts = now
        print(f"\n{'='*55}")
        print(f"📋 [Calibration Log] NEW SESSION — {datetime.now().strftime('%H:%M:%S')}")
        print(f"{'='*55}")
    elif request.event in ("calibration_complete", "calibration_failed"):
        label = "PASS" if request.data.get("passed") else "FAIL"
        saved_path = _save_calib_log(label)
        print(f"📋 [Calibration Log] {label} — {len(_calib_log)} events logged")
    else:
        # Verbose log for key events
        if request.event in ("blink_detected", "phase_changed", "relaxation_computed", "calibration_evaluated"):
            print(f"📋 [+{elapsed:.1f}s] {request.event} / {request.phase} → {request.data}")

    return {"status": "ok", "events": len(_calib_log), "elapsed_s": elapsed}


@app.get("/hardware/calibration/dump")
async def dump_calibration_log():
    """Devuelve el log de calibración en memoria (útil para inspección en tiempo real)."""
    return {
        "status": "ok",
        "events": len(_calib_log),
        "log": _calib_log,
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
            'alpha': band_power(psd_posterior, freqs, 8, 13),  # Alpha desde canales posteriores (TP9, TP10)!
            'beta': band_power(psd_mean, freqs, 13, 30),
            'gamma': band_power(psd_mean, freqs, 30, 50)
        }
        
        # Bandas normalizadas (0-1, suma a 1) para display en UI
        # La potencia bruta (µV²) no es intuitiva para barras de progreso
        total_power = sum(bands.values()) or 1.0
        bands_normalized = {k: float(v / total_power) for k, v in bands.items()}
        
        # Alpha por canal posterior individual (diagnóstico)
        alpha_by_posterior = {}
        for ch_name, ch_idx in [('TP9', 0), ('TP10', 3)]:
            if ch_idx < data.shape[0]:
                _, psd_ch = welch(data[ch_idx], fs=fs, nperseg=min(256, data.shape[1]))
                alpha_by_posterior[ch_name] = float(band_power(psd_ch, freqs_welch, 8, 13))
        
        # Log periódico para monitoreo de alpha
        if random.random() < 0.1:
            print(f"📊 Alpha snapshot: alpha_raw={bands['alpha']:.2f}µV², alpha_norm={bands_normalized['alpha']:.3f}, beta={bands_normalized['beta']:.3f}, theta={bands_normalized['theta']:.3f}")
        
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
        
        # Calidad de canales posteriores (críticos para alpha)
        posterior_quality = {
            'TP9':  signal_quality.get('TP9', 0.0),
            'TP10': signal_quality.get('TP10', 0.0),
            'avg':  (signal_quality.get('TP9', 0.0) + signal_quality.get('TP10', 0.0)) / 2,
        }
        bad_posterior = [ch for ch, q in [('TP9', posterior_quality['TP9']), ('TP10', posterior_quality['TP10'])] if q < 0.5]
        if bad_posterior:
            print(f"⚠️  [Snapshot] Canales posteriores débiles {bad_posterior} — alpha puede ser impreciso (TP9={posterior_quality['TP9']:.2f}, TP10={posterior_quality['TP10']:.2f})")
        
        # EOG blink detection: flag this window as contaminated by eye blinks.
        # Uses frontal channels AF7/AF8 as natural EOG sensors.
        # Consumers (calibration, recording, live viz) use this flag to decide
        # whether to include this sample in alpha calculations.
        eog = EOGDetector.detect_detailed(data, fs)
        
        return {
            "status": "success",
            "bands": bands,                        # µV² — para cálculos (ratio alpha, calibración)
            "bands_normalized": bands_normalized,  # 0-1  — para display en barras UI
            "coherence": coherence,
            "signal_quality": signal_quality,
            "posterior_quality": posterior_quality,
            "alpha_by_channel": alpha_by_posterior,  # Alpha TP9 vs TP10 individual
            "blink_contaminated": eog['blink_detected'],  # True if blink artifact in this window
            "eog": eog,                            # Detailed EOG diagnostics
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
        
        # UMBRAL - Los parpadeos reales son >100µV típicamente
        # threshold_fixed: mínimo absoluto para señal limpia
        # threshold_adaptive: baseline + 4x ruido IQR
        # Cap: el threshold nunca puede superar el 95th percentile de la ventana actual
        # porque si lo hace nunca podremos detectar nada, el pico REAL quedará por debajo.
        threshold_fixed = 150.0  # µV - mínimo absoluto
        threshold_adaptive = baseline + 4.0 * max(noise_level, 20.0)
        percentile_95 = float(np.percentile(frontal_abs, 95))
        
        # Cuando la señal es muy ruidosa, el adaptive sube a 3000-4000µV y no detecta nada.
        # Cap al 95th percentile × 0.85 garantiza que al menos el pico más alto sea detectable.
        threshold_cap = percentile_95 * 0.85
        min_amplitude = max(threshold_fixed, min(threshold_adaptive, threshold_cap))
        min_amplitude = max(min_amplitude, 120.0)

        # Obtener calidad de señal para advertencias
        signal_quality = muse_connector.get_signal_quality()
        avg_quality = sum(signal_quality.values()) / len(signal_quality) if signal_quality else 1.0
        bad_channels = [ch for ch, q in signal_quality.items() if q < 0.4] if signal_quality else []
        
        # NOTE: NO quality gate here. Blinks ARE artifacts — they temporarily
        # destroy signal quality scores (blink = 400-800µV spike, quality checker
        # flags anything > 200µV as poor). Gating on quality during blink
        # detection is contradictory and prevents detecting blinks 2-5 after
        # blink 1 crashes the quality score. The frontend handles the higher-level
        # validation (was this a real blink pattern vs random noise).
        
        if bad_channels and random.random() < 0.05:
            print(f"⚠️  [Blink] Mala señal en {bad_channels} (avg={avg_quality:.2f}) — threshold adaptado a {min_amplitude:.0f}µV (95th pct={percentile_95:.0f}µV)")
        
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
                print(f"👁️ BLINK DETECTED: count={blink_count}, max_amp={max_amplitude:.1f}µV, threshold={min_amplitude:.1f}µV (95th={percentile_95:.0f}µV)")
        else:
            avg_amplitude = 0.0
            max_amplitude = 0.0
            valid_blinks = []
            blink_count = 0
        
        # Log periódico para monitoreo
        if random.random() < 0.1:
            print(f"📊 Blink monitor: max={np.max(frontal_abs):.0f}µV, threshold={min_amplitude:.0f}µV, 95pct={percentile_95:.0f}µV, baseline={baseline:.0f}, noise={noise_level:.0f}, quality={avg_quality:.2f}")
        
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
# DOCUMENTATION DASHBOARD ENDPOINT
# =============================================================================

@app.get("/doc/dashboard")
async def doc_dashboard():
    """
    Aggregated data for the ADA documentation dashboard.
    Returns sessions list, validation results, and project stats.
    Auto-computes validation for sessions that don't have a file yet.
    """
    try:
        # 1. Sessions from PostgreSQL
        pg = get_postgres_client_sync()
        sessions = []
        if pg:
            recordings = pg.get_all_recordings(limit=200)
            for r in recordings:
                d = asdict(r)
                for k in ('started_at', 'ended_at'):
                    if d.get(k) and hasattr(d[k], 'isoformat'):
                        d[k] = d[k].isoformat()
                sessions.append(d)

        # 2. Validation logs from disk
        logs_dir = Path(__file__).parent / "validation_logs"
        logs_dir.mkdir(exist_ok=True)
        validations = []
        validated_ids = set()
        for f in sorted(logs_dir.glob("validate-*.json")):
            try:
                data = json.loads(f.read_text())
                validations.append(data)
                validated_ids.add(data.get("session_id"))
            except Exception:
                pass

        # 3. Auto-compute validation for sessions without files (up to 20 most recent)
        influx_bulk = get_influx_client()
        missing = [s for s in sessions if s.get("id") not in validated_ids][-20:]
        for s in missing:
            sid = s.get("id")
            if not sid:
                continue
            try:
                metrics_v = influx_bulk.get_metrics(sid) or session_db.get_metrics(sid)
                if not metrics_v:
                    continue
                markers_v = []
                try:
                    events_v = influx_bulk.get_events(sid)
                    markers_v = [{"label": e.get("label", ""), "timestamp": e.get("timestamp", 0)} for e in (events_v or [])]
                except Exception:
                    pass
                if not markers_v:
                    raw_evts = session_db.get_events(sid)
                    markers_v = [{"label": e.get("label", e.get("event_type", "")), "timestamp": e.get("timestamp", 0)} for e in (raw_evts or [])]
                val_result = {
                    "status": "success",
                    "session_id": sid,
                    "validation": run_all_tests(metrics_v, markers_v),
                    "quality_score": SessionQualityScore.compute(metrics_v, markers_v),
                    "markers_found": len(markers_v),
                    "metrics_found": len(metrics_v),
                }
                (logs_dir / f"validate-{sid}.json").write_text(json.dumps(val_result, default=str))
                validations.append(val_result)
                print(f"✅ [dashboard] Auto-validated session #{sid}")
            except Exception as ve:
                print(f"⚠️ [dashboard] Auto-validation failed for #{sid}: {ve}")

        # Sort validations by session_id
        validations.sort(key=lambda v: v.get("session_id", 0))

        # 4. Protocol logs (only complete sessions)
        protocol_logs = []
        for f in sorted(logs_dir.glob("validation_*.json")):
            try:
                data = json.loads(f.read_text())
                if data.get("phases_completed", 0) != data.get("total_phases", 8):
                    continue
                protocol_logs.append({
                    "filename": f.name,
                    "phases_completed": data.get("phases_completed", 0),
                    "total_phases": data.get("total_phases", 8),
                    "complete": True,
                    "start_iso": data.get("protocol_start_iso", ""),
                    "metadata": data.get("metadata", {}),
                })
            except Exception:
                pass

        return {
            "status": "success",
            "sessions": sessions,
            "validations": validations,
            "protocol_logs": protocol_logs,
            "total_sessions": len(sessions),
            "total_validations": len(validations),
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


@app.get("/doc/session/{session_id}")
async def doc_session_detail(session_id: int):
    """
    Detailed data for a single session: recording info, validation, protocol log, metrics summary.
    """
    try:
        result = {"status": "success", "session_id": session_id}

        # 1. Recording from PostgreSQL
        pg = get_postgres_client_sync()
        if pg:
            recording = pg.get_recording(session_id)
            if recording:
                d = asdict(recording)
                for k in ('started_at', 'ended_at'):
                    if d.get(k) and hasattr(d[k], 'isoformat'):
                        d[k] = d[k].isoformat()
                result["recording"] = d

        # 2. Validation result — from disk, or compute on-the-fly and save
        logs_dir = Path(__file__).parent / "validation_logs"
        logs_dir.mkdir(exist_ok=True)
        val_file = logs_dir / f"validate-{session_id}.json"
        if val_file.exists():
            result["validation"] = json.loads(val_file.read_text())
        else:
            # Run validation on-the-fly and persist so the dashboard picks it up
            try:
                influx_v = get_influx_client()
                metrics_v = influx_v.get_metrics(session_id) or session_db.get_metrics(session_id)
                if metrics_v:
                    markers_v = []
                    try:
                        events_v = influx_v.get_events(session_id)
                        markers_v = [{"label": e.get("label", ""), "timestamp": e.get("timestamp", 0)} for e in (events_v or [])]
                    except Exception:
                        pass
                    if not markers_v:
                        raw_evts = session_db.get_events(session_id)
                        markers_v = [{"label": e.get("label", e.get("event_type", "")), "timestamp": e.get("timestamp", 0)} for e in (raw_evts or [])]
                    val_result = {
                        "status": "success",
                        "session_id": session_id,
                        "validation": run_all_tests(metrics_v, markers_v),
                        "quality_score": SessionQualityScore.compute(metrics_v, markers_v),
                        "markers_found": len(markers_v),
                        "metrics_found": len(metrics_v),
                    }
                    val_file.write_text(json.dumps(val_result, default=str))
                    result["validation"] = val_result
            except Exception as ve:
                print(f"⚠️ [doc/session] on-the-fly validation failed for #{session_id}: {ve}")

        # 3. Find matching protocol log (match by session recording time ± 2h)
        result["protocol_log"] = None
        rec = result.get("recording", {})
        rec_start_iso = rec.get("started_at", "") if rec else ""
        if logs_dir.exists():
            best_match = None
            best_delta = None
            for f in sorted(logs_dir.glob("validation_*_COMPLETE.json")):
                try:
                    data = json.loads(f.read_text())
                    proto_iso = data.get("protocol_start_iso", "")
                    # Try to match by timestamp proximity (within 2 hours)
                    if rec_start_iso and proto_iso:
                        from datetime import datetime, timezone
                        try:
                            t_rec = datetime.fromisoformat(rec_start_iso.replace("Z", "+00:00"))
                            t_proto = datetime.fromisoformat(proto_iso.replace("Z", "+00:00"))
                            delta = abs((t_rec - t_proto).total_seconds())
                            if best_delta is None or delta < best_delta:
                                best_delta = delta
                                best_match = (f, data)
                        except Exception:
                            if best_match is None:
                                best_match = (f, data)
                    else:
                        if best_match is None:
                            best_match = (f, data)
                except Exception:
                    pass
            # Only use if within 2 hours of the recording
            if best_match and (best_delta is None or best_delta < 21600):
                f, data = best_match
                result["protocol_log"] = {
                    "filename": f.name,
                    "phases_completed": data.get("phases_completed", 0),
                    "total_phases": data.get("total_phases", 8),
                    "start_iso": data.get("protocol_start_iso", ""),
                    "metadata": data.get("metadata", {}),
                    "events": data.get("events", []),
                }

        # 4. Metrics summary from InfluxDB
        try:
            influx = get_influx_client()
            metrics = influx.get_metrics(session_id)
            if metrics:
                n = len(metrics)
                bands_avg = {}
                for band in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
                    vals = [m.get(band, 0) for m in metrics if m.get(band) is not None]
                    bands_avg[band] = sum(vals) / len(vals) if vals else 0
                coh_vals = [m.get('coherence', 0) for m in metrics if m.get('coherence') is not None]
                sq_vals = [m.get('signal_quality', 0) for m in metrics if m.get('signal_quality') is not None]
                result["metrics_summary"] = {
                    "total_windows": n,
                    "duration_seconds": n / 5,  # metrics at 5Hz
                    "bands_avg": bands_avg,
                    "coherence_avg": sum(coh_vals) / len(coh_vals) if coh_vals else 0,
                    "coherence_max": max(coh_vals) if coh_vals else 0,
                    "signal_quality_avg": sum(sq_vals) / len(sq_vals) if sq_vals else 0,
                    "usable_windows": sum(1 for v in sq_vals if v >= 0.7),
                }
        except Exception:
            pass

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


# =============================================================================
# SESSIONS ENDPOINTS (Session Management & Playback)
# =============================================================================

@app.get("/sessions")
async def list_sessions(limit: int = 200, offset: int = 0):
    """
    Lista todas las sesiones grabadas (PostgreSQL).
    """
    try:
        pg = get_postgres_client_sync()
        recordings = pg.get_all_recordings(limit=limit, offset=offset)
        sessions = []
        for r in recordings:
            d = asdict(r)
            # convert datetime to ISO strings for JSON serialisation
            for k in ('started_at', 'ended_at'):
                if d.get(k) and hasattr(d[k], 'isoformat'):
                    d[k] = d[k].isoformat()
            sessions.append(d)
        return {"status": "success", "sessions": sessions, "count": len(sessions)}
    except Exception as e:
        # Fallback to legacy SQLite
        sessions = session_db.list_sessions(limit, offset)
        return {"status": "success", "sessions": sessions, "count": len(sessions), "source": "sqlite"}

@app.get("/sessions/{session_id}")
async def get_session(session_id: int):
    """
    Obtiene detalles de una sesión específica (PostgreSQL).
    """
    try:
        pg = get_postgres_client_sync()
        recording = pg.get_recording(session_id)
        if recording is None:
            return {"status": "error", "message": f"Session {session_id} not found"}
        d = asdict(recording)
        for k in ('started_at', 'ended_at'):
            if d.get(k) and hasattr(d[k], 'isoformat'):
                d[k] = d[k].isoformat()
        return {"status": "success", "session": d}
    except Exception as e:
        session = session_db.get_session(session_id)
        if session is None:
            return {"status": "error", "message": f"Session {session_id} not found"}
        return {"status": "success", "session": session_db.get_session_summary(session_id)}

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

@app.post("/sessions/{session_id}/reclose")
async def reclose_session(session_id: int):
    """
    Re-runs end_recording for a session whose recorder stopped before persisting
    per-channel aggregates to PostgreSQL. Raw and per-window data must already
    exist in InfluxDB.

    Safe to call multiple times — always overwrites with fresh InfluxDB aggregates.
    """
    try:
        pg = get_postgres_client_sync()
        influx = get_influx_client()

        recording = pg.get_recording(session_id)
        if recording is None:
            return {"status": "error", "message": f"Session {session_id} not found in PostgreSQL"}

        # Recompute aggregated metrics from InfluxDB
        aggregated_metrics = {}
        try:
            aggregated_metrics = influx.get_aggregated_metrics(session_id)
            for k, v in aggregated_metrics.items():
                if hasattr(v, 'item'):
                    aggregated_metrics[k] = v.item()
                elif v is not None:
                    aggregated_metrics[k] = float(v)
        except Exception as e:
            return {"status": "error", "message": f"Failed to get aggregated metrics: {e}"}

        # Recompute per-channel aggregates (FAA, alpha_*_avg)
        per_channel_agg = {}
        try:
            per_channel_agg = influx.get_per_channel_aggregates(session_id)
            aggregated_metrics.update(per_channel_agg)
        except Exception as e:
            return {"status": "error", "message": f"Failed to get per-channel aggregates: {e}"}

        if per_channel_agg.get('per_channel_version', 0) == 0:
            return {"status": "error", "message": "No per-channel data found in InfluxDB for this session"}

        updated = pg.end_recording(
            session_id,
            duration_seconds=recording.duration_seconds or 0,
            sample_count=recording.sample_count or 0,
            metrics_count=recording.metrics_count or 0,
            calibration_passed=recording.calibration_passed or False,
            avg_signal_quality=recording.avg_signal_quality or 0,
            aggregated_metrics=aggregated_metrics,
        )

        if updated is None:
            return {"status": "error", "message": f"UPDATE returned no row for session {session_id}"}

        return {
            "status": "success",
            "session_id": session_id,
            "per_channel_version": per_channel_agg.get('per_channel_version'),
            "alpha_tp9_avg": per_channel_agg.get('alpha_tp9_avg'),
            "alpha_af7_avg": per_channel_agg.get('alpha_af7_avg'),
            "alpha_af8_avg": per_channel_agg.get('alpha_af8_avg'),
            "alpha_tp10_avg": per_channel_agg.get('alpha_tp10_avg'),
            "faa_mean": per_channel_agg.get('faa_mean'),
            "faa_baseline_closed": per_channel_agg.get('faa_baseline_closed'),
            "posterior_asymmetry_mean": per_channel_agg.get('posterior_asymmetry_mean'),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/sessions/{session_id}/metrics")
async def get_session_metrics(session_id: int):
    """
    Obtiene todas las métricas de una sesión (InfluxDB).

    Response includes:
    - metrics: existing time-series array (unchanged, backward compat)
    - per_channel: per-channel band power object or null if not available
    - per_channel_version: 0 = no per-channel data, 1 = current schema
    """
    try:
        influx = get_influx_client()
        metrics = influx.get_metrics(session_id)
        if not metrics:
            # fallback to SQLite for legacy sessions
            metrics = session_db.get_metrics(session_id)

        # Attempt to load per-channel band power time series
        per_channel = None
        per_channel_version = 0
        try:
            per_channel = influx.get_per_channel_metrics(session_id)
            if per_channel is not None:
                per_channel_version = 1
        except Exception as e_pc:
            pass  # Non-fatal: per_channel stays None

        per_channel_by_phase = None
        try:
            per_channel_by_phase = influx.get_per_channel_by_phase(session_id)
        except Exception:
            pass  # non-fatal

        return {
            "status": "success",
            "metrics": metrics,
            "count": len(metrics),
            "per_channel": per_channel,
            "per_channel_by_phase": per_channel_by_phase,
            "per_channel_version": per_channel_version,
        }
    except Exception as e:
        metrics = session_db.get_metrics(session_id)
        return {
            "status": "success",
            "metrics": metrics,
            "count": len(metrics),
            "per_channel": None,
            "per_channel_by_phase": None,
            "per_channel_version": 0,
            "source": "sqlite",
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


# ============================================
# Validation Protocol Endpoints
# ============================================

class ProtocolStartRequest(BaseModel):
    name: Optional[str] = ""
    metadata: Optional[dict] = None
    quick: bool = False

@app.post("/protocol/start")
async def protocol_start(request: ProtocolStartRequest):
    """
    Inicia el protocolo de validación científica.
    Requiere Muse 2 conectado y streameando.
    quick=True usa QUICK_VALIDATION_PHASES (~3.5 min, 3 fases).
    """
    # Vincular recorder si hay Muse activo
    if muse_connector.is_streaming and session_recorder is None:
        try:
            validation_protocol.recorder = get_recorder_v2(muse_connector)
        except Exception:
            pass  # funciona sin recorder también
    
    result = validation_protocol.start(
        name=request.name or "",
        metadata=request.metadata,
        quick=request.quick,
    )
    return result

@app.post("/protocol/stop")
async def protocol_stop():
    """Detiene el protocolo y guarda el log."""
    return validation_protocol.stop()

@app.post("/protocol/pause")
async def protocol_pause():
    validation_protocol.pause()
    return {"status": "success"}

@app.post("/protocol/resume")
async def protocol_resume():
    validation_protocol.resume()
    return {"status": "success"}

@app.post("/protocol/advance")
async def protocol_advance():
    """Avanza manualmente a la siguiente fase."""
    return validation_protocol.advance_phase()

@app.post("/protocol/back")
async def protocol_back():
    """Retrocede a la fase anterior."""
    return validation_protocol.go_back_phase()

@app.get("/protocol/state")
async def protocol_state():
    """Estado actual del protocolo (polled por frontend cada 500ms)."""
    return validation_protocol.get_state()


@app.post("/protocol/validate/{session_id}")
async def protocol_validate(session_id: int):
    """
    Ejecuta tests de validación científica sobre una sesión grabada.
    
    Retorna: Berger effect, cognitive reactivity, coherence stability,
    y SessionQualityScore compuesto.
    """
    try:
        influx = get_influx_client()
        
        # 1. Obtener métricas desde InfluxDB
        metrics = influx.get_metrics(session_id)
        if not metrics:
            metrics = session_db.get_metrics(session_id)
        
        if not metrics:
            return {"status": "error", "message": "No metrics found for session"}
        
        # 2. Obtener marcadores — InfluxDB primero (donde el protocolo los graba),
        #    luego fallback a SQLite legacy
        markers = []
        try:
            influx_events = influx.get_events(session_id)
            markers = [
                {"label": e.get("label", ""), "timestamp": e.get("timestamp", 0)}
                for e in (influx_events or [])
            ]
        except Exception as e_influx:
            print(f"\u26a0\ufe0f [validate] InfluxDB events failed: {e_influx}, trying SQLite")
        
        # Fallback: SQLite legacy events
        if not markers:
            events = session_db.get_events(session_id)
            markers = [
                {"label": e.get("label", e.get("event_type", "")), "timestamp": e.get("timestamp", 0)}
                for e in (events or [])
            ]
        
        print(f"\U0001f9ea [validate] session_id={session_id}: {len(metrics)} metrics, {len(markers)} markers")
        if markers:
            marker_labels = [m['label'] for m in markers[:20]]
            print(f"    markers: {marker_labels}")
        
        # 3. Correr todos los tests
        test_results = run_all_tests(metrics, markers)
        
        # 4. Score compuesto
        quality = SessionQualityScore.compute(metrics, markers)
        
        result = {
            "status": "success",
            "session_id": session_id,
            "validation": test_results,
            "quality_score": quality,
            "markers_found": len(markers),
            "metrics_found": len(metrics),
        }

        # 5. Persistir al disco para que /doc/dashboard y /doc/session lo lean
        try:
            logs_dir = Path(__file__).parent / "validation_logs"
            logs_dir.mkdir(exist_ok=True)
            val_file = logs_dir / f"validate-{session_id}.json"
            val_file.write_text(json.dumps(result, default=str))
            print(f"✅ [validate] Guardado {val_file.name}")
        except Exception as save_err:
            print(f"⚠️ [validate] No se pudo guardar a disco: {save_err}")

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}


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
    ws_frame_count = 0
    
    print(f"→ New WebSocket connection established")
    
    try:
        while True:
            # Calcular tiempo relativo
            current_t = time.time() - start_time
            ws_frame_count += 1
            
            # --- INFERENCIA SINTÉRGICA ---
            # Obtener estado con TODAS las métricas científicas
            ai_state = brain.next_state()
            
            # Log cada 25 frames (5s a 5Hz) para ver si los valores cambian
            if ws_frame_count == 1 or ws_frame_count % 25 == 0:
                b = ai_state.get('bands') or {}
                print(
                    f"[WS #{ws_frame_count:04d}] "
                    f"source={ai_state.get('source','?')}  "
                    f"coherence={ai_state.get('coherence', 0):.3f}  "
                    f"δ={b.get('delta',0):.3f} θ={b.get('theta',0):.3f} "
                    f"α={b.get('alpha',0):.3f} β={b.get('beta',0):.3f} γ={b.get('gamma',0):.3f}  "
                    f"state={ai_state.get('state','?')}"
                )
            
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
            
            bands_display = ai_state.get("bands_display")
            if bands_display:
                bands_display = {
                    "delta": sanitize_value(bands_display.get("delta", 0), 0),
                    "theta": sanitize_value(bands_display.get("theta", 0), 0),
                    "alpha": sanitize_value(bands_display.get("alpha", 0), 0),
                    "beta": sanitize_value(bands_display.get("beta", 0), 0),
                    "gamma": sanitize_value(bands_display.get("gamma", 0), 0)
                }
            
            # Construir objeto Pydantic con nuevos campos
            state = SyntergicState(
                timestamp=current_t,
                coherence=coherence,
                entropy=entropy,
                focal_point=Vector3(**focal_point),
                frequency=frequency,
                bands=FrequencyBands(**bands) if bands else None,
                bands_display=FrequencyBands(**bands_display) if bands_display else None,
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
