uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
uniform float uSpeed;
uniform float uStripe;
uniform float uFresnel;
varying vec3  vPosition;
varying vec3  vNormal;

vec3 getChakraColor(float time) {
    vec3 chakraColors[7];
    chakraColors[0] = vec3(1.0, 0.0, 0.0);
    chakraColors[1] = vec3(1.0, 0.5, 0.0);
    chakraColors[2] = vec3(1.0, 1.0, 0.0);
    chakraColors[3] = vec3(0.0, 1.0, 0.0);
    chakraColors[4] = vec3(0.0, 0.5, 1.0);
    chakraColors[5] = vec3(0.3, 0.0, 0.5);
    chakraColors[6] = vec3(0.5, 0.0, 1.0);

    float cycleTime   = mod(time * 0.5, 7.0);
    int   currIdx     = int(floor(cycleTime));
    int   nextIdx     = int(mod(float(currIdx + 1), 7.0));
    float mixFactor   = smoothstep(0.0, 1.0, fract(cycleTime));
    return mix(chakraColors[currIdx], chakraColors[nextIdx], mixFactor);
}

void main() {
    vec3 normal = normalize(vNormal);
    if (!gl_FrontFacing) normal *= -1.0;

    float stripes = mod((vPosition.y - uTime * uSpeed) * uStripe, 1.0);
    stripes = pow(stripes, 3.0);

    vec3  viewDirection = normalize(vPosition - cameraPosition);
    float fresnel       = pow(dot(viewDirection, normal) + 1.0, uFresnel);
    float falloff       = smoothstep(0.8, 0.0, fresnel);

    float holographic = stripes * fresnel + fresnel * 1.25;
    holographic *= falloff;

    vec3 chakraColor = getChakraColor(uTime);
    // Blend chakra cycle with the editable uColor
    vec3 finalColor  = mix(chakraColor, uColor, 0.3);

    gl_FragColor = vec4(finalColor, holographic * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}