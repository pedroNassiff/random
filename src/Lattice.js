import * as THREE from 'three'

/**
 * Lattice System - Based on Jacobo Grinberg's Syntergic Theory
 * 
 * Features:
 * - Labels inside nodes with Courier New font
 * - Drag & drop nodes
 * - Zoom controls
 * - Intro animation from far away
 */

class LatticeNode {
    constructor(position, data = null) {
        this.position = position.clone()
        this.originalPosition = position.clone()
        this.data = data
        this.isContent = data !== null
        this.tier = data?.tier || 0
        // Tier 1: Very bright, Tier 2: Very dim
        this.syntpiergy = data?.tier === 1 ? 1.5 : (data?.tier === 2 ? 0.08 : 0.3)
        this.resonance = 0
        this.connections = []
        this.activated = false
        this.label = null
        this.index = -1
        this.size = 0.1
        this.isDragging = false
    }
}

export default class Lattice {
    constructor(scene, options = {}) {
        this.scene = scene
        this.camera = null
        this.options = {
            gridSize: options.gridSize || { x: 5, y: 5, z: 5 },
            spacing: options.spacing || 3,
            nodeBaseSize: options.nodeBaseSize || 0.08,
            nodeActiveSize: options.nodeActiveSize || 0.35,
            connectionOpacity: options.connectionOpacity || 0.6,
            nodeColor: options.nodeColor || new THREE.Color('#d4a574'),
            connectionColor: options.connectionColor || new THREE.Color('#d4a574'),
            depthFadeStart: options.depthFadeStart || 0,
            depthFadeEnd: options.depthFadeEnd || -20,
            ...options
        }
        
        this.nodes = []
        this.contentNodes = []
        this.group = new THREE.Group()
        this.labelsGroup = new THREE.Group()
        this.time = 0
        this.scrollProgress = 0
        this.focusedNode = null
        this.hoveredNode = null
        
        // Intro animation state
        this.introProgress = 0
        this.introComplete = true  // Start as complete, will be set to false when startIntro() is called
        this.introDuration = 2.5
        this.initialZ = -50  // Start far away
        this.targetZ = -6    // End position (more distance for better view)
        
        // Zoom state
        this.isZooming = false
        this.zoomTarget = null
        this.zoomProgress = 0
        this.zoomDuration = 1.2
        this.originalCameraPosition = null
        this.targetCameraPosition = null
        this.onZoomComplete = null
        
        // Drag state
        this.isDragging = false
        this.draggedNode = null
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
        this.dragOffset = new THREE.Vector3()
        
        // Global drag (rotate lattice)
        this.isGlobalDragging = false
        this.lastMousePosition = { x: 0, y: 0 }
        this.targetRotation = { x: 0, y: 0 }
        this.currentRotation = { x: 0, y: 0 }
        
        // Meshes
        this.nodesMesh = null
        this.connectionsMesh = null
        this.nodeMaterial = null
        this.connectionMaterial = null
        
        // Raycaster
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()
        
        // Intensity
        this.baseIntensity = 0.8
        this.currentIntensity = this.baseIntensity
        this.targetIntensity = this.baseIntensity
        
        // Start hidden for intro
        this.group.position.z = this.initialZ
        this.group.scale.setScalar(0.5)
        
        this.init()
    }
    
    setCamera(camera) {
        this.camera = camera
        this.originalCameraPosition = camera.position.clone()
    }
    
    init() {
        this.createNodes()
        this.createConnections()
        this.scene.add(this.group)
        this.scene.add(this.labelsGroup)
        
        console.log('%c🕸️ Lattice initialized:', 'color: #d4a574; font-weight: bold')
        console.log('  Nodes:', this.nodes.length)
    }
    
    /**
     * Start the intro animation (call this when ready)
     */
    startIntro() {
        this.introProgress = 0
        this.introComplete = false
        console.log('%c🚀 Lattice intro started', 'color: #d4a574')
    }
    
    createNodes() {
        const { gridSize, spacing, nodeColor, nodeBaseSize } = this.options
        
        const geometry = new THREE.SphereGeometry(1, 24, 24)
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: nodeColor },
                uGlobalIntensity: { value: this.baseIntensity },
                uDepthFadeStart: { value: this.options.depthFadeStart },
                uDepthFadeEnd: { value: this.options.depthFadeEnd }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying float vDepthFade;
                
                uniform float uDepthFadeStart;
                uniform float uDepthFadeEnd;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    
                    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    
                    float depth = worldPos.z;
                    vDepthFade = smoothstep(uDepthFadeEnd, uDepthFadeStart, depth);
                    vDepthFade = clamp(vDepthFade, 0.2, 1.0);
                    
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColor;
                uniform float uGlobalIntensity;
                
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                varying float vDepthFade;
                
                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
                    fresnel = pow(fresnel, 1.2);
                    
                    float pulse = sin(uTime * 0.5 + vWorldPosition.x * 0.2) * 0.1 + 0.95;
                    
                    vec3 color = uColor * (0.9 + fresnel * 0.4) * vDepthFade;
                    float alpha = uGlobalIntensity * vDepthFade * (0.7 + fresnel * 0.3) * pulse;
                    float core = (1.0 - fresnel) * vDepthFade * 0.5;
                    color += uColor * core;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        })
        
        const totalNodes = gridSize.x * gridSize.y * gridSize.z
        this.nodesMesh = new THREE.InstancedMesh(geometry, material, totalNodes)
        
        const dummy = new THREE.Object3D()
        let index = 0
        
        const offsetX = (gridSize.x - 1) * spacing / 2
        const offsetY = (gridSize.y - 1) * spacing / 2
        
        for (let z = 0; z < gridSize.z; z++) {
            for (let y = 0; y < gridSize.y; y++) {
                for (let x = 0; x < gridSize.x; x++) {
                    const variation = spacing * 0.08
                    const px = x * spacing - offsetX + (Math.random() - 0.5) * variation
                    const py = y * spacing - offsetY + (Math.random() - 0.5) * variation
                    const pz = -z * spacing * 1.0
                    
                    const position = new THREE.Vector3(px, py, pz)
                    
                    const node = new LatticeNode(position)
                    node.index = index
                    this.nodes.push(node)
                    
                    dummy.position.copy(position)
                    dummy.scale.setScalar(nodeBaseSize)
                    dummy.updateMatrix()
                    this.nodesMesh.setMatrixAt(index, dummy.matrix)
                    
                    index++
                }
            }
        }
        
        this.nodesMesh.instanceMatrix.needsUpdate = true
        this.nodesMesh.computeBoundingSphere()
        this.nodesMesh.frustumCulled = false
        
        this.group.add(this.nodesMesh)
        this.nodeMaterial = material
    }
    
    createConnections() {
        const { connectionColor, connectionOpacity, spacing } = this.options
        
        const positions = []
        const maxDistance = spacing * 1.6
        
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i]
            
            for (let j = i + 1; j < this.nodes.length; j++) {
                const otherNode = this.nodes[j]
                const distance = node.position.distanceTo(otherNode.position)
                
                if (distance < maxDistance) {
                    positions.push(
                        node.position.x, node.position.y, node.position.z,
                        otherNode.position.x, otherNode.position.y, otherNode.position.z
                    )
                    node.connections.push({ node: otherNode, distance })
                    otherNode.connections.push({ node: node, distance })
                }
            }
        }
        
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        
        this.connectionMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: connectionColor },
                uOpacity: { value: connectionOpacity },
                uGlobalIntensity: { value: 0.6 },
                uDepthFadeStart: { value: this.options.depthFadeStart },
                uDepthFadeEnd: { value: this.options.depthFadeEnd }
            },
            vertexShader: `
                varying float vDepthFade;
                varying vec3 vPosition;
                uniform float uDepthFadeStart;
                uniform float uDepthFadeEnd;
                
                void main() {
                    vPosition = position;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vDepthFade = smoothstep(uDepthFadeEnd, uDepthFadeStart, worldPos.z);
                    vDepthFade = clamp(vDepthFade, 0.15, 1.0);
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColor;
                uniform float uOpacity;
                uniform float uGlobalIntensity;
                varying float vDepthFade;
                varying vec3 vPosition;
                
                void main() {
                    float pulse = sin(length(vPosition) * 0.3 - uTime * 0.5) * 0.15 + 0.85;
                    float alpha = uGlobalIntensity * uOpacity * vDepthFade * pulse;
                    
                    gl_FragColor = vec4(uColor * vDepthFade * 1.1, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
        
        this.connectionsMesh = new THREE.LineSegments(geometry, this.connectionMaterial)
        this.connectionsMesh.frustumCulled = false
        this.group.add(this.connectionsMesh)
        
        console.log('  Connections:', positions.length / 6)
    }
    
    /**
     * Create label INSIDE the node - COURIER NEW font
     */
    createLabel(text, node, tier = 2) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        const canvasSize = tier === 1 ? 512 : 256
        canvas.width = canvasSize
        canvas.height = canvasSize
        
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Circular background
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, canvas.width / 2
        )
        gradient.addColorStop(0, 'rgba(212, 165, 116, 0.5)')
        gradient.addColorStop(0.5, 'rgba(212, 165, 116, 0.2)')
        gradient.addColorStop(0.8, 'rgba(212, 165, 116, 0.05)')
        gradient.addColorStop(1, 'rgba(212, 165, 116, 0)')
        
        ctx.beginPath()
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 10, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
        
        // COURIER NEW font
        const maxFontSize = tier === 1 ? 56 : 36
        const minFontSize = tier === 1 ? 28 : 18
        let fontSize = maxFontSize
        
        if (text.length > 10) fontSize = Math.max(minFontSize, maxFontSize * 0.8)
        if (text.length > 15) fontSize = Math.max(minFontSize, maxFontSize * 0.6)
        
        ctx.font = `bold ${fontSize}px "Courier Prime", "Courier New", monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Glow effect
        ctx.shadowColor = '#d4a574'
        ctx.shadowBlur = 25
        ctx.fillStyle = '#ffffff'
        
        // Word wrap for long text
        const words = text.toUpperCase().split(' ')
        if (words.length > 1 && text.length > 8) {
            const lineHeight = fontSize * 1.3
            const startY = canvas.height / 2 - (lineHeight * (words.length - 1)) / 2
            
            words.forEach((word, i) => {
                ctx.fillText(word, canvas.width / 2, startY + i * lineHeight)
            })
            
            // Second pass
            ctx.shadowBlur = 10
            words.forEach((word, i) => {
                ctx.fillText(word, canvas.width / 2, startY + i * lineHeight)
            })
        } else {
            ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2)
            ctx.shadowBlur = 10
            ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2)
        }
        
        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            depthTest: true,
            sizeAttenuation: true
        })
        
        const sprite = new THREE.Sprite(material)
        
        const spriteSize = node.size * 2.2
        sprite.scale.set(spriteSize, spriteSize, 1)
        sprite.position.copy(node.position)
        
        node.label = sprite
        sprite.userData.node = node
        
        this.labelsGroup.add(sprite)
        
        return sprite
    }
    
    /**
     * Add a content node
     */
    addContentNode(position, data, options = {}) {
        const tier = data.tier || 2
        let nodeSize
        
        switch (tier) {
            case 1:
                nodeSize = 1.4
                break
            case 2:
                nodeSize = 0.7
                break
            case 3:
                nodeSize = 0.45
                break
            default:
                nodeSize = 0.6
        }
        
        let closestNode = null
        let closestDistance = Infinity
        
        for (const node of this.nodes) {
            if (node.isContent) continue
            const distance = node.position.distanceTo(position)
            if (distance < closestDistance) {
                closestDistance = distance
                closestNode = node
            }
        }
        
        if (closestNode && closestDistance < this.options.spacing * 3) {
            closestNode.data = data
            closestNode.isContent = true
            closestNode.tier = tier
            closestNode.size = nodeSize
            closestNode.syntpiergy = options.intensity || 0.9
            this.contentNodes.push(closestNode)
            
            const dummy = new THREE.Object3D()
            dummy.position.copy(closestNode.position)
            dummy.scale.setScalar(nodeSize)
            dummy.updateMatrix()
            this.nodesMesh.setMatrixAt(closestNode.index, dummy.matrix)
            this.nodesMesh.instanceMatrix.needsUpdate = true
            
            if (data.title) {
                this.createLabel(data.title, closestNode, tier)
            }
            
            return closestNode
        }
        
        return null
    }
    
    /**
     * Handle mouse wheel zoom
     */
    handleWheel(deltaY) {
        if (this.isZooming || !this.introComplete) return
        
        const zoomSpeed = 0.003
        const newZ = this.group.position.z - deltaY * zoomSpeed
        
        // Clamp zoom
        this.group.position.z = Math.max(-30, Math.min(5, newZ))
    }
    
    /**
     * Handle node hover - brighten tier 1 node and illuminate connected tier 2 nodes
     */
    onNodeHover(node) {
        if (!node || !node.isContent) return
        
        // If it's a tier 1 node, brighten it and its connected tier 2 nodes
        if (node.tier === 1) {
            // Brighten the hovered tier 1 node
            node.syntpiergy = 2.0  // Much brighter
            
            // Find and illuminate connected tier 2 nodes
            const parentId = node.data?.id
            if (parentId) {
                for (const n of this.nodes) {
                    if (n.isContent && n.tier === 2 && n.data?.parentId === parentId) {
                        n.syntpiergy = 1.2  // Illuminate tier 2 connections (from 0.08 to 1.2)
                    }
                }
            }
        }
        
        this.hoveredNode = node
    }
    
    /**
     * Handle node hover end - restore original intensities
     */
    onNodeHoverEnd(node) {
        if (!node || !node.isContent) return
        
        // Restore tier 1 node
        if (node.tier === 1) {
            node.syntpiergy = 1.5  // Back to normal bright
            
            // Restore all tier 2 nodes
            const parentId = node.data?.id
            if (parentId) {
                for (const n of this.nodes) {
                    if (n.isContent && n.tier === 2 && n.data?.parentId === parentId) {
                        n.syntpiergy = 0.08  // Back to very dim
                    }
                }
            }
        }
        
        this.hoveredNode = null
    }
    
    /**
     * Start dragging the lattice (global rotation)
     */
    startGlobalDrag(x, y) {
        this.isGlobalDragging = true
        this.lastMousePosition = { x, y }
    }
    
    /**
     * Update global drag
     */
    updateGlobalDrag(x, y) {
        if (!this.isGlobalDragging) return
        
        const deltaX = x - this.lastMousePosition.x
        const deltaY = y - this.lastMousePosition.y
        
        this.targetRotation.y += deltaX * 0.005
        this.targetRotation.x += deltaY * 0.003
        
        // Clamp X rotation
        this.targetRotation.x = Math.max(-0.5, Math.min(0.5, this.targetRotation.x))
        
        this.lastMousePosition = { x, y }
    }
    
    /**
     * End global drag
     */
    endGlobalDrag() {
        this.isGlobalDragging = false
    }
    
    /**
     * Start dragging a node
     */
    startNodeDrag(node, mouseX, mouseY) {
        if (!node || !node.isContent) return false
        
        this.isDragging = true
        this.draggedNode = node
        node.isDragging = true
        
        // Calculate drag plane
        const nodeWorldPos = new THREE.Vector3()
        if (node.label) {
            node.label.getWorldPosition(nodeWorldPos)
        } else {
            nodeWorldPos.copy(node.position)
            this.group.localToWorld(nodeWorldPos)
        }
        
        this.dragPlane.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 0, 1),
            nodeWorldPos
        )
        
        return true
    }
    
    /**
     * Update dragged node position
     */
    updateNodeDrag(mouseX, mouseY) {
        if (!this.isDragging || !this.draggedNode) return
        
        this.mouse.x = mouseX
        this.mouse.y = mouseY
        
        this.raycaster.setFromCamera(this.mouse, this.camera)
        
        const intersection = new THREE.Vector3()
        this.raycaster.ray.intersectPlane(this.dragPlane, intersection)
        
        if (intersection) {
            // Convert to local space
            this.group.worldToLocal(intersection)
            
            this.draggedNode.position.copy(intersection)
            
            // Update mesh instance
            const dummy = new THREE.Object3D()
            dummy.position.copy(intersection)
            dummy.scale.setScalar(this.draggedNode.size)
            dummy.updateMatrix()
            this.nodesMesh.setMatrixAt(this.draggedNode.index, dummy.matrix)
            this.nodesMesh.instanceMatrix.needsUpdate = true
            
            // Update label
            if (this.draggedNode.label) {
                this.draggedNode.label.position.copy(intersection)
            }
        }
    }
    
    /**
     * End node drag
     */
    endNodeDrag() {
        if (this.draggedNode) {
            this.draggedNode.isDragging = false
        }
        this.isDragging = false
        this.draggedNode = null
    }
    
    /**
     * Update every frame
     */
    update(deltaTime, scrollProgress = 0) {
        this.time += deltaTime
        this.scrollProgress = scrollProgress
        
        // Intro animation
        if (!this.introComplete) {
            this.introProgress += deltaTime / this.introDuration
            
            if (this.introProgress >= 1) {
                this.introProgress = 1
                this.introComplete = true
                console.log('%c✨ Lattice intro complete', 'color: #d4a574')
            }
            
            // Ease out cubic
            const t = 1 - Math.pow(1 - this.introProgress, 3)
            
            // Animate position from far to near
            this.group.position.z = this.initialZ + (this.targetZ - this.initialZ) * t
            
            // Animate scale
            const scale = 0.5 + 0.5 * t
            this.group.scale.setScalar(scale)
            this.labelsGroup.scale.setScalar(scale)
            
            // Animate intensity
            this.currentIntensity = this.baseIntensity * t
        } else {
            // Normal operation
            this.currentIntensity += (this.targetIntensity - this.currentIntensity) * 0.08
        }
        
        // Smooth rotation from drag
        this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.1
        this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.1
        
        // Update shaders
        if (this.nodeMaterial) {
            this.nodeMaterial.uniforms.uTime.value = this.time
            this.nodeMaterial.uniforms.uGlobalIntensity.value = this.currentIntensity
        }
        if (this.connectionMaterial) {
            this.connectionMaterial.uniforms.uTime.value = this.time
            this.connectionMaterial.uniforms.uGlobalIntensity.value = this.currentIntensity * 0.7
        }
        
        // Apply rotation (from drag + subtle animation)
        if (!this.isDragging && !this.isGlobalDragging && this.introComplete) {
            this.group.rotation.y = this.currentRotation.y + Math.sin(this.time * 0.06) * 0.02
            this.group.rotation.x = this.currentRotation.x + Math.cos(this.time * 0.08) * 0.01
        } else {
            this.group.rotation.y = this.currentRotation.y
            this.group.rotation.x = this.currentRotation.x
        }
        
        // Sync labels
        this.labelsGroup.rotation.copy(this.group.rotation)
        this.labelsGroup.position.copy(this.group.position)
        
        // Subtle breathing (only after intro)
        if (this.introComplete) {
            const breathe = Math.sin(this.time * 0.3) * 0.006 + 1.0
            this.group.scale.setScalar(breathe)
            this.labelsGroup.scale.setScalar(breathe)
        }
        
        // Update labels
        this.updateLabels()
        
        // Handle zoom animation
        if (this.isZooming && this.camera) {
            this.updateZoom(deltaTime)
        }
    }
    
    updateLabels() {
        if (!this.camera) return
        
        const cameraPos = this.camera.position
        
        for (const node of this.contentNodes) {
            if (!node.label) continue
            
            const worldPos = new THREE.Vector3()
            node.label.getWorldPosition(worldPos)
            
            const distance = cameraPos.distanceTo(worldPos)
            
            const maxDist = 35
            const minDist = 2
            let opacity = 1.0 - ((distance - minDist) / (maxDist - minDist))
            opacity = Math.max(0.15, Math.min(1, opacity))
            
            const depthFade = 1.0 - ((worldPos.z - this.options.depthFadeStart) / 
                                    (this.options.depthFadeEnd - this.options.depthFadeStart))
            const depthOpacity = Math.max(0.2, Math.min(1, depthFade))
            
            // Highlight dragged node
            if (node.isDragging) {
                node.label.material.opacity = 1
            } else {
                node.label.material.opacity = opacity * depthOpacity * (this.introComplete ? 1 : this.introProgress)
            }
            
            const spriteSize = node.size * 2.2
            node.label.scale.set(spriteSize, spriteSize, 1)
        }
    }
    
    getNodeAtPosition(mouseX, mouseY) {
        if (!this.camera) return null
        
        this.mouse.x = mouseX
        this.mouse.y = mouseY
        
        this.raycaster.setFromCamera(this.mouse, this.camera)
        
        // Check labels first
        for (const node of this.contentNodes) {
            if (node.label) {
                const intersects = this.raycaster.intersectObject(node.label)
                if (intersects.length > 0) {
                    return node
                }
            }
        }
        
        // Check mesh
        const intersects = this.raycaster.intersectObject(this.nodesMesh)
        if (intersects.length > 0) {
            const node = this.nodes[intersects[0].instanceId]
            if (node.isContent) return node
        }
        
        return null
    }
    
    zoomToNode(node, onComplete = null) {
        if (!node || !this.camera || this.isZooming) return
        
        this.isZooming = true
        this.zoomTarget = node
        this.zoomProgress = 0
        this.onZoomComplete = onComplete
        
        this.originalCameraPosition = this.camera.position.clone()
        
        const nodeWorldPos = new THREE.Vector3()
        if (node.label) {
            node.label.getWorldPosition(nodeWorldPos)
        } else {
            nodeWorldPos.copy(node.position)
            this.group.localToWorld(nodeWorldPos)
        }
        
        const zoomDistance = node.size * 3 + 1.5
        
        this.targetCameraPosition = nodeWorldPos.clone()
        this.targetCameraPosition.z += zoomDistance
        
        this.setGlobalIntensity(0.2)
        
        if (node.label) {
            node.label.material.opacity = 1.0
        }
        
        console.log('🎯 Zooming to:', node.data?.title)
    }
    
    updateZoom(deltaTime) {
        this.zoomProgress += deltaTime / this.zoomDuration
        
        const t = 1 - Math.pow(1 - Math.min(this.zoomProgress, 1), 3)
        
        this.camera.position.lerpVectors(
            this.originalCameraPosition,
            this.targetCameraPosition,
            t
        )
        
        if (this.zoomTarget) {
            const nodeWorldPos = new THREE.Vector3()
            if (this.zoomTarget.label) {
                this.zoomTarget.label.getWorldPosition(nodeWorldPos)
            } else {
                nodeWorldPos.copy(this.zoomTarget.position)
                this.group.localToWorld(nodeWorldPos)
            }
            this.camera.lookAt(nodeWorldPos)
        }
        
        if (this.zoomProgress >= 1) {
            this.isZooming = false
            this.focusedNode = this.zoomTarget
            if (this.onZoomComplete) {
                this.onZoomComplete(this.zoomTarget)
            }
        }
    }
    
    resetZoom(onComplete = null) {
        if (!this.camera) return
        
        if (!this.originalCameraPosition) {
            this.resetIntensity()
            if (onComplete) onComplete()
            return
        }
        
        this.isZooming = true
        this.zoomProgress = 0
        this.zoomTarget = null
        this.focusedNode = null
        
        const currentPos = this.camera.position.clone()
        this.targetCameraPosition = this.originalCameraPosition.clone()
        this.originalCameraPosition = currentPos
        
        this.onZoomComplete = () => {
            this.resetIntensity()
            this.originalCameraPosition = this.targetCameraPosition.clone()
            if (onComplete) onComplete()
        }
    }
    
    setGlobalIntensity(intensity) {
        this.targetIntensity = intensity
    }
    
    resetIntensity() {
        this.targetIntensity = this.baseIntensity
    }
    
    getContentNodes() {
        return this.contentNodes
    }
    
    dispose() {
        if (this.nodesMesh) {
            this.nodesMesh.geometry.dispose()
            this.nodeMaterial.dispose()
        }
        if (this.connectionsMesh) {
            this.connectionsMesh.geometry.dispose()
            this.connectionMaterial.dispose()
        }
        this.labelsGroup.traverse((child) => {
            if (child.material) {
                child.material.map?.dispose()
                child.material.dispose()
            }
        })
        this.scene.remove(this.group)
        this.scene.remove(this.labelsGroup)
    }
}
