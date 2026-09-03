uniform vec3  uColor;
uniform float uGlow;

void main()
{
    // Disco circular centrado en el point sprite
    float dist = length(gl_PointCoord - vec2(0.5));

    // Core duro + halo suave
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float halo = 1.0 - smoothstep(0.15, 0.5, dist);
    float alpha = core + halo * 0.4 * uGlow;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(uColor, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
