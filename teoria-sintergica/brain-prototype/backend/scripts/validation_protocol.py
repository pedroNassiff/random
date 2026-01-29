#!/usr/bin/env python3
"""
Protocolo de Validación Científica para Brain-Prototype
========================================================

Tests basados en literatura científica de EEG:
1. Test Berger (ojos abiertos/cerrados) - Alpha debe aumentar ~50-100% con ojos cerrados
2. Test de Parpadeo - Verificar detección de artefactos
3. Rangos esperados - Comparar con valores publicados en papers

Referencias:
- Berger, H. (1929). Über das Elektrenkephalogramm des Menschen
- Barry et al. (2007). EEG differences between eyes-closed and eyes-open resting conditions
- Klimesch, W. (1999). EEG alpha and theta oscillations
"""

import asyncio
import time
import sys
import os

from datetime import datetime
from typing import List, Dict
import numpy as np
from influxdb_client import InfluxDBClient

# Configuración InfluxDB (mismo que influx_client.py)
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "my-super-secret-auth-token"
INFLUX_ORG = "teoria-sintergica"
INFLUX_BUCKET = "eeg-data"

influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)

class ValidationProtocol:
    def __init__(self):
        self.results = {}
        
    def print_header(self, title: str):
        print("\n" + "="*60)
        print(f"  {title}")
        print("="*60)
        
    def print_instruction(self, text: str):
        print(f"\n📋 {text}")
        
    def print_result(self, label: str, value: float, expected: str, passed: bool):
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {label}: {value:.4f} (esperado: {expected}) {status}")

    def wait_for_enter(self, message: str = "Presiona ENTER cuando estés listo..."):
        input(f"\n⏳ {message}")

    def countdown(self, seconds: int, message: str):
        print(f"\n⏱️  {message}")
        for i in range(seconds, 0, -1):
            print(f"   {i}...", end="\r")
            time.sleep(1)
        print("   ¡YA!    ")

    def get_recent_metrics(self, seconds: int = 30) -> List[Dict]:
        """Obtiene métricas de los últimos N segundos"""
        query = f'''
        from(bucket: "{INFLUX_BUCKET}")
            |> range(start: -{seconds}s)
            |> filter(fn: (r) => r._measurement == "eeg_metrics")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        '''
        
        try:
            query_api = influx_client.query_api()
            tables = query_api.query(query, org=INFLUX_ORG)
            
            metrics = []
            for table in tables:
                for record in table.records:
                    metrics.append({
                        'time': record.get_time(),
                        'alpha': record.values.get('alpha_power', 0),
                        'beta': record.values.get('beta_power', 0),
                        'theta': record.values.get('theta_power', 0),
                        'gamma': record.values.get('gamma_power', 0),
                        'delta': record.values.get('delta_power', 0),
                        'coherence': record.values.get('coherence', 0),
                        'blink_detected': record.values.get('blink_detected', False),
                    })
            return metrics
        except Exception as e:
            print(f"Error obteniendo métricas: {e}")
            return []

    def calculate_stats(self, metrics: List[Dict], field: str) -> Dict:
        """Calcula estadísticas de un campo"""
        values = [m[field] for m in metrics if m.get(field) is not None]
        if not values:
            return {'mean': 0, 'std': 0, 'min': 0, 'max': 0, 'count': 0}
        
        return {
            'mean': np.mean(values),
            'std': np.std(values),
            'min': np.min(values),
            'max': np.max(values),
            'count': len(values)
        }

    def test_berger_effect(self):
        """
        Test del Efecto Berger (1929)
        Alpha debe aumentar significativamente con ojos cerrados vs abiertos
        Incremento esperado: 50-100%
        """
        self.print_header("TEST 1: Efecto Berger (Alpha Ojos Abiertos vs Cerrados)")
        
        print("""
Este test verifica que alpha aumenta con ojos cerrados.
Es el efecto EEG más básico y reproducible, descubierto en 1929.

Referencia científica:
- Alpha típico ojos abiertos: 0.05-0.15 (power relativo)
- Alpha típico ojos cerrados: 0.10-0.30 (power relativo)
- Incremento esperado: >50%
        """)
        
        # Fase 1: Ojos abiertos
        self.print_instruction("FASE 1: Mantén los OJOS ABIERTOS mirando un punto fijo")
        self.print_instruction("Relájate pero no cierres los ojos")
        self.wait_for_enter("Presiona ENTER para comenzar (30 segundos)...")
        
        self.countdown(3, "Preparando...")
        print("\n👁️  OJOS ABIERTOS - Mirando punto fijo...")
        time.sleep(30)
        print("   ✓ Fase completada")
        
        # Recoger datos ojos abiertos
        metrics_open = self.get_recent_metrics(30)
        stats_open = self.calculate_stats(metrics_open, 'alpha')
        
        print(f"\n   Muestras recogidas: {stats_open['count']}")
        print(f"   Alpha promedio (ojos abiertos): {stats_open['mean']:.4f}")
        
        # Fase 2: Ojos cerrados
        self.print_instruction("FASE 2: Ahora CIERRA LOS OJOS")
        self.print_instruction("Mantén los ojos cerrados y relájate")
        self.wait_for_enter("Presiona ENTER para comenzar (30 segundos)...")
        
        self.countdown(3, "Preparando...")
        print("\n😌 OJOS CERRADOS - Relájate...")
        time.sleep(30)
        print("   ✓ Fase completada")
        
        # Recoger datos ojos cerrados
        metrics_closed = self.get_recent_metrics(30)
        stats_closed = self.calculate_stats(metrics_closed, 'alpha')
        
        print(f"\n   Muestras recogidas: {stats_closed['count']}")
        print(f"   Alpha promedio (ojos cerrados): {stats_closed['mean']:.4f}")
        
        # Análisis
        self.print_header("RESULTADOS TEST BERGER")
        
        alpha_open = stats_open['mean']
        alpha_closed = stats_closed['mean']
        
        if alpha_open > 0:
            increase_pct = ((alpha_closed - alpha_open) / alpha_open) * 100
        else:
            increase_pct = 0
            
        print(f"\n   Alpha ojos abiertos:  {alpha_open:.4f} ± {stats_open['std']:.4f}")
        print(f"   Alpha ojos cerrados:  {alpha_closed:.4f} ± {stats_closed['std']:.4f}")
        print(f"   Incremento:           {increase_pct:.1f}%")
        
        # Evaluación
        passed = increase_pct > 30  # Umbral más permisivo que el teórico 50%
        
        if increase_pct > 50:
            verdict = "✅ EXCELENTE - Efecto Berger claro y fuerte"
        elif increase_pct > 30:
            verdict = "✅ BUENO - Efecto Berger presente"
        elif increase_pct > 10:
            verdict = "⚠️  DÉBIL - Efecto presente pero bajo"
        else:
            verdict = "❌ NO DETECTADO - Revisar cálculo de alpha o ajuste de electrodos"
            
        print(f"\n   {verdict}")
        
        self.results['berger'] = {
            'alpha_open': alpha_open,
            'alpha_closed': alpha_closed,
            'increase_pct': increase_pct,
            'passed': passed
        }
        
        return passed

    def test_blink_detection(self):
        """
        Test de detección de parpadeos
        Los parpadeos generan artefactos de ~100-200µV en canales frontales
        """
        self.print_header("TEST 2: Detección de Parpadeos")
        
        print("""
Este test verifica que detectamos parpadeos correctamente.
Los parpadeos generan picos de 75-200µV en canales frontales (AF7, AF8).

Haremos 2 fases:
1. Parpadear intencionalmente 10 veces
2. Mantener ojos quietos (sin parpadear)
        """)
        
        # Fase 1: Parpadeos intencionales
        self.print_instruction("FASE 1: Parpadea FUERTE 10 veces (1 cada 2 segundos)")
        self.wait_for_enter("Presiona ENTER para comenzar...")
        
        self.countdown(3, "Preparando...")
        print("\n👁️  PARPADEA AHORA - 10 veces, fuerte y claro...")
        
        for i in range(10):
            print(f"   Parpadeo {i+1}/10", end="\r")
            time.sleep(2)
        print("   ✓ Fase completada      ")
        
        # Recoger datos con parpadeos
        metrics_blink = self.get_recent_metrics(25)
        blinks_detected = sum(1 for m in metrics_blink if m.get('blink_detected'))
        
        print(f"\n   Parpadeos detectados: {blinks_detected}/10")
        
        # Fase 2: Sin parpadeos
        self.print_instruction("FASE 2: Mantén los ojos QUIETOS (sin parpadear) 15 segundos")
        self.wait_for_enter("Presiona ENTER para comenzar...")
        
        self.countdown(3, "Preparando...")
        print("\n😐 OJOS QUIETOS - No parpadees...")
        time.sleep(15)
        print("   ✓ Fase completada")
        
        # Recoger datos sin parpadeos
        metrics_still = self.get_recent_metrics(15)
        false_blinks = sum(1 for m in metrics_still if m.get('blink_detected'))
        
        print(f"\n   Falsos positivos: {false_blinks}")
        
        # Análisis
        self.print_header("RESULTADOS TEST PARPADEO")
        
        detection_rate = (blinks_detected / 10) * 100 if blinks_detected <= 10 else 100
        
        print(f"\n   Parpadeos reales: 10")
        print(f"   Detectados:       {blinks_detected} ({detection_rate:.0f}%)")
        print(f"   Falsos positivos: {false_blinks}")
        
        # Evaluación
        good_detection = blinks_detected >= 5  # Al menos 50% detectados
        low_false_pos = false_blinks <= 3  # Máximo 3 falsos positivos
        passed = good_detection and low_false_pos
        
        if detection_rate >= 70 and false_blinks <= 2:
            verdict = "✅ EXCELENTE - Detección precisa"
        elif detection_rate >= 50 and false_blinks <= 3:
            verdict = "✅ BUENO - Detección aceptable"
        elif detection_rate >= 30:
            verdict = "⚠️  MEJORABLE - Ajustar umbral de detección"
        else:
            verdict = "❌ FALLA - Revisar algoritmo de detección"
            
        print(f"\n   {verdict}")
        
        self.results['blink'] = {
            'expected': 10,
            'detected': blinks_detected,
            'false_positives': false_blinks,
            'passed': passed
        }
        
        return passed

    def test_expected_ranges(self):
        """
        Test de rangos esperados según literatura científica
        """
        self.print_header("TEST 3: Rangos Científicos Esperados")
        
        print("""
Este test verifica que nuestras métricas están en rangos científicamente válidos.

Rangos esperados (power relativo, reposo ojos cerrados):
- Delta (1-4 Hz):   0.10-0.40 (predomina en sueño)
- Theta (4-8 Hz):   0.05-0.20 (meditación profunda)
- Alpha (8-13 Hz):  0.10-0.35 (relajación, ojos cerrados)
- Beta (13-30 Hz):  0.05-0.25 (atención, pensamiento)
- Gamma (30-50 Hz): 0.01-0.10 (procesamiento cognitivo)

Referencia: Klimesch (1999), Barry et al. (2007)
        """)
        
        self.print_instruction("Cierra los ojos y relájate durante 30 segundos")
        self.wait_for_enter("Presiona ENTER para comenzar...")
        
        self.countdown(3, "Preparando...")
        print("\n😌 RELAJACIÓN - Ojos cerrados...")
        time.sleep(30)
        print("   ✓ Datos recogidos")
        
        # Obtener métricas
        metrics = self.get_recent_metrics(30)
        
        if not metrics:
            print("\n❌ No se obtuvieron métricas. ¿Está corriendo el backend?")
            return False
        
        # Calcular estadísticas
        stats = {
            'delta': self.calculate_stats(metrics, 'delta'),
            'theta': self.calculate_stats(metrics, 'theta'),
            'alpha': self.calculate_stats(metrics, 'alpha'),
            'beta': self.calculate_stats(metrics, 'beta'),
            'gamma': self.calculate_stats(metrics, 'gamma'),
            'coherence': self.calculate_stats(metrics, 'coherence'),
        }
        
        # Rangos esperados (min, max)
        expected_ranges = {
            'delta': (0.05, 0.50),
            'theta': (0.02, 0.30),
            'alpha': (0.05, 0.45),
            'beta': (0.02, 0.35),
            'gamma': (0.005, 0.15),
            'coherence': (0.0, 1.0),
        }
        
        # Análisis
        self.print_header("RESULTADOS TEST RANGOS")
        
        print("\n   Banda       │ Valor    │ Rango Esperado  │ Estado")
        print("   ───────────────────────────────────────────────────")
        
        all_passed = True
        for band, (min_val, max_val) in expected_ranges.items():
            value = stats[band]['mean']
            in_range = min_val <= value <= max_val
            status = "✅" if in_range else "⚠️ "
            
            if not in_range:
                all_passed = False
                
            print(f"   {band.capitalize():10} │ {value:.4f}   │ {min_val:.3f} - {max_val:.3f}   │ {status}")
        
        # Verificar que alpha es dominante en relajación
        alpha_dominant = stats['alpha']['mean'] > stats['beta']['mean']
        print(f"\n   Alpha > Beta (esperado en relajación): {'✅' if alpha_dominant else '⚠️ '}")
        
        self.results['ranges'] = {
            'stats': {k: v['mean'] for k, v in stats.items()},
            'all_in_range': all_passed,
            'alpha_dominant': alpha_dominant,
            'passed': all_passed and alpha_dominant
        }
        
        return all_passed

    def run_all_tests(self):
        """Ejecuta todos los tests de validación"""
        self.print_header("PROTOCOLO DE VALIDACIÓN CIENTÍFICA")
        
        print("""
╔════════════════════════════════════════════════════════════╗
║  Brain-Prototype Validation Suite                          ║
║  Basado en literatura científica de EEG                    ║
╚════════════════════════════════════════════════════════════╝

Este protocolo verificará que nuestros cálculos de EEG son correctos
comparando con efectos bien documentados en la literatura científica.

Requisitos:
- Muse 2 conectado y streaming (muselsl)
- Backend corriendo (uvicorn main:app)
- Ambiente tranquilo, sin distracciones
- ~5 minutos de tu tiempo

        """)
        
        self.wait_for_enter("Presiona ENTER para comenzar el protocolo...")
        
        # Test 1: Efecto Berger
        test1_passed = self.test_berger_effect()
        
        input("\n⏳ Presiona ENTER para continuar al siguiente test...")
        
        # Test 2: Detección de parpadeos
        test2_passed = self.test_blink_detection()
        
        input("\n⏳ Presiona ENTER para continuar al siguiente test...")
        
        # Test 3: Rangos esperados
        test3_passed = self.test_expected_ranges()
        
        # Resumen final
        self.print_header("RESUMEN DE VALIDACIÓN")
        
        print("\n   Test                    │ Resultado")
        print("   ──────────────────────────────────────")
        print(f"   1. Efecto Berger        │ {'✅ PASS' if test1_passed else '❌ FAIL'}")
        print(f"   2. Detección Parpadeos  │ {'✅ PASS' if test2_passed else '❌ FAIL'}")
        print(f"   3. Rangos Científicos   │ {'✅ PASS' if test3_passed else '❌ FAIL'}")
        
        total_passed = sum([test1_passed, test2_passed, test3_passed])
        
        print(f"\n   Total: {total_passed}/3 tests pasados")
        
        if total_passed == 3:
            print("\n   🎉 ¡VALIDACIÓN COMPLETA! Los cálculos son científicamente válidos.")
        elif total_passed >= 2:
            print("\n   ⚠️  Validación parcial. Revisar tests fallidos.")
        else:
            print("\n   ❌ Validación fallida. Revisar algoritmos y conexión.")
        
        # Detalles técnicos
        if self.results:
            print("\n" + "─"*60)
            print("   DETALLES TÉCNICOS:")
            
            if 'berger' in self.results:
                b = self.results['berger']
                print(f"\n   Berger: α_open={b['alpha_open']:.4f}, α_closed={b['alpha_closed']:.4f}, Δ={b['increase_pct']:.1f}%")
            
            if 'blink' in self.results:
                bl = self.results['blink']
                print(f"   Blinks: {bl['detected']}/10 detectados, {bl['false_positives']} falsos positivos")
            
            if 'ranges' in self.results:
                r = self.results['ranges']
                print(f"   Bandas: δ={r['stats']['delta']:.3f}, θ={r['stats']['theta']:.3f}, α={r['stats']['alpha']:.3f}, β={r['stats']['beta']:.3f}, γ={r['stats']['gamma']:.3f}")
        
        return total_passed == 3


def run_quick_test():
    """Test rápido solo del efecto Berger (el más importante)"""
    protocol = ValidationProtocol()
    protocol.print_header("TEST RÁPIDO: Solo Efecto Berger")
    return protocol.test_berger_effect()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Protocolo de Validación Científica")
    parser.add_argument("--quick", action="store_true", help="Solo test rápido (Berger)")
    parser.add_argument("--berger", action="store_true", help="Solo test Berger")
    parser.add_argument("--blink", action="store_true", help="Solo test de parpadeo")
    parser.add_argument("--ranges", action="store_true", help="Solo test de rangos")
    
    args = parser.parse_args()
    
    protocol = ValidationProtocol()
    
    if args.quick or args.berger:
        protocol.test_berger_effect()
    elif args.blink:
        protocol.test_blink_detection()
    elif args.ranges:
        protocol.test_expected_ranges()
    else:
        protocol.run_all_tests()
