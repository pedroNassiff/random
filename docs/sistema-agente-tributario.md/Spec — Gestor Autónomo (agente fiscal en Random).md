# Spec — Gestor Autónomo (agente fiscal en Random)

Oct 1, 2026 · @Pedro

## Contexto y problema

El módulo existe para que ninguna obligación fiscal vuelva a depender de la memoria de una persona. En 2026, sin gestoría, se acumularon cuatro fallos en nueve meses:

| Fallo | Consecuencia | Qué lo habría evitado |
| --- | --- | --- |
| Fracciones 5 y 6 del aplazamiento del 130 1T sin pagar | Apremio con recargo del 10–20% (895–976 €) | Calendario de deudas con aviso previo |
| 303 2T sin presentar (resultado ≈ 0) | Requerimiento y multa fija de 200 € (art. 198 LGT) | Calendario de obligaciones derivado del censo |
| Numeración de facturas sin control, plantilla pisada | Riesgo en inspección, facturas perdidas | Facturero con serie correlativa e inmutable |
| Menciones legales erróneas ("exenta" en vez de "no sujeta" o "inversión del sujeto pasivo") | Facturas formalmente incorrectas | Plantillas por tipo de operación |

El patrón común: los datos existían (facturas, notificaciones, censo), pero nadie los convertía en fechas, importes y acciones. Ese es el trabajo del módulo.

Caso piloto: Pedro, autónomo desde el 05-12-2025, IAE 763, estimación directa simplificada, clientes en España, UE (Italia) y EE.UU.

## Principios de diseño

Un prompt de "el mejor gestor de España" no hace al agente correcto; lo hacen los datos, el cálculo determinista y las fuentes citadas. Seis reglas no negociables:

1. **El código calcula, el LLM explica.** Toda cifra (casillas del 303, pago del 130, recargos, plazos) sale de funciones puras y testeadas. El agente las invoca como tools y nunca hace aritmética fiscal por su cuenta.
2. **Human-in-the-loop para presentar y pagar.** El sistema prepara borradores y ficheros; la presentación en la Sede la firma el usuario con Cl@ve o certificado. Nada se envía a la AEAT sin confirmación explícita.
3. **Toda afirmación normativa lleva cita.** Artículo, modelo o consulta vinculante, con año de vigencia. Sin fuente recuperada, el agente dice "no lo sé" y escala.
4. **Corpus versionado por ejercicio.** Tipos, tramos RETA, SMI y calendario cambian cada año; cada regla y documento lleva `valid_from` / `valid_to`.
5. **Ledger inmutable como fuente de verdad.** Facturas y movimientos no se editan: se rectifican. Todo lo demás (declaraciones, dashboards) se deriva del ledger.
6. **Avisar antes, no después.** El valor está en el aviso a T−15, T−5 y T−1 días, no en explicar el apremio cuando ya llegó.

## Alcance: módulos

Nueve módulos, todos alimentando un único ledger y un único calendario. El agente es la interfaz conversacional sobre ellos, no un módulo aparte que guarda estado propio.

| Módulo | Qué hace | Entrada | Automatización |
| --- | --- | --- | --- |
| Perfil fiscal | Alta, IAE, régimen IVA/IRPF, ROI, tarifa plana, domicilio | 036/037 (PDF) o formulario | Parseo del 036 y derivación de obligaciones |
| Ledger | Ingresos y gastos clasificados por tipo de operación | Facturero, CSV bancario, tickets | Clasificación sugerida por el agente, confirmada por el usuario |
| Facturero | Emite facturas correlativas con mención legal correcta | Cliente + concepto + importe | Plantilla por tipo de cliente; validación VIES automática |
| Calendario | Todas las fechas: modelos, cuotas RETA, fracciones, requerimientos | Perfil + deudas + notificaciones | Generado, nunca cargado a mano |
| Motor de cálculo | 303, 130, 349, 390, estimación de Renta, cuota RETA, recargos | Ledger + perfil | 100% determinista |
| Bandeja de notificaciones | Ingesta de PDFs de la AEAT, SS y Ayuntamiento | Upload o reenvío de email | Extracción de tipo, importes, plazo y CSV |
| Deudas | Aplazamientos, fracciones, apremios, estado "al corriente" | Notificaciones + pantallas de la Sede | Recalcula plazos y recargos solo |
| Ayudas | Kit Digital, Activa Autòno+, tarifa plana, prórroga | Perfil + estado de deudas | Alerta de elegibilidad y de bloqueos |
| Agente gestor | Responde, explica, prepara borradores, avisa | Todo lo anterior + corpus RAG | Ver sección del agente |

Fuera de alcance en v1: presentación directa a la AEAT por API, conciliación bancaria en tiempo real, contabilidad de sociedades (Barrilete Cósmico S.L. tributa por IS y es otro producto).

## Decisión: facturero, sí

Hace falta facturero, no solo un registro de "cuánto entró en el mes". El 303 y el 130 no se calculan con el total cobrado: necesitan la base por tipo de operación (nacional con IVA, UE con inversión del sujeto pasivo, fuera de la UE no sujeta), la fecha de devengo y las retenciones. Y dos de los cuatro fallos de 2026 fueron de facturas (numeración y menciones).

Un ingreso bancario tampoco basta como fuente: el IVA se devenga con la factura, no con el cobro (salvo criterio de caja, que Pedro no tiene). La factura del 29/06 va al 2T aunque se cobre en julio.

**Restricción Verifactu.** Los sistemas informáticos de facturación deben cumplir el reglamento Verifactu desde el 1 de julio de 2027 para autónomos y el 1 de enero de 2027 para sociedades ([RD-ley 15/2025](https://www.infoautonomos.com/blog/verifactu-cuando-es-obligatorio-a-quien-afecta/)). Un facturero propio es un SIF: registro encadenado con hash, inalterabilidad, QR y, en modo VERI\*FACTU, envío de cada registro a la AEAT. Quien lo desarrolla además firma una declaración responsable como productor.

| Opción | Coste | Riesgo | Cuándo elegirla |
| --- | --- | --- | --- |
| A. Facturero propio diseñado "Verifactu-ready" desde el día 1 | Alto (hash, envío, declaración responsable) | Cumplimiento a cargo de Random | Si el módulo se va a vender a otros autónomos |
| B. Facturero propio simple hasta jun-2027, migrar después | Bajo ahora, deuda técnica | Migración forzada con fecha fija | No recomendada: el modelo de datos cambia |
| C. Emitir con un SIF certificado vía API y que Random sea la capa de inteligencia | Bajo | Dependencia de un proveedor | Si es solo para uso propio o el MVP |

**Recomendación:** C para el MVP, con el modelo de datos de A (registro inmutable, serie correlativa, encadenado). Si el producto se abre a terceros, pasar a A con tiempo antes de julio de 2027. Decidir proveedor de SIF es una decisión abierta (ver Riesgos).

Lo que el facturero garantiza en cualquier opción: serie correlativa sin huecos por año, fecha no anterior a la última emitida en la serie, mención legal según el tipo de cliente, validación del VAT en VIES para clientes UE y rectificativas en serie propia.

## Motor de cálculo determinista

Cada cálculo es una función pura `f(ledger, perfil, reglas_del_ejercicio) → resultado + traza`, con tests de regresión contra declaraciones reales ya presentadas (el 303 1T 2026 es el primer caso de test). La traza lista qué facturas y qué regla produjeron cada casilla, y el agente la usa para explicar.

| Cálculo | Fórmula / regla | Fuente |
| --- | --- | --- |
| 303 trimestral | Casillas por tipo de operación (tabla siguiente); resultado negativo → "a compensar" salvo 4T | LIVA, instrucciones del modelo 303 |
| 130 trimestral | 20% × (ingresos − gastos acumulados del año) − retenciones acumuladas − 130 previos; mínimo 0 | LIRPF art. 99, RIRPF arts. 109-110 |
| Exención del 130 | No obligado si ≥ 70% de ingresos del año anterior llevó retención (año de inicio: del trimestre) | RIRPF art. 109.1 |
| 349 | Lista de clientes UE con su base del trimestre | RIVA art. 78 |
| 390 anual | Agregado de los cuatro 303 | Instrucciones 390 |
| Estimación de Renta | Rendimiento neto − gastos de difícil justificación (% del ejercicio) − reducción del 20% por inicio de actividad (primer año con beneficio y el siguiente) | LIRPF arts. 30 y 32.3 |
| Cuota RETA | Tramo por rendimiento neto mensual, menos el 7% de gastos genéricos; tarifa plana y su prórroga | Tabla RETA del año |
| Reserva mensual | Por cada cobro: IVA repercutido + 20% del neto (130) → "no es tuyo" | Derivado |
| Recargo extemporáneo sin requerimiento | 1% + 1% por mes completo hasta 12 meses; después 15% + intereses | LGT art. 27 |
| Recargos de apremio | 5% / 10% / 20% según cuándo se paga el principal | LGT art. 28 |
| Plazo de pago en apremio | Notificado días 1-15 → día 20; días 16-fin → día 5 del mes siguiente; inhábil → siguiente hábil | LGT art. 62.5 |
| Plazo de requerimiento | N días hábiles desde el día siguiente a la notificación, sin sábados, domingos ni festivos | Ley 39/2015 art. 30 |
| Sanción por no presentar sin perjuicio | 200 € con requerimiento, 100 € sin él; −25% por pronto pago | LGT arts. 198 y 188 |

Mapeo del 303 según tipo de cliente:

| Tipo de operación | Casillas 303 | Mención en factura |
| --- | --- | --- |
| Cliente en España | 07 / 08 / 09 (base, 21%, cuota) | IVA 21% + retención IRPF si el cliente es empresario |
| Empresa de la UE con VAT válido | 59 (+ modelo 349) | "Inversión del sujeto pasivo" |
| Empresa fuera de la UE | 120 | "Operación no sujeta, art. 69.Uno.1º LIVA" |
| Gastos con IVA español | 28 / 29 | — |

Las fechas de festivos se cargan por ejercicio: nacionales, de Cataluña y de Barcelona (municipio del domicilio fiscal).

## Calendario y notificaciones

El calendario se genera, nunca se carga a mano: perfil fiscal + deudas + notificaciones abiertas → eventos. Cada evento tiene estado (pendiente, preparado, presentado, pagado) y solo se cierra con el justificante subido.

| Origen | Eventos que genera | Ejemplo 2026 |
| --- | --- | --- |
| Perfil (régimen general IVA, estimación directa) | 303 y 130 trimestrales: 20 abr, 20 jul, 20 oct, 30 ene | 303 + 130 3T → 20/10/2026 |
| Perfil (clientes UE, ROI) | 349 en el trimestre con operaciones UE | 349 3T (Vivicos) → 20/10/2026 |
| Perfil (anual) | 390 (30 ene), Renta (abril a 30 jun) | 390 2026 → 30/01/2027 |
| RETA | Cargo mensual; fin de tarifa plana; plazo de prórroga | Fin del primer año → 05/12/2026 |
| Deudas | Cada fracción y cada plazo de apremio | Apremio fracciones 5 y 6 → 05/10/2026 |
| Notificaciones | Plazo calculado en días hábiles | Requerimiento 303 2T → 10 días hábiles |
| Ayudas | Aperturas de convocatoria y fin de ventanas de elegibilidad | Activa Autòno+: gastos del primer año |

**Avisos:** T−15 días (preparar datos), T−5 (borrador listo para revisar), T−1 (último aviso) y día T si sigue abierto. Canales: push en la app, email y opcionalmente Telegram o WhatsApp. Un aviso dice qué, cuánto y el botón a la acción ("303 3T: resultado estimado 0 €, borrador listo, presentar").

**Bandeja de notificaciones.** No hay API pública para que un particular lea su buzón DEHú, así que la ingesta es por dos vías:

1. Reenvío del email de aviso de la DEHú o de la AEAT a una dirección del sistema, que dispara un recordatorio de "abrir notificación".
2. Upload del PDF de la notificación. El agente extrae tipo (apremio, requerimiento, liquidación, resolución de aplazamiento), referencia, importes, CSV y plazo, y crea los eventos.

La fecha de notificación la confirma el usuario, porque de ella cuelgan todos los plazos y el PDF no siempre la trae.

## Agente gestor

El agente corre sobre el cliente de Anthropic ya integrado en Random, con tool use y el RAG existente. Su calidad depende de tres piezas: el system prompt, el corpus y las tools.

**System prompt (núcleo).** Rol: gestor fiscal de autónomos en España, prudente y directo. Reglas:

- Nunca calcula importes: llama a las tools del motor y cita la traza.
- Toda afirmación normativa cita artículo o fuente del corpus con su ejercicio; sin fuente, dice que no lo sabe.
- Ante duda de interpretación (localización de servicios, deducibilidad, sanciones), da las dos lecturas y recomienda consultar a un asesor colegiado.
- Prioriza por fecha y por coste: primero lo que vence antes o lo que más recargo genera.
- Nunca presenta ni paga: prepara y pide confirmación.
- Tono: castellano claro, sin jerga innecesaria, siempre con el siguiente paso concreto.

**Corpus RAG** (chunking por artículo o apartado, metadata de ejercicio y vigencia):

| Bloque | Contenido |
| --- | --- |
| Normativa | LGT, Reglamento General de Recaudación, LIVA y RIVA, LIRPF y RIRPF, RD 1619/2012 de facturación, RD 1007/2023 (Verifactu), Ley 39/2015 |
| AEAT práctica | Instrucciones de los modelos 303, 130, 349, 390 y 036; Manual práctico de IVA y de Renta del ejercicio; calendario del contribuyente |
| Doctrina | Consultas vinculantes de la DGT seleccionadas (servicios digitales, localización, gastos del hogar afecto) |
| Seguridad Social | Tabla de tramos RETA, tarifa plana y prórroga, cese de actividad |
| Ayudas | Kit Digital, Activa Autòno+, programas SOC, B·Crèdits, con fechas de convocatoria |
| Documentos propios | Notificaciones, declaraciones presentadas, resoluciones de aplazamiento y facturas del usuario |

**Tools** (function calling; las de escritura requieren confirmación):

| Tool | Tipo | Hace |
| --- | --- | --- |
| `get_profile` / `update_profile` | Lectura / escritura | Perfil fiscal y obligaciones derivadas |
| `query_ledger` | Lectura | Ingresos y gastos por periodo, cliente o tipo |
| `compute_303`, `compute_130`, `compute_349` | Cálculo | Casillas y traza para un periodo |
| `estimate_renta`, `compute_reta_quota` | Cálculo | Proyección anual y cuota por tramo |
| `compute_deadline` | Cálculo | Plazos en días hábiles o reglas de apremio |
| `list_obligations` | Lectura | Calendario con estado |
| `parse_notification` | Extracción | PDF → tipo, importes, plazo, CSV |
| `draft_invoice` | Escritura | Borrador con serie, número y mención correctos |
| `check_vies` | Externa | Valida VAT intracomunitario |
| `export_303_file` | Escritura | Fichero de importación del 303 para la Sede |
| `check_aid_eligibility` | Cálculo | Requisitos de cada ayuda contra el perfil y las deudas |

## Modelo de datos

Siete entidades. `invoice` y `ledger_entry` son append-only: una corrección es una rectificativa o un asiento inverso, nunca un UPDATE.

| Entidad | Campos clave | Notas |
| --- | --- | --- |
| `tax_profile` | nif, fecha\_alta, iae, regimen\_iva, regimen\_irpf, roi, tarifa\_plana\_hasta, domicilio\_fiscal, municipio | Versionado: cada cambio del 036 crea versión nueva |
| `client` | nombre, pais, tax\_id, tipo (es / ue / extra\_ue / particular), vies\_ok, vies\_checked\_at | El tipo decide mención y casilla |
| `invoice` | serie, numero, fecha\_expedicion, fecha\_devengo, client\_id, lineas, base, tipo\_iva, cuota, retencion, mencion\_legal, hash\_prev, hash, estado | Numeración y fecha validadas contra la última de la serie |
| `ledger_entry` | fecha, tipo (ingreso / gasto), operacion, base, iva, retencion, deducible\_pct, invoice\_id, documento\_url | Gastos con afectación parcial (hogar 30% × m²) |
| `obligation` | modelo, ejercicio, periodo, vence, estado, borrador\_id, justificante\_url | Generada desde el perfil |
| `debt` | origen, clave\_liquidacion, fraccion, principal, recargo\_tipo, vence, estado | Una fila por fracción o providencia |
| `notification` | organismo, tipo, referencia, csv, fecha\_notificacion, plazo\_calculado, pdf\_url, debt\_id / obligation\_id | Fecha de notificación confirmada por el usuario |

Dos tablas de reglas aparte del código: `tax_rules` (tipos, porcentajes, tramos RETA, SMI, por ejercicio) y `holidays` (nacional, Cataluña, Barcelona, por año). Cambiar de ejercicio es cargar filas, no desplegar código.

## Fases

La fase 0 se ejecuta a mano esta semana porque los plazos no esperan al software: el MVP no llega antes del 5 y del 20 de octubre.

1. **Fase 0 — Regularizar (ya, manual con el agente en chat).** Pagar o aplazar el apremio antes del 05/10; presentar el 303 2T y contestar el requerimiento; verificar el 130 2T; preparar 303, 130 y 349 del 3T para el 20/10; revisar alta en ROI; renumerar y corregir menciones de facturas 2026.
2. **Fase 1 — MVP (4-6 semanas).** Perfil, ledger con carga manual y CSV, calendario generado con avisos, motor 303/130/349 con tests contra el 303 1T real, bandeja de notificaciones por upload, agente con corpus de normativa e instrucciones. Criterio de salida: el 303, 130 y 349 del 4T (enero 2027) salen del sistema y coinciden con el cálculo manual.
3. **Fase 2 — Facturero y deudas (6-8 semanas).** Emisión vía SIF certificado (opción C), plantillas por tipo de cliente, VIES, módulo de deudas y apremios, reserva mensual de IVA e IRPF. Criterio de salida: 390 2026 y borrador de Renta 2026 generados desde el ledger.
4. **Fase 3 — Automatización (2027).** Import bancario por agregador PSD2, clasificación automática de gastos, fichero de importación del 303, módulo de ayudas, Verifactu propio si el producto se abre a terceros antes de julio de 2027.

## Posicionamiento y roadmap (análisis del 01/10/2026)

Comparado con TaxDown y Taxfix a partir de sus páginas públicas (no de sus términos ni del producto en uso). Las dos son gestorías con software: un asesor presenta por el cliente como Colaborador Social de la AEAT, por 30–100 € al mes más IVA.

| | TaxDown | Taxfix | Random |
| --- | --- | --- | --- |
| Presenta en nombre del usuario | Sí | Sí | No: prepara y el usuario firma con Cl@ve |
| Deudas, fracciones, apremios | No lo menciona | No lo menciona | Módulo central |
| Trimestres atrasados y expedientes previos al alta | No lo menciona | Excluidos expresamente | Modo "ponerme al día" |
| Notificaciones (PDF → plazo y acción) | Requerimientos, solo plan caro | Cartas e inspecciones, solo plan de 99,90 € | Bandeja de notificaciones |
| Traza de cada cifra | No | No | Sí: factura y regla por casilla |
| Carga de datos | Cuestionario y asesor | Cuestionario y asesor | Por documentos, con el agente |
| Facturero Verifactu | No lo menciona | Gratuito y compatible | Vía SIF certificado (opción C) |
| Gastos | Escáner con tope mensual | Escaneo ilimitado y banco | Lectura de documentos y, después, banco |

**Qué replicamos** (ya lo hacen bien y el usuario lo espera): lectura de tickets y facturas de gasto, importación bancaria, previsión de impuestos en tiempo real, borrador listo para aprobar en un paso, facturero compatible con Verifactu.

**Dónde diferenciamos** (no lo resuelven): deudas y plazos con aviso previo, regularización de atrasos, bandeja de notificaciones, traza y fuente de cada cifra, carga por documentos, ayudas y sus bloqueos.

**Qué no igualamos hoy:** presentar en nombre del usuario (exige ser Colaborador Social) y un asesor colegiado que responda y cubra sanciones.

Orden de construcción desde aquí, que reordena las fases 1 a 3:

1. **Ledger por documentos.** Clientes, facturas emitidas y gastos leídos por el agente desde el PDF o la foto y confirmados por el usuario. Clasificación por tipo de operación.
2. **Motor 303 / 130 / 349 con borrador y traza.** Test de regresión contra el 303 1T 2026 real. Previsión de impuestos por cobro.
3. **Deudas y bandeja de notificaciones** (en paralelo con 2). Fracciones, apremios, recargos, requerimientos; modo "ponerme al día".
4. **Facturero vía SIF certificado**, importación bancaria y ayudas.

Hecho al 01/10/2026: perfil, calendario generado, motor de plazos, agente con propuestas confirmadas por el usuario, carga y almacenamiento de documentos (ver `README.md` de esta carpeta).

## Riesgos y decisiones abiertas

El riesgo mayor no es técnico: es confiar en el agente para algo que nadie revisa. Mientras el motor no tenga un año de declaraciones validadas, cada presentación se contrasta con un asesor o con el cálculo manual.

| Riesgo | Mitigación |
| --- | --- |
| El LLM inventa una regla o un importe | Cálculo solo por tools; citas obligatorias; tests de regresión con declaraciones reales |
| Normativa que cambia a mitad de año | Reglas versionadas por fecha; revisión trimestral del corpus |
| Fecha de notificación mal cargada | Confirmación explícita del usuario; aviso si el PDF y lo cargado no cuadran |
| Responsabilidad si se vende a terceros | Términos claros (herramienta, no asesoría), revisión por un asesor fiscal colegiado, cumplimiento Verifactu y RGPD |
| Datos fiscales sensibles | Cifrado en reposo, sin documentos personales en prompts de logs, retención definida |

Decisiones abiertas:

- [ ] ¿Uso propio o producto para otros autónomos? Cambia la opción del facturero y el nivel de cumplimiento.
- [ ] Proveedor de SIF certificado para la opción C (API, coste, export de datos).
- [ ] ¿Un asesor colegiado como revisor de pago por trimestre durante el primer año del sistema?
- [ ] Canal de avisos prioritario: push, email o mensajería.
- [ ] ¿El agente gestiona también la S.L. (IS, modelo 200, 111, 115) o queda fuera?
