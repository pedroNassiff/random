// PlanetShaderMaterial — superficie
//
// Mismo esquema que el earth shader de Kessler (día/noche por uSunDirection,
// fresnel + atmósfera día/crepúsculo, specular), pero sin texturas: el
// terreno, las nubes y las bandas se generan con value-noise 2D sobre vUv,
// parametrizado por bioma (ver PlanetShaderMaterial.js).

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

uniform vec3  uSunDirection;

uniform vec3  uColorA;
uniform vec3  uColorB;
uniform vec3  uNightColor;

uniform vec3  uPolarColor;
uniform float uPolarCoverage;

uniform vec3  uCloudColor;
uniform float uCloudCoverage;
uniform float uCloudSpeed;

uniform vec3  uBandColor1;
uniform vec3  uBandColor2;
uniform float uBandStrength;

uniform vec3  uEmissiveColor;
uniform float uEmissiveIntensity;

uniform vec3  uAtmosphereDayColor;
uniform vec3  uAtmosphereTwilightColor;

uniform float uTime;
uniform float uNoiseScale;

float hash(vec2 p)
{
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p)
{
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main()
{
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    vec3 normal = normalize(vNormal);

    // orientación del sol
    float sunOrientation = dot(uSunDirection, normal);
    float dayMix = smoothstep(-0.25, 0.5, sunOrientation);

    // terreno base — 2 octavas de value-noise sobre vUv
    vec2 p = vUv * uNoiseScale * 8.0;
    float terrain = valueNoise(p) * 0.6 + valueNoise(p * 2.3 + 100.0) * 0.4;
    vec3 dayColor = mix(uColorA, uColorB, smoothstep(0.35, 0.65, terrain));

    // casquetes polares — latitud aproximada desde vUv.y (0 ecuador, 1 polo)
    float lat = abs(vUv.y - 0.5) * 2.0;
    float polar = smoothstep(uPolarCoverage, uPolarCoverage + 0.12, lat);
    dayColor = mix(dayColor, uPolarColor, polar);

    // bandas horizontales — gigante gaseoso
    float bandNoise = valueNoise(vec2(vUv.x * 6.0, vUv.y * 40.0 + uTime * 0.01));
    float bands = smoothstep(0.4, 0.6, sin((vUv.y + bandNoise * 0.05) * 60.0) * 0.5 + 0.5);
    vec3 bandColor = mix(uBandColor1, uBandColor2, bands);
    dayColor = mix(dayColor, bandColor, uBandStrength);

    vec3 color = mix(uNightColor, dayColor, dayMix);

    // nubes procedurales en movimiento — sólo visibles del lado día
    float cloudNoise = valueNoise(p * 1.4 + vec2(uTime * uCloudSpeed, uTime * uCloudSpeed * 0.4));
    float cloudMix = smoothstep(1.0 - uCloudCoverage, 1.0, cloudNoise);
    cloudMix *= dayMix;
    color = mix(color, uCloudColor, cloudMix);

    // grietas emisivas — lava, bioluminiscencia, etc. Visibles de noche también.
    float crackNoise = valueNoise(p * 3.0 + 50.0);
    float cracks = smoothstep(0.85, 0.95, crackNoise);
    color += uEmissiveColor * cracks * uEmissiveIntensity;

    // Fresnel + atmósfera (día/crepúsculo)
    float fresnel = pow(dot(viewDirection, normal) + 1.0, 2.0);
    float atmosphereDayMix = smoothstep(-0.5, 1.0, sunOrientation);
    vec3 atmosphereColor = mix(uAtmosphereTwilightColor, uAtmosphereDayColor, atmosphereDayMix);
    color = mix(color, atmosphereColor, fresnel * atmosphereDayMix);

    // specular simple — brillo puntual del lado día
    vec3 reflection = reflect(-uSunDirection, normal);
    float specular = max(-dot(reflection, viewDirection), 0.0);
    specular = pow(specular, 60.0);
    vec3 specularColor = mix(vec3(1.0), atmosphereColor, fresnel);
    color += specular * specularColor * 0.25;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
