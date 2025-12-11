import Transmission from './Transmission.js'
import { getHeadScreenPosition } from './TransmissionUtils.js'

/**
 * TransmissionManager orchestrates all transmissions
 * Manages the queue, execution, and lifecycle of transmissions
 */
export default class TransmissionManager {
    constructor(scene, camera, bodyModel) {
        this.scene = scene
        this.camera = camera
        this.bodyModel = bodyModel

        // Queues
        this.transmissionQueue = []
        this.activeTransmissions = []

        // State
        this.isProcessing = false
        this.autoExecute = true // Automatically execute queued transmissions
    }

    /**
     * Queue a transmission for execution
     * @param {Object} transmission - Transmission config from factory
     */
    queueTransmission(transmission) {
        // Get the current head position
        const origin = this.getHeadPosition()

        // Create a Transmission instance
        const tx = new Transmission({
            element: transmission.element,
            origin: origin,
            target: transmission.target,
            duration: transmission.duration,
            scene: this.scene
        })

        // Set completion callback
        tx.onComplete = (completedTx) => {
            this._handleTransmissionComplete(completedTx)
        }

        // Add to queue
        this.transmissionQueue.push(tx)

        // Auto-execute if enabled
        if (this.autoExecute && !this.isProcessing) {
            this.executeNext()
        }

        return tx
    }

    /**
     * Execute the next transmission in the queue
     */
    executeNext() {
        if (this.transmissionQueue.length === 0) {
            this.isProcessing = false
            return null
        }

        this.isProcessing = true
        const transmission = this.transmissionQueue.shift()

        return this._executeTransmission(transmission)
    }

    /**
     * Execute all queued transmissions with a delay between each
     * @param {number} delay - Delay in milliseconds between transmissions
     */
    async executeAll(delay = 500) {
        this.autoExecute = false // Disable auto-execute temporarily

        const transmissions = [...this.transmissionQueue]
        this.transmissionQueue = []

        for (let i = 0; i < transmissions.length; i++) {
            this._executeTransmission(transmissions[i])

            if (i < transmissions.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }

        this.autoExecute = true
    }

    /**
     * Execute a specific transmission
     * @param {Transmission} transmission
     * @private
     */
    _executeTransmission(transmission) {
        // Prepare the element
        transmission.prepare()

        // Add to active transmissions
        this.activeTransmissions.push(transmission)

        // Start transmission after a brief delay (for visual effect)
        setTimeout(() => {
            transmission.transmit()
        }, 50)

        return transmission
    }

    /**
     * Handle completion of a transmission
     * @param {Transmission} transmission
     * @private
     */
    _handleTransmissionComplete(transmission) {
        // Remove from active transmissions
        const index = this.activeTransmissions.indexOf(transmission)
        if (index > -1) {
            this.activeTransmissions.splice(index, 1)
        }

        // Execute next in queue if auto-execute is enabled
        if (this.autoExecute && this.transmissionQueue.length > 0) {
            setTimeout(() => this.executeNext(), 200)
        }
    }

    /**
     * Update method to be called in the animation loop
     * Updates all active particle emitters
     * @param {number} elapsedTime - Elapsed time from Three.js clock
     */
    update(elapsedTime) {
        // Update all active transmissions' particle effects
        this.activeTransmissions.forEach(transmission => {
            transmission.updateParticles(elapsedTime)
        })
    }

    /**
     * Get the current screen position of the Being's head
     * @returns {{x: number, y: number}}
     */
    getHeadPosition() {
        if (!this.bodyModel || !this.camera) {
            console.warn('Body model or camera not available')
            return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        }

        return getHeadScreenPosition(this.bodyModel, this.camera)
    }

    /**
     * Clear all queued and active transmissions
     */
    clearAll() {
        // Cancel all active transmissions
        this.activeTransmissions.forEach(tx => tx.cancel())
        this.activeTransmissions = []

        // Clear the queue
        this.transmissionQueue = []

        this.isProcessing = false
    }

    /**
     * Get status information
     * @returns {Object}
     */
    getStatus() {
        return {
            queued: this.transmissionQueue.length,
            active: this.activeTransmissions.length,
            isProcessing: this.isProcessing
        }
    }
}
