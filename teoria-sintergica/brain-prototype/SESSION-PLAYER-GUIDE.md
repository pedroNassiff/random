# 📼 Session Player - Guía de Uso

## ¿Qué es?

El **Session Player** permite reproducir sesiones EEG completas cronológicamente, como si estuvieras "reviviendo" un estudio de meditación o concentración desde el inicio hasta el final. Ideal para observar evolución temporal de coherencia y estados mentales.

---

## 🎯 Casos de Uso

### 1. Estudiar Transiciones de Estado
**Objetivo**: Ver cómo cambia coherencia durante una sesión de meditación

**Protocolo típico** (dataset meditation):
```
0:00 - 5:00   → Baseline (ojos cerrados, sin instrucción)
5:00 - 25:00  → Meditación Vipassana activa
25:00 - 30:00 → Post-meditación (observación residual)
```

**Qué esperar**:
- Minutos 0-5: Alpha sube lentamente (relajación)
- Minutos 5-15: Coherencia aumenta gradualmente (sintergia emergente)
- Minutos 15-25: Coherencia estable alta (estado sostenido)
- Minutos 25-30: Coherencia baja suavemente (retorno a baseline)

---

### 2. Análisis de Onset de Coherencia
**Pregunta**: ¿Cuánto tarda un meditador en alcanzar coherencia > 0.7?

**Método**:
1. Activar Session Player
2. Observar CoherenceMeter en tiempo real
3. Usar speed 2x o 5x para acelerar
4. Anotar timestamp cuando coherencia cruza 0.7

**Comparación**:
- Principiante: 10-20 minutos
- Intermedio: 3-8 minutos
- Avanzado: 1-3 minutos
- Maestro: <1 minuto

---

### 3. Validar Hipótesis Sintérgica
**Hipótesis de Grinberg**: "Alta coherencia Alpha correlaciona con experiencias de unidad"

**Experimento**:
1. Reproducir sesión completa
2. Marcar timestamps de spikes de coherencia
3. Correlacionar con reportes fenomenológicos del sujeto
4. Validar si coherencia > 0.8 coincide con "momentos de insight"

---

## 🎮 Controles

### Botón "START SESSION PLAYBACK"
- **Qué hace**: Activa modo sesión y carga archivo EDF completo
- **Cuándo usar**: Al inicio, para cambiar de dataset a sesión

### Barra de Progreso (Progress Bar)
- **Click en cualquier punto**: Salta a ese momento de la sesión (seek)
- **Líneas verticales**: Marcadores de timeline (cada minuto o eventos)
- **Color morado**: Progreso actual

### Botones de Velocidad
- **0.5x**: Mitad de velocidad (observación detallada)
- **1.0x**: Tiempo real (experiencia natural)
- **2.0x**: Doble velocidad (overview rápido)
- **5.0x**: 5x velocidad (escaneo rápido de sesión larga)

### Botón "STOP"
- **Qué hace**: Desactiva session player, vuelve a modo dataset
- **Cuándo usar**: Para volver a RELAX/FOCUS random

---

## 📊 Información Mostrada

### Header
```
📼 SESSION PLAYER
PhysioNet Motor Imagery - Run 2 (Eyes Closed)
```
- Nombre de la sesión cargada
- Protocolo experimental

### Timeline
```
0:23 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 89.2% ━━━━ 1:01
```
- **Izquierda**: Posición actual (minutos:segundos)
- **Centro**: Porcentaje completado
- **Derecha**: Duración total

### Session Info
```
Channels: 64          Sampling: 160 Hz
Protocol: Resting State - Eyes Closed
```
- Metadatos técnicos del archivo EDF

---

## 📚 Datasets Disponibles

### Dataset Actual (PhysioNet Motor Imagery)
**Archivo**: `S001R02.edf` (Eyes Closed Baseline)
- **Duración**: ~1 minuto
- **Protocolo**: Ojos cerrados, reposo
- **Limitación**: No es meditación formal, solo relajación

**Estados esperados**:
- Delta/Theta alto (somnolencia)
- Alpha moderado (relajación)
- Coherencia baja-media (no entrenado)

---

### Datasets Futuros (Para descargar manualmente)

#### 1. **PhysioNet Meditation Dataset** ⭐ Recomendado
**URL**: https://physionet.org/content/meditate/1.0.0/

**Características**:
- 14 sujetos expertos en Vipassana
- Sesiones de 30 minutos (Baseline + Meditation + Post)
- 128 canales @ 500 Hz
- **IDEAL para observar sintergia**

**Cómo usar**:
1. Descargar archivos EDF de PhysioNet
2. Colocar en `backend/data/meditation/`
3. Modificar `session_player.py` línea 75 para cargar ruta
4. Reiniciar backend

**Protocolo típico**:
```python
# En session_player.py, método load_meditation_session():
edf_path = 'backend/data/meditation/S001_meditation.edf'
self.load_session(edf_path)
```

**Timeline esperada**:
```
0:00 - Inicio baseline
5:00 - Inicio meditación (Alpha sube)
10:00 - Coherencia cruza 0.7 (sintergia)
20:00 - Coherencia máxima sostenida
25:00 - Fin meditación
30:00 - Fin sesión
```

---

#### 2. **SEED Emotion Dataset**
**URL**: http://bcmi.sjtu.edu.cn/~seed/

**Características**:
- Sujetos viendo videos (feliz/triste/neutral)
- Sesiones de 3-5 minutos por emoción
- 62 canales @ 1000 Hz
- **IDEAL para ver transiciones emocionales**

**Casos de uso**:
- Ver cómo coherencia cambia con emoción
- Detectar spikes de Gamma en momentos "felices"
- Comparar Beta (neutral) vs Alpha (relajado)

---

#### 3. **TUH EEG (Temple University Hospital)**
**URL**: https://www.isip.piconepress.com/projects/tuh_eeg/

**Características**:
- EEG clínico, sesiones de 20-60 minutos
- Datos continuos sin cortes
- Protocolos variados (meditación, tareas, reposo)
- **MÁS REALISTA**: Datos de uso clínico real

**Limitación**: Requiere registro y aprobación institucional

---

## 🔧 Implementación Técnica

### Backend: SessionPlayer Class
**Archivo**: `backend/ai/session_player.py`

**Métodos principales**:
```python
# Cargar sesión
player.load_session('path/to/file.edf')

# Obtener ventana actual
window = player.next_window()  # Devuelve Dict con data + metadata

# Navegar
player.seek(120.0)  # Saltar a segundo 120
player.set_speed(2.0)  # Doble velocidad

# Estado
status = player.get_status()  # Progreso, duración, metadata
```

**Ventajas vs Dataset**:
- ✅ Reproducción secuencial (no aleatoria)
- ✅ Timeline completa observable
- ✅ Control de navegación (seek/speed)
- ✅ Metadata de protocolo experimental

---

### API Endpoints

#### POST `/set-mode/session`
Activa modo sesión player
```bash
curl -X POST http://localhost:8000/set-mode/session
```

#### GET `/session/status`
Estado actual del reproductor
```json
{
  "session_active": true,
  "current_position": 125.4,
  "total_duration": 300.0,
  "progress_percent": 41.8,
  "playback_speed": 1.0,
  "session_metadata": {
    "name": "S001 Meditation Session",
    "protocol": "Vipassana 20min",
    "channels": 128,
    "sampling_rate": 500
  }
}
```

#### POST `/session/seek/{seconds}`
Salta a posición específica
```bash
curl -X POST http://localhost:8000/session/seek/180
# Salta a minuto 3:00
```

#### POST `/session/speed/{speed}`
Ajusta velocidad
```bash
curl -X POST http://localhost:8000/session/speed/2.0
# Doble velocidad
```

#### GET `/session/timeline`
Marcadores de timeline
```json
{
  "markers": [
    {"time": 0.0, "label": "Session Start", "type": "start"},
    {"time": 60.0, "label": "1min", "type": "marker"},
    {"time": 300.0, "label": "Meditation Start", "type": "event"},
    {"time": 1800.0, "label": "Session End", "type": "end"}
  ],
  "total_duration": 1800.0
}
```

---

## 🎬 Workflow Recomendado

### Análisis de Sesión Completa

**Paso 1: Cargar sesión**
1. Click en "START SESSION PLAYBACK"
2. Verificar que metadata se carga correctamente
3. Observar duración total

**Paso 2: Overview rápido (5x)**
1. Set speed a 5.0x
2. Observar CoherenceMeter durante toda la sesión
3. Identificar "picos" interesantes
4. Anotar timestamps aproximados

**Paso 3: Análisis detallado (1x o 0.5x)**
1. Seek a primer pico identificado
2. Set speed a 1.0x (tiempo real)
3. Observar transición en detalle:
   - ¿Cómo sube coherencia?
   - ¿Qué bandas cambian primero?
   - ¿Hay spike de Gamma antes del pico Alpha?
4. Anotar datos en notebook

**Paso 4: Exportar timeline**
```bash
# Obtener marcadores
curl http://localhost:8000/session/timeline > session_timeline.json

# Anotar momentos de interés
# Ej: 
# 125s - Coherence spike to 0.89
# 180s - Gamma burst (insight?)
# 240s - Sustained alpha > 70%
```

---

## 📈 Casos de Estudio Ejemplo

### Caso 1: Meditador Novato
**Sesión**: 20 minutos Vipassana

**Timeline observada**:
```
0:00  - Coherence: 0.32 (baseline bajo)
2:30  - Coherence: 0.45 (lento aumento)
8:15  - Coherence: 0.58 (meseta)
12:00 - Coherence spike: 0.72 (primer momento sintérgico)
12:45 - Coherence drop: 0.51 (perdió foco)
15:30 - Coherence: 0.65 (recuperación)
20:00 - Coherence: 0.48 (fin)
```

**Análisis**:
- Tardó ~12 minutos en alcanzar sintergia
- No sostuvo estado (duró ~45 segundos)
- Coherencia final < inicial (fatiga cognitiva)

**Interpretación**: Principiante sin entrenamiento formal

---

### Caso 2: Meditador Avanzado
**Sesión**: 30 minutos Vipassana

**Timeline observada**:
```
0:00  - Coherence: 0.52 (baseline ya elevado)
1:45  - Coherence: 0.74 (rápido onset)
3:00  - Coherence: 0.83 (sintergia profunda)
3:00-25:00 - Coherence SOSTENIDA 0.80-0.92 (22 minutos!)
18:20 - Gamma spike: 0.41 (posible insight)
25:00 - Coherence: 0.78 (inicio descenso)
30:00 - Coherence: 0.61 (fin, aún elevado)
```

**Análisis**:
- Onset en <2 minutos
- Sostuvo sintergia 22 minutos continuos
- Gamma spike a mitad (momento "aha")
- Coherencia final > baseline (efecto residual)

**Interpretación**: Meditador experto con >1000 horas de práctica

---

## 🚀 Próximos Pasos

### Implementaciones Futuras

**1. Anotaciones Manuales**
- Click en timeline para agregar notas
- "Momento de insight detectado por sujeto"
- Exportar timeline anotada

**2. Comparación Multi-Sesión**
- Cargar 2+ sesiones simultáneamente
- Overlay de coherencia de ambas
- Identificar patrones comunes

**3. Auto-Detección de Eventos**
- Algoritmo detecta automáticamente:
  - Onset de coherencia (cruza threshold)
  - Spikes de Gamma (> 30%)
  - Transiciones de estado (meditation → insight)
- Genera timeline con marcadores automáticos

**4. Exportar Datos**
- CSV con valores por segundo
- Para análisis estadístico en R/Python
- Gráficas de coherencia vs tiempo

---

## 🎓 Referencias Científicas

**Datasets Meditation**:
- Brandmeyer, T., & Delorme, A. (2020). "Meditation and the wandering mind: a theoretical framework of underlying neurocognitive mechanisms"
- Saggar, M., et al. (2015). "Intensive training induces longitudinal changes in meditation state-related EEG oscillatory activity"

**Coherencia y Meditación**:
- Lutz, A., et al. (2004). "Long-term meditators self-induce high-amplitude gamma synchrony"
- Travis, F., & Shear, J. (2010). "Focused attention, open monitoring and automatic self-transcending: Categories to organize meditations"

**Análisis Longitudinal**:
- Cahn, B. R., & Polich, J. (2006). "Meditation states and traits: EEG, ERP, and neuroimaging studies"

---

## 📞 Soporte

**Problemas Comunes**:

**"Session player no carga"**
→ Verificar que archivo EDF existe en `backend/data/`
→ Check logs del backend (errores de MNE)

**"Timeline no muestra marcadores"**
→ Sesión < 10 minutos (solo muestra start/end)
→ Agregar marcadores manualmente en `get_timeline_markers()`

**"Audio no sincroniza con sesión"**
→ Expected, audio es independiente de timeline
→ Usar coherencia de session data para modular audio

---

**Autor**: Pedro Nassiff  
**Versión**: 1.0.0 (Session Player)  
**Fecha**: 12 de diciembre de 2025
