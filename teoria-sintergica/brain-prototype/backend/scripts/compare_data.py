#!/usr/bin/env python3
"""
Script para comparar datos guardados en BD con lo que muestra el reproductor.
"""
import sys
sys.path.insert(0, '/Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/backend')

from database.influx_client import get_influx_client
from database.postgres_client import get_postgres_client_sync

def main():
    recording_id = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    
    # Conectar
    influx = get_influx_client()
    postgres = get_postgres_client_sync()
    influx.connect()
    postgres.connect()
    
    # Obtener grabación
    recording = postgres.get_recording(recording_id)
    if not recording:
        print(f"❌ Grabación #{recording_id} no encontrada")
        return
    
    print(f'📁 Grabación #{recording_id}: {recording.name}')
    print(f'   Duración: {recording.duration_seconds:.1f}s')
    print(f'   Samples: {recording.sample_count}')
    print(f'   Metrics: {recording.metrics_count}')
    
    # Obtener primeros 10 samples
    samples = influx.get_samples(recording_id, limit=20)
    print(f'\n🔬 Primeros 10 samples EEG:')
    print('   idx | Time                    | TP9     | AF7     | AF8     | TP10')
    print('   ' + '-'*70)
    for i, s in enumerate(samples[:10]):
        t = s.get('_time', s.get('time', 'N/A'))
        tp9 = s.get('tp9', 0) or 0
        af7 = s.get('af7', 0) or 0
        af8 = s.get('af8', 0) or 0
        tp10 = s.get('tp10', 0) or 0
        time_str = str(t)[:23] if t else 'N/A'
        print(f'   {i:3d} | {time_str} | {tp9:7.2f} | {af7:7.2f} | {af8:7.2f} | {tp10:7.2f}')
    
    # Obtener samples del medio (para comparar con reproductor)
    mid_samples = influx.get_samples(recording_id, limit=1000)
    if len(mid_samples) > 500:
        print(f'\n📍 Samples del segundo 30-31 (aprox):')
        # A 256 Hz, el segundo 30 empieza en sample ~7680
        start_idx = min(7680, len(mid_samples) - 10)
        print('   idx  | Time                    | TP9     | AF7     | AF8     | TP10')
        print('   ' + '-'*70)
        for i in range(start_idx, min(start_idx + 10, len(mid_samples))):
            s = mid_samples[i]
            t = s.get('_time', s.get('time', 'N/A'))
            tp9 = s.get('tp9', 0) or 0
            af7 = s.get('af7', 0) or 0
            af8 = s.get('af8', 0) or 0
            tp10 = s.get('tp10', 0) or 0
            time_str = str(t)[:23] if t else 'N/A'
            print(f'   {i:4d} | {time_str} | {tp9:7.2f} | {af7:7.2f} | {af8:7.2f} | {tp10:7.2f}')
    
    # Obtener métricas
    metrics = influx.get_metrics(recording_id)
    print(f'\n📊 Primeras 10 métricas:')
    print('   idx | Time                    | Alpha    | Beta     | Theta    | Coherence')
    print('   ' + '-'*75)
    for i, m in enumerate(metrics[:10]):
        t = m.get('_time', m.get('time', 'N/A'))
        alpha = m.get('alpha', 0) or 0
        beta = m.get('beta', 0) or 0
        theta = m.get('theta', 0) or 0
        coh = m.get('coherence', 0) or 0
        time_str = str(t)[:23] if t else 'N/A'
        print(f'   {i:3d} | {time_str} | {alpha:8.2f} | {beta:8.2f} | {theta:8.2f} | {coh:8.4f}')
    
    # Estadísticas rápidas
    print(f'\n📈 Estadísticas de métricas:')
    alphas = [m.get('alpha', 0) or 0 for m in metrics]
    coherences = [m.get('coherence', 0) or 0 for m in metrics]
    
    if alphas:
        print(f'   Alpha: min={min(alphas):.2f}, max={max(alphas):.2f}, avg={sum(alphas)/len(alphas):.2f}')
    if coherences:
        print(f'   Coherencia: min={min(coherences):.4f}, max={max(coherences):.4f}, avg={sum(coherences)/len(coherences):.4f}')

if __name__ == '__main__':
    main()
