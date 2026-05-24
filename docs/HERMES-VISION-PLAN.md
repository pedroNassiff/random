---
proyecto: SANJI-RX
componente: Hermes Vision — Análisis de imágenes clínicas con IA
estado: Planning v1.0
modelo_base: claude-opus-4-7 (visión multimodal)
ultima_revision: 2026-05-16
---

# HERMES VISION — Plan de implementación
## Análisis de imágenes clínicas para seguimiento neurológico felino

> Extensión del copiloto Hermes (SANJI-RX) para procesar imágenes y video del paciente
> y extraer marcadores clínicos estructurados: dolor, estado neurológico, función ocular,
> señales de bienestar/malestar. Va más allá de la Feline Grimace Scale hacia un análisis
> multimodal con grounding veterinario-neurológico profundo.

---

## 0. Por qué esto importa en el caso Sanji

Sanji es un paciente post-isquemia cerebral global. Los marcadores visuales que
podemos extraer de una imagen no son decorativos: son datos clínicos reales que
hoy se pierden porque requieren ojo entrenado y comparación temporal.

Lo que queremos capturar:

| Señal visual | Relevancia clínica en Sanji |
|---|---|
| Anisocoria (asimetría pupilar) | Signo neurológico de primer orden — Horner, lesión de CN III, hipertensión intracraneal |
| Nistagmo | Disfunción vestibular/cerebelosa post-isquémica |
| Posición de orejas | Dolor crónico, malestar, procesamiento sensorial |
| Tensión orbital / FGS | Cuantificar dolor residual post-isquémico |
| Vibrisas | Mapa emocional/sensorial inmediato |
| 3er párpado visible | Enfermedad sistémica, estrés severo, Horner incompleto |
| Descarga ocular | Infección, inflamación, PU/PD (lagrimal) |
| Coat condition | Estado nutricional, estrés crónico, autoaseo comprometido |
| Head tilt residual | Secuela vestibular — comparación longitudinal |
| Postura de cuerpo | Síndrome húsped, ataxia residual, preferencia de peso |

La cámara del celular  ya tiene la resolución necesaria. Solo falta el sistema de análisis.

---

## 1. Benchmarks de referencia

### 1.1 Feline Grimace Scale (FGS) — Universidad de Montreal, 2019

Gold standard validado para dolor agudo en gato. 5 unidades de acción facial (UAF):

| UAF | 0 (ausente) | 1 (moderado) | 2 (presente) |
|---|---|---|---|
| Contracción orbital | Ojos totalmente abiertos | Parcialmente cerrados | Fuertemente cerrados |
| Posición de orejas | Erguidas, hacia adelante | Ligeramente rotadas | Aplanadas contra la cabeza |
| Tensión muzzle/mejillas | Redondeado, relajado | Levemente tenso | Tenso, afilado |
| Posición de vibrisas | Hacia adelante o lateral | Ligeramente hacia atrás | Aplanadas/hacia atrás/agrupadas |
| Posición de cabeza | Sobre línea de hombros | Levemente por debajo | Claramente por debajo, hundida |

Score total: 0-10. Umbral de analgesia: ≥4.
**Limitación**: diseñada para dolor agudo postquirúrgico, no calibrada para dolor neuropático
crónico, hiperestesia sensorial, ni secuelas neurológicas de larga data. Eso es lo que queremos extender.

### 1.2 Cat Stress Score (Kessler & Turner, 1997)
Escala 1-7 de estrés por postura corporal completa. Queremos integrar esto como segundo canal.

### 1.3 Otros referentes
- **GrimACE app**: FGS automatizada básica, sin contexto clínico, sin longitudinalidad.
- **DeepLabCut**: pose estimation animal de laboratorio. Requiere GPU y dataset específico.
- **AnimalPose (MediaPipe)**: landmarks corporales generales, no oftalmológicos.

Lo que proponemos va más lejos en tres dimensiones: **profundidad clínica**, **contexto del caso**
y **longitudinalidad**.

---

## 2. Señales objetivo por categoría

### 2.1 Análisis ocular (prioridad máxima en Sanji)

```
PUPILAS
├── Tamaño absoluto (estimado por proporción con iris)
├── Simetría pupilar (diferencia L-R > 0.5mm = anisocoria clínica)
├── Forma (circular vs irregular = patología)
└── Respuesta aparente a luz (si hay 2 fotos: flash/sin flash)

IRIS
├── Color y homogeneidad (changes → uveitis posible)
├── Borde pupilar (regular vs dentado)
└── Arcus lipoides (adultos mayores — menos relevante aquí)

3er PÁRPADO (membrana nictitante)
├── Visible en reposo (>2mm = signo sistémico)
├── Asimetría L-R (Horner unilateral)
└── Coloración (enrojecida = inflamación)

ÓRBITA Y PERIORBITA
├── Grado de apertura (FGS UAF1)
├── Ptosis palpebral (Horner completo o parcial)
└── Descarga: ausente | serosa | mucoide | purulenta | hemorrágica

MIRADA Y ALINEACIÓN
├── Strabismus (convergente/divergente)
├── Head tilt correlacionado con asimetría visual
└── Nistagmo (requiere video — horizontal, vertical, rotatorio)
```

**Por qué el análisis de retina es difícil pero explorable:**
La retina requiere dilatación pupilar + oftalmoscopio para visualización directa.
Sin embargo, hay señales indirectas:
- Registro pupilar en condiciones de luz controlada puede inferir respuesta retiniana.
- La vascularización periférica del iris es visible con buena resolución.
- Comportamiento frente a luz intensa puede ser indicador de función visual residual.
- Hay investigaciones (2022-2024) sobre análisis de reflejo tapetal como proxy de salud retiniana en carnívoros.

**Propuesta experimental**: protocolo de 3 fotos estandarizadas (luz baja, luz alta, flash
lateral) para comparar dinámica pupilar y reflejo tapetal. Los parámetros se establecen
en el prompt clínico especializado. Esto es investigación aplicada, no diagnóstico.

### 2.2 Análisis facial completo

```
OREJAS
├── Eje principal: erguidas | laterales | rotadas hacia atrás | aplanadas
├── Asimetría L-R (vestibular residual)
├── Movimiento si hay video (twitching = hiperestesia acústica activa)
└── Posición de apertura del canal auditivo visible

VIBRISAS (bigotes)
├── Eje sagital: hacia adelante | neutro | hacia atrás | aplanadas
├── Apertura: expandidas | neutro | contraídas
├── Tensión visible (agrupadas = dolor / miedo activo)
└── Vibrisas supraorbitales (sobre los ojos): posición relativa

MUZZLE Y MEJILLAS
├── Contorno: redondeado/relajado vs tenso/afilado (FGS UAF3)
├── Nariz: húmeda visible | seca | descarga
└── Comisura labial: relajada vs tensa

POSICIÓN DE CABEZA
├── Sobre línea de hombros | levemente bajo | claramente bajo (FGS UAF5)
├── Head tilt angular (estimar ángulo vs horizontal)
└── Mentón hacia adentro ("hunched") vs proyectado
```

### 2.3 Postura y cuerpo

```
POSTURA GENERAL
├── Esfinge relajada | loaf (semi-esfinge) | húsped (curvado) | acostado
├── Posición de patas delanteras (frente tucked vs extendidas)
├── Preferencia de peso (si se ve claramente)
└── Piloerección dorsal/caudal

COAT CONDITION
├── Lustre: brillante | opaco | mate
├── Grooming visible: bien cuidado | descuidado | excesivo en zona
└── Pelaje erizado localizado vs generalizado

SEÑALES COMPORTAMENTALES (si hay video)
├── Frecuencia de parpadeo
├── Movimientos de cabeza bruscos (sobresalto)
├── Grooming compulsivo / autolesión observada
└── Respuesta a estímulo fuera de frame
```

---

## 3. Arquitectura técnica

### 3.1 Stack MVP (Fase 1)

```
Frontend (React)
    └── ImageUpload en SanjiCopilotPanel
              ↓
Backend (FastAPI — sanji-rx port 8001)
    └── POST /sanji/copilot/vision
              ↓
      Anthropic Vision API
      (claude-opus-4-7 — soporta imágenes nativas)
              ↓
      Prompt clínico especializado (VISION_SYSTEM_PROMPT)
              ↓
      Structured JSON output (VisionAnalysis schema)
              ↓
Frontend: renderizado de VisionAnalysisCard
```

No necesitamos CV libraries en MVP. Claude claude-opus-4-7 analiza imágenes directamente
con su propio sistema de visión. El valor estás en el **prompt clínico** y el **schema tipado**
que fuerza una salida estructurada y grounded.

### 3.2 Stack Fase 2 — Análisis local complementario

```
Python (en backend o worker separado)
├── Pillow / OpenCV: preprocessing (crop, normalización de luz, resize)
├── MediaPipe (Face Mesh adaptado): landmarks geométricos faciales
├── ONNX model: clasificador FGS por UAF (requiere datos etiquetados)
└── Resultado fusionado con output de Claude (ensemble)
```

### 3.3 Stack Fase 3 — Longitudinalidad

```
PostgreSQL
└── Tabla vision_analysis
    ├── dog_id, captured_at, image_hash
    ├── fgs_score (0-10)
    ├── fgs_components (JSONB: por UAF)
    ├── pupil_symmetry (float: diferencia L-R)
    ├── ear_position (enum)
    ├── whisker_state (enum)
    ├── head_tilt_deg (float)
    ├── third_eyelid_visible (bool per eye)
    ├── coat_condition (enum)
    ├── llm_raw_output (text)
    └── flags_urgent (bool)
```

Dashboard: gráfica de FGS score en el tiempo. Alertas si score ≥4 o anisocoria nueva.

---

## 4. Sistema de prompting para visión

### 4.1 Vision System Prompt

El prompt de visión se construye sobre el mismo rol/case_baseline del prompt clínico
de HERMES, con extensiones específicas:

```xml
<vision_analysis_mode>
Estás recibiendo una imagen del paciente Sanji para análisis clínico visual.
Tu tarea es extraer señales clínicas estructuradas según el protocolo que sigue.

PROTOCOLO DE OBSERVACIÓN:
1. Describí EXACTAMENTE lo que ves, sin inferencias no grounded.
2. Para cada señal, indicá tu confianza (alta/media/baja) y el motivo.
3. Si la imagen no permite evaluar una señal (ángulo, resolución, oclusión),
   lo declarás explícitamente: "no evaluable - [motivo]".
4. Jamás inferís patología sin evidencia visual directa.
5. La escala FGS se aplica solo si la imagen muestra la cara completa
   en vista AP o levemente lateral; si no, lo indicás.

JERARQUÍA DE URGENCIA:
- CRÍTICO: anisocoria marcada nueva | ptosis unilateral nueva | 3er párpado
  bilateral | membrana tapetal no reflectante | nistagmo
- ALERTA: FGS ≥4 | head tilt >10° | vibrisas completamente aplanadas
- OBSERVAR: FGS 2-3 | orejas levemente rotadas | descarga serosa leve
- NORMAL: FGS 0-1 | signos consistentes con estado basal documentado
</vision_analysis_mode>
```

### 4.2 Output schema (Pydantic)

```python
class EyeAnalysis(BaseModel):
    side: Literal["left", "right", "both", "not_visible"]
    pupil_size_estimate: Literal["normal", "dilated", "constricted", "asymmetric", "not_evaluable"]
    third_eyelid: Literal["not_visible", "slight", "moderate", "prominent", "not_evaluable"]
    discharge: Literal["none", "serous", "mucoid", "purulent", "not_evaluable"]
    orbital_tightening: Literal[0, 1, 2, "not_evaluable"]  # FGS UAF1
    confidence: float
    observations: str

class FGSScore(BaseModel):
    orbital_tightening: Literal[0, 1, 2, "not_evaluable"]
    ear_position: Literal[0, 1, 2, "not_evaluable"]
    muzzle_tension: Literal[0, 1, 2, "not_evaluable"]
    whisker_position: Literal[0, 1, 2, "not_evaluable"]
    head_position: Literal[0, 1, 2, "not_evaluable"]
    total_evaluable: int  # cuántos UAF se pudieron evaluar
    score: Optional[float]  # None si <3 UAF evaluables
    pain_level: Literal["none", "mild", "moderate", "severe", "not_evaluable"]

class PostureAnalysis(BaseModel):
    posture_type: Literal["sphinx_relaxed", "loaf", "hunched", "lying_lateral", "lying_sternal", "standing", "not_visible"]
    head_tilt_deg: Optional[float]  # None si no evaluable
    piloerection: bool
    coat_condition: Literal["good", "fair", "poor", "not_evaluable"]

class VisionAnalysisOutput(BaseModel):
    schema_version: str = "sanji-rx-vision-v1"
    image_quality: Literal["good", "acceptable", "poor"]
    evaluable_regions: List[str]  # qué partes de la imagen son evaluables
    fgs: FGSScore
    eyes: List[EyeAnalysis]
    ear_position: Literal["upright_forward", "lateral", "rotated_back", "flattened", "asymmetric", "not_evaluable"]
    whisker_state: Literal["forward", "neutral", "back", "flat", "not_evaluable"]
    posture: PostureAnalysis
    urgent_flags: List[str]  # lista de señales que requieren atención
    clinical_correlation: str  # párrafo clínico en castellano para Pedro
    compared_to_baseline: Optional[str]  # si hay context previo, comparación
    uncertainty: str
    recommendations: List[str]  # máximo 3, solo si hay algo concreto
```

---

## 5. Señales neurológicas específicas para Sanji (más allá de dolor)

Este es el diferencial real respecto a GrimACE y apps similares. Validadas en
el contexto de isquemia cerebral global + epilepsia secundaria:

| Señal | Qué medir | Relevancia neurológica |
|---|---|---|
| **Anisocoria** | Diferencia de tamaño pupilar L vs R | CN III / Horner / hipertensión intracraneal |
| **Ptosis unilateral** | Caída de párpado superior en un ojo | Horner incompleto — síndrome post-isquémico |
| **Head tilt** | Ángulo de inclinación cefálica | Disfunción vestibular (central o periférica) |
| **Exotropia / Esotropia** | Alineación del eje visual de ambos ojos | Paresia de músculos extraoculares post-isquémica |
| **Nistagmo** | Solo evaluable en video — ver abajo | Lesión cerebelosa / vestibular |
| **Simetría facial** | Comparar tensión L vs R en mejillas y orbit | Neuropatía CN VII post-isquémica |
| **Blink rate** | Parpadeos por minuto (video) | Reducido = dolor corneal / neuropatía sensitiva |
| **Reflexo de amenaza** | Si Pedro pasa el dedo cerca del ojo: ¿parpadeo? | Evaluación campo visual residual |
| **Reactividad pupilar** | 2 fotos: luz alta vs luz baja | Función del CN II + arco reflejo pupilar |
| **3er párpado** | Presencia, bilateralidad | Enfermedad sistémica, Horner |
| **Tapetal reflex color/homogeneidad** | En foto con flash, el reflejo tapetal | Muy experimental — proxy de salud retiniana |

### Protocolo de foto clínica para análisis neurológico

Para máxima utilidad diagnóstica, Pedro debería seguir este protocolo:

```
📸 FOTO 1: Cara completa, frontal, luz natural difusa
   → FGS completa, simetría facial, ojos, orejas, vibrisas

📸 FOTO 2: Cara, leve ángulo lateral (45°)
   → Head tilt, posición de cabeza, orejas en relieve

📸 FOTO 3: Close-up ojos, flash directo (breve)
   → Reflejo tapetal, tamaño pupilar, 3er párpado

📸 FOTO 4: Cuerpo completo, vista lateral
   → Postura, piloerección, coat condition, weight bearing

📹 VIDEO 15s: Sanji en reposo mirando a la cámara
   → Nistagmo, blink rate, movimientos espontáneos, respuesta a estímulo
```

Este protocolo es el que el sistema le pide a Pedro cuando activa el análisis visual.
No son 4 fotos obligatorias — cualquier imagen se analiza. Pero si Pedro sigue
el protocolo, la profundidad del análisis aumenta significativamente.

---

## 6. Análisis longitudinal — La feature más poderosa

Una sola foto da un estado puntual. El valor real está en la **comparación en el tiempo**.

### Métricas a trazar semanalmente:

```
fgs_trend:          score FGS promedio por semana
anisocoria_flag:    apariciones en últimos 14 días
head_tilt_angle:    promedio + varianza
third_eyelid_rate:  % de imágenes donde es visible
coat_score:         1-5 (degradación es señal sistémica)
pupil_symmetry:     índice numérico (0 = simétrico, >0.3 = alerta)
```

### Dashboard visual propuesto:

```
┌─ HERMES VISION ──────────────────────────────────────────┐
│                                                            │
│  FGS Score — últimas 4 semanas                            │
│  ▂▃▂▁▁▂▁▁ (sparkline)   Promedio: 1.2 / 10               │
│                                                            │
│  ALERTAS ACTIVAS:    ninguna 🟢                            │
│                                                            │
│  Última imagen analizada: hace 2 días                     │
│  [Ver análisis] [Comparar con anterior] [Subir imagen]    │
│                                                            │
│  Anisocoria detectada: 0 veces en 14 días                 │
│  Head tilt: estable ~0-2°                                  │
│  Coat condition: buena                                     │
└───────────────────────────────────────────────────────────┘
```

---

## 7. Implementación por fases

### FASE 0 — Investigación (1 semana, sin código)

- [ ] Recopilar 20-30 fotos de Sanji en distintos estados (bien, con hiperestesia, post-medicación)
- [ ] Testar manualmente el prompt de visión contra Claude claude-opus-4-7 con esas fotos
- [ ] Validar que la salida es clinicamente coherente con lo observado por Pedro
- [ ] Identificar edge cases (foto borrosa, ángulo malo, iluminación pobre)
- [ ] Ajustar el schema de output según lo que realmente sale del modelo

**Criterio de go/no-go**: si en 10 fotos de buena calidad el FGS estimado coincide
con la evaluación subjetiva de Pedro en ≥7/10 casos → avanzamos a Fase 1.

### FASE 1 — MVP: upload + análisis básico (3-5 días desarrollo)

**Backend:**
- [ ] `POST /sanji/copilot/vision` — acepta imagen (base64 o multipart/form-data)
- [ ] `VISION_SYSTEM_PROMPT` con protocolo completo
- [ ] VisionAnalysisOutput schema Pydantic
- [ ] Persistencia básica en `vision_analysis` table

**Frontend:**
- [ ] Botón 📷 en SanjiCopilotPanel (junto al input de texto)
- [ ] Preview de imagen antes de enviar
- [ ] `VisionAnalysisCard` — renderiza el JSON de forma legible:
  - FGS score + desglose por UAF
  - Alertas urgentes (rojo)
  - Párrafo clínico
  - Señales observadas

```jsx
// Flujo de UX:
// 1. Pedro toca 📷
// 2. Abre nativa de cámara o file picker
// 3. Preview con overlay "Analizando…"
// 4. Resultado aparece como mensaje de Hermes con VisionAnalysisCard
// 5. Pedro puede seguir chateando sobre el análisis
```

**Entregable Fase 1**: Pedro puede subir una foto de Sanji y recibir análisis FGS
+ observaciones clínicas en lenguaje natural.

### FASE 2 — Análisis neurológico profundo (1-2 semanas)

- [ ] Prompt especializado para análisis de ojos (close-up)
- [ ] Protocolo de 2 fotos (alta/baja luz) para análisis de dinámica pupilar
- [ ] Detección de anisocoria con alert automático en dashboard
- [ ] Head tilt angle estimation (geométrico, con instrucciones de foto)
- [ ] Comparación con imagen anterior ("vs. hace 7 días")
- [ ] Sugerencia de protocolo a Pedro si la imagen no permite análisis completo

### FASE 3 — Longitudinalidad y dashboard (2-3 semanas)

- [ ] `GET /sanji/vision/history` — timeline de análisis
- [ ] Sparklines en dashboard (FGS trend, pupil_symmetry trend)
- [ ] Alertas automáticas si: FGS sube 2+ puntos vs semana anterior |
  anisocoria nueva | head tilt aumenta
- [ ] Export de "reporte visual para el veterinario" (PDF o markdown)

### FASE 4 — ML local (experimental, medium plazo)

- [ ] Pipeline OpenCV para normalización de imagen (crop cara, balance de luz)
- [ ] Fine-tuning de clasificador FGS por UAF con datos de Sanji (transfer learning
  desde modelo animal pose)
- [ ] Análisis de video: blink rate, nistagmo detection (optical flow)
- [ ] Correlación imagen-bitácora: ¿coincide el FGS visual con el hyperesthesia_score manual?

---

## 8. Guardrails y limitaciones clínicas

Aplicar los mismos que el sistema de prompting SANJI-RX:

1. **NUNCA reemplaza examen físico veterinario.** El análisis visual es un complemento,
   no un diagnóstico. Cada output tiene disclaimer explícito.

2. **Confianza declarada obligatoria.** Si la imagen no permite evaluar una señal,
   se dice "no evaluable" — no se imputa valor.

3. **Anisocoria = escalación automática.** Si se detecta asimetría pupilar marcada
   que no estaba previamente documentada, el sistema genera alerta urgente inmediata
   y sugiere contactar al neurólogo veterinario en <6h.

4. **No pathologize normal.** El sistema conoce el baseline de Sanji. Una pupila
   levemente más grande que la otra en contexto de luz variable no es alerta —
   es ruido. El threshold de alerta se calibra con datos propios.

5. **Foto vs. video.** Para nistagmo y blink rate se requiere video. El sistema
   no intenta inferir movimiento de una imagen estática.

6. **Privacidad.** Las imágenes se procesan en memoria y se almacenan con hash.
   No salen al exterior excepto hacia la API de Anthropic bajo la política de
   datos de la plataforma.

---

## 9. Investigación experimental — Análisis tapetal y retiniano indirecto

Esta sección es el límite más avanzado del sistema. No para MVP, pero documentado
como dirección de investigación.

### Reflejo tapetal como proxy de salud retiniana

El tapetum lucidum (capa reflectante detrás de la retina en gatos) produce el
"eye shine" visible en fotos con flash. Su color y homogeneidad puede ser indicativo:

- **Normal**: verde-amarillento homogéneo, simétrico
- **Alterado**: áreas oscuras (posible desprendimiento parcial), asimetría de color,
  pérdida de brillo localizada

**Base científica**: estudios de fotografía de campo amplio en veterinaria (2018-2024)
muestran correlación entre irregularidades del tapetal en imagen no dilatada y
hallazgos oftalmoscópicos. Resolución de 12MP+ con flash frontal es suficiente
para detección de irregularidades macroscópicas.

**Protocolo propuesto (Fase 4)**:
```
1. Foto con flash directo, ojo centrado, distancia 30-50cm
2. Recorte automático de región ocular
3. Análisis de homogeneidad colorimétrica (HSV)
4. Comparación L vs R
5. Comparación con registro anterior del mismo ojo
```

**Caveat**: esto no reemplaza un fondo de ojo con oftalmoscopio indirecto.
Es una señal de screening, marcada explícitamente como experimental.

### Dinámica pupilar y función del CN II

Con 2 fotos en condiciones de luz controlada (flash vs sin flash, mismo ángulo):
- Estimar cambio relativo de tamaño pupilar
- Evaluar si la respuesta es simétrica
- Esto es el reflejo fotomotor directo e indirecto — sin tonómetro ni oftalmoscopio

**Por qué importa en Sanji**: la isquemia occipital que sufrió puede haber afectado
el tract óptico y las áreas de procesamiento visual. Una respuesta pupilar asimétrica
a la luz puede ser la señal más accesible de disfunción residual del CN II o del
tracto óptico central, que ni la RMN rutinaria detecta funcionalmente.

---

## 10. Checklist de implementación

### Fase 0 (validación, sin código):
- [ ] Protocolo de fotos documentado para Pedro
- [ ] 30 fotos test recopiladas
- [ ] Prompt v1 validado manualmente
- [ ] Go/no-go decidido

### Fase 1 (MVP):
- [ ] `vision_analysis` table en PostgreSQL
- [ ] `POST /sanji/copilot/vision` endpoint
- [ ] `VisionAnalysisOutput` Pydantic schema
- [ ] Botón 📷 en SanjiCopilotPanel
- [ ] `VisionAnalysisCard` React component
- [ ] Persistencia básica

### Fase 2 (profundidad neurológica):
- [ ] Prompt especializado de análisis ocular
- [ ] Protocolo 2-fotos (dinámica pupilar)
- [ ] Anisocoria alert automático
- [ ] Comparación with previous image
- [ ] Head tilt angle estimation

### Fase 3 (longitudinalidad):
- [ ] Timeline de análisis en dashboard
- [ ] FGS trend sparkline
- [ ] Reporte exportable para veterinario

### Fase 4 (ML local / experimental):
- [ ] OpenCV preprocessing pipeline
- [ ] Análisis tapetal colorimétrico
- [ ] Video: blink rate + nistagmo
- [ ] Correlación imagen ↔ bitácora

---

## 11. Valor clínico proyectado para Sanji

Si este sistema funciona como se planea, Pedro va a tener:

1. **Un registro visual longitudinal clínicamente codificado** — no solo fotos
   en el carrete, sino análisis estructurados comparables en el tiempo.

2. **Detección temprana de deterioro neurológico** — anisocoria nueva o head tilt
   que vuelve puede ser el primer signo antes de que sea evidente para un ojo no
   entrenado.

3. **Comunicación mejor con el neurólogo/veterinario** — en lugar de "le vi los
   ojos raro", lleva un reporte con FGS score, estimación de simetría pupilar
   y comparación con la semana anterior.

4. **Medición objetiva del dolor residual** — el FGS da un número. Si Sanji tiene
   FGS promedio de 1.5 hoy y en 4 semanas está en 0.8, eso es evidencia de mejoría
   real del vector de dolor/malestar, más allá de la percepción subjetiva.

5. **Investigación aplicada al caso** — el análisis tapetal y la dinámica pupilar
   son cosas que ningún app veterinaria hace hoy. Esto es genuinamente nuevo.

---

*Documento vivo. Se actualiza al inicio de cada fase con learnings de la anterior.*
*Versión 1.0 — Pedro Nassiff / SANJI-RX — 2026-05-16*
