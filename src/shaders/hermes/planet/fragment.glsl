uniform float uTime;
uniform vec3 uBaseColor;      // color base del planeta
uniform vec3 uSecondaryColor; // color secundario para variación
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    // Textura procedural con noise
    float noise = fbm(vUv * 5.0 + uTime * 0.1);
    
    // Mezcla de colores
    vec3 color = mix(uBaseColor, uSecondaryColor, noise);
    
    // Iluminación simple
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    
    color *= (diffuse * 0.7 + 0.3);
    
    gl_FragColor = vec4(color, 1.0);
}