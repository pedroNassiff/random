
---
proyecto: SANJI-RX
subtitulo: Plataforma adaptativa de recuperación neurológica felina post-isquemia
autor: Pedro / Random Lab
estado: Spec v0.1 — Blueprint inicial
basado_en: ADA/Lab Brain (mismo stack, mismos principios)
ultima_revision: 2026-05-16
---

# SANJI-RX

> **Misión.** Construir un sistema continuo, multimodal y adaptativo que mida, modele y potencie la recuperación de Sanji después de un evento de isquemia cerebral global con convulsiones secundarias, integrando datos manuales, visuales (cámara), acústicos (audio), fisiológicos y contextuales en una sola plataforma con inferencia, alertas, y recomendaciones diarias.

> **Principio rector.** *Hasta donde sabemos, con rigor. Más allá, lo marcamos como exploratorio y lo estudiamos antes de actuar sobre ello.* Cada inferencia tiene grado de confianza explícito. Cada predicción está acompañada de los datos que la sustentan.

---

## 0. TL;DR

- **Stack:** FastAPI + React + PostgreSQL (+ pgvector) + InfluxDB + WebSockets. Mismo terreno que ADA/Lab Brain.
- **Inputs:** manuales (bitácora diaria), cámara (postura, marcha, eventos motores), audio (vocalizaciones, ruido ambiente), métricas derivadas y, opcionalmente, biosensores no invasivos.
- **Modelos:** detección + tracking del gato, pose estimation, clasificación de vocalizaciones, detección de anomalías en series temporales, modelo predictivo de "estado del día".
- **Salida:** dashboard con vista 3D del cuerpo de Sanji + heatmap de áreas en recuperación, panel de tendencia, alertas, recomendaciones diarias generadas por reglas + LLM.
- **Puente con ADA:** captura simultánea del estado autonómico del cuidador (Pedro vía Muse + HRV) para medir empíricamente la co-regulación humano-animal — operacionalización de la hipótesis sintérgica.

---

## 1. Modelo conceptual

### 1.1 Vectores de salud monitoreados

Cada vector tiene un score derivado de múltiples features. Los scores son interpretables y trazables a sus inputs.

| Vector | Qué mide | Fuente principal |
|---|---|---|
| Neurológico | Eventos epileptiformes, estabilidad postural, simetría motora | Cámara + manual |
| Sensorial | Reactividad a estímulos (umbral de sobresalto), patrones de retracción | Audio + cámara |
| Motor / propioceptivo | Calidad de marcha, saltos, equilibrio | Cámara + pose estimation |
| Digestivo | Apetito, hidratación, defecación, vómitos | Manual + balanza opcional |
| Emocional / vincular | Búsqueda de contacto, ronroneo, exploración | Audio + cámara + manual |
| Cognitivo | Resolución de tareas, memoria de ubicaciones | Manual (con protocolos) |
| Sueño / circadiano | Latencia, fragmentación, duración | Cámara (actigrafía) |
| Co-regulación | Sincronía con cuidador | ADA/Muse + cámara |

### 1.2 Estados latentes inferidos

A partir de los features observados, el sistema estima estados no directamente observables:

- **Excitabilidad cortical** (proxy de umbral convulsivo) — clave clínica.
- **Carga alostática** (acumulación de estrés fisiológico).
- **Plasticidad activa** (estimación de ventana de aprendizaje).
- **Confort / displacer subjetivo** (estimación, con incertidumbre alta y declarada).

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAPTURA                                  │
├─────────────────────────────────────────────────────────────────┤
│  Cámara IP/RTSP   Micrófono ambiente   Webhook manual (React)   │
│  Webcam local     Balanza opcional     Muse 2 (cuidador, ADA)   │
└──────────┬──────────────┬─────────────────┬─────────────────────┘
           │              │                 │
           ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│            INGESTA / EDGE PROCESSING                             │
│  • frames @ 5-10 fps  • windows de audio 1-3 s                  │
│  • buffer circular en RAM                                       │
│  • compresión + sampling adaptativo                             │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            PIPELINE DE FEATURES (workers async)                  │
│  Visual: YOLO → tracker → pose 2D → keypoints                   │
│  Audio: VAD → mel-spectrogram → embeddings → clasificador       │
│  Derived: actigrafía, latencia, simetría L/R, gait cycle        │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            ALMACENAMIENTO                                        │
│  PostgreSQL    │  Eventos, sesiones, observaciones,             │
│   + pgvector   │  embeddings, alertas, recomendaciones          │
│  InfluxDB      │  Time-series continuas (features 1Hz–100Hz)    │
│  Object store  │  Clips de video/audio cortos (Cloudflare R2 /  │
│                │  GCS) con TTL configurable                     │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            INFERENCIA                                            │
│  • Detección de anomalías temporales (Isolation Forest, LSTM-AE)│
│  • Clasificador de eventos motores (convulsión vs normal)       │
│  • Clasificador de vocalizaciones                               │
│  • Score por vector + estado global del día                     │
│  • LLM (Claude API) para recomendaciones contextualizadas       │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            API (FastAPI) + REALTIME (WebSockets)                 │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            FRONTEND (React + R3F)                                │
│  • Dashboard tendencias  • Modelo 3D del gato                   │
│  • Bitácora rápida       • Timeline eventos                     │
│  • Alertas               • Vista co-regulación cuidador         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Modelo de datos

### 3.1 PostgreSQL — entidades principales

```sql
-- Sujeto (Sanji, extensible)
CREATE TABLE subjects (
  id           UUID PRIMARY KEY,
  name         TEXT NOT NULL,
  species      TEXT NOT NULL,
  birth_date   DATE,
  weight_kg    NUMERIC(4,2),
  baseline     JSONB,            -- features de baseline pre-evento si existen
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Evento clínico (isquemia, convulsión, cambio de medicación)
CREATE TABLE clinical_events (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  kind         TEXT NOT NULL,    -- 'seizure_focal', 'seizure_generalized',
                                 -- 'medication_change', 'vet_visit', 'imaging'
  severity     INT,              -- 0-5
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  notes        TEXT,
  evidence     JSONB,            -- refs a clips, screenshots, archivos
  detected_by  TEXT,             -- 'human', 'video_model', 'audio_model'
  confidence   NUMERIC(3,2)      -- 0.00-1.00
);
CREATE INDEX ON clinical_events(subject_id, started_at DESC);

-- Medicación activa
CREATE TABLE medications (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  name         TEXT NOT NULL,
  active_substance TEXT,
  dose_mg      NUMERIC(6,3),
  frequency_h  INT,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ,
  prescribed_by TEXT,
  serum_levels JSONB              -- histórico mediciones
);

-- Bitácora manual diaria (lo que armamos en el plan)
CREATE TABLE daily_log (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  log_date     DATE NOT NULL,
  appetite_pct INT,                -- 0-100
  water_ml     INT,
  stool        TEXT,
  urine        TEXT,
  mobility_notes TEXT,
  sensory_score INT,               -- 1-5
  social_notes TEXT,
  caretaker_state JSONB,           -- estado del cuidador, opcional
  UNIQUE(subject_id, log_date)
);

-- Observaciones libres (texto + embedding para búsqueda semántica)
CREATE TABLE observations (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  observed_at  TIMESTAMPTZ NOT NULL,
  text         TEXT,
  embedding    VECTOR(1536),       -- OpenAI ada/text-embedding-3-small
  tags         TEXT[]
);
CREATE INDEX ON observations USING ivfflat (embedding vector_cosine_ops);

-- Sesiones de captura (ventana con video/audio)
CREATE TABLE capture_sessions (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  modalities   TEXT[],             -- {'video','audio','manual'}
  storage_uri  TEXT,
  quality      JSONB                -- iluminación, ruido base, framerate efectivo
);

-- Alertas generadas
CREATE TABLE alerts (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  level        TEXT,               -- 'info','warning','urgent','critical'
  kind         TEXT,
  message      TEXT,
  evidence     JSONB,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ
);

-- Recomendaciones diarias (generadas por reglas + LLM)
CREATE TABLE recommendations (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  rec_date     DATE,
  vector       TEXT,               -- vector de salud al que apunta
  action       TEXT,               -- texto accionable
  rationale    TEXT,
  source       TEXT,               -- 'rule', 'llm', 'human'
  confidence   NUMERIC(3,2),
  followed     BOOLEAN,
  outcome      TEXT
);

-- Patrones comportamentales (embeddings de ventanas)
CREATE TABLE behavior_patterns (
  id           UUID PRIMARY KEY,
  subject_id   UUID REFERENCES subjects(id),
  window_start TIMESTAMPTZ,
  window_end   TIMESTAMPTZ,
  embedding    VECTOR(256),         -- embedding aprendido (autoencoder)
  label        TEXT,                -- 'resting','grooming','exploration',
                                    -- 'play','seizure_like','agitated','sleep'
  label_conf   NUMERIC(3,2)
);
CREATE INDEX ON behavior_patterns USING ivfflat (embedding vector_cosine_ops);
```

### 3.2 InfluxDB — measurements

```
# Series continuas, cada una con tags {subject_id, source}

measurement: motion_features
  fields: speed_px_s, accel_px_s2, asymmetry_lr, head_tilt_deg,
          pose_confidence, gait_cycle_phase
  freq: 5-10 Hz

measurement: audio_features
  fields: rms_db, dominant_freq_hz, spectral_centroid, voice_activity,
          purr_score, meow_score, hiss_score, environment_noise_db
  freq: 5-10 Hz

measurement: derived_state
  fields: activity_level, alertness, hyperesthesia_score,
          stress_proxy, seizure_risk_estimate
  freq: 0.1 Hz (cada 10 s)

measurement: caretaker_coregulation
  fields: hrv_caretaker_ms, hrv_proxy_animal, sync_index, presence_score
  freq: 1 Hz

measurement: environment
  fields: ambient_lux, ambient_db, temperature_c, humidity_pct
  freq: 0.1 Hz
```

---

## 4. Pipeline de captura visual

### 4.1 Hardware mínimo viable

- 1× cámara IP con stream RTSP, idealmente con visión nocturna IR (Sanji no la "ve" como ruido visual y permite monitoreo 24h).
- Posicionamiento: vista cenital + lateral si es posible. Cenital sola alcanza para v0.
- Resolución 1080p @ 10 fps suficiente para tracking. Más fps solo para análisis fino de eventos epileptiformes.

### 4.2 Stack de visión

```
Frame → YOLOv8 (clase 'cat', confianza >0.7)
      → tracker ByteTrack/StrongSORT (track ID consistente)
      → recorte con padding 1.5x
      → DeepLabCut (modelo entrenado con dataset propio) o
        SLEAP / MMPose con backbone para animales
      → 12-17 keypoints (orejas, ojos, nariz, columna, cadera, patas)
      → suavizado temporal (filtro Savitzky-Golay)
      → features derivados (sección 4.3)
```

**Por qué DeepLabCut / SLEAP:** son los estándares de la neurociencia animal, soportan fine-tuning con pocos frames anotados (50-200), corren en GPU local. Hay modelos pre-entrenados para gatos que se pueden refinar específicamente con video de Sanji para mejorar precisión.

### 4.3 Features derivados clave

| Feature | Cómo se calcula | Para qué |
|---|---|---|
| `speed` | derivada temporal del centroide | actividad, fatiga |
| `head_tilt_deg` | ángulo línea ojos vs horizontal | head tilt residual, alerta |
| `asymmetry_lr` | diferencia keypoints izq/der | hemiparesia residual |
| `gait_cycle_regularity` | FFT del movimiento de patas | ataxia |
| `stride_length_var` | varianza de longitud de paso | propiocepción |
| `freeze_episodes` | inmovilidad >N s con confianza alta | staring / absence |
| `tail_twitch_rate` | oscilaciones de keypoint de cola | hiperestesia |
| `ear_flick_rate` | rotación rápida orejas | hiperestesia / FARS-like |
| `whisker_baseline` | posición media de bigotes | confort / estrés |
| `sleep_state` | inmovilidad + postura + ojos | sueño vs reposo despierto |

### 4.4 Detección de eventos motores anómalos

Este es uno de los entregables más sensibles. Pipeline propuesto:

1. **Baseline supervisado.** 1-2 semanas grabando comportamiento normal de Sanji para construir distribución de features "saludables".
2. **Detector de anomalías no supervisado.** Autoencoder LSTM sobre ventanas de 5-10 s de keypoints. Error de reconstrucción > umbral → flag.
3. **Clasificador supervisado de eventos motores.** Cuando se acumulan suficientes ejemplos etiquetados (por vos + recomendación de neuro), entrenar clasificador específico: `normal | grooming | play | tremor | focal_seizure | generalized_seizure`.
4. **Mecanismo de revisión humana.** Cada flag genera un clip de 30 s (15 antes + 15 después), notificación push, y vos clasificás. Eso entrena el modelo.

**Aviso explícito.** Un modelo así *asiste* la detección, no reemplaza al neurólogo veterinario. Es un sistema de cribado para no perder eventos sutiles, no un diagnóstico.

---

## 5. Pipeline de audio

### 5.1 Captura

- Micrófono ambiente (ej. ReSpeaker 4-Mic Array USB o lavalier USB) en la habitación donde más tiempo pasa.
- Streaming continuo a buffer + voice activity detection (WebRTC VAD adaptado para no-voz humana).
- Solo se persiste a disco lo que pasa el VAD; lo demás se descarta.

### 5.2 Stack de procesamiento

```
audio chunk (3 s, 16 kHz, mono)
  → librosa: mel-spectrogram (128 mel bins, hop 512)
  → modelo (CNN o panns/yamnet adaptado)
  → embedding 128-D + clasificación
  → categorías: silence | meow | purr | hiss | growl | trill |
                chirp | chatter | yowl | external_noise
  → embedding guardado en pgvector para búsqueda de patrones similares
```

### 5.3 Análisis de maullidos

Hay literatura y datasets útiles aquí (ej. CatMeows dataset de la Universidad de Milán) para entrenar clasificadores que distinguen contextos del maullido (hambre, atención, dolor, irritación). Para Sanji conviene:

- **Pre-entrenamiento** con modelos públicos de vocalizaciones felinas.
- **Fine-tuning específico**: grabar y etiquetar maullidos de Sanji en contextos identificables (antes de comer, al verte, al despertar) durante 2-3 semanas.
- **Detección de cambios**: si la firma acústica de sus maullidos cambia (frecuencia fundamental, duración, jitter, shimmer), es un proxy útil de cambio neurológico/emocional. Cambios bruscos → señal.

### 5.4 Ronroneo como marcador

El ronroneo no solo es estado emocional: tiene componente fisiológico estudiado (frecuencias 25-50 Hz, posible rol en homeostasis ósea/tisular). Para SANJI-RX:

- Detector específico de ronroneo (banda 20-150 Hz, autocorrelación).
- `purr_minutes_per_day` como métrica de bienestar.
- Correlacionar tiempo de ronroneo con sesiones de contacto con vos → input al modelo de co-regulación.

---

## 6. Inferencia y modelo predictivo

### 6.1 Score diario por vector

Cada vector tiene un score 0-100 calculado al cierre del día:

```python
# Pseudocódigo
def compute_neurological_score(features, baseline):
    components = {
        'seizure_events': normalize(features.seizure_count, max=3, invert=True),
        'asymmetry': normalize(features.asymmetry_lr_p95, baseline.asymmetry, invert=True),
        'gait_regularity': normalize(features.gait_regularity, baseline.gait, invert=False),
        'tremor': normalize(features.tremor_episodes, max=5, invert=True),
    }
    weights = {'seizure_events': 0.5, 'asymmetry': 0.2,
               'gait_regularity': 0.2, 'tremor': 0.1}
    score = sum(components[k] * weights[k] for k in weights)
    return score, components  # interpretabilidad obligatoria
```

Cada score viene con su descomposición → el dashboard siempre puede mostrar **por qué** está alto o bajo. No queremos cajas negras en algo así.

### 6.2 Estado global del día

Vector compuesto. Para evitar overfitting con datos limitados:

- Versión 1 (semanas 1-8): media ponderada de vectores con pesos clínicamente razonables.
- Versión 2 (cuando haya >60 días de datos): regresión sobre outcomes definidos (ausencia de crisis, recuperación motora, etc.).

### 6.3 Modelo de riesgo de evento epileptiforme

**Atención: esta es la pieza más delicada del sistema.** Hay literatura emergente en humanos sobre predicción de crisis a partir de patrones pre-ictales sutiles (cambios autonómicos, comportamentales), pero en gatos es territorio casi inexplorado. Lo abordamos así:

- **NO** prometer predicción.
- **SÍ** detectar acumulación de factores de riesgo conocidos: hipersensibilidad sonora elevada en el día, sueño fragmentado, exposición a estímulos disparadores documentados.
- Output: "riesgo elevado / normal" con explicación, no probabilidad numérica engañosa.
- Acción: si riesgo elevado, recomendación de reducir estímulos en próximas X horas + alerta a vos.

### 6.4 Detección de tendencias

Para cada feature clave, fit de tendencia con suavizado (Loess o Holt-Winters):

- Pendiente positiva sostenida → mejora.
- Plateau prolongado → considerar ajuste de intervención (con vete).
- Pendiente negativa → alerta, búsqueda de causa probable en eventos del período.

### 6.5 Búsqueda semántica de patrones

Con `behavior_patterns` y pgvector:

```sql
-- "Mostrame patrones de comportamiento similares al de hoy a las 14:00"
SELECT id, window_start, label
FROM behavior_patterns
WHERE subject_id = $1
ORDER BY embedding <=> $query_embedding
LIMIT 10;
```

Esto permite preguntas como: "¿cuándo tuvimos un patrón parecido al de antes de la última convulsión?" — y empezar a construir intuición sobre pródromos.

---

## 7. Sistema de recomendaciones

### 7.1 Capas

1. **Reglas duras (clinical safety layer).** Conjunto de reglas explícitas no negociables. Ej:
   - Si `appetite_pct < 50` durante >24h → alerta urgente (riesgo lipidosis).
   - Si `seizure_count > 0` en 24h → alerta crítica + protocolo a seguir.
   - Si `medication_due` y `not_administered_in_window` → alerta.

2. **Reglas heurísticas (clinical guidance layer).** Recomendaciones derivadas del plan de recuperación:
   - Si `hyperesthesia_score > umbral` por 2 días → recomendar reducir estímulos.
   - Si `purr_minutes_per_day` bajando → recomendar sesión de contacto consciente.
   - Si `sleep_fragmentation > umbral` → revisar ruido nocturno.

3. **Capa LLM (Claude API).** Para recomendaciones contextualizadas y matizadas que las reglas no capturan. Prompt grounded:

   ```
   aca usamos el promt de sanji_rx_prompt.md
   ```

   La capa LLM **siempre** pasa por validación de la capa de reglas antes de mostrarse. Si una recomendación del LLM contradice una regla dura, se descarta.

### 7.2 Loop de aprendizaje

Cada recomendación se persiste con `followed` y `outcome`. Con suficiente data:

- Recomendaciones con buen outcome → suben en ranking.
- Recomendaciones que no se siguen consistentemente → revisar si son realistas.
- Patrones de qué funciona en qué estados → afinar capa heurística.

---

## 8. Visualización 3D — modelo del gato

Aprovechamos lo que ya tenés con Three.js / R3F.

### 8.1 Modelo

- Modelo 3D low-poly de gato (rigged) con segmentación por regiones anatómicas y funcionales.
- Regiones cerebrales mapeadas sobre la cabeza (proyección, no anatómica real): occipital, parietal, temporal, frontal, cerebelo, tronco. Cada una con score de "recuperación estimada" derivado de tests funcionales:
  - Occipital ← test de seguimiento visual + apetito visual (juego con varita).
  - Cerebelo + propiocepción ← gait_regularity + stride_var + saltos exitosos.
  - Temporal ← reconocimiento de tu voz (respuesta a llamado por nombre).
  - Sistema vestibular ← head_tilt + episodios de pérdida de equilibrio.

### 8.2 Capas visuales

- **Capa anatómica.** Color base.
- **Capa funcional.** Heatmap por región según score (verde → rojo).
- **Capa de eventos.** Marcadores temporales de convulsiones, picos de hiperestesia.
- **Capa sintérgica (exploratoria).** Halo / lattice envolvente cuya coherencia visual responde al `sync_index` de co-regulación. Esto se conecta directamente con la estética de tu portfolio `.RANDOM()` — es la misma teoría, aplicada como interfaz contemplativa de monitoreo.

### 8.3 Modos de visualización

- **Modo clínico.** Métricas, scores, sin estética.
- **Modo contemplativo.** Modelo 3D + capa sintérgica, pensado para sesiones de presencia consciente con Sanji. Pedro mira el dashboard durante una pausa, el dashboard refleja el estado actual real.

---

## 9. Co-regulación cuidador ↔ Sanji (puente científico-sintérgico)

Esta es la pieza más original del sistema y la que conecta empíricamente con tu marco grinbergiano.

### 9.1 Hipótesis operacional

> Existe una sincronización medible entre estados autonómicos del cuidador y comportamiento del animal en interacciones de contacto consciente. Esta sincronización correlaciona con marcadores de bienestar del animal en ventanas subsiguientes.

Esto es una operacionalización falsable de "el campo del cuidador influye en el campo del animal".

### 9.2 Implementación

- **Cuidador (Pedro):** Muse 2 + sensor de HRV (Polar H10 o Apple Watch via HealthKit). Mismas pipelines que tenés en ADA.
- **Animal (Sanji):** features comportamentales en ventana de interacción.
- **Cálculo de sincronía:**
  - HRV del cuidador y proxy de activación del animal (combinación de actividad motora + audio + ratio postural relajado/alerta).
  - Cross-correlation con lag 0-30 s.
  - Phase locking value si extraés ritmos lentos.

### 9.3 Visualización

Vista dedicada en el dashboard: dos series temporales paralelas + índice de sincronía + clip de video de la sesión. Te permite ver, sesión por sesión, qué tan presente estabas y qué tanto eso correlaciona con el estado de Sanji minutos después.

### 9.4 Posibles outputs

- **Para Pedro.** Un protocolo de presencia consciente basado en evidencia: cuándo y cómo interactuar para maximizar el efecto regulador.
- **Para Random Lab.** Un piloto de un producto más grande: "co-regulación medible" como categoría. Hay mercado en cuidados paliativos, animales geriátricos, terapia asistida.
- **Para ADA/Lab Brain.** Datos reales de un sistema bidireccional, no solo neurofeedback del propio sujeto.

---

## 10. Stack técnico — sumando a lo que ya tenés

### 10.1 Backend (FastAPI)

```
sanji-rx/
├── api/
│   ├── routers/
│   │   ├── subjects.py
│   │   ├── events.py
│   │   ├── log.py
│   │   ├── capture.py
│   │   ├── alerts.py
│   │   ├── recommendations.py
│   │   └── coregulation.py
│   └── deps.py
├── workers/
│   ├── video_pipeline.py        # Celery o FastAPI BackgroundTasks
│   ├── audio_pipeline.py
│   ├── feature_aggregator.py
│   ├── anomaly_detector.py
│   └── recommender.py
├── models/
│   ├── pose/                     # DeepLabCut/SLEAP wrappers
│   ├── audio/                    # clasificadores
│   ├── anomaly/                  # autoencoder
│   └── llm/                      # cliente Claude
├── db/
│   ├── postgres.py
│   └── influx.py
├── ws/
│   └── realtime.py
└── core/
    ├── scoring.py
    ├── rules.py
    └── config.py
```

### 10.2 Frontend (React + R3F)

```
sanji-dashboard/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Timeline.tsx
│   │   ├── ThreeDView.tsx
│   │   ├── Bitacora.tsx
│   │   ├── Coregulation.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── ScoreRing.tsx
│   │   ├── VectorRadar.tsx
│   │   ├── EventClip.tsx
│   │   ├── AlertBanner.tsx
│   │   └── RecommendationCard.tsx
│   ├── three/
│   │   ├── CatModel.tsx
│   │   ├── BrainRegions.tsx
│   │   ├── LatticeShader.tsx     # reusar de Retratarte / .RANDOM()
│   │   └── SyncField.tsx
│   ├── hooks/
│   │   ├── useRealtime.ts
│   │   └── useSanjiState.ts
│   └── api/
│       └── client.ts
```

### 10.3 Infra mínima

- 1 host con GPU (puede ser tu workstation local con CUDA) para inferencia de modelos de visión.
- PostgreSQL + pgvector + InfluxDB containerizados (Docker Compose).
- Cloudflare R2 / GCS para clips. TTL: 30 días salvo clips etiquetados como eventos importantes.
- Tailscale o WireGuard para acceso seguro desde móvil cuando no estés en casa.

---

## 11. Roadmap por fases

### Fase 0 — Setup (semana 1)
**Objetivo:** que entre el primer dato real al sistema, aunque sea manual.

- [ ] Repo + scaffolding FastAPI + React (template de Random Lab).
- [ ] Migraciones Postgres con tablas `subjects`, `clinical_events`, `medications`, `daily_log`.
- [ ] Endpoint + formulario móvil para bitácora diaria (los 7 indicadores del plan).
- [ ] Cargar historia clínica de Sanji desde fecha del evento hasta hoy.
- [ ] Cargar medicación activa.

### Fase 1 — Visión básica (semanas 2-4)
**Objetivo:** detección + tracking + actigrafía 24/7.

- [ ] Cámara IP instalada, stream estable.
- [ ] YOLO + tracker corriendo, persistencia de bounding boxes en Influx.
- [ ] Cálculo de `activity_level`, `sleep_state` por ventanas de 5 min.
- [ ] Vista de timeline en frontend con actividad diaria.
- [ ] Detector simple de eventos: "inmóvil >N s con postura atípica" → clip + alerta para revisión manual.

### Fase 2 — Audio (semanas 4-6, en paralelo con Fase 1)
**Objetivo:** captura y clasificación básica de vocalizaciones.

- [ ] Mic ambiente, VAD, persistencia selectiva.
- [ ] Clasificador pre-entrenado funcionando.
- [ ] Detector de ronroneo + `purr_minutes_per_day`.
- [ ] Detector de ruidos ambientales fuertes → cruzar con eventos de hiperestesia.

### Fase 3 — Pose y movimiento fino (semanas 6-10)
**Objetivo:** features motores ricos.

- [ ] Anotar 200-300 frames de Sanji en distintas posturas.
- [ ] Fine-tuning de DeepLabCut/SLEAP.
- [ ] Cálculo de keypoints, derivar `asymmetry_lr`, `gait_regularity`, `head_tilt`.
- [ ] Visualización de pose overlay en clips guardados.

### Fase 4 — Inferencia y scores (semanas 8-12)
**Objetivo:** dashboard con sentido clínico.

- [ ] Implementación de scoring por vector (sección 6).
- [ ] Detector de anomalías (autoencoder LSTM).
- [ ] Sistema de alertas con niveles.
- [ ] Vista de tendencias semanales.

### Fase 5 — 3D y recomendaciones (semanas 10-14)
**Objetivo:** UX completa.

- [ ] Modelo 3D del gato con regiones.
- [ ] Heatmap de recuperación basado en scores.
- [ ] Integración Claude API para recomendaciones.
- [ ] Loop de feedback follow/outcome.

### Fase 6 — Co-regulación (semanas 14-18)
**Objetivo:** medir y operacionalizar la hipótesis sintérgica.

- [ ] Ingesta sincronizada de HRV/Muse de Pedro durante sesiones con Sanji.
- [ ] Cálculo de índice de sincronía.
- [ ] Vista de co-regulación.
- [ ] Capa visual sintérgica sobre modelo 3D.

### Fase 7 — Evaluación retrospectiva (mes 5-6)
**Objetivo:** validar y publicar.

- [ ] Análisis: ¿qué intervenciones del plan correlacionaron con mejoras objetivas?
- [ ] ¿Hubo pródromos detectables antes de eventos?
- [ ] Reporte para neurólogo veterinario con datos longitudinales.
- [ ] Decidir si Random Lab levanta esto como producto / publicación.

---

## 12. Métricas de éxito del sistema

No del paciente — del propio sistema, que es lo que podemos optimizar nosotros.

| Métrica | Target Fase 1 | Target Fase 4 |
|---|---|---|
| Cobertura temporal de captura | >70% horas/día | >90% |
| Latencia de alerta crítica | <60 s | <15 s |
| Precisión detector de eventos motores | >70% recall, etiquetado manual | >85% recall, <10% FP/día |
| Adherencia a bitácora manual | >5 días/semana | >6 días/semana |
| Recomendaciones seguidas | >40% | >65% |
| Tiempo dashboard → decisión accionable | <2 min | <30 s |

---

## 13. Consideraciones críticas

### 13.1 Lo que **no** hace este sistema

- No diagnostica. No reemplaza al neurólogo veterinario.
- No predice convulsiones individuales con timestamp. Estima riesgo agregado.
- No interpreta el "estado emocional subjetivo" del gato como verdad. Lo estima con incertidumbre declarada.
- No toma decisiones médicas autónomas. Sugiere, alerta, registra.

### 13.2 Privacidad y datos

- Todo on-premise por defecto.
- Clips de video con TTL agresivo (30 días salvo eventos etiquetados).
- API key del LLM rotada; las recomendaciones contienen contexto mínimo necesario.
- Si en algún momento esto se vuelve producto, política de datos explícita.

### 13.3 Failure modes y bias

- Sobreajuste a un solo sujeto: si en el futuro se aplica a otros gatos, retraining obligatorio.
- Falsos positivos en detección de eventos: ergonomía de revisión rápida (clip + 2 botones: "evento real" / "falsa alarma").
- Antropomorfización via LLM: prompts muy controlados, prohibición explícita de afirmaciones emocionales sin base en features.
- Pedro como único etiquetador → sesgo. Idealmente al menos un segundo observador (la vete o alguien de tu entorno) valida una muestra.

### 13.4 Ética

- Cualquier intervención propuesta por el sistema que afecte directamente a Sanji (no solo info) pasa por veterinario antes.
- El sistema es para potenciar el cuidado, no para reemplazar la presencia. La métrica más importante sigue siendo no medible: cuánto tiempo de calidad pasás con él.

---

## 14. Conexión con el ecosistema Random / ADA

| Componente Random/ADA | Reutilización en SANJI-RX |
|---|---|
| Stack FastAPI + WebSockets (ADA) | Idéntico, copy-adapt |
| Pipeline InfluxDB + Postgres | Idéntico |
| LSL infraestructura | Reusable si en algún momento se suma EEG Muse no invasivo en sesiones (experimental) |
| MuseVAE / autoencoder de features | Misma arquitectura aplicada a features de comportamiento felino |
| Shaders / lattice de `.RANDOM()` | Reutilizar para capa sintérgica del modelo 3D |
| MediaPipe face tracking (Retratarte) | Adaptar concepto a face landmarks de gato (DeepLabCut) |
| TabAnalisis (UI de scoring de sesiones) | Reusar componente para sesiones de Sanji |
| Hot/cold storage architecture | Mismo patrón: features calientes en RAM/Influx, clips fríos en object store |
| CRM "Planning Prospección" | No directo, pero el patrón kanban + AI modal sirve para "Planning Sanji" (tareas del día por vector) |

---

## 15. Próximas decisiones a tomar (esta semana)

1. **Cámara.** ¿Una cenital o cenital + lateral? Sugerencia: empezar con una cenital buena (Reolink, Tapo, Ubiquiti) y ver si hace falta segunda.
2. **Micrófono.** Decidir array USB vs micro Bluetooth. El USB es más fiable.
3. **GPU disponible.** ¿La workstation tuya alcanza para tracking 10 fps + audio + pose en paralelo? Si no, planear instancia GCP.
4. **Privacidad/red.** Configurar VLAN para dispositivos IoT en casa, separados del resto.
5. **Ventana inicial de captura.** Recomiendo arrancar con 2 semanas de captura "baseline" antes de empezar a derivar anomalías, así el sistema tiene de qué comparar.

1. **Cámara.** tengo una camara profesional nikon 3100, sirve?
micro deberia pcomprar?, estamos muy mal eocnomicamente dps de mas de 3k de gastos en hospital
mi pc mc chiop m4 va perfect 
4. **Privacidad/red.** esto tenemos que implementar

---

## 16. Apéndice — pseudocódigo de un día completo

```python
# 00:00 - Rollover diario
async def daily_rollover(subject_id):
    yesterday = today() - timedelta(days=1)
    
    # 1. Agregar features de Influx en scores por vector
    scores = await compute_vector_scores(subject_id, yesterday)
    
    # 2. Estado global
    global_state = aggregate_state(scores)
    
    # 3. Detectar tendencias
    trends = await detect_trends(subject_id, window=14)
    
    # 4. Alertas pendientes
    alerts = check_alert_rules(scores, trends)
    
    # 5. Recomendaciones del día
    recs = await generate_recommendations(
        subject_id=subject_id,
        scores=scores,
        trends=trends,
        plan_phase=current_phase(subject_id),
        medications=active_medications(subject_id),
    )
    
    # 6. Persistir
    await persist(scores, global_state, alerts, recs)
    
    # 7. Notificar
    await push_to_frontend(subject_id, payload={
        'scores': scores,
        'trends': trends,
        'alerts': alerts,
        'recommendations': recs,
    })


# Loop continuo - cada frame de video
async def on_video_frame(frame, subject_id):
    detections = yolo.detect(frame)
    if not has_cat(detections):
        return
    
    bbox = primary_cat_bbox(detections)
    keypoints = pose_model.infer(frame.crop(bbox))
    features = derive_features(keypoints, history.last_n(30))
    
    await influx.write('motion_features', features, time=frame.ts)
    
    anomaly_score = anomaly_detector.score(features)
    if anomaly_score > THRESHOLD:
        await capture_clip(subject_id, around=frame.ts, duration=30)
        await alerts.create(
            subject_id=subject_id,
            level='warning',
            kind='motor_anomaly',
            evidence={'anomaly_score': anomaly_score, 'features': features},
        )


# Loop continuo - cada chunk de audio
async def on_audio_chunk(chunk, subject_id):
    if not vad.detect(chunk):
        return
    
    mel = compute_mel(chunk)
    embedding = audio_encoder.embed(mel)
    label, conf = audio_classifier.predict(embedding)
    
    await influx.write('audio_features', {
        'rms_db': chunk.rms_db,
        f'{label}_score': conf,
    }, time=chunk.ts)
    
    if label in ('hiss', 'growl', 'yowl') and conf > 0.8:
        await alerts.create(
            subject_id=subject_id,
            level='info',
            kind='vocalization_distress',
            evidence={'label': label, 'conf': conf},
        )
```

---

## 17. Manifiesto cierre

Este sistema no busca *resolver* a Sanji. Busca *acompañarlo con la mayor cantidad de información útil posible*, ofreciéndole a Pedro un instrumento de percepción extendida durante esta ventana crítica de recuperación. Lo que hace humanamente — leer al gato, estar presente, decidir — sigue siendo lo central. SANJI-RX es prótesis para esa lectura, no su sustituto.

La hipótesis sintérgica entra como marco serio: si la conciencia y los campos importan, entonces son medibles aunque sea por sus correlatos. Y lo que se mide se puede mejorar.

> *"Hasta donde sabemos, con rigor. Más allá, lo marcamos como exploratorio y lo estudiamos antes de actuar sobre ello."*



vamos a agregar tb un sistema de notifcaciones semanales, o hace falta diario? sobre que podria ser? la pastilla generalment se le da a la mañana a la noche, la del cerebro 1/4 cada 12 horas (ya que es de 60mg la pastilla) y la otr apara la infeccion morbovet queda 4 dias y es 1/2 pastilla cada 24 hs