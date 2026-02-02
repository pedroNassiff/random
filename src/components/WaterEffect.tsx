import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WaterDropEffectProps {
  scale?: number;
  position?: [number, number, number];
  opacity?: number;
}

export const WaterEffect = ({ 
  scale = 1, 
  position = [-10, 0, 0],
  opacity = 1.0
}: WaterDropEffectProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [dropTime] = useState(0.5); // Momento cuando cae la gota (después de 0.5s)
  const hasDroppedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);

  // Shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDropTime: { value: -100 }, // Inicialmente sin gota
        uColor: { value: new THREE.Color('#505050') }, // Gris medio
        uOpacity: { value: 1.0 }, // Opacidad global para transiciones
      },
      vertexShader: `
        uniform float uTime;
        uniform float uDropTime;
        
        varying vec2 vUv;
        varying float vElevation;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          float elevation = 0.0;
          
          // Calcular tiempo desde la gota
          float timeSinceDrop = uTime - uDropTime;
          
          // Congelar el tiempo de animación a 8.0s para mantener el estado final
          float animTime = min(timeSinceDrop, 8.0);
          
          // Si la gota ha caído
          if(timeSinceDrop >= 0.0) {
            // Distancia desde el centro (0, 0)
            float dist = length(pos.xy);
            
            // Onda que se expande lentamente desde el centro
            // Reducir frecuencia para ondas más suaves y lentas
            float wave = sin(dist * 3.0 - animTime * 2.0) * 0.15;
            
            // Atenuación muy gradual con la distancia para cubrir todo el área
            float attenuation = 1.0 - smoothstep(0.0, 6.0, dist);
            
            // Atenuación muy lenta con el tiempo - congelada en 8s
            float timeAttenuation = 1.0 - smoothstep(0.0, 8.0, animTime);
            
            elevation = wave * attenuation * timeAttenuation;
          }
          
          pos.z += elevation;
          vElevation = elevation;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uDropTime;
        uniform float uOpacity;
        
        varying vec2 vUv;
        varying float vElevation;
        
        void main() {
          float timeSinceDrop = uTime - uDropTime;
          
          // Color base gris solo en las ondas
          vec3 color = uColor;
          
          // Añadir brillo en las crestas de las ondas
          float brightness = 1.0 + vElevation * 4.0;
          color *= brightness;
          
          // Añadir algo de reflejo
          float fresnel = pow(1.0 - abs(vElevation), 2.0);
          color += vec3(fresnel * 0.3);
          
          // Transparencia basada en la elevación y tiempo
          float alpha = abs(vElevation) * 8.0;
          
          // Si la gota no ha caído, completamente transparente
          if(timeSinceDrop < 0.0) {
            alpha = 0.0;
          } else if(timeSinceDrop < 8.0) {
            // Durante los primeros 8s: reveal progresivo desde el centro
            float distanceFromCenter = length(vUv - 0.5) * 50.0;
            float expansionRadius = timeSinceDrop * 2.0;
            float revealFade = smoothstep(expansionRadius + 1.0, expansionRadius - 0.5, distanceFromCenter);
            alpha *= revealFade;
          }
          // Después de 8s: mostrar todo uniformemente, solo uOpacity controla el fade
          
          // Aplicar opacidad global (para transiciones entre efectos)
          alpha *= uOpacity;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // Animación
  useFrame((state) => {
    if (!meshRef.current) return;

    // Capturar tiempo de inicio en el primer frame
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    // Usar tiempo relativo desde el montaje del componente
    const time = state.clock.elapsedTime - startTimeRef.current;
    shaderMaterial.uniforms.uTime.value = time;
    shaderMaterial.uniforms.uOpacity.value = opacity;

    // Activar la gota una sola vez después de 0.5s
    if (time > dropTime && !hasDroppedRef.current) {
      shaderMaterial.uniforms.uDropTime.value = time;
      hasDroppedRef.current = true;
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      position={position} 
      scale={scale}
      material={shaderMaterial}
    >
      <planeGeometry args={[50, 50, 256, 256]} />
    </mesh>
  );
};