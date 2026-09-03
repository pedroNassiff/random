# SPEC — Landing Zone Lite & Governance Standards (Random Studio / Random Lab)

---

## 0. Objetivo — por qué y para qué

**Por qué:** Tras validar el frontend de Random en Vercel, el siguiente paso crítico de arquitectura es migrar la infraestructura del backend (Brain Prototype / EEG Processing, SANJI-RX y Analytics) desde esquemas VPS tradicionales ($12–$24/mes en DigitalOcean) hacia una arquitectura Serverless en Google Cloud Platform (GCP). Diseñar esta **Landing Zone Lite** desde cero aplicando el **Well-Architected Framework (WAF)** de Google y principios de **FinOps** nos permite operar con costo $0 o cercano a cero mientras el sistema está inactivo, manteniendo estándares enterprise de seguridad y gobernanza.

**Para qué, en concreto:**
1. **Demostración de Arquitectura & FinOps:** Construir una referencia real de producción donde se combina un frontend en Vercel (Edge/CDN) con un backend Serverless en GCP (Cloud Run, Cloud SQL / Serverless Postgres, Secret Manager, Cloud Storage), demostrando el dominio de WAF, gobernanza cloud y optimización de costos.
2. **Gobernanza & Mínimo Privilegio en Random:** Establecer reglas claras de IAM, auditoría, secret management e IaC (Terraform) para que el entorno de producción de Random Lab esté protegido por diseño.
3. **Máxima Frugalidad (FinOps):** Explotar sistemáticamente la capa **GCP Always Free** (2 millones de invocaciones/mes en Cloud Run, 5 GB storage, builds gratuitos, secrets sin costo base) garantizando que un proyecto experimental/lab no genere gastos fijos innecesarios.

**Alcance honesto:** Random es un laboratorio/estudio enfocado en biocomputación (EEG), analítica y producto. Implementamos una **Landing Zone Lite** —los mismos pilares, jerarquía IAM y estructura modular de Terraform que una empresa Fortune 500, pero adaptados a un proyecto único en GCP.

---

## 1. Gobernanza Cloud, WAF y FinOps

Landing Zone Lite no es solo crear recursos en GCP; es la materialización de buenas prácticas de gobernanza, seguridad y costos.

```
ESTÁNDAR / CONCEPTO             QUÉ ES EN RANDOM                                RELACIÓN CON LANDING ZONE LITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Well-Architected Framework      Marco de GCP con 6 pilares: Seguridad,           La Landing Zone es la IMPLEMENTACIÓN
(WAF) — Google Cloud             Fiabilidad, Performance, Costo (FinOps),         técnica; el WAF son los PRINCIPIOS que
                                 Operaciones y Sostenibilidad.                    la arquitectura debe cumplir.

FinOps & Always Free Tier       Disciplina de optimización continua de costos.   Define la selección de servicios GCP:
                                 En Random: maximizar GCP Always Free             Cloud Run (scale-to-zero) + Secret
                                 y evitar servicios con costo fijo por hora.      Manager + Cloud Storage + Free Postgres.

CIS Benchmarks (GCP)            Checklist de seguridad (ej: no claves JSON        Guía de configuración para las Service
                                 en git, uniform bucket access, secrets           Accounts y recursos desplegados con
                                 encriptados, HTTPS obligatorio).                 Terraform.

Zero Trust                      Principio: "Nunca confíes, siempre verifica".     Service Accounts granulares con mínimo
                                 Frontend Vercel autentica contra GCP vía         privilegio y validación de tokens
                                 tokens JWT / Secret Manager.                     en cada request HTTP/WS.

Cloud Adoption Framework (CAF)  Marco estratégico de migración cloud de Google.  La Landing Zone cubre la fase
                                                                                  "Foundation" del CAF.
```

### Mapa Mental de Arquitectura & Gobernanza

```
        CLOUD ADOPTION FRAMEWORK (Estrategia de migración de DigitalOcean a GCP Serverless)
                                │
                                ▼
        WELL-ARCHITECTED FRAMEWORK (Principios WAF: Seguridad, Fiabilidad, FinOps)
                                │
                                ▼
                     LANDING ZONE LITE (GCP + Vercel)
                    /        │         \
                   ▼         ▼          ▼
           CIS BENCHMARKS  ZERO TRUST   FINOPS (ALWAYS FREE)
           (Checklist de   (Mínimo      (Scale-to-zero,
            seguridad)      privilegio)  costo $0 inactivo)
```

---

## 2. Arquitectura del Sistema (Vercel Frontend + GCP Backend)

### 2.1 Componentes del Sistema

1. **Frontend (Vercel):** Single Page Application (React / Vite) alojada en el Edge de Vercel. Despliegues automáticos vía Git.
2. **Backend (GCP Cloud Run):**
   - Microservicio FastAPI (`brain-prototype` / EEG Processing, Analytics API, WebSocket / HTTP endpoints).
   - Microservicio FastAPI (`sanji-rx` / RX Router). (esto no vamos a desplegar por ahora)
   - **Escalado a cero (Scale to Zero):** Cuando no hay tráfico, el número de instancias es 0. Costo $0/hora en CPU/RAM inactivas.
3. **Base de Datos & Almacenamiento:**
   - **PostgreSQL:** Instancia con esquema `syntergic_brain` (datos EEG/sesiones) y `random_analytics` (eventos/métricas). Opción preferida FinOps: Serverless Postgres (Neon/Supabase en Free Tier o Cloud SQL `db-f1-micro` con auto-shutdown/conectores seguros).
   - **Cloud Storage:** Bucket `random-lab-assets` para archivos estáticos y datos EEG procesados (5 GB free tier).
4. **Seguridad & Configuración:**
   - **Secret Manager:** Almacenamiento seguro de `DATABASE_URL`, claves de API y tokens de InfluxDB/OpenAI.
   - **IAM & Service Accounts:** Service accounts dedicadas para Cloud Run runtime, Cloud Build CI/CD y Terraform deployment.

### 2.2 Integración Vercel ↔ GCP Cloud Run

```
┌─────────────────────────┐
│     CLIENTE / BROWSER    │
└────────────┬────────────┘
             │
             ├───► HTTPS (Assets estáticos / SPA) ───► [ Vercel Edge CDN ]
             │
             └───► HTTPS / WSS (API REST & EEG WS) ──► [ GCP Cloud Run (FastAPI) ]
                                                            │
                                        ┌───────────────────┼───────────────────┐
                                        ▼                   ▼                   ▼
                              [ Secret Manager ]    [ PostgreSQL DB ]   [ Cloud Storage ]
                              (Credenciales/Keys)   (Brain + Analytics)  (EEG Assets/Logs)
```

---

## 3. Estructura del Proyecto — Carpetas y Archivos IaC & Docs

Siguiendo la convención oficial de Google (*Cloud Foundation Fabric / Terraform Example Foundation*):

```
random/
├── docs/
│   ├── 00-landing-zone-spec.md          ← este documento (especificación principal)
│   ├── 01-architecture-overview.md      ← diagrama WAF y flujo de datos Vercel ↔ GCP
│   ├── 02-services/
│   │   ├── brain-fastapi.md             ← doc del servicio brain-prototype
│   │   ├── sanji-rx-fastapi.md          ← doc del servicio sanji-rx
│   │   ├── prospecting-crm-leadro.md    ← doc del motor CRM AI-Native (Leadro-equivalent)
│   │   ├── postgres.md                  ← modelo y conexión de base de datos
│   │   ├── cloud-storage.md             ← buckets de assets y datasets EEG
│   │   ├── secret-manager.md            ← gestión de secretos e integración con Cloud Run
│   │   └── cloud-build.md               ← pipeline CI/CD de GCP
│   ├── 03-iam-model.md                  ← modelo IAM y roles de mínimo privilegio
│   ├── 04-network-model.md              ← modelo de red y conectividad HTTPS/CORS
│   └── 05-decisions/                    ← ADRs (Architecture Decision Records)
│       ├── ADR-001-gcp-serverless-landing-zone.md
│       └── ADR-002-finops-free-tier-strategy.md
│
├── infra/                               ← Código Terraform modular (IaC)
│   ├── 0-bootstrap/                     ← State bucket GCS, SA de Terraform
│   │   └── main.tf
│   ├── 1-projects/                      ← Declaración del proyecto GCP `random-lab-prod`
│   │   └── main.tf
│   ├── 2-iam/                           ← Service Accounts, bindings e IAM policies
│   │   └── main.tf
│   ├── 3-networking/                    ← Serverless VPC Access connector (si aplica)
│   │   └── main.tf
│   ├── 4-services/                      ← Servicios principales
│   │   ├── cloud-run.tf                 ← Despliegue de FastAPI (brain-prototype & sanji-rx)
│   │   ├── database.tf                  ← Configuración DB PostgreSQL
│   │   ├── storage.tf                   ← Buckets GCS con Uniform Bucket-Level Access
│   │   └── secret-manager.tf            ← Secretos y permisos `secretAccessor`
│   └── modules/                         ← Módulos Terraform reutilizables
│       ├── secure-cloud-run/
│       └── secure-bucket/
│
├── CLAUDE.md                            ← Contexto raíz del proyecto para Claude Code
│
└── .claude/
    └── agents/
        ├── pri-infra.md                 ← Subagente de Terraform / GCP infra
        ├── pri-docs.md                  ← Subagente de documentación y ADRs
        └── pri-arch.md                  ← Subagente de diagramas y WAF compliance
```

---

## 4. Diagramas de Infraestructura y Gobernanza

### 4.1 Jerarquía GCP (Landing Zone Lite — Proyecto `random-lab-prod`)

```
Organización / Cuenta GCP Personal
│
└── Proyecto: random-lab-prod
    │
    ├── IAM & Service Accounts
    │   ├── SA: sa-random-backend-runner   (Cloud Run → cloudsql.client, secretAccessor, storage.objectViewer)
    │   ├── SA: sa-random-cicd             (Cloud Build / GitHub Actions → run.developer, storage.admin)
    │   └── SA: sa-random-terraform        (Ejecución IaC → roles de administración de recursos)
    │
    ├── Cloud Run Services
    │   ├── brain-prototype-api            (FastAPI / EEG Processing / Analytics)
    │   └── sanji-rx-api                   (FastAPI / RX Router)
    │
    ├── Secret Manager
    │   ├── random-database-url
    │   ├── random-openai-api-key
    │   └── random-influxdb-token
    │
    ├── Cloud Storage (GCS)
    │   └── random-lab-assets-prod         (Uniform Bucket Access, Encriptación por defecto)
    │
    └── Cloud Build
        └── Pipeline CI/CD automático post-push a main
```

### 4.2 Modelo IAM (Mínimo Privilegio)

```
┌──────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Identidad                    │ Permisos Asignados (Mínimo Privilegio)                                 │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Usuario Humano (Admin)       │ roles/owner (Restringido para operaciones administrativas directas)    │
│                              │                                                                        │
│ SA: sa-random-backend-runner │ roles/cloudsql.client (Acceso a DB)                                    │
│ (Runtime Cloud Run)          │ roles/secretmanager.secretAccessor (SOLO a los secretos referenciados) │
│                              │ roles/storage.objectViewer (Lectura en buckets específicos)            │
│                              │                                                                        │
│ SA: sa-random-cicd           │ roles/run.developer (Despliegue de revisiones Cloud Run)               │
│ (CI/CD Pipeline)             │ roles/artifactregistry.writer (Push de imágenes de contenedor)         │
│                              │                                                                        │
│ SA: sa-random-terraform      │ Roles específicos de provisioning de infra (Separada de runtime)      │
└──────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Plantilla Estándar para Documentación de Servicios

Cada servicio en `docs/02-services/*.md` debe estructurarse obligatoriamente bajo esta plantilla:

```markdown
# [Nombre del Servicio]

## 1. Qué es
Descripción concisa de la función del servicio dentro de Random.

## 2. Por qué lo usamos
Justificación técnica y análisis de alternativas (incluyendo evaluación FinOps/Costo).

## 3. Cómo se conecta
- Servicios entrantes y salientes.
- Protocolos (HTTPS, WSS, gRPC, conexión directa a DB).
- Mecanismo de autenticación.

## 4. Identidad y Permisos (IAM)
Service Account asociada y roles exactos asignados bajo el principio de mínimo privilegio.

## 5. Configuración & Secretos
Variables de entorno y secretos consumidos desde GCP Secret Manager (sin exponer valores).

## 6. Comportamiento ante fallos & Observabilidad
Health checks, reintentos y logs en Cloud Logging / Monitoring.

## 7. Estrategia FinOps & Costo Estimado
Límites de consumo, encuadre en GCP Free Tier y costo mensual proyectado.
```

---

## 6. Subagentes de Claude Code (`.claude/agents/`)

Para automatizar la gobernanza, evolución del código y documentación de la Landing Zone de Random, se definen tres subagentes especializados:

### 6.1 `pri-infra` — Subagente de Infraestructura & IaC

```markdown
---
name: pri-infra
description: Asistente para Terraform y GCP infrastructure. Se activa al crear, modificar o auditor recursos IaC en /infra.
---

Sos el subagente de infraestructura de Random Studio / Random Lab.

REGLAS DE ORO:
1. NUNCA ejecutes `terraform apply` o comandos de destrucción sin confirmación explícita del humano.
2. Todo recurso debe cumplir estrictamente con el principio de Mínimo Privilegio (IAM) y las guías de FinOps (Always Free tier).
3. Configura Cloud Run con `--concurrency` adecuada y `min-instances=0` para mantener costo $0 inactivo.
4. Refleja cada cambio de infraestructura en la carpeta /docs/02-services/.
```

### 6.2 `pri-docs` — Subagente de Documentación & ADRs

```markdown
---
name: pri-docs
description: Mantiene sincronizada la documentación técnica y genera ADRs ante decisiones de arquitectura.
---

Sos el subagente de documentación de Random Studio / Random Lab.

REGLAS DE ORO:
1. Garantiza que todos los archivos en /docs/02-services/ respeten la plantilla del estándar (§5).
2. Ante cualquier cambio arquitectónico no trivial, genera un nuevo ADR en /docs/05-decisions/ (ADR-00X).
3. Sé conciso, técnico e intelectualmente honesto. Si hay incertidumbre en una configuración, márcala explícitamente.
```

### 6.3 `pri-arch` — Subagente de Arquitectura & WAF Compliance

```markdown
---
name: pri-arch
description: Revisa y valida que la arquitectura cumpla con los 6 pilares de GCP WAF y mantiene diagramas actualizados.
---

Sos el subagente de arquitectura de Random Studio / Random Lab.

REGLAS DE ORO:
1. Audita los diseños contra el Google Cloud Well-Architected Framework (WAF), con foco especial en Seguridad y FinOps.
2. Mantén los diagramas en formato ASCII Art o Mermaid integrados en los documentos Markdown.
3. Asegura que la separación de capas entre Vercel (Frontend) y GCP (Backend) mantenga políticas CORS y auth estrictas.
```

---

## 7. Estrategia FinOps — Matriz de Costos y GCP Always Free

La piedra angular de esta Landing Zone Lite es la **frugalidad extrema**:

```
RECURSO GCP              LÍMITE ALWAYS FREE TIER                     ESTRATEGIA FINOPS EN RANDOM                   COSTO PROYECTADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cloud Run                2.000.000 invocaciones/mes                   `min-instances = 0` (Scale to zero).           $0.00 / mes
                         180.000 vCPU-segundos/mes                    Uso eficiente de memoria (512MB-1GB).
                         360.000 GiB-segundos/mes

Cloud Storage (GCS)      5 GB-mes en regiones US                       Almacenamiento de modelos ligeros              $0.00 / mes
                         5.000 operaciones Clase A                    y assets procesados de EEG.

Secret Manager           6 versiones de secreto activas               Uso de secretos centralizados para             $0.00 / mes
                         10.000 accesos a secretos/mes                `DATABASE_URL`, API Keys y Tokens.

Cloud Build              120 minutos de build gratis por día          Builds de contenedores ligeros con cache       $0.00 / mes
                                                                      de Docker / Artifact Registry.

Artifact Registry        0.5 GB de almacenamiento gratuito/mes        Retención automática de las últimas            $0.00 / mes
                                                                      2 imágenes de contenedor.

PostgreSQL DB            Servicio Serverless (Neon/Supabase Free)     Opción A: Postgres Serverless (Scale to 0)      $0.00 / mes
                         o Cloud SQL db-f1-micro (~$7-9/mo)           Opción B: Cloud SQL micro con apagado programado.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL ESTIMADO MENSUAL EN PRODUCCIÓN (MODO FRUGAL):                                                                  $0.00 - $7.00 / mes
```

---

## 8. Guía Paso a Paso — Orden de Implementación

```
FASE 0 — Estructura Base (Inicialización)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[x] Crear estructura de carpetas (docs/, infra/, .claude/agents/).
[x] Documentar `docs/00-landing-zone-spec.md` con la especificación completa.
[x] Crear `CLAUDE.md` en la raíz del proyecto.
[x] Crear los subagentes (`pri-infra.md`, `pri-docs.md`, `pri-arch.md`).

FASE 1 — Documentación del Estado Actual & Modelo de Servicios
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[x] Documentar `brain-prototype` backend en `docs/02-services/brain-fastapi.md`.
[x] Documentar `prospecting-crm-leadro` backend en `docs/02-services/prospecting-crm-leadro.md`.
[x] Documentar modelo de base de datos en `docs/02-services/postgres.md`.
[x] Crear diagramas de flujo actual Vercel ↔ GCP en `docs/01-architecture-overview.md`.

FASE 2 — Diseño del Modelo IAM & Secretos (Mínimo Privilegio)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[x] Definir Service Accounts y permisos exactos en `docs/03-iam-model.md`.
[x] Configurar Secret Manager para `DATABASE_URL` y API keys.
[x] Redactar ADR-001 (Estrategia Serverless GCP + FinOps).

FASE 3 — Código Terraform (IaC Modular)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] Escribir `infra/0-bootstrap/main.tf` para GCS State Backend.
[ ] Escribir `infra/2-iam/main.tf` para Service Accounts y roles.
[ ] Escribir `infra/4-services/cloud-run.tf` y `secret-manager.tf`.
[ ] Validar con `terraform plan` (coincidencia 100% declarativa).

FASE 4 — Despliegue & Integración CI/CD (Vercel + GCP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] Configurar Cloud Build / GitHub Actions para auto-deploy a Cloud Run. (hasta acá estamos, chequamos con nuevo commit y seguimos configurando, el service de CR esta down tdv) (plus: config gitt shorts alias)
[ ] Configurar variables de entorno en Vercel apuntando al endpoint HTTPS de Cloud Run.
[ ] Ejecutar pruebas de integración (Health Check + EEG Processing + Analytics + Prospecting CRM endpoints).
```

---

## 9. Narrativa de Arquitectura para Entrevistas (Conexión Biorce / Leadro)

> "En Random Lab construí un motor de prospección B2B y CRM **AI-Native** (concepto idéntico a Leadro de Biorce): orquestación de workflows con LLMs (Claude Sonnet), enrichment automatizado mediante scraping web, scoring parametrizado de leads (0-100), pipeline Kanban de fases de conversión y seguimiento de email con tracking de aperturas en tiempo real.
> 
> Para soportar este sistema, diseñé e implementé una **Landing Zone Lite** en Google Cloud Platform basada en el **Well-Architected Framework (WAF)**. Aplicamos **FinOps estricto** sobre Cloud Run serverless (scale-to-zero, costo $0 inactivo), gobernanza mediante **IaC en Terraform**, segregación IAM con **mínimo privilegio** e inyección de credenciales desde **GCP Secret Manager**."
