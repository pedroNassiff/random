import Transmission from './Transmission.js'

/**
 * TransmissionFactory creates different types of transmissions
 * with pre-configured HTML elements and styles
 */
export default class TransmissionFactory {
    constructor() {
        this.elementCounter = 0
    }

    /**
     * Create a logo transmission
     * @param {string} text - Logo text
     * @param {{x: number, y: number}} targetPosition - Target position on screen
     * @param {Object} config - Additional configuration
     * @returns {Transmission}
     */
    createLogoTransmission(text, targetPosition, config = {}) {
        const element = document.createElement('div')
        element.className = 'transmitted-element transmitted-logo'
        element.textContent = text
        element.id = `logo-${++this.elementCounter}`

        // Apply styles
        Object.assign(element.style, {
            fontSize: '2.5rem',
            fontWeight: '900',
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(0, 200, 255, 0.3)',
            fontFamily: 'Arial, sans-serif',
            whiteSpace: 'nowrap',
            ...config.style
        })

        return {
            element,
            target: targetPosition,
            duration: config.duration || 1500,
            type: 'logo'
        }
    }

    /**
     * Create a card transmission
     * @param {Object} content - Card content {title, description, image}
     * @param {{x: number, y: number}} targetPosition - Target position on screen
     * @param {Object} config - Additional configuration
     * @returns {Transmission}
     */
    createCardTransmission(content, targetPosition, config = {}) {
        const element = document.createElement('div')
        element.className = 'transmitted-element transmitted-card'
        element.id = `card-${++this.elementCounter}`

        // Create card structure
        const cardInner = `
            <div class="card-inner">
                ${content.image ? `<div class="card-image" style="background-image: url(${content.image})"></div>` : ''}
                <div class="card-content">
                    ${content.title ? `<h3 class="card-title">${content.title}</h3>` : ''}
                    ${content.description ? `<p class="card-description">${content.description}</p>` : ''}
                </div>
            </div>
        `
        element.innerHTML = cardInner

        // Apply base styles
        Object.assign(element.style, {
            width: '300px',
            minHeight: '200px',
            background: 'linear-gradient(135deg, rgba(20, 20, 40, 0.9), rgba(40, 40, 80, 0.8))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 200, 255, 0.1)',
            overflow: 'hidden',
            ...config.style
        })

        return {
            element,
            target: targetPosition,
            duration: config.duration || 1800,
            type: 'card'
        }
    }

    /**
     * Create a text transmission
     * @param {string} text - Text content
     * @param {{x: number, y: number}} targetPosition - Target position on screen
     * @param {Object} config - Additional configuration
     * @returns {Transmission}
     */
    createTextTransmission(text, targetPosition, config = {}) {
        const element = document.createElement('div')
        element.className = 'transmitted-element transmitted-text'
        element.textContent = text
        element.id = `text-${++this.elementCounter}`

        // Apply styles
        Object.assign(element.style, {
            fontSize: '1.2rem',
            fontWeight: '400',
            color: 'rgba(255, 255, 255, 0.9)',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '400px',
            lineHeight: '1.6',
            ...config.style
        })

        return {
            element,
            target: targetPosition,
            duration: config.duration || 1200,
            type: 'text'
        }
    }

    /**
     * Create an image transmission
     * @param {string} src - Image source URL
     * @param {{x: number, y: number}} targetPosition - Target position on screen
     * @param {Object} config - Additional configuration
     * @returns {Transmission}
     */
    createImageTransmission(src, targetPosition, config = {}) {
        const element = document.createElement('img')
        element.className = 'transmitted-element transmitted-image'
        element.src = src
        element.alt = config.alt || 'Transmitted image'
        element.id = `image-${++this.elementCounter}`

        // Apply styles
        Object.assign(element.style, {
            width: config.width || '200px',
            height: config.height || 'auto',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            ...config.style
        })

        return {
            element,
            target: targetPosition,
            duration: config.duration || 1500,
            type: 'image'
        }
    }

    /**
     * Create a custom transmission with a provided element
     * @param {HTMLElement} element - Custom element
     * @param {{x: number, y: number}} targetPosition - Target position on screen
     * @param {Object} config - Additional configuration
     * @returns {Transmission}
     */
    createCustomTransmission(element, targetPosition, config = {}) {
        element.classList.add('transmitted-element')
        if (!element.id) {
            element.id = `custom-${++this.elementCounter}`
        }

        return {
            element,
            target: targetPosition,
            duration: config.duration || 1500,
            type: 'custom'
        }
    }
}
