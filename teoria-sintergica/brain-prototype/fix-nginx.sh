#!/bin/bash

# Script para diagnosticar y arreglar el problema de nginx en Digital Ocean

echo "=== 1. Verificando configuración de Nginx ==="
cat /etc/nginx/sites-available/brain-backend

echo ""
echo "=== 2. Verificando estado del firewall ==="
ufw status

echo ""
echo "=== 3. Abriendo puertos en el firewall ==="
ufw allow ssh
ufw allow 'Nginx Full'  # Permite HTTP (80) y HTTPS (443)
ufw --force enable

echo ""
echo "=== 4. Verificando puertos abiertos ==="
ufw status verbose

echo ""
echo "=== 5. Reiniciando Nginx ==="
systemctl restart nginx

echo ""
echo "=== 6. Verificando que Nginx esté escuchando en los puertos correctos ==="
ss -tulpn | grep nginx

echo ""
echo "=== 7. Probando conexión local al backend ==="
curl -s http://localhost:8000/health | head -20

echo ""
echo "=== 8. Probando conexión a través de Nginx (local) ==="
curl -s http://localhost/ | head -20

echo ""
echo "=== 9. Eliminando configuración default de Nginx si existe ==="
rm -f /etc/nginx/sites-enabled/default

echo ""
echo "=== 10. Test final de configuración Nginx ==="
nginx -t

echo ""
echo "=== 11. Reinicio final de Nginx ==="
systemctl restart nginx

echo ""
echo "=== 12. Estado final de Nginx ==="
systemctl status nginx --no-pager

echo ""
echo "✅ Configuración completada!"
echo ""
echo "Ahora prueba acceder a: http://api.random-studio.io"
echo ""
echo "Si aún no funciona, verifica el archivo de configuración con:"
echo "nano /etc/nginx/sites-available/brain-backend"
