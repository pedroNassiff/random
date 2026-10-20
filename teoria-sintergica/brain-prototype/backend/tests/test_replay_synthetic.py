from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest

from replay.format import BANDS, FPS, decode_timeline
from replay.synthetic import LOOP_SECONDS, _frame, _normalize, _state, _wave, build_synthetic_bundle

# Characterization values of the deterministic generator (pin the formulas, not just the shape).
GOLDEN: dict[tuple[str, float], dict[str, Any]] = {
    ("relax", 0.0): {
        "coherence": 0.7775310646325043,
        "entropy": 0.3779751482939965,
        "dominant_frequency": 9.861826559979274,
        "focal_point": {"x": 0.0, "y": 0.552441295442369, "z": 0.0},
        "bands": [0.2055452732613653, 0.27824616097370813, 0.37969362138400065, 0.0928382740794643, 0.0436766703014616],
        "bands_display": [
            0.21421810930454613,
            0.23129846438948326,
            0.2838774485536003,
            0.1571353096317857,
            0.11347066812058465,
        ],
        "plv": 0.7386545114008791,
        "state": "meditation",
    },
    ("relax", 7.3): {
        "coherence": 0.834413167898313,
        "entropy": 0.3324694656813496,
        "dominant_frequency": 10.612007080893253,
        "focal_point": {"x": 0.3460715869352034, "y": 0.5946820335885443, "z": 0.45570163831772265},
        "bands": [
            0.2721119817032232,
            0.2603558807038015,
            0.27381370320623305,
            0.11817088763767267,
            0.07554754674906958,
        ],
        "bands_display": [
            0.24084479268128928,
            0.2241423522815206,
            0.24152548128249324,
            0.16726835505506907,
            0.12621901869962784,
        ],
        "plv": 0.7926925095033973,
        "state": "relaxed",
    },
    ("relax", 33.0): {
        "coherence": 0.6327421550209116,
        "entropy": 0.49380627598327076,
        "dominant_frequency": 10.747309467304696,
        "focal_point": {"x": -0.15450849718747364, "y": 0.420604567364199, "z": -0.44550326209418395},
        "bands": [
            0.18295812694024377,
            0.31692979493449225,
            0.2917381519550085,
            0.16022339082462778,
            0.04815053534562768,
        ],
        "bands_display": [
            0.2051832507760975,
            0.2467719179737969,
            0.24869526078200344,
            0.18408935632985113,
            0.11526021413825108,
        ],
        "plv": 0.601105047269866,
        "state": "relaxed",
    },
    ("focus", 0.0): {
        "coherence": 0.5375310646325043,
        "entropy": 0.5699751482939965,
        "dominant_frequency": 16.148690795155925,
        "focal_point": {"x": 0.0, "y": 0.552441295442369, "z": 0.0},
        "bands": [0.1670620341625696, 0.1813923403118901, 0.21216623749885327, 0.276674261534413, 0.16270512649227406],
        "bands_display": [
            0.19882481366502786,
            0.19255693612475605,
            0.2168664949995413,
            0.23066970461376518,
            0.1610820505969096,
        ],
        "plv": 0.5106545114008791,
        "state": "focused",
    },
    ("focus", 91.4): {
        "coherence": 0.4077021192586173,
        "entropy": 0.6738383045931061,
        "dominant_frequency": 17.829777400405085,
        "focal_point": {"x": -0.0730415142812055, "y": 0.15683295184274693, "z": 0.4879583809693737},
        "bands": [
            0.1611704509990203,
            0.14169957380617682,
            0.18163730917341228,
            0.31945686185709327,
            0.1960358041642974,
        ],
        "bands_display": [
            0.19646818039960812,
            0.17667982952247072,
            0.20465492366936494,
            0.24778274474283732,
            0.17441432166571896,
        ],
        "plv": 0.38731701329568646,
        "state": "focused",
    },
}


@pytest.mark.parametrize(("mode", "t"), list(GOLDEN))
def test_frame_matches_golden_values(mode: str, t: float) -> None:
    frame, expected = _frame(mode, t), GOLDEN[(mode, t)]
    for key in ("coherence", "entropy", "dominant_frequency", "plv"):
        assert frame[key] == pytest.approx(expected[key], abs=1e-9), key
    for axis, value in expected["focal_point"].items():
        assert frame["focal_point"][axis] == pytest.approx(value, abs=1e-9), axis
    for group in ("bands", "bands_display"):
        assert list(frame[group]) == list(BANDS)
        assert list(frame[group].values()) == pytest.approx(expected[group], abs=1e-9), group
    assert frame["state"] == expected["state"]
    assert set(frame) == {
        "coherence",
        "entropy",
        "dominant_frequency",
        "focal_point",
        "bands",
        "bands_display",
        "plv",
        "state",
    }


def test_wave_is_a_sine_with_period_dividing_the_loop() -> None:
    assert _wave(0.0, 1) == pytest.approx(0.0)
    assert _wave(LOOP_SECONDS / 4, 1) == pytest.approx(1.0)
    assert _wave(LOOP_SECONDS / 4, 2) == pytest.approx(0.0, abs=1e-9)
    assert _wave(0.0, 3, 1.0) == pytest.approx(0.8414709848)
    assert _wave(LOOP_SECONDS, 5, 0.3) == pytest.approx(_wave(0.0, 5, 0.3))


def test_normalize_sums_to_one_and_survives_all_zero() -> None:
    assert _normalize({"a": 1.0, "b": 3.0}) == {"a": 0.25, "b": 0.75}
    assert _normalize({"a": 0.0, "b": 0.0}) == {"a": 0.0, "b": 0.0}


def _bands(alpha: float = 0.1, beta: float = 0.1, gamma: float = 0.05) -> dict[str, float]:
    return {"delta": 0.2, "theta": 0.2, "alpha": alpha, "beta": beta, "gamma": gamma}


@pytest.mark.parametrize(
    ("bands", "expected"),
    [
        (_bands(alpha=0.36), "meditation"),
        (_bands(alpha=0.36, beta=0.5, gamma=0.5), "meditation"),
        (_bands(alpha=0.35), "relaxed"),
        (_bands(alpha=0.23), "relaxed"),
        (_bands(alpha=0.23, beta=0.5), "relaxed"),
        (_bands(alpha=0.22), "transitioning"),
        (_bands(beta=0.18), "focused"),
        (_bands(beta=0.17), "transitioning"),
        (_bands(gamma=0.11), "focused"),
        (_bands(gamma=0.10), "transitioning"),
        (_bands(beta=0.18, gamma=0.11), "focused"),
    ],
)
def test_state_thresholds(bands: dict[str, float], expected: str) -> None:
    assert _state(bands) == expected


def test_relax_and_focus_have_distinct_profiles_over_the_whole_loop() -> None:
    relax = [_frame("relax", i / FPS) for i in range(LOOP_SECONDS * FPS)]
    focus = [_frame("focus", i / FPS) for i in range(LOOP_SECONDS * FPS)]
    mean = lambda frames, key: sum(f[key] for f in frames) / len(frames)  # noqa: E731
    assert mean(relax, "coherence") > mean(focus, "coherence") + 0.15
    assert mean(relax, "dominant_frequency") < mean(focus, "dominant_frequency")
    assert mean([{"a": f["bands"]["alpha"]} for f in relax], "a") > mean(
        [{"a": f["bands"]["alpha"]} for f in focus], "a"
    )
    assert mean([{"b": f["bands"]["beta"]} for f in focus], "b") > mean([{"b": f["bands"]["beta"]} for f in relax], "b")
    for frame in relax + focus:
        assert 0.0 <= frame["coherence"] <= 1.0
        assert sum(frame["bands"].values()) == pytest.approx(1.0)
        assert sum(frame["bands_display"].values()) == pytest.approx(1.0)
        assert frame["entropy"] == pytest.approx(1.0 - 0.8 * frame["coherence"])
        assert frame["plv"] == pytest.approx(0.95 * frame["coherence"])


def test_coherence_is_clamped_to_unit_interval(monkeypatch: pytest.MonkeyPatch) -> None:
    import replay.synthetic as synthetic

    monkeypatch.setitem(synthetic._PROFILES, "hot", (synthetic._PROFILES["relax"][0], 5.0))  # noqa: SLF001
    monkeypatch.setitem(synthetic._PROFILES, "cold", (synthetic._PROFILES["relax"][0], -5.0))  # noqa: SLF001
    assert _frame("hot", 1.0)["coherence"] == 1.0
    assert _frame("cold", 1.0)["coherence"] == 0.0


def test_bundle_manifest_describes_both_modes() -> None:
    manifest, reader = build_synthetic_bundle()

    assert [(s.id, s.name, s.type, s.category) for s in manifest.sessions] == [
        ("synthetic_relax", "Synthetic - Relax", "synthetic", "Synthetic"),
        ("synthetic_focus", "Synthetic - Focus", "synthetic", "Synthetic"),
    ]
    assert dict(manifest.modes) == {"relax": "synthetic_relax", "focus": "synthetic_focus"}
    for session in manifest.sessions:
        assert session.duration == LOOP_SECONDS == 120
        assert session.frames == LOOP_SECONDS * FPS == 600
        assert session.file == f"frames/{session.id}.json.gz"
        assert dict(session.meta) == {}
        timeline = decode_timeline(reader.read(session.file))
        assert len(timeline) == 600 and timeline.source == "synthetic"
    stamp = datetime.fromisoformat(manifest.generated_at)
    assert stamp.tzinfo is not None and stamp.utcoffset() is not None and stamp.utcoffset().total_seconds() == 0  # type: ignore[union-attr]


def test_bundle_frames_follow_the_generator() -> None:
    manifest, reader = build_synthetic_bundle()
    relax = decode_timeline(reader.read(manifest.sessions[0].file))
    for index in (0, 36, 165):
        stored, expected = relax.frame(index), _frame("relax", index / FPS)
        assert stored["coherence"] == pytest.approx(expected["coherence"], abs=1e-4)
        assert stored["state"] == expected["state"]
