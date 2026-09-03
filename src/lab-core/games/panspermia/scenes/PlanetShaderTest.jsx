/**
 * PANSPERMIA — escena de test (Fase 1)
 *
 * Cicla los 7 planetas del planet bible cada pocos segundos para validar
 * cada preset de bioma de un vistazo. Sólo para dev — no forma parte del
 * loop de juego real.
 */
import React, { useState, useEffect } from 'react'
import { Text } from '@react-three/drei'
import Planet from '../planets/Planet'
import { PLANETS, PLANET_IDS } from '../planets/planetBible'

const CYCLE_SECONDS = 5

export default function PlanetShaderTest() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % PLANET_IDS.length), CYCLE_SECONDS * 1000)
    return () => clearInterval(t)
  }, [])

  const planetId = PLANET_IDS[index]
  const planet = PLANETS[planetId]

  return (
    <group>
      <Planet key={planetId} biome={planet.biome} radius={1} />

      <Text position={[0, 1.6, 0]} fontSize={0.13} color="#ffffff" anchorX="center" anchorY="middle">
        {`${planet.realName} · ${planet.biome}`}
      </Text>
      <Text position={[0, -1.6, 0]} fontSize={0.075} color="#70c1ff" anchorX="center" anchorY="middle" maxWidth={2.4}>
        {planet.fact}
      </Text>
    </group>
  )
}
