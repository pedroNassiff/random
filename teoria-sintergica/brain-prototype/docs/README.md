# Prototipo Cerebro Sintérgico (AI + 3D)

> **"La realidad es el resultado de la interacción entre el Campo Neuronal y la Lattice." — Jacobo Grinberg**

Este proyecto es una implementación técnica de la **Teoría Sintérgica**, utilizando Inteligencia Artificial (Deep Learning) para simular y visualizar cómo la conciencia interactúa con la estructura del espacio-tiempo.

## 🧠 Características Principales (v0.2)

1.  **Motor de Inferencia (AI Backend):**
    *   **VAE (Variational Autoencoder):** Una red neuronal entrenada con datos reales de EEG (PhysioNet) comprime la actividad cerebral en un "Espacio Latente" (El Campo Sintérgico).
    *   **Multi-Modo:** Capacidad de alternar en tiempo real entre estados de "Meditación" (Alpha) y "Atención Activa" (Beta/Gamma).
    *   **Streaming:** Transmisión de vectores de conciencia a 5Hz vía WebSockets.

2.  **Visualización Holográfica (Frontend 3D):**
    *   **Dark Void Shader:** Renderizado volumétrico que solo ilumina las regiones tocadas por la atención.
    *   **Neuro-HUD:** Interfaz científica que muestra métricas de Coherencia, Entropía y Frecuencia en tiempo real.
    *   **The Orb:** Representación visual del "Observador" colapsando la función de onda.

## 🚀 Guía de Inicio

Necesitas dos terminales abiertas:

**Terminal 1: El Generador de Campo (Backend)**
```bash
cd backend
source venv/bin/activate  # O el comando de tu OS
uvicorn main:app --reload --port 8000
```

**Terminal 2: El Observador (Frontend)**
```bash
cd frontend
npm run dev
```

Abre `http://localhost:5173`. Usa los botones **RELAX / FOCUS** arriba a la derecha para experimentar la simulación.


- Motivaciones para afrontar un nuevo reto profesional:
    - soy una persona que le gustan los desafios, crecer profesional y personalmente y aprender constantemente
- Razones para dejar tu actual (o último) puesto-compañía:
    he finalizado y entregado el proyecto para hub city guides, me han propuesto bolsa de horas para mantentenimiento pero no me cuadraba economicamente 
-Salario bruto/año actual (o último):
    55.000
- Expectativas económicas para este nuevo reto (bruto/año):
    55.000 / 60.000
- Tiempo mínimo que necesitarías para incorporación en caso de acuerdo: 
    18 de mayo en adelante
-¿Tienes nacionalidad española o permiso de trabajo en vigor para ser contratado en España laboralmente a tiempo completo sin restricciones?
    Si, tengo permiso de trabajo en vigor para ser contratado en España laboralmente a tiempo completo sin restricciones