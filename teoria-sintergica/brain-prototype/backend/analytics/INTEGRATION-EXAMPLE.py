"""
Ejemplo de integración del Analytics Router en main.py

Agregar estas líneas a tu archivo main.py existente:
"""

# ===== 1. IMPORTS (Al inicio del archivo) =====
import asyncpg
from analytics.router import router as analytics_router
from analytics.service import AnalyticsService

# ===== 2. CONFIGURACIÓN (Después de crear la app) =====

# En la sección donde defines CORSMiddleware, agrega el frontend domain:
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://random.com",  # <-- Tu dominio de producción
        "https://www.random.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 3. STARTUP EVENT (Crear connection pool) =====

@app.on_event("startup")
async def startup_analytics():
    """
    Inicializa el connection pool de PostgreSQL para analytics
    """
    try:
        # PostgreSQL connection pool para analytics
        analytics_pool = await asyncpg.create_pool(
            host="localhost",  # O tu host de PostgreSQL
            port=5432,
            user="postgres",
            password="YOUR_PASSWORD",  # <-- Cambiar por tu password real
            database="random_analytics",  # <-- Database para analytics
            min_size=10,
            max_size=20,
        )
        
        # Guardar en app.state para acceso global
        app.state.analytics_pool = analytics_pool
        app.state.analytics_service = AnalyticsService(analytics_pool)
        
        print("✓ Analytics PostgreSQL connection pool initialized")
    except Exception as e:
        print(f"✗ Failed to initialize analytics pool: {e}")

# ===== 4. SHUTDOWN EVENT (Cerrar conexiones) =====

@app.on_event("shutdown")
async def shutdown_analytics():
    """
    Cierra el connection pool al apagar el servidor
    """
    if hasattr(app.state, 'analytics_pool'):
        await app.state.analytics_pool.close()
        print("✓ Analytics connection pool closed")

# ===== 5. INCLUIR ROUTER (Después de definir los eventos) =====

# Incluir router de analytics
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])

# ===== 6. VERIFICAR CONFIGURACIÓN =====

# Los endpoints de analytics estarán disponibles en:
# - POST /analytics/session/start
# - POST /analytics/pageview
# - POST /analytics/event
# - POST /analytics/engagement
# - POST /analytics/conversion
# - POST /analytics/session/end
# - POST /analytics/batch
# - GET  /analytics/summary
# - GET  /analytics/health

# ===== ARCHIVO COMPLETO EJEMPLO =====

"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncpg

# Imports existentes del brain-prototype
from models import SyntergicState, FrequencyBands, Vector3
from ai.inference import SyntergicBrain
from hardware import MuseConnector, MuseToSyntergicAdapter
from database import get_database, get_recorder_v2, SessionRecorderV2

# NEW: Analytics imports
from analytics.router import router as analytics_router
from analytics.service import AnalyticsService

app = FastAPI(title="Random API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://random.com",
        "https://www.random.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Syntergic Brain initialization (tu código existente)
brain = SyntergicBrain()
muse_connector = MuseConnector()
session_db = get_database()

# NEW: Analytics startup
@app.on_event("startup")
async def startup():
    # Analytics PostgreSQL pool
    try:
        analytics_pool = await asyncpg.create_pool(
            host="localhost",
            port=5432,
            user="postgres",
            password="YOUR_PASSWORD",
            database="random_analytics",
            min_size=10,
            max_size=20,
        )
        app.state.analytics_pool = analytics_pool
        app.state.analytics_service = AnalyticsService(analytics_pool)
        print("✓ Analytics initialized")
    except Exception as e:
        print(f"✗ Analytics failed: {e}")

# NEW: Analytics shutdown
@app.on_event("shutdown")
async def shutdown():
    if hasattr(app.state, 'analytics_pool'):
        await app.state.analytics_pool.close()

# NEW: Include analytics router
app.include_router(analytics_router)

# Tus otros endpoints existentes...
@app.get("/")
def read_root():
    return {"status": "active", "message": "Random API Online"}

# ... resto de tu código ...
"""

# ===== VARIABLES DE ENTORNO =====

"""
Agregar a tu archivo .env del backend:

# Analytics PostgreSQL
ANALYTICS_DB_HOST=localhost
ANALYTICS_DB_PORT=5432
ANALYTICS_DB_USER=postgres
ANALYTICS_DB_PASSWORD=your_password_here
ANALYTICS_DB_NAME=random_analytics

# O usar una sola URL
ANALYTICS_DATABASE_URL=postgresql://postgres:password@localhost:5432/random_analytics

# Frontend CORS origins
FRONTEND_URL=https://random.com
"""

# ===== NOTAS IMPORTANTES =====

"""
1. La base de datos "random_analytics" debe estar creada
2. La migración SQL debe estar ejecutada
3. El puerto 5432 de PostgreSQL debe estar accesible
4. Ajustar min_size/max_size según carga esperada
5. En producción, usar variables de entorno para passwords
6. Test con: curl http://localhost:8000/analytics/health
"""
