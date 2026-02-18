uniform float uTime;
uniform sampler2D uTexture;
uniform float uPattern;
uniform vec2 uResolution;

// Audio básico
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uAudioTreble;
uniform float uAudioVolume;

// Audio avanzado
uniform float uAudioBeat;
uniform float uAudioSpectralCentroid;
uniform float uAudioSpectralFlux;
uniform float uAudioSubBass;
uniform float uAudioLowBass;
uniform float uAudioPresence;
uniform float uAudioBrilliance;

// Mood colors
uniform vec3 uMoodColor1;
uniform vec3 uMoodColor2;
uniform vec3 uMoodColor3;
uniform float uMoodIntensity;

// Face
uniform sampler2D uFaceTexture;
uniform float uHasFace;

// Video stream
uniform sampler2D uVideoTexture;
uniform float uHasVideo;

// ============================================
// EXPRESIONES FACIALES (FASE 3)
// ============================================
uniform float uSmile;           // 0-1: intensidad de sonrisa
uniform float uMouthOpen;       // 0-1: boca abierta
uniform float uEyebrowRaise;    // 0-1: cejas levantadas
uniform float uEyebrowFrown;    // 0-1: ceño fruncido
uniform float uLeftEyeOpen;     // 0-1: ojo izquierdo abierto
uniform float uRightEyeOpen;    // 0-1: ojo derecho abierto

// Head pose (radianes)
uniform float uHeadPitch;       // arriba/abajo
uniform float uHeadYaw;         // izquierda/derecha
uniform float uHeadRoll;        // inclinación lateral

varying vec2 vUv;
varying vec3 vPosition;

// ============================================
// UTILITY FUNCTIONS
// ============================================

#define PI 3.14159265359
#define TAU 6.28318530718

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

vec2 random2(vec2 st) {
    st = vec2(dot(st, vec2(127.1, 311.7)),
              dot(st, vec2(269.5, 183.3)));
    return fract(sin(st) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(st * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// ============================================
// ORIGINAL PATTERNS (0-4, 6-7) - Now with expressions
// ============================================

// Pattern 0: Distance field circles + expressions
vec3 pattern0(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    // Head pose afecta la posición
    st += vec2(uHeadYaw * 0.3, uHeadPitch * 0.2);
    
    float d = length(abs(st) - 0.3);
    float audioInfluence = uAudioBass * 15.0 + uAudioBeat * 3.0;
    
    // Smile expande los círculos
    float smileExpand = uSmile * 5.0;
    
    float pattern = fract(d * (10.0 + audioInfluence + smileExpand) + uTime * 0.5);
    
    vec3 color1 = vec3(1.0, 0.2, 0.5);
    vec3 color2 = vec3(0.2, 0.5, 1.0);
    
    // Smile hace los colores más cálidos
    color1 = mix(color1, vec3(1.0, 0.8, 0.3), uSmile * 0.5);
    
    return mix(color1, color2, pattern) * alpha * (1.0 + uAudioBass * 0.3 + uSmile * 0.2);
}

// Pattern 1: Grid cells + mouth open creates gaps
vec3 pattern1(vec2 st, float alpha) {
    // Mouth open increases grid size
    float gridSize = 10.0 + uAudioMid * 8.0 - uMouthOpen * 4.0;
    st *= max(4.0, gridSize);
    
    vec2 ipos = floor(st);
    vec2 fpos = fract(st);
    
    float time = uTime * (0.5 + uAudioVolume * 0.5);
    
    float rand = random(ipos + floor(time));
    vec3 color = vec3(
        0.5 + 0.5 * sin(rand * 6.28 + time),
        0.5 + 0.5 * sin(rand * 6.28 + time + 2.0),
        0.5 + 0.5 * sin(rand * 6.28 + time + 4.0)
    );
    
    // Eyebrow raise brightens colors
    color = mix(color, vec3(1.0), uEyebrowRaise * 0.4);
    
    float edge = step(0.9 - uAudioMid * 0.2, fpos.x) + step(0.9 - uAudioMid * 0.2, fpos.y);
    color = mix(color, vec3(1.0), edge * uAudioVolume * 0.5);
    
    color += vec3(1.0) * uAudioBeat * 0.2;
    
    return color * alpha;
}

// Pattern 2: Círculos concéntricos + eyebrows affect frequency
vec3 pattern2(vec2 st, float alpha) {
    vec2 pos = st * 2.0 - 1.0;
    pos.x *= uResolution.x / uResolution.y;
    
    // Head roll rotates the pattern
    pos = rotate2D(uHeadRoll) * pos;
    
    float d = length(pos);
    float audioMod = uAudioTreble * 20.0 + uAudioSpectralCentroid * 15.0;
    
    // Eyebrow raise increases frequency (surprise effect)
    float eyebrowMod = uEyebrowRaise * 15.0;
    
    float pattern = sin(d * (20.0 + audioMod + eyebrowMod) - uTime * 2.0) * 0.5 + 0.5;
    
    vec3 color1 = vec3(1.0, 1.0, 0.0);
    vec3 color2 = vec3(1.0, 0.0, 1.0);
    vec3 color3 = vec3(0.0, 1.0, 1.0);
    
    // Frown makes colors darker/more intense
    color1 = mix(color1, vec3(0.8, 0.4, 0.0), uEyebrowFrown);
    color2 = mix(color2, vec3(0.6, 0.0, 0.3), uEyebrowFrown);
    
    float mix1 = smoothstep(0.0, 0.5, pattern + uAudioTreble * 0.2);
    float mix2 = smoothstep(0.5, 1.0, pattern);
    
    vec3 finalColor = mix(color1, color2, mix1);
    finalColor = mix(finalColor, color3, mix2);
    
    return finalColor * alpha * (1.0 + uAudioTreble * 0.2);
}

// Pattern 3: Truchet tiles
vec3 pattern3(vec2 st, float alpha) {
    st *= 8.0;
    vec2 ipos = floor(st);
    vec2 fpos = fract(st);
    
    float time = floor(uTime * 0.3);
    float tile = step(0.5, random(ipos + time));
    
    if(tile > 0.5) {
        fpos = 1.0 - fpos;
    }
    
    float d = distance(fpos, vec2(0.0));
    float pattern = smoothstep(0.3, 0.35, d) - smoothstep(0.65, 0.7, d);
    
    vec3 color = mix(
        vec3(0.1, 0.3, 0.8),
        vec3(0.9, 0.2, 0.4),
        pattern
    );
    
    // Smile adds warmth
    color = mix(color, vec3(1.0, 0.9, 0.7), uSmile * 0.3);
    
    return color * alpha;
}

// Pattern 4: Noise waves + expressions
vec3 pattern4(vec2 st, float alpha) {
    vec2 pos = st * (5.0 + uAudioVolume * 2.0);
    
    // Mouth open creates turbulence
    float turbulence = uMouthOpen * 2.0;
    
    float n = noise(pos + uTime * 0.3);
    n += 0.5 * noise(pos * 2.0 + uTime * 0.4 + turbulence);
    n += 0.25 * noise(pos * 4.0 + uTime * 0.5);
    
    n += uAudioBass * 0.2 + uAudioSpectralFlux * 0.3;
    
    vec3 color1 = vec3(0.0, 1.0, 0.5);
    vec3 color2 = vec3(1.0, 0.0, 0.5);
    vec3 color3 = vec3(0.5, 0.0, 1.0);
    
    // Smile shifts to warmer colors
    color1 = mix(color1, vec3(1.0, 0.8, 0.2), uSmile * 0.5);
    
    vec3 finalColor = mix(color1, color2, smoothstep(0.3, 0.5, n));
    finalColor = mix(finalColor, color3, smoothstep(0.5, 0.7, n));
    
    return finalColor * alpha * (1.0 + uAudioVolume * 0.3);
}

// Pattern 6: Checkerboard psychedelic + eye blink
vec3 pattern6(vec2 st, float alpha) {
    st *= 12.0;
    vec2 ipos = floor(st);
    
    float checker = mod(ipos.x + ipos.y, 2.0);
    
    float time = uTime * 0.5;
    vec3 color1 = vec3(
        0.5 + 0.5 * sin(time * 2.0),
        0.5 + 0.5 * sin(time * 2.0 + 2.0),
        0.5 + 0.5 * sin(time * 2.0 + 4.0)
    );
    
    vec3 color2 = vec3(
        0.5 + 0.5 * sin(time * 2.0 + 3.14),
        0.5 + 0.5 * sin(time * 2.0 + 5.14),
        0.5 + 0.5 * sin(time * 2.0 + 7.14)
    );
    
    float pulse = 0.5 + 0.5 * sin(length(ipos) * 0.5 - time * 3.0);
    
    // Eye closure creates fade effect
    float eyeAvg = (uLeftEyeOpen + uRightEyeOpen) * 0.5;
    float eyeFade = mix(0.3, 1.0, eyeAvg);
    
    return mix(color1, color2, checker) * pulse * alpha * eyeFade;
}

// Pattern 7: Face kaleidoscope with expressions
vec3 pattern7(vec2 st, float alpha) {
    if(uHasVideo < 0.5 && uHasFace < 0.5) {
        return vec3(0.5, 0.2, 0.8) * alpha;
    }
    
    vec2 pos = st * 2.0 - 1.0;
    pos.x *= uResolution.x / uResolution.y;
    
    // Smile increases repetitions
    float repetitions = 6.0 + floor(uAudioVolume * 3.0) + floor(uSmile * 4.0);
    
    float angle = atan(pos.y, pos.x);
    float radius = length(pos);
    
    float segmentAngle = TAU / repetitions;
    angle = mod(angle, segmentAngle);
    
    if(mod(floor(atan(pos.y, pos.x) / segmentAngle), 2.0) > 0.5) {
        angle = segmentAngle - angle;
    }
    
    // Head yaw affects rotation
    float rotation = uTime * 0.5 + uAudioMid * PI * 0.5 + uHeadYaw * 2.0;
    angle += rotation;
    
    // Mouth open affects zoom
    float zoom = 0.3 + uAudioBass * 0.2 + uMouthOpen * 0.15;
    vec2 uv = vec2(cos(angle), sin(angle)) * radius / zoom;
    
    uv = uv * 0.5 + 0.5;
    uv = fract(uv * 2.0);
    
    vec4 sourceColor;
    if(uHasVideo > 0.5) {
        sourceColor = texture2D(uVideoTexture, uv);
    } else {
        sourceColor = texture2D(uFaceTexture, uv);
    }
    
    vec3 color = sourceColor.rgb;
    color.r += uAudioBass * 0.2;
    color.g += uAudioMid * 0.2;
    color.b += uAudioTreble * 0.2;
    
    // Smile adds warmth
    color = mix(color, color * vec3(1.2, 1.1, 0.9), uSmile * 0.5);
    
    float vignette = 1.0 - smoothstep(0.5, 1.5, radius);
    
    return color * vignette * alpha * sourceColor.a;
}

// ============================================
// VORONOI & FLOW FIELD (11-12)
// ============================================

vec3 pattern11_Voronoi(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    // Head movement shifts the pattern
    st += vec2(uHeadYaw * 0.2, uHeadPitch * 0.15);
    
    float scale = 4.0 + uAudioMid * 3.0 + uSmile * 2.0;
    st *= scale;
    
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);
    
    float m_dist = 1.0;
    vec2 m_point = vec2(0.0);
    
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = random2(i_st + neighbor);
            
            float speed = 0.3 + uAudioVolume * 0.5 + uMouthOpen * 0.3;
            point = 0.5 + 0.4 * sin(uTime * speed + TAU * point + uAudioBass * 2.0);
            
            vec2 diff = neighbor + point - f_st;
            float dist = length(diff);
            
            if (dist < m_dist) {
                m_dist = dist;
                m_point = point;
            }
        }
    }
    
    float m_dist2 = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = random2(i_st + neighbor);
            float speed = 0.3 + uAudioVolume * 0.5;
            point = 0.5 + 0.4 * sin(uTime * speed + TAU * point + uAudioBass * 2.0);
            
            vec2 diff = neighbor + point - f_st;
            float dist = length(diff);
            
            if (dist > m_dist + 0.001 && dist < m_dist2) {
                m_dist2 = dist;
            }
        }
    }
    
    float edge = m_dist2 - m_dist;
    float edgeWidth = 0.05 + uAudioTreble * 0.03 + uEyebrowRaise * 0.02;
    float edgeLine = smoothstep(0.0, edgeWidth, edge);
    
    vec3 cellColor = vec3(
        0.5 + 0.5 * sin(m_point.x * 10.0 + uTime),
        0.5 + 0.5 * sin(m_point.y * 10.0 + uTime + 2.0),
        0.5 + 0.5 * sin((m_point.x + m_point.y) * 5.0 + uTime + 4.0)
    );
    
    // Smile makes cells warmer
    cellColor = mix(cellColor, vec3(1.0, 0.9, 0.7), uSmile * 0.4);
    cellColor = mix(cellColor, vec3(1.0), uAudioSpectralCentroid * 0.3);
    
    vec3 edgeColor = vec3(0.1, 0.1, 0.2);
    vec3 color = mix(edgeColor, cellColor, edgeLine);
    
    color += vec3(1.0, 0.8, 0.5) * (1.0 - edgeLine) * uAudioBeat * 0.5;
    
    float glow = exp(-m_dist * 3.0) * uAudioVolume * 0.5;
    color += vec3(0.5, 0.3, 0.8) * glow;
    
    return color * alpha;
}

vec3 pattern12_FlowField(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    // Head rotation affects flow direction
    st = rotate2D(uHeadRoll * 0.5) * st;
    
    vec3 color = vec3(0.0);
    
    for (float layer = 0.0; layer < 3.0; layer++) {
        vec2 pos = st * (3.0 + layer * 1.5);
        
        float noiseScale = 2.0 + uAudioMid * 2.0 + uMouthOpen * 1.5;
        
        vec2 flow = vec2(
            fbm(pos + vec2(0.0, 0.01)) - fbm(pos - vec2(0.0, 0.01)),
            fbm(pos + vec2(0.01, 0.0)) - fbm(pos - vec2(0.01, 0.0))
        ) * (5.0 + uAudioBass * 10.0);
        
        float t = uTime * (0.3 + layer * 0.1) + uAudioVolume;
        vec2 p = fract(st * (5.0 + layer * 2.0) + flow * 0.1 + t * 0.1);
        
        float particle = smoothstep(0.3, 0.0, length(p - 0.5));
        
        vec3 layerColor;
        if (layer < 1.0) {
            layerColor = vec3(0.2, 0.5, 1.0);
        } else if (layer < 2.0) {
            layerColor = vec3(0.8, 0.2, 0.5);
        } else {
            layerColor = vec3(0.2, 0.8, 0.5);
        }
        
        // Smile shifts to warmer palette
        layerColor = mix(layerColor, vec3(1.0, 0.8, 0.5), uSmile * 0.3);
        layerColor = mix(layerColor, vec3(1.0), uAudioSpectralFlux * 0.5);
        
        color += layerColor * particle * (0.5 / (layer + 1.0));
    }
    
    vec2 flowPos = st * 4.0;
    float flowAngle = fbm(flowPos + uTime * 0.05) * TAU;
    vec2 flowDir = vec2(cos(flowAngle), sin(flowAngle));
    
    float linePattern = sin(dot(st, flowDir) * 30.0 + uTime) * 0.5 + 0.5;
    linePattern = smoothstep(0.4, 0.6, linePattern);
    
    vec3 lineColor = vec3(0.3, 0.4, 0.6) * linePattern * 0.3;
    color += lineColor;
    
    float wave = sin(length(st) * 10.0 - uTime * 3.0 - uAudioBeat * 5.0) * 0.5 + 0.5;
    color += vec3(1.0, 0.9, 0.7) * wave * uAudioBeat * 0.3;
    
    float vignette = 1.0 - smoothstep(0.5, 1.5, length(st));
    color *= vignette;
    
    return color * alpha * (1.0 + uAudioVolume * 0.3);
}

// ============================================
// SACRED GEOMETRY (13-15)
// ============================================

vec3 pattern13_Torus(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    float pattern = 0.0;
    
    // Smile expands the torus
    float R = 0.5 + uAudioBass * 0.08 + uSmile * 0.1;
    float r = 0.2 + uAudioMid * 0.04 + uMouthOpen * 0.05;
    
    // Head pose affects rotation
    float rotX = uTime * 0.3 + uAudioTreble * 0.5 + uHeadPitch * 2.0;
    float rotY = uTime * 0.2 + uHeadYaw * 2.0;
    
    float flowLines = 20.0;
    
    for (float i = 0.0; i < flowLines; i++) {
        float theta = i / flowLines * TAU;
        
        for (float t = 0.0; t < 1.0; t += 0.025) {
            float phi = t * TAU + uTime * 0.4;
            
            float x = (R + r * cos(phi)) * cos(theta);
            float y = (R + r * cos(phi)) * sin(theta);
            float z = r * sin(phi);
            
            float x2 = x * cos(rotY) - z * sin(rotY);
            float z2 = x * sin(rotY) + z * cos(rotY);
            float y2 = y * cos(rotX) - z2 * sin(rotX);
            
            vec2 proj = vec2(x2, y2);
            
            float d = length(st - proj);
            float pointSize = 0.015 + (z2 + r) / (2.0 * r) * 0.015;
            pattern += smoothstep(pointSize, 0.0, d) * 0.08;
        }
    }
    
    for (float i = 1.0; i <= 4.0; i++) {
        float ringR = i * 0.18 + uAudioVolume * 0.08;
        float wave = sin(length(st) * 8.0 - uTime * 2.0 - i) * 0.015;
        pattern += smoothstep(0.015, 0.0, abs(length(st) - ringR + wave)) * (0.25 / i);
    }
    
    float centerField = exp(-length(st) * 2.5);
    
    vec3 innerColor = vec3(1.0, 0.3, 0.5);
    vec3 outerColor = vec3(0.3, 0.5, 1.0);
    vec3 energyColor = vec3(1.0, 1.0, 0.5);
    
    // Smile warms the colors
    innerColor = mix(innerColor, vec3(1.0, 0.6, 0.3), uSmile * 0.5);
    
    float distFromCenter = length(st);
    vec3 baseColor = mix(innerColor, outerColor, smoothstep(0.0, 0.8, distFromCenter));
    baseColor = mix(baseColor, energyColor, centerField * uAudioBeat * 0.5);
    
    baseColor += vec3(0.5, 0.8, 1.0) * uAudioSpectralCentroid * 0.2;
    
    return baseColor * (pattern + centerField * 0.4) * alpha;
}

vec3 pattern14_Fibonacci(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    // Head roll rotates the spiral
    st = rotate2D(uHeadRoll) * st;
    
    float pattern = 0.0;
    float lineWidth = 0.012 + uSmile * 0.005;
    
    float phi = 1.618033988749;
    
    float angle = atan(st.y, st.x);
    float radius = length(st);
    
    float arms = 2.0;
    for (float arm = 0.0; arm < arms; arm++) {
        float armOffset = arm * PI;
        
        float a = 0.05;
        float b = 0.3063;
        
        for (float wrap = -3.0; wrap <= 3.0; wrap++) {
            // Smile speeds up rotation
            float wrappedAngle = angle + armOffset + uTime * (0.15 + uSmile * 0.1) + wrap * TAU;
            float wrappedRadius = a * exp(b * wrappedAngle);
            
            if (wrappedRadius > 0.01 && wrappedRadius < 1.2) {
                float diff = abs(radius - wrappedRadius);
                pattern += smoothstep(lineWidth, 0.0, diff) * 0.4;
            }
        }
    }
    
    // Fibonacci points
    for (int i = 0; i < 10; i++) {
        float fibAngle = float(i) * phi * TAU + uTime * 0.08;
        float fibRadius = sqrt(float(i + 1)) * 0.08;
        
        vec2 fibPos = vec2(cos(fibAngle), sin(fibAngle)) * fibRadius;
        float fibDist = length(st - fibPos);
        
        float pointSize = 0.018 + uAudioMid * 0.015 + uEyebrowRaise * 0.01;
        pattern += smoothstep(pointSize, 0.0, fibDist) * 0.6;
    }
    
    vec3 color1 = vec3(1.0, 0.8, 0.2);
    vec3 color2 = vec3(0.6, 0.4, 0.2);
    vec3 color3 = vec3(0.2, 0.6, 0.4);
    
    float colorPhase = angle / TAU + radius + uTime * 0.08;
    vec3 baseColor = mix(color1, color2, sin(colorPhase * 3.0) * 0.5 + 0.5);
    baseColor = mix(baseColor, color3, sin(colorPhase * 5.0 + 1.0) * 0.5 + 0.5);
    
    baseColor += vec3(1.0, 0.9, 0.7) * uAudioBeat * 0.25;
    baseColor *= 1.0 + uAudioVolume * 0.2 + uSmile * 0.15;
    
    return baseColor * pattern * alpha;
}

vec3 pattern15_VesicaPiscis(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    float pattern = 0.0;
    float lineWidth = 0.01;
    
    // Mouth open affects radius
    float r = 0.4 + uAudioBass * 0.08 + uMouthOpen * 0.1;
    float sep = r * (0.5 + uAudioMid * 0.2);
    
    vec2 center1 = vec2(-sep, 0.0);
    vec2 center2 = vec2(sep, 0.0);
    
    float circle1 = length(st - center1) - r;
    float circle2 = length(st - center2) - r;
    
    pattern += smoothstep(lineWidth, 0.0, abs(circle1));
    pattern += smoothstep(lineWidth, 0.0, abs(circle2));
    
    float vesica = max(circle1, circle2);
    float vesicaInside = step(vesica, 0.0);
    
    float eyeRadius = r * 0.3;
    float eye = length(st) - eyeRadius;
    pattern += smoothstep(lineWidth, 0.0, abs(eye)) * vesicaInside;
    
    // Eye open affects pupil size
    float eyeOpenAvg = (uLeftEyeOpen + uRightEyeOpen) * 0.5;
    float pupilSize = eyeRadius * (0.3 + eyeOpenAvg * 0.2);
    float pupil = length(st) - pupilSize;
    pattern += smoothstep(0.0, lineWidth * 2.0, -pupil) * vesicaInside * 0.7;
    
    for (float i = 0.0; i < 4.0; i++) {
        float circleAngle = i * PI * 0.5 + uTime * 0.04;
        vec2 offset = vec2(cos(circleAngle), sin(circleAngle)) * r;
        
        float c = length(st - offset) - r * 0.5;
        pattern += smoothstep(lineWidth * 0.8, 0.0, abs(c)) * 0.3;
    }
    
    pattern += smoothstep(lineWidth * 0.5, 0.0, abs(st.x)) * 0.2;
    
    vec3 outerColor = vec3(0.1, 0.2, 0.4);
    vec3 vesicaColor = vec3(0.8, 0.7, 0.9);
    vec3 eyeColor = vec3(1.0, 0.95, 0.8);
    
    // Smile brightens vesica
    vesicaColor = mix(vesicaColor, vec3(1.0, 0.9, 0.8), uSmile * 0.3);
    
    vec3 baseColor = mix(outerColor, vesicaColor, vesicaInside);
    
    float eyeGlow = smoothstep(eyeRadius * 1.5, 0.0, length(st));
    baseColor = mix(baseColor, eyeColor, eyeGlow * 0.4);
    
    baseColor += eyeColor * uAudioBeat * eyeGlow * 0.3;
    
    float aura = exp(-length(st) * 1.5) * uAudioVolume * 0.4;
    baseColor += vec3(0.5, 0.3, 0.7) * aura;
    
    return baseColor * (pattern * 0.6 + 0.4) * alpha;
}

// ============================================
// NEW: EXPRESSION-REACTIVE PATTERNS (16-17)
// ============================================

// Pattern 16: Expression Aura - Direct expression visualization
vec3 pattern16_ExpressionAura(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    // Apply head pose
    st = rotate2D(uHeadRoll) * st;
    st += vec2(uHeadYaw * 0.3, uHeadPitch * 0.2);
    
    float dist = length(st);
    float angle = atan(st.y, st.x);
    
    // Base aura that pulses with expressions
    float auraSize = 0.5 + uSmile * 0.3 + uMouthOpen * 0.2;
    float aura = smoothstep(auraSize + 0.3, auraSize - 0.1, dist);
    
    // Smile creates expanding warm rings
    float smileRings = sin(dist * 15.0 - uTime * 3.0 - uSmile * 5.0) * 0.5 + 0.5;
    smileRings *= uSmile;
    
    // Mouth open creates vertical waves
    float mouthWaves = sin(st.y * 20.0 + uTime * 4.0) * uMouthOpen * 0.3;
    
    // Eyebrow raise creates upward energy
    float eyebrowEnergy = smoothstep(0.0, -0.5, st.y) * uEyebrowRaise;
    float eyebrowRays = sin(angle * 8.0 + uTime * 2.0) * 0.5 + 0.5;
    eyebrowRays *= eyebrowEnergy;
    
    // Frown creates downward pressure
    float frownPressure = smoothstep(0.0, 0.5, st.y) * uEyebrowFrown;
    float frownDark = 1.0 - frownPressure * 0.5;
    
    // Eye state creates pulsing circles
    float eyeAvg = (uLeftEyeOpen + uRightEyeOpen) * 0.5;
    float eyePulse = sin(dist * 10.0 - uTime * 2.0) * eyeAvg;
    
    // Color based on emotional state
    vec3 happyColor = vec3(1.0, 0.8, 0.3);   // Yellow/gold for smile
    vec3 surpriseColor = vec3(0.3, 0.8, 1.0); // Cyan for eyebrows up
    vec3 neutralColor = vec3(0.5, 0.4, 0.8);  // Purple base
    vec3 angryColor = vec3(0.8, 0.2, 0.1);    // Red for frown
    vec3 sleepyColor = vec3(0.2, 0.3, 0.5);   // Dark blue for eyes closed
    
    // Mix colors based on expression states
    vec3 color = neutralColor;
    color = mix(color, happyColor, uSmile);
    color = mix(color, surpriseColor, uEyebrowRaise);
    color = mix(color, angryColor, uEyebrowFrown);
    color = mix(color, sleepyColor, 1.0 - eyeAvg);
    
    // Apply patterns
    float pattern = aura;
    pattern += smileRings * 0.3;
    pattern += eyebrowRays * 0.2;
    pattern += eyePulse * 0.1;
    pattern += mouthWaves;
    
    // Audio modulation
    pattern += uAudioBeat * 0.2;
    color = mix(color, vec3(1.0), uAudioBeat * 0.3);
    
    // Final composition
    color *= pattern * frownDark;
    color += vec3(1.0, 0.9, 0.8) * exp(-dist * 3.0) * uSmile * 0.5;
    
    return color * alpha;
}

// Pattern 17: Emotion Particles - Particles that represent emotional state
vec3 pattern17_EmotionParticles(vec2 st, float alpha) {
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;
    
    vec3 color = vec3(0.0);
    
    // Determine dominant emotion for particle behavior
    float happiness = uSmile;
    float surprise = uEyebrowRaise;
    float intensity = uMouthOpen;
    float anger = uEyebrowFrown;
    float sleepiness = 1.0 - (uLeftEyeOpen + uRightEyeOpen) * 0.5;
    
    // Particle count based on emotional intensity
    float emotionIntensity = max(max(happiness, surprise), max(intensity, anger));
    float particleCount = 20.0 + emotionIntensity * 30.0;
    
    for (float i = 0.0; i < 50.0; i++) {
        if (i >= particleCount) break;
        
        // Base position from noise
        float seed = i * 0.1;
        vec2 basePos = vec2(
            sin(seed * 12.34 + uTime * 0.5) * 0.8,
            cos(seed * 56.78 + uTime * 0.3) * 0.8
        );
        
        // Happiness: particles rise and spread
        basePos.y += happiness * sin(uTime * 2.0 + i) * 0.3;
        basePos.x += happiness * cos(uTime * 1.5 + i * 0.5) * 0.2;
        
        // Surprise: particles explode outward
        float explodeAngle = seed * TAU;
        basePos += vec2(cos(explodeAngle), sin(explodeAngle)) * surprise * 0.4;
        
        // Mouth open: particles get sucked toward center-bottom
        vec2 mouthPos = vec2(0.0, -0.3);
        basePos = mix(basePos, mouthPos, intensity * 0.3);
        
        // Anger: particles vibrate and cluster
        basePos += vec2(
            sin(uTime * 20.0 + i * 5.0),
            cos(uTime * 20.0 + i * 3.0)
        ) * anger * 0.05;
        
        // Sleepiness: particles drift down slowly
        basePos.y -= sleepiness * 0.3;
        basePos.x += sin(uTime * 0.5 + i) * sleepiness * 0.1;
        
        // Calculate distance to particle
        float dist = length(st - basePos);
        
        // Particle size based on emotion
        float size = 0.03 + happiness * 0.02 + surprise * 0.03;
        size *= (1.0 - sleepiness * 0.5);
        
        // Particle glow
        float glow = smoothstep(size * 2.0, 0.0, dist);
        float core = smoothstep(size, 0.0, dist);
        
        // Color based on emotion
        vec3 particleColor = vec3(0.5, 0.5, 0.8); // Base purple
        particleColor = mix(particleColor, vec3(1.0, 0.9, 0.3), happiness); // Yellow for happy
        particleColor = mix(particleColor, vec3(0.3, 0.9, 1.0), surprise);  // Cyan for surprise
        particleColor = mix(particleColor, vec3(1.0, 0.3, 0.2), anger);     // Red for anger
        particleColor = mix(particleColor, vec3(0.2, 0.2, 0.4), sleepiness); // Dark for sleepy
        
        // Audio modulation
        particleColor = mix(particleColor, vec3(1.0), uAudioBeat * 0.3);
        
        color += particleColor * glow * 0.3;
        color += vec3(1.0) * core * 0.2;
    }
    
    // Add ambient glow based on mood
    float ambientGlow = exp(-length(st) * 2.0);
    vec3 ambientColor = vec3(0.3, 0.2, 0.5);
    ambientColor = mix(ambientColor, vec3(0.5, 0.4, 0.2), happiness);
    color += ambientColor * ambientGlow * 0.3;
    
    // Audio bass adds pulsing background
    color += vec3(0.2, 0.1, 0.3) * uAudioBass * 0.2;
    
    return color * alpha;
}

// ============================================
// MAIN
// ============================================

void main() {
    vec4 textureColor = texture2D(uTexture, vUv);
    float alpha = textureColor.a;
    
    if(alpha < 0.01) {
        discard;
    }
    
    vec3 patternColor = vec3(0.0);
    
    int pattern = int(floor(uPattern));
    
    // Original patterns
    if(pattern == 0) {
        patternColor = pattern0(vUv, alpha);
    } else if(pattern == 1) {
        patternColor = pattern1(vUv, alpha);
    } else if(pattern == 2) {
        patternColor = pattern2(vUv, alpha);
    } else if(pattern == 3) {
        patternColor = pattern3(vUv, alpha);
    } else if(pattern == 4) {
        patternColor = pattern4(vUv, alpha);
    } else if(pattern == 6) {
        patternColor = pattern6(vUv, alpha);
    } else if(pattern == 7) {
        patternColor = pattern7(vUv, alpha);
    }
    // Voronoi & Flow Field
    else if(pattern == 11) {
        patternColor = pattern11_Voronoi(vUv, alpha);
    } else if(pattern == 12) {
        patternColor = pattern12_FlowField(vUv, alpha);
    }
    // Sacred Geometry
    else if(pattern == 13) {
        patternColor = pattern13_Torus(vUv, alpha);
    } else if(pattern == 14) {
        patternColor = pattern14_Fibonacci(vUv, alpha);
    } else if(pattern == 15) {
        patternColor = pattern15_VesicaPiscis(vUv, alpha);
    }
    // Expression-reactive patterns (NEW)
    else if(pattern == 16) {
        patternColor = pattern16_ExpressionAura(vUv, alpha);
    } else if(pattern == 17) {
        patternColor = pattern17_EmotionParticles(vUv, alpha);
    }
    
    gl_FragColor = vec4(patternColor, alpha);
}
