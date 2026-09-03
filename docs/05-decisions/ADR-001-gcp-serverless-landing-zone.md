# ADR-001: Adopción de GCP Serverless & Landing Zone Lite con Estrategia FinOps

## Estatus
Aprobado

## Contexto
El backend del proyecto Random Lab (procesamiento de EEG y analítica) estaba diseñado originalmente para correr en un servidor VPS tradicional (Droplet en DigitalOcean, $12–$24/mes) con PostgreSQL e InfluxDB locales. Dado que el tráfico es variable y la prioridad es la máxima eficiencia de costos y mantenibilidad operacional, mantener un servidor encendido 24/7 resulta ineficiente e inasumible en términos de FinOps.

## Decisión
1. Migrar la infraestructura del backend a **GCP Cloud Run (Serverless)** con configuración `min-instances = 0` (scale to zero), garantizando costo $0 cuando no hay solicitudes.
2. Desplegar una **Landing Zone Lite** en GCP aplicando los principios del Well-Architected Framework (WAF) y CIS Benchmarks.
3. Mantener el frontend alojado en **Vercel CDN Edge**, desacoplado de la infraestructura de backend.
4. Gestionar secretos centralizadamente con **GCP Secret Manager** inyectados nativamente en runtime.
5. Gestionar la base de datos PostgreSQL utilizando soluciones frugales/serverless (Free Tier) o Cloud SQL optimizado.

## Consecuencias
- **Positivas:**
  - Reducción del costo fijo de infraestructura de ~$24/mes a **$0.00 - $7.00/mes**.
  - Eliminación del mantenimiento del sistema operativo del VPS (parches de seguridad, Nginx, systemd manual).
  - Escalabilidad horizontal automática en Cloud Run.
  - Trazabilidad y gobernanza enterprise mediante IaC (Terraform) e IAM de mínimo privilegio.
- **Negativas / Desafíos:**
  - Posible latencia de "Cold Start" (~1–2 segundos) en la primera llamada a Cloud Run cuando las instancias están en 0. Aceptable para la naturaleza del proyecto.
