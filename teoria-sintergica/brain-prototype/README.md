# 🧠 Brain Prototype - Teoría Sintérgica
## Sistema de Neurofeedback en Tiempo Real con Visualización 3D

> *"La cualidad de la experiencia depende de la coherencia del campo neuronal"* — Jacobo Grinberg-Zylberbaum

[![Status](https://img.shields.io/badge/status-Phase%204%20Complete-success)]()
[![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20Python%203.11-blue)]()
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Three.js-purple)]()
[![Database](https://img.shields.io/badge/database-InfluxDB%20%2B%20PostgreSQL-orange)]()

Sistema de neurofeedback científico que visualiza estados cerebrales en 3D, implementando los principios de la Teoría Sintérgica de Jacobo Grinberg mediante análisis EEG en tiempo real, inteligencia artificial y visualización holográfica.

---

## 📚 Índice

- [Visión General](#-visión-general)
- [Arquitectura del Sistema](#️-arquitectura-del-sistema)
- [Características Principales](#-características-principales)
- [Stack Tecnológico](#-stack-tecnológico)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Fundamentos Científicos](#-fundamentos-científicos)
- [Documentación Técnica](#-documentación-técnica)
- [Roadmap](#-roadmap)
- [Contribución](#-contribución)

---

##  Visión General

### ¿Qué es este proyecto?

Un **sistema completo de neurofeedback** que permite visualizar y entrenar estados cerebrales específicos mediante:

1. **Análisis Espectral en Tiempo Real** - Procesamiento FFT de señales EEG a 256 Hz
2. **Visualización 3D Interactiva** - Cerebro holográfico con iluminación por regiones
3. **Gamificación Inteligente** - Sistema de logros basado en métricas neurocientíficas
4. **Meditación Guiada Integrada** - Audio sincronizado con estados cerebrales
5. **Arquitectura de Datos Profesional** - Time-series + relational + cache

### Casos de Uso

- 🧘 **Meditación Profunda** - Alcanzar estados de coherencia sintérgica (Alpha + Theta)
- 🎯 **Entrenamiento de Concentración** - Fortalecer actividad Beta frontal
- 🔬 **Investigación Neurocientífica** - Validar hipótesis de la Teoría Sintérgica
- 🎓 **Educación** - Aprender sobre neurociencia aplicada
- 🏥 **Biofeedback Terapéutico** - Regulación de estados emocionales

---

## 🏗️ Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────┐
│                        HARDWARE LAYER                               │
│  EEG Devices: Muse S, OpenBCI, Emotiv (256 Hz, 4-64 canales)      │
└────────────────────┬───────────────────────────────────────────────┘
                     │ Raw EEG Data
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                     BACKEND (Python/FastAPI)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Data Processing Pipeline                                    │  │
│  │  • Spectral Analysis (FFT, Welch PSD)                       │  │
│  │  • Band Power Extraction (Delta, Theta, Alpha, Beta, Gamma) │  │
│  │  • Coherence Calculation (PLV - Phase Locking Value)        │  │
│  │  • State Inference (Meditation, Focus, Relaxed, Insight)    │  │
│  │  • Smoothing & Artifact Rejection                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  📊 WebSocket Server (5 Hz streaming)                               │
│  🔌 REST API (Session management, achievements)                     │
└────┬──────────────────┬──────────────────┬─────────────────────────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│  InfluxDB   │  │   Redis     │  │ PostgreSQL   │
│ Time-Series │  │   Cache     │  │  Relational  │
│  (EEG Raw)  │  │ (Real-time) │  │  (Sessions)  │
└─────────────┘  └─────────────┘  └──────────────┘
                      │
                      │ WebSocket Pub/Sub
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                   FRONTEND (React + Three.js)                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  3D Visualization Engine                                     │  │
│  │  • Regional Brain Activity (Custom Shaders)                  │  │
│  │  • Frequency-to-Region Mapping                               │  │
│  │  • Real-time Color/Intensity Updates                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  🎮 Practice Mode (Target-based training)                           │
│  🏆 Achievements System (10 unlockable goals)                       │
│  🎧 Guided Meditation (Audio player with progress)                  │
│  📈 Metrics Dashboard (HUD with scientific data)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Características Principales

### 1. **Análisis Espectral Científico** 🔬

**Fundamento:** Descomposición FFT de señales EEG en bandas de frecuencia

**Implementación:**
- `backend/analysis/spectral.py` - SpectralAnalyzer class
- Método de Welch para PSD (Power Spectral Density)
- Normalización a porcentajes del total de potencia

**Bandas Procesadas:**
```python
BANDS = {
    'delta': (0.5, 4.0),   # Sueño profundo, inconsciente
    'theta': (4.0, 8.0),   # Meditación profunda, creatividad
    'alpha': (8.0, 13.0),  # Coherencia sintérgica, relajación
    'beta': (13.0, 30.0),  # Concentración activa, alerta
    'gamma': (30.0, 50.0)  # Insight cognitivo, binding problem
}
```

**Beneficio:** Transformación de datos crudos EEG en **métricas interpretables** alineadas con literatura neurocientífica (Buzsáki, Nunez, Varela).

---

### 2. **Coherencia Interhemisférica** 🧩

**Fundamento:** Medida de sincronización entre hemisferios cerebrales

**Implementación:**
- `backend/analysis/coherence.py` - CoherenceAnalyzer class
- Algoritmo PLV (Phase Locking Value) con transformada de Hilbert
- Ventanas deslizantes de 500ms

**Fórmula:**
```python
PLV = |⟨e^(i·Δφ(t))⟩|
```
Donde `Δφ(t)` es la diferencia de fase instantánea entre hemisferios.

**Interpretación según Grinberg:**
- **PLV < 0.3** → Estados caóticos, percepción fragmentada
- **PLV 0.3-0.6** → Procesamiento normal
- **PLV 0.6-0.8** → Alta coherencia, meditación profunda
- **PLV > 0.8** → **Estado Sintérgico** - Acceso a la lattice

**Beneficio:** Feedback directo sobre el **nivel de integración cerebral**, indicador clave del estado de conciencia.

---

### 3. **Visualización Regional por Frecuencias** 🎨

**Fundamento:** Mapeo anatómico de bandas EEG a regiones cerebrales

**Implementación:**
- `frontend/src/components/canvas/RegionalBrainActivity.jsx`
- Custom GLSL shaders con posicionamiento topográfico
- Sistema 10-20 de electroencefalografía

**Mapeo Científico:**
```
┌─────────────────────┬──────────┬─────────────────────────┐
│ Región Cerebral     │ Banda    │ Estado Mental           │
├─────────────────────┼──────────┼─────────────────────────┤
│ Prefrontal          │ Gamma    │ Insight, eureka         │
│ Frontal             │ Beta     │ Concentración activa    │
│ Occipital           │ Alpha    │ Relajación, ojos cerrado│
│ Temporal/Hipocampo  │ Theta    │ Meditación, memoria     │
│ Central/Tálamo      │ Delta    │ Sueño profundo          │
└─────────────────────┴──────────┴─────────────────────────┘
```

**Shader Logic:**
```glsl
// Influencia de región Occipital para Alpha
float occipitalInfluence = smoothstep(0.2, -1.0, normalizedPos.z) * 
                           smoothstep(-0.5, 0.5, normalizedPos.y);

finalColor += alphaColor * alphaIntensity * occipitalInfluence * 3.0;
```

**Beneficio:** **Biofeedback visual instantáneo** - El usuario ve exactamente qué región cerebral está activa.

---

### 4. **Sistema de Logros Gamificado** 🏆

**Fundamento:** Refuerzo positivo basado en umbrales neurocientíficos

**Implementación:**
- `frontend/src/store/achievementsStore.js` - Zustand store
- Tracking persistente con localStorage
- 10 achievements basados en literatura científica

**Achievements:**
```javascript
{
  id: 'first_contact',
  threshold: { coherence: 0.6 },
  duration: null,
  description: 'Alcanza 60% de coherencia por primera vez'
},
{
  id: 'syntergic_state',
  threshold: { coherence: 0.9, alpha: 0.6 },
  duration: 30, // 30 segundos sostenidos
  description: 'Acceso a la lattice (Grinberg criteria)'
}
```

**Beneficio:** **Motivación intrínseca** para la práctica regular, con metas basadas en ciencia real (no arbitrarias).

---

### 5. **Meditación Guiada Integrada** 🎧

**Fundamento:** Sincronización de instrucciones verbales con estados cerebrales objetivo

**Implementación:**
- `frontend/src/hooks/useGuidedMeditation.js` - Audio player hook
- Catálogo de meditaciones (Vipassana, Samadhi) con voz de Jacobo Grinberg
- Auto-play al iniciar sesión de práctica

**Features:**
- Volume control, seek, progress bar
- Detección de finalización para estadísticas
- Voice cloning con ElevenLabs (planned)

**Beneficio:** **Onboarding guiado** para usuarios sin experiencia en meditación, aumenta tasa de éxito.

---

### 6. **Arquitectura de Datos Profesional** 🗄️

**Fundamento:** Separación de responsabilidades según naturaleza de datos

**Stack:**

#### InfluxDB (Time-Series Database)
```javascript
// Escritura cada 200ms (5 Hz)
influxDB.write({
  measurement: 'brain_state',
  tags: { user_id, session_id },
  fields: {
    coherence: 0.75,
    alpha: 0.45,
    theta: 0.25,
    // ...
  },
  timestamp: Date.now()
})
```

**Beneficios:**
- ✅ Compresión automática (10x reducción de espacio)
- ✅ Queries agregadas ultra-rápidas (promedios, percentiles)
- ✅ Retención automática (borrar datos > 30 días)
- ✅ Downsampling nativo

#### PostgreSQL (Relational Database)
```sql
-- Schema optimizado con triggers
CREATE TABLE practice_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  avg_coherence FLOAT,
  peak_coherence FLOAT,
  syntergic_state_duration INTEGER,
  achievements_unlocked TEXT[]
);

-- Trigger automático para actualizar stats
CREATE TRIGGER update_user_stats
AFTER UPDATE ON practice_sessions
FOR EACH ROW EXECUTE FUNCTION update_user_stats();
```

**Beneficios:**
- ✅ ACID transactions (consistencia garantizada)
- ✅ Relaciones complejas (users → sessions → achievements)
- ✅ JSON support para configuraciones flexibles
- ✅ Triggers para actualización automática de estadísticas

#### Redis (Cache + Pub/Sub)
```python
# Estado actual del usuario (TTL 5 minutos)
redis.hset('user:001:current', {
  'coherence': 0.75,
  'state': 'meditation',
  'session_id': 'abc123'
})

# Pub/Sub para WebSockets
redis.publish('brain-state', json.dumps(state))
```

**Beneficios:**
- ✅ Latencia <1ms (crucial para real-time)
- ✅ Pub/Sub nativo para WebSocket broadcasting
- ✅ TTL automático (limpieza de sesiones antiguas)

**Arquitectura Completa:**
```
EEG (256 Hz) → Backend → InfluxDB (write 5Hz) ──┐
                    │                            │
                    ├─→ Redis (publish WS) ──────┼─→ Frontend
                    │                            │
                    └─→ PostgreSQL (on session end)
```

**Beneficio General:** **Escalabilidad profesional** - Soporta múltiples usuarios simultáneos sin degradación de performance.

---

## 🛠 Stack Tecnológico

### Backend
```yaml
Core:
  - Python 3.11+
  - FastAPI (async/await)
  - Uvicorn (ASGI server)

Scientific Computing:
  - NumPy (arrays, FFT)
  - SciPy (signal processing, Welch PSD)
  - MNE-Python (EEG data handling)

Databases:
  - InfluxDB Client 1.38+
  - Psycopg2 (PostgreSQL)
  - Redis 5.0+

AI/ML (Future):
  - PyTorch (VAE for state prediction)
  - Scikit-learn (classification)
```

### Frontend
```yaml
Core:
  - React 18 (functional components, hooks)
  - Vite (build tool, HMR)

3D Visualization:
  - Three.js (WebGL engine)
  - React Three Fiber (React renderer for Three)
  - @react-three/drei (helpers, loaders)

State Management:
  - Zustand (global store)
  - localStorage (persistence)

UI:
  - Custom CSS (glassmorphism)
  - Leva (debug controls)
```

### DevOps
```yaml
Containerization:
  - Docker Compose (multi-container orchestration)
  - Alpine Linux (minimal images)

Monitoring:
  - Grafana (dashboards)
  - InfluxDB built-in UI

Version Control:
  - Git + GitHub
```

---

## 🚀 Instalación y Configuración

### Prerrequisitos

- **Python 3.11+** ([Download](https://www.python.org/downloads/))
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Git** ([Download](https://git-scm.com/downloads))

### 1. Clonar Repositorio

```bash
git clone https://github.com/pedroNassiff/random.git
cd random/teoria-sintergica/brain-prototype
```

### 2. Levantar Base de Datos (Docker)

```bash
# Iniciar InfluxDB + PostgreSQL + Redis
docker-compose up -d

# Verificar que estén corriendo
docker-compose ps

# Ver logs
docker-compose logs -f influxdb
```

**Acceso a servicios:**
- InfluxDB UI: http://localhost:8086
  - User: `admin` | Pass: `sintergic2024`
  - Token: `my-super-secret-auth-token`
- PostgreSQL: `localhost:5432`
  - Database: `brain_prototype` | User: `brain_user`
- Redis: `localhost:6379`

### 3. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Verificar instalación
python -c "import numpy, scipy, mne; print('✅ Scientific stack OK')"

# Iniciar servidor
uvicorn main:app --reload --port 8000
```

**Endpoints disponibles:**
- Health check: http://localhost:8000/
- Docs API: http://localhost:8000/docs
- WebSocket: `ws://localhost:8000/ws/brain-state`

### 4. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Verificar Three.js
npm list three @react-three/fiber

# Iniciar dev server
npm run dev
```

**Aplicación:** http://localhost:5173

### 5. Verificar Integración

1. Abre el navegador en `http://localhost:5173`
2. Abre DevTools (F12) → Network → WS
3. Deberías ver mensajes WebSocket llegando a 5 Hz
4. El cerebro 3D debe iluminarse según las bandas recibidas

**Panel de control (Leva):**
- Toggle `Regional Frequencies` → ON
- Toggle `Show Region Labels` → ON
- Observa las etiquetas flotantes en 3D

---

## 🔬 Fundamentos Científicos

### Teoría Sintérgica de Jacobo Grinberg

**Premisa central:** La realidad percibida es resultado de la **interacción entre el campo neuronal y la lattice** (estructura del espacio-tiempo).

#### Conceptos Clave

**1. La Lattice (Retícula del Espacio)**
- Matriz de información de capacidad infinita
- Estructura geométrica perfectamente simétrica
- Contiene todas las posibilidades cuánticas

**2. Campo Neuronal**
- Patrón electromagnético generado por actividad sincrónica neuronal
- Su **forma** determina qué información de la lattice se decodifica
- Mayor coherencia = mayor simetría del campo

**3. Sintergia (Síntesis de Energía)**
- Medida de **coherencia del campo neuronal**
- Alta sintergia → El campo se "camufla" con la lattice
- Estado de conciencia pura, percepción no-dual

**4. Criterios Neurofisiológicos del Estado Sintérgico**

Según investigación de Grinberg (1991):
```
Coherencia Interhemisférica > 0.8  (PLV)
          +
Potencia Alpha > 60%
          +
Theta elevado (30-40%)
          =
ESTADO SINTÉRGICO
```

En este estado:
- Desaparece la sensación de separación sujeto-objeto
- Acceso a información no-local
- Experiencias reportadas como "unidad con el todo"

### Validación Científica en el Proyecto

**Experimento Original de Grinberg (1994):**
- 2 sujetos meditadores en cámaras aisladas electromagnéticamente
- Estímulo lumínico a sujeto A
- EEG de sujeto B mostraba "potencial transferido" sin estímulo
- Correlación significativa solo con alta coherencia previa

**Implementación en el Prototipo:**
```python
# backend/analysis/state_inference.py
def detect_syntergic_state(coherence, bands):
    criteria = {
        'high_coherence': coherence > 0.8,
        'alpha_dominant': bands['alpha'] > 0.6,
        'theta_present': bands['theta'] > 0.3,
        'beta_low': bands['beta'] < 0.2  # Mente quieta
    }
    
    if all(criteria.values()):
        return 'syntergic_state'
```

**Métricas Adicionales:**
- **Entropía Espectral** - Desorden del campo (Shannon entropy)
- **Frecuencia Dominante** - Pico espectral principal
- **Asimetría Interhemisférica** - Diferencia izquierda-derecha

### Referencias Académicas

1. **Grinberg-Zylberbaum, J. (1991).** *La Teoría Sintérgica.* INPEC, México.
2. **Grinberg-Zylberbaum, J., et al. (1994).** "The Einstein-Podolsky-Rosen Paradox in the Brain." *Physics Essays*, 7(4).
3. **Buzsáki, G. (2006).** *Rhythms of the Brain.* Oxford University Press.
4. **Nunez, P. L., & Srinivasan, R. (2006).** *Electric Fields of the Brain.* Oxford University Press.
5. **Varela, F., et al. (2001).** "The Brainweb: Phase Synchronization and Large-Scale Integration." *Nature Reviews Neuroscience*, 2(4).

---

## 📖 Documentación Técnica

### Documentos Disponibles

```
docs/
├── ARCHITECTURE.md                    # Arquitectura general del sistema
├── DATABASE_ARCHITECTURE.md           # Stack de bases de datos (InfluxDB/PostgreSQL/Redis)
├── BRAIN_WAVES_GUIDE.md              # Guía científica de frecuencias cerebrales
├── REGIONAL_BRAIN_VISUALIZATION.md   # Sistema de iluminación por regiones
├── SESSION-PLAYER-GUIDE.md           # Reproductor de datasets EEG
├── DATASETS-GUIDE.md                 # Cómo trabajar con PhysioNet datasets
├── BACKEND-UPGRADE-SUMMARY.md        # Changelog del backend
├── ROADMAP.md                        # Roadmap general del proyecto
└── ROADMAP-PRE-HARDWARE.md           # Fases antes de integración con hardware real
```

### Guías de Uso

#### Para Desarrolladores
1. **Arquitectura:** Leer `ARCHITECTURE.md` primero
2. **Base de Datos:** Ver `DATABASE_ARCHITECTURE.md` para queries y schema
3. **Análisis EEG:** Estudiar `BRAIN_WAVES_GUIDE.md` para entender el procesamiento

#### Para Neurocientíficos
1. **Fundamentos:** `BRAIN_WAVES_GUIDE.md` - FFT, PLV, bandas
2. **Datasets:** `DATASETS-GUIDE.md` - Cómo agregar tus propios datos
3. **Validación:** Comparar resultados con literatura (ver Referencias)

#### Para Diseñadores/UX
1. **Visualización:** `REGIONAL_BRAIN_VISUALIZATION.md` - Mapeo anatómico
2. **Gamificación:** Ver `achievementsStore.js` para lógica de logros
3. **Interacción:** Explorar `PracticeMode.jsx` para flujo de usuario

---

## 🗺️ Roadmap

### ✅ Fase 1-4: Completadas (Dic 2024)

- [x] Backend con análisis espectral científico
- [x] Frontend con visualización 3D (Three.js)
- [x] Sistema de datasets (PhysioNet integration)
- [x] Gamificación con 10 achievements
- [x] Modo práctica con targets configurables
- [x] Meditación guiada integrada
- [x] Base de datos profesional (InfluxDB + PostgreSQL + Redis)
- [x] Documentación científica completa

### 🔄 Fase 5: Integración Hardware (En Progreso)

**Dispositivos Soportados:**
- [ ] Muse S (4 canales, Bluetooth)
- [ ] OpenBCI Cyton (8 canales, WiFi)
- [ ] Emotiv Insight (5 canales, Bluetooth)

**Tareas:**
- [ ] Driver de comunicación Bluetooth/Serial
- [ ] Calibración automática de artefactos
- [ ] Detección de calidad de señal en tiempo real
- [ ] Modo offline para sesiones sin internet

### 🚀 Fase 6: AI Avanzada (Q1 2025)

**Modelos Planeados:**
- [ ] VAE (Variational Autoencoder) para predicción de estados
- [ ] LSTM para detección temprana de transiciones
- [ ] Clasificador multi-clase de estados mentales
- [ ] Transfer learning con datasets grandes (50k+ sesiones)

**Objetivos:**
- Predicción de estado sintérgico con 30s de anticipación
- Sugerencias personalizadas de técnicas de meditación
- Detección de patrones anómalos (fatiga, distracción)

### 🌐 Fase 7: Multi-usuario (Q2 2025)

**Features:**
- [ ] Autenticación (OAuth2 + JWT)
- [ ] Dashboard de usuario con historial
- [ ] Comparación con comunidad (rankings)
- [ ] Sesiones compartidas (experimento de Grinberg replicado)
- [ ] API pública para investigadores

### 📱 Fase 8: Mobile App (Q3 2025)

**Plataformas:**
- [ ] iOS (React Native + Expo)
- [ ] Android (React Native + Expo)

**Features Mobile-Specific:**
- Notificaciones de recordatorio de práctica
- Widget de coherencia en tiempo real
- Integración con Apple Health / Google Fit
- Modo viaje (sin necesidad de desktop)

---

## 🤝 Contribución

### Cómo Contribuir

1. **Fork** el repositorio
2. **Crea** una rama feature (`git checkout -b feature/amazing-feature`)
3. **Commit** tus cambios (`git commit -m 'Add amazing feature'`)
4. **Push** a la rama (`git push origin feature/amazing-feature`)
5. **Abre** un Pull Request

### Áreas que Necesitan Ayuda

**Backend:**
- [ ] Optimización de algoritmos de PLV (actualmente O(n²))
- [ ] Implementación de artefact rejection (ICA, filtros adaptativos)
- [ ] Testing unitario (pytest, 80%+ coverage target)

**Frontend:**
- [ ] Mejoras de performance en shaders (reducir draw calls)
- [ ] Responsive design para tablets
- [ ] Accessibility (WCAG 2.1 AA)

**Data Science:**
- [ ] Validación con datasets más grandes (>10 sujetos)
- [ ] Análisis de variabilidad inter-sujeto
- [ ] Publicación de paper con resultados

**Documentación:**
- [ ] Traducciones (inglés, portugués)
- [ ] Video tutoriales
- [ ] Cookbook con casos de uso comunes

### Código de Conducta

Este proyecto sigue los principios de:
- **Respeto** a la diversidad de perspectivas
- **Rigor científico** en todas las claims
- **Transparencia** en metodologías y limitaciones
- **Open source** como filosofía de colaboración

---

## 📄 Licencia

Este proyecto está bajo licencia **MIT** - ver archivo [LICENSE](LICENSE) para detalles.

### Uso Académico

Si usas este proyecto en investigación académica, por favor cita:

```bibtex
@software{brain_prototype_2024,
  author = {Nassiff, Pedro},
  title = {Brain Prototype - Sistema de Neurofeedback basado en Teoría Sintérgica},
  year = {2024},
  publisher = {GitHub},
  url = {https://github.com/pedroNassiff/random/tree/main/teoria-sintergica/brain-prototype}
}
```

---

## 🙏 Agradecimientos

- **Jacobo Grinberg-Zylberbaum** - Por la Teoría Sintérgica que inspira este proyecto
- **PhysioNet** - Por los datasets EEG open-source
- **MNE-Python** - Por las herramientas de procesamiento de señales
- **Three.js Community** - Por la increíble biblioteca de visualización 3D
- **OpenBCI** - Por democratizar el acceso a hardware EEG

---

## 📞 Contacto

**Pedro Nassiff**
- GitHub: [@pedroNassiff](https://github.com/pedroNassiff)
- Email: [nassiffpedro@gmail.com]

**Link del Proyecto:** [https://github.com/pedroNassiff/random/tree/main/teoria-sintergica/brain-prototype](https://github.com/pedroNassiff/random/tree/main/teoria-sintergica/brain-prototype)

---


**Construido con** 🧠 **por la comunidad de neurohackers**

*"La conciencia no está en el cerebro, el cerebro está en la conciencia"* — Jacobo Grinberg


