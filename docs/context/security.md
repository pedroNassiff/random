# Skill: /security
# Activar con: `/security` en Claude Code, o pegar al inicio de revisión de seguridad

> Revisión adversarial antes de desplegar a producción o exponer endpoints.
> Pensar como atacante, no como el developer que lo escribió.
> Leer CLAUDE.md del proyecto para entender el stack y zonas de riesgo conocidas.

---

## Cuándo usar este skill

- Antes de hacer merge de un PR que afecta auth, pagos, datos de usuario o APIs públicas
- Cuando se añade un endpoint nuevo
- Cuando se modifica lógica de permisos o roles
- Antes de desplegar una integración externa (Stripe, OpenAI, Firebase)
- En revisión de código legacy antes de migrar

---

## Fase 1: Superficie de ataque

Mapear qué expone el cambio/feature:

```
Endpoints nuevos/modificados:
- [ ] [método] [ruta] — ¿protegido con qué guard?

Datos que se leen:
- [ ] ¿De qué tabla/colección? ¿Hay filtro por owner/tenant?

Datos que se escriben:
- [ ] ¿Qué campos puede modificar un usuario? ¿Están todos validados?

Integraciones externas que se llaman:
- [ ] [servicio] — ¿qué credenciales usa? ¿están en variables de entorno?
```

---

## Fase 2: Checklist de autenticación y autorización

### Autenticación
- [ ] El endpoint requiere JWT/session — verificar que el guard está aplicado
- [ ] El token se valida en cada request (no solo en login)
- [ ] Los tokens tienen expiración configurada
- [ ] No hay endpoints que devuelven datos sensibles sin auth (ni siquiera "para testing")

### Autorización (el más olvidado)
- [ ] Si el recurso tiene owner, verificar que `resource.userId === request.user.id`
- [ ] Si hay roles, verificar que el role check está en el guard, no en el controller
- [ ] Si hay multi-tenant, verificar que no puede acceder a datos de otro tenant
- [ ] Los IDs en la URL son validados contra el usuario autenticado

### En NestJS específicamente:
```typescript
// ❌ Peligroso — confía en el ID que manda el cliente
async getBooking(@Param('id') id: string) {
  return this.bookingService.findById(id)
}

// ✅ Seguro — verifica ownership
async getBooking(@Param('id') id: string, @GetUser() user: User) {
  return this.bookingService.findByIdAndUser(id, user.id)
}
```

---

## Fase 3: Checklist de inputs y validación

- [ ] Todos los DTOs tienen decoradores de class-validator (`@IsString()`, `@IsInt()`, `@Min()`, etc.)
- [ ] El `ValidationPipe` está configurado con `whitelist: true` (descartar propiedades extra)
- [ ] Los límites están definidos: longitud máxima de strings, rango de números
- [ ] Los campos opcionales realmente son opcionales en el código que los usa
- [ ] No hay `parseInt()` o `Number()` sin validación previa
- [ ] Los parámetros de query (pagination, filters) tienen límites (`@Max(100)` en page size)

### Inputs especialmente peligrosos:
- URLs (SSRF) — si el usuario puede mandar una URL que el backend fetchea
- Nombres de archivo (path traversal) — verificar `path.basename()` y sanitizar
- Contenido HTML/markdown (XSS) — sanitizar antes de guardar o servir

---

## Fase 4: Checklist de datos sensibles

- [ ] No hay passwords, tokens o API keys en logs
- [ ] Las respuestas de API no incluyen campos que no debería ver el cliente (`@Exclude()` en entidades)
- [ ] Los errores de producción no exponen stack traces al cliente
- [ ] Las variables de entorno no están hardcodeadas en código
- [ ] `.env` está en `.gitignore`

### En logs:
```typescript
// ❌ Peligroso
logger.log(`Processing payment for user ${user.email} with card ${cardNumber}`)

// ✅ Seguro
logger.log(`Processing payment for userId=${user.id}`)
```

---

## Fase 5: Checklist de base de datos

- [ ] No hay queries con interpolación directa de strings de usuario
- [ ] Los parámetros usan binding (`?` o `:param`) — TypeORM/Prisma lo hace por defecto, pero verificar raw queries
- [ ] Las transacciones cubren operaciones que deben ser atómicas
- [ ] Si hay operaciones concurrentes sobre el mismo registro, hay `SELECT FOR UPDATE` o locking
- [ ] Las migraciones son reversibles (hay `down()` implementado)

---

## Fase 6: Checklist de integraciones externas

### Para OpenAI / embeddings:
- [ ] El input del usuario no se manda directamente sin sanitizar (prompt injection)
- [ ] Si el resultado de la IA se usa para tomar decisiones críticas, hay validación del output
- [ ] Los costos tienen límite (usage limits en el dashboard de OpenAI)

### Para Stripe:
- [ ] Los webhooks verifican la firma (`stripe.webhooks.constructEvent`)
- [ ] El precio viene del servidor, nunca del cliente
- [ ] Las cuentas de Connect verifican que `account_id` pertenece al tenant correcto

### Para GCP / Cloud:
- [ ] Las Service Accounts tienen solo los permisos necesarios
- [ ] Los buckets de Storage no son públicos salvo que sea intencional
- [ ] Los logs de Cloud Run no contienen datos sensibles

---

## Fase 7: Revisión de código legacy (Calavera Sur u otros)

Contexto especial para migraciones PHP → FastAPI:

- [ ] El endpoint nuevo en FastAPI tiene las mismas restricciones de acceso que el legacy
- [ ] Si conviven dos versiones (PHP + FastAPI), no hay bypass pasando por el más permisivo
- [ ] Los datos migrados están validados — no asumir que el legacy era consistente
- [ ] Los embeddings/pgvector: verificar que no se pueden buscar productos de otro tenant

---

## Output de la revisión

```
🔍 Superficie analizada: [endpoints, datos, integraciones]

✅ Sin issues: [qué está bien]

⚠️ Issues encontrados:
  CRÍTICO: [descripción + línea de código + fix propuesto]
  MEDIO:   [descripción + recomendación]
  BAJO:    [nota para refactor futuro]

📌 Recomendaciones adicionales: [si las hay]
```

Clasificación de severidad:
- **CRÍTICO** — puede comprometer datos de usuario, permite acceso no autorizado, exposición de credenciales
- **MEDIO** — información que no debería estar visible, validación faltante en input importante
- **BAJO** — mejora de hardening, logging mejorable, práctica sub-óptima sin riesgo inmediato
