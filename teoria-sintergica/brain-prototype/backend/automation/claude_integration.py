"""
Claude AI Integration - Scoring de leads y generación de contenido
"""
import json
from typing import Dict, Any, Optional
from anthropic import AsyncAnthropic
from automation.config import config


class ClaudeService:
    """Servicio para integración con Claude API"""
    
    def __init__(self):
        if not config.CLAUDE_API_KEY:
            print("⚠️  CLAUDE_API_KEY not configured - using fallback methods")
            self.client = None
        else:
            self.client = AsyncAnthropic(api_key=config.CLAUDE_API_KEY)
    
    async def score_lead(
        self,
        company_name: str,
        industry: Optional[str],
        company_size: Optional[str],
        location: Optional[str],
        website: Optional[str],
        linkedin_url: Optional[str],
        tech_stack: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Score un lead usando Claude
        
        Returns:
            {"score": int, "category": str, "reasoning": str}
        """
        
        if not self.client:
            return self._fallback_score_lead(industry, company_size, website, linkedin_url)
        
        try:
            # Construir contexto del lead
            lead_context = f"""
Empresa: {company_name}
Industria: {industry or 'No especificada'}
Tamaño: {company_size or 'No especificado'}
Ubicación: {location or 'No especificada'}
Website: {website or 'No disponible'}
LinkedIn: {linkedin_url or 'No disponible'}
Tech Stack: {json.dumps(tech_stack) if tech_stack else 'No disponible'}
"""
            
            prompt = f"""Eres un experto en analizar leads B2B para Random, una consultora de innovación y desarrollo tecnológico en Barcelona.

Nuestra misión: Ayudar a empresas a navegar la complejidad tecnológica mediante automatización inteligente, arquitecturas escalables y transformación digital.

Cliente ideal:
- Empresas tech/SaaS de 50-500 empleados
- Ubicadas en Barcelona o España
- Necesitan: desarrollo web avanzado, automatización, IA, arquitecturas complejas
- Presupuesto: €50K-500K/año en tech
- Buscan partners estratégicos, no solo vendors

Analiza este lead y proporciona:
1. Score de 0-100 (qué tan buen fit es)
2. Categoría: "high" (80-100), "medium" (50-79) o "low" (0-49)
3. Razonamiento: 2-3 frases explicando por qué

Lead:
{lead_context}

Responde SOLO en formato JSON:
{{"score": 85, "category": "high", "reasoning": "Tu análisis aquí en 2-3 frases"}}"""

            message = await self.client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Parsear respuesta
            response_text = message.content[0].text.strip()
            
            # Extraer JSON si está dentro de markdown
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            result = json.loads(response_text)
            
            # Validar formato
            if not all(k in result for k in ["score", "category", "reasoning"]):
                raise ValueError("Invalid response format")
            
            return {
                "score": int(result["score"]),
                "category": result["category"],
                "reasoning": result["reasoning"]
            }
            
        except Exception as e:
            print(f"⚠️  Claude API failed for lead scoring: {e}")
            return self._fallback_score_lead(industry, company_size, website, linkedin_url)
    
    def _fallback_score_lead(
        self,
        industry: Optional[str],
        company_size: Optional[str],
        website: Optional[str],
        linkedin_url: Optional[str]
    ) -> Dict[str, Any]:
        """Fallback scoring cuando Claude API no está disponible"""
        import random
        
        score = 50
        
        # Bonus por industria
        if industry and industry.lower() in ['software', 'technology', 'fintech', 'saas', 'tech']:
            score += 20
        
        # Bonus por tamaño
        if company_size in ['51-200', '201-500', '501-1000']:
            score += 15
        
        # Bonus por datos completos
        if website and linkedin_url:
            score += 10
        
        # Variación
        score += random.randint(-5, 10)
        score = min(95, max(40, score))
        
        reasoning = f"Lead {'con alto potencial' if score > 80 else 'con potencial medio' if score > 60 else 'básico'} en sector {industry or 'desconocido'}. Empresa de tamaño {company_size or 'desconocido'}."
        category = "high" if score > 80 else "medium" if score > 60 else "low"
        
        return {
            "score": score,
            "category": category,
            "reasoning": reasoning
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
        Generar contenido usando Claude
        
        Returns:
            {"title": str, "body": str}
        """
        
        if not self.client:
            return self._fallback_generate_content(topic, content_type, tone)
        
        try:
            # Prompt según el tono
            tone_prompts = {
                "philosophical": """Escribe desde la filosofía de Random: encontrar patrones en el caos, perturbar lo establecido, 
cuestionar lo obvio. Usa metáforas de física, termodinámica, sistemas complejos. 
Tono: reflexivo, profundo pero accesible, con preguntas provocadoras.""",
                
                "technical": """Escribe como un arquitecto de software senior: análisis profundo, patrones técnicos, 
trade-offs claros, experiencias reales. Tono: preciso, informado, sin bullshit.""",
                
                "inspirational": """Escribe sobre transformación y posibilidad: cómo la tecnología bien aplicada cambia organizaciones.
Tono: optimista pero realista, inspirador sin ser cursi."""
            }
            
            tone_instruction = tone_prompts.get(tone, tone_prompts["philosophical"])
            
            prompt = f"""Eres el content strategist de Random, una consultora de innovación tecnológica en Barcelona.

Nuestra voz:
- Inteligente sin ser pretenciosa
- Profunda sin ser académica  
- Técnica sin ser inaccesible
- Auténtica, no corporativa

{tone_instruction}

Genera un {content_type} sobre: {topic}

Audiencia: {target_audience}
{f'Contexto adicional: {additional_context}' if additional_context else ''}

Estructura:
- Título: Atractivo, directo, máx 80 caracteres
- Cuerpo: 
  * Hook inicial fuerte (1-2 líneas)
  * Desarrollo con insights reales (3-4 párrafos cortos)
  * Cierre con pregunta o llamado a reflexión
  * Hashtags relevantes (#Random siempre)

Longitud: 150-250 palabras. Usa saltos de línea para legibilidad.

Responde SOLO en formato JSON:
{{"title": "Tu título aquí", "body": "Tu contenido aquí con \\n para saltos de línea"}}"""

            message = await self.client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Parsear respuesta
            response_text = message.content[0].text.strip()
            
            # Extraer JSON si está dentro de markdown
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            result = json.loads(response_text)
            
            # Validar formato
            if not all(k in result for k in ["title", "body"]):
                raise ValueError("Invalid response format")
            
            return {
                "title": result["title"],
                "body": result["body"]
            }
            
        except Exception as e:
            print(f"⚠️  Claude API failed for content generation: {e}")
            return self._fallback_generate_content(topic, content_type, tone)
    
    def _fallback_generate_content(
        self,
        topic: str,
        content_type: str,
        tone: str
    ) -> Dict[str, Any]:
        """Fallback content generation cuando Claude API no está disponible"""
        
        templates = {
            "philosophical": [
                f"¿Y si {topic} es solo el principio?",
                f"En el caos de {topic}, encontramos patrones",
                f"{topic}: Perturbando lo establecido"
            ],
            "technical": [
                f"Deep Dive: {topic}",
                f"Arquitectura de {topic}",
                f"Por qué {topic} importa ahora"
            ],
            "inspirational": [
                f"El futuro de {topic}",
                f"Transformando {topic}",
                f"La revolución de {topic}"
            ]
        }
        
        import random
        title = random.choice(templates.get(tone, templates["philosophical"]))
        
        body = f"""
Explorando {topic} desde Random.

En el flujo constante de información, donde otros ven ruido, nosotros encontramos señales. {topic} no es solo un concepto — es una perturbación necesaria en el status quo.

La mejor solución no sale del manual. Sale de observar, perturbar, ajustar. Como en termodinámica, donde el caos precede al orden cristalino, en Random creemos que la innovación emerge del desorden controlado.

¿Y si dejáramos de buscar respuestas perfectas y empezáramos a hacer las preguntas correctas?

#Random #Innovation #Technology
        """.strip()
        
        return {"title": title, "body": body}


# Singleton
claude_service = ClaudeService()
