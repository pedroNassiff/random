/**
 * Content Portal - The "painting" area where content materializes
 * 
 * Based on the Syntergic concept: when you focus (high directionality),
 * the information "distortion" in the Lattice becomes clear and accessible.
 * 
 * This represents the "center of the tesseract" where information is painted.
 */

import * as THREE from 'three'

export default class ContentPortal {
    constructor(scene, options = {}) {
        this.scene = scene
        this.options = {
            position: options.position || new THREE.Vector3(0, 0, 2),
            size: options.size || { width: 4, height: 3 },
            borderColor: options.borderColor || new THREE.Color('#d4a574'),
            activeColor: options.activeColor || new THREE.Color('#ffd700'),
            ...options
        }
        
        this.group = new THREE.Group()
        this.isActive = false
        this.currentContent = null
        this.time = 0
        this.activationProgress = 0
        
        this.init()
    }
    
    init() {
        this.createPortalFrame()
        this.createPortalSurface()
        this.group.position.copy(this.options.position)
        this.group.visible = false // Hidden until activated
        this.scene.add(this.group)
    }
    
    createPortalFrame() {
        const { width, height } = this.options.size
        
        // Create frame using lines
        const framePoints = [
            new THREE.Vector3(-width/2, -height/2, 0),
            new THREE.Vector3(width/2, -height/2, 0),
            new THREE.Vector3(width/2, height/2, 0),
            new THREE.Vector3(-width/2, height/2, 0),
            new THREE.Vector3(-width/2, -height/2, 0), // Close the loop
        ]
        
        const frameGeometry = new THREE.BufferGeometry().setFromPoints(framePoints)
        
        this.frameMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: this.options.borderColor },
                uActiveColor: { value: this.options.activeColor },
                uProgress: { value: 0 } // 0 = hidden, 1 = fully visible
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColor;
                uniform vec3 uActiveColor;
                uniform float uProgress;
                
                varying vec3 vPosition;
                
                void main() {
                    // Animated drawing effect
                    float lineProgress = fract(uTime * 0.5);
                    
                    // Glow pulse
                    float pulse = sin(uTime * 3.0) * 0.3 + 0.7;
                    
                    vec3 color = mix(uColor, uActiveColor, pulse * uProgress);
                    float alpha = uProgress * pulse;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
        
        this.frameLine = new THREE.Line(frameGeometry, this.frameMaterial)
        this.group.add(this.frameLine)
    }
    
    createPortalSurface() {
        const { width, height } = this.options.size
        
        // Inner surface where content appears
        const surfaceGeometry = new THREE.PlaneGeometry(width - 0.2, height - 0.2, 32, 32)
        
        this.surfaceMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uProgress: { value: 0 },
                uColor: { value: this.options.borderColor }
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float uTime;
                uniform float uProgress;
                
                void main() {
                    vUv = uv;
                    
                    // Subtle wave distortion when activating
                    vec3 pos = position;
                    float wave = sin(uv.x * 10.0 + uTime * 2.0) * 0.02 * (1.0 - uProgress);
                    wave += sin(uv.y * 8.0 + uTime * 1.5) * 0.02 * (1.0 - uProgress);
                    pos.z += wave;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uProgress;
                uniform vec3 uColor;
                
                varying vec2 vUv;
                
                void main() {
                    // Grid pattern (like the tesseract library shelves)
                    float gridX = abs(fract(vUv.x * 20.0) - 0.5);
                    float gridY = abs(fract(vUv.y * 15.0) - 0.5);
                    float grid = smoothstep(0.45, 0.5, min(gridX, gridY));
                    
                    // Fade from edges
                    float edgeFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
                    edgeFade *= smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
                    
                    // Scanline effect
                    float scanline = sin(vUv.y * 200.0 + uTime * 5.0) * 0.05 + 0.95;
                    
                    vec3 color = uColor * grid * 0.3;
                    float alpha = uProgress * edgeFade * 0.15 * scanline;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        })
        
        this.surfaceMesh = new THREE.Mesh(surfaceGeometry, this.surfaceMaterial)
        this.surfaceMesh.position.z = -0.01 // Slightly behind frame
        this.group.add(this.surfaceMesh)
    }
    
    /**
     * Activate the portal with content
     */
    activate(content, onComplete) {
        this.currentContent = content
        this.isActive = true
        this.group.visible = true
        this.activationProgress = 0
        
        // Animate activation
        const animate = () => {
            this.activationProgress += 0.02
            
            if (this.activationProgress >= 1) {
                this.activationProgress = 1
                if (onComplete) onComplete()
                return
            }
            
            requestAnimationFrame(animate)
        }
        
        animate()
    }
    
    /**
     * Deactivate and hide the portal
     */
    deactivate(onComplete) {
        // Animate deactivation
        const animate = () => {
            this.activationProgress -= 0.03
            
            if (this.activationProgress <= 0) {
                this.activationProgress = 0
                this.isActive = false
                this.group.visible = false
                this.currentContent = null
                if (onComplete) onComplete()
                return
            }
            
            requestAnimationFrame(animate)
        }
        
        animate()
    }
    
    /**
     * Update animation
     */
    update(deltaTime) {
        this.time += deltaTime
        
        this.frameMaterial.uniforms.uTime.value = this.time
        this.frameMaterial.uniforms.uProgress.value = this.activationProgress
        
        this.surfaceMaterial.uniforms.uTime.value = this.time
        this.surfaceMaterial.uniforms.uProgress.value = this.activationProgress
    }
    
    /**
     * Get current content
     */
    getContent() {
        return this.currentContent
    }
    
    dispose() {
        this.frameLine.geometry.dispose()
        this.frameMaterial.dispose()
        this.surfaceMesh.geometry.dispose()
        this.surfaceMaterial.dispose()
        this.scene.remove(this.group)
    }
}
