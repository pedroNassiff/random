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
import { EditorPanel, SourceButton, EDITOR_STYLES } from '../components/CodeEditor'


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
un hipercubo agrega en una cuarta.

no podemos verla, no directamente,
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

we are made of stellar remnants —
every atom in your body passed through a star
before it passed through you.

the galaxy is not a backdrop.
it is the living context —
billions of fires spinning in conversation,
the same geometry at every scale.

look outward and you look inward.
look inward and you look outward.

zoom in, find the whole.
zoom out, find yourself.
the truth according to the kybalion:
everything is the same in different degree.

this is our home.
it has always been moving, always flowing.

— random() lab`,
    es: `# galaxia.hogar

estamos hecho de restos estelares
cada átomo en tu cuerpo pasó por una estrella
antes de pasar por vos.

la galaxia no es un fondo de pantalla.
es el contexto vivo
miles de millones de fuegos girando en conversación,
la misma geometría a cada escala.

mirá hacia afuera y mirás hacia adentro.
mirá hacia adentro y mirás hacia afuera.

acercate, encontrás el todo.
alejate, te encontrás a vos.
la verdad según el kybalion: 
todo es lo mismo en distinto grado.

esta es nuestra casa.
siempre estuvo en movimiento, siempre fluyendo.

— random() lab`,
  },
  holographic: {
    en: `# holographic.being

the holographic model is the body as signal —
vibration as the first language.
each color a frequency,
each frequency a state.

chakras are not a metaphor.
they are standing waves in our field,
interference patterns where attention pools
and consciousness gathers.

this is not a representation of the self.
this is the self.

Inspired by the book
"Hey despierta! Todo el universo depende de ello!"
by my great friend Anibal Estigarribia,
an explorer of consciousness and spirituality.
[link to the book](https://www.instagram.com/hey.despierta/)

— random() lab`,
    es: `# holográfico.ser


el modelo holográfico es el cuerpo como señal
la vibración como primer lenguaje 
cada color una frecuencia,
cada frecuencia un estado.

los chakras no son una metáfora.
son ondas estacionarias en nuestro campo,
patrones de interferencia donde la atención se acumula
y la conciencia se reúne.

esto no es una representación del ser.
esto es el ser.

Inspirado por el libro 
"Hey despierta! Todo el universo depende de ello!"
de mi gran amigo Anibal Estigarribia, 
un explorador de la conciencia y la espiritualidad.
[link al libro](https://www.instagram.com/hey.despierta/)

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
  usePageTracking(`lab/${id}`);
  const { trackClick } = useEventTracking();

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
        <SourceButton onClick={() => setShowEditor(true)} />
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
