# 🌐 Configuración de Nginx en Digital Ocean

## 📊 Estado Actual

**Servidor:** 142.93.47.46  
**Dominio Anterior:** api.random-studio.io  
**Dominio Nuevo:** api.random-lab.es  
**Puerto Backend:** 8000 (FastAPI local)  
**SSL/TLS:** Let's Encrypt (Certbot)

---

## 📁 Estructura de Archivos Nginx

### Ubicaciones Importantes

```
/etc/nginx/
├── sites-available/
│   └── brain-backend          # Configuración del sitio
├── sites-enabled/
│   └── brain-backend          # Symlink → sites-available/brain-backend
└── nginx.conf                 # Configuración principal
```

### Certificados SSL

```
/etc/letsencrypt/live/api.random-studio.io/
├── fullchain.pem              # Certificado completo
├── privkey.pem                # Clave privada
├── cert.pem                   # Certificado
└── chain.pem                  # Cadena de certificados
```

---

## 🔧 Configuración Actual

**Archivo:** `/etc/nginx/sites-available/brain-backend`

```nginx
server {
    server_name api.random-studio.io;

    # Logs
    access_log /var/log/nginx/brain-backend-access.log;
    error_log /var/log/nginx/brain-backend-error.log;

    # Max upload size
    client_max_body_size 100M;

    # Timeouts extendidos para operaciones largas
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    # Proxy al backend FastAPI (corre en localhost:8000)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        
        # Headers necesarios para que el backend conozca el cliente real
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (por si se necesita en el futuro)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Root endpoint como health check
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSL Configuration (managed by Certbot)
    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/api.random-studio.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.random-studio.io/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# Redirect HTTP to HTTPS
server {
    if ($host = api.random-studio.io) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name api.random-studio.io;
    return 404;
}
```

---

## 🎯 Función de Cada Componente

### 1. Proxy Reverso
```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    ...
}
```
**Qué hace:** Nginx recibe requests en el puerto 443 (HTTPS) y los reenvía al backend FastAPI que corre en puerto 8000 internamente.

**Por qué:** 
- Permite usar SSL/TLS (el backend no tiene que manejar HTTPS)
- Oculta el puerto interno del backend
- Permite múltiples servicios en el mismo servidor

### 2. Headers de Proxy
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```
**Qué hace:** Pasa información del cliente original al backend.

**Por qué:**
- El backend necesita saber la IP real del cliente (para analytics, logs)
- CORS necesita el Host correcto
- Logging y seguridad requieren la IP original

### 3. Timeouts Extendidos
```nginx
proxy_connect_timeout 600;
proxy_send_timeout 600;
proxy_read_timeout 600;
```
**Qué hace:** Permite que las operaciones del backend tomen hasta 10 minutos.

**Por qué:**
- El procesamiento EEG puede ser lento
- Análisis de datos grandes requiere tiempo
- Evita timeouts en operaciones largas

### 4. Upload Size
```nginx
client_max_body_size 100M;
```
**Qué hace:** Permite uploads de hasta 100MB.

**Por qué:**
- Los archivos EEG pueden ser grandes
- Múltiples experimentos en un batch
- Archivos de sesiones de meditación

---

## 🔄 Cambio de Dominio: random-studio.io → random-lab.es

### ✅ Paso 1: Verificar DNS
```bash
# Desde tu Mac, verifica que el dominio apunte al servidor
dig api.random-lab.es

# Debería mostrar:
# api.random-lab.es.  300  IN  A  142.93.47.46
```

### ✅ Paso 2: Backup de la Configuración Actual
```bash
ssh root@142.93.47.46 "cp /etc/nginx/sites-available/brain-backend /etc/nginx/sites-available/brain-backend.backup"
```

### 🔧 Paso 3: Actualizar Configuración de Nginx

Conecta al servidor y edita el archivo:

```bash
ssh root@142.93.47.46
nano /etc/nginx/sites-available/brain-backend
```

**Cambios a realizar:**

1. **Línea 2:** Cambiar `server_name`
```nginx
# Antes:
server_name api.random-studio.io;

# Después:
server_name api.random-lab.es;
```

2. **Línea ~48:** Cambiar el `if` del redirect
```nginx
# Antes:
if ($host = api.random-studio.io) {

# Después:
if ($host = api.random-lab.es) {
```

3. **Línea ~54:** Cambiar `server_name` del bloque HTTP
```nginx
# Antes:
server_name api.random-studio.io;

# Después:
server_name api.random-lab.es;
```

### 🔐 Paso 4: Obtener Nuevo Certificado SSL

**IMPORTANTE:** Primero debes remover las líneas de SSL actuales porque Certbot las regenerará.

Edita el archivo y **comenta o elimina** estas líneas (aproximadamente líneas 38-43):

```nginx
# Comentar estas líneas:
# listen [::]:443 ssl ipv6only=on;
# listen 443 ssl;
# ssl_certificate /etc/letsencrypt/live/api.random-studio.io/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/api.random-studio.io/privkey.pem;
# include /etc/letsencrypt/options-ssl-nginx.conf;
# ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
```

Y cambia el listen a solo HTTP temporalmente:
```nginx
# Agregar esto en su lugar:
listen 80;
listen [::]:80;
```

Guarda y cierra el archivo (`Ctrl+X`, `Y`, `Enter`).

Ahora obtén el certificado SSL:

```bash
# Instalar certbot si no está (probablemente ya está)
apt update
apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL para el nuevo dominio
certbot --nginx -d api.random-lab.es

# Certbot preguntará:
# - Email: tu-email@ejemplo.com
# - Aceptar términos: Yes
# - ¿Redirect HTTP → HTTPS?: 2 (Redirect)
```

**Certbot automáticamente:**
- ✅ Obtendrá el certificado de Let's Encrypt
- ✅ Actualizará la configuración de nginx
- ✅ Configurará el redirect HTTP → HTTPS
- ✅ Programará la renovación automática

### ✅ Paso 5: Verificar Configuración

```bash
# Test de sintaxis de nginx
nginx -t

# Deberías ver:
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 🚀 Paso 6: Reiniciar Nginx

```bash
systemctl restart nginx
systemctl status nginx

# Verificar que esté activo
```

### 🔍 Paso 7: Verificar que Funcione

```bash
# En el servidor:
curl https://api.random-lab.es/

# Desde tu Mac:
curl https://api.random-lab.es/

# Deberías ver:
# {"status":"active","message":"Syntergic VAE Online"}
```

---

## 🛠️ Comandos de Mantenimiento

### Ver Logs en Tiempo Real
```bash
# Access logs (requests que llegan)
tail -f /var/log/nginx/brain-backend-access.log

# Error logs
tail -f /var/log/nginx/brain-backend-error.log

# Logs del backend FastAPI
journalctl -u brain-backend -f
```

### Renovación de Certificados SSL
```bash
# Verificar cuándo expiran los certificados
certbot certificates

# Renovar manualmente (aunque se renueva automáticamente)
certbot renew

# Test de renovación (dry-run)
certbot renew --dry-run
```

### Recargar Configuración (sin downtime)
```bash
# Después de cambios menores
nginx -s reload

# O con systemctl
systemctl reload nginx
```

### Restart Completo
```bash
# Solo si reload no es suficiente
systemctl restart nginx
```

---

## 📱 Actualizar el Frontend

Después de cambiar el dominio del backend, necesitas actualizar las URLs en el frontend.

### Archivos a Modificar

**IMPORTANTE:** Buscar y reemplazar en todo el proyecto:

```bash
# En tu Mac:
cd /Users/pedronassiff/Desktop/proyectos/random

# Buscar todas las referencias al dominio viejo
grep -r "random-studio.io" src/
grep -r "random-studio.io" .env*

# Probablemente en:
# - src/lib/analyticsService.js
# - src/services/analyticsApi.js
# - src/services/automationApi.js
# - .env.production
# - .env
```

**Cambio a realizar:**

```javascript
// Antes:
const API_URL = 'https://api.random-studio.io';

// Después:
const API_URL = 'https://api.random-lab.es';
```

### Verificar Variables de Entorno en Vercel

1. Ve a tu dashboard de Vercel
2. Proyecto → Settings → Environment Variables
3. Busca variables tipo `API_URL`, `VITE_API_URL`, etc.
4. Actualiza de `api.random-studio.io` → `api.random-lab.es`
5. Redeploy el proyecto

---

## 🔒 Seguridad

### Headers de Seguridad (Opcional pero Recomendado)

Agregar al bloque `server` en nginx:

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;

# CORS (si el frontend está en otro dominio)
add_header Access-Control-Allow-Origin "https://random-lab.es" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
```

### Rate Limiting (Opcional)

Para prevenir abuso:

```nginx
# En /etc/nginx/nginx.conf (en el bloque http)
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# En el location / del sitio
location / {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://127.0.0.1:8000;
    ...
}
```

---

## 📋 Checklist de Migración

- [ ] DNS apuntando a 142.93.47.46
- [ ] Backup de configuración actual
- [ ] Actualizar `server_name` en nginx (3 lugares)
- [ ] Comentar líneas SSL antiguas
- [ ] Ejecutar certbot para nuevo dominio
- [ ] Verificar nginx -t
- [ ] Reiniciar nginx
- [ ] Probar curl https://api.random-lab.es/health
- [ ] Actualizar URLs en frontend
- [ ] Actualizar variables de entorno en Vercel
- [ ] Verificar analytics funcionan
- [ ] Verificar logs no muestran errores
- [ ] (Opcional) Mantener dominio viejo por un mes redirigiendo al nuevo

---

## 🚨 Troubleshooting

### Error: "nginx: configuration file test failed"
```bash
# Ver el error específico
nginx -t

# Verificar sintaxis del archivo
cat /etc/nginx/sites-available/brain-backend
```

### Error: "Connection refused"
```bash
# Verificar que el backend esté corriendo
systemctl status brain-backend

# Verificar que escuche en puerto 8000
ss -tlnp | grep 8000
```

### Error: "SSL certificate problem"
```bash
# Ver certificados instalados
certbot certificates

# Renovar certificado
certbot renew --force-renewal

# Si todo falla, eliminar y recrear
certbot delete --cert-name api.random-studio.io
certbot --nginx -d api.random-lab.es
```

### Error: "502 Bad Gateway"
Significa que nginx no puede conectar con el backend:

```bash
# 1. Verificar que el backend esté corriendo
systemctl status brain-backend
systemctl restart brain-backend

# 2. Ver logs del backend
journalctl -u brain-backend -n 50

# 3. Ver logs de nginx
tail -n 50 /var/log/nginx/brain-backend-error.log
```

### Analytics no funcionan
```bash
# 1. Verificar CORS en el backend
curl -H "Origin: https://random-lab.es" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.random-lab.es/api/analytics

# 2. Verificar que las requests lleguen
tail -f /var/log/nginx/brain-backend-access.log

# 3. Ver errores del backend
journalctl -u brain-backend -f
```

---

## 📚 Recursos Adicionales

- [Nginx Documentation](https://nginx.org/en/docs/)
- [Certbot Documentation](https://certbot.eff.org/)
- [Let's Encrypt](https://letsencrypt.org/)
- [Digital Ocean Nginx Tutorials](https://www.digitalocean.com/community/tags/nginx)

---

**Fecha de creación:** 16 de Febrero, 2026  
**Última actualización:** 16 de Febrero, 2026  
**Servidor:** random-backend (Digital Ocean)  
**IP:** 142.93.47.46
