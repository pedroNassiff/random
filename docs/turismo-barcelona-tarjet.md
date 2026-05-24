# Audit Express — Target List: Turismo Barcelona

> **Random Lab** · Investigación comercial · Capas A + B + C
> Versión 0.1 · Owner: Pedro
> Status: Investigación pre-cualificación

---

## 1. Contexto del vertical

### 1.1 Por qué turismo Barcelona

Barcelona es uno de los destinos urbanos más visitados de Europa (~12M turistas/año pre-pandemia, recuperados a niveles 2019 desde 2023). El vertical reúne las **tres condiciones del cliente ideal** para Audit Express:

1. **Web revenue-critical**: ticketing online es el canal principal de venta para la mayoría de operadores tier 2-3. Una caída de 30 min en agosto = miles de € perdidos.
2. **Tráfico suficiente**: la mayoría de los targets reciben entre 50k y 500k visitas/mes, magnitud donde los findings cuantificables en € tienen peso comercial.
3. **Compliance creciente**: turistas internacionales = RGPD aplicable; B2C = EAA obligatorio desde 28-jun-2025; muchos targets tienen contratos con Ayuntamiento/Generalitat = ENS aplicable.

### 1.2 Ventaja competitiva de Random Lab en este vertical

- Pedro ya construyó HCG, conoce el lenguaje del sector (tour operators, guías, ticketing, multi-idioma, recurrencia, estacionalidad).
- Casos de uso reales para presentar: GPS tracking, Stripe Connect marketplaces, route processing, multi-idioma con hreflang.
- Red de contactos vía HCG: tour operators y guías profesionales son intros naturales hacia museos y atracciones (combos tour+entrada).
- Capacidad de discurso en catalán, español e inglés (relevante en compliance institucional catalán).

### 1.3 Anti-targets en el vertical (NO perseguir en MVP)

- **Iconos top con equipos enterprise**: Sagrada Familia, Park Güell, Casa Batlló, Casa Milà, FC Barcelona/Camp Nou. Tienen partners tipo Indra, NTT Data, GMV. Ciclo RFP 9-12 meses. **Volver acá cuando haya 3-5 casos de éxito tier 2-3.**
- **OTAs globales**: Tiqets, Civitatis, GetYourGuide, Hellotickets, Musement, Headout. Equipos técnicos de 30+ devs, no necesitan auditoría externa.
- **Cadenas hoteleras grandes**: NH, Meliá, Catalonia full-corporate, Barceló corporate. Compras centralizadas en Madrid.

---

## 2. Capa A — Monumentos y museos tier 2

**Perfil común**: institución cultural mediana o fundación privada, web propio con ticketing, multi-idioma ES/CA/EN/FR, equipo técnico de 0-3 personas in-house (más a menudo subcontratado a agencia digital local), presión creciente por compliance y por ofrecer experiencia digital decente.

**Pain points típicos del segmento**:
- Plataformas de ticketing heredadas (algunas con CMS propios, otras con WordPress + plugin de e-commerce)
- Multi-idioma mal implementado (hreflang ausente o roto)
- Performance pobre por imágenes patrimoniales en alta resolución sin optimizar
- Cookie banners pre-RGPD que no cumplen con la guía actual de AEPD
- Accesibilidad (a11y) muy floja, lo cual es **especialmente crítico** desde EAA vigente
- Compliance ENS dudoso pese a tener contratos con administración

### 2.1 Lista de targets

| # | Nombre | Tipo | Ticketing online | Notas comerciales |
|---|---|---|---|---|
| A1 | Palau de la Música Catalana | Auditorio patrimonial | Sí, venta directa | Patrimonio UNESCO, alto volumen turístico, multi-evento (conciertos + tours) |
| A2 | Hospital de Sant Pau (Recinte Modernista) | Patrimonio modernista | Sí | UNESCO, fundación, audiotours, multi-idioma intensivo |
| A3 | Museu Picasso de Barcelona | Museo municipal | Sí, web propia | Alta demanda internacional, multi-idioma |
| A4 | Fundació Joan Miró | Fundación privada | Sí, e-commerce propio | Tienda física y digital, alta circulación |
| A5 | MACBA | Museo arte contemporáneo | Sí | Exposiciones rotativas, suscripciones |
| A6 | CCCB | Centro de Cultura Contemporània | Sí | Eventos múltiples, cine, festivales |
| A7 | CaixaForum Barcelona | Centro cultural Fundación La Caixa | Sí | **Cuidado**: corporativo La Caixa = decisión centralizada, validar antes de invertir tiempo |
| A8 | MNAC | Museu Nacional d'Art de Catalunya | Sí | Gran volumen, multi-idioma, institución pública catalana |
| A9 | Fundació Antoni Tàpies | Fundación privada | Sí | Volumen medio, ticket digital |
| A10 | Museu Marítim de Barcelona | Museo histórico municipal | Sí | Ticketing + alquiler espacios + barco Santa Eulàlia |
| A11 | Museu Egipci de Barcelona | Museo privado (Fundació Arqueològica Clos) | Sí | Privado, decisión más rápida |
| A12 | MUHBA (Museu d'Història de Barcelona) | Red de sites municipales (8 sedes) | Sí | Multi-site con ticketing combinado, complejidad técnica obvia |
| A13 | CosmoCaixa | Museo de ciencia Fundación La Caixa | Sí | Idem A7, validar decisión central |
| A14 | Museu del Disseny de Barcelona | Museo municipal | Sí | Museo + biblioteca + tienda |
| A15 | Museu Frederic Marès | Museo municipal | Sí | Volumen más bajo, ticket más chico |
| A16 | Museu de la Música de Barcelona | Museo municipal (dentro de L'Auditori) | Sí | Volumen medio |
| A17 | Reial Acadèmia de Ciències i Arts de Barcelona | Histórico | Reservas guiadas | Ticket pequeño pero acceso fácil |
| A18 | Pavelló Mies van der Rohe | Fundación | Sí | Volumen alto turístico, web simple |
| A19 | Palau Güell | Patrimonio | Sí | UNESCO, alta demanda |
| A20 | Reial Cercle Artístic | Privado | Reservas | Volumen menor |

**Prioridad de approach dentro de Capa A**:

- **Alta**: A1, A2, A4, A11, A12, A19 (mix de tráfico alto + decisión razonablemente autónoma + complejidad técnica visible)
- **Media**: A3, A5, A6, A8, A10, A13, A14 (alto tráfico pero potencial dependencia institucional o agencia incumbente)
- **Baja en MVP**: A7, A13 (decisión corporativa La Caixa)

---

## 3. Capa B — Operadores y plataformas de tours / tickets locales

**Perfil común**: empresa privada mediana (10-100 empleados), revenue 100% dependiente del canal digital, fuerte estacionalidad (junio-septiembre), competencia feroz con OTAs globales en SEO, márgenes apretados que hacen que cada punto de conversión y cada € de bandwidth importen.

**Pain points típicos del segmento**:
- Stripe / payment gateway mal optimizado (formularios largos, sin Apple/Google Pay)
- Performance mobile muy mala (su tráfico es 70%+ móvil de turistas en la calle)
- Tracking pixels múltiples (Meta, Google, TikTok) cargados sin control de consent
- Stack tecnológico heterogéneo por crecimiento rápido (WordPress + custom + Shopify a veces conviviendo)
- Multi-idioma con cantidad variable (algunos 8+ idiomas), frecuentemente mal técnicamente
- APIs de booking de terceros (Bokun, FareHarbor, Rezdy) integradas con loops o sin caching
- SEO técnico flojo compitiendo contra OTAs con equipos dedicados

### 3.1 Lista de targets

| # | Nombre | Tipo | Tamaño aprox | Notas comerciales |
|---|---|---|---|---|
| B1 | Barcelona Bus Turístic | Hop-on/hop-off oficial (TMB) | Mediana | Operado por TMB municipal, posible decisión vía Ayuntamiento |
| B2 | City Sightseeing Barcelona | Hop-on/hop-off privado | Mediana | Franquicia global, decisión local pero con framework corporativo |
| B3 | Julià Travel | Operador de tours histórico | Mediana | Multi-producto: tours, transfers, day trips |
| B4 | Catalunya Bus Turístic | Day trips fuera de Barcelona | Pequeña-mediana | Producto específico, web propio |
| B5 | Barceló Experiences | Brand de tours del grupo Barceló | Mediana | Decisión Barceló corporate, validar autonomía |
| B6 | BCN Tickets | Agregador de tickets local | Pequeña | Comparable a OTAs locales, alta dependencia digital |
| B7 | Barcelona Pass / Barcelona City Pass | Pase turístico agregado | Pequeña | Producto digital puro |
| B8 | Aborigen Barcelona | Tours pequeño grupo | Pequeña | Boutique, decisión rápida, ticket más chico |
| B9 | Runner Bean Tours | Free walking tours | Pequeña | Modelo de propina, monetización vía tours pagos premium |
| B10 | Castros Free Walking Tours | Free walking tours | Pequeña | Similar a B9 |
| B11 | Devour Tours | Food tours premium | Mediana | Brand internacional, fuerte en SEO de food tourism |
| B12 | Wanderbeak Tours | Food tours | Pequeña | Boutique gastronómico |
| B13 | Barcelona Eat Local Food Tours | Food tours | Pequeña | Local, decisión rápida |
| B14 | ForeverBarcelona | Tours culturales | Pequeña | Volumen medio |
| B15 | Barcelona Slow Travel | Tours premium experienciales | Pequeña | Nicho premium |
| B16 | My Favourite Things | Tours boutique de lujo | Pequeña | Nicho premium, decisión rápida |
| B17 | Spanish Trails | Day tours desde Barcelona | Pequeña | Decisión rápida |
| B18 | Barcelona Wine Tasting | Experiencias de vino | Pequeña | Nicho gastronómico |
| B19 | Cook & Taste | Cooking classes turísticas | Pequeña | Cooking school + tours mercado |
| B20 | BCN Kitchen | Cooking classes | Pequeña | Similar B19 |
| B21 | Espai Boisà | Cooking classes premium | Pequeña | Premium |
| B22 | Tablao Cordobés | Show flamenco con ticketing | Mediana | Histórico, alto volumen turístico |
| B23 | Palacio del Flamenco | Show flamenco | Mediana | Idem B22 |
| B24 | City Hall Flamenco | Show flamenco | Mediana | Volumen alto |
| B25 | Welcome Pickups Barcelona | Transfers aeropuerto premium | Mediana | Brand internacional con presencia local |

**Prioridad de approach dentro de Capa B**:

- **Alta**: B3, B11, B22, B23, B24 (volumen alto + decisión local + ticket razonable)
- **Media**: B4, B6, B8, B14, B15, B16, B17, B19, B20, B21 (decisión rápida pero ticket más chico)
- **Validar antes**: B1, B2, B5 (dependencia corporativa/municipal)
- **Baja en MVP**: B9, B10, B12, B18, B25 (ticket muy chico o brand internacional)

---

## 4. Capa C — Atracciones y experiencias

**Perfil común**: atracción turística con web propio, ticketing online importante, en muchos casos con app mobile complementaria, mezcla de operación pública/concesión privada/100% privada.

**Pain points típicos del segmento**:
- Picos de tráfico estacionales que tumban la web (Black Friday, vacaciones escolares, verano)
- Apps mobile con backend que se carga del mismo origen que la web (sin separación)
- Sistemas de aforo y reserva por franjas que generan APIs muy chatty desde el frontend
- Photo galleries pesadas (atracciones venden imagen)
- Combos con otros productos (entrada + audioguía + foto recuerdo) que multiplican el flow de checkout

### 4.1 Lista de targets

| # | Nombre | Tipo | Operación | Notas comerciales |
|---|---|---|---|---|
| C1 | L'Aquàrium de Barcelona | Acuario | Aspro Parks (privado) | Volumen muy alto, grupo Aspro decide centralizado pero hay autonomía local técnica |
| C2 | Parc d'Atraccions Tibidabo | Parque atracciones histórico | Municipal | Volumen alto, web propio, decisión municipal con tiempos |
| C3 | Poble Espanyol | Pueblo replica + eventos | Privado | Eventos múltiples, multi-producto |
| C4 | Zoo de Barcelona | Zoológico | Municipal (B:SM) | Volumen alto, decisión vía B:SM municipal |
| C5 | Big Fun Museum Barcelona | Atracción foto-experiencial | Privado | Brand nuevo, web reciente pero crecimiento explosivo |
| C6 | Museum of Illusions Barcelona | Franquicia internacional | Privado franquicia | Decisión local con framework corporativo |
| C7 | Mundo Ilusión Barcelona | Atracción foto-experiencial | Privado | Comparable a C5 |
| C8 | Catalunya en Miniatura | Parque temático maquetas | Privado | Volumen medio, target rápido |
| C9 | Illa Fantasia | Parque acuático | Privado | Estacional fuerte, ticketing crítico junio-septiembre |
| C10 | Mirador de Colom | Atracción histórica (concesión) | Concesión privada | Volumen medio |
| C11 | Anella Olímpica activities (Estadi Olímpic visitable) | Patrimonio olímpico | Municipal | Volumen medio |
| C12 | Telefèric de Montjuïc | Teleférico | Concesión privada | Volumen alto turístico |
| C13 | Cable Car del Port (Transbordador Aeri) | Teleférico portuario | Concesión | Volumen alto, web histórico flojo (señal pública) |
| C14 | Funicular de Montjuïc | Transporte turístico | TMB | Decisión TMB (similar a B1) |
| C15 | Las Golondrinas del Puerto | Barcos turísticos | Privado | Histórico, volumen alto |
| C16 | Catamarán Orsom | Tour en catamarán | Privado | Premium, volumen estacional |
| C17 | Vall de Núria / Cremallera | Tren turístico Pirineos | FGC | Estacional, web propio, decisión FGC pública |
| C18 | Aerobús Barcelona | Transfer aeropuerto-centro | Concesión privada | Volumen muy alto, web crítico |
| C19 | Bus Turístic Montserrat | Day trip | Privado | Producto digital muy concreto |
| C20 | Wax Museum Barcelona (Museu de Cera) | Museo cera | Privado | Histórico, web posiblemente legacy |

**Prioridad de approach dentro de Capa C**:

- **Alta**: C1, C5, C6, C7, C8, C12, C15, C18, C20 (mix de volumen + decisión privada autónoma + señales de web mejorable)
- **Media**: C3, C9, C13, C16, C19 (decisión rápida pero ticket o estacionalidad limitan)
- **Validar antes**: C2, C4, C11, C14, C17 (operación municipal/pública con tiempos más largos)

---

## 5. Framework de cualificación (los 6 criterios)

Antes de cualquier outreach o de incluir a una empresa en el dataset de un informe agregado, aplicar este framework. Todo lo que se mide acá es **información pública o estimación pública**, sin tocar nada de la infra del target.

| # | Criterio | Fuente | Umbral favorable | Umbral excluyente |
|---|---|---|---|---|
| 1 | **Tráfico estimado** | SimilarWeb / Semrush (versión gratuita o trial) | ≥50k visitas/mes | <30k visitas/mes |
| 2 | **Score security headers** | securityheaders.com | F, D, C (oportunidad) | A+ (sin caso de venta obvio) |
| 3 | **SSL Labs grade** | ssllabs.com/ssltest | B, C o peor | A+ |
| 4 | **Core Web Vitals (PSI)** | PageSpeed Insights (Google, público) | LCP >3s, INP >300ms o CLS >0.25 | Todo en verde |
| 5 | **Stack visible** | Wappalyzer / BuiltWith | CMS o framework con versión expuesta o vieja, jQuery 1.x, etc. | Stack moderno con todo oculto |
| 6 | **Tamaño equipo técnico** | LinkedIn búsqueda por empresa | 1-8 devs in-house | 0 devs (no entienden el informe) o 15+ devs (compiten internamente) |

**Scoring sugerido**:

- 5-6 criterios favorables = **Tier 1 Target** → priorizar para warm intro o contenido LinkedIn personalizado
- 3-4 favorables = **Tier 2 Target** → incluir en informe agregado anonimizado del sector
- 0-2 favorables = **Pasar** o monitorear sin acción

**Importante**: estos seis chequeos son los seis que el Audit Express ejecuta automáticamente en su versión Health Check pública. Construir el script de cualificación es **literalmente construir el MVP del producto**. Doble win.

---

## 6. Patrones generales de pain observados en el sector

Sin nombrar empresas concretas, estos son los patrones que se ven sistemáticamente en este vertical (basado en navegación pública estándar de cualquier usuario):

1. **Cookie banners pre-RGPD-2023**: muchos sitios del sector tienen banners que cumplen con la versión vieja (consent implícito al seguir navegando), no con la guía actual de AEPD que exige rechazo igual de fácil que aceptación.

2. **Trackers cargando antes del consent**: GA4, Meta Pixel, TikTok Pixel, Hotjar disparándose en page load sin opt-in. Riesgo de sanción AEPD documentado y publicado.

3. **Imágenes patrimoniales sin optimizar**: museos y monumentos tienden a usar JPGs en alta resolución (legitimamente bonitas) servidas en formato y tamaño inadecuados para web mobile.

4. **Multi-idioma con hreflang incompleto**: ES/CA/EN suele estar, pero el FR/DE/IT/JA/ZH para turistas internacionales o no existe o tiene cantonalización rota.

5. **Stack heredado expuesto**: headers `X-Powered-By` y `Server` revelando versiones que abren camino a fingerprinting trivial. Versiones de WordPress, Drupal o jQuery públicamente identificables vía Wappalyzer.

6. **Performance mobile fuerte vs desktop**: muchos sitios optimizaron desktop hace años y dejaron mobile rezagado, justo el opuesto del comportamiento real del usuario turista.

7. **Checkout con payment gateways obsoletos**: ausencia de Apple Pay / Google Pay, redirección a páginas de banco intermedias, ausencia de validación inline.

8. **a11y muy floja**: WCAG 2.1 AA en violación clara en la mayoría — contraste, alt text en imágenes patrimoniales, navegación por teclado, ARIA mal usado.

Estos patrones son **el material crudo** del primer post de LinkedIn de Random Lab sobre el vertical. Anonimizado, agregado, defendible.

---

## 7. Estrategia de approach por capa

### 7.1 Capa A (monumentos y museos tier 2)

**Approach preferente: warm intro + autoridad pública**.

- Identificar contactos vía HCG ecosystem: tour operators que venden combos con estos museos suelen tener contacto directo con dirección de marketing o comercial.
- Identificar ex-colegas o conexiones LinkedIn en estas instituciones.
- Asistir a eventos del sector cultural: Nit dels Museus, jornadas profesionales del MUHBA, ICOM Catalunya.
- Para los privados (Museu Egipci, fundaciones), email a dirección con un punto concreto puede funcionar.

**Lo que NO funciona acá**: cold email genérico "encontré problemas en tu web". Estas son instituciones, lo viven como amenaza.

### 7.2 Capa B (operadores y plataformas de tours)

**Approach preferente: inbound vía contenido + outreach personalizado warm**.

- Este es el segmento donde tu LinkedIn content strategy actual tracciona más. Post sobre "los 5 problemas técnicos más comunes en webs de tour operators" → llegan inbound.
- Tu credibilidad HCG es la ventaja diferencial. "Construí la infra de HCG, conozco vuestros problemas mejor que nadie" abre puertas.
- Eventos: South Summit, 4YFN, Travel Massive Barcelona meetups.
- Partnership: agencias de marketing turístico que ya sirven a este segmento pero no auditan infra.

### 7.3 Capa C (atracciones y experiencias)

**Approach preferente: foco en estacionalidad y picos**.

- El pitch fuerte acá: "¿qué pasa si tu web cae el primer fin de semana de agosto?". Genera urgencia real.
- Mejor ventana de contacto: febrero-abril, cuando preparan la temporada. Octubre-noviembre cuando hacen retros del verano.
- Las atracciones franquiciadas (Museum of Illusions, etc.) suelen tener autonomía local en mejoras técnicas pequeñas con presupuesto local.

---

## 8. Plan de acción 60 días

### Semana 1-2: Cualificación masiva
- [ ] Aplicar los 6 criterios a las 65 empresas listadas (A+B+C)
- [ ] Construir spreadsheet con scores
- [ ] Identificar Tier 1 (estimado: 15-20 empresas) y Tier 2 (estimado: 25-30)

### Semana 3-4: Construcción del primer informe agregado
- [ ] Análisis anonimizado del Tier 1+Tier 2 con los 6 criterios
- [ ] Identificar las 5-7 estadísticas más impactantes para el post de LinkedIn
- [ ] Gráficos (porcentajes de incumplimiento por categoría)
- [ ] Drafting del post en LinkedIn + carrousel visual

### Semana 5-6: Publicación + amplificación
- [ ] Publicar primer post agregado en LinkedIn
- [ ] DM personalizado a 10 contactos warm del sector con preview
- [ ] Pedir 3 intros vía HCG ecosystem
- [ ] Asistir a 1-2 eventos sectoriales

### Semana 7-8: Primer Health Check entregado
- [ ] Cerrar al menos 1 Health Check (lead magnet versión completa)
- [ ] Entregarlo en formato profesional con findings + recomendaciones
- [ ] Usarlo como prueba de capacidad para vender Audit Express completo

### Métricas de éxito a 60 días
- 65 empresas cualificadas
- 1 informe agregado publicado con ≥1500 visualizaciones LinkedIn
- ≥5 conversaciones comerciales iniciadas
- ≥1 Health Check entregado
- ≥1 Audit Express en negociación

---

## 9. Notas legales y éticas

### 9.1 Qué SÍ se puede hacer sobre estos targets sin contrato

- Visitar sus webs como un usuario normal
- Medir performance vía herramientas públicas (PSI, SSL Labs, securityheaders.com)
- Consultar registros DNS y CT logs
- Estimar tráfico vía SimilarWeb (información comercial pública)
- Identificar stack vía Wappalyzer
- Verificar cumplimiento de cookie banner navegando en incógnito
- Búsqueda de información pública en LinkedIn y prensa

### 9.2 Qué NO se puede hacer sin contrato firmado

- Escaneo activo de puertos
- Fuzzing de endpoints
- Pruebas de auth, IDOR, SSRF, SQLi, XSS
- Cualquier payload distinto del que un browser haría
- Acceso autenticado (incluso con cuentas propias creadas)
- Stress testing
- Reconocimiento agresivo (subdomain bruteforce activo, etc.)

### 9.3 Framing en outreach

- **Nunca** "encontramos vulnerabilidades en su sistema"
- **Nunca** "su web es insegura"
- **Sí** "analizamos la postura pública de seguridad y performance del sector"
- **Sí** "le compartimos un health check técnico de su web como muestra de capacidad"
- **Sí** "vimos que su LCP es X, contexto del sector es Y, hay caso de optimización"

### 9.4 Privacidad de la propia investigación

- No publicar findings específicos de empresas concretas sin su autorización, ni siquiera "positivos" — puede interpretarse como exposición.
- Informes agregados anónimos: muestra mínima de 15-20 empresas, datos en porcentajes, nunca atribuibles.
- Si una empresa contacta interesada tras el informe agregado, ahí sí se le entrega su análisis específico (porque ella misma se identifica como interesada).

---

## 10. Siguientes pasos

1. **Validar la lista** con vos: ¿hay empresas que falten? ¿alguna a sacar?
2. **Decidir la herramienta de cualificación**: ¿manual con spreadsheet o ya construimos el módulo de Health Check del Audit Express y lo usamos como herramienta interna?
3. **Decidir mensaje del primer post LinkedIn**: ¿qué ángulo? ¿"Análisis técnico del turismo BCN" o algo más específico tipo "Compliance RGPD en el sector cultural barcelonés"?

Mi recomendación: **construir el módulo de Health Check primero (Sprint 1 del spec) y usarlo para cualificar las 65 empresas automáticamente**. Te ahorra 20 horas de trabajo manual, valida el producto sobre datos reales antes de venderlo, y te genera el dataset del informe agregado de regalo. Tres outputs con un solo input.

---

**FIN target list v0.1**