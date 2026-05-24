# Web Security Auditing — Teoría y Técnica

> **Random Lab · Internal knowledge base**
> Material de referencia técnica-teórica sobre auditoría web
> Cubre fundamentos de Capa 1 (passive) y Capa 2 (active authorized)
> Enfoque: comprensión profunda, no solo qué hacer sino por qué

---

## Cómo leer este documento

Este no es un manual de checklist. Es un mapa mental de cómo funciona la seguridad web a nivel de fundamentos, organizado en capas:

1. **El stack mental** — cómo pensar la seguridad de una aplicación
2. **Modelos de amenaza** — qué estamos protegiendo de qué
3. **Capa 1 técnica** — cada probe explicado a fondo
4. **Capa 2 técnica** — cada categoría OWASP con su mecánica interna
5. **Conectores transversales** — cosas que aparecen en ambas capas

Cuando termines, deberías poder mirar cualquier sitio y entender qué está expuesto y por qué, no solo qué herramienta tirarle encima.

---

# PARTE 1 — El stack mental de la seguridad web

## 1.1 La pregunta fundamental

Toda auditoría responde una sola pregunta en cinco formas:

> ¿Quién puede hacer qué cosa, sobre qué recurso, en qué condiciones, con qué evidencia?

- **Quién** → autenticación (auth)
- **Qué cosa** → autorización (authz)
- **Qué recurso** → control de acceso a datos
- **En qué condiciones** → contexto (red, sesión, integridad)
- **Con qué evidencia** → logging y trazabilidad

Cuando una de las cinco está rota, hay vulnerabilidad. Cuando todas se rompen al mismo tiempo, hay breach.

## 1.2 Los tres pilares clásicos (CIA)

- **Confidentiality** — solo quien debe ver datos los ve
- **Integrity** — los datos no se alteran sin autorización
- **Availability** — los sistemas siguen funcionando

Y los dos modernos añadidos:

- **Authenticity** — saber con certeza quién hizo qué
- **Non-repudiation** — el actor no puede negar la acción

Un finding crítico generalmente compromete dos o más de estos pilares simultáneamente. Una SQLi que extrae datos compromete confidentiality + integrity + authenticity al mismo tiempo.

## 1.3 El principio de defensa en profundidad

Ningún control de seguridad es perfecto. La seguridad real se construye por **capas redundantes** que se cubren entre sí. Si una falla, la siguiente atrapa al atacante:

```
┌─────────────────────────────────────────────────┐
│ Perímetro (WAF, CDN, rate limiting)             │
│  ┌───────────────────────────────────────────┐  │
│  │ Transporte (TLS, HSTS, CSP)               │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │ Autenticación (passwords, MFA, JWT) │  │  │
│  │  │  ┌───────────────────────────────┐  │  │  │
│  │  │  │ Autorización (RBAC, ABAC)     │  │  │  │
│  │  │  │  ┌─────────────────────────┐  │  │  │  │
│  │  │  │  │ Validación de input     │  │  │  │  │
│  │  │  │  │  ┌───────────────────┐  │  │  │  │  │
│  │  │  │  │  │ Lógica de negocio │  │  │  │  │  │
│  │  │  │  │  │  ┌─────────────┐  │  │  │  │  │  │
│  │  │  │  │  │  │ Persistencia│  │  │  │  │  │  │
│  │  │  │  │  │  │ (BD,fs,API) │  │  │  │  │  │  │
└──────────────────────────────────────────────────┘
```

Cuando audites, mirá cada capa por separado **y las transiciones entre ellas**. La mayoría de los breaches grandes ocurren porque dos capas asumieron que la otra estaba protegiendo algo, y ninguna lo hacía.

## 1.4 Modelo del atacante (threat actor)

No todos los atacantes son iguales. Antes de auditar, identificá contra qué nivel estamos defendiendo:

| Actor | Recursos | Motivación | Tiempo dedicado |
|---|---|---|---|
| **Script kiddie** | Herramientas públicas | Curiosidad, ego | Minutos a horas |
| **Cybercriminal oportunista** | Tooling comercial, botnets | Dinero (ransomware, fraude) | Horas a días |
| **Cybercriminal dirigido** | Infra propia, 0days comprados | Datos específicos, extorsión | Semanas |
| **Insider** | Acceso legítimo previo | Variable | Indefinido |
| **APT (Advanced Persistent Threat)** | Estado, recursos masivos | Espionaje, sabotaje | Meses a años |

La mayoría de los e-commerce mid-market necesitan estar protegidos contra los tres primeros. Pretender defender contra APTs sin staging propio, SOC dedicado y threat intelligence es ciencia ficción.

## 1.5 Surface area vs attack surface

Conceptos parecidos, distintos:

- **Surface area**: todo lo que existe (endpoints, subdominios, servicios). Inventario.
- **Attack surface**: la parte de eso que un atacante puede tocar. Función del actor.

Para un atacante externo no autenticado, el attack surface incluye:
- Endpoints públicos
- Subdominios accesibles
- Servicios expuestos a internet
- Tokens en JS público
- Información en CT logs
- Credenciales filtradas en breaches

Para un atacante autenticado (cliente legítimo malicioso), se suma:
- Endpoints de cuenta
- APIs internas accesibles tras login
- Lógica de negocio

Para un insider:
- Todo lo anterior + acceso administrativo + datos en reposo

Auditar = mapear todas las superficies y verificar que cada una tiene sus controles correctos.

---

# PARTE 2 — Capa 1: Reconocimiento pasivo

## 2.1 La filosofía de Capa 1

Capa 1 mira la aplicación **como cualquier usuario o visitante lo haría**. No autenticamos con cuentas privadas, no enviamos payloads inusuales, no fuzzeamos. Solo observamos lo que la aplicación expone públicamente y lo que cualquier servicio de internet (DNS, CT logs, certificados, APIs públicas) ya tiene sobre ella.

**Por qué importa**: el 60-70% de los problemas de seguridad reales de una empresa mid-market son visibles solo con reconocimiento pasivo. Cookies mal configuradas, headers ausentes, certificados expirando, subdominios olvidados, secretos en GitHub público. No hace falta entrar a ningún sistema.

## 2.2 HTTP Security Headers — la primera línea

Los headers HTTP son instrucciones que el servidor envía al navegador junto con la respuesta. Algunos son críticos para seguridad porque le dicen al navegador qué reglas aplicar para esa página.

### 2.2.1 Strict-Transport-Security (HSTS)

**Qué dice**: "este sitio solo debe accederse por HTTPS, por X tiempo, recordalo aunque el usuario escriba http://".

**Por qué importa**: sin HSTS, un atacante en la misma red WiFi puede interceptar la primera conexión http:// del usuario (antes de la redirección automática a https://) y nunca dejarlo llegar a HTTPS. Esto se llama **SSL stripping**. Con HSTS activo, el navegador ya sabe que el sitio es HTTPS y bloquea la conexión http:// sin siquiera intentarla.

**Valor correcto**: `max-age=31536000; includeSubDomains; preload`
- `max-age` en segundos (31536000 = 1 año)
- `includeSubDomains` extiende la regla a `*.dominio.com`
- `preload` permite incluir el dominio en una lista que viene **hardcoded en los navegadores** (Chrome, Firefox, Safari), eliminando incluso el primer request http://

**Cómo evaluar**:
- Ausente → vulnerable a SSL stripping
- `max-age` < 6 meses → débil
- Sin `includeSubDomains` y el sitio tiene subdominios → cobertura parcial
- Sin preload → primer visit sigue siendo vulnerable

### 2.2.2 Content-Security-Policy (CSP)

**Qué dice**: "el navegador solo debe ejecutar scripts/cargar recursos de estos orígenes específicos, con estas reglas".

**Por qué importa**: si un atacante logra inyectar `<script>` en tu HTML (vía XSS), CSP estricta previene que ese script se ejecute si no viene de un origen permitido. Es **defensa en profundidad** sobre la validación de input.

**Anatomía de una CSP**:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdn.confiable.com 'nonce-aBc123';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.miapp.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
```

**Directivas clave**:
- `default-src` → fallback para todo lo no especificado
- `script-src` → de dónde se cargan JS
- `style-src` → de dónde se cargan CSS
- `connect-src` → a dónde puede hacer fetch/XHR/WebSocket
- `frame-ancestors` → quién puede embeber esta página en iframe (reemplaza a X-Frame-Options)
- `form-action` → a dónde pueden submittear forms

**Anti-patterns que debilitan CSP**:
- `'unsafe-inline'` en `script-src` → permite `<script>...</script>` y `onclick="..."`, eliminando la protección anti-XSS principal
- `'unsafe-eval'` → permite `eval()`, `new Function()`, etc.
- `*` como source → cualquier origen permitido = sin protección
- `data:` en `script-src` → permite cargar JS desde data URLs

**El approach moderno: nonces y hashes**:
```html
<script nonce="aBc123">
  /* solo se ejecuta si nonce coincide con CSP */
</script>
```
El servidor genera un nonce random por request, lo incluye en la CSP y en cada `<script>` legítimo. Cualquier `<script>` inyectado por atacante no tendrá el nonce correcto y será bloqueado.

### 2.2.3 X-Frame-Options / frame-ancestors

**Qué evita**: clickjacking. Un atacante embebe tu sitio en un iframe transparente sobre su propio sitio, y engaña al usuario para hacer click en lo que parece un botón inocente pero en realidad es un botón crítico de tu sitio (ej. "transferir dinero", "borrar cuenta", "aceptar permisos").

**Valores**:
- `DENY` → nadie puede embeberme en iframe
- `SAMEORIGIN` → solo páginas del mismo dominio
- `ALLOW-FROM uri` → deprecado, usar CSP `frame-ancestors`

**Preferido**: `Content-Security-Policy: frame-ancestors 'none'` (o `'self'`). Es la versión moderna y más flexible.

### 2.2.4 X-Content-Type-Options

**Valor único**: `nosniff`

**Qué evita**: que el navegador "adivine" el tipo MIME de un recurso. Sin nosniff, si subís un archivo `imagen.jpg` que en realidad contiene HTML+JS, algunos navegadores pueden ejecutarlo como HTML. Con nosniff, el navegador respeta estrictamente el `Content-Type` que envía el servidor.

Especialmente crítico en endpoints de upload de archivos donde el usuario controla el contenido.

### 2.2.5 Referrer-Policy

**Qué controla**: cuánta info envía el navegador en el header `Referer` cuando navegás a otro sitio o cargás un recurso externo.

Sin esto, si el usuario está en `https://miapp.com/cuenta/factura/123?token=secreto&user=pedro` y hace click en un link externo, el sitio externo recibe la URL **completa**, incluyendo `token=secreto`.

**Valores recomendados**:
- `strict-origin-when-cross-origin` (default moderno, balanceado) → envía URL completa al mismo origen, solo origen al cross-origin, nada si cross-origin downgrade HTTPS→HTTP
- `no-referrer` → máxima privacidad, ningún Referer
- `same-origin` → solo Referer dentro del mismo dominio

### 2.2.6 Permissions-Policy (antes Feature-Policy)

**Qué controla**: qué APIs del navegador pueden usar la página y sus iframes (cámara, micrófono, geolocalización, USB, payment, etc.).

**Ejemplo**:
```
Permissions-Policy: camera=(), microphone=(), geolocation=(self), payment=(self "https://stripe.com")
```

Esto dice: "ninguna página puede pedir cámara o micrófono, solo mi origen puede pedir geolocalización, solo mi origen y stripe.com pueden iniciar pagos".

**Por qué importa**: si un script de terceros se vuelve malicioso (supply chain attack), no puede pedir acceso a cámara/micrófono/etc. aunque lo intente. Defensa en profundidad otra vez.

### 2.2.7 Información disclosure

Headers que **revelan información del stack** y NO deberían enviarse:

- `Server: Apache/2.4.29 (Ubuntu)` → versión exacta → cross-ref con CVEs públicos
- `X-Powered-By: PHP/7.2.0` → versión exacta de PHP → idem
- `X-AspNet-Version: 4.0.30319` → idem para .NET

El problema no es que un atacante use esto para "el ataque definitivo". Es que **acelera el reconocimiento** y le permite ser quirúrgico. Si sabe que estás en PHP 7.2 con Apache 2.4.29, prueba solo los exploits de esas versiones específicas en lugar de probar genéricamente.

**Solución**: quitar estos headers en la config del servidor. En Nginx `server_tokens off;`, en Apache `ServerSignature Off; ServerTokens Prod`.

## 2.3 TLS / SSL — la capa de transporte

### 2.3.1 Por qué TLS

Sin TLS, todo el tráfico HTTP es **texto plano**. Cualquiera en la red entre el cliente y el servidor (WiFi público, ISP, routers intermedios, gobiernos) puede leer y modificar todo. Con TLS:

- **Cifrado** → nadie en el medio puede leer
- **Integridad** → nadie en el medio puede modificar sin que se detecte
- **Autenticación del servidor** → el cliente verifica que el certificado pertenece al dominio real (vía CA)

### 2.3.2 Versiones de TLS

| Versión | Estado | Notas |
|---|---|---|
| SSL 2.0 | Roto | Vulnerabilidades múltiples, deshabilitado en todos lados |
| SSL 3.0 | Roto | POODLE attack (2014). Nunca habilitar |
| TLS 1.0 | Deprecado | BEAST attack. Deshabilitado en navegadores modernos desde 2020 |
| TLS 1.1 | Deprecado | Idem. Sin protección moderna |
| TLS 1.2 | OK | Estándar mínimo aceptable |
| TLS 1.3 | Recomendado | Más rápido (1-RTT handshake), eliminó ciphers débiles, forward secrecy obligatoria |

Una auditoría debe confirmar: **TLS 1.2+ obligatorio, ideal 1.3 disponible, 1.0/1.1 deshabilitados**.

### 2.3.3 Cipher suites

Un cipher suite es la combinación de algoritmos usados en una conexión TLS. Ejemplo:

```
TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
```

Desglose:
- `ECDHE` → key exchange (Elliptic Curve Diffie-Hellman Ephemeral). Provee **forward secrecy**: si un atacante captura el tráfico hoy y mañana roba la clave privada del servidor, no puede descifrar el tráfico viejo.
- `RSA` → autenticación del servidor
- `AES_256_GCM` → cifrado simétrico de los datos
- `SHA384` → función de hash para integridad

**Ciphers a evitar**:
- `RC4` (roto)
- `DES`, `3DES` (débiles)
- `MD5`, `SHA1` para HMAC (débiles)
- `EXPORT` ciphers (legacy, 40-bit)
- Cualquier cipher sin forward secrecy (sin ECDHE o DHE)

### 2.3.4 Certificados

**Qué es**: documento firmado por una CA (Certificate Authority) que dice "este dominio es realmente quien dice ser". Contiene:
- Dominio(s) cubierto(s) — SAN (Subject Alternative Names)
- Clave pública
- Fechas de validez
- Firma de la CA

**Cosas a auditar**:
- ¿Expira pronto? (auto-renewal de Let's Encrypt es estándar, pero falla a veces)
- ¿Cubre todos los subdominios necesarios? (wildcard vs SAN específicos)
- ¿La cadena de certificados está completa? (intermediate certs)
- ¿La CA es confiable? (Let's Encrypt, DigiCert, Sectigo, etc.)
- ¿Hay revocación pendiente? (OCSP, CRL)

### 2.3.5 Certificate Transparency (CT)

**Concepto**: desde 2018, toda CA debe publicar cada certificado emitido en logs públicos auditables. Esto previene que una CA emita certificados maliciosos en secreto.

**Para auditoría defensiva**: CT logs te dan lista pública de **todos los subdominios** que tu cliente ha registrado certificados para. Esto incluye subdominios olvidados:
- `staging.dominio.com` (entorno de pruebas con datos reales mal protegido)
- `old-api.dominio.com` (API vieja sin patches)
- `jenkins.dominio.com` (CI server expuesto)
- `vpn.dominio.com` (acceso interno)

Cada subdominio activo es **superficie de ataque adicional**. Si nadie los está manteniendo, son los más vulnerables.

**Tool**: `crt.sh` (interface web + JSON API gratuita).

## 2.4 Email Authentication — SPF/DKIM/DMARC

Tres protocolos que juntos previenen que cualquiera envíe email haciéndose pasar por tu dominio. Críticos para anti-phishing.

### 2.4.1 SPF (Sender Policy Framework)

**Qué hace**: declara públicamente (en DNS) qué servidores están autorizados a enviar email desde tu dominio.

**Ejemplo**:
```
v=spf1 include:_spf.google.com include:sendgrid.net ~all
```

- `include:_spf.google.com` → Google Workspace puede enviar
- `include:sendgrid.net` → SendGrid puede enviar
- `~all` → todo lo demás "softfail" (sospechoso pero no rechazo duro)
- `-all` → hardfail (rechazo duro)

**Limitaciones**: SPF rompe con forwarding (si A reenvía un mail tuyo a B, B ve el servidor de A, no el tuyo). Por eso necesitamos DKIM además.

### 2.4.2 DKIM (DomainKeys Identified Mail)

**Qué hace**: el servidor que envía firma criptográficamente el email con una clave privada. Tu DNS publica la clave pública. El receptor verifica la firma.

**Ejemplo de registro DNS**:
```
google._domainkey.dominio.com TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQ..."
```

**Ventaja sobre SPF**: la firma viaja con el email, sobrevive forwarding. Si el contenido se modifica, la firma falla.

### 2.4.3 DMARC (Domain-based Message Authentication, Reporting and Conformance)

**Qué hace**: la directriz que une SPF y DKIM. Le dice al receptor: "si SPF Y DKIM fallan, hacé esto", y "mandame reportes de qué emails fallan".

**Ejemplo**:
```
_dmarc.dominio.com TXT "v=DMARC1; p=reject; rua=mailto:dmarc@dominio.com; pct=100"
```

- `p=reject` → si falla, rechazar el email
- `p=quarantine` → mandar a spam
- `p=none` → no hacer nada (modo monitoring)
- `rua=` → mandar reportes agregados acá
- `pct=100` → aplicar a 100% de los emails

**Maduración típica de DMARC**: empezar en `p=none` con `rua=` activo durante 4-8 semanas. Analizar los reportes. Ajustar SPF/DKIM. Pasar a `p=quarantine` con `pct=25`, ir subiendo. Llegar a `p=reject; pct=100`.

**Por qué es crítico**: sin DMARC en `reject`, cualquiera puede mandar emails desde `@tudominio.com` y los proveedores los aceptarán. Esto se usa para:
- Phishing a tus propios clientes ("hola, somos tu banco, ingresá acá")
- Estafas BEC (Business Email Compromise) a tus empleados
- Phishing a tus proveedores haciendo passes legítimos

## 2.5 Performance como vector de seguridad y revenue

### 2.5.1 Por qué performance es seguridad

No solo es UX. Performance pobre es:
- **Vulnerabilidad a DoS**: un sitio que ya tarda 4s con tráfico normal cae con cualquier picos. Atacante con 100 requests/segundo lo tira.
- **Vulnerabilidad económica**: cada segundo extra de carga = 7-10% menos conversión (datos de Akamai/Google). Para un e-commerce mid-market eso son miles de € al mes.
- **Vulnerabilidad de SEO**: Google penaliza Core Web Vitals malos. Menos tráfico orgánico.

### 2.5.2 Core Web Vitals

Tres métricas que Google usa como ranking factor desde 2021:

**LCP (Largest Contentful Paint)** — tiempo hasta que el elemento más grande visible se renderiza.
- Bueno: < 2.5s
- Necesita mejora: 2.5s - 4s
- Pobre: > 4s

Causas comunes de LCP malo:
- Imagen hero gigante sin compresión
- Fonts bloqueantes
- JS render-blocking
- TTFB lento (servidor lento)
- Sin CDN
- Redirecciones encadenadas

**INP (Interaction to Next Paint)** — reemplazó FID en 2024. Mide cuánto tarda el sitio en responder a interacciones del usuario.
- Bueno: < 200ms
- Necesita mejora: 200-500ms
- Pobre: > 500ms

Causas: JS pesado bloqueando el main thread, event handlers ineficientes, re-renders masivos en React.

**CLS (Cumulative Layout Shift)** — cuánto se "mueve" el contenido durante la carga.
- Bueno: < 0.1
- Necesita mejora: 0.1 - 0.25
- Pobre: > 0.25

Causas: imágenes sin width/height, fonts que cambian dimensiones al cargar, ads/embeds insertándose.

### 2.5.3 TTFB y la cadena hasta el primer byte

TTFB (Time to First Byte) es el tiempo desde que el browser hace el request hasta el primer byte de respuesta. Compone:

```
DNS lookup → TCP handshake → TLS handshake → Server processing → First byte
```

Cada paso es optimizable:
- **DNS**: usar DNS rápido (Cloudflare 1.1.1.1, Google 8.8.8.8) y TTLs razonables
- **TCP**: HTTP/2 multiplexing, HTTP/3 con QUIC elimina handshake
- **TLS**: TLS 1.3 0-RTT, OCSP stapling
- **Server**: caching, BD optimizada, evitar N+1 queries
- **Primer byte**: streaming HTML, server-side rendering optimizado

## 2.6 Privacy y compliance — RGPD/LSSI-CE

### 2.6.1 La cadena de consentimiento

Cuando un usuario llega a tu sitio:

```
Usuario llega → ¿Cookies estrictamente necesarias? → Sí: setear sin consent
                                                  → No: NADA hasta consent
                ↓
Banner aparece → Usuario decide → Accept: setear todas
                                → Reject: solo necesarias
                                → Configure: granular
```

**El problema más común que vas a encontrar**: el sitio setea analytics/marketing pixels **antes** del consentimiento. Eso es violación de RGPD art. 7 + LSSI-CE art. 22. Multas reales y publicadas por la AEPD.

### 2.6.2 Cómo se audita pasivamente

1. Abrir el sitio en navegación incógnita
2. Antes de hacer click en nada del banner, abrir DevTools → Application → Cookies
3. Listar todas las cookies seteadas
4. Listar todos los requests salientes (Network tab)

Si hay cookies o requests a Google Analytics, Meta Pixel, TikTok, Hotjar, etc., antes del consent → finding directo de incumplimiento.

### 2.6.3 European Accessibility Act (EAA)

Directiva 2019/882, aplicable desde **28 de junio de 2025**. Obliga a:
- Sitios B2C en EU a cumplir WCAG 2.1 nivel AA
- Apps móviles idem
- Sectores cubiertos: e-commerce, banca, transporte, comunicaciones, ebooks
- Multas hasta 1M€ por infracción (varía por país)

**Cómo auditar**:
- Lighthouse Accessibility score
- axe DevTools
- Lectura manual con teclado (sin mouse)
- Lector de pantalla (NVDA gratis para Windows, VoiceOver en Mac)

**Violaciones típicas**:
- Imágenes sin `alt`
- Contraste insuficiente (< 4.5:1 para texto normal)
- Formularios sin `<label>` asociadas
- Botones sin texto accesible (`aria-label`)
- Navegación imposible por teclado
- Focus states invisibles

---

# PARTE 3 — Capa 2: Testing activo

> **Crítico**: todo lo que sigue solo se ejecuta con consent escrito específico y scope acordado. La teoría es educativa; la práctica sin autorización es delito (CP español arts. 197 bis y 264).

## 3.1 OWASP Top 10 — el marco mental

La lista que actualiza OWASP cada 3-4 años con las vulnerabilidades web más críticas. Versión 2021 vigente:

```
A01: Broken Access Control          ← #1 actual
A02: Cryptographic Failures
A03: Injection
A04: Insecure Design
A05: Security Misconfiguration
A06: Vulnerable and Outdated Components
A07: Identification and Authentication Failures
A08: Software and Data Integrity Failures
A09: Security Logging and Monitoring Failures
A10: Server-Side Request Forgery (SSRF)
```

No es una lista exhaustiva, es la **lista priorizada por prevalencia y severidad**. Cubrirla cubre el 80% de los breaches reales.

## 3.2 A01 — Broken Access Control

**Qué es**: cuando un usuario puede acceder a recursos o ejecutar acciones que no debería. La vulnerabilidad #1 actualmente porque es **muy común** y **fácil de explotar**.

### 3.2.1 IDOR (Insecure Direct Object Reference)

**Mecánica**: cuando un objeto se identifica por un ID en la URL o en el body, y el servidor **no verifica si el usuario tiene permiso** sobre ese objeto específico.

**Ejemplo trivial**:
```
GET /api/orders/12345
Authorization: Bearer <token-del-usuario-A>
```
El servidor verifica que el token es válido, pero **no verifica que el pedido 12345 pertenezca al usuario A**. Cualquier usuario autenticado puede ver cualquier pedido cambiando el número.

**Cómo se detecta**:
1. Auth con cuenta A, observar URLs/payloads (`/api/orders/123`, `/api/users/45/profile`)
2. Auth con cuenta B (en otra sesión), repetir mismas URLs/payloads con los IDs de A
3. Si recibe 200 + datos → IDOR confirmada
4. Si recibe 403/404 → control correcto

**Variantes**:
- **Horizontal**: usuario accede a recursos de otro usuario de mismo nivel
- **Vertical**: usuario normal accede a recursos/acciones de admin

### 3.2.2 BOLA (Broken Object Level Authorization)

Es IDOR pero específico al contexto de APIs. Mismo concepto. OWASP API Top 10 lo lista como API1.

### 3.2.3 Path traversal

**Mecánica**: aprovechar inputs que se concatenan a paths de filesystem sin sanitización.

Si el server hace algo como:
```python
filename = request.args["file"]
return open(f"/uploads/{filename}").read()
```

Y el atacante envía `?file=../../etc/passwd`, el server resuelve a `/uploads/../../etc/passwd` = `/etc/passwd`. Lectura arbitraria de archivos.

### 3.2.4 Privilege escalation

**Vertical**: usuario normal logra acciones de admin.
- Forzar parámetros (`role=admin` en signup)
- Acceder a `/admin/*` sin verificación de rol
- Modificar JWT (cambiar `role: user` a `role: admin` si la firma es débil)

**Horizontal**: ya cubierto en IDOR.

## 3.3 A02 — Cryptographic Failures

**Qué es**: errores en el uso de criptografía. Antes "Sensitive Data Exposure". Engloba:

### 3.3.1 Datos sensibles sin cifrar

- Passwords almacenadas en plaintext en BD (todavía pasa)
- Passwords con MD5/SHA1 (rotos, no son hashing seguro)
- Passwords sin salt
- Tokens en localStorage en lugar de httpOnly cookies
- API keys en frontend JS

**Estándar moderno para passwords**: bcrypt, scrypt o Argon2 con factor de costo apropiado (bcrypt cost 12+).

### 3.3.2 JWT mal implementados

JSON Web Tokens son la forma estándar de auth stateless. Cuatro problemas típicos:

**alg=none attack**: algunos parsers JWT viejos aceptan tokens con header `{"alg":"none"}` que indica "sin firma". El atacante crea un JWT con cualquier claim, lo manda con alg=none, el server lo acepta.

**Weak signing key**: si el secret de HMAC es débil (`secret123`, `mycompany`), se rompe con fuerza bruta offline en minutos. Con la key, el atacante firma cualquier token.

**Algorithm confusion (RS256 → HS256)**: el server espera RS256 (asimétrico, valida con clave pública). El atacante manda token firmado con HS256 usando la **clave pública como secret de HMAC**. Algunos parsers lo aceptan.

**No expiry o expiry muy largo**: tokens válidos por meses. Si se roba un token, sigue activo eternamente.

### 3.3.3 Transmisión sin cifrar

- APIs internas sobre HTTP (LAN no es segura)
- Mixed content (HTTPS con assets HTTP)
- WebSocket sin TLS (`ws://` en lugar de `wss://`)

## 3.4 A03 — Injection

La vulnerabilidad histórica más conocida. Concepto general:

> Cuando input del usuario se mezcla con código/comandos que se interpretan, sin separación clara entre "datos" y "código".

### 3.4.1 SQL Injection

**Ejemplo clásico vulnerable**:
```python
username = request.form["username"]
password = request.form["password"]
query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
db.execute(query)
```

Si el atacante envía `username=admin' --`:
```sql
SELECT * FROM users WHERE username='admin' --' AND password='whatever'
```

El `--` comenta el resto. Login bypass.

**Variantes**:
- **Classic/Union-based**: extraer datos vía `UNION SELECT`
- **Error-based**: forzar errores SQL que revelan info
- **Blind boolean**: el response cambia según condición (`AND 1=1` vs `AND 1=2`)
- **Blind time-based**: el response tarda más si condición es true (`AND SLEEP(5)`)
- **Out-of-band**: el server hace DNS lookup que el atacante captura

**Fix definitivo**: prepared statements / parameterized queries. NO concatenar strings.
```python
# correcto
cursor.execute("SELECT * FROM users WHERE username=%s AND password=%s",
               (username, password))
```

### 3.4.2 XSS (Cross-Site Scripting)

**Mecánica**: el atacante logra inyectar JavaScript que se ejecuta en el navegador de **otros usuarios** de la app.

**Tipos**:

**Reflected XSS**: el payload viene en la URL y se refleja sin escape.
```
https://app.com/search?q=<script>alert(1)</script>
```
Si la página renderiza `q` sin escape, el script ejecuta. El atacante manda este link a víctimas.

**Stored XSS**: el payload se guarda en BD (comentario, post, profile) y se ejecuta cuando otros usuarios lo ven. Más peligroso porque afecta a todos los visitantes.

**DOM-based XSS**: el JS del propio sitio lee datos del URL/storage y los inserta en el DOM sin escape. No requiere round-trip al server.

**Qué puede hacer un XSS**:
- Robar cookies de sesión (`document.cookie`) y enviarlas al atacante
- Hacer requests autenticados como el usuario víctima
- Modificar la página (defacement)
- Keylogger
- Phishing dentro de la propia app (formulario fake)
- Si bypasea CSP, todo lo anterior con más facilidad

**Fix**:
- Output encoding según contexto (HTML, atributo, JS, URL)
- CSP estricta sin `unsafe-inline`
- Cookies con `HttpOnly` (JS no puede leerlas)
- Frameworks modernos (React, Vue) que escapan por default

### 3.4.3 Command Injection

**Mecánica**: input que se pasa a `system()`, `exec()`, `shell` sin sanitización.

```python
filename = request.args["file"]
os.system(f"convert {filename} thumbnail.jpg")  # vulnerable
```

Si atacante manda `?file=image.jpg; rm -rf /`, ejecuta el rm. RCE directo.

**Fix**: nunca pasar input a shell. Usar APIs que toman args como array, no como string:
```python
subprocess.run(["convert", filename, "thumbnail.jpg"])  # safe
```

### 3.4.4 LDAP, NoSQL, XPath injection

Mismo concepto, diferente lenguaje:
- LDAP injection en sistemas de autenticación
- NoSQL injection en MongoDB (`{"$gt": ""}` como password bypassea comparaciones)
- XPath injection en queries XML

## 3.5 A04 — Insecure Design

**Qué es**: vulnerabilidades por **decisiones de diseño** mal pensadas, no por bugs de implementación. La más sutil de auditar porque no hay un "payload" que detecte.

**Ejemplos**:
- Sistema de recuperación de contraseña que revela si el email existe ("usuario no encontrado")
- Sistema de descuentos que no valida si el cupón es del usuario que lo aplica
- Carrito de compra donde el precio viene del cliente (puede modificarlo en el request)
- Sistema de votación sin protección contra votos duplicados
- Función de "olvidé mi contraseña" que manda link permanente sin expiración

**Cómo se audita**: revisión manual del flow de negocio. No hay scanner que detecte esto. Requiere entender el dominio del cliente.

## 3.6 A05 — Security Misconfiguration

**Qué es**: configuraciones por default, debug habilitado, paneles expuestos, permisos demasiado abiertos.

### 3.6.1 Lo más común

- **Debug mode en producción**: Django/Rails/Laravel exponen stack traces detallados, paths, variables, queries SQL
- **Paneles admin sin auth**: `/phpmyadmin`, `/admin`, `/kibana` expuestos a internet
- **Default credentials**: `admin/admin`, `tomcat/tomcat`, `root/root`
- **Directories listables**: `Index of /uploads/` mostrando todos los archivos
- **Backups expuestos**: `.git/`, `wp-config.php.bak`, `database.sql`
- **Verbose error messages** que revelan stack/versión

### 3.6.2 Cómo se audita

- Probar paths conocidos (`/admin`, `/wp-admin`, `/phpmyadmin`, `/.env`, `/.git/HEAD`)
- Forzar errores (paths inexistentes, parámetros inválidos) y leer respuestas
- Buscar archivos backup (`backup.zip`, `dump.sql`, `*.bak`)
- Revisar headers de respuesta por info de stack

## 3.7 A06 — Vulnerable Components

**Qué es**: usar librerías, frameworks, plugins con CVEs conocidos.

### 3.7.1 Cómo se evalúa

- Wappalyzer / BuiltWith detecta CMS y versión
- Headers (`Server`, `X-Powered-By`) revelan versiones
- JS bundles a veces exponen versiones (`jQuery v1.4.2`)
- `package.json` o `composer.json` filtrados accidentalmente
- Comparar contra base de datos pública: NVD (nvd.nist.gov), Snyk, GitHub Advisories

### 3.7.2 Lo realmente peligroso

- WordPress con plugins outdated (top vector de breaches en WP)
- Drupal sin update (Drupalgeddon)
- Frameworks PHP viejos (Laravel < 5.5)
- Librerías npm con vulnerabilities en transitive deps
- Imágenes Docker con base outdated

## 3.8 A07 — Authentication Failures

### 3.8.1 Password policies débiles

- Sin minimum length
- Sin requirements de complejidad razonables
- Sin protección contra passwords conocidas (HIBP)
- Permitir passwords como `12345678`, `qwerty`, etc.

### 3.8.2 Sin rate limiting

Si el endpoint de login no limita intentos, atacante puede probar 1000 passwords/min hasta que entre. Especialmente peligroso si:
- Tienes lista de emails de usuarios (de breaches públicos)
- Tu base de usuarios usa passwords débiles comunes

### 3.8.3 Account enumeration

El login responde diferente según si el email existe:
- "Usuario no encontrado" vs "Password incorrecto" → enumeración fácil
- Tiempo de respuesta diferente entre usuario existente / no existente → enumeración blind

**Fix**: mismo mensaje, mismo tiempo, en ambos casos. "Email o contraseña incorrectos".

### 3.8.4 Password reset débil

- Token de reset sin expiración
- Token predecible (timestamp + email)
- Token reutilizable
- Reset que no invalida sesiones existentes
- Reset que confirma si el email existe

### 3.8.5 Session management

- Sesión con lifetime infinito
- Cookie de sesión sin `HttpOnly` (accesible desde JS)
- Cookie sin `Secure` (viaja por HTTP en mixed content)
- Cookie sin `SameSite` (vulnerable a CSRF)
- Session ID en URL (queda en logs, history, Referer)
- Sesión no regenerada tras login (session fixation)

## 3.9 A08 — Software and Data Integrity Failures

### 3.9.1 Supply chain

- Instalar packages npm/pip sin pin de versión
- CI/CD que pulls de mirrors no oficiales
- Auto-updates sin verificación de firma
- Containers basados en imágenes no oficiales

### 3.9.2 Insecure deserialization

Cuando una app deserializa datos controlados por el atacante (pickle en Python, ObjectInputStream en Java, unserialize en PHP), el proceso de deserialización puede ejecutar código.

```python
# vulnerable
import pickle
data = pickle.loads(request.body)
```

El atacante manda un pickle malicioso que ejecuta código al deserializarse. RCE trivial.

**Fix**: usar formatos data-only (JSON) o validar/firmar el payload antes de deserializar.

### 3.9.3 Subresource Integrity (SRI)

Cuando cargas scripts/styles externos, agrega hash de integridad:
```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-abc123..."
        crossorigin="anonymous"></script>
```

Si el CDN es comprometido y modifica el archivo, el hash no coincide y el browser no lo ejecuta. Protección contra supply chain en CDNs.

## 3.10 A09 — Logging and Monitoring Failures

**Qué es**: si pasa algo malo, ¿te enterás?

Auditar:
- ¿Se loguean intentos de login fallidos?
- ¿Se loguean cambios sensibles (password, email, permisos)?
- ¿Se loguean accesos a recursos sensibles?
- ¿Hay alertas para patrones anómalos (1000 logins fallidos del mismo IP)?
- ¿Los logs son inmutables / firmados?
- ¿Hay retención adecuada (>90 días)?

**No es vulnerabilidad explotable directamente**, pero sin logging un breach se descubre meses después en lugar de minutos.

## 3.11 A10 — Server-Side Request Forgery (SSRF)

**Mecánica**: una funcionalidad legítima del server hace requests a URLs provistas por el usuario, y el atacante abusa de eso para que el server haga requests a recursos internos.

**Ejemplo**: app con feature "importar imagen desde URL":
```python
url = request.args["image_url"]
response = requests.get(url)
save(response.content)
```

Atacante envía `?image_url=http://169.254.169.254/latest/meta-data/`. En AWS, esa IP es el metadata service interno. El server (que está en AWS) accede al metadata, obtiene credenciales IAM temporales, las devuelve en la respuesta o las loggea. Atacante las captura.

**Variantes**:
- Acceder a servicios internos no expuestos a internet (Redis, BD, admin panels)
- Port scanning de la red interna desde el server
- Bypass de firewalls (el server está adentro)
- Cloud metadata (AWS, GCP, Azure tienen endpoints similares)

**Fix**:
- Allowlist de dominios permitidos (no blocklist)
- Resolver DNS antes de hacer request, bloquear IPs privadas (10.*, 172.16-31.*, 192.168.*, 169.254.*, 127.*, ::1)
- Network policies que bloqueen tráfico del server hacia metadata services y recursos internos

## 3.12 Categorías adicionales útiles

### 3.12.1 CSRF (Cross-Site Request Forgery)

**Mecánica**: un sitio malicioso hace que el navegador de la víctima envíe un request autenticado a tu sitio aprovechando que la víctima tiene sesión activa.

Ejemplo: víctima está logueada en `bank.com`. Visita `evil.com`. Esta página tiene:
```html
<form action="https://bank.com/transfer" method="POST">
  <input name="to" value="attacker">
  <input name="amount" value="10000">
</form>
<script>document.forms[0].submit()</script>
```

El browser envía el POST a bank.com con las cookies de sesión de la víctima. Bank.com lo procesa como request legítimo.

**Fix**:
- CSRF tokens (token random por sesión, validado en cada request state-changing)
- `SameSite=Lax` o `Strict` en cookies de sesión (default en browsers modernos)
- Verificar `Origin` / `Referer` header en requests sensibles

### 3.12.2 Race conditions

**Mecánica**: cuando varias operaciones concurrentes producen un resultado inconsistente porque no hay locking adecuado.

Ejemplo: usuario tiene 100€ de saldo. Envía dos requests simultáneos para retirar 100€ cada uno. Si el server hace:
```
1. Lee balance (100)
2. Verifica balance >= 100 (true)
3. Resta 100
4. Guarda nuevo balance (0)
```

Sin transacciones o locks, los dos requests leen 100 al mismo tiempo, ambos validan, ambos restan. Usuario retiró 200€ con saldo de 100.

**Fix**: transacciones con isolation level apropiado, locks pesimistas (`SELECT ... FOR UPDATE`), o atomic operations.

### 3.12.3 Mass assignment

**Mecánica**: framework que mapea automáticamente request params a campos de modelo, y el modelo tiene campos sensibles (`is_admin`, `verified`, `credits`).

```python
# Vulnerable
@app.post("/profile")
def update_profile():
    user.update(**request.json)  # acepta cualquier campo
```

Atacante envía `{"name": "Pedro", "is_admin": true}`. Si el modelo tiene `is_admin`, se actualiza.

**Fix**: allowlist explícita de campos permitidos. Frameworks modernos tienen mecanismos (Rails `strong_parameters`, Django `ModelForm` con fields explícitos, Pydantic con `model_validate` strict).

### 3.12.4 Open redirect

**Mecánica**: endpoint que redirige a URL provista por el usuario sin validar.

```
https://mysite.com/redirect?to=https://evil.com
```

Atacante usa esto en phishing: el link parece de mysite.com (dominio legítimo), pero termina en evil.com.

**Fix**: allowlist de URLs permitidas, o solo paths internos.

---

# PARTE 4 — Conectores transversales

## 4.1 Threat modeling — STRIDE

Marco para pensar amenazas sistemáticamente. Para cada componente:

- **S**poofing — alguien se hace pasar por otro (auth failures)
- **T**ampering — datos modificados sin autorización (integrity)
- **R**epudiation — alguien niega haber hecho algo (logging)
- **I**nformation disclosure — datos expuestos (confidentiality)
- **D**enial of service — sistema no disponible (availability)
- **E**levation of privilege — alguien gana permisos extra (authz)

Cada componente del sistema (frontend, API, BD, queue) se evalúa contra los 6. Esto te da un mapa exhaustivo de superficies a auditar.

## 4.2 CVSS — el lenguaje universal de severidad

Common Vulnerability Scoring System v3.1. Score 0-10 calculado de:

**Base metrics** (intrínsecas a la vulnerabilidad):
- Attack Vector (Network, Adjacent, Local, Physical)
- Attack Complexity (Low, High)
- Privileges Required (None, Low, High)
- User Interaction (None, Required)
- Scope (Unchanged, Changed)
- Impact: Confidentiality, Integrity, Availability (None, Low, High)

**Temporal metrics** (cambian con el tiempo):
- Exploit code maturity
- Remediation level
- Report confidence

**Environmental metrics** (específicas del entorno del cliente):
- Modificadores de impacto según criticidad del sistema

Ranges:
- 0.0 → None
- 0.1-3.9 → Low
- 4.0-6.9 → Medium
- 7.0-8.9 → High
- 9.0-10.0 → Critical

**Cómo usarlo en reports**: cada finding lleva su CVSS calculado. Permite priorización objetiva y comparación entre clientes. Calculadora oficial: `nvd.nist.gov/vuln-metrics/cvss/v3-calculator`.

## 4.3 CWE — taxonomía de debilidades

Common Weakness Enumeration. Catálogo de "tipos de debilidad" de software. Cada CVE referencia una CWE.

Ejemplos:
- CWE-79: XSS
- CWE-89: SQL Injection
- CWE-22: Path Traversal
- CWE-200: Information Exposure
- CWE-287: Improper Authentication
- CWE-352: CSRF
- CWE-918: SSRF

**Para reports**: cada finding debe llevar su CWE. Útil para:
- Comparar findings cross-cliente
- Identificar patrones (¿este cliente tiene muchos CWE-89? → entrenar al equipo en prepared statements)
- Mapear a estándares (PCI DSS, ISO 27001 referencian CWE)

## 4.4 Defense in depth — repaso aplicado

Para cada vulnerabilidad típica, listo los **múltiples controles redundantes** que la previenen. Esto es lo que diferencia un sitio "técnicamente OK" de uno realmente robusto:

### Anti-XSS
1. Input validation
2. Output encoding según contexto
3. CSP estricta sin unsafe-inline
4. HttpOnly cookies (limita impacto)
5. Framework moderno con escape por default
6. WAF como última línea

### Anti-SQLi
1. Prepared statements obligatorios
2. ORM bien usado (no `raw_query` con string concat)
3. Least-privilege en cuenta de BD
4. WAF como detección
5. Logging de queries anómalas
6. Database firewall

### Anti-CSRF
1. Anti-CSRF tokens
2. SameSite cookies
3. Custom headers (CORS preflight)
4. Verificación de Origin
5. Re-auth para acciones críticas

### Anti-IDOR
1. Authorization check en cada endpoint (no asumir)
2. UUIDs en lugar de IDs secuenciales (defense in depth)
3. Indirect references (mapear UUID → ID interno server-side)
4. Logging de accesos a recursos sensibles
5. Alertas por patrones anómalos (1 usuario accediendo a 1000 recursos)

## 4.5 La diferencia entre detectar y explotar

En Capa 2 sobre prod, **detectamos** (mandamos payload de marker que confirma vulnerabilidad sin explotarla). En staging, **explotamos** controladamente para confirmar impacto real.

| Vulnerabilidad | Detección "safe" | Explotación |
|---|---|---|
| SQLi | `'` o `1=1--`, observar comportamiento anómalo | `sqlmap --dbs` para enumerar BD |
| XSS | `<script>console.log("marker")</script>` con marker único | Robar cookies de session real |
| IDOR | Cambiar ID en URL, verificar respuesta | Enumerar rango completo, exfiltrar datos |
| SSRF | `http://127.0.0.1`, observar diferencia | Acceder a metadata cloud, exfiltrar credenciales |
| Command injection | `; sleep 5`, medir tiempo | Reverse shell |
| File upload | Archivo con extensión válida + contenido marker | Webshell ejecutable |

**Filosofía profesional**: en un audit pagado, no se explota más allá de lo necesario para confirmar el finding y poder explicarlo en el report. Más allá de eso es destrucción innecesaria o riesgo legal.

## 4.6 Reporting — convertir hallazgos en valor

Un finding bien escrito tiene:

1. **Título descriptivo y específico** — "SQLi en parámetro `q` de `/api/products/search`", no "SQLi en search".
2. **Categoría OWASP + CWE + CVSS** — para clasificación y priorización objetiva.
3. **Descripción del problema** — qué pasa técnicamente.
4. **Impacto** — qué puede hacer un atacante. Técnico Y de negocio.
5. **Evidencia** — sanitizada, sin payloads reutilizables fuera del contexto del cliente.
6. **Estado** — Confirmed / High Probability / Suspected.
7. **Remediation detallada** — con ejemplo de código si aplica.
8. **Referencias** — OWASP, CWE, blog posts autoritativos.

Lo que un finding **no** debe tener:
- Payloads completos reutilizables
- Datos extraídos
- Capturas de paneles administrativos
- Tono alarmista o vendedor

El report es un documento técnico profesional, no un sales pitch del próximo servicio.

## 4.7 La mentalidad del auditor profesional

Tres reglas que diferencian auditor de script kiddie:

**1. Reverence por el sistema en producción**
Cada request es una acción real sobre un sistema que sirve a usuarios reales. El audit tiene que ser invisible: ningún cliente legítimo debe notar que estamos testeando.

**2. Honestidad sobre lo que se confirmó**
No vender findings probables como confirmados. No inflar severidad para impresionar. Confidence calibration es lo que hace que tu próximo cliente confíe en tu word.

**3. Pensamiento sistémico**
Un finding individual rara vez es la historia completa. Si encontraste IDOR en `/api/orders/`, probablemente esté en `/api/invoices/`, `/api/addresses/`, etc. — porque indica una decisión de diseño sistémica, no un bug puntual. Auditar bien es ver patrones, no solo bugs.

---

# PARTE 5 — Recursos para profundizar

## 5.1 Libros fundamentales

- **The Web Application Hacker's Handbook** (Dafydd Stuttard, Marcus Pinto) — biblia del web pentesting, 2 edición.
- **Real-World Bug Hunting** (Peter Yaworski) — bug bounty con casos reales explicados.
- **The Tangled Web** (Michał Zalewski) — fundamentos profundos de seguridad web del autor de skipfish.
- **Threat Modeling: Designing for Security** (Adam Shostack) — STRIDE y otros marcos.

## 5.2 Recursos online estructurados

- **PortSwigger Web Security Academy** (gratis) — curriculum completo de vulnerabilidades web con labs.
- **OWASP Cheat Sheet Series** — referencia compacta para cada tipo de vulnerabilidad.
- **OWASP Testing Guide (WSTG)** — metodología de testing por categoría.
- **OWASP Top 10** — versión actualizada periódicamente.
- **HackTricks** — wiki técnica con técnicas concretas (usar con criterio ético).

## 5.3 Estándares y compliance

- **OWASP ASVS** (Application Security Verification Standard) — checklist exhaustivo para auditar/desarrollar.
- **OWASP MASVS** — equivalente para mobile.
- **NIST 800-53** — controles de seguridad para sistemas federales US (referencia general).
- **ISO 27001** — gestión de seguridad de la información.
- **ENS** — Esquema Nacional de Seguridad (España, sector público).
- **PCI DSS** — si el cliente procesa tarjetas.

## 5.4 Para mantenerse actualizado

- **PortSwigger Daily Swig** — noticias y research.
- **HackerOne Hacktivity** — disclosed reports, learning real.
- **Mozilla Observatory** y **OWASP Cheat Sheets** — actualizan cuando cambian las recomendaciones.
- **CVE feeds** del NVD para vulnerabilidades específicas.

---

# Cierre

Este documento es la base teórica. La pericia real se construye **aplicando esto sobre sistemas reales** con consent escrito, gradualmente, y revisando cada audit con perspectiva crítica.

Cada cliente que audites te va a enseñar algo nuevo: un patrón de error que se repite, una librería con problemas sistémicos, una decisión de diseño que se ve en muchos sitios. Esa experiencia acumulada es lo que diferencia al senior del junior — no la cantidad de herramientas que sabes usar, sino la cantidad de patrones que reconocés a primera vista.

La seguridad web es un campo donde se aprende eternamente. Asumir que ya sabés todo es exactamente cuando algo nuevo te sorprende.

---

**FIN del knowledge base v0.1**

Próximas revisiones: agregar secciones específicas sobre seguridad de APIs (OWASP API Top 10), seguridad mobile (MASVS), seguridad cloud (CSP - Cloud Security Posture), y patrones específicos de e-commerce/marketplaces/fintech a medida que se acumule experiencia en estos verticales.