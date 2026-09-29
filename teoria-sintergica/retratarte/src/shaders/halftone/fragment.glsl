uniform vec3 uColor;

uniform vec2 uResolution;
uniform float uShadowRepetitions;
uniform vec3 uShadowColor;
uniform float uLightRepetitions;
uniform vec3 uLightColor;

varying vec3 vNormal;
varying vec3 vPosition;


#include ../includes/ambientLight.glsl
#include ../includes/directionalLight.glsl
#include ../includes/pointLight.glsl


vec3 halftone(
    vec3 color, 
    float repetitions, 
    vec3 direction, 
    float low, 
    float high, 
    vec3 pointColor,
    vec3 normal  
    )
{
    float intensity = dot(normal, direction);

    intensity = smoothstep(low, high, intensity);

    vec2 uv = gl_FragCoord.xy / uResolution.y; // using the uniform resolution for scaling
    uv *= repetitions; // aca controlamos cuantas celdas tenemos verticalente
    uv = mod(uv, 1.0);

    float point = distance(uv, vec2(0.5));
    point = 1.0 - step(0.5 * intensity, point); // controlamos el tamaño del punto
    point = smoothstep(0.45, 0.5, point); // suavizamos el borde del punto

    return mix(color, pointColor, point);

}


void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = uColor;

    //  lights
    vec3 light = vec3(0.0);

    light += ambientLight(
        vec3(1.0), // ambient light color
        1.0       // intensity
    );
    light += directionalLight(
        vec3(1.0), // light color
        1.0,        // intensity
        normal, //normal
        vec3(1.0, 1.0, 0.0), // light position
        viewDirection, // view direction
        1.0 // specuular power
    );

    color *= light;

    // halftone 
    color = halftone(
        color,
        uShadowRepetitions,
        vec3(0.0, - 1.0, 0.0),
        - 0.8,
        1.5,
        uShadowColor,
        normal
    );

         color = halftone(
          color,
          uLightRepetitions,
          vec3(1.0, 1.0, 0.0),
          0.5,
          1.5,
          uLightColor,
          normal
     );
    


    // Final color
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}