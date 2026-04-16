# ⚡ QUICK START LABS/ADA - PRIMERAS 48 HORAS

## 🎯 OBJETIVO
Copiloto funcional que responde queries sobre sesiones de meditación EEG:
- "¿Cómo estuvo mi última sesión?"
- "Compara mi sesión de hoy con la de ayer"
- "¿Cuándo alcanzaré el estado sintérgico?"

---

## 📋 PRE-REQUISITOS

### Ya tienes:
✅ Backend FastAPI funcionando (`localhost:8000`)
✅ PostgreSQL con tabla `sessions`
✅ InfluxDB con métricas EEG
✅ UI de análisis (`AnalisisDatasets.jsx`)
✅ BrainModel 3D

### Necesitas agregar:
- [ ] AI/LLM dependencies
- [ ] Copilot service (Labs-focused)
- [ ] Frontend copilot panel

---

## DÍA 1: BACKEND LABS COPILOT (4-5 horas)

### Step 1: Dependencies (15 min)

```bash
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/backend

# Install AI packages
pip install \
    langchain==0.1.0 \
    langchain-openai==0.0.5 \
    tiktoken==0.5.2 \
    scipy==1.11.4

# Verify
python -c "import langchain, scipy; print('✅ Dependencies OK')"
```

### Step 2: Environment Variables (10 min)

```bash
# Add to .env
cat >> .env << EOF

# AI APIs (get free keys)
OPENROUTER_API_KEY=sk-or-v1-xxx  # https://openrouter.ai/keys
GROQ_API_KEY=gsk_xxx             # https://console.groq.com/keys
EOF
```

### Step 3: Create AI Module Structure (10 min)

```bash
# Create folder structure
mkdir -p ai
touch ai/__init__.py
touch ai/llm_router.py
touch ai/eeg_analysis.py
touch ai/copilot_labs_service.py
```

### Step 4: LLM Router (30 min)

**ai/llm_router.py**:
```python
"""
LLM Router para seleccionar modelo según complejidad.
"""

from enum import Enum

class QueryComplexity(Enum):
    SIMPLE = "simple"      # 1 tool call
    MODERATE = "moderate"  # 2-3 tool calls
    COMPLEX = "complex"    # Multi-step reasoning

class LLMRouter:
    def __init__(self):
        self.free_models = {
            "gemini-flash": {
                "provider": "openrouter",
                "model_name": "google/gemini-flash-1.5",
            },
            "llama-70b": {
                "provider": "groq",
                "model_name": "llama3-70b-8192",
            },
        }
    
    def classify_complexity(self, message: str) -> QueryComplexity:
        """Clasifica complejidad basándose en keywords"""
        msg = message.lower()
        
        # Simple: preguntas directas
        if any(kw in msg for kw in ["última", "cuántos", "mostrar", "dame"]):
            return QueryComplexity.SIMPLE
        
        # Complex: análisis, predicciones
        if any(kw in msg for kw in ["predice", "cuándo", "analiza correlación", "compara con"]):
            return QueryComplexity.COMPLEX
        
        # Moderate: comparaciones, filtros
        return QueryComplexity.MODERATE
    
    def select_model(self, complexity: QueryComplexity):
        """Selecciona modelo apropiado"""
        if complexity == QueryComplexity.SIMPLE:
            return self.free_models["gemini-flash"]
        else:
            return self.free_models["llama-70b"]
```

### Step 5: EEG Analysis Functions (1 hora)

**ai/eeg_analysis.py**:
```python
"""
Funciones de análisis de datos EEG.
Ported from AnalisisDatasets.jsx
"""

from typing import List, Dict
from statistics import mean

def analyze_session_data(metrics: List[Dict]) -> Dict:
    """
    Analiza métricas EEG y genera insights.
    
    Returns:
        {
            "score": int (0-100),
            "avg_bands": {...},
            "phases": [...],
            "events": [...],
            "time_distribution": {...},
            "literature_comparison": {...},
            "syntergy_proximity": {...},
        }
    """
    if not metrics or len(metrics) < 5:
        return {"error": "Insufficient data (min 5 points)"}
    
    n = len(metrics)
    
    # Extract band data
    alpha_series = [m.get('alpha', 0) for m in metrics]
    theta_series = [m.get('theta', 0) for m in metrics]
    beta_series = [m.get('beta', 0) for m in metrics]
    gamma_series = [m.get('gamma', 0) for m in metrics]
    delta_series = [m.get('delta', 0) for m in metrics]
    coh_series = [m.get('coherence', 0) for m in metrics]
    
    # Averages
    avg_alpha = mean(alpha_series)
    avg_theta = mean(theta_series)
    avg_beta = mean(beta_series)
    avg_gamma = mean(gamma_series)
    avg_delta = mean(delta_series)
    avg_coherence = mean(coh_series)
    max_alpha = max(alpha_series)
    
    # Detect phases
    phases = detect_meditation_phases(metrics)
    
    # Detect mind-wandering events
    events = detect_mind_wandering(alpha_series, n)
    
    # Calculate score
    score = calculate_session_score(
        avg_alpha, avg_theta, avg_beta, avg_coherence, alpha_series
    )
    
    # Time distribution
    time_dist = {
        "deep": sum(1 for a in alpha_series if a >= 0.13) / n,
        "meditation": sum(1 for a in alpha_series if 0.08 <= a < 0.13) / n,
        "building": sum(1 for a in alpha_series if 0.04 <= a < 0.08) / n,
        "onset": sum(1 for a in alpha_series if a < 0.04) / n,
    }
    
    # Literature comparison
    lit_comp = {
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
    
    # Syntergy proximity
    syntergy = calculate_syntergy_proximity(max_alpha, avg_coherence)
    
    return {
        "score": score,
        "score_label": get_score_label(score),
        "avg_bands": {
            "alpha": avg_alpha,
            "theta": avg_theta,
            "beta": avg_beta,
            "gamma": avg_gamma,
            "delta": avg_delta,
        },
        "max_alpha": max_alpha,
        "avg_coherence": avg_coherence,
        "phases": phases,
        "time_distribution": time_dist,
        "events": events,
        "literature_comparison": lit_comp,
        "syntergy_proximity": syntergy,
    }


def detect_meditation_phases(metrics: List[Dict]) -> List[Dict]:
    """Detecta fases de meditación basadas en alpha"""
    n = len(metrics)
    window_size = max(5, n // 12)
    phases = []
    
    alpha_series = [m.get('alpha', 0) for m in metrics]
    theta_series = [m.get('theta', 0) for m in metrics]
    coh_series = [m.get('coherence', 0) for m in metrics]
    
    for i in range(0, n, window_size):
        window_alpha = alpha_series[i:i+window_size]
        window_theta = theta_series[i:i+window_size]
        window_coh = coh_series[i:i+window_size]
        
        avg_a = mean(window_alpha) if window_alpha else 0
        avg_t = mean(window_theta) if window_theta else 0
        avg_c = mean(window_coh) if window_coh else 0
        
        # Classify phase
        if avg_a >= 0.13:
            label = "deep"
        elif avg_a >= 0.08:
            label = "meditation"
        elif avg_a >= 0.04:
            label = "building"
        else:
            label = "onset"
        
        phases.append({
            "start_idx": i,
            "frac": i / n,
            "label": label,
            "avg_alpha": avg_a,
            "avg_theta": avg_t,
            "avg_coherence": avg_c,
        })
    
    return phases


def detect_mind_wandering(alpha_series: List[float], n: int) -> List[Dict]:
    """Detecta caídas bruscas en alpha (mind-wandering)"""
    window = max(3, n // 20)
    events = []
    
    i = window
    while i < n - window:
        before = mean(alpha_series[i-window:i])
        after = mean(alpha_series[i:i+window])
        
        # Detect >50% drop
        if before > 0.08 and after < before * 0.5:
            events.append({
                "idx": i,
                "frac": i / n,
                "alpha_before": before,
                "alpha_after": after,
                "drop_percent": ((before - after) / before) * 100,
            })
            i += window  # Skip to avoid duplicates
        else:
            i += 1
    
    return events


def calculate_session_score(
    avg_alpha: float,
    avg_theta: float,
    avg_beta: float,
    avg_coherence: float,
    alpha_series: List[float]
) -> int:
    """
    Calcula score de sesión (0-100).
    
    Componentes:
    - Alpha avg (max 30 pts): avg_alpha / 0.12 * 30
    - Theta avg (max 20 pts): avg_theta / 0.25 * 20
    - Coherence (max 20 pts): avg_coherence / 0.65 * 20
    - Beta bajo (max 15 pts): (1 - avg_beta/0.05) * 15
    - Time in deep (max 15 pts): % time alpha>=0.13
    """
    n = len(alpha_series)
    
    alpha_score = min(30, (avg_alpha / 0.12) * 30)
    theta_score = min(20, (avg_theta / 0.25) * 20)
    coh_score = min(20, (avg_coherence / 0.65) * 20)
    beta_score = min(15, max(0, (1 - avg_beta / 0.05)) * 15)
    deep_time_pct = sum(1 for a in alpha_series if a >= 0.13) / n
    deep_score = deep_time_pct * 100 * 0.15  # max 15 pts
    
    total = alpha_score + theta_score + coh_score + beta_score + deep_score
    return round(total)


def get_score_label(score: int) -> str:
    """Convierte score a label"""
    if score >= 75:
        return "Excelente"
    elif score >= 55:
        return "Buena"
    elif score >= 35:
        return "En desarrollo"
    else:
        return "Iniciando"


def calculate_syntergy_proximity(max_alpha: float, avg_coherence: float) -> Dict:
    """
    Calcula proximidad al estado sintérgico.
    
    Criterios Grinberg:
    - Alpha > 0.25 sostenido
    - Coherencia > 0.75
    - Duración: 5+ minutos
    """
    SYNTERGY_ALPHA = 0.25
    SYNTERGY_COH = 0.75
    
    alpha_gap = max(0, SYNTERGY_ALPHA - max_alpha)
    coh_gap = max(0, SYNTERGY_COH - avg_coherence)
    
    if max_alpha >= SYNTERGY_ALPHA and avg_coherence >= SYNTERGY_COH:
        status = "achieved"
        message = "¡Estado sintérgico alcanzado!"
    elif max_alpha >= 0.20:
        status = "very_close"
        message = f"Muy cerca. Gap: α {alpha_gap:.3f}, coh {coh_gap:.3f}"
    else:
        status = "building"
        message = f"En camino. Gap: α {alpha_gap:.3f}, coh {coh_gap:.3f}"
    
    return {
        "max_alpha": max_alpha,
        "avg_coherence": avg_coherence,
        "alpha_threshold": SYNTERGY_ALPHA,
        "coherence_threshold": SYNTERGY_COH,
        "alpha_gap": alpha_gap,
        "coherence_gap": coh_gap,
        "status": status,
        "message": message,
        "alpha_percentage": min(100, (max_alpha / SYNTERGY_ALPHA) * 100),
        "coherence_percentage": min(100, (avg_coherence / SYNTERGY_COH) * 100),
    }
```

### Step 6: Copilot Labs Service (1.5 horas)

**ai/copilot_labs_service.py**:
```python
"""
Copilot service especializado en análisis de sesiones EEG.
"""

from typing import Dict, List, Optional
import os
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from .llm_router import LLMRouter, QueryComplexity
from .eeg_analysis import analyze_session_data

class CopilotLabsService:
    """Copiloto para Labs/ADA"""
    
    def __init__(self, db_pool):
        self.db_pool = db_pool
        self.router = LLMRouter()
    
    async def get_latest_session(self) -> Dict:
        """Tool: Obtiene y analiza sesión más reciente"""
        async with self.db_pool.acquire() as conn:
            session = await conn.fetchrow("""
                SELECT * FROM sessions 
                ORDER BY started_at DESC 
                LIMIT 1
            """)
            
            if not session:
                return {"error": "No sessions found"}
            
            # Get metrics from InfluxDB
            # (reuse your existing logic from analytics/service.py)
            metrics = await self._get_session_metrics(session['id'])
            
            # Analyze
            analysis = analyze_session_data(metrics)
            
            return {
                "session_id": session['id'],
                "name": session.get('name', ''),
                "started_at": str(session['started_at']),
                "duration_seconds": session.get('duration_seconds'),
                "metrics_count": len(metrics),
                "analysis": analysis,
            }
    
    async def _get_session_metrics(self, session_id: int) -> List[Dict]:
        """
        Fetch metrics from InfluxDB.
        Reuse existing endpoint logic from /sessions/{id}/metrics
        """
        # TODO: Implement using existing InfluxDB query
        # For now, placeholder:
        from aioinflux import InfluxDBClient
        
        influx_client = InfluxDBClient(
            host=os.getenv('INFLUXDB_HOST', 'localhost'),
            port=int(os.getenv('INFLUXDB_PORT', 8086)),
            database=os.getenv('INFLUXDB_DB', 'brain_metrics'),
        )
        
        query = f"""
            SELECT * FROM session_metrics 
            WHERE session_id = '{session_id}'
            ORDER BY time ASC
        """
        
        result = await influx_client.query(query)
        
        metrics = []
        for point in result.get('results', [{}])[0].get('series', [{}])[0].get('values', []):
            # Parse InfluxDB response
            # Adjust based on your actual schema
            metrics.append({
                'alpha': point[1],
                'theta': point[2],
                'beta': point[3],
                'gamma': point[4],
                'delta': point[5],
                'coherence': point[6],
            })
        
        return metrics
    
    async def process_message(
        self, 
        message: str,
        user_tier: str = "free"
    ) -> Dict:
        """
        Procesa mensaje del usuario.
        
        Para MVP: Solo maneja "última sesión"
        """
        # 1. Classify complexity
        complexity = self.router.classify_complexity(message)
        
        # 2. Select model
        model_config = self.router.select_model(complexity)
        
        # 3. Initialize LLM
        if model_config["provider"] == "openrouter":
            llm = ChatOpenAI(
                model=model_config["model_name"],
                openai_api_base="https://openrouter.ai/api/v1",
                openai_api_key=os.getenv("OPENROUTER_API_KEY"),
                temperature=0.7,
            )
        elif model_config["provider"] == "groq":
            llm = ChatOpenAI(
                model=model_config["model_name"],
                openai_api_base="https://api.groq.com/openai/v1",
                openai_api_key=os.getenv("GROQ_API_KEY"),
                temperature=0.7,
            )
        
        # 4. Handle query (MVP: direct if-else)
        if "última" in message.lower() or "last" in message.lower():
            # Get latest session
            session_data = await self.get_latest_session()
            
            if "error" in session_data:
                return {
                    "text": "❌ No encontré sesiones en la base de datos.",
                    "widgets": [],
                    "model_used": "none",
                }
            
            # Generate response using LLM
            analysis = session_data['analysis']
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", """Eres un copiloto AI especializado en análisis de sesiones de meditación EEG.

Respondes de forma concisa, clara y motivadora.
Usas emojis para hacer la respuesta más visual.
Enfocas en insights accionables.

Datos disponibles:
- Score de sesión (0-100)
- Promedios de bandas (alpha, theta, beta, gamma, delta)
- Fases detectadas (onset, building, meditation, deep)
- Eventos de mind-wandering
- Comparación con literatura científica
- Proximidad al estado sintérgico (α≥0.25, coherencia≥0.75)
"""),
                ("human", f"""El usuario preguntó: "{message}"

Datos de la sesión:
- Nombre: {session_data.get('name', 'Sin nombre')}
- Duración: {session_data.get('duration_seconds', 0):.0f}s
- Score: {analysis['score']}/100 ({analysis['score_label']})
- Alpha promedio: {analysis['avg_bands']['alpha']:.3f}
- Alpha máximo: {analysis['max_alpha']:.3f}
- Theta promedio: {analysis['avg_bands']['theta']:.3f}
- Beta promedio: {analysis['avg_bands']['beta']:.3f}
- Coherencia promedio: {analysis['avg_coherence']:.3f}
- Tiempo en estado profundo: {analysis['time_distribution']['deep']*100:.1f}%
- Eventos de mind-wandering: {len(analysis['events'])}

Comparación con literatura:
- Alpha: {analysis['literature_comparison']['alpha']['status']} (target: 0.08-0.25)
- Theta: {analysis['literature_comparison']['theta']['status']} (target: 0.15-0.35)
- Beta: {analysis['literature_comparison']['beta']['status']} (target: <0.05)
- Coherencia: {analysis['literature_comparison']['coherence']['status']} (target: 0.50-0.80)

Proximidad sintérgica:
{analysis['syntergy_proximity']['message']}

Genera una respuesta natural, informativa y motivadora.
Estructura: Score → Highlights → Comparación literatura → Recomendación.
NO uses formato markdown de headers (###). Usa bullets (•) para listas.
""")
            ])
            
            chain = prompt | llm
            ai_response = await chain.ainvoke({})
            
            return {
                "text": ai_response.content,
                "widgets": [],  # TODO: Implement widget generation
                "model_used": model_config["model_name"],
                "complexity": complexity.value,
                "session_data": session_data,  # Para debug
            }
        
        # Default response for unhandled queries
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Eres un copiloto AI para análisis de sesiones EEG."),
            ("human", message)
        ])
        chain = prompt | llm
        ai_response = await chain.ainvoke({})
        
        return {
            "text": ai_response.content,
            "widgets": [],
            "model_used": model_config["model_name"],
        }
```

### Step 7: Add Endpoint to main.py (30 min)

**main.py** (agregar esto):
```python
# At top
from ai.copilot_labs_service import CopilotLabsService
from pydantic import BaseModel

# Pydantic models
class CopilotChatRequest(BaseModel):
    message: str
    user_tier: str = "free"

class CopilotChatResponse(BaseModel):
    text: str
    widgets: list
    model_used: str
    complexity: str = "unknown"

# In startup event
@app.on_event("startup")
async def startup():
    # ... existing code ...
    
    # Initialize Copilot Labs Service
    app.state.copilot_labs_service = CopilotLabsService(
        db_pool=app.state.db_pool
    )
    print("✅ Copilot Labs service initialized")

# New endpoint
@app.post("/api/copilot/labs/chat", response_model=CopilotChatResponse)
async def copilot_labs_chat(request: CopilotChatRequest):
    """
    Copiloto especializado en análisis de sesiones EEG.
    
    Example:
    POST /api/copilot/labs/chat
    {
        "message": "¿Cómo estuvo mi última sesión?",
        "user_tier": "free"
    }
    """
    service: CopilotLabsService = app.state.copilot_labs_service
    
    try:
        response = await service.process_message(
            message=request.message,
            user_tier=request.user_tier
        )
        return response
    except Exception as e:
        print(f"❌ Error in copilot: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            "text": f"❌ Error procesando tu mensaje: {str(e)}",
            "widgets": [],
            "model_used": "error",
            "complexity": "unknown",
        }
```

### Step 8: Test Backend (30 min)

```bash
# 1. Start server
python main.py

# Should see:
# ✅ Copilot Labs service initialized

# 2. Test endpoint with curl
curl -X POST http://localhost:8000/api/copilot/labs/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cómo estuvo mi última sesión?",
    "user_tier": "free"
  }'

# Expected response (example):
# {
#   "text": "🧠 Tu última sesión (23 feb, 847s) fue Excelente...",
#   "widgets": [],
#   "model_used": "google/gemini-flash-1.5",
#   "complexity": "simple"
# }

# 3. If error, check:
# - API keys in .env
# - Database connection
# - InfluxDB connection
```

**✅ DÍA 1 COMPLETO**: Backend copilot funcional!

---

## DÍA 2: FRONTEND INTEGRATION (4-5 horas)

### Step 1: Dependencies (10 min)

```bash
cd /Users/pedronassiff/Desktop/proyectos/random

# Install React Query for API calls
npm install react-query react-markdown
```

### Step 2: Create CopilotPanelLabs Component (2 horas)

**src/components/CopilotPanelLabs.jsx**:
```jsx
import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from 'react-query';
import ReactMarkdown from 'react-markdown';

const CopilotPanelLabs = ({ currentSession, onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '🧠 Hola! Soy tu copiloto para análisis de sesiones EEG. ¿En qué puedo ayudarte?',
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const { mutate: sendMessage, isLoading } = useMutation(
    async (userMessage) => {
      const response = await fetch('http://localhost:8000/api/copilot/labs/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          user_tier: 'free'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    },
    {
      onSuccess: (data) => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text,
          metadata: {
            model: data.model_used,
            complexity: data.complexity,
          }
        }]);
      },
      onError: (error) => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Error: ${error.message}`,
        }]);
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
    }]);
    
    setInput('');
    sendMessage(userMessage);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-black border-l border-white/10 flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            🧠 AI Copilot - Labs
          </h3>
          <p className="text-[10px] text-white/30 mt-0.5">EEG Analysis Assistant</p>
        </div>
        <button 
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors text-xl"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 text-sm">
                🤖
              </div>
            )}
            
            <div className={`max-w-[80%] ${
              msg.role === 'user' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/5 text-white/90'
            } rounded-lg px-3 py-2 text-sm`}>
              <ReactMarkdown 
                className="prose prose-invert prose-sm max-w-none"
                components={{
                  p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                  li: ({node, ...props}) => <li className="mb-1" {...props} />,
                  strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
              
              {msg.metadata && (
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 text-[9px] text-white/30">
                  <span>model: {msg.metadata.model}</span>
                  <span>•</span>
                  <span>{msg.metadata.complexity}</span>
                </div>
              )}
            </div>
            
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-sm">
                👤
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 text-sm">
              🤖
            </div>
            <div className="bg-white/5 rounded-lg px-3 py-2 flex items-center gap-1">
              <span className="w-2 h-2 bg-white/40 rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-pulse delay-75" />
              <span className="w-2 h-2 bg-white/40 rounded-full animate-pulse delay-150" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre tus sesiones..."
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ➤
          </button>
        </div>
        
        {/* Quick actions */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {['¿Cómo estuvo mi última sesión?', 'Compara hoy con ayer', 'Dame recomendaciones'].map(q => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setInput(q);
                // Auto-submit after a short delay
                setTimeout(() => {
                  if (!isLoading) {
                    setMessages(prev => [...prev, { role: 'user', content: q }]);
                    sendMessage(q);
                    setInput('');
                  }
                }, 100);
              }}
              disabled={isLoading}
              className="text-[10px] px-2 py-1 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 rounded border border-white/10 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};

export default CopilotPanelLabs;
```

### Step 3: Integrate into AnalisisDatasets (1 hora)

**src/pages/AnalisisDatasets.jsx** (modificar):

```jsx
// At top, add import
import CopilotPanelLabs from '../components/CopilotPanelLabs';
import { QueryClient, QueryClientProvider } from 'react-query';

// Create QueryClient outside component
const queryClient = new QueryClient();

// Inside component, add state
export default function AnalisisDatasets() {
  const { sessions, loading, error, reload } = useSessions()
  const [selected, setSelected] = useState(null)
  const [showCopilot, setShowCopilot] = useState(false)  // NEW

  return (
    <QueryClientProvider client={queryClient}>  {/* NEW: Wrap with provider */}
      <div className="h-screen w-screen bg-black text-white flex overflow-hidden">
        <Sidebar
          sessions={sessions}
          loading={loading}
          error={error}
          selected={selected}
          onSelect={setSelected}
          onReload={reload}
        />
        
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
        
        {/* NEW: Toggle button */}
        <button
          onClick={() => setShowCopilot(!showCopilot)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all z-40 hover:scale-110"
          title="Toggle AI Copilot"
        >
          {showCopilot ? '✕' : '🤖'}
        </button>
      </div>
    </QueryClientProvider>
  )
}
```

### Step 4: Test Frontend (30 min)

```bash
# Start dev server
npm run dev

# Navigate to: http://localhost:5173/analisis-datasets

# Test:
# 1. Click copilot button (bottom-right)
# 2. Panel should slide in from right
# 3. Try quick action: "¿Cómo estuvo mi última sesión?"
# 4. Wait for AI response
# 5. Should see formatted response with score, bands, etc.
```

**✅ DÍA 2 COMPLETO**: Frontend copilot integrado!

---

## ✅ CHECKLIST COMPLETO

### Backend
- [x] Dependencies instaladas (langchain, scipy, etc)
- [x] API keys configuradas (OPENROUTER_API_KEY, GROQ_API_KEY)
- [x] Carpeta `ai/` creada
- [x] `ai/llm_router.py` implementado
- [x] `ai/eeg_analysis.py` implementado
- [x] `ai/copilot_labs_service.py` implementado
- [x] Endpoint `/api/copilot/labs/chat` agregado a main.py
- [x] Test con curl exitoso

### Frontend
- [x] Dependencies instaladas (react-query, react-markdown)
- [x] `CopilotPanelLabs.jsx` creado
- [x] Integrado en `AnalisisDatasets.jsx`
- [x] Toggle button funcionando
- [x] Quick actions configuradas
- [x] Test en browser exitoso

---

## 🎯 PRÓXIMOS PASOS (POST-48H)

Una vez que tengas el MVP funcionando:

### Semana 2:
1. **Agregar más tools**:
   - `compare_sessions(id1, id2)`
   - `compare_with_reference(session_id, dataset)`
   - `predict_syntergy_path(user_id)`

2. **Widget generation**:
   - Phase timeline
   - Alpha+Theta trajectory
   - Band comparison bars
   - Syntergy progress gauge

3. **Mejorar prompts**:
   - Más contexto sobre teoría sintérgica
   - Ejemplos de respuestas ideales
   - Formato estructurado

### Semana 3-4:
4. **Real-time analysis**:
   - WebSocket integration con `/brain/field`
   - Live feedback durante sesión activa
   - Adaptive suggestions

5. **Advanced analytics**:
   - Historical trends
   - Statistical comparisons
   - ML predictions (scipy.stats.linregress)

---

## 🐛 TROUBLESHOOTING

### Backend no arranca
```bash
# Check Python version
python --version  # Should be 3.9+

# Check dependencies
pip list | grep langchain

# Check environment
cat .env | grep API_KEY
```

### API keys no funcionan
```bash
# Test OpenRouter
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Should return list of models
```

### InfluxDB connection fails
```python
# In main.py, add debug:
print(f"InfluxDB: {os.getenv('INFLUXDB_HOST')}:{os.getenv('INFLUXDB_PORT')}")

# Check if InfluxDB is running:
curl http://localhost:8086/ping
```

### Frontend no conecta con backend
```javascript
// In CopilotPanelLabs.jsx, add:
console.log('Sending to:', 'http://localhost:8000/api/copilot/labs/chat')

// Check CORS in main.py:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 💡 TIPS

1. **Usa quick actions**: Son más rápidas que escribir
2. **Revisa metadata**: Model + complexity en cada respuesta
3. **Itera prompts**: Si respuesta no es buena, mejora el prompt en `copilot_labs_service.py`
4. **Debug con print()**: Agrega prints para ver qué está pasando
5. **Empieza simple**: Primero haz funcionar 1 query, luego agrega más

---

¿Listo para empezar? 🚀

**Siguiente comando**:
```bash
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/backend
pip install langchain langchain-openai tiktoken scipy
```