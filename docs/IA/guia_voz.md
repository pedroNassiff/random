# 🎙️ IMPLEMENTACIÓN PRÁCTICA - VOZ GUÍA
## *Código listo para copiar y usar*

---

## ⚡ QUICK START (30 minutos)

### Setup Básico

```bash
# 1. Install dependencies
pip install \
    elevenlabs \
    anthropic \
    librosa \
    soundfile \
    pydub \
    scipy \
    numpy

# 2. Get API keys
# ElevenLabs: https://elevenlabs.io/ (free tier: 10k chars/month)
# Anthropic: https://console.anthropic.com/

# 3. Set environment variables
export ELEVENLABS_API_KEY=""
export ANTHROPIC_API_KEY="your-key"
```

---

## 📝 CÓDIGO COMPLETO MÍNIMO

### `voice_guide_simple.py` (todo en un archivo)

```python
#!/usr/bin/env python3
"""
Voz Guía Sintérgica - Versión Simple
Genera audio de meditación con frecuencias sintérgicas.
"""

import os
import numpy as np
import soundfile as sf
from scipy import signal
from elevenlabs import generate, Voice, VoiceSettings
from anthropic import Anthropic

# ═══════════════════════════════════════════════════════════════
# 1. SCRIPT GENERATOR
# ═══════════════════════════════════════════════════════════════

def generate_meditation_script(
    duration_minutes: int = 10,
    user_level: str = "beginner"  # beginner, intermediate, advanced
) -> str:
    """
    Genera script de meditación usando Claude.
    """
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    system_prompt = """Eres una guía de meditación contemplativa.

Tu voz es cálida, sabia, espaciosa.
Hablas con pausas conscientes marcadas como [pausa].
No eres religiosa, sino filosófica y basada en neurociencia contemplativa.

Estructura de script:
- Apertura (bienvenida, postura)
- Respiración inicial
- Cuerpo principal (presencia, observación)
- Transición
- Cierre (gratitud, integración)

Reglas:
• Frases cortas (5-10 palabras)
• [pausa] frecuente entre frases
• Lenguaje invitativo, no directivo
• 40% del tiempo es silencio
"""
    
    user_prompt = f"""Genera un script de meditación de {duration_minutes} minutos.

Nivel: {user_level}
Objetivo: Inducir estado alpha alto (meditación profunda)

Formato:
- Marca pausas con [pausa]
- ~30 palabras por minuto habladas
- Total palabras: ~{duration_minutes * 30}

Ejemplo de tu voz:
"Bienvenido [pausa] Encuentra una postura cómoda [pausa] 
Cierra suavemente los ojos [pausa] O mantén la mirada baja [pausa]"
"""
    
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}]
    )
    
    return response.content[0].text


# ═══════════════════════════════════════════════════════════════
# 2. TEXT-TO-SPEECH
# ═══════════════════════════════════════════════════════════════

def text_to_speech(text: str, output_file: str = "raw_voice.mp3") -> str:
    """
    Convierte texto a audio usando ElevenLabs.
    """
    # Procesar pausas para TTS
    text_processed = text.replace("[pausa]", ",,,")  # Triple comma = pausa larga
    
    # Voice settings sintérgicas
    voice_settings = VoiceSettings(
        stability=0.85,  # Alta estabilidad
        similarity_boost=0.75,
        style=0.2,  # Bajo estilo = más contemplativo
        use_speaker_boost=True
    )
    
    # Generar audio
    audio = generate(
        text=text_processed,
        voice=Voice(
            # Rachel: cálida, femenina, contemplativa
            voice_id="21m00Tcm4TlvDq8ikWAM",
            settings=voice_settings
        ),
        model="eleven_multilingual_v2",
        api_key=os.getenv("ELEVENLABS_API_KEY")
    )
    
    # Guardar
    with open(output_file, 'wb') as f:
        f.write(audio)
    
    print(f"✓ Audio generado: {output_file}")
    return output_file


# ═══════════════════════════════════════════════════════════════
# 3. AUDIO PROCESSING (Frecuencias Sintérgicas)
# ═══════════════════════════════════════════════════════════════

def add_binaural_beats(
    audio: np.ndarray,
    sr: int,
    carrier_freq: float = 200,  # Hz
    beat_freq: float = 10,  # Hz (alpha)
    mix: float = 0.12  # 12% binaural
) -> np.ndarray:
    """
    Agrega frecuencias binaurales.
    
    Crea efecto estéreo donde cada oído recibe frecuencia ligeramente diferente.
    El cerebro percibe la diferencia como "beat" de 10 Hz (alpha).
    """
    duration = len(audio) / sr
    t = np.linspace(0, duration, len(audio))
    
    # Generar tonos para cada canal
    left_tone = np.sin(2 * np.pi * carrier_freq * t)
    right_tone = np.sin(2 * np.pi * (carrier_freq + beat_freq) * t)
    
    # Normalizar
    left_tone = left_tone * 0.3
    right_tone = right_tone * 0.3
    
    # Convertir audio mono a estéreo
    if audio.ndim == 1:
        audio_stereo = np.stack([audio, audio])
    else:
        audio_stereo = audio.copy()
    
    # Mezclar
    audio_stereo[0] = audio_stereo[0] * (1 - mix) + left_tone * mix
    audio_stereo[1] = audio_stereo[1] * (1 - mix) + right_tone * mix
    
    return audio_stereo


def add_schumann_resonance(
    audio: np.ndarray,
    sr: int,
    mix: float = 0.08  # 8%
) -> np.ndarray:
    """
    Agrega Resonancia Schumann (7.83 Hz).
    
    Frecuencia electromagnética natural de la Tierra.
    Asociada con estados de coherencia profunda.
    """
    duration = len(audio) / sr
    t = np.linspace(0, duration, len(audio))
    
    # Generar onda de 7.83 Hz modulada
    schumann = np.sin(2 * np.pi * 7.83 * t)
    
    # Modular con envolvente suave
    envelope = 0.5 * (1 + np.sin(2 * np.pi * 0.1 * t))  # 0.1 Hz modulation
    schumann = schumann * envelope * 0.2
    
    # Mezclar en ambos canales
    if audio.ndim == 2:
        audio[0] = audio[0] * (1 - mix) + schumann * mix
        audio[1] = audio[1] * (1 - mix) + schumann * mix
    else:
        audio = audio * (1 - mix) + schumann * mix
    
    return audio


def add_spatial_reverb(
    audio: np.ndarray,
    sr: int,
    room_size: float = 0.7,
    wet: float = 0.25
) -> np.ndarray:
    """
    Agrega reverb espacial para sensación de profundidad.
    """
    # Crear impulse response simple
    ir_length = int(sr * room_size)
    ir = np.random.randn(ir_length) * np.exp(-np.arange(ir_length) / (ir_length * 0.5))
    ir = ir / np.max(np.abs(ir))
    
    # Aplicar convolución
    if audio.ndim == 2:
        audio_wet_0 = signal.fftconvolve(audio[0], ir, mode='same')
        audio_wet_1 = signal.fftconvolve(audio[1], ir, mode='same')
        audio_wet = np.stack([audio_wet_0, audio_wet_1])
    else:
        audio_wet = signal.fftconvolve(audio, ir, mode='same')
    
    # Normalizar
    audio_wet = audio_wet / np.max(np.abs(audio_wet))
    
    # Mezclar dry/wet
    audio_mixed = audio * (1 - wet) + audio_wet * wet
    
    return audio_mixed


def process_syntergic_audio(
    input_file: str,
    output_file: str = "syntergic_voice.wav",
    binaural_freq: float = 10,  # Hz (alpha)
    add_schumann: bool = True,
    add_reverb: bool = True
):
    """
    Pipeline completo de procesamiento sintérgico.
    """
    print(f"\n🎵 Procesando: {input_file}")
    
    # 1. Cargar audio
    import librosa
    audio, sr = librosa.load(input_file, sr=44100, mono=True)
    print(f"  ✓ Cargado: {len(audio)/sr:.1f}s @ {sr} Hz")
    
    # 2. Agregar frecuencias binaurales (alpha)
    audio = add_binaural_beats(audio, sr, beat_freq=binaural_freq)
    print(f"  ✓ Binaural {binaural_freq} Hz (alpha)")
    
    # 3. Schumann resonance (opcional)
    if add_schumann:
        audio = add_schumann_resonance(audio, sr)
        print(f"  ✓ Resonancia Schumann 7.83 Hz")
    
    # 4. Reverb espacial
    if add_reverb:
        audio = add_spatial_reverb(audio, sr)
        print(f"  ✓ Reverb espacial")
    
    # 5. Normalizar
    audio = audio / np.max(np.abs(audio)) * 0.95
    print(f"  ✓ Normalizado")
    
    # 6. Guardar
    # Transponer para formato correcto (channels, samples) → (samples, channels)
    audio_transposed = audio.T
    sf.write(output_file, audio_transposed, sr)
    print(f"  ✓ Guardado: {output_file}")
    print("🎵 ¡Audio sintérgico listo!\n")


# ═══════════════════════════════════════════════════════════════
# 4. MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════

def create_syntergic_meditation(
    duration_minutes: int = 10,
    user_level: str = "beginner",
    binaural_freq: float = 10,  # Hz
    output_file: str = "meditation.wav"
):
    """
    Pipeline completo: Script → TTS → Processing
    """
    print("\n" + "="*60)
    print(" GENERANDO MEDITACIÓN SINTÉRGICA")
    print("="*60)
    
    # 1. Generar script
    print("\n📝 1. Generando script con Claude...")
    script = generate_meditation_script(duration_minutes, user_level)
    print(f"✓ Script generado ({len(script)} caracteres)")
    print("\nPREVIEW:")
    print(script[:200] + "...")
    
    # 2. Text-to-Speech
    print("\n🎙️  2. Generando voz con ElevenLabs...")
    raw_audio = text_to_speech(script, "temp_raw.mp3")
    
    # 3. Procesamiento sintérgico
    print("\n🎵 3. Agregando frecuencias sintérgicas...")
    process_syntergic_audio(
        input_file=raw_audio,
        output_file=output_file,
        binaural_freq=binaural_freq,
        add_schumann=True,
        add_reverb=True
    )
    
    # 4. Cleanup
    os.remove("temp_raw.mp3")
    
    print("="*60)
    print(f"✅ LISTO: {output_file}")
    print("="*60)
    print("\nPuedes reproducirlo con:")
    print(f"  $ ffplay {output_file}")
    print("  o cualquier reproductor de audio\n")
    
    return output_file


# ═══════════════════════════════════════════════════════════════
# 5. CLI
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    
    # Parse args
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    level = sys.argv[2] if len(sys.argv) > 2 else "beginner"
    
    # Generate
    create_syntergic_meditation(
        duration_minutes=duration,
        user_level=level,
        binaural_freq=10,  # Alpha
        output_file=f"meditation_{duration}min.wav"
    )
```

---

## 🚀 USO

### Generar Meditación de 10 minutos

```bash
python voice_guide_simple.py 10 beginner
```

**Output:**
```
============================================================
 GENERANDO MEDITACIÓN SINTÉRGICA
============================================================

📝 1. Generando script con Claude...
✓ Script generado (1247 caracteres)

PREVIEW:
Bienvenido [pausa] Encuentra una postura cómoda [pausa] 
Cierra suavemente los ojos [pausa] O mantén la mirada baja...

🎙️  2. Generando voz con ElevenLabs...
✓ Audio generado: temp_raw.mp3

🎵 3. Agregando frecuencias sintérgicas...

🎵 Procesando: temp_raw.mp3
  ✓ Cargado: 10.3s @ 44100 Hz
  ✓ Binaural 10 Hz (alpha)
  ✓ Resonancia Schumann 7.83 Hz
  ✓ Reverb espacial
  ✓ Normalizado
  ✓ Guardado: meditation_10min.wav
🎵 ¡Audio sintérgico listo!

============================================================
✅ LISTO: meditation_10min.wav
============================================================

Puedes reproducirlo con:
  $ ffplay meditation_10min.wav
```

### Generar Meditación Avanzada de 20 minutos

```bash
python voice_guide_simple.py 20 advanced
```

---

## 🎛️ PERSONALIZACIÓN

### Cambiar Voz

```python
# En text_to_speech(), cambiar voice_id:

# Voces femeninas:
voice_id="21m00Tcm4TlvDq8ikWAM"  # Rachel (default) - cálida
voice_id="EXAVITQu4vr4xnSDxMaL"  # Bella - suave, espiritual
voice_id="ThT5KcBeYPX3keUQqHPh"  # Dorothy - madura, sabia

# Voces masculinas:
voice_id="pNInz6obpgDQGcFmaJgB"  # Adam - grave, calmado
voice_id="VR6AewLTigWG4xSOukaG"  # Arnold - profundo, contemplativo
```

### Cambiar Frecuencias

```python
# En create_syntergic_meditation():

# Para meditación profunda (theta):
binaural_freq=6  # Theta medio

# Para concentración (beta bajo):
binaural_freq=14  # Beta bajo

# Para sueño (delta):
binaural_freq=2  # Delta

# Para insight (gamma):
binaural_freq=40  # Gamma
```

### Ajustar Intensidad de Efectos

```python
# En process_syntergic_audio():

# Más binaural:
audio = add_binaural_beats(audio, sr, mix=0.20)  # 20% vs 12% default

# Más Schumann:
audio = add_schumann_resonance(audio, sr, mix=0.15)  # 15% vs 8%

# Más reverb:
audio = add_spatial_reverb(audio, sr, wet=0.40)  # 40% vs 25%
```

---

## 🎯 INTEGRACIÓN CON EEG

### Versión Adaptativa con Muse

```python
# voice_guide_adaptive.py

import asyncio
from muse_connector import MuseConnector

class AdaptiveVoiceGuide:
    def __init__(self):
        self.muse = MuseConnector()
        self.current_state = "onset"
        self.last_intervention = 0
    
    async def start_session(self):
        """Inicia sesión adaptativa"""
        # 1. Conectar Muse
        await self.muse.connect()
        
        # 2. Apertura fija
        await self.play_audio("opening.wav")
        
        # 3. Loop adaptativo
        while self.session_active:
            # Obtener estado EEG
            eeg_data = await self.muse.get_current_data()
            alpha = eeg_data['alpha']
            
            # Decidir intervención
            if alpha < 0.08 and time.time() - self.last_intervention > 60:
                # Alpha bajo, guiar hacia profundidad
                await self.generate_and_play_guidance("building")
                self.last_intervention = time.time()
            
            elif alpha >= 0.13:
                # Estado profundo, silencio total
                pass
            
            await asyncio.sleep(10)  # Check cada 10s
        
        # 4. Cierre
        await self.play_audio("closing.wav")
    
    async def generate_and_play_guidance(self, target_state: str):
        """Genera y reproduce guía adaptativa"""
        # Generar script corto
        script = generate_transition_script(
            from_state=self.current_state,
            to_state=target_state
        )
        
        # TTS
        audio = text_to_speech(script, "temp_guidance.mp3")
        
        # Procesar con frecuencia adaptada al estado
        freq = self.select_binaural_freq(target_state)
        process_syntergic_audio(
            "temp_guidance.mp3",
            "temp_guidance.wav",
            binaural_freq=freq
        )
        
        # Reproducir
        await self.play_audio("temp_guidance.wav")
    
    def select_binaural_freq(self, target_state: str) -> float:
        """Selecciona frecuencia según objetivo"""
        return {
            "onset": 8,      # Theta alto
            "building": 10,  # Alpha medio
            "meditation": 11,  # Alpha alto
            "deep": 10,      # Sostener alpha
        }.get(target_state, 10)

# Uso:
async def main():
    guide = AdaptiveVoiceGuide()
    await guide.start_session()

asyncio.run(main())
```

---

## 📊 ANÁLISIS POST-SESIÓN

### Comparar sesiones con/sin voz guía

```python
# compare_sessions.py

def compare_guided_vs_silent(
    guided_session_id: int,
    silent_session_id: int
):
    """
    Compara métricas de sesión guiada vs silenciosa.
    """
    guided = get_session_analysis(guided_session_id)
    silent = get_session_analysis(silent_session_id)
    
    print("\n" + "="*60)
    print("COMPARACIÓN: Guiada vs Silenciosa")
    print("="*60)
    
    metrics = [
        ("Tiempo en estado profundo (α≥0.13)", 
         guided['time_deep'], silent['time_deep'], "%"),
        ("Alpha promedio",
         guided['avg_alpha'], silent['avg_alpha'], ""),
        ("Alpha máximo",
         guided['max_alpha'], silent['max_alpha'], ""),
        ("Coherencia promedio",
         guided['avg_coherence'], silent['avg_coherence'], ""),
        ("Eventos de distracción",
         len(guided['events']), len(silent['events']), ""),
    ]
    
    for name, guided_val, silent_val, unit in metrics:
        diff = guided_val - silent_val
        pct_change = (diff / silent_val * 100) if silent_val > 0 else 0
        
        symbol = "↑" if diff > 0 else "↓" if diff < 0 else "="
        
        print(f"\n{name}:")
        print(f"  Guiada:    {guided_val:.3f}{unit}")
        print(f"  Silenciosa: {silent_val:.3f}{unit}")
        print(f"  Diferencia: {symbol} {abs(diff):.3f}{unit} ({pct_change:+.1f}%)")
    
    print("\n" + "="*60)

# Ejemplo:
compare_guided_vs_silent(
    guided_session_id=142,
    silent_session_id=141
)
```

---

## 🎨 SCRIPTS EJEMPLO

### Script de Apertura (Principiante)

```
Bienvenido [pausa]

Encuentra un lugar cómodo para sentarte [pausa]
La espalda recta pero relajada [pausa]
Las manos descansando naturalmente [pausa]

Cierra suavemente los ojos [pausa]
O mantén la mirada baja [pausa]

No hay nada que lograr aquí [pausa]
Solo presencia [pausa]

Comienza notando la respiración [pausa]
Cómo entra [pausa]
Cómo sale [pausa]

Sin cambiar nada [pausa]
Solo observando [pausa]
```

### Script de Transición (Onset → Building)

```
Nota cómo algo se asienta [pausa]

La mente todavía viaja [pausa]
Es natural [pausa]

Cada vez que notes un pensamiento [pausa]
Vuelve suavemente [pausa]

A la respiración [pausa]
Al cuerpo [pausa]
Al momento presente [pausa]
```

### Script de Celebración (Alcanzando Deep State)

```
Así [pausa]

Sostenlo con suavidad [pausa]

Sin aferrarte [pausa]
Solo habitando [pausa]

Esta quietud [pausa]
```

### Script de Cierre

```
Lentamente [pausa]
Trae tu atención de vuelta [pausa]

Nota los sonidos alrededor [pausa]
La sensación del cuerpo [pausa]

Mueve suavemente los dedos [pausa]
Los pies [pausa]

Cuando estés listo [pausa]
Abre los ojos [pausa]

Lleva esta calma contigo [pausa]
Hasta el próximo encuentro [pausa]
```

---

## 🔧 TROUBLESHOOTING

### Error: "ElevenLabs API key invalid"

```bash
# Verificar key
echo $ELEVENLABS_API_KEY

# Si está vacío, set:
export ELEVENLABS_API_KEY="your-key-here"

# O agregar a .env
echo "ELEVENLABS_API_KEY=your-key" >> .env
```

### Audio suena distorsionado

```python
# Reducir mix de efectos:
audio = add_binaural_beats(audio, sr, mix=0.08)  # Menos binaural
audio = add_spatial_reverb(audio, sr, wet=0.15)  # Menos reverb
```

### Voz suena muy rápida/lenta

```python
# En VoiceSettings:
voice_settings = VoiceSettings(
    stability=0.85,
    similarity_boost=0.75,
    style=0.2,
    speaking_rate=0.85  # <-- Ajustar (0.5-2.0)
)
```

### Script demasiado corto/largo

```python
# Ajustar en generate_meditation_script():
# Cambiar fórmula:
words_per_minute = 25  # Más lento (default: 30)
total_words = duration_minutes * words_per_minute
```

---

## 📈 PRÓXIMOS PASOS

1. **Generar tu primera meditación**
   ```bash
   python voice_guide_simple.py 5 beginner
   ```

2. **Probarla en una sesión real**
   - Escucha con audífonos (necesario para binaurales)
   - Toma nota de qué partes funcionan/no funcionan

3. **Iterar**
   - Ajustar prompts para mejor flujo
   - Experimentar con frecuencias
   - Personalizar voz

4. **Integrar con EEG**
   - Usar `voice_guide_adaptive.py`
   - Adaptar en tiempo real

---

¿Listo para crear tu primera voz guía? 🎙️✨