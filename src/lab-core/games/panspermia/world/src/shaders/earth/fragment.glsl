varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

uniform sampler2D uDayTexture;
uniform sampler2D uNightTexture;
uniform sampler2D uSpecularCloudsTexture;
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

    //  day night color
    float dayMix = smoothstep(-0.25, 0.5, sunOrientation);
    vec3 dayColor = texture(uDayTexture, vUv).rgb;
    vec3 nightColor = texture(uNightTexture, vUv).rgb;

    color = mix(nightColor, dayColor, dayMix); // si dayMix es 0, se muestra nightColor, si es 1, se muestra dayColor

    vec2 specularCloudsColor = texture(uSpecularCloudsTexture, vUv).rg;

    // specular clouds
    
    // color = vec3(specularCloudsColor, 0.0);



    //  Fresnel


    // clouds
    float cloudMix = smoothstep(0.5, 1.0, specularCloudsColor.g); // aca controlamos la intensidad de las nubes
    cloudMix *= dayMix; // las nubes solo se ven durante el dia, asi que multiplicamos por dayMix
    color = mix(color, vec3(1.), cloudMix); // mezcla el color base con blanco según la intensidad de las nubes
    
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0); // controla la intensidad del efecto Fresnel

    // athmosphere
    float athmosphereDayMix =  smoothstep(- 0.5, 1.0, sunOrientation); // controla la intensidad de la atmósfera durante el día
    vec3 athmosphereColor = mix(uAthmosphereTwilightColor, uAthmosphereDayColor, athmosphereDayMix); // mezcla el color de la atmósfera entre el color del día y el del crepúsculo según la orientación del sol
    color = mix(color, athmosphereColor, fresnel * athmosphereDayMix); // suma el color de la atmósfera al color

    // speculare
    vec3 reflection = reflect(-uSunDirection, normal);
    float specular = - dot(reflection, viewDirection);
    specular = max(specular, 0.0);
    specular = pow(specular, 82.0); // controla el brillo del refle

    specular *= specularCloudsColor.r; // controla la intensidad del brillo, en el agua  y en la tierra, mostramos solo el brillo en el agua en este caso

    vec3 specularColor = mix(vec3(1.0), athmosphereColor, fresnel);
    color += specular * specularColor;

    

    // Final color
    gl_FragColor = vec4(color, 1.0);    
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}