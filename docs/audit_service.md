# Audit Express — Spec Técnico End-to-End

> **Random Lab** · Producto de auditoría automatizada de salud técnica
> Versión 0.1 · Owner: Pedro
> Status: Pre-implementación

---

## 1. Contexto y posicionamiento

### 1.1 Qué es

Audit Express es un servicio + herramienta interna que genera un informe automatizado de "salud técnica pública" de un sitio web a partir de su dominio. Combina checks de seguridad, performance, SEO, accesibilidad, compliance legal (RGPD/EAA) y observabilidad de costos. Todo desde fuera, sin necesidad de credenciales ni acceso a la infra del cliente.

### 1.2 Por qué este framing y no "audit de seguridad"

- **"Seguridad" suena a gasto y miedo** → CISO/CTO defienden presupuesto.
- **"Salud técnica + ahorro" suena a oportunidad y ROI** → CEO/CMO empujan la compra.
- Al mezclar dimensiones, **al menos uno de los hallazgos top siempre es cuantificable en €** (bandwidth, conversión, multas evitadas).
- Diferenciación frente a competidores que venden solo pentesting (Detectify, Intruder.io, Probely).

### 1.3 Posicionamiento comercial

| SKU | Precio | Duración | Alcance | Función comercial |
|---|---|---|---|---|
| **Health Check (lead magnet, gratis o 300€)** | 0–300€ | 24h | Capa 1 estricta | Generador de inbound + sample de capacidad |
| **Audit Express** | 1.5k–3k€ | 1 semana | Capa 1 + revisión manual | Entry-point baja fricción |
| **Pentest Web/Mobile** | 6k–15k€ | 2–4 semanas | Capa 2 (contrato firmado) | Servicio core, ticket alto |
| **Continuous Security** | 800–2k€/mes | Recurring | Scans semanales + retainer | Revenue predecible |

Audit Express es el corazón del funnel. Los otros SKUs lo reutilizan.

---

## 2. Marco legal (no opcional)

### 2.1 Capa 1 — Reconocimiento pasivo (sin contrato)

Todo lo que se ejecuta acá usa **únicamente datos públicos** o consultas a servicios de terceros que el cliente mismo expone a internet:

- DNS lookups
- Headers HTTP (1 request por endpoint público)
- Certificate Transparency logs
- APIs públicas (SSL Labs, PageSpeed Insights, HIBP, crt.sh)
- Carga del sitio en headless browser como un usuario normal hace
- Búsqueda en GitHub público de secretos asociados al dominio

**Límite duro:** sin fuzzing, sin escaneo de puertos activo, sin probar credenciales, sin auth bypass, sin payloads de inyección. Ni de chiste.

### 2.2 Capa 2 — Testing activo (solo con contrato)

Nuclei, ZAP, sqlmap, nmap activo, Burp, fuzzing de APIs, IDOR, SSRF, etc. **Requiere**:

1. Carta de autorización firmada por persona con autoridad
2. Scope documentado (dominios, IPs, horarios, profundidad)
3. Reglas de engagement
4. NDA bidireccional
5. Seguro de RC profesional (Hiscox / AIG cubren pentesting en España)

### 2.3 Referencias legales relevantes

- **CP español arts. 197 bis y 264** — acceso e interferencia en sistemas
- **Directiva NIS2 (UE 2022/2555)** — palanca de venta brutal en 2026
- **European Accessibility Act (Directiva 2019/882)** — vigente desde 28-jun-2025
- **RGPD + LSSI-CE** — base de los hallazgos de privacy/cookies
- **ENS** — si el cliente vende a sector público

Estos no son adornos: son los puntos de pitch que cuantifican el riesgo en € para el cliente.

---

## 3. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AUDIT EXPRESS                              │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────┐        ┌──────────────┐
  │   Frontend   │────────▶│   FastAPI    │───────▶│  PostgreSQL  │
  │   React      │  REST   │   (API)      │  ORM   │  + pgvector  │
  └──────────────┘         └──────┬───────┘        └──────────────┘
                                  │
                                  │ enqueue
                                  ▼
                          ┌───────────────┐
                          │  Redis / RQ   │
                          │  (job queue)  │
                          └───────┬───────┘
                                  │
                                  ▼
                  ┌───────────────────────────────────┐
                  │         AUDIT WORKER POOL         │
                  │  (Python, async, 1+ procesos)     │
                  └───────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────────┐
              ▼                   ▼                       ▼
        ┌──────────┐        ┌──────────┐           ┌──────────┐
        │  Probes  │        │ Playwright│          │External  │
        │ (HTTP,   │        │ headless  │          │  APIs    │
        │  DNS,    │        │  Chrome   │          │ (SSL Labs│
        │  TLS)    │        │           │          │  PSI,    │
        └──────────┘        └──────────┘           │  HIBP...)│
                                                   └──────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │  Findings DB  │
                          │   (scored,    │
                          │   prioritized)│
                          └───────┬───────┘
                                  │
                  ┌───────────────┼───────────────┐
                  ▼                               ▼
            ┌──────────┐                    ┌──────────┐
            │  PDF     │                    │  GCS     │
            │ Reporter │                    │ (storage │
            │ (Weasy/  │                    │  reports)│
            │ ReportLab│                    └──────────┘
            └──────────┘
```

### 3.1 Decisiones arquitectónicas clave

| Decisión | Justificación |
|---|---|
| **FastAPI + workers async** 
| **Redis/RQ en lugar de Celery** | Auditorías son jobs medianos (5–15 min), no necesitamos el peso de Celery. RQ es trivial. |
| **PostgreSQL único (no Mongo para findings)** | Necesitás joins, agregaciones, queries por cliente/run/severidad. Postgres jsonb cubre la flexibilidad. |
| **Playwright sobre Puppeteer** | Mejor API, multi-browser, mejor stealth. Ya lo usamos en Sniper. |
| **GCS para reports** | Ya tenés GCP montado. Signed URLs para entrega. |
| **Lighthouse via Node CLI en subprocess** | Más estable que la versión Python. Worker spawns `lighthouse --output=json`. |
| **pgvector ya está disponible** | Para fase 2: embeddings de findings para similarity y agrupación cross-cliente. |

---

## 4. Stack técnico detallado

```
Backend:
  - Python 3.11+
  - FastAPI 0.110+
  - SQLAlchemy 2.0 (async) + Alembic
  - Pydantic v2
  - RQ (Redis Queue) + Redis 7
  - httpx (async HTTP client)
  - Playwright (Python)
  - dnspython
  - cryptography (TLS introspection si SSL Labs cae)

Frontend (panel interno):
 - REact
  - Tailwind
  - Chart.js para dashboards
  Para el audit principalmente vamos a usar el dashboard y lo que tnemos de planning prospeccion, solo que debemos añadir que todo el analisis y el scraping que ya tenemos es para esto, es decir, como si fuera pasarle un check o algo que le diga este prospecto es de tech-healt-audit por ejemplo - importante!!!!

Reporting:
  - WeasyPrint (HTML → PDF) o ReportLab si querés más control
  - Jinja2 templates

Infra - usamos todo lo que ya tenemos, creamos nuevas tablas:
  - GCP Cloud Run (API) + Compute Engine (workers con Chrome)
    el frontend ya tenemos desplegado en vercel, luego vamos a dpelsgar el backend en CE de gcp
  - Cloud SQL para Postgres - esto ya tenemos
  - Memorystore Redis -  re utilizamos lo que tenemos
  - GCS para reports - esto nuevo
  - Self-hosted GitHub Actions runner (ya lo tenés)

External APIs (gratis o baratas):
  - Google PageSpeed Insights API — free, quota razonable
  - SSL Labs API — free, rate-limited (1 scan / cada 2h por host)
  - HIBP API — $4/mes
  - crt.sh — free, JSON endpoint
  - Wappalyzer — npm package self-hosted
  - axe-core — npm package
```

---

## 5. Estructura de archivos

```
audit-express/
├── README.md
├── docker-compose.yml
├── .env.example
├── pyproject.toml
├── alembic/
│   ├── env.py
│   └── versions/
│
├── apps/
│   ├── api/                          # FastAPI service
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── audits.py             # POST /audits, GET /audits/{id}
│   │   │   ├── clients.py            # CRUD prospects/clientes
│   │   │   ├── findings.py           # GET findings filtrados
│   │   │   ├── reports.py            # GET signed URL del PDF
│   │   │   └── webhooks.py           # callbacks de servicios externos
│   │   ├── dependencies.py
│   │   ├── schemas/                  # Pydantic models
│   │   └── auth.py
│   │
│   └── worker/                       # RQ workers
│       ├── worker.py                 # entry point
│       └── tasks/
│           ├── orchestrator.py       # AuditOrchestrator
│           ├── probes/               # 1 archivo por módulo de check
│           │   ├── __init__.py
│           │   ├── base.py           # ProbeBase abstract
│           │   ├── security_headers.py
│           │   ├── tls.py
│           │   ├── email_auth.py
│           │   ├── ct_logs.py
│           │   ├── stack_detection.py
│           │   ├── breaches.py
│           │   ├── github_secrets.py
│           │   ├── performance.py    # PageSpeed + Lighthouse
│           │   ├── network_analysis.py  # Playwright + CDP
│           │   ├── assets_audit.py   # imágenes, fonts, video
│           │   ├── api_loops.py      # detección de duplicados/polling
│           │   ├── seo_technical.py
│           │   ├── accessibility.py  # axe-core
│           │   ├── privacy_cookies.py
│           │   ├── legal_notices.py
│           │   └── ux_signals.py
│           └── scoring.py            # cálculo de severidad y prioridad
│
├── core/                             # Shared domain
│   ├── models/                       # SQLAlchemy models
│   │   ├── client.py
│   │   ├── audit_run.py
│   │   ├── finding.py
│   │   ├── probe_result.py
│   │   └── report.py
│   ├── enums.py                      # Severity, Category, etc.
│   ├── config.py                     # Pydantic settings
│   └── db.py
│
├── reporting/
│   ├── generator.py                  # orquesta el PDF
│   ├── templates/
│   │   ├── base.html
│   │   ├── executive_summary.html
│   │   ├── sections/
│   │   │   ├── security.html
│   │   │   ├── performance.html
│   │   │   ├── seo.html
│   │   │   ├── accessibility.html
│   │   │   ├── privacy.html
│   │   │   └── recommendations.html
│   │   └── styles.css
│   ├── charts.py                     # gráficos matplotlib → PNG → embed
│   └── pricing_model.py              # cálculo de € ahorrables
│
├── frontend/                         # Vue 3 panel
│   └── ...
│
├── scripts/
│   ├── seed_categories.py
│   └── run_audit_cli.py              # ejecutar un audit desde terminal
│
└── tests/
    ├── unit/
    ├── integration/
    └── fixtures/
        └── sample_sites/             # sitios de testing controlados
```

---

## 6. Base de datos

### 6.1 Modelo de entidades

```
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│   Client    │───┐   │  AuditRun    │───┐   │   Finding    │
│             │   │   │              │   │   │              │
│ id          │   │   │ id           │   │   │ id           │
│ name        │   │   │ client_id ───┼───┘   │ run_id    ───┼──┐
│ domain      │   │   │ root_url     │       │ probe_key    │  │
│ contact     │   │   │ status       │       │ category     │  │
│ industry    │   │   │ started_at   │       │ severity     │  │
│ source      │◀──┘   │ finished_at  │       │ title        │  │
│ created_at  │       │ trigger      │       │ description  │  │
└─────────────┘       │ config_jsonb │       │ evidence_json│  │
                      └──────────────┘       │ impact_eur   │  │
                              │              │ fix_effort   │  │
                              │              │ references   │  │
                              ▼              └──────────────┘  │
                      ┌──────────────┐                         │
                      │ ProbeResult  │                         │
                      │              │       ┌──────────────┐  │
                      │ id           │       │   Report     │  │
                      │ run_id    ───┼──┐    │              │  │
                      │ probe_key    │  │    │ id           │  │
                      │ status       │  │    │ run_id    ───┼──┘
                      │ duration_ms  │  │    │ pdf_gcs_path │
                      │ raw_jsonb    │  │    │ executive_md │
                      │ error        │  │    │ generated_at │
                      └──────────────┘  │    │ version      │
                                        │    └──────────────┘
                                        │
                                        └────── (siblings de Finding,
                                                  ambos pertenecen a AuditRun)
```

### 6.2 DDL (esquemático, lo formalizás con Alembic)

```sql
-- Clientes / prospects (puede integrarse con tu Planning Prospección)
CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    primary_domain  TEXT NOT NULL,
    industry        TEXT,
    country         CHAR(2),
    contact_email   TEXT,
    contact_phone   TEXT,
    source          TEXT, -- 'inbound', 'outbound', 'lead_magnet', 'referral'
    status          TEXT NOT NULL DEFAULT 'prospect',
                    -- 'prospect' | 'lead' | 'customer' | 'churned'
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_domain ON clients(primary_domain);
CREATE INDEX idx_clients_status ON clients(status);

-- Una ejecución de auditoría
CREATE TABLE audit_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    root_url        TEXT NOT NULL,
    sku             TEXT NOT NULL,
                    -- 'health_check' | 'audit_express' | 'pentest' | 'continuous'
    status          TEXT NOT NULL DEFAULT 'pending',
                    -- 'pending'|'running'|'completed'|'failed'|'cancelled'
    trigger         TEXT NOT NULL DEFAULT 'manual',
                    -- 'manual'|'scheduled'|'api'|'webhook'
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
                    -- qué probes correr, parámetros custom
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_runs_client ON audit_runs(client_id);
CREATE INDEX idx_audit_runs_status ON audit_runs(status);
CREATE INDEX idx_audit_runs_started ON audit_runs(started_at DESC);

-- Resultado crudo de cada probe (debugging, replay, comparativa)
CREATE TABLE probe_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    probe_key       TEXT NOT NULL,
                    -- 'security_headers'|'tls'|'lighthouse'|...
    status          TEXT NOT NULL,
                    -- 'success'|'partial'|'failed'|'skipped'
    duration_ms     INTEGER,
    raw_data        JSONB,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_probe_results_run ON probe_results(run_id);
CREATE INDEX idx_probe_results_key ON probe_results(probe_key);

-- Hallazgos individuales (1 probe puede generar 0..N findings)
CREATE TABLE findings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id              UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    probe_key           TEXT NOT NULL,
    category            TEXT NOT NULL,
                        -- 'security'|'performance'|'seo'|'accessibility'
                        -- 'privacy'|'cost_optimization'|'legal'
    severity            TEXT NOT NULL,
                        -- 'info'|'low'|'medium'|'high'|'critical'
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    evidence            JSONB,
                        -- screenshots, headers crudos, URLs, etc.
    impact_eur_monthly  NUMERIC(12,2),
                        -- estimación de impacto/ahorro mensual
    impact_confidence   TEXT,
                        -- 'low'|'medium'|'high' — cuán cuantificable es
    fix_effort          TEXT,
                        -- 'trivial'|'small'|'medium'|'large'
    cwe                 TEXT,
    cvss_score          NUMERIC(3,1),
    refs                JSONB DEFAULT '[]'::jsonb,
                        -- [{type:'rfc'|'cve'|'doc', id, url, title}]
    -- Para fase 2 con pgvector:
    embedding           VECTOR(1536),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_findings_run ON findings(run_id);
CREATE INDEX idx_findings_category ON findings(category);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_embedding ON findings
    USING ivfflat (embedding vector_cosine_ops);

-- Reporte generado
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
    pdf_gcs_path    TEXT NOT NULL,
    executive_md    TEXT,
                    -- resumen ejecutivo en markdown para mail/LinkedIn
    overall_score   INTEGER, -- 0–100
    score_breakdown JSONB,
                    -- {security: 65, performance: 42, seo: 78, ...}
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_reports_run ON reports(run_id);

-- Catálogo de probes (para configuración + UI)
CREATE TABLE probe_catalog (
    key             TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT,
    layer           TEXT NOT NULL,   -- '1_passive' | '2_active'
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    default_config  JSONB DEFAULT '{}'::jsonb,
    avg_duration_ms INTEGER
);
```

### 6.3 Notas de diseño

- **`evidence` y `raw_data` como JSONB** porque cada probe tiene su shape. Los reports leen de findings; el debug lee de probe_results.
- **`impact_eur_monthly`** es el campo MÁGICO comercialmente. Cada finding debe tratar de poblarlo. Si no es posible, queda `NULL` con `impact_confidence='low'`.
- **`embedding`** preparado desde el día 1 aunque arranque vacío. Fase 2 lo usa para detectar patrones cross-cliente ("estas 12 empresas FoodTech tienen el mismo gap").
- **Sin tabla `users`** en v1 — el panel es interno, auth básica HTTP o JWT compartido. Cuando vendas self-service lo agregás.

---

## 7. Módulos de probes (catálogo completo v1)

Cada probe implementa la misma interfaz:

```python
class ProbeBase(ABC):
    key: str
    category: Category
    layer: Layer  # PASSIVE_LAYER_1 | ACTIVE_LAYER_2
    requires: list[str] = []  # otros probes que deben correr antes

    @abstractmethod
    async def run(self, ctx: AuditContext) -> ProbeOutput:
        """
        Returns ProbeOutput(raw_data, findings, status, duration_ms)
        """
```

### 7.1 Seguridad (Capa 1)

| Probe | Qué chequea | API/Tool | Outputs típicos |
|---|---|---|---|
| `security_headers` | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options | request directo | "Falta HSTS", "CSP permisiva con unsafe-inline" |
| `tls` | Versiones soportadas, ciphers, cert expiry, chain, HSTS, OCSP | SSL Labs API | "TLS 1.0 habilitado", "Cert expira en 12 días" |
| `email_auth` | SPF, DKIM, DMARC, BIMI, MTA-STS | DNS via dnspython | "DMARC en p=none", "SPF sin mecanismo all estricto" |
| `ct_logs` | Subdominios expuestos en Certificate Transparency | crt.sh JSON | "Subdominios huérfanos detectados: staging., dev., old.." |
| `stack_detection` | CMS, frameworks, versiones públicas | Wappalyzer | "WordPress 5.8 (vulnerabilidades CVE-XXX)", "jQuery 1.x" |
| `breaches` | Credenciales de @dominio en breaches | HIBP API | "47 credenciales filtradas del dominio" |
| `github_secrets` | Búsqueda de secretos asociados al dominio en GH público | TruffleHog + GH Search | "Posible API key referenciando el dominio en repo X" |
| `info_disclosure` | Headers Server/X-Powered-By, .git público, robots con paths sensibles | request | "X-Powered-By expone PHP 7.2" |

### 7.2 Performance + cost (Capa 1)

| Probe | Qué chequea | API/Tool | Outputs típicos |
|---|---|---|---|
| `pagespeed` | Core Web Vitals (LCP, INP, CLS), field + lab | PSI API | "LCP=4.3s (poor)", "INP=520ms" |
| `lighthouse_full` | Performance, a11y, SEO, best practices, PWA | Lighthouse CLI | Score multidimensional |
| `network_analysis` | Waterfall, requests, third-party, bytes | Playwright + CDP | "Home pesa 18MB", "143 requests" |
| `assets_audit` | Imágenes mal optimizadas, formato, dimensiones vs render | Playwright + análisis | "23 imgs >500KB, ahorro estimado 12MB" |
| `api_loops` | Requests duplicados, polling agresivo, payloads grandes | Playwright + CDP | "API X llamada 4 veces en 1 carga" |
| `caching` | Cache-Control, ETag, immutable assets | request análisis | "Assets estáticos sin Cache-Control" |
| `compression` | gzip/brotli en HTML, JSON, fonts | request con Accept-Encoding | "JSON API sin compresión" |
| `http_version` | HTTP/2, HTTP/3 support | request | "Sirviendo HTTP/1.1 todavía" |
| `cdn_detection` | CDN delante del origin | DNS + headers | "Sin CDN — costo egress directo" |

### 7.3 SEO técnico (Capa 1)

| Probe | Qué chequea | Tool | Outputs típicos |
|---|---|---|---|
| `meta_tags` | Title, description, OG, Twitter Cards | HTML parser | "30% de páginas sin meta description" |
| `structured_data` | JSON-LD presente y válido | HTML parser + schema.org validator | "Sin Schema.org Product en e-commerce" |
| `sitemap_robots` | sitemap.xml válido, robots.txt coherente | requests + XML parse | "Sitemap referencia URLs 404" |
| `canonical_hreflang` | Canonicals, hreflang multi-idioma | HTML parser | "hreflang ES/CA mal configurado" |
| `broken_links` | Links 404 internos (sample) | crawler limitado a 1 nivel | "12 links rotos en homepage" |
| `redirect_chains` | A→B→C→D | request seguimiento | "Chain de 4 redirects en /producto" |

### 7.4 Accesibilidad (Capa 1)

| Probe | Qué chequea | Tool | Outputs típicos |
|---|---|---|---|
| `axe_core` | WCAG 2.1/2.2 AA violations | Playwright + axe-core | "17 violations: contraste, alt, ARIA" |
| `keyboard_nav` | Focus states, skip links, tab order | Playwright scripted | "Sin skip link, focus invisible" |
| `mobile_friendly` | Viewport, tap targets, font sizes | Lighthouse + custom | "Tap targets <48px en CTAs" |

### 7.5 Privacy / RGPD / LSSI-CE (Capa 1)

| Probe | Qué chequea | Tool | Outputs típicos |
|---|---|---|---|
| `cookies_before_consent` | Cookies y trackers seteadas antes del consentimiento | Playwright (sin click en consent) | "GA4 carga sin consent" |
| `cookie_banner_compliance` | Existencia, opciones reales, granularidad | Playwright + heurística | "Sin opción de rechazar" |
| `privacy_policy` | Existencia, accesibilidad, cláusulas mínimas | crawler + texto | "Sin política accesible desde footer" |
| `legal_notice` | Aviso legal con CIF, dirección, contacto | crawler + parser | "Falta CIF en aviso legal" |
| `dpo_published` | DPO publicado si aplica | crawler | "Sin DPO en sitio con tratamiento masivo" |

### 7.6 UX signals (Capa 1)

| Probe | Qué chequea | Tool | Outputs típicos |
|---|---|---|---|
| `cls_real` | Layout shifts reales | Lighthouse | "CLS=0.34 (poor)" |
| `form_quality` | Autocomplete, inputmode, validación | HTML parser | "Forms sin autocomplete attrs" |
| `image_dimensions` | Imgs sin width/height (causa CLS) | HTML parser | "37 imgs sin dimensiones" |

---

## 8. Pseudocódigo del orquestador

### 8.1 Flujo principal

```python
# apps/worker/tasks/orchestrator.py

async def run_audit(run_id: UUID) -> None:
    """
    Entry point del worker. Ejecuta un AuditRun completo.
    """
    run = await db.get(AuditRun, run_id)
    run.status = "running"
    run.started_at = now()
    await db.commit()

    try:
        ctx = AuditContext(
            run_id=run.id,
            root_url=run.root_url,
            domain=extract_domain(run.root_url),
            config=run.config,
            cache={},   # cache compartido entre probes (ej. HTML del home)
        )

        # 1. Seleccionar probes según SKU + config
        probes = select_probes(run.sku, run.config)

        # 2. Pre-warming: cargar el home una vez y compartir
        await prewarm_context(ctx)

        # 3. Ejecutar probes con concurrencia controlada
        results = await run_probes_concurrent(
            probes, ctx,
            max_concurrent=5,
            per_probe_timeout=120
        )

        # 4. Persistir probe_results
        for probe_key, output in results.items():
            await db.add(ProbeResult(
                run_id=run.id,
                probe_key=probe_key,
                status=output.status,
                duration_ms=output.duration_ms,
                raw_data=output.raw_data,
                error=output.error,
            ))

        # 5. Generar findings consolidados
        all_findings = []
        for output in results.values():
            for f in output.findings:
                f.run_id = run.id
                all_findings.append(f)

        # 6. Scoring + priorización + cálculo de impacto en €
        scored = score_findings(all_findings, ctx)
        await db.add_all(scored)

        # 7. Generar reporte
        report = await ReportGenerator(run, scored).generate()
        await db.add(report)

        run.status = "completed"
        run.finished_at = now()

    except Exception as e:
        run.status = "failed"
        run.error = str(e)
        logger.exception("Audit failed", run_id=run_id)

    finally:
        await db.commit()
        await notify_completion(run)
```

### 8.2 Pre-warming del contexto

```python
async def prewarm_context(ctx: AuditContext):
    """
    Cargar recursos que múltiples probes van a reusar.
    Evita cargar el sitio 15 veces.
    """
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()

        # Capturar todo el tráfico
        requests_log = []
        page.on("request", lambda req: requests_log.append({
            "url": req.url, "method": req.method, "type": req.resource_type,
            "ts": time.time(),
        }))

        responses_log = []
        page.on("response", lambda res: responses_log.append({
            "url": res.url, "status": res.status,
            "headers": dict(res.headers), "ts": time.time(),
        }))

        # Cookies ANTES de cualquier interacción (clave para privacy probe)
        await page.goto(ctx.root_url, wait_until="networkidle", timeout=30000)
        cookies_pre_consent = await page.context.cookies()

        ctx.cache["home_html"] = await page.content()
        ctx.cache["home_screenshot"] = await page.screenshot(full_page=True)
        ctx.cache["requests"] = requests_log
        ctx.cache["responses"] = responses_log
        ctx.cache["cookies_pre_consent"] = cookies_pre_consent
        ctx.cache["page"] = page  # algunos probes la reutilizan

        await browser.close()
```

### 8.3 Ejemplo de probe: security_headers

```python
# apps/worker/tasks/probes/security_headers.py

class SecurityHeadersProbe(ProbeBase):
    key = "security_headers"
    category = Category.SECURITY
    layer = Layer.PASSIVE_LAYER_1

    REQUIRED_HEADERS = {
        "strict-transport-security": {
            "severity": Severity.HIGH,
            "title": "Sin HSTS",
            "fix": "Añadir Strict-Transport-Security con max-age >= 31536000",
        },
        "content-security-policy": {
            "severity": Severity.HIGH,
            "title": "Sin CSP",
            "fix": "Definir CSP estricta, evitar unsafe-inline/unsafe-eval",
        },
        "x-content-type-options": {
            "severity": Severity.LOW,
            "title": "Sin X-Content-Type-Options",
        },
        "referrer-policy": {
            "severity": Severity.LOW,
            "title": "Sin Referrer-Policy",
        },
        "permissions-policy": {
            "severity": Severity.MEDIUM,
            "title": "Sin Permissions-Policy",
        },
    }

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        t0 = time.time()
        findings = []

        async with httpx.AsyncClient(follow_redirects=True) as client:
            r = await client.get(ctx.root_url, timeout=15)
            headers = {k.lower(): v for k, v in r.headers.items()}

        for header, spec in self.REQUIRED_HEADERS.items():
            if header not in headers:
                findings.append(Finding(
                    probe_key=self.key,
                    category=Category.SECURITY,
                    severity=spec["severity"],
                    title=spec["title"],
                    description=f"El header `{header}` no está presente en la respuesta.",
                    evidence={"observed_headers": list(headers.keys())},
                    fix_effort=FixEffort.TRIVIAL,
                    impact_eur_monthly=None,
                    impact_confidence="low",
                    refs=[
                        {"type": "doc", "url": "https://owasp.org/...",
                         "title": "OWASP Secure Headers"}
                    ],
                ))

        # CSP permisiva
        csp = headers.get("content-security-policy", "")
        if "unsafe-inline" in csp or "unsafe-eval" in csp:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.SECURITY,
                severity=Severity.MEDIUM,
                title="CSP con unsafe-inline / unsafe-eval",
                description="La CSP permite ejecución inline, anulando gran parte de su protección anti-XSS.",
                evidence={"csp": csp},
            ))

        return ProbeOutput(
            raw_data={"headers": headers},
            findings=findings,
            status=Status.SUCCESS,
            duration_ms=int((time.time() - t0) * 1000),
        )
```

### 8.4 Ejemplo de probe con impacto en €: assets_audit

```python
class AssetsAuditProbe(ProbeBase):
    key = "assets_audit"
    category = Category.COST_OPTIMIZATION
    requires = ["prewarm"]

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        responses = ctx.cache["responses"]
        findings = []

        # Detectar imágenes mal optimizadas
        oversized = []
        for resp in responses:
            if not is_image(resp["url"]):
                continue
            size_kb = int(resp["headers"].get("content-length", 0)) / 1024
            if size_kb > 500:
                oversized.append({"url": resp["url"], "size_kb": size_kb})

        total_excess_kb = sum(max(0, img["size_kb"] - 100) for img in oversized)

        if oversized:
            # Estimación de ahorro
            # Asumimos N visitas/mes (lo configura el cliente o lo estimamos por SimilarWeb)
            visits_per_month = ctx.config.get("estimated_visits_month", 10_000)
            excess_bytes_per_visit = total_excess_kb * 1024
            total_excess_gb_month = (
                excess_bytes_per_visit * visits_per_month / (1024**3)
            )

            # GCP egress ~$0.12/GB → 0.11€/GB conservador
            estimated_eur_month = round(total_excess_gb_month * 0.11, 2)

            findings.append(Finding(
                probe_key=self.key,
                category=Category.COST_OPTIMIZATION,
                severity=Severity.MEDIUM,
                title=f"{len(oversized)} imágenes sin optimizar",
                description=(
                    f"Detectadas {len(oversized)} imágenes >500KB. "
                    f"Optimizando a WebP/AVIF y redimensionando, "
                    f"se ahorrarían ~{total_excess_kb:.0f}KB por carga."
                ),
                evidence={
                    "oversized_images": oversized[:20],
                    "total_excess_kb": total_excess_kb,
                    "assumed_visits_month": visits_per_month,
                },
                impact_eur_monthly=estimated_eur_month,
                impact_confidence="medium",
                fix_effort=FixEffort.SMALL,
            ))

        return ProbeOutput(
            raw_data={"oversized_count": len(oversized)},
            findings=findings,
            status=Status.SUCCESS,
        )
```

### 8.5 Detección de API loops / duplicados

```python
class ApiLoopsProbe(ProbeBase):
    key = "api_loops"
    category = Category.PERFORMANCE
    requires = ["prewarm"]

    async def run(self, ctx: AuditContext) -> ProbeOutput:
        requests = ctx.cache["requests"]
        findings = []

        # Agrupar por URL (normalizada, ignorando query params timestamp-like)
        from collections import Counter
        url_counts = Counter(normalize_url(r["url"]) for r in requests
                             if r["type"] in ("xhr", "fetch"))

        duplicates = {url: count for url, count in url_counts.items() if count > 1}

        if duplicates:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.PERFORMANCE,
                severity=Severity.MEDIUM,
                title=f"{len(duplicates)} llamadas API duplicadas por carga",
                description=(
                    "Mismas APIs llamadas múltiples veces en una sola vista. "
                    "Indica falta de cache cliente (React Query, SWR) o de batching."
                ),
                evidence={"duplicates": duplicates},
                fix_effort=FixEffort.SMALL,
            ))

        # Detectar polling: requests al mismo endpoint con intervalo regular
        polling = detect_polling(requests)
        if polling:
            findings.append(Finding(
                probe_key=self.key,
                category=Category.PERFORMANCE,
                severity=Severity.HIGH,
                title="Polling agresivo detectado",
                description=(
                    f"Endpoint {polling['url']} consultado cada "
                    f"~{polling['interval_s']}s. Considerar WebSockets o SSE."
                ),
                evidence=polling,
                impact_eur_monthly=estimate_polling_cost(polling, ctx),
                impact_confidence="medium",
            ))

        return ProbeOutput(
            raw_data={"duplicates_count": len(duplicates)},
            findings=findings,
            status=Status.SUCCESS,
        )
```

### 8.6 Scoring y priorización

```python
# apps/worker/tasks/scoring.py

SEVERITY_WEIGHTS = {
    Severity.CRITICAL: 10,
    Severity.HIGH: 7,
    Severity.MEDIUM: 4,
    Severity.LOW: 2,
    Severity.INFO: 0,
}

CATEGORY_WEIGHTS_BY_INDUSTRY = {
    "ecommerce": {
        Category.PERFORMANCE: 1.5,
        Category.PRIVACY: 1.3,
        Category.SECURITY: 1.2,
    },
    "fintech": {
        Category.SECURITY: 2.0,
        Category.PRIVACY: 1.5,
    },
    "media": {
        Category.PERFORMANCE: 1.7,
        Category.SEO: 1.5,
    },
}

def score_findings(findings: list[Finding], ctx: AuditContext) -> list[Finding]:
    """
    Ordena y prioriza findings. Calcula también un overall score 0-100.
    """
    industry = ctx.config.get("industry", "default")
    cat_weights = CATEGORY_WEIGHTS_BY_INDUSTRY.get(industry, {})

    for f in findings:
        base = SEVERITY_WEIGHTS[f.severity]
        cat_mult = cat_weights.get(f.category, 1.0)
        impact_mult = 1.0 + (f.impact_eur_monthly or 0) / 1000  # cap razonable

        f.priority_score = base * cat_mult * impact_mult

    findings.sort(key=lambda f: f.priority_score, reverse=True)
    return findings

def compute_overall_scores(findings: list[Finding]) -> dict:
    """
    Score 0-100 por categoría y global.
    100 = sin findings; cada finding resta según severidad.
    """
    deductions = {cat: 0 for cat in Category}
    for f in findings:
        deductions[f.category] += SEVERITY_WEIGHTS[f.severity]

    breakdown = {cat: max(0, 100 - d * 2) for cat, d in deductions.items()}
    overall = round(sum(breakdown.values()) / len(breakdown))
    return {"overall": overall, "breakdown": breakdown}
```

---

## 9. Generación del reporte

### 9.1 Estructura del PDF (10-15 páginas)

```
1. Portada
   - Logo Random Lab
   - Cliente, dominio, fecha
   - Score global (visualización tipo gauge)

2. Executive Summary (1 página, CRÍTICO)
   - 3-5 hallazgos top con impacto en € o métrica clara
   - Score global por categoría (radar chart)
   - Veredicto en 1 párrafo

3. Security Health
   - Headers, TLS, email auth, exposición pública
   - 1 gráfico de comparativa con "media del sector"

4. Performance & Cost Optimization (el que más vende)
   - Core Web Vitals con benchmark
   - Asset audit con € estimados
   - API patterns
   - Recomendaciones priorizadas

5. SEO & Visibility
   - Score Lighthouse SEO
   - Issues técnicos
   - Oportunidades

6. Accessibility & Legal Compliance
   - WCAG violations
   - Recordatorio EAA (multas)
   - RGPD/LSSI status

7. Recommendations matrix
   - Tabla impacto vs esfuerzo
   - Top 10 acciones priorizadas

8. Apéndice técnico
   - Todos los findings con evidencia
   - Referencias y CWEs

9. Sobre Random Lab + CTA
   - Cómo te ayudamos a resolver esto
   - Contacto + propuesta de Audit Express completo
```

### 9.2 Pseudocódigo del generador

```python
# reporting/generator.py

class ReportGenerator:
    def __init__(self, run: AuditRun, findings: list[Finding]):
        self.run = run
        self.findings = findings
        self.scores = compute_overall_scores(findings)

    async def generate(self) -> Report:
        # 1. Calcular agregados
        top_findings = self.findings[:5]  # ya están priorizados
        total_eur_impact = sum(
            f.impact_eur_monthly or 0 for f in self.findings
        )

        # 2. Generar charts (matplotlib → PNG → base64)
        charts = {
            "score_radar": render_radar(self.scores["breakdown"]),
            "vitals_bench": render_vitals_benchmark(self.findings),
            "impact_matrix": render_impact_effort_matrix(self.findings),
        }

        # 3. Render HTML por sección con Jinja
        html = jinja_env.get_template("base.html").render(
            run=self.run,
            findings=self.findings,
            top_findings=top_findings,
            scores=self.scores,
            total_eur_impact=total_eur_impact,
            charts=charts,
            findings_by_category=group_by_category(self.findings),
        )

        # 4. HTML → PDF
        pdf_bytes = HTML(string=html).write_pdf()

        # 5. Upload a GCS
        gcs_path = f"reports/{self.run.client_id}/{self.run.id}.pdf"
        upload_to_gcs(pdf_bytes, gcs_path)

        # 6. Generar executive markdown para mail
        executive_md = render_executive_summary_md(
            self.run, top_findings, total_eur_impact, self.scores
        )

        return Report(
            run_id=self.run.id,
            pdf_gcs_path=gcs_path,
            executive_md=executive_md,
            overall_score=self.scores["overall"],
            score_breakdown=self.scores["breakdown"],
        )
```

---

## 10. API Endpoints

```
POST   /api/v1/clients                 Crear cliente/prospect
GET    /api/v1/clients                 Listar con filtros
GET    /api/v1/clients/{id}            Detalle + historial de runs

POST   /api/v1/audits                  Lanzar audit
       body: { client_id, root_url, sku, config }
GET    /api/v1/audits                  Listar runs (paginado)
GET    /api/v1/audits/{id}             Estado + findings + report URL
POST   /api/v1/audits/{id}/cancel      Cancelar in-progress

GET    /api/v1/findings                Query findings cross-runs (filtros)
GET    /api/v1/findings/{id}           Detalle individual

GET    /api/v1/reports/{run_id}/pdf    Signed URL del PDF (10min TTL)
GET    /api/v1/reports/{run_id}/md     Executive summary en MD

POST   /api/v1/webhooks/audit-completed  (interno, lo dispara el worker)

# Admin
GET    /api/v1/probes                  Catálogo de probes disponibles
PATCH  /api/v1/probes/{key}            Enable/disable, cambiar config default
```

---

## 11. Roadmap de implementación

### Sprint 0 — Setup (2 días)

- [ ] Repo + estructura de carpetas
- [ ] Docker Compose: Postgres, Redis, API, Worker
- [ ] Alembic + schema inicial
- [ ] FastAPI skeleton con health endpoint
- [ ] RQ worker skeleton con dummy task
- [ ] CI básico en self-hosted runner

### Sprint 1 — Núcleo + probes baratos (3-4 días)

- [ ] `ProbeBase`, `AuditContext`, `ProbeOutput` abstractos
- [ ] `AuditOrchestrator` end-to-end con 1 probe dummy
- [ ] Probe: `security_headers`
- [ ] Probe: `tls` (vía SSL Labs API con caching)
- [ ] Probe: `email_auth` (SPF/DKIM/DMARC)
- [ ] Probe: `ct_logs`
- [ ] Probe: `info_disclosure`
- [ ] CLI: `python -m scripts.run_audit_cli <domain>`
- [ ] **Hito: corre audit security básico desde terminal**

### Sprint 2 — Browser probes + performance (4-5 días)

- [ ] Pre-warming con Playwright (compartir page entre probes)
- [ ] Probe: `pagespeed` (PSI API)
- [ ] Probe: `lighthouse_full` (Node CLI en subprocess)
- [ ] Probe: `network_analysis` (CDP)
- [ ] Probe: `assets_audit` con cálculo de € ahorrables
- [ ] Probe: `api_loops`
- [ ] Probe: `caching`
- [ ] Probe: `compression`
- [ ] **Hito: findings con `impact_eur_monthly` poblado**

### Sprint 3 — SEO + a11y + privacy (3-4 días)

- [ ] Probe: `meta_tags`, `structured_data`, `sitemap_robots`
- [ ] Probe: `axe_core` (Playwright + axe inject)
- [ ] Probe: `cookies_before_consent` (clave para venta legal)
- [ ] Probe: `cookie_banner_compliance`
- [ ] Probe: `privacy_policy`, `legal_notice`
- [ ] Probe: `stack_detection` (Wappalyzer)
- [ ] Probe: `breaches` (HIBP) — opcional fase 1
- [ ] **Hito: catálogo completo de Capa 1**

### Sprint 4 — Scoring + Reporting (3-4 días)

- [ ] Sistema de scoring (severity × category × impact)
- [ ] Cálculo de overall score por categoría
- [ ] Templates Jinja por sección
- [ ] Charts con matplotlib (radar, benchmarks, matriz impacto/esfuerzo)
- [ ] WeasyPrint pipeline HTML → PDF
- [ ] Upload a GCS + signed URLs
- [ ] Executive summary MD generation
- [ ] **Hito: PDF descargable end-to-end**

### Sprint 5 — Panel Vue (3-4 días)

- [ ] Layout + auth básica
- [ ] Pantalla "lanzar audit" (form + estado en vivo)
- [ ] Listado de runs con filtros
- [ ] Detalle de run: findings agrupados, gráficos, link al PDF
- [ ] Vista de cliente con histórico
- [ ] **Hito: poder operar todo desde UI**

### Sprint 6 — Integración Planning Prospección + lead magnet (2-3 días)

- [ ] Endpoint para que Planning Prospección dispare audits automáticos
- [ ] Landing pública `randomlab.tld/health-check`
  - Form: dominio + email
  - Backend lanza audit `health_check` (subset reducido)
  - Email con PDF cuando termina
- [ ] Captcha + rate limiting (no querés ser usado para escanear a terceros)
- [ ] **Hito: lead magnet live**

### Sprint 7 — Pulido y primer cliente (rolling)

- [ ] Comparativas de sector (después de 10+ audits acumulados)
- [ ] Mejoras a las estimaciones de € (afinar coeficientes con datos reales)
- [ ] Tests sobre sitios fixture controlados
- [ ] Documentación de venta interna (cómo presentar el informe a un prospect)

---

## 12. Métricas de éxito por sprint

| Sprint | Métrica de éxito |
|---|---|
| 1 | Audit completo en <30s para Capa 1 básica |
| 2 | ≥3 findings con `impact_eur_monthly` poblado en sitio de prueba |
| 3 | Catálogo de 20+ probes funcionando |
| 4 | PDF generado con calidad presentable a cliente real |
| 5 | Pedro puede operar audit completo sin tocar terminal |
| 6 | Primer lead magnet completado por usuario externo |
| 7 | Primer Audit Express vendido y entregado |

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Rate limits de APIs externas** (PSI, SSL Labs) | Caching agresivo (24h por dominio), reintentos exponenciales, fallback a probes locales |
| **Sitios que detectan headless y bloquean** | Playwright con stealth, user agents reales, viewports comunes. Si bloquea, probe falla gracefully, no rompe el run |
| **Sitios protegidos por Cloudflare/captcha** | Reportarlo como finding propio ("sitio detrás de challenge"), no insistir |
| **Cálculos de € desacreditados por el cliente** | Marcar `impact_confidence` honesto. Mejor 1 finding con cálculo defendible que 10 con números inventados |
| **Que un prospect interprete el outreach como amenaza** | Framing siempre como "health check / valor agregado", nunca "encontramos vulnerabilidades". Capa 1 estricta. |
| **Falsos positivos** | Cada probe tiene tests sobre sitios fixture conocidos. Revisión manual de los primeros 10 informes antes de automatizar entrega |
| **Costos de infra** | Workers en VM única al principio, scale-out solo cuando haya pipeline. PSI/SSL Labs son free. HIBP es opcional ($4/mes) |
| **Dependencia de Playwright/Chromium** | Imagen Docker pinneada. Job de health-check diario para detectar cambios |

---

## 14. Fase 2 (post-MVP)

Cuando el v1 esté en producción y haya 5+ clientes activos:

- **Diff entre runs** — "vs hace 30 días, mejoraste X, empeoraste Y"
- **Comparativas de sector** — usando embeddings (pgvector) para agrupar empresas similares y ofrecer benchmarks privados
- **Continuous Security SKU** — scheduler de runs semanales, alertas por email/Slack cuando aparece finding crítico
- **Capa 2 integrada** — Nuclei + ZAP orquestados desde el mismo worker, con check de "contrato vigente" antes de ejecutar
- **API pública** para clientes enterprise (self-service)
- **Webhook a Jira/Linear** para que findings críticos abran tickets directos
- **Multi-página crawler limitado** — actualmente todo se hace sobre root_url; expandir a top-N páginas con prioridad
- **Mobile native audit** — para apps Android/iOS con MobSF (esto es naturalmente Capa 2, requiere binarios del cliente)

---

## 15. Decisiones abiertas (resolver antes de empezar)

1. **¿Auth en el panel desde v1 o solo en v6?** → propongo HTTP basic en `.env` v1, JWT real cuando lleguen usuarios externos.
2. **¿Workers en Cloud Run o GCE?** → GCE para v1 (Chromium pesa, los timeouts de Cloud Run molestan). Migrar a Cloud Run Jobs en v2.
3. **¿Generar reportes en español, inglés o ambos?** → Español primero (mercado natural). Toggle por cliente en v2.
4. **¿Logo y branding del PDF desde v1?** → Sí, el PDF es la entrega visible. No empezamos a vender sin un PDF decente.
5. **¿Integrar desde el día 1 con Planning Prospección?** → Sí, comparten cliente. Mismo schema de `clients` o foreign reference.

---

## 16. Checklist legal antes de operar

- [ ] Términos de uso del lead magnet publicados (qué hacemos con el dominio que nos pasan)
- [ ] Política de privacidad de randomlab actualizada
- [ ] DPA template para clientes de Audit Express y Pentest
- [ ] Plantilla de carta de autorización para Capa 2 (Pentest)
- [ ] Plantilla de NDA bidireccional
- [ ] Cotización de seguro de RC profesional (Hiscox / AIG / Markel)
- [ ] Aviso explícito en el sitio: "Solo testeamos sitios con autorización"
- [ ] Disclaimer en cada PDF: "Análisis basado en información públicamente observable. No incluye testing intrusivo."

---

**FIN del spec v0.1**

Siguiente paso recomendado: revisar este doc, ajustar lo que no encaje, y arrancar por Sprint 0 + Sprint 1. En ~1 semana de trabajo enfocado tenés el primer audit corriendo end-to-end desde CLI con security headers + TLS + email auth + PSI, suficiente para empezar a iterar y ver findings reales.