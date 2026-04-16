# .RANDOM() — Brand Identity & Design System

> **Posicionamiento:** Experiencia dimensional interactiva que materializa la teoría sintérgica de Jacobo Grinberg en forma de interfaz navegable.

---

## 🌀 Manifiesto

En el caos de los datos, el ruido de la matrix, el flujo constante de información — ahí está nuestro laboratorio. Donde otros ven desorden, nosotros encontramos patrones. Donde el hábito limita, la exploración descubre. Random es esa perturbación necesaria que rompe lo predecible para alcanzar lo extraordinario.

La mejor solución no sale del manual — sale de romper la regla, probar, ajustar. La matrix cae con su código infinito, pero ahí, entre el ruido, está la temperatura exacta, el tiempo preciso, el corte perfecto. Random es esa exploración: perturbamos el agua para ver las ondas, observamos energía formando galaxia, captamos vibraciones holográficas. No porque busquemos el caos — lo buscamos porque ahí está el aprendizaje. Rompemos el hábito para encontrar el camino. Nos perdemos en lo desconocido para descubrir lo que no sabíamos que existía. Para eso estamos: **convertir lo aleatorio en intención, el ruido en claridad, la perturbación en creación.**

---

## 🎨 Sistema Cromático

### Colores Primarios (Base de la Landing)

| Color | Hex | RGB | Uso Principal | Significado |
|-------|-----|-----|---------------|-------------|
| **Blanco Cálido** | `#FDFCFB` | `253, 252, 251` | Fondo principal de la landing | Claridad, espacio para que los datos respiren |
| **Gris Claro** | `#F8F8F7` | `248, 248, 247` | Secciones alternadas (proyectos, work) | Sutileza, transición suave |
| **Negro Puro** | `#1A1A1A` | `26, 26, 26` | Tipografía principal, títulos | Contraste absoluto, información directa |
| **Blanco Puro** | `#ffffff` | `255, 255, 255` | Cards de servicios | Limpieza, foco |

### Colores de Texto

| Color | Hex | RGB | Uso | Peso Visual |
|-------|-----|-----|-----|-------------|
| **Negro Principal** | `#1A1A1A` | `26, 26, 26` | Headings, títulos, copy principal | Máxima jerarquía |
| **Gris Medio** | `#666666` | `102, 102, 102` | Body text, descripciones | Lectura sostenida |
| **Gris Claro** | `#CCCCCC` | `204, 204, 204` | Números desactivados, elementos secundarios | Información terciaria |

### Colores de Servicios (Iconos/Bordes Hover)

| Color | Hex | Servicio | Significado |
|-------|-----|----------|-------------|
| **Rojo Coral** | `#E85A4F` | Web Development | Energía, creación |
| **Negro Profundo** | `#1A1A1A` | Cloud Architecture | Infraestructura, solidez |
| **Azul Tecnológico** | `#4A90E2` | AI & ML | Inteligencia, innovación |
| **Verde Lima** | `#8BC34A` | 3D & WebGL | Crecimiento, dimensión |

### Colores de Bordes y Estructuras

| Color | Hex | Uso | Estado |
|-------|-----|-----|--------|
| **Gris Borde** | `#E8E8E8` | Bordes de cards por defecto | Idle |
| **[Color Servicio]** | Variable | Borde de card en hover | Active |

### Colores del Lab/Experimentos (Contraste Negro)

| Color | Hex | RGB | Uso | Contexto |
|-------|-----|-----|-----|----------|
| **Negro Canvas** | `#0a0a0a` | `10, 10, 10` | Fondo de container 3D, Lab section | Pre-espacio, donde viven los experimentos |
| **Blanco en Negro** | `#ffffff` | `255, 255, 255` | Texto sobre fondos oscuros, spinners | Contraste invertido |

---

## 🔤 Tipografía

### Font Stack

```css
/* Logo & Título Principal */
font-family: 'Courier Prime', 'Courier New', monospace;

/* UI General, Body Text */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Efectos Especiales (Cards, Transmissions) */
font-family: 'Arial', sans-serif;
```

### Jerarquía Tipográfica

| Elemento | Font | Size | Weight | Uso |
|----------|------|------|--------|-----|
| **Hero Title** `.RANDOM()` | Courier Prime | `5vw` → `1.4vw` | 700 | Logo animado, identidad central |
| **Navegación Principal** | Inter | `15-16px` | 400-500 | Navbar, menús |
| **Headings H1** | Inter | `2.5-3rem` | 700 | Títulos de páginas |
| **Headings H2** | Inter | `1.5-2rem` | 600 | Secciones principales |
| **Body Text** | Inter | `0.95-1rem` | 400 | Contenido general |
| **Caption/Small** | Inter | `0.85rem` | 400 | Metadatos, footer |

### Letter Spacing

- **Logo**: `0.1em` (amplio, respirado)
- **Navegación**: Normal (`0`)
- **Uppercase Labels**: `3px` (muy amplio, arquitectónico)

---

## 🗣️ Tono & Voz de Marca

### Principios Comunicacionales

**No somos:**
- Un portfolio tradicional
- Una agencia corporativa
- Promesas de disrupciones vacías
- Explicadores de lo obvio

**Somos:**
- Perturbadores del agua para ver las ondas
- Observadores de patrones en el ruido
- Exploradores del caos como laboratorio
- Buscadores de lo extraordinario en lo aleatorio

### Características del Tono

| Dimensión | Descripción | Ejemplo |
|-----------|-------------|---------|
| **Científico** | Terminología técnica precisa, referencias conceptuales | "Lattice", "sintergría", "pre-espacio", "matrix" |
| **Experimental** | Métodos de prueba y error, exploración activa | "Perturbamos el agua para ver las ondas" |
| **Poético** | Metáforas visuales, lenguaje evocativo | "El ruido se convierte en claridad" |
| **Minimalista** | Economía verbal, frases cortas | `.RANDOM(ser)` vs "Random Studio Creative Agency" |
| **Invitacional** | No explicativo, invita a explorar | "Romper el hábito para encontrar el camino" |
| **Honesto** | Sin pretensiones, confiado pero humilde | "Nos perdemos en lo desconocido para descubrir" |

### Ejemplos de Copy

✅ **Correcto:**
> "Donde otros ven desorden, nosotros encontramos patrones."
> "La perturbación necesaria que rompe lo predecible."
> "Entre el ruido, está el tiempo preciso, el corte perfecto."
> "Convertir lo aleatorio en intención, el ruido en claridad."
> "Rompemos el hábito para encontrar el camino."

❌ **Incorrecto:**
> "¡Somos la mejor agencia digital de Argentina!"
> "Transformamos tu negocio con soluciones innovadoras."
> "Descubre por qué miles de clientes confían en nosotros."
> "Hacemos realidad tus sueños digitales."

---

## ⚡ Transiciones & Animaciones

### Filosofía de Movimiento

**Principio:** Todo movimiento es **intencional, exploratorio, y refleja la perturbación del orden**. La animación no decora — transforma. Como las ondas en el agua revelan patrones, nuestras transiciones revelan estructura.

### Timing Functions

```css
/* Transición por defecto (universal) */
transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Hover rápido (botones, links) */
transition: all 0.2-0.3s ease;

/* Apariciones (fade-in, scale) */
transition: opacity 0.3s ease-in-out;

/* Transformaciones espaciales (3D) */
transition: transform 0.8s cubic-bezier(0.19, 1, 0.22, 1);
```

### Catálogo de Animaciones

#### 1. **Materialize Glow** (Apariciones)
```css
@keyframes materialize-glow {
    0% {
        filter: brightness(1.5) drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
    }
    100% {
        filter: brightness(1) drop-shadow(0 0 0 transparent);
    }
}
```
**Uso:** Cuando elementos se "transmiten" desde el canvas 3D al DOM.

#### 2. **Title Minimization** (Logo)
```css
/* Estado inicial */
.title {
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-size: 5vw;
}

/* Estado minimizado */
.title.minimized {
    top: 35px; left: 35px;
    transform: translate(0, 0);
    font-size: 1.4vw;
}
```
**Duration:** 1.2s  
**Timing:** cubic-bezier(0.4, 0, 0.2, 1)

#### 3. **Hover Resonance** (Interacciones)
```css
/* Nodos lattice */
.node:hover {
    scale: 1.2;
    opacity: 1;
}

/* Cards */
.card:hover {
    transform: translate(-50%, -50%) scale(1.05);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 
                0 0 30px rgba(0, 200, 255, 0.3);
}
```
**Duration:** 0.3s ease

#### 4. **Glitch Effect** (Ruptura)
```css
/* Activado aleatoriamente o por ChaosGlitchBadge */
.glitching {
    animation: glitch-anim 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
    filter: hue-rotate(90deg) saturate(2);
}
```
**Características:**
- Nunca dura más de 0.5s
- Offset horizontal: ±10px máx
- Siempre vuelve a estado normal
- Puede ser triggerado por usuario (badge) o aleatorio

#### 5. **Scroll-Based Motion** (Camera)
```css
/* En Three.js */
camera.position.y = (scrollY / window.innerHeight) * -objectsDistance
```
**Factor:** -4 (descenso progresivo)  
**Efecto:** Viaje dimensional hacia la profundidad de la lattice

---

## 🧩 Componentes Clave

### 1. Navbar

**Comportamiento:**
- Fixed top, z-index 50
- Transparente con blur backdrop
- Logo `.RANDOM()` centrado (desktop) o izquierda (mobile)
- Navegación derecha: PROYECTOS, SERVICIOS, LAB, ABOUT
- Botón lang switch con banderas emoji
- Burger menu en mobile

**Estados:**
```css
/* Default */
background: transparent;
backdrop-filter: blur(10px);

/* Scroll */
background: rgba(26, 26, 26, 0.95);
```

### 2. ServiceCard

**Anatomía:**
```
┌─────────────────────────┐
│  1.              ● [color]  │
│                           │
│  Título (32px bold)        │
│  Descripción (16px)        │
│  text-[#666666]            │
└─────────────────────────┘
```

**Interacción:**
- Hover: border cambia de `#E8E8E8` a color del servicio + box-shadow
- Background: `white` (siempre)
- Padding: `p-10` (40px)
- Border radius: `rounded-2xl`
- Número: `text-[#CCCCCC]` (desactivado visualmente)

### 3. Lab Container (Contraste Negro)

**Concepto:** Única sección con fondo oscuro para mostrar experimentos 3D

**Estilo:**
```css
background: #0a0a0a
border-radius: 24px (rounded-3xl)
padding: 40px (p-10)
```

**Grid de experimentos:**
- 4 columnas en desktop
- 2 columnas en tablet
- 1 columna en mobile
- Cada experimento: altura 400px, cursor pointer

### 4. Navbar

**Comportamiento:**
- Fixed top, z-index 50
- Fondo blanco con transparencia + blur
- Logo `.RANDOM()` en Courier Prime
- Navegación: PROYECTOS, SERVICIOS, LAB, ABOUT
- Transición suave en scroll

**Estados:**
```css
/* Default (top) */
background: rgba(253, 252, 251, 0.8);
backdrop-filter: blur(10px);

/* Scroll */
background: rgba(253, 252, 251, 0.95);
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
```

---

## 🌀 Efectos Especiales

### 1. Text Shadow (Sutil)

```css
/* Solo en elementos especiales, no en toda la UI */
text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
```

**Propósito:** Profundidad sutil en grandes títulos sin crear ruido visual.

### 2. Box Shadow (Cards & Elevation)

```css
/* Cards nivel 1 (default) */
box-shadow: 0 0 0 1px #E8E8E8;
border: 1px solid #E8E8E8;

/* Cards hover */
box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
border: 1px solid [color-servicio]; /* #E85A4F, #4A90E2, etc */
```

### 3. Backdrop Filters (Lab Section)

```css
/* Solo en canvas 3D negro del lab */
.lab-container {
  background: #0a0a0a;
  backdrop-filter: none; /* No necesario en fondo sólido */
}
```

### 4. Gradient Overlays (Sutiles)

```css
/* NO se usan gradientes intensos */
/* La landing es mayormente flat con colores sólidos */

/* Único uso: transiciones suaves entre secciones */
background: linear-gradient(
    180deg, 
    #FDFCFB 0%,
    #F8F8F7 100%
);
```

---

## 📐 Sistema de Espaciado

### Grid Base: 8px

| Nombre | Valor | Uso |
|--------|-------|-----|
| `xs` | 4px | Gaps internos mínimos |
| `sm` | 8px | Padding base |
| `md` | 16px | Separación estándar |
| `lg` | 24px | Márgenes verticales |
| `xl` | 32px | Secciones |
| `2xl` | 48px | Hero spacing |
| `3xl` | 64px | Page padding |

---

## 🎭 Responsive Behavior

### Breakpoints

```css
/* Mobile */
@media (max-width: 480px)

/* Tablet */
@media (max-width: 768px)

/* Desktop */
@media (min-width: 769px)

/* Large Desktop */
@media (min-width: 1440px)
```

### Adaptaciones Clave

**Logo:**
- Desktop: 5vw → 1.4vw (animado)
- Mobile: 1.2rem fijo, letter-spacing: 0.2em

**Navbar:**
- Desktop: Links horizontales
- Mobile: Burger → fullscreen overlay

**Cards:**
- Desktop: 320px width
- Tablet: 250px width
- Mobile: 200px width, padding reducido

---

## 🚀 Principios de Diseño

### 1. **Caos Como Laboratorio**
> El ruido, los datos, el flujo constante — ahí está nuestro espacio de trabajo. El desorden es donde se descubren los patrones.

### 2. **Perturbación Intencional**
> Romper lo predecible no es vandalismo — es método. La exploración requiere salirse del manual.

### 3. **Observación Activa**
> Perturbamos el agua para ver las ondas. Observamos energía formando galaxia. Captamos vibraciones holográficas.

### 4. **Aprendizaje por Ruptura**
> Rompemos el hábito para encontrar el camino. Nos perdemos en lo desconocido para descubrir lo que no sabíamos que existía.

### 5. **Transformación del Ruido**
> Convertir lo aleatorio en intención, el ruido en claridad, la perturbación en creación. Este es nuestro propósito.

---

## 📦 Assets & Resources

### Fonts
- **Courier Prime**: [Google Fonts](https://fonts.google.com/specimen/Courier+Prime)
- **Inter**: [Google Fonts](https://fonts.google.com/specimen/Inter)

### 3D Models
- **Holographic Model**: `/models/hermes/` (GLB format)
- **Brain Model**: `/static/models/brain/` (proyecto Sintergic)

### Shaders
- **Holographic Shader**: `/shaders/holographic/`
- **Code Flow Shader**: `/shaders/codeFlow/`
- **Tesseract (legacy)**: `/shaders/tesseract/`

---

## ✨ Casos de Uso

### Ejemplo: Agregar Nueva Sección

```jsx
// ✅ Correcto
<section className="w-full px-6 md:px-16 py-20 md:py-[120px] max-w-[1600px] mx-auto">
  <h2 className="text-[40px] md:text-[50px] font-semibold text-[#1A1A1A] mb-12">
    Nueva Sección
  </h2>
  <p className="text-xl text-[#666666] leading-[1.6] max-w-[900px]">
    Descripción que invita a explorar entre el ruido.
  </p>
</section>

// ❌ Incorrecto (usar fondos muy saturados o oscuros)
<div style={{backgroundColor: "#111", color: "yellow"}}>
  <h1>¡Mira Nuestros Increíbles Proyectos!</h1>
</div>
```

### Ejemplo: Service Card

```jsx
// ✅ Correcto
<div className="flex flex-col p-10 bg-white rounded-2xl 
                border border-[#E8E8E8] hover:border-[#E85A4F] 
                hover:shadow-lg transition-all duration-300">
  <div className="flex items-start justify-between mb-20">
    <span className="text-xl text-[#CCCCCC]">1.</span>
    <div className="w-8 h-8 rounded-full bg-[#E85A4F]" />
  </div>
  <h3 className="text-[32px] font-semibold text-[#1A1A1A] mb-6">
    Web Development
  </h3>
  <p className="text-base text-[#666666] leading-[1.6]">
    Experiencias web que transforman el ruido en claridad.
  </p>
</div>

// ❌ Incorrecto
<div style={{background: "linear-gradient(45deg, purple, pink)", 
             padding: "20px", borderRadius: "10px"}}>
  <h3 style={{color: "white", textShadow: "0 0 10px cyan"}}>
    🚀 Servicio Increíble!!!
  </h3>
</div>
```

---

## 🔮 Futuro & Evolución

### En Consideración
- [ ] Partículas generativas que respondan al scroll (representando datos cayendo como matrix)
- [ ] Sonido ambiente sutil basado en interacciones (frecuencias que emergen del caos)
- [ ] WebGL post-processing: bloom en nodos activos cuando se descubren patrones
- [ ] Visualización de "ruido transformándose en claridad" en tiempo real
- [ ] Modo exploración: caminos alternativos que rompen el flujo predecible

### No Considerado (Anti-Patterns)
- ❌ Animaciones flashy sin propósito exploratorio
- ❌ Efectos que buscan asombrar sin invitar a descubrir
- ❌ Pop-ups, modales que interrumpen el flujo
- ❌ Música de fondo automática que no responde al usuario
- ❌ Simulaciones de caos sin estructura subyacente

---

## 📄 Licencia & Créditos

**Diseño & Desarrollo:** Pedro Nassiff  
**Inspiración Conceptual:** Teoría Sintérgica de Jacobo Grinberg  
**Filosofía:** Convertir lo aleatorio en intención, el ruido en claridad, la perturbación en creación  
**Referencias Visuales:** The Matrix (código cayendo como datos), Interstellar (información como estructura dorada), Experimentos de física cuántica (ondas, perturbaciones, patrones emergentes)

---

**Última actualización:** Febrero 2026  
**Versión:** 1.0  
**Estado:** Activo & En Evolución
