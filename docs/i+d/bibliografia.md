# Bibliografía crítica — la línea de campos
### Documento de estudio — `.random()` lab
**Versión:** 0.1
**Fecha:** 2026-09-09
**Serie:** Vol I · Vol II · Glosario · Correlación `.random()` · **este documento**

---

## 0. Cómo usar esto

Cuatro reglas, porque una lista de 40 recursos sin criterio es peor que ninguna lista.

**Regla 1 — no leas de corrido.** Cada entrada dice **qué capítulos** y **cuánto tiempo**. Casi ningún libro de esta lista hay que leerlo entero; varios son de consulta y uno solo hay que leerlo tapa a tapa.

**Regla 2 — un recurso por bloque del glosario, no cinco.** La tentación es acumular. Con un texto bueno por tema alcanza; el segundo texto sobre lo mismo da rendimientos decrecientes casi inmediatos.

**Regla 3 — leer y calcular en la misma sesión.** El glosario define N2 como "podés producir el número". Leer sin ejecutar produce N1 con sensación de N3. Cada entrada tiene una línea `→ Hacé:` que es la mitad importante.

**Regla 4 — sobre los enlaces.** Los marcados **✓** los verifiqué. El resto: buscá por **título exacto + autor**, porque las URLs cambian y no quiero mandarte a un 404.

**Notación:**
`★` fundamento · `★★` central · `★★★` avanzado/opcional
`[EN]` original en inglés — el resumen de abajo está en castellano
`⏱` tiempo estimado real, no optimista

---

## 1. El núcleo irrenunciable

Si solo hacés seis cosas de todo este documento, son estas. En este orden. Total: unas 25 horas, repartibles en un mes.

| # | Qué | Formato | ⏱ | Por qué es irrenunciable |
|---|---|---|---|---|
| 1 | **Divergence and curl** — 3Blue1Brown | Video | 20 min | Sin esto, medio glosario es vocabulario vacío |
| 2 | **Harchol-Balter, cap. 1–7 + 30–32** | Libro | 12 h | Es el baseline que todo el proyecto debe batir |
| 3 | **Tao — Why global regularity for NS is hard** | Artículo | 2 h | La mejor explicación de por qué el problema es difícil |
| 4 | **Stam — Stable Fluids** | Paper | 3 h | 8 páginas que se implementan; es la PRÁCTICA C1 |
| 5 | **Reinertsen — cap. 3 (colas) y 6 (WIP)** | Libro | 4 h | Traduce todo esto a lenguaje de producto |
| 6 | **Clauset, Shalizi & Newman** | Paper | 3 h | Te evita el error estadístico que arruinaría el proyecto |

**El #6 no es negociable.** Es el único que protege contra el modo de fallo más probable: publicar un exponente de ley de potencia que no existe.

---

## 2. Libros

### 2.1 Colas y flujo — el baseline

**Mor Harchol-Balter — *Performance Modeling and Design of Computer Systems: Queueing Theory in Action*** (2013) ★★★ imprescindible · `[EN]` · ⏱ 12 h para lo relevante

**Qué es:** el libro de teoría de colas escrito por una computer scientist para computer scientists, no por un matemático para matemáticos. Cubre desde Little hasta redes de colas, scheduling, y análisis de colas de tareas en sistemas reales, con ejercicios que se resuelven programando.

**Por qué es el más importante de la lista:** el Vol I dice que la matemática *correcta* para pipelines es teoría de colas, no Navier-Stokes, y que cualquier cosa que construyamos tiene que ganarle a Kingman. **Este es el libro donde está Kingman.** No podés declarar que le ganaste a un baseline que no entendés.

**Qué leer:** caps. 1–7 (fundamentos, Little, M/M/1, utilización), y después saltar a la parte de scheduling (caps. 30–32 aprox., políticas SRPT, PS, tamaños de tarea con cola pesada). Lo del medio es consulta.

**La idea única:** la espera no crece con la carga, crece con `1/(1−ρ)`. Y la variabilidad pesa tanto como la carga.

→ **Hacé:** aplicá Little y Kingman a un pipeline real y a vos mismo (RND-05) antes de terminar el capítulo 7.

---

**Donald Reinertsen — *The Principles of Product Development Flow*** (2009) ★★★ · `[EN]` · ⏱ 4 h para los capítulos clave

**Qué es:** teoría de colas aplicada al desarrollo de producto. 175 principios numerados, con el argumento central de que el desarrollo de producto es un sistema de colas mal gestionado porque nadie mide el WIP y todos optimizan la utilización.

**Por qué está acá:** es **el puente entre esta investigación y la ingeniería de producto**. Todo lo que el Vol I dice en lenguaje de fluidos, este libro ya lo dice en lenguaje de negocio, con argumentos económicos. Si alguna vez tenés que vender esto a un cliente no técnico, el vocabulario sale de acá.

**Qué leer:** cap. 3 (colas), cap. 6 (WIP), cap. 7 (batch size). El resto es refuerzo.

**La idea única:** la utilización alta se siente eficiente y es la causa principal de que todo tarde. Es Kingman, dicho para directores.

→ **Hacé:** calculá el WIP real de un proyecto tuyo. Casi seguro es 3–5× mayor de lo que creés.

---

### 2.2 Fluidos — teoría e implementación

**David Acheson — *Elementary Fluid Dynamics*** (1990) ★★ · `[EN]` · ⏱ 8 h selectivas

**Qué es:** el texto introductorio limpio de dinámica de fluidos. Matemáticamente serio pero no torturante, con los casos clásicos bien desarrollados.

**Por qué:** es donde Couette, Poiseuille, Reynolds y vorticidad están hechos **bien**, no en la versión de divulgación. El Bloque B del glosario sale de acá.

**Qué leer:** caps. 1–2 (cinemática, vorticidad) y el capítulo de flujos viscosos donde están Couette y Poiseuille. Saltear ondas y estabilidad en la primera pasada.

**La idea única:** la vorticidad, no la velocidad, es la variable que gobierna si un flujo se comporta o se rompe.

---

**Robert Bridson — *Fluid Simulation for Computer Graphics*** (2ª ed., 2015) ★★★ para la rama arte · `[EN]` · ⏱ 10 h

**Qué es:** cómo se implementa realmente un solver de fluidos, escrito por alguien de gráficos. Advección, proyección de presión, condiciones de borde, todo orientado a que funcione y se vea bien, no a demostrar teoremas.

**Por qué:** es **el libro de Retratarte**. El sistema de partículas GPU con ping-pong buffers ya es la infraestructura; este libro tiene los cuatro shaders que faltan. Y el capítulo de proyección de presión es la mejor explicación operativa de Helmholtz-Hodge que vas a encontrar: la explica implementándola.

**Qué leer:** los capítulos de advección y de proyección de presión. Con eso ya podés escribir el solver.

**La idea única:** el paso de presión no es física opcional; es lo que hace que el fluido se vea como fluido en vez de como humo genérico.

→ **Hacé:** el solver 2D de la PRÁCTICA C1. Este libro es el manual.

---

**Grigory Barenblatt — *Scaling, Self-Similarity, and Intermediate Asymptotics*** (1996) ★★★ avanzado · `[EN]` · ⏱ duro, 15 h+

**Qué es:** el texto canónico sobre análisis dimensional y autosemejanza. Explica cuándo un sistema tiene soluciones autosemejantes y cuándo el ansatz es ilegítimo.

**Por qué:** el Vol I propone ajustar `L(t) ~ (T−t)^(−α)` a series de latencia, y el glosario marca eso como el experimento de mayor riesgo de autoengaño. **Este libro te dice bajo qué condiciones ese ajuste tiene sentido.** También es donde el análisis dimensional se enseña como método creativo para fabricar números adimensionales nuevos, que es la habilidad N3 del Bloque B.

**Advertencia honesta:** es difícil y no es imprescindible en la primera vuelta. Leelo solo si vas en serio con EXP-05.

---

### 2.3 Redes, escala y transiciones

**Albert-László Barabási — *Network Science*** (2016) ★★★ · `[EN]` · **gratis online** en networksciencebook.com · ⏱ 8 h para lo relevante

**Qué es:** el libro de texto moderno de ciencia de redes, disponible completo y gratis, con figuras interactivas y datasets.

**Por qué:** todo el Bloque E menos la parte geométrica. Percolación, robustez ante fallos aleatorios vs ataques dirigidos, k-core, grado, comunidades. Es exactamente lo que hace falta para EXP-11 y RND-04.

**Qué leer:** el capítulo de robustez de redes (percolación, ataques) y el de propagación. El resto es contexto.

**La idea única:** las redes libres de escala son extraordinariamente robustas ante fallos aleatorios y extraordinariamente frágiles ante ataques dirigidos a los nodos de alto grado. Tu arquitectura es una de esas redes.

→ **Hacé:** la curva de percolación de tu grafo de servicios mientras leés el capítulo.

---

**Geoffrey West — *Scale*** (2017) ★★ · `[EN]`, hay traducción al castellano · ⏱ 10 h, lectura ligera

**Qué es:** divulgación de alto nivel sobre leyes de escala en organismos, ciudades y empresas. West es físico y el libro está escrito con rigor, aunque es largo y repetitivo.

**Por qué:** es el origen del Bloque H y del hallazgo que cierra el círculo del Vol II — que el crecimiento superlineal sobre recursos finitos produce una singularidad en tiempo finito, evitable solo con innovaciones a ritmo acelerado.

**Advertencia:** el libro es entusiasta y no siempre marca dónde la evidencia es débil. Leelo **después** de Clauset-Shalizi-Newman, no antes, para tener el escepticismo estadístico ya instalado.

**Qué leer:** la parte de ciudades. La de organismos es interesante pero no aporta al proyecto.

---

**Steven Strogatz — *Nonlinear Dynamics and Chaos*** (2ª ed.) ★★★ · `[EN]` · ⏱ 15 h selectivas

**Qué es:** el mejor libro de sistemas dinámicos para no matemáticos. Bifurcaciones, estabilidad, atractores, con una claridad pedagógica excepcional.

**Por qué:** es el prerequisito real del Bloque D. El mecanismo lo/hi depende enteramente de que el operador linealizado sea **inestable**, y para entender qué significa eso hay que entender análisis de estabilidad lineal. También da la base para la parte de no reciprocidad del Vol II (EXP-13): los autovalores complejos con parte real positiva son la firma de la oscilación.

**Qué leer:** caps. 2–3 (flujos 1D, bifurcaciones) y 5–6 (sistemas 2D, análisis de estabilidad lineal, plano de fases). Ahí está el 80% del valor.

**La idea única:** el comportamiento cualitativo de un sistema cambia abruptamente en valores críticos de un parámetro. Eso es la tesis del proyecto, en su forma más simple y mejor entendida.

---

**Didier Sornette — *Critical Phenomena in Natural Sciences*** (2ª ed., 2006) ★★★ avanzado · `[EN]` · ⏱ consulta

**Qué es:** leyes de potencia, criticidad, colas pesadas y predicción de crisis, escrito por un geofísico que se dedicó a predecir crashes financieros.

**Por qué:** es la fuente directa del enfoque de EXP-05 (detección de blowup autosemejante) y también la fuente de sus críticas. Sornette es a la vez el mejor argumento a favor y el mejor caso de estudio de los riesgos.

**Uso recomendado:** consulta, no lectura lineal. Buscá los capítulos sobre power-law fitting y sobre predicción de rupturas.

---

### 2.4 Cerebro — la línea ADA

**György Buzsáki — *Rhythms of the Brain*** (2006) ★★★ para ADA · `[EN]` · ⏱ 20 h

**Qué es:** el libro de referencia sobre oscilaciones cerebrales, escrito por uno de los neurocientíficos más importantes del campo. Cubre por qué el cerebro oscila, la jerarquía de bandas de frecuencia, el acoplamiento entre frecuencias y el ruido 1/f.

**Por qué es el libro de ADA:** todo lo que estás midiendo con el Muse está acá, explicado desde la fisiología y no desde el manual del dispositivo. En particular, el material sobre la estructura 1/f del espectro y sobre por qué las bandas clásicas son una convención útil pero arbitraria.

**Qué leer:** los capítulos sobre la jerarquía de osciladores y sobre ruido 1/f. Ahí está la justificación fisiológica de RND-01.

**La idea única:** el espectro del EEG no es un conjunto de bandas; es una estructura 1/f con picos encima. **Medir solo las bandas es tirar información.** Ese es exactamente el argumento de RND-01.

---

### 2.5 Sistemas y método

**Donella Meadows — *Thinking in Systems: A Primer*** (2008) ★★ · `[EN]`, hay traducción · ⏱ 5 h

**Qué es:** libro corto sobre pensamiento sistémico: stocks, flujos, lazos de realimentación, retardos, puntos de apalancamiento.

**Por qué:** es la versión sin matemática de todo el Bloque A, y es el mejor material para explicarle esto a alguien que no va a leer Harchol-Balter nunca. El capítulo sobre retardos en lazos de realimentación es la condición CFL contada en prosa.

**La idea única:** un retardo en un lazo de realimentación produce oscilación. Es CFL sin ecuaciones.

---

**Brown, Roediger & McDaniel — *Make It Stick*** (2014) ★★ · `[EN]`, hay traducción · ⏱ 6 h

**Qué es:** síntesis de la investigación empírica sobre qué funciona al aprender. Recuperación activa, práctica espaciada, intercalado, dificultad deseable — y por qué releer y subrayar no funcionan aunque se sientan productivos.

**Por qué está en una lista técnica:** el protocolo de estudio del glosario sale de acá. Y porque el modo de fallo específico de este material —fluidez confundida con comprensión— es justamente lo que este libro documenta.

**La idea única:** el esfuerzo de recuperar de memoria es lo que consolida. La relectura genera confianza sin generar aprendizaje, y esa es la trampa exacta que un glosario dispara.

---

**Forsgren, Humble & Kim — *Accelerate*** (2018) ★★ · `[EN]`, hay traducción · ⏱ 4 h

**Qué es:** el trabajo empírico detrás de las métricas DORA, con la metodología estadística explicada.

**Por qué:** es el estándar actual de "medir ingeniería de software con evidencia". Si vamos a proponer métricas nuevas —`Co`, `Λ_infra`, índice de curl— tienen que posicionarse respecto de lo que ya existe y es aceptado. **Saber qué mide DORA es saber qué hueco estamos llenando.**

---

**Google — *Site Reliability Engineering*** (2016) ★★ · `[EN]` · **gratis online** en sre.google/books · ⏱ consulta

**Qué es:** cómo opera Google sus sistemas. Gratis y completo.

**Por qué:** es el vocabulario estándar de la industria para lo que el Vol II formaliza. Los capítulos sobre cascading failures y sobre manejo de sobrecarga describen fenomenológicamente lo que el mecanismo lo/hi describe formalmente.

**Qué leer:** *Addressing Cascading Failures* y *Handling Overload*. Leerlos con el Vol I al lado es revelador: describen los mismos fenómenos sin el aparato matemático.

---

## 3. Papers y artículos

*Todos con resumen en castellano. El original está en inglés salvo donde se indique.*

### 3.1 Los resultados de 2026 — obligatorios

**Terence Tao — "Finite time blowup with smooth forcing term..."** (7-sep-2026) ★★★ `[EN]` ⏱ 1 h **✓**
https://terrytao.wordpress.com/2026/09/07/finite-time-blowup-with-smooth-forcing-term-for-the-incompressible-porous-medium-boussinesq-and-incompressible-euler-equations/

**Resumen:** Tao explica el trabajo de Alpöge y Buckmaster, construido sobre el de Córdoba y Martínez-Zoroa, que demuestra blowup en tiempo finito con forzamiento suave para tres ecuaciones modelo: medio poroso incompresible, Boussinesq 2D y Euler 3D incompresible. Lo valioso no es el anuncio sino la exposición del **mecanismo**: se construye la solución por etapas, sumando iterativamente correcciones de alta frecuencia que resuelven aproximadamente la ecuación linealizada alrededor de un flujo base **diseñado para ser inestable**, de modo que la corrección arranca exponencialmente chica y explota justo antes del tiempo crítico, manteniendo el forzamiento acotado. Tao dice explícitamente algo que conviene tener presente: resolver el problema es un objetivo secundario respecto del objetivo primario, que es desarrollar comprensión matemática.

**Por qué es el #1 de la lista de artículos:** es la fuente del único elemento que el proyecto realmente transfiere de la matemática de fluidos.

→ **Hacé:** después de leerlo, la PRÁCTICA D2 — buscá tu propio mecanismo lo/hi en un post-mortem viejo.

---

**Terence Tao — "Why global regularity for Navier-Stokes is hard"** (2007) ★★★ `[EN]` ⏱ 2 h **✓**
https://terrytao.wordpress.com/2007/03/18/why-global-regularity-for-navier-stokes-is-hard/

**Resumen:** escrito 19 años antes de los resultados de 2026, sigue siendo la mejor explicación de por qué el problema resistió tanto. Tao clasifica los métodos disponibles y muestra por qué cada familia falla: hay una competencia de escalas donde la no linealidad concentra energía hacia escalas chicas más rápido de lo que la viscosidad la disipa, y ninguna cantidad conservada controla lo que hay que controlar.

**Por qué leerlo antes que el de 2026:** el de 2026 asume que entendés por qué el problema era difícil. Este te lo explica. **Leelos en orden cronológico, no de novedad.**

**Y por qué importa para el lab:** el argumento de "competencia entre concentración y disipación en distintas escalas" es directamente el argumento sobre si tu sistema disipa carga más rápido de lo que la concentra. Es la forma correcta de pensar la saturación.

---

**OpenAI — "On the Navier–Stokes Millennium Prize Problem"** (8-sep-2026) ★★ `[EN]` ⏱ 1 h el resumen, el manuscrito de 166 páginas no **✓**
https://openai.com/index/navier-stokes-solution/

**Resumen:** OpenAI reporta que un sistema interno produjo una demostración de que Navier-Stokes 3D desarrolla una singularidad en tiempo finito bajo forzamiento suave, con manuscrito y formalización en Lean. La construcción es un filamento de vorticidad que colapsa hacia adentro mientras se estira axialmente, con energía total finita. Se atacaron los enunciados C y D del Clay, la variante **forzada**; el problema canónico sigue abierto y la aceptación independiente no está establecida. Hubo disputa pública de prioridad con el grupo de Buckmaster.

**Cómo leerlo:** la página de resumen sí, el manuscrito no. Y leerlo **junto con** la cobertura de la disputa (Axios, Fortune), porque el contexto es parte del contenido: es un caso de estudio sobre cómo se está produciendo matemática ahora.

---

### 3.2 Los fundamentos técnicos

**Jos Stam — "Stable Fluids"** (SIGGRAPH 1999) ★★★ `[EN]` ⏱ 3 h leyendo, 8 h implementando

**Resumen:** ocho páginas que cambiaron la simulación de fluidos en gráficos. Stam propone un esquema incondicionalmente estable combinando advección semi-lagrangiana (retroceder en el tiempo desde cada celda para ver de dónde vino el fluido, en vez de avanzar) con un paso de proyección que impone divergencia nula resolviendo una ecuación de Poisson. El ciclo resultante —fuerza, advección, difusión, proyección— es el estándar desde entonces.

**Por qué es el paper más accionable de la lista:** se implementa en un fin de semana, y al implementarlo entendés la proyección de Helmholtz-Hodge con las manos en vez de con la cabeza. Es simultáneamente la PRÁCTICA C1 del glosario y el punto de partida de la rama Retratarte.

→ **Hacé:** implementalo. No lo leas y sigas.

---

**Topping, Di Giovanni et al. — "Understanding over-squashing and bottlenecks on graphs via curvature"** (ICLR 2022) ★★★ `[EN]` ⏱ 3 h

**Resumen:** demuestra que los cuellos de botella en el paso de mensajes sobre grafos se caracterizan geométricamente: las aristas con curvatura de Ricci fuertemente negativa son las que estrangulan la información. Introducen una curvatura discreta ("Balanced Forman") que acota inferiormente la de Ollivier, y proponen reconectar el grafo agregando aristas alrededor de las más negativamente curvadas.

**Por qué:** es la base de EXP-09, el experimento de mejor ratio valor/esfuerzo de todo el Vol II. Y hay un post de blog de los autores que resume todo con figuras, mucho más rápido de leer que el paper.

**Complemento:** Nguyen et al., *Revisiting Over-smoothing and Over-squashing Using Ollivier-Ricci Curvature* (https://arxiv.org/abs/2211.15779 **✓**), que agrega la mitad que falta: el over-smoothing se liga a curvatura **positiva**, o sea que las dos patologías son extremos de un mismo espectro.

→ **Hacé:** instalá `GraphRicciCurvature` y corré la curvatura sobre un grafo tuyo mientras leés.

---

**Jiang, Lim, Yao & Ye — "Statistical Ranking and Combinatorial Hodge Theory"** ★★★ `[EN]` ⏱ 4 h, denso

**Resumen:** desarrolla la teoría de Hodge sobre grafos en un contexto aplicado (ranking a partir de comparaciones inconsistentes). Muestra que cualquier flujo sobre aristas se descompone únicamente en componente gradiente (consistente, derivable de un potencial), curl local (inconsistencia en ciclos cortos) y armónica (inconsistencia global que vive en la topología).

**Por qué:** es la base matemática de EXP-02, el entregable más diferenciador del proyecto. Traducido a nuestro dominio: progreso, churn de retries y deuda topológica.

**Alternativa más liviana:** Bhatia et al., *The Helmholtz-Hodge Decomposition: A Survey* (IEEE TVCG 2013), que cubre lo mismo con más figuras y menos álgebra.

---

**Clauset, Shalizi & Newman — "Power-law distributions in empirical data"** (SIAM Review, 2009) ★★★ **obligatorio** `[EN]` ⏱ 3 h

**Resumen:** demuestra que la práctica habitual de ajustar una recta en log-log para identificar una ley de potencia produce resultados sistemáticamente erróneos, y presenta un método correcto: estimación por máxima verosimilitud, selección del punto de corte inferior por distancia de Kolmogorov-Smirnov, y **comparación explícita contra hipótesis alternativas** (log-normal, exponencial, exponencial estirada). Reexaminan dos docenas de conjuntos de datos famosos que se citaban como leyes de potencia; en buena parte de ellos la evidencia resulta débil o la log-normal ajusta igual o mejor.

**Por qué es obligatorio y no opcional:** el Vol II propone medir exponentes `β` con quince sistemas, y el glosario marca eso como el experimento de mayor riesgo de autoengaño. **Este paper es la diferencia entre que el lab tenga credibilidad o no.** Publicar un `β` mal estimado es el único error de esta lista que sería difícil de remontar.

→ **Hacé:** usá la implementación de referencia (`powerlaw` en Python) desde el primer ajuste. No escribas el tuyo.

---

**AlphaEvolve white paper** (2025) ★★ `[EN]` ⏱ 3 h **✓**
https://arxiv.org/abs/2506.13131

**Resumen:** un agente de codificación evolutivo donde LLMs proponen modificaciones a código y evaluadores objetivos seleccionan, iterando. Resultados en producción: una heurística para Borg que lleva más de un año desplegada recuperando de forma continua el 0,7% del cómputo mundial de Google; un kernel de Gemini acelerado 23%; hasta 32,5% de speedup en FlashAttention; y multiplicación de matrices complejas 4×4 con 48 multiplicaciones en lugar de las 49 de Strassen. Los autores subrayan que la solución de Borg es código legible por humanos, y que esa legibilidad es lo que la hizo desplegable.

**Por qué:** no es analogía, es método. Es la ruta alternativa a EXP-04: en vez de diseñar el scheduler, evolucionarlo.

**Qué mirar específicamente:** cómo construyen el evaluador. La calidad del resultado está determinada enteramente por ahí, y es la parte que se subestima.

---

**Google Quantum AI — "Quantum error correction below the surface code threshold"** (Nature) ★★ `[EN]` ⏱ 2 h **✓**
https://www.nature.com/articles/s41586-024-08449-y

**Resumen:** dos memorias de código de superficie operando por debajo del umbral crítico. La tasa de error lógico se suprime por un factor Λ = 2,14 al aumentar la distancia del código en dos, llegando a un código de distancia 7 con 101 qubits y 0,143% de error por ciclo, superando la vida del mejor qubit físico por un factor de 2,4. Mantienen el régimen con decodificación en tiempo real, con latencia media del decodificador de 63 µs en distancia 5 sobre ciclos de 1,1 µs. Y en códigos de repetición hasta distancia 29, encuentran que el límite de performance no son los errores independientes sino **eventos correlacionados raros**, aproximadamente uno por hora.

**Por qué:** los tres números que importan para el Vol II están todos acá — el factor Λ, la restricción de cola sobre el decodificador, y el hallazgo de que lo correlacionado domina. **Leelo con la mentalidad de "esto es un paper sobre redundancia", no sobre computación cuántica.**

---

**Bronson, Aghayev, Charapko & Zhu — "Metastable Failures in Distributed Systems"** (HotOS 2021) ★★ `[EN]` ⏱ 1 h

**Resumen:** paper corto que nombra y caracteriza una clase de fallo donde el sistema entra en un estado degradado que se sostiene **incluso después de que el disparador original desapareció**, porque un lazo de realimentación positiva (típicamente reintentos) mantiene la carga alta. Distinguen estado estable, estado vulnerable y estado metaestable, y muestran que el disparador puede ser trivial mientras el estado vulnerable es lo que realmente importa.

**Por qué es la pieza que engancha todo:** es el fenómeno que el mecanismo lo/hi de Alpöge-Buckmaster describe formalmente. **La literatura de sistemas tiene el fenómeno sin la matemática; los papers de fluidos tienen la matemática sin el fenómeno.** Ese hueco es la tesis del lab.

---

**Donoghue et al. — "Parameterizing neural power spectra into periodic and aperiodic components"** (Nature Neuroscience, 2020) ★★★ para ADA `[EN]` ⏱ 2 h

**Resumen:** presenta el método (FOOOF/specparam) para separar el espectro de potencia neural en su componente aperiódica 1/f y sus picos oscilatorios. Argumentan que las bandas clásicas mezclan ambas cosas, y que cambios reportados como "aumento de alfa" pueden ser desplazamientos del componente aperiódico. El exponente aperiódico se interpreta como proxy del balance excitación/inhibición y varía con estado de conciencia, edad y tarea.

**Por qué es el paper más accionable para ADA:** es RND-01 completo. Herramienta open source, datos que ya guardás, y una métrica potencialmente más sensible que las bandas que estás usando.

→ **Hacé:** corré specparam sobre las sesiones almacenadas. Un fin de semana.

---

**Beggs & Plenz — "Neuronal avalanches in neocortical circuits"** (J. Neuroscience, 2003) ★★★ opcional `[EN]` ⏱ 2 h

**Resumen:** el paper fundacional de la hipótesis del cerebro crítico. Encuentran que las cascadas de actividad neuronal siguen una distribución de ley de potencia consistente con un sistema operando cerca de un punto crítico.

**Advertencia importante:** la hipótesis del cerebro crítico está **debatida**, y buena parte de la crítica es exactamente metodológica en el sentido de Clauset-Shalizi-Newman. Leelo después de ese paper, no antes. Es la conexión más linda entre ADA y el Bloque H, y también la más fácil de sobreinterpretar.

---

### 3.3 Clásicos cortos

- **Little (1961)** — la demostración original de `L = λW`. Dos páginas, y vale leerlas para ver cuán pocos supuestos requiere.
- **Kingman (1961)** — la aproximación para colas generales. La fórmula que todo el proyecto tiene que batir.
- **Bettencourt, Lobo, Helbing, Kühnert & West — "Growth, innovation, scaling, and the pace of life in cities"** (PNAS 2007) — el paper original de las leyes de escala urbana, con los exponentes β ≈ 0,85 y β ≈ 1,15 y el argumento de la singularidad en tiempo finito. Es corto y es la fuente, mejor que el libro de West para este punto específico.
- **Fruchart, Hanai, Littlewood & Vitelli — "Non-reciprocal phase transitions"** (Nature 2021) — para EXP-13. Interacciones asimétricas producen fases dependientes del tiempo imposibles en sistemas recíprocos. Denso, pero la introducción sola ya da la idea.

---

## 4. Videos

*Ordenados por cuánto rinden por minuto invertido.*

**3Blue1Brown — "Divergence and curl"** ★★★ `[EN]`, subtítulos ES · ⏱ 20 min
**El mejor uso de 20 minutos de toda esta lista.** Explica visualmente divergencia y rotacional, que son los dos operadores sobre los que descansa medio glosario. Después de este video, "incompresibilidad" y "vorticidad" dejan de ser palabras.
→ Vé esto antes que cualquier otra cosa del documento.

**3Blue1Brown — serie *Essence of Linear Algebra*** ★★ `[EN]` · ⏱ 3 h la serie
Lo que hace falta es la parte de autovalores y autovectores: es la base del análisis de estabilidad lineal del Bloque D y del espectro asimétrico de EXP-13. Si ya tenés los autovalores claros, salteala.

**Steve Brunton — playlists de dinámica de fluidos y de ciencia basada en datos** ★★★ `[EN]` · ⏱ modular
Profesor de la Universidad de Washington, videos de 10–20 min, excelente nivel: riguroso pero orientado a ingeniería. Cubre Navier-Stokes, número de Reynolds, capa límite y turbulencia, y por separado métodos data-driven (POD, DMD) que son directamente aplicables a series de métricas. **Es el reemplazo en video del libro de Acheson si preferís mirar a leer.**

**Sebastian Lague — "Coding Adventure: Simulating Fluids"** ★★ `[EN]` · ⏱ 45 min
Implementación de un simulador de fluidos desde cero, explicada con una claridad visual excepcional. **Es el complemento perfecto del paper de Stam y el mejor arranque para la rama Retratarte:** te da la intuición antes de escribir el shader.

**Geoffrey West — TED, "The surprising math of cities and corporations"** ★★ `[EN]`, subtítulos ES · ⏱ 20 min
La versión de 20 minutos del libro *Scale*. Si el libro te parece demasiado largo, con esto y el paper de PNAS tenés el 90%.

**Veritasium — el video sobre sincronización (Kuramoto)** ★★ `[EN]`, subtítulos ES · ⏱ 25 min
Osciladores acoplados que se sincronizan espontáneamente al cruzar un acoplamiento crítico. **Es una transición de fase filmada**, y es la intuición más directa para la tesis del Bloque H. También es el marco natural para pensar sistemas de agentes acoplados.

**Numberphile — los videos sobre Busy Beaver** ★★ `[EN]` · ⏱ 30 min entre varios
Explican por qué BB crece más rápido que cualquier función computable y por qué determinar BB(5) fue un logro. **Es el material del Bloque I sobre indecidibilidad, en formato digerible.**

**Terence Tao — charlas sobre matemática asistida por máquina** ★★★ `[EN]` · ⏱ 1 h
Tao lleva años dando charlas sobre asistentes de demostración, formalización en Lean y colaboración humano-IA en matemática. Dado que ambos resultados de 2026 están formalizados en Lean y que uno lo produjo un sistema multi-agente, **entender qué significa y qué no significa "verificado formalmente" es parte del contexto de este proyecto**, no un extra.

---

## 5. Plan de ataque — 12 semanas

Realista, asumiendo unas 6 horas por semana de estudio real.

| Semanas | Foco | Recursos | Entregable |
|---|---|---|---|
| **1** | Operadores y base | 3B1B divergencia/rotacional · Meadows | Notas del Bloque A |
| **2–3** | Colas | Harchol-Balter 1–7 · Reinertsen 3,6 | **RND-05** (Little+Kingman sobre vos) y F1 |
| **4** | Estadística defensiva | Clauset-Shalizi-Newman | Un ajuste hecho bien con `powerlaw` |
| **5–6** | Fluidos e implementación | Stam · Bridson · Brunton | **Solver 2D funcionando** (PRÁCTICA C1) |
| **7** | Los resultados de 2026 | Tao 2007 → Tao 2026 → OpenAI | **PRÁCTICA D2** y el resumen de tres niveles |
| **8** | Grafos | Barabási (robustez) · Topping · Nguyen | **EXP-09 + EXP-11** sobre un grafo real |
| **9** | Fiabilidad | Google QEC · Bronson · SRE (2 caps.) | **Λ_infra** sobre historial de incidentes |
| **10** | Escala | Bettencourt · West (TED) | Decisión: ¿EXP-12 es viable con los datos que hay? |
| **11** | ADA | Donoghue · Buzsáki (1/f) | **RND-01** corriendo sobre sesiones guardadas |
| **12** | Método y síntesis | AlphaEvolve · *Make It Stick* | Revisión del glosario: ¿qué cambió de categoría? |

**El hito de la semana 5–6 es el más importante.** Si terminás ese tramo con un solver funcionando, todo lo demás se vuelve más fácil y la rama Retratarte queda desbloqueada. Si no lo hacés, el resto queda en N1.

---

## 6. Lo que NO hay que leer

Tan importante como la lista de arriba, porque el tiempo es el recurso escaso.

**No leas un libro de texto de Navier-Stokes tapa a tapa.** El proyecto no necesita resolver la ecuación; necesita el mecanismo y el vocabulario. Acheson selectivo + Brunton alcanza. Un curso completo de mecánica de fluidos son 400 horas que no van a producir nada para el lab.

**No leas el manuscrito de 166 páginas de OpenAI.** Requiere formación en análisis de EDPs para que aporte algo, y lo transferible está en el resumen de Tao.

**No leas los libros de divulgación sobre complejidad y caos** del estante de aeropuerto. Producen exactamente el fallo que el glosario advierte: mucha fluidez, cero capacidad de cálculo. Mitchell (*Complexity: A Guided Tour*) es la excepción defendible si querés un panorama, pero no es necesario.

**No acumules un segundo libro sobre un tema que ya cubriste.** El segundo libro de teoría de colas no te va a enseñar más que aplicar el primero a datos tuyos.

**No leas nada más sobre esto hasta haber hecho RND-05 y RND-01.** Los dos son de una semana o menos, usan datos que ya tenés, y los dos pueden cambiar decisiones. **Seguir leyendo antes de hacerlos es la forma más elegante de procrastinar que existe** — y es la que más riesgo tiene en un proyecto como este, porque se siente como avanzar.

---

*Documento vivo. Cuando un recurso te cambie una decisión, anotalo acá con qué decisión cambió. Los que no cambiaron nada después de leídos, sacalos de la lista: eso es información sobre la lista.*