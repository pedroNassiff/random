"""
Analytics Service - Lógica de negocio para el sistema de analytics
"""
import hashlib
import json
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
        
        # Usar datos de geolocalización del frontend si existen, sino usar los del backend
        final_country = data.country if data.country else country
        final_city = data.city if data.city else city
        final_ip_hash = data.ip_hash if data.ip_hash else self.hash_ip(ip_address)
        
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
                    user_id, final_country, final_city, data.timezone, data.language
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
                    data.anonymous_id, final_country, final_city, data.timezone, data.language
                )
            
            # 2. Crear sesión
            referrer_source = self.parse_referrer(data.referrer_url)
            
            # Generar session_id si no viene en el request
            if not data.session_id:
                data.session_id = f"sess_{uuid4().hex[:16]}"
            
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
                final_country, final_city, final_ip_hash
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
            
            # Asegurar que time_spent es int para evitar ambigüedad de tipo
            time_spent_int = int(data.time_spent)
            
            await conn.execute(
                """
                INSERT INTO engagement_zones (
                    session_id, user_id, page_path, zone_id, zone_name,
                    time_spent, scroll_reached, clicked, entered_at, exited_at
                )
                SELECT 
                    id, $2, $3, $4, $5, $6, $7, $8, 
                    NOW() - make_interval(secs => $9), NOW()
                FROM sessions WHERE session_id = $1
                """,
                data.session_id, session['user_id'], data.page_path, data.zone_id,
                data.zone_name, time_spent_int, data.scroll_reached, data.clicked,
                time_spent_int  # Parámetro separado para make_interval
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
        
        # Convertir días a timedelta para PostgreSQL
        time_window = timedelta(days=days)
        
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
                    COALESCE((COUNT(CASE WHEN bounce THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0) as bounce_rate
                FROM sessions
                WHERE started_at > NOW() - $1::INTERVAL
                """,
                time_window
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
                time_window
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
                time_window
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
                time_window
            )
            
            # Daily sessions (para gráfico de línea)
            daily_sessions = await conn.fetch(
                """
                SELECT 
                    DATE(started_at) as date,
                    COUNT(*) as count
                FROM sessions
                WHERE started_at > NOW() - $1::INTERVAL
                GROUP BY DATE(started_at)
                ORDER BY date ASC
                """,
                time_window
            )
            
            # Device breakdown (para gráfico de donut)
            device_breakdown = await conn.fetch(
                """
                SELECT 
                    device_type,
                    COUNT(*) as count
                FROM sessions
                WHERE started_at > NOW() - $1::INTERVAL
                GROUP BY device_type
                ORDER BY count DESC
                """,
                time_window
            )
            
            # Top countries/cities (geolocalización)
            top_countries = await conn.fetch(
                """
                SELECT 
                    country,
                    city,
                    COUNT(*) as count
                FROM sessions
                WHERE started_at > NOW() - $1::INTERVAL
                  AND (country IS NOT NULL OR city IS NOT NULL)
                GROUP BY country, city
                ORDER BY count DESC
                LIMIT 10
                """,
                time_window
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
                top_sources=[dict(r) for r in top_sources],
                daily_sessions=[{"date": str(r['date']), "count": r['count']} for r in daily_sessions],
                device_breakdown=[dict(r) for r in device_breakdown],
                top_countries=[dict(r) for r in top_countries]
            )
    
    async def get_top_pages(self, days: int = 30, limit: int = 10):
        """Obtener páginas más visitadas"""
        time_window = timedelta(days=days)
        
        async with self.db.acquire() as conn:
            results = await conn.fetch(
                """
                SELECT 
                    page_path,
                    page_title,
                    COUNT(*) as views,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    AVG(time_on_page) as avg_time
                FROM pageviews
                WHERE viewed_at > NOW() - $1::INTERVAL
                GROUP BY page_path, page_title
                ORDER BY views DESC
                LIMIT $2
                """,
                time_window, limit
            )
            return [dict(r) for r in results]
    
    async def get_top_events(self, days: int = 30, limit: int = 10):
        """Obtener eventos más frecuentes"""
        time_window = timedelta(days=days)
        
        async with self.db.acquire() as conn:
            results = await conn.fetch(
                """
                SELECT 
                    event_name,
                    event_category,
                    COUNT(*) as count,
                    COUNT(DISTINCT session_id) as unique_sessions
                FROM events
                WHERE occurred_at > NOW() - $1::INTERVAL
                GROUP BY event_name, event_category
                ORDER BY count DESC
                LIMIT $2
                """,
                time_window, limit
            )
            return [dict(r) for r in results]
    
    async def get_top_engagement_zones(self, days: int = 30, limit: int = 10):
        """Obtener zonas de engagement más activas"""
        time_window = timedelta(days=days)
        
        async with self.db.acquire() as conn:
            results = await conn.fetch(
                """
                SELECT 
                    zone_id,
                    zone_name,
                    COUNT(*) as interactions,
                    AVG(time_spent) as avg_duration,
                    COUNT(DISTINCT session_id) as unique_sessions
                FROM engagement_zones
                WHERE entered_at > NOW() - $1::INTERVAL
                GROUP BY zone_id, zone_name
                ORDER BY interactions DESC
                LIMIT $2
                """,
                time_window, limit
            )
            return [dict(r) for r in results]

    async def get_users_activity(self, days: int = 30, limit: int = 20):
        """
        Obtener actividad detallada por usuario
        
        Retorna usuarios con su metadata (email, nombre) y desglose de su actividad:
        - Páginas visitadas con tiempo en cada una
        - Total de clicks por página
        - Número de sesiones
        """
        time_window = timedelta(days=days)
        
        async with self.db.acquire() as conn:
            # Obtener usuarios con metadata y sus métricas generales
            users = await conn.fetch(
                """
                SELECT 
                    u.id,
                    u.anonymous_id,
                    u.email,
                    u.name,
                    u.phone,
                    u.user_identifier,
                    u.total_sessions,
                    u.total_pageviews,
                    u.last_seen,
                    u.country,
                    u.city
                FROM users u
                WHERE u.last_seen > NOW() - $1::INTERVAL
                ORDER BY 
                    CASE 
                        WHEN u.email IS NOT NULL THEN 0
                        ELSE 1
                    END,
                    u.last_seen DESC
                LIMIT $2
                """,
                time_window, limit
            )
            
            result = []
            for user in users:
                user_data = dict(user)
                user_id = user['id']
                
                # Obtener páginas visitadas con tiempo y clicks
                pages = await conn.fetch(
                    """
                    SELECT 
                        p.page_path,
                        p.page_title,
                        COUNT(*) as visits,
                        SUM(p.time_on_page) as total_time,
                        AVG(p.time_on_page) as avg_time,
                        SUM(p.clicks) as total_clicks,
                        MAX(p.viewed_at) as last_visit
                    FROM pageviews p
                    JOIN sessions s ON p.session_id = s.id
                    WHERE s.user_id = $1
                        AND p.viewed_at > NOW() - $2::INTERVAL
                    GROUP BY p.page_path, p.page_title
                    ORDER BY total_time DESC
                    """,
                    user_id, time_window
                )
                
                user_data['pages'] = [dict(p) for p in pages]
                user_data['total_clicks'] = sum(p['total_clicks'] or 0 for p in pages)
                user_data['total_time'] = sum(p['total_time'] or 0 for p in pages)
                
                result.append(user_data)
            
            return result

    async def save_user_metadata(self, data) -> Dict[str, Any]:
        """
        Guardar metadata de usuario extraída del storage del navegador
        
        Actualiza el perfil del usuario con información adicional como email,
        nombre, teléfono, etc., que se extrajo del localStorage/sessionStorage/cookies.
        """
        async with self.db.acquire() as conn:
            # 1. Obtener el user_id de la sesión
            session = await conn.fetchrow(
                """
                SELECT user_id FROM sessions 
                WHERE session_id = $1
                """,
                data.session_id
            )
            
            if not session:
                return {
                    "success": False,
                    "message": "Session not found"
                }
            
            user_id = session['user_id']
            
            # 2. Extraer campos importantes de la metadata
            email = None
            name = None
            phone = None
            user_identifier = None
            
            if 'email' in data.metadata and data.metadata['email']:
                email = data.metadata['email'].get('value')
            
            if 'name' in data.metadata and data.metadata['name']:
                name = data.metadata['name'].get('value')
            
            if 'phone' in data.metadata and data.metadata['phone']:
                phone = data.metadata['phone'].get('value')
            
            if 'userId' in data.metadata and data.metadata['userId']:
                user_identifier = data.metadata['userId'].get('value')
            
            # 3. Actualizar usuario con campos estructurados
            await conn.execute(
                """
                UPDATE users SET
                    email = COALESCE($2, email),
                    name = COALESCE($3, name), 
                    phone = COALESCE($4, phone),
                    user_identifier = COALESCE($5, user_identifier),
                    updated_at = NOW()
                WHERE id = $1
                """,
                user_id, email, name, phone, user_identifier
            )
            
            # 4. Guardar toda la metadata raw en una tabla separada para análisis
            # Parsear timestamp ISO string a datetime naive (sin timezone)
            timestamp_dt = datetime.fromisoformat(data.timestamp.replace('Z', '+00:00'))
            timestamp_naive = timestamp_dt.replace(tzinfo=None)
            
            await conn.execute(
                """
                INSERT INTO user_metadata_history (
                    user_id, session_id, metadata, extracted_at
                ) VALUES ($1, $2, $3, $4)
                """,
                user_id, data.session_id, json.dumps(data.metadata), timestamp_naive
            )
            
            return {
                "success": True,
                "message": "User metadata saved successfully",
                "fields_updated": {
                    "email": email is not None,
                    "name": name is not None,
                    "phone": phone is not None,
                    "user_identifier": user_identifier is not None
                }
            }

