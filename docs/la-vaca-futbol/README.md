# Fútbol Vaquero — Estado y documentación técnica

Armado automático de equipos parejos para el fútbol de los miércoles. Vive dentro de Random:
frontend en el SPA (`/vaca-futbolera`) y backend como módulo del FastAPI `brain-prototype`,
con la BBDD Postgres de Random (schema `futbol`).

- Spec funcional: [spec.md](spec.md)
- Algoritmos (skills, rating, balanceador): [algorithm.md](algorithm.md)
- Diseño visual: [design.md](design.md)
- Diagramas de procesos, vistas, casos de uso e historias de usuario: [flows.md](flows.md)
- Plantilla para cargar el plantel inicial: [players.template.json](players.template.json)

> Última actualización: 2026-09-29. Nada de esto está desplegado en producción todavía
> ni commiteado (rama de trabajo: `feature-templario-hermetico`).

---

## 1. Estado actual

| Milestone | Estado | Notas |
|---|---|---|
| M0 — Setup (auth, layout, `/dev/ui`, gates) | ✅ local | Sin CI todavía: los gates se corren a mano |
| M1 — Jugadores y skills dinámicas | ✅ local | UC-01, UC-02, UC-03 |
| M2 — Partidos e inscripción | ✅ local | UC-04. Cupo configurable (`groups.capacity`, hoy 16). Falta programar el cron en prod |
| M3 — Balanceador v1 | ✅ local | UC-05/06/07/13. Pendiente: drag & drop (hoy "Pasar a…"), radar de skills |
| M4 — Resultados e historial | 🟡 local | UC-08 y pestaña Partidos ✅. Pendiente: importar historial CSV (UC-10), invitados (UC-11) |
| M5 — Rating OpenSkill | ⏳ | |
| M6 — Stats | ⏳ | |
| M7 — Pulido / PWA | ⏳ | |
| Deploy a producción | ❌ | Ver §7 |

**Qué funciona hoy (local):** login con email y contraseña (magic link para el primer acceso y para
recuperar la contraseña), alta y edición de jugadores, alta y edición de
skills (se desactivan, nunca se borran), puntuación anónima 1–10 por skill, vista admin con
puntaje compuesto y raters por skill (con autoevaluación), y la pestaña **Partido**: partido semanal,
cuenta regresiva al cierre, **Voy / Me bajo**, convocados `n/cupo` y lista de espera; el admin agrega y
saca jugadores incluso después del cierre. **Compartir por WhatsApp** manda el texto de la inscripción
(armado en el servidor) con Web Share API o `wa.me`. La **tarjeta de formación** (equipo A · VS · equipo B, con
avatar de vaca) se copia como imagen o se comparte como PNG; hoy se ve con datos de ejemplo en
`/vaca-futbolera/dev/ui` y se conecta a los equipos reales en M3.

---

## 2. Decisiones que difieren de la spec

La spec asume Next.js + Supabase. Se adaptó a la infraestructura de Random:

| Spec | Implementado | Por qué |
|---|---|---|
| Lógica en `src/domain/*.ts` | Python en `backend/futbol/domain/` | Track 1 del gauntlet, backend único en Cloud Run |
| Supabase magic link | Magic link propio en FastAPI | Sin servicios externos (FinOps, Landing Zone) |
| RLS de Postgres | Permisos por rol en la capa de aplicación | Tests de permisos a nivel API (`test_api.py`) |
| App Next.js | Ruta lazy `/vaca-futbolera/*` en el SPA Vite | Mismo dominio y deploy de Vercel |

**Interpretación de ALGORITHMS §1.2:** los "pares" excluyen a los admins. Con ≥ 3 pares se usa su
mediana; si no, la mediana de los admins; si no, **5** ("no sabemos cómo juega", decisión del grupo del
29/09/2026 en lugar de la media del grupo). Así se cumplen a la vez la regla y el test "2 pares + admin → gana el admin".

---

## 3. Login (contraseña + magic link)

Se entra con **email y contraseña**. El magic link se usa solo para el **primer acceso** (crear la
contraseña) y para **"olvidé mi contraseña"**.

**Primer acceso o contraseña olvidada**
1. En `/vaca-futbolera/entrar` → "¿Primera vez o te olvidaste la contraseña?" → email →
   `POST /futbol/auth/request`.
2. El backend genera el link solo si el email es **conocido** (está en `FUTBOL_ADMIN_EMAILS`, es el
   email de un jugador cargado por el admin, o ya tiene usuario). Para cualquier email responde lo
   mismo (202), así no se puede averiguar quién está en el grupo.
3. El link `{FUTBOL_BASE_URL}/vaca-futbolera/entrar?token=…` llega:
   - **en desarrollo** (sin `FUTBOL_SMTP_HOST`): impreso en la terminal del backend, como
     `[futbol] magic link para <email>: http://…`;
   - **en producción**: por email vía SMTP.
4. Al abrirlo (`POST /futbol/auth/verify`, vale **15 min** y se usa **una sola vez**) se abre la
   sesión y la app lleva a **Crear / Cambiar contraseña** (`PUT /futbol/auth/password`, mínimo 8
   caracteres). Sin contraseña creada no se puede usar el resto de la app.

**Accesos siguientes**
- Email + contraseña → `POST /futbol/auth/login`. Si el email no existe o la contraseña está mal,
  el error es el mismo: "Email o contraseña incorrectos."
- La sesión dura **30 días** en la cookie `futbol_session` (httpOnly, SameSite=Lax).
- La contraseña se cambia desde el link **Contraseña** del encabezado.

**Roles**
- Email en `FUTBOL_ADMIN_EMAILS` → admin.
- Resto → member.
- Si el email coincide con el de un jugador, el usuario queda vinculado a ese jugador (necesario
  para puntuar).

**Seguridad**
- Tokens de link y de sesión: solo se guarda su hash SHA-256.
- Contraseñas: hash **scrypt** con salt (stdlib, `futbol/application/passwords.py`) y comparación en
  tiempo constante. Cuando el email no existe, se calcula igual un hash, para que el tiempo de
  respuesta no lo delate.
- ⏳ Pendiente: límite de intentos de login y cerrar las otras sesiones al cambiar la contraseña.
- Si el envío del mail falla, se registra el error con el link en los logs y la respuesta sigue siendo 202.

### Primer ingreso en local

Agregar a `teoria-sintergica/brain-prototype/backend/.env`:

```bash
FUTBOL_ADMIN_EMAILS=tu@email.com        # separados por coma
FUTBOL_COOKIE_SECURE=0                  # obligatorio en http://localhost
FUTBOL_BASE_URL=http://localhost:5173   # a dónde apunta el link
```

Después: reiniciar el backend, entrar a `http://localhost:5173/vaca-futbolera/entrar` → "¿Primera
vez…?", poner el email admin, copiar el link de la terminal del backend y crear la contraseña.

Para que un jugador entre: el admin lo carga en **Jugadores** con su email (o lo edita después, tocando al
jugador); el jugador pide el link con ese mismo email. Mientras tanto, el admin puede anotarlo al partido sin
que tenga cuenta.

---

## 4. Arquitectura

```
Navegador ── /vaca-futbolera/* ──► SPA Vite (Vercel)
    │
    └─ /api/futbol/* ──► proxy (Vite en local / rewrite de Vercel en prod)
                             ──► FastAPI brain-prototype /futbol/* (Cloud Run)
                                     ──► Postgres, schema `futbol`
```

### Backend — `teoria-sintergica/brain-prototype/backend/futbol/`

Capas verificadas con `import-linter` (domain ← application ← infrastructure):

| Capa | Archivos | Qué hace |
|---|---|---|
| `domain/` | `skills.py`, `strength.py`, `balancer.py`, `results.py`, `schedule.py`, `signups.py`, `share.py`, `models.py`, `config.py` | Puro y determinista: skills y compuesto (ALGORITHMS §1), calendario y plan del cron, cupo y lista de espera (spec §3) |
| `application/` | `auth_service.py`, `passwords.py`, `roster_service.py`, `roster_import.py`, `match_service.py`, `teams_service.py`, `results_service.py`, `ports.py`, `errors.py` | Casos de uso y permisos por rol |
| `infrastructure/` | `pg_repository.py`, `pg_matches.py`, `pg_teams.py`, `pg_results.py`, `api.py`, `api_matches.py`, `api_teams.py`, `api_results.py`, `deps.py`, `mailer.py`, `wiring.py` | asyncpg (con `FOR UPDATE` en inscripciones), routers FastAPI, SMTP o consola, composición |
| `migrations/` | `001`…`010` | Schema + seed; contraseñas; puestos POR/DEF/MED/DEL; partidos e inscripciones; apertura configurable; calendario del grupo; propuestas, equipos y restricciones; sin datos = 5; resultados; goles por jugador |

Se enchufa en `main.py` (router `futbol_router` + `app.state.futbol`, que reusa el `db_pool` existente).

### Frontend — `src/vaca-futbolera/`

| Archivo | Qué hace |
|---|---|
| `VacaFutbolera.tsx` | Rutas, layout con `NavTabs`, guardas de sesión y de admin |
| `api.ts`, `auth.tsx`, `useLoad.ts` | Cliente HTTP, contexto de sesión, carga async |
| `pages/` | Login, Contraseña, Home (partido), Jugadores (con edición para admin), Puntuar, Skills, `/dev/ui` |
| `components/` | AppHeader (`.RANDOM(logo)`), Button, NavTabs, SectionHeader, PlayerChip, SkillPicker, Toast, MatchCard, TeamSheet / ShareSheet, CowAvatar |
| `vaca.css` | Tokens de DESIGN §2 con alcance `.vaca` (no filtra al resto del SPA) |

Se carga lazy desde `src/App.jsx` (chunk de unos 15 kB).

### Rutas

| Ruta | Quién |
|---|---|
| `/vaca-futbolera/entrar` | pública |
| `/vaca-futbolera/dev/ui` | pública (catálogo de componentes) |
| `/vaca-futbolera/contrasena` | logueados (obligatoria si todavía no creó contraseña) |
| `/vaca-futbolera` | logueados |
| `/vaca-futbolera/jugadores` | logueados (el admin ve además puntajes y alta) |
| `/vaca-futbolera/jugadores/:id/puntuar` | logueados con jugador vinculado |
| `/vaca-futbolera/partidos` | logueados: partidos jugados con resultado, "Parejo" y quién jugó |
| `/vaca-futbolera/partidos/:id/resultado` | admin: cargar o editar goles y quién jugó |
| `/vaca-futbolera/skills` | admin |
| `/vaca-futbolera/partidos/:id/equipos` | admin: 3 propuestas, mover jugadores, publicar, restricciones |

### API (`/futbol`, vía `/api/futbol` desde el navegador)

| Método y ruta | Permiso | Descripción |
|---|---|---|
| `POST /auth/request` | público | Pide el magic link (siempre 202) |
| `POST /auth/verify` | público | Canjea el token y setea la cookie |
| `POST /auth/login` | público | Email + contraseña, setea la cookie |
| `PUT /auth/password` | sesión | Crea o cambia la contraseña |
| `POST /auth/logout` | sesión | Revoca la sesión |
| `GET /me` | sesión | Email, rol, `player_id` y `has_password` |
| `GET /skills` | sesión | El admin ve también las inactivas |
| `POST /skills` · `PUT /skills/{id}` | admin | La clave no se puede cambiar |
| `GET /players` | sesión | `scoring` solo para admin |
| `POST /players` · `PUT /players/{id}` | admin | |
| `GET /players/{id}/ratings` | sesión | Solo los valores que puso uno mismo |
| `PUT /players/{id}/ratings` | jugador vinculado | Upsert de valores 1–10 |
| `GET /matches/current` | sesión | Partido en curso con convocados, espera y mi estado. Corre el tick antes (no depende del cron) |
| `POST /matches/{id}/signup` | sesión | Anotarse (miembro: solo antes del cierre). Admin: `{player_id}` para anotar a otro, en cualquier momento |
| `POST /matches/{id}/withdraw` | sesión | Bajarse. Después del cierre queda `late_withdrawal` y sube el primero de la espera |
| `POST /cron/tick` | `Authorization: Bearer $FUTBOL_CRON_SECRET` | Idempotente: cierra inscripciones vencidas, crea el próximo partido y genera propuestas de los partidos cerrados |
| `GET /matches/history` | sesión | Partidos jugados (más reciente primero) con resultado, `close` y alineaciones |
| `GET /matches/{id}/result` · `PUT /matches/{id}/result` | admin | Formulario y carga del resultado: pasa a `played` y abre el partido siguiente |
| `GET /matches/{id}/teams` | sesión | Equipos publicados (todos) y propuestas con fuerza (solo admin) + texto de WhatsApp |
| `POST /matches/{id}/teams/generate` | admin | Balanceador: 3 propuestas (ALGORITHMS §3) |
| `POST /matches/{id}/teams/evaluate` | admin | Recalcula diferencia, % y desglose tras mover jugadores |
| `POST /matches/{id}/teams/publish` | admin | Copia a `match_teams` y pasa el partido a `teams_published` |
| `GET/POST /constraints` · `DELETE /constraints/{id}` | admin | Restricciones `apart` / `together` (UC-13) |

Errores: 401 sin sesión, 403 sin permiso, 404 no existe, 422 validación (con `detail` en español).

### Datos (schema `futbol`)

`app_users`, `magic_links`, `auth_sessions`, `groups`, `group_members`, `players`, `skills`,
`skill_ratings`, `matches` (único por `group_id, starts_at`), `signups` y la vista `player_skill_scores`. La vista es un espejo SQL del dominio Python, que
es la fuente de verdad. Un test de integración verifica que coincidan.

---

## 5. Correr en local

```bash
# 1. Postgres (Docker)
cd ~/proyectos/random/teoria-sintergica/brain-prototype && docker compose up -d

# 2. Migraciones (idempotentes, se pueden correr siempre, en orden)
for f in backend/futbol/migrations/*.sql; do
  docker exec -i brain-postgres psql -U brain_user -d brain_prototype < "$f"
done

# 3. Backend (:8000) y frontend (:5173)
cd ~/proyectos/random && ./init-backend.sh
cd ~/proyectos/random && npm run dev
```

Abrir `http://localhost:5173/vaca-futbolera`.

---

### Cargar el plantel desde JSON (HU-08)

Copiar [players.template.json](players.template.json), completarlo y correr:

```bash
cd teoria-sintergica/brain-prototype/backend
venv/bin/python -m futbol.infrastructure.import_players ../../../docs/la-vaca-futbol/players.json --dry-run  # simula
venv/bin/python -m futbol.infrastructure.import_players ../../../docs/la-vaca-futbol/players.json            # guarda
```

- **Validación:** se valida todo el archivo antes de tocar la base: puestos `POR/DEF/MED/DEL`, claves de skill, valores
  enteros 1–10, sin repetidos. Si hay errores, los lista todos juntos.
- **Idempotencia:** un jugador con el mismo email (o, sin email, el mismo nombre) se actualiza, no se duplica. Los
  puntajes se sobrescriben.
- **`rated_by`:** tiene que ser un admin que ya entró a la app y está vinculado a un jugador. Sus puntajes cuentan como
  fuente `admin` hasta que haya 3 puntuaciones de pares. Si se puntúa a sí mismo, es autoevaluación y no cuenta
  (el script avisa).

### Calendario (por grupo, en `futbol.groups`)

| Campo | Local hoy | Qué define |
|---|---|---|
| `match_weekday`, `match_time` | 3 (miércoles), 19:00 (juegan 19–20 h) | Día y hora del partido |
| `signup_close_weekday`, `signup_close_time` | 2 (martes), 23:59 | Cierre de inscripción |
| `signup_open_weekday`, `signup_open_time` | 5 (viernes), 00:00 | Apertura (crea el partido) |
| `capacity` | 12 (10 en cancha + 2 cambios) | Cupo antes de la lista de espera |

Días: 0 = domingo … 6 = sábado. Zona: `timezone` (Europe/Madrid). La migración `006` deja estos valores
para el grupo "Fútbol Vaquero". Hasta que exista la pantalla de Ajustes, se cambian con SQL.

Admins locales: `FUTBOL_ADMIN_EMAILS=signal@random-lab.es,dimitri@lavacacoworking.com`.

## 6. Quality gates

**Track 2 — frontend** (herramientas ya en `devDependencies`):

```bash
npm run vaca:gauntlet   # prettier + eslint + tsc + vitest con cobertura
```

Último resultado: 102 tests, 98% de cobertura (umbral 80%).

**Track 1 — backend** (herramientas en `requirements-dev.txt`):

```bash
cd teoria-sintergica/brain-prototype/backend
venv/bin/pip install -r requirements-dev.txt
venv/bin/ruff format --check futbol tests/futbol && venv/bin/ruff check futbol tests/futbol
venv/bin/mypy --strict --python-version 3.13 futbol tests/futbol   # ver nota abajo
FUTBOL_TEST_DSN=postgresql://brain_user:sintergic2024@localhost:5432/futbol_test \
  venv/bin/python -m pytest tests/futbol --cov=futbol --cov-fail-under=95
venv/bin/lint-imports
```

Último resultado: 193 tests, 99% de cobertura, 2 contratos de capas respetados.

> **Nota mypy:** `pyproject.toml` fija `python_version = "3.11"` (como el `Dockerfile` de prod), pero
> el `venv` local es 3.13 y su `numpy` usa sintaxis 3.12, así que `mypy` sin `--python-version 3.13`
> falla dentro de `numpy`. Pendiente alinear el `venv` local con 3.11 o ajustar la config. Los tests de
integración usan la base `futbol_test` y se saltan si falta `FUTBOL_TEST_DSN`.

**No corridos todavía:** `mutmut`, `bandit`, `pip-audit`, Playwright.

---

## 7. Producción

Estado al 29/09/2026: **en producción** en https://random-lab.es/vaca-futbolera.

| Pieza | Estado |
|---|---|
| Base (Cloud SQL `random-postgres`, base `random_analytics`) | Migraciones 001–010 aplicadas con el runner (registradas en `futbol.schema_migrations`) |
| Cloud Run `brain-prototype-api` | `FUTBOL_ADMIN_EMAILS`, `FUTBOL_BASE_URL`, `FUTBOL_SMTP_*` y el secreto `futbol-smtp-password` |
| Mail | SMTP de Hostinger desde `signal@random-lab.es` (mismo buzón que el CRM; el SPF del dominio ya autoriza a Hostinger) |
| Terraform | `cloud-run.tf` y `secret-manager.tf` declaran lo anterior. Las variables se aplicaron con `gcloud` porque el plan tenía cambios ajenos pendientes (Vertex AI, `REPLAY_BUNDLE_URI`) |
| Cron | ⏳ Falta Cloud Scheduler → `POST /futbol/cron/tick` (hasta entonces, la pestaña Partido corre el tick al cargar) |

### Migraciones

```bash
cd teoria-sintergica/brain-prototype/backend
# Prod: proxy a Cloud SQL con una cuenta con acceso al proyecto
cloud-sql-proxy --token "$(gcloud auth print-access-token --account signal@random-lab.es)" \
  --port 5434 random-507414:us-central1:random-postgres &
venv/bin/python -m futbol.infrastructure.migrate --dsn "postgresql://random_app:<pass>@127.0.0.1:5434/random_analytics" --dry-run
venv/bin/python -m futbol.infrastructure.migrate --dsn "…"   # aplica solo las que falten
```

La contraseña está en el secreto `random-database-url`. Leerla sin imprimirla.

### Gotchas

- Tu `~/.zshrc` exporta `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` de otro proyecto: hacé `unset` antes de usar
  `gcloud`/`terraform` contra `random-507414`.
- Cloud Run lee los secretos al arrancar la instancia: después de cambiar un secreto, forzá una revisión nueva.
- Si el SMTP falla, la API igual responde 202 (para no revelar qué emails existen) y el link queda en los logs de
  Cloud Run con el error: `gcloud logging read '… textPayload:"no se pudo mandar el mail"'`.

## 8. Pendientes y problemas conocidos

- Falta CI para los gates.
- Primer uso: si el partido de la semana se crea después del cierre (por ejemplo, un martes), nace
  con la inscripción cerrada. Los miembros no pueden anotarse, pero el admin sí puede agregarlos.
- IDs de jugador/skill inválidos en `/players/{id}` (no UUID) dan 500 contra Postgres. En
  `/matches/{id}` ya se validan como UUID (422).
- Falta la invitación por link genérico y la elección de nombre al registrarse (spec §7). Hoy el
  vínculo es solo por email cargado por el admin.
- Tipografías: la fuente pixel es Silkscreen (placeholder) hasta verificar la licencia de DePixel.
  Andes cae a Baloo 2.
- Crear una skill sin puntajes baja el compuesto absoluto de todos por igual. El orden se mantiene,
  como promete la spec.
- Preguntas abiertas de la spec §10 (F7/F8, admins, historial, idioma, permiso de marca).
- **Entorno local:** el repo se movió de `~/Desktop/proyectos/random` a `~/proyectos/random`,
  porque iCloud ("Optimizar almacenamiento") sacaba archivos del disco y trababa Vite y uvicorn. No
  volver a ponerlo en una carpeta sincronizada con iCloud.

## 9. Balanceador (M3)

- **Tamaño de equipos:** sale de los convocados. A = floor(n/2), B = el resto: 10 → 5 v 5, 11 → 5 v 6 (el jugador extra vale
  el 60%, §3.3), 12 → 6 v 6 (5 + 1 cambio por equipo).
- **Fuerza:** prior desde skills (§2.1): `mu = 25 + 3·z` del puntaje compuesto. En M5 se actualiza con resultados.
- **% de victoria:** modelo normal (Thurstone) sobre las fuerzas. En M5 se puede reemplazar por el `predictWin` de OpenSkill.
- **Rendimiento:** el costo de todas las particiones se calcula junto con numpy (10–12 jugadores: ~1 ms; 20: ~45 ms,
  presupuesto 300 ms). Un test verifica que coincide exactamente con `evaluate_partition` (Python puro) en todas las
  particiones.
- **Invalidación:** cualquier alta o baja borra las propuestas del partido (hay que volver a armar). Los equipos ya
  publicados no se tocan: si alguien se baja, el admin republica.
- **Goleadores:** los goles por jugador (opcionales, al cargar el resultado) dan un promedio por partido en los
  últimos 10 partidos con dato. El término `W_GOALS` penaliza que un equipo concentre los goles esperados, así los
  goleadores quedan separados. No entra al rating.
- ⚠️ **Datos:** si todos los jugadores tienen los mismos puntajes, todas las divisiones son igual de parejas (50%/50%). El
  balanceador necesita puntajes reales y distintos.
