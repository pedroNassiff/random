# Marcos transferibles — Volumen II
### Documento de trabajo — `.random()` lab
**Versión:** 0.1 (draft)
**Fecha:** 2026-09-09
**Complementa:** `random-lab_fluidos-arquitectura.md`
**Estado:** menú de candidatos, ninguno validado

---

## 0. Criterio de selección

El volumen I salió de una pregunta: *¿qué le podemos robar a la mecánica de fluidos?* Este volumen amplía la búsqueda a otros campos con resultados recientes, pero con un filtro más duro, porque la tentación de coleccionar analogías bonitas es enorme.

Un marco entra a este documento solo si cumple **tres** condiciones:

1. **Tiene un número.** El campo de origen produce una magnitud calculable, no solo una imagen.
2. **Ese número se puede calcular sobre datos que ya tenemos o podemos instrumentar** (grafo de dependencias, trazas, historial de incidentes, repos).
3. **Predice algo que la práctica actual no predice.** Si el resultado es "los servicios muy acoplados dan problemas", no aporta: eso ya lo sabíamos sin geometría diferencial.

Los nueve que siguen pasan el filtro. Están ordenados por **ratio valor/esfuerzo**, no por elegancia.

---

## 1. Teorema del umbral y corrección de errores cuántica
### El resultado

Google Quantum AI (Willow, publicado en Nature) demostró dos memorias de código de superficie operando **por debajo del umbral**: un código de distancia 7 y uno de distancia 5 con decodificador en tiempo real. La tasa de error lógico se suprime por un factor Λ = 2,14 ± 0,02 cada vez que se aumenta la distancia del código en 2, llegando a un código de distancia 7 con 101 qubits y 0,143% de error por ciclo. La memoria lógica supera el break-even: dura 2,4 veces más que su mejor qubit físico.

Lo esencial del teorema del umbral: **la supresión exponencial del error solo ocurre si la tasa de error físico está por debajo de un umbral crítico.** Por encima de ese umbral, agregar redundancia **empeora** el sistema, porque cada componente nuevo introduce más errores de los que corrige.

Y tres detalles del paper que valen oro para nosotros:

- El decodificador clásico tiene una latencia promedio de 63 µs en distancia 5, sobre un tiempo de ciclo de 1,1 µs. **El decodificador tiene que seguirle el ritmo al flujo de síndromes o el backlog crece sin techo.**
- Corriendo códigos de repetición hasta distancia 29, el límite de performance no son los errores independientes: son **eventos de error correlacionados raros**, que aparecen aproximadamente una vez por hora, cada 3×10⁹ ciclos.
- El overhead escala como d² qubits físicos por qubit lógico.

### El mapeo

| QEC | Infraestructura |
|---|---|
| Tasa de error físico | Tasa de fallo por instancia/pod/llamada |
| Distancia del código `d` | Nivel de redundancia (réplicas, reintentos, AZs) |
| Factor de supresión Λ | **Cuánto baja tu tasa de incidentes por cada unidad de redundancia agregada** |
| Umbral crítico | El punto donde agregar réplicas deja de ayudar y empieza a molestar |
| Latencia del decodificador | Tiempo de tu sistema de detección/remediación (alerta → mitigación) |
| Errores correlacionados raros | Caída de AZ, bug en el binario común, expiración de certificado global |
| Overhead d² | Coste de la redundancia |

### Por qué esto es fuerte

Todo el mundo en infra cree, implícitamente, que **más redundancia siempre es mejor**. El teorema del umbral dice que eso es falso, y da la condición exacta bajo la cual es falso. Y en la práctica es fácil estar por encima del umbral: si tus reintentos generan más carga de la que resuelven, estás amplificando, no corrigiendo. Eso es exactamente un retry storm — y ahora tiene un criterio formal en lugar de folklore.

Los dos detalles secundarios son igual de valiosos:

- **El decodificador es una cola.** Si tu MTTD + MTTR es más lento que la tasa de llegada de fallos, no importa cuánta redundancia tengas: el backlog de errores sin corregir crece y el sistema colapsa igual. Esto conecta directo con la condición CFL del volumen I.
- **El límite real son los errores correlacionados.** En QEC de distancia 29, los errores independientes ya no importan: lo que mata son los eventos raros y correlacionados. **Traducción: tu cálculo de "cinco nueves con tres réplicas" es fantasía si las tres réplicas comparten el mismo modo de fallo.** El paper lo mide; nosotros lo asumimos y nunca lo medimos.

### Métrica propuesta# Marcos transferibles — Volumen II
### Documento de trabajo — `.random()` lab
**Versión:** 0.1 (draft)
**Fecha:** 2026-09-09
**Complementa:** `random-lab_fluidos-arquitectura.md`
**Estado:** menú de candidatos, ninguno validado

---

## 0. Criterio de selección

El volumen I salió de una pregunta: *¿qué le podemos robar a la mecánica de fluidos?* Este volumen amplía la búsqueda a otros campos con resultados recientes, pero con un filtro más duro, porque la tentación de coleccionar analogías bonitas es enorme.

Un marco entra a este documento solo si cumple **tres** condiciones:

1. **Tiene un número.** El campo de origen produce una magnitud calculable, no solo una imagen.
2. **Ese número se puede calcular sobre datos que ya tenemos o podemos instrumentar** (grafo de dependencias, trazas, historial de incidentes, repos).
3. **Predice algo que la práctica actual no predice.** Si el resultado es "los servicios muy acoplados dan problemas", no aporta: eso ya lo sabíamos sin geometría diferencial.

Los nueve que siguen pasan el filtro. Están ordenados por **ratio valor/esfuerzo**, no por elegancia.

---

## 1. Teorema del umbral y corrección de errores cuántica
### El resultado

Google Quantum AI (Willow, publicado en Nature) demostró dos memorias de código de superficie operando **por debajo del umbral**: un código de distancia 7 y uno de distancia 5 con decodificador en tiempo real. La tasa de error lógico se suprime por un factor Λ = 2,14 ± 0,02 cada vez que se aumenta la distancia del código en 2, llegando a un código de distancia 7 con 101 qubits y 0,143% de error por ciclo. La memoria lógica supera el break-even: dura 2,4 veces más que su mejor qubit físico.

Lo esencial del teorema del umbral: **la supresión exponencial del error solo ocurre si la tasa de error físico está por debajo de un umbral crítico.** Por encima de ese umbral, agregar redundancia **empeora** el sistema, porque cada componente nuevo introduce más errores de los que corrige.

Y tres detalles del paper que valen oro para nosotros:

- El decodificador clásico tiene una latencia promedio de 63 µs en distancia 5, sobre un tiempo de ciclo de 1,1 µs. **El decodificador tiene que seguirle el ritmo al flujo de síndromes o el backlog crece sin techo.**
- Corriendo códigos de repetición hasta distancia 29, el límite de performance no son los errores independientes: son **eventos de error correlacionados raros**, que aparecen aproximadamente una vez por hora, cada 3×10⁹ ciclos.
- El overhead escala como d² qubits físicos por qubit lógico.

### El mapeo

| QEC | Infraestructura |
|---|---|
| Tasa de error físico | Tasa de fallo por instancia/pod/llamada |
| Distancia del código `d` | Nivel de redundancia (réplicas, reintentos, AZs) |
| Factor de supresión Λ | **Cuánto baja tu tasa de incidentes por cada unidad de redundancia agregada** |
| Umbral crítico | El punto donde agregar réplicas deja de ayudar y empieza a molestar |
| Latencia del decodificador | Tiempo de tu sistema de detección/remediación (alerta → mitigación) |
| Errores correlacionados raros | Caída de AZ, bug en el binario común, expiración de certificado global |
| Overhead d² | Coste de la redundancia |

### Por qué esto es fuerte

Todo el mundo en infra cree, implícitamente, que **más redundancia siempre es mejor**. El teorema del umbral dice que eso es falso, y da la condición exacta bajo la cual es falso. Y en la práctica es fácil estar por encima del umbral: si tus reintentos generan más carga de la que resuelven, estás amplificando, no corrigiendo. Eso es exactamente un retry storm — y ahora tiene un criterio formal en lugar de folklore.

Los dos detalles secundarios son igual de valiosos:

- **El decodificador es una cola.** Si tu MTTD + MTTR es más lento que la tasa de llegada de fallos, no importa cuánta redundancia tengas: el backlog de errores sin corregir crece y el sistema colapsa igual. Esto conecta directo con la condición CFL del volumen I.
- **El límite real son los errores correlacionados.** En QEC de distancia 29, los errores independientes ya no importan: lo que mata son los eventos raros y correlacionados. **Traducción: tu cálculo de "cinco nueves con tres réplicas" es fantasía si las tres réplicas comparten el mismo modo de fallo.** El paper lo mide; nosotros lo asumimos y nunca lo medimos.

### Métrica propuesta

```
Λ_infra = (tasa_de_incidentes con redundancia n)
        / (tasa_de_incidentes con redundancia n+1)

Λ > 1  → estás por debajo del umbral: la redundancia funciona
Λ ≈ 1  → estás en el umbral: la redundancia es coste puro
Λ < 1  → estás por encima: la redundancia te está haciendo daño
```

### Experimento — EXP-08 *(1–2 semanas, riesgo bajo, valor muy alto)*

Sobre el historial de incidentes, estimar Λ para las capas de redundancia existentes. Después separar: **¿qué fracción de los incidentes fue por fallos independientes y qué fracción por correlacionados?** La predicción es que en cualquier sistema medianamente maduro, más del 80% de los incidentes reales son correlacionados, lo que hace que casi toda la inversión en réplicas adicionales tenga Λ ≈ 1. Si sale, es un post que le duele a mucha gente y un argumento de consultoría directo.

### Dónde se rompe

Los qubits fallan de forma estadísticamente homogénea; los servicios no. Y el umbral del código de superficie es un número teórico específico de esa geometría, no algo universal. **No hay un "0,1%" mágico para infra.** Lo que se transfiere es la *forma* de la ley (existe un umbral, cruzar es cualitativo) y la metodología de medición de Λ, no el número.

---

## 2. Curvatura de Ricci discreta y over-squashing
### El resultado

Topping, Di Giovanni et al. (ICLR 2022) mostraron que los cuellos de botella en grafos —donde el paso de mensajes falla en propagar información, el llamado *over-squashing*— se caracterizan geométricamente: **las aristas con curvatura de Ricci muy negativa son los cuellos de botella.** Nguyen et al. (2023) extendieron el resultado y demostraron que over-smoothing y over-squashing son los dos extremos de un mismo espectro: **el over-smoothing está ligado a curvatura positiva y el over-squashing a curvatura negativa.** Propusieron un algoritmo de *rewiring* (Batch Ollivier-Ricci Flow) que ataca ambos simultáneamente. La línea sigue muy viva: en ICLR 2025 apareció PIORF, que combina la curvatura con correlaciones físicas para reconectar mallas en simuladores de fluidos.

### El mapeo

El grafo de dependencias de servicios es un grafo. La curvatura de Ricci se calcula sobre cualquier grafo, hoy, con librerías que ya existen (`GraphRicciCurvature`).

- **Aristas de curvatura fuertemente negativa** = puentes entre comunidades de servicios. Todo el tráfico entre dos subsistemas pasa por ahí. Es el cuello de botella arquitectónico, y **la curvatura lo detecta sin saber nada del tráfico, solo de la topología.**
- **Regiones de curvatura positiva** = zonas híper-conectadas donde todo llama a todo. El análogo de over-smoothing: los servicios se vuelven indistinguibles, nadie sabe qué hace qué, no hay propiedad ni límites claros. Es el "monolito distribuido".
- **Rewiring** = refactor guiado por geometría. El algoritmo te dice *qué arista agregar o sacar* para aliviar el cuello de botella.

### Por qué esto es fuerte, y cómo encaja con el volumen I

Es la pieza que faltaba. Ahora tenemos la descripción geométrica completa del sistema:

| Herramienta | Qué mide |
|---|---|
| Descomposición de Hodge (Vol I §4.2) | **El flujo**: cuánto del tráfico es progreso, churn o deuda topológica |
| Curvatura de Ricci | **La geometría**: dónde el grafo estrangula la información |
| Percolación (§4 de este doc) | **La conectividad**: cuánto aguanta antes de fragmentarse |

Las tres se calculan sobre el mismo objeto (el grafo de servicios con pesos de tráfico) y son independientes entre sí. Eso es un producto, no una analogía.

### Experimento — EXP-09 *(1 semana, riesgo bajo, valor alto)*

Calcular curvatura de Ollivier-Ricci sobre el grafo de dependencias de un sistema real. Contrastar las aristas más negativas contra: (a) dónde ocurrieron los incidentes históricos, (b) dónde los ingenieros *dicen* que están los problemas.

**Éxito:** la curvatura identifica cuellos de botella que la intuición del equipo no marcaba. **Es barato y da una visualización espectacular** — mapa de calor del grafo por curvatura. Combinado con EXP-02 (Hodge), es una herramienta vendible.

### Dónde se rompe

La curvatura es puramente topológica: no sabe que una arista lleva 10.000 req/s y otra 3. Hay que ponderar por tráfico, y ahí la teoría es menos limpia. Además, un cuello de botella arquitectónico puede ser **deliberado y correcto** (un API gateway *tiene* que ser un cuello de botella). La métrica marca la geometría; el juicio sobre si está bien o mal sigue siendo humano.

---

## 3. AlphaEvolve: descubrimiento evolutivo de algoritmos
### El resultado

No es una analogía: es una **metodología** que podemos copiar directamente.

AlphaEvolve es un agente de codificación evolutivo que orquesta un pipeline autónomo de LLMs que modifican código, con retroalimentación continua de uno o más evaluadores. Resultados relevantes:

- Descubrió una heurística de scheduling para **Borg**, el orquestador de los data centers de Google, que lleva más de un año en producción y recupera de forma continua un **0,7% del cómputo mundial de la compañía**.
- Aceleró un kernel de multiplicación de matrices en la arquitectura de Gemini un **23%**, lo que se tradujo en 1% menos de tiempo de entrenamiento.
- Logró hasta **32,5% de speedup en la implementación del kernel de FlashAttention** — un dominio que normalmente los ingenieros humanos ni tocan porque ya está optimizado por el compilador.
- Encontró cómo multiplicar matrices complejas de 4×4 con 48 multiplicaciones escalares en vez de las 49 de Strassen, un problema que resistió 56 años.

Y el detalle de diseño que más nos importa: DeepMind subraya que la solución de Borg no solo rinde bien, sino que **es código legible por humanos**, con las ventajas operativas de interpretabilidad, depurabilidad, predictibilidad y facilidad de despliegue. Fue esa legibilidad lo que la hizo desplegable.

### La lección para el lab

El volumen I propone **diseñar** un scheduler con proyección de Hodge (EXP-04). AlphaEvolve sugiere una alternativa más potente: **no lo diseñes, evolucionálo.**

El patrón es simple y reproducible a nuestra escala:

```
1. Un simulador rápido y determinista del pipeline  → el evaluador
2. Una función heurística en código, pequeña        → el genoma
3. Un LLM que propone mutaciones al código          → el operador de variación
4. Un pool de candidatos con selección              → la evolución
5. Restricción dura: el resultado debe ser legible  → la condición de despliegue
```

**Esto convierte EXP-04 de "un scheduler" en "una fábrica de schedulers".** Y el evaluador que necesita —el simulador de pipeline como malla— es exactamente lo que ya hay que construir para el volumen I. Se comparte la infraestructura.

### Por qué es la apuesta más segura del documento

Los otros ocho marcos son hipótesis. Este es un método con evidencia de producción a escala Google. El riesgo no es que no funcione: es que nuestro evaluador sea malo. **La calidad del resultado está enteramente determinada por la calidad del simulador**, y eso está bajo nuestro control.

### Experimento — EXP-10 *(3–4 semanas, riesgo medio, valor muy alto)*

Mini-loop evolutivo sobre la heurística de asignación de runners del pipeline. Evaluador = el simulador de EXP-04. Baseline a batir = Kingman + backpressure. Restricción: la heurística ganadora tiene que caber en 30 líneas legibles.

**Bonus:** el mismo loop sirve para cualquier heurística del lab (ordenamiento de quality gates, política de reintentos, sizing de canary). Se construye una vez y se reusa.

---

## 4. Percolación y umbrales de fragmentación

### El resultado

Teoría de percolación: en una red, si se van removiendo nodos o aristas al azar, existe una **fracción crítica `p_c`** en la que el componente gigante se fragmenta. La transición es **aguda**: por debajo el sistema está esencialmente entero, por encima está esencialmente muerto, y el pasaje es abrupto, no gradual.

Resultado clásico y relevante: las redes con distribución de grado libre de escala son **robustas frente a fallos aleatorios pero frágiles frente a ataques dirigidos** a los nodos de alto grado. Y la *k-core decomposition* identifica el núcleo cuya remoción colapsa la estructura entera.

### El mapeo y la predicción

Tu grafo de servicios tiene un `p_c` y nadie lo calculó nunca.

- **Fallo aleatorio** = un pod que se muere, un nodo que se reinicia.
- **Ataque dirigido** = se cae el servicio de auth, el service discovery, la config central.
- **k-core** = el conjunto de servicios sin los cuales no queda nada en pie. **Este es el objeto que todos los "diagramas de arquitectura crítica" intentan dibujar a ojo y siempre les sale mal.**

Se calcula en minutos si tenés el grafo. Da un número duro para las conversaciones sobre presupuesto de resiliencia: *"nuestro `p_c` es 0,23 y hoy operamos con un margen de 0,08"*.

### El giro contraintuitivo: percolación explosiva

Cuando se aplican reglas que **retrasan** deliberadamente la formación del componente gigante, la transición resultante se vuelve mucho más abrupta cuando finalmente ocurre. Traducción de la hipótesis: **los circuit breakers, bulkheads y aislamientos, que retrasan la propagación de fallos, pueden estar haciendo que los fallos que sí se propagan sean cualitativamente más catastróficos y más difíciles de anticipar.** El sistema pasa de tener muchos incidentes chicos a tener pocos incidentes totales.

Esto es falsable con datos históricos: si la distribución de tamaño de incidentes tiene cola más pesada después de introducir aislamiento que antes, la hipótesis se sostiene. **Y sería un resultado incómodo y valioso.**

### Experimento — EXP-11 *(3–5 días, riesgo bajo)*

Percolación simulada sobre el grafo real: remover nodos al azar y por grado descendente, medir el tamaño del componente gigante. Calcular k-core. Comparar el ranking de criticidad resultante contra el que el equipo tiene escrito en el runbook.

---

## 5. Leyes de escala urbana y singularidad en tiempo finito
### El resultado

West, Bettencourt y colaboradores establecieron que las ciudades escalan con leyes de potencia respecto a su población `N`, con dos exponentes distintos y consistentes entre países:

- **Infraestructura: sublineal, β ≈ 0,85.** Duplicar la población requiere menos del doble de cañerías, calles y cables. Economía de escala.
- **Producto socioeconómico: superlineal, β ≈ 1,15.** Duplicar la población da *más* del doble de patentes, salarios, crímenes y velocidad de vida.

Y la consecuencia teórica que cierra el círculo con el volumen I: **el crecimiento superlineal sobre recursos finitos conduce a una singularidad en tiempo finito.** El modelo de West predice colapso salvo que haya innovaciones sucesivas que reseteen los parámetros — **y cada reseteo tiene que llegar más rápido que el anterior.**

### El mapeo

Sustituí "población" por "cantidad de servicios", "líneas de código" o "tamaño del equipo".

**Hipótesis a medir:**

| Magnitud | Exponente esperado | Interpretación |
|---|---|---|
| Coste de infra vs nº de servicios | **Sublineal**, β < 1 | Economía de escala real |
| Incidentes/mes vs nº de servicios | **Superlineal**, β > 1 | Coste de coordinación |
| Tiempo de build vs LOC | ¿? | A medir |
| Features entregadas vs tamaño del equipo | ¿Sublineal? | Ley de Brooks cuantificada |
| Superficie de coordinación vs nº de equipos | Superlineal ~N² | Ya lo predice Conway |

### Por qué esto es lo más lindo del documento

**El modelo de West dice que un sistema con crecimiento superlineal en recursos finitos tiene una singularidad en tiempo finito.** Es literalmente el mismo fenómeno matemático de los papers de Euler y Navier-Stokes del volumen I, en otro dominio y con otro mecanismo. Y la salida propuesta —innovaciones que resetean el reloj, a ritmo acelerado— es una descripción sorprendentemente exacta de la vida de un codebase: cada refactor grande, cada migración de framework, cada "vamos a reescribirlo", compra tiempo, y hay que hacerlos cada vez más seguido.

Si medimos β para incidentes vs servicios en varios sistemas y sale consistentemente > 1, **tenemos una estimación cuantitativa de cuándo un codebase necesita su próximo reseteo.** Eso es una herramienta de decisión arquitectónica que hoy no existe.

### Experimento — EXP-12 *(1–2 semanas, riesgo medio, valor alto)*

Ajustar leyes de potencia sobre datos de repos y de incidentes de todos los sistemas a los que tengamos acceso (propios y de clientes, anonimizados). Buscar β. Con pocos sistemas el ajuste es débil, así que **el diseño experimental importa más que el análisis**: hay que juntar suficientes puntos.

### Dónde se rompe

Las leyes urbanas se ajustan con miles de ciudades. Nosotros vamos a tener quizá 15 sistemas. **Un ajuste de ley de potencia con 15 puntos es casi indistinguible de una log-normal, una exponencial truncada o el ruido.** Si hacemos esto hay que aplicar los tests estadísticos de Clauset–Shalizi–Newman, no ajustar una recta en log-log y declarar victoria. Este es el experimento con mayor riesgo de autoengaño de todo el documento.

---

## 6. Transiciones de fase no recíprocas

### El resultado

Física de materia activa (Fruchart, Vitelli et al.): cuando las interacciones entre componentes son **no recíprocas** —A afecta a B distinto de como B afecta a A— aparecen fases que son imposibles en sistemas recíprocos. En particular, **fases dependientes del tiempo**: estados que viajan, oscilan o rotan en vez de asentarse en equilibrio. La transición ocurre en *puntos excepcionales*, donde modos del sistema se fusionan.

### El mapeo

**Las dependencias de software son no recíprocas por construcción.** El servicio A llama a B; B no llama a A. La matriz de acoplamiento es asimétrica. Toda la intuición que traemos de sistemas físicos "normales" (que relajan a un equilibrio) **no aplica**.

Predicción: los modos de fallo **oscilatorios** —la carga que hace ping-pong entre réplicas, el autoscaler que sube y baja, la cascada que da la vuelta al grafo y vuelve— no son bugs de implementación. Son la fase dependiente del tiempo que la no reciprocidad produce genéricamente. Y si es así, **hay un umbral calculable de asimetría por encima del cual la oscilación es inevitable**, sin importar cuán bien esté implementado cada componente.

### Experimento — EXP-13 *(especulativo, no antes de la fase 3)*

Construir la matriz de acoplamiento asimétrica desde las trazas. Analizar su espectro. Buscar pares de autovalores complejos conjugados con parte real positiva: eso es la firma de una inestabilidad oscilatoria. Contrastar con incidentes de tipo flapping históricos.

**Es el más especulativo del documento y el que, si funciona, sería más original.** No conozco a nadie aplicando esto a sistemas distribuidos.

---

## 7. Hiperuniformidad y distribución de carga

### El resultado

Un sistema de puntos es **hiperuniforme** si sus fluctuaciones de densidad a gran escala están suprimidas respecto a las de un proceso aleatorio: el factor de estructura `S(k) → 0` cuando `k → 0`. Es un orden oculto, intermedio entre cristal y líquido. Aparece en el ojo del pollo, en cuasicristales y en el ruido azul de la computación gráfica.

Propiedad clave: **una distribución hiperuniforme cubre el espacio mucho más uniformemente que una aleatoria, sin ser periódica** (y por lo tanto sin los modos de fallo resonantes de lo periódico).

### El mapeo

Asignación de claves a shards, de pods a nodos, de trabajos a workers, de sondas a targets. **El hashing consistente es aleatorio, y lo aleatorio tiene fluctuaciones de densidad de orden √N.** Eso es el hot-shard: no es mala suerte, es la estadística de lo aleatorio. La respuesta estándar (virtual nodes) reduce la varianza pero no cambia el escalado.

Una asignación hiperuniforme suprime las fluctuaciones de largo alcance por construcción. **Predicción: menor cola p99 con la misma capacidad total, sin ningún cambio de hardware.**

### Experimento — EXP-14 *(1 semana, riesgo bajo, valor medio-alto)*

Simular asignación de carga con: (a) hashing consistente, (b) hashing consistente con virtual nodes, (c) secuencia hiperuniforme / ruido azul. Medir varianza de carga y p99 bajo distribuciones de clave realistas (incluyendo sesgadas).

**Es cerrado, barato, y si sale es directamente implementable como librería.** Buen candidato a open source del lab.

---

## 8. Paisajes rugosos, metaestabilidad y recocido

### El resultado

La física de vidrios de espín describe sistemas cuyo espacio de configuraciones es un **paisaje rugoso**: exponencialmente muchos mínimos locales separados por barreras. El sistema queda atrapado en estados metaestables que no son el óptimo, y salir requiere agitación térmica (recocido) o un salto grande.

### El mapeo

Es el complemento natural del fallo metaestable del volumen I. Ahí describimos el **mecanismo dinámico** del colapso (perturbaciones de alta frecuencia que resuenan). Acá tenemos la **estructura estática** que lo hace posible: el espacio de configuraciones del sistema tiene múltiples cuencas, y el sistema puede quedarse atascado en una mala.

Y explica algo que todos hacemos sin justificación teórica: **"reiniciá todo" funciona porque es un enfriamiento brusco fuera de una cuenca metaestable.** No es magia ni ignorancia; es la técnica correcta para ese tipo de paisaje. Lo mismo la inyección deliberada de ruido (chaos engineering) como forma de recocido: agitar el sistema para que no se asiente en un mínimo local frágil.

### Idea derivada — EXP-15 *(especulativo)*

**Recocido simulado como política de operación, no como algoritmo de optimización.** Introducir deliberadamente una "temperatura" en el scheduler: una fracción pequeña de decisiones aleatorias que decae con el tiempo desde un despliegue. Hipótesis: converge a mejores configuraciones estables que un scheduler puramente greedy, que se atasca en el primer mínimo local.

---

## 9. Límites de decidibilidad: Busy Beaver y la terminación

### El resultado

En julio de 2024, la colaboración abierta **bbchallenge** determinó BB(5) = 47.176.870, con la demostración formalizada y verificada en Coq. Es el último valor que probablemente se conozca nunca: BB(6) ya se sabe que está en territorio de torres de exponenciales, más allá de cualquier notación decimal.

El punto no es el número. El punto es que **el problema de la parada no es una curiosidad de libro de texto: se vuelve prácticamente indecidible con máquinas de cinco estados.** Cinco.

### El mapeo, que es incómodo y útil

Cualquier producto que prometa "predecir cuánto va a tardar tu build" o "detectar automáticamente si tu pipeline va a colgarse" **choca contra un muro teórico duro, no contra una limitación de ingeniería**. No es que todavía no lo resolvimos: es que no se puede en el caso general.

Consecuencias operativas concretas:

- **Los timeouts no son un parche. Son la única estrategia correcta.** Dejar de tratarlos como deuda técnica.
- Cualquier estimador de duración es necesariamente heurístico y estadístico. Diseñarlo con ese marco desde el principio (predicción con intervalos, no con puntos).
- La frontera entre "esto lo puede decidir el sistema" y "esto lo tiene que decidir un humano o un timeout" es formal y se puede dibujar. **Dibujarla explícitamente en la arquitectura es un ejercicio que casi nadie hace.**

### Bonus metodológico

El modelo de bbchallenge —colaboración abierta, distribuida, con verificación formal como criterio de aceptación en vez de autoridad— es un **template de cómo podría funcionar el lab**. Vale la pena estudiar cómo se organizaron, no solo qué probaron.

---

## 10. Triage: qué perseguir y en qué orden

| # | Marco | Esfuerzo | Riesgo | Valor | Prioridad |
|---|---|---|---|---|---|
| EXP-09 | Curvatura de Ricci | 1 sem | Bajo | Alto | **1** |
| EXP-08 | Umbral Λ / correlación de fallos | 1–2 sem | Bajo | Muy alto | **2** |
| EXP-11 | Percolación y k-core | 3–5 días | Bajo | Medio-alto | **3** |
| EXP-14 | Hiperuniformidad en sharding | 1 sem | Bajo | Medio-alto | **4** |
| EXP-10 | Loop evolutivo tipo AlphaEvolve | 3–4 sem | Medio | Muy alto | **5** |
| EXP-12 | Leyes de escala β | 1–2 sem | **Alto** | Alto | 6 |
| EXP-15 | Recocido en el scheduler | 2 sem | Alto | Medio | 7 |
| EXP-13 | No reciprocidad / espectro asimétrico | 3+ sem | Muy alto | Muy alto si sale | 8 |
| — | Busy Beaver | — | — | Marco conceptual, no experimento | — |

**Recomendación:** hacer EXP-09 + EXP-11 primero, porque comparten el mismo insumo (el grafo de dependencias) y juntos con EXP-02 del volumen I dan **un producto coherente: un analizador geométrico de arquitecturas**. Tres métricas independientes sobre un mismo grafo, ninguna de las cuales ofrece ninguna herramienta del mercado. Eso solo ya es un entregable del lab.

Después EXP-08, que es el que tiene la tesis más provocadora y más fácil de defender públicamente.

---

## 11. El hilo que conecta todo

Vale la pena notarlo antes de dispersarse, porque no es casualidad:

**Volumen I** describe el colapso de un sistema como una **singularidad en tiempo finito** producida por acumulación resonante de perturbaciones internas mientras el input externo se ve sano.

**Este volumen** encuentra la misma estructura tres veces más, por caminos independientes:

- El **teorema del umbral** (§1): existe una tasa crítica; cruzarla invierte el signo del efecto de la redundancia.
- Las **leyes de escala urbana** (§5): crecimiento superlineal sobre recursos finitos ⇒ singularidad en tiempo finito, evitable solo con innovaciones a ritmo acelerado.
- La **percolación** (§4): existe una fracción crítica; la transición es aguda, no gradual.

Los tres son **transiciones de fase**. Y la tesis unificadora del proyecto se puede escribir en una línea:

> **Los sistemas de software se rompen como transiciones de fase, no como acumulaciones de bugs. Existen umbrales; cruzarlos es cualitativo y a menudo abrupto; y casi ninguno de esos umbrales se está midiendo hoy.**

Eso es una tesis. Es falsable. Y es la que hay que defender o enterrar.

---

## 12. Referencias

**Umbral y QEC**
- Google Quantum AI, *Quantum error correction below the surface code threshold*, Nature: https://www.nature.com/articles/s41586-024-08449-y — preprint: https://arxiv.org/abs/2408.13687
- Knill, Laflamme & Zurek; Aharonov & Ben-Or — teorema del umbral (formulaciones originales)

**Geometría de grafos**
- Topping, Di Giovanni et al., *Understanding over-squashing and bottlenecks on graphs via curvature*, ICLR 2022
- Nguyen et al., *Revisiting Over-smoothing and Over-squashing Using Ollivier-Ricci Curvature*: https://arxiv.org/abs/2211.15779
- PIORF, ICLR 2025: https://arxiv.org/abs/2504.04052
- Librería: `GraphRicciCurvature` (Python)

**Descubrimiento algorítmico**
- AlphaEvolve white paper: https://arxiv.org/abs/2506.13131
- DeepMind blog: https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/

**Redes y percolación**
- Albert, Jeong & Barabási, *Error and attack tolerance of complex networks*, Nature 2000
- Achlioptas, D'Souza & Spencer, *Explosive percolation in random networks*, Science 2009

**Escala**
- Bettencourt, Lobo, Helbing, Kühnert & West, *Growth, innovation, scaling, and the pace of life in cities*, PNAS 2007
- West, *Scale* (2017) — divulgación, buena para el marco general
- Clauset, Shalizi & Newman, *Power-law distributions in empirical data*, SIAM Review 2009 — **obligatorio antes de ajustar cualquier β**

**Materia activa**
- Fruchart, Hanai, Littlewood & Vitelli, *Non-reciprocal phase transitions*, Nature 2021

**Hiperuniformidad**
- Torquato, *Hyperuniform states of matter*, Physics Reports 2018

**Decidibilidad**
- The Busy Beaver Challenge — BB(5) = 47.176.870, verificado en Coq: https://bbchallenge.org

---

*Documento vivo. Complementa al Volumen I. Los marcos acá listados son candidatos, no compromisos: la mayoría debería morir en el triage.*
