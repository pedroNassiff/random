import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import GUI from 'lil-gui'
import * as satellite from 'satellite.js'
import earthVertexShader from './shaders/earth/vertex.glsl'
import earthFragmentShader from './shaders/earth/fragment.glsl'
import athmosphereVertexShader from './shaders/athmosphere/vertex.glsl'
import athmosphereFragmentShader from './shaders/athmosphere/fragment.glsl'
import { SatelliteLayer } from './satellites/SatelliteLayer.js'
import { REGISTRY } from './satellites/registry.js'
import { getSunDirection } from './satellites/sunPosition.js'

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
const textureLoader = new THREE.TextureLoader()


/**
 * Earth
 */

const earthParameter = {}
earthParameter.athmosphereDayColor = '#00aaff'
earthParameter.athmosphereTwilightColor = '#ff6600'


// gui
//     .addColor(earthParameter, 'athmosphereDayColor')
//     .onChange(() => {
//         earthMaterial.uniforms.uAthmosphereDayColor.value.set(earthParameter.athmosphereDayColor)
//         athmosphereMaterial.uniforms.uAthmosphereDayColor.value.set(earthParameter.athmosphereDayColor)
//     })
//     .name('athmosphere day color')
// gui
//     .addColor(earthParameter, 'athmosphereTwilightColor')
//     .onChange(() => {
//         earthMaterial.uniforms.uAthmosphereTwilightColor.value.set(earthParameter.athmosphereTwilightColor)
//         athmosphereMaterial.uniforms.uAthmosphereTwilightColor.value.set(earthParameter.athmosphereTwilightColor)
//     })
//     .name('athmosphere twilight color')

// Mesh
// load de textures
const earthDayTexture = textureLoader.load('/earth/day.jpg')
earthDayTexture.colorSpace = THREE.SRGBColorSpace
earthDayTexture.anisotropy = 8 


const earthNightTexture = textureLoader.load('/earth/night.jpg')
earthNightTexture.colorSpace = THREE.SRGBColorSpace
earthNightTexture.anisotropy = 8

const earthSpecularCloudsTexture = textureLoader.load('/earth/specularClouds.jpg')
earthSpecularCloudsTexture.anisotropy = 8

const earthGeometry = new THREE.SphereGeometry(2, 64, 64)
const earthMaterial = new THREE.ShaderMaterial({
    vertexShader: earthVertexShader,
    fragmentShader: earthFragmentShader,
    uniforms:
    {
        uDayTexture: { value: earthDayTexture },
        uNightTexture: { value: earthNightTexture },
        uSpecularCloudsTexture: { value: earthSpecularCloudsTexture },
        uSunDirection: new THREE.Uniform(new THREE.Vector3(0 , 0, 1)),
        uAthmosphereDayColor: new THREE.Uniform(new THREE.Color(earthParameter.athmosphereDayColor)),
        uAthmosphereTwilightColor: new THREE.Uniform(new THREE.Color(earthParameter.athmosphereTwilightColor))
    }
})
const earth = new THREE.Mesh(earthGeometry, earthMaterial)
scene.add(earth)

// athmosphere
const athmosphereMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    vertexShader: athmosphereVertexShader,
    fragmentShader: athmosphereFragmentShader,
    uniforms:
    {
        uSunDirection: new THREE.Uniform(new THREE.Vector3(0 , 0, 1)),
        uAthmosphereDayColor: new THREE.Uniform(new THREE.Color(earthParameter.athmosphereDayColor)),
        uAthmosphereTwilightColor: new THREE.Uniform(new THREE.Color(earthParameter.athmosphereTwilightColor))
    }
})
const athmosphere = new THREE.Mesh(earthGeometry, athmosphereMaterial)
athmosphere.scale.set(1.05, 1.05, 1.05)
scene.add(athmosphere)


// sun — marcador visual (posición calculada en tiempo real)
const debugSun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.1, 2),
    new THREE.MeshBasicMaterial({ color: '#ffff00' })
)
scene.add(debugSun)

// Primera actualización del sol con la fecha real
const updateRealtimeSun = (date = new Date()) => {
    const dir = getSunDirection(date)
    earthMaterial.uniforms.uSunDirection.value.copy(dir)
    athmosphereMaterial.uniforms.uSunDirection.value.copy(dir)
    debugSun.position.copy(dir).multiplyScalar(5)
}
updateRealtimeSun()

/**
 * Satellites
 */
const satelliteLayer = new SatelliteLayer(scene)

// Estado de visibilidad por grupo, construido desde el registry
const satState = Object.fromEntries(Object.keys(REGISTRY).map(k => [k, false]))

const satFolder = gui.addFolder('Satellites')
const satControllers = {}

const updateCounterLabel = (group, ctrl) => {
    const count = satelliteLayer.getCount(group)
    const label = REGISTRY[group].label
    ctrl.name(`${label} (${count})`)
}

for (const [group, config] of Object.entries(REGISTRY)) {
    const ctrl = satFolder
        .add(satState, group)
        .name(config.label)
        .onChange(async (value) => {
            if (value && !satelliteLayer.groups[group]) {
                ctrl.name(`${config.label} (loading...)`)
                await satelliteLayer.loadGroup(group)
                updateCounterLabel(group, ctrl)
            }
            satelliteLayer.setVisible(group, value)
        })
    satControllers[group] = ctrl

    // Tooltip "?"
    if (config.description) {
        const btn = document.createElement('span')
        btn.className = 'sat-info-btn'
        btn.textContent = '?'

        const tip = document.createElement('span')
        tip.className = 'sat-tooltip'
        tip.textContent = config.description
        btn.appendChild(tip)

        // lil-gui expone el DOM del controller en .domElement
        const widget = ctrl.domElement.querySelector('.widget') ?? ctrl.domElement
        widget.style.display = 'flex'
        widget.style.alignItems = 'center'
        widget.appendChild(btn)
    }
}

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(sizes.pixelRatio)
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(25, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 12
camera.position.y = 5
camera.position.z = 4
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Posiciona la cámara frente a una coordenada geográfica real,
 * teniendo en cuenta la rotación actual de la Tierra (GMST).
 * @param {number} latDeg - latitud en grados
 * @param {number} lonDeg - longitud en grados
 */
const positionCameraAt = (latDeg, lonDeg) => {
    const now   = new Date()
    const gmst  = satellite.gstime(now)
    const lat   = latDeg * Math.PI / 180
    const lon   = lonDeg * Math.PI / 180
    const angle = lon + gmst          // longitud geográfica → ECI azimut

    const camDist = camera.position.length()

    // ECI → Three.js: THREE.x = ECI.x, THREE.y = ECI.z (norte), THREE.z = ECI.y
    camera.position.set(
        Math.cos(lat) * Math.cos(angle) * camDist,
        Math.sin(lat)                   * camDist,
        Math.cos(lat) * Math.sin(angle) * camDist,
    )
    camera.lookAt(0, 0, 0)
    controls.update()
    console.log(`[Geo] Cámara → lat=${latDeg.toFixed(2)}° lon=${lonDeg.toFixed(2)}°`)
}

// Default: Barcelona
const BARCELONA = { lat: 41.3874, lon: 2.1686 }
positionCameraAt(BARCELONA.lat, BARCELONA.lon)

// Intentar geolocalización real — sobreescribe Barcelona si el usuario acepta
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => positionCameraAt(pos.coords.latitude, pos.coords.longitude),
        (err) => console.info('[Geo] Sin permiso de ubicación, usando Barcelona por defecto:', err.message)
    )
}

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)
renderer.setClearColor('#000011')


/**
 * Animate
 */
let sunUpdateCounter = 0

const tick = () =>
{
    const now = new Date()

    // Rotación real de la Tierra: GMST negativo → gira hacia el este (antihorario desde el Polo Norte)
    earth.rotation.y = -satellite.gstime(now)

    // Actualizar la posición del Sol cada 60 frames (~1 vez/seg)
    sunUpdateCounter++
    if (sunUpdateCounter % 60 === 0) updateRealtimeSun(now)

    // Satellites — update posiciones en ECI en tiempo real
    satelliteLayer.update(now)

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()