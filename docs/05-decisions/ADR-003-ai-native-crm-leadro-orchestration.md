# ADR-003: Arquitectura del Motor CRM AI-Native (Leadro-Equivalent) y Orquestación LLM

## Estatus
Aprobado

## Contexto
El motor de prospección B2B de Random Lab requiere orquestar procesos de generación de prospectos, scraping web, evaluación de fit basada en LLMs (Claude Sonnet), scoring parametrizado (0-100), pipeline Kanban de conversión y seguimiento de email con tracking de aperturas en tiempo real.

## Decisión
1. Desarrollar el CRM sobre FastAPI (`prospecting_router`, `prospecting_analysis`, `prospecting_groups`, `prospecting_pitch`) desacoplado en microservicios dentro del contenedor `brain-prototype`.
2. Utilizar salidas estructuradas en formato JSON estricto mediante Pydantic y prompts validados para la integración con Anthropic Claude API / OpenAI API.
3. Almacenar la información relacional de contactos y logs de envío en PostgreSQL (`contacts`, `pitch_logs`) e inyectar pixels de tracking transparentes GIF 1x1 para auditoría de aperturas.
4. Implementar un feature flag `AUTO_APPROVE_SCORE_THRESHOLD` (default: 80) para equilibrar la auto-aprobación de prospectos frente a la revisión humana.

## Consecuencias
- **Positivas:**
  - Alineación 1:1 con la arquitectura del CRM propio **Leadro** de Biorce.
  - Trazabilidad completa desde la captura del lead hasta la conversión.
  - Flexibilidad para cambiar o ajustar modelos LLM sin modificar la interfaz de usuario en Vercel.
- **Negativas:**
  - Dependencia de la latencia y disponibilidad de la API de Anthropic/OpenAI durante el paso de análisis de leads.
