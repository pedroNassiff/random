# RANDOM() - Documentación Técnica del Sistema Lattice

## 📚 Índice

1. [Visión Conceptual](#-visión-conceptual)
2. [Arquitectura Técnica](#-arquitectura-técnica)
3. [Three.js - Conceptos Fundamentales](#-threejs---conceptos-fundamentales)
4. [InstancedMesh - Renderizado Eficiente](#-instancedmesh---renderizado-eficiente)
5. [Shaders GLSL - El Lenguaje de la GPU](#-shaders-glsl---el-lenguaje-de-la-gpu)
6. [Problemas Encontrados y Soluciones](#-problemas-encontrados-y-soluciones)
7. [Sistema de Interacción (Próximos Pasos)](#-sistema-de-interacción-próximos-pasos)
8. [Lecciones Aprendidas](#-lecciones-aprendidas)

---

## 🌐 Visión Conceptual

### La Metáfora: Lattice de Jacobo Grinberg

El sistema visual está inspirado en la **Teoría Sintérgica** de Jacobo Grinberg, que propone que existe una estructura fundamental llamada **Lattice** (retícula) que subyace a toda la realidad y contiene toda la información del universo.

#### Traducción de Conceptos a UX

| Concepto Sintérgico | Traducción Visual/UX |
|---------------------|---------------------|
| **Lattice** | Red de nodos y conexiones doradas |
| **Distorsión** | Nodo de contenido (proyecto, servicio) |
| **Sintergía** | Brillo/intensidad de cada nodo |
| **Direccionalidad** | Foco del usuario (hover/click) |
| **Campo Neuronal** | El modelo holográfico (observador) |
| **Coherencia** | Estado de conexión - cuando haces click, todo se atenúa |
| **Orbitales** | Niveles de profundidad (scroll) |

### Referencia Visual: Interstellar

La escena del teseracto en Interstellar donde Cooper navega a través de una biblioteca dimensional infinita. Cada "slot" contiene información de diferentes momentos - nosotros representamos esto con nodos que contienen proyectos/información.

---

## 🏗️ Arquitectura Técnica

### Estructura de Archivos

```
src/
├── script.js              # Orquestador principal
├── Lattice.js             # Sistema de red neuronal/dimensional
├── ContentPortal.js       # Portal donde se materializa el contenido
├── shaders/
│   ├── holographic/       # Shaders del modelo 3D (chakras)
│   ├── tesseract/         # Shaders legacy (reemplazados)
│   └── ...
└── style.css              # Estilos UI
```

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│                      script.js                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Scene     │  │   Camera    │  │  Renderer   │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│         ▼                ▼                ▼             │
│  ┌─────────────────────────────────────────────┐       │
│  │              tick() Animation Loop           │       │
│  │  - Update time uniforms                      │       │
│  │  - Update lattice (position, rotation)       │       │
│  │  - Update model animation                    │       │
│  │  - Render                                    │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Lattice.js                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  InstancedMesh  │  │  LineSegments   │              │
│  │  (756 nodos)    │  │  (5270 líneas)  │              │
│  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                        │
│           ▼                    ▼                        │
│  ┌─────────────────────────────────────────────┐       │
│  │           ShaderMaterial (GLSL)              │       │
│  │  - uTime: animación                          │       │
│  │  - uGlobalIntensity: brillo (hover)          │       │
│  │  - uColor: color base                        │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

---

## 🎮 Three.js - Conceptos Fundamentales

### 1. La Escena (Scene)

La escena es el contenedor de todos los objetos 3D. Piensa en ella como un "mundo virtual".

```javascript
const scene = new THREE.Scene()
```

### 2. La Cámara (Camera)

Define desde dónde "miras" la escena. Usamos PerspectiveCamera para simular visión humana.

```javascript
const camera = new THREE.PerspectiveCamera(
    45,                           // FOV (field of view) - ángulo de visión
    sizes.width / sizes.height,   // Aspect ratio
    0.1,                          // Near plane - más cerca no se ve
    100                           // Far plane - más lejos no se ve
)
camera.position.set(0, 0, 5)     // Posición: x=0, y=0, z=5 (adelante)
```

**Importante**: Si un objeto está más lejos que `far` (100 en nuestro caso), NO se renderiza.

### 3. El Renderer

Convierte la escena 3D en píxeles 2D en el canvas.

```javascript
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true  // Suaviza bordes
})
renderer.setClearColor('#0a0a0a')  // Color de fondo
```

### 4. El Animation Loop (tick)

Three.js NO anima automáticamente. Necesitas un loop que:
1. Actualiza posiciones/rotaciones
2. Llama a `renderer.render(scene, camera)`
3. Se repite con `requestAnimationFrame`

```javascript
const tick = () => {
    // 1. Calcular tiempo
    const deltaTime = clock.getDelta()
    
    // 2. Actualizar objetos
    lattice.update(deltaTime, scrollProgress)
    
    // 3. Renderizar
    renderer.render(scene, camera)
    
    // 4. Siguiente frame
    requestAnimationFrame(tick)
}
```

### 5. Geometrías y Materiales

En Three.js, un objeto visible necesita:
- **Geometry**: La forma (vértices, caras)
- **Material**: La apariencia (color, textura, shader)
- **Mesh**: La combinación de ambos

```javascript
const geometry = new THREE.SphereGeometry(1, 12, 12)  // Radio, segmentos
const material = new THREE.MeshBasicMaterial({ color: 'red' })
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
```

---

## ⚡ InstancedMesh - Renderizado Eficiente

### El Problema

Renderizar 756 esferas individuales = 756 draw calls = LENTO.

### La Solución: InstancedMesh

Renderiza MUCHAS copias de la misma geometría en UN SOLO draw call.

```javascript
// Crear geometría UNA vez
const geometry = new THREE.SphereGeometry(1, 12, 12)
const material = new THREE.ShaderMaterial({ ... })

// Crear mesh instanciado para 756 copias
const instancedMesh = new THREE.InstancedMesh(geometry, material, 756)
```

### Posicionando las Instancias

Cada instancia tiene su propia matriz de transformación (posición, rotación, escala):

```javascript
const dummy = new THREE.Object3D()

for (let i = 0; i < 756; i++) {
    // Configurar posición/escala del dummy
    dummy.position.set(x, y, z)
    dummy.scale.setScalar(0.15)
    
    // Actualizar su matriz
    dummy.updateMatrix()
    
    // Aplicar a la instancia i
    instancedMesh.setMatrixAt(i, dummy.matrix)
}

// IMPORTANTE: Notificar que las matrices cambiaron
instancedMesh.instanceMatrix.needsUpdate = true
```

### En el Shader: instanceMatrix

Three.js automáticamente proporciona `instanceMatrix` en el vertex shader:

```glsl
void main() {
    // instanceMatrix transforma este vértice según la instancia
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

---

## 🎨 Shaders GLSL - El Lenguaje de la GPU

### ¿Qué son los Shaders?

Programas que corren en la GPU para cada vértice (vertex shader) y cada píxel (fragment shader).

### Estructura Básica

```javascript
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },        // Valores que pasamos desde JS
        uColor: { value: new THREE.Color('#d4a574') }
    },
    vertexShader: `...`,            // Código GLSL para vértices
    fragmentShader: `...`           // Código GLSL para píxeles
})
```

### Vertex Shader (vertex.glsl)

Se ejecuta para CADA vértice. Calcula la posición final en pantalla.

```glsl
// Variables que recibimos de Three.js
// position, normal, uv - atributos por vértice
// modelMatrix, viewMatrix, projectionMatrix - matrices de transformación

// Uniforms - valores globales desde JS
uniform float uTime;

// Varyings - valores que pasamos al fragment shader
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Calcular posición en el mundo
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    
    // Pasar normal al fragment
    vNormal = normalize(normalMatrix * normal);
    
    // Posición final en pantalla
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
```

### Fragment Shader (fragment.glsl)

Se ejecuta para CADA píxel. Calcula el color final.

```glsl
uniform float uTime;
uniform vec3 uColor;
uniform float uGlobalIntensity;

varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    // Efecto Fresnel - más brillante en los bordes
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.0);
    
    // Pulso de respiración
    float pulse = sin(uTime * 1.0 + vWorldPosition.x * 0.3) * 0.1 + 0.9;
    
    // Color final
    vec3 color = uColor * (0.6 + fresnel * 0.4);
    
    // Alpha controlado por intensidad global
    float alpha = uGlobalIntensity * (0.3 + fresnel * 0.7) * pulse;
    
    gl_FragColor = vec4(color, alpha);
}
```

### Tipos de Variables GLSL

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `float` | Número decimal | `float intensity = 0.5;` |
| `vec2` | Vector 2D | `vec2 uv = vec2(0.0, 1.0);` |
| `vec3` | Vector 3D / Color RGB | `vec3 color = vec3(1.0, 0.5, 0.0);` |
| `vec4` | Vector 4D / Color RGBA | `vec4 finalColor = vec4(color, alpha);` |
| `mat4` | Matriz 4x4 | `mat4 modelMatrix;` |

### Funciones GLSL Útiles

```glsl
// Matemáticas
sin(x), cos(x)        // Trigonometría
pow(x, y)             // Potencia
mix(a, b, t)          // Interpolación lineal
smoothstep(a, b, x)   // Interpolación suave
clamp(x, min, max)    // Limitar valor

// Vectores
length(v)             // Magnitud
normalize(v)          // Normalizar (longitud 1)
dot(a, b)             // Producto punto
cross(a, b)           // Producto cruz
```

---

## 🐛 Problemas Encontrados y Soluciones

### Problema 1: La Lattice no se veía

**Síntomas**: Los logs mostraban que todo se creaba correctamente, pero nada aparecía.

**Causas encontradas**:

1. **Posición muy lejana**: Lattice en z=-20, cámara en z=5 → 25 unidades de distancia
2. **Nodos muy pequeños**: `nodeBaseSize: 0.05` era casi invisible
3. **Frustum Culling**: Three.js ocultaba objetos fuera del campo de visión calculado

**Soluciones**:

```javascript
// 1. Acercar la lattice
this.group.position.z = -5  // En lugar de -20

// 2. Aumentar tamaño de nodos
nodeBaseSize: 0.15  // En lugar de 0.05

// 3. Desactivar frustum culling
this.nodesMesh.frustumCulled = false
this.connectionsMesh.frustumCulled = false
```

### Problema 2: Shaders no funcionaban con InstancedMesh

**Síntoma**: Warning en consola sobre vertex shader output no leído.

**Causa**: El shader no usaba `instanceMatrix` correctamente.

**Solución**: Usar `instanceMatrix` en el cálculo de posición mundial:

```glsl
// INCORRECTO
vec4 worldPos = modelMatrix * vec4(position, 1.0);

// CORRECTO
vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
```

### Problema 3: Lattice demasiado brillante

**Síntoma**: Los nodos opacaban todo el resto de la UI.

**Solución**: Agregar `uGlobalIntensity` uniform para controlar brillo:

```javascript
uniforms: {
    uGlobalIntensity: { value: 0.15 }  // Bajo por defecto
}
```

```glsl
float alpha = uGlobalIntensity * (0.3 + fresnel * 0.7) * pulse;
```

---

## 🎯 Sistema de Interacción (Próximos Pasos)

### 1. Scroll - Viaje Dimensional

El scroll mueve al usuario a través de diferentes "orbitales" de la lattice.

**Implementación actual:**
```javascript
// En tick()
const scrollProgress = scrollY * 0.001

// En Lattice.update()
this.group.position.z = -5 + scrollProgress * -15
this.group.rotation.y = Math.sin(this.time * 0.1) * 0.1 + scrollProgress * 0.3
```

**Mejoras propuestas:**
```javascript
// Revelar diferentes capas de contenido según profundidad
update(deltaTime, scrollProgress) {
    // Calcular "orbital" actual (0-4)
    const orbital = Math.floor(scrollProgress * 5)
    
    // Activar nodos de contenido en este orbital
    this.contentNodes.forEach(node => {
        const nodeOrbital = Math.floor(-node.position.z / 5)
        if (nodeOrbital === orbital) {
            this.activateNodeVisually(node)
        }
    })
}
```

### 2. Hover - Resonancia

Cuando el cursor se acerca a un nodo, éste "resuena" (brilla más).

**Implementación necesaria en script.js:**

```javascript
// Raycaster para detectar hover
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

window.addEventListener('mousemove', (event) => {
    // Normalizar coordenadas del mouse (-1 a 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // Actualizar raycaster
    raycaster.setFromCamera(mouse, camera)
    
    // Buscar nodo bajo el cursor
    const hoveredNode = lattice.getNodeAtPosition(raycaster)
    
    if (hoveredNode && hoveredNode.isContent) {
        // Aumentar intensidad de toda la lattice
        lattice.setGlobalIntensity(0.6)
        
        // Marcar nodo como "resonando"
        lattice.setNodeResonance(hoveredNode, 1.0)
        
        // Cambiar cursor
        document.body.style.cursor = 'pointer'
    } else {
        // Volver a estado normal
        lattice.resetIntensity()
        document.body.style.cursor = 'default'
    }
})
```

**En Lattice.js - Métodos ya implementados:**

```javascript
setGlobalIntensity(intensity) {
    this.targetIntensity = intensity  // Transición suave automática
}

resetIntensity() {
    this.targetIntensity = this.baseIntensity
}

pulse(intensity = 0.5, duration = 500) {
    this.targetIntensity = intensity
    setTimeout(() => {
        this.targetIntensity = this.baseIntensity
    }, duration)
}
```

### 3. Click - Direccionalidad Máxima

Al hacer click, la información se "materializa" en el centro (ContentPortal).

**Implementación necesaria:**

```javascript
window.addEventListener('click', (event) => {
    if (hoveredNode && hoveredNode.isContent) {
        // 1. Activar el nodo
        const data = lattice.activateNode(hoveredNode)
        
        // 2. Atenuar el resto de la lattice
        lattice.setGlobalIntensity(0.05)  // Muy sutil
        
        // 3. Mostrar contenido en el portal
        contentPortal.activate(data, () => {
            // Callback cuando la animación termina
            showContentUI(data)
        })
    }
})

// Para cerrar el portal
function closeContentPortal() {
    contentPortal.deactivate(() => {
        lattice.resetIntensity()
    })
}
```

### 4. Integración con Botones de Navegación

Conectar los botones PROYECTOS, SERVICIOS, SOBRE MÍ con nodos de la lattice:

```javascript
// Definir nodos de contenido
const contentItems = [
    {
        id: 'proyectos',
        position: new THREE.Vector3(-3, 1, -5),
        data: { title: 'Proyectos', type: 'section' }
    },
    {
        id: 'servicios', 
        position: new THREE.Vector3(0, 2, -8),
        data: { title: 'Servicios', type: 'section' }
    },
    {
        id: 'sobre-mi',
        position: new THREE.Vector3(3, 0, -12),
        data: { title: 'Sobre Mí', type: 'section' }
    }
]

// Agregar a la lattice
contentItems.forEach(item => {
    lattice.addContentNode(item.position, item.data)
})

// Conectar botón a nodo
document.querySelector('.btn-proyectos').addEventListener('click', () => {
    const node = lattice.contentNodes.find(n => n.data.id === 'proyectos')
    if (node) {
        lattice.activateNode(node)
        // Animar cámara hacia el nodo
        animateCameraToNode(node)
    }
})
```

---

## 📖 Lecciones Aprendidas

### 1. Debugging en Three.js

- **Usar `console.log` generosamente** para verificar que objetos se crean
- **Verificar posiciones**: ¿Está el objeto dentro del frustum de la cámara?
- **Verificar escalas**: ¿Es el objeto lo suficientemente grande para ver?
- **BoxHelper**: Útil para visualizar los límites de un objeto
- **frustumCulled = false**: Deshabilita el culling automático para debugging

### 2. InstancedMesh

- **Usar para muchos objetos iguales**: Dramáticamente más eficiente
- **setMatrixAt + needsUpdate**: Siempre notificar cambios
- **instanceMatrix en shader**: Necesario para transformaciones correctas

### 3. Shaders

- **Start simple**: Primero un color sólido, luego agregar efectos
- **Uniforms para control desde JS**: Pasar tiempo, colores, intensidades
- **Varyings para pasar datos entre vertex y fragment**
- **Fresnel**: Efecto simple pero muy efectivo para bordes brillantes

### 4. Performance

- **AdditiveBlending**: Crea efectos de brillo sin costar mucho
- **depthWrite: false**: Necesario para transparencias correctas
- **Menos polígonos en geometría**: SphereGeometry(1, 12, 12) es suficiente

### 5. UX

- **Intensidad base baja**: Permite ver otros elementos de la UI
- **Transiciones suaves**: Usar interpolación (`currentValue += (target - current) * 0.1`)
- **Feedback visual claro**: El usuario debe saber qué es interactivo

---

## 🚀 Siguientes Pasos Recomendados

1. **Implementar Hover Detection** - Agregar raycaster y eventos de mouse
2. **Crear Nodos de Contenido** - Agregar proyectos reales como nodos especiales
3. **Implementar ContentPortal** - El "cuadro" central donde aparece la información
4. **Conectar Navegación** - Los botones activan nodos específicos
5. **Efecto Random** - Función que causa "glitch" en toda la lattice
6. **Sincronizar Chakras** - El pulso de chakras afecta la lattice

---

## 📚 Recursos para Seguir Aprendiendo

- [Three.js Fundamentals](https://threejs.org/manual/#en/fundamentals)
- [The Book of Shaders](https://thebookofshaders.com/)
- [Three.js Journey](https://threejs-journey.com/) - Curso completo
- [Shadertoy](https://www.shadertoy.com/) - Ejemplos de shaders increíbles

---

*"La Lattice contiene toda la información. Tú solo necesitas sintonizar."* 
— Inspirado en Jacobo Grinberg
