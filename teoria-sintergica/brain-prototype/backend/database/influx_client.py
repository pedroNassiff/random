"""
InfluxDB client for EEG time-series data storage.

Handles high-frequency data:
- EEG raw samples (256 Hz × 4 channels)
- Computed metrics (5 Hz)
- Events/markers
"""

import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import numpy as np

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS, ASYNCHRONOUS


# Connection settings
INFLUX_URL = os.getenv('INFLUX_URL', 'http://localhost:8086')
INFLUX_TOKEN = os.getenv('INFLUX_TOKEN', 'my-super-secret-auth-token')
INFLUX_ORG = os.getenv('INFLUX_ORG', 'teoria-sintergica')
INFLUX_BUCKET = os.getenv('INFLUX_BUCKET', 'eeg-data')


@dataclass
class EEGSample:
    """Single EEG sample with 4 channels."""
    timestamp: float  # Unix timestamp or relative seconds
    tp9: float
    af7: float
    af8: float
    tp10: float
    aux: float = 0.0


@dataclass
class MetricSnapshot:
    """Computed metrics at a point in time."""
    timestamp: float
    coherence: float
    entropy: float
    plv: float
    delta: float
    theta: float
    alpha: float
    beta: float
    gamma: float
    dominant_frequency: float = 0.0
    state: str = ""
    signal_quality: float = 0.0


class InfluxDBEEGClient:
    """
    InfluxDB client optimized for EEG data.
    
    Usage:
        client = InfluxDBEEGClient()
        
        # Write samples in batches
        client.write_samples(recording_id=1, samples=[...])
        
        # Write metrics
        client.write_metrics(recording_id=1, metrics=[...])
        
        # Query data
        samples = client.get_samples(recording_id=1, start=0, end=60)
    """
    
    def __init__(self):
        self.client: Optional[InfluxDBClient] = None
        self.write_api = None
        self.query_api = None
        self._connected = False
    
    def connect(self):
        """Connect to InfluxDB."""
        if self._connected:
            return
        
        try:
            self.client = InfluxDBClient(
                url=INFLUX_URL,
                token=INFLUX_TOKEN,
                org=INFLUX_ORG
            )
            
            # Use synchronous writes for reliability
            self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
            self.query_api = self.client.query_api()
            
            # Verify connection
            health = self.client.health()
            if health.status == "pass":
                self._connected = True
                print(f"✓ InfluxDB connected: {INFLUX_URL}")
            else:
                raise Exception(f"InfluxDB unhealthy: {health.status}")
                
        except Exception as e:
            print(f"✗ InfluxDB connection failed: {e}")
            raise
    
    def close(self):
        """Close connection."""
        if self.client:
            self.client.close()
            self._connected = False
    
    # ==================== WRITE OPERATIONS ====================
    
    def write_samples(
        self, 
        recording_id: int, 
        samples: List[EEGSample],
        base_timestamp: datetime = None
    ):
        """
        Write EEG samples to InfluxDB.
        
        Args:
            recording_id: ID from PostgreSQL eeg_recordings table
            samples: List of EEGSample dataclass instances
            base_timestamp: Base datetime for relative timestamps
        """
        if not self._connected:
            self.connect()
        
        base_timestamp = base_timestamp or datetime.utcnow()
        points = []
        
        for sample in samples:
            # Calculate absolute timestamp
            ts = base_timestamp.timestamp() + sample.timestamp
            
            point = (
                Point("eeg_sample")
                .tag("recording_id", str(recording_id))
                .field("tp9", float(sample.tp9))
                .field("af7", float(sample.af7))
                .field("af8", float(sample.af8))
                .field("tp10", float(sample.tp10))
                .time(int(ts * 1e9), WritePrecision.NS)
            )
            
            if sample.aux != 0:
                point = point.field("aux", float(sample.aux))
            
            points.append(point)
        
        self.write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
    
    def write_samples_batch(
        self,
        recording_id: int,
        timestamps: np.ndarray,
        data: np.ndarray,
        base_timestamp: datetime = None
    ):
        """
        Write batch of samples from numpy arrays.
        
        Args:
            recording_id: Recording ID
            timestamps: Array of relative timestamps (seconds)
            data: Array of shape (n_samples, 4) with channel data
        """
        if not self._connected:
            self.connect()
        
        base_timestamp = base_timestamp or datetime.utcnow()
        base_ts = base_timestamp.timestamp()
        points = []
        
        for i in range(len(timestamps)):
            ts = base_ts + timestamps[i]
            
            point = (
                Point("eeg_sample")
                .tag("recording_id", str(recording_id))
                .field("tp9", float(data[i, 0]))
                .field("af7", float(data[i, 1]))
                .field("af8", float(data[i, 2]))
                .field("tp10", float(data[i, 3]))
                .time(int(ts * 1e9), WritePrecision.NS)
            )
            points.append(point)
        
        self.write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
    
    def write_metrics(
        self,
        recording_id: int,
        metrics: List[MetricSnapshot],
        base_timestamp: datetime = None
    ):
        """
        Write computed metrics to InfluxDB.
        
        Args:
            recording_id: Recording ID
            metrics: List of MetricSnapshot instances
        """
        if not self._connected:
            self.connect()
        
        base_timestamp = base_timestamp or datetime.utcnow()
        points = []
        
        for m in metrics:
            ts = base_timestamp.timestamp() + m.timestamp
            
            point = (
                Point("eeg_metrics")
                .tag("recording_id", str(recording_id))
                .field("coherence", float(m.coherence))
                .field("entropy", float(m.entropy))
                .field("plv", float(m.plv))
                .field("delta", float(m.delta))
                .field("theta", float(m.theta))
                .field("alpha", float(m.alpha))
                .field("beta", float(m.beta))
                .field("gamma", float(m.gamma))
                .field("dominant_frequency", float(m.dominant_frequency))
                .field("signal_quality", float(m.signal_quality))
                .time(int(ts * 1e9), WritePrecision.NS)
            )
            
            if m.state:
                point = point.tag("state", m.state)
            
            points.append(point)
        
        self.write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
    
    def write_event(
        self,
        recording_id: int,
        timestamp: float,
        event_type: str,
        label: str,
        data: Dict = None,
        base_timestamp: datetime = None
    ):
        """Write an event/marker."""
        if not self._connected:
            self.connect()
        
        base_timestamp = base_timestamp or datetime.utcnow()
        ts = base_timestamp.timestamp() + timestamp
        
        point = (
            Point("eeg_event")
            .tag("recording_id", str(recording_id))
            .tag("event_type", event_type)
            .field("label", label)
            .time(int(ts * 1e9), WritePrecision.NS)
        )
        
        if data:
            for key, value in data.items():
                if isinstance(value, (int, float)):
                    point = point.field(key, float(value))
                else:
                    point = point.field(key, str(value))
        
        self.write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
    
    # ==================== QUERY OPERATIONS ====================
    
    def get_samples(
        self,
        recording_id: int,
        start: float = 0,
        end: float = None,
        limit: int = None
    ) -> List[Dict]:
        """
        Get EEG samples for a recording.
        
        Args:
            recording_id: Recording ID
            start: Start time in seconds from recording start
            end: End time in seconds (None = all)
            limit: Max samples to return
        
        Returns:
            List of dicts with timestamp, tp9, af7, af8, tp10
        """
        if not self._connected:
            self.connect()
        
        # Build Flux query
        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_sample")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        
        if limit:
            query += f'\n    |> limit(n: {limit})'
        
        tables = self.query_api.query(query, org=INFLUX_ORG)
        
        samples = []
        for table in tables:
            for record in table.records:
                samples.append({
                    'timestamp': record.get_time().timestamp(),
                    'tp9': record.values.get('tp9', 0),
                    'af7': record.values.get('af7', 0),
                    'af8': record.values.get('af8', 0),
                    'tp10': record.values.get('tp10', 0)
                })
        
        return samples
    
    def get_metrics(
        self,
        recording_id: int,
        start: float = 0,
        end: float = None
    ) -> List[Dict]:
        """Get metrics for a recording."""
        if not self._connected:
            self.connect()
        
        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_metrics")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        
        tables = self.query_api.query(query, org=INFLUX_ORG)
        
        metrics = []
        for table in tables:
            for record in table.records:
                metrics.append({
                    'timestamp': record.get_time().timestamp(),
                    'coherence': record.values.get('coherence', 0),
                    'entropy': record.values.get('entropy', 0),
                    'plv': record.values.get('plv', 0),
                    'delta': record.values.get('delta', 0),
                    'theta': record.values.get('theta', 0),
                    'alpha': record.values.get('alpha', 0),
                    'beta': record.values.get('beta', 0),
                    'gamma': record.values.get('gamma', 0),
                    'state': record.values.get('state', '')
                })
        
        return metrics
    
    def get_aggregated_metrics(self, recording_id: int) -> Dict:
        """
        Get aggregated metrics for a recording (for PostgreSQL update).
        
        Returns:
            Dict with avg_coherence, avg_alpha, peak_coherence, etc.
        """
        if not self._connected:
            self.connect()
        
        # Average metrics
        avg_query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_metrics")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> mean()
        '''
        
        # Peak coherence
        peak_query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_metrics")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> filter(fn: (r) => r["_field"] == "coherence")
            |> max()
        '''
        
        avg_tables = self.query_api.query(avg_query, org=INFLUX_ORG)
        peak_tables = self.query_api.query(peak_query, org=INFLUX_ORG)
        
        result = {
            'avg_coherence': None,
            'avg_alpha': None,
            'avg_theta': None,
            'avg_beta': None,
            'avg_gamma': None,
            'avg_delta': None,
            'peak_coherence': None
        }
        
        for table in avg_tables:
            for record in table.records:
                field = record.get_field()
                value = record.get_value()
                if field == 'coherence':
                    result['avg_coherence'] = value
                elif field == 'alpha':
                    result['avg_alpha'] = value
                elif field == 'theta':
                    result['avg_theta'] = value
                elif field == 'beta':
                    result['avg_beta'] = value
                elif field == 'gamma':
                    result['avg_gamma'] = value
                elif field == 'delta':
                    result['avg_delta'] = value
        
        for table in peak_tables:
            for record in table.records:
                result['peak_coherence'] = record.get_value()
        
        return result
    
    def get_sample_count(self, recording_id: int) -> int:
        """Get total sample count for a recording."""
        if not self._connected:
            self.connect()
        
        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_sample")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> filter(fn: (r) => r["_field"] == "tp9")
            |> count()
        '''
        
        tables = self.query_api.query(query, org=INFLUX_ORG)
        
        for table in tables:
            for record in table.records:
                return int(record.get_value())
        
        return 0
    
    def delete_recording_data(self, recording_id: int):
        """Delete all data for a recording."""
        if not self._connected:
            self.connect()
        
        delete_api = self.client.delete_api()
        
        # Delete samples
        delete_api.delete(
            start="1970-01-01T00:00:00Z",
            stop="2100-01-01T00:00:00Z",
            predicate=f'recording_id="{recording_id}"',
            bucket=INFLUX_BUCKET,
            org=INFLUX_ORG
        )


# Singleton instance
_influx_client: Optional[InfluxDBEEGClient] = None


def get_influx_client() -> InfluxDBEEGClient:
    """Get the singleton InfluxDB client."""
    global _influx_client
    if _influx_client is None:
        _influx_client = InfluxDBEEGClient()
    return _influx_client
