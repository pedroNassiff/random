/**
 * PANSPERMIA — SurfaceController
 *
 * Controller cinemático propio (sin motor de físicas): mantiene al avatar
 * pegado a la superficie de una esfera, con "gravedad" apuntando siempre al
 * centro del planeta en vez de hacia abajo. WASD/flechas mueven tangente a
 * la superficie; A/D rota el heading alrededor de la normal local.
 *
 * Fase 3 puede migrar esto a Rapier si el combate necesita rigid bodies de
 * verdad; hasta entonces esto alcanza y no suma el peso del WASM.
 */
import { useRef } from 'react'
import * as THREE from 'three'
import { useKeyboardActions } from '../../../engine/InputManager'

const ZERO = new THREE.Vector3(0, 0, 0)
const DEFAULT_SPEED = 0.6
const DEFAULT_TURN_SPEED = 2.4
const BOOST_MULTIPLIER = 1.8

export function useSurfaceController({
  radius = 1,
  speed = DEFAULT_SPEED,
  turnSpeed = DEFAULT_TURN_SPEED,
  initialPosition,
  initialForward,
} = {}) {
  const actionsRef = useKeyboardActions()

  const position = useRef(
    initialPosition ? initialPosition.clone().setLength(radius) : new THREE.Vector3(0, 0, radius)
  )
  const forward = useRef(initialForward ? initialForward.clone() : new THREE.Vector3(1, 0, 0))
  const up = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const quaternion = useRef(new THREE.Quaternion())
  const lookMatrix = useRef(new THREE.Matrix4())

  const update = (delta) => {
    const actions = actionsRef.current

    up.current.copy(position.current).normalize()

    // Reortogonalizar forward contra la normal actual (Gram-Schmidt) — lo
    // mantiene tangente a la esfera a medida que el avatar cruza curvatura.
    forward.current
      .addScaledVector(up.current, -forward.current.dot(up.current))
      .normalize()
    right.current.crossVectors(forward.current, up.current).normalize()

    if (actions.left)  forward.current.applyAxisAngle(up.current, turnSpeed * delta)
    if (actions.right) forward.current.applyAxisAngle(up.current, -turnSpeed * delta)

    let move = 0
    if (actions.forward) move += 1
    if (actions.backward) move -= 1

    if (move !== 0) {
      const boost = actions.boost ? BOOST_MULTIPLIER : 1
      position.current.addScaledVector(forward.current, move * speed * boost * delta)
      position.current.setLength(radius)
    }

    lookMatrix.current.lookAt(ZERO, forward.current, up.current)
    quaternion.current.setFromRotationMatrix(lookMatrix.current)

    return {
      position: position.current,
      quaternion: quaternion.current,
      up: up.current,
      forward: forward.current,
      isMoving: move !== 0,
    }
  }

  return { update, position, quaternion }
}
