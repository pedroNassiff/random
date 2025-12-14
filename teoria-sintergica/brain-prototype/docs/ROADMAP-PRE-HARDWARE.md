# 🎯 ROADMAP REORDENADO: Pre-Hardware Focus
## Estrategia: "Perfect the Simulation" mientras llega el EEG

> **Filosofía**: Construir el sistema completo con datos simulados de forma tan robusta que integrar hardware real sea solo "cambiar la fuente de datos".

---

## 📍 SITUACIÓN ACTUAL

### ✅ Fortalezas
- VAE entrenado con PhysioNet (109 sujetos)
- WebSocket streaming funcional (5Hz)
- Visualización 3D reactiva con Three.js
- Shaders básicos sintérgicos

### 🔴 Gaps (Sin necesidad de hardware)
- Métricas sintérgicas superficiales
- Sin análisis espectral (FFT, bandas)
- Shaders básicos (sin efectos cuánticos)
- UI/UX mínima (sin gráficas)
- Sin audio feedback (binaural beats)
- Sin modularización del código

---

## 🚀 FASE 1: BACKEND - Análisis Científico (3-5 días)

**Objetivo**: Implementar métricas sintérgicas reales aunque sea con datos simulados.

### 1.1 Módulo de Análisis Espectral

```python
# backend/analysis/spectral.py
class SpectralAnalyzer:
    """FFT y análisis de bandas de frecuencia"""
    
    @staticmethod
    def compute_frequency_bands(eeg_signal, fs=256):
        """
        Retorna potencia en cada banda:
        - Delta (0.5-4 Hz): Sueño profundo
        - Theta (4-8 Hz): Meditación profunda, creatividad
        - Alpha (8-13 Hz): Relajación, coherencia
        - Beta (13-30 Hz): Concentración, alerta
        - Gamma (30-50 Hz): Insight, procesamiento cognitivo alto
        """
        pass
```

**Por qué AHORA**: 
- Funciona perfectamente con dataset PhysioNet
- No requiere hardware nuevo
- Mejora drásticamente las métricas que mandamos al frontend
- **Bloqueador**: Frontend necesita estas métricas para visualizaciones ricas

### 1.2 Coherencia Inter-Hemisférica Real

```python
# backend/analysis/coherence.py
class CoherenceAnalyzer:
    @staticmethod
    def inter_hemispheric_coherence(left_channels, right_channels, freq_band=(8, 13)):
        """
        Coherencia REAL usando Phase Locking Value (PLV)
        No solo "1/varianza", sino correlación de fases en Alpha
        """
        pass
```

**Por qué AHORA**:
- Dataset PhysioNet tiene múltiples canales L/R
- Métrica core de la teoría sintérgica
- Validable con papers científicos

### 1.3 Refactorización Modular

**Estructura objetivo**:
```
backend/
├── analysis/          # ← NUEVO
│   ├── spectral.py
│   ├── coherence.py
│   ├── entropy.py
│   └── metrics.py    # Orquestador
├── ai/
│   ├── inference.py  # ← Refactorizar
│   └── model.py
└── main.py          # ← Más limpio
```

**Beneficios**:
- Código testeable (unit tests)
- Fácil agregar hardware después
- Separación de concerns

**Tareas**:
- [ ] Crear módulo `analysis/`
- [ ] Mover lógica de métricas de `inference.py` a `metrics.py`
- [ ] Actualizar `main.py` para usar nuevo módulo
- [ ] Tests básicos

---

## 🎨 FASE 2: FRONTEND - UX/UI Científica (4-6 días)

**Objetivo**: Dashboard profesional que muestre TODAS las métricas en tiempo real.

### 2.1 Componentes de Visualización

```jsx
frontend/src/components/hud/
├── CoherenceMeter.jsx       # Gráfica en tiempo real
├── FrequencySpectrum.jsx    # Barras de Delta, Theta, Alpha, Beta, Gamma
├── StateIndicator.jsx       # "MEDITATING" / "FOCUSED" / "RELAXED"
└── SessionStats.jsx         # Duración, promedio coherencia
```

**Mockups conceptuales**:

#### CoherenceMeter
```
┌─────────────────────────────┐
│ COHERENCE                   │
│ ███████████████░░░░ 0.73    │
│                             │
│ [Graph showing last 30s]    │
│     ╱╲    ╱╲                │
│    ╱  ╲  ╱  ╲               │
│ ───────────────────── 0.5   │
└─────────────────────────────┘
```

#### FrequencySpectrum
```
┌─────────────────────────────┐
│ FREQUENCY BANDS             │
│                             │
│ δ ████░░░░░░  0.2  (Sleep)  │
│ θ ████████░░  0.4  (Deep)   │
│ α ██████████  0.8  (Relax)  │ ← Dominante
│ β ██████░░░░  0.3  (Focus)  │
│ γ ██░░░░░░░░  0.1  (Insight)│
└─────────────────────────────┘
```

**Por qué AHORA**:
- Mejora UX inmediatamente
- No depende de hardware (funciona con datos simulados)
- Necesario para neurofeedback después
- **Bloqueador para demos**: Sin esto, es solo "un cerebro bonito"

### 2.2 Audio Binaural Reactivo

```javascript
// frontend/src/hooks/useAudioFeedback.js
export const useAudioFeedback = () => {
  const { coherence } = useBrainStore()
  
  useEffect(() => {
    // Frecuencia base ajustada por coherencia
    const carrierFreq = 200 + (coherence * 100) // 200-300 Hz
    
    // Binaural beat en rango Alpha (10 Hz diferencia)
    const leftFreq = carrierFreq
    const rightFreq = carrierFreq + 10 // Alpha rhythm
    
    // Crear osciladores estéreo
    const leftOsc = audioContext.createOscillator()
    const rightOsc = audioContext.createOscillator()
    
    leftOsc.frequency.value = leftFreq
    rightOsc.frequency.value = rightFreq
    
    // Pan hard L/R
    const pannerL = new StereoPannerNode(audioContext, { pan: -1 })
    const pannerR = new StereoPannerNode(audioContext, { pan: 1 })
    
    leftOsc.connect(pannerL).connect(audioContext.destination)
    rightOsc.connect(pannerR).connect(audioContext.destination)
    
    leftOsc.start()
    rightOsc.start()
    
    return () => {
      leftOsc.stop()
      rightOsc.stop()
    }
  }, [coherence])
}
```

**Por qué AHORA**:
- Web Audio API nativa, no requiere librerías
- Mejora experiencia meditativa inmediatamente
- Testeable con datos simulados
- Feature diferenciador (pocas apps lo tienen)

### 2.3 Shaders Cuánticos Avanzados

**Efectos a implementar**:

#### A. Quantum Collapse Effect
```glsl
// Partículas en superposición → colapso cuando coherencia sube
uniform float uCoherence;
uniform float uTime;

// Función de ruido (simplex o Perlin)
float noise(vec3 p);

void main() {
    // Posición base
    vec3 basePos = vPosition;
    
    // Superposición cuántica (partículas flotando caóticamente)
    vec3 quantumNoise = vec3(
        noise(vPosition + uTime * 0.5),
        noise(vPosition + uTime * 0.7),
        noise(vPosition + uTime * 0.3)
    ) * 0.2;
    
    // Estado superpuesto
    vec3 superposedPos = basePos + quantumNoise;
    
    // Estado colapsado (ordenado)
    vec3 collapsedPos = basePos;
    
    // Mix basado en coherencia: 0.0 = caos, 1.0 = orden
    vec3 finalPos = mix(superposedPos, collapsedPos, uCoherence);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
}
```

#### B. Wave Function Visualization
```glsl
// Fragment shader: Ondas de probabilidad
uniform float uCoherence;
uniform vec3 uFocalPoint;

void main() {
    float dist = distance(vPosition, uFocalPoint);
    
    // Función de onda: amplitud decae con distancia
    float waveAmplitude = exp(-dist * 2.0);
    
    // Frecuencia de onda aumenta con coherencia (más "definida")
    float waveFreq = 5.0 + (uCoherence * 20.0);
    
    // Onda sinusoidal
    float wave = sin(dist * waveFreq - uTime * 3.0) * waveAmplitude;
    
    // Color: Azul frío (baja coherencia) → Oro cálido (alta coherencia)
    vec3 coldColor = vec3(0.0, 0.5, 1.0);
    vec3 hotColor = vec3(1.0, 0.8, 0.2);
    vec3 baseColor = mix(coldColor, hotColor, uCoherence);
    
    // Intensidad modulada por onda
    float intensity = 0.5 + (wave * 0.5);
    vec3 finalColor = baseColor * intensity;
    
    gl_FragColor = vec4(finalColor, 0.8);
}
```

**Por qué AHORA**:
- Diferenciador visual único
- No depende de hardware
- Mejora la narrativa "colapso cuántico = coherencia"
- Fácil de testear con valores manuales

---

## 🧪 FASE 3: DATASET & MÉTRICAS (2-3 días)

**Objetivo**: Mejorar calidad de inferencias con mejor dataset.

### 3.1 Dataset de Meditación

**Opción 1: Kaggle EEG Meditation**
```bash
kaggle datasets download -d birdy654/eeg-brainwave-dataset-mental-state
```

**Opción 2: Synthetic Meditation Data**
```python
# backend/ai/data/synthetic_meditation.py
class MeditationSynthesizer:
    def generate_meditation_eeg(duration_seconds=60):
        """
        Genera EEG sintético con características de meditación:
        - Alpha dominante (8-12 Hz)
        - Alta coherencia inter-hemisférica
        - Baja varianza temporal
        """
        # Usar señales sinusoidales + ruido controlado
        pass
```

**Por qué AHORA**:
- Mejora realismo de las métricas
- Permite fine-tuning del VAE
- No requiere hardware físico

### 3.2 Métricas de Validación

```python
# backend/analysis/validation.py
class MetricsValidator:
    def validate_coherence_range(self, coherence):
        """Coherencia debe estar en [0, 1]"""
        assert 0 <= coherence <= 1
        
    def validate_focal_point_bounds(self, focal_point):
        """Focal point debe estar dentro del cerebro"""
        assert abs(focal_point['x']) < 2.0
        assert abs(focal_point['y']) < 2.0
        assert abs(focal_point['z']) < 2.0
        
    def validate_frequency_bands(self, bands):
        """Bandas deben sumar ~1.0 (normalizado)"""
        total = sum(bands.values())
        assert 0.9 < total < 1.1
```

**Por qué AHORA**:
- Garantiza calidad antes de integrar hardware
- Evita bugs silenciosos
- Profesionaliza el código

---

## 🎮 FASE 4: NEUROFEEDBACK SIMULADO (3-4 días)

**Objetivo**: Sistema de entrenamiento funcional con datos simulados.

### 4.1 Modo Práctica

```jsx
// frontend/src/components/modes/PracticeMode.jsx
const PracticeMode = () => {
  const [target, setTarget] = useState(0.7) // Objetivo: 70% coherencia
  const { coherence } = useBrainStore()
  
  const progress = coherence / target
  
  return (
    <div>
      <h2>Practice: Reach 70% Coherence</h2>
      <ProgressBar value={progress} />
      
      {coherence >= target && (
        <Success>🎉 Target achieved! Hold for 30s...</Success>
      )}
      
      <Instructions>
        • Close your eyes
        • Focus on your breath
        • Visualize golden light
      </Instructions>
    </div>
  )
}
```

### 4.2 Sistema de Logros

```javascript
// frontend/src/store/achievementsStore.js
const achievements = [
  { id: 1, name: "First Contact", desc: "Reach 60% coherence", threshold: 0.6 },
  { id: 2, name: "Syntergic Flow", desc: "Maintain 70% for 1 min", threshold: 0.7, duration: 60 },
  { id: 3, name: "Unified Field", desc: "Reach 90% coherence", threshold: 0.9 },
]
```

**Por qué AHORA**:
- Gamificación aumenta engagement
- Testeable con datos simulados (usuario puede "fingir" con botones de modo)
- Framework listo para cuando tengamos EEG real

---

## 📊 FASE 5: OPTIMIZACIÓN & POLISH (2-3 días)

### 5.1 Performance

**Tareas**:
- [ ] Instancing de partículas en shaders (1 draw call)
- [ ] Web Workers para cálculos FFT
- [ ] Lazy loading de modelos 3D
- [ ] Memoization de componentes React

### 5.2 UX Profesional

**Tareas**:
- [ ] Loading states (skeleton screens)
- [ ] Error boundaries
- [ ] Modo offline (funciona sin backend)
- [ ] Tutorial interactivo first-time user

### 5.3 Documentación

**Crear**:
- [ ] `SETUP.md` - Cómo correr el proyecto
- [ ] `API.md` - Documentación de endpoints
- [ ] `THEORY.md` - Explicación de métricas sintérgicas
- [ ] Video demo (2-3 min)

---

## 🔬 FASE 6: CUANDO LLEGUE EL HARDWARE (1-2 días)

**Módulo único a crear**:
```python
# backend/hardware/eeg_stream.py
class HardwareEEGStream:
    def __init__(self, device_type='muse'):
        # Conectar vía LSL
        pass
    
    def get_next_sample(self):
        # Retornar array de EEG real
        pass
```

**Cambio en `inference.py`**:
```python
# ANTES (simulado)
real_eeg_input = next(self.iterators[self.current_mode])

# DESPUÉS (real)
if hardware_available:
    real_eeg_input = self.hardware_stream.get_next_sample()
else:
    real_eeg_input = next(self.iterators[self.current_mode])  # Fallback
```

**Tiempo estimado**: 1-2 días máximo (porque TODO lo demás ya está listo).

---

## 📅 CRONOGRAMA OPTIMIZADO (Sin hardware)

### Semana 1: Backend Científico
- **Día 1-2**: Módulo `analysis/` (spectral, coherence, entropy)
- **Día 3**: Refactorización de `inference.py`
- **Día 4**: Tests y validación
- **Día 5**: Dataset de meditación

### Semana 2: Frontend Rico
- **Día 1-2**: Componentes HUD (CoherenceMeter, FrequencySpectrum)
- **Día 3**: Audio binaural reactivo
- **Día 4-5**: Shaders cuánticos avanzados

### Semana 3: Experiencia Completa
- **Día 1-2**: Modo práctica + logros
- **Día 3**: Optimización performance
- **Día 4**: UX polish + errores
- **Día 5**: Documentación + video demo

### Semana 4: INTEGRACIÓN HARDWARE
- **Día 1**: Módulo `hardware/eeg_stream.py`
- **Día 2**: Testing con EEG real
- **Día 3+**: Calibración y ajustes

---

## 🎯 PRIORIDADES (Orden de Ejecución)

### 🔴 CRÍTICO (Hacerlo primero)
1. **Análisis Espectral (FFT)** - Backend necesita enviar bandas de frecuencia
2. **CoherenceMeter Component** - Frontend necesita mostrar métricas ricas
3. **Refactorización modular** - Código se está volviendo spagueti

### 🟡 IMPORTANTE (Segunda ola)
4. **Shaders cuánticos** - Diferenciador visual
5. **Audio binaural** - Feature único
6. **FrequencySpectrum component** - Completa el dashboard

### 🟢 NICE TO HAVE (Tercera ola)
7. **Modo práctica** - Gamificación
8. **Dataset meditación** - Mejor realismo
9. **Optimizaciones** - Performance

---

## 🚫 LO QUE **NO** HAREMOS HASTA TENER HARDWARE

- ❌ Integración LSL (Lab Streaming Layer)
- ❌ Calibración de electrodos
- ❌ Detección de artefactos hardware-específica
- ❌ Filtrado hardware en tiempo real
- ❌ UI de configuración de dispositivo

---

## ✅ DEFINITION OF DONE (Cada fase)

### Backend
- [ ] Tests pasan (pytest)
- [ ] Métricas validadas con asserts
- [ ] Código documentado (docstrings)
- [ ] Sin warnings en consola

### Frontend
- [ ] 60 FPS constante
- [ ] Funciona sin backend (modo demo)
- [ ] Responsive (desktop + tablet)
- [ ] Accesibilidad básica (keyboard navigation)

---

## 🎬 PRIMER PASO (Hoy mismo)

### Backend: Análisis Espectral

```python
# backend/analysis/spectral.py
import numpy as np
from scipy import signal
from scipy.fft import fft, fftfreq

class SpectralAnalyzer:
    @staticmethod
    def compute_frequency_bands(eeg_signal: np.ndarray, fs: int = 256) -> dict:
        """
        Calcula potencia en bandas de frecuencia estándar.
        
        Args:
            eeg_signal: Array 1D de EEG
            fs: Frecuencia de muestreo
            
        Returns:
            dict: {'delta': float, 'theta': float, 'alpha': float, 'beta': float, 'gamma': float}
        """
        # FFT
        N = len(eeg_signal)
        yf = fft(eeg_signal)
        xf = fftfreq(N, 1/fs)[:N//2]
        
        # Power Spectral Density
        psd = 2.0/N * np.abs(yf[0:N//2])
        
        # Definir bandas
        bands = {
            'delta': (0.5, 4),
            'theta': (4, 8),
            'alpha': (8, 13),
            'beta': (13, 30),
            'gamma': (30, 50)
        }
        
        # Calcular potencia por banda
        band_powers = {}
        for band_name, (low, high) in bands.items():
            idx_band = np.logical_and(xf >= low, xf <= high)
            band_powers[band_name] = np.mean(psd[idx_band])
        
        # Normalizar a [0, 1]
        total_power = sum(band_powers.values())
        return {k: v/total_power for k, v in band_powers.items()}
```

**Integrar en `main.py`**:
```python
from analysis.spectral import SpectralAnalyzer

# En websocket_endpoint:
ai_state = brain.next_state()

# NUEVO: Calcular bandas de frecuencia
bands = SpectralAnalyzer.compute_frequency_bands(
    ai_state['raw_eeg'],  # ← Necesitamos pasar EEG crudo
    fs=256
)

state = SyntergicState(
    timestamp=current_t,
    coherence=ai_state["coherence"],
    entropy=ai_state["entropy"],
    focal_point=ai_state["focal_point"],
    frequency=10.0 + (ai_state["coherence"] * 30.0),
    bands=bands  # ← NUEVO campo
)
```

**Actualizar `models.py`**:
```python
class SyntergicState(BaseModel):
    timestamp: float
    coherence: float
    entropy: float
    focal_point: dict
    frequency: float
    bands: dict = None  # ← NUEVO: {'delta': 0.1, 'theta': 0.2, ...}
```

---

## 🎓 CONCLUSIÓN

**Estrategia**:
1. **Perfeccionar backend** (métricas científicas reales)
2. **Enriquecer frontend** (visualizaciones + audio)
3. **Gamificar experiencia** (práctica + logros)
4. **Cuando llegue hardware**: Solo conectar fuente de datos

**Ventajas**:
- Sistema 100% funcional sin esperar hardware
- Demostrable a inversores/colaboradores
- Testing exhaustivo con datos controlados
- Integración hardware será trivial (1-2 días)

**Meta**: En 3 semanas tener un producto COMPLETO que funcione con simulación. Cuando llegue el EEG, será solo "enchufar y listo".

---

**¿Empezamos con el módulo de análisis espectral (backend) o prefieres atacar los shaders cuánticos (frontend) primero?**
