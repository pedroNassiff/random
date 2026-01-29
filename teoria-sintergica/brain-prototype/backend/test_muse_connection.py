#!/usr/bin/env python3
"""
Test de conexión con Muse 2.

Este script valida todo el flujo de integración:
1. Descubrimiento de dispositivos
2. Conexión Bluetooth
3. Streaming de datos EEG
4. Cálculo de métricas sintérgicas
5. Calidad de señal

Ejecutar:
    cd backend
    source venv/bin/activate
    python test_muse_connection.py

Requisitos:
    pip install muselsl pylsl bleak
"""

import sys
import time
import numpy as np

def test_imports():
    """Verifica que todas las dependencias estén instaladas."""
    print("=" * 60)
    print("TEST 1: Verificando dependencias...")
    print("=" * 60)
    
    errors = []
    
    try:
        import muselsl
        print("✅ muselsl instalado")
    except ImportError:
        errors.append("muselsl")
        print("❌ muselsl NO instalado")
    
    try:
        import pylsl
        print("✅ pylsl instalado")
    except ImportError:
        errors.append("pylsl")
        print("❌ pylsl NO instalado")
    
    try:
        import bleak
        print("✅ bleak instalado")
    except ImportError:
        errors.append("bleak")
        print("❌ bleak NO instalado")
    
    if errors:
        print(f"\n⚠️  Instalar dependencias faltantes:")
        print(f"   pip install {' '.join(errors)}")
        return False
    
    print("\n✅ Todas las dependencias instaladas")
    return True


def test_hardware_module():
    """Verifica que el módulo hardware se importe correctamente."""
    print("\n" + "=" * 60)
    print("TEST 2: Verificando módulo hardware...")
    print("=" * 60)
    
    try:
        from hardware import MuseConnector, MuseToSyntergicAdapter
        from hardware import EEGDevice, DeviceStatus, EEGWindow
        print("✅ Módulo hardware importado correctamente")
        return True
    except ImportError as e:
        print(f"❌ Error importando hardware: {e}")
        return False


def test_discovery():
    """Busca dispositivos Muse disponibles."""
    print("\n" + "=" * 60)
    print("TEST 3: Buscando dispositivos Muse...")
    print("=" * 60)
    
    from hardware import MuseConnector
    
    muse = MuseConnector()
    print("🔍 Escaneando Bluetooth (10 segundos)...")
    print("   → Asegúrate de que el Muse esté encendido")
    print("   → El LED debe parpadear en azul\n")
    
    devices = muse.discover(timeout=10.0)
    
    if not devices:
        print("\n❌ No se encontraron dispositivos Muse")
        print("\nSoluciones:")
        print("  1. Verifica que el Muse esté encendido")
        print("  2. Verifica que Bluetooth esté activado")
        print("  3. En macOS: System Preferences → Privacy → Bluetooth")
        print("  4. Prueba reiniciar Bluetooth:")
        print("     blueutil --power 0 && blueutil --power 1")
        return None
    
    print(f"\n✅ Encontrados {len(devices)} dispositivo(s):")
    for i, dev in enumerate(devices):
        rssi_str = f" (RSSI: {dev.rssi}dBm)" if dev.rssi else ""
        print(f"   [{i}] {dev.name} - {dev.address}{rssi_str}")
    
    return devices[0].address


def test_connection_and_stream(address: str):
    """Conecta y captura datos del Muse."""
    print("\n" + "=" * 60)
    print("TEST 4: Conexión y streaming...")
    print("=" * 60)
    
    from hardware import MuseConnector, MuseToSyntergicAdapter
    
    muse = MuseConnector()
    
    # Conectar
    print(f"\n🔌 Conectando a: {address}")
    if not muse.connect(address):
        print(f"❌ Error de conexión: {muse.error_message}")
        return False
    
    print(f"✅ Conectado: {muse.device_info.name}")
    
    # Iniciar stream
    print("\n📡 Iniciando stream LSL...")
    if not muse.start_stream():
        print(f"❌ Error al iniciar stream: {muse.error_message}")
        muse.disconnect()
        return False
    
    print("✅ Stream iniciado")
    
    # Esperar a que se llene el buffer
    print("\n⏳ Llenando buffer (5 segundos)...")
    time.sleep(5)
    
    # Capturar ventanas
    print("\n📊 Capturando datos...")
    
    for i in range(5):
        window = muse.get_window(duration=2.0)
        
        if window:
            print(f"\n--- Ventana {i+1}/5 ---")
            print(f"   Shape: {window.data.shape} (canales × muestras)")
            print(f"   Fs: {window.fs} Hz")
            print(f"   Duración: {window.duration}s")
            
            # Estadísticas por canal
            print("\n   Estadísticas por canal (µV):")
            for ch_idx, ch_name in enumerate(window.channels):
                signal = window.data[ch_idx]
                print(f"   {ch_name}: mean={np.mean(signal):7.2f}, std={np.std(signal):7.2f}, "
                      f"range=[{np.min(signal):7.2f}, {np.max(signal):7.2f}]")
            
            # Calidad de señal
            quality = muse.get_signal_quality()
            print(f"\n   Calidad de señal:")
            for ch, q in quality.items():
                bar = "█" * int(q * 10) + "░" * (10 - int(q * 10))
                print(f"   {ch}: [{bar}] {q:.1%}")
            
            # Análisis sintérgico
            data = MuseToSyntergicAdapter.prepare_for_analysis(window)
            print(f"\n   Análisis hemisférico:")
            print(f"   Left avg:  {np.mean(data['left_hemisphere']):7.2f} µV")
            print(f"   Right avg: {np.mean(data['right_hemisphere']):7.2f} µV")
            
        else:
            print(f"⚠️  Ventana {i+1}: No hay suficientes datos")
        
        time.sleep(1)
    
    # Cleanup
    print("\n🔌 Desconectando...")
    muse.disconnect()
    print("✅ Desconectado")
    
    return True


def test_metrics_calculation():
    """Prueba el cálculo de métricas con datos sintéticos."""
    print("\n" + "=" * 60)
    print("TEST 5: Cálculo de métricas (datos sintéticos)...")
    print("=" * 60)
    
    from analysis.metrics import SyntergicMetrics
    from hardware import MuseToSyntergicAdapter, EEGWindow
    
    # Generar señal sintética tipo Alpha (10 Hz)
    fs = 256
    duration = 2.0
    t = np.linspace(0, duration, int(fs * duration))
    
    # 4 canales con onda Alpha + ruido
    alpha_wave = np.sin(2 * np.pi * 10 * t)  # 10 Hz
    noise = np.random.randn(len(t)) * 0.2
    
    data = np.array([
        alpha_wave + noise,              # TP9
        alpha_wave + noise * 1.1,        # AF7
        alpha_wave * 0.95 + noise,       # AF8
        alpha_wave * 0.98 + noise * 0.9  # TP10
    ]) * 50  # Escalar a µV típicos
    
    # Crear EEGWindow
    window = EEGWindow(
        data=data,
        fs=fs,
        timestamp=time.time(),
        channels=['TP9', 'AF7', 'AF8', 'TP10'],
        duration=duration
    )
    
    # Preparar para análisis
    eeg_data = MuseToSyntergicAdapter.prepare_for_analysis(window)
    
    # Calcular métricas
    metrics = SyntergicMetrics.compute_all(eeg_data, fs=fs)
    
    print("\n📈 Métricas calculadas (señal Alpha sintética):")
    print(f"   Coherencia: {metrics['coherence']:.3f}")
    print(f"   Entropía:   {metrics['entropy']:.3f}")
    print(f"   PLV:        {metrics['plv']:.3f}")
    print(f"   Estado:     {metrics['state']}")
    print(f"   Freq. dom:  {metrics['dominant_frequency']:.1f} Hz")
    print(f"\n   Bandas de frecuencia:")
    for band, power in metrics['bands'].items():
        bar = "█" * int(power * 20) + "░" * (20 - int(power * 20))
        print(f"   {band:6}: [{bar}] {power:.2f}")
    
    # Focal point
    focal = MuseToSyntergicAdapter.compute_focal_point_from_bands(metrics['bands'])
    print(f"\n   Focal Point: x={focal['x']:.2f}, y={focal['y']:.2f}, z={focal['z']:.2f}")
    
    # Validar que detectó Alpha correctamente
    if metrics['bands']['alpha'] > 0.3:
        print("\n✅ Detección de Alpha correcta")
        return True
    else:
        print("\n⚠️ Alpha no fue la banda dominante (verificar)")
        return False


def run_all_tests():
    """Ejecuta todos los tests en secuencia."""
    print("\n" + "=" * 60)
    print("   MUSE 2 INTEGRATION TEST SUITE")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Dependencias
    results['imports'] = test_imports()
    if not results['imports']:
        print("\n❌ Test abortado: Instalar dependencias primero")
        return results
    
    # Test 2: Módulo hardware
    results['hardware_module'] = test_hardware_module()
    if not results['hardware_module']:
        print("\n❌ Test abortado: Corregir módulo hardware")
        return results
    
    # Test 3: Discovery
    address = test_discovery()
    results['discovery'] = address is not None
    
    # Test 4: Conexión y streaming (solo si se encontró dispositivo)
    if address:
        results['connection'] = test_connection_and_stream(address)
    else:
        results['connection'] = None
        print("\n⏭️  Saltando test de conexión (no hay dispositivo)")
    
    # Test 5: Métricas (no requiere hardware)
    results['metrics'] = test_metrics_calculation()
    
    # Resumen
    print("\n" + "=" * 60)
    print("   RESUMEN DE TESTS")
    print("=" * 60)
    
    for test_name, passed in results.items():
        if passed is True:
            status = "✅ PASS"
        elif passed is False:
            status = "❌ FAIL"
        else:
            status = "⏭️  SKIP"
        print(f"   {test_name:20}: {status}")
    
    all_passed = all(r is True for r in results.values() if r is not None)
    
    if all_passed:
        print("\n🎉 ¡Todos los tests pasaron! El sistema está listo para usar Muse 2")
    else:
        print("\n⚠️  Algunos tests fallaron. Revisar errores arriba.")
    
    return results


if __name__ == '__main__':
    results = run_all_tests()
    sys.exit(0 if all(r is True for r in results.values() if r is not None) else 1)
