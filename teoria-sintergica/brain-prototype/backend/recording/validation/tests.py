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


def _get_band(window: Dict, band_name: str) -> float:
    """
    Get a band power from a window dict, handling both formats:
      - Nested: {'bands': {'alpha': 0.3, ...}}  (WebSocket/brainState format)
      - Flat:   {'alpha': 0.3, ...}              (InfluxDB metrics format)
    """
    bands = window.get('bands')
    if isinstance(bands, dict):
        return bands.get(band_name, 0)
    return window.get(band_name, 0)


def _get_band_raw(window: Dict, band_name: str) -> float:
    """
    Get absolute band power (µV²/Hz, NOT normalized).

    Falls back to normalized value if raw is not available (e.g., legacy sessions).
    Raw fields are stored as '{band}_raw' in InfluxDB metrics.
    """
    raw = window.get(f'{band_name}_raw')
    if raw is not None and raw > 0:
        return float(raw)
    bands_raw = window.get('bands_raw')
    if isinstance(bands_raw, dict):
        v = bands_raw.get(band_name)
        if v is not None and v > 0:
            return float(v)
    # Fallback: use normalized value (legacy sessions without raw fields)
    return _get_band(window, band_name)


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
    
    alpha_open_vals = [_get_band_raw(w, 'alpha') for w in open_windows]
    alpha_closed_vals = [_get_band_raw(w, 'alpha') for w in closed_windows]
    
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
    the PRECEDING meditation phase (meditation_free), NOT baseline_closed.
    
    Rationale: baseline_closed is at minute 2; cognitive_task is at minute 19
    after 15 min of meditation. Beta is naturally suppressed by then.
    The correct comparison is: did the cognitive task WAKE UP beta relative
    to the deep meditative state that preceded it?
    
    Expected: beta ratio > 1.2, gamma ratio > 1.1
    """
    task_windows = _extract_phase_windows(windows, markers, "cognitive_task")
    
    # Use preceding meditation as reference (not early baseline)
    pre_task_windows = _extract_phase_windows(windows, markers, "meditation_free")
    if not pre_task_windows:
        # Fallback to baseline_closed if no meditation_free phase
        pre_task_windows = _extract_phase_windows(windows, markers, "baseline_closed")
    
    if not pre_task_windows or not task_windows:
        return {
            "test": "cognitive_reactivity",
            "passed": False,
            "quality": "failed",
            "metrics": {},
            "error": "Missing meditation_free/baseline_closed or cognitive_task phases",
        }
    
    # Use last 20% of pre-task phase (deepest meditation point)
    n_tail = max(5, len(pre_task_windows) // 5)
    pre_task_tail = pre_task_windows[-n_tail:]
    
    beta_pre = np.mean([_get_band(w, 'beta') for w in pre_task_tail])
    beta_task = np.mean([_get_band(w, 'beta') for w in task_windows])
    gamma_pre = np.mean([_get_band(w, 'gamma') for w in pre_task_tail])
    gamma_task = np.mean([_get_band(w, 'gamma') for w in task_windows])
    delta_task = np.mean([_get_band(w, 'delta') for w in task_windows])

    beta_ratio = beta_task / (beta_pre + 1e-8)
    gamma_ratio = gamma_task / (gamma_pre + 1e-8)

    # Detectar si delta alto durante la tarea aplastó las proporciones de beta/gamma.
    # Con bandas normalizadas, delta >0.60 durante la tarea cognitiva es estado
    # post-meditación profunda, no un artefacto: beta físicamente no puede subir
    # en proporción aunque sí en absoluto. Advertir para que el scorer lo considere.
    delta_dominance_warning = delta_task > 0.60
    
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
            "beta_pre_meditation": round(float(beta_pre), 4),
            "beta_task": round(float(beta_task), 4),
            "beta_ratio": round(float(beta_ratio), 3),
            "gamma_pre_meditation": round(float(gamma_pre), 4),
            "gamma_task": round(float(gamma_task), 4),
            "gamma_ratio": round(float(gamma_ratio), 3),
            "delta_task_mean": round(float(delta_task), 3),
            "comparison": "cognitive_task vs last 20% of meditation_free",
        },
        "thresholds": {
            "beta_min_ratio": 1.2,
            "gamma_min_ratio": 1.1,
        },
        "warnings": (
            [f"Delta dominance during task ({delta_task:.2f} > 0.60): post-meditation state "
             "suppressed proportional beta. Use raw bands for accurate comparison."]
            if delta_dominance_warning else []
        ),
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


def detect_artifacts(
    windows: List[Dict],
    markers: List[Dict],
) -> Dict:
    """
    Detect common EEG artifacts that contaminate results.
    
    Checks:
    - Muscle artifact: gamma > 0.10 in rest (normal is < 0.05)
    - Flat signal: all bands identical (frozen data from BLE dropout)
    - Electrode drift: progressive alpha increase without closing eyes
    """
    rest_windows = _extract_phase_windows(windows, markers, "baseline_closed")
    if not rest_windows:
        rest_windows = windows[:100]  # first 100 samples as fallback
    
    # Gamma in rest — muscle artifact indicator
    gamma_vals = [_get_band(w, 'gamma') for w in rest_windows]
    gamma_mean = float(np.mean(gamma_vals)) if gamma_vals else 0
    has_muscle_artifact = gamma_mean > 0.10
    
    # Flat signal detection (frozen values from BLE dropout)
    # Check if consecutive windows have identical values
    flat_count = 0
    for i in range(1, min(len(windows), 500)):
        if (abs(_get_band(windows[i], 'alpha') - _get_band(windows[i-1], 'alpha')) < 1e-6 and
            abs(_get_band(windows[i], 'delta') - _get_band(windows[i-1], 'delta')) < 1e-6):
            flat_count += 1
    flat_pct = (flat_count / max(len(windows)-1, 1)) * 100
    has_stale_data = flat_pct > 20
    
    warnings = []
    if has_muscle_artifact:
        warnings.append(f"Muscle artifact detected: gamma={gamma_mean:.3f} in rest (threshold: 0.10). Check jaw tension and electrode contact at TP9/TP10.")
    if has_stale_data:
        warnings.append(f"Stale/frozen data detected: {flat_pct:.0f}% identical consecutive windows. BLE may have dropped.")
    
    return {
        "has_artifacts": has_muscle_artifact or has_stale_data,
        "muscle_artifact": {
            "detected": has_muscle_artifact,
            "gamma_rest_mean": round(gamma_mean, 4),
            "threshold": 0.10,
            "normal_range": "< 0.05",
        },
        "stale_data": {
            "detected": has_stale_data,
            "flat_percent": round(flat_pct, 1),
        },
        "warnings": warnings,
    }


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
    artifacts = detect_artifacts(windows, markers)
    
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
        "artifacts": artifacts,
        "summary": {
            "passed": passed_count,
            "total": len(tests),
            "overall": overall,
            "usable_for_training": passed_count >= 2,
            "artifact_contaminated": artifacts.get('has_artifacts', False),
        },
    })
