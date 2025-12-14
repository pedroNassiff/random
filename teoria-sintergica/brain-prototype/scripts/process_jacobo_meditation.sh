#!/bin/bash

# Script completo para crear meditación guiada con voz de Jacobo
# Usando el audio que ya tienes descargado

echo "🧘 Creador de Meditación Guiada - Voz de Jacobo Grinberg"
echo "=========================================================="
echo ""

# Configuración
AUDIO_PATH="/Users/pedronassiff/Desktop/proyectos/random/frontend/public/audio/meditations"
TEMP_DIR="/Users/pedronassiff/Desktop/proyectos/random/temp"
OUTPUT_DIR="/Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/frontend/public/audio/meditations"

# Crear directorios
mkdir -p "$TEMP_DIR"
mkdir -p "$OUTPUT_DIR"

# Detectar archivo de audio
AUDIO_FILE=$(ls "$AUDIO_PATH"/*.mp3 2>/dev/null | head -n 1)

if [ -z "$AUDIO_FILE" ]; then
    echo "❌ No se encontró archivo de audio en: $AUDIO_PATH"
    echo "Por favor, asegúrate de que el audio descargado esté ahí."
    exit 1
fi

echo "✅ Audio encontrado: $(basename "$AUDIO_FILE")"
echo ""

# PASO 1: Transcribir con Whisper
echo "📝 PASO 1: Transcribiendo audio con Whisper..."
echo "(Esto puede tomar 5-10 minutos dependiendo de la duración)"
echo ""

if ! command -v whisper &> /dev/null; then
    echo "⚠️  Whisper no está instalado. Instalando..."
    pip install -U openai-whisper
fi

whisper "$AUDIO_FILE" \
    --model medium \
    --language Spanish \
    --task transcribe \
    --output_dir "$TEMP_DIR" \
    --output_format txt \
    --output_format vtt

echo ""
echo "✅ Transcripción completada: $TEMP_DIR/$(basename "$AUDIO_FILE" .mp3).txt"
echo ""

# PASO 2: Analizar transcripción y extraer conceptos clave
echo "🔍 PASO 2: Analizando transcripción para conceptos de meditación..."
echo ""

TRANSCRIPT="$TEMP_DIR/$(basename "$AUDIO_FILE" .mp3).txt"

if [ -f "$TRANSCRIPT" ]; then
    echo "Buscando menciones de técnicas de meditación:"
    echo ""
    grep -i "meditación\|observación\|atención\|coherencia\|sintergia\|lattice\|vipassana" "$TRANSCRIPT" | head -n 10
    echo ""
    echo "💡 Revisa el archivo completo en: $TRANSCRIPT"
    echo ""
fi

# PASO 3: Instrucciones para clonación de voz
echo "🎤 PASO 3: Para clonar la voz de Jacobo, tienes 3 opciones:"
echo ""
echo "OPCIÓN A - ElevenLabs (Más fácil, mejor calidad):"
echo "  1. Primero, extrae un segmento donde SOLO hable Jacobo (30-60 seg):"
echo "     ffmpeg -i \"$AUDIO_FILE\" -ss 00:12:30 -t 00:00:45 \"$TEMP_DIR/jacobo_voice_sample.mp3\""
echo ""
echo "  2. Ve a https://elevenlabs.io y crea cuenta (tienen plan gratis)"
echo ""
echo "  3. En 'Voice Lab', haz clic en 'Add Voice' → 'Voice Clone'"
echo ""
echo "  4. Sube jacobo_voice_sample.mp3"
echo ""
echo "  5. Espera 5-10 min mientras la IA aprende su voz"
echo ""
echo "  6. Usa el script de meditación generado (ver abajo) para sintetizar"
echo ""
echo "---------------------------------------------------------------"
echo ""
echo "OPCIÓN B - Coqui TTS (Gratis, local, requiere muestra de voz):"
echo "  pip install TTS"
echo "  tts --text 'Cierra los ojos suavemente' \\"
echo "      --model_name tts_models/multilingual/multi-dataset/xtts_v2 \\"
echo "      --speaker_wav \"$TEMP_DIR/jacobo_voice_sample.mp3\" \\"
echo "      --language_idx es \\"
echo "      --out_path \"$OUTPUT_DIR/test.wav\""
echo ""
echo "---------------------------------------------------------------"
echo ""
echo "OPCIÓN C - Usar fragmentos reales editados (Sin IA):"
echo "  1. Identifica timestamps donde Jacobo dice frases útiles"
echo "  2. Recorta y une esos segmentos"
echo "  3. Ajusta velocidad y pausas para que fluya como meditación"
echo ""

# PASO 4: Generar script de meditación
echo "📜 PASO 4: Generando script de meditación basado en conceptos de Jacobo..."
echo ""

cat > "$TEMP_DIR/meditation_script_vipassana.txt" << 'EOF'
# Script de Meditación Vipassana Sintérgica
# Basado en las enseñanzas de Jacobo Grinberg
# Duración: 10 minutos

[0:00 - 1:00] INTRODUCCIÓN
"Bienvenido a esta práctica de observación ecuánime. Vamos a trabajar con la técnica que llamo meditación sintérgica, diseñada para incrementar la coherencia entre los hemisferios cerebrales y expandir tu conexión con la lattice, la estructura fundamental de la realidad."

[1:00 - 2:00] PREPARACIÓN
"Encuentra una posición cómoda, con la espalda recta pero relajada. Cierra los ojos suavemente. Permite que tu respiración encuentre su ritmo natural, sin forzarla. Simplemente observa cómo el aire entra y sale de tu cuerpo."

[2:00 - 5:00] ESCANEO CORPORAL
"Ahora, dirige tu atención a la coronilla de tu cabeza. Observa cualquier sensación que surja ahí, sin juzgarla, sin etiquetarla como buena o mala. Solo obsérvala tal como es.

Gradualmente, desciende tu atención hacia la frente, los ojos, las mejillas. Nota cualquier tensión, calor, frío, o cosquilleo. No intentes cambiar nada, solo observa con ecuanimidad.

Continúa bajando por el cuello, los hombros, los brazos. Cada parte de tu cuerpo está siendo observada con la misma calidad de atención neutral."

[5:00 - 8:00] OBSERVACIÓN ECUÁNIME
"Nota cómo las sensaciones surgen y desaparecen. Esta es la naturaleza impermanente de la experiencia. Al observar sin apego, sin aversión, estás creando coherencia en tu campo neuronal.

Esta coherencia no es solo un fenómeno interno. Es una sincronización con la lattice misma, la matriz de información que subyace a toda la realidad perceptual.

Mientras observas, puede que notes cómo tu atención se vuelve más clara, más estable. Esta es la sintergia en acción, la unificación de procesos que antes estaban fragmentados."

[8:00 - 10:00] INTEGRACIÓN
"Gradualmente, expande tu consciencia a todo el cuerpo como un campo unificado. Siente todas las sensaciones simultáneamente.

Permanece en este estado de observación total por unos momentos.

Cuando estés listo, lentamente trae movimiento a tus dedos, a tus manos. Toma una respiración profunda.

Abre los ojos suavemente, manteniendo esa calidad de presencia que has cultivado.

Esta práctica fortalece tu capacidad de atención y expande tu coherencia neuronal. Repítela regularmente para profundizar en el estado sintérgico."
EOF

echo "✅ Script generado en: $TEMP_DIR/meditation_script_vipassana.txt"
echo ""
cat "$TEMP_DIR/meditation_script_vipassana.txt"
echo ""
echo "=========================================================="
echo "✨ PRÓXIMOS PASOS:"
echo ""
echo "1. Revisa la transcripción: $TRANSCRIPT"
echo "2. Identifica un segmento de voz limpia de Jacobo"
echo "3. Extrae ese segmento: ffmpeg -i \"$AUDIO_FILE\" -ss HH:MM:SS -t 00:00:45 voice_sample.mp3"
echo "4. Usa ElevenLabs o Coqui TTS para clonar voz"
echo "5. Genera audio con el script: $TEMP_DIR/meditation_script_vipassana.txt"
echo "6. Guarda resultado en: $OUTPUT_DIR/vipassana.mp3"
echo ""
echo "🎯 O si prefieres, puedo ayudarte a automatizar más con Python + ElevenLabs API"
