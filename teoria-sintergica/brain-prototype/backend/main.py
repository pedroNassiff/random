from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import time
import asyncio
from models import SyntergicState

app = FastAPI(title="Syntergic Brain API")

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
    return {"status": "active", "message": "Syntergic Field Initialized"}

@app.websocket("/ws/brain-state")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    start_time = time.time()
    
    try:
        while True:
            # Calcular tiempo relativo
            current_t = time.time() - start_time
            
            # Generar estado sintérgico simulado
            # (Aquí en el futuro conectaremos la salida de la Red Neuronal)
            state = SyntergicState.simulate_next(current_t)
            
            # Enviar al frontend como JSON
            await websocket.send_json(state.dict())
            
            # Simular tasa de refresco de 30Hz (aprox 33ms)
            # Para neurociencia real usaríamos 256Hz o 512Hz, pero para web 30/60 es suficiente
            await asyncio.sleep(0.033)
            
    except Exception as e:
        print(f"Connection closed: {e}")
