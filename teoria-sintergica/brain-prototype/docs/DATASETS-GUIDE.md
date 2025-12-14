# 📚 Guía de Datasets EEG Gratuitos

## Datasets Accesibles (Sin Aprobación)

### ⭐ RECOMENDADO: OpenNeuro ds003969

**URL**: https://openneuro.org/datasets/ds003969  
**Nombre**: "Meditation and mindfulness EEG dataset"

**Características**:
- 40 sujetos (20 meditadores expertos, 20 controles)
- Sesiones de 8 minutos
- 64 canales @ 500 Hz
- Protocolo: 2min baseline + 6min focused attention meditation
- Formato: BrainVision (.vhdr, .vmrk, .eeg)

**Descarga con datalad**:
```bash
pip install datalad
datalad install https://github.com/OpenNeuroDatasets/ds003969.git
cd ds003969
datalad get sub-01/eeg/  # Descargar sujeto 1
```

**Convertir a EDF para usar con MNE**:
```python
import mne
raw = mne.io.read_raw_brainvision('sub-01/eeg/sub-01_task-meditation_eeg.vhdr', preload=True)
raw.export('sub-01_meditation.edf', fmt='edf')
```

---

### 🔬 Alternativa: Buscar en Zenodo

**URL**: https://zenodo.org  
**Buscar**: "meditation EEG" o "mindfulness EEG" o "resting state EEG"

**Datasets típicos**:
- EEG durante meditación Vipassana (20-30 min)
- Mindfulness training longitudinal (múltiples sesiones)
- Resting state antes/después de intervención

**Formato**: Generalmente EDF o BrainVision

**Ejemplo de búsqueda**:
1. Ir a https://zenodo.org
2. Buscar: `meditation EEG filetype:edf`
3. Filtrar por: "Open Access"
4. Descargar .zip directamente

---

### 📊 Kaggle Datasets

**URL**: https://www.kaggle.com/datasets  
**Buscar**: "EEG meditation" o "EEG emotions"

**Datasets populares**:
- **EEG Brainwave Dataset: Feeling Emotions**
  - https://www.kaggle.com/datasets/birdy654/eeg-brainwave-dataset-feeling-emotions
  - 3 estados emocionales
  - 14 canales (Emotiv EPOC)
  - Descarga directa (requiere cuenta gratuita)

- **Meditation vs Awake EEG**
  - Buscar "meditation" en Kaggle datasets
  - Varios usuarios han subido datos de Muse headband

**Cómo usar**:
```bash
# Instalar Kaggle CLI
pip install kaggle

# Configurar API key (descargar de https://www.kaggle.com/settings)
mkdir ~/.kaggle
mv kaggle.json ~/.kaggle/

# Descargar dataset
kaggle datasets download -d birdy654/eeg-brainwave-dataset-feeling-emotions
unzip eeg-brainwave-dataset-feeling-emotions.zip
```

---

### 🧠 BNCI Horizon 2020

**URL**: http://bnci-horizon-2020.eu/database/data-sets  
**Dataset recomendado**: 009-2014 (Motor Imagery + Resting)

**Características**:
- 25 sujetos
- Incluye períodos de reposo de 2-5 minutos
- 16 canales @ 512 Hz
- Formato GDF (compatible con MNE)

**Descarga**:
```bash
wget http://bnci-horizon-2020.eu/database/data-sets/009-2014/009-2014.zip
unzip 009-2014.zip
```

**Cargar en Python**:
```python
import mne
raw = mne.io.read_raw_gdf('BNCI009_S01.gdf', preload=True)
```

---

## 🛠️ Configurar en el Prototipo

### Opción 1: Usar Dataset Descargado

1. **Descargar dataset** (OpenNeuro, Zenodo, Kaggle)
2. **Colocar archivos EDF** en `backend/data/meditation/`
3. **Modificar session_player.py**:

```python
# En session_player.py, método load_meditation_session()
def load_meditation_session(self, subject='01'):
    edf_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), 
        'data', 
        'meditation', 
        f'sub-{subject}_meditation.edf'
    )
    
    if not os.path.exists(edf_path):
        print(f"⚠ Meditation session not found: {edf_path}")
        print("Download dataset and place EDF files in backend/data/meditation/")
        return
    
    self.load_session(edf_path)
```

4. **Llamar al inicializar**:

```python
# En inference.py __init__
self.session_player = SessionPlayer(window_duration=2.0)
self.session_player.load_meditation_session(subject='01')
```

---

### Opción 2: Usar PhysioNet EEG Motor Movement/Imagery

**Ya lo tenés instalado** (viene con MNE), solo hay que usar runs más largos:

```python
# En session_player.py
from mne.datasets import eegbci

# Run 1: Baseline, eyes open (1 min)
# Run 2: Baseline, eyes closed (1 min) ← Actualmente usando este
# Runs 3-14: Tareas de motor imagery (1 min cada uno)

# Para sesión más larga, concatenar runs:
raw_fnames = eegbci.load_data(subjects=[1], runs=[1, 2, 3], path=data_path)
raw_files = [mne.io.read_raw_edf(f, preload=True, verbose=False) for f in raw_fnames]
raw = mne.concatenate_raws(raw_files)  # ~3 minutos total
```

---

## 🎯 Protocolo Ideal para Prototipo

**Estructura de sesión que querés observar**:

```
Fase 1: BASELINE (2-5 min)
  - Ojos cerrados, sin instrucción
  - Alpha bajo-moderado (0.3-0.5)
  - Coherencia baja (0.3-0.5)
  
Fase 2: MEDITACIÓN (10-20 min)
  - Focused attention o Vipassana
  - Alpha sube gradualmente
  - Coherencia aumenta (0.5 → 0.8)
  - Posibles spikes de Gamma (insights)
  
Fase 3: POST (2-5 min)
  - Observación residual
  - Alpha aún elevado (efecto carry-over)
  - Coherencia desciende lentamente
```

**Datasets que cumplen este protocolo**:
1. ✅ OpenNeuro ds003969 (8 min, 2 baseline + 6 meditation)
2. ✅ Zenodo meditation datasets (20-30 min, protocolo completo)
3. ❌ PhysioNet Motor Imagery (solo 1 min por run, tareas no meditativas)

---

## 📥 Descarga Rápida (Copy-Paste)

### Usando OpenNeuro (Recomendado)

```bash
# Terminal en backend/
pip install datalad

# Clonar dataset
cd data/
datalad install https://github.com/OpenNeuroDatasets/ds003969.git
cd ds003969

# Descargar primer sujeto
datalad get sub-01/eeg/

# Convertir a EDF
cd ../../
python3 << EOF
import mne
raw = mne.io.read_raw_brainvision(
    'data/ds003969/sub-01/eeg/sub-01_task-meditation_eeg.vhdr', 
    preload=True
)
raw.export('data/meditation/sub-01_meditation.edf', fmt='edf')
print("✓ Converted to EDF format")
EOF
```

### Descarga Manual (Zenodo)

1. Ir a: https://zenodo.org
2. Buscar: `meditation EEG`
3. Elegir dataset con:
   - ✅ "Open Access"
   - ✅ Formato EDF o BrainVision
   - ✅ Duración > 10 minutos
4. Click "Download" (archivo .zip)
5. Extraer en `backend/data/meditation/`

---

## ✅ Verificar Instalación

```python
# Test script: backend/test_session.py
import os
from ai.session_player import SessionPlayer

player = SessionPlayer()

# Si cargaste dataset meditation:
player.load_meditation_session(subject='01')

# Verificar metadata
print(player.session_metadata)
print(f"Duration: {player.total_duration/60:.1f} minutes")

# Obtener primera ventana
window = player.next_window()
print(f"Window shape: {window['data'].shape}")
print(f"Timestamp: {window['timestamp']:.1f}s")
```

---

## 🆘 Troubleshooting

**Error: "Meditation session not found"**
→ Archivo EDF no está en `backend/data/meditation/`
→ Verificar path con `ls backend/data/meditation/`

**Error: "Bad data format"**
→ Convertir a EDF si está en otro formato:
```python
import mne
raw = mne.io.read_raw_brainvision('archivo.vhdr', preload=True)
raw.export('archivo.edf', fmt='edf')
```

**Error: "Datalad not found"**
→ Instalar: `pip install datalad`
→ Alternativamente, descargar .zip manualmente de OpenNeuro

---

## 📞 Contacto

Si descargás un dataset y querés ayuda para integrarlo, pegá:
1. Nombre del dataset
2. Formato de archivo (.edf, .vhdr, .fif, etc)
3. Output de `ls -lh backend/data/meditation/`

---

**Última actualización**: 12 de diciembre de 2025
