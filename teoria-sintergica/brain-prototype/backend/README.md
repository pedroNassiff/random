# Backend del Cerebro Sintérgico

Este componente actúa como el "Generador de Campo", simulando los estados de conciencia que se visualizan en el frontend 3D.

## Estructura

*   `main.py`: Punto de entrada de la API (FastAPI) y gestor del WebSocket.
*   `ai/model.py`: **SyntergicVAE** (Red Neuronal) implementada en PyTorch.
*   `ai/inference.py`: Motor de inferencia que carga datasets reales (PhysioNet) y genera estados.
*   `ai/dataset.py`: Cargador y pre-procesador de señales EEG (MNE-Python).
*   `models.py`: Definición de datos (Pydantic).

## Instalación y Ejecución

Es recomendable usar un entorno virtual para no ensuciar tu sistema global.

### 1. Crear entorno virtual
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 3. Correr el servidor
```bash
uvicorn main:app --reload --port 8000
```

## Endpoints

*   `GET /`: Health check.
*   `POST /set-mode/{mode}`: Cambia el set de datos que alimenta la IA.
    *   `relax` -> Datos de meditación/ojos cerrados (Alpha).
    *   `focus` -> Datos de imaginación motora (Beta/Gamma).
*   `WS /ws/brain-state`: Stream de datos en tiempo real (5Hz). Envía:
    *   `coherence`: Sincronía global (0.0 - 1.0).
    *   `focal_point`: Coordenadas {x,y,z} de la atención (Vector Latente).
    *   `entropy`: Nivel de desorden.

3.  **Output:** Parámetros sintérgicos hacia el Frontend.

### Guía de Entrenamiento de IA (Manual)

Para entrenar tu propia "Lattice Artificial", sigue estos pasos en tu terminal:

1.  **Activar entorno virtual (si no lo estás ya):**
    ```bash
    cd backend
    source venv/bin/activate
    ```

2.  **Instalar dependencias de IA (Pesadas ~2GB):**
    Esto instalará PyTorch y MNE.
    ```bash
    pip install -r requirements.txt
    ```

3.  **Ejecutar el entrenamiento:**
    Entramos a la carpeta de IA y corremos el script.
    ```bash
    cd ai
    python train.py
    ```

    **¿Qué verás?**
    *   Primero descargará datos de PhysioNet (`Loading EEG data...`).
    *   Luego verás barras de progreso por cada "Epoch":
        `Epoch: 1 | Average Loss: 5432.10`
        `Epoch: 2 | Average Loss: 4321.05`
    *   Al finalizar, generará un archivo `syntergic_vae.pth`.
