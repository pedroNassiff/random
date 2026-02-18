import React, { useRef, useMemo, memo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import './BrainMaterial'

/**
 * BrainModel - Versión optimizada para rendimiento
 * 
 * Optimizaciones:
 * - Material memoizado y reutilizado
 * - Clonación eficiente del modelo
 * - useFrame con early return si no visible
 * - Lerp solo cuando hay cambios
 */
const BrainModel = memo(function BrainModel({ 
  scale = 1, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  autoRotate = true,
  wireframe = false,
  opacity = 1,
  hovered = false,
  isVisible = true,
  onClick
}) {
  const { scene } = useGLTF('/models/brain/scene.gltf')
  const groupRef = useRef()
  const materialRef = useRef()
  const wireframeMaterialRef = useRef(new THREE.MeshBasicMaterial({ color: '#00E5FF', wireframe: true, transparent: true, opacity: 0.55 }))
  const rotationRef = useRef(0)
  const lastHoveredRef = useRef(hovered)

  // Clonar modelo UNA sola vez
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((child) => {
      if (child.isMesh) {
        child.geometry = child.geometry.clone()
        child.frustumCulled = false // Evitar cálculos de culling innecesarios
      }
    })
    return clone
  }, [scene])

  // Configurar material inicial
  useMemo(() => {
    if (materialRef.current) {
      materialRef.current.transparent = true
      materialRef.current.side = THREE.DoubleSide
      materialRef.current.depthWrite = false
      materialRef.current.blending = THREE.AdditiveBlending
    }
  }, [])

  // Animation loop optimizado
  useFrame((state, delta) => {
    // Early return si no está visible
    if (!isVisible || !groupRef.current) return
    
    // Update time del shader (siempre necesario para animación)
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      
      // Solo actualizar opacity si cambió
      if (materialRef.current.uniforms.uOpacity.value !== opacity) {
        materialRef.current.uniforms.uOpacity.value = opacity
      }
      
      // Aplicar material solo si no está aplicado
      if (!clonedScene.userData.materialApplied) {
        clonedScene.traverse((child) => {
          if (child.isMesh) {
            child.material = wireframe ? wireframeMaterialRef.current : materialRef.current
          }
        })
        clonedScene.userData.materialApplied = true
      }
    }

    // Rotación - usar ref para evitar re-renders
    if (autoRotate) {
      const speed = hovered ? 0.8 : 0.3
      rotationRef.current += delta * speed
      groupRef.current.rotation.y = rotationRef.current
    }

    // Solo actualizar posición/escala si es necesario (primera vez)
    if (!groupRef.current.userData.initialized) {
      groupRef.current.position.set(...position)
      groupRef.current.scale.set(scale, scale, scale)
      groupRef.current.userData.initialized = true
    }
    
    lastHoveredRef.current = hovered
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      <primitive object={clonedScene} />
      <brainMaterial ref={materialRef} />
    </group>
  )
})

useGLTF.preload('/models/brain/scene.gltf')

export { BrainModel }
export default BrainModel
