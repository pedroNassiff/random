uniform float uSize;

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition  = viewMatrix * modelPosition;

    gl_Position = projectionMatrix * viewPosition;

    // Tamaño con atenuación por distancia
    gl_PointSize = uSize * (300.0 / - viewPosition.z);
}
