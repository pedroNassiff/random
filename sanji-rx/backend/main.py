"""
SANJI-RX Backend — FastAPI application entry point
Puerto 8001 para no conflictuar con brain-prototype en 8000
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.postgres import get_pool, close_pool
from routers.daily_log import router as log_router
from routers.medications import router as med_router
from routers.state import router as state_router
from routers.copilot import router as copilot_router, close_client as close_copilot

import asyncpg
import os
from pathlib import Path


async def _run_migration(pool: asyncpg.Pool):
    migration_file = Path(__file__).parent / "database" / "migrations" / "001_initial.sql"
    sql = migration_file.read_text()
    async with pool.acquire() as conn:
        await conn.execute(sql)
    print("[DB] Migration 001_initial.sql applied.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    pool = await get_pool()
    await _run_migration(pool)
    print("[SANJI-RX] Backend listo. Puerto 8001.")
    yield
    # Shutdown
    await close_pool()
    await close_copilot()


app = FastAPI(
    title="SANJI-RX",
    description="Sistema de monitoreo neurológico adaptativo para Sanji",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(log_router)
app.include_router(med_router)
app.include_router(state_router)
app.include_router(copilot_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "sanji-rx"}
