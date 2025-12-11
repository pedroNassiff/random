import * as THREE from 'three'
import codeFlowVertexShader from './shaders/codeFlow/vertex.glsl'
import codeFlowFragmentShader from './shaders/codeFlow/fragment.glsl'

/**
 * ParticleEmitter creates and manages the visual "code flow" effect
 * that animates from the Being's head to the target element position
 */
export default class ParticleEmitter {
    constructor(scene) {
        this.scene = scene
        this.mesh = null
        this.material = null
        this.startTime = Date.now()
        this.duration = 1500 // Default duration in milliseconds
    }

    /**
     * Create a particle plane that flows from origin to target
     * @param {{x: number, y: number}} origin - Start position in screen coords
     * @param {{x: number, y: number}} target - End position in screen coords
     * @param {number} duration - Animation duration in milliseconds
     */
    createFlowPlane(origin, target, duration = 1500) {
        this.duration = duration
        this.startTime = Date.now()

        // Calculate the direction and distance
        const dx = target.x - origin.x
        const dy = target.y - origin.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)

        // Convert screen coordinates to world coordinates
        // We use an orthographic-like approach for 2D overlay
        const worldOrigin = this.screenToWorld(origin)
        const worldTarget = this.screenToWorld(target)

        // Calculate center point between origin and target
        const centerX = (worldOrigin.x + worldTarget.x) / 2
        const centerY = (worldOrigin.y + worldTarget.y) / 2
        const centerZ = 2 // Slightly in front of the camera

        // Create geometry - a plane oriented from origin to target
        const planeWidth = distance / 100 // Scale to world units
        const planeHeight = planeWidth * 0.3 // Narrower plane for the flow effect

        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 1, 1)

        // Create shader material with code flow effect
        this.material = new THREE.ShaderMaterial({
            vertexShader: codeFlowVertexShader,
            fragmentShader: codeFlowFragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                u_mouse: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
                u_progress: { value: 0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        })

        // Create mesh
        this.mesh = new THREE.Mesh(geometry, this.material)

        // Position at center
        this.mesh.position.set(centerX, centerY, centerZ)

        // Rotate to align with the direction from origin to target
        this.mesh.rotation.z = angle

        // Add to scene
        this.scene.add(this.mesh)
    }

    /**
     * Convert screen coordinates to world coordinates
     * @param {{x: number, y: number}} screenPos - Screen position
     * @returns {{x: number, y: number, z: number}} - World position
     */
    screenToWorld(screenPos) {
        // Normalize screen coordinates to -1 to 1
        const x = (screenPos.x / window.innerWidth) * 2 - 1
        const y = -(screenPos.y / window.innerHeight) * 2 + 1

        // For a perspective camera at z=5 looking at origin,
        // we need to scale based on the distance
        const z = 2
        const distance = 5 - z // Distance from camera
        const fov = 45 * Math.PI / 180
        const height = 2 * Math.tan(fov / 2) * distance
        const width = height * (window.innerWidth / window.innerHeight)

        return {
            x: x * width / 2,
            y: y * height / 2,
            z: z
        }
    }

    /**
     * Update the particle animation
     * @param {number} elapsedTime - Total elapsed time from clock
     * @returns {boolean} - True if animation is still running, false if complete
     */
    animate(elapsedTime) {
        if (!this.material) return false

        // Calculate progress (0 to 1)
        const currentTime = Date.now()
        const timeSinceStart = currentTime - this.startTime
        const progress = Math.min(timeSinceStart / this.duration, 1)

        // Update uniforms
        this.material.uniforms.u_time.value = elapsedTime
        this.material.uniforms.u_progress.value = progress

        // Return false when animation is complete
        return progress < 1
    }

    /**
     * Clean up and remove the particle system
     */
    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh)

            if (this.mesh.geometry) {
                this.mesh.geometry.dispose()
            }

            if (this.material) {
                this.material.dispose()
            }

            this.mesh = null
            this.material = null
        }
    }

    /**
     * Check if the emitter is active
     * @returns {boolean}
     */
    isActive() {
        return this.mesh !== null
    }
}
