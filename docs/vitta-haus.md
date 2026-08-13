

# PROPUESTA DE PROYECTO
## RANDOM LAB

Sistema Integral de Gestión para Vitta Haus
Operación, Inteligencia de Negocio e IA para Construcción Modular



### 1. Resumen Ejecutivo

Esta propuesta materializa el alcance descrito en su resumen ejecutivo: una plataforma integral que centralice toda la operación de Vitta Haus sobre un único núcleo de datos. No se trata de una simple herramienta de visualización, sino de un sistema que orquesta la empresa a través de procesos claros, medibles y delegables, liberando la información de correos electrónicos, mensajería y hojas de cálculo.

El sistema se concibe como un ecosistema unificado con tres interfaces principales:

*   **Web Pública:** Catálogo, configurador de productos y visor 3D.
*   **Sistema Interno:** Panel de control para dirección, comercial, arquitectura, administración, compras, fábrica, obra y logística.
*   **Portal del Cliente:** Espacio privado para que cada cliente siga el avance de su proyecto.

La información se carga una sola vez y alimenta automáticamente todos los tableros y reportes. Este proyecto es desarrollado directamente por Pedro (Random Lab), garantizando una comunicación directa y un estándar de ingeniería de producto de nivel internacional.

---

### 2. Entendimiento del Proyecto

Tomamos como base su documento inicial para reflejar el punto de partida y los principios rectores del sistema:

*   **Núcleo Único:** Un solo modelo de datos que alimenta todas las interfaces.
*   **Módulos Integrados:** "Vitta Obras" y "Vitta Fábrica" funcionan como centros de costos que consolidan la rentabilidad total.
*   **Avance Objetivo:** El porcentaje de avance se calcula en base a tareas e hitos terminados, diferenciando el avance físico, de cronograma y financiero.
*   **Control Económico Real:** Gestión de costos en cinco estados (presupuestado, comprometido, recibido, pagado, consumido) y manejo separado de ARS y USD.
*   **Tablero de Acción:** Cada usuario visualiza una lista priorizada de tareas, vencimientos y alertas.
*   **IA por Etapas:** Primero como asistente de consulta y análisis, y luego con capacidades predictivas y acciones asistidas, siempre con aprobación humana en decisiones críticas.

---

### 3. Nuestro Enfoque

**Un Sistema Propio, no un Pegado de Herramientas**
La alternativa común es usar múltiples plataformas SaaS, lo que fragmenta los datos y aumenta la complejidad. Nuestra propuesta es un sistema a medida, donde la información reside en un solo lugar bajo su control. Esta es la base que hace posible la rentabilidad en vivo y la capa de inteligencia artificial.

**Estándar de Ingeniería de Producto**
No entregamos "funcionalidades sueltas". Cada fase se construye con una arquitectura por capas, documentación completa, control de versiones, entornos separados y demos periódicas para validar el progreso. Este estándar asegura que el sistema pueda crecer sin necesidad de ser reescrito.

**Trato Directo**
El proyecto es liderado directamente por Pedro. La comunicación es fluida y directa con quien diseña y construye el sistema, lo que agiliza las decisiones, reduce costes y mantiene una coherencia técnica absoluta.

> "En el caos de los datos, el ruido de la matrix, el flujo constante de información, ahí está nuestro laboratorio. Donde otros ven desorden, nosotros encontramos patrones. Convertimos lo aleatorio en intención, el ruido en claridad."

---

### 4. Arquitectura de la Solución

#### Núcleo Único y Subdominios
Una plataforma única con un modelo de datos central, expuesto a través de una API que conecta todas las interfaces. Cada cara del sistema opera en su propio subdominio, con un inicio de sesión compartido.

*   **api:** El núcleo de datos y la lógica de negocio.
*   **app:** Sistema interno de operación, CRM y tableros.
*   **clientes:** Portal donde cada cliente ve su proyecto.
*   **www:** Web pública, configurador y visor 3D.

Una cotización generada en la web pública entra directamente al CRM como una consulta cualificada.



#### Tableros por Rol con Widgets
Cada usuario accede a un tablero personalizado compuesto por widgets reutilizables: indicadores, gráficos, listas de acciones, calendarios y alertas. El widget central es la lista de acciones del día, que es donde el sistema ordena el trabajo.

#### Aplicación Mobile Operativa
Una app enfocada en la captura de datos en origen. Permite a los operarios de fábrica y obra marcar tareas, registrar avances, tomar fotos y controlar la calidad, incluso con conectividad limitada. Esta es la garantía de que los tableros reflejan la realidad.

#### Configurador y Visor 3D
En la web pública, un configurador interactivo para combinar módulos, elegir terminaciones y visualizar la vivienda en 3D en tiempo real.

#### Capa de Inteligencia Artificial
Se incorpora de forma gradual:
1.  **Asistente de Consulta:** Responde preguntas sobre el estado de la operación por rol (ej. "¿Qué proyectos están atrasados?").
2.  **Funciones Predictivas:** Anticipa riesgos de atraso, sobrecoste o quiebre de stock.
3.  **Acciones Asistidas:** Sugiere y prepara acciones (ej. "Crear orden de compra para materiales X") con aprobación humana.
4.  **Asistente Multicanal:** Atiende consultas a través de WhatsApp y redes sociales.

#### Tecnología
*   **Base de Datos:** Relacional como núcleo de datos.
*   **Backend:** Modular para la lógica de negocio.
*   **IA:** Servicio dedicado en Python.
*   **Frontend:** Aplicaciones web para operación, portal y configurador.
*   **Mobile:** App con soporte offline.
*   **Infraestructura:** En la nube con entornos separados de desarrollo y producción.

---

### 5. Fases del Proyecto

El proyecto se estructura en fases, cada una de las cuales entrega valor por sí misma.

**Fase 0 — Relevamiento y Arquitectura**
Mapeo de procesos, definición del modelo de datos, roles, permisos y la arquitectura técnica. Se entrega la base para que el resto del proyecto sea previsible.

**Fase 1 — MVP Núcleo Operativo**
El corazón del sistema, ya utilizable para la operación real:
*   Gestión de proyectos con presupuesto, tareas y avance.
*   Registro de costos y cobros.
*   Rentabilidad por proyecto en vivo.
*   Tablero de acciones por rol y motor de widgets.
*   Versiones básicas del CRM y portal del cliente.

**Fase 2 — Vitta Fábrica y App Mobile**
*   Catálogo de módulos con lista de materiales (BOM).
*   Órdenes de producción, inventario y control de calidad.
*   App mobile para captura de datos en fábrica y obra.

**Fase 3 — Web Pública, Configurador y 3D**
*   Sitio web público con el catálogo de productos.
*   Configurador interactivo de módulos y terminaciones.
*   Visor 3D de la vivienda en tiempo real.

**Fase 4 — IA Agéntica y Predictiva**
*   Asistente de consulta y análisis con recuperación de documentos.
*   Funciones predictivas sobre la operación.
*   Acciones asistidas con aprobación humana.
*   Asistente para WhatsApp y redes sociales.

---

### 6. Entorno del Sistema y Flujo de Trabajo

#### Modelo de Entidades (Diagrama Conceptual)

#### Flujo de Datos e Información

---

### 7. Alcance: Qué Incluye y Qué No

**Incluye:**
*   Desarrollo completo del sistema según las fases descritas.
*   Arquitectura, modelo de datos y documentación.
*   Tableros de gestión personalizables.
*   Aplicación mobile para captura de datos en origen.
*   Configurador y visor 3D para la web pública.
*   Capa de inteligencia artificial con las funcionalidades descritas.
*   Capacitación y manuales de usuario para cada fase.

**No Incluye (Gestionado por el Cliente):**
*   Costes de infraestructura en la nube (hosting, base de datos, almacenamiento).
*   Costes de APIs de terceros (modelos de IA, mensajería, etc.).
*   Adquisición de dominios y certificados SSL.
*   Integraciones con sistemas contables o de pago externos (definidas en Fase 0).

---

