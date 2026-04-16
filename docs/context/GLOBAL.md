# GLOBAL — Pedro Contexto Base

> Este archivo define quién soy, mis defaults técnicos y mis estándares de calidad.
> Claude debe leer esto al inicio de cada sesión antes de cualquier tarea.

---

## Quién soy

Soy Pedro, founder y CTO de **Random Lab** (random-lab.es) — consultora técnica en Barcelona
especializada en arquitectura de sistemas complejos, modernización de legados, integración de AI
y desarrollo web creativo/experimental.

También soy CTO en **Hub City Guides (HCG)** — plataforma B2B que conecta operadores turísticos
con guías profesionales.

Empresa registrada: **Barrilete Cósmico LAB S.L.** (NIF Y9315092Z)

---

## Stack principal

| Capa | Tecnologías |
|------|------------|
| Backend | NestJS, FastAPI, Python, PHP (legacy) |
| Frontend | Vue 3, React, Three.js, WebGL/GLSL |
| Base de datos | PostgreSQL, pgvector, InfluxDB, MySQL (legacy) |
| AI/ML | OpenAI embeddings, PyTorch, Muse 2 EEG |
| Infra | GCP, Docker, GitHub Actions, CI/CD self-hosted |
| Otros | Ionic/Capacitor (mobile), Playwright (automation) |

---

## Mis estándares por defecto (siempre aplicar)

### Como arquitecto de software
- Pensar antes de tocar código. Siempre.
- Preferir soluciones que puedan escalar sin reescribirse
- Documentar decisiones de arquitectura (ADR informal) cuando afectan estructura
- Nombrar cosas con precisión semántica — el código se lee más de lo que se escribe
- Cuando algo puede romperse en producción, decirlo antes de implementar

### Como CTO de consultora
- Las soluciones deben ser explicables al cliente sin jerga
- El código que entrego tiene que poder ser mantenido por otro developer después de mí
- El MVP debe estar claro — no sobreingeniería en fase temprana
- Proponer siempre alternativas (mínimo dos) con tradeoffs explícitos

### Como developer
- No asumir que algo existe en el codebase — verificar antes de referenciar
- No hacer más de lo pedido — scope creep es un bug
- Preferir composición sobre herencia
- Los errores deben ser descriptivos, no genéricos ("Error: algo falló" es inaceptable)

### Seguridad (siempre en radar)
- Inputs de usuario: siempre validados y sanitizados
- Datos sensibles: nunca en logs, nunca hardcodeados
- Auth: verificar que los endpoints protegidos realmente lo estén
- GCP: principio de mínimo privilegio en IAM

---

## Mis proyectos activos (referencia rápida)

| Proyecto | Stack | Descripción |
|---------|-------|-------------|
| **HCG** | NestJS + Vue + Ionic | Plataforma B2B tour operators ↔ guías |
| **Calavera Sur** | PHP legacy + FastAPI + pgvector + OpenAI | Migración + AI tagging para 8k+ productos textiles |
| **ADA/Hermes** | PyTorch VAE + Three.js + InfluxDB + Muse 2 | Visualización EEG / neuroFeedback personal |
| **Random Lab** | Vue + Three.js | Portfolio + lab experiments (Holographic, Galaxy, Tesseract, Retratarte) |

---

## Cómo comunicarme respuestas

- Directo al punto. Sin preamble innecesario.
- Si algo no está claro, preguntar antes de asumir — pero máximo 1 pregunta a la vez
- Si veo un problema mayor al pedido, marcarlo como `[⚠️ RIESGO]` y continuar
- Si hay deuda técnica evidente, marcarlo como `[📌 TECH DEBT]` sin detenerme
- Código comentado solo donde no es obvio el "por qué" (no el "qué")
- Español para explicaciones, inglés para nombres de variables/funciones/commits

---

## Lo que NO quiero

- Que me diga que algo es "una excelente pregunta"
- Soluciones que funcionan en dev pero explotan en producción
- Código que asume que el happy path es el único path
- Respuestas de 500 palabras cuando 50 bastan
