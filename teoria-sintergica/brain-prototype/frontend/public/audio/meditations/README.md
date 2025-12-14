# 🧘 Guided Meditations Audio Setup

Este directorio contiene los archivos de audio para las meditaciones guiadas del Practice Mode.

## 📁 Archivos Requeridos

Coloca los siguientes archivos en este directorio:

- `vipassana.mp3` - Meditación Vipassana guiada por Jacobo Grinberg
- `samadhi.mp3` - Meditación Samadhi guiada por Jacobo Grinberg

## 🎬 Cómo extraer audio de videos

### Opción 1: Usando FFmpeg (Recomendado)

#### 1. Instalar FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
- Descarga desde https://ffmpeg.org/download.html
- O usa: `choco install ffmpeg`

**Linux:**
```bash
sudo apt install ffmpeg  # Ubuntu/Debian
sudo yum install ffmpeg  # CentOS/RHEL
```

#### 2. Extraer audio del video

```bash
# Básico (MP3 de alta calidad)
ffmpeg -i input_video.mp4 -vn -acodec libmp3lame -q:a 2 vipassana.mp3

# Con normalización de volumen
ffmpeg -i input_video.mp4 -vn -acodec libmp3lame -q:a 2 -filter:a loudnorm vipassana.mp3

# Recortar solo una sección (ejemplo: desde 1:30 por 10 minutos)
ffmpeg -i input_video.mp4 -ss 00:01:30 -t 00:10:00 -vn -acodec libmp3lame -q:a 2 vipassana.mp3
```

**Parámetros explicados:**
- `-i input_video.mp4`: Archivo de entrada
- `-vn`: No video (solo audio)
- `-acodec libmp3lame`: Codec MP3
- `-q:a 2`: Calidad audio (0-9, 2 = muy alta)
- `-ss 00:01:30`: Start time (inicio)
- `-t 00:10:00`: Duration (duración)
- `-filter:a loudnorm`: Normaliza el volumen

### Opción 2: Usando herramientas online

1. **CloudConvert** - https://cloudconvert.com/
   - Sube el video
   - Selecciona formato MP3
   - Descarga

2. **Online-Convert** - https://www.online-convert.com/
   - Sube el video
   - Elige "Convert to MP3"
   - Ajusta calidad si quieres

### Opción 3: YouTube-DL (si el video está en YouTube)

```bash
# Instalar youtube-dl
pip install youtube-dl

# Descargar solo audio
youtube-dl -x --audio-format mp3 --audio-quality 0 [URL_DEL_VIDEO]
```

## 🎚️ Recomendaciones de Audio

### Calidad óptima:
- **Formato**: MP3
- **Bitrate**: 128-192 kbps
- **Sample Rate**: 44.1 kHz
- **Canales**: Mono o Estéreo

### Post-procesamiento (opcional):

#### Normalizar volumen
```bash
ffmpeg -i vipassana.mp3 -filter:a loudnorm -c:a libmp3lame -q:a 2 vipassana_normalized.mp3
```

#### Reducir ruido de fondo
```bash
ffmpeg -i vipassana.mp3 -af "highpass=f=200, lowpass=f=3000" vipassana_clean.mp3
```

#### Comprimir tamaño (mantener calidad)
```bash
ffmpeg -i vipassana.mp3 -acodec libmp3lame -b:a 128k vipassana_compressed.mp3
```

## 📝 Estructura de archivos esperada

```
frontend/public/audio/meditations/
├── README.md (este archivo)
├── vipassana.mp3
└── samadhi.mp3
```

## 🔊 Testing

Para verificar que los archivos funcionan:

1. Abre el navegador en http://localhost:5173
2. Activa Practice Mode (panel de achievements)
3. En la configuración pre-sesión, verás el selector de meditación
4. Selecciona "Vipassana" o "Samadhi"
5. Inicia la sesión - el audio debería reproducirse automáticamente

## 🎯 Meditaciones a incluir

### Vipassana (10 min)
Técnica de observación ecuánime de sensaciones corporales descrita en el libro de Jacobo Grinberg. 

**Estructura sugerida:**
1. Introducción (1 min)
2. Escaneo corporal (3 min)
3. Observación ecuánime (4 min)
4. Integración (2 min)

### Samadhi (8 min)
Concentración en un punto focal para alcanzar estados de unificación.

**Estructura sugerida:**
1. Centramiento (1 min)
2. Focalización (3 min)
3. Expansión de coherencia (3 min)
4. Cierre (1 min)

## 🚀 Próximas mejoras

- [ ] Agregar más meditaciones de Jacobo
- [ ] Transcripciones de texto sincronizadas
- [ ] Visualizaciones que respondan a instrucciones específicas
- [ ] Sesiones de diferentes duraciones

## 📚 Referencias

- Grinberg, J. (1987). "La Creación de la Experiencia"
- Grinberg, J. (1991). "Los Chamanes de México"
- Técnicas de meditación sintérgica documentadas en sus publicaciones

---

**Nota**: Los archivos de audio no están incluidos en el repositorio por derechos de autor. Debes extraerlos de fuentes legítimas o grabarlos tú mismo siguiendo las técnicas descritas en los libros de Jacobo Grinberg.
