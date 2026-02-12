"""
Automation Router - FastAPI endpoints para automatización
"""
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from typing import List, Optional
from automation.models import *
from automation.service import AutomationService


router = APIRouter(prefix="/automation", tags=["Automation"])


async def get_automation_service(request: Request) -> AutomationService:
    """Dependency injection del servicio de automatización"""
    return request.app.state.automation_service


# ============================================
# LEADS
# ============================================

@router.get("/leads", response_model=List[LeadResponse])
async def get_leads(
    status: Optional[str] = None,
    min_score: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Obtener lista de leads con filtros
    
    - **status**: Filtrar por status (pending_review, approved, rejected, etc.)
    - **min_score**: Score mínimo de IA (0-100)
    - **limit**: Máximo de resultados (default: 50)
    - **offset**: Offset para paginación
    """
    return await service.get_leads(status=status, min_score=min_score, limit=limit, offset=offset)


@router.post("/leads", response_model=LeadResponse, status_code=201)
async def create_lead(
    lead: LeadCreate,
    background_tasks: BackgroundTasks,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Crear un nuevo lead (manual o desde scraper)
    
    El lead será automáticamente scored por IA en background.
    """
    new_lead = await service.create_lead(lead)
    
    # Scoring automático en background
    background_tasks.add_task(service.score_lead_with_ai, new_lead.id)
    
    return new_lead


@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: int,
    service: AutomationService = Depends(get_automation_service)
):
    """Obtener lead específico"""
    lead = await service.get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    update: LeadUpdate,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Actualizar lead (aprobar, rechazar, agregar notas)
    
    Ejemplo para aprobar: `{"status": "approved"}`
    """
    updated_lead = await service.update_lead(lead_id, update)
    if not updated_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return updated_lead


@router.post("/leads/{lead_id}/score", response_model=LeadResponse)
async def score_lead(
    lead_id: int,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Re-score un lead con Claude
    
    Útil si quieres recalcular el score después de actualizar datos del lead.
    """
    try:
        return await service.score_lead_with_ai(lead_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================================
# CONTENT
# ============================================

@router.get("/content", response_model=List[ContentResponse])
async def get_content(
    status: Optional[str] = None,
    content_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Obtener contenido generado
    
    - **status**: draft, pending_approval, approved, published, rejected
    - **content_type**: linkedin_post, twitter_thread, email, blog_post
    """
    return await service.get_content(status=status, content_type=content_type, limit=limit, offset=offset)


@router.post("/content", response_model=ContentResponse, status_code=201)
async def create_content(
    content: ContentCreate,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Crear contenido manual
    
    Para contenido escrito directamente por humanos.
    """
    return await service.create_content(content)


@router.post("/content/generate", response_model=ContentResponse, status_code=201)
async def generate_content(
    request: ContentGenerateRequest,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Generar contenido con IA
    
    Claude generará contenido basado en el topic y parámetros.
    El contenido quedará en estado "pending_approval" para revisión.
    """
    return await service.generate_content_with_ai(request)


@router.get("/content/{content_id}", response_model=ContentResponse)
async def get_content_item(
    content_id: int,
    service: AutomationService = Depends(get_automation_service)
):
    """Obtener contenido específico"""
    content = await service.get_content_item(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.patch("/content/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: int,
    update: ContentUpdate,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Actualizar contenido (aprobar, rechazar, agendar)
    
    Ejemplos:
    - Aprobar: `{"status": "approved"}`
    - Agendar: `{"status": "approved", "scheduled_for": "2024-02-20T10:00:00Z"}`
    - Rechazar: `{"status": "rejected", "review_notes": "No encaja con el tono Random"}`
    """
    updated = await service.update_content(content_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Content not found")
    return updated


@router.post("/content/{content_id}/publish")
async def publish_content(
    content_id: int,
    platforms: List[str],  # ["linkedin", "twitter"]
    service: AutomationService = Depends(get_automation_service)
):
    """
    Publicar contenido en plataformas
    
    - **platforms**: Array de plataformas donde publicar ["linkedin", "twitter"]
    
    El contenido debe estar en estado "approved" antes de publicar.
    """
    content = await service.get_content_item(content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if content.status != "approved":
        raise HTTPException(status_code=400, detail="Content must be approved before publishing")
    
    result = await service.publish_content(content_id, platforms)
    return result


# ============================================
# CAMPAIGNS
# ============================================

@router.get("/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    status: Optional[str] = None,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Obtener campañas
    
    - **status**: draft, active, paused, completed, cancelled
    """
    return await service.get_campaigns(status=status)


@router.post("/campaigns", response_model=CampaignResponse, status_code=201)
async def create_campaign(
    campaign: CampaignCreate,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Crear campaña
    
    Una campaña puede ser de tipo:
    - **outreach**: Para contactar leads
    - **newsletter**: Para enviar newsletter
    - **social_campaign**: Para posts programados en redes
    """
    return await service.create_campaign(campaign)


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    service: AutomationService = Depends(get_automation_service)
):
    """Obtener campaña específica"""
    campaign = await service.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int,
    update: CampaignUpdate,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Actualizar campaña
    
    Ejemplos:
    - Activar: `{"status": "active"}`
    - Pausar: `{"status": "paused"}`
    - Finalizar: `{"status": "completed"}`
    """
    updated = await service.update_campaign(campaign_id, update)
    if not updated:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return updated


# ============================================
# DASHBOARD & ADMIN
# ============================================

@router.get("/dashboard", response_model=AutomationDashboard)
async def get_dashboard(
    service: AutomationService = Depends(get_automation_service)
):
    """
    Dashboard completo de automatización
    
    Incluye:
    - Leads pendientes y aprobados
    - Contenido pendiente y publicado
    - Campañas activas
    - Acciones que requieren aprobación
    - Errores recientes
    """
    return await service.get_dashboard()


@router.get("/pending-approvals", response_model=List[PendingApproval])
async def get_pending_approvals(
    service: AutomationService = Depends(get_automation_service)
):
    """
    Items que requieren aprobación humana
    
    Retorna leads, contenido y acciones que están esperando tu review.
    """
    return await service.get_pending_approvals()


@router.get("/logs", response_model=List[AutomationLog])
async def get_logs(
    agent_name: Optional[str] = None,
    limit: int = 100,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Logs de auditoría
    
    - **agent_name**: Filtrar por agente específico (content_generator, lead_scraper, etc.)
    - **limit**: Máximo de logs a retornar
    """
    return await service.get_logs(agent_name=agent_name, limit=limit)


# ============================================
# WEBHOOKS (para n8n)
# ============================================

@router.post("/webhooks/lead-scraped")
async def webhook_lead_scraped(
    data: N8nWebhookLead,
    background_tasks: BackgroundTasks,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Webhook llamado por n8n cuando el scraper encuentra un lead
    
    Este endpoint es llamado automáticamente por workflows de n8n.
    """
    lead_create = LeadCreate(
        company_name=data.company_name,
        linkedin_url=data.linkedin_url,
        website=data.website,
        industry=data.industry,
        company_size=data.company_size,
        tech_stack=data.tech_stack,
        source="linkedin_scraper"
    )
    
    new_lead = await service.create_lead(lead_create)
    background_tasks.add_task(service.score_lead_with_ai, new_lead.id)
    
    return {"success": True, "lead_id": new_lead.id, "message": "Lead created and queued for scoring"}


@router.post("/webhooks/content-generated")
async def webhook_content_generated(
    data: N8nWebhookContent,
    service: AutomationService = Depends(get_automation_service)
):
    """
    Webhook llamado por n8n cuando se genera contenido
    
    Este endpoint es llamado automáticamente por workflows de n8n.
    """
    content_create = ContentCreate(
        title=data.title,
        body=data.body,
        content_type=data.content_type,
        tone=data.tone
    )
    
    new_content = await service.create_content(content_create)
    
    # Log para auditoría
    await service.log_action(
        agent_name="content_generator",
        action_type="generate_content",
        input_data={"prompt": data.prompt_used},
        output_data={"content_id": new_content.id},
        status="success",
        requires_approval=True
    )
    
    return {"success": True, "content_id": new_content.id, "message": "Content created and pending approval"}


@router.get("/health")
async def health_check():
    """
    Health check del sistema de automatización
    
    Verifica que el servicio está operativo.
    """
    return {
        "status": "healthy",
        "service": "automation",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }
