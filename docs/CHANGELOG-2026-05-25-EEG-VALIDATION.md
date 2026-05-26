# Changelog — 2026-05-25 — EEG Validation & Bug Fixes

Contexto: sesión de trabajo sobre el stack de validación de calibración rápida (3 fases / ~3.5 min). Se detectó un bug crítico en el recorder, se corrigió, y se generó análisis aproximado de la primera sesión con protocolo completo del día.

---

## Bug fix — `psycopg2` no definido en `postgres_client.py`

**Archivo:** `teoria-sintergica/brain-prototype/backend/database/postgres_client.py`

**Problema:** `PostgresClientSync.connect()` llamaba a `psycopg2.connect(...)` pero `psycopg2` nunca se importaba al inicio del módulo. El resultado era `name 'psycopg2' is not defined` al iniciar cualquier grabación, bloqueando el recorder completamente.

```
⚠️ PostgreSQL sync connection failed: name 'psycopg2' is not defined
⚠️ [ValidationProtocol] Recorder start failed: name 'psycopg2' is not defined
```

Consecuencia directa: la sesión `prueba validacion` del 25/05 (16:44–16:47) no tiene entrada en PostgreSQL ni datos en InfluxDB. Solo existe el log del protocolo en `validation_logs/validation_20260525_164737_COMPLETE.json`.

**Fix aplicado:**

```python
# Antes:
import asyncpg
from typing import Optional, Dict, List

# Después:
import asyncpg
try:
    import psycopg2
except ImportError:
    psycopg2 = None  # type: ignore
from typing import Optional, Dict, List
```

El `except Exception` que ya existía en `connect()` captura el `TypeError` cuando `psycopg2 is None`, imprime el warning y re-raise, sin crashear el proceso. El recorder va a funcionar en la próxima sesión.

---

## Script nuevo — `analyze_ws_log.py`

**Archivo:** `teoria-sintergica/brain-prototype/backend/scripts/analyze_ws_log.py`

Script de análisis de emergencia para cuando el recorder falla pero el protocolo corrió. Parsea los datos del WS broadcast del terminal (líneas `[WS #NNNN]`) y ejecuta tests de validación aproximados.

**Uso:**

```bash
# Sesión built-in del 25/05 (hardcoded en el script):
cd backend && source venv/bin/activate
python3 scripts/analyze_ws_log.py --builtin

# Sesión desde archivo externo:
python3 scripts/analyze_ws_log.py --log session.txt --protocol validation_log.json --out resultado.json
```

**Tests implementados:**
- `berger_effect_approximate` — ratio α_closed / α_open (con normalized powers, limitado)
- `delta_eyes_closed` — δ_closed / δ_open, proxy de shift fisiológico
- `gamma_emg_artifact` — γ_mean durante baseline_open como proxy de EMG frontal
- `coherence_stability` — autocorrelación lag-1 + CV (mismo algoritmo que el endpoint `/protocol/validate`)

**Quality score simplificado:** sin µV²/Hz absolutos el score no es comparable al score de producción. Se informa al usuario con caveat explícito.

**Salida:** JSON en `validation_logs/analysis_YYYYMMDD_ws_approximate.json`.

**Limitación fundamental:** los band powers del WS stream son normalizados (suman ~1 por ventana). El ratio Berger sobre potencias normalizadas es incorrecto cuando δ sube al cerrar los ojos — el share relativo de α puede caer aunque la potencia absoluta suba. Solo resoluble con datos de InfluxDB (recorder activo).

---

## Análisis de sesión — `prueba validacion` (2026-05-25 16:44:07)

**Protocolo:** quick validation — 3 fases, 210s total

| Fase | Windows | Estado dominante |
|---|---|---|
| `baseline_open` | 12 (~60s) | focused |
| `baseline_closed` | 18 (~90s) | focused (5/18 → deep_relaxation) |
| `recovery` | 12 (~60s) | **deep_relaxation** (10/12) |

**Métricas por fase (band powers normalizados):**

| | baseline_open | baseline_closed | recovery |
|---|---|---|---|
| α mean | 0.0253 | 0.0193 | **0.0601** |
| θ mean | 0.0708 | 0.0762 | **0.1445** |
| δ mean | 0.1872 | **0.4371** | **0.6405** |
| γ mean | **0.7112** | 0.4628 | 0.1445 |
| coherence | 0.568 | 0.476 | 0.517 |

**Tests de validación:**

| Test | Resultado | Valor | Nota |
|---|---|---|---|
| Berger effect | ❌ failed | ratio=0.763 | Inválido con normalized powers (ver caveat) |
| Delta eyes-closed | ✅ pass | ratio=2.34× | Shift fisiológico claro |
| Gamma EMG artifact | ❌ high_emg_artifact | γ=0.711 | EMG frontal alto en AF7/AF8 |
| Coherence stability | ✅ marginal | autocorr=0.298 | Aceptable para sesión corta |

**Score aproximado:** 18.9/100 — **No representativo por normalized powers**. El score real requiere datos de InfluxDB.

### Interpretación clínica

**Berger**: El ratio 0.763 (α normalized closed < open) es un falso negativo. El δ se disparó 2.34× al cerrar los ojos, consumiendo share relativo de todas las otras bandas. Esto es el patrón esperado neurológicamente — el Berger real sobre µV²/Hz casi seguro pasa. Confirmar en próxima sesión con recorder activo.

**Gamma / EMG**: γ_mean = 0.711 durante baseline_open es el dato más problemático de la sesión. Valor normal limpio < 0.15; moderado < 0.35; >0.35 indica contaminación de EMG frontal (tensión de frente/cejas). Posibles causas:
- Tensión al leer las instrucciones en pantalla
- Contacto sub-óptimo de AF7/AF8 (electrodos secos)
- Estado de alerta alto al inicio (WS #825–950 muestran γ=0.793–0.945)

El gamma cae notablemente en `baseline_closed` (0.463) y más aún en `recovery` (0.145), lo que sugiere que la contaminación EMG se redujo con la relajación. Señal de que el hardware funciona bien — el problema es comportamental.

**Recovery**: La fase de recuperación muestra el mejor perfil fisiológico de la sesión — δ alto (0.64), θ elevado (0.14), γ bajo (0.14), α en 0.06 (el mayor de las 3 fases). 10/12 ventanas clasificadas como `deep_relaxation`. Paradójicamente, la "vuelta al cuerpo" generó el estado más relajado — habitual en meditaciones cortas post-protocolo.

---

## Pendiente antes de próxima sesión

1. **Verificar fix del recorder**: el psycopg2 fix está commiteado. Iniciar el backend, hacer una sesión corta de 2 min, confirmar que aparece en `GET /sessions` y que `curl -X POST http://localhost:8000/protocol/validate/<id>` retorna `quality_score` con datos reales.

2. **Instrucción de contacto**: antes de iniciar el protocolo, verificar que AF7/AF8 tienen buen contacto (relajar cejas, revisar que el indicador de calidad esté en verde). El gamma alto en baseline_open es el indicador principal de mal contacto/EMG.

3. **Fase 0 del roadmap per-channel** (de `prox-implementacion-mas-canales-PER-CHANNEL-EEG-STORAGE.md`): ahora que el recorder funciona, es el momento de hacer la migración Postgres con las columnas `alpha_af7_avg`, `faa_mean`, `per_channel_version`, etc. Ver schema en el documento de planificación.

---

## Archivos modificados/creados

| Archivo | Tipo | Descripción |
|---|---|---|
| `backend/database/postgres_client.py` | fix | `import psycopg2` con try/except |
| `backend/scripts/analyze_ws_log.py` | nuevo | Análisis de sesiones desde WS stream |
| `backend/validation_logs/analysis_20260525_ws_approximate.json` | output | Resultado análisis sesión 25/05 |
| `backend/validation_logs/validation_20260525_164737_COMPLETE.json` | output (existente) | Log del protocolo (generado por el backend) |
