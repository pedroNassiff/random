"""
Session Recorder v2 - Records EEG data using PostgreSQL + InfluxDB.

Architecture:
- PostgreSQL: Session metadata (eeg_recordings table)
- InfluxDB: Time-series data (samples, metrics, events)
"""

import time
import threading
import numpy as np
from typing import Optional, Dict, Callable, List
from datetime import datetime

from .postgres_client import get_postgres_client_sync, PostgresClientSync, EEGRecording
from .influx_client import get_influx_client, InfluxDBEEGClient, EEGSample, MetricSnapshot


class SessionRecorderV2:
    """
    Records Muse EEG sessions to PostgreSQL + InfluxDB.
    
    Usage:
        recorder = SessionRecorderV2(muse_connector)
        recording_id = recorder.start("My meditation session")
        
        # ... later ...
        recorder.add_marker("eyes_closed")
        
        # ... when done ...
        summary = recorder.stop()
    """
    
    def __init__(self, muse_connector):
        """
        Args:
            muse_connector: MuseConnector instance for getting EEG data
        """
        self.muse_connector = muse_connector
        self.postgres: PostgresClientSync = get_postgres_client_sync()
        self.influx: InfluxDBEEGClient = get_influx_client()
        
        self._recording = False
        self._recording_id: Optional[int] = None
        self._start_time: float = 0
        self._base_timestamp: datetime = None
        self._sample_thread: Optional[threading.Thread] = None
        self._metrics_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        # Buffers for batch inserts
        self._sample_buffer: List[EEGSample] = []
        self._metrics_buffer: List[MetricSnapshot] = []
        self._buffer_lock = threading.Lock()
        self._flush_interval = 1.0  # seconds
        
        # Callbacks
        self._on_metrics: Optional[Callable] = None
        
        # Stats
        self._samples_recorded = 0
        self._metrics_recorded = 0
        
        # Connect to databases
        self._connect()
    
    def _connect(self):
        """Connect to databases."""
        try:
            self.postgres.connect()
        except Exception as e:
            print(f"⚠️ PostgreSQL connection failed: {e}")
        
        try:
            self.influx.connect()
        except Exception as e:
            print(f"⚠️ InfluxDB connection failed: {e}")
    
    @property
    def is_recording(self) -> bool:
        return self._recording
    
    @property
    def recording_id(self) -> Optional[int]:
        return self._recording_id
    
    @property
    def elapsed_time(self) -> float:
        if not self._recording:
            return 0.0
        return time.time() - self._start_time
    
    @property
    def stats(self) -> Dict:
        return {
            'recording': self._recording,
            'recording_id': self._recording_id,
            'elapsed_seconds': self.elapsed_time,
            'samples_recorded': self._samples_recorded,
            'metrics_recorded': self._metrics_recorded
        }
    
    def start(
        self, 
        name: str = "", 
        notes: str = "", 
        tags: str = "",
        recording_type: str = "session"
    ) -> int:
        """
        Start recording a new session.
        
        Args:
            name: Recording name (optional, auto-generated if empty)
            notes: Recording notes
            tags: Comma-separated tags for categorization
            recording_type: 'session', 'calibration', 'test', 'research'
            
        Returns:
            recording_id: ID of the created recording
        """
        if self._recording:
            raise RuntimeError("Already recording. Stop current recording first.")
        
        if not self.muse_connector.is_streaming:
            raise RuntimeError("Muse not streaming. Start stream first.")
        
        # Get device info
        device_address = ""
        if self.muse_connector.device_info:
            device_address = self.muse_connector.device_info.address or ""
        
        # Parse tags
        tags_list = [t.strip() for t in tags.split(',') if t.strip()] if tags else []
        
        # Create recording in PostgreSQL
        self._recording_id = self.postgres.create_recording(
            name=name,
            notes=notes,
            tags=tags_list,
            device="muse2",
            device_address=device_address,
            sampling_rate=256,
            recording_type=recording_type
        )
        
        self._start_time = time.time()
        self._base_timestamp = datetime.utcnow()
        self._recording = True
        self._samples_recorded = 0
        self._metrics_recorded = 0
        self._stop_event.clear()
        
        # Start sample collection thread
        self._sample_thread = threading.Thread(target=self._sample_loop, daemon=True)
        self._sample_thread.start()
        
        # Start metrics collection thread
        self._metrics_thread = threading.Thread(target=self._metrics_loop, daemon=True)
        self._metrics_thread.start()
        
        print(f"🔴 Recording started: Recording #{self._recording_id} → PostgreSQL + InfluxDB")
        return self._recording_id
    
    def stop(self, calibration_passed: bool = False) -> Dict:
        """
        Stop recording and finalize session.
        
        Returns:
            Recording summary
        """
        if not self._recording:
            return None
        
        self._recording = False
        self._stop_event.set()
        
        # Wait for threads to finish
        if self._sample_thread:
            self._sample_thread.join(timeout=2)
        if self._metrics_thread:
            self._metrics_thread.join(timeout=2)
        
        # Flush remaining buffers
        self._flush_buffers()
        
        # Calculate average signal quality
        avg_quality = 0.5
        if self.muse_connector:
            quality = self.muse_connector.get_signal_quality()
            if quality:
                avg_quality = float(sum(quality.values()) / len(quality))
        
        # Get aggregated metrics from InfluxDB
        aggregated_metrics = {}
        try:
            aggregated_metrics = self.influx.get_aggregated_metrics(self._recording_id)
            # Convert numpy types to native Python types
            for key, value in aggregated_metrics.items():
                if hasattr(value, 'item'):  # numpy scalar
                    aggregated_metrics[key] = value.item()
                elif value is not None:
                    aggregated_metrics[key] = float(value)
        except Exception as e:
            print(f"⚠️ Failed to get aggregated metrics: {e}")
        
        # Calculate duration
        duration = float(time.time() - self._start_time)
        
        # End recording in PostgreSQL
        recording = self.postgres.end_recording(
            self._recording_id,
            duration_seconds=duration,
            calibration_passed=calibration_passed,
            avg_signal_quality=avg_quality,
            sample_count=self._samples_recorded,
            metrics_count=self._metrics_recorded,
            aggregated_metrics=aggregated_metrics
        )
        
        # Build summary
        summary = {
            'recording_id': self._recording_id,
            'name': recording.name if recording else '',
            'duration_seconds': recording.duration_seconds if recording else 0,
            'sample_count': self._samples_recorded,
            'metrics_count': self._metrics_recorded,
            'calibration_passed': calibration_passed,
            'avg_signal_quality': avg_quality,
            'aggregated_metrics': aggregated_metrics
        }
        
        print(f"⏹️ Recording stopped: {self._samples_recorded} samples, {self._metrics_recorded} metrics")
        
        self._recording_id = None
        
        return summary
    
    def add_marker(self, label: str, event_type: str = "marker", data: Dict = None):
        """
        Add an event marker to the recording.
        
        Useful for marking stimuli, state changes, etc.
        
        Args:
            label: Marker label (e.g., "eyes_closed", "stimulus_start")
            event_type: Event category
            data: Optional additional data
        """
        if not self._recording:
            return
        
        timestamp = time.time() - self._start_time
        
        try:
            self.influx.write_event(
                recording_id=self._recording_id,
                timestamp=timestamp,
                event_type=event_type,
                label=label,
                data=data,
                base_timestamp=self._base_timestamp
            )
            print(f"📍 Marker added: {label} @ {timestamp:.2f}s")
        except Exception as e:
            print(f"⚠️ Failed to add marker: {e}")
    
    def set_on_metrics_callback(self, callback: Callable):
        """Set callback function called on each metrics snapshot."""
        self._on_metrics = callback
    
    # ==================== INTERNAL LOOPS ====================
    
    def _sample_loop(self):
        """Background thread that collects raw EEG samples."""
        last_flush = time.time()
        
        while not self._stop_event.is_set():
            try:
                # Get latest samples from Muse buffer
                window = self.muse_connector.get_window(duration=0.1)  # 100ms chunks
                
                if window is not None:
                    data = window.data  # (channels, samples)
                    n_samples = data.shape[1]
                    
                    # Calculate timestamps for each sample
                    current_time = time.time() - self._start_time
                    sample_duration = n_samples / window.fs
                    
                    with self._buffer_lock:
                        for i in range(n_samples):
                            t = current_time - sample_duration + (i / window.fs)
                            sample = EEGSample(
                                timestamp=t,
                                tp9=float(data[0, i]) if data.shape[0] > 0 else 0,
                                af7=float(data[1, i]) if data.shape[0] > 1 else 0,
                                af8=float(data[2, i]) if data.shape[0] > 2 else 0,
                                tp10=float(data[3, i]) if data.shape[0] > 3 else 0,
                                aux=float(data[4, i]) if data.shape[0] > 4 else 0
                            )
                            self._sample_buffer.append(sample)
                            self._samples_recorded += 1
                
                # Flush buffer periodically
                if time.time() - last_flush >= self._flush_interval:
                    self._flush_samples()
                    last_flush = time.time()
                
                time.sleep(0.05)  # 50ms between checks
                
            except Exception as e:
                print(f"⚠️ Sample collection error: {e}")
                time.sleep(0.1)
        
        # Final flush
        self._flush_samples()
    
    def _metrics_loop(self):
        """Background thread that computes and stores metrics."""
        # Import here to avoid circular imports
        try:
            from hardware import MuseToSyntergicAdapter
            from analysis.metrics import SyntergicMetrics
        except ImportError:
            print("⚠️ Metrics modules not available")
            return
        
        while not self._stop_event.is_set():
            try:
                # Get 2-second window for metrics
                window = self.muse_connector.get_window(duration=2.0)
                
                if window is not None:
                    timestamp = time.time() - self._start_time
                    
                    # Compute metrics
                    eeg_data = MuseToSyntergicAdapter.prepare_for_analysis(window)
                    metrics = SyntergicMetrics.compute_all(eeg_data, fs=window.fs)
                    
                    # Get signal quality
                    quality = self.muse_connector.get_signal_quality()
                    avg_quality = 0.0
                    if quality:
                        avg_quality = sum(quality.values()) / len(quality)
                    
                    # Create metric snapshot
                    snapshot = MetricSnapshot(
                        timestamp=timestamp,
                        coherence=metrics.get('coherence', 0),
                        entropy=metrics.get('entropy', 0),
                        plv=metrics.get('plv', 0),
                        delta=metrics.get('bands', {}).get('delta', 0),
                        theta=metrics.get('bands', {}).get('theta', 0),
                        alpha=metrics.get('bands', {}).get('alpha', 0),
                        beta=metrics.get('bands', {}).get('beta', 0),
                        gamma=metrics.get('bands', {}).get('gamma', 0),
                        dominant_frequency=metrics.get('dominant_frequency', 0),
                        state=metrics.get('state', ''),
                        signal_quality=avg_quality
                    )
                    
                    with self._buffer_lock:
                        self._metrics_buffer.append(snapshot)
                        self._metrics_recorded += 1
                    
                    # Callback if set
                    if self._on_metrics:
                        self._on_metrics(timestamp, metrics)
                
                time.sleep(0.2)  # 5Hz metrics rate
                
            except Exception as e:
                print(f"⚠️ Metrics collection error: {e}")
                time.sleep(0.2)
        
        # Final flush
        self._flush_metrics()
    
    def _flush_samples(self):
        """Flush sample buffer to InfluxDB."""
        with self._buffer_lock:
            if self._sample_buffer and self._recording_id:
                try:
                    self.influx.write_samples(
                        recording_id=self._recording_id,
                        samples=self._sample_buffer,
                        base_timestamp=self._base_timestamp
                    )
                except Exception as e:
                    print(f"⚠️ Failed to flush samples: {e}")
                self._sample_buffer = []
    
    def _flush_metrics(self):
        """Flush metrics buffer to InfluxDB."""
        with self._buffer_lock:
            if self._metrics_buffer and self._recording_id:
                try:
                    self.influx.write_metrics(
                        recording_id=self._recording_id,
                        metrics=self._metrics_buffer,
                        base_timestamp=self._base_timestamp
                    )
                except Exception as e:
                    print(f"⚠️ Failed to flush metrics: {e}")
                self._metrics_buffer = []
    
    def _flush_buffers(self):
        """Flush all buffers."""
        self._flush_samples()
        self._flush_metrics()


# Singleton instance
_recorder_v2_instance: Optional[SessionRecorderV2] = None


def get_recorder_v2(muse_connector=None) -> Optional[SessionRecorderV2]:
    """Get singleton recorder v2 instance."""
    global _recorder_v2_instance
    if _recorder_v2_instance is None and muse_connector is not None:
        _recorder_v2_instance = SessionRecorderV2(muse_connector)
    return _recorder_v2_instance
