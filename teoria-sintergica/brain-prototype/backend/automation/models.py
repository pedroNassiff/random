"""
Automation Models - Pydantic schemas para automatización
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


# ============================================
# ENUMS
# ============================================

class LeadStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONTACTED = "contacted"
    CONVERTED = "converted"


class ContentStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# ============================================
# LEADS
# ============================================

class LeadBase(BaseModel):
    company_name: str = Field(..., max_length=255)
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_title: Optional[str] = None
    contact_email: Optional[str] = None
    contact_linkedin: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    location: Optional[str] = None
    tech_stack: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = []


class LeadCreate(LeadBase):
    source: str = "manual"


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    review_notes: Optional[str] = None
    tags: Optional[List[str]] = None


class LeadResponse(LeadBase):
    id: int
    ai_score: Optional[int] = None
    ai_reasoning: Optional[str] = None
    fit_category: Optional[str] = None
    status: str
    outreach_status: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


# ============================================
# CONTENT
# ============================================

class ContentBase(BaseModel):
    title: str = Field(..., max_length=500)
    body: str
    content_type: str = Field(..., description="linkedin_post, twitter_thread, email, blog_post")
    format: Optional[str] = Field(None, description="text, carousel, video_script")
    tone: Optional[str] = None
    target_audience: Optional[str] = None


class ContentCreate(ContentBase):
    tags: Optional[List[str]] = []
    related_project: Optional[str] = None


class ContentUpdate(BaseModel):
    status: Optional[ContentStatus] = None
    review_notes: Optional[str] = None
    scheduled_for: Optional[datetime] = None


class ContentResponse(ContentBase):
    id: int
    status: str
    generated_by: str = "human"
    created_at: datetime
    published_at: Optional[datetime] = None
    views: int = 0
    clicks: int = 0
    engagement_rate: Optional[float] = None
    
    model_config = {"from_attributes": True}


class ContentGenerateRequest(BaseModel):
    """Request para generar contenido con IA"""
    content_type: str
    topic: str
    tone: Optional[str] = "philosophical"
    target_audience: Optional[str] = "CTOs"
    additional_context: Optional[str] = None


# ============================================
# CAMPAIGNS
# ============================================

class CampaignBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    campaign_type: str = Field(..., description="outreach, newsletter, social_campaign")
    target_audience: Optional[Dict[str, Any]] = None


class CampaignCreate(CampaignBase):
    content_ids: Optional[List[int]] = []


class CampaignUpdate(BaseModel):
    status: Optional[CampaignStatus] = None
    scheduled_sends: Optional[Dict[str, Any]] = None


class CampaignResponse(CampaignBase):
    id: int
    status: str
    total_sent: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    open_rate: Optional[float] = None
    click_rate: Optional[float] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


# ============================================
# LOGS & AUDIT
# ============================================

class AutomationLog(BaseModel):
    agent_name: str
    action_type: str
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class PendingApproval(BaseModel):
    """Items que requieren aprobación humana"""
    type: str  # "content", "lead", "action"
    item_id: int
    description: str
    created_at: datetime
    agent_name: str


# ============================================
# DASHBOARD
# ============================================

class AutomationDashboard(BaseModel):
    """Dashboard summary"""
    leads_pending: int
    leads_approved: int
    avg_lead_score: Optional[float]
    content_pending: int
    content_published: int
    avg_engagement: Optional[float]
    campaigns_active: int
    emails_sent_30d: int
    avg_open_rate: Optional[float]
    actions_pending_approval: int
    errors_24h: int
    last_updated: datetime


# ============================================
# WEBHOOKS (para n8n)
# ============================================

class N8nWebhookLead(BaseModel):
    """Webhook de n8n cuando scraper encuentra lead"""
    company_name: str
    linkedin_url: str
    website: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    tech_stack: Optional[Dict[str, Any]] = None


class N8nWebhookContent(BaseModel):
    """Webhook de n8n cuando genera contenido"""
    title: str
    body: str
    content_type: str
    tone: str
    prompt_used: str
    variants: Optional[List[Dict[str, str]]] = None


# ============================================
# RESPONSE GENERICS
# ============================================

class AutomationResponse(BaseModel):
    """Respuesta genérica"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
