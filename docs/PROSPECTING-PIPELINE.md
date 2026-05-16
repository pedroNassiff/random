# Pipeline de Prospección B2B — Random Lab

CRM de outreach completo: desde generación de leads con IA hasta tracking de apertura de emails.

---

## Visión general

```
GENERACIÓN ──→ KANBAN ──→ SCRAPING ──→ ANÁLISIS IA ──→ PITCH EMAIL ──→ TRACKING
  (grupos IA)   (stages)   (web)        (Claude)         (SMTP)          (pixel)
```

---

## 1. Generación de grupos (IA)

**Dónde:** Botón `✦ NUEVO GRUPO IA` en Planning/Prospección  
**Componente:** `ProspectGroupModal.jsx`  
**Backend:** `POST /prospecting/groups/generate`

### Paso 1 — Configurar búsqueda
- **Identity doc:** documento de marca de Random Lab (`docs/context/prospect-identity.md`) que define quiénes somos y qué ofrecemos. Se carga por defecto o se puede subir uno custom.
- **Contexto extra:** instrucciones libres para el modelo.
- **Parámetros de búsqueda:**
  - Geografía (chips: Barcelona, Madrid, España, Europa, LATAM, Global)
  - Sectores (multiselect: Creative Tech, Audiovisual, Museos, Retail, etc.)
  - Tamaño empresa (Startup / SME / Mid / Enterprise)
  - Foco técnico (IA, WebGL/3D, Data Viz, Automatización, etc.)
  - Score mínimo (slider 40–90)
  - Batch size (slider 5–25 prospectos)
  - Toggle: usar empresas existentes en la DB como referencia

### Paso 2 — Revisar propuestas
Claude Sonnet genera una lista de prospectos reales con:
- Nombre empresa, web, LinkedIn
- Score de fit (0–100)
- Fit category: `HIGH` / `MID` / `LOW`
- Tier (1–4)
- Decision maker
- `why`: razón concreta de fit
- `entry_vector`: vector de entrada recomendado (tipo, título, descripción)
- Tags

El usuario puede **aceptar** o **descartar** cada prospecto individualmente, o hacer bulk accept por threshold de score.

### Guardar grupo
`POST /prospecting/groups` — crea el grupo en `prospect_groups` e inserta los aceptados directamente en `contacts` (tabla principal del kanban), en stage `identificado`.

---

## 2. Kanban — Stages del pipeline

Drag & drop para mover contactos entre columnas. Cada movimiento actualiza `stage` y `last_action` en la DB.

| Stage | Color | Descripción |
|---|---|---|
| `identificado` | gris | En lista, sin acción |
| `siguiendo` | azul | Conectado / siguiendo en LinkedIn |
| `engagement` | cyan | Comentando / interactuando |
| `pitch` | violeta | DM o email enviado |
| `follow_up` | amber | En seguimiento activo |
| `respondió` | verde | Hay conversación |
| `call` | teal | Call agendada o hecha |
| `cerrado` | verde brillante | Deal / colaboración |
| `descartado` | rojo | No interesado |

**Indicadores en cada card:**
- Tier badge (color por categoría)
- Score + fit category (si tiene análisis IA)
- Badge de opens de email (si hay pitch enviado)
- Indicador rojo si lleva +10 días sin actividad

---

## 3. Scraping web

**Dónde:** Botón `SCRAPE` dentro del modal de contacto  
**Backend:** `POST /prospecting/scrape`

Proceso:
1. Recibe `website` + `contact_id`
2. Hace requests HTTP a la web del prospecto
3. Parsea HTML con BeautifulSoup (títulos, descripciones, OG tags, contenido principal)
4. Intenta WordPress REST API si el site lo expone (`/wp-json/wp/v2/posts`)
5. Guarda en `contacts.scraped_content` + `scrape_ts` (timestamp)

El contenido scrapeado se usa automáticamente como contexto en el siguiente paso de análisis IA.

---

## 4. Análisis IA (Claude Sonnet)

**Dónde:** Botón `✦ ANALIZAR` dentro del modal de contacto  
**Backend:** `POST /prospecting/analyze`  
**Modelo:** `claude-sonnet-4-6`

### Input al modelo
- Datos del contacto (empresa, sector, LinkedIn, web)
- Contenido scrapeado (si existe)
- Contexto de Random Lab (qué ofrecemos, stack, casos de uso)

### Output — estructura JSON
```json
{
  "score": 78,
  "fit_category": "high",
  "summary": "...",
  "entry_vectors": [
    {
      "title": "...",
      "description": "...",
      "pain": "...",
      "priority": "high|mid|low",
      "category": "product|tech_infra|ai_integration|marketing|sales"
    }
  ],
  "pain_points": ["..."],
  "opportunities": {
    "product": ["..."],
    "tech_infra": ["..."],
    "ai_integration": ["..."],
    "marketing": ["..."],
    "sales": ["..."]
  },
  "subject_line": "...",
  "opening_hook": "...",
  "pain_point": "...",
  "proof_point": "...",
  "cta": "...",
  "ps_line": "...",
  "recommended_approach": "...",
  "pitch_angle": "..."
}
```

Se guarda en `contacts.ai_analysis` como JSON blob.

### Traducción de pitch
`POST /prospecting/translate-pitch` — traduce el pitch generado al idioma del prospecto (ES / EN / FR / CA) usando el mismo modelo.

---

## 5. Pitch email

**Dónde:** Botón `PITCH` dentro del modal / sección Pitch en el modal  
**Backend:** `POST /prospecting/pitch/send`  
**Transport:** Hostinger SMTP (`signal@random-lab.es`)

### Flujo
1. El usuario configura en el modal: destinatario, subject, cuerpo (pre-llenado desde análisis IA), idioma
2. Se genera un `tracking_id` único (UUID)
3. Se construye el email HTML con **tracking pixel** embebido:
   ```html
   <img src="https://api.random-lab.es/prospecting/pitch/track/{tracking_id}" 
        width="1" height="1" style="display:none" />
   ```
4. Se envía via SMTP (SSL port 465 en prod)
5. Se guarda el log en `pitch_logs` (tracking_id, contact_id, empresa, email, subject, sent_at)
6. El contacto se mueve automáticamente a stage `pitch`

### Variables de entorno necesarias en prod
```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=signal@random-lab.es
SMTP_PASSWORD=...
SMTP_FROM=signal@random-lab.es
APP_URL=https://api.random-lab.es
```

---

## 6. Tracking de aperturas

**Backend:** `GET /prospecting/pitch/track/{tracking_id}`

Cuando el destinatario abre el email, su cliente de correo carga el pixel 1×1:
1. El endpoint registra el evento de apertura en `pitch_logs.opens` (array JSON con timestamps)
2. Devuelve el GIF transparente 1×1
3. El badge en la ContactCard del kanban se actualiza al recargar

**Stats disponibles:**
- `GET /prospecting/pitch/stats/{contact_id}` — aperturas por contacto
- `GET /prospecting/pitch/all-stats` — resumen global
- `GET /prospecting/pitch/all-stats-by-contact` — agrupado por contacto

---

## 7. Base de datos (SQLite)

**Archivo:** `backend/database/prospecting.db`

| Tabla | Descripción |
|---|---|
| `contacts` | Todos los prospectos con análisis IA, scraping, stage |
| `pitch_logs` | Emails enviados + array de opens/clicks |
| `prospect_groups` | Grupos generados por IA (metadata + config) |
| `prospect_group_items` | Prospectos individuales dentro de un grupo (antes de aceptar al kanban) |

---

## 8. Sync local → prod

```bash
cd teoria-sintergica/brain-prototype/backend
python3 scripts/sync_prospecting_to_prod.py
```

Opciones:
```bash
--dry-run              # ver SQL sin ejecutar
--tables contacts      # sync solo una tabla
```

Estrategia: `INSERT OR REPLACE` — actualiza existentes, inserta nuevos, no toca lo que solo está en prod.
