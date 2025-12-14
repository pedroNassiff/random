from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import time
import asyncio
from models import SyntergicState, FrequencyBands, Vector3
from ai.inference import SyntergicBrain

app = FastAPI(title="Syntergic Brain API v0.3")

# Inicializar el Cerebro Digital (Carga modelo y datos)
print("=" * 60)
print("SYNTERGIC BRAIN API - Initializing...")
print("=" * 60)
brain = SyntergicBrain()
print("=" * 60)

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """
    success = brain.set_mode(mode)
    if success:
        return {"status": "success", "mode": mode, "message": f"Brain switched to {mode} mode"}
    return {"status": "error", "message": "Invalid mode. Use 'relax', 'focus', or 'session'"}

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

@app.websocket("/ws/brain-state")
async def websocket_endpoint(websocket: WebSocket):
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
            
            # Construir objeto Pydantic con nuevos campos
            state = SyntergicState(
                timestamp=current_t,
                coherence=ai_state["coherence"],
                entropy=ai_state["entropy"],
                focal_point=Vector3(**ai_state["focal_point"]),
                frequency=ai_state["dominant_frequency"],
                bands=FrequencyBands(**ai_state["bands"]) if "bands" in ai_state else None,
                state=ai_state.get("state", "neutral"),
                plv=ai_state.get("plv")
            )
            
            # Enviar al frontend
            await websocket.send_json(state.dict())
            
            # Tasa de refresco: 5Hz (0.2s)
            await asyncio.sleep(0.2)
            
    except Exception as e:
        print(f"✗ WebSocket connection closed: {e}")
