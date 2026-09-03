/**
 * PANSPERMIA — root del juego
 *
 * Hidrata el GameStore desde el save al montar, autoguarda en cada cambio
 * de progresión, y delega el render a SceneManager con los 3 stubs de
 * escena. Se monta dentro del <Canvas> de PanspermiaDetail.
 */
import React, { useEffect } from 'react'
import SceneManager from '../../engine/SceneManager'
import { useGameStore } from '../../engine/GameStore'
import { loadSave, saveGame } from '../../engine/SaveManager'
import Nexus from './scenes/Nexus'
import GalaxyTravel from './scenes/GalaxyTravel'
import PlanetSurface from './scenes/PlanetSurface'
import PlanetShaderTest from './scenes/PlanetShaderTest'

const GAME_ID = 'panspermia'

const SCENES = {
  'nexus': Nexus,
  'galaxy-travel': GalaxyTravel,
  'planet-surface': PlanetSurface,
  'planet-test': PlanetShaderTest,
}

export default function PanspermiaGame() {
  const hydrateFromSave = useGameStore((s) => s.hydrateFromSave)

  // Cargar save al montar
  useEffect(() => {
    const defaults = useGameStore.getState().getSaveSnapshot()
    const saved = loadSave(GAME_ID, defaults)
    hydrateFromSave(saved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autoguardar cuando cambia la porción persistida del store
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state, prevState) => {
      const snapshot = useGameStore.getState().getSaveSnapshot()
      const prevSnapshot = {
        reincarnationLevel: prevState.reincarnationLevel,
        element: prevState.element,
        unlockedCenters: prevState.unlockedCenters,
        visitedPlanets: prevState.visitedPlanets,
        knowledge: prevState.knowledge,
        energy: prevState.energy,
      }
      if (JSON.stringify(snapshot) !== JSON.stringify(prevSnapshot)) {
        saveGame(GAME_ID, snapshot)
      }
    })
    return unsubscribe
  }, [])

  return <SceneManager scenes={SCENES} />
}
