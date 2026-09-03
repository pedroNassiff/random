import { fetchTLE } from './fetchTLE.js'
import { initSatrec } from './propagate.js'
import { REGISTRY } from './registry.js'
import { PointsRenderer }    from './renderers/PointsRenderer.js'
import { InstancedRenderer } from './renderers/InstancedRenderer.js'

const RENDERERS = {
    points:    PointsRenderer,
    instanced: InstancedRenderer,
}

/**
 * SatelliteLayer — orquestador de grupos de satélites.
 *
 * La configuración de cada grupo vive en registry.js.
 * El renderer (points / instanced) se selecciona automáticamente
 * según el campo `renderer` del registry.
 *
 * Uso:
 *   const layer = new SatelliteLayer(scene)
 *   await layer.loadGroup('starlink')   // async, carga bajo demanda
 *   layer.setVisible('starlink', true)
 *   // en el tick:
 *   layer.update(new Date())
 */
export class SatelliteLayer {
    constructor(scene) {
        this.scene      = scene
        this.groups     = {}   // name → { renderer, satrecs, visible, loading, updateEvery }
        this.frameCount = 0
    }

    /**
     * Carga un grupo bajo demanda. Idempotente: ignorado si ya está cargado.
     */
    async loadGroup(name) {
        if (this.groups[name]) return

        const config = REGISTRY[name]
        if (!config) throw new Error(`[SatelliteLayer] Grupo desconocido: "${name}"`)

        // Placeholder para evitar doble fetch simultáneo
        this.groups[name] = { loading: true }

        let records
        try {
            records = await fetchTLE(name)
        } catch (err) {
            console.error(`[SatelliteLayer] Error al cargar "${name}":`, err)
            delete this.groups[name]
            return
        }

        const satrecs      = records.map(initSatrec)
        const RendererClass = RENDERERS[config.renderer] ?? PointsRenderer
        const renderer      = new RendererClass(this.scene, config)
        renderer.init(satrecs)

        this.groups[name] = {
            renderer,
            satrecs,
            visible:     true,
            loading:     false,
            updateEvery: config.updateEvery ?? 5,
        }

        console.log(`[SatelliteLayer] "${name}" (${config.renderer}) listo: ${satrecs.length} satélites`)

        // Primera propagación inmediata
        renderer.update(new Date())
    }

    /**
     * Llamar en el animation loop con la fecha actual.
     * Cada grupo propaga según su propio `updateEvery`.
     */
    update(date) {
        this.frameCount++
        for (const name in this.groups) {
            const group = this.groups[name]
            if (!group.loading && group.visible && this.frameCount % group.updateEvery === 0) {
                group.renderer.update(date)
            }
        }
    }

    setVisible(name, visible) {
        const group = this.groups[name]
        if (!group || group.loading) return
        group.visible = visible
        group.renderer.setVisible(visible)
    }

    getCount(name) {
        const group = this.groups[name]
        return (!group || group.loading) ? 0 : group.satrecs.length
    }

    dispose() {
        for (const name in this.groups) {
            const group = this.groups[name]
            if (!group.loading) group.renderer.dispose()
        }
        this.groups = {}
    }
}
