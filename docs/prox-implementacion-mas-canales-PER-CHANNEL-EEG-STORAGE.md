# Per-channel EEG storage — planificación y roadmap

## TL;DR

El pipeline computa band powers por canal pero solo persiste el promedio agregado. Eso bloquea topomap real, FAA, asimetría hemisférica y coherencia inter-hemisférica per-banda — todos biomarcadores centrales para validar estados de meditación/neurofeedback. Fix: nuevo measurement `eeg_band_power` en InfluxDB + columnas agregadas en Postgres para persistencia post-retention. Roadmap en 7 fases, MVP técnico en fases 0-1.

---

## Contexto

El backend procesa EEG del Muse 2 a 256 Hz (4 canales: TP9, AF7, AF8, TP10). En cada ventana de ~1s el pipeline aplica Welch PSD por canal, calcula band powers y coherencia, y persiste en InfluxDB bajo el measurement `eeg_metrics`. El shape actual guarda **un solo valor por banda**, que es el promedio de los 4 canales:

```
alpha    = mean(alpha_tp9, alpha_af7, alpha_af8, alpha_tp10)
alpha_raw = mean en µV²/Hz absoluto
theta, beta, delta, gamma = ídem
coherence = inter-hemisférica agregada
```

El análisis temporal, el scoring de sesión (Berger effect, cognitive reactivity, coherence stability) y el frontend de `SessionDetail.jsx` funcionan con estos datos. El widget `SectionTopoMaps` del frontend **simula** distribución espacial usando `BAND_SPATIAL_PRIOR` — priors neuroanatómicos poblacionales que no miden la asimetría real del sujeto en esta sesión.

La decisión de persistir solo el promedio se tomó temprano, antes de que hubiera test battery ni validación científica. Hoy es la limitación principal para las features de análisis que diferencian ADA de una app de meditación consumer.

---

## Problema

### Qué falta

| Métrica | Descripción | Estado |
|---|---|---|
| Actividad por fase (global) | ¿Aumentó alpha en meditación? | ✅ Disponible |
| Scoring de sesión | Berger, cognitive reactivity, coherence | ✅ Disponible |
| ERSP por banda | Cambio % en transiciones de fase | ✅ Disponible |
| **Topomap real** | Distribución espacial por electrodo | ❌ Estimación con priors |
| **FAA** (Frontal Alpha Asymmetry) | `ln(α_af8) − ln(α_af7)` | ❌ No calculable |
| **Asimetría posterior** | `α_tp10 − α_tp9` | ❌ No calculable |
| **Coherencia per-pair** | AF7↔AF8, TP9↔TP10 por banda | ❌ No calculable |
| **Validación de IAF** | Peak alpha individual | ❌ No accesible |

### Caveats neurocientíficos (importantes)

Antes de vender FAA como feature, hay que dejar claro lo siguiente en el código y en la UI:

**1. Los electrodos de Muse no son los canónicos para FAA.**
La literatura clásica de FAA (Davidson 1992, Coan & Allen 2004) usa F3/F4 o F7/F8 — electrodos **frontales**. Muse tiene AF7/AF8 — **prefrontales**, más anteriores. Cannard et al. 2021 específicamente discute que la FAA con Muse tiene **test-retest reliability marginal en single-session** por la posición del electrodo seco y la contaminación de EMG frontal. Smith et al. 2017 muestra que incluso con electrodos de gel en F3/F4, la reliability single-session es apenas aceptable. Con Muse es peor.

**Conclusión práctica:** FAA en ADA es interpretable como **tendencia intra-sesión** (cambios durante meditación vs baseline), no como valor absoluto comparable entre sujetos.

**2. Pre-requisito: baseline individual.**
FAA en valor absoluto no significa nada. La UI va a mostrar siempre **delta vs baseline** de la fase `baseline_closed` de esa misma sesión. Si no hay calibración con ojos cerrados, no hay FAA.

**3. Pre-requisito no implementado (backlog): IAF.**
El rango canónico de alpha (8-13 Hz) no aplica igual para todos. El pico alpha individual puede estar en 9 Hz o en 11 Hz. Una fase futura (Fase 7) debería detectar IAF durante calibración y centrar la banda ahí. Mientras tanto, usamos 8-13 Hz y documentamos la limitación.

**4. AF7/AF8 son ruidosos por EMG frontal.**
Tensión de frente, cejas, movimientos faciales mínimos contaminan estos canales. El `EOGDetector` ya flagea blinks; habría que extender a threshold de EMG alto. Por ahora: confiar en el flag `blink_contaminated` para filtrar ventanas malas cuando se calculan promedios per-canal.

**5. Asimetría posterior (TP9/TP10) es más limpia, menos estudiada.**
Los TP tienen mejor contacto y menos EMG facial que los AF. La asimetría posterior tiene menos literatura detrás pero probablemente sea una métrica secundaria **más confiable** que el FAA canónico en Muse. Vale la pena reportarla como métrica propia, no solo como curiosidad.

### Por qué importa resolver esto ahora

- El stack de validación científica (Berger, cognitive reactivity, coherence) ya está maduro. El siguiente nivel de análisis **requiere** per-channel data.
- Las sesiones viejas tienen raw EEG guardado en Influx durante 30 días, con lo cual podemos reconstruir per-channel **solo para sesiones recientes** (ver sección de retention).
- Una vez implementado, desbloquea automáticamente todas las features listadas arriba. El costo de mantenimiento es bajo si el schema está bien diseñado.

---

## Arquitectura de datos: hot storage + cold storage

Esta es la sección que **no estaba en el análisis original** y es la decisión de arquitectura más importante del documento.

### Realidad actual

- **InfluxDB** = hot storage. Bucket `eeg-data` tiene **retention de 30 días**. Todas las queries del código usan `|> range(start: -30d)`. Pasados los 30 días, `eeg_sample` y `eeg_metrics` se borran automáticamente.
- **Postgres** (`eeg_recordings`) = cold storage permanente. Hoy guarda solo metadata + algunos agregados (`avg_coherence`, `avg_alpha`, etc.) computados al cerrar la sesión vía `InfluxDBEEGClient.get_aggregated_metrics()`.

### Implicación para per-channel

Si dejáramos las nuevas métricas solo en Influx, serían inútiles a partir del día 31. Cualquier feature que dependa de comparar sesiones a lo largo del tiempo (ej. "tu FAA meditativa a lo largo de 3 meses de práctica") requiere persistencia en Postgres.

**Regla general a partir de ahora:**

> Todo per-window data vive en InfluxDB durante 30 días (para gráficos temporales y análisis detallado).
> Todo agregado por-sesión que querramos conservar históricamente vive en Postgres, calculado en `SessionRecorderV2.stop()`.

### Qué se promueve a Postgres al cerrar una sesión

**Agregados per-canal:**
- `alpha_af7_avg`, `alpha_af8_avg`, `alpha_tp9_avg`, `alpha_tp10_avg`
- Idem para theta, beta (fase 5+)

**Agregados derivados:**
- `faa_mean` — media de `ln(α_af8) − ln(α_af7)` sobre la sesión
- `faa_baseline_closed` — FAA medio durante fase `baseline_closed` (zero-reference)
- `posterior_asymmetry_mean` — media de `α_tp10 − α_tp9`
- `per_channel_version` — entero. 0 = sin per-channel (sesiones viejas), 1 = esquema actual. Permite distinguir sesiones reprocesadas vs no.

Sesiones pre-implementación tendrán `per_channel_version = 0` y todos los campos nuevos en `null`. La UI debe manejar el caso sin romper.

---

## Schema propuesto

### InfluxDB: nuevo measurement `eeg_band_power`

Se agrega como measurement separado para no hinchar `eeg_metrics` con 20+ fields nuevos. Tag-based para que agregar bandas en el futuro no cambie schema.

```
measurement: eeg_band_power
tags:
  recording_id       (str, existing pattern)
  band               (alpha | theta | beta | delta | gamma)
  channel            (tp9 | af7 | af8 | tp10)
  state              (baseline_open | baseline_closed | meditation | cognitive_task | ...)
fields:
  value              (float, normalized 0-1)
  value_raw          (float, µV²/Hz absolute)
timestamp: window timestamp (nanoseconds)
```

Ejemplo de un punto:
```
eeg_band_power,recording_id=35,band=alpha,channel=af7,state=baseline_closed value=0.42,value_raw=5.83 1729876543000000000
```

**Cardinalidad esperada:** 4 canales × 5 bandas × N sesiones = 20 series por sesión. A tu escala (decenas de sesiones) totalmente manejable. El tag `state` agrega cardinalidad moderada (~4-6 fases por sesión).

**Volumen esperado:** ~1800 windows × 20 (4ch × 5bands) = ~36k points por sesión en `eeg_band_power`. Sumado al existente, bien dentro de los 290MB actuales del bucket.

### InfluxDB: `eeg_metrics` se mantiene sin cambios

Los fields existentes (`alpha`, `alpha_raw`, `coherence`, `entropy`, `plv`, `signal_quality`, `blink_contaminated`, etc.) siguen igual. Esto preserva backward compat con todos los queries actuales. En una iteración futura se puede deprecar los fields de banda de `eeg_metrics` ya que serán derivables desde `eeg_band_power`, pero no ahora.

### Postgres: columnas nuevas en `eeg_recordings`

Todas nullable para compat con sesiones viejas.

```sql
ALTER TABLE eeg_recordings
  ADD COLUMN alpha_af7_avg     DOUBLE PRECISION,
  ADD COLUMN alpha_af8_avg     DOUBLE PRECISION,
  ADD COLUMN alpha_tp9_avg     DOUBLE PRECISION,
  ADD COLUMN alpha_tp10_avg    DOUBLE PRECISION,
  ADD COLUMN faa_mean                   DOUBLE PRECISION,
  ADD COLUMN faa_baseline_closed        DOUBLE PRECISION,
  ADD COLUMN posterior_asymmetry_mean   DOUBLE PRECISION,
  ADD COLUMN per_channel_version        INTEGER DEFAULT 0;
```

Fase 5 extiende con theta/beta per-channel. Fase 7 extiende con IAF. El `per_channel_version` se incrementa cuando el schema cambia para permitir queries como "solo sesiones con schema >= 1".

---

## API contract change

Solo dos consumidores: `AnalisisDatasets.jsx` y `SessionDetail.jsx`. No hace falta versionado — cambiamos el shape del response agregando un campo top-level nuevo.

### `GET /sessions/{id}/metrics` — shape nuevo

```json
{
  "status": "success",
  "metrics": [ /* array existente, sin cambios */ ],
  "count": 1800,
  "per_channel": {
    "timestamps": [t0, t1, t2, ...],
    "alpha": {
      "af7":  [v0, v1, ...],
      "af8":  [v0, v1, ...],
      "tp9":  [v0, v1, ...],
      "tp10": [v0, v1, ...]
    },
    "alpha_raw": { "af7": [...], "af8": [...], "tp9": [...], "tp10": [...] },
    "theta": { ... },      // fase 5+
    "beta":  { ... }       // fase 5+
  },
  "per_channel_version": 1
}
```

Arrays paralelos al timebase `timestamps`. Si la sesión no tiene per-channel (version=0 o sesiones pre-implementación), `per_channel` es `null` y el frontend cae al topomap con priors.

### `GET /sessions/{id}` — expone agregados Postgres

Ya devuelve el `asdict(recording)`. Automáticamente va a incluir las columnas nuevas. Frontend puede mostrar `faa_mean`, `faa_baseline_closed` como métricas en la tarjeta de sesión.

---

## Roadmap por fases

### Fase 0 — setup (½ día)

**Objetivo:** dejar listo el terreno para la Fase 1 sin escribir código de pipeline todavía.

Tareas:
1. Crear migración Postgres con las columnas nuevas (ver schema arriba).
2. Correrla en dev, verificar que las sesiones viejas siguen siendo leíbles.
3. Documentar en `GLOBAL.md` o `CLAUDE.md` del repo la regla "agregados históricos van a Postgres, per-window a Influx".
4. Confirmar (leyendo `processing.py` o donde se compute bandas) que el pipeline ya aplica Welch por canal. Si promedia los 4 canales antes de FFT, hay que rehacer esa parte en Fase 1.

**Deliverable:** migración aplicada, confirmación del punto (4).

**Criterio de éxito:** las sesiones existentes siguen funcionando en el frontend sin cambios visibles. Los campos nuevos en Postgres están `null`.

---

### Fase 1 — MVP técnico: per-channel storage (2-3 días)

**Objetivo:** grabar sesiones nuevas con per-channel persistido end-to-end.

Tareas:
1. Extender `MetricSnapshot` con arrays o dicts per-canal:
   ```python
   alpha_by_channel: Dict[str, float]      # normalized
   alpha_by_channel_raw: Dict[str, float]  # µV²/Hz
   # idem theta, beta, delta, gamma
   ```
2. Modificar el pipeline de procesamiento para que pase los per-channel valores al `MetricSnapshot` (si no lo hace ya).
3. Extender `InfluxDBEEGClient.write_metrics()`:
   - Seguir escribiendo a `eeg_metrics` igual que antes (no romper nada).
   - Además, para cada snapshot, escribir 20 points a `eeg_band_power` (4 canales × 5 bandas) con tags + fields según schema.
4. Extender `InfluxDBEEGClient.get_aggregated_metrics()`:
   - Query per-canal: `group by channel` sobre `eeg_band_power` filtrando `band=alpha`.
   - Retornar `{alpha_af7_avg, alpha_af8_avg, alpha_tp9_avg, alpha_tp10_avg, faa_mean, posterior_asymmetry_mean}`.
   - Calcular `faa_baseline_closed` filtrando por `state=baseline_closed`.
5. Modificar `SessionRecorderV2.stop()` para guardar estos agregados en las columnas Postgres nuevas y setear `per_channel_version = 1`.
6. Extender endpoint `GET /sessions/{id}/metrics`:
   - Query `eeg_band_power` por `recording_id`, pivot por timestamp.
   - Armar el objeto `per_channel` del shape nuevo.
   - Si no hay datos, devolver `per_channel: null`.

**Criterio de éxito (gates de aceptación):**

Grabar una sesión corta de 2 min con fases explícitas (1 min ojos abiertos, 1 min ojos cerrados). Verificar:

1. **Consistencia de agregación:**
   `mean(alpha_af7_avg, alpha_af8_avg, alpha_tp9_avg, alpha_tp10_avg)` del response ≈ `avg_alpha` existente, tolerancia < 5%. Si falla, hay bug en el pipeline de promedio — parar todo y arreglar.

2. **Sanity check neurofisiológico:**
   En fase `baseline_closed`, `α_tp9 + α_tp10` > `α_af7 + α_af8` (alpha es posterior-dominante con ojos cerrados). Si falla, canales cruzados o bug de signo.

3. **Persistencia end-to-end:**
   `SELECT per_channel_version, alpha_tp9_avg FROM eeg_recordings WHERE id = N;` devuelve `1` y un valor no-null.

4. **API shape correcto:**
   `curl /sessions/N/metrics | jq .per_channel.alpha.tp9 | length` devuelve `N_windows`.

5. **Frontend no se rompe:**
   `AnalisisDatasets.jsx` y `SessionDetail.jsx` siguen renderizando igual que antes, ignorando el campo `per_channel` nuevo. (No se consume aún.)

**Deliverable:** sesión grabada que pasa los 5 criterios. Merge a main.

---

### Fase 2 — reprocesamiento limitado (1 día)

**Objetivo:** recuperar per-channel para sesiones recientes que todavía tienen raw en Influx (< 30d).

Tareas:
1. CLI nuevo: `python -m backend.reprocess --session <id> [--from-raw]`.
2. Leer `eeg_sample` raw de InfluxDB para esa sesión.
3. Reproducir el mismo pipeline de Fase 1 ventana por ventana.
4. Idempotente: antes de escribir, borrar puntos existentes de `eeg_band_power` para ese `recording_id` con `delete_api`.
5. Actualizar columnas Postgres de esa sesión (`per_channel_version = 1`, agregados).
6. Comando batch: `python -m backend.reprocess --all-recent-30d`.

**Criterio de éxito:**
1. Reprocesar S34 (si sigue en retention): el `avg_alpha` reconstruido ≈ el `avg_alpha` original persistido (tolerancia < 1%, debería ser exacto).
2. Topomap real de S34 muestra distribución coherente con lo esperado (posterior-dominante en ojos cerrados).
3. Re-ejecutar el comando sobre S34 no duplica datos (idempotencia).

**Nota importante:** toda sesión con `started_at < now() - 30d` queda permanentemente con `per_channel_version = 0`. El script debe advertir explícitamente cuando una sesión está fuera de retention.

---

### Fase 3 — topomap real (1-2 días)

**Objetivo:** reemplazar `BAND_SPATIAL_PRIOR` con datos reales.

Tareas:
1. En `SessionDetail.jsx → SectionTopoMaps`, consumir `per_channel.alpha` del response.
2. Si `per_channel == null` o `per_channel_version == 0`, fallback al cálculo actual con priors + badge visual "estimación".
3. Actualizar cálculo del widget: promediar `per_channel.alpha[ch]` a lo largo del tiempo y por fase.
4. Tests visuales: mostrar S34 reprocesada vs una sesión vieja sin per-channel. Diferencias deben ser visibles.

**Criterio de éxito de producto:**
- Topomap real difiere del topomap con priors en ≥20% de sesiones reprocesadas. Si da idéntico en todas, los priors eran demasiado buenos (sospechoso) o hay bug.
- Usuario puede distinguir visualmente una sesión con datos reales vs una con estimación.

---

### Fase 4 — FAA con baseline individual (2-3 días)

**Objetivo:** widget de FAA en frontend, con interpretación clara y caveats.

Tareas:
1. Agregar widget `SectionFAA` a `SessionDetail.jsx`.
2. Calcular serie temporal `ln(α_af8) − ln(α_af7)` desde `per_channel.alpha_raw`.
3. Zero-reference al baseline de la sesión: restar `faa_baseline_closed` (desde Postgres) de toda la serie. El gráfico muestra deltas.
4. UI con badge explicativo:
   > "FAA en ADA usa electrodos prefrontales (AF7/AF8) del Muse, no frontales canónicos (F3/F4). La reliability single-session es marginal (Cannard et al. 2021). Interpretar cambios **dentro de la sesión**, no valores absolutos."
5. Mostrar métrica agregada `faa_mean` en la tarjeta de sesión.
6. Definir colores/interpretación: positivo = tendencia approach (prefrontal izquierdo activo), negativo = withdrawal.

**Criterio de éxito:**
- En S34 (A-grade, gold standard), FAA durante `baseline_closed` tiene std < 0.3 en unidades log. Si mayor, el electrodo no está dando señal confiable — revisar criterios de gating o aumentar el threshold.
- FAA muestra cambio detectable (>1σ del baseline) en al menos 1 fase no-baseline de las sesiones de meditación recientes. Si no muestra ningún cambio jamás, el feature no es útil y hay que volver al whiteboard.

---

### Fase 5 — asimetría posterior + coherencia per-pair + theta/beta

**Objetivo:** completar la batería de métricas per-channel.

Tareas:
1. Widget de asimetría posterior (`α_tp10 − α_tp9`) en `SessionDetail.jsx`.
2. Extender pipeline para computar coherencia AF7↔AF8 y TP9↔TP10 por banda (usando PLV o correlación). Esto es lo más pesado de la fase — requiere tocar el cálculo de coherencia core.
3. Persistir a `eeg_band_power` con `band=alpha_coh_af` por ejemplo, o mejor en un measurement aparte `eeg_coherence_pair` con tags `band + pair`.
4. Extender schema Postgres con theta/beta per-channel.
5. Reprocesar sesiones recientes.

**Criterio de éxito:**
- Asimetría posterior muestra patrones consistentes en ≥2 sujetos (cuando haya más de Pedro).
- Coherencia inter-hemisférica frontal aumenta detectablemente en meditación vs cognitive_task (hipótesis basada en literatura).

---

### Fase 6 — análisis avanzado y UI comparativa

**Objetivo:** features que hacen que per-channel valga la pena más allá de topomap bonito.

Tareas:
1. Heatmap fase × asimetría: matriz 4 fases (baseline_open, baseline_closed, meditation, cognitive_task) × 2 asimetrías (FAA, posterior).
2. Vista comparativa inter-sesión: gráfico de FAA media a lo largo de todas las sesiones del sujeto. Eje X = fecha, eje Y = faa_mean (desde Postgres).
3. Export a CSV/JSON de la matriz completa (ya existe export, extenderlo).

**Criterio de éxito:**
- Una pregunta que antes no podías responder ahora es contestable con un gráfico. Ejemplo: "¿mi FAA meditativa está cambiando con la práctica?"

---

### Fase 7 — IAF detection (backlog, opcional)

**Objetivo:** personalizar la banda alpha al pico individual del sujeto.

Tareas:
1. Durante `baseline_closed` de cada sesión, identificar peak frequency en el rango 7-14 Hz de los canales TP9/TP10.
2. Guardarlo en Postgres como `individual_alpha_frequency`.
3. Pipeline usa banda `[IAF-2, IAF+2]` en lugar de `[8, 13]` canónico.
4. Reprocesar sesiones recientes con IAF detectado.

**Criterio de éxito:**
- IAF estable entre sesiones del mismo sujeto (std < 1 Hz).
- Berger effect ratio con IAF > Berger effect ratio con banda canónica (hipótesis: personalizar la banda mejora la señal).

---

## Riesgos y asunciones

### Asunciones

- **El pipeline ya computa Welch por canal.** A verificar en Fase 0. Si no lo hace, Fase 1 se extiende ~½ día más.
- **Retention de 30d se mantiene.** Si se reduce, sesiones recientes pierden la opción de backfill. Si se extiende, no cambia nada.
- **Postgres `eeg_recordings` tiene margen para columnas nuevas.** No es una tabla bajo presión.
- **Frontend no tiene otros consumidores del endpoint metrics.** Confirmado: solo `AnalisisDatasets.jsx` y `SessionDetail.jsx`.

### Riesgos técnicos

- **EMG frontal en AF7/AF8.** Si las ventanas no-blink siguen teniendo EMG alto, el FAA va a ser ruido. Mitigación: extender `EOGDetector` o agregar rejection de ventanas con varianza frontal > threshold en una fase siguiente.
- **Cardinalidad de tags en Influx.** A la escala actual no es problema, pero si en algún momento hay multi-sujeto y cada uno tiene cientos de sesiones, los tags `recording_id` inflan la cardinalidad. No bloqueante hoy.
- **Migración Postgres rollback.** Si algo sale mal en Fase 0, las columnas nullable no rompen nada, pero hay que tener un script de `DROP COLUMN` listo por las dudas.

### Riesgos neurocientíficos

- **FAA con Muse puede no replicar Davidson.** Plan B: reportar asimetría posterior como métrica primaria y FAA como secundaria con caveat permanente.
- **Single-session reliability es marginal.** Mitigación: UI enfatiza trends intra-sesión, no valores absolutos. Comparaciones inter-sesión son válidas solo con N>5 sesiones del mismo sujeto.

### Riesgos de producto

- **Overhead cognitivo para el usuario.** FAA, asimetría posterior, coherencia per-pair — es mucha métrica. Fase 4+ requiere pensar bien la UI para que no sea un dashboard que nadie entiende. Mitigación: priorizar una "métrica del día" en el resumen de sesión, resto detrás de un tab "análisis avanzado".

---

## Referencias

**Neurociencia:**
- Davidson, R.J. (1992). Anterior cerebral asymmetry and the nature of emotion. *Brain and Cognition*.
- Coan, J.A., & Allen, J.J.B. (2004). Frontal EEG asymmetry as a moderator and mediator of emotion. *Biological Psychology*.
- Smith, E.E. et al. (2017). The reliability of single-session FAA measurements. *Psychophysiology*.
- Brandmeyer, T., & Delorme, A. (2018). Closed-loop frontal midline theta neurofeedback. *Frontiers in Human Neuroscience*.
- Cannard, C. et al. (2021). Validating the Muse headband: a consumer-grade EEG device for research. *Journal of Neural Engineering*.
- Klimesch, W. (1999). EEG alpha and theta oscillations reflect cognitive and memory performance. *Brain Research Reviews*.

**Ingeniería:**
- InfluxDB tag cardinality best practices — [docs.influxdata.com](https://docs.influxdata.com/influxdb/v2/write-data/best-practices/resolve-high-cardinality/)
- Pipeline de procesamiento ADA: `backend/processing.py` (a confirmar path en Fase 0)
- Cliente Influx: `backend/database/influx_client.py`
- Schema Postgres: `backend/database/postgres_schema.sql` (o equivalente)