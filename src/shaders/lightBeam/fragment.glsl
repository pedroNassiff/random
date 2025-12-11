uniform float uTime;
uniform float uOpacity;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main()
{
    // Fresnel para bordes brillantes
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    float fresnel = abs(dot(viewDirection, normal));
    fresnel = 1.0 - fresnel;
    fresnel = pow(fresnel, 3.0);
    
    // Gradiente vertical (más brillante arriba, fade abajo)
    float verticalGradient = 1.0 - vUv.y;
    verticalGradient = pow(verticalGradient, 0.5);
    
    // Pulsación suave
    float pulse = sin(uTime * 2.0) * 0.15 + 0.85;
    
    // Combinación
    float intensity = fresnel * verticalGradient * pulse;
    
    vec3 color = vec3(1.0); // Luz blanca
    float alpha = intensity * uOpacity;
    
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
