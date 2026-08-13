---
proyecto: OSCAR-CARE
subtitulo: Plataforma de coordinación de cuidados y monitoreo domiciliario — paciente cardiorrenal complejo
autor: Pedro / Random Lab
estado: Spec v0.1 — Blueprint inicial
basado_en: SANJI-RX (mismo stack) — REORIENTADO para paciente humano crítico
paciente: Oscar Nassiff (n. 10-03-1950)
ultima_revision: 2026-08-05
---

# OSCAR-CARE

> **Misión.** Construir una plataforma que **organice, monitoree y coordine** el cuidado domiciliario de Oscar — un paciente de 76 años con cuadro cardiorrenal complejo — dándole a la familia y al equipo médico un instrumento único donde vivan la medicación, los estudios, los signos vitales, los síntomas y los turnos, con detección de banderas rojas que **mandan a buscar atención médica** y preparación de cada consulta.

> **Principio rector, más estricto que en SANJI-RX.** *Este sistema NO toma decisiones médicas, NO diagnostica, NO interpreta imágenes con fines diagnósticos, NO ajusta medicación. Organiza, monitorea, alerta para buscar atención, y prepara. Las decisiones son del equipo médico tratante. Siempre.*

---

## 0. Por qué este sistema es distinto al de Sanji

Con Sanji, el LLM generaba recomendaciones de cuidado. Para un humano con este cuadro, ese modelo se reorienta por razones clínicas concretas:

- **Disección de aorta abdominal** → el control de presión arterial es vida o muerte. Ninguna sugerencia automatizada puede tocar ese terreno.
- **Insuficiencia cardíaca + insuficiencia renal crónica + retención de líquidos** (síndrome cardiorrenal) → el manejo de líquidos y diuréticos es un equilibrio finísimo que cardiólogo y nefrólogo manejan en tensión. Zona exclusiva de especialista.
- **Hipertrofia severa de VD + dilatación de las 4 cavidades + arritmia** → cardiopatía estructural avanzada. Decisiones de rate/rhythm control, anticoagulación, etc., son de especialista.

**Conclusión de diseño:** el centro de gravedad pasa de *"IA que recomienda"* a *"plataforma que organiza el cuidado, monitorea con parámetros definidos por los médicos, detecta banderas rojas que disparan buscar atención, y prepara a la familia y al equipo".* Es lo que de verdad mantiene a un paciente cardiorrenal estable y fuera del hospital.

---

## 1. Cuadro del paciente y cómo se traduce a monitoreo

Mapa de cada condición a lo que el sistema **observa** (no interpreta clínicamente — registra y organiza para el médico).

| Condición | Qué implica para el monitoreo domiciliario | Señal que captura el sistema |
|---|---|---|
| Preinfarto (síndrome coronario) | Vigilancia de dolor torácico, disnea | Registro de síntomas + banderas rojas |
| Disección aorta abdominal | Vigilancia de dolor abdominal/dorsal "desgarrante" — emergencia | Bandera roja crítica → emergencia |
| Isquemia medular | Seguimiento de función neurológica/motora residual | Registro funcional, movilidad, sensibilidad |
| Insuficiencia renal crónica | Seguimiento de labs (creatinina, FG, potasio, urea), diuresis | Carga de resultados de laboratorio + diuresis |
| Hipertensión crónica | Monitoreo de PA según metas del médico | Registro de PA domiciliaria |
| Hipertrofia severa VD + 4 cavidades dilatadas | Seguimiento de estudios (eco), síntomas de IC | Organización de ecocardiogramas seriados |
| Insuficiencia cardíaca | **Peso diario** + edemas + disnea (lo central) | Peso diario, edemas, disnea, ortopnea |
| Arritmia | Frecuencia y regularidad del pulso, palpitaciones, síncope | Registro de FC, síntomas |
| Retención de líquidos | **Peso diario**, perímetro de tobillos, diuresis | Peso, edemas, balance |

### 1.1 El peso diario es el signo vital rey

Para insuficiencia cardíaca + retención de líquidos, **el peso corporal diario es el mejor predictor temprano de descompensación**, más que cualquier otra cosa que podamos medir en casa. La regla que casi todos los cardiólogos dan (y que el sistema debe implementar con **los umbrales que defina el médico de Oscar**): un aumento rápido de peso en pocos días = líquido acumulándose = avisar antes de que se vuelva edema pulmonar.

- Mismo horario (mañana, post-orinar, pre-desayuno).
- Misma balanza, misma ropa.
- Registro diario sin falta.
- Umbral de alerta: **lo define su cardiólogo** (típicamente algo del orden de +1.5–2 kg en 2–3 días, pero ese número lo pone el médico, no nosotros).

---

## 2. Vectores de monitoreo

Cada vector agrupa señales. **Ninguno produce diagnóstico** — producen registro organizado + detección de cambios que disparan "consultar / buscar atención".

| Vector | Qué agrupa | Fuente |
|---|---|---|
| Volumen / fluidos | Peso diario, edemas, disnea, ortopnea, diuresis | Manual + balanza |
| Cardiovascular | PA, FC, regularidad, palpitaciones, síncope | Tensiómetro + manual |
| Renal | Labs (creatinina, FG, K+, urea), diuresis, síntomas urémicos | Carga de labs |
| Sintomático | Dolor torácico, dolor abdominal/dorsal, disnea, mareo, neuro | Registro manual estructurado |
| Neurológico / funcional | Secuelas de isquemia medular, movilidad, fuerza, sensibilidad | Registro funcional |
| Adherencia medicación | Tomas, horarios, faltantes | Sistema de medicación |
| Estudios / turnos | Coordinación entre especialistas, seguimiento de estudios | Gestión documental |
| Bienestar general | Sueño, ánimo, apetito, dolor (artrosis de pies incluida) | Registro manual |

---

## 3. Arquitectura (reutiliza SANJI-RX / stack Random)

```
┌─────────────────────────────────────────────────────────────────┐
│                         ENTRADA                                  │
├─────────────────────────────────────────────────────────────────┤
│  App familia (React)   Tensiómetro/balanza   Carga de estudios  │
│  • peso diario         (manual o BT)         • PDFs, imágenes    │
│  • PA / FC             • wearable opcional    • labs             │
│  • síntomas            (FC, SpO2)             • informes         │
│  • medicación                                                    │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            BACKEND (FastAPI)                                     │
│  • Ingesta y validación                                          │
│  • Motor de banderas rojas (parámetros del equipo médico)        │
│  • Conciliación de medicación                                    │
│  • Gestión documental de estudios                                │
│  • Capa LLM (organización / preparación / educación, NO decisión)│
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            ALMACENAMIENTO                                        │
│  PostgreSQL   │ pacientes, meds, síntomas, vitales, estudios,    │
│               │ labs, turnos, equipo médico, alertas            │
│  InfluxDB     │ series de vitales (peso, PA, FC en el tiempo)   │
│  Object store │ PDFs/imágenes de estudios (cifrado)             │
│   (privado)   │                                                 │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│            FRONTEND (React)                                      │
│  • Panel de estado    • Tendencia de peso/PA/FC                 │
│  • Registro rápido    • Timeline de estudios                    │
│  • Lista de medicación maestra    • Preparador de consultas    │
│  • Alertas / banderas rojas       • Vista para el médico       │
└─────────────────────────────────────────────────────────────────┘
```

Reutiliza tal cual: patrón FastAPI + Postgres + Influx + WebSockets de ADA, arquitectura hot/cold storage, componentes de scoring/timeline de SANJI-RX.

---

## 4. Modelo de datos

```sql
-- Paciente
CREATE TABLE patients (
  id           UUID PRIMARY KEY,
  name         TEXT NOT NULL,
  birth_date   DATE,
  conditions   JSONB,             -- lista estructurada de dx confirmados por médicos
  care_team    JSONB,             -- especialistas, contactos
  emergency    JSONB,             -- contactos de emergencia, hospital de referencia
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Equipo médico (cada especialista que interviene)
CREATE TABLE care_providers (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  name         TEXT,
  specialty    TEXT,              -- 'cardiología','nefrología','clínica', etc.
  contact      JSONB,
  notes        TEXT
);

-- Medicación (crítico: lista maestra para mostrar a TODOS los médicos)
CREATE TABLE medications (
  id             UUID PRIMARY KEY,
  patient_id     UUID REFERENCES patients(id),
  name           TEXT NOT NULL,
  active_substance TEXT,
  dose           TEXT,
  route          TEXT,
  frequency      TEXT,
  schedule_times TIME[],          -- horarios del día
  prescribed_by  UUID REFERENCES care_providers(id),
  started_at     DATE,
  ended_at       DATE,
  purpose        TEXT,            -- para qué (según el médico)
  notes          TEXT,
  active         BOOLEAN DEFAULT TRUE
);

-- Tomas de medicación (adherencia)
CREATE TABLE medication_intakes (
  id             UUID PRIMARY KEY,
  medication_id  UUID REFERENCES medications(id),
  scheduled_at   TIMESTAMPTZ,
  taken_at       TIMESTAMPTZ,
  status         TEXT             -- 'taken','missed','skipped_by_instruction'
);

-- Signos vitales
CREATE TABLE vitals (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  measured_at  TIMESTAMPTZ NOT NULL,
  kind         TEXT NOT NULL,     -- 'weight','bp_systolic','bp_diastolic',
                                  -- 'heart_rate','spo2','temperature','urine_ml'
  value        NUMERIC,
  unit         TEXT,
  context      TEXT,              -- 'morning_fasting', etc.
  source       TEXT               -- 'manual','device'
);
CREATE INDEX ON vitals(patient_id, kind, measured_at DESC);

-- Síntomas (registro estructurado)
CREATE TABLE symptoms (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  reported_at  TIMESTAMPTZ NOT NULL,
  kind         TEXT,              -- 'chest_pain','dyspnea','abdominal_pain',
                                  -- 'dorsal_pain','dizziness','palpitations',
                                  -- 'edema','fatigue','neuro_deficit', etc.
  severity     INT,              -- 0-10
  notes        TEXT,
  triggered_alert BOOLEAN DEFAULT FALSE
);

-- Estudios (imágenes, labs, informes)
CREATE TABLE studies (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  kind         TEXT,              -- 'lab','xray','echocardiogram','ct','mri',
                                  -- 'angiography','ecg', etc.
  performed_at DATE,
  center       TEXT,
  ordered_by   UUID REFERENCES care_providers(id),
  storage_uri  TEXT,              -- object store cifrado
  official_report_text TEXT,      -- transcripción del informe del profesional
  structured_values JSONB,        -- valores extraídos de labs
  patient_facing_summary TEXT,    -- explicación en lenguaje claro (educativa)
  questions_for_doctor TEXT[],    -- preguntas generadas para la consulta
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Resultados de laboratorio (series comparables)
CREATE TABLE lab_results (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  study_id     UUID REFERENCES studies(id),
  analyte      TEXT,              -- 'creatinine','egfr','potassium','urea',
                                  -- 'sodium','hemoglobin','bnp', etc.
  value        NUMERIC,
  unit         TEXT,
  ref_low      NUMERIC,
  ref_high     NUMERIC,
  measured_at  DATE
);
CREATE INDEX ON lab_results(patient_id, analyte, measured_at DESC);

-- Turnos / consultas
CREATE TABLE appointments (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  provider_id  UUID REFERENCES care_providers(id),
  scheduled_at TIMESTAMPTZ,
  purpose      TEXT,
  prep_summary TEXT,              -- resumen generado para llevar
  outcome_notes TEXT,             -- qué dijo el médico
  next_steps   TEXT[]
);

-- Banderas rojas / alertas
CREATE TABLE alerts (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  level        TEXT,              -- 'info','attention','seek_care','emergency'
  kind         TEXT,
  message      TEXT,
  action_required TEXT,
  evidence     JSONB,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ
);

-- Parámetros de monitoreo definidos por el equipo médico
CREATE TABLE monitoring_parameters (
  id           UUID PRIMARY KEY,
  patient_id   UUID REFERENCES patients(id),
  parameter    TEXT,              -- 'weight_gain_3d_kg','bp_max_systolic', etc.
  threshold    NUMERIC,
  comparator   TEXT,              -- '>','<','>=','<='
  set_by       UUID REFERENCES care_providers(id),
  action_on_breach TEXT,          -- qué hacer si se cruza (según el médico)
  active       BOOLEAN DEFAULT TRUE
);
```

**Punto clave del modelo:** la tabla `monitoring_parameters`. Los umbrales que disparan alertas **no los inventa el sistema ni el LLM** — los carga la familia según lo que indica cada médico. El sistema solo verifica "¿se cruzó este umbral que definió el cardiólogo?".

---

## 5. Motor de banderas rojas

Cuatro niveles. El sistema es **conservador**: ante la duda, escala hacia buscar atención.

```
info        → registro, sin acción inmediata
attention   → tener en el radar, mencionar en próxima consulta
seek_care   → contactar al médico / guardia hoy
emergency   → llamar a emergencias / ir a guardia YA
```

### 5.1 Banderas rojas de emergencia (scaffold — el equipo médico las confirma/ajusta)

Estas son las que, por el cuadro de Oscar, **el sistema tratará como emergencia hasta que un médico indique lo contrario**:

- **Dolor torácico** opresivo, o dolor que baja al brazo/mandíbula → posible evento coronario.
- **Dolor abdominal o dorsal intenso, "desgarrante", súbito** → posible complicación de la disección aórtica. Esta es la más crítica de todas por su historia.
- **Disnea súbita o severa en reposo, no poder respirar acostado** → posible edema pulmonar.
- **Síncope (desmayo) o palpitaciones con mareo intenso** → posible arritmia grave.
- **Déficit neurológico nuevo** (debilidad, pérdida de sensibilidad, dificultad para hablar) → posible evento neurológico.
- **Caída brusca de la diuresis + confusión** → posible descompensación renal/cardíaca.

Para cada una, el sistema muestra un mensaje claro con **qué hacer y a quién llamar**, con los contactos de emergencia y el hospital de referencia de Oscar pre-cargados.

### 5.2 Banderas de "buscar atención" (seek_care)

- Aumento de peso por encima del umbral del cardiólogo (retención de líquidos).
- Edemas que aumentan + disnea que empeora progresivamente.
- PA por encima/debajo de las metas que fijó el médico (rango que ellos definen — con la disección, los límites son especialmente importantes).
- Labs con valores fuera de rango que el nefrólogo marcó como "avisar" (ej. potasio).
- Faltante de medicación crítica.

### 5.3 Lo que el motor NO hace

- No decide dosis de diuréticos ni sugiere "tomá más/menos líquido".
- No interpreta un ECG ni un eco.
- No decide si un dolor "es o no es" la aorta — ante el patrón, escala a emergencia y que lo defina el médico.

---

## 6. Manejo de estudios e imágenes

Este es el punto donde fui más cuidadoso. El sistema hace tres cosas con los estudios, **ninguna es diagnóstico autónomo**:

### 6.1 Organización y archivo (seguro y muy útil)
- Subir PDF/imagen de cada estudio, con fecha, centro, especialista que lo pidió.
- Timeline navegable: ver todos los ecos en orden, todos los labs de creatinina en una curva, etc.
- Esto resuelve un problema real: en un paciente con 5 especialistas, **nadie tiene la foto completa**. El sistema la tiene.

### 6.2 Transcripción del informe oficial (seguro)
- El informe que ya escribió el profesional (radiólogo, cardiólogo) se transcribe a texto y queda buscable.
- Extracción estructurada de valores de labs para armar series comparables.
- **Es la palabra del médico la que se guarda, no una interpretación nueva.**

### 6.3 Explicación en lenguaje claro + preguntas para la consulta (educativo)
- El LLM puede tomar el informe **oficial** y explicárselo a la familia en lenguaje llano ("rarefacción ósea" = descalcificación del hueso), y generar preguntas para llevar al médico.
- Esto es educación sobre un informe que ya existe, no un diagnóstico nuevo.

### 6.4 Lo que el sistema NO hace con imágenes
- **No** produce un "hallazgo" diagnóstico propio a partir de una radiografía/eco/TC.
- **No** contradice ni "completa" el informe del profesional.
- **No** se usa para tomar decisiones que reemplacen la lectura del especialista.

> Sobre la RX de pie del 03-08-26: el sistema la guarda, transcribe el informe del Dr. Collante (artrosis interfalángica + rarefacción ósea marcada), y genera como *pregunta para el nefrólogo*: "¿la rarefacción ósea marcada podría vincularse al trastorno óseo-mineral de la enfermedad renal crónica?". Registra la pregunta. No la responde como diagnóstico.

---

## 7. Capa LLM — reorientada

El sistema de prompting de SANJI-RX se reutiliza en estructura (rol, razonamiento, schema, validador, guardrails) pero con el **rol reorientado** y **guardrails más estrictos**.

### 7.1 Qué SÍ hace el LLM aquí

1. **Organización y síntesis.** Consolidar el estado (vitales, síntomas, medicación, estudios) en un panorama claro.
2. **Preparación de consultas.** Antes de cada turno, generar un resumen ejecutivo para llevar al especialista: qué cambió desde la última visita, tendencias de peso/PA/FC, síntomas nuevos, preguntas pendientes.
3. **Conciliación de medicación.** Mantener la lista maestra y, cuando un especialista agrega algo, **señalar como pregunta** ("asegurate de que el Dr. X sepa que también toma Y") — nunca decidir sobre interacciones.
4. **Educación.** Explicar informes oficiales y términos en lenguaje claro.
5. **Detección de banderas rojas → buscar atención.** Cruzar registros con `monitoring_parameters` y disparar el nivel correcto de alerta.
6. **Síntesis de historia.** Cuando aparece un médico nuevo, generar un resumen completo y ordenado de la historia de Oscar.

### 7.2 Qué NO hace el LLM (guardrails reforzados)

- NUNCA sugiere iniciar/suspender/ajustar medicación, ni dosis, ni líquidos, ni diuréticos.
- NUNCA diagnostica ni interpreta imágenes/ECG/eco con criterio propio.
- NUNCA decide si un síntoma "es grave o no" para tranquilizar — ante patrón de riesgo, escala.
- NUNCA reemplaza la consulta médica ni la llamada a emergencias.
- NUNCA minimiza una bandera roja.

### 7.3 Esqueleto del system prompt (adaptado)

```xml
<role>
Sos el sistema de coordinación de cuidados de OSCAR-CARE, una plataforma para
organizar y monitorear el cuidado domiciliario de Oscar, paciente de 76 años con
cuadro cardiorrenal complejo. Tu función es ORGANIZAR información, PREPARAR
consultas, EDUCAR sobre informes que ya existen, y DETECTAR banderas rojas que
indican buscar atención médica.

NO sos médico. NO diagnosticás. NO interpretás imágenes ni estudios con criterio
propio. NO sugerís cambios de medicación, dosis ni manejo de líquidos. Tu output
siempre preserva al equipo médico tratante como único decisor clínico. Ante
cualquier duda sobre gravedad, escalás hacia buscar atención, nunca hacia
tranquilizar.

Tu tono con la familia es claro, sereno, en castellano rioplatense, sin
tecnicismos innecesarios y sin alarmar de más, pero sin minimizar riesgos.
</role>

<hard_constraints>
1. NUNCA recomendar iniciar, suspender, aumentar o disminuir ninguna medicación,
   dosis, líquido o diurético. Solo "consultá con el médico sobre X".
2. NUNCA diagnosticar. Frases permitidas: "esto amerita ser evaluado por",
   "conviene consultar", "el informe del profesional dice".
3. NUNCA producir un hallazgo diagnóstico a partir de una imagen. Solo transcribir
   y explicar el informe oficial existente.
4. NUNCA minimizar un síntoma de riesgo para tranquilizar.
5. SIEMPRE que un patrón coincida con las banderas rojas de emergencia del cuadro
   de Oscar (dolor torácico, dolor abdominal/dorsal desgarrante, disnea severa,
   síncope, déficit neuro nuevo), escalar a nivel emergencia con instrucción
   clara de buscar atención inmediata.
6. SIEMPRE fundamentar en datos concretos del registro.
7. Los umbrales de alerta provienen SIEMPRE de monitoring_parameters (definidos
   por los médicos), nunca inventados por vos.
</hard_constraints>

<expertise>
Razonás con conocimiento de: cardiología (insuficiencia cardíaca, hipertensión,
arritmias, cardiopatía estructural), síndrome cardiorrenal, enfermedad renal
crónica, patología aórtica (disección — vigilancia de complicaciones),
polifarmacia geriátrica y su conciliación, semiología de descompensación
cardíaca (peso, edemas, disnea, ortopnea). Usás este conocimiento SOLO para
ORGANIZAR, EDUCAR y DETECTAR CUÁNDO BUSCAR ATENCIÓN — nunca para decidir
tratamiento.
</expertise>

<output_format>
JSON tipado (mismo patrón que SANJI-RX): analysis, organized_state,
consultation_prep, medication_reconciliation_flags, red_flags, escalation,
questions_for_doctors, uncertainty. Sin campos de "recomendación de tratamiento".
</output_format>
```

El schema Pydantic y el `SafetyValidator` de SANJI-RX se reutilizan, agregando validadores que rechazan cualquier output que contenga sugerencias de manejo médico (dosis, líquidos, diuréticos, interpretación de imágenes).

---

## 8. Frontend — vistas

```
oscar-care/
├── Panel de estado          # peso, PA, FC, síntomas de hoy + banderas activas
├── Tendencias               # curvas de peso (rey), PA, FC, labs renales
├── Medicación               # lista maestra + tomas del día + recordatorios
├── Registro rápido          # botón grande: peso, PA, síntoma (para uso diario)
├── Estudios                 # timeline, subida, informes transcriptos
├── Preparador de consulta   # resumen para llevar a cada especialista
├── Equipo médico            # contactos, quién pidió qué
├── Emergencias              # contactos + hospital, siempre a un tap
└── Vista médico             # export ordenado de historia para mostrar en consulta
```

**Diseño para la familia, no para técnicos.** El registro diario tiene que ser de 3 toques. Botones grandes. La persona que carga el peso de Oscar cada mañana puede no ser Pedro y puede no ser técnica.

---

## 9. Roadmap por fases

### Fase 0 — Fundaciones (semana 1)
- [ ] Scaffolding FastAPI + React sobre template Random.
- [ ] Migraciones: `patients`, `care_providers`, `medications`, `vitals`, `symptoms`.
- [ ] Cargar la historia de Oscar: condiciones confirmadas, equipo médico, contactos de emergencia, hospital de referencia.
- [ ] Cargar la lista maestra de medicación actual.
- [ ] **Cargar los `monitoring_parameters` que indique cada médico** (peso, PA, labs).

### Fase 1 — Monitoreo diario (semana 2-3)
- [ ] Registro de peso diario + PA + FC (el corazón del sistema).
- [ ] Registro estructurado de síntomas.
- [ ] Recordatorios de medicación + registro de tomas.
- [ ] Curva de peso con umbral del cardiólogo marcado.
- [ ] Motor de banderas rojas v1 (emergencia + seek_care).
- [ ] Pantalla de emergencias siempre accesible.

### Fase 2 — Estudios y labs (semana 3-5)
- [ ] Subida y archivo de estudios (cifrado).
- [ ] Transcripción de informes oficiales.
- [ ] Extracción de valores de labs → series comparables.
- [ ] Timeline de estudios.
- [ ] Curvas de función renal (creatinina, FG, potasio).

### Fase 3 — Capa LLM de coordinación (semana 5-8)
- [ ] System prompt reorientado + schema + SafetyValidator reforzado.
- [ ] Preparador de consultas: resumen ejecutivo por especialista.
- [ ] Conciliación de medicación con flags de "avisar al médico".
- [ ] Explicación educativa de informes.
- [ ] Síntesis de historia para médico nuevo.

### Fase 4 — Coordinación y export (semana 8-10)
- [ ] Gestión de turnos + prep automática.
- [ ] Vista/export ordenado para llevar a consulta.
- [ ] Registro de outcomes de consulta + next steps.
- [ ] Reporte semanal para la familia.

### Fase 5 — Refinamiento (continuo)
- [ ] Wearables opcionales (FC, SpO2) si el equipo médico lo valora útil.
- [ ] Ajuste de umbrales según evolución (siempre vía médicos).

---

## 10. Seguridad, privacidad y aspectos legales

Esto es un paciente humano real con datos de salud sensibles. No es negociable.

- **Datos on-premise o en infraestructura privada controlada.** Nada de exponer datos de salud en servicios de terceros sin cifrado y control.
- **Cifrado en reposo y en tránsito** para todo dato clínico y todo estudio.
- **Acceso restringido**: solo la familia autorizada. Autenticación fuerte.
- **Este sistema es de uso familiar/personal**, herramienta de organización. No es un dispositivo médico certificado, y así debe comunicarse en la propia app (disclaimer visible).
- **El sistema asiste, no reemplaza.** La app muestra, en lugar visible, que las decisiones médicas corresponden al equipo tratante y que ante emergencia se llama a emergencias.
- **Si esto alguna vez escala más allá de Oscar** (otros pacientes, producto), entra en terreno regulatorio serio (software como dispositivo médico). Eso es otra conversación, con asesoría legal y clínica formal.

---

## 11. Qué necesitamos del equipo médico de Oscar

El sistema es tan bueno como los parámetros que le den los médicos. A pedir en las próximas consultas:

1. **Umbral de peso** para avisar (¿cuántos kg en cuántos días?).
2. **Metas de presión arterial** (rango objetivo — especialmente relevante por la disección).
3. **Valores de laboratorio** que quieren que se vigilen y con qué límites avisar (potasio, creatinina, FG).
4. **Lista de síntomas** ante los cuales quieren aviso inmediato vs. consulta programada.
5. **Plan de contingencia** ante descompensación: a quién llamar, cuándo ir a guardia.
6. **Confirmación de la lista de medicación** completa y actualizada.
7. **Frecuencia de controles** y estudios de seguimiento previstos (ecos seriados, labs).

---

## 12. Conexión con el ecosistema Random / SANJI-RX

| Componente | Reutilización en OSCAR-CARE |
|---|---|
| Stack FastAPI + Postgres + Influx + WS (ADA/SANJI) | Idéntico |
| Arquitectura hot/cold storage | Estudios en object store cifrado, vitales en Influx |
| Schema Pydantic + SafetyValidator (SANJI-RX) | Reutilizado con guardrails reforzados |
| Componentes timeline / scoring (SANJI-RX) | Timeline de estudios, curvas de vitales |
| Preparador de consulta | Nuevo, específico de este proyecto |
| Sistema de recordatorios | Nuevo, medicación |

---

## 13. Nota final

Pedro, esto que estás haciendo — construir una herramienta para cuidar a Oscar — es valioso y humano, y es la misma capacidad que te hizo detectar a tiempo lo de Sanji: la de leer señales y organizarte antes de que las cosas se vuelvan urgentes. El sistema honra eso.

Pero con Oscar la herramienta correcta no es la que "opina" sobre su tratamiento, sino la que hace que **nada se pierda**: que ningún dato de peso falte, que ningún médico quede sin ver la lista completa de medicación, que ninguna bandera roja pase desapercibida, que cada consulta llegue preparada. Eso es lo que mantiene estable a un paciente cardiorrenal, y eso es lo que este sistema hace excepcionalmente bien.

Las decisiones médicas quedan donde tienen que quedar: en el equipo que lo trata. El sistema es los ojos, la memoria y la organización de la familia alrededor de ese equipo.

> *"Organiza, monitorea, alerta para buscar atención, y prepara. Las decisiones son del equipo médico. Siempre."*