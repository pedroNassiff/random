#!/usr/bin/env python3
"""
Script para migrar samples de PostgreSQL a InfluxDB.

USO:
    python scripts/migrate_postgres_to_influx.py --all
    python scripts/migrate_postgres_to_influx.py --recording 1
    python scripts/migrate_postgres_to_influx.py --range 1-9
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime
import time

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.postgres_client import get_postgres_client_sync
from database.influx_client import get_influx_client, EEGSample


def migrate_recording(recording_id: int, dry_run: bool = False):
    """Migrate a single recording from PostgreSQL to InfluxDB."""
    
    print(f"\n{'='*60}")
    print(f"📦 MIGRANDO RECORDING #{recording_id}")
    print(f"{'='*60}")
    
    # Connect to databases
    postgres = get_postgres_client_sync()
    postgres.connect()
    
    influx = get_influx_client()
    influx.connect()
    
    # Get recording metadata
    recording = postgres.get_recording(recording_id)
    if not recording:
        print(f"❌ Recording {recording_id} not found in PostgreSQL")
        return False
    
    print(f"📝 Name: {recording.name}")
    print(f"📅 Start: {recording.started_at}")
    print(f"⏱  Duration: {recording.duration_seconds:.1f}s")
    
    # Check if already migrated
    existing_samples = influx.get_samples(recording_id, limit=1)
    if existing_samples:
        print(f"⚠️  Recording already has {len(existing_samples)} samples in InfluxDB")
        response = input("   ¿Sobrescribir? (y/N): ")
        if response.lower() != 'y':
            print("   Skipping...")
            return False
    
    # Get samples from PostgreSQL
    print(f"📊 Fetching samples from PostgreSQL...")
    samples = postgres.get_samples(recording_id)
    
    if not samples:
        print(f"❌ No samples found in PostgreSQL for recording {recording_id}")
        return False
    
    print(f"✓ Found {len(samples)} samples in PostgreSQL")
    
    if dry_run:
        print("🔍 DRY RUN - No data will be written")
        return True
    
    # Convert to InfluxDB format
    print(f"📝 Converting samples to InfluxDB format...")
    influx_samples = []
    
    for sample in samples:
        influx_samples.append(EEGSample(
            tp9=sample['tp9'],
            af7=sample['af7'],
            af8=sample['af8'],
            tp10=sample['tp10'],
            timestamp_ms=sample['timestamp_ms']
        ))
    
    # Write to InfluxDB in batches
    print(f"💾 Writing to InfluxDB...")
    batch_size = 5000
    total_batches = (len(influx_samples) + batch_size - 1) // batch_size
    
    start_time = time.time()
    
    for i in range(0, len(influx_samples), batch_size):
        batch = influx_samples[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        
        try:
            influx.write_samples(
                recording_id=recording_id,
                samples=batch,
                base_timestamp=recording.started_at
            )
            print(f"   ✓ Batch {batch_num}/{total_batches} ({len(batch)} samples)")
        except Exception as e:
            print(f"   ❌ Batch {batch_num} failed: {e}")
            return False
    
    elapsed = time.time() - start_time
    print(f"\n✅ Migration complete!")
    print(f"   Samples migrated: {len(influx_samples)}")
    print(f"   Time elapsed: {elapsed:.1f}s")
    print(f"   Rate: {len(influx_samples) / elapsed:.0f} samples/sec")
    
    return True


def migrate_range(start_id: int, end_id: int, dry_run: bool = False):
    """Migrate a range of recordings."""
    
    success_count = 0
    fail_count = 0
    skip_count = 0
    
    for recording_id in range(start_id, end_id + 1):
        try:
            if migrate_recording(recording_id, dry_run):
                success_count += 1
            else:
                skip_count += 1
        except Exception as e:
            print(f"❌ Error migrating recording {recording_id}: {e}")
            fail_count += 1
    
    print(f"\n{'='*60}")
    print(f"📋 RESUMEN")
    print(f"{'='*60}")
    print(f"✅ Exitosas: {success_count}")
    print(f"⏭  Salteadas: {skip_count}")
    print(f"❌ Fallidas: {fail_count}")


def main():
    parser = argparse.ArgumentParser(
        description="Migrate EEG samples from PostgreSQL to InfluxDB"
    )
    parser.add_argument('--all', action='store_true', 
                       help='Migrate all recordings')
    parser.add_argument('--recording', type=int, metavar='ID',
                       help='Migrate specific recording by ID')
    parser.add_argument('--range', type=str, metavar='START-END',
                       help='Migrate range of recordings (e.g., 1-9)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be migrated without writing data')
    
    args = parser.parse_args()
    
    if args.recording:
        migrate_recording(args.recording, args.dry_run)
    
    elif args.range:
        try:
            start, end = map(int, args.range.split('-'))
            migrate_range(start, end, args.dry_run)
        except ValueError:
            print("❌ Invalid range format. Use: --range 1-9")
            sys.exit(1)
    
    elif args.all:
        # Get all recordings
        postgres = get_postgres_client_sync()
        postgres.connect()
        recordings = postgres.get_all_recordings()
        
        if not recordings:
            print("❌ No recordings found in PostgreSQL")
            sys.exit(1)
        
        print(f"Found {len(recordings)} recordings")
        start_id = min(r.id for r in recordings)
        end_id = max(r.id for r in recordings)
        migrate_range(start_id, end_id, args.dry_run)
    
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()
