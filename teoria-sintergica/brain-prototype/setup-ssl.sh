#!/bin/bash

# Script para configurar SSL/HTTPS con Let's Encrypt en el backend de analytics
# Ejecutar en el servidor Digital Ocean como root o con sudo

set -e

echo "============================================"
echo "🔒 Configurando SSL para api.random-studio.io"
echo "============================================"

# 1. Instalar certbot si no está instalado
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
else
    echo "✓ Certbot ya está instalado"
fi

# 2. Verificar que nginx está corriendo
if ! systemctl is-active --quiet nginx; then
    echo "⚠️  Nginx no está corriendo. Iniciando..."
    systemctl start nginx
fi

# 3. Obtener certificado SSL
echo "🔐 Obteniendo certificado SSL de Let's Encrypt..."
echo "   (Esto configurará automáticamente nginx para HTTPS)"

certbot --nginx \
    -d api.random-studio.io \
    --non-interactive \
    --agree-tos \
    --redirect \
    --email admin@random-studio.io

# 4. Verificar configuración
echo ""
echo "============================================"
echo "✓ SSL configurado correctamente"
echo "============================================"
echo ""
echo "🔍 Verificando configuración..."
nginx -t

echo ""
echo "🔄 Recargando nginx..."
systemctl reload nginx

echo ""
echo "============================================"
echo "✅ ¡Listo!"
echo "============================================"
echo ""
echo "Tu API ahora está disponible en:"
echo "   👉 https://api.random-studio.io/analytics"
echo ""
echo "El certificado se renovará automáticamente cada 90 días."
echo ""
echo "Prueba el endpoint:"
echo "   curl https://api.random-studio.io/analytics/health"
echo ""
