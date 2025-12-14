#!/bin/bash
# Script para descargar dataset de meditación desde Zenodo

echo "📥 Downloading Meditation EEG Dataset from Zenodo..."

# Crear directorio
mkdir -p ../data/meditation

# Descargar dataset (ejemplo - actualizar URL real de Zenodo)
# Nota: Zenodo cambia URLs, verificar en https://zenodo.org buscando "meditation EEG"

echo "⚠️  MANUAL DOWNLOAD REQUIRED:"
echo ""
echo "1. Visitar: https://zenodo.org"
echo "2. Buscar: 'meditation EEG' o 'mindfulness EEG'"
echo "3. Descargar archivo .zip"
echo "4. Extraer en: backend/data/meditation/"
echo ""
echo "Datasets recomendados en Zenodo:"
echo "  - 'EEG during meditation' (32 canales, 20min sesiones)"
echo "  - 'Mindfulness meditation EEG' (varios protocolos)"
echo ""
echo "Alternativamente, usar OpenNeuro (requiere datalad):"
echo "  pip install datalad"
echo "  datalad install https://github.com/OpenNeuroDatasets/ds003969.git"
echo ""

# Si ya descargaste manualmente, descomprimir aquí:
# unzip meditation_eeg.zip -d ../data/meditation/

echo "✓ Setup complete. Place EDF files in: backend/data/meditation/"
