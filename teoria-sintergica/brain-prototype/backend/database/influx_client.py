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


# Connection settings — support both INFLUXDB_* (.env) and INFLUX_* (legacy) prefixes
INFLUX_URL = os.getenv('INFLUXDB_URL', os.getenv('INFLUX_URL', 'http://localhost:8086'))
INFLUX_TOKEN = os.getenv('INFLUXDB_TOKEN', os.getenv('INFLUX_TOKEN', 'my-super-secret-auth-token'))
INFLUX_ORG = os.getenv('INFLUXDB_ORG', os.getenv('INFLUX_ORG', 'teoria-sintergica'))
INFLUX_BUCKET = os.getenv('INFLUXDB_BUCKET', os.getenv('INFLUX_BUCKET', 'eeg-data'))


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
    # Potencia absoluta µV²/Hz (NO normalizada) — necesaria para Berger effect
    delta_raw: float = 0.0
    theta_raw: float = 0.0
    alpha_raw: float = 0.0
    beta_raw: float = 0.0
    gamma_raw: float = 0.0
    # EOG blink artifact detected in this window (frontal AF7/AF8 > 80µV)
    blink_contaminated: bool = False


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
                .field("delta_raw", float(m.delta_raw))
                .field("theta_raw", float(m.theta_raw))
                .field("alpha_raw", float(m.alpha_raw))
                .field("beta_raw", float(m.beta_raw))
                .field("gamma_raw", float(m.gamma_raw))
                .field("blink_contaminated", m.blink_contaminated)
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
                    'state': record.values.get('state', ''),
                    'signal_quality': record.values.get('signal_quality', 0),
                    'dominant_frequency': record.values.get('dominant_frequency', 0),
                    'delta_raw': record.values.get('delta_raw', 0),
                    'theta_raw': record.values.get('theta_raw', 0),
                    'alpha_raw': record.values.get('alpha_raw', 0),
                    'beta_raw': record.values.get('beta_raw', 0),
                    'gamma_raw': record.values.get('gamma_raw', 0),
                    'blink_contaminated': bool(record.values.get('blink_contaminated', False)),
                })
        
        return metrics
    
    def get_events(
        self,
        recording_id: int,
    ) -> List[Dict]:
        """Get events/markers for a recording."""
        if not self._connected:
            self.connect()

        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_event")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["_time"])
        '''

        tables = self.query_api.query(query, org=INFLUX_ORG)

        events = []
        for table in tables:
            for record in table.records:
                events.append({
                    'timestamp': record.get_time().timestamp(),
                    'label': record.values.get('label', ''),
                    'event_type': record.values.get('event_type', ''),
                })

        return events

    def get_aggregated_metrics(self, recording_id: int) -> Dict:
        """
        Get aggregated metrics for a recording (for PostgreSQL update).
        
        Returns:
            Dict with avg_coherence, avg_alpha, peak_coherence, etc.
        """
        if not self._connected:
            self.connect()
        
        # Average metrics — exclude boolean field blink_contaminated
        # which causes 'unsupported input type for mean aggregate: boolean'
        avg_query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_metrics")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> filter(fn: (r) => r["_field"] != "blink_contaminated")
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
    
    # ==================== PER-CHANNEL BAND POWER ====================

    def write_band_power_per_channel(
        self,
        recording_id: int,
        ts_ns: int,
        channel_bands: Dict[str, Dict[str, float]],
        state: str = "",
    ):
        """
        Write per-channel band powers to the eeg_band_power measurement.

        Schema:
            measurement: eeg_band_power
            tags:  recording_id, band (alpha|theta|...), channel (tp9|af7|af8|tp10), state
            fields: value (normalized 0-1), value_raw (µV²/Hz)

        Args:
            recording_id: PostgreSQL recording ID.
            ts_ns:         Absolute timestamp in nanoseconds.
            channel_bands: {band_name: {channel_name: raw_µV²/Hz_value}}.
                           E.g. {"alpha": {"tp9": 5.2, "af7": 3.1, "af8": 3.8, "tp10": 5.0}, ...}
            state:         Optional session state tag (e.g. "alpha_dominant", "baseline_closed").
        """
        if not self._connected:
            self.connect()

        CHANNELS = ['tp9', 'af7', 'af8', 'tp10']
        points = []

        for band_name, ch_raw in channel_bands.items():
            # Normalize per-channel: each channel's band powers sum to 1 across all bands.
            # We need total power for each channel across ALL bands.
            # ch_raw only has one band, so normalization must happen at write time using
            # total across all available bands for this channel.
            pass  # total computed below per-channel (see loop after collection)

        # Collect all raw values per channel {channel: {band: raw}}
        channel_all_bands: Dict[str, Dict[str, float]] = {}
        for band_name, ch_raw in channel_bands.items():
            for ch_name, raw_val in ch_raw.items():
                if ch_name not in channel_all_bands:
                    channel_all_bands[ch_name] = {}
                channel_all_bands[ch_name][band_name] = float(raw_val)

        for ch_name, band_raws in channel_all_bands.items():
            total_raw = sum(band_raws.values()) or 1.0
            for band_name, raw_val in band_raws.items():
                value_normalized = raw_val / total_raw
                point = (
                    Point("eeg_band_power")
                    .tag("recording_id", str(recording_id))
                    .tag("band", band_name)
                    .tag("channel", ch_name)
                    .field("value", float(value_normalized))
                    .field("value_raw", float(raw_val))
                    .time(ts_ns, WritePrecision.NS)
                )
                if state:
                    point = point.tag("state", state)
                points.append(point)

        if points:
            self.write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)

    def get_per_channel_metrics(self, recording_id: int) -> Optional[Dict]:
        """
        Query per-channel band power time series from eeg_band_power.

        Returns the `per_channel` object for the /sessions/{id}/metrics API response:
        {
            "timestamps": [t0, t1, ...],
            "alpha":     {"tp9": [...], "af7": [...], "af8": [...], "tp10": [...]},
            "alpha_raw": {"tp9": [...], ...},
            ...same for delta, theta, beta, gamma...
        }
        Returns None if no per-channel data exists for this recording.
        """
        if not self._connected:
            self.connect()

        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_band_power")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> sort(columns: ["_time"])
        '''

        tables = self.query_api.query(query, org=INFLUX_ORG)

        # Accumulate: {timestamp_float: {band: {channel: {value: float, value_raw: float}}}}
        time_points: Dict[float, Any] = {}

        for table in tables:
            for record in table.records:
                ts = record.get_time().timestamp()
                band = record.values.get('band', '')
                channel = record.values.get('channel', '')
                field = record.get_field()  # 'value' or 'value_raw'
                val = record.get_value()

                if not band or not channel:
                    continue

                if ts not in time_points:
                    time_points[ts] = {}
                if band not in time_points[ts]:
                    time_points[ts][band] = {}
                if channel not in time_points[ts][band]:
                    time_points[ts][band][channel] = {'value': 0.0, 'value_raw': 0.0}

                if field in ('value', 'value_raw') and val is not None:
                    time_points[ts][band][channel][field] = float(val)

        if not time_points:
            return None

        sorted_ts = sorted(time_points.keys())
        channels = ['tp9', 'af7', 'af8', 'tp10']
        bands = ['delta', 'theta', 'alpha', 'beta', 'gamma']

        per_channel: Dict[str, Any] = {"timestamps": sorted_ts}

        for band in bands:
            per_channel[band] = {ch: [] for ch in channels}
            per_channel[f"{band}_raw"] = {ch: [] for ch in channels}
            for ts in sorted_ts:
                for ch in channels:
                    pt = time_points[ts].get(band, {}).get(ch, {})
                    per_channel[band][ch].append(pt.get('value', 0.0))
                    per_channel[f"{band}_raw"][ch].append(pt.get('value_raw', 0.0))

        return per_channel

    def get_per_channel_aggregates(self, recording_id: int) -> Dict:
        """
        Compute per-channel session aggregates from eeg_band_power.

        Returns dict ready to be merged into the end_recording call:
        {
            alpha_tp9_avg, alpha_af7_avg, alpha_af8_avg, alpha_tp10_avg,
            faa_mean, faa_baseline_closed, posterior_asymmetry_mean,
            per_channel_version
        }
        Returns {'per_channel_version': 0} if no per-channel data exists.
        """
        import math

        if not self._connected:
            self.connect()

        # 1. Average normalized alpha per channel (→ Postgres alpha_*_avg columns)
        avg_norm_query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_band_power")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> filter(fn: (r) => r["band"] == "alpha")
            |> filter(fn: (r) => r["_field"] == "value")
            |> group(columns: ["channel"])
            |> mean()
        '''

        # 2. All per-window alpha raw values (for FAA + posterior asymmetry)
        raw_query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_band_power")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> filter(fn: (r) => r["band"] == "alpha")
            |> filter(fn: (r) => r["_field"] == "value_raw")
            |> sort(columns: ["_time"])
        '''

        # 3. Baseline-closed raw alpha (for faa_baseline_closed)
        baseline_query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "eeg_band_power")
            |> filter(fn: (r) => r["recording_id"] == "{recording_id}")
            |> filter(fn: (r) => r["band"] == "alpha")
            |> filter(fn: (r) => r["_field"] == "value_raw")
            |> filter(fn: (r) => r["state"] == "baseline_closed")
            |> sort(columns: ["_time"])
        '''

        avg_tables = self.query_api.query(avg_norm_query, org=INFLUX_ORG)
        raw_tables = self.query_api.query(raw_query, org=INFLUX_ORG)
        baseline_tables = self.query_api.query(baseline_query, org=INFLUX_ORG)

        # --- Extract normalized averages ---
        channel_avg_norm: Dict[str, float] = {}
        for table in avg_tables:
            for record in table.records:
                ch = record.values.get('channel', '')
                val = record.get_value()
                if ch and val is not None:
                    channel_avg_norm[ch] = float(val)

        if not channel_avg_norm:
            return {'per_channel_version': 0}

        # --- Collect per-window raw values {ts: {channel: raw}} ---
        ts_ch_raw: Dict[float, Dict[str, float]] = {}
        for table in raw_tables:
            for record in table.records:
                ts = record.get_time().timestamp()
                ch = record.values.get('channel', '')
                val = record.get_value()
                if ch and val is not None:
                    if ts not in ts_ch_raw:
                        ts_ch_raw[ts] = {}
                    ts_ch_raw[ts][ch] = float(val)

        # --- Compute FAA and posterior asymmetry window-by-window ---
        faa_values = []
        posterior_asym_values = []
        for ts, ch_vals in ts_ch_raw.items():
            af7 = ch_vals.get('af7', 0.0)
            af8 = ch_vals.get('af8', 0.0)
            tp9 = ch_vals.get('tp9', 0.0)
            tp10 = ch_vals.get('tp10', 0.0)
            if af7 > 0 and af8 > 0:
                faa_values.append(math.log(af8) - math.log(af7))
            if tp9 > 0 and tp10 > 0:
                posterior_asym_values.append(tp10 - tp9)

        # --- Baseline FAA ---
        baseline_ts_ch: Dict[float, Dict[str, float]] = {}
        for table in baseline_tables:
            for record in table.records:
                ts = record.get_time().timestamp()
                ch = record.values.get('channel', '')
                val = record.get_value()
                if ch in ('af7', 'af8') and val is not None:
                    if ts not in baseline_ts_ch:
                        baseline_ts_ch[ts] = {}
                    baseline_ts_ch[ts][ch] = float(val)

        baseline_faa_values = []
        for ts, ch_vals in baseline_ts_ch.items():
            af7 = ch_vals.get('af7', 0.0)
            af8 = ch_vals.get('af8', 0.0)
            if af7 > 0 and af8 > 0:
                baseline_faa_values.append(math.log(af8) - math.log(af7))

        return {
            'alpha_tp9_avg':            channel_avg_norm.get('tp9'),
            'alpha_af7_avg':            channel_avg_norm.get('af7'),
            'alpha_af8_avg':            channel_avg_norm.get('af8'),
            'alpha_tp10_avg':           channel_avg_norm.get('tp10'),
            'faa_mean':                 float(sum(faa_values) / len(faa_values)) if faa_values else None,
            'faa_baseline_closed':      float(sum(baseline_faa_values) / len(baseline_faa_values)) if baseline_faa_values else None,
            'posterior_asymmetry_mean': float(sum(posterior_asym_values) / len(posterior_asym_values)) if posterior_asym_values else None,
            'per_channel_version':      1,
        }

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
