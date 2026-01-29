"""
Database module for EEG session recording and playback.

Architecture:
- SQLite (legacy): models.py, recorder.py - old local storage
- PostgreSQL: postgres_client.py - session metadata (eeg_recordings)
- InfluxDB: influx_client.py - time-series (samples, metrics)
- recorder_v2.py: New recorder using PostgreSQL + InfluxDB
"""

# Legacy SQLite (for backward compatibility)
from .models import SessionDatabase, SessionMetadata, MetricSnapshot, get_database
from .recorder import SessionRecorder, get_recorder

# New PostgreSQL + InfluxDB architecture
from .postgres_client import (
    PostgresClient, 
    PostgresClientSync,
    EEGRecording,
    get_postgres_client,
    get_postgres_client_sync
)
from .influx_client import (
    InfluxDBEEGClient,
    EEGSample,
    MetricSnapshot as InfluxMetricSnapshot,
    get_influx_client
)
from .recorder_v2 import SessionRecorderV2, get_recorder_v2

__all__ = [
    # Legacy
    'SessionDatabase',
    'SessionMetadata', 
    'MetricSnapshot',
    'SessionRecorder',
    'get_database',
    'get_recorder',
    
    # PostgreSQL
    'PostgresClient',
    'PostgresClientSync',
    'EEGRecording',
    'get_postgres_client',
    'get_postgres_client_sync',
    
    # InfluxDB
    'InfluxDBEEGClient',
    'EEGSample',
    'InfluxMetricSnapshot',
    'get_influx_client',
    
    # New Recorder
    'SessionRecorderV2',
    'get_recorder_v2'
]
