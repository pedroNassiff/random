# Gestor Autónomo — estado de implementación

Spec: [Spec — Gestor Autónomo (agente fiscal en Random).md](<./Spec — Gestor Autónomo (agente fiscal en Random).md>).
Vive en `/dashboard` → sección **Putos Impuestos**.

## Tanda 1 (hecha): shell + calendario + motor de plazos

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Sesión compartida | `backend/accounts/` · `/auth/*` | Un solo login para las páginas con login. Reutiliza usuarios, contraseñas y cookie de Fútbol Vaquero (`futbol.app_users`, `futbol.auth_sessions`). El acceso a cada app es una allowlist de emails. |
| Perfil fiscal | `fiscal/domain/profile.py` · `GET/PUT /fiscal/profile` | Versionado: cada guardado crea una versión, nunca UPDATE. Valida DNI/NIE con letra de control. |
| Motor de plazos | `fiscal/domain/deadlines.py` · `POST /fiscal/deadlines` | Días hábiles desde notificación (Ley 39/2015 art. 30) y plazo de apremio (LGT art. 62.5), con traza y fuente. |
| Días hábiles | `fiscal/domain/holidays.py` · tabla `fiscal.holidays` | Festivos por año y territorio (nacional, comunidad, municipio). Año sin festivos cargados: el motor se niega a calcular. |
| Calendario | `fiscal/domain/calendar.py` · `GET /fiscal/calendar` | Generado desde el perfil: 303, 130, 349, 390, Renta, cuotas RETA y fin de tarifa plana. Solo se persiste el estado. |
| Estados y avisos | `fiscal/domain/status.py` · `PUT /fiscal/obligations/{key}/status` | pendiente → preparado → presentado/pagado; cerrar exige justificante. Etapa de aviso T−15 / T−5 / T−1 / T / vencida. |
| Frontend | `src/dashboard/` | Shell con sidebar, login, y Putos Impuestos con Calendario, Plazos y Perfil fiscal. |

## Tanda 2 (hecha): agente en el dashboard

Chat flotante abajo a la derecha (`src/dashboard/components/AgentChat.tsx`) sobre `POST /fiscal/agent/chat`.

- **Modelo:** Claude Opus 5.5 por el SDK oficial (`fiscal/infrastructure/claude.py`), con `ANTHROPIC_API_KEY`
  (o `CLAUDE_API_KEY`). Sin clave el dashboard funciona igual y el chat responde 503.
- **El código calcula, el modelo explica.** Tools de lectura y cálculo: `ver_perfil` (NIF enmascarado),
  `ver_calendario`, `calcular_plazo`. Llaman a `FiscalService`; el modelo no hace aritmética.
- **Human-in-the-loop.** `proponer_perfil` y `proponer_estado` validan con el dominio y devuelven una
  propuesta; no escriben. La persona elige Guardar (usa los mismos endpoints que los formularios),
  Rehacer o Descartar. Al guardar, la página abierta se recarga sola.
- **Documentos en el chat.** Se adjuntan PDF o imágenes (hasta 3 por mensaje, 5 MB cada uno); el agente los
  lee y propone los datos. Su contenido se trata como dato, nunca como instrucción.
- **Los documentos se guardan.** Contenido en el bucket privado `<proyecto>-fiscal-docs`
  (`FISCAL_DOCS_BUCKET`; sin esa variable, en la carpeta local `data/fiscal_docs`) y metadatos en
  `fiscal.documents`. Un mismo archivo se guarda una vez por dueño (sha256). El agente los reutiliza con
  `ver_documentos` y `leer_documento`, y la pestaña Documentos permite descargarlos y eliminarlos.
- **Puesta en marcha guiada.** `ver_pasos` (`fiscal/domain/onboarding.py`) calcula qué falta y qué documento
  lo completa: 036/037 → perfil; resolución del RETA → tarifa plana; justificantes → cierre de obligaciones
  vencidas; notificaciones → plazos. El agente pide de a un documento.
- **Sin memoria en el servidor.** El historial viaja en cada pedido (solo texto) y se pierde al recargar.
- **Privacidad.** No se loguean prompts ni respuestas; el NIF no llega al modelo salvo que la persona lo escriba.

Falta: corpus RAG con normativa (hoy el agente solo cita las fuentes que devuelven las tools), streaming de
la respuesta (tarda ~10-15 s) y el eval de calidad del Track 3.

## Tanda 3 (hecha): facturas emitidas

Registro de ingresos a partir de las facturas, leídas por el agente y confirmadas por la persona.

- **Dominio** (`fiscal/domain/invoices.py`): tipo de operación según el cliente (España, UE con VAT, fuera
  de la UE), importes derivados, trimestre por fecha de devengo, observaciones formales (mención legal, IVA o
  retención indebidos, tipo de cambio faltante) e incidencias de numeración (huecos, duplicados, fechas fuera
  de orden).
- **Resumen por trimestre:** bases por tipo de operación con la casilla del 303 a la que van, IVA repercutido,
  retenciones, clientes UE para el 349 y la traza de facturas. No calcula el resultado de ningún modelo:
  faltan los gastos.
- **Se registra lo emitido, no lo correcto.** La factura se guarda tal como salió, con sus errores señalados;
  se corrige con una rectificativa. La tabla `fiscal.invoices` es append-only: un registro cargado por error
  se marca `anulada`.
- **Moneda extranjera:** se guarda el importe facturado y el tipo de cambio; sin tipo de cambio la factura queda
  marcada. El sistema todavía no trae el tipo oficial: lo aporta la persona.
- **Agente:** `ver_facturas`, `resumen_trimestre` y `proponer_factura`. Pestaña Facturas en el dashboard.

Simplificaciones: los datos del cliente van en la propia factura (sin tabla de clientes ni validación VIES
automática) y todavía no hay series de rectificativas ni emisión de facturas nuevas.

Todo dato fiscal pertenece a un `owner_id` (el usuario logueado) y no se cruza con el de otro.

## Decisiones tomadas al implementar

- **349 condicional.** La spec lo pide "en el trimestre con operaciones UE", pero eso depende del ledger (aún
  no existe). Con ROI se genera cada trimestre marcado "Si aplica".
- **Fechas provisionales.** Solo hay festivos sembrados para 2026. Un vencimiento que cae en un año sin festivos
  salta fines de semana, no festivos, y se marca provisional (p. ej. 390 2026: 30/01/2027 sábado → 01/02/2027).
- **Fin de tarifa plana sin traslado.** No se mueve al siguiente día hábil: la prórroga se pide antes.
- **Justificante = texto** (CSV o referencia). La subida del PDF llega con la bandeja de notificaciones.
- **`comunidad`** se agregó al perfil (la spec solo lista `municipio`): hace falta para elegir los festivos autonómicos.
- **Usuarios y sesiones siguen en el schema `futbol`** para no invalidar sesiones vivas. Moverlos a un schema
  propio es una migración aparte.

## Pendiente de la spec

Envío de avisos (push/email/mensajería), ledger, motor 303/130/349/390, facturero, bandeja de notificaciones,
deudas, ayudas y el corpus RAG del agente. Las citas normativas del calendario deben revisarse antes de que
el agente las use como fuente.

## Puesta en marcha

```bash
cd teoria-sintergica/brain-prototype/backend
venv/bin/python -m futbol.infrastructure.migrate --schema fiscal --dry-run   # schema, festivos 2026, documentos
venv/bin/python -m futbol.infrastructure.migrate --schema fiscal
```

Variables de entorno del backend:

- `DASHBOARD_EMAILS`: emails con acceso a `/dashboard`, separados por coma. Sin ella nadie entra.
- `FISCAL_DOCS_BUCKET`: bucket de documentos (lo crea `infra/4-services/storage.tf`). En local no hace falta.
- `SESSION_COOKIE_SECURE=0` solo en local sin HTTPS (si no está, se respeta `FUTBOL_COOKIE_SECURE`).

Cargar festivos de otro año o municipio es insertar filas en `fiscal.holidays` (`territorio`: `ES`, la comunidad
o el municipio, igual que en el perfil), contrastadas con la resolución anual de días inhábiles del BOE.

## Quality gates

```bash
# Track 1 — backend
cd teoria-sintergica/brain-prototype/backend
venv/bin/ruff format --check accounts fiscal futbol tests && venv/bin/ruff check accounts fiscal futbol tests
venv/bin/mypy --strict --python-version 3.13 accounts fiscal futbol tests/accounts tests/fiscal tests/futbol
FUTBOL_TEST_DSN=postgresql://brain_user:sintergic2024@localhost:5432/futbol_test \
  venv/bin/python -m pytest tests/accounts tests/fiscal tests/futbol --cov=accounts --cov=fiscal --cov=futbol --cov-fail-under=95
venv/bin/lint-imports

# Track 2 — frontend
npm run dash:gauntlet
```

No corridos todavía: `mutmut`, `bandit`, `pip-audit` (no están instalados en el venv) y Playwright.
