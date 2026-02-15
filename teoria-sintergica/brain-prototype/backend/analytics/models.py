"""
Analytics Models - Pydantic schemas para el sistema de analytics
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


# ============================================
# REQUEST MODELS (Lo que recibe el backend)
# ============================================

class AnalyticsSessionStart(BaseModel):
    """Iniciar una nueva sesión de usuario"""
    anonymous_id: str = Field(..., description="Hash anónimo único del navegador")
    session_id: Optional[str] = Field(None, description="ID único de la sesión (se genera automáticamente si no se provee)")
    
    # Device & Browser
    device_type: Optional[str] = Field(None, description="desktop, mobile, tablet")
    browser: Optional[str] = None
    browser_version: Optional[str] = None
    os: Optional[str] = None
    os_version: Optional[str] = None
    screen_width: Optional[int] = None
    screen_height: Optional[int] = None
    
    # Entry info
    entry_page: str = Field(..., description="Primera página visitada")
    referrer_url: Optional[str] = None
    
    # UTM Parameters
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    
    # Location (from frontend geolocation API)
    country: Optional[str] = Field(None, max_length=2, description="ISO country code (e.g., 'US', 'ES')")
    city: Optional[str] = Field(None, max_length=100, description="City name")
    ip_hash: Optional[str] = Field(None, max_length=64, description="Hashed IP for privacy")
    timezone: Optional[str] = None
    language: Optional[str] = Field(None, description="e.g., 'es', 'en', 'fr'")


class PageView(BaseModel):
    """Registrar una vista de página"""
    model_config = {"extra": "ignore"}  # Ignorar campos adicionales
    
    session_id: str
    page_path: str = Field(..., description="e.g., '/', '/work', '/work/hermes'")
    page_title: Optional[str] = None
    page_section: Optional[str] = Field(None, description="home, work, services, lab, about")
    time_on_page: Optional[int] = Field(None, description="Segundos en la página anterior")
    scroll_depth: Optional[int] = Field(None, ge=0, le=100, description="0-100%")
    clicks: Optional[int] = Field(0, ge=0)
    load_time: Optional[int] = Field(None, description="Tiempo de carga en ms")


class AnalyticsEvent(BaseModel):
    """Registrar un evento (click, scroll, hover, etc.)"""
    model_config = {"extra": "ignore"}  # Ignorar campos adicionales
    
    session_id: str
    event_type: str = Field(..., description="click, scroll, hover, view, form_submit")
    event_name: str = Field(..., description="project_card_click, nav_click, cta_click")
    event_category: Optional[str] = Field(None, description="navigation, engagement, conversion")
    
    # Target
    target_element: Optional[str] = Field(None, description="button, link, card, image")
    target_id: Optional[str] = None
    target_text: Optional[str] = None
    target_url: Optional[str] = None
    
    # Context
    page_path: str
    page_section: Optional[str] = None
    
    # Data adicional (flexible)
    event_data: Optional[Dict[str, Any]] = None


class EngagementZone(BaseModel):
    """Registrar tiempo en una zona específica de la página"""
    model_config = {"extra": "ignore"}  # Ignorar campos adicionales
    
    session_id: str
    page_path: str
    zone_id: Optional[str] = Field(None, description="hero, projects, services, lab, about")
    zone_name: Optional[str] = None
    time_spent: int = Field(..., ge=0, description="Segundos en la zona")
    scroll_reached: bool = False
    clicked: bool = False


class Conversion(BaseModel):
    """Registrar una conversión/objetivo cumplido"""
    session_id: str
    conversion_type: str = Field(..., description="project_view, contact_click, lab_visit, full_scroll")
    conversion_value: Optional[str] = None
    page_path: str


class AnalyticsSessionEnd(BaseModel):
    """Finalizar una sesión"""
    session_id: str
    exit_page: Optional[str] = Field(None)
    total_clicks: Optional[int] = Field(0, ge=0)
    avg_scroll_depth: Optional[int] = Field(0, ge=0, le=100)


class AnalyticsBatch(BaseModel):
    """Enviar múltiples eventos en batch (más eficiente)"""
    session_id: str
    pageviews: Optional[List[PageView]] = []
    events: Optional[List[AnalyticsEvent]] = []
    engagement_zones: Optional[List[EngagementZone]] = []
    conversions: Optional[List[Conversion]] = []


class UserMetadata(BaseModel):
    """Metadata de usuario extraída del storage del navegador"""
    session_id: str
    metadata: Dict[str, Any] = Field(..., description="Datos extraídos del storage con estructura {campo: {value, source, key}}")
    timestamp: str = Field(..., description="ISO timestamp de cuando se extrajo la data")


# ============================================
# RESPONSE MODELS (Lo que devuelve el backend)
# ============================================

class AnalyticsResponse(BaseModel):
    """Respuesta genérica de analytics"""
    success: bool
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None


class AnalyticsSummary(BaseModel):
    """Resumen de analytics para dashboard"""
    date: str
    unique_visitors: int
    total_sessions: int
    total_pageviews: int
    avg_session_duration: float
    avg_scroll_depth: float
    bounce_rate: float
    top_pages: List[Dict[str, Any]]
    top_events: List[Dict[str, Any]]
    top_sources: List[Dict[str, Any]]
    daily_sessions: List[Dict[str, Any]] = []
    device_breakdown: List[Dict[str, Any]] = []
    top_countries: List[Dict[str, Any]] = []


class PageAnalytics(BaseModel):
    """Analytics de una página específica"""
    page_path: str
    total_views: int
    unique_visitors: int
    avg_time_on_page: float
    avg_scroll_depth: float
    total_clicks: int
    bounce_rate: float
    top_entry_sources: List[Dict[str, Any]]


# ============================================
# VALIDATORS
# ============================================

class AnalyticsSessionStart(AnalyticsSessionStart):
    @validator('device_type')
    def validate_device_type(cls, v):
        if v and v not in ['desktop', 'mobile', 'tablet']:
            return 'desktop'
        return v
    
    @validator('language')
    def validate_language(cls, v):
        if v and len(v) > 10:
            return v[:10]
        return v


class PageView(PageView):
    @validator('page_section')
    def validate_page_section(cls, v):
        valid_sections = ['home', 'work', 'projects', 'services', 'lab', 'about', 'project-detail']
        if v and v not in valid_sections:
            return None
        return v


class AnalyticsEvent(AnalyticsEvent):
    @validator('event_type')
    def validate_event_type(cls, v):
        valid_types = ['click', 'scroll', 'hover', 'view', 'form_submit', 'navigation']
        if v not in valid_types:
            raise ValueError(f'event_type must be one of {valid_types}')
        return v
