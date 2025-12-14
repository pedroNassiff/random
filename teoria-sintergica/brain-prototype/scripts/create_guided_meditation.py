#!/usr/bin/env python3
"""
Script para crear meditación guiada con la voz de Jacobo Grinberg
usando IA para transcribir, generar script, y clonar voz.

Requisitos:
- pip install openai-whisper torch elevenlabs
- API key de ElevenLabs (https://elevenlabs.io)
"""

import os
import sys
from pathlib import Path

# Paths
AUDIO_DIR = Path("/Users/pedronassiff/Desktop/proyectos/random/frontend/public/audio/meditations")
TEMP_DIR = Path("/Users/pedronassiff/Desktop/proyectos/random/temp")
TEMP_DIR.mkdir(exist_ok=True)

print("🎙️ Generador de Meditación Guiada con Voz de Jacobo Grinberg")
print("=" * 60)

# PASO 1: Transcribir con Whisper
print("\n📝 PASO 1: Transcribir audio original...")
print("Comando a ejecutar:")
print(f"""
whisper {AUDIO_DIR}/jacobo_original.mp3 \\
  --model medium \\
  --language Spanish \\
  --task transcribe \\
  --output_dir {TEMP_DIR} \\
  --output_format all
""")

# PASO 2: Extraer segmento de voz limpia (para clonación)
print("\n🎤 PASO 2: Extraer muestra de voz de Jacobo (solo su voz, sin entrevistador)...")
print("""
Necesitas identificar un segmento de 30-60 segundos donde:
- Solo hable Jacobo
- Sin música de fondo
- Dicción clara

Comando para extraer:
ffmpeg -i jacobo_original.mp3 -ss 00:12:30 -t 00:00:45 temp/jacobo_voice_sample.mp3
""")

# PASO 3: Script de meditación
print("\n📜 PASO 3: Crear script de meditación basado en conceptos de Jacobo...")
print("""
Usando la transcripción, identifica:
1. Conceptos clave: coherencia, sintergia, observación, lattice
2. Frases textuales de Jacobo que podamos reutilizar
3. Estructura de una meditación: intro → práctica → cierre
""")

# PASO 4: Opciones de síntesis de voz
print("\n🤖 PASO 4: Generar audio con voz clonada...")
print("""
OPCIÓN A - ElevenLabs (Mejor calidad, ~$5/mes):
  1. Ve a https://elevenlabs.io
  2. Sube jacobo_voice_sample.mp3 a "Voice Lab"
  3. Espera ~5 minutos para entrenamiento
  4. Genera audio con tu script

OPCIÓN B - Coqui TTS (Gratis, local):
  pip install TTS
  tts --text "Tu script aquí" --model_name tts_models/es/css10/vits --out_path output.wav

OPCIÓN C - RVC (Gratis, mejor para clonar):
  https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI
  (Más complejo pero excelente resultado)
""")

print("\n✅ FLUJO COMPLETO:")
print("""
1. Transcribe con Whisper → temp/jacobo_original.txt
2. Extrae muestra de voz → temp/jacobo_voice_sample.mp3
3. Crea script combinando:
   - Frases textuales de la transcripción
   - Estructura de meditación guiada
4. Clona voz en ElevenLabs o Coqui
5. Genera audio final → frontend/public/audio/meditations/vipassana.mp3
""")

print("\n📋 ¿Quieres que ejecute algún paso automáticamente? (y/n)")
