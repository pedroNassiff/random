# Servicio: B2B Prospecting & AI-Native CRM Engine (Leadro-Equivalent)

## 1. Qué es
Microservicio del backend de Random Lab encargo del flujo end-to-end de prospección B2B y CRM nativo en IA: desde la generación y scraping de prospectos, scoring automatizado vía LLM (Claude), pipeline Kanban de stages, generación y traducción de pitches personalizados, hasta el envío vía SMTP y tracking de aperturas en tiempo real mediante pixels transparentes.

## 2. Por qué lo usamos
Los CRMs tradicionales (HubSpot, Salesforce) no ofrecen integración nativa con agentes LLM para análisis de fit en tiempo real, extracción de pain points a partir de web scraping o generación programática de vectors de entrada. Este motor proporciona un flujo **AI-Native** desacoplado y serverless en GCP.

## 3. Cómo se conecta
- **Entrante:**
  - REST APIs desde el Frontend Vercel (Creación de grupos, transición de kanban, activación de scraping y análisis).
  - Webhooks de scrapers externos / tracking pixel `GET /prospecting/pitch/track/{tracking_id}`.
- **Saliente:**
  - **Anthropic Claude API (Sonnet) / OpenAI API:** Para la generación de prospectos, scoring 0-100, deducción de pain points y generación/traducción de pitches.
  - **Servidor SMTP (Hostinger / SendGrid):** Despacho de emails de outreach.
  - **PostgreSQL / BigQuery:** Almacenamiento relacional de contactos (`contacts`, `pitch_logs`, `prospect_groups`) y data warehouse para analítica GTM.

## 4. Identidad y Permisos (IAM)
- **Service Account:** `sa-random-backend-runner@random-lab-prod.iam.gserviceaccount.com`
- **Roles asignados:**
  - `roles/cloudsql.client`
  - `roles/secretmanager.secretAccessor` (acceso a `random-anthropic-api-key`, `random-smtp-password`, `random-database-url`)
  - `roles/bigquery.dataEditor` (para streaming de eventos GTM a BigQuery)

## 5. Configuración & Secretos
- Secret Manager:
  - `random-anthropic-api-key`: Clave API para modelos Claude (Sonnet 3.5 / 3.7)
  - `random-smtp-password`: Credenciales de envío de mail
  - `random-database-url`: Cadena de conexión a PostgreSQL
- Variables de entorno en Cloud Run:
  - `APP_URL`: URL del backend Cloud Run para construcción de URLs de tracking pixel.
  - `AUTO_APPROVE_SCORE_THRESHOLD`: Feature flag (default: `80`) para auto-aprobación de leads vs revisión humana.

## 6. Flujo de Datos & Orquestación LLM (Agentic Workflow)

```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│ Web Scraper /   ├─────►│ Raw Web Content  ├─────►│  Claude LLM       ├─────►│ Structured JSON   │
│ HTTP Request    │      │ (HTML/WP-JSON)   │      │  (Scoring & Fit)  │      │ (Score, Pain, CTA)│
└─────────────────┘      └──────────────────┘      └─────────┬─────────┘      └─────────┬─────────┘
                                                             │                          │
                                                             ▼                          ▼
                                                   ┌───────────────────┐      ┌───────────────────┐
                                                   │  PostgreSQL / BQ  │      │  Kanban CRM       │
                                                   │  (System of Record│      │  (Approve / Pitch)│
                                                   └───────────────────┘      └───────────────────┘
```

## 7. Comportamiento ante fallos & Observabilidad
- Fallos en scraping web caen de forma elegante a análisis basado únicamente en metadata/LinkedIn.
- Reintentos en llamadas a LLM con backoff exponencial.
- Registro auditado de aperturas de correo en `pitch_logs`.

## 8. Estrategia FinOps & Costo Estimado
- Desplegado dentro de Cloud Run serverless (scale-to-zero).
- Invocaciones a LLM bajo demanda (costo por token consumido en Anthropic API).
- Costo base de infraestructura GCP: **$0.00 / mes** (dentro del Always Free Tier).
