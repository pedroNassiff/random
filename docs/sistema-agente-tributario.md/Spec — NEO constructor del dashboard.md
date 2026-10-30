# Spec — NEO, constructor del dashboard (borrador)

Estado: borrador, 30/10/2026. Reemplaza a la spec "NEO lectura y escritura total".

## Principio

NEO es el constructor del dashboard. Desde el chat crea lo que haga falta en la base de datos, el backend y el
frontend. Lo fiscal es el primer módulo, no el alcance de NEO.

Ninguna escritura pasa sin confirmación humana (de Pedro).

El dashboard es de uso personal: un solo usuario, Pedro. Los módulos nuevos no separan datos por cliente.

## Construir desde producción: builder aislado

Se construye desde el dashboard de producción. NEO de producción conversa, arma la spec y muestra el estado,
pero **nunca ejecuta el código que genera**: eso pasa en un sandbox descartable. Es el patrón de los builders
tipo Lovable o Replit: la app no corre el agente, el código generado es no confiable, y antes de publicar hay
una preview.

```
Dashboard prod ──chat──► NEO (Cloud Run): spec, estado, Aprobar / Descartar
                             │ lanza un build
                             ▼
                   Cloud Run Job neo-builder (una ejecución por pedido)
                   · clona el repo, rama neo/<pedido>, Claude Agent SDK
                   · tests → migración → backend → front → gauntlet (hasta 3 intentos)
                   · push de la rama + PR
                   · service account propia, SIN secretos de producción
                             ▼
                   Preview: Vercel por rama · revisión de Cloud Run con tag y 0% de tráfico
                            · database preview_<pedido> en la misma instancia
                             ▼
                   Aprobar ─► merge por API ─► deploy: backup ─► migraciones ─► servicio
                   Descartar ─► cierra el PR, borra la preview y su base
```

| | Producción (operador) | Builder (constructor) |
| --- | --- | --- |
| Qué hace | Lee datos y propone cambios de datos | Escribe código y migraciones en una rama |
| Base de datos | Cloud SQL con `neo_reader` (solo lectura) | Base de preview del pedido |
| Confirmación | Guardar / Rehacer / Descartar | Aprobar = merge del PR desde el dashboard |
| Secretos de prod | Los del servicio | Ninguno |

El mismo builder corre en local para depurarlo.

### Guardrails (los impone la plataforma, no el prompt)

- `main` protegida: merge solo con el check **Gauntlet** en verde (`.github/workflows/gauntlet.yml`). El token de
  merge de NEO no puede saltarse la protección.
- GitHub App del builder limitada a este repo: contenidos y PRs, **sin** el permiso `workflows`, así que no puede
  tocar `.github/workflows`.
- La federación de GitHub → GCP solo acepta tokens de `refs/heads/main`: un workflow de una rama no puede
  desplegar.
- El botón Aprobar exige la sesión de Pedro y muestra diff, gauntlet y preview antes de confirmar.
- Cada deploy hace un backup bajo demanda de Cloud SQL antes de migrar.
- Las migraciones de un módulo son aditivas. Borrar o renombrar algo con datos exige una confirmación aparte.

## Módulo e instancia

- **Módulo:** una capacidad nueva del dashboard. Lleva tablas, endpoints y páginas, y se construye con código
  (p. ej. "Proyectos").
- **Instancia:** un registro dentro de un módulo que ya existe. Lleva filas, no código (p. ej. el proyecto ITEC).

NEO decide cuál de las dos es cada pedido y lo dice antes de proponer. Si el módulo todavía no existe, propone
primero construir el módulo y después crear la instancia.

```gherkin
Característica: NEO distingue módulo de instancia

  Escenario: El módulo no existe
    Dado que el dashboard no tiene el módulo Proyectos
    Cuando le digo a NEO "creemos el proyecto cliente ITEC"
    Entonces NEO responde que primero hay que construir el módulo Proyectos y después crear ITEC dentro

  Escenario: El módulo ya existe
    Dado que el módulo Proyectos ya existe
    Cuando le digo a NEO "creemos el proyecto cliente Acme"
    Entonces NEO propone una fila nueva en proyectos, sin código
    Y al pulsar Guardar aparece "Acme" bajo Proyectos en el sidebar
```

## Cómo pregunta NEO: propone y pregunta a la vez

NEO no hace un interrogatorio antes de mostrar algo. En cada vuelta:

1. **Propone un borrador concreto:** modelo de datos, pantallas y menú, con lo que ya sabe.
2. **Pregunta solo lo que cambia el borrador**, con opciones y una recomendación.
3. **Agrupa lo que se repite** y lo dice ("pruebas y tests son lo mismo: los junto en uno").

```gherkin
Característica: NEO arma la spec conversando

  Escenario: Pedido con información parcial
    Cuando le digo a NEO "quiero tareas, entregables, notas, pruebas, tests, i+d y prototipos"
    Entonces NEO muestra un borrador de modelo de datos y de pantallas en el mismo mensaje
    Y señala qué junta y por qué (p. ej. pruebas = tests)
    Y hace a lo sumo 3 preguntas, cada una con su opción recomendada

  Escenario: Respuesta a una pregunta
    Cuando contesto una de las preguntas
    Entonces NEO actualiza el borrador y muestra qué cambió

  Escenario: Spec cerrada
    Cuando le digo a NEO que el borrador está bien
    Entonces NEO escribe la spec formal (criterios en Gherkin) del módulo
    Y me la muestra para aprobarla antes de generar código
```

## Construcción

```gherkin
Característica: NEO construye un módulo en el builder aislado

  Escenario: Generar el módulo
    Dado que aprobé la spec del módulo
    Cuando NEO construye
    Entonces trabaja en una rama nueva del repo, nunca en main
    Y escribe primero los tests y después la migración, el backend y el frontend
    Y aplica la migración solo en la base de preview del pedido
    Y corre la gauntlet de cada track que tocó

  Escenario: Revisión
    Cuando la gauntlet pasa
    Entonces NEO me muestra el resumen del diff, el resultado de la gauntlet y el link de la preview
    Y nada llega a main hasta que pulso Aprobar

  Escenario: Aprobar
    Cuando pulso Aprobar con la gauntlet en verde
    Entonces NEO hace el merge del PR
    Y el deploy hace backup, corre las migraciones y despliega
    Y NEO me avisa cuando el módulo está en producción

  Escenario: Descartar
    Cuando pulso Descartar
    Entonces NEO cierra el PR y borra la preview y su base

  Escenario: La gauntlet falla
    Cuando un gate falla
    Entonces NEO corrige y vuelve a correrla
    Y si no lo resuelve en 3 intentos, se detiene y me muestra el error

  Escenario: Límites
    Entonces el builder nunca hace push a main, nunca despliega y no tiene acceso a la base de producción
    Y no toca /infra sin pasar la gauntlet del Track 4
    Y no borra tablas ni columnas con datos sin pedirme confirmación aparte
```

## Producción

```gherkin
Característica: NEO opera sobre los módulos desplegados

  Escenario: Leer cualquier módulo
    Cuando le pregunto a NEO por datos de cualquier módulo desplegado
    Entonces los consulta con el usuario neo_reader (solo SELECT, sin credenciales ni secretos)

  Escenario: Cambiar datos
    Cuando le pido crear, editar o borrar registros
    Entonces NEO genera una propuesta con el antes y el después
    Y se aplica solo si pulso Guardar, pasando por las validaciones del módulo

  Escenario: Cambio que necesita código
    Cuando le pido algo que requiere código nuevo
    Entonces NEO arma la spec conmigo y, cuando la apruebo, lanza el builder
```

## Primer caso: módulo Proyectos (cliente ITEC)

Pedido: tareas, entregables, notas, pruebas, tests, i+d y prototipos. Lo que se repite se junta.

Borrador que NEO debería proponer (sirve como caso de aceptación de la conversación):

- **proyecto:** nombre, cliente, estado (activo, pausado, cerrado), fechas de inicio y fin, descripción.
- **elemento:** un solo tipo de registro con `tipo`, que reemplaza seis listas parecidas:
  - `tarea`, `entregable`, `prueba` (pruebas y tests juntos), `investigacion` (i+d) y `prototipo`.
  - Campos: título, descripción, estado, prioridad, fecha límite, enlace y elemento padre (p. ej. tareas dentro de
    un entregable).
- **nota:** texto libre de un proyecto o de un elemento, con fecha.

Pantallas: sidebar "Proyectos" con un submenú por proyecto (ITEC). Dentro, una vista por tipo de elemento con
filtros por estado, y las notas.

Preguntas que NEO debería hacer junto con el borrador:

1. ¿Los estados son iguales para todos los tipos (pendiente, en curso, hecho) o cada tipo tiene los suyos?
   Recomendado: iguales, con `resultado` (pasó / falló) solo en pruebas.
2. ¿Las pruebas se vinculan a un prototipo o a un entregable? Recomendado: a cualquier elemento, por el padre.
3. ¿Querés registrar horas? Recomendado: no por ahora.

## Lo que ya está hecho y sigue sirviendo

- El resumen del trimestre devuelve el detalle de cada factura con observaciones, y el prompt de NEO le prohíbe
  mandar al usuario a revisar algo que puede consultar él.
- El usuario `neo_reader` (migración fiscal/009, `PgNeoReader`, Terraform del secreto). Hay que ampliarlo a los
  schemas de los módulos nuevos; hoy cubre solo `fiscal`. No está desplegado.

## Implementación por fases

1. **Base:** gauntlet en CI como check obligatorio, protección de `main`, federación solo desde `main`,
   migraciones y backup en el deploy. *(en curso)*
2. **Builder:** Cloud Run Job `neo-builder` con el Agent SDK y la GitHub App; corre la gauntlet y abre el PR.
3. **Preview:** revisión con tag, base de preview y link en el chat.
4. **Aprobar y descartar desde el dashboard.**
5. **Primer módulo construido de punta a punta desde prod:** Proyectos con ITEC.
6. **Operador:** `consultar_bd` sobre todos los schemas y propuestas genéricas de datos.

## Preguntas abiertas

- ¿Los usuarios fiscales que existen hoy (`futbol.app_users`) se mantienen o el dashboard pasa a ser solo de
  Pedro en todo? Afecta a si `fiscal` sigue separando datos por dueño.
