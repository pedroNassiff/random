import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { propagateSatECI } from '../propagate.js'

// Reutilizables para evitar garbage collection en el loop
const _matrix = new THREE.Matrix4()
const _pos    = new THREE.Vector3()
const _quat   = new THREE.Quaternion()
const _scale  = new THREE.Vector3()

/**
 * Geometría procedural de satélite:
 * - cuerpo cúbico central
 * - dos paneles solares rectangulares a los lados
 * Todo normalizado a escala 1 → se escala con bodyScale en el registry.
 */
function buildSatelliteGeometry() {
    const body = new THREE.BoxGeometry(1.0, 0.45, 0.45)

    const panelL = new THREE.BoxGeometry(1.1, 0.6, 0.04)
    panelL.translate(-1.05, 0, 0)

    const panelR = new THREE.BoxGeometry(1.1, 0.6, 0.04)
    panelR.translate(1.05, 0, 0)

    return mergeGeometries([body, panelL, panelR])
}

/**
 * Renderer para grupos pequeños/medianos usando THREE.InstancedMesh.
 * Cada instancia es un mesh procedural: cuerpo + dos paneles solares.
 */
export class InstancedRenderer {
    constructor(scene, config) {
        this.scene   = scene
        this.config  = config
        this.mesh    = null
        this.satrecs = null
        this.s       = config.bodyScale ?? 0.020
    }

    init(satrecs) {
        this.satrecs  = satrecs
        const count   = satrecs.length

        const geometry = buildSatelliteGeometry()
        const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(this.config.color),
        })

        this.mesh = new THREE.InstancedMesh(geometry, material, count)
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        // posición inicial: origen (invisible hasta la primera propagación)
        _scale.set(this.s, this.s, this.s)
        _quat.identity()
        for (let i = 0; i < count; i++) {
            _matrix.compose(_pos.set(0, 0, 0), _quat, _scale)
            this.mesh.setMatrixAt(i, _matrix)
        }
        this.mesh.instanceMatrix.needsUpdate = true

        this.scene.add(this.mesh)
    }

    update(date) {
        if (!this.mesh) return

        _scale.set(this.s, this.s, this.s)
        _quat.identity()

        for (let i = 0; i < this.satrecs.length; i++) {
            const v = propagateSatECI(this.satrecs[i].satrec, date)

            _pos.copy(v ?? new THREE.Vector3(0, 0, 0))
            _matrix.compose(_pos, _quat, _scale)
            this.mesh.setMatrixAt(i, _matrix)
        }

        this.mesh.instanceMatrix.needsUpdate = true
    }

    setVisible(visible) {
        if (this.mesh) this.mesh.visible = visible
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh)
            this.mesh.geometry.dispose()
            this.mesh.material.dispose()
            this.mesh = null
        }
    }
}
