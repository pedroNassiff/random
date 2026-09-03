# Servicio: Brain Prototype (FastAPI Backend)

## 1. Qué es
Microservicio principal en Python (FastAPI + PyTorch) responsable del procesamiento de señales biológicas/EEG, cálculo de coherencia sintérgica, ingestion de analítica del portfolio y streaming de estado vía WebSockets.

## 2. Por qué lo usamos
PyTorch y NumPy permiten ejecutar algoritmos matemáticos y procesamiento de señales en tiempo real con alta performance. FastAPI provee soporte nativo para asincronía (`async/await`), validación con Pydantic y WebSockets livianos.

## 3. Cómo se conecta
- **Entrante:** HTTPS / WSS desde el Frontend en Vercel.
- **Saliente:** Conexión async (vía `asyncpg` / `SQLAlchemy`) a PostgreSQL (`syntergic_brain` y `random_analytics`), lectura de secretos en Secret Manager y almacenamiento de artefactos en Cloud Storage.

## 4. Identidad y Permisos (IAM)
- **Service Account:** `sa-random-backend-runner@random-lab-prod.iam.gserviceaccount.com`
- **Roles asignados:**
  - `roles/cloudsql.client`
  - `roles/secretmanager.secretAccessor` (restringido a secretos de aplicación)
  - `roles/storage.objectViewer` (bucket `random-lab-assets-prod`)

## 5. Configuración & Secretos
- Secretos consumidos desde Secret Manager:
  - `random-database-url` → Inyectado en `DATABASE_URL`
  - `random-openai-api-key` → Inyectado en `OPENAI_API_KEY` (opcional)
- Variables de entorno en Cloud Run:
  - `CORS_ORIGINS`: Dominio del frontend en Vercel (`https://random-studio.io`)
  - `PORT`: `8000`

## 6. Comportamiento ante fallos & Observabilidad
- **Health Check:** `GET /analytics/health` o `GET /health` responde `200 OK`.
- **Logs:** Transmitidos automáticamente a GCP Cloud Logging (stdout/stderr).

## 7. Estrategia FinOps & Costo Estimado
- **Escalado:** `min-instances = 0`, `max-instances = 3`, `concurrency = 80`.
- **Encuadre Free Tier:** Encaja 100% dentro de las 2.000.000 invocaciones libres de GCP Cloud Run. Costo estimado: **$0.00 / mes**.
