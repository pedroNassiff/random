/**
 * PANSPERMIA — escena PLANET SURFACE
 *
 * Fase 2: aterrizás sobre el PlanetShaderMaterial real, caminás con el
 * Avatar/SurfaceController, y hay una misión mínima — encontrar el
 * fragmento de conocimiento del planeta (el `knowledgeFragment` del planet
 * bible). Fase 3 suma poderes/combate sobre esta misma base.
 */
import React, { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useGameStore } from '../../../engine/GameStore'
import Planet from '../planets/Planet'
import Avatar from '../character/Avatar'
import { getPlanet } from '../planets/planetBible'

const DEFAULT_PLANET_ID = 'trappist-1e'
const PLANET_RADIUS = 1
const SURFACE_OFFSET = 0.04 // separa al avatar de la superficie para que no quede embebido
const PICKUP_DISTANCE = 0.22

function KnowledgeOrb({ position }) {
  const ref = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y = t * 1.2
    ref.current.scale.setScalar(1 + Math.sin(t * 3) * 0.15)
  })
  return (
    <mesh ref={ref} position={position}>
      <octahedronGeometry args={[0.08, 0]} />
      <meshStandardMaterial color="#ffd76a" emissive="#ffd76a" emissiveIntensity={2} />
    </mesh>
  )
}

export default function PlanetSurface() {
  const activePlanetId = useGameStore((s) => s.activePlanetId)
  const addKnowledge = useGameStore((s) => s.addKnowledge)
  const knowledge = useGameStore((s) => s.knowledge)

  const planetId = activePlanetId ?? DEFAULT_PLANET_ID
  const planet = getPlanet(planetId)

  const surfaceRadius = PLANET_RADIUS + SURFACE_OFFSET
  const fragmentPosition = useMemo(
    () => new THREE.Vector3(0.5, 0.6, 0.7).normalize().multiplyScalar(surfaceRadius),
    [surfaceRadius]
  )

  const alreadyKnown = planet && knowledge.includes(planet.knowledgeFragment)
  const [collected, setCollected] = useState(false)
  const avatarPos = useRef(new THREE.Vector3())

  useFrame(() => {
    if (collected || alreadyKnown || !planet) return
    if (avatarPos.current.distanceTo(fragmentPosition) < PICKUP_DISTANCE) {
      setCollected(true)
      addKnowledge(planet.knowledgeFragment)
    }
  })

  const showOrb = planet && !collected && !alreadyKnown

  return (
    <group>
      <Planet biome={planet?.biome ?? 'terra'} radius={PLANET_RADIUS} />

      <Avatar
        radius={surfaceRadius}
        initialPosition={new THREE.Vector3(0, 0, 1)}
        onUpdate={(p) => avatarPos.current.copy(p)}
      />

      {showOrb && <KnowledgeOrb position={fragmentPosition} />}

      <Text position={[0, 1.3, 0]} fontSize={0.11} color="#ffffff" anchorX="center" anchorY="middle">
        {planet?.realName ?? planetId}
      </Text>
      <Text position={[0, -1.3, 0]} fontSize={0.07} color="#70c1ff" anchorX="center" anchorY="middle" maxWidth={2.2}>
        {collected ? `+ conocimiento: ${planet.knowledgeFragment}` : (planet?.fact ?? 'sin planeta asignado')}
      </Text>
    </group>
  )
}
