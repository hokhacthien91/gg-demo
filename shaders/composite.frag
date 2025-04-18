precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_renderingTexture;
uniform sampler2D u_occlusionTexture;

uniform vec2 u_resolution;
uniform float u_fov;

uniform mat4 u_inverseViewMatrix;

uniform sampler2D u_shadowDepthTexture;
uniform vec2 u_shadowResolution;
uniform mat4 u_lightProjectionViewMatrix;

// Add uniform for base particle color
uniform float u_particleColorHue;
// Add uniform for color variety
uniform float u_colorVariety;
// Add uniform for time animation
uniform float u_time;

float linearstep (float left, float right, float x) {
    return clamp((x - left) / (right - left), 0.0, 1.0);
}

vec3 hsvToRGB(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Function to generate varied colors based on position and speed
vec3 getParticleColor(vec3 position, float speed, float baseHue) {
    // Add animated movement to positions by offsetting with time
    vec3 animatedPosition = position;
    
    // Create moving color waves in different directions with increased speed
    animatedPosition.x += sin(u_time * 0.7) * 15.0;
    animatedPosition.y += cos(u_time * 0.9) * 12.0;
    animatedPosition.z += sin(u_time * 0.8 + 1.5) * 18.0;
    
    // Create more chaotic circular moving patterns
    float circularMotion = sin(u_time * 0.5) * cos(u_time * 0.7) * 12.0;
    animatedPosition.x += circularMotion * cos(u_time * 0.8);
    animatedPosition.z += circularMotion * sin(u_time * 0.6);
    
    // Add more random fluctuations
    animatedPosition.x += sin(u_time * 1.2 + position.z * 0.5) * 8.0;
    animatedPosition.y += cos(u_time * 1.5 + position.x * 0.3) * 6.0;
    animatedPosition.z += sin(u_time * 1.3 + position.y * 0.4) * 10.0;
    
    // Use animated position to create color variations
    float positionFactor = sin(animatedPosition.x * 0.3) * 0.2 + 
                          cos(animatedPosition.z * 0.2) * 0.2 + 
                          sin(animatedPosition.y * 0.25) * 0.1;
    
    // Add time-based animation for more dynamic color shifts
    float timeFactor = sin(u_time * 0.5 + animatedPosition.x * 0.5 + 
                           animatedPosition.y * 0.3 + animatedPosition.z * 0.2) * 0.15;
    
    // Apply color variety factor - when 0, no position-based variation
    positionFactor *= u_colorVariety;
    timeFactor *= u_colorVariety;
    
    // Calculate final hue by adding variations to the base hue
    float hue = mod(baseHue + positionFactor + timeFactor, 1.0);
    
    // Speed affects saturation and brightness
    float saturation = 0.7 + speed * 0.01 + sin(u_time * 0.3 + animatedPosition.y * 0.2) * 0.15 * u_colorVariety;
    float brightness = 0.9 + speed * 0.02 + cos(u_time * 0.4 + animatedPosition.x * 0.1) * 0.1 * u_colorVariety;
    
    // Keep values in valid range
    saturation = clamp(saturation, 0.5, 1.0);
    brightness = clamp(brightness, 0.7, 1.0);
    
    return hsvToRGB(vec3(hue, saturation, brightness));
}

void main () {
    vec4 data = texture2D(u_renderingTexture, v_coordinates);
    float occlusion = texture2D(u_occlusionTexture, v_coordinates).r;

    vec3 viewSpaceNormal = vec3(data.x, data.y, sqrt(1.0 - data.x * data.x - data.y * data.y));

    float viewSpaceZ = data.a;
    vec3 viewRay = vec3(
        (v_coordinates.x * 2.0 - 1.0) * tan(u_fov / 2.0) * u_resolution.x / u_resolution.y,
        (v_coordinates.y * 2.0 - 1.0) * tan(u_fov / 2.0),
        -1.0);

    vec3 viewSpacePosition = viewRay * -viewSpaceZ;
    vec3 worldSpacePosition = vec3(u_inverseViewMatrix * vec4(viewSpacePosition, 1.0));

    float speed = data.b;
    
    // Use the new function to generate varied colors
    vec3 color = getParticleColor(worldSpacePosition, speed, u_particleColorHue);

    vec4 lightSpacePosition = u_lightProjectionViewMatrix * vec4(worldSpacePosition, 1.0);
    lightSpacePosition /= lightSpacePosition.w;
    lightSpacePosition *= 0.5;
    lightSpacePosition += 0.5;
    vec2 lightSpaceCoordinates = lightSpacePosition.xy;
    
    float shadow = 1.0;
    const int PCF_WIDTH = 2;
    const float PCF_NORMALIZATION = float(PCF_WIDTH * 2 + 1) * float(PCF_WIDTH * 2 + 1);

    for (int xOffset = -PCF_WIDTH; xOffset <= PCF_WIDTH; ++xOffset) {
        for (int yOffset = -PCF_WIDTH; yOffset <= PCF_WIDTH; ++yOffset) {
            float shadowSample = texture2D(u_shadowDepthTexture, lightSpaceCoordinates + 5.0 * vec2(float(xOffset), float(yOffset)) / u_shadowResolution).r;
            if (lightSpacePosition.z > shadowSample + 0.001) shadow -= 1.0 / PCF_NORMALIZATION;
        }
    }


    float ambient = 1.0 - occlusion * 0.7;
    float direct = 1.0 - (1.0 - shadow) * 0.8;

    color *= ambient * direct;

    if (speed >= 0.0) {
        gl_FragColor = vec4(color, 1.0);
    } else {
        vec3 backgroundColor = vec3(1.0) - length(v_coordinates * 2.0 - 1.0) * 0.1;
        gl_FragColor = vec4(backgroundColor, 1.0);
    }

    //gl_FragColor = vec4(texture2D(u_shadowDepthTexture, v_coordinates).rrr, 1.0);
}
