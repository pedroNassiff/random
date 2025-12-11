import { generateId, easeOutCubic } from './TransmissionUtils.js'
import ParticleEmitter from './ParticleEmitter.js'

/**
 * Transmission class manages the lifecycle of a single transmission
 * from the Being's head to a target location on screen
 */
export default class Transmission {
    /**
     * @param {Object} config - Transmission configuration
     * @param {HTMLElement} config.element - The DOM element to transmit
     * @param {{x: number, y: number}} config.origin - Origin position (head)
     * @param {{x: number, y: number}} config.target - Target position on screen
     * @param {number} config.duration - Duration in milliseconds
     * @param {THREE.Scene} config.scene - Three.js scene for particles
     */
    constructor({ element, origin, target, duration = 1500, scene }) {
        this.id = generateId()
        this.element = element
        this.origin = origin
        this.target = target
        this.duration = duration
        this.scene = scene

        // State machine: 'pending' → 'transmitting' → 'materialized' → 'complete'
        this.state = 'pending'

        // Particle emitter
        this.particleEmitter = null

        // Animation tracking
        this.startTime = null
        this.animationFrame = null

        // Callbacks
        this.onComplete = null
    }

    /**
     * Prepare the element for transmission
     * Hides it and positions it at the origin
     */
    prepare() {
        if (this.state !== 'pending') {
            console.warn(`Transmission ${this.id} is not in pending state`)
            return
        }

        // Set initial position to origin (head position)
        this.element.style.position = 'fixed'
        this.element.style.left = `${this.origin.x}px`
        this.element.style.top = `${this.origin.y}px`
        this.element.style.opacity = '0'
        this.element.style.transform = 'translate(-50%, -50%) scale(0.1)'
        this.element.style.pointerEvents = 'none'
        this.element.style.transition = 'none'

        // Add to DOM if not already there
        if (!this.element.parentElement) {
            const container = document.getElementById('transmitted-content')
            if (container) {
                container.appendChild(this.element)
            } else {
                document.body.appendChild(this.element)
            }
        }
    }

    /**
     * Start the transmission animation
     */
    transmit() {
        if (this.state !== 'pending') {
            console.warn(`Transmission ${this.id} cannot transmit from state ${this.state}`)
            return
        }

        this.state = 'transmitting'
        this.startTime = Date.now()

        // Create particle emitter
        if (this.scene) {
            this.particleEmitter = new ParticleEmitter(this.scene)
            this.particleEmitter.createFlowPlane(this.origin, this.target, this.duration)
        }

        // Start animation
        this._animate()
    }

    /**
     * Internal animation loop
     */
    _animate() {
        if (this.state !== 'transmitting') return

        const currentTime = Date.now()
        const elapsed = currentTime - this.startTime
        const progress = Math.min(elapsed / this.duration, 1)
        const easedProgress = easeOutCubic(progress)

        // Interpolate position
        const currentX = this.origin.x + (this.target.x - this.origin.x) * easedProgress
        const currentY = this.origin.y + (this.target.y - this.origin.y) * easedProgress

        // Update element position
        this.element.style.left = `${currentX}px`
        this.element.style.top = `${currentY}px`

        // Fade in and scale up
        this.element.style.opacity = `${easedProgress}`
        const scale = 0.1 + (0.9 * easedProgress)
        this.element.style.transform = `translate(-50%, -50%) scale(${scale})`

        // Check if animation is complete
        if (progress >= 1) {
            this.materialize()
        } else {
            this.animationFrame = requestAnimationFrame(() => this._animate())
        }
    }

    /**
     * Complete the transmission and materialize the element
     */
    materialize() {
        if (this.state !== 'transmitting') return

        this.state = 'materialized'

        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
            this.animationFrame = null
        }

        // Set final position
        this.element.style.left = `${this.target.x}px`
        this.element.style.top = `${this.target.y}px`
        this.element.style.opacity = '1'
        this.element.style.transform = 'translate(-50%, -50%) scale(1)'
        this.element.style.pointerEvents = 'auto'

        // Add materialized class for any additional CSS animations
        this.element.classList.add('materialized')

        // Wait a bit before cleaning up particle effect
        setTimeout(() => this.cleanup(), 300)
    }

    /**
     * Clean up the particle effect
     */
    cleanup() {
        if (this.particleEmitter) {
            this.particleEmitter.dispose()
            this.particleEmitter = null
        }

        this.state = 'complete'

        // Trigger completion callback
        if (this.onComplete) {
            this.onComplete(this)
        }
    }

    /**
     * Update the particle emitter (called from animation loop)
     * @param {number} elapsedTime - Elapsed time from Three.js clock
     */
    updateParticles(elapsedTime) {
        if (this.particleEmitter && this.particleEmitter.isActive()) {
            this.particleEmitter.animate(elapsedTime)
        }
    }

    /**
     * Cancel and remove the transmission
     */
    cancel() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
            this.animationFrame = null
        }

        if (this.particleEmitter) {
            this.particleEmitter.dispose()
            this.particleEmitter = null
        }

        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element)
        }

        this.state = 'complete'
    }
}
