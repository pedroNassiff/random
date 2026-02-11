#!/bin/bash

# Script para arreglar el problema de git ownership en el servidor

echo "🔧 Arreglando problema de git ownership en el servidor..."
echo ""

ssh root@142.93.47.46 << 'ENDSSH'
# Configurar safe directory para git
git config --global --add safe.directory /home/brain/random

# Verificar el ownership actual
echo "📊 Ownership actual del directorio:"
ls -ld /home/brain/random

# Cambiar ownership a usuario brain
echo "🔄 Cambiando ownership a usuario brain..."
chown -R brain:brain /home/brain/random

echo "✅ Ownership actualizado:"
ls -ld /home/brain/random

# Verificar que git funciona ahora
echo "🧪 Probando git..."
cd /home/brain/random
git status | head -5

echo "✅ Git configurado correctamente!"
ENDSSH

echo ""
echo "✅ Problema de ownership resuelto en el servidor!"
echo ""
