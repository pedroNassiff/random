#!/bin/bash

# ============================================
# Script para Limpiar Historial de Git
# ============================================
# 
# ⚠️ ADVERTENCIA: Este script REESCRIBE el historial de Git
# Solo ejecutar si NO has pusheado a GitHub todavía
# O si estás dispuesto a hacer force push
#
# Uso:
#   chmod +x cleanup_git_history.sh
#   ./cleanup_git_history.sh
#
# ============================================

echo "🧹 Limpiando datasets del historial de Git..."
echo ""
echo "⚠️  ADVERTENCIA: Esto reescribirá el historial"
echo "    ¿Continuar? (y/N): "
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

cd "$(dirname "$0")/.." || exit

echo ""
echo "📊 Tamaño actual del repositorio:"
git count-objects -vH

echo ""
echo "🔍 Buscando archivos grandes en el historial..."

# Usar git-filter-repo (más moderno que filter-branch)
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo no está instalado"
    echo ""
    echo "Instalar con:"
    echo "  brew install git-filter-repo  # macOS"
    echo "  pip install git-filter-repo   # Python"
    echo ""
    
    echo "Alternativa: usar BFG Repo Cleaner"
    echo "  brew install bfg              # macOS"
    echo ""
    exit 1
fi

# Backup del repo
echo ""
echo "💾 Creando backup en ../brain-prototype-backup..."
cd ..
cp -r teoria-sintergica/brain-prototype teoria-sintergica/brain-prototype-backup
cd teoria-sintergica/brain-prototype || exit

# Limpiar archivos del historial
echo ""
echo "🗑️  Eliminando datasets del historial..."

git filter-repo --force \
  --path backend/data/ --invert-paths \
  --path backend/ds003969/ --invert-paths \
  --path backend/ai/syntergic_vae.pth --invert-paths \
  --path-glob '*.edf' --invert-paths \
  --path-glob '*.fif' --invert-paths \
  --path-glob '*.pth' --invert-paths

# Re-agregar el README de data
git checkout HEAD -- backend/data/README.md 2>/dev/null || true

echo ""
echo "✅ Historial limpiado"
echo ""
echo "📊 Tamaño nuevo del repositorio:"
git count-objects -vH

echo ""
echo "📝 Próximos pasos:"
echo ""
echo "1. Verificar que todo funciona:"
echo "   git log --oneline"
echo "   ls -lh backend/"
echo ""
echo "2. Si todo está bien, hacer force push (si ya habías pusheado):"
echo "   git push --force origin main"
echo ""
echo "3. Si algo salió mal, restaurar del backup:"
echo "   cd .."
echo "   rm -rf teoria-sintergica/brain-prototype"
echo "   mv teoria-sintergica/brain-prototype-backup teoria-sintergica/brain-prototype"
echo ""
echo "✨ Listo!"
