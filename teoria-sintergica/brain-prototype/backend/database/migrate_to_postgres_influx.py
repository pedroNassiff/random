#!/usr/bin/env python3
"""
Migration script: SQLite → PostgreSQL + InfluxDB

Migrates existing EEG sessions from SQLite to the new architecture:
- Session metadata → PostgreSQL (eeg_recordings table)
- EEG samples → InfluxDB (eeg_sample measurement)
- Metrics → InfluxDB (eeg_metrics measurement)
- Events → InfluxDB (eeg_event measurement)
"""

import sqlite3
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
import numpy as np

# Add parent to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.postgres_client import get_postgres_client
from database.influx_client import get_influx_client, EEGSample, MetricSnapshot


# SQLite database path
SQLITE_PATH = Path(__file__).parent / "sessions.db"


async def migrate_sessions():
    """Migrate all sessions from SQLite to PostgreSQL + InfluxDB."""
    
    # Connect to SQLite
    print(f"📂 Opening SQLite: {SQLITE_PATH}")
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    cursor = sqlite_conn.cursor()
    
    # Connect to PostgreSQL
    print("🐘 Connecting to PostgreSQL...")
    postgres = get_postgres_client()
    await postgres.connect()
    
    # Connect to InfluxDB
    print("📊 Connecting to InfluxDB...")
    influx = get_influx_client()
    influx.connect()
    
    # Get all sessions from SQLite
    cursor.execute('''
        SELECT id, name, start_time, end_time, duration_seconds, 
               device, sampling_rate, channels, notes, tags,
               calibration_passed, avg_signal_quality
        FROM sessions
        ORDER BY id
    ''')
    sessions = cursor.fetchall()
    
    print(f"\n📋 Found {len(sessions)} sessions to migrate\n")
    
    # Map old session IDs to new recording IDs
    id_mapping = {}
    
    for session in sessions:
        old_id = session['id']
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"📦 Migrating Session #{old_id}: {session['name']}")
        
        # Parse start time
        start_time_str = session['start_time']
        try:
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        except:
            start_time = datetime.now() - timedelta(seconds=session['duration_seconds'] or 0)
        
        # Parse tags
        tags = []
        if session['tags']:
            tags = [t.strip() for t in session['tags'].split(',') if t.strip()]
        
        # Create recording in PostgreSQL
        new_id = await postgres.create_recording(
            name=session['name'],
            notes=session['notes'] or '',
            tags=tags,
            device=session['device'] or 'muse2',
            sampling_rate=session['sampling_rate'] or 256,
            recording_type='session'
        )
        
        id_mapping[old_id] = new_id
        print(f"   ✓ Created PostgreSQL recording #{new_id}")
        
        # Migrate EEG samples
        cursor.execute('''
            SELECT timestamp, tp9, af7, af8, tp10, aux
            FROM eeg_samples
            WHERE session_id = ?
            ORDER BY timestamp
        ''', (old_id,))
        
        samples_data = cursor.fetchall()
        sample_count = len(samples_data)
        
        if sample_count > 0:
            print(f"   📤 Migrating {sample_count} samples to InfluxDB...")
            
            # Convert to EEGSample objects in batches
            batch_size = 5000
            for i in range(0, sample_count, batch_size):
                batch = samples_data[i:i+batch_size]
                samples = [
                    EEGSample(
                        timestamp=row['timestamp'],
                        tp9=row['tp9'] or 0,
                        af7=row['af7'] or 0,
                        af8=row['af8'] or 0,
                        tp10=row['tp10'] or 0,
                        aux=row['aux'] or 0
                    )
                    for row in batch
                ]
                
                influx.write_samples(
                    recording_id=new_id,
                    samples=samples,
                    base_timestamp=start_time
                )
                
                pct = min(100, int((i + len(batch)) / sample_count * 100))
                print(f"      ... {pct}% ({i + len(batch)}/{sample_count})")
            
            print(f"   ✓ Migrated {sample_count} samples")
        
        # Migrate metrics
        cursor.execute('''
            SELECT timestamp, coherence, entropy, plv, 
                   delta, theta, alpha, beta, gamma,
                   dominant_frequency, state, signal_quality_avg
            FROM metrics
            WHERE session_id = ?
            ORDER BY timestamp
        ''', (old_id,))
        
        metrics_data = cursor.fetchall()
        metrics_count = len(metrics_data)
        
        if metrics_count > 0:
            print(f"   📤 Migrating {metrics_count} metrics to InfluxDB...")
            
            metrics = [
                MetricSnapshot(
                    timestamp=row['timestamp'],
                    coherence=row['coherence'] or 0,
                    entropy=row['entropy'] or 0,
                    plv=row['plv'] or 0,
                    delta=row['delta'] or 0,
                    theta=row['theta'] or 0,
                    alpha=row['alpha'] or 0,
                    beta=row['beta'] or 0,
                    gamma=row['gamma'] or 0,
                    dominant_frequency=row['dominant_frequency'] or 0,
                    state=row['state'] or '',
                    signal_quality=row['signal_quality_avg'] or 0
                )
                for row in metrics_data
            ]
            
            influx.write_metrics(
                recording_id=new_id,
                metrics=metrics,
                base_timestamp=start_time
            )
            
            print(f"   ✓ Migrated {metrics_count} metrics")
        
        # Migrate events
        cursor.execute('''
            SELECT timestamp, event_type, label, data
            FROM events
            WHERE session_id = ?
            ORDER BY timestamp
        ''', (old_id,))
        
        events_data = cursor.fetchall()
        events_count = len(events_data)
        
        if events_count > 0:
            print(f"   📤 Migrating {events_count} events to InfluxDB...")
            
            for row in events_data:
                influx.write_event(
                    recording_id=new_id,
                    timestamp=row['timestamp'],
                    event_type=row['event_type'] or 'marker',
                    label=row['label'] or '',
                    data=None,  # JSON parsing would go here if needed
                    base_timestamp=start_time
                )
            
            print(f"   ✓ Migrated {events_count} events")
        
        # Get aggregated metrics from InfluxDB
        aggregated = influx.get_aggregated_metrics(new_id)
        
        # End recording in PostgreSQL with aggregated metrics
        await postgres.end_recording(
            recording_id=new_id,
            calibration_passed=bool(session['calibration_passed']),
            avg_signal_quality=session['avg_signal_quality'] or 0,
            sample_count=sample_count,
            metrics_count=metrics_count,
            aggregated_metrics=aggregated
        )
        
        print(f"   ✓ Recording #{new_id} finalized")
    
    # Close connections
    sqlite_conn.close()
    await postgres.close()
    influx.close()
    
    print(f"\n{'━' * 50}")
    print(f"✅ Migration complete!")
    print(f"\nID Mapping (old → new):")
    for old_id, new_id in id_mapping.items():
        print(f"   Session #{old_id} → Recording #{new_id}")
    
    return id_mapping


if __name__ == "__main__":
    print("=" * 50)
    print("🚀 EEG Session Migration: SQLite → PostgreSQL + InfluxDB")
    print("=" * 50)
    print()
    
    asyncio.run(migrate_sessions())
