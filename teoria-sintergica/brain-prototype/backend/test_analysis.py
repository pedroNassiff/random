"""
Script de prueba para el módulo de análisis.
Valida que las métricas científicas funcionan correctamente.
"""

import numpy as np
import sys
import os

# Agregar path del backend
sys.path.insert(0, os.path.dirname(__file__))

from analysis.spectral import SpectralAnalyzer
from analysis.coherence import CoherenceAnalyzer
from analysis.entropy import EntropyAnalyzer
from analysis.metrics import SyntergicMetrics


def test_spectral_analysis():
    """Test análisis espectral"""
    print("\n" + "="*60)
    print("TEST 1: Análisis Espectral (FFT)")
    print("="*60)
    
    # Crear señal sintética: 10 Hz (Alpha) dominante
    fs = 256
    duration = 2  # segundos
    t = np.linspace(0, duration, fs * duration)
    
    # Señal con Alpha dominante (10 Hz) + algo de Beta (20 Hz)
    signal_alpha = np.sin(2 * np.pi * 10 * t) * 2.0  # Alpha fuerte
    signal_beta = np.sin(2 * np.pi * 20 * t) * 0.5   # Beta débil
    signal = signal_alpha + signal_beta + np.random.randn(len(t)) * 0.1
    
    # Calcular bandas
    bands = SpectralAnalyzer.compute_frequency_bands(signal, fs)
    
    print("\nBandas de frecuencia:")
    for band, power in bands.items():
        bar = "█" * int(power * 50)
        print(f"  {band:6s}: {bar:50s} {power:.3f}")
    
    print(f"\nSuma total: {sum(bands.values()):.3f} (debe ser ~1.0)")
    
    # Frecuencia dominante
    dominant_freq = SpectralAnalyzer.get_dominant_frequency(signal, fs)
    print(f"Frecuencia dominante: {dominant_freq:.1f} Hz (esperado: ~10 Hz)")
    
    # Estado mental
    state = SpectralAnalyzer.get_state_from_bands(bands)
    print(f"Estado mental inferido: {state}")
    
    assert 0.9 <= sum(bands.values()) <= 1.1, "Bandas no suman 1.0"
    assert bands['alpha'] > 0.3, "Alpha debería ser dominante"
    assert 8 <= dominant_freq <= 13, "Frecuencia dominante debería estar en Alpha"
    
    print("\n✓ Test espectral PASSED")
    return True


def test_coherence_analysis():
    """Test coherencia inter-hemisférica"""
    print("\n" + "="*60)
    print("TEST 2: Coherencia Inter-Hemisférica")
    print("="*60)
    
    fs = 256
    duration = 2
    t = np.linspace(0, duration, fs * duration)
    
    # Test 1: Señales idénticas (coherencia perfecta)
    signal1 = np.sin(2 * np.pi * 10 * t)
    signal2 = signal1.copy()
    
    coherence_perfect = CoherenceAnalyzer.compute_coherence(signal1, signal2, fs)
    print(f"\nTest 1 - Señales idénticas:")
    print(f"  Coherencia: {coherence_perfect:.3f} (esperado: ~1.0)")
    
    assert coherence_perfect > 0.8, "Coherencia de señales idénticas debería ser >0.8"
    
    # Test 2: Señales con desfase (menor coherencia)
    signal3 = np.sin(2 * np.pi * 10 * t + np.pi/4)  # Desfase 45°
    coherence_shifted = CoherenceAnalyzer.compute_coherence(signal1, signal3, fs)
    print(f"\nTest 2 - Señales con desfase 45°:")
    print(f"  Coherencia: {coherence_shifted:.3f} (esperado: 0.5-0.9)")
    
    # Test 3: Ruido aleatorio (sin coherencia)
    signal4 = np.random.randn(len(t))
    signal5 = np.random.randn(len(t))
    coherence_random = CoherenceAnalyzer.compute_coherence(signal4, signal5, fs)
    print(f"\nTest 3 - Ruido aleatorio:")
    print(f"  Coherencia: {coherence_random:.3f} (esperado: <0.3)")
    
    assert coherence_random < 0.4, "Coherencia de ruido debería ser baja"
    
    # Test 4: Phase Locking Value
    plv = CoherenceAnalyzer.compute_phase_locking_value(signal1, signal2, fs)
    print(f"\nTest 4 - Phase Locking Value (señales idénticas):")
    print(f"  PLV: {plv:.3f} (esperado: ~1.0)")
    
    print("\n✓ Test coherencia PASSED")
    return True


def test_entropy_analysis():
    """Test entropía"""
    print("\n" + "="*60)
    print("TEST 3: Análisis de Entropía")
    print("="*60)
    
    fs = 256
    duration = 2
    t = np.linspace(0, duration, fs * duration)
    
    # Test 1: Señal pura (baja entropía)
    pure_signal = np.sin(2 * np.pi * 10 * t)
    entropy_pure = EntropyAnalyzer.compute_spectral_entropy(pure_signal, fs)
    print(f"\nTest 1 - Señal pura (10 Hz):")
    print(f"  Entropía: {entropy_pure:.3f} (esperado: <0.4)")
    
    assert entropy_pure < 0.5, "Entropía de señal pura debería ser baja"
    
    # Test 2: Ruido blanco (alta entropía)
    noise = np.random.randn(len(t))
    entropy_noise = EntropyAnalyzer.compute_spectral_entropy(noise, fs)
    print(f"\nTest 2 - Ruido blanco:")
    print(f"  Entropía: {entropy_noise:.3f} (esperado: >0.7)")
    
    assert entropy_noise > 0.6, "Entropía de ruido debería ser alta"
    
    # Test 3: Señal compleja (entropía media)
    complex_signal = (np.sin(2 * np.pi * 10 * t) + 
                     np.sin(2 * np.pi * 20 * t) + 
                     np.sin(2 * np.pi * 15 * t))
    entropy_complex = EntropyAnalyzer.compute_spectral_entropy(complex_signal, fs)
    print(f"\nTest 3 - Señal multi-frecuencia:")
    print(f"  Entropía: {entropy_complex:.3f} (esperado: 0.4-0.7)")
    
    print("\n✓ Test entropía PASSED")
    return True


def test_full_metrics():
    """Test sistema completo de métricas"""
    print("\n" + "="*60)
    print("TEST 4: Sistema Completo de Métricas Sintérgicas")
    print("="*60)
    
    fs = 256
    duration = 2
    t = np.linspace(0, duration, fs * duration)
    
    # Simular actividad de "meditación"
    # Alpha dominante, alta coherencia inter-hemisférica
    left_hemisphere = np.sin(2 * np.pi * 10 * t) + np.random.randn(len(t)) * 0.1
    right_hemisphere = np.sin(2 * np.pi * 10 * t + np.pi/10) + np.random.randn(len(t)) * 0.1
    
    eeg_data = {
        'signal': left_hemisphere,
        'left_hemisphere': left_hemisphere,
        'right_hemisphere': right_hemisphere
    }
    
    # Calcular todas las métricas
    metrics = SyntergicMetrics.compute_all(eeg_data, fs)
    
    print("\nMétricas calculadas:")
    print(f"  Coherencia:          {metrics['coherence']:.3f}")
    print(f"  Entropía:            {metrics['entropy']:.3f}")
    print(f"  Frecuencia dominante: {metrics['dominant_frequency']:.1f} Hz")
    print(f"  Estado mental:       {metrics['state']}")
    print(f"  PLV:                 {metrics.get('plv', 0):.3f}")
    
    print("\n  Bandas de frecuencia:")
    for band, power in metrics['bands'].items():
        bar = "█" * int(power * 50)
        print(f"    {band:6s}: {bar:50s} {power:.3f}")
    
    # Validar métricas
    is_valid = SyntergicMetrics.validate_metrics(metrics)
    print(f"\nValidación: {'✓ PASSED' if is_valid else '✗ FAILED'}")
    
    assert is_valid, "Métricas fuera de rango válido"
    assert metrics['state'] in ['meditation', 'relaxed', 'neutral'], "Estado inesperado"
    
    print("\n✓ Test sistema completo PASSED")
    return True


if __name__ == "__main__":
    print("\n" + "="*60)
    print("SYNTERGIC METRICS - Test Suite")
    print("="*60)
    
    try:
        test_spectral_analysis()
        test_coherence_analysis()
        test_entropy_analysis()
        test_full_metrics()
        
        print("\n" + "="*60)
        print("✓ TODOS LOS TESTS PASARON")
        print("="*60)
        print("\nEl módulo de análisis está listo para usar.")
        print("Puedes iniciar el backend con: uvicorn main:app --reload")
        
    except AssertionError as e:
        print(f"\n✗ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
