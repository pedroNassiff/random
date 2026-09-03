# Random Studio / Random Lab — Contexto del Proyecto

## 🎯 Visión General
Random Studio / Random Lab es una plataforma de biocomputación (procesamiento EEG), analítica y CRM nativo en IA (Leadro-equivalent).
- **ID de Proyecto GCP:** `random-507414`
- **Frontend:** SPA en React + Vite alojado en **Vercel CDN Edge**.
- **Backend:** Microservicio FastAPI (`brain-prototype` — incluye procesamiento EEG, analítica y el motor de prospección B2B/CRM) desplegado en **GCP Cloud Run** (Serverless, scale-to-zero). (*`sanji-rx` excluido del despliegue cloud por ahora*).
- **Gobernanza & Infraestructura:** Basado en el **Google Cloud Well-Architected Framework (WAF)**, **Landing Zone Lite** e **IaC con Terraform**.
- **Principios FinOps:** Frugalidad extrema, maximización de GCP Always Free Tier (costo $0 inactivo).

## 📚 Estructura de Documentación & Gobernanza
- [docs/00-landing-zone-spec.md](file:///Users/pedronassiff/Desktop/proyectos/random/docs/00-landing-zone-spec.md): Especificación principal de Landing Zone Lite, IAM y FinOps.
- [docs/01-architecture-overview.md](file:///Users/pedronassiff/Desktop/proyectos/random/docs/01-architecture-overview.md): Visión general de arquitectura y flujos Vercel ↔ GCP.
- [docs/02-services/](file:///Users/pedronassiff/Desktop/proyectos/random/docs/02-services/): Documentación individual de microservicios, bases de datos y almacenamiento.
- [docs/03-iam-model.md](file:///Users/pedronassiff/Desktop/proyectos/random/docs/03-iam-model.md): Modelo IAM de mínimo privilegio y service accounts.
- [docs/04-network-model.md](file:///Users/pedronassiff/Desktop/proyectos/random/docs/04-network-model.md): Modelo de red, CORS e integración HTTPS/WSS.
- [docs/05-decisions/](file:///Users/pedronassiff/Desktop/proyectos/random/docs/05-decisions/): Architecture Decision Records (ADRs).

## 🤖 Subagentes de Claude Code (.claude/agents/)
- `pri-infra`: Gestión de Terraform e infraestructura en GCP.
- `pri-docs`: Mantenimiento de documentación y redacción de ADRs.
- `pri-arch`: Validación de WAF, diagramas y arquitectura.

---

# Quality Gates — Random Lab ("The Gauntlet")

> Filosofía (Uncle Bob, jul 2026): el código del agente no se revisa línea por línea.
> Se lo rodea de restricciones extremas. Si pasa la muralla completa, hay confianza
> alta en su correctitud. Rol humano: **arquitecto de calidad**, no revisor de código.
>
> Regla de oro: un gate que no bloquea el merge NO es un guardrail, es una sugerencia.

---

## Contrato de trabajo del agente

Antes de generar código, el agente DEBE:

1. Trabajar contra una **especificación formal** (Gherkin / criterios de aceptación),
   nunca contra notas informales. Spec ambigua → pedir aclaración, NO adivinar.
2. Escribir los tests ANTES o junto al código de producción.
3. Identificar a qué **track** pertenece el cambio y correr la muralla de ESE track.
4. No marcar la tarea como completa hasta que la gauntlet del track pase en verde.

Los agentes `pri-*` reciben solo la especificación formal que produce el orquestador,
no el contexto difuso de la conversación. (Aislamiento de contexto = guardrail.)

---

## TRACK 1 — Python (FastAPI, EEG Signal Processing, AI CRM Engine)

Core de biocomputación y prospección B2B. Umbrales más altos.

| # | Gate | Herramienta | Bloquea merge si |
|---|------|-------------|------------------|
| 1 | Formato | `ruff format --check` | hay diffs |
| 2 | Lint | `ruff check` | cualquier error |
| 3 | Tipos | `mypy --strict` | cualquier error |
| 4 | Unit tests | `pytest` | algún test falla |
| 5 | Cobertura | `pytest --cov` | < 90% (lógica de procesamiento/scoring: 95%) |
| 6 | Complejidad | `ruff` (C901) | ciclomática > 10 |
| 7 | Tamaño módulo | check custom | archivo > 400 líneas |
| 8 | Dependencias | `import-linter` | viola contrato de capas |
| 9 | Mutation | `mutmut` | mutation score < 80% |
| 10 | Seguridad | `bandit` + `pip-audit` | vuln HIGH/CRITICAL |

Contrato de capas (`import-linter`):
- `domain` (señales EEG / reglas de scoring) no importa de `application` ni `infrastructure`.
- `application` (use cases, orquestación LLM) no importa de `infrastructure`.
- Solo `infrastructure` toca PostgreSQL, Secret Manager, Anthropic SDK, Cloud Run, SMTP.

---

## TRACK 2 — JS / React (Frontend Vercel & WebGL Signal Viz)

| Gate | Herramienta | Bloquea si |
|------|-------------|-----------|
| Formato | `prettier --check` | diffs |
| Lint | `eslint` | errores |
| Tipos | `tsc --noEmit` | errores |
| Unit tests | `vitest` | falla |
| Cobertura (lógica) | `vitest --coverage` | < 80% |
| Regresión visual / WebGL | Playwright + screenshot diff | diff > umbral en canvas |

---

## TRACK 3 — Calidad de IA & Modelos (Scoring de Leads + Filtros EEG)

CRÍTICO. Que el código pase unit tests no garantiza que el scoring de leads o los filtros FFT de EEG recuperen buenos resultados.

| # | Gate | Cómo | Bloquea merge si |
|---|------|------|------------------|
| 1 | Lead Scoring Precision | Evaluation set contra golden set (`tests/golden_set_leads.json`) | precision@5 baja del baseline (90%) |
| 2 | Prompt JSON Schema | Validación estricta con Pydantic / JSON Schema | cualquier respuesta malformada de Claude |
| 3 | EEG Signal Processing SNR | Test sintético con señales EEG de prueba | SNR < 15 dB post-filtrado bandpass |
| 4 | Pitch Translation Quality | BLEU / Cosine similarity sobre embeddings traducidos | similitud semántica < 0.85 |

---

## TRACK 4 — IaC & GCP Infrastructure (Terraform & Landing Zone Lite)

| # | Gate | Herramienta | Bloquea merge si |
|---|------|-------------|------------------|
| 1 | Formato IaC | `terraform fmt -check` | hay diffs en archivos `.tf` |
| 2 | Validación Sintaxis | `terraform validate` | cualquier error sintáctico |
| 3 | Linter de Buenas Prácticas | `tflint` | advertencias o errores de configuración |
| 4 | Auditar Seguridad GCP | `tfsec` / `checkov` | violaciones a CIS Benchmarks GCP |
| 5 | Mínimo Privilegio IAM | Check custom de Service Accounts | presencia de `roles/editor` o `roles/owner` |

---

## Comandos locales (pre-push, por track)

```bash
# TRACK 1 — Python
ruff format --check . && ruff check . && mypy --strict backend/ && \
pytest --cov=backend --cov-fail-under=90 && bandit -r backend/ && pip-audit

# TRACK 2 — JS/React
prettier --check . && eslint . && tsc --noEmit && vitest run --coverage

# TRACK 3 — Eval de IA & Signals
python -m evals.lead_scoring --golden tests/golden_set_leads.json

# TRACK 4 — IaC & Terraform
cd infra/ && terraform fmt -check && terraform validate && tflint && tfsec .
```
