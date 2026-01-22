uniform float uTime;
uniform vec3 uColor1;
uniform vec3 uColor2;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vDepth;

void main() {
    // Normalizar la normal
    vec3 normal = normalize(vNormal);
    
    // Efecto de profundidad 4D
    float depthFactor = sin(vDepth * 1.5 + uTime * 0.5) * 0.5 + 0.5;
    
    // Gradiente de color basado en la posición y profundidad
    vec3 color = mix(uColor1, uColor2, depthFactor);
    
    // Grid lines effect (como las líneas del tesseracto de Interstellar)
    float gridX = abs(fract(vPosition.x * 2.0) - 0.5);
    float gridY = abs(fract(vPosition.y * 2.0) - 0.5);
    float gridZ = abs(fract(vPosition.z * 2.0) - 0.5);
    float grid = min(min(gridX, gridY), gridZ);
    grid = smoothstep(0.45, 0.5, grid);
    
    // Líneas más sutiles y doradas
    vec3 gridColor = uColor1 * (1.0 - grid) * 1.5;
    color = mix(color, gridColor, 0.4);
    
    // Fresnel effect para los bordes
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);
    
    // Glow sutil en los bordes
    color += fresnel * uColor1 * 0.3;
    
    // Pulsación temporal muy sutil
    float pulse = sin(uTime * 0.8) * 0.05 + 0.95;
    
    // Alpha basado en profundidad y fresnel para transparencia
    float alpha = (0.15 + fresnel * 0.2) * pulse;
    alpha = mix(alpha, alpha * 0.6, depthFactor);
    
    gl_FragColor = vec4(color, alpha);
}
