# Euler 3d and Navier-Stokes problem solved como podemos aplicar la solucion a la ingenieria de arquitectura de software, para el despliegue y uso de los recursos?

# sabemos que con una metafora de que un fluido (servicio, componente, recurso, lo que exista (?)) es un campo que cambia, podriamos aplicar coutte - lineal o poiseville - perfil parabolico a despliegues por ejemplo?

# la practica de convertir flido en malla, donde cada celda puede contener: 1) mejorar la velocidad, 2) resolver presición, proyectar, repetir

# por ejemplo podriamos asigar x recursos de build, deploy segun atributos / estados, uso re recursos? 

# por ejemplo n recursos para quality gates, n recursos para deploy, de x servicios



# Fluidodinámica aplicada a arquitectura de software
### Documento de trabajo — `.random()` lab
**Versión:** 0.1 (draft de estudio)
**Fecha:** 2026-09-09
**Estado:** hipótesis abiertas, nada validado todavía
**Autores:** Pedro + Claude

---

## 0. Para qué existe este documento

Tres objetivos, en orden de dificultad:

1. **Entender bien** qué se probó realmente en 2026 sobre Euler 3D y Navier–Stokes, sin la capa de hype de prensa.
2. **Construir un diccionario honesto** entre magnitudes de mecánica de fluidos y magnitudes de infraestructura/despliegue: qué mapea de verdad, qué mapea como metáfora útil, y qué no mapea y hay que descartar explícitamente.
3. **Derivar experimentos falsables** para el lab: si la analogía sirve, tiene que producir un scheduler, un detector o una heurística que le gane a la alternativa boba en un benchmark medible. Si no le gana, la tiramos.

Regla de oro del documento: **una metáfora que no produce una predicción numérica es decoración.** Todo lo que sigue tiene que terminar en un número.

---

## 1. Estado del arte real (a 9 de septiembre de 2026)

### 1.1 Lo que pasó, en orden

**(a) Alpöge & Buckmaster — Euler 3D forzado.**
Construyeron blowup en tiempo finito con **término de forzamiento suave** para tres ecuaciones: el medio poroso incompresible (IPM), Boussinesq 2D y Euler 3D incompresible. Se apoyan en el trabajo previo de Córdoba y Martínez-Zoroa (que ya había resuelto IPM). El trabajo está formalizado en Lean. Tao lo comentó el 7 de septiembre.

**(b) OpenAI — Navier–Stokes forzado.**
El 8 de septiembre OpenAI anunció que un sistema interno multi-agente (del orden de 10.000 sub-agentes, ~88 horas, ~130 mil millones de tokens de salida, coste en el rango de millones de dólares) produjo una demostración de que Navier–Stokes 3D incompresible desarrolla una **singularidad en tiempo finito bajo forzamiento suave**: un fluido inicialmente suave y en reposo, con energía total finita durante toda la dinámica, en el que un filamento de vorticidad colapsa hacia adentro mientras se estira axialmente, y la velocidad diverge. Publicaron manuscrito (~166 páginas) y formalización en Lean.

**(c) Ganeshram, Duruisseaux & Anandkumar — Euler sin forzamiento, vía PINN.**
Preprint independiente que ataca el otro camino: usar redes neuronales informadas por física para *localizar* numéricamente un perfil de blowup autosemejante estable para Euler sin forzamiento ni frontera, y después probar que es lo bastante estable como para perturbarlo a una solución real. La parte rigurosa todavía no está cerrada.

### 1.2 Lo que **NO** pasó (importante, para no escribir pelotudeces en el blog del lab)

- **El Millennium Prize no está cobrado.** Los enunciados atacados son los de la variante **forzada** (Statements C/D del Clay). El problema canónico —blowup sin forzamiento externo— sigue abierto.
- **No hay aceptación independiente.** A la fecha, la comunidad está revisando. Hay disputa pública de prioridad y de conducta entre OpenAI y el grupo de Buckmaster, e intercambios de Palasek y Tao sobre lo difícil que es quitar el forzamiento.
- **No es un "solver de fluidos mejor".** Es un teorema de existencia: construyeron un dato inicial y un forzamiento diseñados a mano (a máquina) para romper la ecuación. No mejora la simulación de fluidos ni el clima ni el CFD industrial. Silvester (Manchester) lo describió como un peldaño importante, no como el final del camino.

### 1.3 El mecanismo, que es lo que a nosotros nos sirve

Esta es la parte transferible. La estrategia de Córdoba–Martínez-Zoroa, extendida por Alpöge–Buckmaster:

Se parte de una ecuación abstracta `N(u) = f`, con `u` la solución, `N` el operador no lineal y `f` el forzamiento. Se tiene una solución de baja frecuencia `N(u_lo) = f_lo`, y se le agrega una corrección de alta frecuencia:

```
N(u_lo + u_hi) = f_lo + f_hi
```

El juego es que `u_hi` resuelva aproximadamente la ecuación linealizada `N'(u_lo)·u_hi ≈ 0`, de modo que `f_hi` quede chiquito. Y se **diseña el flujo de fondo `u_lo` para que ese linealizado sea inestable**: `u_hi` arranca exponencialmente pequeño y se vuelve grande justo cerca del tiempo de blowup. Se itera con frecuencias que crecen rápido en cada paso y se pasa al límite.

El resultado es una solución que revienta mientras **el forzamiento externo se mantiene suave y acotado**.

> **Traducción de una línea, y es la tesis central de este documento:**
> *Un sistema puede colapsar por acumulación resonante de perturbaciones internas de alta frecuencia y baja amplitud, mientras el input externo se ve perfectamente sano.*

Eso es, literalmente, la descripción formal de un **fallo metaestable** en sistemas distribuidos: tráfico de entrada normal, ninguna causa externa visible, y el sistema igual se cae por retry storms, thundering herds, cache stampedes y feedback de health checks. La literatura de sistemas ya tiene el fenómeno descrito (Bronson et al., *Metastable Failures in Distributed Systems*, HotOS '21) pero **no tiene la maquinaria matemática**. Los papers de fluidos sí.

---

## 2. El diccionario

### 2.1 Mapeo de magnitudes

| Fluido | Software / infra | Grado de honestidad |
|---|---|---|
| Campo de velocidad `u(x,t)` | Tasa de avance de trabajo por etapa (jobs/s en cada stage del pipeline) | **Fuerte** |
| Densidad `ρ` | Trabajo en curso por celda (WIP: jobs encolados en esa etapa) | **Fuerte** |
| Presión `p` | Precio sombra del recurso escaso (runners, cuota de API, conexiones de DB) | **Fuerte** (ver §4) |
| Viscosidad `ν` | Fricción del sistema: overhead de scheduling, cold starts, throttling, rate limits | **Media** |
| Forzamiento `f` | Tráfico entrante, merges a main, cron, eventos de negocio | **Fuerte** |
| Incompresibilidad `∇·u = 0` | Conservación: ningún job aparece ni desaparece; capacidad total fija | **Fuerte** |
| Vorticidad `ω = ∇×u` | Circulación de trabajo: retries, rollbacks, ping-pong entre servicios | **Media** |
| Número de Reynolds `Re` | Ratio inercia/fricción del pipeline (ver §5.1) | **Media, pero operacionalizable** |
| Blowup en tiempo finito | Colapso metaestable: latencia → ∞ con carga externa constante | **Fuerte conceptualmente, débil formalmente** |
| Turbulencia | Régimen donde el comportamiento agregado deja de ser predecible desde el estado por-servicio | **Metáfora, cuidado** |
| Energía cinética `½∫|u|²` | Coste computacional instantáneo total | **Débil** — no se conserva igual |
| Temperatura / entropía | (no mapear) | **Descartar** |

### 2.2 Dónde se rompe la analogía — leer esto antes de entusiasmarse

Cuatro rupturas serias. Ignorarlas es lo que convierte el proyecto en numerología:

1. **El software no vive en un continuo.** Navier–Stokes vive en ℝ³ y toda la dificultad del problema (el blowup) es un fenómeno de **escalas infinitamente pequeñas**. Un cluster tiene 40 nodos. No hay cascada de frecuencias hasta el infinito: hay un cutoff duro en el tamaño del pod. **Consecuencia: el blowup literal es imposible en tu infra.** Lo que sí existe es el análogo discreto: saturación (`ρ → 1`) en teoría de colas.
2. **No hay invariancia de Galileo ni de escala.** Un pipeline con el doble de servicios no es el mismo pipeline reescalado. Los grupos de simetría que hacen funcionar el análisis autosemejante no existen acá. Podemos usar autosemejanza como *ansatz de ajuste empírico*, nunca como teorema.
3. **La topología es un grafo, no un dominio conexo.** El operador correcto no es el Laplaciano continuo `Δ`, es el **Laplaciano de grafo** `L = D − A` sobre el DAG de dependencias. Esto en realidad es una buena noticia (§4.2): todo el aparato de proyección de Helmholtz–Hodge tiene versión discreta exacta sobre grafos (teoría de Hodge combinatoria).
4. **Los jobs tienen identidad; las partículas de fluido no.** No podés promediar dos deploys y obtener medio deploy. La descripción de campo medio solo vale con muchos jobs pequeños. **Regla práctica: por debajo de ~50 unidades de trabajo por celda, el modelo continuo es basura y hay que usar colas discretas.**

**La honestidad de arriba es el activo del proyecto.** Cualquiera puede escribir "los microservicios son como un fluido". Lo interesante es saber exactamente hasta dónde.

---

## 3. Los regímenes de flujo aplicados a despliegues

Tu intuición de Couette vs Poiseuille es buena y da tres modelos de rollout distintos.

### 3.1 Couette — perfil lineal, impulsado por el borde

Fluido entre dos placas, una en movimiento a velocidad `U`. Perfil `u(y) = U·y/h`. Lineal. **El motor es la frontera, no un gradiente interno.**

**Traducción a deploy:** rollout donde alguien externo mueve el slider de tráfico. El avance es lineal en el tiempo y **totalmente controlado**: 5% → 10% → 25% → 50% → 100%. La tasa de cizalladura `γ̇ = U/h` es constante en todo el sistema: el estrés que impone la migración es uniforme sobre todas las capas.

- **Cuándo aplica:** canary manual, feature flags con ramp lineal, migraciones de datos con throttle fijo.
- **Qué predice:** el estrés máximo es `μ·U/h`. Si querés bajar el estrés sin bajar la velocidad final `U`, **aumentá `h`** — o sea, agregá capas intermedias entre lo viejo y lo nuevo (shadow traffic, dual-write, proxy de traducción). Más capas = mismo desplazamiento total, menos cizalladura por capa.
- **Predicción testeable:** la tasa de incidentes durante una migración debería escalar con `U/h`, no con `U`. **Esto es medible con datos históricos de post-mortems.**

### 3.2 Poiseuille — perfil parabólico, impulsado por gradiente de presión

Flujo en tubería por diferencia de presión, con condición de no-deslizamiento en las paredes. Perfil `u(r) = (ΔP/4μL)·(R² − r²)`. Parábola: rápido en el centro, cero en la pared.

**Traducción a deploy:** rollout donde el motor es la **presión** (backlog, deadline, presión comercial) y no un operador. El "centro" avanza rápido: servicios stateless, clientes modernos, región principal. La "pared" no avanza: el cliente enterprise con la integración legacy, la región con compliance, el móvil que no actualiza. **La condición de no-deslizamiento es real y es la razón por la que nunca terminás de deprecar una API v1.**

Ley de Hagen–Poiseuille: `Q = πR⁴ΔP / 8μL`.

Ese exponente 4 es la observación explotable. **Duplicar el "radio" del canal (concurrencia, ancho del worker pool) multiplica el caudal por 16, no por 2** — hasta que la fricción cambia de régimen. Eso explica los retornos superlineales al ampliar paralelismo en CI, y explica que la curva se caiga bruscamente después: el modelo laminar deja de valer.

- **Predicción testeable:** en un pipeline de CI, graficar throughput vs concurrencia. **Si Poiseuille aplica, hay un tramo de pendiente ≫1 en log-log, seguido de un quiebre.** Ese quiebre es el `Re` crítico del pipeline (§5.1) y es el punto de operación óptimo. Nadie tunea así hoy: se tunea con `runners = 8` porque quedaba lindo.

### 3.3 El tercero, que faltaba: turbulento

Después del quiebre, la relación se vuelve `ΔP ∝ Q^1.75` (Blasius) en vez de `ΔP ∝ Q`. Traducción: más allá del punto crítico, **cada unidad extra de throughput cuesta desproporcionadamente más presión** (más recursos, más deuda, más incidentes). Ahí es donde vive la mayoría de los pipelines de CI reales y por eso duelen.

---

## 4. La malla, el solver, y la joya del asunto

### 4.1 El ciclo de Stam, que es exactamente lo que describiste

Tu intuición — *"convertir fluido en malla, cada celda: mejorar velocidad, resolver presión, proyectar, repetir"* — es, palabra por palabra, el algoritmo **Stable Fluids** de Jos Stam (1999). El paso de tiempo es:

```
1. add_force    →  aplicar forzamiento externo         (llegan merges, tráfico, crons)
2. advect       →  transportar el estado por el campo  (los jobs avanzan de etapa)
3. diffuse      →  viscosidad implícita                (overhead, cold starts, throttling)
4. project      →  imponer ∇·u = 0                     (respetar capacidad total)
```

El paso 4 es la clave y es donde está el aporte no trivial.

### 4.2 La proyección de Helmholtz–Hodge = asignación óptima de recursos

Esto no es metáfora. Es el mismo teorema.

**En fluidos:** después de advectar y difundir, el campo `u*` ya no cumple `∇·u = 0` (no conserva masa). Se corrige resolviendo una ecuación de Poisson para la presión, `Δp = ∇·u*`, y restando el gradiente: `u = u* − ∇p`. Es la proyección ortogonal de `u*` sobre el subespacio de campos de divergencia nula. La presión **no es una variable dinámica**: es el multiplicador de Lagrange de la restricción de incompresibilidad.

**En scheduling:** después de que cada servicio pide los recursos que quiere, el vector de asignación `a*` no cumple la restricción de capacidad `Σaᵢ ≤ C`. Se corrige resolviendo un problema dual y restando el gradiente del precio. **El precio del recurso es el multiplicador de Lagrange de la restricción de capacidad.**

> **Es el mismo objeto matemático.** La presión en un fluido incompresible y el precio sombra en un scheduler con restricción de capacidad son ambos el multiplicador de Lagrange de una restricción de conservación, y ambos se obtienen resolviendo un Poisson (continuo en un caso, sobre el Laplaciano de grafo en el otro).

Y esto habilita algo concreto: **la teoría de Hodge combinatoria da la versión exacta y discreta sobre el DAG de dependencias.** Un campo de flujo sobre las aristas del grafo de servicios se descompone únicamente en:

- **componente gradiente** — flujo que va "cuesta abajo" desde un potencial. *Trabajo que progresa.*
- **componente rotacional (curl)** — circulación local. *Retries, ping-pong entre servicios, trabajo que gira sin avanzar.*
- **componente armónica** — flujo global sin fuente ni sumidero, vive en los ciclos de la topología. *Deuda estructural: flujo que existe porque el grafo tiene ciclos de dependencia.*

**Este es el resultado más accionable de todo el documento.** Si instrumentás las llamadas entre servicios como un flujo sobre aristas y le aplicás la descomposición de Hodge, obtenés tres números por servicio: cuánto de su tráfico es progreso, cuánto es churn local y cuánto es deuda topológica. **Eso no lo mide ninguna herramienta de observabilidad que exista hoy.** Datadog te da latencia por span; nadie te dice qué fracción de tu tráfico es curl puro.

### 4.3 La condición CFL, que explica el flapping del autoscaler

Courant–Friedrichs–Lewy: un esquema explícito es estable solo si `Δt ≤ Δx / |u|`. En castellano: **el paso de tiempo tiene que ser menor que el tiempo que tarda la información en cruzar una celda.** Si no, la simulación oscila y explota numéricamente.

**Traducción directa:** si tu HPA/autoscaler decide cada 30 segundos, pero un job cruza una etapa en 5 segundos, estás **violando CFL**. El scheduler está tomando decisiones basadas en un estado que ya cambió varias veces. El resultado es exactamente lo que se ve en la práctica: oscilación, sobrerreacción, thrashing.

```
Número de Courant del scheduler:
    Co = (tick_del_scheduler) / (tiempo_de_tránsito_por_etapa)

    Co < 1   → estable
    Co ≈ 1   → marginal
    Co > 1   → flapping garantizado
```

**Esto es publicable como post del lab tal cual, y es verificable en una tarde.** Calculá `Co` para tus HPAs actuales. La predicción: los servicios con historial de flapping tienen `Co > 1` y los estables no. Si eso sale, tenemos una regla de tuning de autoscaler derivada de CFL que hoy nadie usa.

### 4.4 Refinamiento adaptativo de malla (AMR) → asignación de observabilidad

En CFD no se usa la misma resolución en todo el dominio: se refina donde el gradiente es grande. **Traducción:** no muestrees todos los servicios al mismo rate. Asigná resolución de tracing proporcional al gradiente local de latencia. Servicio plano y aburrido → 1% de sampling. Servicio con derivada alta → 100%. Es AMR aplicado a presupuesto de observabilidad, y baja el coste de Datadog sin perder señal donde importa.

---

## 5. Números adimensionales propios del `.random()` lab

La parte de fluidos que más valor tiene no son las ecuaciones: son los **números adimensionales**. Son la forma de comparar sistemas que no se parecen en nada. Propongo definir los nuestros.

### 5.1 Reynolds del pipeline

```
Re_pipe = (tasa de trabajo × acoplamiento) / fricción
        = (λ · k) / (μ_overhead)
```
donde `λ` = jobs/s, `k` = fan-out promedio del DAG de dependencias, `μ_overhead` = tiempo de scheduling + cold start + espera de lock.

- `Re` bajo → régimen laminar: el comportamiento agregado es predecible desde el comportamiento individual. Podés razonar servicio por servicio.
- `Re` alto → régimen turbulento: aparecen modos colectivos. **Razonar servicio por servicio deja de funcionar** y necesitás estadística de sistema.

**Hipótesis fuerte:** existe un `Re` crítico universal (no un número mágico global, pero sí un umbral estable por clase de arquitectura) por encima del cual los post-mortems dejan de encontrar causa raíz única. **Falsable con datos de incidentes.**

### 5.2 Número de Courant del scheduler — §4.3.

### 5.3 Índice de curl

Fracción de la energía del flujo de tráfico que está en la componente rotacional de Hodge. Es la métrica de "trabajo que gira sin avanzar". **Meta: que baje release a release.**

### 5.4 Exponente de blowup

Si el colapso es autosemejante, cerca del tiempo crítico `T` la latencia debería ir como:

```
L(t) ~ C · (T − t)^(−α)
```

**Predicción:** durante la fase previa a un colapso metaestable, ajustar esa ley de potencias a la serie de latencia permite estimar `T` **antes** de que ocurra. Es el mismo tipo de aparato que Sornette usa para crashes financieros (con las mismas críticas de sobreajuste, que hay que tomar en serio).

**Contra-hipótesis que hay que testear en serio:** que una regla trivial de umbral sobre la derivada segunda de la latencia prediga igual de bien y con la décima parte de la complejidad. Si es así, el ajuste autosemejante no aporta y se descarta.

---

## 6. El problema que planteaste: asignación de recursos a quality gates vs deploy

Tu caso concreto: `n` runners para quality gates, `m` para deploy, sobre `x` servicios, según atributos y estado.

### 6.1 Formulación como flujo con restricción

Estado del sistema en el tick `t`: para cada servicio `i` y etapa `s ∈ {build, test, gate, deploy}`, una celda con densidad `ρᵢₛ` (jobs esperando) y velocidad `uᵢₛ` (jobs/s de procesamiento, proporcional a runners asignados).

```
Restricción de capacidad:   Σ_{i,s} runners(i,s) ≤ R_total
Conservación:               ∂ρ/∂t + ∇·(ρu) = fuente − sumidero
```

Cada tick:
1. **Forzamiento:** llegan merges nuevos → `fuente`.
2. **Advección:** los jobs avanzan según `u`.
3. **Difusión:** aplicar overhead y throttling.
4. **Proyección:** resolver Poisson sobre el grafo de etapas → precio por runner → reasignar hasta cumplir la restricción.

El paso 4 es lo que hace un scheduler de fluidos y **no** lo que hace un scheduler FIFO ni un HPA por métrica de CPU. La diferencia: **el precio propaga globalmente.** Si el deploy está atascado río abajo, el precio sube y **automáticamente frena los gates río arriba**, en vez de seguir generando WIP que se va a apilar. Eso es backpressure derivado, no cableado a mano.

### 6.2 La alternativa aburrida contra la que hay que competir

**Hay que decirlo con todas las letras: la matemática correcta y establecida para pipelines es teoría de colas, no Navier–Stokes.**

- **Ley de Little:** `L = λW`. WIP = tasa × tiempo. Exacta, sin supuestos.
- **Fórmula de Kingman:** `Wq ≈ (ρ/(1−ρ)) · ((c_a² + c_s²)/2) · τ`

Kingman ya te dice lo esencial: **la espera explota como `ρ/(1−ρ)`.** A 80% de utilización esperás 4τ; a 95%, 19τ. **Ese factor `1/(1−ρ)` es el análogo real y riguroso del blowup en tiempo finito**, y es la razón por la que un cluster al 95% se comporta como un fluido que revienta.

Cualquier cosa que construyamos tiene que **ganarle a Kingman + backpressure simple.** Si el solver de fluidos empata, ganó la teoría de colas: es más simple, tiene garantías y ya está en los libros.

**Dónde el enfoque de fluidos *podría* ganar de verdad:** teoría de colas es excelente para una cola aislada y se vuelve intratable en **redes de colas con topología, correlación y feedback** — que es exactamente lo que es un DAG de microservicios con retries. Ahí es donde un solver de campo sobre el grafo puede aportar algo que la fórmula cerrada no da.

---

## 7. Experimentos

Priorizados por ratio valor/esfuerzo. Los tres primeros se pueden hacer solos y ya justifican el proyecto.

### EXP-01 — CFL del autoscaler *(1 día, riesgo bajo, valor alto)*
Calcular `Co = tick / tiempo_de_tránsito` para todos los HPAs/schedulers accesibles. Correlacionar con historial de flapping.
**Éxito:** correlación clara entre `Co > 1` y oscilación. **Entregable:** regla de tuning + post del lab.
**Por qué primero:** no requiere construir nada y el resultado es útil aunque el resto del proyecto muera.

### EXP-02 — Descomposición de Hodge del tráfico *(1 semana, riesgo medio, valor muy alto)*
Tomar el grafo de llamadas de un sistema real, construir el flujo sobre aristas, descomponer en gradiente / curl / armónico.
**Éxito:** el índice de curl identifica hotspots de retry que la observabilidad estándar no marca.
**Por qué:** es el resultado más diferenciador. Nadie está midiendo esto.

### EXP-03 — Curva de Poiseuille en CI *(2 días, riesgo bajo)*
Barrer concurrencia de runners en un pipeline real, medir throughput. Graficar log-log.
**Éxito:** aparece el tramo superlineal y el quiebre. Localizar el `Re` crítico y usarlo como punto de operación.

### EXP-04 — Scheduler con proyección de presión *(3–4 semanas, riesgo alto, valor alto si sale)*
Simulador de pipeline (malla + Stam sobre el DAG). Comparar cuatro políticas en el mismo workload sintético:
`(a)` FIFO · `(b)` prioridad estática · `(c)` backpressure Kingman · `(d)` proyección de Hodge.
**Métricas:** p99 de lead time, WIP máximo, utilización, incidentes simulados.
**Criterio de muerte del proyecto:** si (d) no le gana a (c) por un margen claro, la línea de fluidos no vale y lo escribimos como resultado negativo honesto.

### EXP-05 — Detector de blowup autosemejante *(2 semanas, riesgo alto)*
Sobre series históricas de latencia previas a incidentes conocidos, ajustar `L(t) ~ (T−t)^(−α)` en ventana deslizante.
**Éxito:** predicción de `T` con adelanto útil (>5 min) y menos falsos positivos que un umbral simple.
**Advertencia:** altísimo riesgo de sobreajuste. **Validación out-of-sample obligatoria o el experimento no cuenta.**

### EXP-06 — AMR para presupuesto de observabilidad *(1 semana, riesgo bajo)*
Sampling de tracing proporcional al gradiente local de latencia.
**Éxito:** mismo poder de detección de incidentes con 40–60% menos de spans ingeridos. Se mide en euros.

### EXP-07 — Rollout Couette vs Poiseuille *(largo plazo)*
Formalizar los dos perfiles como estrategias de rollout con parámetros explícitos, y probarlos en despliegues reales de proyectos del lab.

---

## 8. Riesgos y criterios de honestidad

**Riesgo 1 — Numerología.** El fracaso más probable es producir un documento hermoso donde todo "corresponde" con todo y ninguna predicción se cumple. *Mitigación:* cada sección tiene que morir en un número medible, y EXP-04 tiene criterio de muerte explícito.

**Riesgo 2 — Colgarse del hype.** Los resultados de septiembre 2026 son de matemática pura, sobre la versión **forzada** del problema, y están en disputa. **No podemos escribir "aplicamos la solución de Navier–Stokes al DevOps".** Es falso y nos hace quedar mal. Lo honesto: *"usamos el aparato de la mecánica de fluidos —que acaba de dar resultados espectaculares— como fuente de estructura formal para scheduling"*. Lo que efectivamente transferimos es el **mecanismo** (§1.3), no el teorema.

**Riesgo 3 — Reinventar cosas que ya existen.** Buena parte de esto ya vive en otras disciplinas: control de congestión TCP es literalmente esto (BBR modela la red como un pipe con capacidad y RTT), teoría de colas, hidrodinámica de tráfico vehicular (modelo LWR: `∂ρ/∂t + ∂q/∂x = 0`, una ley de conservación idéntica a la nuestra). **Tarea previa a construir nada: revisar traffic flow theory. Ya resolvieron nuestro problema en otro dominio hace 70 años.**

**Riesgo 4 — Régimen equivocado.** Si tenés 12 servicios y 40 jobs por hora, sos un sistema discreto y el modelo continuo no aplica (§2.2, ruptura 4). El enfoque tiene sentido a escala grande. **Antes de todo: contar jobs por celda.** Si es <50, este documento es un ejercicio intelectual y no una herramienta.

---

## 9. Fases

**Fase 0 — Lectura y descarte *(2 semanas).*** Traffic flow theory (LWR), Kingman, Hodge combinatoria, Stam. Objetivo: encontrar qué ya está resuelto y sacarlo del roadmap.

**Fase 1 — Fruta madura *(2–3 semanas).*** EXP-01, EXP-03, EXP-06. Bajo riesgo, resultado útil aunque la tesis grande falle.

**Fase 2 — La apuesta *(4–6 semanas).*** EXP-02 y EXP-04. Acá se decide si el proyecto es real.

**Fase 3 — Especulativo.** EXP-05, EXP-07. Solo si la fase 2 sale bien.

---

## 10. Lectura

**Los resultados de 2026**
- Tao — *Finite time blowup with smooth forcing term...* (7-sep-2026): https://terrytao.wordpress.com/2026/09/07/finite-time-blowup-with-smooth-forcing-term-for-the-incompressible-porous-medium-boussinesq-and-incompressible-euler-equations/ ← **empezar por acá**, es la mejor explicación del mecanismo
- OpenAI — *On the Navier–Stokes Millennium Prize Problem* (8-sep-2026): https://openai.com/index/navier-stokes-solution/
- Buckmaster — paper de Boussinesq: https://cims.nyu.edu/~tristanb/boussinesq.pdf
- Córdoba & Martínez-Zoroa (IPM, base del método): https://arxiv.org/abs/2410.22920
- Ganeshram, Duruisseaux & Anandkumar (PINN, Euler sin forzamiento): https://anima-ai.org/2026/09/07/stable-singularity-of-the-euler-equations-on-r3-without-forcing/
- Cobertura de la disputa de prioridad: Axios, Fortune (8-sep-2026)

**Fundamentos que necesitamos**
- Stam, *Stable Fluids* (SIGGRAPH 1999) — el ciclo advect/diffuse/project
- Bhatia et al., *The Helmholtz-Hodge Decomposition: A Survey* (IEEE TVCG 2013)
- Jiang, Lim, Yao & Ye, *Statistical Ranking and Combinatorial Hodge Theory* — Hodge sobre grafos
- Harchol-Balter, *Performance Modeling and Design of Computer Systems* — colas, Kingman
- Bronson et al., *Metastable Failures in Distributed Systems* (HotOS 2021)
- Treiber & Kesting, *Traffic Flow Dynamics* — el precedente más cercano a lo que queremos hacer

---

## 11. Preguntas abiertas

1. ¿Existe un `Re` crítico estable por clase de arquitectura, o es específico de cada sistema?
2. La componente armónica de Hodge — ¿es realmente "deuda estructural"? Es la parte más especulativa y la más interesante. Se puede testear: si un refactor rompe un ciclo de dependencias, la componente armónica debería caer de forma medible.
3. ¿Se puede definir una condición tipo Beale–Kato–Majda para software? En Euler, la solución sigue siendo suave mientras `∫||ω||_∞ dt < ∞` — el criterio de blowup está **enteramente en la vorticidad**. Si el análogo vale, **la integral acumulada de la tasa de retries sería el único predictor necesario de colapso.** Eso sería un resultado precioso y es directamente testeable.
4. ¿El mecanismo lo/hi de Córdoba–Alpöge–Buckmaster tiene un análogo operativo? O sea: ¿podemos *construir deliberadamente* un fallo metaestable inyectando perturbaciones de alta frecuencia y baja amplitud sobre un flujo base sano? **Eso sería una herramienta de chaos engineering de un tipo que no existe** — caos que se ve inocuo desde afuera.

---

*Documento vivo. Nada de esto está validado. Actualizar al cerrar cada experimento, incluidos —sobre todo— los resultados negativos.*