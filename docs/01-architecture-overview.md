# Visión General de Arquitectura — Random Studio / Random Lab

## 1. Introducción y Propósito
Este documento describe la arquitectura global del sistema **Random Studio / Random Lab**, diseñado bajo los principios del **Google Cloud Well-Architected Framework (WAF)** y gobernado por una **Landing Zone Lite** en GCP.

El sistema se compone de una arquitectura híbrida:
- **Frontend SPA (React + Vite):** Alojado en **Vercel CDN Edge**, encargado del rendering interactivo, visualización de datos biométricos/EEG e interfaz de portfolio/analítica.
- **Backend Serverless (GCP Cloud Run):** Contenedor FastAPI (`brain-prototype` — que engloba EEG Processing, Analytics API, Prospecting B2B CRM y WebSocket / HTTP endpoints) ejecutado bajo demanda con escalado a cero (Scale to Zero) para optimización estricta de costos (FinOps). (*Nota: `sanji-rx` no se despliega en Cloud Run por ahora*).

---

## 2. Diagrama de Arquitectura Global (Vercel + GCP)

```
                                    ┌────────────────────────────────┐
                                    │    USUARIO / NAVEGADOR WEB     │
                                    └───────────────┬────────────────┘
                                                    │
                               ┌────────────────────┴────────────────────┐
                               │                                         │
                    HTTPS (Assets / SPA)                       HTTPS / WSS (API REST & EEG WS)
                               │                                         │
                               ▼                                         ▼
                     ┌──────────────────┐                      ┌──────────────────┐
                     │   VERCEL EDGE    │                      │  GCP CLOUD RUN   │
                     │  (Frontend CDN)  │                      │ (FastAPI Backend)│
                     └──────────────────┘                      └────────┬─────────┘
                                                                        │
                                                ┌───────────────────────┼───────────────────────┐
                                                ▼                       ▼                       ▼
                                      ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
                                      │  SECRET MANAGER  │    │  POSTGRESQL DB   │    │  CLOUD STORAGE   │
                                      │ (DATABASE_URL,   │    │(syntergic_brain, │    │  (Assets EEG &   │
                                      │   API Keys)      │    │ random_analytics)│    │   Datasets)      │
                                      └──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 3. Pilares del Well-Architected Framework (WAF) Aplicados

1. **Seguridad (Security):**
   - Mínimo privilegio en IAM (Service Accounts dedidadas para runtime, CI/CD e IaC).
   - Secretos 100% inyectados desde GCP Secret Manager (`secretAccessor`). Sin claves planos ni `.env` en imágenes.
   - HTTPS / TLS 1.3 forzado en la capa de Vercel y Cloud Run.
2. **Costo & FinOps (Cost Optimization):**
   - Uso intensivo del **GCP Always Free Tier**.
   - Cloud Run configurado con `min-instances = 0` (costo $0 inactivo).
   - Base de Datos Serverless / Frugal (Supabase/Neon Free tier o Cloud SQL optimizado).
3. **Fiabilidad (Reliability):**
   - Reintentos exponenciales en reconexión de WebSocket para streaming EEG.
   - Health checks estandarizados (`/analytics/health`, `/health`) monitoreados por Cloud Run.
4. **Excelencia Operativa (Operational Excellence):**
   - Infraestructura definida 100% como Código (IaC) con Terraform en `/infra`.
   - Pipeline de CI/CD automatizado vía Cloud Build / GitHub Actions.
