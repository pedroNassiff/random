import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

// Vertex Shader
const syntergicVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Fragment Shader
const syntergicFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uHover;
  uniform float uHoverIntensity;

  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    // Base color (algo oscuro/misterioso)
    vec3 baseColor = vec3(0.1, 0.1, 0.15);

    // Simular "Field" activation basado en distancia al punto de estímulo (uHover)
    float dist = distance(vPosition, uHover);
    
    // Radio de efecto
    float radius = 45.0; 
    
    // Crear un "glow" suave donde está el estímulo
    float glow = 1.0 - smoothstep(0.0, radius, dist);
    glow = clamp(glow, 0.0, 1.0);
    
    // Mezclar color base con el color de activación según intensidad
    vec3 finalColor = mix(baseColor, uColor, glow * uHoverIntensity);

    // Añadir un pulso global (Sintergia)
    float pulse = sin(uTime * 2.0) * 0.05;
    finalColor += pulse;

    gl_FragColor = vec4(finalColor, 0.9);
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
