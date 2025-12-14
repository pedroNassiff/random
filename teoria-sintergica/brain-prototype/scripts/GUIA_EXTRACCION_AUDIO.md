# 🎙️ Guía Completa: Extraer Audio de Jacobo Grinberg de YouTube

## 📺 Video fuente
**URL**: https://www.youtube.com/watch?v=xYMzjkUAwmg
**Tipo**: Entrevista con Jacobo Grinberg

---

## 🚀 Opción 1: Método Rápido (Recomendado)

### Requisitos:
```bash
# Instalar yt-dlp (mejor que youtube-dl)
brew install yt-dlp  # macOS
# o
pip install yt-dlp   # Windows/Linux

# Instalar ffmpeg
brew install ffmpeg  # macOS
```

### Paso a paso:

#### 1. Descargar audio completo
```bash
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype

# Descargar audio de alta calidad
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  -o "temp/jacobo_full.%(ext)s" \
  "https://www.youtube.com/watch?v=xYMzjkUAwmg"
```

#### 2. Procesar audio
```bash
# Normalizar volumen y limpiar ruido
ffmpeg -i temp/jacobo_full.mp3 \
  -af "loudnorm,highpass=f=100,lowpass=f=3500" \
  temp/jacobo_clean.mp3
```

#### 3. Recortar secciones específicas

**Necesitas identificar los timestamps manualmente** viendo el video. Busca:
- Menciones de técnicas de meditación
- Explicaciones de Vipassana
- Descripciones de Samadhi o concentración

Ejemplo de comando para recortar:
```bash
# Recortar desde 12:30 por 8 minutos (ejemplo)
ffmpeg -i temp/jacobo_clean.mp3 \
  -ss 00:12:30 -t 00:08:00 \
  frontend/public/audio/meditations/vipassana.mp3

# Recortar desde 25:45 por 6 minutos (ejemplo)
ffmpeg -i temp/jacobo_clean.mp3 \
  -ss 00:25:45 -t 00:06:00 \
  frontend/public/audio/meditations/samadhi.mp3
```

---

## 🎨 Opción 2: Separación Avanzada de Voz (Elimina entrevistador)

### Usar Spleeter (IA para separar voces)

```bash
# Instalar Spleeter
pip install spleeter

# Separar voces del audio
spleeter separate -p spleeter:2stems \
  -o temp/separated \
  temp/jacobo_clean.mp3

# Esto genera:
# - temp/separated/jacobo_clean/vocals.wav (solo voces)
# - temp/separated/jacobo_clean/accompaniment.wav (solo música/ruido)
```

Luego usa Audacity para:
1. Abrir `vocals.wav`
2. Identificar y eliminar partes del entrevistador
3. Conservar solo las partes de Jacobo
4. Exportar como MP3

---

## 🎧 Opción 3: Usar Herramientas Online (Sin instalación)

### A. Descarga el audio:
**Sitio**: https://yt5s.io/
1. Pega el URL: `https://www.youtube.com/watch?v=xYMzjkUAwmg`
2. Selecciona "MP3"
3. Descarga

### B. Edita el audio:
**Audacity** (gratis): https://www.audacityteam.org/

1. Abre el MP3 descargado
2. Escucha y encuentra secciones donde Jacobo habla de meditación
3. Selecciona la sección → `File > Export > Export Selected Audio`
4. Nombra como `vipassana.mp3` o `samadhi.mp3`

### C. Limpia el audio (opcional):
En Audacity:
1. `Effect > Noise Reduction` → Get Noise Profile (selecciona silencio)
2. Selecciona todo → `Effect > Noise Reduction` → OK
3. `Effect > Normalize` → OK
4. `Effect > Compressor` → OK

---

## 🤖 Opción 4: IA para Transcribir y Crear Guión

Si no encuentras secciones claras de meditación guiada, puedes:

### 1. Transcribir automáticamente
```bash
# Usar Whisper de OpenAI (gratis)
pip install openai-whisper

whisper temp/jacobo_clean.mp3 \
  --model medium \
  --language Spanish \
  --output_format txt

# Genera: jacobo_clean.txt con timestamps
```

### 2. Extraer conceptos clave
Lee la transcripción y busca:
- Descripciones de técnicas meditativas
- Instrucciones paso a paso
- Menciones de "observación", "atención", "coherencia"

### 3. Crear script de meditación guiada
Basándote en lo que dice Jacobo, crea un script y:
- Grábalo tú mismo con voz tranquila
- O usa TTS de alta calidad (ElevenLabs, Azure TTS)

---

## 📋 Script de Ejemplo (Basado en Teoría de Jacobo)

### Vipassana Sintérgica (10 min)

```
[0:00 - 0:30] Introducción
"Vamos a practicar la técnica de observación ecuánime, 
desarrollada para incrementar la coherencia neural..."

[0:30 - 2:00] Preparación
"Cierra los ojos suavemente. Permite que tu respiración 
encuentre su ritmo natural..."

[2:00 - 5:00] Escaneo Corporal
"Dirige tu atención a la coronilla de tu cabeza. 
Observa cualquier sensación sin juzgarla..."

[5:00 - 8:00] Observación Ecuánime
"Nota cómo las sensaciones surgen y desaparecen. 
Esta observación sin apego es lo que crea coherencia..."

[8:00 - 10:00] Integración
"Gradualmente expande tu consciencia a todo el cuerpo. 
Siente la unificación, la sintergia..."
```

Puedes grabar este script siguiendo las enseñanzas de Jacobo del video.

---

## ✅ Comando Todo-en-Uno

Ejecuta esto después de identificar los timestamps:

```bash
#!/bin/bash

# Crear directorios
mkdir -p temp
mkdir -p frontend/public/audio/meditations

# Descargar
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  -o "temp/jacobo.%(ext)s" \
  "https://www.youtube.com/watch?v=xYMzjkUAwmg"

# Limpiar audio
ffmpeg -i temp/jacobo.mp3 \
  -af "loudnorm,highpass=f=100,lowpass=f=3500" \
  temp/jacobo_clean.mp3

echo "✅ Audio procesado en: temp/jacobo_clean.mp3"
echo ""
echo "🎯 Ahora NECESITAS:"
echo "1. Escuchar el archivo y anotar timestamps"
echo "2. Recortar secciones con:"
echo "   ffmpeg -i temp/jacobo_clean.mp3 -ss HH:MM:SS -t HH:MM:SS output.mp3"
echo ""
```

---

## 🎯 Recomendación Final

**Mejor flujo de trabajo:**

1. ✅ **Descarga el audio** (5 min)
   ```bash
   yt-dlp -x --audio-format mp3 "https://www.youtube.com/watch?v=xYMzjkUAwmg"
   ```

2. ✅ **Abre en Audacity** (gratis)
   - Escucha el video completo
   - Marca las secciones relevantes
   - Exporta esas secciones

3. ✅ **Limpia y optimiza** (5 min)
   ```bash
   ffmpeg -i vipassana_raw.mp3 \
     -af "loudnorm,highpass=f=100" \
     frontend/public/audio/meditations/vipassana.mp3
   ```

**Tiempo total**: ~30 minutos incluyendo escuchar el video

---

## 🚨 Alternativa si no hay contenido útil

Si la entrevista no tiene instrucciones claras de meditación:

1. Lee los libros de Jacobo:
   - "La Creación de la Experiencia"
   - "Meditación Autoalusiva"

2. Crea un script basado en sus enseñanzas

3. Grábalo tú mismo o usa:
   - **ElevenLabs** (voz IA muy natural, $5/mes)
   - **Azure TTS** (español mexicano de alta calidad)
   - **Google TTS** (gratis pero menos natural)

---

¿Quieres que te ayude con algún paso específico?
