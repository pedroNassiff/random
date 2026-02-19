uniform float uTime;
uniform float uGlitch;
varying vec3 vPosition;
varying vec3 vNormal;

float random2D(vec2 value) {
    return fract(sin(dot(value.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    float glitchTime     = uTime - modelPosition.y;
    float glitchStrength = sin(glitchTime) + sin(glitchTime * 1.45) + sin(glitchTime * 2.13);
    glitchStrength      /= 3.0;
    glitchStrength       = smoothstep(0.3, 1.0, glitchStrength);
    glitchStrength      *= uGlitch;
    modelPosition.x += (random2D(modelPosition.xz + uTime) - 0.5) * glitchStrength;
    modelPosition.z += (random2D(modelPosition.zx + uTime) - 0.5) * glitchStrength;

    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vec4 modeNormal = modelMatrix * vec4(normal, 0.0);
    vPosition = modelPosition.xyz;
    vNormal   = modeNormal.xyz;
}