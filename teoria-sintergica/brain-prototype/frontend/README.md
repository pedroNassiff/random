# Prototipo Cerebro Sintérgico v0.1: La Interfaz de la Conciencia

> *"La cualidad de la experiencia depende de la coherencia del campo sinérgico."* — Jacobo Grinberg

Este documento detalla la traducción de conceptos abstractos de la Teoría Sintérgica a mecanismos de ingeniería de software tangibles dentro de este prototipo.

---

## 🔬 Mapeo Profundo: Teoría vs. Implementación

### 1. El Campo Neuronal (The Neural Field)
**Teoría:**
El cerebro no solo procesa información internamente; crea un campo energético "distorsionado" resultante de la actividad sincrónica de millones de neuronas. Este campo interactúa con la Lattice (la matriz del espacio-tiempo). La **forma** de este campo determina la percepción.

**Práctica (Código):**
En nuestro shader (`SyntergicMaterial.js`), el Campo Neuronal no es una textura pegada, es una función matemática viva:
*   ** Distorsión Local:** Usamos funciones de distancia (`distance(vPosition, uHover)`) para simular cómo un pensamiento (foco de atención) deforma el espacio alrededor de una coordenada física.
*   **Intensidad:** La variable `uHoverIntensity` controla la "fuerza" de esta distorsión. Una alta intensidad en el código representa una alta energía emocional/sináptica en la teoría.

### 2. La Lattice (La Estructura del Espacio)
**Teoría:**
Una matriz de información de capacidad infinita y simetría perfecta. En reposo es invisible. Solo se vuelve visible o "sensible" cuando un objeto masivo (cerebro/materia) la distorsiona. 

**Práctica (Código):**
*   **Wireframe:** La opción de `wireframe` en nuestro componente React no es estética; es la representación de la estructura topológica subyacente.
*   **Geometry Nodes (Futuro):** Planeamos usar nodos geométricos para mostrar líneas que conectan el cerebro con el espacio vacío alrededor, visualizando la "red" invisible.

### 3. Coherencia Interhemisférica y Sintergia
**Teoría:**
La **Sintergia** (Síntesis de Energía) es la medida de coherencia del campo. 
*   **Baja Sintergia:** Cerebro caótico, hemisferios desincronizados. Percepción fragmentada.
*   **Alta Sintergia:** Hemisferios unificados. El campo neuronal se "camufla" con la Lattice (alta simetría). Estados de conciencia pura.

**Práctica (Código):**
*   **Estado Global (Zustand):** La variable `coherence` en `brainStore.js` actúa como el modulador maestro.
*   **Visualización:** 
    *   *Coherencia 0.0:* El shader muestra ruido, colores dispares en izquierda/derecha.
    *   *Coherencia 1.0:* El shader unifica el color (ej. Dorado/Blanco), elimina el ruido y sincroniza el pulso (`sin(uTime)`) de ambos hemisferios perfectamente.

### 4. El Factor de Direccionalidad (La Atención)
**Teoría:**
La conciencia tiene un "vector". Donde pones tu atención, colapsas la función de onda y creas realidad. Grinberg lo llamaba el "Factor de Direccionalidad".

**Práctica (Código):**
*   **Interacción:** El vector `uHover` (X, Y, Z) que controlas con los sliders (o el mouse a futuro) **ES** el Factor de Direccionalidad. 
*   Donde sitúas este vector, el shader "resuelve" la geometría (la ilumina). Donde no hay vector, la geometría permanece en "oscuridad" o potencialidad latente.

---

## 🔮 Estado Actual (v0.2)
*   **Visualización:** Shader "Materia Oscura" implementado. Solo se ilumina la región activa por la atención.
*   **Interfaz:** HUD Científico + Panel Educativo "Neuro-Syntergic Log".
*   **Interactividad:** Selector de Modos (Relax/Focus) funcional.
*   **Conexión:** WebSocket recibiendo inferencia de PyTorch en tiempo real.

## 🛠 Arquitectura del Sistema (El Patrón del Observador)

1.  **Estado (La Realidad Implicada):** `useBrainStore` contiene la verdad matemática del sistema.
2.  **Render (La Realidad Explicada):** `Brain.jsx` + `SyntergicMaterial` colapsan ese estado en luz.
3.  **Feedback:** El usuario puede cambiar el estímulo (`setMode`), alterando la fuente de datos en el Backend.
