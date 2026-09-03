/**
 * PANSPERMIA — escena GALAXY TRAVEL
 *
 * Placeholder de Fase 0: reusa GalaxyModel tal cual como mapa de fondo.
 * Fase 4 agrega planetas seleccionables (brillan según nivel de
 * reencarnación) y el FlightController.
 */
import React from 'react'
import { Text } from '@react-three/drei'
import GalaxyModel from '../../../galaxy/GalaxyModel'

export default function GalaxyTravel() {
  return (
    <group>
      <GalaxyModel scale={1.4} position={[0, -0.5, 0]} autoRotate opacity={1} />
      <Text position={[0, 1.6, 0]} fontSize={0.14} color="#ffffff" anchorX="center" anchorY="middle">
        GALAXY TRAVEL
      </Text>
    </group>
  )
}
