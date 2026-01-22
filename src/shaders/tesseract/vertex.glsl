uniform float uTime;
uniform float uRotation4D;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vDepth;

// Matrix de rotación 4D
vec4 rotateXW(vec4 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec4(
        p.x * c - p.w * s,
        p.y,
        p.z,
        p.x * s + p.w * c
    );
}

vec4 rotateYW(vec4 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec4(
        p.x,
        p.y * c - p.w * s,
        p.z,
        p.y * s + p.w * c
    );
}

vec4 rotateZW(vec4 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec4(
        p.x,
        p.y,
        p.z * c - p.w * s,
        p.z * s + p.w * c
    );
}

void main() {
    vNormal = normal;
    
    // Convertir posición 3D a 4D (agregar dimensión W)
    vec4 pos4D = vec4(position, 1.0);
    
    // Rotar en el espacio 4D
    pos4D = rotateXW(pos4D, uTime * 0.3);
    pos4D = rotateYW(pos4D, uTime * 0.2);
    pos4D = rotateZW(pos4D, uTime * 0.15);
    
    // Proyección estereográfica de 4D a 3D
    float w = 2.0; // Distancia de proyección
    vec3 projected = pos4D.xyz / (w - pos4D.w);
    
    vPosition = projected;
    vDepth = pos4D.w; // Guardar la profundidad en la 4ta dimensión
    
    vec4 modelPosition = modelMatrix * vec4(projected, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectedPosition;
}
