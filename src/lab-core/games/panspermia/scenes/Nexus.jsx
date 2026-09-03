/**
 * PANSPERMIA — escena NEXUS (hub)
 *
 * Placeholder de Fase 0. Fase 4 la llena de verdad: árbol de poderes,
 * elección de elemento, mapa de mundos desbloqueados.
 */
import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useGameStore } from '../../../engine/GameStore'

export default function Nexus() {
  const orbRef = useRef()
  const reincarnationLevel = useGameStore((s) => s.reincarnationLevel)
  const element = useGameStore((s) => s.element)
  const energy = useGameStore((s) => s.energy)

  useFrame((state) => {
    if (!orbRef.current) return
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 1.5) * 0.08
    orbRef.current.scale.setScalar(pulse)
    orbRef.current.rotation.y = t * 0.3
  })

  return (
    <group>
      <mesh ref={orbRef}>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshStandardMaterial
          color="#70c1ff"
          emissive="#70c1ff"
          emissiveIntensity={1.2}
          wireframe
        />
      </mesh>

      <Text position={[0, 1.1, 0]} fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle">
        NEXUS
      </Text>
      <Text position={[0, -1.1, 0]} fontSize={0.08} color="#70c1ff" anchorX="center" anchorY="middle">
        {`reencarnación ${reincarnationLevel} · elemento ${element ?? '—'} · energía ${energy}`}
      </Text>
    </group>
  )
}
