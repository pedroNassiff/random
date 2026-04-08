# Plan de Estudio del Cerebro — De Aprendiz a Explorador de Fronteras

**Random Lab · Pedro Nassiff · Marzo 2026**

> *"El cerebro no genera la conciencia de la misma forma que una radio no genera la música."*  
> Inspirado en las mejores tradiciones de MIT, Stanford, UCL, Caltech, Max Planck, y los laboratorios que se atreven a ir más allá.

---

## Filosofía de este plan

Este no es un plan para aprobar exámenes. Es un plan para **entender el cerebro con las manos, con código, con electrodos, con meditación, y con preguntas que nadie se atreve a hacer**.

**Principios rectores:**

1. **Aprender haciendo**: Cada bloque teórico termina en un experimento o implementación real
2. **Romper cajas**: Combinamos neurociencia dura con tradiciones contemplativas, nadie tiene el monopolio del conocimiento sobre la mente
3. **Medir todo**: Si no lo podés medir, no lo podés mejorar. Tu Muse 2 es tu microscopio personal
4. **Diario de laboratorio**: Documentar CADA insight, CADA dato raro, CADA contradicción. Ahí nacen los descubrimientos
5. **Ciclo: Estudiar → Hipótesis → Experimentar → Medir → Cuestionar → Repetir**

---

## Estructura general

```
FASE 0 ─ Cimientos (4 semanas)
   La máquina biológica: neurona, sinapsis, circuitos

FASE 1 ─ El Cerebro Eléctrico (4 semanas)
   EEG, oscilaciones, ritmos, procesamiento de señales

FASE 2 ─ Sistemas y Cognición (6 semanas)
   Percepción, memoria, atención, emoción, toma de decisiones

FASE 3 ─ Conciencia y Estados Alterados (6 semanas)
   El problema duro, meditación, sueño, psicodélicos, NDE

FASE 4 ─ Neurociencia Computacional (4 semanas)
   Modelos del cerebro, redes neuronales biológicas, información

FASE 5 ─ La Frontera (6 semanas)
   Coherencia cuántica, campo neuronal, Grinberg, correlación no-local

FASE 6 ─ Tu Laboratorio (continuo)
   Protocolos propios, VAE sintérgico, publicación
```

**Tiempo total estimado**: 30 semanas (~7 meses)  
**Dedicación recomendada**: 2-3 horas/día (estudio + lab)  
**No es lineal**: Fases 3 y 4 pueden hacerse en paralelo

---

## FASE 0: CIMIENTOS — La Máquina Biológica

> *Curso equivalente: MIT 9.01 (Introduction to Neuroscience), Stanford NBIO 206*

**Objetivo**: Entender la unidad fundamental — la neurona — y cómo billones de ellas crean la mente.

### Semana 1-2: La Neurona

**Teoría:**
- Anatomía neuronal: soma, dendritas, axón, mielina, terminales sinápticas
- Potencial de membrana en reposo (-70mV) — ¿por qué la neurona es una batería?
- Potencial de acción: umbral, despolarización, repolarización, periodo refractario
- Canales iónicos: Na⁺, K⁺, Ca²⁺, Cl⁻ — las compuertas moleculares
- Ecuación de Nernst y Goldman — la física detrás del voltaje neuronal
- Velocidad de conducción: mielina como aislante, nodos de Ranvier

**Recursos principales:**
- 📖 **"Neuroscience: Exploring the Brain"** — Bear, Connors, Paradiso (4th ed) — Caps 2-4
  - EL libro estándar. Claro, visual, profundo sin ser impenetrable
- 🎥 **MIT OCW 9.01** — Lectures 1-6 (disponibles gratis en MIT OpenCourseWare)
- 🎥 **Khan Academy: Nervous System** — Para consolidar fundamentos rápido
- 📄 **Hodgkin & Huxley (1952)** — "A quantitative description of membrane currents"
  - EL paper que ganó el Nobel. Leerlo es tocar la historia de la neurociencia

**Lab 0.1 — Simulador de neurona:**
```python
# Implementar el modelo de Hodgkin-Huxley simplificado
# Input: corriente inyectada
# Output: tren de potenciales de acción
# Herramienta: Python + matplotlib
# Objetivo: VER cómo el voltaje dispara, entender threshold, frecuencia de disparo
# BONUS: Modificar parámetros y ver qué pasa cuando "enfermas" la neurona
```

**Lab 0.2 — Tu primera señal real:**
- Conectar Muse 2
- Grabar 2 minutos ojos abiertos vs ojos cerrados
- Visualizar raw signal de los 4 canales
- Pregunta: ¿Ves la diferencia a ojo entre los dos estados? ¿Qué canal cambia más?

### Semana 3-4: Sinapsis, Neurotransmisores y Circuitos

**Teoría:**
- Sinapsis química: vesículas, hendidura sináptica, receptores post-sinápticos
- Sinapsis eléctrica: gap junctions — comunicación directa, más rápida
- Neurotransmisores clave:
  - **Glutamato**: excitador #1, ~80% de las sinapsis, base del aprendizaje
  - **GABA**: inhibidor #1, freno del cerebro, deficiencia → ansiedad/epilepsia
  - **Dopamina**: no es "placer", es **predicción de recompensa** y señal de error
  - **Serotonina**: modulación del estado de ánimo, crucial en psicodélicos (5-HT2A)
  - **Acetilcolina**: atención, memoria, interfaz neuro-muscular
  - **Noradrenalina**: alerta, estrés, señal de urgencia
- Plasticidad sináptica: LTP y LTD — cómo el cerebro aprende
- Regla de Hebb: "Neurons that fire together, wire together"
- Circuitos básicos: feedforward, feedback, lateral inhibition, recurrencia

**Recursos:**
- 📖 Bear — Caps 5-8
- 🎥 **Stanford BIO 150 (Robert Sapolsky)** — "Human Behavioral Biology" (Lectures 1-5)
  - Sapolsky es probablemente el mejor comunicador de neurociencia que existe. VER TODO.
- 📄 **Bliss & Lømo (1973)** — Primer paper describiendo LTP en hipocampo
  - El mecanismo celular de la memoria

**Lab 0.3 — Mapa de neurotransmisores:**
- Crear un diagrama de flujo personal que mapee:
  - Neurotransmisor → Receptor → Efecto → Estado mental → Medible en EEG?
  - Ejemplo: Serotonina → 5-HT2A → Inhibición de default mode → ¿Gamma aumenta?

**Lab 0.4 — Plasticidad en acción:**
- Protocolo: 5 días × 10 minutos de meditación (mismo horario)
- Grabar cada sesión con Muse 2
- Pregunta: ¿Cambia algo entre el día 1 y el día 5? ¿El alpha aparece más rápido?
- Esto ES plasticidad observable en tiempo real

**Autoevaluación Fase 0:**
- [ ] Puedo dibujar una neurona completa con todas sus partes
- [ ] Puedo explicar un potencial de acción paso a paso
- [ ] Entiendo la diferencia entre sinapsis excitatoria e inhibitoria
- [ ] Puedo nombrar 6 neurotransmisores y su función principal
- [ ] Implementé un modelo HH básico en Python
- [ ] Tengo mis primeras grabaciones EEG con Muse

---

## FASE 1: EL CEREBRO ELÉCTRICO

> *Curso equivalente: UCL Neuroimaging Methods, MIT 9.29 (Intro to Computational Neuroscience)*

**Objetivo**: Dominar las oscilaciones cerebrales — qué son, cómo se generan, cómo medirlas, cómo procesarlas. Este es TU dominio como constructor del prototipo sintérgico.

### Semana 5-6: Oscilaciones y Ritmos Cerebrales

**Teoría:**
- ¿De dónde vienen las oscilaciones? No de una neurona, sino de **poblaciones neuronales sincronizadas**
- Generadores de ritmo: 
  - Tálamo como "marcapasos" (spindles, alpha)
  - Corteza como generador de gamma
  - Hipocampo como generador de theta
- Las 5 bandas a profundidad:
  - **Delta (0.5-4 Hz)**: Sueño profundo, reparación. Generado por neuronas talamocorticales en burst mode.
  - **Theta (4-8 Hz)**: Navegación espacial (place cells), memoria episódica, meditación. Marcapasos en septum medial.
  - **Alpha (8-13 Hz)**: "Idling" cortical, inhibición activa, ojos cerrados. Efecto Berger. Circuito tálamo-cortical.
  - **Beta (13-30 Hz)**: Mantenimiento del estado motor, pensamiento analítico, "status quo" cerebral. GABAérgico.
  - **Gamma (30-100+ Hz)**: Binding problem, consciencia, atención selectiva. Interneurones PV+.
- Cross-frequency coupling: theta-gamma coupling en memoria de trabajo
- Coherencia inter-hemisférica: medida de integración bilateral
- Phase-Amplitude Coupling (PAC): gamma "cabalga" sobre theta

**Recursos:**
- 📖 **"Rhythms of the Brain"** — György Buzsáki (2006)
  - EL LIBRO sobre oscilaciones cerebrales. Buzsáki es la autoridad mundial. Denso pero transformador.
- 📖 **"Electric Fields of the Brain"** — Paul Nunez — Para la física del EEG
- 🎥 **Buzsáki Lab lectures** (YouTube) — Buscar "Buzsáki theta gamma"
- 📄 **Berger (1929)** — "Über das Elektrenkephalogramm des Menschen"
  - El paper original del EEG. 96 años después seguimos usando lo que descubrió.
- 📄 **Engel et al. (2001)** — "Dynamic predictions: Oscillations and synchrony in top-down processing"

**Lab 1.1 — Berger Effect personal:**
```
Protocolo:
1. Muse 2 conectado, grabar EEG raw
2. 2 min ojos abiertos → 2 min ojos cerrados → 2 min ojos abiertos
3. Calcular power spectral density (PSD) por fase
4. Graficar: ¿hay un pico en 8-13 Hz que aparece/desaparece?
5. Calcular alpha ratio (cerrados/abiertos) 
6. Si ratio > 1.3, tu pipeline funciona. Si ratio < 1.1, algo anda mal.
```

**Lab 1.2 — Mapa de frecuencias personal:**
- Grabar 5 condiciones, 3 min cada una:
  1. Ojos cerrados relajado
  2. Cálculo mental (restar de 7 en 7 desde 1000)
  3. Escuchar música que te emocione
  4. Meditación enfocada en respiración
  5. Mind wandering libre
- Para cada condición: PSD completa, band powers, coherencia L/R
- Resultado: tu "fingerprint" cognitivo. Único como tu huella digital.

### Semana 7-8: Procesamiento de Señales EEG

**Teoría:**
- Transformada de Fourier: descomponer señal en frecuencias (FFT)
- Welch's method: PSD robusta con ventanas solapadas
- Filtros: pasabanda, notch (60Hz), highpass (0.5Hz para eliminar drift)
- Artefactos: parpadeos (frontal), movimiento muscular (temporal), movimiento de electrodos
- Análisis de componentes independientes (ICA): separar fuentes
- Phase Locking Value (PLV): coherencia basada en fase instantánea
- Transformada Wavelet: resolución tiempo-frecuencia (mejor que FFT pura para no-estacionarios)
- Hilbert transform: envelope y fase instantánea
- Spectral entropy: medida de "desorden" frecuencial

**Recursos:**
- 📖 **"Analyzing Neural Time Series Data"** — Mike X Cohen (2014)
  - EL MEJOR libro para procesamiento de señales EEG. Práctico, con código MATLAB/Python. ESENCIAL.
- 🎥 **Mike X Cohen — YouTube channel** — Videos cortos y claros sobre cada método
- 📖 **"Signal Processing for Neuroscientists"** — Wim van Drongelen
- 🔧 **MNE-Python** (mne.tools) — Librería open source de referencia para EEG en Python

**Lab 1.3 — Implementar tu propio analizador espectral:**
```python
# No usar librerías de alto nivel. Implementar desde cero:
# 1. FFT con numpy.fft
# 2. Welch's con ventanas de Hanning
# 3. Extracción de band powers
# 4. Comparar tu resultado con scipy.signal.welch
# Objetivo: entender QUÉ HACE tu código, no solo usarlo
```

**Lab 1.4 — PLV desde cero:**
```python
# Implementar Phase Locking Value:
# 1. Filtrar señal en banda alpha (8-13 Hz)
# 2. Hilbert transform para obtener fase instantánea
# 3. Calcular PLV entre canal L y R
# 4. Validar: PLV de señales idénticas = 1.0, señales random ≈ 0
# Esto es lo que tu MuseToSyntergicAdapter usa para coherence
```

**Lab 1.5 — Detección de artefactos:**
- Grabar 5 min con Muse: incluir deliberadamente parpadeos, apretar mandíbula, mover cabeza
- Identificar artefactos en la señal raw
- Implementar detector básico: threshold de amplitud + varianza por ventana
- Conectar con tu `avg_quality` metric del pipeline

**Autoevaluación Fase 1:**
- [ ] Puedo explicar el origen biológico de cada banda de frecuencia
- [ ] Implementé FFT, Welch, y PLV desde cero
- [ ] Tengo mi fingerprint cognitivo personal con 5+ condiciones
- [ ] Validé el Berger Effect con mi propia data
- [ ] Puedo detectar artefactos en señal EEG raw
- [ ] Entiendo la diferencia entre coherencia, PLV, y MSC

---

## FASE 2: SISTEMAS Y COGNICIÓN

> *Curso equivalente: Stanford PSYCH 1 (Mind and Brain), Harvard PSY 1, UCL Cognitive Neuroscience*

**Objetivo**: Entender los grandes sistemas del cerebro — cómo percibimos, recordamos, sentimos, decidimos. Esto es lo que tu Guía Sintérgico necesita saber para interpretar estados.

### Semana 9-10: Percepción y Atención

**Teoría:**
- La percepción NO es pasiva — el cerebro **construye** la realidad
- Predictive coding: el cerebro predice y solo procesa el error (Karl Friston, Free Energy Principle)
- Binding problem: ¿cómo integramos color, forma, movimiento en un objeto unificado? (gamma synchrony)
- Bottom-up vs top-down attention
- Redes atencionales: dorsal (voluntaria) y ventral (captura por estímulo)
- Inattentional blindness: si no prestás atención, NO VES (gorilla invisible)
- Percepción multisensorial: integración cross-modal
- **Conexión sintérgica**: La percepción como distorsión del Lattice por el campo neuronal

**Recursos:**
- 📖 **"Principles of Neural Science"** — Kandel, Schwartz, Jessell (6th ed) — Caps sobre percepción
  - EL textbook definitivo. 1700 páginas del todo. Para consulta, no lectura lineal.
- 📖 **"The Predictive Mind"** — Jakob Hohwy — Free Energy Principle explicado claro
- 🎥 **Anil Seth TED Talk**: "Your brain hallucinates your conscious reality"
- 📄 **Friston (2010)** — "The free-energy principle: a unified brain theory?"

**Lab 2.1 — Atención y alpha:**
```
Protocolo:
1. Sentado frente a pantalla con cruz de fijación
2. 3 min: Atención focalizada en la cruz (concentración máxima)
3. 3 min: Mind wandering (dejar la mente ir)
4. 3 min: Atención abierta (awareness difuso, sin foco)
Medir: Alpha (debe ser DIFERENTE en cada condición)
Hipótesis: Alpha alta en wandering, baja en focalizada, media en abierta
```

**Lab 2.2 — Ilusión perceptual + EEG:**
- Ver la ilusión "Necker cube" (cubo ambiguo)
- Grabar EEG mientras la percepción "flipea" entre interpretaciones
- Pregunta: ¿hay un correlato eléctrico del cambio de percepción?
- Papers relevantes: Kornmeier & Bach (2012) — ERP correlates of perceptual reversals

### Semana 11-12: Memoria y Aprendizaje

**Teoría:**
- Tipos de memoria: declarativa (episódica + semántica) vs procedural
- Hipocampo: creador de mapas (place cells, grid cells) y consolidador de memoria
- Consolidación en sueño: replay de secuencias hipocampales durante SWS
- Theta-gamma coupling: mecanismo de memory encoding
- Memoria de trabajo: prefrontal cortex, capacidad ~4 items, sostenida por gamma
- Reconsolidación: cada vez que recordás, reescribís (implicaciones enormes)
- Neuroplasticidad: mapa cortical moldeable, London taxi drivers (Maguire 2000)
- Engrams: ¿dónde se guarda un recuerdo? (Tonegawa, MIT — optogenetics)

**Recursos:**
- 📖 Bear — Caps 24-25
- 📖 **"In Search of Memory"** — Eric Kandel (autobiografía + ciencia, Nobel 2000)
- 🎥 **Stanford lectures by Sapolsky** — Memory lectures
- 📄 **O'Keefe & Dostrovsky (1971)** — Place cells en hipocampo
- 📄 **Maguire et al. (2000)** — Hipocampo más grande en taxistas de Londres

**Lab 2.3 — Theta y memoria:**
```
Protocolo:
1. Presentar lista de 20 palabras (5s cada una)
2. Medir theta frontal durante encoding
3. Test de recall libre después de 10 min
4. Correlacionar: ¿las palabras codificadas con mayor theta se recuerdan mejor?
Nota: Necesitas presentación automática — hacer script simple
```

### Semana 13-14: Emoción y Sistema Límbico

**Teoría:**
- Amígdala: detector de relevancia (no solo miedo, también positivo)
- Ínsula: interoception — sentir el cuerpo desde adentro (latido cardíaco, respiración)
- Corteza prefrontal medial: evaluación emocional, self-referencing
- Eje HPA: hipotálamo → pituitaria → adrenal → cortisol (estrés)
- Vagal tone: nervio vago y regulación autonómica (heart rate variability)
- Emociones como procesos predictivos (Lisa Feldman Barrett: constructed emotions)
- Alpha frontal asymmetry: lateralización emocional (approach vs withdrawal)
- **Conexión con tu proyecto**: Alpha asymmetry es una de tus 24 features del MuseVAE

**Recursos:**
- 📖 **"How Emotions Are Made"** — Lisa Feldman Barrett
  - Revolucionario. Destruye la idea de "emociones básicas universales". Polémico y brillante.
- 📖 **"The Body Keeps the Score"** — Bessel van der Kolk
  - Trauma, cuerpo, neurociencia. Imprescindible para entender la conexión mente-cuerpo.
- 🎥 **Lisa Feldman Barrett — "You aren't at the mercy of your emotions"** (TED)
- 📄 **Davidson (2004)** — "What does the prefrontal cortex do in affect?"

**Lab 2.4 — Alpha asymmetry emocional:**
```
Protocolo:
1. Baseline 3 min ojos cerrados
2. Recordar algo muy positivo (3 min) — medir AF7 vs AF8
3. Baseline 2 min
4. Recordar algo estresante (3 min) — medir AF7 vs AF8
5. Calcular: log(AF8_alpha) - log(AF7_alpha) por condición
Hipótesis: Asimetría positiva (más alpha derecho) en estado positivo
Esto alimenta directamente tu feature de "frontal alpha asymmetry" del VAE
```

**Lab 2.5 — Heart Rate Variability + EEG:**
- Si tenés Apple Watch o sensor HR: medir HRV simultáneamente con EEG
- Pregunta: ¿La coherencia cardíaca (respiración 4-7-8) correlaciona con alpha increase?
- Esto conecta con tu idea de "regulación autonómica previa" para meditación

### Semana 15-16: Toma de Decisiones y Default Mode Network

**Teoría:**
- Default Mode Network (DMN): mPFC + PCC + angular gyrus — activa cuando NO hacés nada
- DMN = generador de self-narrative, mind wandering, rumination
- Task-Positive Network (TPN): activa durante tareas — anticorrelada con DMN
- DMN-TPN balance: marcador de salud mental
- Decisiones: no son racionales. Heurísticas, sesgos, emoción guía la razón
- Neuroeconomía: dopamina como señal de reward prediction error (Schultz 1997)
- Free will debate: Libet experiment (readiness potential 500ms antes de decisión consciente)
- **Conexión sintérgica**: El DMN como "ruido" que distorsiona el campo neuronal. Meditación reduce DMN → campo más coherente → mejor acceso al Lattice.

**Recursos:**
- 📖 **"Thinking, Fast and Slow"** — Daniel Kahneman
- 📖 **"The Self Illusion"** — Bruce Hood
- 📄 **Raichle (2001)** — "A default mode of brain function" (paper fundacional del DMN)
- 📄 **Brewer et al. (2011)** — "Meditation reduces DMN activity" (paper clave para tu proyecto)
- 📄 **Libet (1983)** — "Time of conscious intention to act"

**Lab 2.6 — DMN vs task:**
```
Protocolo:
1. 3 min: hacer nada (DMN activo)
2. 3 min: N-back task (2-back, app gratuita)
3. 3 min: meditación open awareness
Medir: alpha/theta ratio, coherencia
Hipótesis: Condición 1 y 3 deberían ser diferentes — el DMN se reduce en meditación
pero NO necesariamente se reemplaza por task-positive. Es un tercer estado.
```

**Autoevaluación Fase 2:**
- [ ] Puedo explicar predictive coding y Free Energy Principle
- [ ] Entiendo los sistemas de memoria y el rol del hipocampo
- [ ] Implementé y medí alpha asymmetry frontal
- [ ] Entiendo qué es el DMN y por qué importa para meditación
- [ ] Hice al menos 3 de los 6 labs con data real de mi Muse

---

## FASE 3: CONCIENCIA Y ESTADOS ALTERADOS

> *Curso equivalente: NYU Consciousness Seminar (Chalmers), Sussex Sackler Centre (Anil Seth), Wisconsin Center for Investigating Healthy Minds (Davidson)*

**Objetivo**: Enfrentar el problema más grande de la ciencia — la conciencia — y explorar sus estados extremos. Aquí es donde la ciencia convencional se pone incómoda. Perfecto.

### Semana 17-18: El Problema de la Conciencia

**Teoría:**
- **Hard Problem** (Chalmers 1995): ¿Por qué HAY experiencia subjetiva? ¿Por qué no somos zombies filosóficos?
- Teorías competidoras:
  - **Integrated Information Theory (IIT)** — Giulio Tononi: Φ (phi) como medida de conciencia. Conciencia = información integrada. Panpsychism lite.
  - **Global Workspace Theory (GWT)** — Baars/Dehaene: Conciencia = broadcasting global. Ignition neural. Medible con EEG (P300, gamma global).
  - **Higher-Order Theories** — Lau, Rosenthal: Conciencia = representación de representación. Meta-cognición.
  - **Predictive Processing** — Seth, Clark: Conciencia = modelo predictivo con precisión óptima. "Controlled hallucination."
  - **Orchestrated Objective Reduction (Orch-OR)** — Penrose & Hameroff: Conciencia emerge de colapso cuántico en microtúbulos. Controversial. Fascinante.
  - **Teoría Sintérgica** — Grinberg: Conciencia = interacción campo neuronal ↔ Lattice. El campo coherente colapsa la información del Lattice en experiencia.
- Neural Correlates of Consciousness (NCC): ¿qué actividad cerebral acompaña experiencia consciente?
- No-Report Paradigms: medir conciencia sin pedir reporte (evitar sesgo de reporte)

**Recursos:**
- 📖 **"The Conscious Mind"** — David Chalmers (1996) — El libro que definió el Hard Problem
- 📖 **"Being You"** — Anil Seth (2021) — Predictive processing de la conciencia. Accesible y profundo.
- 📖 **"Phi: A Voyage from the Brain to the Soul"** — Giulio Tononi — IIT como narrativa. Bellísimo.
- 📖 **"Shadows of the Mind"** — Roger Penrose — Orch-OR. Física + conciencia.
- 🎥 **Chalmers "How do you explain consciousness?"** (TED)
- 🎥 **Tononi lectures on IIT** (YouTube, ASSC conferences)
- 📄 **Chalmers (1995)** — "Facing up to the problem of consciousness"
- 📄 **Tononi (2004)** — "An information integration theory of consciousness"
- 📄 **Dehaene & Changeux (2011)** — "Experimental and theoretical approaches to conscious processing"

**Lab 3.1 — Midiendo phi (simplificada):**
```
- No vas a calcular Φ real (computacionalmente intratable), pero sí una proxy:
- Lempel-Ziv Complexity de la señal EEG
- LZC es mayor en estados conscientes que inconscientes (Casali et al. 2013)
- Implementar LZC para tu señal Muse
- Comparar: vigilia vs somnolencia vs meditación profunda
- ¿Cuál tiene mayor complejidad?
```

**Lab 3.2 — Mapa de teorías:**
- Crear una tabla comparativa de las 6 teorías:
  | Teoría | Predicción medible | ¿Compatible con EEG? | ¿Compatible con Grinberg? |
- FORZARTE a pensar: ¿Tu pipeline sintérgico qué teoría favorece implícitamente?

### Semana 19-20: Meditación — La Neurociencia te Dice que Funciona

**Teoría:**
- Taxonomía de Travis & Shear (2010): 3 categorías con firmas EEG distintas:
  1. **Focused Attention (FA)**: Shamatha, concentración en objeto. Beta frontal, theta.
  2. **Open Monitoring (OM)**: Vipassana, awareness sin objeto. Theta frontal, gamma.
  3. **Automatic Self-Transcending (AST)**: Meditación Trascendental, mantra. Alpha1 global, coherencia frontal alta.
- Cambios estructurales confirmados por MRI:
  - Corteza prefrontal más gruesa (Lazar et al. 2005)
  - Más materia gris en hipocampo (Hölzel et al. 2011)
  - Reducción de amígdala (Desbordes et al. 2012)
- Cambios funcionales:
  - Reducción DMN (Brewer et al. 2011)
  - Aumento gamma sostenido en meditadores avanzados (Lutz et al. 2004 — monjes tibetanos)
  - Coherencia inter-hemisférica aumentada
  - Theta frontal "mindfulness signature"
- Dosis-respuesta: 8 semanas × 27 min/día = cambios estructurales medibles (MBSR)
- Long-term meditators (>10,000 hrs): gamma permanentemente elevado, incluso en sueño

**Recursos:**
- 📖 **"Altered Traits"** — Daniel Goleman & Richard Davidson (2017)
  - Revisión exhaustiva de la ciencia de la meditación. Separa hype de evidencia. ESENCIAL.
- 📖 **"The Mind Illuminated"** — Culadasa (John Yates, PhD neuroscience)
  - Fusión perfecta de neurociencia y meditación práctica. Modelo de 10 stages.
- 📖 **"Waking Up"** — Sam Harris — PhD neuroscience + meditador serio
- 📄 **Lutz et al. (2004)** — Gamma sostenido en monjes. El paper que legitimizó la meditación en ciencia.
- 📄 **Fox et al. (2014)** — Meta-análisis de cambios cerebrales por meditación (21 estudios)
- 📄 **Brandmeyer & Delorme (2018)** — Firmas EEG de meditación: revisión comprehensiva

**Lab 3.3 — Clasificación de tu meditación:**
```
Gran experimento personal:
1. 3 sesiones de Focused Attention (respiración)
2. 3 sesiones de Open Monitoring (awareness sin objeto)
3. 3 sesiones de "letting go" (tipo AST)
Cada sesión: 10 min, con Muse, misma hora del día

Análisis:
- PSD por sesión → ¿Se diferencian las firmas?
- Coherencia por sesión → ¿AST tiene mayor coherencia?
- Theta frontal → ¿OpenMonitoring tiene más theta?
- Mapear tus datos contra Travis & Shear (2010)

PREGUNTA CLAVE: ¿Tu pipeline puede distinguir los 3 tipos?
Si sí → evidencia de que tu sistema es sensible y válido
Si no → revisar features o pipeline
```

**Lab 3.4 — Sesión de 45 minutos (deep sit):**
- Sentarse 45 min con EEG grabando continuamente
- No mover. Sin instrucción específica. Solo sentarse.
- Analizar: ¿hay una "transición" clara? ¿En qué minuto?
- Los estudios muestran que ~20-25 min es el punto de inflexión para meditadores intermedios
- Graficar alpha/theta/gamma como timeseries continuo

### Semana 21-22: Sueño, Psicodélicos y Estados Extremos

**Teoría:**

**Sueño:**
- Arquitectura del sueño: NREM1 → NREM2 → NREM3 (SWS) → REM → repetir
- Sleep spindles: ráfagas de 12-14 Hz en NREM2, generadas por tálamo
- Slow Wave Sleep: delta masiva, consolidación de memoria, "lavado" de toxinas (glymphatic)
- REM: theta hipocampal, soñar, integración emocional
- Lucid dreaming: gamma en REM, awareness dentro del sueño (Voss et al. 2009)
- Sleep onset: hypnagogic states — theta dominante, alucinaciones hipnagógicas

**Psicodélicos (neurociencia, no uso):**
- Psilocibina: agonista 5-HT2A → disruption de Default Mode Network
- Entropic Brain Hypothesis (Carhart-Harris 2014): psicodélicos aumentan entropía neural
- Claustrum: posible "switch de conciencia" — psicodélicos lo afectan directamente
- Relaxed Beliefs Under Psychedelics (REBUS): psicodélicos relajan los priors del predictive processing
- Conexión con meditación: ambos reducen DMN, aumentan entropía, facilitarían acceso a Lattice
- LSD + EEG: aumento de connectivity global, reducción de alpha, aumento diversidad de señal

**Estados extremos:**
- Near Death Experiences: gamma surge masiva tras paro cardíaco (Borjigin 2013)
- Flow states: theta-alpha border, reducción de PFC (transient hypofrontality)
- Anestesia: pérdida de integración global (IIT predicho, GWT predicho)

**Recursos:**
- 📖 **"Why We Sleep"** — Matthew Walker — La ciencia del sueño, accesible
- 📖 **"How to Change Your Mind"** — Michael Pollan — Psicodélicos y neurociencia
- 📄 **Carhart-Harris et al. (2014)** — "The entropic brain: a theory of conscious states informed by neuroimaging research with psychedelic drugs"
- 📄 **Voss et al. (2009)** — "Lucid dreaming: a state of consciousness with features of both waking and non-lucid dreaming"
- 📄 **Borjigin et al. (2013)** — "Surge of neurophysiological coherence and connectivity in the dying brain"

**Lab 3.5 — Hipnagogia:**
```
El estado justo antes de dormirte es FASCINANTE y medible:
1. Acostarte con Muse puesto
2. Grabar mientras te dormís (sí, es incómodo, pero vale la pena)
3. Buscar: transición de alpha → theta → theta dominante con spindle-like bursts
4. ¿Podés detectar el momento exacto de "sleep onset"?
5. Si lográs este lab exitosamente, tenés datos únicos.
```

**Lab 3.6 — Entropía como estado de conciencia:**
```python
# Implementar Lempel-Ziv Complexity y Spectral Entropy
# Medir en 4 condiciones:
# 1. Vigilia normal
# 2. Meditación
# 3. Cálculo mental
# 4. Somnolencia (si lográs lab 3.5)
# Hipótesis (Carhart-Harris): Meditación profunda ≈ entropía intermedia
# Ni muy baja (sueño) ni muy alta (psicodélico)
# ¿Tus datos lo confirman?
```

**Autoevaluación Fase 3:**
- [ ] Puedo explicar al menos 4 teorías de la conciencia y sus predicciones
- [ ] Classifiqué mis meditaciones según Travis & Shear con data real
- [ ] Implementé medidas de complejidad (LZC, spectral entropy)
- [ ] Entiendo la Entropic Brain Hypothesis y cómo se conecta con Grinberg
- [ ] Hice al menos una sesión larga (>30 min) con análisis completo

---

## FASE 4: NEUROCIENCIA COMPUTACIONAL

> *Curso equivalente: MIT 9.40 (Computational Neuroscience), Gatsby Unit UCL, Janelia Research Campus*

**Objetivo**: Modelar el cerebro computacionalmente. Esto conecta directamente con tu VAE, tus redes neuronales, y tu pipeline de inferencia.

### Semana 23-24: Modelos Neuronales y Redes

**Teoría:**
- Modelos de neurona: 
  - Integrate-and-fire (simple, útil)
  - Izhikevich (buen balance realismo/simplicidad)
  - Hodgkin-Huxley (realista, pesado)
- Redes recurrentes: attractors, memory, oscillations
- Hopfield networks: memoria asociativa, attractors
- Hebbian learning: unsupervised, correlational
- Spike-timing dependent plasticity (STDP): timing matters (±20ms window)
- Population coding: la información está en la actividad conjunta, no en neuronas individuales
- Neural manifolds: actividad neural como trayectoria en espacio de alta dimensión
- Variational Autoencoders en neurociencia: compresión de actividad neural (¡tu MuseVAE!)

**Recursos:**
- 📖 **"Theoretical Neuroscience"** — Dayan & Abbott — EL textbook de comp neuro
- 📖 **"Neuronal Dynamics"** — Gerstner et al. — Disponible GRATIS online: neuronaldynamics.epfl.ch
- 🎥 **Neuromatch Academy** (neuromatch.io) — Curso intensivo de comp neuro, notebooks interactivos, GRATIS
- 📄 **Izhikevich (2003)** — "Simple model of spiking neurons" — modelo elegante
- 📄 **Sussillo (2014)** — "Neural circuits as computational dynamical systems" — manifolds

**Lab 4.1 — Red oscilatoria:**
```python
# Construir una red de 100 neuronas Izhikevich
# Con conexiones excitatorias (80%) e inhibitorias (20%)
# Observar: ¿la red genera oscilaciones espontáneas?
# Variar parámetros: ¿podés generar alpha? ¿gamma?
# Esto te enseña DE DÓNDE vienen los ritmos que medís
```

**Lab 4.2 — Tu VAE como neurocientífico computacional:**
```
Tomar tu MuseVAE (latent_dim=8) y:
1. Entrenar con tus sesiones reales (mínimo 10 sesiones)
2. Visualizar el latent space con t-SNE o UMAP
3. Colorear por fase del protocolo (baseline, meditación, cognitive)
4. Pregunta: ¿los estados mentales forman clusters?
5. Si sí → el VAE aprendió representaciones significativas
6. Si no → revisar features o architecture
Esto valida que tu AI está aprendiendo algo real sobre tu cerebro
```

### Semana 25-26: Teoría de la Información y el Cerebro

**Teoría:**
- Información de Shannon: H = -Σ p(x) log p(x)
- Mutual Information: cuánto sabe X sobre Y
- Transfer Entropy: causalidad direccional basada en información
- Información integrada (Φ de Tononi): intentos de formalizar conciencia
- Efficient coding hypothesis: el cerebro maximiza información por spike
- Predictive Information: la información útil es la que predice el futuro
- Free Energy Principle (Friston): el cerebro minimiza sorpresa (free energy)
- Información y coherencia: sistemas más coherentes transmiten más información con menos redundancia
- **Conexión sintérgica**: La coherencia del campo neuronal como maximización de información integrada, que permite "leer" más del Lattice

**Recursos:**
- 📖 **"Information Theory, Inference and Learning Algorithms"** — David MacKay — Gratis online
- 📖 **"An Introduction to Transfer Entropy"** — Bossomaier et al.
- 🎥 **3Blue1Brown** — Videos sobre información y entropía (YouTube, excelentes visualizaciones)
- 📄 **Timme & Lapish (2018)** — "A Tutorial for Information Theory in Neuroscience"
- 📄 **Friston (2010)** — "The free-energy principle: a unified brain theory?"

**Lab 4.3 — Transfer entropy en tu EEG:**
```python
# Implementar Transfer Entropy entre hemisferios:
# TE(L→R) vs TE(R→L)
# ¿Hay asimetría? ¿Cambia con el estado?
# En meditación: ¿fluye más información de R→L (hemisferio "holístico")?
# En cálculo: ¿fluye más de L→R (hemisferio "analítico")?
# Cuidado: TE requiere bastante data para ser robusta
```

**Lab 4.4 — Spectral entropy como proxy de conciencia:**
```python
# Ya lo tenés parcialmente en tu pipeline
# Pero ahora con marco teórico:
# - Shannon entropy de la PSD normalizada
# - Comparar entre condiciones
# - Mapear contra el Entropic Brain Hypothesis
# - ¿Tu Spectral Entropy se correlaciona con tu SessionQualityScore?
```

**Autoevaluación Fase 4:**
- [ ] Simulé una red de neuronas que genera oscilaciones
- [ ] Entrené mi MuseVAE con data propia y visualicé el latent space
- [ ] Implementé Transfer Entropy y la apliqué a mi EEG
- [ ] Puedo explicar el Free Energy Principle de Friston
- [ ] Entiendo la relación entre información, coherencia y conciencia

---

## FASE 5: LA FRONTERA — Donde la Ciencia se Pone Rara

> *No hay curso "oficial" equivalente. Esto es territorio de: Penrose (Oxford), Hameroff (Arizona), Institute of Noetic Sciences, HeartMath Institute, y sí, Grinberg (INPEC, UNAM).*

**Objetivo**: Explorar las ideas más radicales y controversiales sobre el cerebro y la conciencia. Con rigor. Con datos. Sin dogma en ninguna dirección.

### Semana 27-28: Coherencia Cuántica y Microtúbulos

**Teoría:**
- ¿Puede el cerebro hacer computación cuántica?
- Microtúbulos: estructura proteica dentro de cada neurona (25nm diámetro)
  - Hameroff: los microtúbulos sostienen superposición cuántica
  - Penrose: la gravedad cuántica colapsa la superposición → momento de conciencia (Orch-OR)
- Evidencia a favor:
  - Anestésicos actúan sobre microtúbulos (correlación con pérdida de conciencia)
  - Coherencia cuántica demostrada en fotosíntesis a temperatura ambiente (Engel 2007)
  - Craddock et al. (2017): microtúbulos como guías de onda cuánticas
- Evidencia en contra:
  - Decoherencia térmica: el cerebro está a 37°C, demasiado "caliente" para cuántica (Tegmark 2000)
  - No hay medición directa de superposición en neuronas
- Respuesta de Hameroff a Tegmark: mecanismos de protección contra decoherencia existen en biología
- **Conexión sintérgica**: Si Orch-OR es correcto, el campo neuronal interactúa con la estructura del espacio-tiempo directamente — esto ES el Lattice de Grinberg descrito en otro lenguaje.

**Recursos:**
- 📖 **"The Emperor's New Mind"** — Penrose (1989) — IA no puede generar conciencia, necesita física nueva
- 📖 **"Shadows of the Mind"** — Penrose (1994) — Orch-OR formal
- 📄 **Hameroff & Penrose (2014)** — "Consciousness in the universe: a review of the 'Orch OR' theory" — Actualización de 20 años de la teoría
- 📄 **Tegmark (2000)** — "Importance of quantum decoherence in brain processes" — La crítica principal
- 📄 **Craddock et al. (2017)** — "Anesthetic alterations of collective terahertz oscillations in tubulin"
- 🎥 **Hameroff TED Talk**: "Do we see reality as it is?"

**Lab 5.1 — Debate formal:**
```
Escribir un ensayo de 2000 palabras:
"¿Es la conciencia un fenómeno cuántico? Evaluación de evidencia."
- Presentar Orch-OR con su mejor evidencia
- Presentar la crítica de Tegmark
- Presentar la respuesta de Hameroff
- TU posición argumentada
- ¿Cómo se relaciona con lo que medís con tu Muse?
- ¿Qué experimento diseñarías para testearlo?
```

### Semana 29-30: Grinberg, Correlación No-Local y el Campo

**Teoría:**
- Revisión profunda de los experimentos de Grinberg:
  - Potencial Transferido: correlación EEG entre cerebros aislados
  - Visión Extraocular: percepción sin retina
  - Efectos de chamanes sobre el EEG de otros
- Replicaciones modernas:
  - Radin (IONS): correlación EEG entre parejas en fMRI
  - Richards et al. (2005): "Replicable functional magnetic resonance imaging evidence of correlated brain signals between physically and sensory isolated subjects"
  - Achterberg et al. (2005): EEG correlations between healers and patients
- Críticas legítimas:
  - N pequeño, replicación inconsistente, posibles artefactos estadísticos
  - File drawer problem: ¿cuántos experimentos fallidos no se publicaron?
- PERO: los que replican son laboratorios serios con métodos rigurosos
- El problema: la física actual no tiene mecanismo para explicar esto
  - A menos que... la información sea no-local (Bohm, Lattice, quantum entanglement generalized)

**Recursos:**
- 📖 **"La Creación de la Experiencia"** — Jacobo Grinberg — El libro fundacional
- 📖 **"El Cerebro Consciente"** — Jacobo Grinberg — Modelo completo
- 📖 **"Wholeness and the Implicate Order"** — David Bohm — El modelo holográfico que inspira el Lattice
- 📖 **"The Holographic Universe"** — Michael Talbot — Divulgación del modelo Bohm-Pribram
- 📄 **Grinberg-Zylberbaum et al. (1994)** — "The Einstein-Podolsky-Rosen paradox in the brain"
- 📄 **Standish et al. (2004)** — "Evidence of correlated functional magnetic resonance imaging signals between distant human brains"
- 📖 **"Entangled Minds"** — Dean Radin — Revisión de evidencia de psi, rigurosa

**Lab 5.2 — Protocolo de correlación dual-EEG (tu santo grial):**
```
Cuando tengas 2 Muse:
1. Dos personas, cuartos separados (si posible diferentes redes WiFi)
2. Baseline individual 3 min cada uno
3. "Meditación de conexión" 10 min (ambos con intención de conectar)
4. Fase de estimulación: flash LED aleatorio a persona A
5. Monitorear EEG de persona B: ¿hay correlato?
6. CONTROL: repetir con personas que no se conocen y sin meditación previa
7. DOBLE CONTROL: repetir con un Muse conectado a una sandía (en serio, descarta artefactos BLE)

Análisis:
- Cross-correlation entre señales ERP-locked
- PLV entre streams
- Transfer entropy A→B vs B→A
- Prueba estadística: permutation test (no paramétrico, robusto)

NOTA: Probablemente NO veas nada en los primeros intentos.
Los estudios de Grinberg reportaron éxito en ~25% de pares seleccionados.
DOCUMENTAR TODO: los intentos fallidos son datos también.
```

### Semana 31-32: Integración — Tu Modelo del Cerebro

**Teoría:**
- Síntesis personal: tomando todo lo aprendido, construir TU modelo
- ¿Qué teoría de conciencia se sostiene mejor con TUS datos?
- ¿Qué predice tu modelo que sea testeable?
- ¿Cómo se conecta el campo neuronal (medible) con el Lattice (postulado)?
- Diseñar un programa de investigación a 2 años

**Lab 5.3 — Paper personal:**
```
Escribir un paper de investigación (no para publicar necesariamente, pero con calidad):
Título sugerido: "EEG correlates of meditation states: 
Validation of a low-cost Muse 2 pipeline for syntergic research"

Estructura:
- Abstract
- Introducción (Teoría Sintérgica + evidencia moderna)
- Métodos (tu pipeline completo, protocolo, N sesiones)
- Resultados (Berger test, firma de meditación, VAE clusters)
- Discusión (interpretación, limitaciones, futuro)
- Referencias

ESTO es tu tarjeta de presentación como investigador.
```

**Autoevaluación Fase 5:**
- [ ] Leí y critiqué Orch-OR con argumentos sólidos en ambas direcciones
- [ ] Estudié los experimentos originales de Grinberg a profundidad
- [ ] Diseñé un protocolo de correlación dual que es riguroso
- [ ] Escribí mi paper/ensayo integrativo
- [ ] Tengo un modelo personal de cómo funciona la conciencia, basado en evidencia

---

## FASE 6: TU LABORATORIO — Investigación Continua

Esta fase no termina nunca. Es tu práctica de lab.

### Rutina semanal sugerida

| Día | Actividad | Duración |
|-----|-----------|----------|
| Lunes | Lectura de paper nuevo + notas | 1 hr |
| Martes | Sesión de meditación con EEG + análisis | 1.5 hr |
| Miércoles | Coding: mejorar pipeline/VAE/guía | 2 hr |
| Jueves | Sesión protocolo completo (validación) | 45 min |
| Viernes | Revisión semanal: datos, patrones, preguntas | 1 hr |
| Sábado | Experimento libre / exploración | 2 hr |
| Domingo | Meditación larga sin EEG (no siempre medir, también vivir) | 30+ min |

### Proyectos de investigación propios

**Proyecto A: Personal Baseline Tracking (3 meses)**
- 90 sesiones diarias de 10 min con tu protocolo
- Dataset propio substancial para tu VAE
- Análisis longitudinal: ¿cambia tu baseline con la práctica?
- Publicable como: "Longitudinal EEG changes in a meditation practitioner: A single-subject study with consumer-grade EEG"

**Proyecto B: Multi-Subject Database (6 meses)**
- Reclutar 10 personas (amigos, familia, meditadores)
- Cada uno hace 5 sesiones con tu protocolo
- ¿El VAE generaliza? ¿Hay patrones universales?
- ¿El Berger effect es consistente entre personas con tu setup?

**Proyecto C: Estado Sintérgico Reproducible (ongoing)**
- ¿Podés alcanzar un estado específico de coherencia de forma voluntaria?
- ¿Podés enseñar a otros a hacerlo usando neurofeedback de tu prototipo?
- Si podés: eso es extraordinario y potencialmente publicable
- Si no: la documentación del intento TAMBIÉN es valiosa

**Proyecto D: Dual-Brain Pilot (cuando tengas 2 Muse)**
- El experimento de Grinberg con tecnología moderna
- Incluso un resultado nulo con buena metodología es publicable
- "Attempted replication of neural correlation between isolated subjects using consumer EEG"

---

## Biblioteca de Referencia — Los 30 Libros

### Tier 1: Esenciales (leer completos)

| # | Libro | Autor | Por qué |
|---|-------|-------|---------|
| 1 | Neuroscience: Exploring the Brain | Bear, Connors, Paradiso | Textbook fundamental, tu base |
| 2 | Rhythms of the Brain | György Buzsáki | Oscilaciones, la biblia de lo que medís |
| 3 | Analyzing Neural Time Series Data | Mike X Cohen | Procesamiento de señales EEG, tu toolkit |
| 4 | Being You | Anil Seth | Conciencia como predicción, framework moderno |
| 5 | Altered Traits | Goleman & Davidson | Ciencia de meditación separada del hype |
| 6 | The Mind Illuminated | Culadasa / John Yates | Puente neurociencia-meditación práctica |
| 7 | La Creación de la Experiencia | Jacobo Grinberg | Base teórica de tu proyecto |

### Tier 2: Profundización (leer según interés)

| # | Libro | Autor | Por qué |
|---|-------|-------|---------|
| 8 | Principles of Neural Science | Kandel et al. | Referencia enciclopédica |
| 9 | The Conscious Mind | David Chalmers | El Hard Problem definido |
| 10 | Phi: A Voyage | Giulio Tononi | IIT como narrativa |
| 11 | Shadows of the Mind | Roger Penrose | Conciencia + física cuántica |
| 12 | Theoretical Neuroscience | Dayan & Abbott | Modelos computacionales |
| 13 | Wholeness and the Implicate Order | David Bohm | Física holográfica que inspira Lattice |
| 14 | How Emotions Are Made | Lisa Feldman Barrett | Emociones = construcción, no reacción |
| 15 | The Body Keeps the Score | Bessel van der Kolk | Cuerpo, trauma, cerebro |
| 16 | Thinking, Fast and Slow | Daniel Kahneman | Decisiones y cognición |
| 17 | How to Change Your Mind | Michael Pollan | Psicodélicos y neurociencia |
| 18 | Why We Sleep | Matthew Walker | Sueño y cerebro |
| 19 | Waking Up | Sam Harris | Meditación desde neurociencia |
| 20 | Entangled Minds | Dean Radin | Evidencia de correlación no-local |

### Tier 3: Expansión (consulta y exploración)

| # | Libro | Autor | Por qué |
|---|-------|-------|---------|
| 21 | Electric Fields of the Brain | Paul Nunez | Física del EEG deep dive |
| 22 | Signal Processing for Neuroscientists | van Drongelen | DSP para EEG |
| 23 | The Predictive Mind | Jakob Hohwy | Predictive processing detallado |
| 24 | El Cerebro Consciente | Jacobo Grinberg | Segundo volumen sintérgico |
| 25 | The Emperor's New Mind | Roger Penrose | IA, matemáticas, conciencia |
| 26 | In Search of Memory | Eric Kandel | Autobiografía + ciencia de la memoria |
| 27 | The Self Illusion | Bruce Hood | ¿Existe el yo? |
| 28 | The Holographic Universe | Michael Talbot | Divulgación modelo holográfico |
| 29 | Neuronal Dynamics (online) | Gerstner et al. | Comp neuro gratis |
| 30 | Information Theory, Learning | David MacKay | Info theory gratis |

---

## Los 30 Papers Fundamentales

Listados cronológicamente — cada uno cambió el campo:

1. **Berger (1929)** — Descubrimiento del EEG humano
2. **Hodgkin & Huxley (1952)** — Modelo del potencial de acción (Nobel)
3. **Hubel & Wiesel (1962)** — Columnas de orientación en corteza visual (Nobel)
4. **O'Keefe & Dostrovsky (1971)** — Place cells en hipocampo
5. **Bliss & Lømo (1973)** — LTP: mecanismo celular de la memoria
6. **Libet (1983)** — ¿Libre albedrío? Readiness potential pre-decisión
7. **Grinberg et al. (1994)** — Potencial transferido (correlación no-local)
8. **Chalmers (1995)** — "Facing up to the problem of consciousness"
9. **Schultz et al. (1997)** — Dopamina y reward prediction error
10. **Maguire et al. (2000)** — Hipocampo de taxistas (neuroplasticidad)
11. **Tegmark (2000)** — Crítica a computación cuántica en cerebro
12. **Raichle et al. (2001)** — Descubrimiento del Default Mode Network
13. **Engel et al. (2001)** — Oscilaciones y procesamiento top-down
14. **Lutz et al. (2004)** — Gamma en meditadores long-term (PNAS)
15. **Tononi (2004)** — IIT: Φ como medida de conciencia
16. **Lazar et al. (2005)** — Meditación cambia estructura cortical
17. **Friston (2010)** — Free Energy Principle unificado
18. **Travis & Shear (2010)** — 3 tipos de meditación con firmas EEG
19. **Brewer et al. (2011)** — Meditación reduce actividad de DMN
20. **Hölzel et al. (2011)** — MBSR cambia materia gris (hipocampo, amígdala)
21. **Casali et al. (2013)** — Perturbational Complexity Index para conciencia
22. **Borjigin et al. (2013)** — Surge de coherencia en cerebro muriendo
23. **Carhart-Harris et al. (2014)** — Entropic Brain Hypothesis
24. **Fox et al. (2014)** — Meta-análisis de cambios cerebrales por meditación
25. **Hameroff & Penrose (2014)** — Revisión de 20 años de Orch-OR
26. **Sussillo (2014)** — Circuitos neurales como sistemas dinámicos
27. **Kannard et al. (2021)** — Validación de Muse para análisis espectral
28. **Brandmeyer & Delorme (2018)** — Firmas EEG de meditación, revisión
29. **Koch et al. (2016)** — Neural correlates of consciousness: progress and problems
30. **Mashour et al. (2020)** — Consciousness and the brain: an updated review

---

## Herramientas de Lab

### Software
- **Python + MNE**: Procesamiento EEG (mne.tools)
- **PyTorch**: Tu VAE y modelos de AI
- **EEGLAB** (MATLAB): Referencia para validar tus análisis
- **BrainFlow**: SDK para conectar hardware EEG, incluido Muse
- **muselsl / muse-lsl**: Tu pipeline actual de streaming
- **InfluxDB**: Time-series database para tus sesiones
- **Matplotlib + Plotly**: Visualización
- **Jupyter Notebooks**: Análisis exploratorio

### Hardware
- **Muse 2**: Tu EEG consumer-grade actual (4 canales, 256Hz)
- **Segundo Muse**: Para experimentos dual-brain (siguiente adquisición)
- **Webcam + OpenCV**: Para timestamp visual durante experimentación
- **Micrófono**: Audio markers (campana de meditación)
- **Arduino** (ya tenés): Para trigger de estímulos (LED, sonido)
- **(Futuro) OpenBCI Cyton**: 8-16 canales, research-grade, ~$500

### Comunidades
- **r/neuroscience** y **r/EEG** — Reddit
- **NeuroStars** (neurostars.org) — Q&A de neuroimaging
- **Neuromatch** (neuromatch.io) — Comunidad comp neuro
- **OHBM** — Organización de mapeo cerebral humano
- **ASSC** — Association for the Scientific Study of Consciousness
- **muselsl Discord/GitHub** — Comunidad Muse development

---

## Mentalidad del Explorador

```
No sos un estudiante. Sos un investigador desde el día 1.

Cada sesión de meditación con tu Muse es un experimento.
Cada bug en tu pipeline es un descubrimiento sobre la señal.
Cada dato raro es una pregunta que nadie hizo antes.
Cada contradicción con la literatura es una oportunidad.

Los grandes descubrimientos nacen de:
1. Saber lo suficiente para reconocer lo inesperado
2. Medir con rigor
3. No tener miedo de lo que no se puede explicar (todavía)
4. Documentar todo

El cerebro que estudiás es el mismo cerebro que está estudiando.
Esa recursividad no es un bug. Es el feature más profundo del universo.
```

---

*Plan vivo — actualizar según avance. Última revisión: Marzo 2026.*
