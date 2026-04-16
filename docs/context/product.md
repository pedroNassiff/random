# Skill: /product
# Activar con: `/product` en Claude Code, o pegar al inicio de sesión de decisiones

> Proceso para tomar decisiones de arquitectura y producto con criterio de CTO/consultora.
> Útil para: propuestas a clientes, decisiones de tecnología, diseño de features complejas,
> evaluación de tradeoffs, estimaciones.

---

## Cuándo usar este skill

- Antes de proponer una arquitectura a un cliente
- Cuando hay que elegir entre dos o más enfoques técnicos
- Para dimensionar el esfuerzo de una feature compleja
- Para escribir una propuesta técnica o bolsa de horas
- Para decidir cómo priorizar deuda técnica vs features

---

## Fase 1: Entender el problema real

Antes de proponer soluciones, clarificar:

**¿Cuál es el problema de negocio?** (no el técnico)
→ "El cliente no puede gestionar las disponibilidades de los guías" — no "necesitamos una tabla de disponibilidad"

**¿Cuál es el síntoma vs la causa raíz?**
→ Síntoma: "los bookings fallan a veces"
→ Causa raíz: "no hay lock en las transacciones concurrentes"

**¿Cuál es el impacto si no se resuelve?** (urgencia real)
→ ¿Pérdida de dinero? ¿Fricción de usuario? ¿Deuda técnica acumulando?

**¿Cuál es el constraint real?**
→ Tiempo, presupuesto, equipo, deuda técnica existente, compatibilidad

---

## Fase 2: Generar alternativas

Nunca proponer solo una opción. Siempre mínimo dos, idealmente tres:

```
Opción A — [nombre descriptivo]
  Descripción: [qué hace]
  Esfuerzo: [horas / semanas]
  Riesgo técnico: [bajo / medio / alto]
  Riesgo de negocio: [bajo / medio / alto]
  Cuándo elegirla: [contexto donde tiene sentido]
  Cuándo NO elegirla: [limitaciones]

Opción B — [nombre descriptivo]
  [misma estructura]

Opción C — [MVP / minimal si aplica]
  [misma estructura]
```

### Tipos de opciones a considerar siempre:
- **La opción rápida** — ¿qué resuelve el 80% del problema en el 20% del tiempo?
- **La opción correcta** — ¿cómo lo haríamos bien si no hubiera prisa?
- **La opción de no hacer nada** — ¿qué pasa si lo dejamos como está? (a veces es válida)

---

## Fase 3: Evaluar tradeoffs con criterio de consultora

Para cada opción, evaluar:

| Criterio | Opción A | Opción B | Opción C |
|---------|---------|---------|---------|
| Tiempo de implementación | | | |
| Complejidad de mantenimiento | | | |
| Escalabilidad | | | |
| Reversibilidad (¿se puede deshacer?) | | | |
| Costo operativo (infra, licencias) | | | |
| Riesgo de regresión | | | |

### Preguntas que siempre hay que hacerse:
- ¿Esta solución crea más deuda técnica de la que resuelve?
- ¿En 12 meses esto va a ser un problema mayor o menor?
- ¿El equipo que mantiene esto lo va a entender?
- ¿Cuál es el plan B si esta solución falla en producción?

---

## Fase 4: Recomendación con argumento

La recomendación no es "depende" — es una posición fundamentada:

```
Recomendación: [Opción X]

Por qué:
- [Razón 1 — técnica o de negocio]
- [Razón 2]
- [Razón 3]

Con estos supuestos:
- [Constraint que hace válida esta elección]
- [Si cambia X, considerar Opción Y en cambio]

Próximos pasos concretos:
1. [Acción inmediata]
2. [Siguiente decisión que habrá que tomar]
```

---

## Fase 5: Estimación honesta

Para propuestas a clientes o planificación interna:

### Estructura de estimación:
```
Feature: [nombre]

Desglose:
- Backend (endpoints, lógica, DB): X horas
- Frontend: X horas  
- Tests: X horas
- Integración / deploy: X horas
- Buffer (15-20% para imprevistos): X horas

TOTAL: X horas

Supuestos:
- [Qué asumimos que está hecho / disponible]
- [Qué dependencias externas hay]

No incluido (posibles adicionales):
- [Qué puede aparecer que no está en el scope]
```

### Reglas de estimación honesta:
- No multiplicar por 2 "por si acaso" de forma oculta — ser transparente con el buffer
- Si hay incertidumbre alta → dar rango (mínimo - máximo), no un número falso preciso
- Si hay dependencias fuera de control → decirlo explícitamente
- El tiempo de code review, testing en staging y deploy no es gratis — incluirlo

---

## Contexto por proyecto para decisiones

### HCG — criterios de decisión
- Prioridad: estabilidad sobre velocidad (plataforma productiva con clientes reales)
- El backend NestJS es el centro — decisiones de frontend son secundarias
- Las integraciones (Stripe Connect, notificaciones) tienen mucho riesgo implícito
- Mobile (Ionic) tiene constraints de performance que no existen en web

### Random Lab consultora — criterios de decisión
- La solución debe ser mantenible por otro developer después de nosotros
- Documentación es parte del entregable, no opcional
- Preferir tecnología que el cliente ya conoce si cumple los requisitos
- El over-engineering en proyectos de cliente tiene costo real

### Proyectos experimentales (ADA/Hermes, Retratarte, lab) — criterios
- La exploración técnica ES el objetivo — no optimizar prematuramente
- Código puede ser menos estructurado, pero las decisiones de arquitectura importan igual
- Documentar el "por qué" de decisiones inusuales — esto se comparte públicamente

---

## Templates para propuestas a cliente

### Propuesta de bolsa de horas (mantenimiento)
```markdown
## Propuesta de Mantenimiento — [Proyecto] — Random Lab

### Contexto
[1 párrafo: qué es el sistema, en qué estado está]

### Alcance de la bolsa de horas
Incluye:
- [Tipo de tarea 1]
- [Tipo de tarea 2]
- Comunicación y reuniones de seguimiento

No incluye:
- [Feature nueva fuera del scope acordado]
- [Integraciones con terceros no mencionados]

### Condiciones
- Horas: [X horas / mes]
- Tarifa: [€/hora]
- Tiempo de respuesta: [X horas hábiles]
- Rollover: [si/no, hasta X horas]

### Proceso de trabajo
[Cómo se reportan tareas, cómo se consume la bolsa, cómo se rinde cuentas]
```
