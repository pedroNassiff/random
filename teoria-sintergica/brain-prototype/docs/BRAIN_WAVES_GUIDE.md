# 🧠 Guía Científica: Ondas Cerebrales y Frecuencias EEG

## 📊 **¿Qué son las ondas cerebrales?**

Las ondas cerebrales son **patrones de actividad eléctrica** generados por neuronas comunicándose entre sí. Se miden en **Hertz (Hz)** = ciclos por segundo.

### **Analogía simple:**
Imagina un lago con olas:
- **Olas lentas y grandes** = Delta (0.5-4 Hz) - Sueño profundo
- **Olas medianas** = Theta (4-8 Hz) - Meditación profunda
- **Olas rápidas pequeñas** = Beta/Gamma (13-50+ Hz) - Pensamiento activo

---

## 🎯 **Las 5 Bandas de Frecuencia del EEG**

### **1. Delta (δ) - 0.5 a 4 Hz**
**Representación física:**
- Ciclos muy lentos (menos de 4 por segundo)
- Amplitud alta (voltaje alto)
- Generadas principalmente en **tálamo** y **corteza**

**Estados mentales:**
- Sueño profundo (etapas 3 y 4)
- Reparación celular
- Secreción de hormona de crecimiento
- Inconsciencia (anestesia)

**En el prototipo:**
```python
# Si Delta domina (>40% de la potencia total)
state = "deep_relaxation"
```

**Ejemplo de señal:**
```
Amplitud
   ^
   |     ___           ___
   |    /   \         /   \
   |___/     \_______/     \____> Tiempo
   |                            (1 ciclo = ~2 segundos)
```

---

### **2. Theta (θ) - 4 a 8 Hz**
**Representación física:**
- Ciclos lentos (4-8 por segundo)
- Asociadas con **hipocampo** (memoria) y **corteza frontal**

**Estados mentales:**
- Meditación profunda
- Creatividad
- Fase REM del sueño
- Estados hipnagógicos (entre sueño y vigilia)
- Insight y "eureka moments"

**En el prototipo:**
```python
# Si Theta es alta (>40%) = Meditación profunda
if bands['theta'] > 0.4:
    state = "relaxed" o "meditation"
```

**Conexión con Jacobo Grinberg:**
> "El estado theta permite acceder a la lattice de forma más directa, 
> reduciendo el filtro perceptual del ego"

**Ejemplo de señal:**
```
Amplitud
   ^
   |  __    __    __
   | /  \  /  \  /  \
   |/    \/    \/    \> Tiempo
   |                  (1 ciclo = ~0.2 seg)
```

---

### **3. Alpha (α) - 8 a 13 Hz**
**Representación física:**
- Ciclos moderados (8-13 por segundo)
- Generadas principalmente en **lóbulo occipital** (visión)
- Muy prominentes cuando ojos cerrados

**Estados mentales:**
- Relajación con ojos cerrados
- Meditación ligera
- Estado de "flow" inicial
- Puente entre consciente e inconsciente

**En el prototipo:**
```python
# Si Alpha es dominante (>50%) = Meditación
if bands['alpha'] > 0.5:
    state = "meditation"
```

**Dato científico:**
- **Supresión de Alpha**: Cuando abres los ojos o piensas activamente, alpha se reduce (fenómeno de bloqueo alpha)
- **Alpha peak**: Frecuencia individual (~10 Hz para mayoría)

**Ejemplo de señal:**
```
Amplitud
   ^
   | _  _  _  _  _
   |/ \/ \/ \/ \/ \
   |              > Tiempo
   |               (1 ciclo = ~0.1 seg)
```

---

### **4. Beta (β) - 13 a 30 Hz**
**Representación física:**
- Ciclos rápidos (13-30 por segundo)
- Distribuidas en **corteza frontal** y **motor cortex**
- Amplitud menor que ondas lentas

**Estados mentales:**
- Pensamiento activo
- Concentración
- Resolución de problemas
- Ansiedad (si muy alta)

**Sub-bandas:**
- **Low Beta (13-15 Hz)**: Relajado pero alerta
- **Mid Beta (15-20 Hz)**: Pensamiento activo
- **High Beta (20-30 Hz)**: Estrés, ansiedad

**En el prototipo:**
```python
# Si Beta + Gamma alto = Concentración
if bands['beta'] + bands['gamma'] > 0.6:
    state = "focused"
```

**Ejemplo de señal:**
```
Amplitud
   ^
   |_____
   |\_/\_/\_/\_/\_/> Tiempo
   |               (1 ciclo = ~0.05 seg)
```

---

### **5. Gamma (γ) - 30 a 100+ Hz**
**Representación física:**
- Ciclos muy rápidos (>30 por segundo)
- Amplitud muy baja
- Asociadas con **binding problem** (unificación perceptual)

**Estados mentales:**
- Insight súbito
- Estados místicos/pico
- Procesamiento de información compleja
- **Coherencia gamma** = unificación de percepción

**En el prototipo:**
```python
# Si Gamma alto = Insight
if bands['gamma'] > 0.3:
    state = "insight"
```

**Conexión con Grinberg:**
> "La sincronía gamma entre hemisferios es la firma neural 
> de la experiencia sintérgica - la unificación total"

**Ejemplo de señal:**
```
Amplitud
   ^
   |_______________
   |\/\/\/\/\/\/\/\> Tiempo
   |                (1 ciclo = ~0.02 seg)
```

---

## 🔬 **Cómo se miden y calculan en el código**

### **Paso 1: Captura de señal EEG**

```python
# Hardware EEG captura voltajes en el cuero cabelludo
# Ejemplo: 64 canales @ 256 Hz (256 muestras por segundo)

eeg_signal = [0.5, 0.3, -0.2, 0.8, ...] # micro-voltios
# Cada valor = voltaje en un instante
# 256 valores = 1 segundo de datos
```

### **Paso 2: Transformada de Fourier (FFT)**

La **FFT** convierte señal temporal → espectro de frecuencias

```python
from scipy.fft import fft, fftfreq
import numpy as np

# Parámetros
fs = 256  # Frecuencia de muestreo (Hz)
N = 256   # Número de muestras (1 segundo)

# Aplicar FFT
yf = fft(eeg_signal)
xf = fftfreq(N, 1/fs)[:N//2]  # Frecuencias positivas

# Power Spectral Density (PSD)
psd = 2.0/N * np.abs(yf[0:N//2])
```

**¿Qué hace la FFT?**
Descompone la señal en sus componentes de frecuencia:

```
Señal Original (tiempo):
    ___   ___   ___
   /   \ /   \ /   \  ← Mezcla de frecuencias
  /     X     X     \

FFT ↓

Espectro (frecuencia):
Potencia
   ^
   |        ___
   |       |   |      ← Pico en 10 Hz (Alpha)
   |  _    |   |  _
   | | |   |   | | |
   |_|_|___|___|_|_|___> Frecuencia (Hz)
   0  4   10  13   30
```

### **Paso 3: Integrar potencia por banda**

```python
# backend/analysis/spectral.py

bands = {
    'delta': (0.5, 4),
    'theta': (4, 8),
    'alpha': (8, 13),
    'beta': (13, 30),
    'gamma': (30, 50)
}

band_powers = {}
for band_name, (low, high) in bands.items():
    # Encontrar índices en el rango de frecuencias
    idx_band = np.logical_and(xf >= low, xf <= high)
    
    # Integrar potencia (área bajo la curva)
    band_powers[band_name] = np.mean(psd[idx_band])

# Normalizar a [0, 1]
total_power = sum(band_powers.values())
normalized_bands = {k: v/total_power for k, v in band_powers.items()}
```

**Resultado:**
```python
{
    'delta': 0.15,   # 15% de la potencia total
    'theta': 0.20,   # 20%
    'alpha': 0.45,   # 45% ← DOMINANTE (meditación)
    'beta': 0.15,    # 15%
    'gamma': 0.05    # 5%
}
```

---

## 🧮 **Ejemplo Matemático Completo**

### **Señal EEG de 1 segundo:**
```python
# Señal sintética: mezcla de 5 Hz (theta) + 10 Hz (alpha)
t = np.linspace(0, 1, 256)  # 1 segundo, 256 muestras
signal = np.sin(2 * np.pi * 5 * t) + 2 * np.sin(2 * np.pi * 10 * t)
#        ^^^^^^^^^^^^^^^^^^^^^^^^     ^^^^^^^^^^^^^^^^^^^^^^^^^
#        Theta (5 Hz, amplitud 1)      Alpha (10 Hz, amplitud 2)
```

### **Aplicar FFT:**
```python
yf = fft(signal)
psd = 2.0/256 * np.abs(yf[0:128])
```

### **Potencia por banda:**
```python
# Theta (4-8 Hz): incluye el componente de 5 Hz → Alta potencia
# Alpha (8-13 Hz): incluye el componente de 10 Hz → Muy alta (amplitud 2x)
# Resultado: Alpha domina
```

---

## 🎨 **Representación en el Cerebro**

### **Mapa Topográfico:**

```
Vista Superior del Cerebro:

        FRONTAL (Beta)
            ↑
    +--------------+
    | 🔴  🔴  🔴 |  ← Actividad Beta (concentración)
IZDA|             |DCHA
    | 🟢  🟢  🟢 |  ← Actividad Alpha (relajación)
    |             |
    | 🟣  🟣  🟣 |  ← Actividad Theta (meditación)
    +--------------+
            ↓
        OCCIPITAL (Alpha fuerte)

Colores:
🔴 = Alta Beta (>20 Hz)
🟢 = Alpha dominante (8-13 Hz)
🟣 = Theta (4-8 Hz)
```

### **En el código del prototipo:**

```javascript
// frontend/src/shaders/SyntergicMaterial.js

// El focal point se mueve según las frecuencias dominantes
vec3 focalPoint = uFocalPoint; // Viene del backend

// Color basado en banda dominante
if (alpha > 0.5) {
    color = vec3(1.0, 0.84, 0.0); // Dorado (meditación)
} else if (beta > 0.5) {
    color = vec3(0.0, 0.5, 1.0); // Azul (concentración)
}
```

---

## 📈 **Coherencia: La métrica clave**

### **¿Qué es la coherencia?**

Mide la **sincronización de fase** entre dos señales (hemisferios izquierdo y derecho).

```python
# backend/analysis/coherence.py

def inter_hemispheric_coherence(left, right, fs=256):
    """
    Phase Locking Value (PLV) entre hemisferios
    """
    from scipy.signal import hilbert
    
    # Transformada de Hilbert para obtener fase instantánea
    analytic_left = hilbert(left)
    analytic_right = hilbert(right)
    
    phase_left = np.angle(analytic_left)
    phase_right = np.angle(analytic_right)
    
    # Diferencia de fase
    phase_diff = phase_left - phase_right
    
    # PLV: magnitud del promedio de vectores unitarios
    plv = np.abs(np.mean(np.exp(1j * phase_diff)))
    
    return plv  # 0 = no sincronizado, 1 = perfectamente sincronizado
```

### **Interpretación:**

```
Coherencia = 0.3 (Baja):
Hemisferio Izq:  ___/‾‾‾\___
Hemisferio Der:  \___/‾‾‾\___  ← Fuera de fase

Coherencia = 0.9 (Alta):
Hemisferio Izq:  ___/‾‾‾\___
Hemisferio Der:  ___/‾‾‾\___  ← En fase (sintergia)
```

---

## 🎯 **Cómo se forma cada parámetro en el código**

### **1. Banda dominante → Estado mental**

```python
# backend/analysis/metrics.py

def infer_state(bands):
    if bands['alpha'] > 0.5:
        return "meditation"
    elif bands['beta'] + bands['gamma'] > 0.6:
        return "focused"
    elif bands['theta'] > 0.4:
        return "relaxed"
    elif bands['gamma'] > 0.3:
        return "insight"
    elif bands['delta'] > 0.4:
        return "deep_relaxation"
    else:
        return "transitioning"
```

### **2. Frecuencia dominante**

```python
# Encontrar pico más alto en el espectro
dominant_idx = np.argmax(psd)
dominant_frequency = xf[dominant_idx]  # Hz
```

### **3. Entropía (complejidad de la señal)**

```python
from scipy.stats import entropy

def spectral_entropy(psd):
    # Normalizar PSD como distribución de probabilidad
    prob_dist = psd / np.sum(psd)
    
    # Calcular entropía de Shannon
    H = entropy(prob_dist)
    
    # Normalizar a [0, 1]
    max_entropy = np.log(len(psd))
    return H / max_entropy
```

**Interpretación:**
- **Entropía baja** (0.2): Señal ordenada, dominada por 1-2 frecuencias (meditación)
- **Entropía alta** (0.8): Señal caótica, muchas frecuencias mezcladas (ansiedad)

---

## 🌟 **Conexión con la Teoría Sintérgica de Grinberg**

### **El modelo de Jacobo:**

1. **Lattice**: Campo cuántico fundamental (vacío cuántico)
2. **Interacción Neuronal**: El cerebro "perturba" la lattice
3. **Coherencia**: Mayor sincronía = Mayor acceso a la lattice
4. **Sintergia**: Estado de unificación total (coherencia máxima)

### **En el código:**

```python
# Alta coherencia + Alpha dominante = Estado sintérgico
if coherence > 0.8 and bands['alpha'] > 0.6:
    # Focal point se centra (unificación)
    focal_point = [0, 0, 0]
    
    # Color dorado (oro = sintergia)
    brain_color = "golden"
```

---

## 📚 **Referencias Científicas**

1. **Buzsáki, G. (2006)** - "Rhythms of the Brain"
   - Base teórica de oscilaciones neuronales

2. **Nunez & Srinivasan (2006)** - "Electric Fields of the Brain"
   - Teoría de campo de potenciales eléctricos

3. **Varela et al. (2001)** - "The Brainweb: Phase synchronization"
   - Phase Locking Value (PLV) y coherencia

4. **Grinberg-Zylberbaum, J. (1987)** - "La Creación de la Experiencia"
   - Teoría sintérgica y lattice

---

¿Quieres que profundice en algún aspecto específico? Por ejemplo:
- Cómo optimizar la FFT para tiempo real
- Implementar filtros IIR/FIR para limpiar señales
- Algoritmos avanzados de coherencia (Wavelet Coherence)
- Mapeo topográfico 3D de frecuencias
