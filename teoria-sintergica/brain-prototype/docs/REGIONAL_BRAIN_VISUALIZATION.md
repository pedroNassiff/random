# Sistema de Iluminación Regional del Cerebro por Frecuencias EEG

## 🎨 Mapeo Anatómico → Frecuencias

Este sistema ilumina regiones específicas del cerebro en 3D basándose en la actividad de cada banda de frecuencia EEG en tiempo real.

### Mapeo Región ↔ Frecuencia

```
┌─────────────────────┬─────────────┬──────────────┬─────────────────────────┐
│ Región Cerebral     │ Frecuencia  │ Hz           │ Estado Mental           │
├─────────────────────┼─────────────┼──────────────┼─────────────────────────┤
│ Central/Tálamo      │ Delta       │ 0.5-4 Hz     │ Sueño profundo          │
│ Temporal/Hipocampo  │ Theta       │ 4-8 Hz       │ Meditación, creatividad │
│ Occipital           │ Alpha       │ 8-13 Hz      │ Relajación, coherencia  │
│ Frontal             │ Beta        │ 13-30 Hz     │ Concentración activa    │
│ Prefrontal          │ Gamma       │ 30-50 Hz     │ Insight, binding        │
└─────────────────────┴─────────────┴──────────────┴─────────────────────────┘
```

## 🧠 Visualización en 3D

### Regiones y Colores

```
        [Prefrontal - Gamma 🔴]
              (Insight)
                  ▲
                  │
         [Frontal - Beta 🟠]
           (Concentración)
                  │
                  │
        ◄─────────●─────────►
       Temporal   │   Temporal
       (Theta 🔵) │   (Theta 🔵)
                  │
           [Central - Delta 🟣]
             (Sueño profundo)
                  │
                  ▼
          [Occipital - Alpha 🟢]
            (Relajación)
```

### Colores del Sistema

- 🟣 **Púrpura (#8b5cf6)**: Delta - Centro/Tálamo
- 🔵 **Azul (#3b82f6)**: Theta - Temporal/Hipocampo  
- 🟢 **Verde (#10b981)**: Alpha - Occipital (COHERENCIA SINTÉRGICA)
- 🟠 **Naranja (#f59e0b)**: Beta - Frontal
- 🔴 **Rojo (#ef4444)**: Gamma - Prefrontal

## ⚙️ Funcionamiento Técnico

### Shader de Regiones

El shader personalizado (`RegionalBrainActivity.jsx`) calcula la influencia de cada región en cada punto del cerebro:

```glsl
// Para cada región (ejemplo: Alpha en Occipital)
float getRegionInfluence(vec3 pos, vec3 center, float radius, float intensity) {
  float dist = distance(pos, center);
  float influence = smoothstep(radius, radius * 0.3, dist);
  return influence * intensity;
}

// El color final es la mezcla de todas las regiones activas
finalColor = mix(baseColor, alphaColor, alphaInfluence);
finalColor = mix(finalColor, betaColor, betaInfluence);
// ... etc
```

### Posiciones Anatómicas (Coordenadas 3D)

```javascript
const BRAIN_REGIONS = {
  prefrontal: { 
    center: [0, 0.5, 0.6],    // Adelante arriba
    radius: 0.5,
    color: '#ef4444'          // Gamma
  },
  frontal: { 
    center: [0, 0.3, 0.5],    // Adelante centro
    radius: 0.8,
    color: '#f59e0b'          // Beta
  },
  occipital: { 
    center: [0, 0.2, -0.6],   // Atrás
    radius: 0.7,
    color: '#10b981'          // Alpha
  },
  temporal: { 
    center: [0, -0.2, 0],     // Lados/abajo
    radius: 0.6,
    color: '#3b82f6'          // Theta
  },
  central: { 
    center: [0, 0, 0],        // Centro absoluto
    radius: 0.4,
    color: '#8b5cf6'          // Delta
  }
}
```

## 🎮 Controles de Usuario

### Panel Leva (Configuración)

```
┌─ Lighting ──────────────────────────────┐
│ Ambient Intensity: ███████░░░ 0.5       │
│ Environment: [Studio ▼]                 │
│ ✅ Regional Frequencies                  │
│ ✅ Show Region Labels                    │
└─────────────────────────────────────────┘
```

- **Regional Frequencies**: Activa/desactiva la vista regional (vs. vista tradicional)
- **Show Region Labels**: Muestra etiquetas 3D flotantes con nombre de región + intensidad

### Etiquetas Dinámicas

Cada etiqueta muestra:
```
┌────────────────┐
│ Prefrontal     │  ← Nombre de región
│ Gamma 45%      │  ← Frecuencia + intensidad actual
└────────────────┘
```

Las etiquetas:
- **Opacidad dinámica**: Más intensidad = más visible
- **Brillo**: Si intensidad > 30%, aparece glow del color de la banda
- **Color de fondo**: Color de la banda con transparencia basada en intensidad

## 📊 Integración con Backend

### Flujo de Datos

```
Backend (spectral.py)
  │
  │ WebSocket
  │
  ├─→ bands: { delta: 0.15, theta: 0.25, alpha: 0.45, beta: 0.10, gamma: 0.05 }
  │
  ├─→ useBrainStore (Zustand)
  │
  ├─→ RegionalBrainActivity Component
  │      │
  │      ├─→ Shader Uniforms Update (cada frame)
  │      │   • uFrontalIntensity = bands.beta * 2.0
  │      │   • uOccipitalIntensity = bands.alpha * 2.0
  │      │   • uTemporalIntensity = bands.theta * 2.5
  │      │   • uPrefrontalIntensity = bands.gamma * 3.0
  │      │   • uCentralIntensity = bands.delta * 2.0
  │      │
  │      └─→ 3D Render (Three.js)
  │
  └─→ BrainRegionLabels Component
       │
       └─→ HTML Overlays (etiquetas flotantes)
```

### Amplificación de Señal

Las bandas se multiplican para mejor visibilidad:

```javascript
// Beta (frontal) - amplificación 2x
uniforms.uFrontalIntensity.value = bands.beta * 2.0

// Gamma (prefrontal) - amplificación 3x (es más sutil)
uniforms.uPrefrontalIntensity.value = bands.gamma * 3.0

// Theta (temporal) - amplificación 2.5x
uniforms.uTemporalIntensity.value = bands.theta * 2.5
```

## 🔬 Base Científica

### Topografía Cerebral Real

Este sistema respeta la **topografía EEG estándar** (sistema 10-20):

1. **Delta (Central)**: Generado principalmente en estructuras profundas (tálamo) y se propaga a toda la corteza
2. **Theta (Temporal)**: Originado en hipocampo y estructuras límbicas, visible en regiones temporales
3. **Alpha (Occipital)**: Prominente en corteza visual primaria (V1), región occipital
4. **Beta (Frontal)**: Asociado con actividad motora y cognitiva, corteza frontal
5. **Gamma (Prefrontal)**: Procesamiento cognitivo superior, corteza prefrontal

### Coherencia Sintérgica

Según Jacobo Grinberg:

```
Coherencia > 0.8  +  Alpha > 0.6  =  Estado Sintérgico
         │                │              │
         │                │              └─→ Acceso a la lattice
         │                └─→ Región occipital iluminada (verde)
         └─→ Brillo general del cerebro
```

En este sistema:
- **Alta coherencia** → Brillo uniforme en todo el cerebro
- **Alpha dominante** → Región occipital intensamente verde
- **Combinación** → Cerebro brillante con occipital verde = estado sintérgico visual

## 🎯 Estados Mentales Típicos

### Meditación Profunda
```
Theta (Temporal): ████████░░ 35%  🔵
Alpha (Occipital): ███████░░░ 30%  🟢
Beta (Frontal): ██░░░░░░░░ 15%    🟠
```
→ Temporal azul + Occipital verde iluminados

### Concentración Activa
```
Beta (Frontal): █████████░ 45%    🟠
Gamma (Prefrontal): ████░░░░░░ 25% 🔴
Alpha (Occipital): ███░░░░░░░ 20%  🟢
```
→ Frontal naranja + Prefrontal rojo brillantes

### Estado Sintérgico (Grinberg)
```
Alpha (Occipital): █████████░ 65%  🟢
Theta (Temporal): ███████░░░ 35%   🔵
Coherence: 85%
```
→ Todo el cerebro brillante, occipital verde intenso, temporal azul

### Insight/Eureka
```
Gamma (Prefrontal): ████████░░ 40% 🔴
Alpha (Occipital): ██████░░░░ 35%  🟢
Beta (Frontal): █████░░░░░ 25%    🟠
```
→ Prefrontal rojo explosivo (momento "aha!")

## 🚀 Uso en Práctica

### Modo Práctica con Meditación Guiada

Cuando el usuario activa el modo práctica:

1. Selecciona objetivo de coherencia (ej: 70%)
2. Selecciona meditación guiada (Vipassana de Jacobo)
3. Audio comienza a reproducirse
4. El cerebro 3D muestra:
   - **Inicio**: Beta/Gamma (frontal/prefrontal naranja/rojo) - mente activa
   - **Progreso**: Theta aumenta (temporal azul) - entrando en meditación
   - **Estado profundo**: Alpha dominante (occipital verde) + alta coherencia (brillo general)
   - **Logro**: Cerebro uniformemente brillante con occipital verde intenso

### Feedback Visual Directo

El usuario **ve exactamente dónde está activo su cerebro**:
- Pensamiento activo → Frente naranja
- Momento de insight → Explosión roja prefrontal
- Relajación profunda → Parte posterior verde
- Meditación → Lados azules + posterior verde

## 📝 Archivos Modificados/Creados

```
frontend/src/components/canvas/
├── RegionalBrainActivity.jsx          ← NUEVO: Cerebro con shader regional
├── BrainRegionLabels.jsx              ← NUEVO: Etiquetas 3D flotantes
└── Experience.jsx                     ← Modificado: Toggle regional/tradicional

frontend/src/components/hud/
└── FrequencySpectrum.jsx              ← Modificado: Tooltip con regiones

docs/
└── REGIONAL_BRAIN_VISUALIZATION.md    ← NUEVO: Esta documentación
```

## 🎓 Referencias Científicas

1. **Buzsáki, G. (2006)**: Rhythms of the Brain - Topografía de frecuencias
2. **Nunez, P. L. (1995)**: Neocortical Dynamics - EEG y geometría cerebral
3. **Grinberg-Zylberbaum, J. (1991)**: La Teoría Sintérgica - Coherencia y lattice
4. **Varela, F. (1999)**: The Brainweb - Fase y sincronización
5. **Singer, W. (1999)**: Binding Problem - Gamma y integración cognitiva

---

**Sistema desarrollado para el Proyecto Teoría Sintérgica**  
Visualización en tiempo real de estados cerebrales según mapeo anatómico científico.
