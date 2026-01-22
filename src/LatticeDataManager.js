/**
 * LatticeDataManager.js
 * 
 * Gestiona los datos de la Lattice - nodos, conexiones y contenido.
 * Prepara la información para ser visualizada en el sistema 3D.
 * 
 * Inspirado en la Teoría Sintérgica: cada nodo es una "distorsión"
 * en la Lattice que contiene información específica.
 */

import * as THREE from 'three'

export default class LatticeDataManager {
    constructor() {
        this.nodes = new Map()           // id -> node
        this.connections = []            // array de conexiones
        this.nodesByType = new Map()     // type -> [nodes]
        this.nodesByTier = new Map()     // tier -> [nodes]
        this.settings = {}
        this.loaded = false
    }

    /**
     * Carga los datos desde el JSON
     * @param {string} path - Ruta al archivo JSON (o datos inline)
     */
    async load(dataOrPath = null) {
        try {
            let data
            
            if (typeof dataOrPath === 'object' && dataOrPath !== null) {
                // Datos pasados directamente
                data = dataOrPath
            } else {
                // Cargar desde archivo
                const response = await fetch(dataOrPath || '/src/data/lattice-data.json')
                data = await response.json()
            }
            
            this.parseData(data)
            this.loaded = true
            
            console.log('%c LatticeDataManager loaded:', 'color: #00ff00; font-weight: bold')
            console.log(`   Nodes: ${this.nodes.size}`)
            console.log(`   Connections: ${this.connections.length}`)
            console.log(`   Types: ${Array.from(this.nodesByType.keys()).join(', ')}`)
            
            return this
        } catch (error) {
            console.error('Failed to load lattice data:', error)
            throw error
        }
    }

    /**
     * Parsea y organiza los datos
     */
    parseData(data) {
        // Guardar settings
        this.settings = data.settings || {}
        
        // Procesar nodos
        for (const node of data.nodes) {
            // Convertir posición a THREE.Vector3
            node.position3D = new THREE.Vector3(
                node.position.x,
                node.position.y,
                node.position.z
            )
            
            // Convertir colores a THREE.Color (with fallbacks)
            const colorData = node.syntpiergy?.color || {}
            node.colors = {
                primary: colorData.primary 
                    ? new THREE.Color(colorData.primary) 
                    : new THREE.Color('#d4a574'),
                secondary: colorData.secondary 
                    ? new THREE.Color(colorData.secondary) 
                    : null,
                glow: colorData.glow 
                    ? new THREE.Color(colorData.glow) 
                    : null
            }
            
            // Almacenar en maps
            this.nodes.set(node.id, node)
            
            // Organizar por tipo
            if (!this.nodesByType.has(node.type)) {
                this.nodesByType.set(node.type, [])
            }
            this.nodesByType.get(node.type).push(node)
            
            // Organizar por tier
            if (!this.nodesByTier.has(node.tier)) {
                this.nodesByTier.set(node.tier, [])
            }
            this.nodesByTier.get(node.tier).push(node)
        }
        
        // Procesar conexiones (extraer de cada nodo)
        for (const node of data.nodes) {
            if (node.connections) {
                for (const conn of node.connections) {
                    this.connections.push({
                        sourceId: node.id,
                        targetId: conn.targetId,
                        type: conn.type,
                        strength: conn.strength,
                        bidirectional: conn.bidirectional,
                        label: conn.label
                    })
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Obtiene un nodo por ID
     */
    getNode(id) {
        return this.nodes.get(id)
    }

    /**
     * Obtiene todos los nodos
     */
    getAllNodes() {
        return Array.from(this.nodes.values())
    }

    /**
     * Obtiene nodos por tipo
     */
    getNodesByType(type) {
        return this.nodesByType.get(type) || []
    }

    /**
     * Obtiene nodos por tier
     */
    getNodesByTier(tier) {
        return this.nodesByTier.get(tier) || []
    }

    /**
     * Obtiene nodos primarios (tier 1) - las secciones principales
     */
    getPrimaryNodes() {
        return this.getNodesByTier(1)
    }

    /**
     * Obtiene nodos secundarios (tier 2) - proyectos, servicios, etc
     */
    getSecondaryNodes() {
        return this.getNodesByTier(2)
    }

    /**
     * Obtiene nodos terciarios (tier 3) - detalles, referencias
     */
    getTertiaryNodes() {
        return this.getNodesByTier(3)
    }

    /**
     * Obtiene los hijos de un nodo
     */
    getChildren(parentId) {
        return this.getAllNodes().filter(node => node.parentId === parentId)
    }

    /**
     * Obtiene las conexiones de un nodo
     */
    getNodeConnections(nodeId) {
        return this.connections.filter(
            conn => conn.sourceId === nodeId || 
                   (conn.bidirectional && conn.targetId === nodeId)
        )
    }

    /**
     * Obtiene nodos conectados a un nodo específico
     */
    getConnectedNodes(nodeId) {
        const connections = this.getNodeConnections(nodeId)
        const connectedIds = new Set()
        
        for (const conn of connections) {
            if (conn.sourceId === nodeId) {
                connectedIds.add(conn.targetId)
            } else {
                connectedIds.add(conn.sourceId)
            }
        }
        
        return Array.from(connectedIds).map(id => this.getNode(id)).filter(Boolean)
    }

    // ═══════════════════════════════════════════════════════════════
    // BÚSQUEDA Y FILTROS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Busca nodos por tag
     */
    searchByTag(tag) {
        const normalizedTag = tag.toLowerCase()
        return this.getAllNodes().filter(node => 
            node.tags.some(t => t.toLowerCase().includes(normalizedTag))
        )
    }

    /**
     * Busca nodos por texto (title, description)
     */
    searchByText(query) {
        const normalizedQuery = query.toLowerCase()
        return this.getAllNodes().filter(node => 
            node.title.toLowerCase().includes(normalizedQuery) ||
            node.description.toLowerCase().includes(normalizedQuery) ||
            (node.subtitle && node.subtitle.toLowerCase().includes(normalizedQuery))
        )
    }

    /**
     * Filtra nodos por sintergía mínima
     */
    filterByMinIntensity(minIntensity) {
        return this.getAllNodes().filter(node => 
            node.syntpiergy.intensity >= minIntensity
        )
    }

    /**
     * Obtiene nodos visibles según el scroll progress
     * Tier 1: siempre visible
     * Tier 2: visible a partir de 25% scroll
     * Tier 3: visible a partir de 50% scroll
     */
    getVisibleNodes(scrollProgress) {
        return this.getAllNodes().filter(node => {
            if (node.tier === 1) return true
            if (node.tier === 2) return scrollProgress >= 0.25
            if (node.tier === 3) return scrollProgress >= 0.50
            return false
        })
    }

    // ═══════════════════════════════════════════════════════════════
    // CONVERSIÓN PARA LATTICE.JS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Genera datos para crear nodos de contenido en la Lattice visual
     * Ordena por tier para que tier 1 se procese primero (al frente)
     * @returns {Array} Array de objetos listos para Lattice.addContentNode()
     */
    getContentNodesForLattice() {
        // Sort by tier so tier 1 gets processed first
        const sortedNodes = this.getAllNodes().sort((a, b) => a.tier - b.tier)
        
        return sortedNodes.map(node => ({
            id: node.id,
            slug: node.slug,
            position: node.position3D.clone(),
            data: {
                id: node.id,
                type: node.type,
                tier: node.tier,
                title: node.title,
                subtitle: node.subtitle,
                description: node.description,
                tags: node.tags,
                content: node.content,
                resources: node.resources
            },
            syntpiergy: {
                intensity: node.syntpiergy?.intensity || 0.8,
                resonance: node.syntpiergy?.resonance || 0.7,
                size: this.sizeToScale(node.syntpiergy?.size),
                color: node.colors?.primary || new THREE.Color('#d4a574'),
                glowColor: node.colors?.glow || node.colors?.primary || new THREE.Color('#d4a574')
            }
        }))
    }

    /**
     * Genera datos de conexiones para la Lattice visual
     * @returns {Array} Array de conexiones con posiciones 3D
     */
    getConnectionsForLattice() {
        return this.connections.map(conn => {
            const source = this.getNode(conn.sourceId)
            const target = this.getNode(conn.targetId)
            
            if (!source || !target) return null
            
            return {
                from: source.position3D.clone(),
                to: target.position3D.clone(),
                strength: conn.strength,
                type: conn.type,
                color: this.getConnectionColor(conn.type)
            }
        }).filter(Boolean)
    }

    /**
     * Convierte tamaño string a escala numérica
     */
    sizeToScale(size) {
        const scales = {
            'sm': 0.1,
            'md': 0.15,
            'lg': 0.2,
            'xl': 0.25
        }
        return scales[size] || 0.15
    }

    /**
     * Obtiene color de conexión según tipo
     */
    getConnectionColor(type) {
        const colors = {
            'parent': '#ffd700',      // Dorado fuerte
            'related': '#c9a066',     // Dorado medio
            'reference': '#8b6f47',   // Marrón dorado
            'sequence': '#d4a574',    // Dorado claro
            'tech': '#00d4aa'         // Verde tech
        }
        return new THREE.Color(colors[type] || '#8b6f47')
    }

    // ═══════════════════════════════════════════════════════════════
    // UTILIDADES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Obtiene estadísticas de la lattice
     */
    getStats() {
        return {
            totalNodes: this.nodes.size,
            totalConnections: this.connections.length,
            nodesByType: Object.fromEntries(
                Array.from(this.nodesByType.entries()).map(([type, nodes]) => [type, nodes.length])
            ),
            nodesByTier: Object.fromEntries(
                Array.from(this.nodesByTier.entries()).map(([tier, nodes]) => [tier, nodes.length])
            ),
            avgIntensity: this.getAllNodes().reduce((sum, n) => sum + n.syntpiergy.intensity, 0) / this.nodes.size
        }
    }

    /**
     * Exporta los datos (útil para debugging)
     */
    export() {
        return {
            nodes: this.getAllNodes(),
            connections: this.connections,
            settings: this.settings,
            stats: this.getStats()
        }
    }
}
