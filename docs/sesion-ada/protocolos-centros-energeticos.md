# Protocolo de Centros Energéticos — Master Spec

> Sesión terapéutica interdisciplinaria con seguimiento EEG en ADA.
> Neurociencia · Filosofía hindú (chakras) · Dispenza · Grinberg · Cronobiología · Metafísica.
> Sujeto piloto: Pedro. Diseño N-of-1, longitudinal, 3 meses.

---

## TL;DR

Construimos, sobre el stack existente de brain-prototype/ADA, un **protocolo terapéutico de trabajo con centros energéticos** que documenta cada sesión en tres momentos (pre / durante / post) y las encadena en un **programa de 3 meses** personalizado al perfil del sujeto.

La apuesta metodológica central: **el EEG es la verdad de terreno**. Todo el aparato simbólico —chakras, cosmología, "flujo energético", timing astrológico, prácticas de Dispenza o reiki— entra al sistema como **hipótesis y features contextuales**, no como mecanismo probado. El sistema no asume que "abrir el chakra del corazón" es real; asume que *una práctica etiquetada como "corazón" produce, o no, un cambio medible en biomarcadores frontales/cardíacos* y deja que los datos hablen a lo largo del tiempo.

Esto nos permite dos cosas que una app de meditación consumer no puede: (1) sostener el marco espiritual/terapéutico completo que le da sentido y adherencia a la práctica, y (2) mantener rigor científico falsable encima, porque cada afirmación se ancla a un biomarcador y a un criterio de aceptación. ADA se convierte en el analista interdisciplinario que cruza las dos capas.

MVP en 3 fases (protocolo de sesión → perfil + plan → análisis longitudinal), construido sobre el per-channel storage ya planificado.

---

## 1. Visión y por qué ahora

El stack de validación científica ya está maduro: Berger, reactividad cognitiva, estabilidad de coherencia, y el roadmap per-channel (FAA, asimetría posterior, topomap real) desbloquea los biomarcadores de asimetría hemisférica. Tenemos recorder funcionando, InfluxDB (hot, 30d) + Postgres (cold, permanente), y ADA con dos capas (instant rule-based + deep LLM) corriendo en tiempo real durante la sesión.

Lo que **no** tenemos todavía es un marco que convierta "grabé una meditación y vi mis frecuencias" en **"seguí un programa terapéutico dirigido a un objetivo, y puedo mostrar si funcionó"**. Ese salto —de instrumento de medición a intervención con seguimiento de efecto— es este documento.

El objetivo declarado del sujeto: trabajar el flujo energético entre centros (chakras), destrabar centros bloqueados, y ver si prácticas específicas (Dispenza, reiki, pranayama, meditación) producen cambios medibles y sostenidos en el tiempo. El objetivo del *sistema*: ser lo suficientemente riguroso como para que la respuesta pueda ser "no", y lo suficientemente rico como para que el "sí" signifique algo.

---

## 2. Postura epistemológica — el contrato del sistema

Esta sección es la más importante del documento. Define qué creemos, qué medimos y qué no afirmamos. Todo el código, la UI y los prompts de ADA se derivan de acá.

### 2.1 Dos capas ontológicas, una fuente de verdad

Separamos el sistema en dos capas que **nunca se confunden en el código**:

**Capa simbólica (subjetiva / hipótesis):** chakras, nadis, prana, "energía", el mapa de centros, la cosmología (fase lunar, estación, hora planetaria), la carta natal, la intención de la práctica, el lenguaje de Dispenza y del reiki. Esta capa es rica, motivadora y estructura la experiencia. En la base de datos vive como **etiquetas, features y metadata contextual**. No se le asigna estatus causal.

**Capa objetiva (verdad de terreno):** EEG per-canal y sus derivados (band powers, coherencia, FAA, asimetría posterior, IAF), más señales fisiológicas auxiliares (HRV/pulso, respiración si está disponible), más auto-reporte estructurado (escalas validadas). Esta capa es la que **decide** si algo pasó.

> **Regla de oro:** una afirmación de la capa simbólica solo se "confirma" cuando correlaciona de forma reproducible con un cambio en la capa objetiva. Hasta entonces es una hipótesis viva, etiquetada como tal en la UI.

### 2.2 Por qué esta postura sirve a AMBOS objetivos

No es hedging defensivo. Es lo que hace el sistema *más* potente, no menos:

- **Para lo espiritual:** el marco completo se mantiene intacto. El sujeto practica "apertura del centro del corazón" con toda la carga simbólica que la hace funcionar. La adherencia y el efecto placebo/expectativa son *parte del mecanismo terapéutico real*, no ruido a eliminar.
- **Para lo científico:** cada práctica genera una predicción falsable ("meditación de corazón → aumento de coherencia frontal y HRV vs baseline"). A los 3 meses tenemos datos para decir cuáles hipótesis sobrevivieron. Eso es N-of-1 real, no fe.

### 2.3 Qué NO hace el sistema

- No mide "energía", "aura" ni "vibración" — no tenemos sensor para eso y no lo inventamos. Medimos correlatos neuro/fisiológicos y los reportamos como lo que son.
- No afirma que un cambio EEG *prueba* que un chakra "se abrió". Afirma que *durante y después de la práctica X, el biomarcador Y cambió en dirección Z*, con tamaño de efecto e intervalo.
- No hace diagnóstico clínico. El vocabulario de "psicología analítica" y "medicina alternativa" se usa como marco interpretativo del sujeto, con caveat permanente.

### 2.4 El estándar de evidencia N-of-1

Somos un sujeto (Pedro). Eso limita generalización pero **no** invalida el diseño: los estudios N-of-1 son un método reconocido en medicina personalizada. La clave es:
- **Baselines repetidos** (cada sesión tiene su propio baseline_open/closed → zero-reference intra-sujeto).
- **Replicación temporal** (la misma práctica, muchas veces, a lo largo de meses → distinguir señal de ruido de sesión).
- **Contraste de condiciones** (práctica vs baseline; práctica A vs práctica B; misma práctica en distintos contextos/horarios).
- **Pre-registro de hipótesis** (se declara qué esperamos ANTES de mirar los datos, para no caer en pattern-matching post-hoc).

---

## 3. Marco teórico interdisciplinario

Acá fundamentamos cada corriente, qué aporta, y —crucialmente— qué de eso es medible con nuestro hardware y qué queda como capa simbólica.

### 3.1 Neurociencia de la meditación (la columna vertebral medible)

Esto es lo mejor establecido y es donde vive nuestra verdad de terreno. Biomarcadores robustos en la literatura:

- **Theta frontal-medial (4–8 Hz):** marcador de atención focalizada sostenida y control ejecutivo; sube en meditación de concentración. Nuestro proxy con Muse: theta en AF7/AF8. Candidato para prácticas de "foco / tercer ojo".
- **Alpha (8–13 Hz), posterior-dominante con ojos cerrados:** relajación con alerta, desactivación cortical de tarea. Efecto Berger. Ya lo validamos. Candidato para estados de calma / "coronilla" en reposo.
- **Relación alpha↔theta y profundidad meditativa:** a mayor profundidad, la literatura describe modulaciones específicas alpha/theta (no monotónicas); útil para un índice de "profundidad de estado".
- **Gamma (30–50 Hz):** en meditadores expertos, sobre todo en prácticas de compasión/loving-kindness (línea Lutz & Davidson), aparece gamma sostenida y sincronía de gran escala. Con Muse el gamma es frágil (contaminación EMG), así que lo tratamos con cautela y gating estricto de artefacto.
- **Asimetría alpha frontal (FAA):** `ln(α_derecha) − ln(α_izquierda)`; se asocia a sistemas de aproximación (izquierda) vs. retirada/evitación (derecha) — relevante para el eje emocional/afectivo. **Caveat fuerte:** Muse usa AF7/AF8 (prefrontal), no F3/F4 canónicos; reliability single-session marginal (Cannard 2021). Solo interpretable como *tendencia intra-sesión* con zero-reference al baseline. Ya está en el roadmap per-channel.
- **Asimetría posterior (TP9/TP10):** menos estudiada pero más limpia (mejor contacto, menos EMG). Métrica secundaria propia.
- **Acoplamiento neurocardíaco (EEG × HRV):** la coherencia cardíaca y su interacción con oscilaciones corticales sube tras mindfulness. Si sumamos pulso/HRV, ganamos un eje "corazón" con base fisiológica real, no solo simbólica.

> Estos son los "instrumentos" con los que vamos a *auditar* todo lo demás.

### 3.2 Joe Dispenza — *Sobrenatural* y el trabajo de centros

Qué propone (capa simbólica): en *Becoming Supernatural*, Dispenza describe la meditación **"Blessing of the Energy Centers"** — recorrer secuencialmente los centros (que mapea explícitamente a los chakras y a plexos nerviosos/glándulas), llevando consciencia y "energía" a cada uno para desbloquear y coherer el sistema. Enfatiza pasar de estados de estrés (beta alta, supervivencia, foco en el mundo material) a estados de coherencia (ondas más lentas y coherentes, "trascender el cuerpo y el tiempo"), y usa el lenguaje de "coherencia cerebral y cardíaca" y de gamma elevado en estados de "elevación".

Qué de esto es medible / evidencia real: el grupo asociado a Dispenza **publicó** un estudio revisado por pares — *"Large effects of brief meditation intervention on EEG spectra in meditation novices"* (Vieten, Wahbeh, Cahn, Fannin et al., IBRO Reports, 2020) — con EEG tomado en sus retiros avanzados, reportando **aumentos grandes de potencia espectral a lo largo de delta, theta, alpha, beta y gamma** durante las meditaciones. Es un dato real y citable.

**Caveats honestos que van en el código y la UI:**
- El estudio es de campo, **sin grupo control aleatorizado**, con participantes autoseleccionados y altamente motivados (expectativa alta). Muestra que "pasan cosas medibles en el EEG durante estas prácticas", no que el mecanismo sea el que Dispenza postula.
- Los claims sobre "energía", campos, y efectos no-locales de sus retiros exceden lo que ese EEG demuestra.
- Su hardware es EEG de alta densidad; nosotros tenemos Muse (4 canales). Podemos replicar *tendencias de banda y coherencia*, no la resolución espacial de sus mapas.

Qué tomamos: la **estructura de la práctica** (recorrido secuencial de centros, énfasis en transición beta→ondas lentas coherentes, componente de "elevación emocional") como protocolo, y sus predicciones como hipótesis medibles (ej. "durante blessing-of-centers baja la beta relativa y sube coherencia frontal vs baseline").

### 3.3 Jacobo Grinberg — teoría sintérgica

Qué propone (capa simbólica/teórica): Grinberg postuló que la consciencia emerge de la interacción entre el **campo neuronal** del cerebro y una estructura pre-espacial que llamó **lattice** (la retícula), siendo la **sintergia** el grado de coherencia/síntesis de esa interacción. A mayor sintergia, mayor unidad perceptual y estados expandidos. Su experimento más famoso —el **"potencial transferido"**— puso pares de sujetos que meditaron juntos en cámaras de Faraday separadas; al estimular a uno con flashes, reportó que en ~1/4 de los ensayos aparecían patrones EEG correlacionados en el otro, sin estímulo directo.

Estatus científico (honesto): el trabajo de Grinberg **nunca tuvo replicación robusta ni aceptación mainstream**; quedó marginado y su desaparición en 1994 truncó el programa. Los intentos de replicación de correlación EEG inter-cerebral son controvertidos y no concluyentes. **No** construimos sobre el claim no-local.

Qué tomamos, y cómo, sin comprarnos lo no falsable: la **noción de sintergia como coherencia/integración** es traducible a algo que *sí* medimos — coherencia inter-hemisférica, PLV, integración de gran escala. Usamos "índice sintérgico" como **nombre de una métrica compuesta de coherencia** (ya aparece "estado sintérgico" en el `AdaRealtimePanel` con umbral α≥0.25 & coh≥0.75), dejando claro en la doc que es un *operacionalización nuestra inspirada en Grinberg*, no una validación de su teoría. El marco de Grinberg le da al sujeto un lenguaje para "unidad/expansión"; el sistema lo aterriza en coherencia medible.

### 3.4 Filosofía hindú y chakras — el mapa simbólico operativo

El sistema de 7 chakras (Muladhara → Sahasrara), con sus nadis (Ida/Pingala/Sushumna), elementos (tattvas), bijas (mantras semilla) y correspondencias glandulares/plexales del tantra y el yoga, es el **andamiaje organizador** de todo el programa. Es la capa que le da estructura narrativa: qué se trabaja, en qué orden, con qué práctica, con qué intención.

Cómo lo tratamos: como un **mapa de objetivos y prácticas**, no como anatomía literal. Para cada chakra definimos (a) el trabajo psicológico/simbólico asociado (à la psicología analítica: raíz=seguridad/sombra corporal, corazón=vínculo/duelo, etc.), (b) las prácticas concretas que lo abordan, y (c) **uno o más biomarcadores candidatos** que *podrían* moverse si la práctica hace algo medible. La correspondencia chakra→biomarcador es explícitamente una **hipótesis**, tabulada en §7, no un hecho.

### 3.5 Cronobiología, cosmología y contexto — por qué "cuándo" importa

El sujeto quiere que el *timing* (hora del día, día, fase del año, cosmología) determine qué práctica hacer. Separamos dos sub-capas:

- **Cronobiología (base fisiológica real):** existen ritmos circadianos medibles que afectan el estado cerebral y la respuesta a la práctica — respuesta de cortisol al despertar (CAR, primeros 30–45 min tras despertar), ritmo de temperatura central, curva de alerta, melatonina nocturna. Esto justifica *fisiológicamente* que prácticas activadoras (pranayama energizante, foco) rindan distinto a la mañana que meditación de calma a la noche. Es capa objetiva-adyacente: lo usamos como feature con base real.
- **Cosmología / astrología / fase lunar (capa simbólica pura):** carta natal, hora planetaria, fase lunar, estación como "estación del alma". Sin mecanismo físico establecido sobre EEG. **No se descarta** —entra como feature contextual y como estructura ritual que aumenta intención/adherencia— pero se etiqueta como hipótesis y, con suficientes sesiones, el sistema puede *testear* si (por ejemplo) las sesiones en luna llena difieren en algún biomarcador de las de luna nueva. Si no difieren, se reporta honestamente; si difieren, es un hallazgo para investigar (probablemente vía adherencia/sueño, no vía "energía lunar").

> Esto es exactamente el poder del enfoque "EEG como verdad de terreno": convierte la cosmología de dogma en **hipótesis testeable**. El sujeto no tiene que elegir entre creer y medir.

---

## 4. Arquitectura del sistema

### 4.1 Cómo encaja en el stack existente

No reinventamos infraestructura. Reusamos:

- **Recorder + InfluxDB (hot, 1 año) + Postgres (cold, permanente):** el patrón "per-window a Influx, agregados por-sesión a Postgres" del doc per-channel se extiende con las nuevas entidades (sesión terapéutica, práctica, auto-reporte).
- **Per-channel storage (roadmap ya planificado):** este protocolo es el **primer gran consumidor** de FAA / asimetría posterior / topomap real. Conviene priorizar Fase 0–1 de ese doc como prerequisito.
- **ADA (instant + deep):** durante la sesión, la capa instant guía en tiempo real (ya existe `getRuleBasedInsight`, `classifyGuidanceState`, guía adaptativa por estado). La capa deep (LLM) hace el análisis interdisciplinario pre/post y el seguimiento longitudinal.
- **Guía adaptativa por voz (TTS):** el `AdaRealtimePanel` ya tiene apertura + wandering + silencio en estado sintérgico. Extendemos los scripts de `adaGuidanceScripts` para el vocabulario de centros.

### 4.2 Nuevas entidades de datos

```
PerfilSujeto (1 por sujeto, versionado)
  ├── intrínseco: nacimiento (fecha/hora/lugar), edad, sexo, IAF individual,
  │               baselines EEG históricos, rasgos (auto-reporte inicial)
  ├── extrínseco/dinámico: sueño, consumo (cafeína/alcohol/etc.), ejercicio,
  │               estrés, ciclo, contexto vital, humor basal
  └── simbólico: carta natal (features derivadas), constelación de centros
                 "prioritarios" según el trabajo elegido

ProgramaTerapeutico (1 por ciclo de 3 meses)
  ├── objetivo(s) por centro
  ├── secuencia de mesociclos (ver §6)
  └── hipótesis pre-registradas (predicciones falsables)

SesionTerapeutica (N por programa)  ← el corazón del protocolo
  ├── contexto pre: timestamp, snapshot de features extrínsecas + cosmológicas,
  │                 auto-reporte pre (escalas), intención declarada
  ├── baseline: baseline_open + baseline_closed (zero-reference)
  ├── práctica(s): tipo, centro target, duración, guía usada
  ├── registro EEG per-window (Influx) + per-channel
  ├── auto-reporte post (escalas) + notas cualitativas / ADA dialog
  └── agregados por-sesión (Postgres): biomarcadores por fase, deltas vs baseline

Practica (catálogo)
  ├── nombre, tradición (dispenza|pranayama|reiki|mantra|visualización|...)
  ├── centro(s) target
  ├── biomarcador(es) esperado(s) + dirección esperada
  └── parámetros (duración, ritmo respiratorio, mantra, etc.)
```

### 4.3 Escalas de auto-reporte (la tercera fuente de verdad)

El EEG no captura la dimensión fenomenológica/afectiva. Sumamos escalas cortas, validadas, pre y post:

- **Estado afectivo:** PANAS corto o SAM (valencia/activación/dominancia) — 30 segundos.
- **Estado corporal / centros:** un "body scan" subjetivo de 7 ítems (uno por centro): sensación de bloqueo/apertura 0–10. Esto es *dato subjetivo estructurado*, no medición energética.
- **Profundidad percibida / absorción:** 1 ítem 0–10 post.
- **Contexto:** sueño anoche, última comida, cafeína, estrés previo (para modelar covariables).

Estas escalas son clave: permiten cruzar "lo que sentí" con "lo que midió el EEG" y detectar disociaciones interesantes (ej. sesión que se *sintió* profunda pero el EEG muestra beta alta → material para ADA).

---

## 5. Modelo de perfil — intrínseco y extrínseco

El sujeto pidió explícitamente derivar recomendaciones desde su perfil (nacimiento, hábitos, contexto, momento del año, cosmología). Así lo estructuramos, siempre bajo la regla de que **el perfil genera hipótesis de recomendación, y el EEG las valida a posteriori**.

### 5.1 Capa intrínseca (estable)

- **Datos de nacimiento:** fecha, hora, lugar. De acá se derivan features cronobiológicas (cronotipo estimado, si hay data) y las features **simbólicas** de carta natal (sol/luna/ascendente, elementos dominantes, etc.). Las simbólicas se guardan como etiquetas para *estructurar* el programa (ej. "trabajar elemento agua = centros sacro/corazón") y como variables a testear, nunca como verdad causal.
- **IAF (Individual Alpha Frequency):** de la Fase 7 del roadmap per-channel. Personaliza la banda alpha. Biomarcador intrínseco real.
- **Baseline EEG histórico:** el promedio de baselines del sujeto define su "normal" personal — toda métrica se lee como delta contra esto.
- **Rasgos / línea de base psicológica:** auto-reporte inicial más extenso (una vez): qué centros siente bloqueados, historia, objetivos terapéuticos.

### 5.2 Capa extrínseca (dinámica, por sesión)

- **Cronobiológica:** hora respecto al despertar (ventana CAR), momento del día, cronotipo.
- **Fisiológica reciente:** sueño (duración/calidad), ejercicio, comida, cafeína/alcohol/sustancias, ciclo hormonal.
- **Estado vital:** estrés, carga de trabajo, ánimo basal, eventos.
- **Cosmológica (simbólica):** fase lunar, estación, hora planetaria, tránsitos. Features contextuales testeable.

### 5.3 El motor de recomendación (cómo el perfil elige la práctica)

Regla de diseño: **empezar simple y basado en reglas + cronobiología, no en un modelo opaco.** El motor v1 es un conjunto de reglas legibles:

```
si (ventana CAR / mañana) y (objetivo = activación de centros bajos)
    → práctica energizante (pranayama Kapalabhati/Bhastrika, foco raíz/plexo)
    razón fisiológica: pico de cortisol matinal favorece activación
si (noche / pre-sueño) y (objetivo = calma / corazón / coronilla)
    → meditación de coherencia + loving-kindness + respiración lenta
    razón fisiológica: melatonina en ascenso, favorece ondas lentas
si (fase lunar = llena) [SIMBÓLICO, hipótesis]
    → sugerir trabajo de "liberación", loggeado como feature a testear
...
```

Cada regla registra **la razón** (fisiológica real vs. simbólica-hipótesis, etiquetada). ADA puede exponer esa razón al sujeto ("te sugiero esto ahora porque estás en tu ventana de cortisol matinal —base fisiológica— y además es luna creciente —marco simbólico que estamos testeando—"). Con el tiempo, el motor puede aprender de los datos qué reglas efectivamente predicen mejores biomarcadores, pero **solo tras acumular sesiones** y sin sobreajustar.

---

## 6. Mapa Centro → Trabajo → Práctica → Biomarcador (hipótesis)

Esta es la tabla operativa. **La columna de biomarcador es hipótesis, no hecho** — es precisamente lo que el programa va a testear. Con Muse 2 (TP9, AF7, AF8, TP10) los biomarcadores accesibles son limitados; se indica cuáles son *directos*, cuáles *proxy débil* y cuáles requieren HRV.

| Centro (chakra) | Trabajo psico-simbólico | Prácticas candidatas | Biomarcador(es) candidato(s) | Fuerza de la medición |
|---|---|---|---|---|
| Raíz (Muladhara) | Seguridad, cuerpo, sombra corporal, arraigo | Body scan, respiración diafragmática lenta, Kapalabhati suave, mantra LAM | ↓ beta relativa (des-estrés), ↑ estabilidad de coherencia, ↑ HRV | Proxy / requiere HRV |
| Sacro (Svadhisthana) | Emoción, placer, creatividad, fluidez | Movimiento/respiración pélvica, visualización agua, mantra VAM | Modulación theta, cambios de valencia (auto-reporte + FAA) | Proxy débil |
| Plexo solar (Manipura) | Poder, voluntad, autoestima, digestión emocional | Bhastrika, respiración de fuego, foco en ombligo, mantra RAM | ↑ theta frontal-medial (foco), ↑ activación (beta controlada) | Proxy (AF7/AF8) |
| Corazón (Anahata) | Vínculo, compasión, duelo, apertura | Loving-kindness/Metta, coherencia cardíaca, blessing Dispenza, reiki, mantra YAM | ↑ coherencia frontal, ↑ HRV/coherencia cardíaca, FAA hacia aproximación, gamma (experto) | Directo (coh) + requiere HRV |
| Garganta (Vishuddha) | Expresión, verdad, comunicación | Canto/mantra (Bhramari, HAM), vibración vocal | Modulación por vocalización, cambios de coherencia | Débil / confound EMG |
| Tercer ojo (Ajna) | Intuición, insight, foco interno | Trataka, concentración en entrecejo, visualización, mantra OM/KSHAM | ↑ theta frontal-medial, ↑ alpha frontal, ↓ actividad de tarea | Directo (theta/alpha AF) |
| Coronilla (Sahasrara) | Unidad, trascendencia, "sintergia" | Meditación abierta/sin objeto, silencio, blessing final Dispenza | ↑ coherencia global (índice sintérgico), gamma sostenido, alpha posterior alto | Directo (coh) + gamma frágil |

**Notas de honestidad que van en la UI:**
- El chakra de garganta es especialmente difícil de medir sin contaminar por EMG de vocalización; se reporta con caveat.
- Los biomarcadores "requiere HRV" están gated a que sumemos sensor de pulso (ver roadmap).
- El "índice sintérgico" es una métrica de coherencia compuesta, operacionalización nuestra (§3.3), no una validación de Grinberg.
- La correspondencia glandular/plexal del tantra (ej. corazón↔timo, plexo↔páncreas) es marco simbólico; no la medimos.

---

## 7. Protocolo de sesión — pre / durante / post

Estructura de una sesión terapéutica única. Análoga al `validation_protocol.py` (fases con instrucciones, countdown, captura por ventana) pero orientada a intervención y con las tres fuentes de verdad (EEG + auto-reporte + contexto).

### 7.1 PRE-sesión (documentar el estado de partida)

1. **Captura de contexto (automática + 3 toques):** timestamp, features extrínsecas (sueño, cafeína, estrés), features cosmológicas (fase lunar, hora). Auto-reporte pre: afectivo (SAM, 30s) + body-scan de 7 centros (0–10 c/u) + intención declarada ("qué centro trabajo hoy y por qué").
2. **Verificación de señal:** contacto AF7/AF8 en verde, gamma baseline < umbral EMG (reusar el gate del changelog: γ alto en baseline_open = mal contacto/tensión frontal). No arrancar hasta señal limpia.
3. **Baseline EEG (obligatorio, zero-reference):**
   - `baseline_open` 60s (ojos abiertos, punto fijo).
   - `baseline_closed` 90s (ojos cerrados, reposo).
   - De acá salen: efecto Berger de la sesión, FAA baseline, IAF, y el "cero" contra el que se leen todos los deltas.

### 7.2 DURANTE (la práctica, con guía y captura)

4. **Práctica dirigida al centro target** (o secuencia de centros, à la blessing Dispenza). Duración según plan (típico 10–25 min).
5. **Guía en tiempo real (ADA instant + TTS):** apertura, y guía adaptativa por estado — extendiendo `classifyGuidanceState` con estados de centro. Silencio en estado de coherencia alta (ya implementado como "estado sintérgico"). Intervención suave si wandering (beta↑, coherencia↓).
6. **Captura per-window a Influx** con tag `state` = fase de la práctica (ej. `heart_opening`, `crown_open_awareness`), per-channel activado. Feed del buffer de ADA como ya hace `addSample`.
7. **Marcadores de evento:** el sujeto (o ADA) puede marcar momentos ("acá sentí apertura", "acá me distraje") para alinear con el EEG post-hoc.

### 7.3 POST-sesión (documentar el estado de llegada y el delta)

8. **Recovery/retorno** 60s (como en el protocolo actual — a menudo el estado más relajado).
9. **Auto-reporte post:** afectivo (SAM) + body-scan 7 centros + profundidad percibida. El **delta pre→post de cada uno** es un outcome primario subjetivo.
10. **Cómputo de agregados por-sesión (Postgres):** por fase y global — band powers per-canal, coherencia, FAA (delta vs baseline_closed), asimetría posterior, índice sintérgico, (HRV si hay). `per_channel_version`, `session_type='therapeutic'`.
11. **Análisis interdisciplinario de ADA (deep/LLM):** ADA recibe las tres fuentes (EEG agregado, auto-reporte, contexto) y produce una lectura que cruza: neurociencia ("tu theta frontal subió 18% vs baseline durante la fase de foco"), marco simbólico ("consistente con activación del trabajo de Ajna que te propusiste"), psicológico ("reportaste apertura en corazón y el EEG mostró ↑coherencia — convergen"), y **honestidad** ("pero la beta se mantuvo alta, así que la calma fue parcial"). Termina con una micro-recomendación para la próxima.

### 7.4 Criterios de aceptación del protocolo de sesión (gates)

Una sesión es **válida** (entra al análisis longitudinal) si:
1. Señal limpia: ≥80% de ventanas sin flag de artefacto; γ baseline_open bajo umbral EMG.
2. Baseline completo: baseline_open + baseline_closed capturados, Berger computable.
3. Consistencia de agregación: `mean(per-canal) ≈ avg global`, tolerancia <5% (mismo gate que el doc per-channel).
4. Sanity neurofisiológico: en baseline_closed, alpha posterior (TP9+TP10) > alpha frontal (AF7+AF8).
5. Auto-reporte pre y post completos.

Si falla 1 o 2, la sesión se marca `quality=low` y se excluye de las conclusiones longitudinales (pero se guarda).

---

## 8. Plan longitudinal de 3 meses — cuándo esperar efectos

Diseño del programa que encadena sesiones. Estructurado como mesociclos, con hitos y una respuesta honesta a "¿cuándo se ven efectos?".

### 8.1 Estructura en mesociclos (12 semanas)

- **Semana 0 — Calibración (baseline del programa):** 4–5 sesiones de solo baseline + una práctica neutra, distintos horarios/contextos, para caracterizar la variabilidad *normal* del sujeto (crítico: sin esto no sabemos qué es "cambio real" vs. ruido de día). Se detecta IAF, se fija el "cero" del programa.
- **Mesociclo 1 (sem 1–4) — Fundamento / centros bajos:** foco en raíz + plexo (arraigo, activación, regulación de estrés). Prácticas energizantes a la mañana (base cronobiológica). Frecuencia objetivo: 4–6 sesiones/semana.
- **Mesociclo 2 (sem 5–8) — Corazón / coherencia:** loving-kindness, coherencia cardíaca, blessing de Dispenza. Acá entra fuerte el eje HRV si está el sensor. Sesiones vespertinas de calma.
- **Mesociclo 3 (sem 9–12) — Centros altos / integración:** tercer ojo (foco/insight) y coronilla (consciencia abierta, "sintergia"). Meditación sin objeto, silencio. Integración de todo el recorrido (blessing completo).
- Cada mesociclo cierra con una **sesión de evaluación** idéntica en estructura a la de calibración, para comparar contra el baseline del programa.

### 8.2 Hitos y cuándo esperar efectos (honesto)

Basado en la literatura de neuroplasticidad y meditación, con la salvedad de que N-of-1 y Muse limitan la potencia estadística:

- **Efectos de estado (dentro de la sesión): inmediatos.** Desde la sesión 1 deberíamos ver deltas práctica-vs-baseline (ej. ↑theta en foco, ↓beta en calma). Esto valida el *método*, no el *cambio de rasgo*.
- **Consolidación de habilidad (llegar más rápido/profundo al estado): 2–4 semanas.** Con práctica regular, la latencia para alcanzar el estado objetivo debería bajar y la magnitud del delta subir. Es el primer signo de aprendizaje real.
- **Cambios de rasgo / baseline (el baseline_closed mismo cambia): 6–12 semanas, y con incertidumbre.** Que el EEG *en reposo* del sujeto se mueva (ej. más alpha/theta basal, FAA basal desplazada, mayor coherencia basal) sería el hallazgo fuerte. La literatura sugiere que cambios de rasgo requieren dosis sostenida; a 12 semanas *podríamos* verlo, pero hay que estar preparados para que el efecto sea pequeño o ausente, y reportarlo así.
- **Outcomes subjetivos (body-scan, afecto): seguimiento semanal.** Suelen moverse antes y más que el EEG; ojo con la disociación subjetivo/objetivo (material valioso, no contradicción a esconder).

### 8.3 Cómo mostramos "las frecuencias cambiaron en el tiempo, a mejor o no"

- **Serie longitudinal por biomarcador:** eje X = fecha, eje Y = métrica (delta-vs-baseline de theta de foco, coherencia de corazón, FAA, índice sintérgico). Tendencia + banda de variabilidad del baseline. (Consume los agregados Postgres — Fase 6 del doc per-channel: vista comparativa inter-sesión.)
- **Trayectoria de estado-→rasgo:** dos curvas por métrica: la de *estado* (durante práctica) y la de *rasgo* (baseline_closed). El objetivo terapéutico es que la de rasgo empiece a levantar.
- **Adherencia como covariable:** graficar dosis (sesiones/semana) contra outcome; el efecto sin dosis es sospechoso.
- **Honestidad estadística:** con N-of-1 usamos bandas de variabilidad del baseline como umbral de "cambio real" (un punto cuenta como cambio si sale >2σ del baseline del programa). Nada de sobre-interpretar ruido.

---

## 9. El rol de ADA — analista interdisciplinario

ADA ya tiene la arquitectura (instant + deep, TTS, buffer, contexto de sesión). Lo que agregamos es **rol y prompting**, no infra nueva mayor.

- **Durante:** guía de estado (ya existe), extendida con vocabulario de centros vía `adaGuidanceScripts`.
- **Post-sesión:** ADA recibe un `session_context` enriquecido (EEG agregado por fase + auto-reporte pre/post + contexto + hipótesis de la práctica) y produce la lectura de convergencia/divergencia de las tres fuentes. **Regla de prompt:** ADA siempre distingue las tres voces — la neuro (dato duro), la simbólica (marco, etiquetada como interpretación) y la honesta (qué NO cambió). Nunca afirma que un chakra se abrió; describe biomarcadores y su consistencia (o no) con la hipótesis.
- **Longitudinal:** ADA hace el "reporte de mesociclo" cruzando la serie temporal, señalando qué hipótesis pre-registradas se sostienen, cuáles no, y ajustes al plan.
- **Caveat de tier:** el análisis profundo interdisciplinario probablemente rinde mejor con el modelo pago (Claude) que con el gratuito; el selector de modelo ya existe. Vale reservar el análisis longitudinal serio para el modelo bueno.

---

## 10. Roadmap de ingeniería por fases

Estilo del doc per-channel: fases cortas con gates de aceptación falsables. Prerequisito global: **Fases 0–1 del doc per-channel** (per-channel storage) deben estar hechas, porque FAA/asimetría/topomap son insumo de este protocolo.

### Fase 0 — Fundaciones de datos (1 día)
- Migración Postgres: tabla `therapeutic_sessions`, `practices` (catálogo), `programs`, columnas de auto-reporte y agregados terapéuticos. Extender `eeg_recordings` con `session_type`.
- Measurement Influx: reusar `eeg_band_power` con tags `state` de práctica (heart_opening, etc.).
- Catálogo inicial de prácticas (§6) como seed.
- **Gate:** migración aplicada, sesiones viejas intactas, catálogo consultable.

### Fase 1 — Protocolo de sesión pre/durante/post (3–4 días)
- Máquina de estados de sesión (baseline_open → baseline_closed → práctica(s) → recovery), análoga al ValidationProtocol pero en la UI de `/lab/brain`.
- UI de auto-reporte pre/post (SAM + body-scan 7 centros + intención/profundidad).
- Captura de contexto (cronobiológico auto + cosmológico + toques manuales).
- Cómputo y persistencia de agregados terapéuticos por fase a Postgres en `stop()`.
- **Gate:** grabar 1 sesión completa que pase los 5 criterios de §7.4; auto-reporte y agregados en Postgres; delta práctica-vs-baseline visible para ≥1 biomarcador.

### Fase 2 — Modelo de perfil + motor de recomendación v1 (2–3 días)
- Entidad `PerfilSujeto` (intrínseco + extrínseco + simbólico) con carga inicial.
- Derivación de features cronobiológicas (ventana despertar) y cosmológicas (fase lunar, hora — cálculo local, sin depender de API dudosa).
- Motor de reglas legible (§5.3) que sugiere práctica + expone la razón (fisiológica vs simbólica etiquetada).
- **Gate:** dado el perfil + timestamp, el motor sugiere una práctica con razón trazable; el sujeto puede aceptar/override; la elección queda loggeada como feature.

### Fase 3 — ADA analista interdisciplinario (2–3 días)
- Prompt/rol post-sesión: recibe las 3 fuentes, produce lectura de convergencia con las tres voces (neuro/simbólica/honesta) y micro-recomendación.
- Extender `adaGuidanceScripts` con vocabulario de centros para la guía en vivo.
- **Gate:** para una sesión real, ADA produce un análisis que (a) cita ≥2 biomarcadores con su delta, (b) los conecta con la hipótesis de la práctica, (c) nombra explícitamente al menos una cosa que NO cambió. Revisión humana de calidad.

### Fase 4 — Programa longitudinal + vistas de tendencia (3–4 días)
- Entidad `ProgramaTerapeutico` con mesociclos e hipótesis pre-registradas.
- Vistas: serie longitudinal por biomarcador (estado vs rasgo), adherencia vs outcome, con bandas de variabilidad del baseline del programa.
- Reporte de mesociclo por ADA.
- **Gate:** tras ≥3 semanas de sesiones, el sistema grafica la trayectoria de ≥1 biomarcador con umbral de cambio (2σ del baseline) y ADA reporta qué hipótesis se sostiene.

### Fase 5 — HRV / coherencia cardíaca (opcional, alto valor)
- Integrar sensor de pulso/HRV (el eje "corazón" gana base fisiológica real).
- Nuevo measurement + agregados; extender mapa §6 a biomarcadores cardíacos reales.
- **Gate:** coherencia cardíaca capturada y correlacionada temporalmente con EEG en ≥1 sesión de corazón.

### Fase 6 — Testeo de hipótesis cosmológicas + IAF (backlog)
- Con N suficiente, testear si features cosmológicas (luna, estación) predicen algún biomarcador (probablemente vía sueño/adherencia). Reportar honestamente.
- IAF (Fase 7 per-channel) para personalizar banda alpha.
- **Gate:** análisis honesto publicado en el dashboard, con o sin hallazgo, sin sobre-interpretar.

---

## 11. Métricas de éxito del sistema (no del sujeto)

Cómo sabemos que el *producto* funciona, independientemente de si Pedro "abre sus chakras":

- **Validez del método (Fase 1–3):** las prácticas producen deltas de estado reproducibles vs baseline. Si no hay *ningún* delta reproducible en 4 semanas, el instrumento o el protocolo fallan — parar y revisar.
- **Consistencia de las 3 fuentes:** frecuencia con que EEG, auto-reporte y contexto convergen. Las divergencias son features, no bugs.
- **Falsabilidad ejercida:** al menos algunas hipótesis pre-registradas deben poder ser *rechazadas* por los datos. Un sistema donde todo "confirma" está roto.
- **Utilidad longitudinal:** a los 3 meses, poder responder con un gráfico preguntas que hoy no se pueden ("¿mi coherencia de corazón subió con la práctica?").

---

## 12. Riesgos y caveats

### Neurocientíficos
- **Muse = 4 canales, EEG seco:** resolución espacial pobre, EMG frontal, gamma frágil. Todo biomarcador de AF7/AF8 con caveat; gating de artefacto estricto.
- **FAA single-session marginal (Cannard 2021):** solo tendencia intra-sesión, zero-reference obligatorio.
- **N-of-1:** sin generalización; potencia estadística baja. Mitigación: baselines repetidos, pre-registro, umbral 2σ.
- **Regresión a la media / expectativa:** el sujeto está motivado (efecto expectativa alto). No lo eliminamos (es parte del efecto terapéutico) pero lo nombramos y usamos baseline propio como control.

### Epistemológicos / éticos
- **No confundir capas:** el riesgo mayor es que la UI o ADA deslicen la capa simbólica como hecho. Mitigación: regla de las tres voces, badges "hipótesis", lenguaje de biomarcador.
- **No es terapia clínica:** caveat permanente; no diagnóstico. Si aparece material psicológico difícil, ADA deriva a acompañamiento humano, no lo procesa como clínico.
- **Cosmología testeada, no vendida:** las features astrológicas se reportan como lo que los datos digan, incluso si es "no efecto".

### De producto
- **Sobrecarga de métricas:** FAA + asimetría + coherencia + índice sintérgico + HRV + 7 centros = dashboard ilegible. Mitigación: "métrica del día" en el resumen, resto detrás de "análisis avanzado" (mismo principio que el doc per-channel).
- **Fricción del auto-reporte:** si pre/post es pesado, baja la adherencia. Mantener <90s cada uno.

---

## 13. Referencias

**Neurociencia de la meditación:**
- Lutz, A., Greischar, L., Rawlings, N., Ricard, M., & Davidson, R.J. (2004). Long-term meditators self-induce high-amplitude gamma synchrony during mental practice. *PNAS*.
- Cahn, B.R., & Polich, J. (2006). Meditation states and traits: EEG, ERP, and neuroimaging studies. *Psychological Bulletin*.
- Klimesch, W. (1999). EEG alpha and theta oscillations reflect cognitive and memory performance. *Brain Research Reviews*.
- Vieten, C., Wahbeh, H., Cahn, B.R., Fannin, J., et al. (2020). Large effects of brief meditation intervention on EEG spectra in meditation novices. *IBRO Reports*. — [estudio del grupo asociado a Dispenza]
- Cannard, C., et al. (2021). Validating the Muse headband for research-grade EEG. *Journal of Neural Engineering*.
- Davidson, R.J. (1992). Anterior cerebral asymmetry and the nature of emotion. *Brain and Cognition*.

**Marcos integrados / consciencia:**
- Dispenza, J. (2017). *Becoming Supernatural*. Hay House. — Blessing of the Energy Centers, coherencia cerebro-corazón.
- Grinberg-Zylberbaum, J. *La teoría sintérgica*. — campo neuronal, lattice, sintergia, potencial transferido. [Estatus: no replicado/marginado — se toma como marco simbólico, no como validación.]

**Cronobiología:**
- Literatura sobre respuesta de cortisol al despertar (CAR), ritmo circadiano de temperatura/alerta y melatonina — base fisiológica del timing de prácticas.

**Ingeniería (stack propio):**
- `prox-implementacion-mas-canales-PER-CHANNEL-EEG-STORAGE.md` — prerequisito de FAA/asimetría/topomap.
- `AdaRealtimePanel.jsx`, `adaGuidanceScripts` — copiloto en tiempo real y guía adaptativa.
- `validation_protocol.py`, `validate_recording.py` — patrón de protocolo por fases y validación.
- InfluxDB (hot 30d) + Postgres (cold) — arquitectura de persistencia.

---

## Apéndice A — Resumen de decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Epistemología | EEG como verdad de terreno; simbólico = hipótesis | Sostiene marco espiritual Y rigor científico |
| Diseño experimental | N-of-1 longitudinal, pre-registrado | Un sujeto, replicación temporal, falsabilidad |
| Fuentes de verdad | EEG + auto-reporte + contexto (3) | El EEG no captura fenomenología |
| Persistencia | per-window→Influx, agregados→Postgres | Reusa patrón existente; sobrevive retention 30d |
| Motor de recomendación | Reglas legibles + cronobiología primero | Trazable; evita caja negra prematura |
| Cosmología/astrología | Feature contextual testeable, no descarte | Convierte dogma en hipótesis medible |
| Prerequisito técnico | Per-channel storage Fase 0–1 | FAA/asimetría son insumo core |
| Rol de ADA | Analista de 3 voces (neuro/simbólica/honesta) | Nunca afirma mecanismo; describe convergencia |