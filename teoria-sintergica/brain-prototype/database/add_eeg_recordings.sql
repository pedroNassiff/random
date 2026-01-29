-- Add eeg_recordings table for raw EEG session metadata
-- This stores technical recording info, separate from practice_sessions

CREATE TABLE IF NOT EXISTS eeg_recordings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    
    -- Timestamps
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    duration_seconds REAL DEFAULT 0,
    
    -- Device info
    device VARCHAR(50) DEFAULT 'muse2',
    device_address VARCHAR(100),
    sampling_rate INTEGER DEFAULT 256,
    channels TEXT[] DEFAULT ARRAY['TP9', 'AF7', 'AF8', 'TP10'],
    
    -- Recording stats
    sample_count INTEGER DEFAULT 0,
    metrics_count INTEGER DEFAULT 0,
    
    -- Quality
    calibration_passed BOOLEAN DEFAULT FALSE,
    avg_signal_quality REAL DEFAULT 0,
    
    -- User context (optional)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    practice_session_id UUID REFERENCES practice_sessions(id) ON DELETE SET NULL,
    
    -- Notes
    notes TEXT DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    recording_type VARCHAR(50) DEFAULT 'session',
    
    -- Aggregated metrics (from InfluxDB at end)
    avg_coherence REAL,
    avg_alpha REAL,
    avg_theta REAL,
    avg_beta REAL,
    avg_gamma REAL,
    avg_delta REAL,
    peak_coherence REAL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eeg_recordings_started ON eeg_recordings(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_eeg_recordings_user ON eeg_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_eeg_recordings_type ON eeg_recordings(recording_type);

COMMENT ON TABLE eeg_recordings IS 'Raw EEG recordings from Muse device - technical metadata';
COMMENT ON COLUMN eeg_recordings.practice_session_id IS 'Link to meditation session if part of practice';
