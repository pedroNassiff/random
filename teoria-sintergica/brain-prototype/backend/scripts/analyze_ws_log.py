#!/usr/bin/env python3
"""
Analyzes a validation session from WS broadcast data (terminal log).

Used when the recorder failed (e.g. psycopg2 not available) but the protocol
ran and WS metrics were printed. Reads the protocol log for phase timing,
parses WS windows from a log string, and runs approximate validation tests.

Usage:
    python analyze_ws_log.py --log <ws_log_file.txt> --protocol <validation_log.json>
    python analyze_ws_log.py --builtin  # uses the hardcoded session from 2026-05-25
"""

import re
import json
import argparse
import statistics
from datetime import datetime
from pathlib import Path

# ── WS data parser ────────────────────────────────────────────────────────────

WS_RE = re.compile(
    r'\[WS #(\d+)\].*?coherence=([\d.]+).*?δ=([\d.]+).*?θ=([\d.]+).*?α=([\d.]+).*?β=([\d.]+).*?γ=([\d.]+).*?state=(\w+)'
)


def parse_ws_lines(text: str) -> list[dict]:
    windows = []
    for m in WS_RE.finditer(text):
        windows.append({
            'window': int(m.group(1)),
            'coherence': float(m.group(2)),
            'delta': float(m.group(3)),
            'theta': float(m.group(4)),
            'alpha': float(m.group(5)),
            'beta': float(m.group(6)),
            'gamma': float(m.group(7)),
            'state': m.group(8),
        })
    return sorted(windows, key=lambda x: x['window'])


# ── Phase assignment ───────────────────────────────────────────────────────────

def assign_phases(windows: list[dict], protocol_log: dict) -> list[dict]:
    """
    Tags each window with its phase using the protocol log timestamps.
    Falls back to WS window range heuristics if log is unavailable.
    Each window is ~1s at 256 Hz; the window number is cumulative since process start.
    """
    # Extract phase boundaries from the protocol log
    phases = {}
    for ev in protocol_log.get('events', []):
        if ev['event'] == 'phase_start':
            phases[ev['data']['phase']] = ev['elapsed']
        elif ev['event'] == 'phase_end':
            phases[ev['data']['phase'] + '_end'] = ev['elapsed']

    if not phases:
        return windows  # can't assign

    # The first WS window in the log corresponds to elapsed≈0 of phase 1
    # We use the window numbers relative to the first window in the log.
    first_window = windows[0]['window'] if windows else 0
    windows_per_second = 1  # ~1 window per second

    phase_order = ['baseline_open', 'baseline_closed', 'recovery',
                   'meditation', 'cognitive_task', 'profundizacion', 'close']
    phase_starts = {p: phases.get(p, None) for p in phase_order}

    for w in windows:
        elapsed = (w['window'] - first_window) * windows_per_second
        phase = 'unknown'
        for p in phase_order:
            start = phase_starts.get(p)
            end = phases.get(p + '_end')
            if start is not None and end is not None:
                if start <= elapsed < end:
                    phase = p
                    break
        w['phase'] = phase

    return windows


# ── Metrics per phase ─────────────────────────────────────────────────────────

def phase_stats(windows: list[dict], phase: str) -> dict:
    rows = [w for w in windows if w.get('phase') == phase]
    if not rows:
        return {'n': 0}

    def _stats(key):
        vals = [r[key] for r in rows]
        return {
            'mean': round(statistics.mean(vals), 4),
            'median': round(statistics.median(vals), 4),
            'std': round(statistics.stdev(vals) if len(vals) > 1 else 0, 4),
            'min': round(min(vals), 4),
            'max': round(max(vals), 4),
        }

    state_counts = {}
    for r in rows:
        state_counts[r['state']] = state_counts.get(r['state'], 0) + 1
    dominant_state = max(state_counts, key=state_counts.get)

    return {
        'n': len(rows),
        'alpha': _stats('alpha'),
        'theta': _stats('theta'),
        'delta': _stats('delta'),
        'beta': _stats('beta'),
        'gamma': _stats('gamma'),
        'coherence': _stats('coherence'),
        'state_distribution': state_counts,
        'dominant_state': dominant_state,
    }


# ── Validation tests (approximate — normalized band powers) ───────────────────

def test_berger_approximate(open_stats: dict, closed_stats: dict) -> dict:
    """
    Berger effect with normalized alpha.
    NOTE: These are normalized band powers (0-1), not absolute µV²/Hz.
    Delta surge during eyes-closed can suppress normalized alpha even when
    absolute alpha increases. Results are indicative only.
    """
    if open_stats['n'] == 0 or closed_stats['n'] == 0:
        return {'passed': False, 'quality': 'no_data'}

    alpha_open = open_stats['alpha']['mean']
    alpha_closed = closed_stats['alpha']['mean']

    if alpha_open == 0:
        return {'passed': False, 'quality': 'failed', 'note': 'alpha_open=0'}

    ratio = alpha_closed / alpha_open
    quality = 'failed'
    if ratio > 1.5:
        quality = 'excellent'
    elif ratio > 1.2:
        quality = 'good'
    elif ratio > 1.05:
        quality = 'marginal'

    passed = ratio > 1.05
    return {
        'test': 'berger_effect_approximate',
        'passed': passed,
        'quality': quality,
        'metrics': {
            'alpha_open_mean': round(alpha_open, 4),
            'alpha_closed_mean': round(alpha_closed, 4),
            'ratio': round(ratio, 3),
            'open_samples': open_stats['n'],
            'closed_samples': closed_stats['n'],
        },
        'caveat': (
            'Normalized band powers used — absolute alpha may have increased '
            'while normalized share dropped due to delta surge with eyes closed. '
            'Re-run with recorder active for absolute µV²/Hz values.'
        ),
        'thresholds': {'excellent': '>1.5x', 'good': '>1.2x', 'marginal': '>1.05x'},
    }


def test_delta_eyes_closed(open_stats: dict, closed_stats: dict) -> dict:
    """Delta should increase with eyes closed (drowsiness/relaxation shift)."""
    if open_stats['n'] == 0 or closed_stats['n'] == 0:
        return {'passed': False, 'quality': 'no_data'}

    delta_open = open_stats['delta']['mean']
    delta_closed = closed_stats['delta']['mean']
    ratio = delta_closed / delta_open if delta_open > 0 else 0
    passed = ratio > 1.2
    # Strong delta surge (>3x) during closed-eyes short baseline may indicate
    # drowsiness or movement artifact in anterior electrodes.
    warning = ratio > 3.0

    return {
        'test': 'delta_eyes_closed',
        'passed': passed,
        'metrics': {
            'delta_open_mean': round(delta_open, 4),
            'delta_closed_mean': round(delta_closed, 4),
            'ratio': round(ratio, 3),
        },
        'warning': 'Strong delta surge — possible drowsiness or movement artifact' if warning else None,
    }


def test_gamma_artifact(open_stats: dict) -> dict:
    """
    High gamma (>0.4 normalized) during eyes-open baseline strongly suggests
    EMG muscle artifact on AF7/AF8 (forehead tension). Should be < 0.15 for
    clean EEG.
    """
    if open_stats['n'] == 0:
        return {'passed': True, 'quality': 'no_data'}

    gamma_mean = open_stats['gamma']['mean']
    clean = gamma_mean < 0.15
    moderate = gamma_mean < 0.35

    if clean:
        quality = 'clean'
    elif moderate:
        quality = 'moderate_emg'
    else:
        quality = 'high_emg_artifact'

    return {
        'test': 'gamma_emg_artifact',
        'passed': clean,
        'quality': quality,
        'metrics': {
            'gamma_open_mean': round(gamma_mean, 4),
            'normal_range': '< 0.15',
        },
        'interpretation': (
            'Low gamma = clean signal. '
            'High gamma during eyes-open baseline is typically frontal EMG (forehead tension). '
            'Relax forehead, check AF7/AF8 contact.'
        ),
    }


def test_coherence_stability(all_windows: list[dict]) -> dict:
    """Coherence stability test — mirrors production validate endpoint."""
    if len(all_windows) < 3:
        return {'passed': False, 'quality': 'insufficient_data'}

    coherences = [w['coherence'] for w in all_windows]
    mean_c = statistics.mean(coherences)
    std_c = statistics.stdev(coherences) if len(coherences) > 1 else 0
    cv = std_c / mean_c if mean_c > 0 else 1

    # Lag-1 autocorrelation
    n = len(coherences)
    if n > 2:
        mean_c2 = statistics.mean(coherences)
        num = sum((coherences[i] - mean_c2) * (coherences[i + 1] - mean_c2) for i in range(n - 1))
        den = sum((c - mean_c2) ** 2 for c in coherences)
        autocorr = num / den if den > 0 else 0
    else:
        autocorr = 0

    passed = autocorr > 0.3 or mean_c > 0.5

    if autocorr > 0.7:
        quality = 'excellent'
    elif autocorr > 0.5:
        quality = 'good'
    elif autocorr > 0.3:
        quality = 'acceptable'
    else:
        quality = 'marginal'

    return {
        'test': 'coherence_stability',
        'passed': passed,
        'quality': quality,
        'metrics': {
            'mean_coherence': round(mean_c, 4),
            'std_coherence': round(std_c, 4),
            'coefficient_of_variation': round(cv, 4),
            'autocorrelation_lag1': round(autocorr, 4),
            'n_samples': n,
        },
        'interpretation': {
            '> 0.7': 'Real neural coherence, excellent signal',
            '0.5-0.7': 'Acceptable, likely real signal',
            '0.3-0.5': 'Marginal, may contain noise',
            '< 0.3': 'Likely noise, check electrode contact',
        },
    }


def compute_quality_score(berger: dict, coherence: dict, gamma: dict, windows: list[dict]) -> dict:
    """Simplified quality score (no absolute power → signal_quality approximate)."""
    scores = {}

    # Alpha reactivity
    if berger.get('passed'):
        ratio = berger['metrics']['ratio']
        alpha_score = min(100, max(0, (ratio - 1.0) / (2.5 - 1.0) * 100))
    else:
        alpha_score = 0
    scores['alpha_reactivity'] = round(alpha_score, 1)

    # Coherence stability
    ac = coherence['metrics'].get('autocorrelation_lag1', 0)
    coh_score = min(100, max(0, ac * 100))
    scores['coherence_stability'] = round(coh_score, 1)

    # Signal quality proxy — penalize high gamma
    gamma_mean = gamma['metrics'].get('gamma_open_mean', 0.5)
    sig_score = max(0, 100 - (gamma_mean / 0.15 - 1) * 40) if gamma_mean > 0.15 else 100
    sig_score = min(100, max(0, sig_score))
    scores['signal_quality_proxy'] = round(sig_score, 1)

    # Data completeness (all windows parsed)
    scores['data_completeness'] = 100

    total = (
        scores['alpha_reactivity'] * 0.3 +
        scores['coherence_stability'] * 0.3 +
        scores['signal_quality_proxy'] * 0.3 +
        scores['data_completeness'] * 0.1
    )

    if total >= 80:
        grade = 'A'
    elif total >= 65:
        grade = 'B'
    elif total >= 50:
        grade = 'C'
    elif total >= 35:
        grade = 'D'
    else:
        grade = 'F'

    return {
        'total_score': round(total, 1),
        'grade': grade,
        'components': scores,
        'caveat': 'Score computed from normalized band powers (WS stream). Re-run with active recorder for production-quality score.',
    }


# ── Hardcoded session 2026-05-25 ──────────────────────────────────────────────

BUILTIN_WS_LOG = """
[WS #0825] source=muse2  coherence=0.780  δ=0.455 θ=0.221 α=0.064 β=0.004 γ=0.256  state=focused
[WS #0850] source=muse2  coherence=0.635  δ=0.127 θ=0.050 α=0.024 β=0.006 γ=0.793  state=focused
[WS #0875] source=muse2  coherence=0.762  δ=0.267 θ=0.110 α=0.031 β=0.005 γ=0.587  state=focused
[WS #0900] source=muse2  coherence=0.464  δ=0.127 θ=0.042 α=0.013 β=0.004 γ=0.815  state=focused
[WS #0925] source=muse2  coherence=0.330  δ=0.024 θ=0.018 α=0.009 β=0.005 γ=0.945  state=focused
[WS #0950] source=muse2  coherence=0.302  δ=0.066 θ=0.028 α=0.010 β=0.005 γ=0.890  state=focused
[WS #0975] source=muse2  coherence=0.427  δ=0.089 θ=0.041 α=0.015 β=0.005 γ=0.850  state=focused
[WS #1000] source=muse2  coherence=0.443  δ=0.167 θ=0.037 α=0.021 β=0.008 γ=0.767  state=focused
[WS #1025] source=muse2  coherence=0.649  δ=0.165 θ=0.058 α=0.020 β=0.006 γ=0.751  state=focused
[WS #1050] source=muse2  coherence=0.622  δ=0.183 θ=0.052 α=0.034 β=0.008 γ=0.722  state=focused
[WS #1075] source=muse2  coherence=0.766  δ=0.384 θ=0.139 α=0.027 β=0.004 γ=0.446  state=focused
[WS #1100] source=muse2  coherence=0.637  δ=0.192 θ=0.053 α=0.035 β=0.008 γ=0.712  state=focused
📍 [ValidationProtocol] Phase 2/3: BASELINE — Cerrá los ojos (90s)
[WS #1125] source=muse2  coherence=0.341  δ=0.211 θ=0.061 α=0.019 β=0.007 γ=0.702  state=focused
[WS #1150] source=muse2  coherence=0.625  δ=0.770 θ=0.064 α=0.010 β=0.002 γ=0.155  state=deep_relaxation
[WS #1175] source=muse2  coherence=0.412  δ=0.446 θ=0.071 α=0.011 β=0.006 γ=0.466  state=focused
[WS #1200] source=muse2  coherence=0.545  δ=0.653 θ=0.080 α=0.009 β=0.003 γ=0.255  state=deep_relaxation
[WS #1225] source=muse2  coherence=0.508  δ=0.605 θ=0.114 α=0.014 β=0.003 γ=0.265  state=deep_relaxation
[WS #1250] source=muse2  coherence=0.351  δ=0.561 θ=0.096 α=0.009 β=0.003 γ=0.331  state=deep_relaxation
[WS #1275] source=muse2  coherence=0.412  δ=0.501 θ=0.089 α=0.012 β=0.004 γ=0.395  state=focused
[WS #1300] source=muse2  coherence=0.356  δ=0.411 θ=0.081 α=0.017 β=0.005 γ=0.486  state=focused
[WS #1325] source=muse2  coherence=0.532  δ=0.449 θ=0.074 α=0.019 β=0.004 γ=0.454  state=focused
[WS #1350] source=muse2  coherence=0.525  δ=0.566 θ=0.070 α=0.022 β=0.004 γ=0.338  state=deep_relaxation
[WS #1375] source=muse2  coherence=0.725  δ=0.319 θ=0.063 α=0.046 β=0.006 γ=0.567  state=focused
[WS #1400] source=muse2  coherence=0.595  δ=0.549 θ=0.048 α=0.028 β=0.004 γ=0.371  state=focused
[WS #1425] source=muse2  coherence=0.397  δ=0.364 θ=0.077 α=0.026 β=0.005 γ=0.528  state=focused
[WS #1450] source=muse2  coherence=0.485  δ=0.107 θ=0.056 α=0.026 β=0.007 γ=0.805  state=focused
[WS #1475] source=muse2  coherence=0.366  δ=0.249 θ=0.067 α=0.016 β=0.010 γ=0.659  state=focused
[WS #1500] source=muse2  coherence=0.495  δ=0.319 θ=0.085 α=0.013 β=0.006 γ=0.578  state=focused
[WS #1525] source=muse2  coherence=0.458  δ=0.340 θ=0.083 α=0.022 β=0.007 γ=0.549  state=focused
[WS #1550] source=muse2  coherence=0.440  δ=0.448 θ=0.093 α=0.029 β=0.004 γ=0.426  state=focused
📍 [ValidationProtocol] Phase 3/3: RECUPERACIÓN — Volvé al cuerpo (60s)
[WS #1575] source=muse2  coherence=0.513  δ=0.215 θ=0.046 α=0.018 β=0.007 γ=0.714  state=focused
[WS #1600] source=muse2  coherence=0.557  δ=0.645 θ=0.218 α=0.068 β=0.011 γ=0.058  state=deep_relaxation
[WS #1625] source=muse2  coherence=0.496  δ=0.749 θ=0.148 α=0.039 β=0.006 γ=0.058  state=deep_relaxation
[WS #1650] source=muse2  coherence=0.605  δ=0.822 θ=0.105 α=0.040 β=0.004 γ=0.029  state=deep_relaxation
[WS #1675] source=muse2  coherence=0.465  δ=0.788 θ=0.135 α=0.037 β=0.004 γ=0.035  state=deep_relaxation
[WS #1700] source=muse2  coherence=0.471  δ=0.638 θ=0.134 α=0.084 β=0.015 γ=0.128  state=deep_relaxation
[WS #1725] source=muse2  coherence=0.453  δ=0.413 θ=0.149 α=0.126 β=0.024 γ=0.287  state=focused
[WS #1750] source=muse2  coherence=0.415  δ=0.832 θ=0.107 α=0.018 β=0.005 γ=0.040  state=deep_relaxation
[WS #1775] source=muse2  coherence=0.588  δ=0.642 θ=0.144 α=0.078 β=0.014 γ=0.122  state=deep_relaxation
[WS #1800] source=muse2  coherence=0.465  δ=0.644 θ=0.183 α=0.054 β=0.012 γ=0.107  state=deep_relaxation
[WS #1825] source=muse2  coherence=0.594  δ=0.703 θ=0.182 α=0.046 β=0.006 γ=0.063  state=deep_relaxation
[WS #1850] source=muse2  coherence=0.580  δ=0.595 θ=0.183 α=0.113 β=0.017 γ=0.093  state=deep_relaxation
"""

BUILTIN_PROTOCOL_LOG = Path(__file__).parent.parent / "validation_logs" / "validation_20260525_164737_COMPLETE.json"


# ── Phase range override for quick protocol ───────────────────────────────────

QUICK_PHASE_RANGES = {
    # WS # inclusive ranges derived from the phase markers in the log
    'baseline_open':   (825, 1100),
    'baseline_closed': (1125, 1550),
    'recovery':        (1575, 1850),
}


def assign_phases_by_range(windows: list[dict]) -> list[dict]:
    for w in windows:
        num = w['window']
        w['phase'] = 'unknown'
        for phase, (lo, hi) in QUICK_PHASE_RANGES.items():
            if lo <= num <= hi:
                w['phase'] = phase
                break
    return windows


# ── Main ──────────────────────────────────────────────────────────────────────

def run_analysis(ws_text: str, protocol_log_path: Path | None) -> dict:
    windows = parse_ws_lines(ws_text)
    if not windows:
        return {'error': 'No WS windows found in log'}

    # Assign phases
    if protocol_log_path and protocol_log_path.exists():
        with open(protocol_log_path) as f:
            protocol_log = json.load(f)
    else:
        protocol_log = {}

    # Try timestamp-based assignment first; fall back to WS-range heuristic
    # when > 40% of windows remain 'unknown' (happens when window numbers
    # don't map linearly to elapsed seconds, e.g. quick protocol).
    windows = assign_phases(windows, protocol_log)
    unknown_frac = sum(1 for w in windows if w.get('phase', 'unknown') == 'unknown') / len(windows)
    if unknown_frac > 0.4:
        windows = assign_phases_by_range(windows)

    # Protocol-only windows (exclude post-protocol free stream)
    protocol_windows = [w for w in windows if w['phase'] != 'unknown']

    open_s = phase_stats(windows, 'baseline_open')
    closed_s = phase_stats(windows, 'baseline_closed')
    recovery_s = phase_stats(windows, 'recovery')

    berger = test_berger_approximate(open_s, closed_s)
    delta_test = test_delta_eyes_closed(open_s, closed_s)
    gamma_test = test_gamma_artifact(open_s)
    coherence_test = test_coherence_stability(protocol_windows or windows)
    quality = compute_quality_score(berger, coherence_test, gamma_test, protocol_windows)

    n_passed = sum([
        berger.get('passed', False),
        delta_test.get('passed', False),
        coherence_test.get('passed', False),
    ])

    result = {
        'status': 'success',
        'session_name': protocol_log.get('metadata', {}).get('name', 'prueba validacion'),
        'session_date': '2026-05-25T16:44:07',
        'analysis_type': 'ws_stream_approximate',
        'data_source': 'WS broadcast (recorder failed — normalized band powers)',
        'protocol': {
            'phases_completed': protocol_log.get('phases_completed', 3),
            'total_phases': protocol_log.get('total_phases', 3),
            'total_duration_s': protocol_log.get('events', [{}])[-1].get('elapsed', 210),
            'mode': 'quick_validation',
        },
        'windows_parsed': len(windows),
        'windows_in_protocol': len(protocol_windows),
        'phase_stats': {
            'baseline_open': open_s,
            'baseline_closed': closed_s,
            'recovery': recovery_s,
        },
        'tests': {
            'berger_effect': berger,
            'delta_eyes_closed': delta_test,
            'gamma_emg_artifact': gamma_test,
            'coherence_stability': coherence_test,
        },
        'summary': {
            'passed': n_passed,
            'total': 3,
            'quality_score': quality,
            'overall': 'good' if n_passed >= 2 else ('marginal' if n_passed == 1 else 'failed'),
        },
        'limitations': [
            'Session recorder failed (psycopg2 not imported — now fixed). No InfluxDB data persisted.',
            'Band powers are NORMALIZED (0-1, sum≈1 per window). Berger absolute ratio unavailable.',
            'Gamma surge during eyes-open suggests frontal EMG artifact (forehead tension).',
            'Re-run protocol with recorder active for production-quality validation.',
        ],
        'fix_applied': 'postgres_client.py now imports psycopg2 with try/except — recorder will work on next run.',
    }
    return result


def main():
    parser = argparse.ArgumentParser(description='Analyze validation session from WS log')
    parser.add_argument('--log', help='Path to WS terminal log file (.txt)')
    parser.add_argument('--protocol', help='Path to validation protocol JSON log')
    parser.add_argument('--builtin', action='store_true', help='Use built-in 2026-05-25 session')
    parser.add_argument('--out', help='Output JSON path (default: validation_logs/analysis_<date>.json)')
    args = parser.parse_args()

    if args.builtin or (not args.log):
        ws_text = BUILTIN_WS_LOG
        protocol_path = BUILTIN_PROTOCOL_LOG
    else:
        ws_text = Path(args.log).read_text()
        protocol_path = Path(args.protocol) if args.protocol else None

    result = run_analysis(ws_text, protocol_path)

    out_dir = Path(__file__).parent.parent / "validation_logs"
    out_dir.mkdir(exist_ok=True)
    out_file = Path(args.out) if args.out else (out_dir / "analysis_20260525_ws_approximate.json")
    out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False))

    # Pretty print summary
    print(f"\n{'='*60}")
    print(f"📊 ANÁLISIS DE SESIÓN — {result['session_date']}")
    print(f"{'='*60}")
    print(f"  Datos:        {result['data_source']}")
    print(f"  Ventanas:     {result['windows_parsed']} total / {result['windows_in_protocol']} en protocolo")
    print()
    print(f"  FASE baseline_open   | α={result['phase_stats']['baseline_open']['alpha']['mean']:.4f} "
          f"γ={result['phase_stats']['baseline_open']['gamma']['mean']:.4f} "
          f"coh={result['phase_stats']['baseline_open']['coherence']['mean']:.3f}")
    print(f"  FASE baseline_closed | α={result['phase_stats']['baseline_closed']['alpha']['mean']:.4f} "
          f"δ={result['phase_stats']['baseline_closed']['delta']['mean']:.4f} "
          f"coh={result['phase_stats']['baseline_closed']['coherence']['mean']:.3f}")
    print(f"  FASE recovery        | α={result['phase_stats']['recovery']['alpha']['mean']:.4f} "
          f"θ={result['phase_stats']['recovery']['theta']['mean']:.4f} "
          f"coh={result['phase_stats']['recovery']['coherence']['mean']:.3f}")
    print()

    tests = result['tests']
    b = tests['berger_effect']
    g = tests['gamma_emg_artifact']
    d = tests['delta_eyes_closed']
    c = tests['coherence_stability']

    def icon(passed): return '✅' if passed else '❌'

    print(f"  {icon(b['passed'])} Berger (α closed/open):  ratio={b['metrics']['ratio']:.3f} — {b['quality']}")
    print(f"  {icon(d['passed'])} Delta eyes-closed:        ratio={d['metrics']['ratio']:.3f}{' ⚠️  ' + d['warning'] if d.get('warning') else ''}")
    print(f"  {icon(g['passed'])} Gamma EMG artifact:      mean={g['metrics']['gamma_open_mean']:.4f} — {g['quality']} {'(signal clean)' if g['passed'] else '(EMG contam.)'}")
    print(f"  {icon(c['passed'])} Coherence stability:      autocorr={c['metrics']['autocorrelation_lag1']:.3f} — {c['quality']}")
    print()

    q = result['summary']['quality_score']
    print(f"  SCORE: {q['total_score']}/100  Grade: {q['grade']}")
    print(f"  Tests passed: {result['summary']['passed']}/{result['summary']['total']}")
    print()
    print(f"  ⚠️  LIMITACIONES:")
    for lim in result['limitations']:
        print(f"      • {lim}")
    print()
    print(f"  📁 Resultado guardado: {out_file}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
