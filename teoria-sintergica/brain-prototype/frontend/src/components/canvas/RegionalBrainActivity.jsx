import React, { useRef, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useBrainStore } from '../../store/brainStore'

/**
 * Cerebro con iluminación por regiones según bandas de frecuencia
 * Usa shader personalizado para colorear regiones específicas
 */

export function RegionalBrainActivity(props) {
  const { scene } = useGLTF('/models/brain/scene.gltf')
  const group = useRef()
  const meshRef = useRef()
  
  // Colores por banda
  const bandColors = useMemo(() => ({
    delta: new THREE.Color('#8b5cf6'),  // Purple - Centro
    theta: new THREE.Color('#3b82f6'),  // Blue - Temporal
    alpha: new THREE.Color('#10b981'),  // Green - Occipital
    beta: new THREE.Color('#f59e0b'),   // Orange - Frontal
    gamma: new THREE.Color('#ef4444')   // Red - Prefrontal
  }), [])
  
  // Material con shader personalizado
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeltaIntensity: { value: 0.2 },
        uThetaIntensity: { value: 0.2 },
        uAlphaIntensity: { value: 0.2 },
        uBetaIntensity: { value: 0.2 },
        uGammaIntensity: { value: 0.2 },
        uCoherence: { value: 0 },
        
        uDeltaColor: { value: bandColors.delta },
        uThetaColor: { value: bandColors.theta },
        uAlphaColor: { value: bandColors.alpha },
        uBetaColor: { value: bandColors.beta },
        uGammaColor: { value: bandColors.gamma }
      },
      
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      
      fragmentShader: `
        uniform float uTime;
        uniform float uDeltaIntensity;
        uniform float uThetaIntensity;
        uniform float uAlphaIntensity;
        uniform float uBetaIntensity;
        uniform float uGammaIntensity;
        uniform float uCoherence;
        
        uniform vec3 uDeltaColor;
        uniform vec3 uThetaColor;
        uniform vec3 uAlphaColor;
        uniform vec3 uBetaColor;
        uniform vec3 uGammaColor;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          // Normalizar posición local
          vec3 normalizedPos = normalize(vPosition);
          
          // FRONTAL (Beta) - adelante (z positivo)
          float frontalInfluence = smoothstep(-0.2, 1.0, normalizedPos.z) * 
                                   smoothstep(-0.3, 0.5, normalizedPos.y);
          
          // PREFRONTAL (Gamma) - muy adelante y arriba
          float prefrontalInfluence = smoothstep(0.3, 1.0, normalizedPos.z) * 
                                      smoothstep(0.2, 1.0, normalizedPos.y);
          
          // OCCIPITAL (Alpha) - atrás (z negativo)
          float occipitalInfluence = smoothstep(0.2, -1.0, normalizedPos.z) * 
                                     smoothstep(-0.5, 0.5, normalizedPos.y);
          
          // TEMPORAL (Theta) - lados (x alto)
          float temporalInfluence = smoothstep(0.2, 1.0, abs(normalizedPos.x)) * 
                                    smoothstep(0.5, -0.5, abs(normalizedPos.y));
          
          // CENTRAL (Delta) - centro
          float centralInfluence = 1.0 - smoothstep(0.0, 0.8, length(normalizedPos));
          
          // Color base oscuro
          vec3 baseColor = vec3(0.05, 0.05, 0.08);
          
          // Acumular colores
          vec3 finalColor = baseColor;
          finalColor += uDeltaColor * uDeltaIntensity * centralInfluence * 3.0;
          finalColor += uThetaColor * uThetaIntensity * temporalInfluence * 3.0;
          finalColor += uAlphaColor * uAlphaIntensity * occipitalInfluence * 3.0;
          finalColor += uBetaColor * uBetaIntensity * frontalInfluence * 3.0;
          finalColor += uGammaColor * uGammaIntensity * prefrontalInfluence * 4.0;
          
          // Brillo por coherencia
          finalColor += finalColor * uCoherence * 0.8;
          
          // Pulsación
          float pulse = sin(uTime * 1.5) * 0.05 + 1.0;
          finalColor *= pulse;
          
          // Lighting
          vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
          float lighting = dot(vNormal, lightDir) * 0.4 + 0.6;
          finalColor *= lighting;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      
      wireframe: true,
      side: THREE.DoubleSide
    })
  }, [bandColors])
  
  // Aplicar material al modelo
  useMemo(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.material = material
        meshRef.current = child
      }
    })
  }, [scene, material])
  
  useFrame((state, delta) => {
    // Rotación suave
    if (group.current) {
      group.current.rotation.y += delta * 0.05
    }
    
    // Obtener datos del store
    const { bands, coherence } = useBrainStore.getState()
    
    if (material.uniforms) {
      // Actualizar tiempo
      material.uniforms.uTime.value += delta
      
      // Actualizar intensidades con interpolación suave
      material.uniforms.uDeltaIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uDeltaIntensity.value,
        bands.delta,
        0.1
      )
      
      material.uniforms.uThetaIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uThetaIntensity.value,
        bands.theta,
        0.1
      )
      
      material.uniforms.uAlphaIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uAlphaIntensity.value,
        bands.alpha,
        0.1
      )
      
      material.uniforms.uBetaIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uBetaIntensity.value,
        bands.beta,
        0.1
      )
      
      material.uniforms.uGammaIntensity.value = THREE.MathUtils.lerp(
        material.uniforms.uGammaIntensity.value,
        bands.gamma,
        0.1
      )
      
      material.uniforms.uCoherence.value = THREE.MathUtils.lerp(
        material.uniforms.uCoherence.value,
        coherence,
        0.05
      )
    }
  })
  
  return (
    <group ref={group} {...props} dispose={null}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload('/models/brain/scene.gltf')
