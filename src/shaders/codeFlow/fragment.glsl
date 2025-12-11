uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_progress; // 0 to 1, controls the flow animation

varying vec2 vUv;

float random(in float x) {
    return fract(sin(x) * 1e4);
}

float random(in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float pattern(vec2 st, vec2 v, float t) {
    vec2 p = floor(st + v);
    return step(t, random(100.0 + p * 0.000001) + random(p.x) * 0.5);
}

void main() {
    vec2 st = vUv * u_resolution / min(u_resolution.x, u_resolution.y);
    st.x *= u_resolution.x / u_resolution.y;

    vec2 grid = vec2(100.0, 50.0);
    st *= grid;

    vec2 ipos = floor(st);  // integer
    vec2 fpos = fract(st);  // fraction

    // Animate based on progress and time
    vec2 vel = vec2(u_time * 2.0 * max(grid.x, grid.y)); // time
    vel *= vec2(-1.0, 0.0) * random(1.0 + ipos.y); // direction

    // Offset for RGB channels
    vec2 offset = vec2(0.1, 0.0);

    vec3 color = vec3(0.0);
    
    // RGB separation for chromatic effect
    color.r = pattern(st + offset, vel, 0.5 + u_mouse.x / u_resolution.x);
    color.g = pattern(st, vel, 0.5 + u_mouse.x / u_resolution.x);
    color.b = pattern(st - offset, vel, 0.5 + u_mouse.x / u_resolution.x);

    // Margins for cleaner look
    color *= step(0.2, fpos.y);
    
    // Fade based on progress (appear/disappear animation)
    float fadeIn = smoothstep(0.0, 0.3, u_progress);
    float fadeOut = smoothstep(1.0, 0.7, u_progress);
    float fade = fadeIn * fadeOut;
    
    // Apply fade
    color *= fade;

    gl_FragColor = vec4(1.0 - color, fade * 0.8);
}
