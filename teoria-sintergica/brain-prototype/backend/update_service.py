#!/usr/bin/env python3
"""
Script para actualizar service.py con integración Claude API
"""
import re

# Leer el archivo original
with open('./automation/service.py', 'r') as f:
    content = f.read()

# Nueva función score_lead_with_ai
new_score_function = '''    async def score_lead_with_ai(self, lead_id: int) -> LeadResponse:
        """Score un lead usando Claude API"""
        
        lead = await self.get_lead(lead_id)
        if not lead:
            raise ValueError(f"Lead {lead_id} not found")
        
        from automation.claude_client import get_claude_client
        
        try:
            # Llamar a Claude para scoring real
            claude = get_claude_client()
            result = await claude.score_lead(
                company_name=lead.company_name,
                industry=lead.industry,
                company_size=lead.company_size,
                website=lead.website,
                linkedin_url=lead.linkedin_url,
                tech_stack=lead.tech_stack,
                location=lead.location
            )
            
            score = result.get("score", 50)
            category = result.get("category", "medium")
            reasoning = result.get("reasoning", "Análisis completado")
            
            # Agregar highlights y concerns al reasoning si existen
            if result.get("fit_highlights"):
                reasoning += f"\\n\\nPuntos fuertes: {', '.join(result['fit_highlights'])}"
            if result.get("concerns"):
                reasoning += f"\\n\\nConsideraciones: {', '.join(result['concerns'])}"
            if result.get("recommended_approach"):
                reasoning += f"\\n\\nApproach recomendado: {result['recommended_approach']}"
            
        except Exception as e:
            print(f"⚠️  Claude scoring failed, using fallback: {e}")
            # Fallback a scoring básico
            import random
            score = 50
            if lead.industry and lead.industry.lower() in ['software', 'technology', 'fintech', 'saas']:
                score += 20
            if lead.company_size in ['51-200', '201-500', '501-1000']:
                score += 15
            if lead.website and lead.linkedin_url:
                score += 10
            score += random.randint(-5, 10)
            score = min(95, max(40, score))
            
            reasoning = f"Scoring automático (Claude no disponible): Lead en {lead.industry or 'sector desconocido'}, tamaño {lead.company_size or 'desconocido'}"
            category = "high" if score > 80 else "medium" if score > 60 else "low"
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                """
                UPDATE automation_leads 
                SET ai_score = $1, ai_reasoning = $2, fit_category = $3
                WHERE id = $4
                RETURNING *
                """,
                score, reasoning, category, lead_id
            )
            
            # Log la acción
            await self.log_action(
                agent_name="lead_scorer",
                action_type="score_lead",
                input_data={"lead_id": lead_id},
                output_data={"score": score, "category": category},
                status="success"
            )
            
            return LeadResponse(**dict(row))'''

# Nueva función generate_content_with_ai
new_content_function = '''    async def generate_content_with_ai(self, request: ContentGenerateRequest) -> ContentResponse:
        """Generar contenido con Claude API"""
        
        from automation.claude_client import get_claude_client
        
        try:
            # Llamar a Claude para generación real
            claude = get_claude_client()
            result = await claude.generate_content(
                topic=request.topic,
                content_type=request.content_type,
                tone=request.tone or "philosophical",
                target_audience=request.target_audience or "CTOs",
                additional_context=request.additional_context
            )
            
            title = result.get("title", f"Explorando {request.topic}")
            body = result.get("body", "")
            
            # Agregar hashtags al final si no están
            hashtags = result.get("hashtags", ["Random", "Innovation"])
            if hashtags and not any(tag in body for tag in hashtags):
                body += f"\\n\\n{' '.join(f'#{tag}' for tag in hashtags)}"
            
        except Exception as e:
            print(f"⚠️  Claude content generation failed, using fallback: {e}")
            # Fallback a contenido template
            title = f"{request.topic}: Perturbando lo establecido"
            body = f"""Explorando {request.topic} desde Random.

En el flujo constante de información, donde otros ven ruido, nosotros encontramos señales. {request.topic} no es solo un concepto — es una perturbación necesaria en el status quo.

La mejor solución no sale del manual. Sale de observar, perturbar, ajustar. Como en termodinámica, donde el caos precede al orden cristalino, en Random creemos que la innovación emerge del desorden controlado.

¿Y si dejáramos de buscar respuestas perfectas y empezáramos a hacer las preguntas correctas?

#Random #Innovation #Technology"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO automation_content (
                    title, body, content_type, tone, target_audience,
                    generated_by, prompt_used, status
                ) VALUES (
                    $1, $2, $3, $4, $5, 'claude', $6, 'pending_approval'
                )
                RETURNING *
                """,
                title, body, request.content_type, request.tone,
                request.target_audience, request.topic
            )
            
            await self.log_action(
                agent_name="content_generator",
                action_type="generate_content",
                input_data=request.model_dump(),
                output_data={"content_id": row['id']},
                status="success",
                requires_approval=True
            )
            
            return ContentResponse(**dict(row))'''

# Reemplazar la función score_lead_with_ai
pattern_score = r'    async def score_lead_with_ai\(self, lead_id: int\) -> LeadResponse:.*?return LeadResponse\(\*\*dict\(row\)\)'
content = re.sub(pattern_score, new_score_function, content, flags=re.DOTALL)

# Reemplazar la función generate_content_with_ai
pattern_content = r'    async def generate_content_with_ai\(self, request: ContentGenerateRequest\) -> ContentResponse:.*?return ContentResponse\(\*\*dict\(row\)\)'
content = re.sub(pattern_content, new_content_function, content, flags=re.DOTALL)

# Guardar el archivo actualizado
with open('./automation/service.py', 'w') as f:
    f.write(content)

print("✅ service.py actualizado con Claude API!")
print("🔄 Reinicia el backend para aplicar cambios")
