import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

// Vertex Shader
const syntergicVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying float vQuantumNoise;
  
  uniform float uTime;
  uniform vec3 uHover;
  uniform float uHoverIntensity; // Mapeado a Coherencia (1.0 = Alta, 0.0 = Baja)

  // Noise function para efecto cuántico
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    // --- QUANTUM SUPERPOSITION EFFECT ---
    // Coherencia baja = partículas en superposición (flotando caóticamente)
    // Coherencia alta = colapso de onda (estructura definida)
    
    float coherence = clamp((uHoverIntensity - 1.0) / 3.0, 0.0, 1.0);
    float chaos = 1.0 - coherence; // Inverso: más caos cuando coherencia baja
    
    // Noise 3D para simular incertidumbre cuántica
    vec3 noisePos = position * 3.0 + vec3(uTime * 0.3);
    float noise = snoise(noisePos);
    vQuantumNoise = noise; // Pasar al fragment shader
    
    // Desplazamiento cuántico: grande cuando chaos alto, pequeño cuando coherencia alta
    vec3 quantumDisplacement = normal * noise * chaos * 0.15;
    
    // Oscilación temporal (partículas "vibrando" entre estados)
    float oscillation = sin(uTime * 2.0 + position.x * 10.0) * cos(uTime * 1.5 + position.y * 10.0);
    quantumDisplacement += normal * oscillation * chaos * 0.08;
    
    // --- LATTICE DISTORTION (Focal Point) ---
    float dist = distance(position, uHover);
    float regionRadius = 6.0;
    
    float distortion = 1.0 - smoothstep(0.0, regionRadius, dist);
    distortion = pow(distortion, 2.0);
    
    // Cuando hay coherencia, la distorsión focal es más fuerte
    vec3 focalDisplacement = normal * distortion * 0.05 * sin(uTime * 5.0) * (1.0 + coherence);
    
    // POSICIÓN FINAL: Base + Quantum Chaos + Focal Point
    vec3 newPos = position + quantumDisplacement + focalDisplacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`

// Fragment Shader
const syntergicFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uHover;
  uniform float uHoverIntensity; // Coherencia (Controla Sintergia)

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying float vQuantumNoise;

  void main() {
    // Calcular coherencia normalizada
    float coherence = clamp((uHoverIntensity - 1.0) / 3.0, 0.0, 1.0);
    float chaos = 1.0 - coherence;
    
    // --- 1. LATTICE GRID (La Estructura) ---
    float gridScale = 20.0;
    float gridX = step(0.98, fract(vPosition.x * gridScale));
    float gridY = step(0.98, fract(vPosition.y * gridScale));
    float gridZ = step(0.98, fract(vPosition.z * gridScale));
    float isGrid = max(gridX, max(gridY, gridZ));
    
    // Grid más visible cuando hay caos (superposición)
    vec3 latticeColor = vec3(0.1, 0.1, 0.2) * (1.0 + chaos * 0.5);
    
    // --- 2. QUANTUM SUPERPOSITION EFFECT ---
    // Baja coherencia: colores fluctuantes (estados superpuestos)
    // Alta coherencia: colores estables (estado colapsado)
    
    vec3 quantumFluctuation = vec3(
      sin(vQuantumNoise * 10.0 + uTime * 2.0),
      cos(vQuantumNoise * 8.0 + uTime * 1.5),
      sin(vQuantumNoise * 12.0 + uTime * 3.0)
    ) * 0.5 + 0.5;
    
    // --- 3. HEMISPHERIC COHERENCE (Sintergia) ---
    vec3 leftHemiColor = vec3(0.0, 1.0, 1.0); // Cyan (Lógica)
    vec3 rightHemiColor = vec3(1.0, 0.0, 1.0); // Magenta (Intuición)
    vec3 unifiedColor = vec3(1.0, 0.9, 0.5); // Gold (Iluminación/Sintergia)
    
    // División hemisférica
    float hemiMix = step(0.0, vPosition.z); 
    vec3 rawHemiColor = mix(leftHemiColor, rightHemiColor, hemiMix);
    
    // Mezclar hacia unificación según coherencia
    vec3 brainStateColor = mix(rawHemiColor, unifiedColor, coherence);
    
    // Aplicar fluctuación cuántica cuando hay caos
    brainStateColor = mix(brainStateColor, quantumFluctuation, chaos * 0.4);
    
    // --- 4. DIRECTIONALITY FACTOR (Focal Point) ---
    float dist = distance(vPosition, uHover);
    float regionRadius = 7.0; 
    float activation = 1.0 - smoothstep(0.0, regionRadius, dist);
    activation = pow(activation, 5.0);
    
    // --- 5. COMPOSICIÓN FINAL ---
    // Base oscura
    vec3 finalColor = vec3(0.02);
    
    // Grid de la Lattice (más visible en caos)
    finalColor += latticeColor * isGrid * (0.3 + chaos * 0.3);
    
    // Activación focal con estado mental
    finalColor += brainStateColor * activation * 2.0;
    
    // Pulso temporal
    finalColor += sin(uTime * 3.0) * 0.1 * activation;
    
    // Brillo cuántico cuando hay caos (partículas "chispeando")
    float sparkle = step(0.85, vQuantumNoise) * chaos;
    finalColor += vec3(1.0, 1.0, 1.0) * sparkle * 0.5;
    
    // Glow adicional cuando coherencia es alta (estado definido)
    finalColor += unifiedColor * coherence * 0.2 * activation;

    gl_FragColor = vec4(finalColor, 0.95);
  }
`

// Definición del Material
const SyntergicMaterial = shaderMaterial(
    {
        uTime: 0,
        uColor: new THREE.Color('#ffb700'),
        uHover: new THREE.Vector3(0, 0, 0),
        uHoverIntensity: 0,
        uWireframe: false
    },
    syntergicVertexShader,
    syntergicFragmentShader
)

// Extendemos Three.js para que React reconozca <syntergicMaterial>
extend({ SyntergicMaterial })

export { SyntergicMaterial }
