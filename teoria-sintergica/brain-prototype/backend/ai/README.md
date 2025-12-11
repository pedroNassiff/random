# Sintergia AI: El "Cerebro" Digital

Este módulo contiene la inteligencia artificial que procesa señales EEG para simular (y eventualmente predecir) el Campo Sintérgico.

## 1. El Dataset: PhysioNet EEG (Motor Imagery)

Utilizamos el dataset público **EEG Motor Movement/Imagery Dataset** proporcionado por PhysioNet.

*   **Origen:** [PhysioNet EEGBCI](https://physionet.org/content/eegmmidb/1.0.0/)
*   **Descripción:** Grabaciones de EEG de 64 canales de 109 voluntarios.
*   **Experimento:** Los sujetos realizaban tareas de mover manos/pies o **imaginar** que los movían.
*   **Por qué lo usamos:**
    *   La "Imaginación Motora" es lo más cercano a medir un "pensamiento puro" o intención sin acción física, lo cual resuena con el concepto de Lattice y potencialidad.
    *   Tiene 64 canales, lo que nos da una buena resolución espacial para simular la topología del campo neuronal.

### Estructura de Datos
Los datos crudos se descargan automáticamente en `backend/data`.
*   **Frecuencia de Muestreo:** 160Hz.
*   **Preprocesamiento (en `dataset.py`):**
    *   Filtro Pasa-Banda: 1Hz - 50Hz (Cubre ondas Delta, Theta, Alpha, Beta, Gamma).
    *   Normalización: Z-Score para estandarizar la varianza entre sujetos.
    *   Epoching: Ventanas de 1 segundo.

## 2. Arquitectura: Variational Autoencoder (VAE)

No usamos una red neuronal convencional (clasificador), sino un modelo generativo **VAE**.

### Filosofía Sintérgica
Según Grinberg, el cerebro interactúa con la Lattice creando un "Campo Neuronal".
*   **Encoder:** Representa la capacidad del cerebro de comprimir la información infinita de la Lattice en un percepto finito.
*   **Latent Space ($z$):** Es la representación matemática del **Campo Sintérgico**. Un vector de baja dimensión (ej. 32 floats) que contiene la "semilla" de la realidad perciba.
*   **Decoder:** Representa la expansión de ese campo hacia la percepción consciente (colapso de función de onda).

### Implementación (`model.py`)
*   **Framework:** PyTorch.
*   **Entrada:** Vector plano de actividad eléctrica (64 canales x 160 muestras).
*   **Capa Oculta (Campo):** 2 vectores: Media ($\mu$) y Varianza ($\sigma$).
*   **Salida:** Reconstrucción de la señal original.

### Interpretación de Variables
El modelo traduce el vector latente a parámetros visuales para el Frontend 3D:
1.  **Coherencia:** Calculada como la inversa de la varianza del espacio latente ($1 / \sigma$). Menor ruido neuronal = Mayor Sintergia.
2.  **Foco de Atención:** Las dimensiones principales del vector $\mu$ se mapean a coordenadas X, Y, Z.

## 3. Entrenamiento

Para entrenar el modelo con los datos de PhysioNet:

```bash
cd backend/ai
python train.py
```

El script descargará los datos, entrenará el VAE y guardará el modelo en `syntergic_vae.pth`.
