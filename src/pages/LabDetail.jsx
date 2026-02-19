import React, { Suspense, useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageTracking, useEventTracking } from '../lib/useAnalytics.jsx'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import HolographicModel from '../components/HolographicModel'
import TesseractModel from '../lab-core/tesseract/TesseractModel'
import GalaxyModel from '../lab-core/galaxy/GalaxyModel'
import RetratarteDetail from './RetratarteDetail'
import BrainDetail from './BrainDetail'


// Locale helper — Argentine Spanish and all Spanish locales
const isSpanish = () => typeof navigator !== 'undefined' && navigator.language?.startsWith('es')

// Bilingual about.md content
const ABOUT = {
  tesseract: {
    en: `# tesseract.dimension

a cube understands three directions.
a hypercube insists on a fourth.

we cannot see it — not directly —
but we can watch its shadow rotate
and feel the shape of something
beyond the frame.

the brain is like this.
we observe its projection:
language, memory, feeling, thought.
but the thing casting the shadow
remains largely unknown.

four dimensions is one more
than we were given.
consciousness may be one more than that.

the tesseract is a reminder:
the limit of your perception
is not the limit of what exists.

still rotating. still becoming.

// in progress — like the rest of us.

— random() lab`,
    es: `# tesseract.dimensión

un cubo entiende tres direcciones.
un hipercubo insiste en una cuarta.

no podemos verla — no directamente —
pero podemos observar su sombra girar
y sentir la forma de algo
más allá del marco.

el cerebro es así.
observamos su proyección:
lenguaje, memoria, sentimiento, pensamiento.
pero lo que proyecta la sombra
sigue siendo en gran parte desconocido.

cuatro dimensiones es una más
de las que nos dieron.
la conciencia puede ser una más que esa.

el tesseract es un recordatorio:
el límite de tu percepción
no es el límite de lo que existe.

todavía girando. todavía convirtiéndose.

// en progreso — como el resto de nosotros.

— random() lab`,
  },
  galaxy: {
    en: `# galaxy.home

you are made of stellar remnants —
every atom in your body
passed through a star
before it passed through you.

the galaxy is not a backdrop.
it is the living context:
billions of fires spinning in conversation,
the same geometry at every scale.

look outward and you look inward.
look inward and you look outward.

zoom in, find the whole.
zoom out, find yourself.
the mandelbrot truth: it's the same.

we are the universe become briefly local,
briefly aware,
briefly capable of wondering why.

this is your home.
it has always been moving.

— random() lab`,
    es: `# galaxia.hogar

estás hecho de restos estelares —
cada átomo en tu cuerpo
pasó por una estrella
antes de pasar por vos.

la galaxia no es un fondo de pantalla.
es el contexto vivo:
miles de millones de fuegos girando en conversación,
la misma geometría a cada escala.

mirá hacia afuera y mirás hacia adentro.
mirá hacia adentro y mirás hacia afuera.

acercate, encontrás el todo.
alejate, te encontrás a vos.
la verdad mandelbrot: es lo mismo.

somos el universo que se vuelve brevemente local,
brevemente consciente,
brevemente capaz de preguntarse por qué.

este es tu hogar.
siempre estuvo en movimiento.

— random() lab`,
  },
  holographic: {
    en: `# holographic.being

vibration is the first language —
before thought, before image,
there is oscillation.

the holographic model is the body as signal:
each color a frequency,
each frequency a state,
each state a question
posed to the present moment.

chakras are not metaphor here.
they are standing waves in the field of flesh,
interference patterns where attention pools
and consciousness gathers.

watch it long enough
and you will feel the resonance —
something in you follows the geometry,
something older than language says yes.

this is not a representation of the self.
this is the self,
at a different resolution.

— random() lab`,
    es: `# holográfico.ser

la vibración es el primer lenguaje —
antes del pensamiento, antes de la imagen,
existe la oscilación.

el modelo holográfico es el cuerpo como señal:
cada color una frecuencia,
cada frecuencia un estado,
cada estado una pregunta
hecha al momento presente.

los chakras no son metáfora acá.
son ondas estacionarias en el campo de la carne,
patrones de interferencia donde la atención se acumula
y la conciencia se reúne.

observalo el tiempo suficiente
y vas a sentir la resonancia —
algo en vos sigue la geometría,
algo más viejo que el lenguaje dice sí.

esto no es una representación del ser.
esto es el ser,
en una resolución diferente.

— random() lab`,
  },
}

// Source files per experiment

const EDITOR_FILES = {
  tesseract: [
    {
      name: 'config.js',
      lang: 'js',
      live: true,
      code: `export const tesseract = {
  rotation: {
    xwSpeed: 0.40,   // XW plane spin rate
    ywSpeed: 0.25,   // YW plane spin rate
    zwSpeed: 0.15,   // ZW plane spin rate
  },
  colors: {
    line:  '#FFD700',
    point: '#ffffff',
  },
  viewDistance: 2.0,
}`,
    },
    {
      name: 'projection.js',
      lang: 'js',
      live: false,
      code: `// 4D → 3D stereographic projection
// Three independent rotation planes: XW, YW, ZW
function project(point4D, time, cfg) {
  let [x, y, z, w] = point4D

  // XW plane rotation
  const a1 = time * cfg.rotation.xwSpeed
  ;[x, w] = [x * Math.cos(a1) - w * Math.sin(a1),
              x * Math.sin(a1) + w * Math.cos(a1)]

  // YW plane rotation
  const a2 = time * cfg.rotation.ywSpeed
  ;[y, w] = [y * Math.cos(a2) - w * Math.sin(a2),
              y * Math.sin(a2) + w * Math.cos(a2)]

  // ZW plane rotation
  const a3 = time * cfg.rotation.zwSpeed
  ;[z, w] = [z * Math.cos(a3) - w * Math.sin(a3),
              z * Math.sin(a3) + w * Math.cos(a3)]

  // Perspective divide — eye at w = viewDistance
  const d = cfg.viewDistance / (cfg.viewDistance - w)
  return [x * d, y * d, z * d]
}

// Hypercube: 16 vertices, 32 edges
// Bit trick: connected iff exactly one bit differs
const vertices = Array.from({ length: 16 }, (_, i) => [
  (i & 1) ? 0.5 : -0.5,
  (i & 2) ? 0.5 : -0.5,
  (i & 4) ? 0.5 : -0.5,
  (i & 8) ? 0.5 : -0.5,
])`,
    },
    {
      name: 'vertex.glsl',
      lang: 'glsl',
      live: true,
      code: `uniform float uTime;
varying vec3  vPos;

void main() {
  vPos        = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    },
    {
      name: 'fragment.glsl',
      lang: 'glsl',
      live: true,
      code: `uniform float uTime;
uniform vec3  uColor;
varying vec3  vPos;

void main() {
  // Pulse along time + distance from origin
  float t = 0.65 + 0.35 * sin(uTime * 1.2 + length(vPos) * 3.0);
  gl_FragColor = vec4(uColor * t, 0.85);
}`,
    },
    {
      name: 'about.md',
      lang: 'markdown',
      live: false,
      get code() { return isSpanish() ? ABOUT.tesseract.es : ABOUT.tesseract.en },
    },
  ],
  galaxy: [
    {
      name: 'config.js',
      lang: 'js',
      live: true,
      code: `export const galaxy = {
  params: {
    count:          25000,
    radius:         3,
    branches:       5,
    spin:           1,
    randomness:     0.2,
    randomnessPower: 3,
    size:           20,
    insideColor:  '#ff6030',
    outsideColor: '#1b3984',
  },
}`,
    },
    {
      name: 'vertex.glsl',
      lang: 'glsl',
      live: true,
      code: `uniform float uSize;
uniform float uTime;

attribute float aScale;
attribute vec3  aRandomness;

varying vec3 vColor;

void main() {
  vec4 pos = modelMatrix * vec4(position, 1.0);

  float angle  = atan(pos.x, pos.z);
  float dist   = length(pos.xz);
  float offset = (1.0 / dist) * uTime * 0.2;

  angle  += offset;
  pos.x   = cos(angle) * dist;
  pos.z   = sin(angle) * dist;
  pos.xyz += aRandomness;

  vec4 view = viewMatrix * pos;
  gl_Position  = projectionMatrix * view;
  gl_PointSize = uSize * aScale * (1.0 / -view.z);
  vColor       = color;
}`,
    },
    {
      name: 'fragment.glsl',
      lang: 'glsl',
      live: true,
      code: `varying vec3 vColor;

void main() {
  float s = distance(gl_PointCoord, vec2(0.5));
  s = pow(1.0 - s, 10.0);
  gl_FragColor = vec4(mix(vec3(0.0), vColor, s), 1.0);
}`,
    },
    {
      name: 'about.md',
      lang: 'markdown',
      live: false,
      get code() { return isSpanish() ? ABOUT.galaxy.es : ABOUT.galaxy.en },
    },
  ],
  holographic: [
    {
      name: 'config.js',
      lang: 'js',
      live: true,
      code: `export const config = {
  color: '#70c1ff',
  glitchStrength: 0.05,
  speed: 0.02,
  stripeFreq: 20.0,
  fresnelPower: 2.0,
  opacity: 0.9,
}`,
    },
    {
      name: 'vertex.glsl',
      lang: 'glsl',
      live: true,
      code: `uniform float uTime;
uniform float uGlitch;
varying vec3 vPosition;
varying vec3 vNormal;

float random2D(vec2 value) {
    return fract(sin(dot(value.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    float glitchTime     = uTime - modelPosition.y;
    float glitchStrength = sin(glitchTime) + sin(glitchTime * 1.45) + sin(glitchTime * 2.13);
    glitchStrength      /= 3.0;
    glitchStrength       = smoothstep(0.3, 1.0, glitchStrength);
    glitchStrength      *= uGlitch;
    modelPosition.x += (random2D(modelPosition.xz + uTime) - 0.5) * glitchStrength;
    modelPosition.z += (random2D(modelPosition.zx + uTime) - 0.5) * glitchStrength;

    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vec4 modeNormal = modelMatrix * vec4(normal, 0.0);
    vPosition = modelPosition.xyz;
    vNormal   = modeNormal.xyz;
}`,
    },
    {
      name: 'fragment.glsl',
      lang: 'glsl',
      live: true,
      code: `uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
uniform float uSpeed;
uniform float uStripe;
uniform float uFresnel;
varying vec3  vPosition;
varying vec3  vNormal;

vec3 getChakraColor(float time) {
    vec3 chakraColors[7];
    chakraColors[0] = vec3(1.0, 0.0, 0.0);
    chakraColors[1] = vec3(1.0, 0.5, 0.0);
    chakraColors[2] = vec3(1.0, 1.0, 0.0);
    chakraColors[3] = vec3(0.0, 1.0, 0.0);
    chakraColors[4] = vec3(0.0, 0.5, 1.0);
    chakraColors[5] = vec3(0.3, 0.0, 0.5);
    chakraColors[6] = vec3(0.5, 0.0, 1.0);

    float cycleTime = mod(time * 0.5, 7.0);
    int   currIdx   = int(floor(cycleTime));
    int   nextIdx   = int(mod(float(currIdx + 1), 7.0));
    float mix_f     = smoothstep(0.0, 1.0, fract(cycleTime));
    return mix(chakraColors[currIdx], chakraColors[nextIdx], mix_f);
}

void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal *= -1.0;

    float stripes = mod((vPosition.y - uTime * uSpeed) * uStripe, 1.0);
    stripes = pow(stripes, 3.0);

    vec3  viewDirection = normalize(vPosition - cameraPosition);
    float fresnel       = pow(dot(viewDirection, normal) + 1.0, uFresnel);
    float falloff       = smoothstep(0.8, 0.0, fresnel);

    float holographic   = stripes * fresnel + fresnel * 1.25;
    holographic        *= falloff;

    vec3 chakraColor = getChakraColor(uTime);
    vec3 finalColor  = mix(chakraColor, uColor, 0.3);

    gl_FragColor = vec4(finalColor, holographic * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`,
    },
    {
      name: 'about.md',
      lang: 'markdown',
      live: false,
      get code() { return isSpanish() ? ABOUT.holographic.es : ABOUT.holographic.en },
    },
  ],
}


// Lab editor styles

const EDITOR_STYLES = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes slideInUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .lab-editor { font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace; }
  .lab-editor *::-webkit-scrollbar        { width: 5px; height: 5px; }
  .lab-editor *::-webkit-scrollbar-track  { background: transparent; }
  .lab-editor *::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.07); border-radius: 3px; }
  .lab-editor *::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }
  .lab-ta { caret-color: #00FFD1; }
  .lab-ta::selection { background: rgba(0,255,209,0.18); }
  .lab-tab-strip { overflow-x: auto; scrollbar-width: none; }
  .lab-tab-strip::-webkit-scrollbar { display: none; }
  .lab-tab-btn { transition: color 0.12s, background 0.12s; }
  .lab-tab-btn:hover { color: rgba(255,255,255,0.75) !important; }
  .lab-resize { transition: background 0.15s; }
  .lab-resize:hover, .lab-resize:active { background: rgba(0,255,209,0.3) !important; }

  @keyframes glitch-clip {
    0%   { clip-path: inset(40% 0 50% 0); transform: translateY(-50%) rotate(180deg) translate(-2px,0); }
    10%  { clip-path: inset(10% 0 80% 0); transform: translateY(-50%) rotate(180deg) translate(2px,0);  }
    20%  { clip-path: inset(70% 0 10% 0); transform: translateY(-50%) rotate(180deg) translate(0,0);    }
    30%  { clip-path: inset(30% 0 40% 0); transform: translateY(-50%) rotate(180deg) translate(-1px,0); }
    40%  { clip-path: inset(80% 0  5% 0); transform: translateY(-50%) rotate(180deg) translate(1px,0);  }
    50%  { clip-path: inset(50% 0 30% 0); transform: translateY(-50%) rotate(180deg) translate(0,0);    }
    100% { clip-path: inset(40% 0 50% 0); transform: translateY(-50%) rotate(180deg) translate(-2px,0); }
  }
  .lab-source-btn {
    transition: color 0.2s, background 0.2s, border-color 0.2s;
    position: relative;
  }
  .lab-source-btn::before,
  .lab-source-btn::after {
    content: attr(data-text);
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    writing-mode: vertical-rl;
    font: inherit; letter-spacing: inherit;
    pointer-events: none; opacity: 0;
    padding: inherit;
  }
  .lab-source-btn::before { color: #E040FB; left: -1px; }
  .lab-source-btn::after  { color: #00B4FF; left:  1px; }
  .lab-source-btn:hover::before,
  .lab-source-btn:hover::after {
    opacity: 0.7;
    animation: glitch-clip 0.35s steps(1) infinite;
  }
  .lab-source-btn:hover::after {
    animation-delay: 0.05s;
    animation-direction: reverse;
  }
`


// MarkdownView — read-only prose display for .md tabs
function MarkdownView({ content, compact }) {
  const lines = content.split('\n')
  return (
    <div style={{
      flex: 1, overflowY: 'auto',
      padding: compact ? '16px 18px 40px' : '32px 36px 48px',
      fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
      fontSize: compact ? 11 : 12,
    }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return (
          <div key={i} style={{ color: '#00FFD1', fontSize: 13, letterSpacing: '0.12em', marginBottom: 28, paddingBottom: 10, borderBottom: '1px solid rgba(0,255,209,0.12)', fontWeight: 600 }}>{line.slice(2)}</div>
        )
        if (line.startsWith('## ')) return (
          <div key={i} style={{ color: 'rgba(0,255,209,0.6)', fontSize: 11, letterSpacing: '0.1em', marginTop: 20, marginBottom: 10 }}>{line.slice(3)}</div>
        )
        if (line.startsWith('// ')) return (
          <div key={i} style={{ color: 'rgba(255,255,255,0.18)', fontStyle: 'italic', lineHeight: '1.9', letterSpacing: '0.03em' }}>{line}</div>
        )
        if (line.startsWith('— ')) return (
          <div key={i} style={{ color: 'rgba(255,255,255,0.22)', marginTop: 28, letterSpacing: '0.08em', fontSize: 10 }}>{line}</div>
        )
        if (line.trim() === '') return <div key={i} style={{ height: 14 }} />
        return (
          <div key={i} style={{ color: 'rgba(255,255,255,0.62)', lineHeight: '1.9', letterSpacing: '0.03em' }}>{line}</div>
        )
      })}
    </div>
  )
}

// CodeArea — textarea + synced line numbers

function CodeArea({ value, onChange, onCursorChange, onForceCompile, fontSize = 12 }) {
  const taRef   = useRef(null)
  const numsRef = useRef(null)
  const lineCount = (value.match(/\n/g) || []).length + 1

  const syncScroll = () => {
    if (numsRef.current && taRef.current)
      numsRef.current.scrollTop = taRef.current.scrollTop
  }

  const reportCursor = () => {
    const ta = taRef.current
    if (!ta || !onCursorChange) return
    const before = ta.value.slice(0, ta.selectionStart)
    const lines  = before.split('\n')
    onCursorChange({ ln: lines.length, col: lines[lines.length - 1].length + 1 })
  }

  const handleKeyDown = (e) => {
    // Tab → 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault()
      const { selectionStart: ss, selectionEnd: se } = e.target
      const next = value.slice(0, ss) + '  ' + value.slice(se)
      onChange(next)
      requestAnimationFrame(() => {
        if (taRef.current) {
          taRef.current.selectionStart = taRef.current.selectionEnd = ss + 2
          reportCursor()
        }
      })
      return
    }
    // ⌘↵ or Ctrl↵ → force compile
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onForceCompile?.()
      return
    }
  }

  const lh = 20

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      {/* Line numbers column */}
      <div
        ref={numsRef}
        aria-hidden
        style={{
          flexShrink: 0, width: 48,
          paddingTop: 14, paddingBottom: 20, paddingRight: 12,
          textAlign: 'right',
          color: 'rgba(255,255,255,0.12)',
          fontSize, lineHeight: lh + 'px',
          userSelect: 'none', overflowY: 'hidden', overflowX: 'hidden',
          background: '#060910',
          borderRight: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: lh }}>{i + 1}</div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={taRef}
        className="lab-ta"
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        onClick={reportCursor}
        onKeyUp={reportCursor}
        onSelect={reportCursor}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none', outline: 'none',
          color: 'rgba(255,255,255,0.85)',
          cursor: 'text',
          fontFamily: 'inherit',
          fontSize, lineHeight: lh + 'px',
          paddingTop: 14, paddingBottom: 32,
          paddingLeft: 12, paddingRight: 16,
          resize: 'none', tabSize: 2,
          whiteSpace: 'pre', overflowWrap: 'normal',
          overflowX: 'auto', overflowY: 'auto',
        }}
      />
    </div>
  )
}


// EditorPanel — resizable live editor

function EditorPanel({ files, liveCode, onChange, errorMsg, shaderPending, onClose, onForceCompile }) {
  const [activeTab,  setActiveTab]  = useState(0)
  const [panelWidth, setPanelWidth] = useState(460)
  const [cursor,     setCursor]     = useState({ ln: 1, col: 1 })
  const [tabOverflow, setTabOverflow] = useState(false)
  const [isMobile,   setIsMobile]   = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const dragRef     = useRef(null)
  const tabStripRef = useRef(null)
  const tabDragRef  = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false })

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // about.md always first
  const orderedFiles = [...files].sort((a, b) => {
    if (a.name === 'about.md') return -1
    if (b.name === 'about.md') return 1
    return 0
  })

  // Overflow indicator
  useEffect(() => {
    const el = tabStripRef.current
    if (!el) return
    const check = () => setTabOverflow(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [files])

  // Drag-to-scroll on tab strip
  const onTabStripMouseDown = (e) => {
    if (e.button !== 0) return
    const el = tabStripRef.current
    if (!el) return
    tabDragRef.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false }
    e.stopPropagation()
  }
  const onTabStripMouseMove = (e) => {
    const d = tabDragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 3) d.moved = true
    if (d.moved && tabStripRef.current) tabStripRef.current.scrollLeft = d.scrollLeft - dx
    e.stopPropagation()
  }
  const onTabStripMouseUp = (e) => { tabDragRef.current.active = false; e.stopPropagation() }
  const onTabStripWheel = (e) => {
    const el = tabStripRef.current
    if (el) el.scrollLeft += e.deltaY || e.deltaX
    e.stopPropagation(); e.preventDefault()
  }
  // Touch scroll for mobile
  const onTabStripTouchStart = (e) => {
    const t = e.touches[0]
    tabDragRef.current = { active: true, startX: t.clientX, scrollLeft: tabStripRef.current?.scrollLeft || 0, moved: false }
  }
  const onTabStripTouchMove = (e) => {
    const d = tabDragRef.current
    if (!d.active || !tabStripRef.current) return
    tabStripRef.current.scrollLeft = d.scrollLeft - (e.touches[0].clientX - d.startX)
  }
  const onTabStripTouchEnd = () => { tabDragRef.current.active = false }

  useEffect(() => { setActiveTab(0) }, [files])

  const file  = orderedFiles[activeTab]
  const value = liveCode[file?.name] ?? file?.code ?? ''
  const lang  = file?.lang ?? 'js'

  // Resize drag
  const startResize = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = panelWidth
    const onMove = (ev) => {
      const delta = startX - ev.clientX
      setPanelWidth(Math.min(900, Math.max(300, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup',   onUp,   true)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    // capture:true  fires before stopPropagation in child handlers
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup',   onUp,   true)
  }

  const stopAll = (e) => e.stopPropagation()

  const extColor = (name) => {
    if (name.endsWith('.glsl')) return '#00B4FF'
    if (name.endsWith('.js'))   return '#E040FB'
    if (name.endsWith('.md'))   return '#00FFD1'
    return 'rgba(255,255,255,0.38)'
  }

  const isEs = typeof navigator !== 'undefined' && navigator.language?.startsWith('es')
  const langLabel = lang === 'glsl' ? 'GLSL' : lang === 'js' ? 'JavaScript' : lang === 'markdown' ? (isEs ? 'esencia' : 'essence') : lang.toUpperCase()

  const hasError = !!errorMsg

  return (
    <div
      className="lab-editor"
      onPointerDown={stopAll} onPointerMove={stopAll} onPointerUp={stopAll}
      onMouseDown={stopAll}   onMouseMove={stopAll}
      onTouchStart={stopAll}  onWheel={stopAll}
      style={isMobile ? {
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '78vh',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        background: '#080b10',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '14px 14px 0 0',
        fontSize: 12,
        animation: 'slideInUp 0.25s ease',
        cursor: 'default',
      } : {
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: panelWidth,
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        background: '#080b10',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        fontSize: 12,
        animation: 'slideInRight 0.2s ease',
        cursor: 'default',
      }}
    >
      <style>{EDITOR_STYLES}</style>

      {/* ── Mobile drag pill ──────────────────────────────── */}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
        </div>
      )}

      {/* ── Resize handle (desktop only) ──────────────────── */}
      {!isMobile && <div
        ref={dragRef}
        className="lab-resize"
        onMouseDown={startResize}
        title="Drag to resize"
        style={{
          position: 'absolute', left: -3, top: 0, bottom: 0, width: 6,
          cursor: 'ew-resize', zIndex: 10,
          background: 'transparent',
        }}
      />}

      {/* ── Title bar ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'stretch', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#04070c',
        height: 38,
      }}>
        {/* Brand close */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={onClose}
            title="close editor"
            style={{
              background: 'none',
              border: '1px solid rgba(0,255,209,0.22)',
              borderRadius: 2,
              color: 'rgba(0,255,209,0.45)',
              cursor: 'pointer',
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
              fontSize: 9,
              letterSpacing: '0.12em',
              padding: '3px 8px',
              lineHeight: 1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#00FFD1'
              e.currentTarget.style.borderColor = 'rgba(0,255,209,0.55)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(0,255,209,0.45)'
              e.currentTarget.style.borderColor = 'rgba(0,255,209,0.22)'
            }}
          >×</button>
        </div>

        {/* Scrollable tab strip — drag or wheel scroll */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {tabOverflow && (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 32,
              background: 'linear-gradient(to right, transparent, #04070c)',
              zIndex: 2, pointerEvents: 'none',
            }} />
          )}
          <div
            ref={tabStripRef}
            className="lab-tab-strip"
            onMouseDown={onTabStripMouseDown}
            onMouseMove={onTabStripMouseMove}
            onMouseUp={onTabStripMouseUp}
            onMouseLeave={onTabStripMouseUp}
            onWheel={onTabStripWheel}
            onTouchStart={onTabStripTouchStart}
            onTouchMove={onTabStripTouchMove}
            onTouchEnd={onTabStripTouchEnd}
            style={{ display: 'flex', height: '100%', alignItems: 'stretch', cursor: isMobile ? 'default' : 'grab' }}>
            {orderedFiles.map((f, i) => (
              <button
                key={i}
                className="lab-tab-btn"
                onClick={() => { if (!tabDragRef.current?.moved) setActiveTab(i) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i === activeTab ? '2px solid #00FFD1' : '2px solid transparent',
                  borderRight: '1px solid rgba(255,255,255,0.05)',
                  color: i === activeTab ? '#fff' : 'rgba(255,255,255,0.32)',
                  cursor: 'pointer',
                  fontSize: 11, letterSpacing: '0.03em',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ color: extColor(f.name), fontSize: 8 }}>⬤</span>
                {f.name}
              </button>
            ))}
          </div>
        </div>

        </div>{/* end title bar */}

      {/* ── Error banner ──────────────────────────────────── */}
      {hasError && (
        <div style={{
          flexShrink: 0,
          padding: '6px 14px',
          background: 'rgba(255,95,87,0.08)',
          borderBottom: '1px solid rgba(255,95,87,0.2)',
          color: '#ff5f57',
          fontSize: 11, lineHeight: '16px',
          fontFamily: 'inherit',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          ⚠ {errorMsg}
        </div>
      )}

      {/* ── Code area ─────────────────────────────────────── */}
      {file?.lang === 'markdown'
        ? <MarkdownView content={value} compact={isMobile} />
        : <CodeArea
            value={value}
            onChange={(v) => onChange(file.name, v)}
            onCursorChange={setCursor}
            onForceCompile={onForceCompile}
          />
      }

      {/* ── Status bar (VS Code pattern) ──────────────────── */}
      <div style={{
        flexShrink: 0, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#02050a',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '0 10px',
        fontSize: 10, letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.28)',
        userSelect: 'none',
        fontFamily: 'inherit',
      }}>
        {/* Left: lang + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: lang === 'glsl' ? 'rgba(0,180,255,0.12)' : lang === 'markdown' ? 'rgba(0,255,209,0.08)' : 'rgba(224,64,251,0.12)',
            color: lang === 'glsl' ? '#00B4FF' : lang === 'markdown' ? '#00FFD1' : '#E040FB',
            padding: '1px 6px', borderRadius: 2,
            fontSize: 9, letterSpacing: '0.08em',
          }}>{langLabel}</span>
          {shaderPending && !hasError && (
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>compiling…</span>
          )}
          {!shaderPending && !hasError && file?.live && (
            <span style={{ color: 'rgba(0,255,209,0.45)' }}>● ready</span>
          )}
          {hasError && (
            <span style={{ color: '#ff5f57' }}>⚠ error</span>
          )}
        </div>
        {/* Right: cursor pos + shortcut hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Ln {cursor.ln}, Col {cursor.col}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>⌘↵ compile</span>
        </div>
      </div>
    </div>
  )
}


// Config full-screen por experimento

const DETAIL_CONFIG = {
  holographic: {
    name: 'HOLOGRAPHIC',
    Component: HolographicModel,
    camera: { position: [0, 0.5, 7], fov: 44 },
    model: { scale: 0.17, position: [0, -1.5, 0], autoRotate: true, opacity: 0.9 },
    bg: '#000308',
    lights: [
      { type: 'ambient', intensity: 0.3 },
      { type: 'point', pos: [2, 3, 2], intensity: 2.2, color: '#70c1ff' },
      { type: 'point', pos: [-2, -1, 1], intensity: 0.8, color: '#3040ff' },
    ],
    desc: 'Human form, rendered in light.',
    tags: ['glitch', 'shaders', 'chakras'],
  },
  tesseract: {
    name: 'TESSERACT',
    Component: TesseractModel,
    camera: { position: [0, 0.3, 2.8], fov: 38 },
    model: { scale: 0.5, position: [0, 0, 0], autoRotate: true, opacity: 1 },
    bg: '#020201',
    lights: [
      { type: 'ambient', intensity: 0.4 },
      { type: 'point', pos: [3, 3, 3], intensity: 1.2, color: '#FFD700' },
    ],
    desc: '4D hypercube projected into 3-space.',
    tags: ['4D geometry', 'projection', 'shaders'],
  },
  galaxy: {
    name: 'GALAXY',
    Component: GalaxyModel,
    camera: { position: [0, 3, 6], fov: 52 },
    model: { scale: 2, position: [0, 0, 0], autoRotate: true, opacity: 1 },
    bg: '#000005',
    lights: [
      { type: 'ambient', intensity: 0.1 },
    ],
    desc: '25,000 particles in orbit.',
    tags: ['25k particles', 'noise field', 'orbit'],
  },
}

// Placeholders para los complejos
const PLACEHOLDER_IDS = []


// Lights helper

function SceneLights({ lights }) {
  return lights.map((l, i) =>
    l.type === 'ambient'
      ? <ambientLight key={i} intensity={l.intensity} />
      : <pointLight key={i} position={l.pos} intensity={l.intensity} color={l.color} />
  )
}


// Custom cursor (igual que en Lab.jsx)

function CustomCursor() {
  const ref = useRef(null)
  const pos = useRef({ x: -100, y: -100 })
  const raf = useRef(null)

  useEffect(() => {
    const move = (e) => { pos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', move)
    const tick = () => {
      if (ref.current) ref.current.style.transform = `translate(${pos.current.x - 6}px, ${pos.current.y - 6}px)`
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { window.removeEventListener('mousemove', move); cancelAnimationFrame(raf.current) }
  }, [])

  return (
    <div ref={ref} className="pointer-events-none fixed top-0 left-0 z-[9999] mix-blend-difference" style={{ willChange: 'transform' }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffffff' }} />
    </div>
  )
}


// Placeholder page para experimentos en desarrollo

function ComingSoon({ id, onBack }) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center" style={{ cursor: 'none' }}>
      <CustomCursor />
      <p className="text-white/20 text-[10px] tracking-[0.5em] uppercase font-mono mb-6">.RANDOM() / LAB</p>
      <h1 className="text-white text-2xl tracking-[0.3em] uppercase font-mono mb-3">{id.toUpperCase()}</h1>
      <p className="text-white/30 text-[11px] tracking-[0.3em] uppercase font-mono">In development</p>

      <button
        onClick={onBack}
        className="fixed top-8 left-8 text-white/40 hover:text-white text-[10px] tracking-[0.4em] uppercase font-mono transition-colors duration-200"
        style={{ cursor: 'none' }}
      >
        ← Back
      </button>
    </div>
  )
}


// LabDetail — full screen experiment viewer

export default function LabDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [hint, setHint] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  usePageTracking(`lab/${id}`);
  const { trackClick } = useEventTracking();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Live code state ─────────────────────────────────────
  const [liveCode, setLiveCode] = useState(() => {
    const obj = {}
    ;(EDITOR_FILES[id] || []).forEach(f => { obj[f.name] = f.code })
    return obj
  })

  // Reset when experiment changes
  useEffect(() => {
    const obj = {}
    ;(EDITOR_FILES[id] || []).forEach(f => { obj[f.name] = f.code })
    setLiveCode(obj)
    // Also reset compiled state immediately on experiment switch
    const files = EDITOR_FILES[id] || []
    setCompiledVertex(files.find(f => f.name === 'vertex.glsl')?.code)
    setCompiledFragment(files.find(f => f.name === 'fragment.glsl')?.code)
    const cfgFile = files.find(f => f.name === 'config.js')
    if (cfgFile) {
      try {
        const s = cfgFile.code.replace(/^export\s+const\s+\w+\s*=\s*/, '').trim().replace(/;?\s*$/, '')
        setCompiledConfig(new Function('return (' + s + ')')())
      } catch { setCompiledConfig(null) }
    } else {
      setCompiledConfig(null)
    }
    setConfigError(false)
    setErrorMsg('')
    setShaderPending(false)
  }, [id])

  const handleCodeChange = (filename, newCode) => {
    setLiveCode(prev => ({ ...prev, [filename]: newCode }))
  }

  // ── Debounced compiled shaders — recompile 600ms after typing stops ──
  const [compiledVertex,   setCompiledVertex]   = useState(() => liveCode['vertex.glsl'])
  const [compiledFragment, setCompiledFragment] = useState(() => liveCode['fragment.glsl'])
  const [shaderPending, setShaderPending] = useState(false)
  useEffect(() => {
    setShaderPending(true)
    const t = setTimeout(() => {
      setCompiledVertex(liveCode['vertex.glsl'])
      setCompiledFragment(liveCode['fragment.glsl'])
      setShaderPending(false)
    }, 600)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCode['vertex.glsl'], liveCode['fragment.glsl']])

  // ── Debounced config eval — parse config.js 600ms after typing stops ──
  const [configError,    setConfigError]    = useState(false)
  const [errorMsg,       setErrorMsg]       = useState('')
  const [compiledConfig, setCompiledConfig] = useState(() => {
    const f = (EDITOR_FILES[id] || []).find(x => x.name === 'config.js')
    if (!f) return null
    try {
      const s = f.code.replace(/^export\s+const\s+\w+\s*=\s*/, '').trim().replace(/;?\s*$/, '')
      return new Function('return (' + s + ')')()  // eslint-disable-line no-new-func
    } catch { return null }
  })
  useEffect(() => {
    const t = setTimeout(() => {
      const code = liveCode['config.js']
      if (!code) return
      try {
        const stripped = code.replace(/^export\s+const\s+\w+\s*=\s*/, '').trim().replace(/;?\s*$/, '')
        setCompiledConfig(new Function('return (' + stripped + ')'  )())
        setConfigError(false)
        setErrorMsg('')
      } catch (err) {
        setConfigError(true)
        setErrorMsg(String(err).replace(/^Error:\s*/,''))
      }
    }, 600)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCode['config.js']])

  // Force compile immediately (from ⌘↵ shortcut)
  const forceCompile = () => {
    const code = liveCode['config.js']
    if (code) {
      try {
        const s = code.replace(/^export\s+const\s+\w+\s*=\s*/, '').trim().replace(/;?\s*$/, '')
        setCompiledConfig(new Function('return (' + s + ')')())
        setConfigError(false); setErrorMsg('')
      } catch (err) {
        setConfigError(true); setErrorMsg(String(err).replace(/^Error:\s*/, ''))
      }
    }
    setCompiledVertex(liveCode['vertex.glsl'])
    setCompiledFragment(liveCode['fragment.glsl'])
    setShaderPending(false)
  }

  const back = () => {
    trackClick('lab_back_click', id);
    navigate('/lab');
  }

  // Ocultar el drag hint tras 3s
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 3000)
    return () => clearTimeout(t)
  }, [])

  // Retratarte tiene su propio viewer
  if (id === 'retratarte') return <RetratarteDetail />

  // Brain viewer — WebSocket to Syntergic VAE
  if (id === 'brain') return <BrainDetail />

  // Placeholder (none currently)
  if (PLACEHOLDER_IDS.includes(id)) return <ComingSoon id={id} onBack={back} />

  const config = DETAIL_CONFIG[id]
  if (!config) {
    navigate('/lab', { replace: true })
    return null
  }

  const { name, Component, camera, model, lights, bg, desc } = config

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      <CustomCursor />
      <style>{EDITOR_STYLES}</style>

      {/* Full screen canvas */}
      <Canvas
        camera={{ position: camera.position, fov: camera.fov, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        frameloop="always"
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bg]} />
        <SceneLights lights={lights} />

        <Suspense fallback={null}>
          <Component
            scale={model.scale}
            position={model.position}
            autoRotate={model.autoRotate}
            opacity={model.opacity ?? 1}
            wireframe={model.wireframe ?? false}
            hovered={false}
            isVisible={true}
            vertexShader={compiledVertex}
            fragmentShader={compiledFragment}
            galaxyParams={compiledConfig?.params}
            tesseractParams={compiledConfig}
            holographicParams={compiledConfig}
          />
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={1}
          maxDistance={30}
        />
      </Canvas>

      {/* Back button */}
      <button
        onClick={back}
        className="fixed top-8 left-8 z-50 text-white/40 hover:text-white text-[14px] tracking-[0.4em] uppercase font-mono transition-colors duration-200"
        style={{ cursor: 'none' }}
      >
        ← Back
      </button>

      {/* Experiment name — top center */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center">
        <p className="text-white/20 text-[14px] tracking-[0.5em] uppercase font-mono">.RANDOM() / LAB</p>
        <p className="text-white/60 text-[14px] tracking-[0.4em] uppercase font-mono mt-1">{name}</p>
      </div>

      {/* Description + tags — bottom center */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center space-y-2">
        <p className="text-white/75 text-[12px] tracking-[0.3em] uppercase font-mono">{desc}</p>
        {config.tags?.length > 0 && (
          <div className="flex justify-center gap-2">
            {config.tags.map(tag => (
              <span key={tag} className="text-white/65 text-[10px] tracking-[0.3em] uppercase font-mono border border-white/10 px-1.5 py-0.5">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Source tab */}
      {EDITOR_FILES[id] && !showEditor && (
        isMobile ? (
          /* Mobile — vertical pill on right edge, same as desktop */
          <button
            className="lab-source-btn"
            data-text=">_ source"
            onClick={() => setShowEditor(true)}
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%) rotate(180deg)',
              zIndex: 150,
              writingMode: 'vertical-rl',
              background: 'rgba(0,255,209,0.04)',
              border: '1px solid rgba(0,255,209,0.25)',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              color: '#00FFD1',
              padding: '14px 7px',
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
              fontSize: '10px',
              letterSpacing: '0.18em',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            &gt;_ source
          </button>
        ) : (
          /* Desktop — vertical pill on right edge */
          <button
            className="lab-source-btn"
            data-text=">_ source"
            onClick={() => setShowEditor(true)}
            style={{
              position: 'fixed',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%) rotate(180deg)',
              zIndex: 150,
              writingMode: 'vertical-rl',
              background: 'rgba(0,255,209,0.04)',
              border: '1px solid rgba(0,255,209,0.25)',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              color: '#00FFD1',
              padding: '14px 7px',
              fontFamily: '"JetBrains Mono", "Fira Code", Menlo, monospace',
              fontSize: '10px',
              letterSpacing: '0.18em',
              cursor: 'none',
              pointerEvents: 'auto',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,255,209,0.1)'
              e.currentTarget.style.borderColor = 'rgba(0,255,209,0.5)'
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0,255,209,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,255,209,0.04)'
              e.currentTarget.style.borderColor = 'rgba(0,255,209,0.25)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            &gt;_ source
          </button>
        )
      )}

      {/* Editor panel */}
      {showEditor && EDITOR_FILES[id] && (
        <EditorPanel
          files={EDITOR_FILES[id]}
          liveCode={liveCode}
          onChange={handleCodeChange}
          errorMsg={errorMsg}
          shaderPending={shaderPending}
          onForceCompile={forceCompile}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Drag hint — hide when editor is open */}
      <div
        className="fixed bottom-8 z-50 pointer-events-none transition-opacity duration-700"
        style={{ opacity: hint && !showEditor ? 0.4 : 0, right: showEditor ? 436 : 32 }}
      >
        <p className="text-white text-[8px] tracking-[0.35em] uppercase font-mono">Drag to explore</p>
      </div>
    </div>
  )
}
