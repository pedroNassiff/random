"""
Analytics Service - Lógica de negocio para el sistema de analytics
"""
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID, uuid4
import asyncpg
from analytics.models import (
    AnalyticsSessionStart, PageView, AnalyticsEvent, 
    EngagementZone, Conversion, AnalyticsSessionEnd,
    AnalyticsSummary, PageAnalytics
)


class AnalyticsService:
    """Servicio para manejar toda la lógica de analytics"""
    
    def __init__(self, db_pool: asyncpg.Pool):
        self.db = db_pool
    
    @staticmethod
    def hash_ip(ip_address: str) -> str:
        """Hash de IP para GDPR compliance (no guardamos IPs reales)"""
        return hashlib.sha256(ip_address.encode()).hexdigest()
    
    @staticmethod
    def parse_referrer(referrer_url: Optional[str]) -> str:
        """Extraer la fuente del referrer"""
        if not referrer_url:
            return "direct"
        
        referrer_lower = referrer_url.lower()
        
        # Social Media
        if any(x in referrer_lower for x in ['facebook.com', 'fb.com']):
            return "facebook"
        if 'twitter.com' in referrer_lower or 'x.com' in referrer_lower:
            return "twitter"
        if 'linkedin.com' in referrer_lower:
            return "linkedin"
        if 'instagram.com' in referrer_lower:
            return "instagram"
        
        # Search Engines
        if 'google' in referrer_lower:
            return "google"
        if 'bing' in referrer_lower:
            return "bing"
        if 'duckduckgo' in referrer_lower:
            return "duckduckgo"
        
        # Dev platforms
        if 'github.com' in referrer_lower:
            return "github"
        if 'vercel.app' in referrer_lower or 'vercel.com' in referrer_lower:
            return "vercel"
        
        return "other"
    
    async def start_session(
        self, 
        data: AnalyticsSessionStart, 
        ip_address: str,
        country: Optional[str] = None,
        city: Optional[str] = None
    ) -> Dict[str, Any]:
        """Iniciar una nueva sesión de usuario"""
        
        async with self.db.acquire() as conn:
            # 1. Buscar o crear usuario
            user = await conn.fetchrow(
                """
                SELECT id, total_sessions FROM users 
                WHERE anonymous_id = $1
                """,
                data.anonymous_id
            )
            
            if user:
                # Usuario existente - actualizar
                user_id = user['id']
                await conn.execute(
                    """
                    UPDATE users SET
                        last_seen = NOW(),
                        total_sessions = total_sessions + 1,
                        country = COALESCE($2, country),
                        city = COALESCE($3, city),
                        timezone = COALESCE($4, timezone),
                        language = COALESCE($5, language),
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    user_id, country, city, data.timezone, data.language
                )
            else:
                # Nuevo usuario
                user_id = await conn.fetchval(
                    """
                    INSERT INTO users (
                        anonymous_id, country, city, timezone, language
                    ) VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                    """,
                    data.anonymous_id, country, city, data.timezone, data.language
                )
            
            # 2. Crear sesión
            referrer_source = self.parse_referrer(data.referrer_url)
            ip_hash = self.hash_ip(ip_address)
            
            session_id = await conn.fetchval(
                """
                INSERT INTO sessions (
                    user_id, session_id, device_type, browser, browser_version,
                    os, os_version, screen_width, screen_height,
                    entry_page, referrer_source, referrer_url,
                    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                    country, city, ip_hash
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $18, $19, $20
                )
                RETURNING id
                """,
                user_id, data.session_id, data.device_type, data.browser, data.browser_version,
                data.os, data.os_version, data.screen_width, data.screen_height,
                data.entry_page, referrer_source, data.referrer_url,
                data.utm_source, data.utm_medium, data.utm_campaign, data.utm_content, data.utm_term,
                country, city, ip_hash
            )
            
            return {
                "success": True,
                "session_id": data.session_id,
                "user_id": str(user_id),
                "is_returning": user is not None
            }
    
    async def track_pageview(self, data: PageView) -> Dict[str, Any]:
        """Registrar una vista de página"""
        
        async with self.db.acquire() as conn:
            # Obtener user_id de la sesión
            session = await conn.fetchrow(
                "SELECT user_id FROM sessions WHERE session_id = $1",
                data.session_id
            )
            
            if not session:
                return {"success": False, "message": "Session not found"}
            
            # Insertar pageview
            await conn.execute(
                """
                INSERT INTO pageviews (
                    session_id, user_id, page_path, page_title, page_section,
                    time_on_page, scroll_depth, clicks, load_time
                )
                SELECT 
                    id, $2, $3, $4, $5, $6, $7, $8, $9
                FROM sessions WHERE session_id = $1
                """,
                data.session_id, session['user_id'], data.page_path, data.page_title,
                data.page_section, data.time_on_page, data.scroll_depth, 
                data.clicks, data.load_time
            )
            
            # Actualizar contador de pageviews en sesión
            await conn.execute(
                """
                UPDATE sessions SET
                    pageviews = pageviews + 1,
                    total_scroll_depth = (
                        SELECT COALESCE(AVG(scroll_depth), 0)
                        FROM pageviews
                        WHERE session_id = sessions.id
                    )
                WHERE session_id = $1
                """,
                data.session_id
            )
            
            # Actualizar contador de pageviews en usuario
            await conn.execute(
                """
                UPDATE users SET
                    total_pageviews = total_pageviews + 1
                WHERE id = $1
                """,
                session['user_id']
            )
            
            return {"success": True, "message": "Pageview tracked"}
    
    async def track_event(self, data: AnalyticsEvent) -> Dict[str, Any]:
        """Registrar un evento"""
        
        async with self.db.acquire() as conn:
            session = await conn.fetchrow(
                "SELECT user_id FROM sessions WHERE session_id = $1",
                data.session_id
            )
            
            if not session:
                return {"success": False, "message": "Session not found"}
            
            await conn.execute(
                """
                INSERT INTO events (
                    session_id, user_id, event_type, event_name, event_category,
                    target_element, target_id, target_text, target_url,
                    page_path, page_section, event_data
                )
                SELECT 
                    id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                FROM sessions WHERE session_id = $1
                """,
                data.session_id, session['user_id'], data.event_type, data.event_name,
                data.event_category, data.target_element, data.target_id, data.target_text,
                data.target_url, data.page_path, data.page_section, data.event_data
            )
            
            # Si es un click, actualizar contador
            if data.event_type == "click":
                await conn.execute(
                    "UPDATE sessions SET total_clicks = total_clicks + 1 WHERE session_id = $1",
                    data.session_id
                )
            
            return {"success": True, "message": "Event tracked"}
    
    async def track_engagement_zone(self, data: EngagementZone) -> Dict[str, Any]:
        """Registrar engagement en una zona"""
        
        async with self.db.acquire() as conn:
            session = await conn.fetchrow(
                "SELECT user_id FROM sessions WHERE session_id = $1",
                data.session_id
            )
            
            if not session:
                return {"success": False, "message": "Session not found"}
            
            await conn.execute(
                """
                INSERT INTO engagement_zones (
                    session_id, user_id, page_path, zone_id, zone_name,
                    time_spent, scroll_reached, clicked, entered_at, exited_at
                )
                SELECT 
                    id, $2, $3, $4, $5, $6, $7, $8, 
                    NOW() - ($6 || ' seconds')::INTERVAL, NOW()
                FROM sessions WHERE session_id = $1
                """,
                data.session_id, session['user_id'], data.page_path, data.zone_id,
                data.zone_name, data.time_spent, data.scroll_reached, data.clicked
            )
            
            return {"success": True, "message": "Engagement tracked"}
    
    async def track_conversion(self, data: Conversion) -> Dict[str, Any]:
        """Registrar una conversión"""
        
        async with self.db.acquire() as conn:
            session = await conn.fetchrow(
                "SELECT user_id FROM sessions WHERE session_id = $1",
                data.session_id
            )
            
            if not session:
                return {"success": False, "message": "Session not found"}
            
            await conn.execute(
                """
                INSERT INTO conversions (
                    session_id, user_id, conversion_type, conversion_value, page_path
                )
                SELECT 
                    id, $2, $3, $4, $5
                FROM sessions WHERE session_id = $1
                """,
                data.session_id, session['user_id'], data.conversion_type,
                data.conversion_value, data.page_path
            )
            
            return {"success": True, "message": "Conversion tracked"}
    
    async def end_session(self, data: AnalyticsSessionEnd) -> Dict[str, Any]:
        """Finalizar una sesión"""
        
        async with self.db.acquire() as conn:
            await conn.execute(
                """
                UPDATE sessions SET
                    ended_at = NOW(),
                    duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
                    exit_page = $2,
                    total_clicks = $3,
                    total_scroll_depth = $4,
                    bounce = (pageviews <= 1)
                WHERE session_id = $1
                """,
                data.session_id, data.exit_page, data.total_clicks, data.avg_scroll_depth
            )
            
            # Actualizar tiempo total del usuario
            result = await conn.fetchval(
                """
                UPDATE users SET
                    total_time_spent = (
                        SELECT COALESCE(SUM(duration), 0)
                        FROM sessions
                        WHERE user_id = users.id
                    )
                WHERE id = (SELECT user_id FROM sessions WHERE session_id = $1)
                RETURNING total_time_spent
                """,
                data.session_id
            )
            
            return {"success": True, "message": "Session ended", "total_time": result}
    
    async def get_summary(self, days: int = 30) -> AnalyticsSummary:
        """Obtener resumen de analytics de los últimos N días"""
        
        async with self.db.acquire() as conn:
            # Métricas generales
            summary = await conn.fetchrow(
                """
                SELECT 
                    COUNT(DISTINCT user_id) as unique_visitors,
                    COUNT(*) as total_sessions,
                    SUM(pageviews) as total_pageviews,
                    COALESCE(AVG(duration), 0) as avg_session_duration,
                    COALESCE(AVG(total_scroll_depth), 0) as avg_scroll_depth,
                    (COUNT(CASE WHEN bounce THEN 1 END) * 100.0 / COUNT(*)) as bounce_rate
                FROM sessions
                WHERE started_at > NOW() - $1::INTERVAL
                """,
                f"{days} days"
            )
            
            # Top páginas
            top_pages = await conn.fetch(
                """
                SELECT page_path, COUNT(*) as views
                FROM pageviews
                WHERE viewed_at > NOW() - $1::INTERVAL
                GROUP BY page_path
                ORDER BY views DESC
                LIMIT 10
                """,
                f"{days} days"
            )
            
            # Top eventos
            top_events = await conn.fetch(
                """
                SELECT event_name, COUNT(*) as count
                FROM events
                WHERE occurred_at > NOW() - $1::INTERVAL
                GROUP BY event_name
                ORDER BY count DESC
                LIMIT 10
                """,
                f"{days} days"
            )
            
            # Top sources
            top_sources = await conn.fetch(
                """
                SELECT referrer_source, COUNT(*) as count
                FROM sessions
                WHERE started_at > NOW() - $1::INTERVAL
                GROUP BY referrer_source
                ORDER BY count DESC
                LIMIT 10
                """,
                f"{days} days"
            )
            
            return AnalyticsSummary(
                date=datetime.now().isoformat(),
                unique_visitors=summary['unique_visitors'],
                total_sessions=summary['total_sessions'],
                total_pageviews=summary['total_pageviews'],
                avg_session_duration=round(float(summary['avg_session_duration']), 2),
                avg_scroll_depth=round(float(summary['avg_scroll_depth']), 2),
                bounce_rate=round(float(summary['bounce_rate']), 2),
                top_pages=[dict(r) for r in top_pages],
                top_events=[dict(r) for r in top_events],
                top_sources=[dict(r) for r in top_sources]
            )
