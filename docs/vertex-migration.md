# 🔧 SPEC — Migración a Vertex AI Nativo
## Random Lab · `ai/llm_router.py` · Prep para entrevista GFT/BBVA

---

## 0. Objetivo

Reemplazar la llamada indirecta a Gemini vía OpenRouter (proxy de terceros)
por una llamada nativa a **Vertex AI**, usando la service account que ya
corre el backend en Cloud Run (`sa-random-backend-runner`), sin ninguna API
key nueva.

**Por qué esto y no más:** es el único punto del sistema ya arquitecturado
multi-proveedor (el toggle `model_preference` ya existe en el frontend), así
que el cambio es quirúrgico — no se toca nada del CRM/prospecting con Claude
directo, eso queda como está.

---

## 1. Prerrequisitos — verificar antes de tocar código

```bash
# Confirmar el proyecto GCP activo
gcloud config get-value project

# Confirmar que la service account existe
gcloud iam service-accounts describe \
  sa-random-backend-runner@random-507414.iam.gserviceaccount.com

# Confirmar que Cloud Run ya usa esa SA (no una por defecto)
gcloud run services describe <NOMBRE_SERVICIO_BACKEND> \
  --region=us-central1 \
  --format="value(spec.template.spec.serviceAccountName)"
```

Si el último comando NO devuelve `sa-random-backend-runner@...`, hay que
asignársela al servicio antes de seguir (paso 2.3).

---

## 2. Setup en GCP

### 2.1 Habilitar la API de Vertex AI

```bash
gcloud services enable aiplatform.googleapis.com \
  --project=random-507414
```

### 2.2 Dar el rol correcto a la service account (mínimo privilegio)

```bash
gcloud projects add-iam-policy-binding random-507414 \
  --member="serviceAccount:sa-random-backend-runner@random-507414.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

`roles/aiplatform.user` alcanza para invocar modelos — no uses
`roles/aiplatform.admin`, no hace falta y viola el principio de mínimo
privilegio que venís aplicando en todo lo demás.

### 2.3 (Solo si el servicio de Cloud Run no tiene ya esa SA)

```bash
gcloud run services update <NOMBRE_SERVICIO_BACKEND> \
  --region=us-central1 \
  --service-account=sa-random-backend-runner@<TU_PROYECTO>.iam.gserviceaccount.com
```

---

## 3. Dependencias

```bash
pip install google-genai --break-system-packages
```

Agregar a `requirements.txt`:

```
google-genai>=0.3.0
```

---

## 4. Variables de entorno

Agregar en el `.env` (local) y en la config de Cloud Run (producción):

```bash
GCP_PROJECT_ID=<tu-proyecto-gcp>
GCP_VERTEX_LOCATION=us-central1
```

En Cloud Run, si ya usás Secret Manager o `--set-env-vars` para el resto de
la config, sumalas ahí mismo — no necesitan ser secretas, no son
credenciales, son solo identificadores de proyecto/región.

---

## 5. Código — el cambio en `ai/llm_router.py`

**este es el patrón a insertar.** Buscá
en  `llm_router.py` la función que actualmente arma la llamada a
OpenRouter para el caso `model_preference == 'gemini'` (o el branch
`provider == 'openrouter'` con el modelo `google/gemini-2.0-flash-001`), y
reemplazala por esto:

```python
# ai/vertex_client.py — nuevo archivo, cliente Vertex AI aislado

import os
from google import genai

_client = None

def get_vertex_client() -> genai.Client:
    """
    Cliente Vertex AI singleton. En Cloud Run usa Application Default
    Credentials automáticamente (la identidad de sa-random-backend-runner) —
    no requiere ninguna API key. En local, requiere haber corrido
    `gcloud auth application-default login` una vez.
    """
    global _client
    if _client is None:
        _client = genai.Client(
            vertexai=True,
            project=os.environ["GCP_PROJECT_ID"],
            location=os.environ.get("GCP_VERTEX_LOCATION", "us-central1"),
        )
    return _client


async def call_vertex_gemini(prompt: str, model: str = "gemini-2.0-flash-001") -> str:
    """
    Reemplaza la llamada indirecta a Gemini vía OpenRouter.
    Mismo modelo (gemini-2.0-flash-001), ahora servido nativo desde
    Vertex AI en vez de un proxy de terceros.
    """
    client = get_vertex_client()
    response = client.models.generate_content(
        model=model,
        contents=prompt,
    )
    return response.text
```

```python
# ai/llm_router.py — el cambio puntual dentro del router existente

from .vertex_client import call_vertex_gemini

# ... dentro de la lógica que ya elige el provider según model_preference:

if model_preference == "gemini":
    # ANTES: llamaba a OpenRouter → google/gemini-2.0-flash-001
    # AHORA: Vertex AI nativo, misma service account que ya corre el backend
    return await call_vertex_gemini(prompt)
```

**Lo que NO cambia:** Groq como primario para `model_preference == 'auto'`,
el fallback a OpenRouter para otros modelos que no sean Gemini (si los hay),
y absolutamente nada de los 4 puntos de Claude directo del CRM.

---

## 6. Testing local

```bash
# Autenticarte localmente con ADC (una sola vez, no hace falta en Cloud Run)
gcloud auth application-default login

# Correr el backend local y pegarle al endpoint que usa CopilotPanelLabs.jsx
# con model_preference=gemini explícito, para forzar el nuevo path
curl -X POST http://localhost:8000/<endpoint-copilot-labs> \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "model_preference": "gemini"}'
```

Verificar en la respuesta que el `model_used` (si el router lo devuelve, como
vimos que hace `CopilotLabsService`) diga Gemini, y que NO haya ningún log
de llamada a `openrouter.ai` en la consola.

---

## 7. Deploy

```bash
# Build + deploy siguiendo el mismo pipeline que ya usás
# (GitHub Actions → Cloud Build → Cloud Run, mismo patrón de Calavera)
git add .
git commit -m "feat: migrate Gemini calls to native Vertex AI"
git push origin main
```

Después del deploy, repetir el `curl` de testing pero contra la URL de
Cloud Run en vez de localhost.

---

## 8. Verificación end-to-end (checklist)

```
[ ] Vertex AI API habilitada en el proyecto
[ ] Service account tiene roles/aiplatform.user (y solo ese, no admin)
[ ] Deploy exitoso, servicio arriba
[ ] Toggle model_preference='gemini' en el frontend responde correctamente
[ ] La respuesta viene de Vertex AI, no de OpenRouter (verificar logs)
[ ] model_preference='auto' y model_preference='claude' siguen funcionando
    exactamente igual que antes (no rompiste el resto del router)
[ ] Ningún cambio en automation/claude_client.py ni los otros 3 puntos
    de Claude directo del CRM — confirmar que siguen intactos
```

---

## 9. Rollback (por si algo sale mal antes de la entrevista)

Si el deploy falla o algo se rompe a último momento, el rollback es
trivial porque el cambio es aislado:

```bash
# Revertir el último commit y re-deployar
git revert HEAD
git push origin main
```

El branch de OpenRouter para Gemini no se borró, solo se dejó de invocar —
si preferís ir sobre seguro, comentá el nuevo path en vez de borrar el
viejo hasta después de la entrevista.

---

## 10. Cómo hablar de esto mañana

```
"Hicimos una auditoría completa de dónde usábamos IA en el producto:
4 integraciones directas a Claude para el motor de CRM/prospecting,
con prompts afinados específicamente para ese comportamiento — esos
los dejamos como están, migrar eso sería costo sin beneficio técnico
real. Pero encontramos un punto ya arquitecturado multi-proveedor,
el Brain Copilot de nuestro producto de neurofeedback, que llamaba a
Gemini indirectamente vía OpenRouter. Como ya corríamos en GCP con
una service account propia, migramos esa llamada a Vertex AI nativo
— le dimos el rol aiplatform.user a la misma identidad que ya usa el
resto del backend, sin ninguna API key nueva, y sacamos un
intermediario de terceros del medio. Menos latencia, menos costo,
menos superficie de credenciales que gestionar."
```

Esa frase, dicha con seguridad, muestra exactamente el criterio de
arquitecto que un cliente como BBVA necesita ver: **no migrás todo porque
podés, migrás lo que tiene sentido migrar, y explicás por qué el resto se
queda como está.**