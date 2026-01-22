import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import holographicVertexShader from './shaders/holographic/vertex.glsl'
import holographicFragmentShader from './shaders/holographic/fragment.glsl'
import Lattice from './Lattice.js'
import LatticeDataManager from './LatticeDataManager.js'
import latticeData from './data/lattice-data.json'

/**
 * ═══════════════════════════════════════════════════════════════
 * TYPEWRITER EFFECT
 * ═══════════════════════════════════════════════════════════════
 */
function applyTypewriterEffect(element, delay = 0, charDelay = 80) {
    return new Promise((resolve) => {
        const text = element.textContent
        element.textContent = ''
        element.style.opacity = '1'
        
        const chars = []
        for (let i = 0; i < text.length; i++) {
            const charSpan = document.createElement('span')
            charSpan.textContent = text[i]
            charSpan.style.display = 'inline-block'
            charSpan.style.opacity = '0'
            element.appendChild(charSpan)
            chars.push(charSpan)
        }
        
        setTimeout(() => {
            chars.forEach((char, index) => {
                setTimeout(() => {
                    char.style.transition = 'opacity 0.1s ease'
                    char.style.opacity = '1'
                    
                    // Resolve when last character appears
                    if (index === chars.length - 1) {
                        setTimeout(resolve, 100)
                    }
                }, index * charDelay)
            })
        }, delay)
    })
}

/**
 * ═══════════════════════════════════════════════════════════════
 * LOADING SEQUENCE
 * ═══════════════════════════════════════════════════════════════
 */
let loadingPhase = 'init' // init -> typewriter -> model -> wait -> descend -> lattice -> complete
let modelReady = false
let latticeReady = false

async function startLoadingSequence() {
    const loader = document.getElementById('loader')
    const title = document.querySelector('.title')
    const titleStatic = document.querySelector('.title-static')
    const randomContent = document.getElementById('random-content')
    const closingParen = document.getElementById('closing-paren')
    
    // Hide loader
    if (loader) {
        loader.classList.add('hidden')
    }
    
    // Phase 1: Typewriter effect for ".RANDOM("
    loadingPhase = 'typewriter'
    console.log('%c📝 Phase: Typewriter', 'color: #d4a574')
    
    titleStatic.textContent = '.RANDOM('
    closingParen.textContent = ')'
    closingParen.style.opacity = '0'
    
    await applyTypewriterEffect(titleStatic, 200, 100)
    
    // Show closing paren
    closingParen.style.transition = 'opacity 0.3s ease'
    closingParen.style.opacity = '1'
    
    // Phase 2: Wait for model to be ready, then show it inside parenthesis
    loadingPhase = 'model'
    console.log('%c👤 Phase: Model appears', 'color: #d4a574')
    
    // Wait until model is loaded
    while (!modelReady) {
        await new Promise(r => setTimeout(r, 100))
    }
    
    // Phase 3: Hold for 3 seconds with model inside RANDOM()
    loadingPhase = 'wait'
    console.log('%c⏳ Phase: Holding 3 seconds', 'color: #d4a574')
    await new Promise(r => setTimeout(r, 3000))
    
    // Phase 4: Model descends, lattice zooms in
    loadingPhase = 'descend'
    console.log('%c🚀 Phase: Descend & Lattice intro', 'color: #d4a574')
    
    startModelAnimation()
    
    // Wait a moment then start lattice intro
    await new Promise(r => setTimeout(r, 500))
    lattice.startIntro()
    
    // Phase 5: Minimize title after lattice intro starts
    await new Promise(r => setTimeout(r, 2000))
    title.classList.add('minimized')
    
    loadingPhase = 'complete'
    console.log('%c✨ Loading complete', 'color: #00ff00; font-weight: bold')
}

/**
 * ═══════════════════════════════════════════════════════════════
 * THREE.JS SETUP
 * ═══════════════════════════════════════════════════════════════
 */
const gui = new GUI()
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
const gltfLoader = new GLTFLoader()

// Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// Camera
const camera = new THREE.PerspectiveCamera(45, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 0, 5)
scene.add(camera)

// Controls (minimal - we handle our own)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enableZoom = false
controls.enableRotate = false
controls.enablePan = false

// Renderer
const rendererParameters = { clearColor: '#0a0a0a' }

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setClearColor(rendererParameters.clearColor)
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

gui.addColor(rendererParameters, 'clearColor').onChange(() => {
    renderer.setClearColor(rendererParameters.clearColor)
})

/**
 * ═══════════════════════════════════════════════════════════════
 * HOLOGRAPHIC MATERIAL
 * ═══════════════════════════════════════════════════════════════
 */
const materialParameters = { color: '#ff0000' }

const material = new THREE.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms: {
        uTime: new THREE.Uniform(0),
        uColor: new THREE.Uniform(new THREE.Color('red')),
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
})

gui.addColor(materialParameters, 'color').name('Model color').onChange(() => {
    material.uniforms.uColor.value = new THREE.Color(materialParameters.color)
})

/**
 * ═══════════════════════════════════════════════════════════════
 * LATTICE SYSTEM
 * ═══════════════════════════════════════════════════════════════
 */
const lattice = new Lattice(scene, {
    gridSize: { x: 10, y: 8, z: 12 },
    spacing: 1.8,
    nodeBaseSize: 0.06,
    nodeActiveSize: 0.5,
    connectionOpacity: 0.4,
    nodeColor: new THREE.Color('#d4a574'),
    connectionColor: new THREE.Color('#d4a574'),
    depthFadeStart: 2,
    depthFadeEnd: -20
})

lattice.setCamera(camera)

// Initialize lattice with data
async function initLatticeData() {
    try {
        const dataManager = new LatticeDataManager()
        await dataManager.load(latticeData)

        console.log('%c🕸️ Lattice Data Loaded:', 'color: #00ff00; font-weight: bold')
        console.log('  ', dataManager.getStats())

        const contentNodes = dataManager.getContentNodesForLattice()
        let addedNodes = 0
        
        for (const nodeConfig of contentNodes) {
            const addedNode = lattice.addContentNode(
                nodeConfig.position, 
                nodeConfig.data,
                { intensity: nodeConfig.syntpiergy?.intensity || 0.9 }
            )
            if (addedNode) addedNodes++
        }

        console.log('%c✨ Lattice Ready:', 'color: #d4a574; font-weight: bold')
        console.log('  Total nodes:', lattice.nodes.length)
        console.log('  Content nodes:', addedNodes)
        console.log('  Labels:', lattice.labelsGroup.children.length)
        
        latticeReady = true
        
    } catch (error) {
        console.error('Failed to initialize lattice:', error)
    }
}

initLatticeData()

/**
 * ═══════════════════════════════════════════════════════════════
 * MOUSE INTERACTION
 * ═══════════════════════════════════════════════════════════════
 */
let hoveredNode = null
let isMouseDown = false
let mouseDownTime = 0
let mouseDownPosition = { x: 0, y: 0 }

// Mouse move
canvas.addEventListener('mousemove', (event) => {
    const mouseX = (event.clientX / sizes.width) * 2 - 1
    const mouseY = -(event.clientY / sizes.height) * 2 + 1
    
    // Handle global drag (lattice rotation)
    if (isMouseDown && !lattice.isDragging) {
        const distance = Math.sqrt(
            Math.pow(event.clientX - mouseDownPosition.x, 2) +
            Math.pow(event.clientY - mouseDownPosition.y, 2)
        )
        
        if (distance > 5) {
            lattice.updateGlobalDrag(event.clientX, event.clientY)
        }
    }
    
    // Handle node drag
    if (lattice.isDragging) {
        lattice.updateNodeDrag(mouseX, mouseY)
        return
    }
    
    // Hover detection
    const node = lattice.getNodeAtPosition(mouseX, mouseY)
    
    if (node !== hoveredNode) {
        hoveredNode = node
        
        if (node && node.isContent) {
            canvas.style.cursor = 'pointer'
        } else {
            canvas.style.cursor = isMouseDown ? 'grabbing' : 'grab'
        }
    }
})

// Mouse down
canvas.addEventListener('mousedown', (event) => {
    isMouseDown = true
    mouseDownTime = Date.now()
    mouseDownPosition = { x: event.clientX, y: event.clientY }
    
    const mouseX = (event.clientX / sizes.width) * 2 - 1
    const mouseY = -(event.clientY / sizes.height) * 2 + 1
    
    const node = lattice.getNodeAtPosition(mouseX, mouseY)
    
    // Start node drag if clicking on a content node
    if (node && node.isContent) {
        lattice.startNodeDrag(node, mouseX, mouseY)
        canvas.style.cursor = 'grabbing'
    } else {
        // Start global drag
        lattice.startGlobalDrag(event.clientX, event.clientY)
        canvas.style.cursor = 'grabbing'
    }
})

// Mouse up
canvas.addEventListener('mouseup', (event) => {
    const wasShortClick = Date.now() - mouseDownTime < 200
    const mouseX = (event.clientX / sizes.width) * 2 - 1
    const mouseY = -(event.clientY / sizes.height) * 2 + 1
    
    // End any drags
    lattice.endGlobalDrag()
    lattice.endNodeDrag()
    
    // Handle click (short press without much movement)
    if (wasShortClick) {
        const distance = Math.sqrt(
            Math.pow(event.clientX - mouseDownPosition.x, 2) +
            Math.pow(event.clientY - mouseDownPosition.y, 2)
        )
        
        if (distance < 10) {
            const node = lattice.getNodeAtPosition(mouseX, mouseY)
            
            if (node && node.isContent) {
                if (lattice.focusedNode) {
                    lattice.resetZoom(() => {
                        setTimeout(() => {
                            lattice.zoomToNode(node, (targetNode) => {
                                console.log('📍 Focused on:', targetNode.data?.title)
                            })
                        }, 300)
                    })
                } else {
                    lattice.zoomToNode(node, (targetNode) => {
                        console.log('📍 Focused on:', targetNode.data?.title)
                    })
                }
            } else if (lattice.focusedNode) {
                lattice.resetZoom()
            }
        }
    }
    
    isMouseDown = false
    canvas.style.cursor = hoveredNode ? 'pointer' : 'grab'
})

// Mouse leave
canvas.addEventListener('mouseleave', () => {
    isMouseDown = false
    lattice.endGlobalDrag()
    lattice.endNodeDrag()
})

// Mouse wheel (zoom)
canvas.addEventListener('wheel', (event) => {
    event.preventDefault()
    lattice.handleWheel(event.deltaY)
}, { passive: false })

// Escape key
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lattice.focusedNode) {
        lattice.resetZoom()
    }
})

/**
 * ═══════════════════════════════════════════════════════════════
 * BODY MODEL
 * ═══════════════════════════════════════════════════════════════
 */
const modelParameters = {
    initialScale: 0.018,
    finalScale: 0.15,
    initialX: 0,        // Centered in RANDOM()
    initialY: -0.15,
    finalX: 0,
    finalY: -4.67,
    initialRotationY: 0,
    finalRotationY: Math.PI
}

let modelAnimationProgress = 0
let modelAnimating = false
const modelAnimationDuration = 3

function startModelAnimation() {
    modelAnimationProgress = 0
    modelAnimating = true
}

let bodyModel = null
gltfLoader.load('./malebase.glb', (gltf) => {
    bodyModel = gltf.scene
    
    // Start inside RANDOM() - very small
    bodyModel.position.set(modelParameters.initialX, modelParameters.initialY, 0)
    bodyModel.scale.set(modelParameters.initialScale, modelParameters.initialScale, modelParameters.initialScale)
    bodyModel.rotation.y = modelParameters.initialRotationY
    
    bodyModel.traverse((child) => {
        if (child.isMesh) child.material = material
    })
    
    scene.add(bodyModel)
    
    // Mark model as ready
    modelReady = true
    console.log('%c👤 Model loaded', 'color: #00ff00')
    
    // GUI controls
    const modelFolder = gui.addFolder('Body Model')
    modelFolder.add(modelParameters, 'initialScale', 0.01, 0.2, 0.001).name('Initial Scale')
    modelFolder.add(modelParameters, 'finalScale', 0.01, 2, 0.01).name('Final Scale')
    modelFolder.add(modelParameters, 'initialX', -3, 3, 0.01).name('Initial X')
    modelFolder.add(modelParameters, 'initialY', -3, 3, 0.01).name('Initial Y')
    modelFolder.add(modelParameters, 'finalX', -3, 3, 0.01).name('Final X')
    modelFolder.add(modelParameters, 'finalY', -5, 1, 0.01).name('Final Y')
})

/**
 * ═══════════════════════════════════════════════════════════════
 * ANIMATION LOOP
 * ═══════════════════════════════════════════════════════════════
 */
const clock = new THREE.Clock()

const tick = () => {
    const deltaTime = clock.getDelta()
    const elapsedTime = clock.getElapsedTime()
    
    // Update holographic material
    material.uniforms.uTime.value = elapsedTime
    
    // Update lattice
    lattice.update(deltaTime, 0)
    
    // Animate body model
    if (bodyModel && modelAnimating) {
        modelAnimationProgress += deltaTime / modelAnimationDuration
        modelAnimationProgress = Math.min(modelAnimationProgress, 1)
        
        const easeProgress = 1 - Math.pow(1 - modelAnimationProgress, 3)
        
        const targetX = modelParameters.initialX + (easeProgress * (modelParameters.finalX - modelParameters.initialX))
        const targetY = modelParameters.initialY + (easeProgress * (modelParameters.finalY - modelParameters.initialY))
        const targetScale = modelParameters.initialScale + (easeProgress * (modelParameters.finalScale - modelParameters.initialScale))
        const targetRotationY = modelParameters.initialRotationY - (easeProgress * (modelParameters.finalRotationY - modelParameters.initialRotationY))
        
        bodyModel.position.x += (targetX - bodyModel.position.x) * 0.1
        bodyModel.position.y += (targetY - bodyModel.position.y) * 0.1
        bodyModel.scale.x += (targetScale - bodyModel.scale.x) * 0.1
        bodyModel.scale.y += (targetScale - bodyModel.scale.y) * 0.1
        bodyModel.scale.z += (targetScale - bodyModel.scale.z) * 0.1
        bodyModel.rotation.y += (targetRotationY - bodyModel.rotation.y) * 0.1
        
        if (modelAnimationProgress >= 1) {
            modelAnimating = false
        }
    }
    
    controls.update()
    renderer.render(scene, camera)
    window.requestAnimationFrame(tick)
}

tick()

// Start loading sequence when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    startLoadingSequence()
})
