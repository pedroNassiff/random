import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import holographicVertexShader from './shaders/holographic/vertex.glsl'
import holographicFragmentShader from './shaders/holographic/fragment.glsl'
console.log(holographicFragmentShader, holographicVertexShader);

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

window.addEventListener('resize', () =>
{
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
    .onChange(() =>
    {
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
    .onChange(() =>
    {
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
    initialX: 1.123,  // Posición inicial X (dentro del paréntesis)
    initialY: -0.24,  // Posición inicial Y
    finalX: 0,        // Posición final X (centro de pantalla)
    finalY: -4.67,    // Posición final Y (ajustar para mostrar solo cabeza)
    initialRotationY: 0,        // Rotación inicial (de frente) - 0 grados
    finalRotationY: Math.PI     // Rotación final (de espaldas) - 180 grados
}

let bodyModel = null
gltfLoader.load(
    './malebase.glb',
    (gltf) =>
    {
        bodyModel = gltf.scene
        
        // Position model inside the parentheses - offset to the right
        bodyModel.position.set(modelParameters.initialX, modelParameters.initialY, 0)
        bodyModel.scale.set(modelParameters.initialScale, modelParameters.initialScale, modelParameters.initialScale)
        
        // Set initial rotation (facing front)
        bodyModel.rotation.y = modelParameters.initialRotationY
        
        // Apply holographic material
        bodyModel.traverse((child) =>
        {
            if(child.isMesh)
                child.material = material
        })
        
        scene.add(bodyModel)
        
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
        modelFolder.add(modelParameters, 'initialRotationY', 0, Math.PI * 2, 0.01).name('Initial Rotation Y')
        modelFolder.add(modelParameters, 'finalRotationY', 0, Math.PI * 2, 0.01).name('Final Rotation Y (back)')
        modelFolder.add(modelParameters, 'rotationSpeed', 0, 2, 0.1).name('Rotation Speed')
        modelFolder.open()
    }
)

/**
 * Scroll
 */
let scrollY = 0

window.addEventListener('scroll', () =>
{
    scrollY = window.scrollY
})

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update material time uniform
    material.uniforms.uTime.value = elapsedTime
    
    // Animate body model based on scroll
    if(bodyModel)
    {
        // Normalizar el scroll: dividir por el total scrollable (3 secciones de 100vh)
        const totalScrollHeight = document.body.scrollHeight - window.innerHeight
        const scrollProgress = Math.min(scrollY / totalScrollHeight, 1) // Clamp a 1
        
        // Ease out cubic para movimiento suave curvo (aceleración al inicio, desaceleración al final)
        const easeProgress = 1 - Math.pow(1 - scrollProgress, 3)
        
        // Movimiento en X: desde posición inicial hacia posición final
        const initialX = modelParameters.initialX
        const finalX = modelParameters.finalX // usa la variable configurable
        const targetX = initialX + (easeProgress * (finalX - initialX))
        
        // Movimiento en Y: desde posición inicial hacia posición final (solo cabeza visible)
        const initialY = modelParameters.initialY
        const finalY = modelParameters.finalY // usa la variable configurable para debugear
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
    }

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()