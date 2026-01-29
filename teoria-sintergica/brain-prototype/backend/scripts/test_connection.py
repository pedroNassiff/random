#!/usr/bin/env python3
"""Test de conexión antes del protocolo de validación"""

from influxdb_client import InfluxDBClient

INFLUX_URL = 'http://localhost:8086'
INFLUX_TOKEN = 'my-super-secret-auth-token'
INFLUX_ORG = 'teoria-sintergica'
INFLUX_BUCKET = 'eeg-data'

print('🔍 Probando conexión a InfluxDB...')
print(f'   URL: {INFLUX_URL}')
print(f'   Org: {INFLUX_ORG}')
print(f'   Bucket: {INFLUX_BUCKET}')

try:
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    
    # Test 1: Health check
    health = client.health()
    print(f'\n✅ Health: {health.status}')
    
    # Test 2: Query últimos datos
    query_api = client.query_api()
    query = f'''
    from(bucket: "{INFLUX_BUCKET}")
        |> range(start: -30s)
        |> filter(fn: (r) => r._measurement == "eeg_metrics")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> limit(n: 5)
    '''
    
    tables = query_api.query(query, org=INFLUX_ORG)
    
    count = 0
    last_alpha = None
    for table in tables:
        for record in table.records:
            count += 1
            last_alpha = record.values.get('alpha_power')
    
    print(f'✅ Métricas últimos 30s: {count} registros')
    if last_alpha:
        print(f'✅ Último alpha: {last_alpha:.4f}')
    else:
        print('⚠️  No hay métricas recientes (¿muselsl + backend corriendo?)')
    
    client.close()
    print('\n✅ CONEXIÓN OK - Listo para el protocolo')
    
except Exception as e:
    print(f'\n❌ ERROR: {e}')
