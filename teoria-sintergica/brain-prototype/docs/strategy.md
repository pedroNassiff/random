# Syntergic Brain — Estrategia Científica + Técnica + Producto

**Random Lab · Marzo 2026**
**Pedro Nassiff — CTO / Investigador principal**

---

## Contexto del stack actual

Pipeline funcional end-to-end:

```
Muse 2 (BLE) → muselsl → LSL 256Hz
  → MuseConnector._stream_loop() → deque 10s × 4ch
    → MuseToSyntergicAdapter (L/R hemisphere avg)
      → SyntergicMetrics.compute_all() [FFT Welch + PLV + entropy]
        → inference._process_muse_window() [EMA smoothing 5 frames]
          → FastAPI WebSocket /ws/brain-state (5Hz)
            → useBrainStore (Zustand)
              → SyntergicBrain.jsx (shader regional + coherence glow + focal pulse)
              → HUD: MuseControl + FrequencySpectrum + CoherenceMeter + StateIndicator
```

El VAE actual (64ch PhysioNet, latent_dim=64) **no se usa** en modo Muse — correctamente bypaseado. El focal_point en modo Muse se genera con heurística desde bandas (`compute_focal_point_from_bands()`).

---

## PILAR 1: Validación científica

### 1.1 Protocolo de recolección de datos

**Objetivo**: Construir un dataset propio de sesiones de meditación con Muse 2 que sirva como ground truth y como training data para el VAE dedicado.

**Protocolo por sesión (30 min)**:

| Fase | Duración | Condición | Marcadores | Qué valida |
|------|----------|-----------|------------|------------|
| Baseline ojos abiertos | 2 min | Sentado, mirando punto fijo | `baseline_open_start/end` | Referencia alpha baja |
| Baseline ojos cerrados | 2 min | Sentado, ojos cerrados, sin instrucción | `baseline_closed_start/end` | Alpha reactivity (Berger effect) |
| Meditación guiada fase 1 | 5 min | Shamatha (atención a respiración) | `meditation_shamatha_start` | Theta + alpha buildup |
| Meditación libre fase 2 | 10 min | Sin instrucción, meditación propia | `meditation_free_start` | Estado natural del practicante |
| Evento cognitivo | 1 min | Cálculo mental (restar de 7 en 7 desde 1000) | `cognitive_start/end` | Beta/gamma activation |
| Recovery | 3 min | Relajación post-cognitivo | `recovery_start` | Transición beta → alpha |
| Meditación profunda | 5 min | Instrucción: "dejá ir todo esfuerzo" | `deep_start` | Theta dominante, posible delta |
| Cierre | 2 min | Ojos cerrados → abiertos gradualmente | `close_start`, `eyes_open` | Alpha suppression on opening |

**Mínimo viable**: 10 sesiones (5 días × 2 sesiones/día), idealmente 20-30 sesiones para entrenar el VAE.

**Metadatos por sesión**: hora del día, calidad de sueño (1-5), café (sí/no), minutos de meditación previa ese día, estado subjetivo pre/post (1-10).

### 1.2 Implementación técnica del recording mejorado

Tu `SessionRecorderV2` ya graba a PostgreSQL + InfluxDB. Lo que necesitamos agregar:

```python
# backend/recording/validation_protocol.py

class ValidationProtocol:
    """
    Protocolo de grabación estructurada para validación científica.
    
    Automatiza los marcadores del protocolo de 30 min.
    Se expone como endpoint REST que el frontend controla.
    """
    
    PHASES = [
        {"name": "baseline_open",      "duration": 120, "instruction": "Ojos abiertos, mirá un punto fijo"},
        {"name": "baseline_closed",    "duration": 120, "instruction": "Cerrá los ojos, sin hacer nada"},
        {"name": "shamatha",           "duration": 300, "instruction": "Atención en la respiración"},
        {"name": "meditation_free",    "duration": 600, "instruction": "Meditación libre"},
        {"name": "cognitive_task",     "duration": 60,  "instruction": "Restá de 7 en 7 desde 1000"},
        {"name": "recovery",           "duration": 180, "instruction": "Relajate, dejá ir"},
        {"name": "deep_meditation",    "duration": 300, "instruction": "Soltá todo esfuerzo"},
        {"name": "close",              "duration": 120, "instruction": "Abrí los ojos lentamente"},
    ]
    
    def __init__(self, recorder: SessionRecorderV2):
        self.recorder = recorder
        self.current_phase_idx = 0
        self.phase_start_time = None
        self.is_running = False
    
    def start(self, session_name: str, metadata: dict):
        """Inicia protocolo. Graba marcador de inicio."""
        self.recorder.start(session_name)
        self.recorder.add_metadata(metadata)  # hora, sueño, café, etc.
        self.current_phase_idx = 0
        self.is_running = True
        self._start_phase(0)
    
    def _start_phase(self, idx: int):
        phase = self.PHASES[idx]
        self.phase_start_time = time.time()
        self.recorder.add_marker(f"{phase['name']}_start")
    
    def get_current_state(self) -> dict:
        """Para el frontend: qué fase, cuánto falta, instrucción."""
        if not self.is_running:
            return {"status": "idle"}
        
        phase = self.PHASES[self.current_phase_idx]
        elapsed = time.time() - self.phase_start_time
        remaining = phase["duration"] - elapsed
        
        if remaining <= 0:
            # Auto-avanzar a siguiente fase
            self.recorder.add_marker(f"{phase['name']}_end")
            self.current_phase_idx += 1
            if self.current_phase_idx >= len(self.PHASES):
                self.is_running = False
                self.recorder.stop()
                return {"status": "complete"}
            self._start_phase(self.current_phase_idx)
            phase = self.PHASES[self.current_phase_idx]
            elapsed = 0
            remaining = phase["duration"]
        
        return {
            "status": "recording",
            "phase": phase["name"],
            "instruction": phase["instruction"],
            "elapsed": elapsed,
            "remaining": remaining,
            "phase_index": self.current_phase_idx,
            "total_phases": len(self.PHASES),
            "progress_percent": (self.current_phase_idx / len(self.PHASES)) * 100
        }
```

### 1.3 Validación contra ground truth

**1.3.1 Berger Effect Test (alpha reactivity)**

La prueba más fundamental en EEG: alpha debe aumentar al cerrar ojos y decrecer al abrirlos. Si tu pipeline no captura esto, algo está mal.

```python
# backend/validation/berger_test.py

def validate_berger_effect(session_data: dict) -> dict:
    """
    Valida que el alpha ratio (eyes_closed / eyes_open) sea > 1.0.
    
    Literature reference: 
    - Cannard et al. (2021) validaron Muse para alpha asymmetry
    - Ratio esperado con Muse 2: 1.3-3.0x para meditadores
    - Ratio mínimo aceptable: 1.1x
    """
    # Extraer ventanas por fase (usando marcadores)
    open_windows = extract_phase(session_data, "baseline_open")
    closed_windows = extract_phase(session_data, "baseline_closed")
    
    alpha_open = np.mean([w['bands']['alpha'] for w in open_windows])
    alpha_closed = np.mean([w['bands']['alpha'] for w in closed_windows])
    
    ratio = alpha_closed / (alpha_open + 1e-8)
    
    return {
        "test": "berger_effect",
        "alpha_open": alpha_open,
        "alpha_closed": alpha_closed, 
        "ratio": ratio,
        "passed": ratio > 1.1,
        "quality": "excellent" if ratio > 2.0 else "good" if ratio > 1.5 else "marginal" if ratio > 1.1 else "failed",
        "reference": "Cannard et al. 2021 — Muse validated for spectral analysis"
    }
```

**1.3.2 Cognitive Task Test (beta/gamma reactivity)**

Beta debe aumentar durante cálculo mental vs relajación.

```python
def validate_cognitive_reactivity(session_data: dict) -> dict:
    """
    Valida beta/gamma increase durante cognitive task vs baseline.
    
    Esperado: beta ratio > 1.2, gamma ratio > 1.1
    """
    rest_windows = extract_phase(session_data, "baseline_closed")
    task_windows = extract_phase(session_data, "cognitive_task")
    
    beta_rest = np.mean([w['bands']['beta'] for w in rest_windows])
    beta_task = np.mean([w['bands']['beta'] for w in task_windows])
    gamma_rest = np.mean([w['bands']['gamma'] for w in rest_windows])
    gamma_task = np.mean([w['bands']['gamma'] for w in task_windows])
    
    return {
        "test": "cognitive_reactivity",
        "beta_ratio": beta_task / (beta_rest + 1e-8),
        "gamma_ratio": gamma_task / (gamma_rest + 1e-8),
        "passed": (beta_task / (beta_rest + 1e-8)) > 1.2,
    }
```

**1.3.3 Coherence Consistency Test**

PLV inter-hemisférico debe ser consistente a lo largo de una sesión (no random).

```python
def validate_coherence_stability(session_data: dict) -> dict:
    """
    Valida que la coherencia no sea ruido aleatorio.
    
    Test: autocorrelación de la serie de coherencia con lag=1.
    Señal real: autocorrelación > 0.5 (la coherencia cambia gradualmente).
    Ruido: autocorrelación ~0 (cambios erráticos).
    """
    coherence_series = [w['coherence'] for w in session_data['windows']]
    autocorr = np.corrcoef(coherence_series[:-1], coherence_series[1:])[0, 1]
    
    return {
        "test": "coherence_stability",
        "autocorrelation_lag1": autocorr,
        "passed": autocorr > 0.5,
        "interpretation": "Real neural coherence" if autocorr > 0.7 else "Acceptable" if autocorr > 0.5 else "Possibly noise"
    }
```

**1.3.4 Cross-validation con Mind Monitor (opcional, secuencial)**

No simultáneo (BLE exclusivo), pero grabando la misma condición:

1. Sesión A: 5 min baseline + 5 min meditación con tu pipeline → CSV export
2. Desconectar tu app. Conectar Mind Monitor.
3. Sesión B: mismas condiciones (misma hora, misma posición) → Mind Monitor CSV
4. Comparar band powers promedio. Correlación esperada: r > 0.8 entre sesiones

### 1.4 Métricas de calidad de sesión (Session Quality Score)

```python
class SessionQualityScore:
    """
    Score compuesto 0-100 que evalúa la calidad de una sesión grabada.
    
    Componentes:
    - Signal quality (25%): Calidad promedio de electrodos durante la sesión
    - Alpha reactivity (25%): Berger effect durante calibración
    - Data completeness (25%): % de ventanas sin artefactos
    - Coherence stability (25%): Autocorrelación de PLV
    """
    
    @staticmethod
    def compute(session_data: dict) -> dict:
        signal_score = np.mean(session_data.get('avg_quality_series', [0.5])) * 100
        
        berger = validate_berger_effect(session_data)
        alpha_score = min(100, berger['ratio'] * 50)  # ratio 2.0 = 100
        
        total_windows = len(session_data['windows'])
        clean_windows = sum(1 for w in session_data['windows'] if w.get('avg_quality', 0) > 0.4)
        completeness_score = (clean_windows / max(total_windows, 1)) * 100
        
        coherence = validate_coherence_stability(session_data)
        coherence_score = coherence['autocorrelation_lag1'] * 100
        
        total = (signal_score * 0.25 + alpha_score * 0.25 + 
                 completeness_score * 0.25 + coherence_score * 0.25)
        
        return {
            "total_score": round(total, 1),
            "signal_quality": round(signal_score, 1),
            "alpha_reactivity": round(alpha_score, 1),
            "data_completeness": round(completeness_score, 1),
            "coherence_stability": round(coherence_score, 1),
            "grade": "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "F",
            "usable_for_training": total >= 50,  # Mínimo para incluir en VAE training
        }
```

---

## PILAR 2: VAE dedicado Muse 2

### 2.1 Arquitectura

El VAE actual: `input_dim=10304 (64×161), hidden_dim=512, latent_dim=64` — entrenado con PhysioNet motor imagery (64 canales, 160Hz).

El nuevo VAE Muse: entrenado con **tus propias sesiones de meditación** (4 canales, 256Hz).

```python
# backend/ai/muse_vae.py

class MuseVAE(nn.Module):
    """
    VAE dedicado para Muse 2 (4 canales, 256Hz).
    
    Input: Feature vector por ventana de 2s, no raw signal.
    
    Features (dim=24):
      - 5 band powers × 4 canales = 20 (delta, theta, alpha, beta, gamma per channel)
      - 2 coherence metrics (PLV left-right, MSC alpha-band)
      - 1 alpha asymmetry (log(right_alpha/left_alpha))
      - 1 theta/beta ratio (promedio global)
    
    Latent dim: 8 (sufficient for 4-channel meditation states)
    
    Output del latent space:
      - dims 0-2: focal_point (x, y, z) para el shader 3D
      - dims 3-4: coherence proxy (trained, not heuristic)
      - dims 5-7: state embedding (clusters → meditation states)
    """
    
    def __init__(self, input_dim=24, hidden_dim=64, latent_dim=8):
        super().__init__()
        
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.GELU(),  # GELU > ReLU for smooth EEG features
            nn.LayerNorm(hidden_dim),
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.LayerNorm(hidden_dim),
        )
        
        self.fc_mu = nn.Linear(hidden_dim, latent_dim)
        self.fc_logvar = nn.Linear(hidden_dim, latent_dim)
        
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.GELU(),
            nn.LayerNorm(hidden_dim),
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, input_dim),
        )
    
    def encode(self, x):
        h = self.encoder(x)
        return self.fc_mu(h), self.fc_logvar(h)
    
    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std
    
    def decode(self, z):
        return self.decoder(z)
    
    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        return self.decode(z), mu, logvar
    
    def get_syntergic_state(self, x):
        """
        Extrae estado sintérgico desde el espacio latente.
        
        A diferencia del VAE original que usaba heurísticas,
        este modelo APRENDE el mapping latent → (focal, coherence, state).
        """
        with torch.no_grad():
            mu, logvar = self.encode(x)
            
            # Focal point: primeras 3 dimensiones del mu
            focal_point = {
                "x": float(torch.tanh(mu[0, 0]).item()),  # tanh → [-1, 1]
                "y": float(torch.tanh(mu[0, 1]).item()),
                "z": float(torch.tanh(mu[0, 2]).item()),
            }
            
            # Coherence: sigmoid de dims 3-4 promediadas
            coherence = float(torch.sigmoid(mu[0, 3:5].mean()).item())
            
            # Variance-based entropy (same concept as original)
            variance_mean = torch.mean(torch.exp(logvar))
            entropy = float(variance_mean.item())
            
            return {
                "focal_point": focal_point,
                "coherence": coherence,
                "entropy": entropy,
                "latent_mu": mu[0].tolist(),
            }
```

### 2.2 Feature extraction para training

```python
# backend/ai/muse_features.py

class MuseFeatureExtractor:
    """
    Extrae features de una ventana EEG de Muse 2 para el MuseVAE.
    
    Convierte raw 4ch × 512 samples (2s @ 256Hz) → feature vector dim=24.
    """
    
    CHANNELS = ['TP9', 'AF7', 'AF8', 'TP10']
    BANDS = ['delta', 'theta', 'alpha', 'beta', 'gamma']
    
    @staticmethod
    def extract(window_data: np.ndarray, fs: int = 256) -> np.ndarray:
        """
        Args:
            window_data: (4, n_samples) raw EEG
            fs: sampling rate
            
        Returns:
            np.ndarray shape (24,) feature vector
        """
        features = []
        
        # 1. Band powers per channel (5 bands × 4 channels = 20 features)
        for ch_idx in range(4):
            signal = window_data[ch_idx]
            bands = SpectralAnalyzer.compute_frequency_bands(signal, fs)
            for band_name in MuseFeatureExtractor.BANDS:
                features.append(bands[band_name])
        
        # 2. Inter-hemispheric PLV (1 feature)
        left_avg = np.mean(window_data[:2], axis=0)   # TP9 + AF7
        right_avg = np.mean(window_data[2:], axis=0)   # AF8 + TP10
        plv = CoherenceAnalyzer.compute_phase_locking_value(left_avg, right_avg, fs)
        features.append(plv if np.isfinite(plv) else 0.5)
        
        # 3. Alpha-band MSC (1 feature)
        msc = CoherenceAnalyzer.compute_msc(left_avg, right_avg, fs)
        features.append(msc if np.isfinite(msc) else 0.5)
        
        # 4. Frontal alpha asymmetry: log(AF8_alpha / AF7_alpha) (1 feature)
        af7_alpha = SpectralAnalyzer.compute_frequency_bands(window_data[1], fs)['alpha']
        af8_alpha = SpectralAnalyzer.compute_frequency_bands(window_data[2], fs)['alpha']
        asymmetry = np.log((af8_alpha + 1e-8) / (af7_alpha + 1e-8))
        features.append(np.clip(asymmetry, -2, 2))
        
        # 5. Global theta/beta ratio (1 feature)
        global_signal = np.mean(window_data, axis=0)
        global_bands = SpectralAnalyzer.compute_frequency_bands(global_signal, fs)
        tbr = global_bands['theta'] / (global_bands['beta'] + 1e-8)
        features.append(np.clip(tbr, 0, 10))
        
        return np.array(features, dtype=np.float32)
```

### 2.3 Training pipeline

```python
# backend/ai/train_muse_vae.py

class MuseSessionDataset(Dataset):
    """
    Carga sesiones grabadas con el ValidationProtocol desde InfluxDB.
    
    Cada sample es un feature vector de 24 dims extraído de una ventana de 2s.
    """
    
    def __init__(self, session_ids: list, influx_client, min_quality: float = 0.4):
        self.features = []
        self.labels = []  # phase labels para supervisión débil
        
        for session_id in session_ids:
            windows = influx_client.query_session_windows(session_id)
            for w in windows:
                if w.get('avg_quality', 0) < min_quality:
                    continue
                
                feature_vec = MuseFeatureExtractor.extract(w['raw_data'], fs=256)
                self.features.append(feature_vec)
                self.labels.append(w.get('phase', 'unknown'))
        
        self.features = torch.tensor(np.array(self.features), dtype=torch.float32)
    
    def __len__(self):
        return len(self.features)
    
    def __getitem__(self, idx):
        return self.features[idx]


def train_muse_vae(session_ids: list, epochs: int = 50):
    """
    Entrena el MuseVAE con sesiones propias.
    
    Loss: MSE reconstruction + KL divergence + optional phase-contrastive loss.
    
    Contrastive loss: ventanas de la misma fase (ej: shamatha) deben estar
    cerca en el latent space, ventanas de fases distintas deben estar lejos.
    Esto hace que el latent space sea más interpretable y el focal_point
    se mueva de forma coherente con el estado mental.
    """
    dataset = MuseSessionDataset(session_ids)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)
    
    model = MuseVAE(input_dim=24, hidden_dim=64, latent_dim=8)
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    
    # KL annealing: empieza reconstruyendo bien, después regulariza
    kl_weight_schedule = np.linspace(0.0, 1.0, epochs)
    
    for epoch in range(epochs):
        total_loss = 0
        kl_weight = kl_weight_schedule[epoch]
        
        for batch in loader:
            optimizer.zero_grad()
            recon, mu, logvar = model(batch)
            
            # Reconstruction loss (MSE, not BCE — features are not 0-1)
            recon_loss = F.mse_loss(recon, batch, reduction='sum')
            
            # KL divergence
            kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
            
            loss = recon_loss + kl_weight * kl_loss
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        
        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1}/{epochs} | Loss: {total_loss/len(dataset):.4f} | KL weight: {kl_weight:.2f}")
    
    # Guardar
    torch.save(model.state_dict(), "muse_vae.pth")
    return model
```

### 2.4 Integración en inference.py

Reemplazar `compute_focal_point_from_bands()` (heurístico) por el MuseVAE (aprendido):

```python
# En _process_muse_window():

# ANTES (heurístico):
focal_point = MuseToSyntergicAdapter.compute_focal_point_from_bands(smoothed_bands)

# DESPUÉS (VAE aprendido):
feature_vec = MuseFeatureExtractor.extract(window.data, fs=256)
input_tensor = torch.tensor(feature_vec).unsqueeze(0)
vae_state = self.muse_vae.get_syntergic_state(input_tensor)
focal_point = vae_state['focal_point']
# Opcional: override coherence con la del VAE
# coherence_vae = vae_state['coherence']
```

---

## PILAR 3: Guía Sintérgica (evolución del ADA Copilot)

### 3.1 Visión: no es un chatbot, es un maestro contemplativo con datos

El copilot actual (`CopilotLabsService`) ya tiene el system prompt con `_EEG_KNOWLEDGE` — neurociencia contemplativa de alto nivel, Teoría Sintérgica, bandas EEG con interpretaciones profundas. Pero funciona como chat genérico.

La visión correcta: **un guía que ve tu cerebro en tiempo real y te acompaña como lo haría un maestro de meditación que puede leer tu mente**.

### 3.2 Tres modos de presencia

**Modo 1: Guía de sesión en vivo (real-time)**

No chat. Intervenciones mínimas, contextuales, basadas en lo que el EEG muestra AHORA.

```
[Alpha cae, beta sube durante meditación]
→ Voz suave: "Estás pensando. No pasa nada. Volvé a la respiración."

[Alpha sube sostenidamente por 30+ segundos]
→ Silencio (no interrumpir un estado bueno)

[Theta + alpha simultáneos, coherencia > 0.6]
→ Campana suave (no palabras — la mente verbal rompería el estado)

[Coherencia cae después de un pico]
→ "Notás el cambio? Eso es normal. El campo se expande y contrae."

[Sesión de 10 min completada, alpha promedio alto]
→ "Excelente sesión. Tu alpha promedio fue 23% — 15% más que ayer."
```

**Modo 2: Análisis post-sesión (session player)**

Después de una sesión grabada o mientras reproducís una sesión pasada.

```
"Tu sesión del martes muestra un patrón interesante: los primeros 4 
minutos tuviste mucha actividad beta (mente ocupada), pero en el minuto 
5 hubo una transición clara a alpha. Eso es típico — la mente tarda 
en aquietarse. Lo notable es que una vez que entraste en alpha, 
mantuviste coherencia por encima de 0.5 durante 6 minutos seguidos. 
Eso es inusual para tu perfil y sugiere que esa técnica te funciona."
```

**Modo 3: Coach de progreso longitudinal**

Análisis de tendencias semana a semana.

```
"En las últimas 2 semanas, tu tiempo promedio hasta alpha sostenido 
bajó de 7 minutos a 4.5 minutos. Tu coherencia máxima subió de 0.52 
a 0.61. Estás progresando.

Lo que noto es que tus sesiones de la mañana (antes de las 9am) 
consistentemente muestran mejor alpha que las de la tarde. Esto es 
fisiológicamente esperable — el cortisol matutino facilita la transición.

Sugerencia: si querés acelerar, intentá agregar 5 minutos de 
respiración 4-7-8 antes de sentarte. Los practicantes que usan 
regulación autonómica previa alcanzan alpha sostenido ~2 min más rápido."
```

### 3.3 Arquitectura técnica del Guía

```python
# backend/ai/syntergic_guide.py

class SyntergicGuide:
    """
    Guía de meditación con consciencia de EEG en tiempo real.
    
    No es un chatbot. Es un sistema de intervención contextual
    que observa el stream de brainState y decide cuándo hablar,
    qué decir, y cuándo callar.
    """
    
    # Regla #1: El silencio es la intervención más importante
    # Regla #2: Nunca interrumpir un estado profundo
    # Regla #3: Las intervenciones verbales son para transiciones, no para estados estables
    
    class InterventionType(Enum):
        SILENCE = "silence"           # No hacer nada (estado bueno)
        BELL = "bell"                 # Campana suave (marcar momento)
        WHISPER = "whisper"           # Texto corto, voz suave
        INSTRUCTION = "instruction"   # Instrucción de técnica
        CELEBRATION = "celebration"   # Reconocimiento de logro
        REDIRECT = "redirect"         # Redirigir atención
    
    def __init__(self):
        self.state_buffer = deque(maxlen=150)  # 30s a 5Hz
        self.last_intervention_time = 0
        self.min_interval = 30  # Mínimo 30s entre intervenciones
        self.session_start = None
        self.peak_alpha = 0
        self.peak_coherence = 0
        self.time_in_alpha = 0  # Segundos acumulados con alpha > threshold
    
    def observe(self, brain_state: dict) -> Optional[dict]:
        """
        Recibe cada frame de brainState (5Hz) y decide si intervenir.
        
        Returns:
            None (silencio) o dict con intervención
        """
        self.state_buffer.append(brain_state)
        
        now = time.time()
        elapsed_since_last = now - self.last_intervention_time
        
        # Regla de cooldown: no intervenir demasiado seguido
        if elapsed_since_last < self.min_interval:
            return None
        
        # Analizar tendencia
        trend = self._analyze_trend()
        
        # Decisión de intervención
        intervention = self._decide(trend, brain_state)
        
        if intervention and intervention['type'] != 'silence':
            self.last_intervention_time = now
        
        return intervention
    
    def _analyze_trend(self) -> dict:
        """Analiza los últimos 30s de datos."""
        if len(self.state_buffer) < 25:  # Mínimo 5s de datos
            return {"status": "warming_up"}
        
        recent = list(self.state_buffer)
        last_5s = recent[-25:]   # Últimos 5s
        prev_5s = recent[-50:-25] if len(recent) >= 50 else recent[:25]
        
        alpha_now = np.mean([s['bands']['alpha'] for s in last_5s])
        alpha_prev = np.mean([s['bands']['alpha'] for s in prev_5s])
        beta_now = np.mean([s['bands']['beta'] for s in last_5s])
        coherence_now = np.mean([s['coherence'] for s in last_5s])
        
        return {
            "alpha_now": alpha_now,
            "alpha_prev": alpha_prev,
            "alpha_trend": "rising" if alpha_now > alpha_prev * 1.1 else "falling" if alpha_now < alpha_prev * 0.9 else "stable",
            "beta_now": beta_now,
            "coherence_now": coherence_now,
            "state": last_5s[-1].get('state', 'unknown'),
            "is_deep": alpha_now > 0.20 and coherence_now > 0.5,
            "is_wandering": beta_now > 0.15 and alpha_now < 0.10,
        }
    
    def _decide(self, trend: dict, current: dict) -> Optional[dict]:
        """Motor de decisión del guía."""
        
        # Estado profundo → SILENCIO ABSOLUTO
        if trend.get('is_deep'):
            # Pero si es la primera vez que alcanza este nivel, marcar
            if current['coherence'] > self.peak_coherence * 1.1:
                self.peak_coherence = current['coherence']
                return {
                    "type": "bell",
                    "sound": "singing_bowl_soft",
                    "reason": "new_coherence_peak"
                }
            return None
        
        # Mind wandering → redirigir suavemente
        if trend.get('is_wandering') and trend['alpha_trend'] == 'falling':
            return {
                "type": "redirect",
                "message": self._get_redirect_message(trend),
                "voice": "whisper",
                "urgency": "low"
            }
        
        # Alpha rising → reforzar silenciosamente
        if trend['alpha_trend'] == 'rising' and trend['alpha_now'] > 0.12:
            return {
                "type": "silence",  # El mejor refuerzo es no interrumpir
                "internal_note": "alpha_building_well"
            }
        
        return None
    
    def _get_redirect_message(self, trend: dict) -> str:
        """
        Mensajes de redirección variados (no repetir el mismo dos veces seguidas).
        """
        messages = [
            "Volvé a la respiración.",
            "Notá el pensamiento. Dejalo ir.",
            "Sentí el cuerpo. Los pies en el piso.",
            "Respiración. Solo eso.",
            "Sin esfuerzo. Solo presencia.",
        ]
        return random.choice(messages)
    
    def get_session_summary(self) -> dict:
        """
        Genera resumen al final de una sesión.
        Para ser procesado por el LLM en modo análisis.
        """
        all_states = list(self.state_buffer)
        
        return {
            "duration_seconds": len(all_states) / 5,
            "avg_alpha": np.mean([s['bands']['alpha'] for s in all_states]),
            "avg_coherence": np.mean([s['coherence'] for s in all_states]),
            "peak_coherence": self.peak_coherence,
            "peak_alpha": self.peak_alpha,
            "time_in_meditation_state": sum(1 for s in all_states if s.get('state') in ['meditation', 'deep_meditation']) / 5,
            "time_in_wandering": sum(1 for s in all_states if s.get('state') == 'focused') / 5,
            "alpha_trajectory": [s['bands']['alpha'] for s in all_states[::25]],  # 1 sample per 5s
            "coherence_trajectory": [s['coherence'] for s in all_states[::25]],
        }
```

### 3.4 Frontend: UI del Guía durante sesión

No es un chat panel. Es una capa minimal sobre el cerebro 3D:

```
┌─────────────────────────────────────────┐
│                                         │
│        [Cerebro 3D con shader]          │
│                                         │
│                                         │
│    ┌──────────────────────────┐         │
│    │ "Volvé a la respiración" │  ← fade │
│    └──────────────────────────┘    in/out│
│                                         │
│  α 0.18  θ 0.12  coh 0.45    4:32      │
│  ████░░  ███░░░  ████░░░░    elapsed    │
│                                         │
│         [🔴 Recording]                  │
└─────────────────────────────────────────┘
```

La intervención del guía aparece como texto flotante semi-transparente que hace fade in/out. No ocupa espacio permanente. No requiere interacción. El usuario puede estar con ojos cerrados — el audio TTS (ElevenLabs, que ya tenés integrado) susurra la instrucción.

### 3.5 Roadmap de implementación

| Fase | Duración | Entregable |
|------|----------|------------|
| **V1 — Validation protocol** | 1 semana | `ValidationProtocol` + recording UI + 10 sesiones grabadas |
| **V2 — Quality scoring** | 3 días | `SessionQualityScore` + validation tests (Berger, cognitive, coherence) |
| **V3 — Muse VAE training** | 1 semana | Feature extractor + training pipeline + integración en inference |
| **V4 — Guía básico** | 1 semana | `SyntergicGuide.observe()` + redirect/silence/bell + TTS whisper |
| **V5 — Post-session analysis** | 1 semana | LLM-powered session summary + progress tracking longitudinal |
| **V6 — Coach longitudinal** | 2 semanas | Analytics cross-session + recommendations + personal baseline tracking |

**Orden recomendado**: V1 → V2 → V3 → V4 → V5 → V6

V1-V2 son prerequisito de V3 (necesitás datos para entrenar).
V4 puede arrancar en paralelo con V3 (usa métricas directas, no VAE).

---

## Referencias científicas clave

1. **Cannard, C. et al. (2021)** — Validating the wearable MUSE headset for EEG spectral analysis and Frontal Alpha Asymmetry. IEEE BIBM. *Validación directa del Muse 2 para las métricas que usamos.*

2. **Krigolson, O. et al. (2017)** — Using muse: Rapid mobile assessment of brain function. Frontiers in Neuroscience. *Establece que Muse es viable para investigación de ERPs y spectral analysis.*

3. **Lutz, A. et al. (2004)** — Long-term meditators self-induce high-amplitude gamma synchrony. PNAS. *Base teórica para gamma sostenido en meditación avanzada.*

4. **Aftanas, L. & Golocheikine, S. (2001)** — Human anterior and frontal midline theta and lower alpha reflect emotionally positive state and internalized attention. Neuroscience Letters. *Theta frontal + alpha posterior = flow meditativo.*

5. **Travis, F. & Shear, J. (2010)** — Focused attention, open monitoring, and automatic self-transcending: Categories to organize meditations. Consciousness and Cognition. *Framework de 3 categorías de meditación con firmas EEG distintas.*