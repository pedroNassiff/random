import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

// Vertex Shader - VERSIÓN SIMPLIFICADA Y CLARA
const syntergicVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying float vFocalInfluence;
  varying float vHemisphere; // -1 = izquierdo, +1 = derecho
  
  uniform float uTime;
  uniform vec3 uHover;
  uniform float uHoverIntensity; // Coherencia (1.0-4.0)

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    // Determinar hemisferio (basado en coordenada Z)
    vHemisphere = sign(position.z);
    
    // --- COHERENCIA ---
    float coherence = clamp((uHoverIntensity - 1.0) / 3.0, 0.0, 1.0);
    
    // --- FOCAL POINT (Punto de Atención) ---
    float distToFocal = distance(position, uHover);
    float focalInfluence = smoothstep(2.5, 0.0, distToFocal);
    vFocalInfluence = focalInfluence;
    
    // Desplazamiento SOLO en zona focal, pulsación suave
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    vec3 focalDisplacement = normal * focalInfluence * coherence * pulse * 0.12;
    
    vec3 finalPosition = position + focalDisplacement;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
  }
`

// Fragment Shader - COLORES CLAROS Y CIENTÍFICOS
const syntergicFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uHover;
  uniform float uHoverIntensity;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying float vFocalInfluence;
  varying float vHemisphere;

  void main() {
    // --- COHERENCIA ---
    float coherence = clamp((uHoverIntensity - 1.0) / 3.0, 0.0, 1.0);
    
    // --- COLORES HEMISFÉRICOS ---
    // Izquierdo (Z < 0): Cyan (lógico/verbal)
    // Derecho (Z > 0): Magenta (intuitivo/espacial)
    vec3 leftColor = vec3(0.0, 0.8, 1.0);   // Cyan brillante
    vec3 rightColor = vec3(1.0, 0.2, 0.8);  // Magenta brillante
    
    // Color base según hemisferio
    vec3 hemisphereColor = mix(leftColor, rightColor, (vHemisphere + 1.0) * 0.5);
    
    // --- COLOR DE SINTERGIA (Unificación) ---
    // Dorado cuando coherencia alta (hemisferios unificados)
    vec3 syntergicColor = vec3(1.0, 0.9, 0.4); // Dorado
    
    // Interpolar de hemisférico a sintérgico según coherencia
    vec3 brainColor = mix(hemisphereColor, syntergicColor, coherence * 0.85);
    
    // --- ZONA FOCAL (Punto de Atención) ---
    // Iluminar región focal con blanco/dorado intenso
    vec3 focalGlow = vec3(1.0, 1.0, 0.9) * vFocalInfluence * coherence;
    brainColor += focalGlow * 0.6;
    
    // --- FRESNEL (Bordes brillantes) ---
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 3.0);
    brainColor += vec3(0.3, 0.3, 0.4) * fresnel * 0.4;
    
    // --- GRID SUTIL (Lattice) ---
    // Líneas de retícula muy sutiles
    float gridScale = 25.0;
    float gridX = abs(sin(vPosition.x * gridScale));
    float gridY = abs(sin(vPosition.y * gridScale));
    float gridZ = abs(sin(vPosition.z * gridScale));
    float grid = max(max(gridX, gridY), gridZ);
    float gridLine = step(0.95, grid);
    
    // Grid más visible cuando coherencia baja (estructura expuesta)
    vec3 gridColor = vec3(0.15, 0.15, 0.25) * (1.0 - coherence * 0.5);
    brainColor += gridColor * gridLine * 0.3;
    
    // --- OUTPUT ---
    gl_FragColor = vec4(brainColor, 0.95);
  }
`

const SyntergicMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(0.1, 0.5, 0.9),
    uHover: new THREE.Vector3(0, 0, 0),
    uHoverIntensity: 1.0
  },
  syntergicVertexShader,
  syntergicFragmentShader
)

extend({ SyntergicMaterial })

export { SyntergicMaterial }
