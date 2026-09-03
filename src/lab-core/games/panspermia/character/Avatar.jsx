/**
 * PANSPERMIA — Avatar
 *
 * Envuelve HolographicModel (el "ser holográfico" del Lab) con el
 * SurfaceController: la orientación/posición las decide el controller, acá
 * sólo se monta el modelo y se avisa la posición hacia afuera (onUpdate)
 * para que la escena resuelva misiones/colisiones sin que el Avatar sepa
 * nada de eso.
 */
import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import HolographicModel from '../../../../components/HolographicModel'
import { useSurfaceController } from './SurfaceController'

export default function Avatar({
  radius = 1,
  scale = 0.05,
  initialPosition,
  initialForward,
  onUpdate,
}) {
  const groupRef = useRef()
  const { update } = useSurfaceController({ radius, initialPosition, initialForward })

  useFrame((state, delta) => {
    const { position, quaternion } = update(delta)
    if (groupRef.current) {
      groupRef.current.position.copy(position)
      groupRef.current.quaternion.copy(quaternion)
    }
    onUpdate?.(position)
  })

  return (
    <group ref={groupRef}>
      <HolographicModel scale={scale} position={[0, 0, 0]} autoRotate={false} opacity={0.95} />
    </group>
  )
}
