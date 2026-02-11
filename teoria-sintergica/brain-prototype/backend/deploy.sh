#!/bin/bash

# 🚀 Script de Deploy Automatizado para Digital Ocean
# Este script ayuda a automatizar el despliegue del backend

set -e  # Salir si hay algún error

echo "================================================================"
echo "  🧠 SYNTERGIC BRAIN BACKEND - DEPLOY SCRIPT"
echo "================================================================"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir con color
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}➜ $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "main.py" ]; then
    print_error "Este script debe ejecutarse desde el directorio backend/"
    exit 1
fi

# Menú principal
echo "Selecciona una opción:"
echo ""
echo "1) Deploy inicial en servidor nuevo"
echo "2) Actualizar código en servidor existente"
echo "3) Ver logs del servidor"
echo "4) Verificar estado del servicio"
echo "5) Generar archivo .env"
echo "0) Salir"
echo ""
read -p "Opción: " option

case $option in
    1)
        echo ""
        print_info "DEPLOY INICIAL - Configuración de servidor nuevo"
        echo ""
        
        # Pedir IP del servidor
        read -p "IP del Droplet: " SERVER_IP
        
        if [ -z "$SERVER_IP" ]; then
            print_error "Debes proporcionar la IP del servidor"
            exit 1
        fi
        
        print_info "Conectando a $SERVER_IP..."
        
        # Script que se ejecutará en el servidor remoto
        ssh root@$SERVER_IP << 'ENDSSH'
            set -e
            
            echo "📦 Actualizando sistema..."
            apt update && apt upgrade -y
            
            echo "🐍 Instalando Python 3.11..."
            apt install -y python3.11 python3.11-venv python3-pip git nginx
            
            echo "🗄️ Instalando PostgreSQL..."
            apt install -y postgresql postgresql-contrib
            
            echo "📊 Instalando InfluxDB..."
            wget -q https://repos.influxdata.com/influxdata-archive_compat.key
            cat influxdata-archive_compat.key | gpg --dearmor | tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null
            echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | tee /etc/apt/sources.list.d/influxdata.list
            apt update && apt install -y influxdb2
            systemctl start influxdb
            systemctl enable influxdb
            
            echo "👤 Creando usuario 'brain'..."
            if ! id -u brain > /dev/null 2>&1; then
                adduser --disabled-password --gecos "" brain
            fi
            
            echo "✅ Servidor configurado!"
            echo ""
            echo "PRÓXIMOS PASOS:"
            echo "1. Configura PostgreSQL: sudo -u postgres psql"
            echo "2. Configura InfluxDB: http://$SERVER_IP:8086"
            echo "3. Ejecuta la opción 2 para subir el código"
ENDSSH
        
        print_success "Configuración inicial completada!"
        ;;
        
    2)
        echo ""
        print_info "ACTUALIZACIÓN DE CÓDIGO"
        echo ""
        
        read -p "IP del Droplet: " SERVER_IP
        
        if [ -z "$SERVER_IP" ]; then
            print_error "Debes proporcionar la IP del servidor"
            exit 1
        fi
        
        # Verificar que estamos en un repo git
        if [ ! -d ".git" ]; then
            print_error "Este directorio no es un repositorio git"
            print_info "Inicializa git primero: git init && git add . && git commit -m 'Initial commit'"
            exit 1
        fi
        
        # Obtener la rama actual
        BRANCH=$(git rev-parse --abbrev-ref HEAD)
        
        print_info "Haciendo push a origin/$BRANCH..."
        git push origin $BRANCH
        
        print_info "Actualizando código en el servidor..."
        
        ssh root@$SERVER_IP << ENDSSH
            set -e
            
            # Cambiar a usuario brain
            sudo -u brain bash << 'INNEREOF'
                cd ~/random/teoria-sintergica/brain-prototype/backend
                
                echo "📥 Pulling latest changes..."
                git pull origin $BRANCH
                
                echo "🔄 Activando entorno virtual..."
                source venv/bin/activate
                
                echo "📦 Actualizando dependencias..."
                pip install -r requirements.txt
                
                echo "✅ Código actualizado!"
INNEREOF
            
            echo "🔄 Reiniciando servicio..."
            systemctl restart brain-backend
            
            echo "⏳ Esperando 5 segundos..."
            sleep 5
            
            echo "📊 Estado del servicio:"
            systemctl status brain-backend --no-pager -l
ENDSSH
        
        print_success "Código actualizado y servicio reiniciado!"
        ;;
        
    3)
        echo ""
        print_info "LOGS DEL SERVIDOR"
        echo ""
        
        read -p "IP del Droplet: " SERVER_IP
        read -p "Número de líneas (default: 50): " LINES
        LINES=${LINES:-50}
        
        print_info "Mostrando últimas $LINES líneas..."
        
        ssh root@$SERVER_IP "journalctl -u brain-backend -n $LINES --no-pager"
        
        echo ""
        read -p "¿Ver logs en tiempo real? (y/n): " FOLLOW
        
        if [ "$FOLLOW" = "y" ] || [ "$FOLLOW" = "Y" ]; then
            print_info "Siguiendo logs (Ctrl+C para salir)..."
            ssh root@$SERVER_IP "journalctl -u brain-backend -f"
        fi
        ;;
        
    4)
        echo ""
        print_info "ESTADO DEL SERVICIO"
        echo ""
        
        read -p "IP del Droplet: " SERVER_IP
        
        ssh root@$SERVER_IP << 'ENDSSH'
            echo "📊 Estado del servicio brain-backend:"
            systemctl status brain-backend --no-pager -l
            echo ""
            echo "📊 PostgreSQL:"
            systemctl status postgresql --no-pager | head -n 5
            echo ""
            echo "📊 InfluxDB:"
            systemctl status influxdb --no-pager | head -n 5
            echo ""
            echo "🌐 Nginx:"
            systemctl status nginx --no-pager | head -n 5
            echo ""
            echo "💾 Uso de disco:"
            df -h / | tail -n 1
            echo ""
            echo "🧠 Uso de memoria:"
            free -h | grep Mem
ENDSSH
        ;;
        
    5)
        echo ""
        print_info "GENERADOR DE ARCHIVO .env"
        echo ""
        
        read -p "PostgreSQL User: " PG_USER
        read -sp "PostgreSQL Password: " PG_PASS
        echo ""
        read -p "PostgreSQL Database: " PG_DB
        read -p "InfluxDB URL (default: http://localhost:8086): " INFLUX_URL
        INFLUX_URL=${INFLUX_URL:-http://localhost:8086}
        read -p "InfluxDB Token: " INFLUX_TOKEN
        read -p "InfluxDB Organization: " INFLUX_ORG
        read -p "InfluxDB Bucket: " INFLUX_BUCKET
        read -p "CORS Origins (separados por coma): " CORS_ORIGINS
        
        cat > .env << EOF
# Database
DATABASE_URL=postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}

# InfluxDB
INFLUXDB_URL=${INFLUX_URL}
INFLUXDB_TOKEN=${INFLUX_TOKEN}
INFLUXDB_ORG=${INFLUX_ORG}
INFLUXDB_BUCKET=${INFLUX_BUCKET}

# API Settings
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=${CORS_ORIGINS}

# Hardware (opcional)
MUSE_ENABLE=false
EOF
        
        print_success "Archivo .env generado!"
        echo ""
        print_info "⚠️  IMPORTANTE: No subas este archivo a Git"
        print_info "Añade .env al .gitignore si no lo está ya"
        
        if [ ! -f ".gitignore" ] || ! grep -q ".env" .gitignore; then
            read -p "¿Agregar .env al .gitignore? (y/n): " ADD_GITIGNORE
            if [ "$ADD_GITIGNORE" = "y" ] || [ "$ADD_GITIGNORE" = "Y" ]; then
                echo ".env" >> .gitignore
                print_success ".env agregado al .gitignore"
            fi
        fi
        ;;
        
    0)
        print_info "Saliendo..."
        exit 0
        ;;
        
    *)
        print_error "Opción inválida"
        exit 1
        ;;
esac

echo ""
print_success "¡Proceso completado!"
echo ""
