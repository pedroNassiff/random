"""
SessionQualityScore — composite quality score for recorded EEG sessions.

Score 0-100 with grade A-F, composed of:
  - Signal quality (25%): Average electrode contact quality
  - Alpha reactivity (25%): Berger effect ratio
  - Data completeness (25%): % of windows without artefacts
  - Coherence stability (25%): Autocorrelation of PLV

Determines if a session is usable for VAE training.
"""

import numpy as np
from typing import Dict, List, Optional

from .tests import (
    validate_berger_effect,
    validate_coherence_stability,
)


class SessionQualityScore:
    """
    Computes a composite quality score for a recorded session.
    
    Usage:
        result = SessionQualityScore.compute(windows, markers)
        print(result['total_score'])   # 72.5
        print(result['grade'])          # 'B'
        print(result['usable_for_training'])  # True
    """
    
    # Minimum quality threshold for training data
    MIN_TRAINING_SCORE = 65
    
    # Minimum number of metric windows for a session to be usable
    # 500 windows @ 5Hz = 100 seconds of clean data
    MIN_TRAINING_WINDOWS = 500
    
    # Minimum electrode quality to consider a window "clean"
    MIN_WINDOW_QUALITY = 0.4
    
    @staticmethod
    def compute(
        windows: List[Dict],
        markers: List[Dict],
    ) -> Dict:
        """
        Compute composite quality score.
        
        Args:
            windows: List of brainState dicts. Expected fields:
                     'bands', 'coherence', 'timestamp',
                     'avg_quality' or 'signal_quality' (optional)
            markers: List of marker dicts with 'label', 'timestamp'
        
        Returns:
            Dict with total_score, component scores, grade, usable_for_training
        """
        # ── 1. Signal quality (25%) ──────────────────────────────────────
        quality_values = []
        for w in windows:
            aq = w.get('avg_quality')
            if aq is not None:
                quality_values.append(aq)
            elif w.get('signal_quality') is not None:
                sq = w['signal_quality']
                if isinstance(sq, dict):
                    vals = [v for v in sq.values() if isinstance(v, (int, float)) and np.isfinite(v)]
                    if vals:
                        quality_values.append(np.mean(vals))
                elif isinstance(sq, (int, float)) and np.isfinite(sq) and sq > 0:
                    # Scalar float from InfluxDB get_metrics()
                    quality_values.append(sq)
        
        signal_score = (np.mean(quality_values) * 100) if quality_values else 50.0
        signal_score = min(100, max(0, signal_score))
        
        # ── 2. Alpha reactivity (25%) ────────────────────────────────────
        berger = validate_berger_effect(windows, markers)
        ratio = berger.get('metrics', {}).get('ratio', 1.0)
        # ratio 1.0 → 0 pts, ratio 2.0 → 100 pts (linear)
        alpha_score = min(100, max(0, (ratio - 1.0) * 100))
        
        # ── 3. Data completeness (25%) ───────────────────────────────────
        total_windows = len(windows)
        if total_windows > 0:
            clean_windows = sum(
                1 for w in windows
                if _get_window_quality(w) >= SessionQualityScore.MIN_WINDOW_QUALITY
            )
            completeness_score = (clean_windows / total_windows) * 100
        else:
            completeness_score = 0.0
        
        # ── 4. Coherence stability (25%) ─────────────────────────────────
        coh_result = validate_coherence_stability(windows, markers)
        autocorr = coh_result.get('metrics', {}).get('autocorrelation_lag1', 0)
        # autocorr 0.0 → 0 pts, 1.0 → 100 pts
        coherence_score = max(0, autocorr * 100)
        
        # ── Composite ────────────────────────────────────────────────────
        total = (
            signal_score * 0.25 +
            alpha_score * 0.25 +
            completeness_score * 0.25 +
            coherence_score * 0.25
        )
        
        grade = _score_to_grade(total)
        
        return _sanitize({
            "total_score": round(total, 1),
            "grade": grade,
            "passes_quality_threshold": (
                total >= SessionQualityScore.MIN_TRAINING_SCORE and
                total_windows >= SessionQualityScore.MIN_TRAINING_WINDOWS
            ),
            "components": {
                "signal_quality": {
                    "score": round(signal_score, 1),
                    "weight": 0.25,
                    "description": "Average electrode contact quality",
                    "windows_with_quality": len(quality_values),
                },
                "alpha_reactivity": {
                    "score": round(alpha_score, 1),
                    "weight": 0.25,
                    "description": "Berger effect (eyes closed/open alpha ratio)",
                    "ratio": round(ratio, 3),
                    "berger_passed": berger.get('passed', False),
                },
                "data_completeness": {
                    "score": round(completeness_score, 1),
                    "weight": 0.25,
                    "description": "% of windows with adequate signal",
                    "total_windows": total_windows,
                    "clean_windows": clean_windows if total_windows > 0 else 0,
                },
                "coherence_stability": {
                    "score": round(coherence_score, 1),
                    "weight": 0.25,
                    "description": "Autocorrelation of coherence (real signal vs noise)",
                    "autocorrelation": round(autocorr, 4),
                    "coherence_passed": coh_result.get('passed', False),
                },
            },
            "total_windows": total_windows,
            "session_duration_est": round(total_windows * 0.2, 1),
        })
    
    @staticmethod
    def compute_quick(windows: List[Dict]) -> Dict:
        """
        Quick score without markers (no Berger test).
        
        Useful for live sessions or sessions without the validation protocol.
        Uses signal quality, completeness, and coherence only.
        """
        total_windows = len(windows)
        
        # Signal quality
        quality_values = [_get_window_quality(w) for w in windows]
        quality_values = [q for q in quality_values if q > 0]
        signal_score = (np.mean(quality_values) * 100) if quality_values else 50.0
        
        # Completeness
        clean = sum(1 for q in quality_values if q >= 0.4)
        completeness_score = (clean / max(total_windows, 1)) * 100
        
        # Coherence
        coh_series = [w.get('coherence', 0) for w in windows if np.isfinite(w.get('coherence', 0))]
        if len(coh_series) >= 10:
            arr = np.array(coh_series)
            autocorr = float(np.corrcoef(arr[:-1], arr[1:])[0, 1])
            coherence_score = max(0, autocorr * 100)
        else:
            coherence_score = 0
        
        total = (signal_score + completeness_score + coherence_score) / 3
        
        return {
            "total_score": round(total, 1),
            "grade": _score_to_grade(total),
            "components": {
                "signal_quality": round(signal_score, 1),
                "data_completeness": round(completeness_score, 1),
                "coherence_stability": round(coherence_score, 1),
            },
        }


def _get_window_quality(w: Dict) -> float:
    """Extract quality score from a window dict."""
    aq = w.get('avg_quality')
    if aq is not None and isinstance(aq, (int, float)) and np.isfinite(aq):
        return float(aq)
    sq = w.get('signal_quality')
    if sq is not None:
        if isinstance(sq, (int, float)) and np.isfinite(sq):
            return float(sq)
        if isinstance(sq, dict):
            vals = [v for v in sq.values() if isinstance(v, (int, float)) and np.isfinite(v)]
            if vals:
                return float(np.mean(vals))
    return 0.5  # default if no quality info


def _sanitize(obj):
    """Recursively convert numpy types to native Python for JSON serialization."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def _score_to_grade(score: float) -> str:
    if score >= 85:
        return "A"
    elif score >= 70:
        return "B"
    elif score >= 55:
        return "C"
    elif score >= 40:
        return "D"
    else:
        return "F"
