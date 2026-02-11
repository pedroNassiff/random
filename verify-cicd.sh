#!/bin/bash

# Script de verificación pre-commit para CI/CD

echo "🔍 Verificando configuración para CI/CD..."
echo ""

# Verificar que existen los archivos de workflow
echo "1. Verificando workflows de GitHub Actions..."
if [ -f .github/workflows/deploy-backend.yml ]; then
    echo "   ✅ deploy-backend.yml encontrado"
else
    echo "   ❌ deploy-backend.yml NO encontrado"
fi

if [ -f .github/workflows/deploy-analytics.yml ]; then
    echo "   ✅ deploy-analytics.yml encontrado"
else
    echo "   ❌ deploy-analytics.yml NO encontrado"
fi

echo ""
echo "2. Verificando módulo analytics en local..."
if [ -d teoria-sintergica/brain-prototype/backend/analytics ]; then
    echo "   ✅ Directorio analytics existe"
    echo "   📁 Archivos:"
    ls -1 teoria-sintergica/brain-prototype/backend/analytics/ | sed 's/^/      - /'
else
    echo "   ❌ Directorio analytics NO existe"
fi

echo ""
echo "3. Verificando .env en backend..."
if [ -f teoria-sintergica/brain-prototype/backend/.env ]; then
    echo "   ✅ .env encontrado"
    echo "   ⚠️  IMPORTANTE: No subir .env al repositorio"
else
    echo "   ❌ .env NO encontrado"
fi

echo ""
echo "4. Verificando .gitignore..."
if [ -f .gitignore ] && grep -q ".env" .gitignore; then
    echo "   ✅ .env está en .gitignore"
else
    echo "   ⚠️  .env NO está en .gitignore - agregándolo..."
    echo "" >> .gitignore
    echo "# Environment variables" >> .gitignore
    echo ".env" >> .gitignore
    echo "**/.env" >> .gitignore
    echo "   ✅ .env agregado a .gitignore"
fi

echo ""
echo "5. Verificando git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "   ✅ Repositorio git inicializado"
    
    # Verificar si hay cambios sin commitear
    if ! git diff-index --quiet HEAD --; then
        echo "   📝 Hay cambios sin commitear:"
        git status --short | head -10
    else
        echo "   ✅ No hay cambios pendientes"
    fi
else
    echo "   ❌ NO es un repositorio git"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 CHECKLIST ANTES DE HACER PUSH:"
echo ""
echo "   [ ] Configurar secrets en GitHub (SERVER_HOST, SERVER_USER, SSH_PRIVATE_KEY)"
echo "   [ ] Verificar que .env NO esté en el commit"
echo "   [ ] Verificar que analytics/ esté en el commit"
echo "   [ ] Verificar que .github/workflows/ esté en el commit"
echo ""
echo "🚀 Para configurar secrets en GitHub, ejecuta:"
echo "   ./.github/show-secrets.sh"
echo ""
echo "✅ Ready to commit and push!"
echo ""
