"""
Analytics Router - FastAPI endpoints para el sistema de analytics
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
import asyncpg
from analytics.models import (
    AnalyticsSessionStart, PageView, AnalyticsEvent,
    EngagementZone, Conversion, AnalyticsSessionEnd,
    AnalyticsBatch, AnalyticsResponse, AnalyticsSummary,
    PageAnalytics, UserMetadata
)
from analytics.service import AnalyticsService


router = APIRouter(prefix="/analytics", tags=["Analytics"])

# Esta función será inyectada desde main.py
async def get_analytics_service(request: Request) -> AnalyticsService:
    """Dependency injection del servicio de analytics"""
    return request.app.state.analytics_service


@router.post("/session/start", response_model=AnalyticsResponse)
async def start_session(
    data: AnalyticsSessionStart,
    request: Request,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Iniciar una nueva sesión de usuario
    
    Este endpoint se llama cuando un usuario entra al sitio por primera vez
    o inicia una nueva sesión después de 30 minutos de inactividad.
    """
    # Obtener IP del cliente (respetando proxies)
    client_ip = request.client.host
    if "x-forwarded-for" in request.headers:
        client_ip = request.headers["x-forwarded-for"].split(",")[0].strip()
    
    # Obtener geolocalización usando ip-api.com (gratis, sin API key)
    country = None
    city = None
    
    # Si la IP no es local, obtener geolocalización
    if client_ip and not client_ip.startswith(('127.', '192.168.', '10.', '172.')):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"http://ip-api.com/json/{client_ip}?fields=status,country,countryCode,city")
                if response.status_code == 200:
                    geo_data = response.json()
                    if geo_data.get('status') == 'success':
                        country = geo_data.get('countryCode')
                        city = geo_data.get('city')
        except Exception as e:
            # Si falla la geolocalización, continuar sin ella
            print(f"Geolocation failed: {e}")
    
    result = await service.start_session(data, client_ip, country, city)
    
    return AnalyticsResponse(
        success=result["success"],
        message="Session started successfully",
        session_id=result.get("session_id"),
        user_id=result.get("user_id")
    )


@router.post("/pageview", response_model=AnalyticsResponse)
async def track_pageview(
    data: PageView,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Registrar una vista de página
    
    Se llama cada vez que el usuario navega a una nueva página.
    """
    result = await service.track_pageview(data)
    
    return AnalyticsResponse(
        success=result["success"],
        message=result["message"]
    )


@router.post("/event", response_model=AnalyticsResponse)
async def track_event(
    data: AnalyticsEvent,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Registrar un evento (click, scroll, hover, etc.)
    
    Ejemplos:
    - Click en botón "Ver proyecto"
    - Click en navegación
    - Hover sobre tarjeta de proyecto
    - Submit de formulario
    """
    result = await service.track_event(data)
    
    return AnalyticsResponse(
        success=result["success"],
        message=result["message"]
    )


@router.post("/engagement", response_model=AnalyticsResponse)
async def track_engagement(
    data: EngagementZone,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Registrar tiempo en una zona específica
    
    Se usa para detectar qué secciones captan más la atención del usuario.
    Solo se registra si el usuario pasa más de 5 segundos en la zona.
    """
    result = await service.track_engagement_zone(data)
    
    return AnalyticsResponse(
        success=result["success"],
        message=result["message"]
    )


@router.post("/conversion", response_model=AnalyticsResponse)
async def track_conversion(
    data: Conversion,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Registrar una conversión/objetivo cumplido
    
    Ejemplos:
    - Ver un proyecto completo
    - Click en "Contacto"
    - Visitar el Lab
    - Scroll completo de una página
    """
    result = await service.track_conversion(data)
    
    return AnalyticsResponse(
        success=result["success"],
        message=result["message"]
    )


@router.post("/session/end", response_model=AnalyticsResponse)
async def end_session(
    data: AnalyticsSessionEnd,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Finalizar una sesión
    
    Se llama cuando el usuario cierra el tab o después de 30 minutos de inactividad.
    """
    result = await service.end_session(data)
    
    return AnalyticsResponse(
        success=result["success"],
        message=result["message"]
    )


@router.post("/batch", response_model=AnalyticsResponse)
async def track_batch(
    data: AnalyticsBatch,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Enviar múltiples eventos en batch (más eficiente)
    
    Útil para reducir requests enviando múltiples eventos de una vez.
    Se puede llamar cada 30 segundos o al cerrar la página.
    """
    results = {
        "pageviews": 0,
        "events": 0,
        "engagement_zones": 0,
        "conversions": 0
    }
    
    # Procesar pageviews
    for pv in data.pageviews:
        pv.session_id = data.session_id
        await service.track_pageview(pv)
        results["pageviews"] += 1
    
    # Procesar eventos
    for event in data.events:
        event.session_id = data.session_id
        await service.track_event(event)
        results["events"] += 1
    
    # Procesar engagement zones
    for zone in data.engagement_zones:
        zone.session_id = data.session_id
        await service.track_engagement_zone(zone)
        results["engagement_zones"] += 1
    
    # Procesar conversiones
    for conv in data.conversions:
        conv.session_id = data.session_id
        await service.track_conversion(conv)
        results["conversions"] += 1
    
    return AnalyticsResponse(
        success=True,
        message=f"Batch processed: {results}"
    )


@router.post("/user/metadata", response_model=AnalyticsResponse)
async def save_user_metadata(
    data: UserMetadata,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Guardar metadata de usuario extraída del storage del navegador
    
    Esta información se usa para enriquecer el perfil del usuario y permitir
    análisis más detallados de comportamiento por tipo de usuario.
    
    Los datos incluyen:
    - Email (si está disponible)
    - Nombre de usuario
    - ID de usuario
    - Teléfono
    - Ubicación
    - Idioma preferido
    - Otros datos relevantes encontrados en localStorage/sessionStorage/cookies
    """
    result = await service.save_user_metadata(data)
    
    return AnalyticsResponse(
        success=result["success"],
        message=result["message"]
    )


# ============================================
# ENDPOINTS DE CONSULTA (Para dashboard)
# ============================================

@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary(
    days: int = 30,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Obtener resumen de analytics de los últimos N días
    
    Incluye:
    - Visitantes únicos
    - Total de sesiones
    - Total de pageviews
    - Duración promedio de sesión
    - Scroll promedio
    - Bounce rate
    - Top páginas
    - Top eventos
    - Top fuentes de tráfico
    """
    return await service.get_summary(days)


@router.get("/top-pages")
async def get_top_pages(
    days: int = 30,
    limit: int = 10,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Obtener páginas más visitadas"""
    return await service.get_top_pages(days, limit)


@router.get("/top-events")
async def get_top_events(
    days: int = 30,
    limit: int = 10,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Obtener eventos más frecuentes"""
    return await service.get_top_events(days, limit)


@router.get("/top-engagement-zones")
async def get_top_zones(
    days: int = 30,
    limit: int = 10,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """Obtener zonas de engagement más activas"""
    return await service.get_top_engagement_zones(days, limit)


@router.get("/users-activity")
async def get_users_activity(
    days: int = 30,
    limit: int = 20,
    service: AnalyticsService = Depends(get_analytics_service)
):
    """
    Obtener actividad detallada por usuario
    
    Incluye:
    - Email y nombre del usuario (si está disponible)
    - Páginas visitadas
    - Total de clicks
    - Tiempo en cada página
    - Total de sesiones del usuario
    """
    return await service.get_users_activity(days, limit)


@router.get("/health")
async def health_check():
    """Health check del sistema de analytics"""
    return {
        "status": "healthy",
        "service": "analytics",
        "version": "1.0.0"
    }

