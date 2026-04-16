# 🧠 RANDOM DASHBOARD + AI COPILOT (LABS/ADA PRIORITY)
## *Menos menús. Más conversación. Análisis inteligente de consciencia.*

---

## 🎯 NUEVA PRIORIDAD: LABS/ADA PRIMERO

### Contexto Actual
Ya tienes un sistema funcional de análisis de sesiones EEG:
- Backend FastAPI (`localhost:8000`) con PostgreSQL + InfluxDB
- UI de análisis (`AnalisisDatasets.jsx`) con comparación de datasets
- Visualización 3D del cerebro (`BrainModel.jsx`)
- Análisis automático: fases, scores, bandas de frecuencia

### Objetivo del Copiloto
**Convertir el análisis manual en conversación natural:**

```
User: "¿Cómo estuvo mi última sesión de meditación?"
         ↓
Copilot analiza sesión más reciente:
         ↓
🧠 Tu última sesión (23 feb, 847s) fue Excelente (score 82/100)

Highlights:
• 68% del tiempo en estado meditativo profundo (α ≥13%)
• Coherencia promedio: 0.74 (objetivo: 0.65-0.80) ✓
• Solo 1 interrupción detectada (mind-wandering en t≈423s)

vs Literatura mindfulness:
• α: 0.187 (ref: 0.08-0.25) ✓ perfecto
• θ: 0.223 (ref: 0.15-0.35) ✓ dentro
• β: 0.032 (ref: <0.05) ✓ bajo y estable

[Widget 1: Timeline de fases ↑]
[Widget 2: Comparación con tu promedio histórico ↑]
[Widget 3: Trayectoria Alpha+Theta ↑]

Recomendación: Mantén esta práctica. Tu α pico (0.24) se acerca
al rango sintérgico teórico (>0.25).
```

---

## 🏗️ ARQUITECTURA ACTUALIZADA

### Prioridad de Tabs

```
PRIORIDAD 1: 🔬 Labs (ADA/Hermes)
  - Análisis de sesiones EEG
  - Comparación con datasets
  - Predicciones y recomendaciones
  - Visualización 3D del brain

PRIORIDAD 2: 📊 Analytics
  - Métricas web
  - Engagement

PRIORIDAD 3: 🤖 Automation
  - Leads
  - Content
```

### Stack Técnico (Labs Focus)

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Labs)                          │
│  ┌──────────┐   ┌────────────────────────────────┐         │
│  │ SIDEBAR  │   │      WORKSPACE                 │         │
│  │          │   │                                │         │
│  │ 🔬 Labs  │◄──┤  📊 AnalisisDatasets.jsx       │         │
│  │ 📊 Analy │   │  🧠 BrainModel.jsx             │         │
│  │ 🤖 Autom │   │  + AI-Generated Insights       │         │
│  └──────────┘   └────────────────────────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       🤖 AI COPILOT - LABS SPECIALIST               │   │
│  │  💬 "¿Cómo estuvo mi última sesión?"                │   │
│  │  🧠 "Score 82/100. 68% en meditación profunda..."  │   │
│  │  📊 [Widgets de análisis EEG generados ↑]          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (FastAPI - Existing)               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Existing Endpoints:                                │   │
│  │  GET  /sessions?limit=200                          │   │
│  │  GET  /sessions/{id}/metrics                       │   │
│  │  GET  /sessions/{id}/analysis                      │   │
│  │  WS   /brain/field (real-time EEG stream)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  NEW: AI Copilot Service (Labs-focused)            │   │
│  │                                                      │   │
│  │  LLM Router → Free/Premium models                   │   │
│  │                                                      │   │
│  │  Tools (Labs):                                       │   │
│  │  • get_latest_session()                             │   │
│  │  • analyze_session(session_id)                      │   │
│  │  • compare_sessions(id1, id2)                       │   │
│  │  • compare_with_reference(session_id, dataset)      │   │
│  │  • predict_syntergy_path(user_history)             │   │
│  │  • get_meditation_recommendations(session_id)       │   │
│  │  • generate_eeg_widget(type, data)                  │   │
│  │                                                      │   │
│  │  Tools (Analytics - later):                         │   │
│  │  • get_analytics_summary()                          │   │
│  │  • get_top_pages()                                  │   │
│  │                                                      │   │
│  │  Tools (Automation - later):                        │   │
│  │  • get_leads_count()                                │   │
│  │  • filter_leads()                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Existing)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ PostgreSQL   │  │ InfluxDB     │  │ Redis Cache  │     │
│  │              │  │              │  │              │     │
│  │ • Sessions   │  │ • EEG metrics│  │ • AI Context │     │
│  │ • Recordings │  │ • Timeseries │  │ • Sessions   │     │
│  │ • Users      │  │ • Bands data │  │ • Rate Limits│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ TOOLS PRIORITARIOS (LABS)

### 1. get_latest_session()

```python
async def get_latest_session(self) -> Dict:
    """
    Obtiene la sesión más reciente del usuario.
    Incluye análisis completo automáticamente.
    """
    async with self.db_pool.acquire() as conn:
        session = await conn.fetchrow("""
            SELECT * FROM sessions 
            WHERE user_id = $1 
            ORDER BY started_at DESC 
            LIMIT 1
        """, self.user_id)
        
        if not session:
            return {"error": "No sessions found"}
        
        # Get metrics from InfluxDB
        metrics = await self.get_session_metrics(session['id'])
        
        # Run analysis
        analysis = self.analyze_session_data(metrics)
        
        return {
            "session": dict(session),
            "metrics_count": len(metrics),
            "analysis": analysis,
        }
```

**Ejemplo de uso:**
```
User: "¿Cómo estuvo mi última sesión?"
→ Tool: get_latest_session()
→ AI genera respuesta con análisis completo
```

---

### 2. analyze_session(session_id)

```python
def analyze_session_data(self, metrics: List[Dict]) -> Dict:
    """
    Analiza métricas EEG y genera insights.
    
    Calcula:
    - Score de sesión (0-100)
    - Fases detectadas (onset, building, meditation, deep)
    - Distribución de tiempo por fase
    - Eventos de mind-wandering
    - Comparación con literatura mindfulness
    - Recomendaciones personalizadas
    """
    if not metrics or len(metrics) < 5:
        return {"error": "Insufficient data"}
    
    # Calcular promedios de bandas
    avg_alpha = mean([m.get('alpha', 0) for m in metrics])
    avg_theta = mean([m.get('theta', 0) for m in metrics])
    avg_beta = mean([m.get('beta', 0) for m in metrics])
    avg_coherence = mean([m.get('coherence', 0) for m in metrics])
    max_alpha = max([m.get('alpha', 0) for m in metrics])
    
    # Detectar fases
    phases = self._detect_meditation_phases(metrics)
    
    # Detectar eventos de mind-wandering
    events = self._detect_mind_wandering(metrics)
    
    # Calcular score (0-100)
    score = self._calculate_session_score(
        avg_alpha, avg_theta, avg_beta, avg_coherence, phases
    )
    
    # Comparar con literatura
    literature_comparison = {
        "alpha": {
            "value": avg_alpha,
            "target_min": 0.08,
            "target_max": 0.25,
            "status": "within" if 0.08 <= avg_alpha <= 0.25 else "outside",
        },
        "theta": {
            "value": avg_theta,
            "target_min": 0.15,
            "target_max": 0.35,
            "status": "within" if 0.15 <= avg_theta <= 0.35 else "outside",
        },
        "beta": {
            "value": avg_beta,
            "target_max": 0.05,
            "status": "good" if avg_beta <= 0.05 else "high",
        },
        "coherence": {
            "value": avg_coherence,
            "target_min": 0.50,
            "target_max": 0.80,
            "status": "within" if 0.50 <= avg_coherence <= 0.80 else "outside",
        },
    }
    
    # Generar recomendaciones
    recommendations = self._generate_recommendations(
        avg_alpha, avg_theta, avg_beta, events, phases
    )
    
    return {
        "score": score,
        "score_label": self._get_score_label(score),
        "avg_bands": {
            "alpha": avg_alpha,
            "theta": avg_theta,
            "beta": avg_beta,
            "gamma": mean([m.get('gamma', 0) for m in metrics]),
            "delta": mean([m.get('delta', 0) for m in metrics]),
        },
        "max_alpha": max_alpha,
        "avg_coherence": avg_coherence,
        "phases": phases,
        "time_distribution": self._calculate_time_distribution(metrics),
        "events": events,
        "literature_comparison": literature_comparison,
        "recommendations": recommendations,
        "syntergy_proximity": self._calculate_syntergy_proximity(max_alpha),
    }

def _detect_meditation_phases(self, metrics: List[Dict]) -> List[Dict]:
    """
    Detecta fases de meditación basándose en niveles de alpha.
    
    Fases:
    - onset: α < 0.04
    - building: 0.04 ≤ α < 0.08
    - meditation: 0.08 ≤ α < 0.13
    - deep: α ≥ 0.13
    """
    n = len(metrics)
    window_size = max(5, n // 12)
    phases = []
    
    for i in range(0, n, window_size):
        window = metrics[i:i+window_size]
        avg_alpha = mean([m.get('alpha', 0) for m in window])
        avg_theta = mean([m.get('theta', 0) for m in window])
        avg_coh = mean([m.get('coherence', 0) for m in window])
        
        if avg_alpha >= 0.13:
            label = "deep"
        elif avg_alpha >= 0.08:
            label = "meditation"
        elif avg_alpha >= 0.04:
            label = "building"
        else:
            label = "onset"
        
        phases.append({
            "start_idx": i,
            "frac": i / n,
            "label": label,
            "avg_alpha": avg_alpha,
            "avg_theta": avg_theta,
            "avg_coherence": avg_coh,
        })
    
    return phases

def _detect_mind_wandering(self, metrics: List[Dict]) -> List[Dict]:
    """
    Detecta eventos de mind-wandering (caídas bruscas en alpha).
    """
    n = len(metrics)
    window = max(3, n // 20)
    events = []
    
    alpha_series = [m.get('alpha', 0) for m in metrics]
    
    for i in range(window, n - window):
        before = mean(alpha_series[i-window:i])
        after = mean(alpha_series[i:i+window])
        
        # Detectar caída >50%
        if before > 0.08 and after < before * 0.5:
            events.append({
                "idx": i,
                "frac": i / n,
                "alpha_before": before,
                "alpha_after": after,
                "drop_percent": ((before - after) / before) * 100,
            })
            i += window  # Skip window to avoid duplicates
    
    return events

def _calculate_syntergy_proximity(self, max_alpha: float) -> Dict:
    """
    Calcula qué tan cerca está de alcanzar el rango sintérgico.
    
    Según teoría sintérgica (Jacobo Grinberg):
    - Rango sintérgico: α > 0.25 sostenido
    - Pre-sintérgico: 0.20 ≤ α < 0.25
    - Meditación profunda: 0.13 ≤ α < 0.20
    """
    SYNTERGY_THRESHOLD = 0.25
    PRE_SYNTERGY = 0.20
    
    if max_alpha >= SYNTERGY_THRESHOLD:
        status = "achieved"
        message = "¡Has alcanzado el rango sintérgico!"
    elif max_alpha >= PRE_SYNTERGY:
        status = "very_close"
        remaining = SYNTERGY_THRESHOLD - max_alpha
        message = f"Muy cerca. Solo {remaining:.3f} de diferencia."
    else:
        status = "building"
        remaining = SYNTERGY_THRESHOLD - max_alpha
        message = f"Sigue practicando. {remaining:.3f} para el rango sintérgico."
    
    return {
        "max_alpha": max_alpha,
        "syntergy_threshold": SYNTERGY_THRESHOLD,
        "status": status,
        "remaining": max(0, SYNTERGY_THRESHOLD - max_alpha),
        "message": message,
        "percentage": min(100, (max_alpha / SYNTERGY_THRESHOLD) * 100),
    }
```

---

### 3. compare_sessions(id1, id2)

```python
async def compare_sessions(self, id1: int, id2: int) -> Dict:
    """
    Compara dos sesiones y muestra diferencias.
    """
    async with self.db_pool.acquire() as conn:
        s1 = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", id1)
        s2 = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", id2)
        
        if not s1 or not s2:
            return {"error": "Session not found"}
    
    m1 = await self.get_session_metrics(id1)
    m2 = await self.get_session_metrics(id2)
    
    a1 = self.analyze_session_data(m1)
    a2 = self.analyze_session_data(m2)
    
    return {
        "session_1": {
            "id": id1,
            "name": s1['name'],
            "date": s1['started_at'],
            "analysis": a1,
        },
        "session_2": {
            "id": id2,
            "name": s2['name'],
            "date": s2['started_at'],
            "analysis": a2,
        },
        "comparison": {
            "score_delta": a2['score'] - a1['score'],
            "alpha_delta": a2['avg_bands']['alpha'] - a1['avg_bands']['alpha'],
            "coherence_delta": a2['avg_coherence'] - a1['avg_coherence'],
            "improvement_summary": self._generate_comparison_summary(a1, a2),
        }
    }
```

**Ejemplo de uso:**
```
User: "Compara mi sesión de hoy con la de ayer"
→ Tool: compare_sessions(latest_id, previous_id)
→ AI: "Tu sesión de hoy mejoró +12 puntos. Alpha aumentó 0.04..."
```

---

### 4. compare_with_reference(session_id, dataset)

```python
async def compare_with_reference(
    self, 
    session_id: int, 
    dataset: str = "openneuro_ds004324"
) -> Dict:
    """
    Compara sesión con datasets de referencia.
    
    Datasets disponibles:
    - openneuro_ds004324: Muse S meditation (N=20, gold standard)
    - physionet_eegbci: Eyes-open/closed baseline
    - kaggle_brainwave: 1min meditation samples
    """
    # Get user session
    metrics = await self.get_session_metrics(session_id)
    analysis = self.analyze_session_data(metrics)
    
    # Load reference dataset
    ref_data = self._load_reference_dataset(dataset)
    
    # Calculate percentiles
    user_alpha = analysis['avg_bands']['alpha']
    ref_alpha_mean = ref_data['alpha_mean']
    ref_alpha_std = ref_data['alpha_std']
    
    z_score = (user_alpha - ref_alpha_mean) / ref_alpha_std
    percentile = self._z_to_percentile(z_score)
    
    return {
        "user_session": analysis,
        "reference_dataset": {
            "name": dataset,
            "description": ref_data['description'],
            "n_subjects": ref_data['n_subjects'],
            "stats": {
                "alpha_mean": ref_alpha_mean,
                "alpha_std": ref_alpha_std,
                "theta_mean": ref_data['theta_mean'],
                "coherence_mean": ref_data.get('coherence_mean'),
            }
        },
        "comparison": {
            "alpha_percentile": percentile,
            "z_score": z_score,
            "interpretation": self._interpret_percentile(percentile),
        }
    }

def _interpret_percentile(self, p: float) -> str:
    """Interpreta el percentil"""
    if p >= 90:
        return "Excepcional - top 10% de meditadores"
    elif p >= 75:
        return "Excelente - por encima de la mayoría"
    elif p >= 50:
        return "Bueno - sobre el promedio"
    elif p >= 25:
        return "En desarrollo - bajo el promedio"
    else:
        return "Iniciando - mucho margen de mejora"
```

**Ejemplo de uso:**
```
User: "¿Cómo me comparo con otros meditadores?"
→ Tool: compare_with_reference(session_id, "openneuro_ds004324")
→ AI: "Estás en el percentil 78. Excelente - por encima de la mayoría..."
```

---

### 5. predict_syntergy_path(user_history)

```python
async def predict_syntergy_path(self, user_id: int) -> Dict:
    """
    Predice cuándo podría alcanzar el rango sintérgico
    basándose en el historial de sesiones.
    
    Usa regresión lineal simple sobre max_alpha en el tiempo.
    """
    async with self.db_pool.acquire() as conn:
        sessions = await conn.fetch("""
            SELECT id, started_at, duration_seconds, avg_alpha, peak_alpha
            FROM sessions
            WHERE user_id = $1
            ORDER BY started_at ASC
        """, user_id)
    
    if len(sessions) < 3:
        return {
            "error": "Need at least 3 sessions for prediction",
            "sessions_count": len(sessions),
        }
    
    # Extract data
    dates = [s['started_at'] for s in sessions]
    peak_alphas = [s['peak_alpha'] or s['avg_alpha'] or 0 for s in sessions]
    
    # Convert dates to days since first session
    first_date = dates[0]
    days = [(d - first_date).days for d in dates]
    
    # Linear regression
    from scipy.stats import linregress
    slope, intercept, r_value, p_value, std_err = linregress(days, peak_alphas)
    
    # Predict when syntergy threshold (0.25) will be reached
    SYNTERGY_THRESHOLD = 0.25
    current_peak = peak_alphas[-1]
    
    if current_peak >= SYNTERGY_THRESHOLD:
        status = "achieved"
        days_to_syntergy = 0
    elif slope <= 0:
        status = "stagnant"
        days_to_syntergy = None
    else:
        days_needed = (SYNTERGY_THRESHOLD - intercept) / slope
        days_to_syntergy = max(0, days_needed - days[-1])
        status = "on_track"
    
    return {
        "current_peak_alpha": current_peak,
        "syntergy_threshold": SYNTERGY_THRESHOLD,
        "sessions_analyzed": len(sessions),
        "trend": {
            "slope": slope,  # alpha increase per day
            "r_squared": r_value ** 2,
            "status": status,
        },
        "prediction": {
            "days_to_syntergy": days_to_syntergy,
            "estimated_date": (datetime.now() + timedelta(days=days_to_syntergy)).date() if days_to_syntergy else None,
            "confidence": "high" if r_value ** 2 > 0.7 else "medium" if r_value ** 2 > 0.4 else "low",
        },
        "recommendation": self._generate_path_recommendation(slope, current_peak, days_to_syntergy),
    }

def _generate_path_recommendation(self, slope: float, current: float, days: float) -> str:
    """Genera recomendación personalizada"""
    if current >= 0.25:
        return "¡Felicidades! Mantén la práctica para sostener el estado sintérgico."
    
    if slope <= 0:
        return "Tu progreso se ha estancado. Considera: (1) Aumentar duración de sesiones, (2) Practicar técnicas de concentración específicas, (3) Revisar condiciones ambientales."
    
    if days and days < 30:
        return f"¡Vas muy bien! A este ritmo alcanzarás el rango sintérgico en ~{int(days)} días. Mantén la consistencia."
    elif days and days < 90:
        return f"Progreso sólido. Estimado: ~{int(days)} días. Considera intensificar la práctica para acelerar."
    else:
        return "Progreso lento pero constante. Considera sesiones más largas y/o más frecuentes."
```

**Ejemplo de uso:**
```
User: "¿Cuándo podré alcanzar el estado sintérgico?"
→ Tool: predict_syntergy_path(user_id)
→ AI: "A tu ritmo actual (~0.003 α/día), alcanzarás el rango sintérgico 
      en aproximadamente 45 días. Tu progreso es sólido..."
```

---

### 6. get_meditation_recommendations(session_id)

```python
async def get_meditation_recommendations(self, session_id: int) -> Dict:
    """
    Genera recomendaciones personalizadas basadas en el análisis.
    """
    metrics = await self.get_session_metrics(session_id)
    analysis = self.analyze_session_data(metrics)
    
    recommendations = []
    
    # Check alpha levels
    avg_alpha = analysis['avg_bands']['alpha']
    if avg_alpha < 0.08:
        recommendations.append({
            "category": "technique",
            "priority": "high",
            "issue": "Alpha bajo",
            "suggestion": "Prueba respiración 4-7-8 para aumentar alpha. Inhala 4s, retén 7s, exhala 8s.",
            "expected_impact": "+0.03-0.05 α típicamente",
        })
    
    # Check beta levels (should be low during meditation)
    avg_beta = analysis['avg_bands']['beta']
    if avg_beta > 0.05:
        recommendations.append({
            "category": "technique",
            "priority": "medium",
            "issue": "Beta elevado (mente activa)",
            "suggestion": "Incorpora body scan para reducir actividad mental. Beta debería estar <0.05.",
            "expected_impact": "Reducción ~30-40% en beta",
        })
    
    # Check coherence
    if analysis['avg_coherence'] < 0.50:
        recommendations.append({
            "category": "environment",
            "priority": "medium",
            "issue": "Coherencia baja",
            "suggestion": "Revisa: (1) Ajuste del headband, (2) Ruido ambiental, (3) Postura",
            "expected_impact": "Coherencia target: 0.50-0.80",
        })
    
    # Check for mind-wandering
    if len(analysis['events']) > 3:
        recommendations.append({
            "category": "technique",
            "priority": "high",
            "issue": f"{len(analysis['events'])} interrupciones detectadas",
            "suggestion": "Practica anchor breathing: cada vez que notes distracción, vuelve suavemente a la respiración.",
            "expected_impact": "Reducción ~50% en interrupciones",
        })
    
    # Check session duration
    async with self.db_pool.acquire() as conn:
        session = await conn.fetchrow("SELECT * FROM sessions WHERE id = $1", session_id)
    
    if session['duration_seconds'] < 600:  # <10 min
        recommendations.append({
            "category": "practice",
            "priority": "low",
            "issue": "Sesión corta (<10 min)",
            "suggestion": "Para alcanzar estados profundos, apunta a sesiones de 15-20 min mínimo.",
            "expected_impact": "Estados profundos típicamente aparecen después de 12-15 min",
        })
    
    return {
        "session_id": session_id,
        "score": analysis['score'],
        "recommendations": sorted(recommendations, key=lambda x: {"high": 0, "medium": 1, "low": 2}[x['priority']]),
        "strengths": self._identify_strengths(analysis),
    }

def _identify_strengths(self, analysis: Dict) -> List[str]:
    """Identifica puntos fuertes de la sesión"""
    strengths = []
    
    if analysis['score'] >= 75:
        strengths.append("Sesión excelente en general")
    
    if analysis['avg_bands']['alpha'] >= 0.13:
        strengths.append("Alpha en rango profundo (α≥13%)")
    
    if analysis['avg_coherence'] >= 0.65:
        strengths.append("Coherencia alta y estable")
    
    if analysis['avg_bands']['beta'] <= 0.03:
        strengths.append("Mente muy calmada (beta bajo)")
    
    if len(analysis['events']) == 0:
        strengths.append("Sin interrupciones - concentración sostenida")
    
    if analysis['time_distribution']['deep'] >= 0.5:
        strengths.append("Más del 50% en estado profundo")
    
    return strengths
```

---

## 💬 EJEMPLOS DE INTERACCIÓN (LABS)

### Ejemplo 1: Análisis de Sesión Simple

```
┌────────────────────────────────────────────────────────┐
│ USER:  "¿Cómo estuvo mi última sesión?"                 │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ ROUTER: SIMPLE → Gemini Flash (free)                   │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ TOOL: get_latest_session()                             │
│ → PostgreSQL: SELECT * FROM sessions ORDER BY...       │
│ → InfluxDB: Fetch metrics for session                  │
│ → analyze_session_data(metrics)                        │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ AI RESPONSE:                                            │
│                                                         │
│ 🧠 Tu última sesión (23 feb, 847s) fue Excelente      │
│                                                         │
│ **Score: 82/100** 🌟                                   │
│                                                         │
│ **Highlights:**                                        │
│ • 68% del tiempo en meditación profunda (α≥13%)       │
│ • Coherencia promedio: 0.74 ✓                         │
│ • Solo 1 interrupción detectada (t≈423s)              │
│ • Alpha pico: 0.24 (¡muy cerca del rango sintérgico!) │
│                                                         │
│ **vs Literatura:**                                     │
│ • α: 0.187 (ref: 0.08-0.25) ✓ perfecto                │
│ • θ: 0.223 (ref: 0.15-0.35) ✓ dentro                  │
│ • β: 0.032 (ref: <0.05) ✓ bajo y estable              │
│                                                         │
│ [Widget 1: Timeline de fases ↑]                        │
│ [Widget 2: Trayectoria Alpha+Theta ↑]                  │
│ [Widget 3: Comparación con tu promedio ↑]              │
│                                                         │
│ **Recomendación:** Mantén esta práctica. Estás a solo │
│ 0.01 del rango sintérgico teórico (>0.25).            │
└────────────────────────────────────────────────────────┘
```

---

### Ejemplo 2: Comparación de Sesiones

```
┌────────────────────────────────────────────────────────┐
│ USER:  "Compara mi sesión de hoy con la de ayer"       │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ ROUTER: MODERATE → Llama 70B (free)                    │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ TOOLS:                                                  │
│ 1. get_latest_session() → session_id: 142             │
│ 2. Get session from yesterday → session_id: 141        │
│ 3. compare_sessions(142, 141)                          │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ AI RESPONSE:                                            │
│                                                         │
│ 📊 Comparación de sesiones:                            │
│                                                         │
│ **Hoy (23 feb) vs Ayer (22 feb)**                     │
│                                                         │
│ | Métrica | Ayer | Hoy | Cambio |                      │
│ |---------|------|-----|--------|                      │
│ | Score   | 70   | 82  | +12 ✓  |                      │
│ | α avg   | 0.14 | 0.19| +0.05 ✓|                      │
│ | Coherencia| 0.68|0.74| +0.06 ✓|                      │
│ | Mind-wandering| 4 | 1 | -3 ✓  |                      │
│                                                         │
│ **Mejoras clave:**                                     │
│ 1. Alpha aumentó significativamente (+36%)             │
│ 2. Menos interrupciones (-75%)                         │
│ 3. Mayor coherencia sostenida                          │
│                                                         │
│ [Widget: Comparación visual de bandas ↑]               │
│ [Widget: Timeline superpuesta ↑]                        │
│                                                         │
│ **Análisis:** ¡Excelente progreso! Lo que cambió:     │
│ - Sesión más larga (847s vs 623s ayer)                │
│ - Mejor fase de "construcción" inicial                 │
│ - Pico de alpha llegó más temprano                     │
│                                                         │
│ Mantén lo que hiciste hoy diferente. Está funcionando.│
└────────────────────────────────────────────────────────┘
```

---

### Ejemplo 3: Predicción de Camino Sintérgico (Complex)

```
┌────────────────────────────────────────────────────────┐
│ USER:  "¿Cuándo podré alcanzar el estado sintérgico?"  │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ ROUTER: COMPLEX → Claude 3.5 (si premium user)         │
│         o Llama 70B (si free + suggestion to upgrade)  │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ TOOLS:                                                  │
│ 1. predict_syntergy_path(user_id)                      │
│    → Fetch all sessions                                │
│    → Linear regression on peak_alpha over time         │
│    → Calculate days to threshold (0.25)                │
│ 2. get_latest_session() (for current status)           │
│ 3. compare_with_reference("openneuro_ds004324")        │
└────────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────────┐
│ AI RESPONSE (Claude):                                   │
│                                                         │
│ 🎯 Predicción de Camino Sintérgico                     │
│                                                         │
│ **Tu situación actual:**                               │
│ • Sesiones analizadas: 28                             │
│ • Alpha pico actual: 0.24                             │
│ • Distancia al umbral: 0.01 (¡muy cerca!)             │
│                                                         │
│ **Análisis de tendencia:**                            │
│ • Progreso α: +0.003 por día (R²=0.78, alta confianza)│
│ • Velocidad: Excelente                                │
│ • Consistencia: 4.2 sesiones/semana                   │
│                                                         │
│ **Predicción:**                                        │
│ A tu ritmo actual, alcanzarás el rango sintérgico     │
│ (α≥0.25 sostenido) en aproximadamente **3-5 días**.   │
│ Fecha estimada: ~28 feb 2026                          │
│                                                         │
│ [Widget 1: Gráfico de progreso histórico ↑]           │
│ [Widget 2: Proyección lineal con IC 95% ↑]            │
│ [Widget 3: Comparación con dataset OpenNeuro ↑]        │
│                                                         │
│ **Contexto científico:**                              │
│ Según el dataset OpenNeuro ds004324 (N=20 meditadores│
│ Muse S), estás en el percentil 92. Solo el 8% de     │
│ meditadores alcanza α>0.24 de forma sostenida.       │
│                                                         │
│ **Recomendaciones para consolidar:**                  │
│ 1. Mantén sesiones de 15+ min                         │
│ 2. Practica a la misma hora (circadian consistency)   │
│ 3. Una vez alcanzado 0.25, sostén por 5+ min         │
│    (criterio de Grinberg para sintergia)              │
│                                                         │
│ **Teoría Sintérgica (Grinberg):**                     │
│ El estado sintérgico requiere:                        │
│ • α > 0.25 sostenido                                  │
│ • Coherencia inter-hemisférica >0.75                  │
│ • Duración mínima: 5 minutos                          │
│                                                         │
│ Tu coherencia actual (0.74) también está cerca.       │
│ Estás en el umbral. 🌟                                │
└────────────────────────────────────────────────────────┘
```

---

## 📅 ROADMAP ACTUALIZADO (Labs First)

### Timeline (8 semanas)

```
┌────────────────────────────────────────────────────────┐
│ SEMANAS 1-2: LABS CORE (Prioridad Máxima)             │
├────────────────────────────────────────────────────────┤
│ Backend:                                               │
│ ✓ LLMRouter implementado                              │
│ ✓ CopilotService (Labs-focused)                       │
│ ✓ 6 tools de Labs:                                    │
│   - get_latest_session()                              │
│   - analyze_session()                                 │
│   - compare_sessions()                                │
│   - compare_with_reference()                          │
│   - predict_syntergy_path()                           │
│   - get_meditation_recommendations()                  │
│ ✓ Endpoint /api/copilot/chat                          │
│                                                         │
│ Frontend:                                              │
│ ✓ Integrar CopilotPanel en AnalisisDatasets          │
│ ✓ Widget renderer para EEG:                           │
│   - Phase timeline                                    │
│   - Alpha+Theta trajectory                            │
│   - Band comparison bars                              │
│   - Syntergy progress gauge                           │
│                                                         │
│ 🎯 MILESTONE: Copilot responde queries de Labs        │
│              end-to-end con análisis completo          │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ SEMANAS 3-4: LABS AVANZADO                             │
├────────────────────────────────────────────────────────┤
│ • Real-time analysis durante sesión activa            │
│ • WebSocket integration con brain/field               │
│ • Comparación automática con datasets                 │
│ • Generación de reportes PDF                          │
│ • Historical trends y analytics                       │
│                                                         │
│ 🎯 MILESTONE: Sistema completo de análisis Labs       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ SEMANAS 5-6: ANALYTICS + AUTOMATION                    │
├────────────────────────────────────────────────────────┤
│ • Analytics tools (get_summary, top_pages, etc)       │
│ • Automation tools (leads, content)                   │
│ • Context management avanzado                         │
│ • Multi-tab orchestration                             │
│                                                         │
│ 🎯 MILESTONE: 3 tabs completamente integrados         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ SEMANA 7: INTELIGENCIA AVANZADA                        │
├────────────────────────────────────────────────────────┤
│ • Multi-step reasoning                                │
│ • Proactive insights                                  │
│ • Export & sharing                                    │
│ • Premium features                                    │
│                                                         │
│ 🎯 MILESTONE: Sistema inteligente completo            │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ SEMANA 8: POLISH & DEPLOY                              │
├────────────────────────────────────────────────────────┤
│ • Performance optimization                            │
│ • Mobile responsive                                   │
│ • Production deployment                               │
│ • Documentation                                       │
│                                                         │
│ 🎯 MILESTONE: Production ready                        │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ QUICK START (LABS FIRST - 48 HORAS)

### DÍA 1: Backend Labs Tools (4-5 horas)

```bash
# 1. Install dependencies
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/backend
pip install langchain langchain-openai tiktoken scipy

# 2. Create ai/ folder
mkdir -p ai
touch ai/__init__.py

# 3. Create files:
# - ai/llm_router.py (reuse from previous plan)
# - ai/copilot_service_labs.py (new, Labs-focused)
# - ai/eeg_analysis.py (analysis functions)
```

**ai/copilot_service_labs.py** (nuevo archivo):
```python
from typing import Dict, List, Optional
from .llm_router import LLMRouter
from .eeg_analysis import (
    analyze_session_data,
    detect_meditation_phases,
    calculate_syntergy_proximity
)

class CopilotLabsService:
    """
    Copiloto especializado en análisis de sesiones EEG.
    """
    
    def __init__(self, db_pool):
        self.db_pool = db_pool
        self.router = LLMRouter()
        self.tools = self._init_tools()
    
    def _init_tools(self):
        return [
            {
                "name": "get_latest_session",
                "description": "Obtiene y analiza la sesión más reciente",
                "func": self.get_latest_session,
            },
            {
                "name": "analyze_session",
                "description": "Analiza una sesión específica por ID",
                "func": self.analyze_session,
            },
            # ... más tools
        ]
    
    async def get_latest_session(self, user_id: int = 1) -> Dict:
        """Get + analyze latest session"""
        async with self.db_pool.acquire() as conn:
            session = await conn.fetchrow("""
                SELECT * FROM sessions 
                ORDER BY started_at DESC 
                LIMIT 1
            """)
            
            if not session:
                return {"error": "No sessions found"}
            
            # Get metrics from InfluxDB
            # (reuse existing endpoint logic)
            metrics = await self._get_metrics_from_influx(session['id'])
            
            # Analyze
            analysis = analyze_session_data(metrics)
            
            return {
                "session": dict(session),
                "analysis": analysis,
            }
    
    # ... implementar otros tools
```

**Agregar endpoint en main.py**:
```python
from ai.copilot_service_labs import CopilotLabsService

@app.post("/api/copilot/labs/chat")
async def copilot_labs_chat(request: CopilotChatRequest):
    service: CopilotLabsService = app.state.copilot_labs_service
    response = await service.process_message(request.message)
    return response
```

### DÍA 2: Frontend Integration (4-5 horas)

```bash
cd /Users/pedronassiff/Desktop/proyectos/random
npm install zustand react-query recharts react-markdown
```

**Modificar AnalisisDatasets.jsx** para agregar CopilotPanel:

```jsx
// Agregar al final de AnalisisDatasets.jsx

import CopilotPanelLabs from '../components/CopilotPanelLabs';

export default function AnalisisDatasets() {
  const { sessions, loading, error, reload } = useSessions()
  const [selected, setSelected] = useState(null)
  const [showCopilot, setShowCopilot] = useState(false)

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
      <Sidebar ... />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? <RecordingView rec={selected} /> : <EmptyState />}
      </div>
      
      {/* NEW: Copilot Panel */}
      {showCopilot && (
        <CopilotPanelLabs 
          currentSession={selected}
          onClose={() => setShowCopilot(false)}
        />
      )}
      
      {/* Toggle button */}
      <button
        onClick={() => setShowCopilot(!showCopilot)}
        className="fixed bottom-4 right-4 bg-purple-600 text-white p-3 rounded-full"
      >
        🤖
      </button>
    </div>
  )
}
```

**Crear CopilotPanelLabs.jsx**:
```jsx
// Similar a CopilotPanel.jsx del plan anterior,
// pero enfocado en Labs queries
```

### Testing

```bash
# Backend
python main.py

# Test endpoint
curl -X POST http://localhost:8000/api/copilot/labs/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cómo estuvo mi última sesión?"}'

# Frontend
npm run dev
# Navigate to /analisis-datasets
# Click copilot button
# Ask: "¿Cómo estuvo mi última sesión?"
```

---

## 🎯 SIGUIENTES PASOS INMEDIATOS

1. **Revisar** este plan actualizado
2. **Decidir** si empezar con Quick Start de 48h o implementación más gradual
3. **Preparar** environment (API keys, dependencias)
4. **Comenzar** con el tool más simple: `get_latest_session()`

¿Listo para empezar? 🚀