# 🚀 Deploy Backend en Digital Ocean

Esta guía te ayudará a desplegar el backend del Brain Prototype (FastAPI + PyTorch) en Digital Ocean.

---

## 📋 Requisitos

- Cuenta en [Digital Ocean](https://www.digitalocean.com/)
- SSH configurado en tu máquina local
- Git instalado

---

## 🎯 Opción 1: Droplet + App Platform (Recomendado)

### Paso 1: Crear Droplet

1. **Crear Droplet en Digital Ocean**
   - Ve a [cloud.digitalocean.com/droplets](https://cloud.digitalocean.com/droplets)
   - Click en **Create → Droplets**
   
2. **Configuración del Droplet**
   ```
   Image: Ubuntu 22.04 LTS
   Plan: Basic
   CPU Options: Regular (2GB RAM / 1 vCPU) - $12/mes
   Datacenter: Nueva York o el más cercano
   Authentication: SSH Key (agregar la tuya)
   Hostname: brain-backend
   ```

3. **Crear y esperar** (~1 minuto)

4. **Copiar IP del droplet** (ej: `143.198.123.45`)

---

### Paso 2: Configurar el Servidor

#### SSH al servidor
```bash
ssh root@TU_IP_DROPLET
```

#### Actualizar sistema
```bash
apt update && apt upgrade -y
```

#### Instalar dependencias del sistema
```bash
# Python 3.11
apt install -y python3.11 python3.11-venv python3-pip

# Git
apt install -y git

# Nginx (reverse proxy)
apt install -y nginx

# Certbot (SSL gratis)
apt install -y certbot python3-certbot-nginx

# Build tools (para compilar paquetes de Python)
apt install -y build-essential python3-dev

# PostgreSQL
apt install -y postgresql postgresql-contrib

# InfluxDB 2
wget -q https://repos.influxdata.com/influxdata-archive_compat.key
echo '393e8779c89ac8d958f81f942f9ad7fb82a25e133faddaf92e15b16e6ac9ce4c influxdata-archive_compat.key' | sha256sum -c && cat influxdata-archive_compat.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null
echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | tee /etc/apt/sources.list.d/influxdata.list
apt update && apt install -y influxdb2
```

---

### Paso 3: Configurar PostgreSQL

```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Dentro de psql, crear AMBAS bases de datos:

-- 1. Database para Brain Prototype (EEG, sesiones)
CREATE DATABASE syntergic_brain;
CREATE USER brain_user WITH PASSWORD 'sintergic2024';
GRANT ALL PRIVILEGES ON DATABASE brain_prototype TO brain_user;

-- 2. Database para Analytics del Portfolio Random
CREATE DATABASE random_analytics;
CREATE USER analytics_user WITH PASSWORD 'random_sanyi_mapuche';
GRANT ALL PRIVILEGES ON DATABASE random_analytics TO analytics_user;

-- Verificar que se crearon correctamente
\l

-- Salir
\q
```

**Importante**: Guarda ambos passwords en un lugar seguro, los necesitarás después.

---

### Paso 4: Configurar InfluxDB

```bash
# Iniciar InfluxDB
systemctl start influxdb
systemctl enEjecutar Migraciones de Analytics

token influxDB
A4mWRtbh5cYFaMZV3FL_HP9cCRL-MGhzvYQWqDKBme86O6r2VKaVSKLP_ullJ65aOt9uSmbuVGhGHwyT1imIAg==


**Antes de clonar el proyecto**, ejecuta la migración SQL para Analytics:
scp teoria-sintergica/brain-prototype/backend/database/migrations/001_create_analytics_schema.sql root@142.93.47.46:/tmp/
```bash
# Primero, crea el archivo de migración temporalmente
nano /tmp/analytics_migration.sql
```

**Copia TODO el contenido** del archivo `/backend/database/migrations/001_create_analytics_schema.sql` aquí.

Luego ejecuta la migración:

```bash
# Conectar a PostgreSQL como postgres
sudo -u postgres psql -d random_analytics -f /tmp/analytics_migration.sql

# Verificar que las tablas se crearon
sudo -u postgres psql -d random_analytics -c "\dt"

# Deberías ver: users, sessions, pageviews, events, engagement_zones, conversions
```

**Nota**: Si ya tienes el repo clonado localmente, puedes subir el archivo SQL al servidor con `scp`:
```bash
# Desde tu máquina local:
scp backend/database/migrations/001_create_analytics_schema.sql root@TU_IP_DROPLET:/tmp/
```

---

### Paso 6: Clonar y Configurar el Proyecto

```bash
# Crear usuario para la app (seguridad)
adduser --disabled-password --gecos "" brain
su - brain

# Clonar repo
cd ~
git clone https://github.com/TU_USUARIO/random.git
cd random/teoria-sintergica/brain-prototype/backend

# Crear entorno virtual
python3.11 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# IMPORTANTE: Instalar asyncpg para Analytics
pip install asyncpg

# Crear archivo .env
nano .env
```

#### Contenido de `.env`:
```bash
# Brain Database
DATABASE_URL=postgresql://brain_user:sintergic2024@localhost:5432/brain_prototype

# InfluxDB (para time-series del brain)
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=A4mWRtbh5cYFaMZV3FL_HP9cCRL-MGhzvYQWqDKBme86O6r2VKaVSKLP_ullJ65aOt9uSmbuVGhGHwyT1imIAg==
INFLUXDB_ORG=syntergic
INFLUXDB_BUCKET=brain_sessions

# Analytics Database (para portfolio Random)
ANALYTICS_DB_HOST=localhost
ANALYTICS_DB_PORT=5432
ANALYTICS_DB_USER=analytics_user
ANALYTICS_DB_PASSWORD=random_sanyi_mapuche
ANALYTICS_DB_NAME=random_analytics

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=https://random-studio.io,https://www.random-studio.io

# Hardware (opcional - si vas a conectar Muse)
MUSE_ENABLE=true
```

#### Guardar y salir: `Ctrl+X`, `Y`, `Enter`

---

### Paso 6: Configurar Systemd (Auto-inicio)

Salir del8usuario `brain`:
```bash
exit  # Volver a root
```

Crear servicio:
```bash
nano /etc/systemd/system/brain-backend.service
```

#### Contenido del servicio:
```ini
[Unit]
Description=Syntergic Brain Backend (FastAPI)
After=network.target postgresql.service influxdb.service

[Service]
Type=simple
User=brain
WorkingDirectory=/home/brain/random/teoria-sintergica/brain-prototype/backend
Environment="PATH=/home/brain/random/teoria-sintergica/brain-prototype/backend/venv/bin"
ExecStart=/home/brain/random/teoria-sintergica/brain-prototype/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Iniciar servicio:
```bash
systemctl daemon-reload
systemctl start brain-backend
systemctl enable brain-backend

# Verificar que está corriendo
systemctl status brain-backend
```

---

### Paso 7: Configurar Nginx (Reverse Proxy)

```bash
nano /etc/nginx/sites-available/brain-backend
```

#### Contenido:
```nginx
server {
    listen 80;
    server_name api.tu-dominio.com;  # Cambia por tu dominio o IP

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_read_timeout 86400;
    }
}
```

#### Activar configuración:
```bash
ln -s /etc/nginx/sites-available/brain-backend /etc/nginx/sites-enabled/
nginx -t  # Verificar configuración
systemctl restart nginx
```

---

### Paso 9: SSL/HTTPS con Let's Encrypt (Opcional pero Recomendado)

```bash
# Solo si tienes un dominio apuntando al servidor
certbot --nginx -d api.tu-dominio.com

# Seguir las instrucciones:
# - Email: tu@email.com
# - Términos: Aceptar
# - Redirect HTTP → HTTPS: Yes
```

Certbot automáticamente:
✅ Genera certificado SSL  
✅ Configura Nginx para HTTPS  
✅ Configura auto-renovación  

---

## 🧪 Verificar Deploy

### Desde el navegador:
```
http://TU_IP_DROPLET/
# O si configuraste SSL:
https://api.tu-dominio.com/
```

Deberías ver:
```json
{
  "message": "Syntergic Brain API is running",
  "version": "0.4"
}
```

### Desde terminal:
```bash
curl http://TU_IP_DROPLET/
```

### WebSocket:
```bash
# Instalar wscat
npm install -g wscat

# Conectar
wscat -c ws://TU_IP_DROPLET/ws/brain-state
```

---

## 🔄 Actualizar el Backend

```bash
# SSH al servidor
ssh root@TU_IP_DROPLET

# Cambiar a usuario brain
su - brain

# Ir al directorio
cd ~/random/teoria-sintergica/brain-prototype/backend

# Pull cambios
git pull origin main

# Activar venv
source venv/bin/activate

# Actualizar dependencias (si cambió requirements.txt)
pip install -r requirements.txt

# Salir
exit

# Reiniciar servicio
systemctl restart brain-backend

# Verificar logs
journalctl -u brain-backend -f
```

---

## 📊 Monitoreo

### Ver logs en tiempo real:
```bash
journalctl -u brain-backend -f
```

### Ver estado del servicio:
```bash
systemctl status brain-backend
```

### Ver uso de recursos:
```bash
htop
```

---

## 🐛 Troubleshooting

### Backend no inicia

```bash
# Ver logs detallados
journalctl -u brain-backend -n 100 --no-pager

# Verificar permisos
ls -la /home/brain/random/teoria-sintergica/brain-prototype/backend/

# Verificar que Python encuentra los módulos
su - brain
cd ~/random/teoria-sintergica/brain-prototype/backend
source venv/bin/activate
python -c "import fastapi; print('FastAPI OK')"
python -c "import torch; print('PyTorch OK')"
```

### Base de datos no conecta

```bash
# Verificar PostgreSQL
systemctl status postgresql

# Listar databases
sudo -u postgres psql -l

# Conectar a database de Analytics y verificar tablas
sudo -u postgres psql -d random_analytics -c "\dt"

# Conectar a database del Brain
sudo -u postgres psql -d syntergic_brain -c "\dt"

# Verificar InfluxDB
systemctl status influxdb
curl http://localhost:8086/health
```

### Analytics no funciona

```bash
# Verificar que las tablas existen
sudo -u postgres psql -d random_analytics -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Verificar conexión desde Python
su - brain
cd ~/random/teoria-sintergica/brain-prototype/backend
source venv/bin/activate
python -c "import asyncpg; print('asyncpg OK')"

# Test health endpoint
curl http://localhost:8000/analytics/health
```

### Nginx error 502

```bash
# Verificar que backend está corriendo
systemctl status brain-backend

# Verificar logs de Nginx
tail -f /var/log/nginx/error.log
```

### Memoria insuficiente (PyTorch es pesado)

Si el modelo no carga:
```bash
# Aumentar swap (memoria virtual)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

O considera aumentar el plan del Droplet a 4GB RAM.

---

## 🔒 Seguridad

### Firewall
```bash
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

### Fail2Ban (protección contra brute force)
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### Cambiar puerto SSH (opcional)
```bash
nano /etc/ssh/sshd_config
# Cambiar: Port 22 → Port 2222
systemctl restart sshd

# Actualizar firewall
ufw allow 2222
ufw delete allow ssh
```

---

## 💰 Costos Estimados

| Servicio | Plan | Costo/mes |
|----------|------|-----------|
| Droplet (2GB) | Basic | $12 |
| Droplet (4GB) | Basic | $24 |
| Backup semanal | Opcional | +20% |
| **Total** | | **$12-24** |

---

## 🎯 Opción 2: Docker Compose (Avanzado)

Si prefieres usar Docker:

### Crear `Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Crear `docker-compose.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://brain_user:password@postgres:5432/syntergic_brain
      - INFLUXDB_URL=http://influxdb:8086
    depends_on:
      - postgres
      - influxdb
    restart: always

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: syntergic_brain
      POSTGRES_USER: brain_user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  influxdb:
    image: influxdb:2.7
    ports:
      - "8086:8086"
    volumes:
      - influxdb_data:/var/lib/influxdb2
    environment:
      - DOCKER_INFLUXDB_INIT_MODE=setup
      - DOCKER_INFLUXDB_INIT_USERNAME=admin
      - DOCKER_INFLUXDB_INIT_PASSWORD=adminpassword
      - DOCKER_INFLUXDB_INIT_ORG=syntergic
      - DOCKER_INFLUXDB_INIT_BUCKET=brain_sessions
    restart: always

volumes:
  postgres_data:
  influxdb_data:
```

### Deploy con Docker:
```bash
# En el servidor
apt install -y docker.io docker-compose
cd ~/random/teoria-sintergica/brain-prototype/backend
docker-compose up -d
```

---

## 📚 Recursos Adicionales

- [Digital Ocean Docs](https://docs.digitalocean.com/)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/)

---

## ✅ Checklist de Deploy

- [ ] Droplet creado y configurado
- [ ] PostgreSQL instalado
- [ ] **2 Databases creadas**: `syntergic_brain` + `random_analytics`
- [ ] **2 Usuarios creados**: `brain_user` + `analytics_user`
- [ ] InfluxDB instalado y configurado
- [ ] **Migración de Analytics ejecutada** (6 tablas)
- [ ] Código clonado
- [ ] Dependencias instaladas (`pip install -r requirements.txt` + `asyncpg`)
- [ ] Variables de entorno configuradas (`.env` completo)
- [ ] Servicio systemd creado y activo
- [ ] Nginx configurado
- [ ] SSL/HTTPS configurado (opcional)
- [ ] Firewall configurado
- [ ] Logs verificados
- [ ] WebSocket funcional
- [ ] Frontend conectado al backend
- [ ] **Analytics endpoints funcionando** (`/analytics/health`)

---

🎉 **¡Felicidades! Tu backend ya está en producción.**

Para soporte: revisa los logs con `journalctl -u brain-backend -f`
