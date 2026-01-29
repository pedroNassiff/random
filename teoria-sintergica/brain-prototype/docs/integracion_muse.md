# 🎧 Plan de Integración: Muse 2 → Syntergic Brain Platform

> **Objetivo**: Conectar el hardware Muse 2 con nuestro sistema existente para capturar EEG en tiempo real.

---

## 📊 Estado Actual del Sistema

### Backend (Python/FastAPI) ✅
```
backend/
├── main.py              # API + WebSocket (streaming a 5Hz)
├── models.py            # Pydantic schemas
├── analysis/            # Métricas sintérgicas
│   ├── spectral.py      # FFT, bandas de frecuencia
│   ├── coherence.py     # Coherencia inter-hemisférica
│   ├── entropy.py       # Entropía espectral
│   └── metrics.py       # Orquestador de métricas
├── ai/
│   ├── model.py         # VAE architecture
│   ├── inference.py     # SyntergicBrain (punto de entrada)
│   └── session_player.py
└── hardware/            # ← A CREAR
    ├── __init__.py
    ├── base.py          # Abstract base class
    ├── muse.py          # Muse 2 connector
    └── lsl_stream.py    # Lab Streaming Layer utils
```

### Frontend (React/Three.js) ✅
- Ya consume WebSocket en `ws://localhost:8000/ws/brain-state`
- No requiere cambios para integración de hardware

---

## 🎯 Especificaciones del Muse 2

### Canales EEG
| Canal | Ubicación | Hemisferio | Zona |
|-------|-----------|------------|------|
| **TP9** | Temporal izquierdo | Left | Temporal/Parietal |
| **AF7** | Frontal izquierdo | Left | Frontal |
| **AF8** | Frontal derecho | Right | Frontal |
| **TP10** | Temporal derecho | Right | Temporal/Parietal |

### Sensores Adicionales
- **Acelerómetro**: 3 ejes (X, Y, Z) - detección de movimiento
- **Giroscopio**: 3 ejes - orientación de la cabeza
- **PPG**: Photoplethysmography - ritmo cardíaco (sensor en frente)

### Especificaciones Técnicas
- **Sampling Rate EEG**: 256 Hz (vs. 160 Hz de PhysioNet)
- **Resolución**: 12-bit
- **Conexión**: Bluetooth Low Energy (BLE)
- **Batería**: ~10 horas
- **Formato datos**: LSL (Lab Streaming Layer)

---

## 🔧 Stack de Integración

### Librerías Python Necesarias

```bash
# Lab Streaming Layer (core)
pip install pylsl

# Muse específico
pip install muselsl

# Opcional: Bluetooth utilities (Linux)
pip install bleak  # Para BLE directo

# Ya instalados en requirements.txt
# mne, numpy, scipy
```

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                         MUSE 2                                  │
│   TP9 ─────┐                                                    │
│   AF7 ─────┼────► Bluetooth LE                                  │
│   AF8 ─────┤                                                    │
│   TP10 ────┘                                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MUSELSL BRIDGE                               │
│   muselsl stream --ppg --acc --gyro                             │
│           │                                                     │
│           ▼                                                     │
│   Lab Streaming Layer (LSL)                                     │
│   - EEG Stream @ 256 Hz                                         │
│   - PPG Stream                                                  │
│   - ACC Stream                                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND: hardware/muse.py                       │
│                                                                 │
│   class MuseConnector:                                          │
│     • Discover & Connect                                        │
│     • Buffer EEG (2 sec windows)                                │
│     • Resample 256Hz → 160Hz (compatibilidad)                   │
│     • Split hemisferios (TP9+AF7 | AF8+TP10)                    │
│     • Generar formato compatible con SyntergicMetrics           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 BACKEND: ai/inference.py                        │
│                                                                 │
│   class SyntergicBrain:                                         │
│     • set_mode('muse')  ← NUEVO MODO                            │
│     • _process_eeg_window() ← Sin cambios                       │
│     • next_state() → Usa MuseConnector si modo='muse'           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 WEBSOCKET → FRONTEND                            │
│   Mismo formato JSON que ya existe                              │
│   { coherence, entropy, focal_point, bands, state, plv }        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Fases de Implementación

### Fase 1: Módulo Hardware Base (2-3 horas)

**Archivos a crear:**
```
backend/hardware/
├── __init__.py
├── base.py        # Abstract base class para hardware
├── lsl_utils.py   # Utilidades LSL
└── muse.py        # Conector Muse 2
```

**Tareas:**
- [ ] Crear clase abstracta `EEGDevice` con interfaz común
- [ ] Implementar `MuseConnector` con métodos:
  - `discover()` - Buscar dispositivos
  - `connect(address)` - Conectar
  - `start_stream()` - Iniciar streaming
  - `get_window(duration)` - Obtener ventana EEG
  - `disconnect()` - Desconectar
- [ ] Manejar resampling 256Hz → 160Hz

### Fase 2: Integración con SyntergicBrain (1-2 horas)

**Modificar:**
- `ai/inference.py` - Agregar modo 'muse'
- `main.py` - Nuevos endpoints para hardware

**Nuevos endpoints:**
```
GET  /hardware/devices       # Lista dispositivos disponibles
POST /hardware/connect       # Conectar a Muse
POST /hardware/disconnect    # Desconectar
GET  /hardware/status        # Estado de conexión
POST /set-mode/muse          # Cambiar a modo hardware
```

### Fase 3: Validación y Calibración (2-3 horas)

**Tareas:**
- [ ] Script de test: `test_muse_connection.py`
- [ ] Comparar métricas Muse vs Dataset (sanity check)
- [ ] Ajustar thresholds si es necesario
- [ ] Documentar proceso de calibración

### Fase 4: UX y Onboarding (1-2 horas)

**Frontend (opcional):**
- [ ] Indicator de conexión hardware
- [ ] Wizard de calibración
- [ ] Feedback de calidad de señal

---

## 🗂️ Estructura de Archivos Propuesta

### backend/hardware/__init__.py
```python
from .base import EEGDevice
from .muse import MuseConnector
from .lsl_utils import LSLStreamManager

__all__ = ['EEGDevice', 'MuseConnector', 'LSLStreamManager']
```

### backend/hardware/base.py
```python
from abc import ABC, abstractmethod
from typing import Optional, Dict, List
import numpy as np

class EEGDevice(ABC):
    """
    Abstract base class para dispositivos EEG.
    Permite agregar nuevos dispositivos (OpenBCI, etc.) fácilmente.
    """
    
    @abstractmethod
    def discover(self) -> List[Dict]:
        """Descubre dispositivos disponibles."""
        pass
    
    @abstractmethod
    def connect(self, address: str) -> bool:
        """Conecta a un dispositivo específico."""
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """Desconecta del dispositivo."""
        pass
    
    @abstractmethod
    def start_stream(self) -> None:
        """Inicia el streaming de datos."""
        pass
    
    @abstractmethod
    def stop_stream(self) -> None:
        """Detiene el streaming."""
        pass
    
    @abstractmethod
    def get_window(self, duration: float) -> Optional[Dict]:
        """
        Retorna una ventana de datos EEG.
        
        Returns:
            Dict con estructura:
            {
                'data': np.ndarray,      # (n_channels, n_samples)
                'fs': int,               # Sampling rate
                'timestamp': float,      # Timestamp inicio
                'channels': List[str]    # Nombres canales
            }
        """
        pass
    
    @abstractmethod
    def get_status(self) -> Dict:
        """Retorna estado del dispositivo."""
        pass
```

---

## ⚙️ Configuración del Muse 2

### Primer Setup (una sola vez)

```bash
# 1. Instalar dependencias
pip install muselsl pylsl bleak

# 2. Buscar dispositivos
muselsl list

# Output esperado:
# Found 1 Muse(s):
#   Muse-XXXX : XX:XX:XX:XX:XX:XX

# 3. Test de conexión
muselsl stream --address XX:XX:XX:XX:XX:XX

# En otra terminal:
muselsl view  # Visualizar ondas en tiempo real
```

### En macOS (notas importantes)

```bash
# macOS requiere permisos de Bluetooth
# System Preferences → Security & Privacy → Privacy → Bluetooth

# Si hay problemas de conexión:
brew install blueutil
blueutil --power 0 && blueutil --power 1  # Reset Bluetooth
```

### En Linux

```bash
# Asegurar que el usuario tiene permisos Bluetooth
sudo usermod -a -G bluetooth $USER

# Reiniciar servicio
sudo systemctl restart bluetooth
```

---

## 🔌 Mapping de Canales: Muse 2 → Sistema Actual

### Problema
El sistema actual espera 64 canales (PhysioNet), Muse 2 tiene 4.

### Solución: Adaptador

```python
class MuseToSyntergicAdapter:
    """
    Adapta datos de 4 canales Muse a formato compatible con el sistema.
    """
    
    # Mapeo de canales Muse
    MUSE_CHANNELS = {
        0: 'TP9',   # Temporal izquierdo
        1: 'AF7',   # Frontal izquierdo
        2: 'AF8',   # Frontal derecho
        3: 'TP10'   # Temporal derecho
    }
    
    # Hemisferios
    LEFT_CHANNELS = [0, 1]   # TP9, AF7
    RIGHT_CHANNELS = [2, 3]  # AF8, TP10
    
    @staticmethod
    def prepare_for_analysis(muse_data: np.ndarray, fs: int = 256) -> Dict:
        """
        Prepara datos Muse para SyntergicMetrics.
        
        Args:
            muse_data: Array (4, n_samples)
            fs: Sampling rate
            
        Returns:
            Dict compatible con SyntergicMetrics.compute_all()
        """
        # Promedio hemisferio izquierdo (TP9 + AF7)
        left_avg = np.mean(muse_data[MuseToSyntergicAdapter.LEFT_CHANNELS], axis=0)
        
        # Promedio hemisferio derecho (AF8 + TP10)
        right_avg = np.mean(muse_data[MuseToSyntergicAdapter.RIGHT_CHANNELS], axis=0)
        
        # Señal global (promedio de todo)
        signal_avg = np.mean(muse_data, axis=0)
        
        return {
            'signal': signal_avg,
            'left_hemisphere': left_avg,
            'right_hemisphere': right_avg,
            'raw_variance': np.var(muse_data)
        }
```

### Para el VAE (opcional)
Si queremos usar el VAE pre-entrenado, necesitamos padding:

```python
def pad_for_vae(muse_data: np.ndarray, target_shape=(64, 161)) -> np.ndarray:
    """
    Expande 4 canales a 64 mediante padding/repetición.
    
    NOTA: El VAE no fue entrenado con datos Muse,
    así que las inferencias de focal_point serán aproximadas.
    Para v1, usamos solo las métricas espectrales (FFT, coherencia)
    que NO dependen del VAE.
    """
    n_channels_muse, n_samples = muse_data.shape
    
    # Resampling temporal si es necesario
    if n_samples != target_shape[1]:
        from scipy import signal
        muse_data = signal.resample(muse_data, target_shape[1], axis=1)
    
    # Padding de canales: repetir patrón para llenar 64
    # TP9, AF7, AF8, TP10 → Repetir 16 veces
    padded = np.tile(muse_data, (16, 1))  # (64, 161)
    
    return padded
```

---

## 📊 Métricas Prioritarias (Muse 2)

### Métricas que FUNCIONAN PERFECTO con 4 canales:
1. ✅ **Coherencia Alpha** (TP9 ↔ TP10, AF7 ↔ AF8)
2. ✅ **Bandas de frecuencia** (Delta, Theta, Alpha, Beta, Gamma)
3. ✅ **Entropía espectral**
4. ✅ **Estado mental** (meditation, focus, relaxed)
5. ✅ **PLV** (Phase Locking Value)
6. ✅ **Frecuencia dominante**

### Métricas con LIMITACIONES:
1. ⚠️ **Focal Point 3D**: Solo aproximado (4 puntos, no mapeo completo)
2. ⚠️ **Source Localization**: No viable con 4 canales
3. ⚠️ **Topografía completa**: Imposible (solo 4 ubicaciones)

### Decisión de Diseño
**Para v1 con Muse 2**: 
- Usar análisis espectral directo (no VAE)
- El VAE se puede omitir o usar con disclaimer
- Focal point puede ser sintético basado en bandas

---

## 🧪 Scripts de Testing

### test_muse_connection.py
```python
#!/usr/bin/env python3
"""
Test de conexión con Muse 2.
Ejecutar: python test_muse_connection.py
"""

from muselsl import list_muses, stream
from pylsl import StreamInlet, resolve_byprop
import time
import numpy as np

def test_discovery():
    """Test: Descubrir dispositivos"""
    print("🔍 Buscando dispositivos Muse...")
    muses = list_muses()
    
    if not muses:
        print("❌ No se encontraron dispositivos Muse")
        print("   → Asegúrate de que el Muse esté encendido")
        print("   → Bluetooth debe estar activado")
        return None
    
    print(f"✅ Encontrados {len(muses)} dispositivo(s):")
    for m in muses:
        print(f"   • {m['name']} : {m['address']}")
    
    return muses[0]['address']

def test_stream(address: str, duration: int = 10):
    """Test: Streaming de datos"""
    print(f"\n📡 Conectando a {address}...")
    
    # Iniciar stream en background
    import subprocess
    import threading
    
    stream_process = subprocess.Popen(
        ['muselsl', 'stream', '--address', address],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    time.sleep(5)  # Esperar conexión
    
    # Resolver stream EEG
    print("🔌 Buscando stream EEG en LSL...")
    streams = resolve_byprop('type', 'EEG', timeout=10)
    
    if not streams:
        print("❌ No se encontró stream EEG")
        stream_process.terminate()
        return False
    
    print(f"✅ Stream encontrado: {streams[0].name()}")
    
    # Crear inlet
    inlet = StreamInlet(streams[0])
    
    # Capturar datos
    print(f"\n📊 Capturando {duration} segundos de datos...")
    samples = []
    start_time = time.time()
    
    while time.time() - start_time < duration:
        sample, timestamp = inlet.pull_sample(timeout=1.0)
        if sample:
            samples.append(sample)
    
    samples = np.array(samples)
    print(f"✅ Capturados {len(samples)} samples")
    print(f"   Forma: {samples.shape}")
    print(f"   Sampling rate efectivo: {len(samples)/duration:.1f} Hz")
    print(f"   Rango valores: [{samples.min():.2f}, {samples.max():.2f}] µV")
    
    # Calcular métricas básicas
    print("\n📈 Métricas básicas:")
    for i, ch in enumerate(['TP9', 'AF7', 'AF8', 'TP10']):
        std = np.std(samples[:, i])
        print(f"   {ch}: σ = {std:.2f} µV")
    
    # Cleanup
    stream_process.terminate()
    
    return True

if __name__ == '__main__':
    address = test_discovery()
    if address:
        test_stream(address)
```

---

## 📅 Timeline Estimado

| Fase | Duración | Descripción |
|------|----------|-------------|
| **1. Setup Hardware** | 30 min | Instalar libs, test conexión |
| **2. Módulo base.py** | 1 hora | Abstract class, tipos |
| **3. Módulo muse.py** | 2 horas | Conector completo |
| **4. Integración inference.py** | 1.5 horas | Nuevo modo 'muse' |
| **5. Endpoints API** | 1 hora | /hardware/* routes |
| **6. Testing** | 1.5 horas | Scripts de validación |
| **7. Documentación** | 30 min | README, comentarios |

**Total estimado**: ~8 horas de desarrollo

---

## 🚀 Próximos Pasos

1. **Instalar muselsl** y verificar que detecta el Muse 2
2. **Crear estructura** `backend/hardware/`
3. **Implementar** `muse.py` con buffer circular
4. **Integrar** con `SyntergicBrain.set_mode('muse')`
5. **Testear** métricas en tiempo real
6. **Opcional**: Actualizar frontend con indicador de hardware

---

## 📚 Referencias

- [muselsl Documentation](https://github.com/alexandrebarachant/muse-lsl)
- [pylsl Tutorial](https://labstreaminglayer.readthedocs.io/)
- [Muse Research Tools](https://choosemuse.com/development/)
- [MNE-Python LSL](https://mne.tools/mne-lsl/)

---

*Documento creado para brain-prototype v0.3*
*Última actualización: Enero 2026*