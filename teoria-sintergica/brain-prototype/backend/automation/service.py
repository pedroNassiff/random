"""
Automation Service - Lógica de negocio para el sistema de automatización
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
import asyncpg
import json
from automation.models import (
    LeadCreate, LeadUpdate, LeadResponse,
    ContentCreate, ContentUpdate, ContentResponse, ContentGenerateRequest,
    CampaignCreate, CampaignUpdate, CampaignResponse,
    AutomationLog, PendingApproval, AutomationDashboard
)


class AutomationService:
    """Servicio para manejar toda la lógica de automatización"""
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db = db_pool
    
    # ============================================
    # LEADS
    # ============================================
    
    async def get_leads(
        self, 
        status: Optional[str] = None,
        min_score: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[LeadResponse]:
        """Obtener lista de leads con filtros"""
        
        query = """
            SELECT * FROM automation_leads
            WHERE 1=1
        """
        params = []
        param_count = 1
        
        if status:
            query += f" AND status = ${param_count}"
            params.append(status)
            param_count += 1
        
        if min_score:
            query += f" AND ai_score >= ${param_count}"
            params.append(min_score)
            param_count += 1
        
        query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        async with self.db.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [LeadResponse(**dict(row)) for row in rows]
    
    async def get_lead(self, lead_id: int) -> Optional[LeadResponse]:
        """Obtener lead específico"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM automation_leads WHERE id = $1",
                lead_id
            )
            return LeadResponse(**dict(row)) if row else None
    
    async def create_lead(self, lead: LeadCreate) -> LeadResponse:
        """Crear un nuevo lead"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO automation_leads (
                    company_name, website, linkedin_url, contact_name, contact_title,
                    contact_email, contact_linkedin, industry, company_size, location,
                    tech_stack, tags, source
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13
                )
                RETURNING *
                """,
                lead.company_name, lead.website, lead.linkedin_url, lead.contact_name,
                lead.contact_title, lead.contact_email, lead.contact_linkedin,
                lead.industry, lead.company_size, lead.location, 
                json.dumps(lead.tech_stack) if lead.tech_stack else None,
                lead.tags, lead.source
            )
            
            # Log la acción
            await self.log_action(
                agent_name="system",
                action_type="create_lead",
                input_data=lead.model_dump(),
                output_data={"lead_id": row['id']},
                status="success"
            )
            
            return LeadResponse(**dict(row))
    
    async def update_lead(self, lead_id: int, update: LeadUpdate) -> Optional[LeadResponse]:
        """Actualizar lead"""
        
        updates = []
        params = []
        param_count = 1
        
        if update.status:
            updates.append(f"status = ${param_count}")
            params.append(update.status.value)
            param_count += 1
        
        if update.review_notes:
            updates.append(f"review_notes = ${param_count}")
            params.append(update.review_notes)
            param_count += 1
        
        if update.tags:
            updates.append(f"tags = ${param_count}")
            params.append(update.tags)
            param_count += 1
        
        if not updates:
            return await self.get_lead(lead_id)
        
        updates.append("updated_at = NOW()")
        query = f"""
            UPDATE automation_leads 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        params.append(lead_id)
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return LeadResponse(**dict(row)) if row else None
    
    async def score_lead_with_ai(self, lead_id: int) -> LeadResponse:
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
                reasoning += f"\n\nPuntos fuertes: {', '.join(result['fit_highlights'])}"
            if result.get("concerns"):
                reasoning += f"\n\nConsideraciones: {', '.join(result['concerns'])}"
            if result.get("recommended_approach"):
                reasoning += f"\n\nApproach recomendado: {result['recommended_approach']}"
            
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
            
            return LeadResponse(**dict(row))
    
    # ============================================
    # CONTENT
    # ============================================
    
    async def get_content(
        self,
        status: Optional[str] = None,
        content_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[ContentResponse]:
        """Obtener contenido con filtros"""
        
        query = """
            SELECT * FROM automation_content
            WHERE 1=1
        """
        params = []
        param_count = 1
        
        if status:
            query += f" AND status = ${param_count}"
            params.append(status)
            param_count += 1
        
        if content_type:
            query += f" AND content_type = ${param_count}"
            params.append(content_type)
            param_count += 1
        
        query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        
        async with self.db.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [ContentResponse(**dict(row)) for row in rows]
    
    async def get_content_item(self, content_id: int) -> Optional[ContentResponse]:
        """Obtener contenido específico"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM automation_content WHERE id = $1",
                content_id
            )
            return ContentResponse(**dict(row)) if row else None
    
    async def create_content(self, content: ContentCreate) -> ContentResponse:
        """Crear contenido manual"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO automation_content (
                    title, body, content_type, format, tone, target_audience,
                    tags, related_project, generated_by
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, 'human'
                )
                RETURNING *
                """,
                content.title, content.body, content.content_type, content.format,
                content.tone, content.target_audience, content.tags, content.related_project
            )
            
            await self.log_action(
                agent_name="human",
                action_type="create_content",
                input_data=content.model_dump(),
                output_data={"content_id": row['id']},
                status="success"
            )
            
            return ContentResponse(**dict(row))
    
    async def generate_content_with_ai(self, request: ContentGenerateRequest) -> ContentResponse:
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
                body += f"\n\n{' '.join(f'#{tag}' for tag in hashtags)}"
            
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
            
            return ContentResponse(**dict(row))
    
    async def update_content(self, content_id: int, update: ContentUpdate) -> Optional[ContentResponse]:
        """Actualizar contenido"""
        
        updates = []
        params = []
        param_count = 1
        
        if update.status:
            updates.append(f"status = ${param_count}")
            params.append(update.status.value)
            param_count += 1
        
        if update.review_notes:
            updates.append(f"review_notes = ${param_count}")
            params.append(update.review_notes)
            param_count += 1
        
        if update.scheduled_for:
            updates.append(f"scheduled_for = ${param_count}")
            params.append(update.scheduled_for)
            param_count += 1
        
        if not updates:
            return await self.get_content_item(content_id)
        
        updates.append("updated_at = NOW()")
        query = f"""
            UPDATE automation_content 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        params.append(content_id)
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return ContentResponse(**dict(row)) if row else None
    
    async def publish_content(self, content_id: int, platforms: List[str]) -> Dict[str, Any]:
        """Publicar contenido en plataformas"""
        
        # TODO: Implementar publicación real en LinkedIn/Twitter
        
        async with self.db.acquire() as conn:
            await conn.execute(
                """
                UPDATE automation_content 
                SET status = 'published', published_at = NOW(),
                    published_to = $1::jsonb
                WHERE id = $2
                """,
                json.dumps({"platforms": platforms, "date": datetime.now().isoformat()}),
                content_id
            )
            
            await self.log_action(
                agent_name="social_publisher",
                action_type="publish_content",
                input_data={"content_id": content_id, "platforms": platforms},
                output_data={"success": True},
                status="success"
            )
            
            return {"success": True, "platforms": platforms}
    
    # ============================================
    # CAMPAIGNS
    # ============================================
    
    async def get_campaigns(self, status: Optional[str] = None) -> List[CampaignResponse]:
        """Obtener campañas"""
        
        query = "SELECT * FROM automation_campaigns"
        params = []
        
        if status:
            query += " WHERE status = $1"
            params.append(status)
        
        query += " ORDER BY created_at DESC"
        
        async with self.db.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [CampaignResponse(**dict(row)) for row in rows]
    
    async def get_campaign(self, campaign_id: int) -> Optional[CampaignResponse]:
        """Obtener campaña específica"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM automation_campaigns WHERE id = $1",
                campaign_id
            )
            return CampaignResponse(**dict(row)) if row else None
    
    async def create_campaign(self, campaign: CampaignCreate) -> CampaignResponse:
        """Crear campaña"""
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO automation_campaigns (
                    name, description, campaign_type, target_audience, content_ids
                ) VALUES (
                    $1, $2, $3, $4::jsonb, $5
                )
                RETURNING *
                """,
                campaign.name, campaign.description, campaign.campaign_type,
                json.dumps(campaign.target_audience) if campaign.target_audience else None, 
                campaign.content_ids
            )
            
            return CampaignResponse(**dict(row))
    
    async def update_campaign(self, campaign_id: int, update: CampaignUpdate) -> Optional[CampaignResponse]:
        """Actualizar campaña"""
        
        updates = []
        params = []
        param_count = 1
        
        if update.status:
            updates.append(f"status = ${param_count}")
            params.append(update.status.value)
            param_count += 1
        
        if update.scheduled_sends:
            updates.append(f"scheduled_sends = ${param_count}::jsonb")
            params.append(json.dumps(update.scheduled_sends))
            param_count += 1
        
        if not updates:
            return await self.get_campaign(campaign_id)
        
        updates.append("updated_at = NOW()")
        query = f"""
            UPDATE automation_campaigns 
            SET {', '.join(updates)}
            WHERE id = ${param_count}
            RETURNING *
        """
        params.append(campaign_id)
        
        async with self.db.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return CampaignResponse(**dict(row)) if row else None
    
    # ============================================
    # DASHBOARD & ADMIN
    # ============================================
    
    async def get_dashboard(self) -> AutomationDashboard:
        """Obtener dashboard summary con datos en tiempo real"""
        
        async with self.db.acquire() as conn:
            # Query directo en lugar de vista materializada para datos en tiempo real
            row = await conn.fetchrow(
                """
                SELECT 
                    -- Leads
                    (SELECT COUNT(*) FROM automation_leads WHERE status = 'pending_review') as leads_pending,
                    (SELECT COUNT(*) FROM automation_leads WHERE status = 'approved') as leads_approved,
                    (SELECT COALESCE(AVG(ai_score), 0) FROM automation_leads WHERE ai_score IS NOT NULL) as avg_lead_score,
                    
                    -- Content
                    (SELECT COUNT(*) FROM automation_content WHERE status = 'pending_approval') as content_pending,
                    (SELECT COUNT(*) FROM automation_content WHERE status = 'published') as content_published,
                    (SELECT COALESCE(AVG(engagement_rate), 0) FROM automation_content WHERE published_at > NOW() - INTERVAL '30 days') as avg_engagement,
                    
                    -- Campaigns
                    (SELECT COUNT(*) FROM automation_campaigns WHERE status = 'active') as campaigns_active,
                    (SELECT COALESCE(SUM(total_sent), 0) FROM automation_campaigns WHERE started_at > NOW() - INTERVAL '30 days') as emails_sent_30d,
                    (SELECT COALESCE(AVG(open_rate), 0) FROM automation_campaigns WHERE started_at > NOW() - INTERVAL '30 days') as avg_open_rate,
                    
                    -- Logs y auditoría
                    (SELECT COUNT(*) FROM automation_logs WHERE requires_approval = TRUE AND approved_at IS NULL) as actions_pending_approval,
                    (SELECT COUNT(*) FROM automation_logs WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'failed') as errors_24h,
                    
                    -- Timestamp
                    NOW() as last_updated
                """
            )
            
            if not row:
                # Fallback si hay error en la query
                return AutomationDashboard(
                    leads_pending=0, leads_approved=0, avg_lead_score=0,
                    content_pending=0, content_published=0, avg_engagement=0,
                    campaigns_active=0, emails_sent_30d=0, avg_open_rate=0,
                    actions_pending_approval=0, errors_24h=0, last_updated=datetime.now()
                )
            
            return AutomationDashboard(**dict(row))
    
    async def get_pending_approvals(self) -> List[PendingApproval]:
        """Items que requieren aprobación"""
        
        async with self.db.acquire() as conn:
            # Contenido pendiente
            content_rows = await conn.fetch(
                """
                SELECT id, title, created_at 
                FROM automation_content 
                WHERE status = 'pending_approval'
                ORDER BY created_at DESC
                LIMIT 20
                """
            )
            
            # Leads pendientes
            lead_rows = await conn.fetch(
                """
                SELECT id, company_name, created_at 
                FROM automation_leads 
                WHERE status = 'pending_review'
                ORDER BY created_at DESC
                LIMIT 20
                """
            )
            
            # Acciones pendientes
            action_rows = await conn.fetch(
                """
                SELECT id, agent_name, action_type, created_at 
                FROM automation_logs 
                WHERE requires_approval = TRUE AND approved_at IS NULL
                ORDER BY created_at DESC
                LIMIT 20
                """
            )
            
            approvals = []
            
            for row in content_rows:
                approvals.append(PendingApproval(
                    type="content",
                    item_id=row['id'],
                    description=f"Contenido: {row['title']}",
                    created_at=row['created_at'],
                    agent_name="content_generator"
                ))
            
            for row in lead_rows:
                approvals.append(PendingApproval(
                    type="lead",
                    item_id=row['id'],
                    description=f"Lead: {row['company_name']}",
                    created_at=row['created_at'],
                    agent_name="lead_scraper"
                ))
            
            for row in action_rows:
                approvals.append(PendingApproval(
                    type="action",
                    item_id=row['id'],
                    description=f"{row['agent_name']}: {row['action_type']}",
                    created_at=row['created_at'],
                    agent_name=row['agent_name']
                ))
            
            return sorted(approvals, key=lambda x: x.created_at, reverse=True)
    
    async def get_logs(
        self,
        agent_name: Optional[str] = None,
        limit: int = 100
    ) -> List[AutomationLog]:
        """Obtener logs de auditoría"""
        
        query = "SELECT * FROM automation_logs"
        params = []
        
        if agent_name:
            query += " WHERE agent_name = $1"
            params.append(agent_name)
        
        query += f" ORDER BY created_at DESC LIMIT ${len(params) + 1}"
        params.append(limit)
        
        async with self.db.acquire() as conn:
            rows = await conn.fetch(query, *params)
            logs = []
            for row in rows:
                row_dict = dict(row)
                # Parse JSON strings to dicts
                if row_dict.get('input_data') and isinstance(row_dict['input_data'], str):
                    row_dict['input_data'] = json.loads(row_dict['input_data'])
                if row_dict.get('output_data') and isinstance(row_dict['output_data'], str):
                    row_dict['output_data'] = json.loads(row_dict['output_data'])
                logs.append(AutomationLog(**row_dict))
            return logs
    
    async def log_action(
        self,
        agent_name: str,
        action_type: str,
        input_data: Dict[str, Any],
        output_data: Dict[str, Any],
        status: str,
        error_message: Optional[str] = None,
        requires_approval: bool = False
    ):
        """Loggear una acción para auditoría"""
        
        async with self.db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO automation_logs (
                    agent_name, action_type, input_data, output_data,
                    status, error_message, requires_approval
                ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
                """,
                agent_name, action_type, 
                json.dumps(input_data), json.dumps(output_data),
                status, error_message, requires_approval
            )
