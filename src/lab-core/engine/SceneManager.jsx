/**
 * lab-core/engine — SceneManager
 *
 * Cambia entre escenas de juego (Nexus / GalaxyTravel / PlanetSurface, ...)
 * leyendo `currentScene` del GameStore, con un fundido a negro simple entre
 * medio. Vive dentro del <Canvas>: el "velo" es un plano bloqueado a cámara,
 * no un overlay DOM.
 */
import React, { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from './GameStore'

const FADE_DURATION = 0.4 // segundos, por tramo (out o in)

export default function SceneManager({ scenes, sceneProps = {} }) {
  const currentScene = useGameStore((s) => s.currentScene)
  const [displayedScene, setDisplayedScene] = useState(currentScene)
  const fade = useRef(0) // 0 = despejado, 1 = tapado
  const phase = useRef('idle') // 'idle' | 'out' | 'in'
  const planeRef = useRef()

  useEffect(() => {
    if (currentScene !== displayedScene) phase.current = 'out'
  }, [currentScene, displayedScene])

  useFrame((state, delta) => {
    if (phase.current === 'out') {
      fade.current = Math.min(1, fade.current + delta / FADE_DURATION)
      if (fade.current >= 1) {
        setDisplayedScene(currentScene)
        phase.current = 'in'
      }
    } else if (phase.current === 'in') {
      fade.current = Math.max(0, fade.current - delta / FADE_DURATION)
      if (fade.current <= 0) phase.current = 'idle'
    }

    if (planeRef.current) {
      planeRef.current.material.opacity = fade.current
      planeRef.current.visible = fade.current > 0.001
      planeRef.current.position.copy(state.camera.position)
      planeRef.current.quaternion.copy(state.camera.quaternion)
      planeRef.current.translateZ(-0.15)
    }
  })

  const ActiveScene = scenes[displayedScene]

  return (
    <>
      {ActiveScene && <ActiveScene {...sceneProps} />}
      <mesh ref={planeRef} renderOrder={999} visible={false}>
        <planeGeometry args={[4, 4]} />
        <meshBasicMaterial color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
    </>
  )
}
