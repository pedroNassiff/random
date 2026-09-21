# Glosario técnico — fluidos, geometría y sistemas
### Documento de estudio — `.random()` lab
**Versión:** 0.1
**Fecha:** 2026-09-09
**Complementa:** `random-lab_fluidos-arquitectura.md` (Vol I) · `random-lab_marcos-transferibles-vol2.md` (Vol II)

---

## 0. Cómo usar este documento

Esto no es una lista de definiciones para consultar. Es un **material de estudio diseñado para producir comprensión operativa**, que es distinto de reconocimiento. Un glosario leído linealmente produce la ilusión de haber aprendido: reconocés los términos, los podés repetir, y no podés hacer nada con ellos.

### Los tres niveles de dominio

Cada término está marcado con el nivel al que hay que llegar, y hay que ser honesto sobre en cuál estás:

| Nivel | Qué significa | Test |
|---|---|---|
| **N1 — Reconocés** | Sabés qué es y de qué familia viene | Podés ubicarlo en el mapa conceptual sin mirar |
| **N2 — Calculás** | Podés producir el número sobre datos reales | Escribiste código que lo computa y el resultado tiene sentido |
| **N3 — Enseñás** | Podés explicarlo sin jerga, y sabés dónde se rompe | Se lo explicaste a alguien que no sabe física y entendió, incluyendo la limitación |

**La trampa central de todo este proyecto:** con estos temas es muy fácil quedarse en N1 y sentir que estás en N3, porque las metáforas son vívidas y el vocabulario es impresionante. La única defensa es el criterio de N2: **si no lo calculaste, no lo entendés.**

### Protocolo de estudio

**Pasada 1 — barrido (1 sesión).** Leer el glosario entero de corrido sin tomar notas y sin detenerse en lo que no se entiende. Objetivo: construir el mapa, no el detalle. La sensación de "no entendí la mitad" es correcta y esperada.

**Pasada 2 — por bloques (1 bloque por sesión).** Cada bloque de este glosario es una unidad de *chunking*: los términos de un bloque solo tienen sentido juntos. Para cada bloque: leer, cerrar el documento, y **escribir de memoria** qué había en él. Después comparar. La brecha entre lo que escribiste y lo que había es exactamente tu material de estudio; lo demás ya lo sabés.

**Pasada 3 — práctica.** Hacer los ejercicios marcados `PRÁCTICA`. Son el paso a N2 y no son opcionales: son el único punto del documento donde efectivamente se aprende algo.

**Mantenimiento — recuperación espaciada.** Las preguntas de la §11 se responden a **día 1, día 3, día 7, día 21, día 60**. Responder de memoria, escribiendo, antes de mirar. El costo de recuperar mal y corregirse es lo que consolida; releer no consolida nada.

### Dos reglas de higiene cognitiva específicas para este material

1. **Separar siempre "esto es literalmente lo mismo" de "esto se parece".** El glosario marca cada mapeo con `[ISOMORFO]`, `[ANALOGÍA FUERTE]` o `[METÁFORA]`. Confundir las tres categorías es el modo de fallo del proyecto entero, y es un fallo *cognitivo* antes que técnico: la fluidez de una metáfora se siente igual que la validez de un isomorfismo.
2. **Cada vez que sientas que "todo encaja", desconfiá.** La sensación de coherencia total es un síntoma de que dejaste de testear. En este documento, cada término tiene una entrada `⚠ Trampa` justamente para eso.

---

## Bloque A — Campos y conservación
*El vocabulario base. Sin esto, nada del resto se entiende.*

**Campo** ★ · N3
**Qué es:** una función que asigna un valor a cada punto del espacio y del tiempo. Campo escalar si el valor es un número (presión, temperatura); campo vectorial si es un vector (velocidad).
**En software:** cualquier magnitud definida sobre todo el sistema en todo momento: latencia por servicio, WIP por etapa, carga por nodo.
`[ISOMORFO]` — es solo una definición matemática, aplica igual en los dos lados.
**⚠ Trampa:** un campo requiere que la magnitud esté definida *en todas partes*. Si tu métrica solo existe en 6 de 40 servicios, no tenés un campo, tenés puntos sueltos, y todo el aparato de derivadas no aplica.

**Ley de conservación** ★ · N3
**Qué es:** una ecuación de la forma `∂ρ/∂t + ∇·(ρu) = fuentes − sumideros`. En castellano: *lo que hay acá adentro cambia solo por lo que entra, lo que sale, lo que se crea y lo que se destruye.* Es la ecuación más importante de la física aplicada.
**En software:** los jobs en una etapa cambian solo por los que llegan, los que se van, los que se crean (fan-out) y los que se destruyen (fallos, cancelaciones).
`[ISOMORFO]` — la contabilidad es idéntica; es simplemente aritmética de flujos.
**Por qué importa:** es la base de todo. La ley de Little (Bloque F) es un caso particular. El modelo de tráfico vehicular es esta misma ecuación.

**Advección** ★ · N2
**Qué es:** el transporte de una cantidad *por el propio movimiento del fluido*. La mancha de tinta viaja porque el agua viaja.
**En software:** los jobs avanzan de etapa porque el pipeline los mueve. El estado se propaga porque los mensajes fluyen.
`[ANALOGÍA FUERTE]`
**⚠ Trampa:** la advección es **no lineal** (el campo se transporta a sí mismo). Esa no linealidad es la fuente de toda la dificultad en Navier-Stokes, y también de todos los efectos contraintuitivos en sistemas: cuando la carga afecta a la velocidad que a su vez mueve la carga, la intuición lineal falla.

**Difusión** ★ · N2
**Qué es:** el esparcimiento de una cantidad por gradiente, de zonas de mucho a zonas de poco. La descripe el laplaciano `Δ`. Suaviza; nunca crea picos.
**En software:** balanceo de carga, propagación de configuración, gossip protocols. Todo lo que tiende a igualar.
`[ANALOGÍA FUERTE]`

**Viscosidad `ν`** ★ · N2
**Qué es:** la resistencia interna del fluido a deformarse. Es el coeficiente de la difusión de momento. **La viscosidad suaviza y disipa energía.**
**En software:** fricción del sistema — overhead de scheduling, cold starts, throttling, esperas de lock, latencia de coordinación.
`[ANALOGÍA FUERTE]`
**⚠ Trampa:** la intuición dice "la viscosidad es mala, hay que minimizarla". En fluidos la viscosidad es lo que *impide* que las cosas exploten (por eso Navier-Stokes es más difícil de romper que Euler). En sistemas, algo de fricción —rate limits, backpressure, colas— es lo que evita el colapso. **Un sistema sin viscosidad es un sistema sin amortiguación.**

**Forzamiento `f`** ★ · N2
**Qué es:** una fuerza externa aplicada al sistema, que no viene de su propia dinámica.
**En software:** tráfico entrante, merges a main, crons, eventos de negocio. Todo lo que llega de afuera.
`[ISOMORFO]`
**Por qué es *el* concepto clave del Vol I:** la distinción entre lo que le pasa al sistema por el forzamiento externo y lo que le pasa por su propia dinámica interna es exactamente la distinción entre "nos cayó un pico de tráfico" y "nos caímos solos". Los resultados de 2026 son sobre blowup **con forzamiento suave**: el input se ve sano y el sistema se rompe igual.

**Divergencia `∇·u`** ★ · N2
**Qué es:** cuánto "sale" de un punto. Positiva = fuente, negativa = sumidero, cero = lo que entra es lo que sale.
**En software:** en un nodo del grafo de servicios, la diferencia entre lo que le llega y lo que emite.
`[ISOMORFO]` sobre grafos (ver Bloque E).
**Incompresibilidad** es la condición `∇·u = 0` en todo punto: nada se crea ni se acumula. En software: la capacidad total es fija y ningún job se evapora.

**Gradiente `∇p`** ★ · N2
**Qué es:** el vector que apunta en la dirección de máximo crecimiento de un campo escalar. Un fluido va **a favor** del gradiente de presión negativo: de alta a baja presión.
**En software:** de alto precio de recurso a bajo precio. El gradiente de precio es lo que dirige la reasignación.
`[ISOMORFO]` — ver proyección de Hodge, Bloque C.

**Vorticidad `ω = ∇×u`** ★★ · N2
**Qué es:** el rotacional del campo de velocidad. Mide cuánto gira localmente el fluido. **Es la magnitud protagonista de todos los resultados de blowup.**
**En software:** circulación de trabajo que no avanza — retries, ping-pong entre servicios, rollbacks.
`[ANALOGÍA FUERTE]`, y se vuelve `[ISOMORFO]` en la versión de grafos (componente *curl* de Hodge).
**Por qué es central:** ver criterio Beale-Kato-Majda, Bloque D. Toda la posibilidad de colapso está en la vorticidad.

> **PRÁCTICA A1 — Feynman sobre conservación.**
> Explicá por escrito, en menos de 150 palabras y sin usar ninguna palabra de este bloque, por qué un pipeline con más entradas que salidas acumula trabajo indefinidamente. Después leé lo que escribiste y marcá cada lugar donde tuviste que ser vago. Esos son los huecos.

> **PRÁCTICA A2 — instrumentación (N2).**
> Elegí un sistema real al que tengas acceso. Escribí la ley de conservación **explícita** para una etapa: cuáles son exactamente las fuentes, los sumideros, y qué métrica mide cada una. Si no podés instrumentar alguno de los cuatro términos, anotalo: **ese hueco de instrumentación es más valioso que la ecuación.**

---

## Bloque B — Regímenes y números adimensionales
*Acá está el 80% del valor práctico inmediato.*

**Número adimensional** ★ · N3
**Qué es:** un cociente de magnitudes que cancela unidades, y que por lo tanto **permite comparar sistemas que no se parecen en nada**. Reynolds compara un avión con una arteria.
**Por qué es la herramienta más importante del documento:** no transferimos ecuaciones, transferimos *ratios*. Un número adimensional captura el régimen de comportamiento independientemente de la escala.
**Cómo se construye uno:** identificar dos efectos que compiten, formar el cociente entre ellos, verificar que las unidades se cancelan. Si el cociente es ≫1 domina uno, si es ≪1 domina el otro, y **cerca de 1 está la transición interesante**.

**Flujo de Couette** ★ · N2
**Qué es:** fluido entre dos placas, una en movimiento. Perfil de velocidad **lineal**. El motor es la frontera.
**En software:** rollout controlado por un operador externo que mueve el slider (canary manual, feature flags con ramp).
`[ANALOGÍA FUERTE]`
**Predicción operativa:** el estrés (cizalladura) es `U/h`. Más capas intermedias `h` con la misma velocidad final `U` = menos estrés por capa.

**Flujo de Poiseuille** ★ · N2
**Qué es:** fluido en tubería impulsado por gradiente de presión, con velocidad cero en las paredes (*no-slip*). Perfil **parabólico**: rápido en el centro, cero en el borde.
**En software:** rollout impulsado por presión de negocio o backlog. El centro (servicios modernos, región principal) avanza; la pared (cliente legacy, región con compliance) no avanza nunca.
`[ANALOGÍA FUERTE]`
**Por qué la condición de no-deslizamiento es la mejor parte:** explica formalmente por qué nunca terminás de deprecar la API v1. La velocidad en la pared es cero por la física del problema, no por falta de ganas.

**Ley de Hagen-Poiseuille** ★★ · N2
**Qué es:** `Q = πR⁴ΔP / 8μL`. El caudal escala con la **cuarta potencia** del radio.
**En software:** duplicar el ancho del pool de workers no duplica el throughput: lo multiplica mucho más, hasta el quiebre de régimen.
`[METÁFORA]` — el exponente 4 viene de la geometría cilíndrica y **no hay razón para que sea 4 en un pipeline**. Lo transferible es "hay un tramo de retornos superlineales seguido de un quiebre", no el número.
**⚠ Trampa:** esta es la entrada del glosario donde es más fácil autoengañarse. Medí tu exponente, no lo asumas.

**Número de Reynolds `Re`** ★★ · N2
**Qué es:** `Re = inercia / viscosidad`. Bajo = laminar (predecible, ordenado). Alto = turbulento (caótico, con modos colectivos). La transición ocurre en un rango crítico.
**En software:** `Re_pipe = (λ·k) / μ_overhead`, con λ = jobs/s, k = fan-out, μ = overhead.
`[METÁFORA operacionalizable]` — la *forma* del número se puede definir; que exista un `Re` crítico universal es una hipótesis nuestra, no un resultado importado.
**Lo que predice:** por debajo del crítico podés razonar servicio por servicio. Por encima, no: aparecen comportamientos que no están en ninguna parte individual del sistema.

**Laminar / turbulento** ★ · N3
**Qué es:** los dos regímenes. Laminar: capas que se deslizan ordenadamente, el comportamiento agregado se deduce del local. Turbulento: cascada de escalas, mezcla, imprevisibilidad.
**En software:** la diferencia entre un sistema donde el post-mortem encuentra causa raíz única y uno donde no.
`[METÁFORA]` — pero es una metáfora *productiva*, porque sugiere la métrica que la haría verificable.

**Condición CFL / número de Courant** ★★ · N2 — **la joya práctica**
**Qué es:** Courant-Friedrichs-Lewy. Un esquema numérico explícito es estable solo si `Δt ≤ Δx/|u|`: **el paso de tiempo tiene que ser menor que el tiempo en que la información cruza una celda.** Si no, la simulación oscila y explota — no por un error de modelado, sino por aritmética.
**En software:** `Co = tick_del_scheduler / tiempo_de_tránsito_por_etapa`. Si tu HPA decide cada 30s y un job cruza la etapa en 5s, `Co = 6` y el flapping está garantizado.
`[ISOMORFO]` — es el mismo argumento: estás decidiendo sobre información que ya caducó. No hay nada metafórico acá.
**Por qué es la joya:** es el único item del proyecto que ya es accionable sin construir nada, y explica un fenómeno (thrashing del autoscaler) que la industria trata como magia negra.

> **PRÁCTICA B1 — calculá tu Courant (N2, 2 horas).**
> Para tres autoscalers o schedulers reales: medí el tick de decisión y el tiempo de tránsito p50 por etapa. Calculá `Co`. Cruzá con el historial de oscilación. **Este ejercicio solo ya justifica el tiempo invertido en todo el glosario.**

> **PRÁCTICA B2 — construí un número adimensional nuevo.**
> Elegí dos efectos que compitan en un sistema tuyo (ej.: velocidad de cambio del código vs velocidad de propagación de conocimiento en el equipo). Formá el cociente. ¿Es adimensional? ¿Qué predice cuando vale 0,1, 1 y 10? **Habilidad N3: la capacidad de fabricar números adimensionales nuevos es más valiosa que memorizar los existentes.**

---

## Bloque C — Discretización y solvers
*Cómo se pasa de una ecuación continua a un algoritmo. Acá vive el aporte técnico principal del Vol I.*

**Malla / celda / discretización** ★ · N2
**Qué es:** partir el dominio continuo en celdas finitas y guardar valores promedio por celda. Todo CFD real es esto.
**En software:** cada par (servicio, etapa) es una celda con su densidad de WIP y su velocidad de procesamiento.
`[ISOMORFO]`
**⚠ Trampa clave:** el modelo continuo solo vale si hay **muchas** unidades por celda. Regla práctica: menos de ~50 jobs por celda y el modelo de campo es basura; ahí hay que usar colas discretas (Bloque F).

**Ciclo Stable Fluids (Stam, 1999)** ★★ · N2
**Qué es:** el algoritmo estándar de simulación de fluidos en tiempo real. Cada paso: `add_force → advect → diffuse → project`.
**En software:** `llegan merges → los jobs avanzan → se aplica overhead → se reasignan recursos respetando capacidad`.
`[ISOMORFO estructural]` — es el bucle de un scheduler, escrito por un gráfico en 1999.

**Proyección de Helmholtz-Hodge** ★★★ · N2 — **el aporte central**
**Qué es:** después de advectar, el campo ya no conserva masa. Se corrige resolviendo `Δp = ∇·u*` y restando `∇p`. Matemáticamente es la **proyección ortogonal** del campo sobre el subespacio de divergencia nula.
**En software:** después de que cada servicio pide lo que quiere, la suma viola la capacidad. Se corrige resolviendo un dual y restando el gradiente de precio.
`[ISOMORFO]` — **son el mismo teorema**, no una analogía.

**Presión como multiplicador de Lagrange** ★★★ · N3 — **el insight que hay que poder explicar**
**Qué es:** en flujo incompresible, la presión **no es una variable dinámica con su propia ecuación de evolución**. Es el multiplicador de Lagrange de la restricción `∇·u = 0`: el precio de forzar la conservación.
**En software:** el precio sombra de un recurso escaso es el multiplicador de Lagrange de la restricción de capacidad.
`[ISOMORFO]` — mismo objeto matemático, dos nombres.
**Por qué esto es lo que hay que entender de verdad:** si lo entendés, entendés por qué un scheduler con proyección genera *backpressure automático*. Cuando el deploy se atasca río abajo, el precio sube y frena los gates río arriba **sin que nadie lo haya programado**. Emerge de la restricción.
**Test de N3:** explicá por qué la presión no necesita condición inicial. (Respuesta: porque no evoluciona; se determina instantáneamente por la restricción en cada momento.)

**Ecuación de Poisson** ★★ · N1/N2
**Qué es:** `Δφ = ρ`. La ecuación más común de la física. Resolverla es el paso caro de todo solver de fluidos.
**En software:** el equivalente sobre el Laplaciano de grafo. Costo computacional real, hay que medirlo antes de proponer un scheduler basado en esto.

**AMR — refinamiento adaptativo de malla** ★★ · N2
**Qué es:** no usar la misma resolución en todo el dominio; refinar donde el gradiente es grande.
**En software:** sampling de tracing proporcional al gradiente local de latencia. Servicio plano → 1%. Servicio con derivada alta → 100%.
`[ANALOGÍA FUERTE]` — y produce ahorro medible en euros, que es el mejor tipo de validación.

> **PRÁCTICA C1 — implementá Stable Fluids (N2/N3, 1 fin de semana).**
> Escribí un solver de fluidos 2D básico en la grilla, con los cuatro pasos. **No para el proyecto: para entenderlo con las manos.** Hasta que no hayas visto tu propio código de proyección corregir un campo divergente, la §4.2 del Vol I es literatura. Después de eso, es intuición.

> **PRÁCTICA C2 — la explicación de dos minutos.**
> Explicale a alguien de producto, sin ecuaciones, por qué "resolver la presión" es lo mismo que "poner precio a un recurso escaso". Si no podés en dos minutos, todavía estás en N1.

---

## Bloque D — Singularidad, colapso y los resultados de 2026
*El material que originó todo esto.*

**Blowup en tiempo finito** ★★ · N3
**Qué es:** una solución que arranca suave y en la que alguna magnitud diverge a infinito en un tiempo finito `T`. No es que el sistema se degrade: es que la ecuación deja de tener solución.
**En software:** `[METÁFORA]` estricta — **en tu infra el blowup literal es imposible**, porque no hay escalas infinitamente pequeñas: hay un cutoff duro en el tamaño del pod. El análogo riguroso es la saturación de colas, `ρ → 1` (Bloque F).
**⚠ Trampa mayor del proyecto:** decir "aplicamos la solución de Navier-Stokes al DevOps" es falso y nos quema. Lo que transferimos es el **mecanismo**, no el teorema.

**Forzamiento suave (el matiz que la prensa se comió)** ★★ · N3
**Qué es:** los resultados de 2026 (Alpöge-Buckmaster para Euler 3D, OpenAI para Navier-Stokes) prueban blowup **con un término de forzamiento suave aplicado**. El problema del Clay canónico —sin forzamiento— sigue abierto, y la verificación independiente está en curso.
**Por qué importa para nosotros:** el forzamiento suave es *exactamente* nuestro caso de interés. Un fluido al que se le aplica una fuerza bien portada y aún así explota es la descripción formal de un sistema con tráfico normal que se cae solo.

**Mecanismo lo/hi (Córdoba-Martínez-Zoroa → Alpöge-Buckmaster)** ★★★ · N3 — **lo único que realmente transferimos**
**Qué es:** se parte de una solución de baja frecuencia `u_lo` y se le suman correcciones de alta frecuencia `u_hi` que resuelven aproximadamente la ecuación **linealizada** `N'(u_lo)·u_hi ≈ 0`, diseñando `u_lo` para que ese linealizado sea **inestable**. La corrección arranca exponencialmente chica y se vuelve grande justo antes del tiempo de blowup. Se itera con frecuencias que crecen rápido.
**En software:** perturbaciones internas pequeñas y de alta frecuencia —retries, health checks, crons, cache invalidations— acumulándose resonantemente sobre un flujo base sano, hasta romper el sistema, **mientras el input externo se ve perfecto**.
`[ANALOGÍA FUERTE]` — es la descripción formal de un fallo metaestable, que la literatura de sistemas describe pero no formaliza.
**Test de N3:** explicá por qué el truco requiere que el linealizado sea inestable. (Porque si fuera estable, la perturbación chica se amortiguaría en vez de crecer.)

**Linealización** ★★ · N2
**Qué es:** aproximar un operador no lineal por su derivada alrededor de un estado base. `N(u_lo + δ) ≈ N(u_lo) + N'(u_lo)·δ`. La estabilidad del sistema frente a perturbaciones chicas está gobernada por el espectro de `N'`.
**En software:** el comportamiento de tu sistema frente a un pico chico está determinado por el estado en el que estaba, no por el pico. **El mismo pico de 5% puede ser inocuo o fatal según el flujo base.**
`[ANALOGÍA FUERTE]` — y esto sí es medible: es análisis de estabilidad estándar.

**Autosemejanza / self-similar** ★★ · N2
**Qué es:** la solución cerca del colapso se parece a sí misma reescalada: `u(x,t) ≈ (T−t)^(−α) · U(x/(T−t)^β)`. Colapsa cada vez más rápido y más chico, con la misma forma.
**En software:** hipótesis de que la latencia previa a un colapso sigue `L(t) ~ (T−t)^(−α)`, lo que permitiría estimar `T` **antes** de que ocurra.
`[METÁFORA con riesgo alto]` — sin invariancia de escala real, el ajuste autosemejante es empírico, no teórico. **Riesgo enorme de sobreajuste. Validación out-of-sample obligatoria.**

**Ansatz** ★ · N1
**Qué es:** una forma funcional propuesta a mano para la solución, que después se verifica. No es una deducción: es una apuesta educada que se valida a posteriori.
**Por qué está en el glosario:** es el término que más aparece en estos papers y el que más confunde. Buena parte de la matemática moderna de fluidos consiste en **adivinar bien** y después probar que la adivinanza funciona.

**Criterio Beale-Kato-Majda** ★★★ · N1 — **la pregunta abierta más linda del proyecto**
**Qué es:** en Euler, la solución sigue siendo suave mientras `∫₀ᵀ ‖ω(t)‖_∞ dt < ∞`. O sea: **el blowup está enteramente controlado por la vorticidad acumulada.** Nada más importa.
**En software:** si existiera un análogo, **la integral acumulada de la tasa de retries sería el único predictor necesario de colapso**. Un solo número.
`[ESPECULATIVO]` — no hay teorema. Pero es directamente testeable y sería un resultado precioso.

**Formalización en Lean** ★ · N1
**Qué es:** un asistente de demostración donde un teorema se verifica mecánicamente. Que un resultado esté formalizado significa que la lógica es correcta, **no** que las definiciones sean las que uno cree que son.
**Por qué está acá:** es la distinción entre "verificado" y "aceptado". Ambos resultados de 2026 están formalizados; ninguno tiene aún aceptación independiente de la comunidad.

**PINN — red neuronal informada por física** ★★ · N1
**Qué es:** una red entrenada con la ecuación diferencial en la función de pérdida, así que aprende soluciones que respetan la física. Se usó para *localizar numéricamente* perfiles de blowup candidatos, que después hay que probar rigurosamente.
**Relevancia para el lab:** es el patrón "usá ML para encontrar el candidato, usá matemática para probarlo". Buen modelo metodológico para nuestros propios experimentos.

> **PRÁCTICA D1 — el resumen de tres niveles.**
> Escribí qué pasó en 2026 con Euler y Navier-Stokes en **tres versiones**: (a) un tuit, (b) un párrafo para un ingeniero senior, (c) media página con los matices de forzamiento, prioridad y verificación. Si la versión (a) contiene algo falso, reescribí las tres.

> **PRÁCTICA D2 — busca tu mecanismo lo/hi.**
> Tomá un incidente real de tu historial que no tuvo causa externa clara. Reconstruí: ¿cuál era el flujo base? ¿Cuáles eran las perturbaciones de alta frecuencia? ¿Qué las hizo crecer en vez de amortiguarse? **Este ejercicio es el corazón del proyecto**, y se puede hacer hoy con un post-mortem viejo y una hora.

---

## Bloque E — Grafos, geometría y topología
*El bloque con mayor valor por unidad de esfuerzo. Todo se calcula sobre el mismo objeto.*

**Grafo de dependencias** ★ · N2
**Qué es:** nodos = servicios, aristas = llamadas, pesos = tráfico. **Es el objeto central de todo el Vol II.** Los tres análisis de este bloque corren sobre él.

**Laplaciano de grafo `L = D − A`** ★★ · N2
**Qué es:** la versión discreta del laplaciano `Δ` sobre un grafo. `D` es la matriz de grados, `A` la de adyacencia. Su espectro codifica conectividad, cuellos de botella y velocidad de difusión.
`[ISOMORFO]` — es literalmente el análogo discreto, con teoremas propios.
**Por qué importa:** es lo que hace que la proyección de Hodge sea **exacta** sobre un grafo y no una aproximación.

**Descomposición de Hodge (combinatoria)** ★★★ · N2 — **el entregable diferenciador**
**Qué es:** todo flujo sobre las aristas de un grafo se descompone de forma **única** en tres partes ortogonales:
- **Gradiente** — flujo que baja desde un potencial. *Trabajo que progresa.*
- **Curl (rotacional)** — circulación local. *Retries, ping-pong, churn.*
- **Armónica** — flujo global sin fuente ni sumidero, que vive en los ciclos de la topología. *Deuda estructural.*

**En software:** tres números por servicio que ninguna herramienta de observabilidad del mercado te da. Datadog te da latencia por span; nadie te dice qué fracción de tu tráfico es curl puro.
`[ISOMORFO]`
**⚠ Trampa:** la interpretación de la componente armónica como "deuda estructural" es **nuestra hipótesis**, no un resultado. La descomposición es un teorema; el significado que le damos, no. Test: si un refactor rompe un ciclo de dependencias, la armónica debería caer de forma medible. Si no cae, la interpretación está mal.

**Curvatura de Ricci discreta (Ollivier / Forman)** ★★★ · N2
**Qué es:** una noción de curvatura para grafos. Aristas con **curvatura muy negativa** son puentes entre comunidades: cuellos de botella por donde tiene que pasar toda la información. Curvatura positiva = zonas híper-conectadas.
**En software:** detecta cuellos de botella arquitectónicos **usando solo la topología**, sin saber nada del tráfico. Se calcula hoy con `GraphRicciCurvature`.
`[ISOMORFO]` — el grafo de servicios es un grafo, punto.

**Over-squashing / over-smoothing** ★★ · N2
**Qué es:** los dos modos de fallo del paso de mensajes en grafos, y están en **extremos opuestos del mismo espectro**: el over-squashing (información que no llega, estrangulada por el cuello de botella) se liga a curvatura negativa; el over-smoothing (todo se vuelve indistinguible) a curvatura positiva.
**En software:** over-squashing = el cuello de botella arquitectónico. Over-smoothing = el monolito distribuido, donde nadie sabe qué hace qué y no hay límites de propiedad.
`[ANALOGÍA FUERTE]`
**Por qué es valioso:** te da **una sola métrica con dos umbrales** para dos patologías que hoy se discuten por separado y sin números.

**Rewiring** ★★ · N2
**Qué es:** modificar la topología (agregar o sacar aristas) para mejorar el flujo de información, guiado por curvatura.
**En software:** refactor arquitectónico guiado por geometría. El algoritmo no solo te dice *que* hay un problema: te dice *qué arista tocar*.

**Percolación y `p_c`** ★★ · N2
**Qué es:** al ir removiendo nodos, existe una fracción crítica en la que el componente gigante se fragmenta. **La transición es aguda, no gradual.** Las redes libres de escala son robustas ante fallos aleatorios y frágiles ante ataques dirigidos a los nodos de alto grado.
**En software:** fallo aleatorio = pod que muere. Ataque dirigido = se cae auth o service discovery.
`[ISOMORFO]`

**k-core** ★★ · N2
**Qué es:** el subgrafo máximo donde todo nodo tiene al menos `k` vecinos dentro. Identifica el núcleo estructural.
**En software:** **el conjunto de servicios sin los cuales no queda nada en pie.** Es el objeto que todos los diagramas de "arquitectura crítica" intentan dibujar a ojo y siempre les sale mal. Se calcula en minutos.

**Percolación explosiva** ★★★ · N1
**Qué es:** reglas que retrasan deliberadamente la formación del componente gigante hacen que la transición, cuando llega, sea **más abrupta**.
**En software (hipótesis):** circuit breakers y bulkheads retrasan la propagación de fallos, pero podrían estar volviendo los fallos que sí se propagan cualitativamente más catastróficos. Menos incidentes, cola más pesada.
`[ESPECULATIVO pero falsable]` — comparar la distribución de tamaño de incidentes antes y después de introducir aislamiento.

> **PRÁCTICA E1 — el analizador geométrico (N2, 1 semana). El ejercicio de mayor rendimiento del glosario.**
> Sobre un grafo de dependencias real, calculá: (1) curvatura de Ricci por arista, (2) k-core, (3) curva de percolación. Visualizá el grafo coloreado por curvatura. Contrastá el ranking de criticidad resultante contra el runbook que el equipo tiene escrito.
> **Las tres métricas son independientes, corren sobre el mismo insumo, y ninguna herramienta comercial las ofrece.** Esto solo ya es un producto del lab.

---

## Bloque F — Colas y capacidad
*La alternativa aburrida, rigurosa y establecida. Hay que dominarla, porque es el baseline a batir.*

**Ley de Little `L = λW`** ★ · N3
**Qué es:** WIP = tasa de llegada × tiempo de permanencia. **Exacta, sin ningún supuesto sobre distribuciones.** Vale siempre.
**En software:** jobs en el pipeline = merges/hora × lead time.
`[ISOMORFO]` — no es física prestada, es la misma contabilidad de la ley de conservación del Bloque A.
**Por qué es N3:** es la ecuación más útil y menos usada de la ingeniería de software. Se aplica en tres segundos y responde la mitad de las preguntas de capacidad.

**Utilización `ρ`** ★ · N3
**Qué es:** fracción del tiempo que el recurso está ocupado. `ρ = λ/μ`.
**⚠ La trampa más cara de la industria:** los managers quieren `ρ` cerca de 1 porque "no desperdiciar recursos". La fórmula de Kingman dice por qué eso es catastrófico.

**Fórmula de Kingman** ★★ · N3 — **el análogo riguroso del blowup**
**Qué es:** `Wq ≈ (ρ/(1−ρ)) · ((c_a² + c_s²)/2) · τ`. La espera explota como `1/(1−ρ)`.
**Los números que hay que tener memorizados:** a `ρ = 0,8` esperás ~4τ. A `ρ = 0,95`, ~19τ. A `ρ = 0,99`, ~99τ.
**Por qué es el corazón del proyecto:** **ese factor `1/(1−ρ)` es la singularidad real de tu sistema.** No hace falta Navier-Stokes para explicar por qué un cluster al 95% se comporta como un fluido que revienta. Cualquier cosa que construyamos con fluidos tiene que ganarle a esto, que es más simple, tiene garantías y está en los libros hace 60 años.
**El otro término:** `c_a²` y `c_s²` son los coeficientes de variación de llegadas y servicio. **La variabilidad multiplica la espera.** Reducir varianza es tan efectivo como agregar capacidad, y suele ser más barato.

**Backpressure** ★ · N3
**Qué es:** propagar hacia atrás la señal de saturación para que el productor frene.
**En software:** lo que el scheduler con proyección de Hodge genera *automáticamente* vía el gradiente de precio, en vez de cablearlo a mano en cada punto.

**Redes de colas** ★★★ · N1
**Qué es:** varias colas conectadas con topología, feedback y correlación. **Acá es donde la teoría de colas clásica se vuelve intratable analíticamente.**
**Por qué importa:** es exactamente el hueco donde el enfoque de campo sobre grafos podría aportar algo real. Si nuestro método le gana a Kingman en algún lado, va a ser acá.

> **PRÁCTICA F1 — el baseline honesto (N3, 3 horas).**
> Antes de escribir una línea de código del scheduler de fluidos: aplicá Little y Kingman a un pipeline real. Estimá `ρ`, `c_a²`, `c_s²`. Predecí la espera. Compará con la medida.
> **Si Kingman ya predice bien tu sistema, el proyecto de fluidos tiene que justificar qué agrega.** Hacer esto primero es lo que separa investigación de entusiasmo.

---

## Bloque G — Umbrales, redundancia y fiabilidad

**Teorema del umbral** ★★ · N3
**Qué es:** en corrección de errores cuántica, la supresión exponencial del error lógico al agregar redundancia **solo ocurre si la tasa de error físico está por debajo de un umbral crítico**. Por encima, agregar redundancia empeora el sistema: cada componente nuevo introduce más errores de los que corrige.
**En software:** si tus reintentos generan más carga de la que resuelven, estás amplificando. Un retry storm es operar por encima del umbral.
`[ANALOGÍA FUERTE]` — la *forma* de la ley se transfiere; el número del umbral no. **No hay un "0,1%" mágico para infra.**

**Factor de supresión `Λ`** ★★ · N2
**Qué es:** cuánto baja el error lógico por cada incremento de redundancia. En el experimento de Willow, `Λ = 2,14` al aumentar la distancia del código en 2.
**En software:** `Λ_infra` = cociente entre tasas de incidentes con `n` y con `n+1` niveles de redundancia. `Λ > 1` funciona, `Λ ≈ 1` es coste puro, `Λ < 1` te está haciendo daño.
**Métrica propia del lab, calculable con historial de incidentes.**

**Errores correlacionados** ★★ · N3 — **el detalle que cambia todo**
**Qué es:** en el experimento de códigos de repetición hasta distancia 29, el límite de performance no fueron los errores independientes sino **eventos correlacionados raros**, del orden de uno por hora.
**En software:** caída de AZ, bug en el binario común, certificado que expira en todas partes.
**Por qué importa tanto:** todo cálculo de "cinco nueves con tres réplicas" asume independencia. **Ellos lo midieron; nosotros lo asumimos.** La predicción del lab es que en cualquier sistema maduro, la mayoría de los incidentes reales son correlacionados, lo que hace que la inversión marginal en réplicas tenga `Λ ≈ 1`.

**Latencia del decodificador** ★★ · N2
**Qué es:** en QEC, el decodificador clásico tiene ~63 µs de latencia sobre ciclos de 1,1 µs. **Tiene que seguirle el ritmo al flujo de síndromes o el backlog crece sin techo.**
**En software:** tu MTTD + MTTR es un decodificador. Si es más lento que la tasa de llegada de fallos, la redundancia no te salva: los errores sin corregir se acumulan.
`[ISOMORFO]` — es una restricción de cola sobre tu sistema de detección, y conecta directo con CFL.

**Fallo metaestable** ★★ · N3
**Qué es:** el sistema entra en un estado sostenido de mal funcionamiento que **persiste incluso cuando el disparador original desapareció**. Retry storms, cache stampedes, thundering herds.
**Conexión central del proyecto:** el mecanismo lo/hi del Bloque D es la formalización de esto, y el paisaje rugoso de abajo es su estructura estática.

**Paisaje rugoso / metaestabilidad (vidrios de espín)** ★★ · N1
**Qué es:** un espacio de configuraciones con exponencialmente muchos mínimos locales separados por barreras. El sistema queda atrapado en uno malo.
**En software:** explica formalmente por qué **"reiniciá todo" funciona**: es un enfriamiento brusco fuera de una cuenca metaestable. No es ignorancia; es la técnica correcta para ese tipo de paisaje.
**Derivado:** chaos engineering como *recocido* — agitar el sistema para que no se asiente en un mínimo frágil.

---

## Bloque H — Escala y transiciones de fase

**Ley de potencia** ★★ · N2
**Qué es:** `Y ∝ N^β`. En log-log es una recta de pendiente `β`.
**⚠ La trampa estadística más peligrosa del proyecto:** con pocos puntos, una ley de potencia es **indistinguible** de una log-normal, una exponencial truncada o el ruido. Ajustar una recta en log-log y declarar victoria es el error clásico. **Clauset-Shalizi-Newman es lectura obligatoria antes de reportar cualquier `β`.**

**Escalado sub y superlineal** ★★ · N2
**Qué es:** `β < 1` = economía de escala (infraestructura urbana, β ≈ 0,85). `β > 1` = rendimientos crecientes y también costes crecientes (producto socioeconómico urbano, β ≈ 1,15).
**En software (a medir):** coste de infra vs nº de servicios debería ser sublineal; incidentes/mes vs nº de servicios, superlineal.

**Singularidad por crecimiento superlineal** ★★★ · N3 — **el cierre del círculo**
**Qué es:** en el modelo de escala urbana, el crecimiento superlineal sobre recursos finitos conduce a una **singularidad en tiempo finito**, evitable solo mediante innovaciones sucesivas que resetean los parámetros — y cada reseteo debe llegar más rápido que el anterior.
**En software:** cada refactor grande, cada migración de framework, cada reescritura, compra tiempo. Y hay que hacerlos cada vez más seguido.
**Por qué es el mejor hallazgo del Vol II:** es el **mismo fenómeno matemático** del Vol I, alcanzado por un camino totalmente independiente. Si medimos `β` para incidentes vs servicios, tenemos una estimación cuantitativa de cuándo un codebase necesita su próximo reseteo.

**Transición de fase** ★★ · N3 — **la tesis unificadora**
**Qué es:** un cambio cualitativo de comportamiento al cruzar un valor crítico de un parámetro. Abrupto, no gradual.
**La tesis del proyecto, en una línea:**
> **Los sistemas de software se rompen como transiciones de fase, no como acumulaciones de bugs. Existen umbrales; cruzarlos es cualitativo y a menudo abrupto; y casi ninguno de esos umbrales se está midiendo hoy.**

Tres umbrales independientes la sostienen: el umbral de redundancia (Bloque G), el `p_c` de percolación (Bloque E) y la singularidad por superlinealidad (este bloque). Más el `ρ → 1` de Kingman (Bloque F), que es el único con demostración.

---

## Bloque I — Método y epistemología
*El bloque más importante y el que más se saltea.*

**Isomorfismo vs analogía vs metáfora** ★★★ · N3
- **Isomorfismo:** los dos sistemas comparten la misma estructura matemática. Los teoremas se transfieren. (Presión ≡ multiplicador de Lagrange.)
- **Analogía fuerte:** el mecanismo es similar y las predicciones cualitativas se transfieren, pero los números no. (Viscosidad ≈ overhead.)
- **Metáfora:** ayuda a pensar y no predice nada. (Turbulencia organizacional.)

**La disciplina de mantener esta distinción es el 90% de la diferencia entre un lab de investigación y un blog de LinkedIn.** Y es difícil precisamente porque las tres se *sienten* igual de convincentes por dentro.

**Falsabilidad y criterio de muerte** ★★ · N3
Cada hipótesis del proyecto tiene que venir con la condición explícita bajo la cual la abandonamos, **escrita antes de correr el experimento**. Escribirla después es racionalización.

**Baseline** ★★ · N3
La alternativa aburrida contra la que hay que competir. Acá es Kingman + backpressure simple. **Un método nuevo que empata con el baseline perdió**, porque el baseline es más simple y ya está desplegado.

**Sobreajuste y validación out-of-sample** ★★ · N3
Especialmente crítico para el detector de blowup autosemejante: ajustar una curva a incidentes pasados es trivial y no significa nada. **El único resultado que cuenta es la predicción sobre datos que no viste al ajustar.**

**Resultado negativo** ★★ · N3
Un experimento bien diseñado que falla es un entregable, no un fracaso. Publicarlos es lo que le da credibilidad a los positivos. **Si el lab nunca publica negativos, nadie debería creerle los positivos.**

**Búsqueda evolutiva con evaluador duro** ★★ · N2
El patrón de AlphaEvolve: LLM propone mutaciones al código, un evaluador objetivo selecciona, se itera. Produjo una heurística de scheduling que lleva más de un año en producción en Borg recuperando el 0,7% del cómputo global de Google, un 23% de speedup en un kernel de Gemini y hasta 32,5% en FlashAttention.
**La restricción de diseño que hay que copiar:** la solución de Borg es **código legible por humanos**, y esa legibilidad —interpretabilidad, depurabilidad, predictibilidad— es lo que la hizo desplegable. **La calidad del resultado está determinada enteramente por la calidad del evaluador.**

**Indecidibilidad y timeouts** ★★ · N3
BB(5) = 47.176.870, verificado formalmente en Coq; BB(6) está más allá de cualquier notación decimal. Con **cinco estados** la parada ya es prácticamente indecidible.
**Consecuencia dura:** cualquier producto que prometa predecir si tu build se va a colgar choca contra un muro teórico, no de ingeniería. **Los timeouts no son deuda técnica: son la única estrategia correcta**, y hay que diseñarlos como tales.

---

## Bloque J — Mapa de dependencias conceptuales

Qué hay que saber antes de qué. Seguir este orden ahorra semanas:

```
A (campos, conservación)
├── B (regímenes, adimensionales) ──────► CFL ★ empezar acá para valor inmediato
├── C (discretización, Hodge, presión) ──► requiere A completo
│   └── E (grafos, Hodge discreto) ─────► requiere C
│       └── Ricci, percolación ─────────► requiere solo E, no C
├── D (blowup, mecanismo lo/hi) ────────► requiere A + linealización
└── F (colas) ─────────────────────────► INDEPENDIENTE, se puede hacer primero

G (umbrales) ──── independiente, requiere solo probabilidad básica
H (escala) ────── requiere estadística de leyes de potencia, no física
I (método) ────── transversal, leer primero y releer siempre
```

**Dos rutas rápidas si tenés poco tiempo:**
- **Ruta valor inmediato (1 semana):** F → B (CFL) → E (Ricci + percolación). Todo calculable, cero teoría de PDEs.
- **Ruta comprensión profunda (1 mes):** A → C → D. Termina en poder leer los papers de 2026 y entender de qué hablan.

---

## 11. Autoevaluación — recuperación espaciada

Responder **de memoria, por escrito**, antes de mirar. Calendario: día 1, 3, 7, 21, 60.

**Nivel 1 — reconocimiento**
1. ¿Qué diferencia hay entre Couette y Poiseuille, y qué tipo de rollout representa cada uno?
2. ¿Qué mide el número de Reynolds y qué significan valores altos y bajos?
3. ¿Cuáles son las tres componentes de la descomposición de Hodge?
4. ¿Qué es el forzamiento y por qué el matiz "con forzamiento suave" cambia el titular de 2026?

**Nivel 2 — cálculo**
5. Escribí la fórmula del número de Courant para un scheduler y explicá qué predice `Co > 1`.
6. Con Kingman: a utilización 0,9, ¿cuántas veces el tiempo de servicio esperás en cola?
7. ¿Cómo se calcula `Λ_infra` y qué significa que dé menos de 1?
8. Un servicio tiene curvatura de Ricci muy negativa en sus aristas. ¿Qué patología esperás?

**Nivel 3 — comprensión y límites**
9. Explicá, sin ecuaciones, por qué la presión en un fluido incompresible y el precio de un recurso escaso son el mismo objeto matemático.
10. ¿Por qué el blowup literal es imposible en tu infraestructura, y cuál es el análogo riguroso?
11. Describí el mecanismo lo/hi y explicá por qué requiere que el linealizado sea **inestable**.
12. Nombrá tres cosas de este glosario que sean `[METÁFORA]` y explicá qué haría falta para promoverlas a `[ANALOGÍA FUERTE]`.
13. ¿Cuál es el baseline que todo el proyecto tiene que batir, y por qué empatar significa perder?
14. Un colega dice: "agregamos una cuarta réplica, ahora tenemos cuatro nueves". ¿Qué le preguntás?
15. ¿Por qué un ajuste de ley de potencia con 15 puntos no es evidencia de casi nada?

**Meta-pregunta (la que más importa)**
16. ¿Qué parte de este glosario creés que entendés y no calculaste todavía? Esa es tu lista de tareas real.

---

## 12. Errores de calibración a vigilar

Cuatro sesgos específicos que este material dispara, y cómo detectarlos en uno mismo:

**Fluidez confundida con comprensión.** Estos conceptos son vívidos y se recuerdan fácil. La facilidad de recordar se siente igual que la comprensión y no lo es. *Detección: intentá el cálculo. Si no sale, era fluidez.*

**Coherencia confundida con verdad.** Cuando un marco explica todo, dejó de ser falsable. *Detección: pedite un ejemplo de algo que el marco NO explique. Si no encontrás ninguno, el marco no está diciendo nada.*

**Autoridad prestada.** Que Navier-Stokes sea difícil no vuelve más cierta tu analogía. El prestigio del origen no se transfiere con el concepto. *Detección: sacá el nombre propio y volvé a leer el argumento. ¿Sigue en pie?*

**Sesgo del que construye.** Una vez que invertís tres semanas en el scheduler de Hodge, vas a querer que le gane a Kingman. *Detección: el criterio de muerte se escribe antes, y lo evalúa alguien que no lo construyó.*

---

*Documento vivo. Actualizar el marcado `[ISOMORFO] / [ANALOGÍA] / [METÁFORA]` cada vez que un experimento cambie el estatus de una correspondencia — que es, en definitiva, lo que el lab está midiendo.*