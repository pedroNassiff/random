import * as THREE from 'three'

/**
 * Utility functions for the Transmission System
 * Handles 3D to 2D coordinate conversions and head position tracking
 */

/**
 * Get the 3D world position of the Being's head
 * @param {THREE.Object3D} bodyModel - The loaded GLTF body model
 * @returns {THREE.Vector3} - World position of the head
 */
export function getHeadPosition3D(bodyModel) {
    if (!bodyModel) {
        console.warn('Body model not loaded yet')
        return new THREE.Vector3(0, 0, 0)
    }

    // The head is approximately at the top of the model
    // We calculate it based on the model's position and scale
    const headOffset = new THREE.Vector3(0, 1.7, 0) // Approximate head position in model space

    // Create a world position vector
    const headPosition = new THREE.Vector3()

    // Get the world position of the model
    bodyModel.updateMatrixWorld()

    // Apply the model's transformation to the head offset
    headOffset.multiplyScalar(bodyModel.scale.y) // Scale the offset
    headPosition.copy(bodyModel.position).add(headOffset)

    return headPosition
}

/**
 * Project a 3D position to 2D screen coordinates
 * @param {THREE.Vector3} position3D - 3D world position
 * @param {THREE.Camera} camera - Three.js camera
 * @returns {{x: number, y: number}} - Screen coordinates in pixels
 */
export function project3DTo2D(position3D, camera) {
    // Clone the position to avoid modifying the original
    const vector = position3D.clone()

    // Project to normalized device coordinates (-1 to +1)
    vector.project(camera)

    // Convert to screen coordinates
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight

    return { x, y }
}

/**
 * Get the screen position of the Being's head
 * Main API function that combines head tracking and projection
 * @param {THREE.Object3D} bodyModel - The loaded GLTF body model
 * @param {THREE.Camera} camera - Three.js camera
 * @returns {{x: number, y: number}} - Screen coordinates in pixels
 */
export function getHeadScreenPosition(bodyModel, camera) {
    const headPosition3D = getHeadPosition3D(bodyModel)
    return project3DTo2D(headPosition3D, camera)
}

/**
 * Calculate the direction vector from origin to target in 2D
 * @param {{x: number, y: number}} origin - Origin position
 * @param {{x: number, y: number}} target - Target position
 * @returns {{x: number, y: number, distance: number, angle: number}} - Direction info
 */
export function getDirection2D(origin, target) {
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    return {
        x: dx / distance, // normalized
        y: dy / distance, // normalized
        distance,
        angle
    }
}

/**
 * Linear interpolation between two values
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Progress (0 to 1)
 * @returns {number} - Interpolated value
 */
export function lerp(start, end, t) {
    return start + (end - start) * t
}

/**
 * Ease out cubic function for smooth animations
 * @param {number} t - Progress (0 to 1)
 * @returns {number} - Eased value
 */
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3)
}

/**
 * Ease in-out cubic function for smooth animations
 * @param {number} t - Progress (0 to 1)
 * @returns {number} - Eased value
 */
export function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Generate a unique ID for transmissions
 * @returns {string} - Unique identifier
 */
export function generateId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
