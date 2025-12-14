# Frontend de la Interfaz Sintérgica

Esta aplicación hecha en **React + Three.js** visualiza el Campo Neuronal basándose en los datos servidos por el procesamiento del Backend.

## Estructura

*   `src/components/canvas/`: Componentes 3D (Cerebro, Escena).
*   `src/shaders/`: Shaders GLSL personalizados (SyntergicMaterial).
*   `src/store/`: Estado global (Zustand) que sincroniza WebSocket -> Visualización.

## Requisitos Previos

*   Node.js (v18 recomendada)
*   NPM

## Instalación y Ejecución

### 1. Instalar dependencias
Desde la carpeta `frontend`:
```bash
npm install
```

### 2. Iniciar el servidor de desarrollo
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`.

## Controles de la UI (Panel Lateral)

*   **Lighting:** Ajusta la intensidad y el mapa de entorno.
*   **Brain Properties:** (Si activado) Ajustes de debug del shader.

## Integración con Backend

La aplicación intenta conectarse automáticamente a `ws://localhost:8000/ws/brain-state` al iniciar.
*   **Si el backend está corriendo:** Verás el cerebro "respirar" y moverse solo.
*   **Si el backend NO está corriendo:** Verás el cerebro estático y un mensaje de error en la consola del navegador.
