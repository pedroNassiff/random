# Skill: /think
# Activar con: `/think` en Claude Code, o pegar este contenido al inicio de sesión en Claude web

> Metodología de 6 fases para pensar antes de codificar.
> Aplica a features nuevas, bugs complejos, migraciones y refactors.
> Leer GLOBAL.md y CLAUDE.md del proyecto ANTES de ejecutar cualquier fase.

---

## Fase 0: Leer contexto

Antes de cualquier cosa:
1. Leer GLOBAL.md — quién es Pedro, su stack global, sus estándares
2. Leer CLAUDE.md del proyecto — qué es este sistema, sus convenciones, zonas de riesgo
3. Confirmar en 2-3 líneas: qué entiendo que hay que hacer y en qué contexto

Si hay ambigüedad → preguntar UNA COSA antes de continuar.

---

## Fase 1: Planificar antes de tocar código

**Objetivo:** Entender el alcance real antes de escribir una línea.

### Hacer:
- Descomponer la tarea en subtareas concretas y ordenadas
- Estimar impacto: ¿cuántos archivos se tocan? ¿hay cambio de schema? ¿afecta API pública?
- Clasificar complejidad:
  - **Simple** — 1-3 archivos, lógica aislada, sin efecto en otros módulos
  - **Media** — 4-8 archivos, toca dominio compartido, puede haber regresiones
  - **Compleja** — arquitectura afectada, múltiples módulos, riesgo de race conditions o breaking changes
- Identificar dependencias: ¿qué tiene que existir para que esto funcione?

### Output esperado:
```
Plan:
1. [ ] Crear/modificar X
2. [ ] Actualizar Y
3. [ ] Testear Z

Complejidad: [Simple / Media / Compleja]
Riesgo: [qué puede salir mal]
```

---

## Fase 2: Explorar el codebase antes de asumir

**Objetivo:** No referenciar nada que no exista.

### Hacer (en Claude Code con herramientas de filesystem):
- Buscar el modelo / servicio / función que se va a usar — confirmar que existe con su firma real
- Verificar tipos: si es TypeScript, confirmar tipos de parámetros y retorno
- Buscar usos existentes del patrón para ser consistente
- Revisar migraciones pendientes o schema actual si hay cambios de DB
- Si es legacy PHP → verificar qué parte está migrada y qué no

### En Claude web (sin filesystem):
- Pedir al usuario que pegue los archivos relevantes antes de continuar
- No asumir que un método existe si no está en los archivos compartidos

### Señal de alerta:
Si voy a escribir `someService.someMethod()` sin haberlo visto en código real → **STOP**.

---

## Fase 3: Tests primero (cuando aplica)

**Objetivo:** Definir el comportamiento esperado antes de implementar.

### Cuándo aplicar TDD estricto:
- Lógica de negocio (bookings, transacciones, validaciones de estado)
- Servicios de integración (OpenAI, Stripe, Firebase)
- Cualquier cosa con side effects (emails, notificaciones, webhooks)

### Cuándo es opcional:
- Endpoints CRUD simples sin lógica compleja
- Scripts de migración one-shot
- Prototipos exploratorios (Three.js, experimentos ADA/Hermes)

### Patrón de test con resistencia a mutación:
```typescript
// ❌ Débil — pasa aunque el código no haga nada útil
expect(result).toBeTruthy()

// ✅ Fuerte — verifica el valor específico y los side effects
expect(result.status).toBe('completed')
expect(result.notifiedAt).toBeInstanceOf(Date)
expect(mockNotificationService.send).toHaveBeenCalledWith(
  expect.objectContaining({ type: 'BOOKING_CONFIRMED', userId: guide.id })
)
```

Tests deben fallar ANTES de la implementación. Si ya pasan → el test no está probando nada.

---

## Fase 4: Implementar el mínimo

**Objetivo:** Solo lo necesario para pasar los tests o resolver la tarea.

### Reglas:
- No implementar lo que no se pidió, aunque parezca "obvio que vendrá después"
- No abstraer hasta que haya al menos 3 repeticiones (regla de tres)
- No optimizar prematuramente — primero que funcione, luego que sea rápido
- Seguir convenciones del CLAUDE.md del proyecto (nombrado, estructura, patrones)
- Si encuentro deuda técnica en el camino → marcar `[📌 TECH DEBT: descripción]` y continuar

### Para integraciones AI (OpenAI, PyTorch):
- Siempre manejar: timeout, rate limit, respuesta malformada
- Loguear inputs/outputs de API calls (sin datos sensibles)
- Tener fallback o degradación elegante

---

## Fase 5: Revisión adversarial

**Objetivo:** Revisar el código como si quisiera romperlo en producción.

### Checklist — hacer mentalmente antes de cualquier commit:

**Concurrencia:**
- [ ] ¿Qué pasa si dos requests ejecutan esto simultáneamente?
- [ ] ¿Hay estado compartido sin lock? (especialmente en DB)
- [ ] ¿Las transacciones cubren todo lo que deben cubrir?

**Inputs:**
- [ ] ¿Qué pasa si el input es null, undefined, vacío, negativo o string gigante?
- [ ] ¿Los DTOs validan tipos y rangos con class-validator?
- [ ] ¿Hay algún campo que se asume como presente pero puede no venir?

**Seguridad:**
- [ ] ¿Este endpoint está protegido con el Guard correcto?
- [ ] ¿Hay datos sensibles en logs o en respuestas que no deberían estar?
- [ ] ¿Los IDs de recursos verifican ownership del usuario que los pide?
- [ ] ¿Las queries SQL tienen posibilidad de injection? (aunque use ORM, verificar)

**Integraciones externas:**
- [ ] ¿Qué pasa si OpenAI / Stripe / Firebase está caído?
- [ ] ¿Hay retry logic donde hace falta?
- [ ] ¿El timeout está configurado?

**Edge cases de negocio:**
- [ ] ¿Esta acción es idempotente si se ejecuta dos veces?
- [ ] ¿Hay estados de transición que no están cubiertos?

### Para migraciones legacy (Calavera Sur u otros):
- [ ] ¿El rollback está pensado?
- [ ] ¿Los datos nuevos coexisten con los datos viejos durante la transición?
- [ ] ¿El AI tagging puede fallar parcialmente sin corromper el resto?

**Si encuentro algo crítico → marcar `[⚠️ RIESGO]` y proponer solución antes de cerrar.**

---

## Fase 6: Documentar mientras el contexto está fresco

**Qué documentar (mínimo):**
- Comentario de "por qué" si la decisión no es obvia
- Actualizar CLAUDE.md si encontré algo que debería estar en "Zonas de riesgo" o "Convenciones"
- Si hubo cambio de schema → actualizar descripción de tabla/modelo
- Si es una API pública → verificar que el README o Swagger esté actualizado

**Qué NO documentar:**
- El "qué" — el código ya lo dice
- Estado de implementación temporal ("esto es provisional") — o lo arreglas o lo dejas como tech debt

---

## Output final esperado

Al terminar una tarea con /think, entregar:

```
✅ Implementado: [resumen en 1 línea]
📁 Archivos modificados: [lista]
🧪 Tests: [X tests, Y assertions — todos pasan / pendientes]
⚠️ Riesgos encontrados: [si hay alguno]
📌 Tech debt registrado: [si hay alguno]
📝 CLAUDE.md actualizado: [sí/no — qué se añadió]
```
