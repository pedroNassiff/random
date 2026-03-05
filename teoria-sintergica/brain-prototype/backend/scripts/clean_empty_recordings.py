#!/usr/bin/env python3
"""
Script para limpiar grabaciones sin datos de InfluxDB.

Elimina de PostgreSQL las grabaciones que no tienen samples en InfluxDB.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.postgres_client import get_postgres_client_sync
from database.influx_client import get_influx_client


def clean_empty_recordings(dry_run=True, recording_ids=None):
    """
    Limpia grabaciones que no tienen datos en InfluxDB.
    
    Args:
        dry_run: Si True, solo muestra qué se eliminaría sin borrar
        recording_ids: Lista de IDs específicos a limpiar (None = verificar todos)
    """
    postgres = get_postgres_client_sync()
    postgres.connect()
    
    influx = get_influx_client()
    influx.connect()
    
    # Get all recordings or specific ones
    if recording_ids:
        recordings = [postgres.get_recording(rid) for rid in recording_ids]
        recordings = [r for r in recordings if r is not None]
    else:
        recordings = postgres.get_all_recordings()
    
    if not recordings:
        print("❌ No recordings found")
        return
    
    print(f"{'='*60}")
    print(f"🧹 LIMPIEZA DE GRABACIONES VACÍAS")
    print(f"{'='*60}\n")
    
    empty_recordings = []
    valid_recordings = []
    
    # Check each recording
    for recording in recordings:
        print(f"📦 Recording #{recording.id}: {recording.name}")
        
        # Check if has data in InfluxDB
        sample_count = influx.get_sample_count(recording.id)
        
        if sample_count == 0:
            print(f"   ❌ Sin datos en InfluxDB (PostgreSQL dice {recording.sample_count} samples)")
            empty_recordings.append(recording)
        else:
            print(f"   ✅ Tiene {sample_count} samples en InfluxDB")
            valid_recordings.append(recording)
    
    print(f"\n{'='*60}")
    print(f"📊 RESUMEN")
    print(f"{'='*60}")
    print(f"✅ Grabaciones válidas: {len(valid_recordings)}")
    print(f"❌ Grabaciones vacías: {len(empty_recordings)}")
    
    if not empty_recordings:
        print("\n🎉 No hay grabaciones vacías para limpiar")
        return
    
    print(f"\n📋 Grabaciones a eliminar:")
    for rec in empty_recordings:
        print(f"   - #{rec.id}: {rec.name} ({rec.started_at})")
    
    if dry_run:
        print(f"\n🔍 DRY RUN - No se eliminó nada")
        print(f"   Ejecuta con --confirm para eliminar realmente")
        return
    
    # Confirm deletion
    print(f"\n⚠️  ¿Eliminar {len(empty_recordings)} grabaciones? (escribe 'eliminar' para confirmar)")
    response = input(">>> ")
    
    if response.strip().lower() != 'eliminar':
        print("❌ Cancelado")
        return
    
    # Delete recordings
    print(f"\n🗑️  Eliminando grabaciones...")
    
    deleted_count = 0
    failed_count = 0
    
    for rec in empty_recordings:
        try:
            # Delete from PostgreSQL
            with postgres._conn.cursor() as cur:
                cur.execute('DELETE FROM eeg_recordings WHERE id = %s', (rec.id,))
                postgres._conn.commit()
            print(f"   ✅ Eliminado: #{rec.id} - {rec.name}")
            deleted_count += 1
        except Exception as e:
            print(f"   ❌ Error eliminando #{rec.id}: {e}")
            failed_count += 1
    
    print(f"\n{'='*60}")
    print(f"✅ Eliminados: {deleted_count}")
    print(f"❌ Fallidos: {failed_count}")
    print(f"{'='*60}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Clean empty recordings from PostgreSQL"
    )
    parser.add_argument('--confirm', action='store_true',
                       help='Actually delete recordings (default is dry-run)')
    parser.add_argument('--ids', type=str, metavar='1,2,3',
                       help='Specific recording IDs to check (comma-separated)')
    parser.add_argument('--range', type=str, metavar='1-9',
                       help='Range of recording IDs to check (e.g., 1-9)')
    
    args = parser.parse_args()
    
    recording_ids = None
    
    if args.ids:
        recording_ids = [int(x.strip()) for x in args.ids.split(',')]
    elif args.range:
        start, end = map(int, args.range.split('-'))
        recording_ids = list(range(start, end + 1))
    
    clean_empty_recordings(
        dry_run=not args.confirm,
        recording_ids=recording_ids
    )


if __name__ == '__main__':
    main()
