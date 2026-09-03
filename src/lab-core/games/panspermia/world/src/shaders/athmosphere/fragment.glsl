varying vec3 vNormal;
varying vec3 vPosition;


uniform vec3 uSunDirection;   

uniform vec3 uAthmosphereDayColor;
uniform vec3 uAthmosphereTwilightColor;

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);
    vec3 color = vec3(0.0);

    // orientacion del sol
    float sunOrientation = dot(uSunDirection, normal);


    //  Fresnel

    // athmosphere
    float athmosphereDayMix =  smoothstep(- 0.5, 1.0, sunOrientation); // controla la intensidad de la atmósfera durante el día
    vec3 athmosphereColor = mix(uAthmosphereTwilightColor, uAthmosphereDayColor, athmosphereDayMix); // mezcla el color de la atmósfera entre el color del día y el del crepúsculo según la orientación del sol

    float edgeAlpha = dot(viewDirection, normal);
    edgeAlpha = smoothstep(0.0, 0.5, edgeAlpha);

    float dayAlpha = smoothstep(- 0.5, 0.0, sunOrientation);
    float alpha = edgeAlpha * dayAlpha;

    color = athmosphereColor;

    // Final color
    gl_FragColor = vec4(color, alpha);    
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}