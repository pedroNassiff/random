#!/usr/bin/env python3
"""
sync_to_prod.py
---------------
Sube sesiones EEG grabadas en LOCAL a las BBDDs de PRODUCCIÓN.

Arquitectura:
  local PostgreSQL  →  prod PostgreSQL  (metadatos de sesión)
  local InfluxDB    →  prod InfluxDB    (métricas + samples + eventos)
  local JSONs       →  prod server      (validation logs vía SCP)

Requiere que tunnel-prod-db.sh esté corriendo en background:
  ./tunnel-prod-db.sh --bg

Uso:
  python scripts/sync_to_prod.py --last          # última sesión grabada
  python scripts/sync_to_prod.py --id 11         # sesión específica
  python scripts/sync_to_prod.py --all           # todas las no sincronizadas
  python scripts/sync_to_prod.py --list          # lista sesiones locales
  python scripts/sync_to_prod.py --id 25 --validate  # sync + trigger validation on prod
"""

import os, sys, json, argparse, subprocess, glob
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


def upload_influx_samples(session_id: int):
    """
    Lee los raw EEG samples (256Hz, 4 canales) de local InfluxDB
    y los escribe en prod InfluxDB.
    """
    with local_influx_client() as lclient:
        qapi = lclient.query_api()
        query = f'''
        from(bucket: "{LOCAL_INFLUX["bucket"]}")
            |> range(start: -90d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_sample")
            |> filter(fn: (r) => r["recording_id"] == "{session_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        tables = qapi.query(query, org=LOCAL_INFLUX["org"])
        samples = []
        for table in tables:
            for record in table.records:
                samples.append({
                    "time": record.get_time(),
                    "tp9":  record.values.get("tp9", 0),
                    "af7":  record.values.get("af7", 0),
                    "af8":  record.values.get("af8", 0),
                    "tp10": record.values.get("tp10", 0),
                    "aux":  record.values.get("aux", None),
                })

    if not samples:
        print(f"   ⚠️  InfluxDB: sin samples locales para sesión #{session_id}")
        return 0

    with prod_influx_client() as pclient:
        wapi = pclient.write_api(write_options=SYNCHRONOUS)
        points = []
        for s in samples:
            p = (
                Point("eeg_sample")
                .tag("recording_id", str(session_id))
                .field("tp9",  s["tp9"])
                .field("af7",  s["af7"])
                .field("af8",  s["af8"])
                .field("tp10", s["tp10"])
                .time(s["time"], WritePrecision.NS)
            )
            if s["aux"] is not None and s["aux"] != 0:
                p = p.field("aux", s["aux"])
            points.append(p)

        batch_size = 1000
        total = len(points)
        for i in range(0, total, batch_size):
            wapi.write(bucket=PROD_INFLUX["bucket"], org=PROD_INFLUX["org"], record=points[i:i+batch_size])
            if total > 5000 and (i // batch_size) % 10 == 0:
                pct = min(100, int((i / total) * 100))
                print(f"   … samples {pct}% ({i}/{total})", end="\r")

    print(f"   ✓ InfluxDB: {len(samples)} samples → prod         ")
    return len(samples)


def upload_influx_events(session_id: int):
    """
    Lee los eventos/marcadores de protocolo de local InfluxDB
    y los escribe en prod InfluxDB.
    """
    with local_influx_client() as lclient:
        qapi = lclient.query_api()
        query = f'''
        from(bucket: "{LOCAL_INFLUX["bucket"]}")
            |> range(start: -90d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_event")
            |> filter(fn: (r) => r["recording_id"] == "{session_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        tables = qapi.query(query, org=LOCAL_INFLUX["org"])
        events = []
        for table in tables:
            for record in table.records:
                events.append({
                    "time":       record.get_time(),
                    "event_type": record.values.get("event_type", ""),
                    "label":      record.values.get("label", ""),
                    "values":     {k: v for k, v in record.values.items()
                                   if k not in ("_time", "_start", "_stop", "_measurement",
                                                "recording_id", "event_type", "label",
                                                "result", "table")},
                })

    if not events:
        print(f"   ⚠️  InfluxDB: sin eventos locales para sesión #{session_id}")
        return 0

    with prod_influx_client() as pclient:
        wapi = pclient.write_api(write_options=SYNCHRONOUS)
        points = []
        for e in events:
            p = (
                Point("eeg_event")
                .tag("recording_id", str(session_id))
                .tag("event_type", e["event_type"])
                .field("label", e["label"])
                .time(e["time"], WritePrecision.NS)
            )
            for fk, fv in e["values"].items():
                if isinstance(fv, (int, float)):
                    p = p.field(fk, fv)
                elif isinstance(fv, str) and fv:
                    p = p.field(fk, fv)
            points.append(p)

        wapi.write(bucket=PROD_INFLUX["bucket"], org=PROD_INFLUX["org"], record=points)

    print(f"   ✓ InfluxDB: {len(events)} eventos → prod")
    return len(events)


# ── Validation & Protocol log upload (SCP) ────────────────────────────────────
VALIDATION_LOGS_DIR = BACKEND_DIR / "validation_logs"
PROD_SSH_HOST = os.getenv("PROD_SSH_HOST", "api.random-lab.es")
PROD_SSH_USER = os.getenv("PROD_SSH_USER", "root")
PROD_REMOTE_LOGS_DIR = os.getenv("PROD_VALIDATION_LOGS_DIR",
    "/root/random/teoria-sintergica/brain-prototype/backend/validation_logs")


def upload_validation_json(session_id: int):
    """Sube el validate-{session_id}.json a prod vía SCP."""
    local_file = VALIDATION_LOGS_DIR / f"validate-{session_id}.json"
    if not local_file.exists():
        print(f"   ⚠️  validate-{session_id}.json no existe localmente")
        return False

    remote = f"{PROD_SSH_USER}@{PROD_SSH_HOST}:{PROD_REMOTE_LOGS_DIR}/"
    result = subprocess.run(
        ["scp", "-q", str(local_file), remote],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"   ❌ SCP validate-{session_id}.json falló: {result.stderr.strip()}")
        return False

    print(f"   ✓ SCP: validate-{session_id}.json → prod")
    return True


def upload_protocol_logs():
    """Sube todos los protocol logs COMPLETE a prod vía SCP (si no existen allá)."""
    complete_logs = sorted(VALIDATION_LOGS_DIR.glob("validation_*_COMPLETE.json"))
    if not complete_logs:
        print("   ⚠️  Sin protocol logs COMPLETE locales")
        return 0

    uploaded = 0
    for log_file in complete_logs:
        remote = f"{PROD_SSH_USER}@{PROD_SSH_HOST}:{PROD_REMOTE_LOGS_DIR}/"
        result = subprocess.run(
            ["scp", "-q", str(log_file), remote],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            uploaded += 1
        else:
            print(f"   ❌ SCP {log_file.name} falló: {result.stderr.strip()}")

    if uploaded:
        print(f"   ✓ SCP: {uploaded} protocol log(s) → prod")
    return uploaded


def trigger_prod_validation(session_id: int):
    """
    Llama al endpoint /protocol/validate/{session_id} en prod (vía tunnel)
    para generar/regenerar validate-{session_id}.json en el servidor.
    """
    import urllib.request, urllib.error
    prod_api = os.getenv("PROD_API_URL", f"http://localhost:{os.getenv('PROD_API_PORT', '8000')}")
    url = f"{prod_api}/protocol/validate/{session_id}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            if data.get("status") == "success":
                # Save locally too if we don't have it
                local_file = VALIDATION_LOGS_DIR / f"validate-{session_id}.json"
                if not local_file.exists():
                    local_file.write_text(json.dumps(data, indent=2))
                    print(f"   ✓ Validation: guardada localmente en validate-{session_id}.json")
                # Save on prod via SCP
                local_file.write_text(json.dumps(data, indent=2))
                upload_validation_json(session_id)
                print(f"   ✓ Validation: sesión #{session_id} validada en prod")
                return True
            else:
                print(f"   ⚠️  Validation: {data.get('detail', 'error desconocido')}")
                return False
    except urllib.error.URLError as e:
        print(f"   ⚠️  Validation endpoint no accesible: {e}")
        print(f"      (si no tienes tunnel al API, sube manualmente: scp validate-{session_id}.json prod:...)")
        return False


def sync_session(session_id: int, force: bool = False, validate: bool = False):
    """Sube una sesión completa (metadata + samples + métricas + eventos + logs) a producción."""
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
        # 1. PostgreSQL metadata
        upload_session_metadata(session)

        # 2. InfluxDB metrics (processed 2s windows)
        n_metrics = upload_influx_metrics(session_id)

        # 3. InfluxDB raw samples (256Hz EEG)
        n_samples = upload_influx_samples(session_id)

        # 4. InfluxDB events (protocol markers)
        n_events = upload_influx_events(session_id)

        # 5. Validation JSON (if exists locally)
        upload_validation_json(session_id)

        # 6. Protocol logs
        upload_protocol_logs()

        # 7. Optionally trigger validation on prod
        if validate:
            trigger_prod_validation(session_id)

        print(f"\n   ✅ Sesión #{session_id} subida correctamente")
        print(f"      {n_metrics} métricas · {n_samples} samples · {n_events} eventos")
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
    parser.add_argument("--force",    action="store_true", help="Sobreescribir si ya existe en prod")
    parser.add_argument("--validate", action="store_true", help="Trigger validation en prod después de subir")
    parser.add_argument("--no-samples", action="store_true", help="Skip raw EEG samples (solo métricas)")
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

    # Inyectar skip_samples en sync_session si se pasa --no-samples
    if getattr(args, 'no_samples', False):
        global upload_influx_samples
        upload_influx_samples = lambda sid: (print(f"   ⏭  Skipping samples (--no-samples)"), 0)[1]

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
        ok = sum(sync_session(s['id'], force=args.force, validate=args.validate) for s in sessions)
        print(f"\n✅ {ok}/{len(sessions)} sesiones subidas")
        return

    sync_session(session_id, force=args.force, validate=args.validate)


if __name__ == "__main__":
    main()
