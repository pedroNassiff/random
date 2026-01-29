"""
Comparación detallada: Datos del WebSocket vs InfluxDB durante playback.
"""
import requests
import websockets
import asyncio
import json
from influxdb_client import InfluxDBClient

INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "my-super-secret-auth-token"
INFLUX_ORG = "teoria-sintergica"
INFLUX_BUCKET = "eeg-data"

async def capture_ws_data(duration_secs=5):
    """Captura datos del WebSocket durante playback."""
    ws_data = []
    
    try:
        async with websockets.connect("ws://localhost:8000/ws/brain-state") as ws:
            start_time = asyncio.get_event_loop().time()
            
            while asyncio.get_event_loop().time() - start_time < duration_secs:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                    data = json.loads(msg)
                    ws_data.append({
                        'alpha': data.get('bands', {}).get('alpha', 0),
                        'coherence': data.get('coherence', 0),
                        'entropy': data.get('entropy', 0),
                        'state': data.get('state', ''),
                        'session_timestamp': data.get('session_timestamp', 0),
                        'session_progress': data.get('session_progress', 0),
                        'source': data.get('source', 'unknown'),  # Nuevo: detectar si son pregrabadas
                    })
                except asyncio.TimeoutError:
                    continue
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    return ws_data

def get_influx_metrics(recording_id=6, limit=50):
    """Obtiene métricas guardadas en InfluxDB."""
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    query_api = client.query_api()
    
    query = f'''
    from(bucket: "{INFLUX_BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "eeg_metrics" and r.recording_id == "{recording_id}")
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> limit(n: {limit})
    '''
    
    result = query_api.query(query)
    
    metrics = []
    for table in result:
        for record in table.records:
            metrics.append({
                'time': str(record.get_time()),
                'alpha': record.values.get('alpha', 0),
                'coherence': record.values.get('coherence', 0),
                'entropy': record.values.get('entropy', 0),
                'state': record.values.get('state', '')
            })
    
    client.close()
    return metrics

def main():
    # 1. Verificar que el reproductor esté activo
    status = requests.get("http://localhost:8000/session/status").json()
    print("=== Estado del Reproductor ===")
    print(f"  Session activa: {status.get('is_active', False)}")
    print(f"  Reproduciendo: {status.get('is_playing', False)}")
    print(f"  Duracion: {status.get('duration', 0):.1f}s")
    print(f"  DB ID: {status.get('db_id', 'N/A')}")
    
    if not status.get('is_playing'):
        print("\n[!] El reproductor no esta reproduciendo. Iniciando playback...")
        requests.post("http://localhost:8000/session/play")
        import time
        time.sleep(1)
    
    # 2. Obtener métricas de InfluxDB
    print("\n=== Metricas Guardadas en InfluxDB ===")
    db_metrics = get_influx_metrics(recording_id=6, limit=10)
    for i, m in enumerate(db_metrics[:5]):
        print(f"  [{i}] alpha={m['alpha']:.4f}, coherence={m['coherence']:.4f}, entropy={m['entropy']:.4f}")
    
    # 3. Capturar datos del WebSocket
    print("\n=== Capturando datos del WebSocket (5 segundos) ===")
    ws_data = asyncio.run(capture_ws_data(duration_secs=5))
    
    print(f"\nCapturados {len(ws_data)} frames del WebSocket:")
    for i, w in enumerate(ws_data[:15]):
        source = w.get('source') or 'unknown'
        ts = w.get('session_timestamp') or 0
        progress = w.get('session_progress') or 0
        print(f"  [{i}] ts={ts:.1f}s alpha={w['alpha']:.4f}, coherence={w['coherence']:.4f}, progress={progress:.1f}%, source={source}")
    
    # 4. Comparación
    print("\n=== COMPARACION ===")
    print("InfluxDB (primeros 5):")
    for m in db_metrics[:5]:
        print(f"  alpha={m['alpha']:.4f}, coherence={m['coherence']:.4f}")
    
    print("\nWebSocket (primeros 5):")
    for w in ws_data[:5]:
        print(f"  alpha={w['alpha']:.4f}, coherence={w['coherence']:.4f}")
    
    print("\n>>> CONCLUSION:")
    if ws_data:
        avg_ws_alpha = sum(w['alpha'] for w in ws_data) / len(ws_data)
        avg_db_alpha = sum(m['alpha'] for m in db_metrics[:len(ws_data)]) / min(len(db_metrics), len(ws_data))
        
        avg_ws_coh = sum(w['coherence'] for w in ws_data) / len(ws_data)
        avg_db_coh = sum(m['coherence'] for m in db_metrics[:len(ws_data)]) / min(len(db_metrics), len(ws_data))
        
        print(f"  Promedio Alpha - WS: {avg_ws_alpha:.4f}, DB: {avg_db_alpha:.4f}")
        print(f"  Promedio Coherence - WS: {avg_ws_coh:.4f}, DB: {avg_db_coh:.4f}")
        
        # Detectar si coherence es fija (desviación cercana a 0)
        coherence_values = [w['coherence'] for w in ws_data]
        coherence_std = (sum((c - avg_ws_coh)**2 for c in coherence_values) / len(coherence_values))**0.5
        
        if coherence_std < 0.01:
            print(f"\n  [!] Coherence tiene variacion muy baja ({coherence_std:.4f})")
            print("      Las metricas se RECALCULAN, no se usan las pregrabadas de InfluxDB")

if __name__ == "__main__":
    main()
