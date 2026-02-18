import React, { useRef, useMemo, memo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import './PatternMaterial'

/**
 * RetratatarteModel - Versión optimizada
 * 
 * Optimizaciones:
 * - Geometría y textura completamente memoizadas
 * - Material uniforms actualizados selectivamente
 * - Early return cuando no visible
 */
const RetratatarteModel = memo(function RetratatarteModel({ 
  scale = 1, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  autoRotate = false,
  opacity = 1,
  hovered = false,
  isVisible = true,
  onClick
}) {
  const meshRef = useRef()
  const materialRef = useRef()
  const hoverValueRef = useRef(0)

  // Cargar textura una sola vez
  const texture = useLoader(THREE.TextureLoader, '/lavaca.png')
  
  // Configurar textura - solo una vez
  useMemo(() => {
    if (texture) {
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false // Mejor rendimiento
    }
  }, [texture])

  // Geometría memoizada
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 2, 32, 32) // Reducido de 64 a 32
    return geo
  }, [])

  // Resolución memoizada
  const resolution = useMemo(() => {
    return new THREE.Vector2(window.innerWidth, window.innerHeight)
  }, [])

  // Animation loop optimizado
  useFrame((state, delta) => {
    if (!isVisible || !meshRef.current || !materialRef.current) return
    
    const mat = materialRef.current
    
    // Update time
    mat.uniforms.uTime.value = state.clock.elapsedTime
    
    // Lerp hover solo si hay diferencia significativa
    const targetHover = hovered ? 1.0 : 0.0
    if (Math.abs(hoverValueRef.current - targetHover) > 0.01) {
      hoverValueRef.current = THREE.MathUtils.lerp(hoverValueRef.current, targetHover, 0.1)
      mat.uniforms.uHover.value = hoverValueRef.current
    }
    
    // Configurar material solo primera vez
    if (!mat.userData.configured) {
      mat.transparent = true
      mat.side = THREE.DoubleSide
      mat.depthWrite = false
      mat.userData.configured = true
    }
    
    // Rotación sutil
    if (autoRotate) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
    }
    
    // Transforms solo primera vez
    if (!meshRef.current.userData.initialized) {
      meshRef.current.position.set(...position)
      meshRef.current.scale.set(scale, scale, scale)
      meshRef.current.userData.initialized = true
    }
  })

  return (
    <mesh 
      ref={meshRef}
      geometry={geometry}
      onClick={onClick}
    >
      <patternMaterial 
        ref={materialRef}
        uTexture={texture}
        uResolution={resolution}
      />
    </mesh>
  )
})

export { RetratatarteModel }
export default RetratatarteModel
