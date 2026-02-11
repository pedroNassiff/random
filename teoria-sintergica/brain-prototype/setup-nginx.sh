#!/bin/bash

# Script para configurar Nginx en Digital Ocean desde local

echo "🚀 Configurando Nginx en Digital Ocean..."
echo ""

SERVER="root@142.93.47.46"

# 1. Subir la configuración de nginx
echo "📤 Subiendo configuración de nginx..."
scp nginx-brain-backend.conf $SERVER:/etc/nginx/sites-available/brain-backend

# 2. Subir el script de diagnóstico
echo "📤 Subiendo script de configuración..."
scp fix-nginx.sh $SERVER:/root/fix-nginx.sh

# 3. Ejecutar el script en el servidor
echo "⚙️  Ejecutando configuración en el servidor..."
ssh $SERVER "chmod +x /root/fix-nginx.sh && /root/fix-nginx.sh"

echo ""
echo "✅ Configuración completada!"
echo ""
echo "🌐 Prueba acceder a: http://api.random-studio.io/health"
echo ""
