/**
 * lab-core/engine — useGameLoop
 *
 * Tick fijo (física/gameplay) + callback de render por frame, encima de
 * useFrame de R3F. Acumulador clásico para desacoplar la simulación del
 * framerate real; recorta pasos si hay un lag spike grande (spiral of death).
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const DEFAULT_FIXED_STEP = 1 / 60
const DEFAULT_MAX_SUBSTEPS = 5

export function useGameLoop({
  onFixedUpdate,
  onRender,
  fixedStep = DEFAULT_FIXED_STEP,
  maxSubSteps = DEFAULT_MAX_SUBSTEPS,
} = {}) {
  const accumulator = useRef(0)

  useFrame((state, delta) => {
    accumulator.current += delta

    let steps = 0
    while (accumulator.current >= fixedStep && steps < maxSubSteps) {
      onFixedUpdate?.(fixedStep, state)
      accumulator.current -= fixedStep
      steps += 1
    }
    if (steps >= maxSubSteps) accumulator.current = 0

    onRender?.(delta, state)
  })
}
