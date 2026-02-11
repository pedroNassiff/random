#!/bin/bash

# Script para mostrar la información necesaria para configurar GitHub Actions

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🚀 CONFIGURACIÓN DE GITHUB ACTIONS - INFORMACIÓN NECESARIA  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "📝 Necesitas agregar estos SECRETS en tu repositorio de GitHub:"
echo ""
echo "   GitHub → Settings → Secrets and variables → Actions"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1️⃣  SERVER_HOST"
echo "   Valor: 142.93.47.46"
echo ""

echo "2️⃣  SERVER_USER"
echo "   Valor: root"
echo ""

echo "3️⃣  SSH_PRIVATE_KEY"
echo "   Copia el contenido completo de tu clave SSH privada:"
echo ""

# Detectar qué tipo de clave SSH tiene el usuario
if [ -f ~/.ssh/id_ed25519 ]; then
    echo "   🔑 Detectada clave ed25519. Copia este contenido:"
    echo "   ─────────────────────────────────────────────────"
    cat ~/.ssh/id_ed25519
    echo ""
    echo "   ─────────────────────────────────────────────────"
elif [ -f ~/.ssh/id_rsa ]; then
    echo "   🔑 Detectada clave RSA. Copia este contenido:"
    echo "   ─────────────────────────────────────────────────"
    cat ~/.ssh/id_rsa
    echo ""
    echo "   ─────────────────────────────────────────────────"
else
    echo "   ⚠️  No se encontró clave SSH en ~/.ssh/"
    echo "   Necesitas generar una o localizar tu clave privada"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   • Copia TODA la clave, incluyendo las líneas BEGIN y END"
echo "   • Esta clave es PRIVADA - solo agrégala como secret en GitHub"
echo "   • Nunca la subas directamente al repositorio"
echo ""
echo "✅ Después de configurar los secrets, haz:"
echo "   git add .github/"
echo "   git commit -m 'ci: configurar GitHub Actions para deployment'"
echo "   git push origin main"
echo ""
echo "🎉 ¡GitHub Actions hará el deployment automáticamente!"
echo ""
