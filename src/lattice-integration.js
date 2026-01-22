/**
 * lattice-integration.js
 * 
 * Ejemplo de integración entre LatticeDataManager y Lattice visual
 * Este archivo muestra cómo cargar los datos y crear los nodos de contenido
 * 
 * COPIAR ESTE CÓDIGO A script.js PARA IMPLEMENTAR
 */

import * as THREE from 'three'
import Lattice from './Lattice.js'
import LatticeDataManager from './LatticeDataManager.js'
import latticeData from './data/lattice-data.json'

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inicializa el sistema completo de Lattice con datos
 */
async function initLatticeSystem(scene, camera) {
    // 1. Crear el manager de datos
    const dataManager = new LatticeDataManager()
    
    // 2. Cargar los datos (puede ser desde JSON o fetch)
    await dataManager.load(latticeData)
    
    // 3. Crear la lattice visual
    const lattice = new Lattice(scene, {
        gridSize: { x: 9, y: 7, z: 12 },
        spacing: 1.8,
        nodeBaseSize: 0.08,        // Más pequeño para background
        nodeActiveSize: 0.25,
        connectionOpacity: 0.3,
        nodeColor: new THREE.Color('#8b6f47'),      // Color tenue de fondo
        connectionColor: new THREE.Color('#6b5237'),
        activeColor: new THREE.Color('#ffd700')
    })
    
    // 4. Agregar nodos de contenido desde los datos
    const contentNodes = dataManager.getContentNodesForLattice()
    
    for (const nodeData of contentNodes) {
        lattice.addContentNode(
            nodeData.position,
            nodeData.data,
            {
                size: nodeData.syntpiergy.size,
                color: nodeData.syntpiergy.color,
                intensity: nodeData.syntpiergy.intensity
            }
        )
    }
    
    console.log('🕸️ Lattice System initialized:')
    console.log('   Content nodes:', contentNodes.length)
    console.log('   Stats:', dataManager.getStats())
    
    return { lattice, dataManager }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACCIÓN - HOVER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configura el sistema de hover/resonancia
 */
function setupHoverInteraction(lattice, dataManager, camera, canvas) {
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let hoveredNode = null
    let hoverPreviewElement = null
    
    // Crear elemento de preview
    hoverPreviewElement = createPreviewElement()
    document.body.appendChild(hoverPreviewElement)
    
    canvas.addEventListener('mousemove', (event) => {
        // Normalizar coordenadas
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
        
        // Raycast
        raycaster.setFromCamera(mouse, camera)
        const node = lattice.getNodeAtPosition(raycaster)
        
        if (node && node.isContent) {
            if (hoveredNode !== node) {
                // Nuevo hover
                hoveredNode = node
                
                // Aumentar intensidad de la lattice
                lattice.setGlobalIntensity(0.5)
                
                // Marcar nodo como resonando
                lattice.setNodeResonance(node.instanceId, 1.0)
                
                // Mostrar preview
                showPreview(hoverPreviewElement, node.data, event)
                
                // Cambiar cursor
                canvas.style.cursor = 'pointer'
                
                console.log('Hovering:', node.data.title)
            }
            
            // Actualizar posición del preview
            updatePreviewPosition(hoverPreviewElement, event)
            
        } else if (hoveredNode) {
            // Salió del hover
            hoveredNode = null
            lattice.resetIntensity()
            hidePreview(hoverPreviewElement)
            canvas.style.cursor = 'default'
        }
    })
    
    return { raycaster, mouse, getHoveredNode: () => hoveredNode }
}

/**
 * Crea el elemento HTML de preview
 */
function createPreviewElement() {
    const el = document.createElement('div')
    el.className = 'lattice-preview'
    el.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: rgba(10, 10, 10, 0.95);
        border: 1px solid rgba(212, 165, 116, 0.5);
        border-radius: 8px;
        padding: 16px 20px;
        max-width: 320px;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.2s, transform 0.2s;
        z-index: 1000;
        font-family: 'Cormorant Garamond', serif;
        color: #e0d5c7;
    `
    
    el.innerHTML = `
        <div class="preview-type" style="
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #d4a574;
            margin-bottom: 4px;
        "></div>
        <div class="preview-title" style="
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 4px;
        "></div>
        <div class="preview-subtitle" style="
            font-size: 12px;
            color: #a09080;
            margin-bottom: 8px;
        "></div>
        <div class="preview-description" style="
            font-size: 13px;
            line-height: 1.5;
            color: #c0b5a5;
        "></div>
        <div class="preview-tags" style="
            margin-top: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        "></div>
    `
    
    return el
}

/**
 * Muestra el preview con datos del nodo
 */
function showPreview(element, data, event) {
    element.querySelector('.preview-type').textContent = data.type
    element.querySelector('.preview-title').textContent = data.title
    element.querySelector('.preview-subtitle').textContent = data.subtitle || ''
    element.querySelector('.preview-description').textContent = data.description
    
    // Tags
    const tagsContainer = element.querySelector('.preview-tags')
    tagsContainer.innerHTML = (data.tags || []).slice(0, 5).map(tag => `
        <span style="
            font-size: 10px;
            padding: 3px 8px;
            background: rgba(212, 165, 116, 0.15);
            border-radius: 4px;
            color: #d4a574;
        ">${tag}</span>
    `).join('')
    
    element.style.opacity = '1'
    element.style.transform = 'translateY(0)'
    
    updatePreviewPosition(element, event)
}

/**
 * Actualiza la posición del preview
 */
function updatePreviewPosition(element, event) {
    const offset = 20
    let x = event.clientX + offset
    let y = event.clientY + offset
    
    // Evitar que salga de la pantalla
    const rect = element.getBoundingClientRect()
    if (x + rect.width > window.innerWidth) {
        x = event.clientX - rect.width - offset
    }
    if (y + rect.height > window.innerHeight) {
        y = event.clientY - rect.height - offset
    }
    
    element.style.left = x + 'px'
    element.style.top = y + 'px'
}

/**
 * Oculta el preview
 */
function hidePreview(element) {
    element.style.opacity = '0'
    element.style.transform = 'translateY(10px)'
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACCIÓN - CLICK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configura el sistema de click/materialización
 */
function setupClickInteraction(lattice, dataManager, getHoveredNode, onNodeActivate) {
    window.addEventListener('click', (event) => {
        const hoveredNode = getHoveredNode()
        
        if (hoveredNode && hoveredNode.isContent) {
            // Activar el nodo
            const data = lattice.activateNode(hoveredNode)
            
            // Atenuar toda la lattice excepto el nodo activo
            lattice.setGlobalIntensity(0.05)
            
            // Callback para mostrar contenido
            if (onNodeActivate) {
                onNodeActivate(data)
            }
            
            console.log('Activated node:', data.title)
        }
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACCIÓN - SCROLL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configura el sistema de scroll/viaje dimensional
 */
function setupScrollInteraction(lattice, dataManager) {
    // El scroll se maneja en tick() - aquí solo configuramos efectos adicionales
    
    let lastScrollProgress = 0
    
    return {
        /**
         * Llamar en cada frame con el scroll progress
         */
        update(scrollProgress) {
            // Detectar cambio de "orbital" (capa de profundidad)
            const currentOrbital = Math.floor(scrollProgress * 4)
            const lastOrbital = Math.floor(lastScrollProgress * 4)
            
            if (currentOrbital !== lastOrbital) {
                // Pulso al entrar en nuevo orbital
                lattice.pulse(0.4, 300)
                
                // Log para debug
                console.log(`Entered orbital ${currentOrbital}`)
            }
            
            lastScrollProgress = scrollProgress
            
            // Obtener nodos visibles según scroll
            const visibleNodes = dataManager.getVisibleNodes(scrollProgress)
            
            return {
                orbital: currentOrbital,
                visibleNodesCount: visibleNodes.length
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT PORTAL - Materialización de contenido
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Muestra el contenido de un nodo en el portal central
 */
function showContentPortal(data, onClose) {
    // Crear overlay
    const overlay = document.createElement('div')
    overlay.className = 'content-portal-overlay'
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(10, 10, 10, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s;
    `
    
    // Crear contenedor del portal
    const portal = document.createElement('div')
    portal.className = 'content-portal'
    portal.style.cssText = `
        background: rgba(15, 15, 15, 0.98);
        border: 1px solid rgba(212, 165, 116, 0.3);
        border-radius: 12px;
        padding: 40px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: 'Cormorant Garamond', serif;
        color: #e0d5c7;
        transform: scale(0.9);
        transition: transform 0.3s;
    `
    
    // Contenido
    portal.innerHTML = `
        <button class="portal-close" style="
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: 1px solid rgba(212, 165, 116, 0.3);
            color: #d4a574;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
        ">×</button>
        
        <div class="portal-type" style="
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #d4a574;
            margin-bottom: 8px;
        ">${data.type}</div>
        
        <h1 style="
            font-size: 36px;
            font-weight: 600;
            margin: 0 0 8px 0;
        ">${data.title}</h1>
        
        <h2 style="
            font-size: 18px;
            font-weight: 400;
            color: #a09080;
            margin: 0 0 24px 0;
        ">${data.subtitle || ''}</h2>
        
        <p style="
            font-size: 16px;
            line-height: 1.7;
            margin-bottom: 24px;
        ">${data.description}</p>
        
        ${data.content ? renderContent(data.content) : ''}
        
        ${data.resources ? renderResources(data.resources) : ''}
        
        <div class="portal-tags" style="
            margin-top: 32px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        ">
            ${(data.tags || []).map(tag => `
                <span style="
                    font-size: 11px;
                    padding: 4px 12px;
                    background: rgba(212, 165, 116, 0.1);
                    border: 1px solid rgba(212, 165, 116, 0.2);
                    border-radius: 20px;
                    color: #d4a574;
                ">${tag}</span>
            `).join('')}
        </div>
    `
    
    overlay.appendChild(portal)
    document.body.appendChild(overlay)
    
    // Animación de entrada
    requestAnimationFrame(() => {
        overlay.style.opacity = '1'
        portal.style.transform = 'scale(1)'
    })
    
    // Cerrar
    const closePortal = () => {
        overlay.style.opacity = '0'
        portal.style.transform = 'scale(0.9)'
        setTimeout(() => {
            overlay.remove()
            if (onClose) onClose()
        }, 300)
    }
    
    portal.querySelector('.portal-close').addEventListener('click', closePortal)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePortal()
    })
    
    // Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closePortal()
            window.removeEventListener('keydown', handleEscape)
        }
    }
    window.addEventListener('keydown', handleEscape)
}

/**
 * Renderiza el contenido expandido del nodo
 */
function renderContent(content) {
    if (!content) return ''
    
    let html = '<div class="portal-content" style="margin-top: 24px;">'
    
    if (content.challenge) {
        html += `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #d4a574; margin-bottom: 8px;">
                    El Desafío
                </h3>
                <p style="color: #c0b5a5; line-height: 1.6;">${content.challenge}</p>
            </div>
        `
    }
    
    if (content.solution) {
        html += `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #d4a574; margin-bottom: 8px;">
                    La Solución
                </h3>
                <p style="color: #c0b5a5; line-height: 1.6;">${content.solution}</p>
            </div>
        `
    }
    
    if (content.features) {
        html += `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #d4a574; margin-bottom: 12px;">
                    Características
                </h3>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${content.features.map(f => `
                        <li style="
                            color: #c0b5a5;
                            padding: 6px 0 6px 20px;
                            position: relative;
                        ">
                            <span style="
                                position: absolute;
                                left: 0;
                                color: #d4a574;
                            ">→</span>
                            ${f}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `
    }
    
    if (content.impact) {
        html += `
            <div style="
                margin-top: 24px;
                padding: 16px 20px;
                background: rgba(212, 165, 116, 0.1);
                border-left: 3px solid #d4a574;
                border-radius: 4px;
            ">
                <strong style="color: #d4a574;">Impacto:</strong>
                <span style="color: #e0d5c7;"> ${content.impact}</span>
            </div>
        `
    }
    
    html += '</div>'
    return html
}

/**
 * Renderiza los recursos/links del nodo
 */
function renderResources(resources) {
    if (!resources) return ''
    
    let html = `
        <div class="portal-resources" style="
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid rgba(212, 165, 116, 0.2);
        ">
            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #d4a574; margin-bottom: 16px;">
                Recursos
            </h3>
    `
    
    if (resources.url) {
        html += `
            <a href="${resources.url}" target="_blank" style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #e0d5c7;
                text-decoration: none;
                padding: 8px 16px;
                border: 1px solid rgba(212, 165, 116, 0.3);
                border-radius: 6px;
                margin-right: 12px;
                margin-bottom: 8px;
                transition: all 0.2s;
            ">
                🔗 Ver Proyecto
            </a>
        `
    }
    
    if (resources.repo) {
        html += `
            <a href="${resources.repo}" target="_blank" style="
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: #e0d5c7;
                text-decoration: none;
                padding: 8px 16px;
                border: 1px solid rgba(212, 165, 116, 0.3);
                border-radius: 6px;
                margin-right: 12px;
                margin-bottom: 8px;
            ">
                📂 Repositorio
            </a>
        `
    }
    
    if (resources.tech) {
        html += `
            <div style="margin-top: 16px;">
                <h4 style="font-size: 12px; color: #a09080; margin-bottom: 8px;">Stack Tecnológico:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${resources.tech.map(t => `
                        <span style="
                            font-size: 11px;
                            padding: 4px 10px;
                            background: rgba(0, 212, 170, 0.1);
                            border-radius: 4px;
                            color: #00d4aa;
                        ">${t}</span>
                    `).join('')}
                </div>
            </div>
        `
    }
    
    html += '</div>'
    return html
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR TODO
// ═══════════════════════════════════════════════════════════════════════════

export {
    initLatticeSystem,
    setupHoverInteraction,
    setupClickInteraction,
    setupScrollInteraction,
    showContentPortal
}

// ═══════════════════════════════════════════════════════════════════════════
// EJEMPLO DE USO EN SCRIPT.JS
// ═══════════════════════════════════════════════════════════════════════════

/*
// En script.js:

import {
    initLatticeSystem,
    setupHoverInteraction,
    setupClickInteraction,
    setupScrollInteraction,
    showContentPortal
} from './lattice-integration.js'

// Después de crear scene y camera:

const { lattice, dataManager } = await initLatticeSystem(scene, camera)

const { getHoveredNode } = setupHoverInteraction(lattice, dataManager, camera, canvas)

setupClickInteraction(lattice, dataManager, getHoveredNode, (data) => {
    showContentPortal(data, () => {
        // Al cerrar el portal
        lattice.resetIntensity()
    })
})

const scrollHandler = setupScrollInteraction(lattice, dataManager)

// En tick():
const tick = () => {
    const deltaTime = clock.getDelta()
    const scrollProgress = Math.min(scrollY / (document.body.scrollHeight - window.innerHeight), 1)
    
    // Actualizar lattice
    lattice.update(deltaTime, scrollProgress)
    
    // Actualizar scroll handler
    scrollHandler.update(scrollProgress)
    
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
}
*/
