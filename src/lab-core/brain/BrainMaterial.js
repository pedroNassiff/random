import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * BrainMaterial - Versión simplificada del shader sintérgico
 * 
 * Efectos:
 * - Wireframe con glow
 * - Fresnel en bordes
 * - Pulso sutil de "vida"
 * - Color holográfico cyan/magenta
 */

const brainVertexShader = `
  uniform float uTime;
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    vPosition = position;
    vNormal = normal;
    vUv = uv;
    
    // Subtle breathing effect
    float pulse = sin(uTime * 0.5) * 0.02;
    vec3 pos = position + normal * pulse;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const brainFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    // Fresnel effect - bordes brillantes
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDirection, normalize(vNormal))), 2.5);
    
    // Hemispheric color shift
    float hemisphere = vPosition.z * 0.5 + 0.5;
    vec3 leftColor = vec3(0.0, 0.9, 1.0);   // Cyan
    vec3 rightColor = vec3(0.8, 0.2, 1.0);  // Magenta
    vec3 baseColor = mix(leftColor, rightColor, hemisphere);
    
    // Pulse glow
    float pulse = sin(uTime * 2.0) * 0.15 + 0.85;
    
    // Scanlines subtle
    float scanline = sin(vPosition.y * 50.0 + uTime * 3.0) * 0.05 + 0.95;
    
    // Combine
    vec3 finalColor = baseColor * pulse * scanline;
    finalColor += vec3(1.0) * fresnel * 0.6;
    
    // Edge glow
    float edgeGlow = fresnel * 0.8;
    
    gl_FragColor = vec4(finalColor, (0.3 + edgeGlow) * uOpacity);
  }
`

const BrainMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(0.0, 0.9, 1.0),
    uOpacity: 1.0
  },
  brainVertexShader,
  brainFragmentShader
)

// Extend para usar en JSX
extend({ BrainMaterial })

export { BrainMaterial }
