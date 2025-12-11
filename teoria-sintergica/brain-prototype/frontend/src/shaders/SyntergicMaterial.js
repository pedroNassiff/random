import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

// Vertex Shader
const syntergicVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  uniform float uTime;
  uniform vec3 uHover;
  uniform float uHoverIntensity; // Mapeado a Coherencia (1.0 = Alta, 0.0 = Baja)

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    // --- LATTICE DISTORTION (Vertex Displacement) ---
    // La presencia de la conciencia (uHover) distorsiona físicamente la Lattice
    float dist = distance(position, uHover);
    float regionRadius = 6.0;
    
    // Fuerza de distorsión
    float distortion = 1.0 - smoothstep(0.0, regionRadius, dist);
    distortion = pow(distortion, 2.0); // Caída cuadrática
    
    // Dirección del desplazamiento: "Inflar" hacia afuera en la normal
    // MUY SUTIL: 0.05 para que no "rompa" el modelo
    vec3 newPos = position + (normal * distortion * 0.05 * sin(uTime * 5.0));
    
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

  void main() {
    // --- 1. LATTICE GRID (La Estructura) ---
    // Patrón de rejilla sutil siempre presente
    float gridScale = 20.0;
    float gridX = step(0.98, fract(vPosition.x * gridScale));
    float gridY = step(0.98, fract(vPosition.y * gridScale));
    float gridZ = step(0.98, fract(vPosition.z * gridScale));
    float isGrid = max(gridX, max(gridY, gridZ));
    
    vec3 latticeColor = vec3(0.1, 0.1, 0.2); // Azul oscuro cuántico
    
    // --- 2. HEMISPHERIC COHERENCE (Sintergia) ---
    // Coherencia 0.0 -> Hemisferios separados (Cyan vs Magenta)
    // Coherencia 1.0 -> Hemisferios unificados (Gold/White)
    
    vec3 leftHemiColor = vec3(0.0, 1.0, 1.0); // Cyan (Lógica/Lenguaje)
    vec3 rightHemiColor = vec3(1.0, 0.0, 1.0); // Magenta (Intuición/Espacial)
    vec3 unifiedColor = vec3(1.0, 0.9, 0.5); // Gold (Iluminación)
    
    // Determinar hemisferio -> CAMBIO A EJE Z (Si X era Front/Back)
    // Probamos con Z para lograr división Izq/Der anatómica
    float hemiMix = step(0.0, vPosition.z); 
    vec3 rawHemiColor = mix(leftHemiColor, rightHemiColor, hemiMix);
    
    // Mezclar basado en Coherencia Real (uHoverIntensity normalizada aprox)
    // Asumimos uHoverIntensity viene ~ 1.0 base + boost. 
    // Normalizamos para color:
    float coherenceFactor = clamp((uHoverIntensity - 1.0) / 3.0, 0.0, 1.0);
    
    // Color base del tejido
    vec3 brainStateColor = mix(rawHemiColor, unifiedColor, coherenceFactor);
    
    // --- 3. DIRECTIONALITY FACTOR (Focal Point) ---
    float dist = distance(vPosition, uHover);
    float regionRadius = 7.0; 
    float activation = 1.0 - smoothstep(0.0, regionRadius, dist);
    activation = pow(activation, 5.0); // Sharp falloff
    
    // COMPOSICIÓN FINAL
    // Base: Casi negro + Grid sutil
    vec3 finalColor = vec3(0.02) + (latticeColor * isGrid * 0.3);
    
    // Sumar Activación: El color del estado mental SOLO se ve donde hay atención
    finalColor += brainStateColor * activation * 2.0;
    
    // Pulso
    finalColor += sin(uTime * 3.0) * 0.1 * activation;

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
