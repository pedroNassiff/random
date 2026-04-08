"""
Queries diagnósticas para sesión 26.
Corre: python3 scripts/query_session26.py
"""
import os
from influxdb_client import InfluxDBClient

INFLUX_URL   = os.getenv('INFLUX_URL',   'http://localhost:8086')
INFLUX_TOKEN = os.getenv('INFLUX_TOKEN', 'my-super-secret-auth-token')
INFLUX_ORG   = os.getenv('INFLUX_ORG',  'teoria-sintergica')
BUCKET       = os.getenv('INFLUX_BUCKET','eeg-data')

client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
q = client.query_api()

# ─── Q1: Confirmar que bandas son normalizadas (suman ~1.0) ───────────────────
print("\n" + "="*70)
print("Q1 — ¿Las bandas almacenadas suman 1.0? (primeras 10 filas de sesión 26)")
print("="*70)

flux_q1 = '''
from(bucket: "eeg-data")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "eeg_metrics")
  |> filter(fn: (r) => r.recording_id == "26")
  |> filter(fn: (r) => r._field == "alpha" or r._field == "delta" or r._field == "theta" or r._field == "beta" or r._field == "gamma")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
  |> limit(n: 10)
'''

tables = q.query(flux_q1, org=INFLUX_ORG)
print(f"{'time':10s}  {'δ':6s}  {'θ':6s}  {'α':6s}  {'β':7s}  {'γ':6s}  {'SUM':5s}")
print("-"*55)
for table in tables:
    for r in table.records:
        a = r.values.get('alpha', 0) or 0
        d = r.values.get('delta', 0) or 0
        t = r.values.get('theta', 0) or 0
        b = r.values.get('beta',  0) or 0
        g = r.values.get('gamma', 0) or 0
        s = a + d + t + b + g
        ts = str(r.get_time())[11:19]
        print(f"{ts}  {d:.4f}  {t:.4f}  {a:.4f}  {b:.5f}  {g:.5f}  {s:.4f}")

# ─── Q2: Markers de sesión 26 con tiempos relativos ──────────────────────────
print("\n" + "="*70)
print("Q2 — Markers de sesión 26")
print("="*70)

flux_q2 = '''
from(bucket: "eeg-data")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "eeg_event")
  |> filter(fn: (r) => r.recording_id == "26")
  |> filter(fn: (r) => r._field == "label")
  |> sort(columns: ["_time"])
'''

marker_rows = []
tables = q.query(flux_q2, org=INFLUX_ORG)
for table in tables:
    for r in table.records:
        marker_rows.append((r.get_time(), r.get_value()))

if marker_rows:
    t0 = marker_rows[0][0]
    print(f"Session start: {t0}")
    print(f"{'elapsed':>8s}   label")
    print("-"*50)
    for ts, label in marker_rows:
        elapsed = (ts - t0).total_seconds()
        print(f"+{elapsed:6.0f}s   {label}")
    
    # Extraer timestamps de cognitive_task para Q3
    cog_start = next((ts for ts, l in marker_rows if l == 'cognitive_task_start'), None)
    cog_end   = next((ts for ts, l in marker_rows if l == 'cognitive_task_end'),   None)
    med_end   = next((ts for ts, l in marker_rows if l == 'meditation_free_end'),  None)
else:
    print("No markers found → usando timestamps hardcodeados de análisis anterior")
    from datetime import datetime, timezone
    cog_start = datetime(2026, 3, 26, 7, 23, 14, tzinfo=timezone.utc)
    cog_end   = datetime(2026, 3, 26, 7, 24, 15, tzinfo=timezone.utc)
    med_end   = datetime(2026, 3, 26, 7, 23, 14, tzinfo=timezone.utc)

# ─── Q3: Bandas durante cognitive_task ───────────────────────────────────────
print("\n" + "="*70)
print("Q3 — Bandas segundo a segundo durante cognitive_task")
print("     (confirma si beta=0.006 es artefacto de normalización o movimiento)")
print("="*70)

from datetime import timedelta
flux_q3 = f'''
from(bucket: "eeg-data")
  |> range(start: {cog_start.strftime('%Y-%m-%dT%H:%M:%SZ')}, stop: {cog_end.strftime('%Y-%m-%dT%H:%M:%SZ')})
  |> filter(fn: (r) => r._measurement == "eeg_metrics")
  |> filter(fn: (r) => r.recording_id == "26")
  |> filter(fn: (r) => r._field == "delta" or r._field == "beta" or r._field == "gamma" or r._field == "alpha" or r._field == "theta")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"])
'''

tables = q.query(flux_q3, org=INFLUX_ORG)
cog_rows = []
for table in tables:
    for r in table.records:
        cog_rows.append(r)

print(f"Ventanas en cognitive_task: {len(cog_rows)}")
print(f"\n{'time':10s}  {'δ':6s}  {'θ':6s}  {'α':6s}  {'β':7s}  {'γ':6s}")
print("-"*55)

import statistics
betas, deltas, gammas = [], [], []
for r in cog_rows:
    a = r.values.get('alpha', 0) or 0
    d = r.values.get('delta', 0) or 0
    t = r.values.get('theta', 0) or 0
    b = r.values.get('beta',  0) or 0
    g = r.values.get('gamma', 0) or 0
    betas.append(b); deltas.append(d); gammas.append(g)
    ts = str(r.get_time())[11:19]
    print(f"{ts}  {d:.4f}  {t:.4f}  {a:.4f}  {b:.5f}  {g:.5f}")

if betas:
    print(f"\n{'MEDIA':10s}  {sum(deltas)/len(deltas):.4f}  {'':6s}  {'':6s}  {sum(betas)/len(betas):.5f}  {sum(gammas)/len(gammas):.5f}")
    print(f"\nDiagnóstico:")
    avg_beta = sum(betas)/len(betas)
    avg_delta = sum(deltas)/len(deltas)
    if avg_beta < 0.01:
        print(f"  ⚠️  beta MEDIO={avg_beta:.4f} es físicamente imposible en vigilia")
        print(f"  ⚠️  delta MEDIO={avg_delta:.3f} — si >0.80 es artefacto de movimiento")
        if avg_delta > 0.75:
            print(f"  → CONCLUSIÓN: Artefacto de movimiento durante la tarea aritmética.")
            print(f"     Delta se disparó ({avg_delta:.2f}) aplastando la proporción de beta.")
        else:
            print(f"  → CONCLUSIÓN: Bug de normalización. Delta no está exagerado.")
    else:
        print(f"  ✓ beta={avg_beta:.4f} parece fisiológico — revisar ventana de comparación")

client.close()
