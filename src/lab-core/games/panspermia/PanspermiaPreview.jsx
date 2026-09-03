/**
 * PANSPERMIA — thumbnail preview para el grid del Lab
 *
 * Placeholder liviano: una chispa holográfica pulsante (no carga el .glb
 * del avatar ni el planet shader — eso es para la escena real).
 */
import React, { useRef, memo } from 'react'
import { useFrame } from '@react-three/fiber'

const PanspermiaPreview = memo(function PanspermiaPreview({
  scale = 1,
  position = [0, 0, 0],
  autoRotate = true,
  opacity = 1,
  isVisible = true,
}) {
  const groupRef = useRef()
  const coreRef = useRef()

  useFrame((state) => {
    if (!isVisible) return
    const t = state.clock.elapsedTime
    if (groupRef.current && autoRotate) groupRef.current.rotation.y = t * 0.4
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.2) * 0.12
      coreRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.5, 2]} />
        <meshStandardMaterial
          color="#70c1ff"
          emissive="#70c1ff"
          emissiveIntensity={1.4}
          transparent
          opacity={opacity}
          wireframe
        />
      </mesh>
    </group>
  )
})

export default PanspermiaPreview
