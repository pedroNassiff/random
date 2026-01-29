"""
Database models for EEG session recording.

Stores recorded Muse sessions with:
- Session metadata (start time, duration, notes)
- EEG raw samples (4 channels @ 256Hz)
- Computed metrics over time (coherence, bands, entropy)
"""

import sqlite3
import json
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from dataclasses import dataclass, asdict
import threading


# Database path
DB_PATH = Path(__file__).parent / "sessions.db"


@dataclass
class SessionMetadata:
    """Metadata for a recorded session."""
    id: Optional[int] = None
    name: str = ""
    start_time: str = ""
    end_time: str = ""
    duration_seconds: float = 0.0
    device: str = "muse2"
    sampling_rate: int = 256
    channels: str = "TP9,AF7,AF8,TP10"
    notes: str = ""
    tags: str = ""  # comma-separated tags
    calibration_passed: bool = False
    avg_signal_quality: float = 0.0


@dataclass 
class MetricSnapshot:
    """Single snapshot of computed metrics at a point in time."""
    session_id: int
    timestamp: float  # seconds from session start
    coherence: float
    entropy: float
    plv: float
    delta: float
    theta: float
    alpha: float
    beta: float
    gamma: float
    dominant_frequency: float
    state: str
    signal_quality_avg: float


class SessionDatabase:
    """
    SQLite database manager for EEG sessions.
    
    Thread-safe for concurrent writes during recording.
    """
    
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()
    
    def _init_db(self):
        """Create tables if they don't exist."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Sessions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    duration_seconds REAL DEFAULT 0,
                    device TEXT DEFAULT 'muse2',
                    sampling_rate INTEGER DEFAULT 256,
                    channels TEXT DEFAULT 'TP9,AF7,AF8,TP10',
                    notes TEXT DEFAULT '',
                    tags TEXT DEFAULT '',
                    calibration_passed INTEGER DEFAULT 0,
                    avg_signal_quality REAL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Raw EEG samples table (high volume)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS eeg_samples (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    timestamp REAL NOT NULL,
                    tp9 REAL,
                    af7 REAL,
                    af8 REAL,
                    tp10 REAL,
                    aux REAL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id)
                )
            ''')
            
            # Create index for faster queries
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_eeg_session 
                ON eeg_samples(session_id, timestamp)
            ''')
            
            # Metrics snapshots table (lower volume, computed every 200ms)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    timestamp REAL NOT NULL,
                    coherence REAL,
                    entropy REAL,
                    plv REAL,
                    delta REAL,
                    theta REAL,
                    alpha REAL,
                    beta REAL,
                    gamma REAL,
                    dominant_frequency REAL,
                    state TEXT,
                    signal_quality_avg REAL,
                    FOREIGN KEY (session_id) REFERENCES sessions(id)
                )
            ''')
            
            cursor.execute('''
                CREATE INDEX IF NOT EXISTS idx_metrics_session 
                ON metrics(session_id, timestamp)
            ''')
            
            # Events/markers table (for stimuli, annotations)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id INTEGER NOT NULL,
                    timestamp REAL NOT NULL,
                    event_type TEXT NOT NULL,
                    label TEXT,
                    data TEXT,
                    FOREIGN KEY (session_id) REFERENCES sessions(id)
                )
            ''')
            
            conn.commit()
            conn.close()
            
            print(f"✓ Session database initialized: {self.db_path}")
    
    # ==================== SESSION CRUD ====================
    
    def create_session(self, name: str = "", notes: str = "", tags: str = "") -> int:
        """Create a new recording session. Returns session ID."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            start_time = datetime.now().isoformat()
            if not name:
                name = f"Session {start_time[:10]}"
            
            cursor.execute('''
                INSERT INTO sessions (name, start_time, notes, tags)
                VALUES (?, ?, ?, ?)
            ''', (name, start_time, notes, tags))
            
            session_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            print(f"🔴 Created recording session #{session_id}: {name}")
            return session_id
    
    def end_session(self, session_id: int, 
                    calibration_passed: bool = False,
                    avg_signal_quality: float = 0.0) -> None:
        """Mark session as ended and update duration."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get start time
            cursor.execute('SELECT start_time FROM sessions WHERE id = ?', (session_id,))
            row = cursor.fetchone()
            if row:
                start_time = datetime.fromisoformat(row[0])
                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()
                
                cursor.execute('''
                    UPDATE sessions 
                    SET end_time = ?, duration_seconds = ?, 
                        calibration_passed = ?, avg_signal_quality = ?
                    WHERE id = ?
                ''', (end_time.isoformat(), duration, 
                      int(calibration_passed), avg_signal_quality, session_id))
                
                conn.commit()
                print(f"⏹️ Ended session #{session_id} (duration: {duration:.1f}s)")
            
            conn.close()
    
    def get_session(self, session_id: int) -> Optional[SessionMetadata]:
        """Get session metadata by ID."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM sessions WHERE id = ?', (session_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return SessionMetadata(
                id=row['id'],
                name=row['name'],
                start_time=row['start_time'],
                end_time=row['end_time'] or "",
                duration_seconds=row['duration_seconds'],
                device=row['device'],
                sampling_rate=row['sampling_rate'],
                channels=row['channels'],
                notes=row['notes'],
                tags=row['tags'],
                calibration_passed=bool(row['calibration_passed']),
                avg_signal_quality=row['avg_signal_quality']
            )
        return None
    
    def list_sessions(self, limit: int = 50) -> List[Dict]:
        """List recent sessions."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, start_time, duration_seconds, 
                   calibration_passed, avg_signal_quality, notes, tags
            FROM sessions 
            ORDER BY start_time DESC 
            LIMIT ?
        ''', (limit,))
        
        sessions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return sessions
    
    def delete_session(self, session_id: int) -> bool:
        """Delete session and all related data."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM eeg_samples WHERE session_id = ?', (session_id,))
            cursor.execute('DELETE FROM metrics WHERE session_id = ?', (session_id,))
            cursor.execute('DELETE FROM events WHERE session_id = ?', (session_id,))
            cursor.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
            
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            
            if deleted:
                print(f"🗑️ Deleted session #{session_id}")
            return deleted
    
    # ==================== EEG SAMPLES ====================
    
    def add_eeg_samples(self, session_id: int, samples: List[tuple]) -> None:
        """
        Bulk insert EEG samples.
        
        Args:
            session_id: Session ID
            samples: List of tuples (timestamp, tp9, af7, af8, tp10, aux)
        """
        if not samples:
            return
            
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.executemany('''
                INSERT INTO eeg_samples (session_id, timestamp, tp9, af7, af8, tp10, aux)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', [(session_id,) + s for s in samples])
            
            conn.commit()
            conn.close()
    
    def get_eeg_samples(self, session_id: int, 
                        start_time: float = 0, 
                        end_time: float = None) -> np.ndarray:
        """
        Get EEG samples for a session.
        
        Returns:
            Array of shape (n_samples, 6) - [timestamp, tp9, af7, af8, tp10, aux]
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if end_time:
            cursor.execute('''
                SELECT timestamp, tp9, af7, af8, tp10, aux
                FROM eeg_samples 
                WHERE session_id = ? AND timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp
            ''', (session_id, start_time, end_time))
        else:
            cursor.execute('''
                SELECT timestamp, tp9, af7, af8, tp10, aux
                FROM eeg_samples 
                WHERE session_id = ? AND timestamp >= ?
                ORDER BY timestamp
            ''', (session_id, start_time))
        
        rows = cursor.fetchall()
        conn.close()
        
        return np.array(rows) if rows else np.array([])
    
    # ==================== METRICS ====================
    
    def add_metric(self, session_id: int, timestamp: float, metrics: Dict) -> None:
        """Add a metrics snapshot."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            bands = metrics.get('bands', {})
            
            cursor.execute('''
                INSERT INTO metrics (
                    session_id, timestamp, coherence, entropy, plv,
                    delta, theta, alpha, beta, gamma,
                    dominant_frequency, state, signal_quality_avg
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                session_id,
                timestamp,
                metrics.get('coherence', 0),
                metrics.get('entropy', 0),
                metrics.get('plv', 0),
                bands.get('delta', 0),
                bands.get('theta', 0),
                bands.get('alpha', 0),
                bands.get('beta', 0),
                bands.get('gamma', 0),
                metrics.get('dominant_frequency', 0),
                metrics.get('state', 'unknown'),
                metrics.get('avg_quality', 0)
            ))
            
            conn.commit()
            conn.close()
    
    def get_metrics(self, session_id: int) -> List[Dict]:
        """Get all metrics for a session."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM metrics 
            WHERE session_id = ? 
            ORDER BY timestamp
        ''', (session_id,))
        
        metrics = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return metrics
    
    # ==================== EVENTS ====================
    
    def add_event(self, session_id: int, timestamp: float, 
                  event_type: str, label: str = "", data: Dict = None) -> None:
        """Add an event/marker to the session."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO events (session_id, timestamp, event_type, label, data)
                VALUES (?, ?, ?, ?, ?)
            ''', (session_id, timestamp, event_type, label, 
                  json.dumps(data) if data else None))
            
            conn.commit()
            conn.close()
    
    def get_events(self, session_id: int) -> List[Dict]:
        """Get all events for a session."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM events 
            WHERE session_id = ? 
            ORDER BY timestamp
        ''', (session_id,))
        
        events = []
        for row in cursor.fetchall():
            event = dict(row)
            if event['data']:
                event['data'] = json.loads(event['data'])
            events.append(event)
        
        conn.close()
        return events
    
    # ==================== ANALYSIS HELPERS ====================
    
    def get_session_summary(self, session_id: int) -> Dict:
        """Get comprehensive session summary for analysis."""
        session = self.get_session(session_id)
        if not session:
            return None
        
        metrics = self.get_metrics(session_id)
        events = self.get_events(session_id)
        
        # Compute statistics
        if metrics:
            coherence_values = [m['coherence'] for m in metrics]
            alpha_values = [m['alpha'] for m in metrics]
            
            summary = {
                'session': asdict(session),
                'metrics_count': len(metrics),
                'events_count': len(events),
                'stats': {
                    'coherence': {
                        'mean': np.mean(coherence_values),
                        'std': np.std(coherence_values),
                        'min': np.min(coherence_values),
                        'max': np.max(coherence_values)
                    },
                    'alpha': {
                        'mean': np.mean(alpha_values),
                        'std': np.std(alpha_values),
                        'min': np.min(alpha_values),
                        'max': np.max(alpha_values)
                    }
                },
                'timeline': {
                    'start': metrics[0]['timestamp'] if metrics else 0,
                    'end': metrics[-1]['timestamp'] if metrics else 0
                }
            }
        else:
            summary = {
                'session': asdict(session),
                'metrics_count': 0,
                'events_count': len(events),
                'stats': None,
                'timeline': None
            }
        
        return summary


# Singleton instance
_db_instance = None

def get_database() -> SessionDatabase:
    """Get singleton database instance."""
    global _db_instance
    if _db_instance is None:
        _db_instance = SessionDatabase()
    return _db_instance
