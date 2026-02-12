"""
Claude Client - Cliente reutilizable para interactuar con Claude API
"""
import anthropic
from typing import Optional, Dict, Any, List
import os
from automation.config import config


class ClaudeClient:
    """Cliente para interactuar con Claude API"""
    
    def __init__(self):
        api_key = config.CLAUDE_API_KEY or os.getenv("CLAUDE_API_KEY")
        if not api_key:
            raise ValueError("CLAUDE_API_KEY not found in environment")
        
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = config.CLAUDE_MODEL
        self.max_tokens = config.CLAUDE_MAX_TOKENS
    
    async def score_lead(
        self,
        company_name: str,
        industry: Optional[str] = None,
        company_size: Optional[str] = None,
        website: Optional[str] = None,
        linkedin_url: Optional[str] = None,
        tech_stack: Optional[Dict[str, Any]] = None,
        location: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Score un lead usando Claude
        
        Returns:
            {
                "score": 85,
                "category": "high",
                "reasoning": "...",
                "recommended_approach": "..."
            }
        """
        
        prompt = f"""Eres un analista experto evaluando leads para Random Lab, un estudio que fusiona ciencia, tecnología, arte y espiritualidad. 

**Nicho único de Random:**
- Brain Prototype: Visualización 3D de actividad cerebral en tiempo real con neurociencia aplicada
- Plataforma Hermes: Tech + meditación + prácticas contemplativas para optimización cognitiva
- Intersección ciencia/espiritualidad: Neurotechnology, wellness tech, consciousness hacking
- Arte generativo + datos biométricos: Experiencias inmersivas
- Stack tech avanzado: WebGL, Three.js, real-time data viz, ML/AI

**Perfil de cliente ideal:**
- Wellness tech: Apps de meditación, biohacking, neurofeedback
- Consciousness tech: Startups en mindfulness, terapias digitales, mental health
- Creative tech: Estudios que mezclan arte + ciencia + tecnología
- Health tech: Plataformas de salud mental, cognitive enhancement
- Innovation labs: Equipos explorando fronteras de human enhancement
- Cultural/artistic projects: Museos, instalaciones, experiencias inmersivas

Evalúa este lead y asigna un score de 0-100:

**Lead Info:**
- Empresa: {company_name}
- Industria: {industry or 'Desconocida'}
- Tamaño: {company_size or 'Desconocido'}
- Ubicación: {location or 'Desconocida'}
- Website: {website or 'No disponible'}
- LinkedIn: {linkedin_url or 'No disponible'}
- Tech Stack: {tech_stack or 'Desconocido'}

**Criterios de Scoring:**
- Industry alignment (35%): Wellness tech, neurotechnology, consciousness tech, creative tech, health tech = muy alto. Pure SaaS tradicional = medio. Finanzas/seguros = bajo
- Vision/mission fit (25%): Menciona meditación, bienestar, neurociencia, arte+tech, consciencia = alto bonus
- Tech sophistication (20%): 3D/WebGL, real-time data, biometrics, ML/AI = ideal. Stack moderno cloud = bueno
- Company stage (10%): Startups innovadoras 10-200 empleados = ideal. Corporates explorando = medio
- Location (10%): Europa (Barcelona/España bonus). US wellness hubs (SF, LA, Boulder) = bonus

**Responde SOLO con este JSON (sin markdown, sin explicaciones extra):**
{{
  "score": 85,
  "category": "high",
  "reasoning": "Empresa tech en Barcelona con stack moderno y tamaño ideal para Random",
  "fit_highlights": ["SaaS en crecimiento", "Stack moderno", "Ubicación ideal"],
  "concerns": ["Posible limitación presupuestaria"],
  "recommended_approach": "Lead directo al CTO con caso de uso específico"
}}

Categorías:
- high: score >= 80
- medium: score 60-79
- low: score < 60"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extraer JSON del response
            response_text = message.content[0].text
            
            # Limpiar markdown si existe
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            import json
            result = json.loads(response_text.strip())
            
            return result
            
        except Exception as e:
            print(f"❌ Error scoring lead with Claude: {e}")
            # Fallback a scoring básico
            return {
                "score": 50,
                "category": "medium",
                "reasoning": f"Error en scoring con IA: {str(e)}. Score asignado por defecto.",
                "fit_highlights": [],
                "concerns": ["Error en análisis automático"],
                "recommended_approach": "Review manual requerido"
            }
    
    async def generate_content(
        self,
        topic: str,
        content_type: str,
        tone: str = "philosophical",
        target_audience: str = "CTOs",
        additional_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generar contenido con Claude usando filosofía Random
        
        Returns:
            {
                "title": "...",
                "body": "...",
                "hashtags": ["Random", "Innovation"]
            }
        """
        
        # Filosofía Random para el system prompt
        random_philosophy = """Eres un content creator para Random Lab, un estudio que fusiona ciencia, tecnología, arte y espiritualidad.

ESENCIA RANDOM:
- Encontramos señales donde otros ven ruido (en cerebros, en datos, en experiencias)
- Fusionamos neurociencia + meditación + código + visualización 3D
- Brain Prototype: Visualizamos la mente en tiempo real - biofeedback como arte
- Plataforma Hermes: Tech para expandir consciencia, no solo productividad
- La mejor solución emerge de observar → perturbar → ajustar (como en meditación)
- Como en termodinámica: el caos precede al orden cristalino
- La innovación está en la intersección: donde ciencia encuentra espiritualidad

PROYECTOS CLAVE:
- Brain Prototype: Modelo 3D del cerebro + visualización de ondas cerebrales en tiempo real
- Plataforma de meditación + neurofeedback (nombre Hermes en desarrollo)
- Experiencias inmersivas: Arte generativo desde datos biométricos
- Tech stack: WebGL, Three.js, real-time data, EEG processing, ML/AI

FILOSOFÍA:
- La tecnología puede ser contemplativa, no solo productiva
- Los datos cerebrales son una forma de arte
- La meditación es ciencia aplicada, no misticismo vago
- Perturbamos el status quo: ¿Y si el bienestar fuera medible? ¿Y si la consciencia tuviera API?

TONO POR TIPO:
- Philosophical: Conecta neurociencia con práctica contemplativa. Profundo pero accesible. Cuestiona límites entre mente/máquina
- Technical: Arquitectura + biometrics + 3D viz. Muestra expertise en intersección tech/wellness
- Inspirational: Transformación interior meets tech. Auténtico, nunca new-age vacío

ESTRUCTURA TÍPICA:de neurociencia, física cuántica, estados de consciencia. Conecta meditación con datos. Cuestiona límites entre interior/exterior, mente/código.",
            "technical": "Profundiza en 3D viz, WebGL, real-time biometrics, EEG processing. Muestra como tech puede ser contemplativa. Arquitectura de consciencia.",
            "inspirational": "Transforma desde dentro (con tech como herramienta). Menciona Brain Prototype/Hermes si es relevante. Auténtico, científico, nunca místico vací
3. Twist Random (la perspectiva única donde tech meets inner work)
4. Cierre memorable con pregunta sobre posibilidades futuras

EVITA:
- Lenguaje corporativo genérico o new-age vacío
- Buzzwords wellness sin sustancia científica
- Separar tech de espiritualidad (nuestra magia es la fusión)
- Prometer enlightenment instantáneo o soluciones mágicas"""

        tone_instructions = {
            "philosophical": "Usa metáforas científicas (termodinámica, física, química). Cuestiona lo establecido. Invita a pensar diferente.",
            "technical": "Profundiza en arquitectura y decisiones técnicas. Muestra expertise sin arrogancia. Comparte insights prácticos.",
            "inspirational": "Conecta con aspiraciones reales. Muestra transformación posible. Auténtico, no corporativo."
        }
        
        tone_instruction = tone_instructions.get(tone, tone_instructions["philosophical"])
        
        prompt = f"""Genera un post de LinkedIn para Random Lab sobre: **{topic}**

Target: {target_audience}
Tono: {tone} - {tone_instruction}
{f'Contexto adicional: {additional_context}' if additional_context else ''}

Requisitos:
- Longitud: 150-250 palabras
- Conecta con nuestra esencia: ciencia + tecnología + arte + espiritualidad
- Si es relevante, menciona Brain Prototype (visualización 3D cerebro) o plataforma Hermes (meditación + tech)
- Estructura: Hook → Insight desde proyecto real → Twist Random → Cierre provocador
- Incluir 3-5 hashtags (siempre #Random, considera: #Neuroscience #WellnessTech #ConsciousnessTech #Meditation #BrainData)
- Lenguaje: Español natural, evitar anglicismos innecesarios
- Sin emojis excesivos (máximo 2-3 si son relevantes)
- Auténtico: científico pero no frío, espiritual pero no místico

Responde SOLO con este JSON:
{{
  "title": "Título corto y provocador (max 60 chars)",
  "body": "Contenido del post con filosofía Random: tech meets inner work",
  "hashtags": ["Random", "Neuroscience", "..."]
}}"""

        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=random_philosophy,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extraer JSON del response
            response_text = message.content[0].text
            
            # Limpiar markdown
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            import json
            result = json.loads(response_text.strip())
            
            return result
            
        except Exception as e:
            print(f"❌ Error generating content with Claude: {e}")
            # Fallback
            return {
                "title": f"Explorando {topic}",
                "body": f"Error generando contenido: {str(e)}",
                "hashtags": ["Random", "Innovation"]
            }


# Singleton instance
_claude_client = None

def get_claude_client() -> ClaudeClient:
    """Get or create Claude client singleton"""
    global _claude_client
    if _claude_client is None:
        _claude_client = ClaudeClient()
    return _claude_client
