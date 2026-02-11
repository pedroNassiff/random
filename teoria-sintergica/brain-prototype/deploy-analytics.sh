#!/bin/bash

# Script para subir código de analytics al servidor de producción

echo "📤 Subiendo código de analytics a producción..."
echo ""

SERVER="root@142.93.47.46"
REMOTE_BACKEND="/home/brain/random/teoria-sintergica/brain-prototype/backend"

# 1. Crear directorio analytics en el servidor
echo "📁 Creando directorio analytics..."
ssh $SERVER "mkdir -p $REMOTE_BACKEND/analytics"

# 2. Subir archivos de analytics
echo "📤 Subiendo archivos de analytics..."
scp -r backend/analytics/* $SERVER:$REMOTE_BACKEND/analytics/

# 3. Subir .env actualizado
echo "📤 Subiendo .env actualizado..."
scp backend/.env $SERVER:$REMOTE_BACKEND/.env

# 4. Verificar que los archivos estén en el servidor
echo "✅ Verificando archivos..."
ssh $SERVER "ls -la $REMOTE_BACKEND/analytics/"

# 5. Reiniciar el servicio backend
echo "🔄 Reiniciando backend..."
ssh $SERVER "systemctl restart brain-backend"

# 6. Esperar a que inicie
echo "⏳ Esperando a que el backend inicie..."
sleep 5

# 7. Probar el endpoint
echo "🧪 Probando endpoint de analytics..."
curl -s http://api.random-studio.io/analytics/health | jq . || curl -s http://api.random-studio.io/analytics/health

echo ""
echo "✅ ¡Deployment completado!"
echo ""
echo "🌐 Prueba: http://api.random-studio.io/analytics/health"
echo ""
