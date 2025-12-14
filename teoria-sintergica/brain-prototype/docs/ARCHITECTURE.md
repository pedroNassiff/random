# 🏗️ Arquitectura Técnica: Syntergic AI Platform
## Patrones de Desarrollo, Best Practices y Diseño de Sistema

---

## 📐 PRINCIPIOS DE DISEÑO

### 1. Separation of Concerns
```
Domain Layer (Teoría Sintérgica) ←→ Application Layer (IA/ML) ←→ Presentation (3D/UI)
```

### 2. Real-time First
- WebSocket como comunicación principal
- Estado reactivo (Zustand transient updates)
- Shaders optimizados (60 FPS mínimo)

### 3. Scientific Rigor
- Métricas validadas (papers peer-reviewed)
- Logging exhaustivo para replicabilidad
- Versionado de modelos (semántico)

### 4. Open Science
- Código abierto (MIT License)
- Datasets públicos
- APIs documentadas (OpenAPI/Swagger)

---

## 🎯 ARQUITECTURA ACTUAL (v0.2) - MEJORADA

### Backend Architecture (Python)

```
┌─────────────────────────────────────────────────────────────┐
│                        FASTAPI APP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Routes     │    │  WebSocket   │    │   Models     │ │
│  │   /api/*     │◄───┤   /ws/*      │◄───┤  (Pydantic)  │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    ▲        │
│         ▼                    ▼                    │        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           SYNTERGIC BRAIN (Inference Engine)        │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • VAE Model (PyTorch)                              │  │
│  │  • EEG Dataset Loaders (PhysioNet)                  │  │
│  │  • State Machine (RELAX/FOCUS modes)                │  │
│  │  • Metrics Calculator (Coherence, Entropy, Focal)   │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              AI/ML LAYER                             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ model.py   │  │ train.py   │  │ dataset.py │     │  │
│  │  │ (VAE Arch) │  │ (Training) │  │ (PhysioNet)│     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ WebSocket (JSON)
                          │
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Three.js)                │
└─────────────────────────────────────────────────────────────┘
```

### Estructura de Directorios Mejorada

```
backend/
├── main.py                      # FastAPI entry point
├── config/
│   ├── settings.py              # Configuración (env vars)
│   └── logging.yaml             # Logging config
├── api/
│   ├── routes.py                # REST endpoints
│   └── websocket.py             # WebSocket handlers
├── models/
│   └── schemas.py               # Pydantic models
├── ai/
│   ├── models/
│   │   ├── vae.py              # Variational Autoencoder
│   │   ├── transformer.py      # ← NUEVO: Temporal model
│   │   └── base.py             # Abstract base classes
│   ├── training/
│   │   ├── trainer.py          # Training loop
│   │   ├── callbacks.py        # W&B logging, checkpoints
│   │   └── losses.py           # Custom loss functions
│   ├── inference/
│   │   ├── predictor.py        # Real-time inference
│   │   └── batch.py            # Batch processing
│   └── data/
│       ├── dataset.py          # EEG dataset class
│       ├── transforms.py       # Data augmentation
│       └── loaders.py          # DataLoader configs
├── analysis/                    # ← NUEVO MÓDULO
│   ├── spectral.py             # FFT, bandas de frecuencia
│   ├── coherence.py            # Inter-hemispheric coherence
│   ├── entropy.py              # Shannon, sample entropy
│   ├── connectivity.py         # PLV, Granger causality
│   └── metrics.py              # Métricas sintérgicas
├── hardware/                    # ← NUEVO MÓDULO
│   ├── lsl_stream.py           # Lab Streaming Layer
│   ├── openbci.py              # OpenBCI connector
│   └── muse.py                 # Muse headband
├── services/
│   ├── brain_service.py        # Business logic
│   └── session_manager.py      # User sessions
├── utils/
│   ├── logger.py
│   └── validators.py
├── tests/
│   ├── test_vae.py
│   ├── test_metrics.py
│   └── test_api.py
└── requirements.txt
```

---

## 🎨 FRONTEND ARCHITECTURE (React/Three.js)

### Estructura Mejorada

```
frontend/
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Root component
│   ├── components/
│   │   ├── canvas/              # 3D Components
│   │   │   ├── Experience.jsx   # R3F Canvas wrapper
│   │   │   ├── Brain.jsx        # Brain mesh + logic
│   │   │   ├── LatticeMesh.jsx  # ← SEPARADO: Lattice grid
│   │   │   ├── FocalOrb.jsx     # ← SEPARADO: Conscious marker
│   │   │   └── Environment.jsx  # Lights, background
│   │   ├── hud/                 # ← NUEVO: UI Overlays
│   │   │   ├── CoherenceMeter.jsx    # Real-time graph
│   │   │   ├── FrequencySpectrum.jsx # FFT visualization
│   │   │   ├── StateIndicator.jsx    # Meditation state
│   │   │   └── SessionStats.jsx      # Duration, avg coherence
│   │   ├── controls/
│   │   │   ├── ModeSelector.jsx
│   │   │   ├── RecordButton.jsx      # ← NUEVO
│   │   │   └── CalibrationWizard.jsx # ← NUEVO
│   │   └── panels/
│   │       ├── ContextPanel.jsx      # Teoría explicativa
│   │       └── SettingsPanel.jsx     # ← NUEVO
│   ├── shaders/
│   │   ├── SyntergicMaterial.js      # Brain shader
│   │   ├── LatticeMaterial.js        # ← NUEVO: Grid shader
│   │   └── ParticleSystem.js         # ← NUEVO: Quantum particles
│   ├── store/
│   │   ├── brainStore.js             # Zustand state
│   │   ├── sessionStore.js           # ← NUEVO: Session data
│   │   └── settingsStore.js          # ← NUEVO: User prefs
│   ├── hooks/
│   │   ├── useWebSocket.js           # WebSocket connection
│   │   ├── useBrainMetrics.js        # ← NUEVO: Derived metrics
│   │   └── useAudioFeedback.js       # ← NUEVO: Binaural beats
│   ├── utils/
│   │   ├── mathUtils.js
│   │   └── colorUtils.js             # Coherence → Color mapping
│   └── styles/
│       └── global.css
├── public/
│   └── models/
│       └── brain/
│           └── scene.gltf
└── package.json
```

### Estado Global (Zustand) - Mejorado

```javascript
// store/brainStore.js
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export const useBrainStore = create(
  subscribeWithSelector((set, get) => ({
    // WebSocket Connection
    ws: null,
    isConnected: false,
    
    // Real-time Metrics (transient - no re-render)
    coherence: 0.5,
    entropy: 0.5,
    focalPoint: { x: 0, y: 0, z: 0 },
    frequency: 10.0,
    
    // Frequency Bands (NUEVO)
    bands: {
      delta: 0,   // 0.5-4 Hz
      theta: 0,   // 4-8 Hz
      alpha: 0,   // 8-13 Hz
      beta: 0,    // 13-30 Hz
      gamma: 0    // 30-50 Hz
    },
    
    // Session Data
    sessionStartTime: null,
    sessionDuration: 0,
    coherenceHistory: [], // Array de {timestamp, coherence}
    
    // User State
    currentMode: 'focus', // 'relax' | 'focus' | 'custom'
    isRecording: false,
    
    // Actions
    connect: (url) => {
      const ws = new WebSocket(url)
      ws.onopen = () => set({ isConnected: true, ws })
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        get().updateMetrics(data)
      }
      ws.onclose = () => set({ isConnected: false, ws: null })
    },
    
    updateMetrics: (data) => {
      // Transient update (no trigger re-renders)
      const state = get()
      state.coherence = data.coherence
      state.entropy = data.entropy
      state.focalPoint = data.focal_point
      state.frequency = data.frequency
      
      // Update history (persisted)
      if (state.isRecording) {
        set(state => ({
          coherenceHistory: [
            ...state.coherenceHistory,
            { timestamp: Date.now(), value: data.coherence }
          ]
        }))
      }
    },
    
    setMode: async (mode) => {
      await fetch(`http://localhost:8000/set-mode/${mode}`, { method: 'POST' })
      set({ currentMode: mode })
    },
    
    startSession: () => set({
      isRecording: true,
      sessionStartTime: Date.now(),
      coherenceHistory: []
    }),
    
    endSession: () => {
      const session = {
        duration: Date.now() - get().sessionStartTime,
        avgCoherence: get().coherenceHistory.reduce((sum, v) => sum + v.value, 0) / get().coherenceHistory.length,
        history: get().coherenceHistory
      }
      // Save to localStorage or send to backend
      localStorage.setItem('lastSession', JSON.stringify(session))
      set({ isRecording: false })
      return session
    }
  }))
)
```

---

## 🔬 MÓDULO DE ANÁLISIS CIENTÍFICO (Nuevo)

### Clase Principal de Métricas

```python
# backend/analysis/metrics.py
import numpy as np
from scipy import signal
from scipy.stats import entropy as shannon_entropy
import mne

class SyntergicMetrics:
    """
    Calcula métricas sintérgicas basadas en papers científicos validados.
    """
    
    @staticmethod
    def compute_coherence(eeg_left: np.ndarray, 
                          eeg_right: np.ndarray, 
                          fs: int = 256,
                          freq_band: tuple = (8, 13)) -> float:
        """
        Coherencia inter-hemisférica en banda Alpha.
        
        Referencias:
        - Nunez et al. (1997). "EEG coherency: I. Statistics, reference electrode..."
        - Thatcher et al. (2008). "Development of cortical connections..."
        
        Args:
            eeg_left: Señal EEG hemisferio izquierdo (1D array)
            eeg_right: Señal EEG hemisferio derecho (1D array)
            fs: Frecuencia de muestreo
            freq_band: Rango de frecuencias (Hz)
        
        Returns:
            float: Coherencia normalizada [0, 1]
        """
        # Welch's method para coherencia
        f, Cxy = signal.coherence(eeg_left, eeg_right, fs, nperseg=256)
        
        # Extraer banda de interés
        freq_mask = (f >= freq_band[0]) & (f <= freq_band[1])
        coherence_band = np.mean(Cxy[freq_mask])
        
        return float(coherence_band)
    
    @staticmethod
    def compute_entropy(eeg_signal: np.ndarray, fs: int = 256) -> float:
        """
        Entropía de Shannon del espectro de potencia.
        Alta entropía = Caos (muchas frecuencias)
        Baja entropía = Orden (dominante en pocas frecuencias)
        
        Referencias:
        - Inouye et al. (1991). "Quantification of EEG irregularity..."
        """
        # PSD usando Welch
        f, Pxx = signal.welch(eeg_signal, fs, nperseg=256)
        
        # Normalizar a distribución de probabilidad
        Pxx_norm = Pxx / np.sum(Pxx)
        
        # Shannon entropy
        H = shannon_entropy(Pxx_norm)
        
        # Normalizar a [0, 1]
        max_entropy = np.log(len(Pxx_norm))  # Máxima entropía posible
        normalized_entropy = H / max_entropy
        
        return float(normalized_entropy)
    
    @staticmethod
    def compute_focal_point(eeg_channels: np.ndarray,
                           electrode_positions: dict) -> dict:
        """
        Calcula el "centro de masa" de la actividad cerebral.
        
        Método simplificado de source localization.
        Para versión completa usar MNE-Python con BEM model.
        
        Args:
            eeg_channels: Array (n_channels, n_samples)
            electrode_positions: Dict {channel_name: (x, y, z)}
        
        Returns:
            dict: {'x': float, 'y': float, 'z': float}
        """
        # Power de cada canal (RMS)
        power_per_channel = np.sqrt(np.mean(eeg_channels**2, axis=1))
        
        # Normalizar
        weights = power_per_channel / np.sum(power_per_channel)
        
        # Weighted centroid
        centroid = np.zeros(3)
        for i, (ch_name, pos) in enumerate(electrode_positions.items()):
            centroid += weights[i] * np.array(pos)
        
        return {
            'x': float(centroid[0]),
            'y': float(centroid[1]),
            'z': float(centroid[2])
        }
    
    @staticmethod
    def detect_gamma_bursts(eeg_signal: np.ndarray,
                           fs: int = 256,
                           threshold: float = 2.0) -> list:
        """
        Detecta ráfagas de actividad Gamma (40 Hz).
        Asociadas a momentos de insight ("Aha!" moments).
        
        Referencias:
        - Sheth et al. (2009). "Gamma oscillations and neural synchrony..."
        """
        # Filtrar banda Gamma (30-50 Hz)
        sos = signal.butter(4, [30, 50], btype='bandpass', fs=fs, output='sos')
        gamma_filtered = signal.sosfilt(sos, eeg_signal)
        
        # Envolvente (Hilbert transform)
        analytic_signal = signal.hilbert(gamma_filtered)
        amplitude_envelope = np.abs(analytic_signal)
        
        # Detectar picos sobre threshold (en desviaciones estándar)
        mean_amp = np.mean(amplitude_envelope)
        std_amp = np.std(amplitude_envelope)
        threshold_value = mean_amp + (threshold * std_amp)
        
        peaks, _ = signal.find_peaks(amplitude_envelope, height=threshold_value)
        
        # Convertir índices a timestamps
        timestamps = peaks / fs
        
        return timestamps.tolist()
    
    @staticmethod
    def compute_all_metrics(eeg_data: dict, fs: int = 256) -> dict:
        """
        Compute completo de todas las métricas sintérgicas.
        
        Args:
            eeg_data: Dict con estructura {
                'left_hemisphere': np.ndarray,  # Promedio Fp1, F3, C3, P3
                'right_hemisphere': np.ndarray, # Promedio Fp2, F4, C4, P4
                'all_channels': np.ndarray,     # (n_channels, n_samples)
                'electrode_positions': dict
            }
        
        Returns:
            dict: Todas las métricas calculadas
        """
        return {
            'coherence': SyntergicMetrics.compute_coherence(
                eeg_data['left_hemisphere'],
                eeg_data['right_hemisphere'],
                fs
            ),
            'entropy': SyntergicMetrics.compute_entropy(
                eeg_data['left_hemisphere'],  # O promedio de ambos
                fs
            ),
            'focal_point': SyntergicMetrics.compute_focal_point(
                eeg_data['all_channels'],
                eeg_data['electrode_positions']
            ),
            'gamma_bursts': SyntergicMetrics.detect_gamma_bursts(
                eeg_data['left_hemisphere'],
                fs
            )
        }
```

---

## 🎮 PATRONES DE INTERACCIÓN

### 1. Neurofeedback Loop

```
Usuario → EEG → Backend (Análisis) → Frontend (Visualización) → Usuario ve resultado
   ↑                                                                      ↓
   └──────────────────── Ajusta estrategia mental ◄──────────────────────┘
```

### 2. Progressive Enhancement

```javascript
// Funciona sin EEG (modo demo con datos simulados)
if (!eegHardwareDetected) {
  useDemoMode() // Dataset pre-grabado
}

// Mejora si hay EEG
if (eegConnected) {
  useRealTimeEEG()
}

// Ultra-mejora si hay múltiples sujetos
if (multipleSubjects) {
  enableSyntergicSync() // Coherencia cruzada
}
```

### 3. Error Handling Científico

```python
# backend/utils/validators.py
class EEGValidator:
    @staticmethod
    def validate_signal_quality(eeg_signal: np.ndarray) -> dict:
        """
        Retorna métricas de calidad de señal.
        """
        # 1. Rango fisiológico (EEG típico: -100 a +100 µV)
        if np.max(np.abs(eeg_signal)) > 200:
            return {'valid': False, 'reason': 'Amplitud fuera de rango fisiológico'}
        
        # 2. Detectar saturación (flat line)
        if np.std(eeg_signal) < 0.1:
            return {'valid': False, 'reason': 'Señal saturada o desconectada'}
        
        # 3. Detectar artefactos de movimiento (cambios bruscos)
        diff = np.diff(eeg_signal)
        if np.max(np.abs(diff)) > 50:
            return {'valid': False, 'reason': 'Artefacto de movimiento detectado'}
        
        return {'valid': True, 'reason': 'Señal válida'}
```

---

## 📊 LOGGING Y TELEMETRÍA

### Weights & Biases Integration

```python
# backend/ai/training/trainer.py
import wandb

class Trainer:
    def __init__(self, config):
        wandb.init(
            project="syntergic-ai",
            config=config,
            tags=["vae", "eeg", "meditation"]
        )
    
    def train_epoch(self, dataloader):
        for batch in dataloader:
            loss = self.compute_loss(batch)
            
            # Log métricas
            wandb.log({
                "loss": loss,
                "learning_rate": self.optimizer.param_groups[0]['lr'],
                "batch_coherence": batch_metrics['coherence']
            })
            
            # Log visualizaciones cada 100 batches
            if batch_idx % 100 == 0:
                wandb.log({
                    "latent_space": wandb.Image(plot_latent_space(batch)),
                    "reconstruction": wandb.Image(plot_reconstruction(batch))
                })
```

---

## 🔐 SEGURIDAD Y PRIVACIDAD

### Datos Sensibles (EEG)

```python
# backend/utils/privacy.py
import hashlib

class EEGPrivacy:
    @staticmethod
    def anonymize_subject_id(subject_id: str) -> str:
        """Hash irreversible del ID"""
        return hashlib.sha256(subject_id.encode()).hexdigest()[:16]
    
    @staticmethod
    def remove_pii(eeg_data: dict) -> dict:
        """Elimina información personal identificable"""
        safe_data = {
            'eeg_signal': eeg_data['signal'],
            'timestamp': eeg_data['timestamp'],
            'metadata': {
                'sampling_rate': eeg_data['fs'],
                'duration': len(eeg_data['signal']) / eeg_data['fs']
            }
        }
        # NO incluir: nombre, edad, ubicación
        return safe_data
```

---

## 🚀 DEPLOYMENT

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
      - MODEL_PATH=/models/syntergic_vae.pth
    volumes:
      - ./models:/models
    command: uvicorn main:app --host 0.0.0.0 --reload
  
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:8000
    command: npm run dev -- --host
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

---

## 📈 PERFORMANCE OPTIMIZATION

### Backend
- [ ] Redis caching para inferencias repetidas
- [ ] Batch processing para múltiples usuarios
- [ ] Model quantization (FP16 en lugar de FP32)
- [ ] ONNX runtime para inferencia más rápida

### Frontend
- [ ] Three.js instancing para partículas (1 draw call)
- [ ] Shader LOD (Level of Detail) según FPS
- [ ] Web Workers para cálculos pesados
- [ ] Lazy loading de modelos 3D

---

## 🧪 TESTING STRATEGY

```python
# backend/tests/test_metrics.py
import pytest
import numpy as np
from analysis.metrics import SyntergicMetrics

def test_coherence_perfect_sync():
    """Dos señales idénticas → coherencia = 1.0"""
    signal1 = np.sin(2 * np.pi * 10 * np.linspace(0, 1, 256))
    signal2 = signal1.copy()
    
    coherence = SyntergicMetrics.compute_coherence(signal1, signal2)
    assert coherence > 0.95  # Casi 1.0 (tolerancia numérica)

def test_coherence_uncorrelated():
    """Ruido aleatorio → coherencia cercana a 0"""
    signal1 = np.random.randn(256)
    signal2 = np.random.randn(256)
    
    coherence = SyntergicMetrics.compute_coherence(signal1, signal2)
    assert coherence < 0.3
```

---

## 🎓 CONCLUSIÓN

Esta arquitectura:
1. **Escalable**: Modular, fácil agregar nuevos modelos
2. **Científica**: Métricas validadas, logging exhaustivo
3. **User-friendly**: UX progresiva, errores claros
4. **Open**: APIs públicas, código documentado

**Próximo paso**: Implementar módulo `analysis/` completo.
