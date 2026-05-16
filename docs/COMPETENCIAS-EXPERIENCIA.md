# Competencias & Experiencia — Portfolio técnico

> Documento de referencia para postulaciones. Basado en proyectos reales entregados en producción.
> No es un CV — es la materia prima para construir respuestas a preguntas de entrevista.

---

## Stack general

**Frontend:** React (2017→presente), Vue.js, Next.js, TypeScript, Ionic/Capacitor, Three.js/WebGL, GSAP, Tailwind CSS  
**Backend:** Python (FastAPI, Django), Node.js (NestJS), PHP (Laravel)  
**Bases de datos:** PostgreSQL, MySQL, Redis, Firebase  
**Cloud & DevOps:** GCP, Vercel, Cloudflare, OpenShift RedHat, Docker, GitHub Actions, CI/CD 
**IA/ML:** PyTorch, OpenAI API, embeddings vectoriales, pgvector, VertexIA
**Hardware:** Muse 2 EEG vía BLE, Arduino, señales en tiempo real  

---

## DevOps & Infraestructura — lo que realmente hice

### GCP — Google Cloud Platform
- **Cloud Run (serverless):** deploy de backend FastAPI en contenedor, scaling automático a 0, sin gestión de servidor. Proyecto: Calavera Sur.
- **Cloud Build:** pipeline CI/CD automatizado — push a `main` → build de imagen Docker → deploy a Cloud Run sin intervención manual.
- **Google Cloud Storage (GCS):** almacenamiento de imágenes con acceso público controlado, URLs firmadas para uploads seguros desde el cliente.
- **BigQuery:** consultas analíticas sobre datasets grandes (contexto NDS/Gistech).

### Vercel
- Deploy de múltiples proyectos React/Next.js (Shujman, Lavazza, portfolio Random Lab).
- Configuración de `vercel.json` para rewrites, headers de seguridad y control de caché.
- Edge functions para SSR y respuestas rápidas desde cualquier región.
- Variables de entorno por ambiente (preview / production).

### Cloudflare
- Túnel Cloudflare para exponer servicios locales sin abrir puertos (init-tunner-cloudflare.sh).
- DNS management, SSL automático, proxying de tráfico.

### OpenShift RedHat (NDS — 2021/2024)
- Deploy de aplicaciones Python/Django en contenedores gestionados por OpenShift.
- Trabajo en pipelines de integración continua en entorno enterprise con múltiples equipos.
- Gestión de configuraciones, secretos y rollbacks.

### Docker
- Creación de Dockerfile para todos los servicios backend (Python/FastAPI, Django, NestJS).
- Imágenes multi-stage para reducir tamaño final (build stage separado de runtime).
- `docker-compose` para entornos locales con múltiples servicios orquestados (backend + PostgreSQL + Redis + Nginx).
- Registro de imágenes privado (GCR en GCP, registry interno en OpenShift).
- Rollbacks automáticos: si el healthcheck falla post-deploy, el orquestador vuelve a la imagen anterior sin intervención manual.
- Backups automáticos de volúmenes y bases de datos como parte del ciclo de vida del contenedor.
- Sistema de alertas integrado: errores en contenedores disparan notificaciones en tiempo real vía webhooks.

### GitHub Actions
- Workflows de CI para lint, tests y deploy automático.
- Secrets management para credenciales de GCP y variables de entorno sensibles.

### Nginx
- Configuración de proxy inverso para servicios backend.
- Headers de seguridad, rate limiting básico, SSL termination.

### Redis
- Caché de rutas GPS procesadas en Hub City Guides (consultas que tardaban segundos → milisegundos).
- Gestión de TTL según frecuencia de actualización de datos.

---

## Proyectos — enfoque en ingeniería real

### ADA — Plataforma EEG en tiempo real (2025)
*Random Lab · 2025 · Proyecto propio*

**Descripción de tu experiencia**  
Sistema end-to-end que conecta hardware físico (Muse 2 EEG vía BLE) con visualización 3D en tiempo real, combinando neurociencia, IA y diseño de experiencia de usuario.

**Contexto**  
Proyecto de investigación aplicada dentro de Random Lab. Cliente final: usuarios interesados en meditación y biofeedback neurológico. El dispositivo Muse 2 captura señales EEG de 4 canales que deben procesarse y visualizarse en tiempo real con latencia mínima.

**Mi meta**  
Construir una plataforma donde cualquier persona pudiera ver su actividad cerebral en 3D mientras medita, sin necesidad de conocimientos técnicos. El objetivo técnico: latencia <100ms desde señal EEG hasta render visual.

**Tareas completadas**
- Integración BLE con Muse 2: conexión estable, manejo de dropout, protocolo de calibración (calidad de señal → parpadeos → baseline alpha)
- Pipeline de procesamiento EEG en Python/FastAPI con PyTorch VAE entrenado sobre dataset PhysioNet
- Visualización 3D en Three.js con sistema de partículas mapeado al espacio latente del modelo
- Copiloto ADA con arquitectura dual: capa rule-based (sin latencia) + capa LLM (análisis cada 30s)
- WebSockets para sincronización en tiempo real entre backend y frontend
- Deploy: frontend en Vercel, backend via Cloudflare Tunnel, GitHub Actions para CI

**Resultados**  
- Latencia end-to-end <100ms conseguida en producción
- Sistema de calibración con tasa de éxito >90% en primeras sesiones
- Copiloto operativo con dos modelos intercambiables (GPT-4o / Claude) sin cambios en frontend
- Base técnica para futura investigación de coherencia neuronal y estados meditativos

**Entorno técnico**  
React 19, Three.js, WebGL, Python/FastAPI, PyTorch, WebSockets, PostgreSQL, pgvector, OpenAI API, Vercel, Cloudflare, GitHub Actions, Docker

---

### Calavera Sur — Búsqueda visual con IA (2025)
*Calavera Sur · 2025 · Cliente externo*

**Descripción de tu experiencia**  
Pipeline de ingesta y búsqueda semántica de imágenes textiles usando embeddings vectoriales e IA, con infraestructura serverless en GCP.

**Contexto**  
Empresa de indumentaria con un archivo de miles de diseños sin sistema de búsqueda por estética. El equipo de diseño perdía horas buscando referencias manualmente. La búsqueda por texto clásico no capturaba conceptos visuales como "estilo navy" o "patrón geométrico minimalista".

**Mi meta**  
Permitir búsqueda semántica por imagen o texto que entienda la estética, no solo palabras clave. Infraestructura serverless que escale a 0 en horas sin tráfico para reducir costos.

**Tareas completadas**
- Diseño e implementación del pipeline ETL: ingesta de imágenes → generación de embeddings (OpenAI text-embedding-ada-002) → almacenamiento vectorial en pgvector
- API REST en FastAPI + SQLAlchemy 2.0 para búsqueda por similitud (cosine distance)
- Almacenamiento de imágenes en GCS con URLs firmadas para acceso seguro
- CI/CD con Cloud Build: push → build → push GCR → deploy Cloud Run (0 clicks manuales)
- Blue-Green deployment: tráfico migrado progresivamente, rollback instantáneo si healthcheck falla
- Tests automatizados como gate en pipeline: deploy bloqueado si tests fallan
- Backups automáticos de PostgreSQL con restauraciones testeadas periódicamente
- Alertas en tiempo real vía webhook ante fallos de deploy

**Resultados**  
- Tiempo de búsqueda <500ms en producción serverless
- 0 downtime en deploys gracias a blue-green
- Reducción significativa del tiempo de búsqueda de referencias para el equipo de diseño
- Costos de infraestructura optimizados: Cloud Run escala a 0 fuera de horario laboral

**Entorno técnico**  
Python/FastAPI, SQLAlchemy 2.0, PostgreSQL + pgvector, OpenAI API, GCP Cloud Run, Cloud Build, GCS (Google Cloud Storage), Docker (multi-stage), GitHub Actions

---

### Hub City Guides — Marketplace B2B + Geotracking (2024)
*Hub City Guides · 2024 · Cliente externo*

**Descripción de tu experiencia**  
Marketplace B2B que conecta guías turísticos con tour operadores, con sistema de tracking GPS procesado en tiempo real para verificación de tours realizados.

**Contexto**  
Empresa de turismo con operaciones en múltiples ciudades. El problema: las agencias no tenían forma de verificar que los tours se realizaron correctamente, ni métricas de ruta (distancia real, paradas, duración). Los guías gestionaban todo por WhatsApp. El GPS raw del móvil llega con ruido, deriva y saltos — inutilizable directamente.

**Mi meta**  
Construir una plataforma donde guías y operadores pudieran gestionar tours end-to-end, con tracking GPS procesado automáticamente que generara rutas limpias y métricas verificables. Dos clientes distintos (web para operadores, mobile para guías) sobre la misma infraestructura.

**Tareas completadas**
- Web app en Vue.js para tour operadores: gestión de tours, asignaciones, calendario, métricas
- App mobile en Ionic/Capacitor para guías: tours disponibles, aplicación, tracking GPS en vivo
- Chat en tiempo real con Firebase entre guías y operadores
- Pipeline de procesamiento GPS en Python/FastAPI: filtro de Kalman, map-matching, DBSCAN clustering, Haversine
- Bull queues para procesamiento GPS asíncrono sin bloquear la API principal
- Redis para caché de rutas procesadas
- Docker con `Dockerfile` independiente por microservicio, `docker-compose` para entorno local
- Tests automatizados en CI antes de cada deploy
- Sistema de monitoreo con alertas ante caída de servicios o latencia elevada

**Resultados**  
- Rutas GPS limpias con >95% de precisión vs GPS raw inutilizable
- Consultas de ruta: de segundos a milisegundos gracias a caché Redis
- Operadores con visibilidad completa y verificable de cada tour realizado
- App mobile funcionando en iOS y Android desde un único codebase

**Entorno técnico**  
Vue.js, Ionic/Capacitor, NestJS, Python/FastAPI, PostgreSQL, Redis, Firebase, Docker, docker-compose, Bull queues, GitHub Actions CI

---

### NDS Tech — Business Intelligence & IA industrial (2021–2024)
*NDS Tech · 2021–2024 · 3 años · Cliente: Ford (planta de ensamblaje)*

**Descripción de tu experiencia**  
Desarrollo de plataforma de Business Intelligence e implementaciones de IA para detección predictiva de fallas en la línea de ensamblaje de Ford, sobre infraestructura Kubernetes en OpenShift RedHat.

**Contexto**  
Planta de ensamblaje automotriz con múltiples líneas de producción. La detección de fallas era reactiva — la maquinaria fallaba en producción causando paradas no planificadas. Los datos de los sistemas de control estaban en silos sin visibilidad unificada. Entorno enterprise con 0 tolerancia a downtime y requisitos de seguridad estrictos.

**Mi meta**  
Pasar de detección reactiva a predictiva: que el sistema identifique una anomalía antes de que se convierta en falla. Construir dashboards en tiempo real que consolidaran datos de producción dispersos. Infraestructura robusta sobre Kubernetes con seguridad enterprise.

**Tareas completadas**
- Plataforma BI con dashboards en tiempo real para métricas de producción de la planta
- Modelo de IA para detección de fallas por sonido: entrenamiento sobre audio de maquinaria, alertas preventivas antes de falla total
- Modelo 3D del sistema eléctrico completo de la planta + ML sobre históricos para anticipar puntos de fallo eléctrico
- Kubernetes: orquestación de servicios en pods, réplicas, liveness/readiness probes, escalamiento horizontal automático
- Tekton Pipelines: CI/CD nativo en Kubernetes (build → test → staging → aprobación → producción)
- OpenShift RedHat: RBAC, secretos cifrados, cuotas de recursos por namespace, registry privado
- Seguridad: network policies entre namespaces, TLS interno, escaneo de imágenes Docker pre-deploy
- Nginx: load balancing entre pods, rate limiting, HSTS, CSP
- Tests E2E con Selenium integrados en pipeline como gate de deploy
- Backups automáticos con restauraciones periódicas testeadas
- Gestión SCRUM: sprints de 2 semanas, KPIs semanales de velocity, sprint reviews con demo en vivo al cliente, toma de requerimientos con stakeholders de Ford, Jira + Confluence

**Resultados**  
- Reducción de paradas no planificadas gracias a detección predictiva por sonido
- Visibilidad unificada de producción en tiempo real para mandos medios y dirección
- 0 downtime en releases gracias a pipeline Kubernetes con rollback automático
- Cobertura E2E con Selenium bloqueando deploys con regresiones antes de llegar a producción

**Entorno técnico**  
Python/Django, React.js, GCP, OpenShift RedHat, Kubernetes, Tekton Pipelines, Docker, Nginx, Selenium, Jira, Confluence, SCRUM

---

### MISIA — E-commerce de productos custom (2018)
*MISIA Fashion · 2018 · Cliente externo*

**Descripción de tu experiencia**  
Plataforma de e-commerce con customización total de indumentaria: el usuario configura su prenda desde cero y ve el resultado renderizado en tiempo real antes de comprar.

**Contexto**  
Marca de indumentaria local que quería diferenciarse del e-commerce estándar. Cada prenda es única: el cliente elige tela, color, talle y corte. El sistema debía calcular precios dinámicamente según la combinación, generar un SKU único por pedido, y gestionar el inventario de materiales base — no de productos terminados.

**Mi meta**  
Construir una experiencia de compra donde el usuario sea co-creador del producto, con lógica de negocio robusta detrás que manejara la complejidad de inventario y precios variables.

**Tareas completadas**
- Frontend React con configurador visual en tiempo real — preview instantáneo al cambiar opciones
- Backend Laravel (PHP) con API REST para opciones configurables por categoría
- Generación dinámica de SKUs únicos por combinación de opciones
- Cálculo de precios en tiempo real según materiales seleccionados
- Gestión de inventario de materiales base (no stock de productos terminados)
- Integración de pagos con Stripe (checkout, webhooks, manejo de errores)
- Panel de administración para gestionar opciones disponibles por categoría
- Deploy con Docker, `Dockerfile` para backend Laravel, backups de MySQL automatizados

**Resultados**  
- Plataforma en producción con transacciones reales desde lanzamiento
- 0 errores críticos en checkout en producción — aprendí aquí que la robustez no es opcional cuando hay dinero de por medio
- Experiencia de compra diferenciada: cada pedido es único

**Entorno técnico**  
React, Laravel (PHP), MySQL, Stripe API, Docker, scripts shell de deploy

---

### CENIT — Plataforma educativa (2018)
*Instituto CENIT · 2018 · Cliente externo*

**Descripción de tu experiencia**  
Plataforma LMS (Learning Management System) para capacitación en informática, con tracking de progreso por estudiante y sistema de certificaciones.

**Contexto**  
Instituto de formación IT que necesitaba digitalizar sus cursos y certificar a sus estudiantes con evidencia de progreso real, no solo asistencia. Los docentes requerían visibilidad sobre el avance de cada alumno por módulo.

**Mi meta**  
Construir una plataforma educativa que rastreara el progreso individual, emitiera certificaciones verificables y diera herramientas al docente para gestionar su aula digitalmente.

**Tareas completadas**
- Frontend React con interfaz diferenciada por rol (admin / docente / estudiante)
- Backend Django con gestión de usuarios, roles, módulos, lecciones y progreso
- Sistema de tracking de avance: qué módulos completó cada estudiante, tiempo dedicado, puntos de bloqueo
- Sistema de certificaciones con validación de requisitos completados
- Panel de administración para gestión de cursos, usuarios y reportes
- PostgreSQL con modelo de datos normalizado para historial de aprendizaje

**Resultados**  
- Plataforma con usuarios reales en producción desde lanzamiento
- Primer proyecto con gestión de roles y permisos complejos en producción
- Base técnica que consolidó el patrón de arquitectura usado en proyectos posteriores

**Entorno técnico**  
React, Django (Python), PostgreSQL, Docker

---

## Competencias blandas — las que importan en entrevista

**Autonomía real:** la mayoría de estos proyectos los llevé end-to-end — desde la reunión con el cliente hasta el deploy en producción. No hay un "lo mandé a otro lado" en mi historia.

**Gestión de equipos y ciclo de vida completo:** en NDS, Hub City Guides y Somos404 lideré equipos de desarrollo con metodología SCRUM — planificación de sprints, asignación de tareas, seguimiento de KPIs semanales (velocity, story points completados vs estimados, bugs abiertos/cerrados). Presenté sprint reviews al cliente con demo en vivo del incremento. Tomé requerimientos directamente con stakeholders, los traduje a historias de usuario, los prioricé con el PO y los derivé al equipo con criterio técnico. El ciclo completo: discovery → planificación → desarrollo → QA → deploy → retrospectiva.

**Criterio técnico:** cuando algo se puede hacer simple, lo hago simple. La arquitectura de doble capa en ADA (rule-based + LLM) no fue capricho — fue la respuesta correcta al problema de latencia. En NDS, elegir Kubernetes sobre deploy manual fue la decisión correcta para un cliente con 0 tolerancia a downtime.

**Documentación:** todos los proyectos tienen READMEs, arquitectura documentada, y decisiones técnicas explicadas. En NDS era obligatorio (Confluence) y lo hice bien. En proyectos propios lo hago igual — porque sé que mi yo del futuro o un nuevo compañero lo va a necesitar.

**Uso de IA en flujo de trabajo:** Claude y Copilot son parte de mi stack diario. Los uso para generación, revisión y refactorización — pero con criterio propio para validar el output. No uso ciego.

---

## Frases de entrevista que funcionan

> *"Trabajo mejor cuando entiendo el problema de negocio detrás del ticket técnico."*

> *"En producción aprendí que la robustez no es un extra — es el producto."*

> *"Prefiero un sistema simple que funcione siempre a uno elegante que falle bajo carga."*

> *"El DevOps no empieza cuando el código está listo — empieza en el diseño de la arquitectura."*
