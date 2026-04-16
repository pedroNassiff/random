# ⚡ QUICK START - PRIMERAS 48 HORAS

## 🎯 OBJETIVO
Tener un copiloto funcional que responda "¿Cuántos leads tengo?" y muestre un widget.

---

## DÍA 1: BACKEND SETUP (4-5 horas)

### Step 1: Dependencias (30 min)

```bash
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/backend

# Install AI dependencies
pip install langchain==0.1.0 \
            langchain-openai==0.0.5 \
            langchain-anthropic==0.0.1 \
            tiktoken==0.5.2 \
            groq==0.4.1

# Verify installation
python -c "import langchain; print('✅ Langchain installed')"
```

### Step 2: Environment Variables (15 min)

```bash
# Add to .env
cat >> .env << EOF

# AI/LLM APIs
OPENROUTER_API_KEY=sk-or-v1-xxx  # Get from https://openrouter.ai/
GROQ_API_KEY=gsk_xxx             # Get from https://console.groq.com/
ANTHROPIC_API_KEY=sk-ant-xxx     # Optional, for premium features
EOF
```

**Obtener API Keys**:
1. OpenRouter (free): https://openrouter.ai/keys
2. Groq (free): https://console.groq.com/keys
3. Anthropic (premium): https://console.anthropic.com/

### Step 3: LLM Router (1 hora)

Crear `backend/ai/__init__.py`:
```python
# backend/ai/__init__.py
```

Crear `backend/ai/llm_router.py`:
```python
# backend/ai/llm_router.py

from enum import Enum
from typing import Optional
import os

class QueryComplexity(Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"

class LLMRouter:
    """Decide qué modelo usar basándose en complejidad"""
    
    def __init__(self):
        self.free_models = {
            "gemini-flash-1.5": {
                "provider": "openrouter",
                "model_name": "google/gemini-flash-1.5",
            },
            "llama-70b": {
                "provider": "groq",
                "model_name": "llama3-70b-8192",
            },
        }
        
        self.premium_models = {
            "claude-3.5-sonnet": {
                "provider": "anthropic",
                "model_name": "claude-3-5-sonnet-20241022",
            },
        }
    
    def classify_complexity(self, message: str) -> QueryComplexity:
        """Clasifica complejidad de la query"""
        message_lower = message.lower()
        
        # Keywords simples
        simple_keywords = ["cuántos", "cuántas", "total", "count", "suma"]
        if any(kw in message_lower for kw in simple_keywords):
            return QueryComplexity.SIMPLE
        
        # Keywords complejos
        complex_keywords = ["analiza", "correlación", "predice", "optimiza"]
        if any(kw in message_lower for kw in complex_keywords):
            return QueryComplexity.COMPLEX
        
        return QueryComplexity.MODERATE
    
    def select_model(self, complexity: QueryComplexity, user_tier: str = "free"):
        """Selecciona modelo apropiado"""
        if user_tier == "premium" and complexity == QueryComplexity.COMPLEX:
            return self.premium_models["claude-3.5-sonnet"]
        
        # Para free tier o queries simples, usar modelos gratuitos
        if complexity == QueryComplexity.SIMPLE:
            return self.free_models["gemini-flash-1.5"]
        else:
            return self.free_models["llama-70b"]
```

### Step 4: Copilot Service (2 horas)

Crear `backend/ai/copilot_service.py`:
```python
# backend/ai/copilot_service.py

from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain.prompts import ChatPromptTemplate
from .llm_router import LLMRouter, QueryComplexity
import os
import json

class CopilotService:
    """Servicio principal del copiloto AI"""
    
    def __init__(self, db_pool):
        self.db_pool = db_pool
        self.router = LLMRouter()
    
    async def get_leads_count(self) -> Dict:
        """Tool: Obtiene conteo de leads"""
        async with self.db_pool.acquire() as conn:
            total = await conn.fetchval("SELECT COUNT(*) FROM leads")
            
            by_status = await conn.fetch("""
                SELECT status, COUNT(*) as count 
                FROM leads 
                GROUP BY status
            """)
            
            return {
                "total": total,
                "by_status": [
                    {"status": row["status"], "count": row["count"]} 
                    for row in by_status
                ]
            }
    
    async def process_message(
        self, 
        message: str, 
        user_tier: str = "free"
    ) -> Dict:
        """Procesa un mensaje del usuario"""
        
        # 1. Clasificar complejidad
        complexity = self.router.classify_complexity(message)
        
        # 2. Seleccionar modelo
        model_config = self.router.select_model(complexity, user_tier)
        
        # 3. Inicializar LLM
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
        elif model_config["provider"] == "anthropic":
            llm = ChatAnthropic(
                model=model_config["model_name"],
                anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
                temperature=0.7,
            )
        
        # 4. Para MVP, manejar query específica directamente
        if "cuántos leads" in message.lower() or "leads tengo" in message.lower():
            # Ejecutar tool
            leads_data = await self.get_leads_count()
            
            # Generar respuesta
            prompt = ChatPromptTemplate.from_messages([
                ("system", """Eres un copiloto AI para Random Dashboard.
Responde de forma concisa y amigable.
Usa emojis para hacer la respuesta más visual."""),
                ("human", f"""El usuario preguntó: "{message}"

Datos de leads:
{json.dumps(leads_data, indent=2)}

Genera una respuesta informativa y sugiere crear un widget de pie chart.
""")
            ])
            
            chain = prompt | llm
            ai_response = await chain.ainvoke({})
            
            # Preparar widget
            widget = {
                "type": "pie_chart",
                "title": "Distribución de Leads",
                "data": [
                    {"label": status["status"], "value": status["count"]}
                    for status in leads_data["by_status"]
                ]
            }
            
            return {
                "text": ai_response.content,
                "widgets": [widget],
                "model_used": model_config["model_name"],
                "complexity": complexity.value,
            }
        
        # Para otras queries, respuesta genérica por ahora
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Eres un copiloto AI para Random Dashboard."),
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

### Step 5: API Endpoint (1 hora)

Modificar `backend/main.py`:
```python
# backend/main.py - AGREGAR ESTO

from ai.copilot_service import CopilotService
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

# Inicializar en startup
@app.on_event("startup")
async def startup():
    # ... existing code ...
    
    # Initialize Copilot Service
    app.state.copilot_service = CopilotService(
        db_pool=app.state.db_pool
    )
    print("✅ Copilot service initialized")

# Endpoint
@app.post("/api/copilot/chat", response_model=CopilotChatResponse)
async def copilot_chat(request: CopilotChatRequest):
    """
    Procesa un mensaje del copiloto AI.
    
    Example request:
    {
        "message": "¿Cuántos leads tengo?",
        "user_tier": "free"
    }
    """
    service: CopilotService = app.state.copilot_service
    
    try:
        response = await service.process_message(
            message=request.message,
            user_tier=request.user_tier
        )
        return response
    except Exception as e:
        print(f"Error in copilot: {e}")
        return {
            "text": f"❌ Error procesando tu mensaje: {str(e)}",
            "widgets": [],
            "model_used": "error",
        }
```

### Step 6: Test Backend (30 min)

```bash
# Start server
python main.py

# In another terminal, test with curl:
curl -X POST http://localhost:8000/api/copilot/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuántos leads tengo?",
    "user_tier": "free"
  }'

# Expected response:
# {
#   "text": "🎯 Tienes 47 leads en total...",
#   "widgets": [{...}],
#   "model_used": "google/gemini-flash-1.5"
# }
```

---

## DÍA 2: FRONTEND SETUP (4-5 horas)

### Step 1: Dependencias (15 min)

```bash
cd /Users/pedronassiff/Desktop/proyectos/random

# Install dependencies
npm install zustand react-query recharts react-markdown
```

### Step 2: State Management (30 min)

Crear `src/stores/copilotStore.js`:
```javascript
// src/stores/copilotStore.js

import { create } from 'zustand';

const useCopilotStore = create((set) => ({
  // State
  currentTab: 'analytics',
  activeFilters: {},
  visibleWidgets: [],
  messages: [
    {
      role: 'assistant',
      content: '¡Hola! Soy tu copiloto. ¿En qué puedo ayudarte?',
    }
  ],
  isLoading: false,
  
  // Actions
  setTab: (tab) => set({ currentTab: tab }),
  
  addWidget: (widget) => set((state) => ({
    visibleWidgets: [...state.visibleWidgets, widget]
  })),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  clearWidgets: () => set({ visibleWidgets: [] }),
}));

export default useCopilotStore;
```

### Step 3: CopilotPanel Component (2 horas)

Crear `src/components/CopilotPanel.jsx`:
```javascript
// src/components/CopilotPanel.jsx

import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from 'react-query';
import ReactMarkdown from 'react-markdown';
import useCopilotStore from '../stores/copilotStore';
import '../styles/CopilotPanel.css';

const CopilotPanel = () => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  
  const { 
    messages, 
    isLoading, 
    addMessage, 
    setLoading, 
    addWidget 
  } = useCopilotStore();

  const { mutate: sendMessage } = useMutation(
    async (userMessage) => {
      const response = await fetch('http://localhost:8000/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          user_tier: 'free'
        }),
      });
      
      if (!response.ok) throw new Error('API error');
      return response.json();
    },
    {
      onMutate: () => setLoading(true),
      onSuccess: (data) => {
        // Add AI response
        addMessage({
          role: 'assistant',
          content: data.text,
        });
        
        // Generate widgets
        if (data.widgets && data.widgets.length > 0) {
          data.widgets.forEach(widget => addWidget(widget));
        }
        
        setLoading(false);
      },
      onError: (error) => {
        addMessage({
          role: 'assistant',
          content: `❌ Error: ${error.message}`,
        });
        setLoading(false);
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    
    // Add user message
    addMessage({
      role: 'user',
      content: userMessage,
    });
    
    setInput('');
    sendMessage(userMessage);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="copilot-panel">
      <div className="copilot-header">
        <h3>🤖 AI Copilot</h3>
        <span className="status-badge">Free Tier</span>
      </div>

      <div className="messages-container">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta algo sobre tus datos..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          ➤
        </button>
      </form>
    </div>
  );
};

export default CopilotPanel;
```

### Step 4: Sidebar Component (30 min)

Crear `src/components/Sidebar.jsx`:
```javascript
// src/components/Sidebar.jsx

import React from 'react';
import useCopilotStore from '../stores/copilotStore';
import '../styles/Sidebar.css';

const Sidebar = () => {
  const { currentTab, setTab } = useCopilotStore();
  
  const tabs = [
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'automation', icon: '🤖', label: 'Automation' },
    { id: 'labs', icon: '🔬', label: 'Labs' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-symbol">🎲</span>
        <span className="logo-text">RANDOM</span>
      </div>
      
      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => setTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
```

### Step 5: DashboardLayout (1 hora)

Crear `src/components/DashboardLayout.jsx`:
```javascript
// src/components/DashboardLayout.jsx

import React from 'react';
import Sidebar from './Sidebar';
import CopilotPanel from './CopilotPanel';
import useCopilotStore from '../stores/copilotStore';
import Analytics from '../pages/Analytics';
import Automation from '../pages/Automation';
import '../styles/DashboardLayout.css';

const DashboardLayout = () => {
  const { currentTab, visibleWidgets } = useCopilotStore();

  return (
    <div className="dashboard-layout">
      <Sidebar />
      
      <main className="workspace">
        {/* Base content según tab activo */}
        <div className="base-content">
          {currentTab === 'analytics' && <Analytics />}
          {currentTab === 'automation' && <Automation />}
          {currentTab === 'labs' && (
            <div className="coming-soon">
              <h2>🔬 Labs</h2>
              <p>Coming soon...</p>
            </div>
          )}
        </div>
        
        {/* Widgets AI-generados */}
        {visibleWidgets.length > 0 && (
          <div className="ai-widgets-container">
            <h3>AI Generated Insights</h3>
            {visibleWidgets.map((widget, idx) => (
              <div key={idx} className="widget-card">
                <h4>{widget.title}</h4>
                <p>Widget type: {widget.type}</p>
                {/* TODO: Implementar renderizado de widgets */}
              </div>
            ))}
          </div>
        )}
      </main>
      
      <CopilotPanel />
    </div>
  );
};

export default DashboardLayout;
```

### Step 6: Estilos Básicos (30 min)

Crear `src/styles/DashboardLayout.css`:
```css
/* src/styles/DashboardLayout.css */

.dashboard-layout {
  display: grid;
  grid-template-columns: 200px 1fr 350px;
  height: 100vh;
  background: #0a0a0a;
  color: #fff;
}

.sidebar {
  background: #111;
  border-right: 1px solid #222;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  margin-bottom: 30px;
}

.logo-symbol {
  font-size: 32px;
}

.logo-text {
  font-size: 20px;
  font-weight: bold;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 10px;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.tab-button:hover {
  background: #1a1a1a;
  color: #fff;
}

.tab-button.active {
  background: #8B5CF6;
  color: #fff;
}

.tab-icon {
  font-size: 20px;
}

.tab-label {
  font-size: 14px;
}

.workspace {
  overflow-y: auto;
  padding: 20px;
}

.ai-widgets-container {
  margin-top: 30px;
  padding: 20px;
  background: #111;
  border-radius: 12px;
}

.widget-card {
  background: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  margin-top: 15px;
}
```

Crear `src/styles/CopilotPanel.css`:
```css
/* src/styles/CopilotPanel.css */

.copilot-panel {
  background: #111;
  border-left: 1px solid #222;
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.copilot-header {
  padding: 20px;
  border-bottom: 1px solid #222;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copilot-header h3 {
  margin: 0;
  font-size: 16px;
}

.status-badge {
  font-size: 11px;
  padding: 4px 8px;
  background: #8B5CF6;
  border-radius: 4px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message {
  display: flex;
  gap: 10px;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  padding: 12px;
  background: #1a1a1a;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
}

.message.assistant .message-content {
  background: #8B5CF620;
}

.typing {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing span {
  width: 6px;
  height: 6px;
  background: #888;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-8px);
  }
}

.input-form {
  padding: 20px;
  border-top: 1px solid #222;
  display: flex;
  gap: 10px;
}

.input-form input {
  flex: 1;
  padding: 12px 16px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
}

.input-form input:focus {
  outline: none;
  border-color: #8B5CF6;
}

.input-form button {
  padding: 12px 20px;
  background: #8B5CF6;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 18px;
  transition: background 0.2s;
}

.input-form button:hover:not(:disabled) {
  background: #7C3AED;
}

.input-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Step 7: Integrar en App (15 min)

Modificar `src/App.jsx`:
```javascript
// src/App.jsx

import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import DashboardLayout from './components/DashboardLayout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout />
    </QueryClientProvider>
  );
}

export default App;
```

### Step 8: Test Frontend (30 min)

```bash
# Start dev server
npm run dev

# Navigate to http://localhost:5173
# Try asking: "¿Cuántos leads tengo?"
```

---

## ✅ CHECKLIST COMPLETO

### Backend
- [x] Dependencias instaladas
- [x] API keys configuradas
- [x] LLMRouter implementado
- [x] CopilotService implementado
- [x] Endpoint /api/copilot/chat funcionando
- [x] Test con curl exitoso

### Frontend
- [x] Dependencias instaladas
- [x] Zustand store creado
- [x] CopilotPanel component
- [x] Sidebar component
- [x] DashboardLayout component
- [x] Estilos aplicados
- [x] Test en browser exitoso

---

## 🎯 SIGUIENTE PASO

Una vez que tengas esto funcionando (48 horas), el siguiente paso es:

1. **Agregar más tools** (filter_leads, get_analytics_summary)
2. **Implementar widget renderer** (para mostrar charts reales)
3. **Mejorar prompts** (para respuestas más naturales)
4. **Agregar caching** (para reducir latencia)

¿Necesitas ayuda con algún paso específico? 🚀