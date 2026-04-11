import sys
sys.path.insert(0, '.')

errors = []

try:
    from analysis.spectral import SpectralAnalyzer
    assert hasattr(SpectralAnalyzer, 'compute_frequency_bands_raw'), "missing compute_frequency_bands_raw"
    import numpy as np
    sig = np.random.randn(512) * 10
    raw = SpectralAnalyzer.compute_frequency_bands_raw(sig, 256)
    norm = SpectralAnalyzer.compute_frequency_bands(sig, 256)
    assert abs(sum(norm.values()) - 1.0) < 0.01, f"normalized sum={sum(norm.values())}"
    assert sum(raw.values()) > 0.01, "raw sum too low"
    assert abs(sum(raw.values()) - 1.0) > 0.05, "raw should NOT sum to 1.0"
    print(f"[OK] spectral — raw sum={sum(raw.values()):.4f} (not normalized), norm sum={sum(norm.values()):.4f}")
except Exception as e:
    errors.append(f"[FAIL] spectral: {e}")

try:
    from analysis.metrics import SyntergicMetrics
    import numpy as np
    data = {
        'signal': np.random.randn(512) * 10,
        'left_hemisphere': np.random.randn(512) * 10,
        'right_hemisphere': np.random.randn(512) * 10,
    }
    result = SyntergicMetrics.compute_all(data, fs=256)
    assert 'bands_raw' in result, "bands_raw missing from compute_all"
    assert 'alpha' in result['bands_raw'], "alpha missing from bands_raw"
    print(f"[OK] metrics  — bands_raw in compute_all, alpha_raw={result['bands_raw']['alpha']:.6f}")
except Exception as e:
    errors.append(f"[FAIL] metrics: {e}")

try:
    from database.influx_client import MetricSnapshot
    raw_fields = [f for f in MetricSnapshot.__dataclass_fields__ if 'raw' in f]
    assert len(raw_fields) == 5, f"expected 5 raw fields, got {raw_fields}"
    snap = MetricSnapshot(timestamp=0, coherence=0, entropy=0, plv=0,
                          delta=0, theta=0, alpha=0, beta=0, gamma=0,
                          alpha_raw=1.5, beta_raw=0.3)
    assert snap.alpha_raw == 1.5
    print(f"[OK] influx   — raw fields: {raw_fields}")
except Exception as e:
    errors.append(f"[FAIL] influx_client: {e}")

try:
    from recording.validation.tests import _get_band_raw, validate_berger_effect, validate_cognitive_reactivity
    # Test _get_band_raw with raw field
    w = {'alpha_raw': 2.5, 'alpha': 0.15}
    assert _get_band_raw(w, 'alpha') == 2.5, "should return raw value"
    # Test fallback to normalized
    w2 = {'alpha': 0.15}
    assert _get_band_raw(w2, 'alpha') == 0.15, "should fallback to normalized"
    print("[OK] tests    — _get_band_raw works, fallback works")
    # Test cognitive_reactivity has warnings key
    import inspect
    src = inspect.getsource(validate_cognitive_reactivity)
    assert 'warnings' in src, "warnings key missing"
    assert 'delta_dominance_warning' in src, "delta_dominance_warning missing"
    print("[OK] tests    — cognitive_reactivity has delta_dominance_warning")
except Exception as e:
    errors.append(f"[FAIL] tests: {e}")

try:
    from recording.validation.quality_score import SessionQualityScore
    import inspect
    src = inspect.getsource(SessionQualityScore.compute)
    assert 'passes_quality_threshold' in src, "passes_quality_threshold missing"
    # allow usable_for_training in docstrings/comments, but not as a return key
    assert '"usable_for_training"' not in src, "old return key usable_for_training still present"
    # Test scalar signal_quality fix
    windows = [{'signal_quality': 0.9} for _ in range(50)]
    result = SessionQualityScore.compute(windows, [])
    sig_score = result['components']['signal_quality']['score']
    assert sig_score > 50, f"signal_score should be >50 with sq=0.9, got {sig_score}"
    print(f"[OK] quality  — scalar sq fixed (score={sig_score:.1f}), field renamed to passes_quality_threshold")
except Exception as e:
    errors.append(f"[FAIL] quality_score: {e}")

print()
if errors:
    for e in errors:
        print(e)
    sys.exit(1)
else:
    print("All checks passed")
