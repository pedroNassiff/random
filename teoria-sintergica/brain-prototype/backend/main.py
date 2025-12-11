from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import time
import asyncio
from models import SyntergicState
from ai.inference import SyntergicBrain

app = FastAPI(title="Syntergic Brain API")

# Inicializar el Cerebro Digital (Carga modelo y datos)
brain = SyntergicBrain()

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
    Cambia el estado cognitivo del cerebro digital (relax vs focus).
    """
    success = brain.set_mode(mode)
    if success:
        return {"status": "success", "mode": mode, "message": f"Brain switched to {mode} mode"}
    return {"status": "error", "message": "Invalid mode. Use 'relax' or 'focus'"}

@app.websocket("/ws/brain-state")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    start_time = time.time()
    
    try:
        while True:
            # Calcular tiempo relativo (para logs o sincronicidad)
            current_t = time.time() - start_time
            
            # --- INFERENCIA SINTÉRGICA ---
            # En lugar de simular, obtenemos el estado real del modelo IA
            ai_state = brain.next_state()
            
            # Construimos el objeto pydantic
            state = SyntergicState(
                timestamp=current_t,
                coherence=ai_state["coherence"],
                entropy=ai_state["entropy"],
                focal_point=ai_state["focal_point"],
                frequency=10.0 + (ai_state["coherence"] * 30.0) # Gamma si hay alta coherencia
            )
            
            # Enviar al frontend
            await websocket.send_json(state.dict())
            
            # Tasa de refresco: 5Hz (0.2s) para movimientos más orgánicos y menos frenéticos
            await asyncio.sleep(0.2)
            
    except Exception as e:
        print(f"Connection closed: {e}")
