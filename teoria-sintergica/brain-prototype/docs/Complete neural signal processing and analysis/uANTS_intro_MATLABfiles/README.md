# Cómo ejecutar los scripts del curso ANTS

Scripts del curso **Complete Neural Signal Processing and Analysis** (Udemy).  
Pueden correrse con **MATLAB** (licencia) o **GNU Octave** (gratis).

---

## Opción A — GNU Octave (gratis, recomendado)

### 1. Instalar Octave
```bash
brew install octave
```
O descarga el instalador desde https://octave.org/download

### 2. Instalar paquetes necesarios
Dentro de Octave:
```octave
pkg install -forge signal
pkg install -forge statistics
pkg install -forge image
```

### 3. Ejecutar un script
```bash
# Desde terminal, pararte en esta carpeta
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/docs/Complete\ neural\ signal\ processing\ and\ analysis/uANTS_intro_MATLABfiles

# Correr un script
octave uANTS_intro.m

# O lanzar la GUI de Octave
octave --gui
```

Desde la GUI: `File > Open` → seleccioná el `.m` → botón `Run`.

> **Nota:** Para los plots de topografía usar `topoplotIndieOctave.m` en lugar de `topoplotIndie.m`.

---

## Opción B — MATLAB (licencia)

### 1. Abrir MATLAB y navegar a la carpeta
```
cd '/Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype/docs/Complete neural signal processing and analysis/uANTS_intro_MATLABfiles'
```

### 2. Cargar un dataset `.mat`
```matlab
load('sampleEEGdata.mat')   % carga variable EEG en workspace
load('v1_laminar.mat')       % carga datos de corteza laminar
whos                         % ver qué hay cargado
```

### 3. Correr un script
```matlab
run('uANTS_intro.m')
% o simplemente abrir el archivo y pulsar Run (F5)
```

---

## Archivos del curso

| Archivo | Qué es |
|---|---|
| `uANTS_intro.m` | Script principal — ejercicios de la sección |
| `uANTS_intro_SOL.m` | Soluciones oficiales |
| `uANTS_simulate_problemset.m` | Problem set de simulación |
| `uANTS_simulate_problemset_SOL.m` | Soluciones del problem set |
| `plot_simEEG.m` | Función helper para plots EEG simulados |
| `topoplotIndie.m` | Plot de topografía (MATLAB) |
| `topoplotIndieOctave.m` | Plot de topografía (Octave) |
| `sampleEEGdata.mat` | Dataset EEG de ejemplo *(no commiteado)* |
| `v1_laminar.mat` | Datos de señal cortical laminar *(no commiteado)* |

---

## Troubleshooting

**Error: `undefined function`**  
→ Asegurate de estar parado en esta carpeta (`cd` a la ruta) antes de correr el script.

**Octave no encuentra `pkg`**  
→ Corré `octave` desde terminal, no con `octave-cli`.

**Plot no se ve / ventana vacía**  
→ En Octave agregar al inicio del script: `graphics_toolkit qt` o `graphics_toolkit gnuplot`
