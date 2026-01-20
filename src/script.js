import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import holographicVertexShader from './shaders/holographic/vertex.glsl'
import holographicFragmentShader from './shaders/holographic/fragment.glsl'
import lightBeamVertexShader from './shaders/lightBeam/vertex.glsl'
import lightBeamFragmentShader from './shaders/lightBeam/fragment.glsl'
import TransmissionManager from './TransmissionManager.js'
import TransmissionFactory from './TransmissionFactory.js'
console.log(holographicFragmentShader, holographicVertexShader);

/**
 * Glitch Text Effect
 */
class GlitchText {
    constructor(element, text) {
        this.element = element
        this.originalText = text
        this.chars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        this.isAnimating = false
    }
    
    animate() {
        if (this.isAnimating) return
        this.isAnimating = true
        
        const length = this.originalText.length
        const iterations = 15 // Number of random iterations
        let currentIteration = 0
        
        const interval = setInterval(() => {
            if (currentIteration >= iterations) {
                this.element.textContent = this.originalText
                clearInterval(interval)
                this.isAnimating = false
                return
            }
            
            // Generate random text
            let randomText = ''
            for (let i = 0; i < length; i++) {
                // Progressively reveal correct characters
                const revealProgress = currentIteration / iterations
                if (Math.random() < revealProgress) {
                    randomText += this.originalText[i]
                } else {
                    randomText += this.chars[Math.floor(Math.random() * this.chars.length)]
                }
            }
            
            this.element.textContent = randomText
            currentIteration++
        }, 30) // Speed of character changes
    }
}

/**
 * Typewriter Effect - Applies to any text element
 */
function applyTypewriterEffect(element, delay = 0, charDelay = 50) {
    const text = element.textContent
    
    // Clear element
    element.textContent = ''
    element.style.opacity = '1'
    
    // Create character spans
    const chars = []
    for (let i = 0; i < text.length; i++) {
        const charSpan = document.createElement('span')
        charSpan.textContent = text[i]
        charSpan.style.display = 'inline-block'
        charSpan.style.opacity = '0'
        element.appendChild(charSpan)
        chars.push(charSpan)
    }
    
    // Animate characters appearing one by one
    setTimeout(() => {
        chars.forEach((char, index) => {
            setTimeout(() => {
                char.style.transition = 'opacity 0.1s ease'
                char.style.opacity = '1'
            }, index * charDelay)
        })
    }, delay)
}

/**
 * Initialize typewriter effects on page load
 */
function initTypewriterEffects() {
    // Apply to .RANDOM( part
    const titleStatic = document.querySelector('.title-static')
    if (titleStatic) {
        applyTypewriterEffect(titleStatic, 100, 60)
    }
    
    // Apply to closing parenthesis )
    const closingParen = document.getElementById('closing-paren')
    if (closingParen) {
        applyTypewriterEffect(closingParen, 600, 60)
    }
    
    // Apply to any other text elements with .typewriter-text class
    const textElements = document.querySelectorAll('.typewriter-text')
    textElements.forEach((el, index) => {
        applyTypewriterEffect(el, 1000 + (index * 300), 50)
    })
}

/**
 * Random Content System with Materialization
 */
// All elements to materialize (including model which won't show text)
const allElements = ['MODEL', 'PROYECTOS', 'SERVICIOS', 'SOBRE MÍ']
// Text elements to show in random-content (excluding MODEL)
const textElements = ['PROYECTOS', 'SERVICIOS', 'SOBRE MÍ']
const randomContentSpan = document.getElementById('random-content')
const navButtonsContainer = document.querySelector('.nav-buttons')
let currentIndex = 0
let materializedElements = []
let materializing = false
let loadingComplete = false

// Animation state for each element
const elementAnimations = new Map()

class ElementAnimation {
    constructor(name, index, isModel = false) {
        this.name = name
        this.index = index
        this.isModel = isModel
        this.progress = 0
        this.targetProgress = 1
        this.movingText = null
        this.finalButton = null
        this.initialX = 0
        this.initialY = 0
        this.finalX = 0
        this.finalY = 0
        
        if (!isModel) {
            // Get INITIAL position (where random-content is - in the parenthesis)
            const randomContent = document.getElementById('random-content')
            const contentRect = randomContent.getBoundingClientRect()
            this.initialX = contentRect.left + contentRect.width / 2
            this.initialY = contentRect.top + contentRect.height / 2
            
            // Calculate FINAL position (where each button should end up)
            const windowHeight = window.innerHeight
            const windowWidth = window.innerWidth
            const buttonWidth = 150
            const gap = 20
            const totalButtons = 3
            const totalWidth = (buttonWidth * totalButtons) + (gap * (totalButtons - 1))
            const startX = (windowWidth - totalWidth) / 2
            
            // Position for this specific button (index-1 because MODEL is index 0)
            this.finalX = startX + (this.index - 1) * (buttonWidth + gap) + buttonWidth / 2
            this.finalY = windowHeight - 147
            
            console.log(`%c${name} SETUP:`, 'color: #00ff00; font-weight: bold')
            console.log(`  Initial: (${this.initialX.toFixed(0)}, ${this.initialY.toFixed(0)})`)
            console.log(`  Final:   (${this.finalX.toFixed(0)}, ${this.finalY.toFixed(0)})`)
            console.log(`  Distance: ${(this.finalY - this.initialY).toFixed(0)}px down`)
            
            // Create final button in fixed position (invisible initially)
            this.finalButton = document.createElement('button')
            this.finalButton.className = 'nav-btn'
            this.finalButton.textContent = name
            this.finalButton.style.position = 'fixed'
            this.finalButton.style.left = this.finalX + 'px'
            this.finalButton.style.top = this.finalY + 'px'
            this.finalButton.style.transform = 'translate(-50%, -50%)'
            this.finalButton.style.opacity = '0'
            this.finalButton.style.pointerEvents = 'none'
            this.finalButton.style.border = '1px solid transparent'
            this.finalButton.style.borderBottomColor = 'transparent'
            this.finalButton.style.borderRightColor = 'transparent'
            this.finalButton.style.borderTopColor = 'transparent'
            this.finalButton.style.borderLeftColor = 'transparent'
            
            // Add specific class for styling
            if (name === 'PROYECTOS') this.finalButton.classList.add('btn-proyectos')
            else if (name === 'SERVICIOS') this.finalButton.classList.add('btn-servicios')
            else if (name === 'SOBRE MÍ') this.finalButton.classList.add('btn-sobre-mi')
            
            document.body.appendChild(this.finalButton)
            
            // Add glitch effect on hover
            const glitchEffect = new GlitchText(this.finalButton, name)
            this.finalButton.addEventListener('mouseenter', () => {
                glitchEffect.animate()
            })
            
            // Create element that will move from initial to final position
            this.movingText = document.createElement('div')
            this.movingText.className = 'moving-text'
            
            // Split text into individual characters
            this.chars = []
            for (let i = 0; i < name.length; i++) {
                const charSpan = document.createElement('span')
                charSpan.textContent = name[i]
                charSpan.style.display = 'inline-block'
                charSpan.style.opacity = '0'
                this.movingText.appendChild(charSpan)
                this.chars.push(charSpan)
            }
            
            // Start at initial position with title styling
            this.movingText.style.position = 'fixed'
            this.movingText.style.left = this.initialX + 'px'
            this.movingText.style.top = this.initialY + 'px'
            this.movingText.style.transform = 'translate(-50%, -50%)'
            this.movingText.style.fontSize = '3vw' // Start smaller to fit in parenthesis
            this.movingText.style.fontWeight = '900'
            this.movingText.style.color = 'white'
            this.movingText.style.textTransform = 'uppercase'
            this.movingText.style.letterSpacing = '0.2em'
            this.movingText.style.zIndex = '100'
            this.movingText.style.whiteSpace = 'nowrap'
            this.movingText.style.padding = '0'
            this.movingText.style.background = 'none'
            
            // Borders invisible initially
            this.movingText.style.border = '2px solid transparent'
            this.movingText.style.borderStyle = 'solid'
            
            document.body.appendChild(this.movingText)
            
            // Hide the original random-content text to avoid duplication
            randomContent.textContent = ''
        }
    }
    
    update(deltaTime) {
        if (this.progress < this.targetProgress) {
            const oldProgress = this.progress
            this.progress += deltaTime * 0.6
            this.progress = Math.min(this.progress, this.targetProgress)
            
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - this.progress, 3)
            
            if (!this.isModel && this.movingText) {
                // PHASE 1: Movement and sizing (0% to 70%)
                const movementProgress = Math.min(easeProgress / 0.7, 1)
                
                // Move from initial position to final position
                const currentX = this.initialX + (this.finalX - this.initialX) * movementProgress
                const currentY = this.initialY + (this.finalY - this.initialY) * movementProgress
                
                // Animate characters appearing one by one (typewriter effect)
                const charsToShow = Math.floor(movementProgress * this.chars.length)
                this.chars.forEach((char, index) => {
                    if (index < charsToShow) {
                        char.style.opacity = '1'
                    } else if (index === charsToShow) {
                        // Character currently appearing
                        const charProgress = (movementProgress * this.chars.length) - charsToShow
                        char.style.opacity = charProgress
                    }
                })
                
                // Log every 10% of progress
                if (Math.floor(this.progress * 10) !== Math.floor(oldProgress * 10)) {
                    console.log(`%c${this.name} ${(this.progress * 100).toFixed(0)}%:`, 'color: #ffaa00; font-weight: bold', 
                        `X: ${currentX.toFixed(0)} Y: ${currentY.toFixed(0)} Chars: ${charsToShow}/${this.chars.length}`)
                }
                
                this.movingText.style.left = currentX + 'px'
                this.movingText.style.top = currentY + 'px'
                this.movingText.style.border = 'none'
                
                // Shrink from 3vw to 14px
                const initialFontSize = window.innerWidth * 0.03
                const finalFontSize = 14
                const currentFontSize = initialFontSize + (finalFontSize - initialFontSize) * movementProgress
                this.movingText.style.fontSize = currentFontSize + 'px'
                this.movingText.style.fontWeight = '700'
                
                // Grow padding
                const paddingY = 12 * movementProgress
                const paddingX = 24 * movementProgress
                this.movingText.style.padding = `${paddingY}px ${paddingX}px`
                
                // PHASE 2: Fade OUT text and paint borders on final button (70% to 100%)
                if (easeProgress > 0.7) {
                    const phase2Progress = (easeProgress - 0.7) / 0.3
                    
                    // Fade out moving text characters one by one (reverse order)
                    const charsToHide = Math.floor(phase2Progress * this.chars.length)
                    this.chars.forEach((char, index) => {
                        const reverseIndex = this.chars.length - 1 - index
                        if (reverseIndex < charsToHide) {
                            char.style.opacity = '0'
                        } else if (reverseIndex === charsToHide) {
                            const charProgress = (phase2Progress * this.chars.length) - charsToHide
                            char.style.opacity = 1 - charProgress
                        }
                    })
                    
                    // Make final button visible and paint borders progressively
                    if (this.finalButton) {
                        this.finalButton.style.opacity = '1'
                        
                        // Smooth progressive border drawing (0 to 1 for each border)
                        const borderProgress = phase2Progress * 4 // 0 to 4
                        
                        // Bottom border (0 to 1)
                        if (borderProgress >= 0) {
                            const bottomOpacity = Math.min(borderProgress, 1)
                            this.finalButton.style.borderBottomColor = `rgba(255, 255, 255, ${bottomOpacity})`
                        }
                        // Right border (1 to 2)
                        if (borderProgress > 1) {
                            const rightOpacity = Math.min(borderProgress - 1, 1)
                            this.finalButton.style.borderRightColor = `rgba(255, 255, 255, ${rightOpacity})`
                        }
                        // Top border (2 to 3)
                        if (borderProgress > 2) {
                            const topOpacity = Math.min(borderProgress - 2, 1)
                            this.finalButton.style.borderTopColor = `rgba(255, 255, 255, ${topOpacity})`
                        }
                        // Left border (3 to 4)
                        if (borderProgress > 3) {
                            const leftOpacity = Math.min(borderProgress - 3, 1)
                            this.finalButton.style.borderLeftColor = `rgba(255, 255, 255, ${leftOpacity})`
                        }
                    }
                }
            }
            
            return false // Not finished
        }
        
        // Animation complete - clean up and activate final button
        if (!this.isModel && this.movingText && this.finalButton) {
            console.log(`%c${this.name} COMPLETE`, 'color: #00ff00; font-weight: bold')
            
            // Remove the animated text element
            this.movingText.remove()
            this.movingText = null
            
            // Activate the final button
            this.finalButton.style.opacity = '1'
            this.finalButton.style.pointerEvents = 'auto'
        }
        
        return true // Finished
    }
}

// Function to materialize current element
function materializeElement() {
    if (materializing || currentIndex >= allElements.length) return
    
    const element = allElements[currentIndex]
    materializing = true
    
    console.log('Materializing:', element)
    
    // Check if element was already materialized
    if (materializedElements.includes(element)) {
        materializing = false
        currentIndex++
        return
    }
    
    materializedElements.push(element)
    
    // Start animation
    if (element === 'MODEL') {
        // Trigger model animation
        console.log('Starting model animation')
        const animation = new ElementAnimation(element, currentIndex, true)
        elementAnimations.set(element, animation)
        if (bodyModel) {
            startModelAnimation()
        }
    } else {
        // Create button animation using the visible text
        console.log('Creating button for:', element)
        
        // Create animation which will handle the text
        const animation = new ElementAnimation(element, currentIndex, false)
        elementAnimations.set(element, animation)
    }
    
    // Move to next element after delay
    setTimeout(() => {
        materializing = false
        currentIndex++
        // Trigger next element
        if (currentIndex < allElements.length && !loadingComplete) {
            updateRandomContent()
        } else if (!loadingComplete) {
            // Loading complete - trigger closing parenthesis animation
            loadingComplete = true
            setTimeout(() => {
                closeParenthesisAnimation()
            }, 500)
        }
    }, 1000)
}

// Function to animate closing parenthesis
function closeParenthesisAnimation() {
    const closingParen = document.getElementById('closing-paren')
    const randomContent = document.getElementById('random-content')
    
    if (!closingParen || !randomContent) return
    
    console.log('Starting closing parenthesis animation')
    
    // Get the width of the content to know how far to move
    const contentWidth = randomContent.offsetWidth
    
    // Add closing class
    closingParen.classList.add('closing')
    
    // Animate the parenthesis moving left
    let progress = 0
    const duration = 800 // milliseconds
    const startTime = performance.now()
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime
        progress = Math.min(elapsed / duration, 1)
        
        // Ease in-out cubic
        const easeProgress = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2
        
        // Move parenthesis left
        const translateX = -contentWidth * easeProgress
        closingParen.style.transform = `translateX(${translateX}px)`
        
        // Clip/hide the content as parenthesis moves over it
        const clipWidth = contentWidth * (1 - easeProgress)
        randomContent.style.clipPath = `inset(0 ${contentWidth - clipWidth}px 0 0)`
        randomContent.style.opacity = String(1 - easeProgress)
        
        if (progress < 1) {
            requestAnimationFrame(animate)
        } else {
            // Clear content completely
            randomContent.textContent = ''
            randomContent.style.clipPath = 'none'
            randomContent.style.opacity = '1'
            closingParen.style.transform = 'translateX(0)'
            closingParen.classList.remove('closing')
            loadingComplete = true
        }
    }
    
    requestAnimationFrame(animate)
}

// Function to update random content
function updateRandomContent() {
    if (currentIndex >= allElements.length || loadingComplete) {
        return
    }
    
    const element = allElements[currentIndex]
    
    // If it's the model, don't show text, just materialize
    if (element === 'MODEL') {
        randomContentSpan.textContent = ''
        materializeElement()
    } else {
        // Fade out current text
        randomContentSpan.style.opacity = '0'
        randomContentSpan.style.transition = 'opacity 0.3s ease'
        
        setTimeout(() => {
            // Show new text
            randomContentSpan.textContent = element
            // Fade in
            randomContentSpan.style.opacity = '1'
            
            // Materialize after showing for a moment
            setTimeout(() => {
                materializeElement()
            }, 400)
        }, 300)
    }
}

// Start the sequence
setTimeout(() => {
    updateRandomContent()
}, 500)

/**
 * Base
 */
// Debug
const gui = new GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Loaders
const gltfLoader = new GLTFLoader()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 0, 5)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enableZoom = false // Desactivar zoom para que el scroll no afecte la cámara
controls.enableRotate = false // Desactivar rotación para que el mouse no mueva la cámara
controls.enablePan = false // Desactivar pan

/**
 * Renderer
 */
const rendererParameters = {}
rendererParameters.clearColor = '#1d1f2a'

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setClearColor(rendererParameters.clearColor)
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

gui
    .addColor(rendererParameters, 'clearColor')
    .onChange(() => {
        renderer.setClearColor(rendererParameters.clearColor)
    })

/**
 * Material
 */

// material parameters
const materialParameters = {}
materialParameters.color = '#ff0000'

gui
    .addColor(materialParameters, 'color')
    .name('material color')
    .onChange(() => {
        material.uniforms.uColor.value = new THREE.Color(materialParameters.color)
    })
const material = new THREE.ShaderMaterial(
    {
        vertexShader: holographicVertexShader,
        fragmentShader: holographicFragmentShader,

        uniforms: {
            uTime: new THREE.Uniform(0),
            uColor: new THREE.Uniform(new THREE.Color('red')),
        },
        transparent: true,
        // side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }
)

/**
 * Objects
 */


// Body Model
const modelParameters = {
    initialScale: 0.02,  // Tamaño inicial cuando está dentro del ()
    finalScale: 0.15,     // Tamaño final cuando llega al centro abajo
    rotationSpeed: 0,
    initialX: 1.25,  // Posición inicial X (dentro del paréntesis)
    initialY: -0.24,  // Posición inicial Y
    finalX: 0,        // Posición final X (centro de pantalla)
    finalY: -4.67,    // Posición final Y (ajustar para mostrar solo cabeza)
    initialRotationY: 0,        // Rotación inicial (de frente) - 0 grados
    finalRotationY: Math.PI     // Rotación final (de espaldas) - 180 grados
}

// Model animation state
let modelAnimationProgress = 0
let modelAnimating = false
const modelAnimationDuration = 3 // seconds

function startModelAnimation() {
    modelAnimationProgress = 0
    modelAnimating = true
}

/**
 * Transmission System
 */
let transmissionManager = null
const factory = new TransmissionFactory()
let transmissionsStarted = false

function startTransmissions() {
    if (!transmissionManager || transmissionsStarted) return

    transmissionsStarted = true

    // Logo transmission to top-left
    const logoConfig = factory.createLogoTransmission(
        'RANDOM',
        { x: 150, y: 60 }, // top-left position
        { duration: 2000 }
    )
    transmissionManager.queueTransmission(logoConfig)

    // Card transmissions - example cards
    setTimeout(() => {
        const card1 = factory.createCardTransmission(
            {
                title: 'Proyecto 01',
                description: 'Explorando la creatividad a través del código generativo.'
            },
            { x: window.innerWidth / 2 - 350, y: window.innerHeight / 2 },
            { duration: 2200 }
        )
        transmissionManager.queueTransmission(card1)
    }, 800)

    setTimeout(() => {
        const card2 = factory.createCardTransmission(
            {
                title: 'Proyecto 02',
                description: 'Rompiendo las reglas para descubrir nuevas formas.'
            },
            { x: window.innerWidth / 2, y: window.innerHeight / 2 },
            { duration: 2200 }
        )
        transmissionManager.queueTransmission(card2)
    }, 1600)

    setTimeout(() => {
        const card3 = factory.createCardTransmission(
            {
                title: 'Proyecto 03',
                description: 'La imperfección como fuente de belleza.'
            },
            { x: window.innerWidth / 2 + 350, y: window.innerHeight / 2 },
            { duration: 2200 }
        )
        transmissionManager.queueTransmission(card3)
    }, 2400)
}

let bodyModel = null
gltfLoader.load(
    './malebase.glb',
    (gltf) => {
        bodyModel = gltf.scene

        // Position model inside the parentheses - offset to the right
        bodyModel.position.set(modelParameters.initialX, modelParameters.initialY, 0)
        bodyModel.scale.set(modelParameters.initialScale, modelParameters.initialScale, modelParameters.initialScale)

        // Set initial rotation (facing front)
        bodyModel.rotation.y = modelParameters.initialRotationY

        // Apply holographic material
        bodyModel.traverse((child) => {
            if (child.isMesh)
                child.material = material
        })

        scene.add(bodyModel)

        // Initialize TransmissionManager after model loads
        // transmissionManager = new TransmissionManager(scene, camera, bodyModel)

        // Add GUI controls for the model
        const modelFolder = gui.addFolder('Body Model')
        modelFolder.add(modelParameters, 'initialScale', 0.01, 0.2, 0.001)
            .name('Initial Scale (in ())')
        modelFolder.add(modelParameters, 'finalScale', 0.01, 2, 0.01)
            .name('Final Scale (center)')
        modelFolder.add(modelParameters, 'initialX', -3, 3, 0.01).name('Initial X')
        modelFolder.add(modelParameters, 'initialY', -3, 3, 0.01).name('Initial Y')
        modelFolder.add(modelParameters, 'finalX', -3, 3, 0.01).name('Final X (end)')
        modelFolder.add(modelParameters, 'finalY', -5, 1, 0.01).name('Final Y (end - head only)')
        modelFolder.add(modelParameters, 'initialRotationY', 0, Math.PI * 2, 0.00).name('Initial Rotation Y')
        modelFolder.add(modelParameters, 'finalRotationY', 0, Math.PI * 2, 0.01).name('Final Rotation Y (back)')
        modelFolder.add(modelParameters, 'rotationSpeed', 0, 2, 0.1).name('Rotation Speed')


    }
)

/**
 * Scroll
 */
let scrollY = 0

window.addEventListener('scroll', () => {
    scrollY = window.scrollY
})

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () => {
    const deltaTime = clock.getDelta()
    const elapsedTime = clock.getElapsedTime()

    // Update material time uniform
    material.uniforms.uTime.value = elapsedTime
    // lightBeamMaterial.uniforms.uTime.value = elapsedTime

    // Update transmission system
    if (transmissionManager) {
        transmissionManager.update(elapsedTime)
    }

    // Update element animations
    elementAnimations.forEach((animation, name) => {
        animation.update(deltaTime)
    })

    // Animate body model automatically (time-based instead of scroll-based)
    if (bodyModel && modelAnimating) {
        // Increment progress based on time
        modelAnimationProgress += deltaTime / modelAnimationDuration
        modelAnimationProgress = Math.min(modelAnimationProgress, 1)

        // Ease out cubic para movimiento suave curvo (aceleración al inicio, desaceleración al final)
        const easeProgress = 1 - Math.pow(1 - modelAnimationProgress, 3)

        // Movimiento en X: desde posición inicial hacia posición final
        const initialX = modelParameters.initialX
        const finalX = modelParameters.finalX
        const targetX = initialX + (easeProgress * (finalX - initialX))

        // Movimiento en Y: desde posición inicial hacia posición final (solo cabeza visible)
        const initialY = modelParameters.initialY
        const finalY = modelParameters.finalY
        const targetY = initialY + (easeProgress * (finalY - initialY))

        // Escalado: desde tamaño inicial (dentro del paréntesis) hasta tamaño final (centro)
        const initialScale = modelParameters.initialScale
        const finalScale = modelParameters.finalScale
        const targetScale = initialScale + (easeProgress * (finalScale - initialScale))

        // Rotación: desde frente hacia espaldas
        const initialRotationY = modelParameters.initialRotationY
        const finalRotationY = modelParameters.finalRotationY
        const targetRotationY = initialRotationY - (easeProgress * (finalRotationY - initialRotationY))

        // Suavizar el movimiento con lerp (linear interpolation)
        bodyModel.position.x += (targetX - bodyModel.position.x) * 0.1
        bodyModel.position.y += (targetY - bodyModel.position.y) * 0.1
        bodyModel.scale.x += (targetScale - bodyModel.scale.x) * 0.1
        bodyModel.scale.y += (targetScale - bodyModel.scale.y) * 0.1
        bodyModel.scale.z += (targetScale - bodyModel.scale.z) * 0.1
        bodyModel.rotation.y += (targetRotationY - bodyModel.rotation.y) * 0.1

        // Stop animation when complete
        if (modelAnimationProgress >= 1) {
            modelAnimating = false
            // Start transmissions after model animation
            if (!transmissionsStarted) {
                startTransmissions()
            }
        }
    }

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()

// Initialize typewriter effects when page loads
window.addEventListener('DOMContentLoaded', () => {
    initTypewriterEffects()
})