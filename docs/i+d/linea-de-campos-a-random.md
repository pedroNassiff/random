# La línea de campos aplicada a `.random()`
### Documento de trabajo — `.random()` lab
**Versión:** 0.1
**Fecha:** 2026-09-09
**Serie:** Vol I (fluidos) · Vol II (marcos transferibles) · Glosario · **este documento**

---

## 0. La pregunta

Los tres documentos anteriores son investigación abstracta. Este pregunta lo único que importa a nivel negocio: **¿esto tiene algo que ver con lo que `.random()` ya es, o es un hobby paralelo?**

La respuesta corta, y la tesis de este documento:

> **`.random()` ya viene trabajando con campos, flujos y sistemas dinámicos en casi todos sus proyectos, sin haberlo nombrado nunca así. La línea de investigación no agrega un tema nuevo: le pone nombre y matemática a lo que ya era el patrón común.**

Y con eso viene una advertencia que hay que leer antes que el resto, porque es el riesgo real de este documento entero: **cualquier fundador puede retro-ajustar una teoría unificadora a lo que ya construyó.** Es un ejercicio placentero y casi siempre falso. La sección §7 es el antídoto, y conviene leerla primero si te empieza a gustar demasiado lo que estás leyendo.

---

## 1. La esencia: qué es `.random()` en términos del marco

El nombre ya dice algo preciso.

`random()` es una **función determinista que devuelve algo impredecible**. No hay azar adentro: hay una semilla, un algoritmo fijo, y una salida que ningún observador razonable puede anticipar. Es exactamente la relación que la mecánica de fluidos pasó dos siglos tratando de entender: **Navier-Stokes es completamente determinista y produce turbulencia.**

Eso ubica al lab en un lugar conceptual bien definido:

> **`.random()` trabaja con sistemas deterministas cuyo comportamiento agregado no es deducible de sus partes.**

Cerebros, mercados, pipelines, tráfico urbano, embeddings semánticos, enjambres de agentes. Todos son eso. Y todos aparecen ya en la cartera del lab, lo cual no fue una decisión estratégica sino una atracción repetida hacia el mismo tipo de problema. Ponerle nombre convierte esa atracción en posicionamiento.

**Barrilete Cósmico**, como nombre societario, encaja mejor de lo previsto: una trayectoria que ningún defensor pudo predecir aunque toda la física fuera clásica.

---

## 2. Mapeo producto por producto

### 2.1 ADA — el caso más fuerte, y el que menos esperaba

ADA no *se parece* a un análisis de campos. **Es un análisis de campos.** El EEG es literalmente un campo escalar (potencial eléctrico) muestreado en varios puntos de la superficie del cráneo, evolucionando en el tiempo. Todo el Bloque A del glosario aplica sin metáfora.

Y hay tres conexiones concretas, no decorativas:

**(a) El ratio de Berger ya es un número adimensional.**
Un ratio 2,545× es exactamente lo que el Bloque B llama la herramienta más importante del arsenal: un cociente que cancela unidades y permite comparar sesiones, sujetos y días entre sí. **Ya estás haciendo la práctica B2 sin saberlo.** La pregunta que abre: ¿cuántos otros números adimensionales se pueden construir con los datos que ADA ya guarda? Cada uno es una métrica de sesión nueva, comparable entre sesiones, sin necesidad de más hardware.

**(b) El exponente aperiódico y la hipótesis del cerebro crítico.**
Acá está lo bueno. La actividad neuronal exhibe avalanchas cuyo tamaño sigue una distribución de ley de potencia, y la hipótesis del cerebro crítico sostiene que el cerebro opera cerca de un punto crítico —justo en el borde de una transición de fase— porque ahí se maximizan la capacidad de procesamiento y el rango dinámico. Es una hipótesis debatida, no un hecho establecido, pero es medible.

Relacionado y más inmediatamente accionable: el espectro de EEG tiene una **componente aperiódica 1/f** además de los picos oscilatorios. Separar las dos (metodología FOOOF/specparam) da un **exponente de la pendiente espectral** que se interpreta como proxy del balance excitación/inhibición, y que se mueve con estado de conciencia, sueño, anestesia y meditación.

> **Esto conecta ADA con el Bloque H del glosario de forma directa: el exponente aperiódico es una ley de potencia, con todos los riesgos estadísticos que el glosario advierte, y ADA ya tiene los datos crudos por canal para calcularlo.**

**Experimento — RND-01:** calcular el exponente aperiódico por ventana sobre las sesiones ya almacenadas y ver si se mueve durante la meditación de forma distinta a como se mueven las bandas clásicas. Si el aperiódico se mueve y las bandas no, **tenés una métrica más sensible que la que estás usando**, sobre datos que ya guardaste. Coste: un fin de semana. Sin hardware nuevo.

**(c) El artefacto gamma persistente es un problema de campos, no de ruido.**
La tensión mandibular contamina gamma porque el EMG es otro campo superpuesto al que querés medir. La separación de campos superpuestos es un problema clásico con herramientas específicas (ICA, filtrado espacial). Encuadrarlo así da la familia de soluciones correcta en vez de tratarlo como ruido a tolerar.

**(d) La arquitectura hot/cold es multi-escala.**
InfluxDB por ventana, Postgres por sesión. Eso es exactamente lo que en física se llama *coarse-graining*: dos niveles de descripción, uno fino y transitorio, otro grueso y permanente. La regla arquitectónica que ya definiste es una decisión de renormalización, y está bien tomada.

**Y la conexión con la teoría sintérgica:** el trabajo de Grinberg es, en su formulación, una teoría de campos con una estructura tipo lattice. Independientemente de qué se piense de su estatus científico, **el vocabulario formal correcto para discutirlo es el del Bloque A y E** — campos, lattices, operadores sobre grafos. Eso permite algo valioso: hablar de esas ideas con precisión matemática en vez de con vaguedad, y por lo tanto poder decir claramente qué parte es medible y qué parte no.

### 2.2 Red Hermes — el mejor banco de pruebas que tenés

El Vol I propone un scheduler con proyección de presión (EXP-04) y advierte que probarlo en infra de cliente es caro y arriesgado.

**Red Hermes es el banco de pruebas ideal, y ya está construido.**

Un orquestador que rutea a agentes de dominio, con capacidad finita (presupuesto de tokens, ventana de contexto, coste por modelo), es **exactamente** el problema de asignación con restricción de capacidad del Bloque C:

| Fluidos | Red Hermes |
|---|---|
| Campo de velocidad | Tasa de progreso de cada agente |
| Restricción de capacidad | Presupuesto de tokens / coste por hora |
| Presión / precio sombra | Coste marginal de rutear a Opus vs Sonnet vs Haiku vs Qwen local |
| Proyección | La decisión de ruteo del orquestador |
| Viscosidad | Latencia de arranque de agente, overhead de contexto |
| Número de Courant | Frecuencia de decisión del orquestador vs duración de una tarea de agente |

**El insight aplicable hoy:** hoy el ruteo es por tipo de tarea (mecánico → Haiku/Qwen, dominio → Sonnet, orquestación → Opus). Eso es una política **estática**. Una política con precio sombra es **dinámica**: cuando el presupuesto se aprieta, el precio sube y el ruteo se desplaza solo hacia modelos baratos, sin reglas nuevas escritas a mano. Emerge de la restricción.

**Y el número de Courant aplica literalmente:** si el orquestador replanifica cada N pasos pero un subagente completa su tarea en menos que eso, estás decidiendo sobre estado caducado. La topología aplanada a supervisor-con-subagentes ya te limitó la profundidad; el `Co` te dice el **ritmo** correcto.

**Experimento — RND-02:** medir `Co` en Red Hermes y calcular el coste por tarea completada bajo la política actual. Es el baseline para cualquier scheduler que construyamos, y es un sistema propio: se puede romper sin consecuencias.

### 2.3 HCG — ya estás haciendo mecánica de fluidos

Esto es lo más llamativo del ejercicio. HCG procesa rutas GPS con map matching OSRM, filtrado de Kalman y detección de paradas por DBSCAN.

**Eso es, punto por punto, análisis de flujos:**

- Las trazas GPS son **descripción lagrangiana** de un flujo: seguís partículas individuales. El campo de velocidad de la ciudad es la **descripción euleriana** del mismo fenómeno. Convertir entre las dos es un ejercicio estándar en fluidos, y te daría **el campo de flujo turístico de la ciudad** a partir de las trazas que ya recolectás.
- El filtro de Kalman es estimación de estado sobre un sistema dinámico con ruido. Es el mismo problema que asimilación de datos en meteorología, a escala chica.
- **Y el Vol I ya señaló el precedente exacto:** la teoría de flujo de tráfico (modelo LWR) es una ley de conservación idéntica a la del Bloque A, con 70 años de literatura. HCG es el producto donde eso se aplica **sin ninguna metáfora**: es el mismo dominio.

**Producto derivado — RND-03:** de las trazas agregadas y anonimizadas, construir el campo de densidad y velocidad de flujo turístico. Eso da: detección de congestión antes de que ocurra, recomendación de horario por gradiente de densidad, y rutas alternativas que optimizan contra el campo y no contra el mapa estático.

> **Es una feature vendible a un operador turístico, derivada directamente de esta investigación, sobre datos que HCG ya captura.** De todo lo que hay en estos cuatro documentos, esto es lo más cercano a facturar.

Detalle menor pero simpático: la barra de tabs con deformación gravitacional en CSS ya es física-como-estética. Eso pertenece a §4.

### 2.4 Calavera Sur — campos en espacio de embeddings

Un espacio de embeddings de 1.536 dimensiones con ~8.149 productos indexados es un espacio métrico con estructura. Aplican dos cosas del Bloque E:

- **El grafo de similitud tiene curvatura.** Las regiones de curvatura negativa son "puentes" semánticos: productos que conectan categorías que de otro modo estarían separadas. En un e-commerce, ese es **exactamente el producto que hace descubrir una categoría nueva** — el objeto más valioso de un sistema de recomendación y el que ningún ranking por similitud coseno te va a mostrar, porque por definición no se parece mucho a nada.
- **La recomendación es difusión sobre un grafo.** El blend 40/60 entre intención de sesión e historial es una mezcla de dos campos. Formularlo como difusión con dos fuentes da el marco para ajustar el ratio con un criterio en vez de con un número elegido a ojo.

**Y el fallo de batch (153 de 7.886 guardados por inconsistencia de casing en el JSON) es un caso de estudio de manual para el Vol II:** un fallo **correlacionado**, no independiente. Ninguna cantidad de reintentos lo hubiera arreglado, porque todos los reintentos comparten el mismo modo de fallo. Es el argumento del Bloque G en versión propia y documentada. Vale la pena escribirlo como post-mortem público: es más convincente que cualquier ejemplo abstracto.

### 2.5 Sistema de leads — percolación en su forma más pura

Un scraper que recorre LinkedIn y otras páginas construyendo un grafo de contactos, con scoring.

- El scoring es un **campo potencial** sobre el grafo. La prospección eficiente sigue el gradiente.
- La propagación por referidos es **percolación**: hay un umbral de densidad de conexiones por encima del cual el alcance se vuelve global y por debajo del cual queda fragmentado en islas.
- **k-core sobre el grafo de contactos** identifica el núcleo denso: el conjunto de personas cuya conexión te da acceso a todo lo demás. Es una lista de prioridades de prospección calculada, no intuida.

**Experimento — RND-04:** calcular k-core y centralidad sobre el grafo de leads ya scrapeado, y comparar el ranking resultante contra el scoring actual. Barato, y usa datos que ya tenés. El backend todavía no está desplegado, así que **es el momento exacto para meter esto en el diseño en vez de agregarlo después.**

### 2.6 SANJI-RX y OSCAR-CARE — donde el Bloque G no es opcional

Ambos son sistemas de monitoreo donde un falso negativo importa de verdad. El teorema del umbral y el análisis de errores correlacionados dejan de ser una curiosidad intelectual:

- **`Λ_infra` aplicado a las alertas:** ¿agregar una fuente de señal más reduce los falsos negativos, o solo agrega ruido correlacionado con las que ya tenés? Es la pregunta central de diseño de un sistema de monitoreo y casi nunca se hace explícita.
- **Errores correlacionados:** tres sensores que fallan juntos cuando se cae el wifi no son tres sensores. Son uno.
- **La latencia del decodificador:** el tiempo entre que la señal aparece y que alguien actúa es la restricción real del sistema. Toda la sofisticación de detección aguas arriba es irrelevante si ese lazo es lento. En un sistema de coordinación, esa es la métrica que hay que optimizar primero.

Las restricciones de seguridad que ya definiste para OSCAR-CARE —que el LLM no sugiera ajustes de medicación ni interprete imágenes por su cuenta— son, en el vocabulario del Bloque I, **criterios de muerte escritos antes del experimento**. Están bien puestas y no deberían relajarse por conveniencia después.

---

## 3. La arquitectura interna del lab: aplicártelo a vos

La aplicación más incómoda y probablemente la más útil.

`.random()` es, operativamente, **un servidor con una cola**. Vos. Con agentes que amplían el throughput pero no cambian la topología: sigue habiendo un único punto por el que pasa toda decisión no delegable.

Aplicando el Bloque F sin piedad:

**Ley de Little:** `proyectos_en_curso = tasa_de_entrada × duración_media`. Si tenés cuatro clientes activos y cada compromiso dura tres meses, tu tasa sostenible de aceptación de proyectos nuevos está determinada, no es negociable, y probablemente sea menor de la que estás usando.

**Kingman, que es la parte que duele:** un consultor con alta utilización está en `ρ → 0,95`. La fórmula dice que el tiempo de espera se multiplica por ~19. **Traducción: no es que estés lento; es que estás operando en el régimen donde cualquier variabilidad se amplifica veinte veces.** Y el segundo término de Kingman dice algo aún más útil: la varianza importa tanto como la carga. Un cliente con requerimientos erráticos consume desproporcionadamente más que uno con carga alta pero predecible. **Eso es un criterio de selección de clientes derivado de una fórmula, no de una sensación.**

**Courant aplicado a vos:** si cambiás de contexto entre proyectos más rápido de lo que tarda una tarea en completarse, estás violando CFL sobre tu propia atención. El resultado es thrashing: la misma oscilación del autoscaler, en un cerebro. **Y esto conecta directo con ADA:** tenés el instrumento para medirlo.

**Superlinealidad (Bloque H):** el coste de coordinación crece superlinealmente con el número de frentes abiertos. Con seis proyectos activos —los que hay en esta memoria— el término de coordinación probablemente ya domina sobre el de ejecución.

> **RND-05, el experimento más barato y más incómodo de los cuatro documentos:** una semana de registro honesto de dónde va el tiempo, y calcular `L`, `λ`, `W`, `ρ` y una estimación de `c_a²` sobre vos mismo. La predicción es `ρ > 0,9`. Si sale, el Vol I ya te dijo qué pasa a partir de ahí.

---

## 4. La rama arte: Retratarte y la estética derivada

Acá es donde esto se vuelve identidad y no solo ingeniería, y es la parte que probablemente tenga más recorrido.

**Retratarte ya tiene la infraestructura exacta que un solver de fluidos necesita.** El sistema de partículas GPU con ping-pong buffers de 16.384 partículas es, sin ninguna modificación conceptual, **la arquitectura estándar para implementar Stable Fluids en la GPU**: dos texturas que se alternan, el estado del campo en los texels, un shader por paso. El ciclo `add_force → advect → diffuse → project` del Bloque C se implementa como cuatro pasadas de fragment shader sobre esos mismos buffers.

**No hay que construir nada nuevo. Hay que escribir cuatro shaders sobre lo que ya existe.** Y eso resuelve simultáneamente la PRÁCTICA C1 del glosario: entender la proyección de Hodge escribiéndola.

### Ocho patrones derivados de la investigación

Todos construibles con MediaPipe + GLSL + Three.js + FFT de audio, que es exactamente el stack que ya tenés:

**1. Retrato como campo de velocidad.**
Los 468 landmarks faciales definen un campo. El movimiento de la cara genera velocidad; la velocidad advecta tinta o partículas. **La cara no se dibuja: la cara mueve el fluido y lo que ves es la estela.** Es el patrón más directo y probablemente el más impactante.

**2. Vorticidad facial.**
Calcular `∇×u` sobre el campo de landmarks y colorear por vorticidad. Las regiones de alta rotación —comisuras, ceño, párpados— se encienden. **Una sonrisa tiene una firma de vorticidad específica y reconocible.** Ese es un patrón de retrato que no existe en ningún filtro.

**3. Descomposición de Hodge del gesto.**
Separar el movimiento facial en sus tres componentes: gradiente (expresión que se propaga), curl (micro-tics, tensión) y armónica (la deformación global que la topología de la cara permite). **Tres retratos simultáneos del mismo instante, cada uno mostrando una capa distinta del gesto.** Conceptualmente es lo más fuerte de la lista: es un retrato que descompone la expresión en partes matemáticamente ortogonales.

**4. Curvatura como mapa.**
La malla facial es un grafo. Colorear por curvatura de Ricci discreta produce un mapa de calor donde las regiones de curvatura negativa —los "puentes" de la cara— se destacan. Es una lectura geométrica del rostro, no fotográfica.

**5. Blowup autosemejante.**
Un patrón que colapsa como `(T−t)^(−α)`, con la misma forma a todas las escalas, acelerando hacia un instante crítico. Disparado por un pico de audio, produce una implosión visual con estructura fractal. **Es la estética directa del Vol I: la singularidad en tiempo finito, hecha imagen.**

**6. Transición laminar-turbulenta por audio.**
El volumen de la FFT controla el `Re` de la simulación. Voz baja = flujo laminar, capas ordenadas. Voz alta = turbulencia. **La transición no es un fundido: es abrupta, porque las transiciones de fase lo son.** Ese salto cualitativo es visualmente mucho más interesante que cualquier interpolación suave, y es honesto respecto de la física.

**7. Percolación como disolución.**
El retrato se fragmenta al remover aristas de la malla. **No se desvanece gradualmente: se mantiene entero hasta `p_c` y ahí colapsa de golpe.** Es una disolución con umbral, y es una experiencia visual que nadie asocia con "desaparecer".

**8. Ruido azul / hiperuniformidad.**
Distribución de las 16.384 partículas con una secuencia hiperuniforme en vez de aleatoria. Sin grumos ni huecos, sin ser una grilla. **Se nota inmediatamente: es la diferencia entre un cielo estrellado real y uno con `Math.random()`.** Es el cambio más barato de la lista y el que más mejora la calidad percibida.

### Por qué esta rama importa más de lo que parece

Un lab que publica investigación técnica **y** genera piezas visuales derivadas de esa misma investigación tiene algo que casi nadie tiene: **la estética no es decoración del contenido, es una consecuencia del contenido.** Los shaders no ilustran los papers; salen de ellos.

Eso resuelve el problema de comunicación de todo el proyecto. Un post sobre descomposición de Hodge en grafos de servicios no lo lee nadie. Un retrato que se descompone en tres capas ortogonales frente a la cámara, con el post al lado, sí. **Y el portfolio 3D con shaders holográficos, el carrusel de experimentos, la lattice sintérgica — ya es exactamente el vehículo para eso.** No hay que construir el canal; ya está.

---

## 5. La filosofía, dicha en una línea

Poniendo junto todo lo anterior:

> **`.random()` estudia sistemas deterministas que producen comportamiento impredecible, y construye instrumentos para medirlos: en el cerebro (ADA), en la ciudad (HCG), en el software (la línea de fluidos), en el significado (Calavera Sur), en las redes de personas (leads) y en el rostro (Retratarte).**
>
> **La tesis técnica que los une: estos sistemas no se degradan, transicionan. Existen umbrales, cruzarlos es cualitativo, y casi ninguno se está midiendo.**

Eso es un posicionamiento, no un eslogan: dice qué problemas tomás y cuáles no.

Y define un método propio, que es lo que en consultoría técnica realmente te diferencia. La mayoría vende experiencia. Esto vende **un aparato de medición**: dado un sistema, `.random()` produce sus números adimensionales, sus umbrales y sus modos de fallo. **Eso es un producto reproducible**, y es lo que puede convertir tres documentos de investigación en una oferta.

---

## 6. Roadmap de integración

Ordenado por proximidad a producir algo real:

| # | Qué | Dónde | Esfuerzo | Por qué primero |
|---|---|---|---|---|
| **RND-01** | Exponente aperiódico 1/f | ADA | 1 fin de semana | Datos ya guardados, métrica potencialmente más sensible que las bandas |
| **RND-05** | Little + Kingman sobre vos | El lab | 1 semana de registro | El más barato y el que más cambia decisiones |
| **RND-02** | Courant + coste por tarea | Red Hermes | 3 días | Baseline para EXP-04, sistema propio, se puede romper |
| **RND-06** | Retratarte fluid shaders | Retratarte | 1–2 fines de semana | Resuelve la PRÁCTICA C1 y produce material publicable |
| **RND-04** | k-core del grafo de leads | Leads | 2 días | El backend aún no está desplegado: momento exacto |
| **RND-03** | Campo de flujo turístico | HCG | 2–3 semanas | **Lo más cercano a facturar** de los cuatro documentos |
| **RND-07** | Curvatura del grafo de embeddings | Calavera Sur | 1 semana | Producto-puente semántico, imposible de encontrar por similitud |
| **RND-08** | `Λ` y correlación de alertas | SANJI-RX | 1 semana | Diseño de monitoreo con criterio |

**Secuencia recomendada:** RND-01 y RND-05 primero, porque son sobre datos que ya tenés y no dependen de nadie. RND-06 después, porque produce lo publicable. RND-03 cuando quieras que esto empiece a pagar.

---

## 7. El antídoto

Prometí esto en la introducción y es la sección que hay que releer cada vez que este documento se sienta demasiado bien.

**Lo que acabo de hacer es exactamente el ejercicio que todo fundador hace y que casi siempre es falso:** tomar una cartera de proyectos heterogéneos, encontrar un marco lo bastante general y declarar que siempre hubo un plan. Con un marco suficientemente abstracto —campos, sistemas dinámicos, complejidad— se puede unificar cualquier cosa con cualquier cosa. Que las conexiones de arriba se sientan reveladoras **no es evidencia de que sean reales.**

Cuatro tests para separar lo que aguanta de lo que es narrativa:

**Test 1 — ¿produce un número que no tenías?** RND-01 (exponente aperiódico) y RND-03 (campo de flujo) sí. La frase "`.random()` estudia sistemas deterministas impredecibles" no produce ningún número: es posicionamiento, y está bien que lo sea, siempre que no se confunda con un hallazgo.

**Test 2 — ¿cambia una decisión?** RND-05 cambia a cuántos clientes le decís que sí. RND-02 cambia la política de ruteo. La conexión con Grinberg no cambia ninguna decisión operativa; es interesante y es otra categoría.

**Test 3 — ¿sobreviviría si sacás el nombre prestigioso?** Sacá "Navier-Stokes", "Hodge" y "criticidad" de los párrafos de arriba y releé el argumento. Donde sigue en pie, era ingeniería. Donde se desinfla, era autoridad prestada.

**Test 4 — ¿qué NO explica el marco?** Si un marco explica los seis proyectos igual de bien, dejó de discriminar. **Nombrémoslo:** no explica nada de lo fiscal, ni de Stripe Connect, ni de la gestión de clientes, ni de por qué un diseño se ve bien, ni de la mayor parte del trabajo diario, que es leer código de otros y arreglarlo. **La línea de campos cubre quizá el 25% de lo que hace `.random()`, y ese 25% es el interesante, no el total.**

Un lab honesto es el que puede decir dónde termina su marco. Ese límite, dicho en voz alta, es más creíble que cualquier teoría unificada.

---

*Documento vivo. La regla del proyecto se mantiene: una correspondencia sube de categoría cuando un experimento la sostiene, y baja cuando no. Nada de esto está validado todavía.*