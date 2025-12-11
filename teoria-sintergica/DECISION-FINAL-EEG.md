# 🎯 DECISIÓN FINAL: EEG para Experimentos Sintérgicos

## TL;DR - COMPRA ESTO:

# **MUSE 2** ($250 USD)

---

## ¿Por qué Muse 2 es LA MEJOR opción para ti?

### ✅ Razones Principales

#### 1. **RELACIÓN CALIDAD-PRECIO IMBATIBLE**
- **Precio**: $250 USD (vs. $500 OpenBCI, vs. $1,200 Neurosity)
- **Performance**: Suficiente para validar Teoría Sintérgica
- **Ahorro**: $250-950 USD que puedes invertir en otras cosas

#### 2. **LISTO PARA USAR (0 montaje)**
- Llega → Lo pones → Funciona
- App móvil lista (iOS + Android)
- No necesitas soldar NADA
- No necesitas programar para comenzar

#### 3. **DATOS CIENTÍFICOS REALES**
- **4 canales EEG**: TP9, AF7, AF8, TP10 (suficiente para coherencia)
- **256 Hz sampling rate**: Excelente para ondas cerebrales
- **Exportación CSV**: Acceso completo a datos crudos
- **Compatible con Python/MNE**: Análisis profesional

#### 4. **PROBADO EN INVESTIGACIÓN**
- **250+ papers científicos** publicados usando Muse
- Validado contra EEG clínico (correlación >0.8)
- Universidades lo usan para estudios preliminares

#### 5. **COMPATIBLE CON TODO**
- ✅ iPhone (Bluetooth)
- ✅ Mac/PC (via Bluetooth o USB dongle)
- ✅ Python (biblioteca `muselsl`)
- ✅ Unity/JavaScript (si quieres hacer interfaces)

---

## 📊 Comparación Final

| Característica | **Muse 2** ⭐ | OpenBCI Cyton | Neurosity Crown | DIY ADS1299 |
|----------------|---------------|---------------|-----------------|-------------|
| **Precio** | **$250** | $500 | $1,200 + $300/año | $120 + tiempo |
| **Canales EEG** | 4 | 8 (16 con Daisy) | 8 | 8 |
| **Listo para usar** | **SÍ ✅** | Casi (setup medio) | SÍ | NO (soldar) |
| **Tiempo hasta experimento** | **1 día** | 3-5 días | 1 día | 2-4 semanas |
| **Comodidad** | **⭐⭐⭐⭐⭐** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Batería** | **10 horas** | ~8 horas | 3 horas | 4-6 horas |
| **Datos exportables** | **CSV (raw data)** | CSV/BDF | API | CSV |
| **Ideal para** | **Meditación, coherencia** | Investigación avanzada | Focus tracking | Hackers |
| **Curva aprendizaje** | **⭐ Fácil** | ⭐⭐⭐ Media | ⭐⭐ Fácil-Media | ⭐⭐⭐⭐⭐ Difícil |

---

## 🧪 Qué Puedes Hacer con Muse 2

### Experimentos de Grinberg Replicables:

#### ✅ 1. Coherencia Neuronal en Meditación
- Medir coherencia alpha/theta durante meditación
- Comparar meditadores vs no-meditadores
- **Canales suficientes**: Sí (necesitas mínimo 2-4)

#### ✅ 2. Orbitales de Conciencia
- Detectar transiciones entre estados
- Mapear ondas cerebrales en diferentes prácticas
- **Factible**: Sí

#### ⚠️ 3. Potencial Transferido (versión simplificada)
- Puedes medir correlación entre 2 personas con 2 Muse
- No tan preciso como EEG de 32 canales
- **Factible**: Sí, con limitaciones

#### ❌ 4. Mapeo cerebral completo
- No (necesitarías 19+ canales)
- Pero no es necesario para validar hipótesis principal

---

## 💻 Setup Técnico

### Opción A: Uso Inmediato (App)

```
1. Descargar "Muse" app (gratis)
2. Conectar via Bluetooth
3. Meditar 10 minutos
4. Exportar datos
5. Analizar con Python
```

### Opción B: Streaming en Tiempo Real (Python)

```bash
# Instalar biblioteca Muse
pip install muselsl mne

# Streaming en vivo
muselsl stream

# En otro terminal: Grabar datos
muselsl record --duration 600  # 10 minutos

# Analizar
python analizar_muse_eeg.py
```

### Código Python para Muse 2

```python
from muselsl import stream, list_muses, record
from pylsl import StreamInlet, resolve_byprop
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

# 1. Conectar a Muse
muses = list_muses()
stream(muses[0]['address'])

# 2. Recibir datos
streams = resolve_byprop('type', 'EEG', timeout=5)
inlet = StreamInlet(streams[0])

# 3. Capturar 5 minutos
eeg_data = []
for i in range(300 * 256):  # 5 min * 256 Hz
    sample, timestamp = inlet.pull_sample()
    eeg_data.append(sample)

eeg_data = np.array(eeg_data)

# 4. Calcular coherencia inter-hemisférica
# TP9 (izq) vs TP10 (der)
left_hemisphere = eeg_data[:, 0]   # TP9
right_hemisphere = eeg_data[:, 3]  # TP10

# Coherencia en banda alpha (8-13 Hz)
f, Cxy = signal.coherence(left_hemisphere, right_hemisphere, fs=256)
alpha_band = (f >= 8) & (f <= 13)
alpha_coherence = np.mean(Cxy[alpha_band])

print(f"Coherencia Alpha: {alpha_coherence:.3f}")

# Si alpha_coherence > 0.7 → Alta coherencia (meditación profunda)
```

---

## 🚀 Plan de Acción

### Semana 1: Compra y Setup
```
Día 1: Ordenar Muse 2 ($250)
       Amazon: https://www.amazon.com/Muse-Brain-Sensing-Headband/dp/B07HL2S9JQ
       
Día 3: Llega el dispositivo
       - Cargar batería (3 horas)
       - Descargar app
       - Hacer primera sesión

Día 4-7: Familiarización
       - 3 sesiones diarias (10 min c/u)
       - Probar exportación datos
       - Instalar muselsl en Mac
```

### Semana 2-3: Experimentos Básicos
```
- Protocolo coherencia (con Polar H10 + Muse 2 simultáneos)
- Medir HRV + EEG al mismo tiempo
- Validar correlación coherencia cardíaca ↔ coherencia neuronal
```

### Mes 2+: Replicar Grinberg
```
- Experimento formal (N=10 sujetos)
- Análisis estadístico
- Comparar con papers originales
```

---

## 🔧 Si Necesitas Más Canales DESPUÉS

**Upgrade Path** (opcional, solo si Muse 2 te convence):

1. **Comprar segundo Muse 2** ($250) 
   - Total 8 canales entre ambos
   - Sincronizar con Lab Streaming Layer (LSL)

2. **Comprar OpenBCI Cyton** ($500)
   - 8 canales profesionales
   - Solo si necesitas research-grade para publicar

3. **Nunca compres** Neurosity Crown
   - Muy caro ($1,200 + $300/año)
   - No vale la pena para investigación
   - Más enfocado a "productividad" que ciencia

---

## ❌ Por Qué NO Comprar los Otros

### OpenBCI Cyton ($500)
- ❌ **Doble de precio** que Muse 2
- ❌ **Setup más complejo** (electrodos pasivos, gel, etc.)
- ❌ **Menos cómodo** para sesiones largas
- ✅ **Solo si**: Vas a publicar papers y necesitas research-grade

### Neurosity Crown ($1,200 + $300/año)
- ❌ **5X más caro** que Muse 2
- ❌ **Batería 3 horas** (vs. 10 de Muse)
- ❌ **Modelo de suscripción** (WTF?)
- ❌ **Orientado a "productividad"**, no investigación
- ❌ **NO VALE LA PENA**

### DIY ADS1299 ($120)
- ❌ **Requiere soldar** componentes SMD (muy difícil)
- ❌ **Semanas de trabajo** para que funcione
- ❌ **Sin garantía**
- ❌ **Posibles riesgos de seguridad** (voltajes en la cabeza)
- ✅ **Solo si**: Eres ingeniero electrónico masoquista

---

## 💰 Inversión Total Recomendada

### Setup Mínimo (comenzar YA)
```
Polar H10:        $90
Muse 2:          $250
Electrodos extra: $15
                ------
TOTAL:           $355
```

Con esto tienes:
- ✅ HRV de grado científico (Polar)
- ✅ EEG de 4 canales (Muse)
- ✅ 0 montaje, 0 soldadura
- ✅ Listo en 3 días

### Setup Avanzado (si te encanta después de 3 meses)
```
Polar H10:         $90
Muse 2:           $250
Segundo Muse 2:   $250
OpenBCI Cyton:    $500 (opcional)
                 ------
TOTAL:        $590-1,090
```

---

## 🎯 DECISIÓN FINAL

### COMPRA AHORA:

1. **[Polar H10](https://www.amazon.com/s?k=polar+h10)** - $90
   - Para HRV (gold standard)

2. **[Muse 2](https://www.amazon.com/Muse-Brain-Sensing-Headband/dp/B07HL2S9JQ)** - $250  
   - Para EEG (4 canales, perfecto para coherencia)

**Total: $340 USD**

**Tiempo hasta primer experimento completo: 5 días**

---

## 📚 Recursos Muse 2

### Documentación
- [Muse Developer Docs](https://mind-monitor.com/technical.php)
- [MuseLSL Library](https://github.com/alexandrebarachant/muse-lsl)
- [MNE-Python Muse Tutorial](https://mne.tools/stable/auto_tutorials/index.html)

### Papers que usaron Muse
- "Validation of Muse headset" - Krigolson et al. (2017)
- "Consumer-grade EEG for meditation research" - Ratti et al. (2017)
- Buscar en Google Scholar: "Muse headband EEG coherence meditation"

---

## ✅ Checklist Pre-Compra

- [ ] Confirmar compatibilidad iPhone 12 ✅ (Bluetooth 5.0)
- [ ] Verificar que Amazon envía a tu país
- [ ] Leer 2-3 reviews en Amazon
- [ ] Instalar app Muse antes de que llegue
- [ ] Instalar Python + muselsl en tu Mac
- [ ] Tener listo script de análisis (te lo doy)

---

¿Listo para ordenar? Te preparo el código Python completo para cuando te lleguen los dispositivos 🚀
