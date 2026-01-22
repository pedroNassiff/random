/**
 * Integration Example: How to use Lattice system in your script.js
 * 
 * This file shows the key changes needed to replace the tesseract
 * with the Lattice system while keeping all existing functionality.
 */

// ============================================
// IMPORTS TO ADD (at the top of script.js)
// ============================================

import Lattice from './Lattice.js'
import ContentPortal from './ContentPortal.js'

// ============================================
// REMOVE: The old tesseract creation code
// ============================================

/*
DELETE THIS SECTION:

const tesseractGroup = new THREE.Group()
const layers = 15
for (let i = 0; i < layers; i++) {
    const depth = i * 4
    const size = 20 + i * 3
    const boxGeometry = new THREE.BoxGeometry(size, size, size, 2, 2, 2)
    const edges = new THREE.EdgesGeometry(boxGeometry)
    ...
}
scene.add(tesseractGroup)
*/

// ============================================
// ADD: Lattice and Portal creation
// ============================================

// Create the Lattice (replace tesseractGroup)
const lattice = new Lattice(scene, {
    gridSize: { x: 7, y: 5, z: 12 },   // More depth for dimensional travel
    spacing: 2.5,
    nodeBaseSize: 0.08,
    nodeActiveSize: 0.25,
    connectionOpacity: 0.1,
    nodeColor: new THREE.Color('#d4a574'),      // Interstellar gold
    connectionColor: new THREE.Color('#8b6f47'), // Dark gold
    activeColor: new THREE.Color('#ffd700'),     // Bright gold
    breathingSpeed: 0.3,
    resonanceDecay: 2.0
})

// Position the lattice to surround the viewer
lattice.group.position.set(0, 0, -15)

// Create the content portal (where content "paints" when activated)
const contentPortal = new ContentPortal(scene, {
    position: new THREE.Vector3(0, 0, 2),
    size: { width: 5, height: 3.5 },
    borderColor: new THREE.Color('#d4a574'),
    activeColor: new THREE.Color('#ffd700')
})

// ============================================
// ADD: Content nodes for projects/services
// ============================================

// Define your content positions in the lattice
const contentItems = [
    {
        position: new THREE.Vector3(-3, 1, -5),
        data: { 
            id: 'proyecto-01',
            title: 'Proyecto 01', 
            description: 'Explorando la creatividad a través del código generativo.',
            type: 'project',
            color: '#00ffff'
        }
    },
    {
        position: new THREE.Vector3(0, 2, -8),
        data: { 
            id: 'proyecto-02',
            title: 'Proyecto 02', 
            description: 'Rompiendo las reglas para descubrir nuevas formas.',
            type: 'project',
            color: '#ff00ff'
        }
    },
    {
        position: new THREE.Vector3(3, 0, -12),
        data: { 
            id: 'proyecto-03',
            title: 'Proyecto 03', 
            description: 'La imperfección como fuente de belleza.',
            type: 'project',
            color: '#ffff00'
        }
    },
    {
        position: new THREE.Vector3(-4, -1, -3),
        data: { 
            id: 'servicios',
            title: 'Servicios', 
            description: 'Desarrollo web, 3D, UX/UI, y más.',
            type: 'service',
            color: '#00ff00'
        }
    },
    {
        position: new THREE.Vector3(4, 1, -6),
        data: { 
            id: 'sobre-mi',
            title: 'Sobre Mí', 
            description: 'CTO, desarrollador fullstack, explorador de dimensiones.',
            type: 'about',
            color: '#ff8800'
        }
    },
]

// Add content nodes to the lattice
const contentNodes = contentItems.map(item => {
    return lattice.addContentNode(item.position, item.data)
})

// ============================================
// ADD: Raycaster for interaction
// ============================================

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let hoveredNode = null

// Mouse move handler
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // Update raycaster
    raycaster.setFromCamera(mouse, camera)
    
    // Check for hovered node
    const node = lattice.getNodeAtPosition(raycaster)
    
    if (node && node.isContent) {
        if (hoveredNode !== node) {
            // New node hovered
            hoveredNode = node
            lattice.setNodeResonance(node, 0.8)
            document.body.style.cursor = 'pointer'
            
            // Could show tooltip or preview here
            console.log('Hovering:', node.data.title)
        }
    } else if (hoveredNode) {
        // Left the node
        lattice.setNodeResonance(hoveredNode, 0)
        hoveredNode = null
        document.body.style.cursor = 'default'
    }
})

// Click handler
window.addEventListener('click', (event) => {
    if (hoveredNode) {
        // Activate the node
        const data = lattice.activateNode(hoveredNode)
        
        if (data) {
            console.log('Activated:', data.title)
            
            // Show content in the portal
            contentPortal.activate(data, () => {
                console.log('Portal animation complete')
                // Here you would render the actual content
                // Could be HTML overlay, DOM elements, etc.
            })
        }
    }
})

// ============================================
// MODIFY: The tick() animation loop
// ============================================

const tick = () => {
    const deltaTime = clock.getDelta()
    const elapsedTime = clock.getElapsedTime()

    // Update material time uniform
    material.uniforms.uTime.value = elapsedTime
    
    // Calculate scroll progress (0 to 1)
    const maxScroll = document.body.scrollHeight - window.innerHeight
    const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0
    
    // ============================================
    // REMOVE: Old tesseract animation
    // ============================================
    /*
    DELETE THIS:
    tesseractGroup.children.forEach((box, index) => {
        box.rotation.x = scrollProgress * 0.3 * (index + 1)
        box.rotation.y = scrollProgress * 0.5 * (index + 1)
        box.rotation.z = scrollProgress * 0.2 * (index + 1)
    })
    tesseractGroup.rotation.y = Math.sin(scrollProgress * 2) * 0.1
    tesseractGroup.rotation.x = Math.cos(scrollProgress * 3) * 0.05
    const breathe = Math.sin(scrollProgress * 4) * 0.15 + 1
    tesseractGroup.scale.setScalar(breathe)
    */
    
    // ============================================
    // ADD: Lattice and portal updates
    // ============================================
    
    // Update lattice with scroll progress
    lattice.update(deltaTime, scrollProgress)
    
    // Update content portal
    contentPortal.update(deltaTime)
    
    // ============================================
    // KEEP: All existing code for buttons, model, etc.
    // ============================================
    
    // ... chakra detection, button glitch wave, etc.
    // ... model animation
    // ... element animations
    // ... controls update
    // ... render
    
    window.requestAnimationFrame(tick)
}

// ============================================
// ADD: Random Disruption Effect
// ============================================

function triggerRandomDisruption() {
    console.log('🌀 RANDOM DISRUPTION')
    
    // 1. Visual glitch on all nodes
    const originalPositions = lattice.nodes.map(n => n.position.clone())
    
    lattice.nodes.forEach((node, i) => {
        // Random offset
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3
        )
        
        // Apply temporarily
        node.position.add(offset)
    })
    
    // 2. Update visual
    lattice.nodesMesh.instanceMatrix.needsUpdate = true
    
    // 3. Glitch on title
    const titleStatic = document.querySelector('.title-static')
    if (titleStatic) {
        const glitch = new GlitchText(titleStatic, titleStatic.textContent)
        glitch.animate()
    }
    
    // 4. Return to coherence after delay
    setTimeout(() => {
        lattice.nodes.forEach((node, i) => {
            node.position.copy(originalPositions[i])
        })
        lattice.nodesMesh.instanceMatrix.needsUpdate = true
        console.log('✨ Coherence restored')
    }, 1500)
}

// Random trigger (every 30-60 seconds randomly)
function scheduleRandomDisruption() {
    const delay = 30000 + Math.random() * 30000 // 30-60 seconds
    setTimeout(() => {
        triggerRandomDisruption()
        scheduleRandomDisruption() // Schedule next
    }, delay)
}

// Start random disruptions after initial load
setTimeout(scheduleRandomDisruption, 10000)

// Also trigger on specific key press (secret feature)
window.addEventListener('keydown', (e) => {
    if (e.key === 'r' && e.ctrlKey) {
        triggerRandomDisruption()
    }
})

// ============================================
// ADD: Connect navigation buttons to lattice
// ============================================

// When navigation buttons are created, connect them to lattice nodes
function connectButtonToNode(buttonElement, nodeData) {
    buttonElement.addEventListener('click', () => {
        // Find the node with this data
        const node = lattice.contentNodes.find(n => n.data.id === nodeData.id)
        if (node) {
            lattice.activateNode(node)
            contentPortal.activate(node.data)
            
            // Scroll to bring node into focus
            // Could animate camera here too
        }
    })
    
    buttonElement.addEventListener('mouseenter', () => {
        const node = lattice.contentNodes.find(n => n.data.id === nodeData.id)
        if (node) {
            lattice.setNodeResonance(node, 0.8)
        }
    })
    
    buttonElement.addEventListener('mouseleave', () => {
        const node = lattice.contentNodes.find(n => n.data.id === nodeData.id)
        if (node) {
            lattice.setNodeResonance(node, 0)
        }
    })
}
