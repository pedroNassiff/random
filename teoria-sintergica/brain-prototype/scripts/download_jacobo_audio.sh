#!/bin/bash

# Script para descargar y procesar audio de entrevista de Jacobo Grinberg
# URL: https://www.youtube.com/watch?v=xYMzjkUAwmg

echo "🎬 Descargando audio de entrevista con Jacobo Grinberg..."

# Paso 1: Descargar solo audio de YouTube
echo "📥 Paso 1: Descargando audio completo..."
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  -o "jacobo_entrevista_completa.%(ext)s" \
  "https://www.youtube.com/watch?v=xYMzjkUAwmg"

echo "✅ Audio descargado: jacobo_entrevista_completa.mp3"

# Paso 2: Normalizar volumen
echo "🔊 Paso 2: Normalizando volumen..."
ffmpeg -i jacobo_entrevista_completa.mp3 \
  -af "loudnorm" \
  jacobo_entrevista_normalized.mp3

# Paso 3: Reducir ruido de fondo (opcional pero recomendado)
echo "🧹 Paso 3: Limpiando ruido de fondo..."
ffmpeg -i jacobo_entrevista_normalized.mp3 \
  -af "highpass=f=200, lowpass=f=3000" \
  jacobo_entrevista_clean.mp3

echo ""
echo "✨ Proceso completado!"
echo ""
echo "📁 Archivos generados:"
echo "  - jacobo_entrevista_completa.mp3 (original)"
echo "  - jacobo_entrevista_normalized.mp3 (volumen normalizado)"
echo "  - jacobo_entrevista_clean.mp3 (con reducción de ruido)"
echo ""
echo "🎯 Próximos pasos MANUALES:"
echo ""
echo "1. Abre jacobo_entrevista_clean.mp3 en un editor de audio (Audacity es gratis)"
echo "2. Identifica las secciones donde Jacobo explica técnicas de meditación"
echo "3. Recorta esas secciones específicas"
echo "4. Exporta como:"
echo "   - vipassana.mp3 (explicación de Vipassana)"
echo "   - samadhi.mp3 (explicación de Samadhi)"
echo ""
echo "💡 Timestamps sugeridos (revisa el video para encontrarlos):"
echo "   Busca menciones de: 'observación', 'atención', 'meditación', 'técnica'"
echo ""
echo "5. Copia los archivos finales a:"
echo "   frontend/public/audio/meditations/"
echo ""
