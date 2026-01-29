"""
Session Recorder - Records EEG data from Muse in real-time.

Runs in a background thread to capture samples without blocking.
"""

import time
import threading
from typing import Optional, Dict, Callable
from datetime import datetime

from .models import get_database, SessionDatabase


class SessionRecorder:
    """
    Records Muse EEG sessions to the database.
    
    Usage:
        recorder = SessionRecorder(muse_connector)
        session_id = recorder.start("My meditation session")
        
        # ... later ...
        recorder.add_marker("eyes_closed")
        
        # ... when done ...
        recorder.stop()
    """
    
    def __init__(self, muse_connector):
        """
        Args:
            muse_connector: MuseConnector instance for getting EEG data
        """
        self.muse_connector = muse_connector
        self.db: SessionDatabase = get_database()
        
        self._recording = False
        self._session_id: Optional[int] = None
        self._start_time: float = 0
        self._sample_thread: Optional[threading.Thread] = None
        self._metrics_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        # Buffers for batch inserts
        self._sample_buffer = []
        self._buffer_lock = threading.Lock()
        self._flush_interval = 1.0  # seconds
        
        # Callbacks
        self._on_metrics: Optional[Callable] = None
        
        # Stats
        self._samples_recorded = 0
        self._metrics_recorded = 0
    
    @property
    def is_recording(self) -> bool:
        return self._recording
    
    @property
    def session_id(self) -> Optional[int]:
        return self._session_id
    
    @property
    def elapsed_time(self) -> float:
        if not self._recording:
            return 0.0
        return time.time() - self._start_time
    
    @property
    def stats(self) -> Dict:
        return {
            'recording': self._recording,
            'session_id': self._session_id,
            'elapsed_seconds': self.elapsed_time,
            'samples_recorded': self._samples_recorded,
            'metrics_recorded': self._metrics_recorded
        }
    
    def start(self, name: str = "", notes: str = "", tags: str = "") -> int:
        """
        Start recording a new session.
        
        Args:
            name: Session name (optional, auto-generated if empty)
            notes: Session notes
            tags: Comma-separated tags for categorization
            
        Returns:
            session_id: ID of the created session
        """
        if self._recording:
            raise RuntimeError("Already recording. Stop current session first.")
        
        if not self.muse_connector.is_streaming:
            raise RuntimeError("Muse not streaming. Start stream first.")
        
        # Create session in database
        self._session_id = self.db.create_session(name, notes, tags)
        self._start_time = time.time()
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
        
        print(f"🔴 Recording started: Session #{self._session_id}")
        return self._session_id
    
    def stop(self, calibration_passed: bool = False) -> Dict:
        """
        Stop recording and finalize session.
        
        Returns:
            Session summary
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
        
        # Flush remaining samples
        self._flush_buffer()
        
        # Calculate average signal quality
        avg_quality = 0.5
        if self.muse_connector:
            quality = self.muse_connector.get_signal_quality()
            if quality:
                avg_quality = sum(quality.values()) / len(quality)
        
        # End session in database
        self.db.end_session(self._session_id, calibration_passed, avg_quality)
        
        # Get summary
        summary = self.db.get_session_summary(self._session_id)
        summary['recording_stats'] = {
            'samples_recorded': self._samples_recorded,
            'metrics_recorded': self._metrics_recorded
        }
        
        print(f"⏹️ Recording stopped: {self._samples_recorded} samples, {self._metrics_recorded} metrics")
        
        session_id = self._session_id
        self._session_id = None
        
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
        self.db.add_event(self._session_id, timestamp, event_type, label, data)
        print(f"📍 Marker added: {label} @ {timestamp:.2f}s")
    
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
                # We sample faster than the flush to not miss data
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
                            # (timestamp, tp9, af7, af8, tp10, aux)
                            sample = (
                                t,
                                float(data[0, i]) if data.shape[0] > 0 else 0,
                                float(data[1, i]) if data.shape[0] > 1 else 0,
                                float(data[2, i]) if data.shape[0] > 2 else 0,
                                float(data[3, i]) if data.shape[0] > 3 else 0,
                                float(data[4, i]) if data.shape[0] > 4 else 0
                            )
                            self._sample_buffer.append(sample)
                            self._samples_recorded += 1
                
                # Flush buffer periodically
                if time.time() - last_flush >= self._flush_interval:
                    self._flush_buffer()
                    last_flush = time.time()
                
                time.sleep(0.05)  # 50ms between checks
                
            except Exception as e:
                print(f"⚠️ Sample collection error: {e}")
                time.sleep(0.1)
        
        # Final flush
        self._flush_buffer()
    
    def _metrics_loop(self):
        """Background thread that computes and stores metrics."""
        from hardware import MuseToSyntergicAdapter
        from analysis.metrics import SyntergicMetrics
        
        while not self._stop_event.is_set():
            try:
                # Get 2-second window for metrics
                window = self.muse_connector.get_window(duration=2.0)
                
                if window is not None:
                    timestamp = time.time() - self._start_time
                    
                    # Compute metrics
                    eeg_data = MuseToSyntergicAdapter.prepare_for_analysis(window)
                    metrics = SyntergicMetrics.compute_all(eeg_data, fs=window.fs)
                    
                    # Add signal quality
                    quality = self.muse_connector.get_signal_quality()
                    if quality:
                        metrics['avg_quality'] = sum(quality.values()) / len(quality)
                    
                    # Store in database
                    self.db.add_metric(self._session_id, timestamp, metrics)
                    self._metrics_recorded += 1
                    
                    # Callback if set
                    if self._on_metrics:
                        self._on_metrics(timestamp, metrics)
                
                time.sleep(0.2)  # 5Hz metrics rate
                
            except Exception as e:
                print(f"⚠️ Metrics collection error: {e}")
                time.sleep(0.2)
    
    def _flush_buffer(self):
        """Flush sample buffer to database."""
        with self._buffer_lock:
            if self._sample_buffer and self._session_id:
                self.db.add_eeg_samples(self._session_id, self._sample_buffer)
                self._sample_buffer = []


# Singleton instance
_recorder_instance = None

def get_recorder(muse_connector=None) -> Optional[SessionRecorder]:
    """Get singleton recorder instance."""
    global _recorder_instance
    if _recorder_instance is None and muse_connector is not None:
        _recorder_instance = SessionRecorder(muse_connector)
    return _recorder_instance
