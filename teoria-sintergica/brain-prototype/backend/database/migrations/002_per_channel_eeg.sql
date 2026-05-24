-- Migration 002: Per-channel EEG band power storage
-- Adds per-channel columns to eeg_recordings for post-retention historical persistence.
--
-- Rule: per-window data lives in InfluxDB eeg_band_power (30d retention).
--       per-session aggregates live here permanently.
--
-- Sessions recorded before this migration will have per_channel_version = 0
-- and all per-channel columns as NULL. The frontend must handle this gracefully.
--
-- To apply:
--   psql -h <host> -U brain_user -d brain_prototype -f 002_per_channel_eeg.sql
-- Or via tunnel:
--   psql -h localhost -p 5433 -U brain_user -d brain_prototype -f 002_per_channel_eeg.sql

ALTER TABLE eeg_recordings
  ADD COLUMN IF NOT EXISTS alpha_tp9_avg             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS alpha_af7_avg             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS alpha_af8_avg             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS alpha_tp10_avg            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS faa_mean                  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS faa_baseline_closed       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS posterior_asymmetry_mean  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS per_channel_version       INTEGER DEFAULT 0;

-- Ensure existing rows have version = 0 explicitly (not NULL)
UPDATE eeg_recordings
SET per_channel_version = 0
WHERE per_channel_version IS NULL;

-- Verify
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'eeg_recordings'
  AND column_name IN (
    'alpha_tp9_avg', 'alpha_af7_avg', 'alpha_af8_avg', 'alpha_tp10_avg',
    'faa_mean', 'faa_baseline_closed', 'posterior_asymmetry_mean', 'per_channel_version'
  )
ORDER BY ordinal_position;
