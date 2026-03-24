"""
Validation tests and quality scoring for recorded EEG sessions.

Three core tests:
  1. Berger effect (alpha reactivity: eyes closed > eyes open)
  2. Cognitive reactivity (beta increase during mental task)
  3. Coherence stability (autocorrelation of PLV series)

Plus a composite SessionQualityScore (0-100, grade A-F).
"""

from .tests import (
    validate_berger_effect,
    validate_cognitive_reactivity,
    validate_coherence_stability,
    detect_artifacts,
    run_all_tests,
)
from .quality_score import SessionQualityScore

__all__ = [
    'validate_berger_effect',
    'validate_cognitive_reactivity',
    'validate_coherence_stability',
    'detect_artifacts',
    'run_all_tests',
    'SessionQualityScore',
]
