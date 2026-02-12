"""
🌀 RANDOM - Ejemplo de integración del módulo automation en main.py

Copiar las líneas marcadas con # 🆕 a tu main.py existente
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncpg

# 🆕 Import automation
from automation import router as automation_router
from automation.service import AutomationService
from automation.config import config as automation_config

# Import analytics (ya existente)
from analytics import router as analytics_router
from analytics.service import AnalyticsService


app = FastAPI(
    title="Random API",
    version="1.0.0",
    description="Analytics + Automation para Random Lab"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Startup: Conectar a DB y setup servicios"""
    
    print("🚀 Starting Random API...")
    
    # Conectar a PostgreSQL
    app.state.db_pool = await asyncpg.create_pool(
        user="postgres",
        password="tu_password",
        database="tu_database",
        host="localhost",
        min_size=5,
        max_size=20
    )
    
    print("✅ Database connected")
    
    # Setup analytics service (ya existente)
    app.state.analytics_service = AnalyticsService(app.state.db_pool)
    print("✅ Analytics service initialized")
    
    # 🆕 Setup automation service
    app.state.automation_service = AutomationService(app.state.db_pool)
    print("✅ Automation service initialized")
    
    # 🆕 Check automation config (opcional)
    missing = automation_config.get_missing_configs()
    if missing:
        print("⚠️  Optional configs missing:", ", ".join(missing))
    
    print("🌀 Random API ready!")


@app.on_event("shutdown")
async def shutdown():
    """Shutdown: Cerrar pool de DB"""
    await app.state.db_pool.close()
    print("✅ DB pool closed")


# Registrar routers
app.include_router(analytics_router)   # Ya existente
app.include_router(automation_router)  # 🆕 NUEVO


@app.get("/")
async def root():
    """Health check"""
    return {
        "status": "healthy",
        "name": "Random API",
        "services": ["analytics", "automation"],  # 🆕
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected" if app.state.db_pool else "disconnected",
        "services": {
            "analytics": "active",
            "automation": "active"  # 🆕
        }
    }


# 🆕 NUEVO: Endpoint de info del sistema
@app.get("/info")
async def system_info():
    """System info"""
    return {
        "name": "Random API",
        "version": "1.0.0",
        "services": {
            "analytics": {
                "status": "active",
                "endpoints": 10
            },
            "automation": {
                "status": "active",
                "endpoints": 25,
                "features": [
                    "lead_management",
                    "content_generation",
                    "campaign_management",
                    "ai_scoring",
                    "audit_logging"
                ]
            }
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Solo en desarrollo
    )
