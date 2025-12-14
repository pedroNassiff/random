# Datasets - Brain Prototype

> ⚠️ **Los datasets NO están incluidos en el repositorio de Git** (son muy pesados: ~256 MB)

## 📥 Cómo Obtener los Datos

### Opción 1: Descargar Automáticamente (Recomendado)

El backend descarga automáticamente los datasets la primera vez que ejecutas el servidor:

```bash
cd backend
source venv/bin/activate
python -c "from ai.dataset import load_eeg_data; load_eeg_data()"
```

Esto descargará:
- **MNE-EEGBCI Dataset** (~110 MB) - Motor imagery data
- Se guarda en: `backend/data/MNE-eegbci-data/`

### Opción 2: PhysioNet Dataset (Manual)

Para el dataset completo de meditación:

```bash
cd backend
wget -r -N -c -np https://physionet.org/files/meditation-eeg/1.0.0/
mv physionet.org/files/meditation-eeg/1.0.0 ./ds003969/
rm -rf physionet.org
```

### Opción 3: Dataset Sintético (Para Testing)

Si no necesitas datos reales:

```python
# backend/data/generate_synthetic.py
import numpy as np
from scipy import signal

def generate_synthetic_eeg(duration=60, fs=256):
    """Genera señal EEG sintética para testing"""
    t = np.arange(0, duration, 1/fs)
    
    # Simular bandas de frecuencia
    delta = 0.5 * np.sin(2 * np.pi * 2 * t)   # 2 Hz
    theta = 0.8 * np.sin(2 * np.pi * 6 * t)   # 6 Hz
    alpha = 1.0 * np.sin(2 * np.pi * 10 * t)  # 10 Hz
    beta = 0.4 * np.sin(2 * np.pi * 20 * t)   # 20 Hz
    
    # Mezclar + ruido
    eeg = delta + theta + alpha + beta + 0.2 * np.random.randn(len(t))
    return eeg

# Usar en desarrollo
eeg_data = generate_synthetic_eeg()
```

## 📂 Estructura Esperada

```
backend/
├── data/
│   ├── MNE-eegbci-data/          # Auto-descargado por MNE
│   │   └── files/eegmmidb/...
│   └── meditation/                # Datasets custom (opcional)
│       └── *.edf
├── ds003969/                      # PhysioNet dataset (opcional)
│   ├── sub-001/
│   ├── sub-002/
│   └── ...
└── ai/
    └── models/                    # Modelos entrenados (generados)
        └── *.pth
```

## 🔬 Datasets Soportados

### MNE-EEGBCI (Motor Imagery)
- **Sujetos:** 109
- **Tareas:** Imaginación motora (manos, pies)
- **Canales:** 64
- **Frecuencia:** 160 Hz
- **Formato:** `.edf`
- **Licencia:** Open Data Commons

### PhysioNet Meditation EEG
- **Sujetos:** 50+
- **Tareas:** Meditación, eyes open/closed
- **Canales:** 8-32 (variable)
- **Frecuencia:** 256 Hz
- **Formato:** `.edf` / `.fif`
- **Licencia:** Open Database License

## ⚙️ Configuración

El backend busca datasets en este orden:

1. `backend/ds003969/` (PhysioNet completo)
2. `backend/data/MNE-eegbci-data/` (MNE auto-download)
3. `backend/data/meditation/` (Custom datasets)

Si no encuentra ninguno, usa datos sintéticos (ver Opción 3).

## 🚀 Verificar Instalación

```bash
cd backend
python test_analysis.py
```

Deberías ver:
```
✅ Spectral analysis: OK
✅ Coherence calculation: OK
✅ Dataset loading: OK
```

## 📚 Referencias

- [PhysioNet](https://physionet.org/)
- [MNE-Python Datasets](https://mne.tools/stable/overview/datasets_index.html)
- [EEG Motor Movement/Imagery Dataset](https://physionet.org/content/eegmmidb/1.0.0/)

## ❓ Troubleshooting

**Error: "No EEG data found"**
```bash
# Forzar descarga
python -c "from ai.dataset import load_eeg_data; load_eeg_data(force=True)"
```

**Error: "Permission denied"**
```bash
# Dar permisos
chmod -R 755 backend/data/
```

**Datasets muy lentos para descargar**
- Usa datos sintéticos durante desarrollo (Opción 3)
- Descarga solo 1-2 sujetos en lugar del dataset completo
