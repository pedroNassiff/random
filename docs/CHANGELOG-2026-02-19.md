# Changelog — Sprint 19.02.2026

## Propuesta de terminología

Venimos usando "lab de cada experimento" sin nombre claro. Algunas opciones:

| Opción | Razonamiento |
|--------|-------------|
| **Nodo** | Cada experimento es un nodo del lab. Consistente con la estética de red/sintergética |
| **Módulo** | Neutro, técnico, claro |
| **Cámara** | Connotación de espacio de observación / laboratorio físico |
| **Campo** | Vincula con "campo sintérgico" del brain prototype |
| **Instancia** | Más dev-speak, puede confundir |

**Sugerencia**: `Campo` para el viewer individual, `Lab` para la galería. `/lab` → galería de campos. `/lab/brain` → Campo HERMES.

---

## 1. Lab — Galería de experimentos

### Renaming & estructura
- Los experimentos ahora tienen IDs internos (`brain`, `retratarte`, `tesseract`, `galaxy`, `holographic`) y nombres de display independientes (`HERMES`, `RETRATARTE`, etc.)
- Cada experimento tiene config propia: cámara R3F, luces, fondo, tags, escala del modelo

### Analytics integrado
- `usePageTracking('lab')` al entrar al Lab
- `trackLabVisit()` conversion event en cada visita
- `trackClick('lab_experiment_click', id)` al hacer click en cada experimento
- `usePageTracking('lab/:id')` al entrar a cada campo

### CTA desde proyectos
- Campo de `labLink` en `projects.js` para vincular proyectos con sus experimentos de lab
- Hermes (`/work/hermes`) ahora tiene botón **IR AL LAB** que navega a `/lab/brain`
- El botón usa `GlitchButton` con `variant="primary"` (`#00FFD1`), registra `lab_cta_click`

---

## 2. HERMES — Campo EEG (Brain Prototype integrado)

### Arquitectura
```
BrainDetail.jsx
├── Canvas (R3F, full-screen)
│   ├── SyntergicBrain.jsx      ← shader wireframe con bandas EEG
│   └── BrainBridge             ← lee Zustand cada frame, sin re-renders
├── Sidebar derecho
│   ├── StateIndicator          ← estado mental estimado
│   ├── FrequencySpectrum       ← bandas δ θ α β γ en tiempo real
│   ├── CoherenceMeter          ← coherencia inter-hemisférica
│   └── AudioControl            ← binaurales sincronizados
└── Panel inferior
    └── SessionControl          ← reproductor tipo Spotify de grabaciones EEG
```

### WebSocket → Modelo 3D
- Store Zustand en `store.js` mantiene conexión `wss://api.random-lab.es/ws/brain-state`
- Reconexión automática con back-off de 2s
- `BrainBridge` corre dentro del loop R3F: lee el store cada frame y actualiza `brainStateRef` sin causar re-renders
- El shader de `SyntergicBrain` interpola las 5 bandas con `lerp` (factor 0.06) para movimiento fluido
- **Logging de verificación**: primer mensaje WS y cada 100 se loguean con badge morado en consola mostrando `source`, `coherence` y las 5 bandas

### Muse 2 — Deshabilitado
- Tab "Muse 2" ahora `disabled`, cursor `not-allowed`, badge `WIP`, opacity 30%
- Solo disponible el modo **Dataset** (reproducción de grabaciones)
- Se reactiva cuando esté lista la integración BLE

### SessionControl — Reproductor de grabaciones
Bugs corregidos:

| Bug | Fix aplicado |
|-----|-------------|
| Cambiar sesión con otra activa no reproducía la nueva | `selectSession` siempre llama `POST /session/play` |
| ⏮ ⏭ cambiaban la sesión pero no hacían play | `nextSession`/`previousSession` usan el helper `refreshPlaylistAndPlay()` |
| Al cambiar sesión el nombre y barra de progreso mostraban datos de la anterior | `setSessionStatus(null)` antes de cargar la nueva |
| Detener sesión dejaba el backend en estado `session` activo | `stopSession` ahora llama `POST /set-mode/idle` antes de limpiar el estado local |

### Reproductor — controles
- Barra de progreso draggable (estilo Spotify)
- ⏮ Anterior / ▶⏸ Play-Pause / ⏭ Siguiente
- Velocidad: 0.5x / 1x / 2x / 5x
- Queue popup: lista todas las sesiones grabadas con badge `REC`/`MED`/`DS`
- Smooth progress con `requestAnimationFrame` + interpolación

---

## 3. RETRATARTE — Face tracking + Audio reactivo

### Cámara (FaceTracker)
- Acceso a cámara al entrar al campo: `getUserMedia({ video: true })`
- Detección facial con `face-api.js` (68 landmarks)
- Status badge en HUD: `init` → `active` / `denied`
- Uniforms alimentados por cara detectada:
  - `uFaceX`, `uFaceY` — posición del rostro normalizada
  - `uFaceScale` — tamaño del rostro
  - `uHasFace` — 0.0 / 1.0 (patterns degradan con gracia sin cara)
  - `uMouthOpen`, `uLeftEye`, `uRightEye`, `uEyebrowRaise` — expresiones

### Micrófono (AudioAnalyzer)
- Acceso a micrófono: `getUserMedia({ audio: true })`
- Análisis via `AnalyserNode` WebAudio API
- Uniforms en tiempo real:
  - `uAudioBass`, `uAudioMid`, `uAudioTreble`
  - `uAudioVolume`, `uAudioBeat`
  - `uAudioSpectralCentroid`, `uAudioSpectralFlux`
  - `uAudioSubBass`, `uAudioLowBass`, `uAudioPresence`
- Status badge: `init` → `active` / `denied`

### Patterns disponibles (14)
`LIQUID CRYSTAL` · `CHROMATIC FIELD` · `SIGNAL FLOW` · `WARP MESH` · `SPECTRAL TRACE` · `INTERFERENCE` · `KALEIDOSCOPE` · `MATTER WAVE` · `RESONANCE` · `FLUX LATTICE` · `NULL SPACE` · `VOID GRADIENT` · `EXPRESSION AURA` · `EMOTION FIELD`

Los patterns 16 (`EXPRESSION AURA`) y 17 (`EMOTION FIELD`) dependen directamente de los landmarks faciales.

---

## 4. Analytics Dashboard — Widgets draggables

### react-grid-layout integrado
- Todos los widgets son arrastrables (drag handle: barra de título)
- Redimensionables en ancho y alto desde la esquina inferior derecha
- Layout persiste en `localStorage` con clave `analytics_dashboard_layout`
- Botón **↺ Reset** restaura el layout por defecto
- Validación anti-corrupción: si el layout guardado tiene items menores a `w:2 h:2` se descarta automáticamente

### Layout por defecto (lg, 12 columnas)
| Widget | Posición | Tamaño |
|--------|----------|--------|
| Sessions Over Time | col 0, fila 0 | 8×6 |
| Device Breakdown | col 8, fila 0 | 4×6 |
| Top Pages | col 0, fila 6 | 8×6 |
| Top Events | col 8, fila 6 | 4×6 |
| Engagement Zones | col 0, fila 12 | 4×5 |
| Traffic Sources | col 4, fila 12 | 4×5 |
| Geographic Dist. | col 8, fila 12 | 4×5 |
| User Activity | col 0, fila 17 | 12×10 |

### Mejoras UI adicionales
- Paleta de color aplicada: `#00FFD1` (primary), `#E040FB` (purple), `#00B4FF` (blue), `#FFD700` (gold)
- `formatDuration()`: tiempos en `h m s` en lugar de solo segundos (Engagement Zones + stat Avg Duration)
- Barra Engagement Zones: color sólido `#00FFD1` (sin gradiente)
- User Activity: sin `max-height` fijo, scroll nativo
- Timestamps `first_seen` / `last_seen` con timezone `Europe/Madrid`
- Geographic Distribution: no estira en altura en grid

---

## 5. CORS & Infraestructura

### Vercel proxy (producción)
```json
{ "source": "/api/analytics/:path*", "destination": "https://api.random-lab.es/analytics/:path*" },
{ "source": "/api/automation/:path*", "destination": "https://api.random-lab.es/automation/:path*" }
```

### Vite proxy (desarrollo local)
```js
'/api/analytics' → 'http://localhost:8000/analytics'
'/api/automation' → 'http://localhost:8000/automation'
```

### Backend FastAPI
- `allow_origins` ahora incluye `https://random-lab.es` y `https://www.random-lab.es`

---

## Archivos modificados

```
src/pages/
  Analytics.jsx          — widgets draggables, colores, formatDuration
  BrainDetail.jsx        — campo HERMES completo, Muse 2 deshabilitado
  RetratarteDetail.jsx   — camera + mic integrados
  Lab.jsx                — analytics tracking
  LabDetail.jsx          — analytics tracking
  ProjectDetail.jsx      — CTA → lab con GlitchButton

src/lab-core/brain/
  SyntergicBrain.jsx     — shader EEG, 5 bandas + coherencia
  store.js               — WebSocket + logging de verificación
  hud/SessionControl.jsx — reproductor bugs fix + logging

src/styles/Analytics.css — widget system CSS, colores, engagement bar
src/data/projects.js     — labLink en hermes
vercel.json              — proxy rewrites
vite.config.js           — dev proxy + optimizeDeps
```
