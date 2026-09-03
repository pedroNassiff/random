/**
 * lab-core/engine — SaveManager
 *
 * Persistencia versionada en localStorage, compartida entre juegos del Lab.
 * Un save inválido o de una versión vieja se descarta (no se intenta migrar
 * automáticamente) y se vuelve a los defaults del caller.
 */

const SAVE_VERSION = 1
const KEY_PREFIX = 'lab-save:'

const keyFor = (gameId) => `${KEY_PREFIX}${gameId}`

export function loadSave(gameId, defaults) {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const raw = window.localStorage.getItem(keyFor(gameId))
    if (!raw) return { ...defaults }

    const parsed = JSON.parse(raw)
    if (parsed.version !== SAVE_VERSION) {
      console.warn(`[SaveManager] ${gameId}: save de versión ${parsed.version} (actual ${SAVE_VERSION}), se descarta`)
      return { ...defaults }
    }
    return { ...defaults, ...parsed.data }
  } catch (err) {
    console.error(`[SaveManager] ${gameId}: no se pudo leer el save`, err)
    return { ...defaults }
  }
}

export function saveGame(gameId, data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      keyFor(gameId),
      JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), data })
    )
  } catch (err) {
    console.error(`[SaveManager] ${gameId}: no se pudo guardar`, err)
  }
}

export function resetSave(gameId) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(keyFor(gameId))
}

export const SAVE_MANAGER_VERSION = SAVE_VERSION
