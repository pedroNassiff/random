#!/usr/bin/env python3
"""
sync_to_prod.py
---------------
Sube sesiones EEG grabadas en LOCAL a las BBDDs de PRODUCCIÓN.

Arquitectura:
  local PostgreSQL  →  prod PostgreSQL  (metadatos de sesión)
  local InfluxDB    →  prod InfluxDB    (métricas time-series)

Requiere que tunnel-prod-db.sh esté corriendo en background:
  ./tunnel-prod-db.sh --bg

Uso:
  python scripts/sync_to_prod.py --last          # última sesión grabada
  python scripts/sync_to_prod.py --id 11         # sesión específica
  python scripts/sync_to_prod.py --all           # todas las no sincronizadas
  python scripts/sync_to_prod.py --list          # lista sesiones locales
"""

import os, sys, json, argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

# ── cargar .env.prod-db ───────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent.parent
env_prod = BACKEND_DIR / ".env.prod-db"

if not env_prod.exists():
    print("❌ Falta .env.prod-db")
    print(f"   cp {BACKEND_DIR}/.env.prod-db.example {BACKEND_DIR}/.env.prod-db")
    print("   (luego rellena las credenciales de producción)")
    sys.exit(1)

# Cargar variables del .env.prod-db sin sobrescribir las del entorno
with open(env_prod) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        if k not in os.environ:
            os.environ[k.strip()] = v.strip()

# ── imports sistema (después de cargar env) ───────────────────────────────────
sys.path.insert(0, str(BACKEND_DIR))

import psycopg2
from psycopg2.extras import RealDictCursor
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from database.postgres_client import PostgresClientSync, get_postgres_client_sync
from database.influx_client import InfluxDBEEGClient, get_influx_client

# ── config local ──────────────────────────────────────────────────────────────
LOCAL_PG = dict(
    host=os.getenv("LOCAL_POSTGRES_HOST", "localhost"),
    port=int(os.getenv("LOCAL_POSTGRES_PORT", 5432)),
    dbname=os.getenv("LOCAL_POSTGRES_DB", os.getenv("POSTGRES_DB", "brain_prototype")),
    user=os.getenv("LOCAL_POSTGRES_USER", os.getenv("POSTGRES_USER", "brain_user")),
    password=os.getenv("LOCAL_POSTGRES_PASSWORD", os.getenv("POSTGRES_PASSWORD", "sintergic2024")),
)

LOCAL_INFLUX = dict(
    url=os.getenv("LOCAL_INFLUX_URL", "http://localhost:8086"),
    token=os.getenv("LOCAL_INFLUX_TOKEN", os.getenv("INFLUX_TOKEN", "my-super-secret-auth-token")),
    org=os.getenv("LOCAL_INFLUX_ORG", os.getenv("INFLUX_ORG", "teoria-sintergica")),
    bucket=os.getenv("LOCAL_INFLUX_BUCKET", os.getenv("INFLUX_BUCKET", "eeg-data")),
)

# ── config prod (via tunnel) ──────────────────────────────────────────────────
PROD_PG = dict(
    host="localhost",
    port=int(os.getenv("POSTGRES_PORT", 5433)),
    dbname=os.getenv("POSTGRES_DB", "brain_prototype"),
    user=os.getenv("POSTGRES_USER", "brain_user"),
    password=os.getenv("POSTGRES_PASSWORD", ""),
)

PROD_INFLUX = dict(
    url=os.getenv("INFLUX_URL", "http://localhost:8087"),
    token=os.getenv("INFLUX_TOKEN", ""),
    org=os.getenv("INFLUX_ORG", "teoria-sintergica"),
    bucket=os.getenv("INFLUX_BUCKET", "eeg-data"),
)

# ── helpers ───────────────────────────────────────────────────────────────────
def local_pg_conn():
    return psycopg2.connect(**LOCAL_PG)

def prod_pg_conn():
    return psycopg2.connect(**PROD_PG)

def local_influx_client():
    return InfluxDBClient(url=LOCAL_INFLUX["url"], token=LOCAL_INFLUX["token"], org=LOCAL_INFLUX["org"])

def prod_influx_client():
    return InfluxDBClient(url=PROD_INFLUX["url"], token=PROD_INFLUX["token"], org=PROD_INFLUX["org"])


def list_local_sessions():
    """Lista sesiones en la BBDD local."""
    with local_pg_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, name, started_at, duration_seconds, sample_count,
                       avg_signal_quality, calibration_passed
                FROM eeg_recordings
                ORDER BY started_at DESC
                LIMIT 50
            """)
            return cur.fetchall()


def get_local_session(session_id: int) -> Optional[dict]:
    """Devuelve metadatos de una sesión local."""
    with local_pg_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM eeg_recordings WHERE id = %s", (session_id,))
            return cur.fetchone()


def session_exists_in_prod(session_id: int) -> bool:
    """Comprueba si la sesión ya existe en prod (por el mismo ID o por nombre+fecha)."""
    try:
        with prod_pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM eeg_recordings WHERE id = %s", (session_id,))
                return cur.fetchone() is not None
    except Exception:
        return False


def upload_session_metadata(session: dict) -> int:
    """
    Sube los metadatos de la sesión a prod PostgreSQL.
    Si ya existe, la actualiza. Devuelve el ID en prod.
    """
    with prod_pg_conn() as conn:
        with conn.cursor() as cur:
            # Intentar insert (preservando el mismo ID para mantener coherencia con InfluxDB tags)
            try:
                cur.execute("""
                    INSERT INTO eeg_recordings (
                        id, name, started_at, ended_at, duration_seconds,
                        device, device_address, sampling_rate, channels,
                        sample_count, metrics_count, calibration_passed,
                        avg_signal_quality, notes, tags, recording_type,
                        avg_coherence, avg_alpha, avg_theta, avg_beta,
                        avg_gamma, avg_delta, peak_coherence
                    ) VALUES (
                        %(id)s, %(name)s, %(started_at)s, %(ended_at)s, %(duration_seconds)s,
                        %(device)s, %(device_address)s, %(sampling_rate)s, %(channels)s,
                        %(sample_count)s, %(metrics_count)s, %(calibration_passed)s,
                        %(avg_signal_quality)s, %(notes)s, %(tags)s, %(recording_type)s,
                        %(avg_coherence)s, %(avg_alpha)s, %(avg_theta)s, %(avg_beta)s,
                        %(avg_gamma)s, %(avg_delta)s, %(peak_coherence)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name               = EXCLUDED.name,
                        ended_at           = EXCLUDED.ended_at,
                        duration_seconds   = EXCLUDED.duration_seconds,
                        sample_count       = EXCLUDED.sample_count,
                        metrics_count      = EXCLUDED.metrics_count,
                        avg_signal_quality = EXCLUDED.avg_signal_quality,
                        avg_coherence      = EXCLUDED.avg_coherence,
                        avg_alpha          = EXCLUDED.avg_alpha,
                        avg_theta          = EXCLUDED.avg_theta,
                        avg_beta           = EXCLUDED.avg_beta,
                        avg_gamma          = EXCLUDED.avg_gamma,
                        avg_delta          = EXCLUDED.avg_delta,
                        peak_coherence     = EXCLUDED.peak_coherence
                """, dict(session))
                conn.commit()
                print(f"   ✓ PostgreSQL: sesión #{session['id']} → prod")
                return session['id']
            except Exception as e:
                conn.rollback()
                raise RuntimeError(f"Error subiendo metadatos a prod: {e}") from e


def upload_influx_metrics(session_id: int):
    """
    Lee las métricas de local InfluxDB y las escribe en prod InfluxDB.
    """
    # Leer de local
    with local_influx_client() as lclient:
        qapi = lclient.query_api()
        query = f'''
        from(bucket: "{LOCAL_INFLUX["bucket"]}")
            |> range(start: -90d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_metrics")
            |> filter(fn: (r) => r["recording_id"] == "{session_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        tables = qapi.query(query, org=LOCAL_INFLUX["org"])
        metrics = []
        for table in tables:
            for record in table.records:
                metrics.append({
                    "time": record.get_time(),
                    "coherence":      record.values.get("coherence", 0),
                    "entropy":        record.values.get("entropy", 0),
                    "plv":            record.values.get("plv", 0),
                    "delta":          record.values.get("delta", 0),
                    "theta":          record.values.get("theta", 0),
                    "alpha":          record.values.get("alpha", 0),
                    "beta":           record.values.get("beta", 0),
                    "gamma":          record.values.get("gamma", 0),
                    "state":          record.values.get("state", ""),
                    "signal_quality": record.values.get("signal_quality", 0),
                })

    if not metrics:
        print(f"   ⚠️  InfluxDB: sin métricas locales para sesión #{session_id}")
        return 0

    # Escribir en prod
    with prod_influx_client() as pclient:
        wapi = pclient.write_api(write_options=SYNCHRONOUS)
        points = []
        for m in metrics:
            p = (
                Point("eeg_metrics")
                .tag("recording_id", str(session_id))
                .field("coherence",      m["coherence"])
                .field("entropy",        m["entropy"])
                .field("plv",            m["plv"])
                .field("delta",          m["delta"])
                .field("theta",          m["theta"])
                .field("alpha",          m["alpha"])
                .field("beta",           m["beta"])
                .field("gamma",          m["gamma"])
                .field("signal_quality", m["signal_quality"])
                .field("state",          m["state"])
                .time(m["time"], WritePrecision.NS)
            )
            points.append(p)

        # Escribir en lotes de 500
        batch_size = 500
        for i in range(0, len(points), batch_size):
            wapi.write(bucket=PROD_INFLUX["bucket"], org=PROD_INFLUX["org"], record=points[i:i+batch_size])

    print(f"   ✓ InfluxDB: {len(metrics)} métricas → prod")
    return len(metrics)


def sync_session(session_id: int, force: bool = False):
    """Sube una sesión completa (metadata + métricas) a producción."""
    print(f"\n📤 Subiendo sesión #{session_id} a producción…")

    session = get_local_session(session_id)
    if not session:
        print(f"   ❌ Sesión #{session_id} no encontrada en local")
        return False

    print(f"   📋 {session['name'] or f'Sesión #{session_id}'} — {session.get('duration_seconds', 0):.1f}s")

    if not force and session_exists_in_prod(session_id):
        print(f"   ⚠️  Ya existe en prod. Usa --force para sobreescribir.")
        return False

    try:
        upload_session_metadata(session)
        n = upload_influx_metrics(session_id)
        print(f"   ✅ Sesión #{session_id} subida correctamente ({n} métricas)")
        return True
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


# ── CLI ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Sube sesiones EEG locales a producción")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--last",  action="store_true", help="Última sesión grabada")
    group.add_argument("--id",    type=int,            help="ID de sesión específica")
    group.add_argument("--all",   action="store_true", help="Todas las sesiones locales")
    group.add_argument("--list",  action="store_true", help="Listar sesiones locales")
    parser.add_argument("--force", action="store_true", help="Sobreescribir si ya existe en prod")
    args = parser.parse_args()

    if args.list:
        sessions = list_local_sessions()
        print(f"\n{'ID':>4}  {'Nombre':<25}  {'Inicio':<20}  {'Dur':>6}  {'Señal':>5}")
        print("─" * 70)
        for s in sessions:
            started = str(s['started_at'])[:16] if s['started_at'] else '–'
            dur     = f"{s['duration_seconds']:.0f}s" if s['duration_seconds'] else '–'
            qual    = f"{s['avg_signal_quality']:.2f}" if s['avg_signal_quality'] else '–'
            print(f"{s['id']:>4}  {(s['name'] or '–'):<25}  {started:<20}  {dur:>6}  {qual:>5}")
        return

    if args.last:
        sessions = list_local_sessions()
        if not sessions:
            print("❌ No hay sesiones locales")
            sys.exit(1)
        session_id = sessions[0]['id']
    elif args.id:
        session_id = args.id
    else:  # --all
        sessions = list_local_sessions()
        ok = sum(sync_session(s['id'], force=args.force) for s in sessions)
        print(f"\n✅ {ok}/{len(sessions)} sesiones subidas")
        return

    sync_session(session_id, force=args.force)


if __name__ == "__main__":
    main()
