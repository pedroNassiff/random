"""
MuseFeatureExtractor — Extracts feature vectors from Muse 2 EEG windows.

Converts raw 4ch × n_samples (2s @ 256Hz) into a 24-dim feature vector
suitable for MuseVAE training and inference.

Feature vector (dim=24):
  [0:20]  5 band powers × 4 channels (delta, theta, alpha, beta, gamma per ch)
  [20]    Inter-hemispheric PLV (TP9+AF7 vs AF8+TP10)
  [21]    Alpha-band MSC
  [22]    Frontal alpha asymmetry: log(AF8_alpha / AF7_alpha)
  [23]    Global theta/beta ratio

Usage:
    from ai.muse_features import MuseFeatureExtractor
    
    features = MuseFeatureExtractor.extract(window_data, fs=256)
    # features.shape == (24,)
    
    # Batch extraction from recorded session:
    dataset = MuseFeatureExtractor.extract_session(session_windows)
    # dataset.shape == (n_windows, 24)
"""

import numpy as np
from typing import List, Dict, Optional

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from analysis.spectral import SpectralAnalyzer
from analysis.coherence import CoherenceAnalyzer


class MuseFeatureExtractor:
    """
    Extracts a 24-dimensional feature vector from a Muse 2 EEG window.
    
    Channels:
      0: TP9  (left temporal)
      1: AF7  (left frontal)
      2: AF8  (right frontal)
      3: TP10 (right temporal)
    """
    
    CHANNELS = ['TP9', 'AF7', 'AF8', 'TP10']
    BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
    LEFT_CH = [0, 1]   # TP9, AF7
    RIGHT_CH = [2, 3]  # AF8, TP10
    
    FEATURE_DIM = 24
    
    # Feature names for interpretability / logging
    FEATURE_NAMES = (
        [f"{ch}_{band}" for ch in ['TP9', 'AF7', 'AF8', 'TP10'] for band in ['delta', 'theta', 'alpha', 'beta', 'gamma']]
        + ['plv_inter_hemispheric', 'msc_alpha', 'frontal_alpha_asymmetry', 'theta_beta_ratio']
    )
    
    @staticmethod
    def extract(window_data: np.ndarray, fs: int = 256) -> np.ndarray:
        """
        Extract feature vector from raw EEG window.
        
        Args:
            window_data: (4, n_samples) raw EEG in µV
            fs: sampling rate in Hz
            
        Returns:
            np.ndarray shape (24,) — feature vector
        """
        assert window_data.shape[0] == 4, f"Expected 4 channels, got {window_data.shape[0]}"
        
        features = []
        
        # ── 1. Band powers per channel (5 bands × 4 ch = 20 features) ──
        channel_bands = []
        for ch_idx in range(4):
            signal = window_data[ch_idx]
            bands = SpectralAnalyzer.compute_frequency_bands(signal, fs)
            channel_bands.append(bands)
            for band_name in MuseFeatureExtractor.BANDS:
                features.append(bands.get(band_name, 0.0))
        
        # ── 2. Inter-hemispheric PLV (1 feature) ────────────────────────
        left_avg = np.mean(window_data[MuseFeatureExtractor.LEFT_CH], axis=0)
        right_avg = np.mean(window_data[MuseFeatureExtractor.RIGHT_CH], axis=0)
        
        try:
            plv = CoherenceAnalyzer.compute_phase_locking_value(left_avg, right_avg, fs)
            plv = plv if np.isfinite(plv) else 0.5
        except Exception:
            plv = 0.5
        features.append(plv)
        
        # ── 3. Alpha-band MSC (1 feature) ───────────────────────────────
        try:
            msc = CoherenceAnalyzer.compute_msc(left_avg, right_avg, fs)
            msc = msc if np.isfinite(msc) else 0.5
        except Exception:
            msc = 0.5
        features.append(msc)
        
        # ── 4. Frontal alpha asymmetry (1 feature) ──────────────────────
        # AF7 = channel 1, AF8 = channel 2
        af7_alpha = channel_bands[1].get('alpha', 0.01)
        af8_alpha = channel_bands[2].get('alpha', 0.01)
        asymmetry = np.log((af8_alpha + 1e-8) / (af7_alpha + 1e-8))
        features.append(float(np.clip(asymmetry, -2.0, 2.0)))
        
        # ── 5. Global theta/beta ratio (1 feature) ──────────────────────
        global_signal = np.mean(window_data, axis=0)
        global_bands = SpectralAnalyzer.compute_frequency_bands(global_signal, fs)
        tbr = global_bands.get('theta', 0.2) / (global_bands.get('beta', 0.2) + 1e-8)
        features.append(float(np.clip(tbr, 0.0, 10.0)))
        
        return np.array(features, dtype=np.float32)
    
    @staticmethod
    def extract_from_brainstate(brain_state: Dict) -> Optional[np.ndarray]:
        """
        Extract feature vector from a processed brainState dict.
        
        Less precise than extract() (no per-channel info), but works
        with data already in the WebSocket/InfluxDB format.
        
        Uses global bands repeated across 4 channels (approximation).
        
        Args:
            brain_state: Dict with 'bands', 'coherence', 'plv'
            
        Returns:
            np.ndarray shape (24,) or None if data is insufficient
        """
        bands = brain_state.get('bands')
        if not bands:
            return None
        
        features = []
        
        # Approximate: use global bands for all 4 channels
        for _ch in range(4):
            for band_name in MuseFeatureExtractor.BANDS:
                features.append(bands.get(band_name, 0.2))
        
        # PLV from brainState
        features.append(brain_state.get('plv', brain_state.get('coherence', 0.5)))
        
        # MSC approximation (use coherence)
        features.append(brain_state.get('coherence', 0.5))
        
        # Alpha asymmetry (not available in global bands, use 0)
        features.append(0.0)
        
        # Theta/beta ratio
        theta = bands.get('theta', 0.2)
        beta = bands.get('beta', 0.2)
        features.append(float(np.clip(theta / (beta + 1e-8), 0.0, 10.0)))
        
        return np.array(features, dtype=np.float32)
    
    @staticmethod
    def extract_session(
        windows: List[Dict],
        min_quality: float = 0.4,
    ) -> np.ndarray:
        """
        Batch extract features from a list of brainState windows.
        
        Filters out low-quality windows.
        
        Args:
            windows: List of brainState dicts
            min_quality: Minimum avg_quality to include
            
        Returns:
            np.ndarray shape (n_valid_windows, 24)
        """
        features = []
        
        for w in windows:
            # Quality gate
            quality = w.get('avg_quality', 1.0)
            if quality < min_quality:
                continue
            
            feat = MuseFeatureExtractor.extract_from_brainstate(w)
            if feat is not None:
                features.append(feat)
        
        if not features:
            return np.empty((0, MuseFeatureExtractor.FEATURE_DIM), dtype=np.float32)
        
        return np.array(features, dtype=np.float32)
    
    @staticmethod
    def get_feature_stats(features: np.ndarray) -> Dict:
        """
        Compute statistics for a batch of feature vectors.
        
        Useful for normalization and quality checks before training.
        """
        if features.size == 0:
            return {"error": "Empty feature array"}
        
        return {
            "n_samples": features.shape[0],
            "feature_dim": features.shape[1],
            "mean": features.mean(axis=0).tolist(),
            "std": features.std(axis=0).tolist(),
            "min": features.min(axis=0).tolist(),
            "max": features.max(axis=0).tolist(),
            "feature_names": MuseFeatureExtractor.FEATURE_NAMES,
        }
