# SPEC — Process Lens: "Cómo trabajamos" con casos reales

**Proyecto:** web de Random (`random-lab.es`), página de servicio Cloud & DevOps.
**Caso de prueba:** ITeC (Institut de Tecnologia de la Construcció de Catalunya).
**Destinatario:** Claude Code. Leer este documento completo antes de escribir código.
**Base de diseño obligatoria:** principios de "De la catenaria al pipeline" (piedra angular de Random).

---

## 0. Objetivo

Construir la sección **"Cómo trabajamos"** (6 pasos) como un componente que **no muestra un proceso genérico, sino un caso real recorrido paso a paso**. El mismo componente sirve para tres cosas:

1. **Marketing:** explicar cómo trabaja Random con un ejemplo concreto en vez de con viñetas abstractas.
2. **Modo test:** cargar los datos de un cliente (un "case file" en JSON) y validar qué sabemos, qué suponemos y qué falta. El resultado es un **informe de huecos** que dice exactamente qué preguntar.
3. **Herramienta de trabajo:** el case file de ITeC se convierte en una primera propuesta de infraestructura óptima, con cada afirmación marcada según su nivel de certeza.

**Regla de oro:** el componente nunca presenta una suposición como si fuera un hecho. Cada dato lleva su estado.

---

## 1. Restricciones de identidad

### 1.1 Identidad de Random (a reconciliar con el repo)
- Voz con prompt de terminal `>` para frases clave, como en `en.json` (`cta_description`, `about_text_*`).
- La web usa Three.js/WebGL (shaders holográficos, lluvia de Matrix, laboratorio). Este componente **no** usa WebGL: usa SVG para que el diagrama sea accesible, nítido y liviano. Si el repo ya tiene un fondo WebGL global, el componente convive con él sin competir.
- i18n en JSON con claves en snake_case. Todo texto visible sale del i18n; nada hardcodeado.

### 1.2 Tokens visuales
Partir de los tokens de la página Cloud & DevOps ya publicada (plano técnico). **Antes de implementar, comparar con los tokens existentes del repo y unificar.** Si hay conflicto, gana el sistema del repo y se ajusta esta página.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--paper` | `#E9EEF2` | `#0B1A2A` | Fondo |
| `--ink` | `#0F2236` | `#DCE6EE` | Texto y trazos principales |
| `--line` | `#24496B` | `#7FB2D9` | Estructura, bordes, diagrama |
| `--muted` | `#4F6378` | `#8FA6BB` | Texto secundario |
| `--load` | `#C8742B` | `#E5A15A` | **Solo** fuerzas, cargas y lo que requiere atención |
| `--grid` | `rgba(36,73,107,.10)` | `rgba(127,178,217,.08)` | Cuadrícula de plano |

Tipografía: Archivo (eje de ancho variable) para títulos y texto; IBM Plex Mono solo para líneas con `>` y estados.

### 1.3 Los estados de certeza también son identidad visual

| Estado | Significado | Tratamiento |
|---|---|---|
| `known` | Dato verificado, con fuente | Trazo sólido `--ink` |
| `assumed` | Hipótesis razonable, sin verificar | Trazo punteado `--line` y etiqueta "Hipótesis" |
| `open` | Dato que falta | Contorno `--load` y etiqueta "Por confirmar" |

---

## 2. Decisiones de diseño basadas en evidencia

| # | Decisión | Por qué |
|---|---|---|
| D1 | **El usuario avanza los pasos.** Nada de autoplay. Clic, teclado (← →) y, como opción, scroll. | Tversky, Morrison y Bétrancourt (2002): la animación no supera por sí sola a las imágenes estáticas; hace falta poder avanzar paso a paso y controlar el ritmo. Pero el control total también puede agregar carga cognitiva, así que el control es **simple**: siguiente, anterior, ir a un paso. |
| D2 | **Un solo diagrama persistente** que evoluciona en los 6 pasos, en vez de 6 pantallas. | Heer y Robertson (2007): las transiciones bien diseñadas mejoran la percepción gráfica si se mantiene la representación válida y la correspondencia entre elementos. |
| D3 | **Transiciones escalonadas:** primero se resalta lo que va a cambiar, después cambia. | Mismo estudio: las transiciones escalonadas se prefieren a las simples, y estas a las estáticas. |
| D4 | **Duraciones cortas** (180–450 ms por etapa, como máximo ~900 ms por paso). | "Tan largas como haga falta, y no más." |
| D5 | **Fotogramas clave estables:** cada paso es un estado completo y válido; si se desactiva la animación, el componente funciona igual. | Los fotogramas clave bien segmentados suelen funcionar tan bien o mejor que la animación. Además, respeta `prefers-reduced-motion`. |
| D6 | **El último paso cierra con la inversión de la catenaria.** | Es la firma de la página: el sistema "se sostiene solo" cuando se entrega. Conecta este componente con el hero. |

---

## 3. Concepto: Process Lens

Un diagrama SVG del sistema del cliente ocupa el centro. A su lado, un panel de texto. Seis pasos lo recorren:

```
┌──────────────────────────────────────────────────────────────┐
│  [1 Medir] [2 Decidir] [3 Construir] [4 Desplegar] [5 Operar] [6 Entregar] │  ← stepper
├───────────────────────────────────────┬──────────────────────┤
│                                       │ > paso actual        │
│        DIAGRAMA DEL SISTEMA           │ título               │
│   (persistente: cambia por capas)     │ qué hicimos          │
│                                       │ datos (con estado)   │
│                                       │ preguntas abiertas   │
├───────────────────────────────────────┴──────────────────────┤
│  Leyenda: ━ conocido   ┅ hipótesis   ▢ por confirmar   [Modo test] │
└──────────────────────────────────────────────────────────────┘
```

En móvil: stepper con desplazamiento horizontal arriba, diagrama a ancho completo y panel debajo.

### 3.1 Qué le pasa al diagrama en cada paso

| Paso | Estado del diagrama | Transición escalonada |
|---|---|---|
| **1. Medir las fuerzas** | Productos y usuarios del cliente como bloques. Flechas `--load` entran al sistema: carga, volumen de datos, ritmo de cambio, cumplimiento. | (a) aparecen los bloques, (b) entran las flechas de fuerza una por una. |
| **2. Decidir por escrito** | Sobre el diagrama aparecen marcadores de ADR anclados al componente que afectan. | (a) se atenúa lo que no está afectado, (b) aparecen los marcadores. |
| **3. Construir como código** | El sistema se reorganiza en las **capas de Brand** (terreno → estructura → instalaciones → distribución → objetos), de la más lenta a la más rápida. | (a) los bloques se mueven a su capa, (b) aparecen las etiquetas de capa. |
| **4. Desplegar con gates** | Un camino de pipeline atraviesa el diagrama con sus gates (tests, secretos, SAST, dependencias, imagen, DAST, aprobación). | (a) se dibuja el camino, (b) los gates se encienden en orden. |
| **5. Operar y observar** | Sobre cada servicio aparecen las cuatro señales doradas; un incidente simulado salta a su runbook. | (a) aparecen las señales, (b) una alerta destaca un componente y muestra su runbook. |
| **6. Entregar** | Los andamios (marcadores de Random) se retiran y la catenaria del hero se invierte bajo el sistema: el sistema se sostiene sin nosotros. | (a) se retiran los marcadores, (b) se invierte la catenaria. |

---

## 4. Interacción, accesibilidad y rendimiento

- **Teclado:** el stepper es un `tablist` (WAI-ARIA). Flechas ← → cambian de paso; Home y End van al primero y al último. Foco siempre visible.
- **Lectores de pantalla:** el panel de texto es la fuente principal de información. El SVG tiene `role="img"` y un `aria-label` que resume el estado del paso. Cada cambio de paso se anuncia con `aria-live="polite"`.
- **Movimiento reducido:** con `prefers-reduced-motion: reduce`, los pasos cambian sin transición (D5).
- **Scroll opcional:** si se implementa avance por scroll (sección fija con `IntersectionObserver`), **los botones y el teclado siguen funcionando** y el scroll nunca queda bloqueado.
- **Rendimiento:** sin dependencias pesadas. Animaciones con Web Animations API o CSS sobre `transform` y `opacity`. Presupuesto: ≤ 35 KB gzip para el componente sin contar los datos del caso. Sin saltos de layout al cambiar de paso.
- **Contraste:** WCAG AA en los dos temas, incluidos los estados `assumed` y `open`.

---

## 5. Modelo de datos: el case file

Cada caso es un archivo JSON validado contra un esquema. Los textos visibles van como pares `{ "en": ..., "es": ... }` o como claves de i18n.

### 5.1 Tipos (TypeScript)

```ts
type Certainty = "known" | "assumed" | "open";
type Localized = { en: string; es: string };

interface Source {
  label: string;        // "Programa de trabajo ITeC 2023"
  url?: string;
  date?: string;        // ISO; cuándo es válido el dato
}

interface Fact {
  id: string;
  text: Localized;
  certainty: Certainty;
  source?: Source;        // obligatorio si certainty === "known"
  question?: Localized;   // obligatorio si certainty !== "known": qué preguntar para confirmarlo
}

interface SystemNode {
  id: string;
  label: Localized;
  kind: "product" | "service" | "data" | "client" | "platform" | "external";
  layer: "site" | "structure" | "services" | "space_plan" | "stuff"; // capas de Brand
  certainty: Certainty;
}

interface Force {
  id: string;
  kind: "load" | "data" | "change_rate" | "compliance" | "team" | "cost";
  target: string;        // SystemNode.id
  fact: Fact;
}

interface Adr {
  id: string;            // "ADR-001"
  title: Localized;
  decision: Localized;
  rationale: Localized;
  principle: PrincipleId; // qué principio de diseño aplica
  affects: string[];      // SystemNode.id[]
  status: "proposed" | "accepted";
  revisitWhen?: Localized; // condición para reconsiderar la decisión
}

interface Gate {
  id: string;
  name: Localized;
  tool: string;          // "Gitleaks", "Semgrep", "Trivy", "OWASP ZAP"...
  stage: "mr" | "build" | "staging" | "release";
  blocking: boolean;
}

interface Signal {
  node: string;
  metric: "latency" | "errors" | "traffic" | "saturation";
  alert?: Localized;
  runbook?: string;
}

interface StepContent {
  summary: Localized;
  facts: Fact[];
}

interface CaseFile {
  schemaVersion: 1;
  id: string;            // "itec"
  client: { name: string; sector: Localized; public: boolean };
  disclaimer: Localized; // obligatorio: aclara qué es hipótesis
  nodes: SystemNode[];
  steps: {
    measure:  StepContent & { forces: Force[] };
    decide:   StepContent & { adrs: Adr[] };
    build:    StepContent;   // usa nodes[].layer
    ship:     StepContent & { gates: Gate[] };
    operate:  StepContent & { signals: Signal[] };
    handover: StepContent & { deliverables: Localized[] };
  };
}

type PrincipleId =
  | "forces" | "pace_layers" | "contain_failure" | "composable"
  | "operable" | "economy" | "noise" | "integrity";
```

### 5.2 Reglas de validación (modo test)

El validador recibe un case file y devuelve **errores** (bloquean la publicación) y **huecos** (no bloquean, pero se informan).

**Errores:**
- E1: un `Fact` con `certainty: "known"` sin `source`.
- E2: un `Fact` con `assumed` u `open` sin `question`.
- E3: un `Force.target`, `Adr.affects[]` o `Signal.node` que apunta a un nodo inexistente.
- E4: un texto `Localized` al que le falta `en` o `es`.
- E5: un paso sin `summary` o sin al menos un `fact`.
- E6: un caso con `client.public: true` y algún dato `open` en `measure`. **No se publica un caso con fuerzas sin medir.**
- E7: falta el `disclaimer`.

**Huecos (se informan):**
- H1: cada `Fact` en estado `open` o `assumed`.
- H2: nodos sin ninguna `Signal` en el paso 5.
- H3: ADRs sin `revisitWhen`.
- H4: fuentes con más de 24 meses de antigüedad (el dato puede haber cambiado).

### 5.3 Salidas del modo test
- `npm run case:check <id>`: valida e imprime un resumen (errores, huecos, porcentaje de datos `known`).
- `npm run case:gaps <id>`: genera `cases/<id>/gaps.md` con **todas las preguntas agrupadas por paso**, listas para llevar a una reunión.
- En la web, un interruptor "Modo test" (solo en desarrollo o con `?test=1`) resalta en el diagrama todo lo `assumed` y `open`.

---

## 6. Caso de prueba: ITeC (case file v0)

> **Aviso:** todo lo que no está marcado como `known` es una hipótesis de Random a partir de información pública y de la oferta de empleo. Los datos `known` vienen de documentos públicos de ITeC de 2022–2023 y pueden haber cambiado. El caso se marca `public: false` hasta validarlo con ITeC.

### 6.1 Paso 1: Medir las fuerzas

| Id | Dato | Estado | Fuente / pregunta |
|---|---|---|---|
| f-bedec | BEDEC: base de datos de casi un millón de elementos constructivos, principal producto por ingresos. | known | Programa de trabajo y presupuesto ITeC 2023 |
| f-tcqi | TCQi: versión SaaS de gestión de obra; TCQ es la versión de escritorio. | known | Web de software de ITeC |
| f-tcq-legacy | El TCQ de escritorio estaba en Visual Basic, con plan de migrar a Electron desde la base de código de TCQi. | known (2022–23) | Programa de trabajo 2023 · *¿En qué punto está la migración?* |
| f-compliance | Objetivo de certificar ISO 27001 y, si es posible, ENS para TCQi y BEDEC. | known (2022–23) | Programa de trabajo 2023 · *¿Se certificaron? ¿Qué controles cuestan más?* |
| f-team | 87 personas, 13 en informática. | known (fines de 2022) | Programa de trabajo 2023 · *¿Cuántos en el equipo técnico hoy?* |
| f-stack | Stack de entrega: Jenkins, GitLab, GitLab Runners, Docker, Compose, Linux, Bash. | known | Oferta de empleo (vía AMKALIS) |
| f-hosting | Dónde corren TCQi y BEDEC (on-premise, nube o híbrido). | open | *¿Dónde corren hoy y hacia dónde quieren ir?* |
| f-load | Picos de carga en las publicaciones de BEDEC (nuevas versiones de precios). | assumed | *¿Cómo se publican las versiones de BEDEC y qué carga generan?* |
| f-deploys | Frecuencia de despliegue y tiempo de recuperación actuales. | open | *¿Cada cuánto despliegan y cuánto tarda recuperarse de un fallo?* |
| f-incidents | Incidencias más frecuentes en las guardias. | open | *¿Qué despierta a la persona de guardia?* |

### 6.2 Paso 2: Decidir por escrito (ADRs propuestos)

| ADR | Decisión propuesta | Principio | Revisar si… |
|---|---|---|---|
| ADR-001 | **Una sola plataforma de CI: GitLab CI.** Migrar de Jenkins de forma gradual, proyecto por proyecto, empezando por los de menor riesgo. | integrity, economy | Algún pipeline necesita integraciones que solo resuelve Jenkins. |
| ADR-002 | **Plantillas de pipeline compartidas** (`include:` + `extends:`), versionadas. Cada proyecto usa la plantilla en unas pocas líneas. | composable | La variación entre proyectos supera lo que una plantilla puede parametrizar. |
| ADR-003 | **No adoptar Kubernetes todavía.** Docker Compose (o Swarm donde haga falta alta disponibilidad) sobre servidores gestionados con código. | economy, forces | Más de ~15 servicios, necesidad real de autoescalado, o varios equipos desplegando en paralelo. |
| ADR-004 | **Runner de Windows dedicado** para construir y firmar la versión de escritorio de TCQ. | operable | La app de escritorio deja de distribuirse. |
| ADR-005 | **Las versiones de BEDEC son artefactos versionados**, con un pipeline de validación de datos (esquema, integridad, conteos) antes de publicar, y vuelta atrás a la versión anterior. | noise, contain_failure | — |
| ADR-006 | **El merge request es el registro del cambio:** aprobaciones, resultados de los gates y despliegue quedan trazados, como evidencia para ISO 27001 y ENS. | integrity | Un auditor exige una herramienta de gestión de cambios separada. |
| ADR-007 | **Terraform para crear infraestructura y Ansible para configurar servidores.** | operable, pace_layers | — |

Todos con `status: "proposed"` hasta validarlos con ITeC.

### 6.3 Paso 3: Construir como código (nodos por capa)

| Capa (Brand) | Nodos |
|---|---|
| Terreno | Hosting (`open`), red y accesos |
| Estructura | Base de datos de BEDEC, modelo de datos de TCQi, repositorio de infraestructura (Terraform + Ansible) |
| Instalaciones | GitLab CI con runners Linux y Windows, gestor de secretos, observabilidad (Prometheus, Grafana, Loki), backups |
| Distribución | Servicios de TCQi y de la API de BEDEC en contenedores |
| Objetos | Funcionalidades de TCQi, versiones de datos de BEDEC, builds de escritorio |

### 6.4 Paso 4: Desplegar con gates

| Gate | Herramienta | Etapa | Bloquea |
|---|---|---|---|
| Tests y cobertura | Según el stack de cada proyecto | MR | Sí |
| Secretos en el código | Gitleaks | MR | Sí |
| SAST | Semgrep | MR | Sí, con severidad alta o crítica |
| Dependencias | Trivy (filesystem) | MR | Sí, con severidad alta o crítica |
| Imagen de contenedor | Trivy (image) | Build | Sí, con severidad crítica |
| Validación de datos de BEDEC | Script propio (ADR-005) | Build | Sí |
| DAST | OWASP ZAP (baseline) | Staging | Informa; bloquea con hallazgos altos |
| Aprobación de producción | Entorno protegido de GitLab | Release | Sí, para cambios de riesgo alto |

Las excepciones de seguridad se documentan en el repositorio, con motivo y fecha de vencimiento.

### 6.5 Paso 5: Operar y observar
- Las cuatro señales doradas en TCQi y en la API de BEDEC.
- Alertas solo sobre síntomas que afectan a usuarios, cada una con su runbook.
- Backups con recuperación a un momento dado y **simulacros de restauración trimestrales**, con tiempo medido.
- Métricas DORA para medir si el proceso de entrega mejora.
- Objetivo explícito: **que las guardias se usen cada vez menos** (`f-incidents` define por dónde empezar).

### 6.6 Paso 6: Entregar
- Runbooks y ADRs en el repositorio.
- Dev Containers para que una persona nueva esté productiva en el primer día.
- Plantillas de pipeline documentadas.
- Criterio de éxito: **ninguna operación crítica depende de una persona concreta.**

### 6.7 Salida esperada del modo test para ITeC v0
- **Errores:** 0. Con `public: false`, E6 no aplica.
- **Huecos:** al menos `f-hosting`, `f-load`, `f-deploys`, `f-incidents`, más todos los datos `known` con fuentes de más de 24 meses (H4).
- `gaps.md` resultante = **la lista de preguntas para la entrevista con ITeC.**

---

## 7. Estructura de código

Adaptar a las convenciones del repo (framework, rutas, estilos). Si el repo es React + TypeScript, la estructura objetivo es:

```
src/
  features/process-lens/
    ProcessLens.tsx            # contenedor: stepper + diagrama + panel
    Stepper.tsx                # tablist accesible
    Diagram.tsx                # SVG persistente; recibe el paso y el case file
    diagram/
      layout.ts                # posiciones de nodos por capa (determinista)
      transitions.ts           # escenarios escalonados por paso (Web Animations API)
      Catenary.tsx             # reutiliza la física de la cadena del hero
    StepPanel.tsx              # texto, datos con estado, preguntas abiertas
    CertaintyBadge.tsx
    useReducedMotion.ts
  cases/
    schema.ts                  # tipos + validador (zod o JSON Schema)
    validate.ts                # reglas E1–E7, H1–H4
    itec/case.json
scripts/
  case-check.ts                # npm run case:check <id>
  case-gaps.ts                 # npm run case:gaps <id> → cases/<id>/gaps.md
tests/
  validate.test.ts
  process-lens.e2e.ts          # Playwright
  process-lens.a11y.ts         # axe
```

Las posiciones del diagrama se calculan **de forma determinista** a partir de `nodes[].layer`, para que cualquier caso nuevo se dibuje sin editar coordenadas a mano.

---

## 8. Tareas para Claude Code (en orden)

Cada tarea en su propia rama y merge request, con su criterio de aceptación verificado.

1. **Explorar el repo.** Identificar framework, sistema de estilos, configuración de i18n y tokens existentes. Escribir `docs/adr/0001-process-lens-stack.md` con lo encontrado y las decisiones de integración. **No escribir código del componente antes de este paso.**
2. **Esquema y validador.** Tipos, reglas E1–E7 y H1–H4, tests unitarios con un caso válido y uno con cada error. *Hecho cuando:* todos los tests pasan.
3. **Case file de ITeC** según la sección 6. *Hecho cuando:* `case:check itec` da 0 errores y `case:gaps itec` genera las preguntas esperadas (sección 6.7).
4. **Stepper y panel** sin diagrama. *Hecho cuando:* se navega por teclado, se anuncia cada cambio y pasa axe sin violaciones.
5. **Diagrama estático:** los 6 fotogramas clave sin animación (D5). *Hecho cuando:* cada paso es un estado completo y legible, en móvil y escritorio.
6. **Transiciones escalonadas** (D3, D4) y respeto de movimiento reducido. *Hecho cuando:* ninguna transición dura más de ~900 ms y con movimiento reducido no hay animación.
7. **Paso 6 con la catenaria**, reutilizando la física del hero.
8. **Modo test en la web** (`?test=1`).
9. **i18n:** todos los textos de interfaz en `en.json` y `es.json`.
10. **Tests e2e y visuales:** recorrido completo por teclado, capturas por paso en los dos temas, y presupuesto de tamaño verificado.

---

## 9. Fuera de alcance y riesgos

- **Publicar el caso de ITeC.** Sin su autorización, el caso queda privado (`public: false`). En la web pública se puede usar un caso propio, como Calavera Sur, o una versión anonimizada.
- **Afirmar el estado actual de ITeC.** Los datos son de 2022–2023. El componente siempre muestra la fecha de la fuente.
- **Riesgo de sobrecarga visual:** si un paso no se entiende en estático, se simplifica el diagrama antes de agregar más animación.

---

## 10. Referencias

- Tversky, B., Morrison, J. B., Bétrancourt, M. (2002). "Animation: can it facilitate?". *International Journal of Human-Computer Studies*, 57, 247–262.
- Heer, J., Robertson, G. (2007). "Animated Transitions in Statistical Data Graphics". *IEEE TVCG (InfoVis)*. https://idl.uw.edu/papers/animated-transitions
- Brand, S. (1994). *How Buildings Learn*.
- WAI-ARIA Authoring Practices: patrón Tabs.
- ITeC: programa de trabajo y presupuesto 2023; página de software de ITeC.
- Random: "De la catenaria al pipeline" (piedra angular de diseño).