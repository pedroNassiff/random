// PatternMaterial - Shader simplificado de patterns para el Lab
// Basado en los patterns de Retratarte pero sin dependencias de audio/face tracking

import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

const patternVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
    
    vUv = uv;
    vPosition = modelPosition.xyz;
  }
`

const patternFragmentShader = `
  uniform float uTime;
  uniform sampler2D uTexture;
  uniform float uPattern;
  uniform vec2 uResolution;
  uniform float uHover;

  varying vec2 vUv;
  varying vec3 vPosition;

  #define PI 3.14159265359
  #define TAU 6.28318530718

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  vec2 random2(vec2 st) {
    st = vec2(dot(st, vec2(127.1, 311.7)),
              dot(st, vec2(269.5, 183.3)));
    return fract(sin(st) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
  }

  // Pattern 0: Voronoi cells
  vec3 patternVoronoi(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    
    float scale = 4.0 + uHover * 2.0;
    st *= scale;
    
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);
    
    float m_dist = 1.0;
    vec2 m_point = vec2(0.0);
    
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = random2(i_st + neighbor);
        point = 0.5 + 0.4 * sin(uTime * 0.5 + TAU * point);
        
        vec2 diff = neighbor + point - f_st;
        float dist = length(diff);
        
        if (dist < m_dist) {
          m_dist = dist;
          m_point = point;
        }
      }
    }
    
    vec3 cellColor = vec3(
      0.5 + 0.5 * sin(m_point.x * 10.0 + uTime),
      0.5 + 0.5 * sin(m_point.y * 10.0 + uTime + 2.0),
      0.5 + 0.5 * sin((m_point.x + m_point.y) * 5.0 + uTime + 4.0)
    );
    
    float edge = smoothstep(0.0, 0.05, m_dist);
    vec3 edgeColor = vec3(0.1, 0.1, 0.2);
    
    return mix(edgeColor, cellColor, edge) * alpha;
  }

  // Pattern 1: Fibonacci spiral
  vec3 patternFibonacci(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    
    float pattern = 0.0;
    float lineWidth = 0.015;
    float phi = 1.618033988749;
    
    float angle = atan(st.y, st.x);
    float radius = length(st);
    
    for (float arm = 0.0; arm < 2.0; arm++) {
      float armOffset = arm * PI;
      
      for (float wrap = -3.0; wrap <= 3.0; wrap++) {
        float wrappedAngle = angle + armOffset + uTime * 0.2 + wrap * TAU;
        float wrappedRadius = 0.05 * exp(0.3063 * wrappedAngle);
        
        if (wrappedRadius > 0.01 && wrappedRadius < 1.2) {
          float diff = abs(radius - wrappedRadius);
          pattern += smoothstep(lineWidth, 0.0, diff) * 0.5;
        }
      }
    }
    
    // Fibonacci points
    for (int i = 0; i < 10; i++) {
      float fibAngle = float(i) * phi * TAU + uTime * 0.1;
      float fibRadius = sqrt(float(i + 1)) * 0.1;
      
      vec2 fibPos = vec2(cos(fibAngle), sin(fibAngle)) * fibRadius;
      float fibDist = length(st - fibPos);
      pattern += smoothstep(0.025, 0.0, fibDist) * 0.8;
    }
    
    vec3 color1 = vec3(1.0, 0.8, 0.2);
    vec3 color2 = vec3(0.6, 0.4, 0.2);
    
    float colorPhase = angle / TAU + radius + uTime * 0.1;
    vec3 baseColor = mix(color1, color2, sin(colorPhase * 3.0) * 0.5 + 0.5);
    
    return baseColor * pattern * alpha;
  }

  // Pattern 2: Torus energy field
  vec3 patternTorus(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    
    float pattern = 0.0;
    float R = 0.5 + uHover * 0.1;
    float r = 0.2;
    
    float rotX = uTime * 0.4;
    float rotY = uTime * 0.3;
    
    float flowLines = 15.0;
    
    for (float i = 0.0; i < flowLines; i++) {
      float theta = i / flowLines * TAU;
      
      for (float t = 0.0; t < 1.0; t += 0.03) {
        float phi = t * TAU + uTime * 0.5;
        
        float x = (R + r * cos(phi)) * cos(theta);
        float y = (R + r * cos(phi)) * sin(theta);
        float z = r * sin(phi);
        
        float x2 = x * cos(rotY) - z * sin(rotY);
        float z2 = x * sin(rotY) + z * cos(rotY);
        float y2 = y * cos(rotX) - z2 * sin(rotX);
        
        vec2 proj = vec2(x2, y2);
        
        float d = length(st - proj);
        float pointSize = 0.02 + (z2 + r) / (2.0 * r) * 0.02;
        pattern += smoothstep(pointSize, 0.0, d) * 0.1;
      }
    }
    
    // Energy rings
    for (float i = 1.0; i <= 3.0; i++) {
      float ringR = i * 0.2;
      float wave = sin(length(st) * 8.0 - uTime * 2.0 - i) * 0.02;
      pattern += smoothstep(0.02, 0.0, abs(length(st) - ringR + wave)) * (0.3 / i);
    }
    
    vec3 innerColor = vec3(1.0, 0.3, 0.5);
    vec3 outerColor = vec3(0.3, 0.5, 1.0);
    
    float distFromCenter = length(st);
    vec3 baseColor = mix(innerColor, outerColor, smoothstep(0.0, 0.8, distFromCenter));
    
    return baseColor * pattern * alpha;
  }

  // Pattern 3: Flow field
  vec3 patternFlow(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    
    vec3 color = vec3(0.0);
    
    for (float layer = 0.0; layer < 3.0; layer++) {
      vec2 pos = st * (3.0 + layer * 1.5);
      
      float n1 = noise(pos + uTime * 0.1);
      float n2 = noise(pos * 2.0 + uTime * 0.15);
      
      vec2 flow = vec2(n1 - 0.5, n2 - 0.5) * 5.0;
      
      vec2 p = fract(st * (5.0 + layer * 2.0) + flow * 0.1 + uTime * 0.05);
      float particle = smoothstep(0.3, 0.0, length(p - 0.5));
      
      vec3 layerColor;
      if (layer < 1.0) {
        layerColor = vec3(0.2, 0.5, 1.0);
      } else if (layer < 2.0) {
        layerColor = vec3(0.8, 0.2, 0.5);
      } else {
        layerColor = vec3(0.2, 0.8, 0.5);
      }
      
      color += layerColor * particle * (0.5 / (layer + 1.0));
    }
    
    float vignette = 1.0 - smoothstep(0.5, 1.5, length(st));
    
    return color * vignette * alpha;
  }

  void main() {
    vec4 textureColor = texture2D(uTexture, vUv);
    float alpha = textureColor.a;
    
    if(alpha < 0.01) {
      discard;
    }
    
    vec3 patternColor = vec3(0.0);
    
    // Cycle through patterns based on time
    float patternCycle = mod(uTime * 0.1, 4.0);
    int pattern = int(floor(patternCycle));
    float blend = fract(patternCycle);
    
    // Get current and next pattern
    vec3 current, next;
    
    if(pattern == 0) {
      current = patternVoronoi(vUv, alpha);
      next = patternFibonacci(vUv, alpha);
    } else if(pattern == 1) {
      current = patternFibonacci(vUv, alpha);
      next = patternTorus(vUv, alpha);
    } else if(pattern == 2) {
      current = patternTorus(vUv, alpha);
      next = patternFlow(vUv, alpha);
    } else {
      current = patternFlow(vUv, alpha);
      next = patternVoronoi(vUv, alpha);
    }
    
    // Smooth transition between patterns
    float smoothBlend = smoothstep(0.8, 1.0, blend);
    patternColor = mix(current, next, smoothBlend);
    
    gl_FragColor = vec4(patternColor, alpha);
  }
`

const PatternMaterial = shaderMaterial(
  {
    uTime: 0,
    uTexture: null,
    uPattern: 0,
    uResolution: new THREE.Vector2(1, 1),
    uHover: 0
  },
  patternVertexShader,
  patternFragmentShader
)

extend({ PatternMaterial })

export { PatternMaterial }
