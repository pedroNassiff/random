# Servicio: Base de Datos PostgreSQL (Brain & Analytics)

## 1. Qué es
Instancia relacional PostgreSQL 15+ encargada de almacenar las métricas de sesiones EEG (`syntergic_brain`) y la telemetría de eventos/visitas del portfolio (`random_analytics`).

## 2. Por qué lo usamos
PostgreSQL garantiza consistencia ACID, consultas eficientes de series temporales y compatibilidad directa con `asyncpg` y migraciones SQL declarativas (`001_create_analytics_schema.sql`).

## 3. Cómo se conecta
- **Conexión:** TCP vía SSL / Cloud SQL Auth Proxy / Servidor Postgres Serverless (Neon/Supabase en Free Tier).
- **Consumidores:** Cloud Run Service (`brain-prototype` backend).

## 4. Identidad y Permisos (IAM)
- **Service Account de acceso:** `sa-random-backend-runner` posee el rol `roles/cloudsql.client`.

### Usuario de solo lectura de NEO (`neo_reader`)
- Lo usa el agente fiscal NEO para consultar la base directamente (spec: `docs/sistema-agente-tributario.md/Spec — NEO constructor del dashboard.md`).
- Lo crea la migración `fiscal/migrations/009_neo_reader.sql`, sin contraseña. El runner de migraciones (`--schema fiscal`) le pone la de `NEO_DATABASE_URL`.
- No es un `google_sql_user`, porque Cloud SQL lo haría miembro de `cloudsqlsuperuser`.
- Conexión propia, no `SET ROLE` desde la de la app. Con `SET ROLE`, la consulta podría volver al rol de la app con `set_config('role', session_user, true)`.
- Solo SELECT, transacción READ ONLY y timeout de 5 s. RLS por `owner_id`, con el dueño en `fiscal.neo_sessions`, que solo escribe la app. Sin el NIF del perfil y sin acceso al schema `futbol`.

## 5. Configuración & Secretos
- Secret Manager: `random-database-url` almacena la cadena de conexión formateada:
  `postgresql://analytics_user:PASS@HOST:5432/random_analytics`
- Secret Manager: `random-neo-database-url`: misma base con el usuario `neo_reader`; llega a Cloud Run como `NEO_DATABASE_URL`.

## 6. Comportamiento ante fallos & Observabilidad
- Reconexión automática con pooler `asyncpg` en el backend.
- Backups automáticos diarios.

## 7. Estrategia FinOps & Costo Estimado
- **Opción A (Frugal / Free Tier Absolute):** PostgreSQL Serverless (Neon / Supabase Free Tier) → **$0.00 / mes**.
- **Opción B (Managed Cloud SQL):** Instance `db-f1-micro` (Shared core 0.6 GB RAM) → **~$7.00–$9.00 / mes**.
