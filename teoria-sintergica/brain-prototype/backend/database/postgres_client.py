"""
PostgreSQL client for session metadata storage.

Handles:
- EEG recording sessions metadata (eeg_recordings table)
- User management
- Practice sessions linkage
"""

import os
import asyncio
import asyncpg
from typing import Optional, Dict, List
from datetime import datetime
from dataclasses import dataclass, field


# Connection settings
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', 5432))
POSTGRES_DB = os.getenv('POSTGRES_DB', 'brain_prototype')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'brain_user')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'sintergic2024')


@dataclass
class EEGRecording:
    """Metadata for a recorded EEG session."""
    id: Optional[int] = None
    name: str = ""
    started_at: datetime = None
    ended_at: datetime = None
    duration_seconds: float = 0.0
    device: str = "muse2"
    device_address: str = ""
    sampling_rate: int = 256
    channels: List[str] = field(default_factory=lambda: ['TP9', 'AF7', 'AF8', 'TP10'])
    sample_count: int = 0
    metrics_count: int = 0
    calibration_passed: bool = False
    avg_signal_quality: float = 0.0
    user_id: str = None
    practice_session_id: str = None
    notes: str = ""
    tags: List[str] = field(default_factory=list)
    recording_type: str = "session"
    
    # Aggregated metrics (from InfluxDB)
    avg_coherence: float = None
    avg_alpha: float = None
    avg_theta: float = None
    avg_beta: float = None
    avg_gamma: float = None
    avg_delta: float = None
    peak_coherence: float = None


class PostgresClient:
    """
    Async PostgreSQL client for brain prototype.
    
    Uses the eeg_recordings table for recording metadata.
    Time-series data goes to InfluxDB.
    
    Usage:
        client = PostgresClient()
        await client.connect()
        
        recording_id = await client.create_recording("My meditation")
        await client.end_recording(recording_id, metrics={...})
        
        await client.close()
    """
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._connected = False
    
    async def connect(self):
        """Establish connection pool to PostgreSQL."""
        if self._connected:
            return
        
        try:
            self.pool = await asyncpg.create_pool(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                min_size=2,
                max_size=10
            )
            self._connected = True
            print(f"✓ PostgreSQL connected: {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
            
        except Exception as e:
            print(f"✗ PostgreSQL connection failed: {e}")
            raise
    
    async def close(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
            self._connected = False
    
    @property
    def is_connected(self) -> bool:
        return self._connected
    
    # ==================== RECORDING CRUD ====================
    
    async def create_recording(
        self, 
        name: str = "",
        notes: str = "",
        tags: List[str] = None,
        device: str = "muse2",
        device_address: str = "",
        sampling_rate: int = 256,
        recording_type: str = "session"
    ) -> int:
        """
        Create a new EEG recording.
        
        Returns:
            recording_id
        """
        if not self._connected:
            await self.connect()
        
        if not name:
            name = f"Recording {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        async with self.pool.acquire() as conn:
            recording_id = await conn.fetchval('''
                INSERT INTO eeg_recordings 
                    (name, started_at, notes, tags, device, device_address, sampling_rate, recording_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id
            ''', name, datetime.now(), notes, tags or [], device, device_address, sampling_rate, recording_type)
            
        return recording_id
    
    async def end_recording(
        self,
        recording_id: int,
        calibration_passed: bool = False,
        avg_signal_quality: float = 0.0,
        sample_count: int = 0,
        metrics_count: int = 0,
        aggregated_metrics: Dict = None
    ) -> EEGRecording:
        """
        Finalize a recording.
        
        Args:
            recording_id: Recording to finalize
            calibration_passed: Whether calibration was successful
            avg_signal_quality: Average signal quality during recording
            sample_count: Total EEG samples recorded
            metrics_count: Total metrics snapshots recorded
            aggregated_metrics: Dict with avg_coherence, avg_alpha, etc.
        """
        if not self._connected:
            await self.connect()
        
        aggregated_metrics = aggregated_metrics or {}
        
        async with self.pool.acquire() as conn:
            ended_at = datetime.now()
            
            # Get start time to calculate duration
            started_at = await conn.fetchval(
                'SELECT started_at FROM eeg_recordings WHERE id = $1', recording_id
            )
            
            if started_at:
                duration = (ended_at - started_at).total_seconds()
            else:
                duration = 0
            
            await conn.execute('''
                UPDATE eeg_recordings SET
                    ended_at = $1,
                    duration_seconds = $2,
                    calibration_passed = $3,
                    avg_signal_quality = $4,
                    sample_count = $5,
                    metrics_count = $6,
                    avg_coherence = $7,
                    avg_alpha = $8,
                    avg_theta = $9,
                    avg_beta = $10,
                    avg_gamma = $11,
                    avg_delta = $12,
                    peak_coherence = $13
                WHERE id = $14
            ''', 
                ended_at, duration, calibration_passed, avg_signal_quality,
                sample_count, metrics_count,
                aggregated_metrics.get('avg_coherence'),
                aggregated_metrics.get('avg_alpha'),
                aggregated_metrics.get('avg_theta'),
                aggregated_metrics.get('avg_beta'),
                aggregated_metrics.get('avg_gamma'),
                aggregated_metrics.get('avg_delta'),
                aggregated_metrics.get('peak_coherence'),
                recording_id
            )
            
        return await self.get_recording(recording_id)
    
    async def get_recording(self, recording_id: int) -> Optional[EEGRecording]:
        """Get recording by ID."""
        if not self._connected:
            await self.connect()
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                'SELECT * FROM eeg_recordings WHERE id = $1', recording_id
            )
            
            if not row:
                return None
            
            return self._row_to_recording(row)
    
    async def get_all_recordings(self, limit: int = 50, recording_type: str = None) -> List[EEGRecording]:
        """Get all recordings, newest first."""
        if not self._connected:
            await self.connect()
        
        async with self.pool.acquire() as conn:
            if recording_type:
                rows = await conn.fetch('''
                    SELECT * FROM eeg_recordings 
                    WHERE ended_at IS NOT NULL AND recording_type = $1
                    ORDER BY started_at DESC 
                    LIMIT $2
                ''', recording_type, limit)
            else:
                rows = await conn.fetch('''
                    SELECT * FROM eeg_recordings 
                    WHERE ended_at IS NOT NULL
                    ORDER BY started_at DESC 
                    LIMIT $1
                ''', limit)
            
            return [self._row_to_recording(row) for row in rows]
    
    async def delete_recording(self, recording_id: int) -> bool:
        """Delete a recording."""
        if not self._connected:
            await self.connect()
        
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                'DELETE FROM eeg_recordings WHERE id = $1', recording_id
            )
            return 'DELETE 1' in result
    
    def _row_to_recording(self, row) -> EEGRecording:
        """Convert database row to EEGRecording dataclass."""
        return EEGRecording(
            id=row['id'],
            name=row['name'],
            started_at=row['started_at'],
            ended_at=row['ended_at'],
            duration_seconds=row['duration_seconds'] or 0,
            device=row['device'],
            device_address=row['device_address'] or '',
            sampling_rate=row['sampling_rate'],
            channels=list(row['channels']) if row['channels'] else ['TP9', 'AF7', 'AF8', 'TP10'],
            sample_count=row['sample_count'] or 0,
            metrics_count=row['metrics_count'] or 0,
            calibration_passed=row['calibration_passed'],
            avg_signal_quality=row['avg_signal_quality'] or 0,
            user_id=str(row['user_id']) if row['user_id'] else None,
            practice_session_id=str(row['practice_session_id']) if row['practice_session_id'] else None,
            notes=row['notes'] or '',
            tags=list(row['tags']) if row['tags'] else [],
            recording_type=row['recording_type'] or 'session',
            avg_coherence=row['avg_coherence'],
            avg_alpha=row['avg_alpha'],
            avg_theta=row['avg_theta'],
            avg_beta=row['avg_beta'],
            avg_gamma=row['avg_gamma'],
            avg_delta=row['avg_delta'],
            peak_coherence=row['peak_coherence']
        )


# ==================== SYNC WRAPPER ====================
# For use in non-async contexts (like the recorder thread)

import asyncio
from concurrent.futures import ThreadPoolExecutor

_executor = ThreadPoolExecutor(max_workers=2)


import psycopg2
from psycopg2.extras import RealDictCursor


class PostgresClientSync:
    """
    Synchronous PostgreSQL client using psycopg2.
    
    Used in threaded contexts like the SessionRecorder.
    """
    
    def __init__(self):
        self._conn = None
        self._connected = False
    
    def connect(self):
        """Connect to PostgreSQL synchronously."""
        if self._connected:
            return
        try:
            self._conn = psycopg2.connect(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD
            )
            self._connected = True
            print(f"✓ PostgreSQL connected (sync): {POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}")
        except Exception as e:
            print(f"⚠️ PostgreSQL sync connection failed: {e}")
            raise
    
    def close(self):
        """Close connection."""
        if self._conn:
            self._conn.close()
            self._connected = False
    
    def create_recording(
        self, 
        name: str = "",
        notes: str = "",
        tags: List[str] = None,
        device: str = "muse2",
        device_address: str = "",
        sampling_rate: int = 256,
        recording_type: str = "session"
    ) -> int:
        """Create a new recording entry."""
        if not self._connected:
            self.connect()
        
        if not name:
            name = f"Recording {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        with self._conn.cursor() as cur:
            cur.execute("""
                INSERT INTO eeg_recordings 
                (name, notes, tags, device, device_address, sampling_rate, recording_type, started_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (name, notes, tags or [], device, device_address, sampling_rate, recording_type))
            self._conn.commit()
            recording_id = cur.fetchone()[0]
        
        print(f"📝 Recording created: #{recording_id} - {name}")
        return recording_id
    
    def end_recording(
        self, 
        recording_id: int,
        duration_seconds: float = 0,
        sample_count: int = 0,
        metrics_count: int = 0,
        calibration_passed: bool = False,
        avg_signal_quality: float = 0,
        avg_coherence: float = None,
        avg_alpha: float = None,
        avg_theta: float = None,
        avg_beta: float = None,
        avg_gamma: float = None,
        avg_delta: float = None,
        peak_coherence: float = None,
        aggregated_metrics: dict = None
    ) -> Optional[EEGRecording]:
        """End a recording and update metadata."""
        if not self._connected:
            self.connect()
        
        # Extract values from aggregated_metrics if provided
        if aggregated_metrics:
            avg_coherence = aggregated_metrics.get('avg_coherence', avg_coherence)
            avg_alpha = aggregated_metrics.get('avg_alpha', avg_alpha)
            avg_theta = aggregated_metrics.get('avg_theta', avg_theta)
            avg_beta = aggregated_metrics.get('avg_beta', avg_beta)
            avg_gamma = aggregated_metrics.get('avg_gamma', avg_gamma)
            avg_delta = aggregated_metrics.get('avg_delta', avg_delta)
            peak_coherence = aggregated_metrics.get('peak_coherence', peak_coherence)
        
        # Helper to convert numpy types to native Python
        def to_native(val):
            if val is None:
                return None
            if hasattr(val, 'item'):  # numpy scalar
                return val.item()
            return float(val)
        
        # Convert all numeric values to native Python types
        duration_seconds = to_native(duration_seconds) or 0
        avg_signal_quality = to_native(avg_signal_quality) or 0
        avg_coherence = to_native(avg_coherence)
        avg_alpha = to_native(avg_alpha)
        avg_theta = to_native(avg_theta)
        avg_beta = to_native(avg_beta)
        avg_gamma = to_native(avg_gamma)
        avg_delta = to_native(avg_delta)
        peak_coherence = to_native(peak_coherence)
        
        with self._conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                UPDATE eeg_recordings SET
                    ended_at = NOW(),
                    duration_seconds = %s,
                    sample_count = %s,
                    metrics_count = %s,
                    calibration_passed = %s,
                    avg_signal_quality = %s,
                    avg_coherence = %s,
                    avg_alpha = %s,
                    avg_theta = %s,
                    avg_beta = %s,
                    avg_gamma = %s,
                    avg_delta = %s,
                    peak_coherence = %s
                WHERE id = %s
                RETURNING *
            """, (
                duration_seconds, sample_count, metrics_count, calibration_passed,
                avg_signal_quality, avg_coherence, avg_alpha, avg_theta, avg_beta,
                avg_gamma, avg_delta, peak_coherence, recording_id
            ))
            self._conn.commit()
            row = cur.fetchone()
        
        if row:
            print(f"✅ Recording #{recording_id} ended: {duration_seconds:.1f}s, {sample_count} samples")
            return self._row_to_recording(row)
        return None
    
    def get_recording(self, recording_id: int) -> Optional[EEGRecording]:
        """Get a recording by ID."""
        if not self._connected:
            self.connect()
        
        with self._conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM eeg_recordings WHERE id = %s", (recording_id,))
            row = cur.fetchone()
        
        return self._row_to_recording(row) if row else None
    
    def get_all_recordings(self, limit: int = 50, offset: int = 0) -> List[EEGRecording]:
        """Get all recordings with pagination."""
        if not self._connected:
            self.connect()
        
        with self._conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM eeg_recordings 
                ORDER BY started_at DESC 
                LIMIT %s OFFSET %s
            """, (limit, offset))
            rows = cur.fetchall()
        
        return [self._row_to_recording(row) for row in rows]
    
    def _row_to_recording(self, row: dict) -> EEGRecording:
        """Convert database row to EEGRecording."""
        return EEGRecording(
            id=row['id'],
            name=row.get('name', ''),
            started_at=row.get('started_at'),
            ended_at=row.get('ended_at'),
            duration_seconds=row.get('duration_seconds', 0),
            device=row.get('device', 'muse2'),
            device_address=row.get('device_address', ''),
            sampling_rate=row.get('sampling_rate', 256),
            channels=row.get('channels', ['TP9', 'AF7', 'AF8', 'TP10']),
            sample_count=row.get('sample_count', 0),
            metrics_count=row.get('metrics_count', 0),
            calibration_passed=row.get('calibration_passed', False),
            avg_signal_quality=row.get('avg_signal_quality', 0),
            user_id=row.get('user_id'),
            practice_session_id=row.get('practice_session_id'),
            notes=row.get('notes', ''),
            tags=row.get('tags', []),
            recording_type=row.get('recording_type', 'session'),
            avg_coherence=row.get('avg_coherence'),
            avg_alpha=row.get('avg_alpha'),
            avg_theta=row.get('avg_theta'),
            avg_beta=row.get('avg_beta'),
            avg_gamma=row.get('avg_gamma'),
            avg_delta=row.get('avg_delta'),
            peak_coherence=row.get('peak_coherence')
        )


# Singleton instances
_postgres_client: Optional[PostgresClient] = None
_postgres_client_sync: Optional[PostgresClientSync] = None


def get_postgres_client() -> PostgresClient:
    """Get the singleton async PostgreSQL client."""
    global _postgres_client
    if _postgres_client is None:
        _postgres_client = PostgresClient()
    return _postgres_client


def get_postgres_client_sync() -> PostgresClientSync:
    """Get the singleton sync PostgreSQL client."""
    global _postgres_client_sync
    if _postgres_client_sync is None:
        _postgres_client_sync = PostgresClientSync()
    return _postgres_client_sync
