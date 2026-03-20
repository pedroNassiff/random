"""
Scientific validation tests for Muse 2 EEG sessions.

Each test returns a dict with:
  - test: name of the test
  - passed: bool
  - quality: 'excellent' | 'good' | 'marginal' | 'failed'
  - metrics: dict with computed values
  - reference: literature citation

Usage:
    from recording.validation import run_all_tests
    
    results = run_all_tests(session_windows, markers)
    # session_windows: list of dicts with 'bands', 'coherence', 'phase', etc.
    # markers: list of dicts with 'label', 'timestamp'
"""

import numpy as np
from typing import Dict, List, Optional


def _extract_phase_windows(
    windows: List[Dict],
    markers: List[Dict],
    phase_name: str,
) -> List[Dict]:
    """
    Extrae las ventanas de datos que caen dentro de una fase del protocolo.
    
    Busca marcadores '{phase_name}_start' y '{phase_name}_end' para delimitar.
    Si no encuentra end, usa todas las ventanas después de start.
    
    Fallback: si no hay marcadores, busca windows con campo 'phase' == phase_name.
    """
    start_ts = None
    end_ts = None
    
    for m in markers:
        label = m.get('label', '')
        if label == f"{phase_name}_start":
            start_ts = m.get('timestamp', 0)
        elif label == f"{phase_name}_end":
            end_ts = m.get('timestamp', float('inf'))
    
    if start_ts is not None:
        return [
            w for w in windows
            if start_ts <= w.get('timestamp', 0) <= (end_ts or float('inf'))
        ]
    
    # Fallback: use 'phase' field on windows
    return [w for w in windows if w.get('phase') == phase_name]


def validate_berger_effect(
    windows: List[Dict],
    markers: List[Dict],
) -> Dict:
    """
    Berger Effect Test — the most fundamental EEG validation.
    
    Alpha power must increase when eyes are closed vs open.
    This validates that the Muse 2 is correctly measuring cortical alpha.
    
    Expected ratio with Muse 2: 1.3-3.0x for meditators.
    Minimum acceptable: 1.1x.
    
    Reference: Cannard et al. (2021) — Validated Muse for spectral analysis
               and frontal alpha asymmetry. IEEE BIBM.
    """
    open_windows = _extract_phase_windows(windows, markers, "baseline_open")
    closed_windows = _extract_phase_windows(windows, markers, "baseline_closed")
    
    if not open_windows or not closed_windows:
        return {
            "test": "berger_effect",
            "passed": False,
            "quality": "failed",
            "metrics": {},
            "error": "Missing baseline_open or baseline_closed phases",
            "reference": "Cannard et al. 2021",
        }
    
    # Skip first 10% (warmup artefacts from phase transition)
    skip_open = max(1, len(open_windows) // 10)
    skip_closed = max(1, len(closed_windows) // 10)
    open_windows = open_windows[skip_open:]
    closed_windows = closed_windows[skip_closed:]
    
    alpha_open_vals = [w.get('bands', {}).get('alpha', 0) for w in open_windows]
    alpha_closed_vals = [w.get('bands', {}).get('alpha', 0) for w in closed_windows]
    
    alpha_open = np.mean(alpha_open_vals) if alpha_open_vals else 0
    alpha_closed = np.mean(alpha_closed_vals) if alpha_closed_vals else 0
    
    ratio = alpha_closed / (alpha_open + 1e-8)
    
    if ratio > 2.0:
        quality = "excellent"
    elif ratio > 1.5:
        quality = "good"
    elif ratio > 1.1:
        quality = "marginal"
    else:
        quality = "failed"
    
    return {
        "test": "berger_effect",
        "passed": ratio > 1.1,
        "quality": quality,
        "metrics": {
            "alpha_open": round(float(alpha_open), 4),
            "alpha_closed": round(float(alpha_closed), 4),
            "ratio": round(float(ratio), 3),
            "open_samples": len(alpha_open_vals),
            "closed_samples": len(alpha_closed_vals),
        },
        "thresholds": {
            "excellent": "> 2.0x",
            "good": "> 1.5x",
            "marginal": "> 1.1x",
        },
        "reference": "Cannard et al. 2021 — Muse validated for spectral analysis",
    }


def validate_cognitive_reactivity(
    windows: List[Dict],
    markers: List[Dict],
) -> Dict:
    """
    Cognitive Reactivity Test — beta/gamma must increase during mental task.
    
    Compares beta and gamma power during 'cognitive_task' phase vs 
    'baseline_closed' (resting state).
    
    Expected: beta ratio > 1.2, gamma ratio > 1.1
    """
    rest_windows = _extract_phase_windows(windows, markers, "baseline_closed")
    task_windows = _extract_phase_windows(windows, markers, "cognitive_task")
    
    if not rest_windows or not task_windows:
        return {
            "test": "cognitive_reactivity",
            "passed": False,
            "quality": "failed",
            "metrics": {},
            "error": "Missing baseline_closed or cognitive_task phases",
        }
    
    beta_rest = np.mean([w.get('bands', {}).get('beta', 0) for w in rest_windows])
    beta_task = np.mean([w.get('bands', {}).get('beta', 0) for w in task_windows])
    gamma_rest = np.mean([w.get('bands', {}).get('gamma', 0) for w in rest_windows])
    gamma_task = np.mean([w.get('bands', {}).get('gamma', 0) for w in task_windows])
    
    beta_ratio = beta_task / (beta_rest + 1e-8)
    gamma_ratio = gamma_task / (gamma_rest + 1e-8)
    
    passed = beta_ratio > 1.2
    
    if beta_ratio > 1.8 and gamma_ratio > 1.3:
        quality = "excellent"
    elif beta_ratio > 1.4:
        quality = "good"
    elif beta_ratio > 1.2:
        quality = "marginal"
    else:
        quality = "failed"
    
    return {
        "test": "cognitive_reactivity",
        "passed": passed,
        "quality": quality,
        "metrics": {
            "beta_rest": round(float(beta_rest), 4),
            "beta_task": round(float(beta_task), 4),
            "beta_ratio": round(float(beta_ratio), 3),
            "gamma_rest": round(float(gamma_rest), 4),
            "gamma_task": round(float(gamma_task), 4),
            "gamma_ratio": round(float(gamma_ratio), 3),
        },
        "thresholds": {
            "beta_min_ratio": 1.2,
            "gamma_min_ratio": 1.1,
        },
    }


def validate_coherence_stability(
    windows: List[Dict],
    markers: Optional[List[Dict]] = None,
) -> Dict:
    """
    Coherence Stability Test — verifies PLV is not random noise.
    
    Real neural coherence changes gradually (high autocorrelation).
    Random noise has autocorrelation ~0.
    
    Test: autocorrelation of coherence time series at lag=1.
    Threshold: > 0.5 for real signal, > 0.7 for excellent.
    """
    coherence_series = [w.get('coherence', 0) for w in windows if w.get('coherence') is not None]
    
    if len(coherence_series) < 10:
        return {
            "test": "coherence_stability",
            "passed": False,
            "quality": "failed",
            "metrics": {},
            "error": f"Too few samples ({len(coherence_series)}), need >= 10",
        }
    
    # Remove NaN/Inf
    coherence_series = [c for c in coherence_series if np.isfinite(c)]
    
    if len(coherence_series) < 10:
        return {
            "test": "coherence_stability",
            "passed": False,
            "quality": "failed",
            "metrics": {},
            "error": "Too many NaN/Inf values in coherence series",
        }
    
    arr = np.array(coherence_series)
    
    # Lag-1 autocorrelation
    autocorr = np.corrcoef(arr[:-1], arr[1:])[0, 1]
    
    # Mean and std of coherence
    mean_coh = np.mean(arr)
    std_coh = np.std(arr)
    
    # Coefficient of variation (lower = more stable)
    cv = std_coh / (mean_coh + 1e-8)
    
    if autocorr > 0.7:
        quality = "excellent"
    elif autocorr > 0.5:
        quality = "good"
    elif autocorr > 0.3:
        quality = "marginal"
    else:
        quality = "failed"
    
    return {
        "test": "coherence_stability",
        "passed": autocorr > 0.5,
        "quality": quality,
        "metrics": {
            "autocorrelation_lag1": round(float(autocorr), 4),
            "mean_coherence": round(float(mean_coh), 4),
            "std_coherence": round(float(std_coh), 4),
            "coefficient_of_variation": round(float(cv), 4),
            "n_samples": len(coherence_series),
        },
        "interpretation": {
            "> 0.7": "Real neural coherence, excellent signal",
            "0.5-0.7": "Acceptable, likely real signal",
            "0.3-0.5": "Marginal, may contain noise",
            "< 0.3": "Likely noise, check electrode contact",
        },
    }


def _sanitize(obj):
    """
    Recursively convert numpy types to native Python types
    so FastAPI's jsonable_encoder can serialize them.
    """
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


def run_all_tests(
    windows: List[Dict],
    markers: List[Dict],
) -> Dict:
    """
    Run all validation tests on a recorded session.
    
    Args:
        windows: List of brainState dicts from the session.
                 Each must have: 'bands' (dict), 'coherence' (float),
                 'timestamp' (float), optionally 'phase' (str).
        markers: List of marker dicts with 'label' and 'timestamp'.
    
    Returns:
        Dict with individual test results + overall assessment.
    """
    berger = validate_berger_effect(windows, markers)
    cognitive = validate_cognitive_reactivity(windows, markers)
    coherence = validate_coherence_stability(windows, markers)
    
    tests = [berger, cognitive, coherence]
    passed_count = sum(1 for t in tests if t['passed'])
    
    # Overall assessment
    if passed_count == 3:
        overall = "excellent" if all(t['quality'] in ('excellent', 'good') for t in tests) else "good"
    elif passed_count == 2:
        overall = "acceptable"
    elif passed_count == 1:
        overall = "marginal"
    else:
        overall = "failed"
    
    return _sanitize({
        "tests": {
            "berger_effect": berger,
            "cognitive_reactivity": cognitive,
            "coherence_stability": coherence,
        },
        "summary": {
            "passed": passed_count,
            "total": len(tests),
            "overall": overall,
            "usable_for_training": passed_count >= 2,
        },
    })
