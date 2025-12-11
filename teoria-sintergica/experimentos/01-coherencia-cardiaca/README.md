# Experimento 1: Coherencia Cardíaca y Meditación
## Investigación de Variabilidad del Ritmo Cardíaco (HRV) como Proxy de Coherencia

---

## 🎯 Objetivo del Experimento

Replicar y validar la relación entre:
1. **Práctica meditativa** → Aumento de coherencia cardíaca (HRV)
2. **Coherencia cardíaca** → Proxy de coherencia neuronal (según hipótesis sintérgica)

### Hipótesis
- **H1**: La meditación aumenta HRV coherente (ritmo cardíaco más regular y sincronizado con respiración)
- **H2**: Meditadores experimentados muestran HRV basal más alta que no-meditadores
- **H3**: Estados de alta coherencia cardíaca correlacionan con sensación subjetiva de "claridad mental"

---

## 📚 Fundamento Teórico

### Coherencia Cardíaca
- **HRV (Heart Rate Variability)**: Variación en intervalos entre latidos cardíacos
- **HRV alta**: Sistema nervioso autónomo flexible (parasimpático activo)
- **HRV baja**: Estrés crónico, rigidez autonómica

### Conexión con Teoría Sintérgica
- Coherencia cardíaca ↔ Coherencia neuronal (evidencia indirecta)
- Sistema nervioso autónomo regulado por corteza prefrontal
- Meditación → aumenta coherencia neuronal → mejora regulación autonómica → HRV alta

Instituto HeartMath ha investigado esto extensamente, complementando investigación de Grinberg.

---

## 🔧 Hardware Necesario

- Arduino Uno
- Sensor MAX30102 o MAX30105 (pulso/oxímetro)
- Cables de conexión
- Computadora/Raspberry Pi para análisis

---

## ⚙️ Setup

### Circuito
Ver `hardware-setup.md` para conexiones MAX30102 ↔ Arduino

### Código Arduino

**Archivo**: `arduino/hrv_captura.ino`

```cpp
/*
 * Captura de HRV para Experimento Sintérgico
 * Mide intervalos R-R (inter-beat intervals)
 */

#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

MAX30105 particleSensor;

const byte RATE_SIZE = 10;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
long lastIBI = 0;  // Inter-Beat Interval
float beatsPerMinute;

void setup() {
  Serial.begin(115200);
  
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("ERROR: MAX30105 no encontrado");
    while (1);
  }
  
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);
  
  Serial.println("timestamp_ms,ibi_ms,bpm,ir_raw");
}

void loop() {
  long irValue = particleSensor.getIR();
  
  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    lastIBI = delta;
    
    beatsPerMinute = 60000.0 / (float)delta;
    
    if (beatsPerMinute < 180 && beatsPerMinute > 40) {
      // Enviar: timestamp, IBI, BPM, señal cruda
      Serial.print(millis());
      Serial.print(",");
      Serial.print(lastIBI);
      Serial.print(",");
      Serial.print(beatsPerMinute, 2);
      Serial.print(",");
      Serial.println(irValue);
    }
  }
  
  delay(20);
}
```

---

## 📝 Protocolo Experimental

### Diseño
**Intra-sujeto**: Cada participante es su propio control

### Condiciones
1. **Línea Base** (5 min): Reposo, respiración normal
2. **Estresor** (3 min): Tarea cognitiva (contar hacia atrás desde 1000 de 7 en 7)
3. **Recuperación** (3 min): Reposo
4. **Meditación** (10 min): Meditación atencional (foco en respiración)
5. **Post-meditación** (5 min): Reposo

### Participantes
- **Grupo A**: Meditadores (>1 año práctica diaria)
- **Grupo B**: No-meditadores
- N mínimo: 10 por grupo

### Variables Medidas
- **IBI (Inter-Beat Interval)**: Milisegundos entre latidos
- **SDNN**: Desviación estándar de IBI (HRV en tiempo)
- **RMSSD**: Raíz media cuadrada de diferencias sucesivas
- **pNN50**: % de IBI que difieren >50ms del anterior
- **LF/HF ratio**: Ratio baja frecuencia / alta frecuencia (análisis espectral)

---

## 💻 Script de Análisis (Python)

**Archivo**: `raspberry/analizar_hrv.py`

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal
from scipy.stats import ttest_ind
import seaborn as sns

def calcular_hrv(ibi_data):
    """
    Calcula métricas HRV desde datos IBI
    ibi_data: array de intervalos inter-beat en ms
    """
    # Filtrar outliers (IBIs demasiado cortos/largos = artefactos)
    ibi_clean = ibi_data[(ibi_data > 400) & (ibi_data < 2000)]
    
    if len(ibi_clean) < 10:
        return None
    
    # Métricas tiempo
    sdnn = np.std(ibi_clean)
    rmssd = np.sqrt(np.mean(np.diff(ibi_clean)**2))
    
    # pNN50
    diff_ibi = np.abs(np.diff(ibi_clean))
    pnn50 = 100 * np.sum(diff_ibi > 50) / len(diff_ibi)
    
    # Análisis frecuencia (requiere interpolar a señal equiespaciada)
    # Simplificado aquí - usar HRV python library para completo
    
    return {
        'SDNN': sdnn,
        'RMSSD': rmssd,
        'pNN50': pnn50,
        'Mean_IBI': np.mean(ibi_clean),
        'BPM': 60000 / np.mean(ibi_clean)
    }

def analizar_sesion(filename):
    """Analiza archivo CSV de una sesión"""
    df = pd.read_csv(filename)
    
    # Separar por condición (requiere timestamps anotados manualmente)
    # Aquí simplificado: dividir en bloques
    duracion_total = (df['timestamp_ms'].iloc[-1] - df['timestamp_ms'].iloc[0]) / 1000 / 60
    print(f"Duración: {duracion_total:.1f} minutos")
    
    # Calcular HRV para toda la sesión
    hrv_metrics = calcular_hrv(df['ibi_ms'].values)
    
    print("\n--- Métricas HRV ---")
    for key, val in hrv_metrics.items():
        print(f"{key}: {val:.2f}")
    
    # Visualizar
    fig, axes = plt.subplots(3, 1, figsize=(12, 10))
    
    # Plot 1: Serie temporal IBI
    axes[0].plot(df['timestamp_ms']/1000/60, df['ibi_ms'], linewidth=0.5)
    axes[0].set_xlabel('Tiempo (min)')
    axes[0].set_ylabel('IBI (ms)')
    axes[0].set_title('Intervalos Inter-Beat')
    axes[0].grid(True, alpha=0.3)
    
    # Plot 2: BPM
    axes[1].plot(df['timestamp_ms']/1000/60, df['bpm'], color='red', linewidth=0.7)
    axes[1].set_xlabel('Tiempo (min)')
    axes[1].set_ylabel('BPM')
    axes[1].set_title('Frecuencia Cardíaca')
    axes[1].grid(True, alpha=0.3)
    
    # Plot 3: HRV deslizante (ventana 60 segundos)
    window = 60  # segundos
    hrv_sliding = []
    times_sliding = []
    
    for i in range(0, len(df)-10, 5):
        window_data = df.iloc[i:min(i+60, len(df))]
        if len(window_data) > 10:
            hrv_val = calcular_hrv(window_data['ibi_ms'].values)
            if hrv_val:
                hrv_sliding.append(hrv_val['SDNN'])
                times_sliding.append(window_data['timestamp_ms'].iloc[0]/1000/60)
    
    axes[2].plot(times_sliding, hrv_sliding, color='green', linewidth=1)
    axes[2].set_xlabel('Tiempo (min)')
    axes[2].set_ylabel('SDNN (ms)')
    axes[2].set_title('HRV deslizante (ventana 60s)')
    axes[2].grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig(f"{filename.replace('.csv', '_analisis.png')}")
    plt.show()
    
    return hrv_metrics

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python3 analizar_hrv.py <archivo.csv>")
    else:
        analizar_sesion(sys.argv[1])
```

---

## 🧪 Procedimiento Paso a Paso

### Día del Experimento

#### 1. Preparación (10 min antes)
- Montar circuito Arduino + MAX30102
- Conectar a Raspberry Pi/PC
- Colocar sensor en dedo índice del participante
- Asegurar buen contacto (no muy apretado)
- Dejar que la señal se estabilice (2-3 min)

#### 2. Captura de Datos
```bash
# En Raspberry Pi
cd teoria-sintergica/
python3 raspberry/captura_datos.py
```

**Protocolo verbal al participante:**
```
"Vamos a registrar tu ritmo cardíaco durante diferentes actividades.
Trata de mantenerte quieto y relajado.

1. (0-5 min): Respira normalmente, ojos abiertos, observa la pared.
2. (5-8 min): Cuenta hacia atrás desde 1000 de 7 en 7 mentalmente.
3. (8-11 min): Descansa, respira normalmente.
4. (11-21 min): Meditación - enfoca atención en tu respiración.
5. (21-26 min): Descansa, respira normalmente.
```

Anotar timestamps de cada transición en hoja de papel.

#### 3. Análisis
```bash
python3 raspberry/analizar_hrv.py datos/sujeto01_20250130.csv
```

---

## 📊 Resultados Esperados

### Si Hipótesis Sintérgica es Correcta

#### En Meditadores vs. No-meditadores
- **SDNN meditadores** > SDNN no-meditadores (en línea base)
- **RMSSD meditadores** > RMSSD no-meditadores

#### Durante Meditación
- Aumento de SDNN (~20-40% respecto a línea base)
- Patrón más coherente (ritmo sinusoidal regular en IBI)
- Sincronización cardio-respiratoria visible

#### Durante Estresor
- Disminución de HRV
- Recuperación más rápida en meditadores

### Valores de Referencia (Literatura)

| Condición | SDNN (ms) | RMSSD (ms) |
|-----------|-----------|------------|
| Estrés agudo | 20-40 | 15-25 |
| Reposo normal | 40-80 | 25-50 |
| Meditación | 80-150 | 50-100 |

---

## 📋 Registro de Datos

### Hoja de Participante

```
EXPERIMENTO: Coherencia Cardíaca y Meditación
Fecha: ___________
Sujeto ID: ___________
Grupo: [ ] Meditador (años práctica: ___ ) [ ] No-meditador

Condiciones:
[00:00 - 05:00] Línea Base
[05:00 - 08:00] Estresor cognitivo
[08:00 - 11:00] Recuperación
[11:00 - 21:00] Meditación
[21:00 - 26:00] Post-meditación

Notas observacionales:
_____________________________________
_____________________________________

Sensación subjetiva post-meditación (1-10):
- Claridad mental: ___
- Relajación: ___
- Consciencia corporal: ___
```

---

## 🔬 Análisis Estadístico

### Comparar Grupos (Meditadores vs. No-meditadores)

```python
# En Python
from scipy.stats import ttest_ind, mannwhitneyu

# Cargar datos de todos los sujetos
meditadores_sdnn = [85, 92, 78, 110, 95, ...]  # Ejemplo
no_meditadores_sdnn = [45, 52, 38, 60, 48, ...]

# Test t (si distribución normal) o Mann-Whitney (si no)
t_stat, p_value = ttest_ind(meditadores_sdnn, no_meditadores_sdnn)

print(f"t-statistic: {t_stat:.3f}")
print(f"p-value: {p_value:.4f}")

if p_value < 0.05:
    print("Diferencia SIGNIFICATIVA")
else:
    print("Sin diferencia significativa")
```

---

## 💡 Extensiones del Experimento

### 1. Coherencia Cardio-Respiratoria
- Añadir sensor de respiración (termistor en nariz)
- Calcular correlación entre ritmo cardíaco y respiración
- Meditadores deberían mostrar mayor sincronización

### 2. Biofeedback en Tiempo Real
- Mostrar HRV en pantalla durante meditación
- Entrenar aumento voluntario de coherencia
- Gamificación (luces LED que cambian con coherencia)

### 3. Correlación con EEG
- Si tienes OpenBCI: Capturar HRV + EEG simultáneamente
- Calcular correlación entre coherencia cardíaca y coherencia neuronal (alpha, theta)
- Validación directa de hipótesis sintérgica

---

## 📖 Lectura Complementaria

- **HeartMath Institute** - Research on Heart Coherence
- **"The HeartMath Solution"** - Doc Childre & Howard Martin
- **Paper**: Grinberg - "Brain-Heart Coherence in Meditation" (si disponible)

---

## ✅ Checklist Pre-Experimento

- [ ] Hardware probado y funcionando
- [ ] Código Arduino cargado y testeado
- [ ] Script Python de análisis funcional
- [ ] Consentimientos informados de participantes
- [ ] Ambiente tranquilo sin interrupciones
- [ ] Sensor limpio y funcionando correctamente
- [ ] Protocolo impreso para referencia
- [ ] Hojas de registro preparadas

---

¿Listo para tu primera sesión experimental? 📈🧘‍♂️
