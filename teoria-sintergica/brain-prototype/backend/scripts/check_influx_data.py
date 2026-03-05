#!/usr/bin/env python3
"""Check what data exists in InfluxDB."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.influx_client import get_influx_client, INFLUX_ORG

influx = get_influx_client()
influx.connect()

# Listar todos los buckets
buckets_api = influx.client.buckets_api()
buckets = buckets_api.find_buckets(org=INFLUX_ORG).buckets

print('📦 Buckets disponibles:')
print('=' * 60)
for bucket in buckets:
    print(f'  - {bucket.name}')

print(f'\nTotal: {len(buckets)} buckets\n')

# Buscar datos en cada bucket
for bucket in buckets:
    print(f'🔍 Bucket: {bucket.name}')
    print('-' * 60)
    
    # Buscar primeros 5 records
    query = f'''
    from(bucket: "{bucket.name}")
        |> range(start: -90d)
        |> limit(n: 5)
    '''
    
    try:
        tables = influx.query_api.query(query, org=INFLUX_ORG)
        count = sum(len(table.records) for table in tables)
        
        if count > 0:
            print(f'   ✅ Tiene datos ({count} records en sample)')
            
            # Buscar measurements
            query2 = f'''
            from(bucket: "{bucket.name}")
                |> range(start: -90d)
                |> group()
                |> distinct(column: "_measurement")
                |> limit(n: 50)
            '''
            
            tables2 = influx.query_api.query(query2, org=INFLUX_ORG)
            measurements = set()
            for table in tables2:
                for record in table.records:
                    measurements.add(record.get_value())
            
            print(f'   Measurements: {", ".join(sorted(measurements))}')
            
            # Para cada measurement, contar recording_ids
            for meas in sorted(measurements):
                query3 = f'''
                from(bucket: "{bucket.name}")
                    |> range(start: -90d)
                    |> filter(fn: (r) => r["_measurement"] == "{meas}")
                    |> group()
                    |> distinct(column: "recording_id")
                    |> limit(n: 100)
                '''
                tables3 = influx.query_api.query(query3, org=INFLUX_ORG)
                rec_ids = set()
                for table in tables3:
                    for record in table.records:
                        val = record.get_value()
                        if val:
                            rec_ids.add(val)
                
                print(f'     • {meas}: {len(rec_ids)} recording_ids → {sorted(rec_ids)}')
        else:
            print(f'   ❌ Vacío (no hay datos)')
            
    except Exception as e:
        print(f'   ⚠️  Error: {e}')
    
    print()
