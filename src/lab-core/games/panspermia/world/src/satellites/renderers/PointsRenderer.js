import * as THREE from 'three'
import { propagateSatECI } from '../propagate.js'
import satVertexShader   from '../../shaders/satellites/vertex.glsl'
import satFragmentShader from '../../shaders/satellites/fragment.glsl'

/**
 * Renderer para miles de satélites usando THREE.Points + ShaderMaterial con glow.
 */
export class PointsRenderer {
    constructor(scene, config) {
        this.scene     = scene
        this.config    = config
        this.points    = null
        this.positions = null
        this.satrecs   = null
    }

    init(satrecs) {
        this.satrecs   = satrecs
        const count    = satrecs.length
        this.positions = new Float32Array(count * 3)

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))

        const material = new THREE.ShaderMaterial({
            vertexShader:   satVertexShader,
            fragmentShader: satFragmentShader,
            uniforms: {
                uColor: { value: new THREE.Color(this.config.color) },
                uSize:  { value: this.config.pointSize ?? 3.0 },
                uGlow:  { value: 1.0 },
            },
            transparent: true,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        })

        this.points = new THREE.Points(geometry, material)
        this.scene.add(this.points)
    }

    update(date) {
        if (!this.points) return

        for (let i = 0; i < this.satrecs.length; i++) {
            const v = propagateSatECI(this.satrecs[i].satrec, date)

            if (v) {
                this.positions[i * 3]     = v.x
                this.positions[i * 3 + 1] = v.y
                this.positions[i * 3 + 2] = v.z
            } else {
                this.positions[i * 3]     = 0
                this.positions[i * 3 + 1] = 0
                this.positions[i * 3 + 2] = 0
            }
        }

        this.points.geometry.attributes.position.needsUpdate = true
    }

    setVisible(visible) {
        if (this.points) this.points.visible = visible
    }

    dispose() {
        if (this.points) {
            this.scene.remove(this.points)
            this.points.geometry.dispose()
            this.points.material.dispose()
            this.points = null
        }
    }
}
