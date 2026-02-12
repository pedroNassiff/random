# Automation Module

Sistema de automatización de comunicación digital para Random.

## 🚀 Quick Start

### 1. Crear las tablas en la DB

```bash
cd /Users/pedronassiff/Desktop/proyectos/random
psql -U postgres -d tu_database < automation_schema.sql
```

### 2. Registrar el router en main.py

```python
from automation import router as automation_router
from automation.service import AutomationService

# En startup()
app.state.automation_service = AutomationService(app.state.db_pool)

# Registrar router
app.include_router(automation_router)
```

### 3. Test

```bash
curl http://localhost:8000/automation/health
# Expected: {"status": "healthy", "service": "automation", "version": "1.0.0"}
```

## 📚 Endpoints

### Leads
- `GET /automation/leads` - Lista
- `POST /automation/leads` - Crear
- `GET /automation/leads/{id}` - Detalle
- `PATCH /automation/leads/{id}` - Actualizar
- `POST /automation/leads/{id}/score` - Score con IA

### Content
- `GET /automation/content` - Lista
- `POST /automation/content` - Crear manual
- `POST /automation/content/generate` - Generar con IA
- `PATCH /automation/content/{id}` - Actualizar
- `POST /automation/content/{id}/publish` - Publicar

### Campaigns
- `GET /automation/campaigns` - Lista
- `POST /automation/campaigns` - Crear
- `PATCH /automation/campaigns/{id}` - Actualizar

### Dashboard
- `GET /automation/dashboard` - Métricas
- `GET /automation/pending-approvals` - Items para revisar
- `GET /automation/logs` - Logs de auditoría

### Webhooks (n8n)
- `POST /automation/webhooks/lead-scraped`
- `POST /automation/webhooks/content-generated`

## 🧪 Testing

```bash
# Crear lead de prueba
curl -X POST http://localhost:8000/automation/leads \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Company",
    "website": "https://test.com",
    "industry": "Software",
    "company_size": "11-50",
    "source": "manual"
  }'

# Generar contenido
curl -X POST http://localhost:8000/automation/content/generate \
  -H "Content-Type: application/json" \
  -d '{
    "content_type": "linkedin_post",
    "topic": "Innovación en IA",
    "tone": "philosophical"
  }'

# Ver dashboard
curl http://localhost:8000/automation/dashboard
```

## 📂 Estructura

```
automation/
├── __init__.py       # Module exports
├── models.py         # Pydantic schemas (25+ modelos)
├── service.py        # Business logic
└── router.py         # FastAPI endpoints (25+)
```

## 🔒 Seguridad

- ✅ Logs completos en `automation_logs`
- ✅ Sistema de permisos por agente
- ✅ Rate limiting configurado
- ✅ Aprobación humana para acciones críticas

## 📊 Database

Ver `/Users/pedronassiff/Desktop/proyectos/random/automation_schema.sql`

Tablas:
- `automation_leads` - Leads y scoring
- `automation_content` - Contenido generado
- `automation_campaigns` - Campañas
- `automation_logs` - Auditoría
- `automation_agent_permissions` - Permisos

## 🐛 Troubleshooting

**Error: "Table does not exist"**
```bash
psql -U postgres -d tu_database < automation_schema.sql
```

**Ver logs:**
```sql
SELECT * FROM automation_logs ORDER BY created_at DESC LIMIT 20;
```

## 📖 Docs

- `AUTOMATION_IMPLEMENTATION.md` - Plan completo
- `WEEK1_CHECKLIST.md` - Checklist de implementación
- `test_automation.sh` - Script de testing

## 🎯 Next Steps

1. Integrar Claude API real en `service.py`
2. Setup n8n workflows
3. Build frontend dashboard
4. LinkedIn API para publicación

## 🤝 Integration

Este módulo se integra con el sistema de analytics existente:
- Métricas de engagement desde analytics
- Performance de contenido
- Conversiones desde campañas
