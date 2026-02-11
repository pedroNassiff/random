# Analytics System

Sistema completo de analytics para el portfolio Random.

## 📊 Lo que trackea

### Sesiones
- Visitantes únicos (anonimizado con hash)
- Duración de sesión
- Device type, browser, OS
- Resolución de pantalla
- Referrer y UTM parameters
- Geolocalización (país, ciudad)

### Pageviews
- Páginas visitadas
- Tiempo en cada página
- Scroll depth
- Tiempo de carga
- Clicks por página

### Eventos
- Clicks en botones / links
- Hovers sobre elementos
- Scroll eventos
- Form submits
- Navigación

### Engagement Zones
- Tiempo en cada sección (Hero, Projects, Services, Lab, About)
- Zonas que captan más atención (>5 segundos)
- Scroll reached
- Clicks en la zona

### Conversiones
- Ver proyecto completo
- Click en contacto
- Visitar Lab
- Scroll completo de página

## 🚀 Uso

### Backend (ya configurado)

Los endpoints están en `/analytics/*`:
- `POST /analytics/session/start` - Iniciar sesión
- `POST /analytics/pageview` - Registrar pageview
- `POST /analytics/event` - Registrar evento
- `POST /analytics/engagement` - Registrar engagement
- `POST /analytics/conversion` - Registrar conversión
- `POST /analytics/session/end` - Finalizar sesión
- `POST /analytics/batch` - Enviar múltiples eventos
- `GET /analytics/summary?days=30` - Resumen de analytics

### Frontend (siguiente paso)

Ver `frontend/src/lib/analytics.js` para el cliente de React.

## 🔒 GDPR Compliance

✅ No guardamos IPs reales (solo hash SHA256)  
✅ Datos anonimizados por defecto  
✅ Sin cookies de tracking  
✅ Datos agregados para analytics  
✅ Respeta "Do Not Track"

## 📈 Dashboard

Para ver analytics:
```sql
-- Resumen últimos 30 días
SELECT * FROM analytics_summary WHERE date > NOW() - INTERVAL '30 days';

-- Top páginas
SELECT * FROM top_pages;

-- Top eventos
SELECT * FROM top_events;

-- Engagement zones
SELECT * FROM top_engagement_zones;
```

## 🗄️ Base de Datos

Schema completo en: `database/migrations/001_create_analytics_schema.sql`

Tablas:
- `users` - Usuarios anonimizados
- `sessions` - Sesiones de navegación
- `pageviews` - Vistas de página
- `events` - Eventos de interacción
- `engagement_zones` - Tiempo en cada sección
- `conversions` - Objetivos cumplidos

Vistas materializadas:
- `analytics_summary` - Métricas agregadas diarias
- `top_pages` - Páginas más vistas
- `top_events` - Eventos más frecuentes
- `top_engagement_zones` - Zonas con más engagement
