uniform float uTime;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    vPosition = modelPosition.xyz;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vUv = uv;
}
