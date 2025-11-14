uniform float uTime;
uniform vec3 uColor;
varying vec3 vPosition;

varying vec3 vNormal;

// Función para obtener el color del chakra según el tiempo
vec3 getChakraColor(float time)
{
    // Los 7 colores de los chakras
    vec3 chakraColors[7];
    chakraColors[0] = vec3(1.0, 0.0, 0.0);      // Rojo - Muladhara (Raíz)
    chakraColors[1] = vec3(1.0, 0.5, 0.0);      // Naranja - Svadhisthana (Sacro)
    chakraColors[2] = vec3(1.0, 1.0, 0.0);      // Amarillo - Manipura (Plexo Solar)
    chakraColors[3] = vec3(0.0, 1.0, 0.0);      // Verde - Anahata (Corazón)
    chakraColors[4] = vec3(0.0, 0.5, 1.0);      // Azul - Vishuddha (Garganta)
    chakraColors[5] = vec3(0.3, 0.0, 0.5);      // Índigo - Ajna (Tercer Ojo)
    chakraColors[6] = vec3(0.5, 0.0, 1.0);      // Violeta - Sahasrara (Corona)
    
    // Ciclo completo cada 14 segundos (2 segundos por chakra)
    float cycleTime = mod(time * 0.5, 7.0); // 0 a 7
    
    // Índice actual y siguiente
    int currentIndex = int(floor(cycleTime));
    int nextIndex = int(mod(float(currentIndex + 1), 7.0));
    
    // Factor de mezcla suave entre colores
    float mixFactor = fract(cycleTime);
    mixFactor = smoothstep(0.0, 1.0, mixFactor); // Transición suave
    
    // Mezcla entre el color actual y el siguiente
    return mix(chakraColors[currentIndex], chakraColors[nextIndex], mixFactor);
}

void main()
{

    vec3 normal = normalize(vNormal);
    if(!gl_FrontFacing)
    {
        normal *= - 1.0;
    }

    float stripes = mod((vPosition.y - uTime * 0.02) * 20.0, 1.0);
    stripes = pow(stripes, 3.0);

    // fresnel
    vec3 viewDirection = normalize(vPosition - cameraPosition);
     float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    float flalloff = smoothstep(0.8, 0.0, fresnel);

    // holographic
    float holographic = stripes * fresnel;
    holographic += fresnel * 1.25;

    // falloff
    holographic *= flalloff;

    // Obtener color del chakra animado
    vec3 chakraColor = getChakraColor(uTime);

    gl_FragColor = vec4(chakraColor, holographic);
    //  gl_FragColor = vec4(vNormal, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}