# ADR-002: Estrategia FinOps & Maximización del GCP Always Free Tier

## Estatus
Aprobado

## Contexto
El proyecto Random Studio / Random Lab es un laboratorio experimental de biocomputación y prospección B2B. Mantener costos fijos mensuales en servicios cloud sin un flujo de ingresos constante degrada la eficiencia económica del proyecto. GCP ofrece una capa de uso gratuito perpetuo (Always Free Tier) para servicios serverless y storage.

## Decisión
1. **Cloud Run:** Forzar `min-instances = 0` (Scale to zero) en todas las revisiones de servicios, limitando a 1 vCPU y 1024MB de RAM por instancia para encajar dentro del cupo mensual de 2.000.000 de invocaciones, 180.000 vCPU-segundos y 360.000 GiB-segundos.
2. **Cloud Storage (GCS):** Utilizar una sola región (`us-central1`) con límite de almacenamiento proyectado menor a 5 GB.
3. **Secret Manager:** Centralizar hasta 6 versiones de secretos activos para mantener costo de almacenamiento $0.00.
4. **Cloud Build:** Limitar el pipeline de CI/CD a ejecuciones con caché de capas Docker para no superar los 120 minutos diarios gratuitos.

## Consecuencias
- **Positivas:**
  - Costo base mensual de infraestructura GCP de **$0.00 / mes** durante periodos de inactividad o bajo tráfico.
  - Alerta presupuestaria (Budget Alert) configurada a $1.00 USD para detectar cualquier anomalía.
- **Negativas:**
  - Si el volumen de llamadas de WebSockets o scraping intensivo supera los 2M de peticiones/mes, se aplicará facturación bajo demanda por consumo excedente.
