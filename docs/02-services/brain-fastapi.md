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
  - `REPLAY_BUNDLE_URI`: `gs://random-507414-assets/replay` (bundle de replay, ver sección 8)
  - `PORT`: `8000`

## 6. Comportamiento ante fallos & Observabilidad
- **Health Check:** `GET /analytics/health` o `GET /health` responde `200 OK`.
- **Logs:** Transmitidos automáticamente a GCP Cloud Logging (stdout/stderr).

## 7. Estrategia FinOps & Costo Estimado
- **Escalado:** `min-instances = 0`, `max-instances = 3`, `concurrency = 80`.
- **Encuadre Free Tier:** Encaja 100% dentro de las 2.000.000 invocaciones libres de GCP Cloud Run. Costo estimado: **$0.00 / mes**.

## 8. Modo Cloud: replay del cerebro y `/lab/brain/doc`
La imagen de Cloud Run **no** incluye `torch`/`mne`/`scipy` (`requirements-cloud.txt`), por lo que `HARDWARE_AVAILABLE=False` y no existe `SyntergicBrain`. En su lugar `main.py` arranca `replay.ReplayBrain`, que expone la misma interfaz (`next_state`, `set_mode`, playlist, `session_player`) sobre estados EEG **precomputados** en local.

| Entorno | `brain` | `/doc/*`, `/sessions/{id}/metrics` |
|---|---|---|
| Local (stack completo) | `SyntergicBrain` (sin cambios) | Postgres + Influx (sin cambios) |
| Cloud Run | `ReplayBrain` (bundle en GCS) | Snapshots JSON del bundle |
| Cloud Run sin bundle válido | `ReplayBrain` sobre generador sintético | Error controlado |

**Bundle** (`gs://<assets>/replay/`): `manifest.json`, `frames/<id>.json.gz` (5 Hz, columnar), `doc/dashboard.json`, `doc/session/<id>.json`, `sessions/<id>/metrics.json`. Incluye los datasets PhysioNet (relax/focus), la meditación y las sesiones grabadas.

**Publicar/actualizar** (solo lectura sobre las BBDD locales; backend local levantado):
```bash
cd teoria-sintergica/brain-prototype/backend
python scripts/export_replay_bundle.py --out replay_bundle   # frames + snapshots /doc
DRY_RUN=1 ./scripts/upload_replay_bundle.sh replay_bundle    # revisar
./scripts/upload_replay_bundle.sh replay_bundle              # rsync al bucket
```
No requiere rebuild de imagen. Los snapshots de `/doc` se refrescan cada 5 min; el `manifest` y los frames del cerebro se cachean por vida de la instancia, así que una sesión nueva aparece en `/playlist` cuando la instancia se recicla (scale-to-zero) o tras un nuevo deploy de revisión.

**Limitaciones:** no hay Muse en vivo ni inferencia nueva en la nube (`/set-mode/muse` responde error); las sesiones nuevas aparecen al republicar el bundle.

