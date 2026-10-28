// New Year's Eve behind you. The camera picture is drawn just above
// App.tsx's VideoBackground (GROUNDING.md, camera effects) and split by the
// portrait mask: the room becomes a night sky, deep navy to violet, with
// twinkling stars and a warm glow along the horizon over a city skyline of
// lit windows (two layers, the far one hazier); you stay lit, as the camera
// saw you, a touch cooler for the night. A soft vignette frames it. Until
// the mask is ready, the whole picture is the night.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Texture } from "three";
import { usePersonMaskTexture } from "@vincentt-xr/sdk";
import { useXRCameraTexture } from "@vincentt-xr/sdk/low-level";

import { personMask } from "./personMask";

const NIGHT = {
  /** Sky, top to horizon, and the glow over the city. */
  skyTop: [0.03, 0.05, 0.14] as const,
  skyLow: [0.2, 0.1, 0.32] as const,
  glow: [0.95, 0.45, 0.4] as const,
  /** Skyline heights (screen heights from the bottom): near, far. */
  near: [0.3, 0.56] as const,
  far: [0.42, 0.68] as const,
  /** Lit windows: colour and share lit. */
  window: [1, 0.8, 0.45] as const,
  lit: 0.42,
  /** You at night: brightness and a cool cast. */
  you: [0.94, 0.96, 1.04] as const,
  /** Brightness left in the corners. */
  vignette: 0.55,
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D cameraTexture;
  uniform sampler2D maskTexture;
  uniform float hasMask;
  uniform vec2 texel;
  uniform float aspect;
  uniform float time;
  uniform vec3 skyTop;
  uniform vec3 skyLow;
  uniform vec3 glowColor;
  uniform vec2 nearRange;
  uniform vec2 farRange;
  uniform vec3 windowColor;
  uniform float lit;
  uniform vec3 youTint;
  uniform float vignette;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // The person, softened: a small disc blur of the mask, then a smooth step.
  float person(vec2 uv) {
    if (hasMask < 0.5) return 0.0;
    float m = texture2D(maskTexture, uv).g * 0.2;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      m += texture2D(maskTexture, uv + vec2(cos(a), sin(a)) * texel * 3.0).g * 0.1;
    }
    return smoothstep(0.35, 0.75, m);
  }

  // One skyline layer at x (screen heights): building silhouette and lit
  // windows. Returns (inside, window light).
  vec2 skyline(float x, float y, float width, vec2 range, float seed) {
    float col = floor(x / width);
    float h = mix(range.x, range.y, hash(vec2(col, seed)));
    // Now and then a tower.
    h += step(0.86, hash(vec2(col, seed + 7.0))) * 0.08;
    float inside = step(y, h);
    vec2 cell = vec2(floor(x / (width / 4.0)), floor(y / 0.014));
    float inX = fract(x / (width / 4.0));
    float inY = fract(y / 0.014);
    float pane = step(0.25, inX) * step(inX, 0.75) * step(0.3, inY) * step(inY, 0.8);
    float on = step(1.0 - lit, hash(cell + seed));
    // A few windows switch on and off slowly.
    on *= step(0.08, fract(hash(cell * 1.7 + seed) + time * 0.02 * step(0.9, hash(cell + 3.0))));
    float edge = step(y, h - 0.012) * step(0.12, fract(x / width)) * step(fract(x / width), 0.88);
    return vec2(inside, pane * on * edge);
  }

  void main() {
    vec3 cam = texture2D(cameraTexture, vUv).rgb;
    float x = vUv.x * aspect;
    float y = vUv.y;

    // Sky.
    vec3 sky = mix(skyLow, skyTop, smoothstep(0.15, 0.95, y));
    sky += glowColor * 0.35 * exp(-max(y - 0.2, 0.0) * 9.0);
    // Stars, twinkling.
    vec2 sg = vec2(x, y) * 120.0;
    float sh = hash(floor(sg));
    float star = step(0.992, sh) * smoothstep(0.3, 0.0, length(fract(sg) - 0.5))
      * (0.55 + 0.45 * sin(time * (1.5 + sh * 4.0) + sh * 30.0))
      * smoothstep(0.35, 0.6, y);
    sky += vec3(star);

    // Far skyline, hazy; then near skyline, dark with warm windows.
    vec2 far = skyline(x + 3.7, y, 0.075, farRange, 11.0);
    vec3 farColor = mix(skyLow * 0.55, glowColor * 0.25, 0.3);
    sky = mix(sky, farColor + windowColor * far.y * 0.35, far.x);
    vec2 near = skyline(x, y, 0.11, nearRange, 3.0);
    vec3 nearColor = vec3(0.02, 0.025, 0.06);
    sky = mix(sky, nearColor + windowColor * near.y * 0.9, near.x);

    // You, a touch cooler for the night.
    vec3 you = cam * youTint;
    vec3 c = mix(sky, you, person(vUv));

    vec2 v = (vUv - 0.5) * vec2(1.0, 0.85);
    c *= mix(vignette, 1.0, smoothstep(0.78, 0.25, length(v)));
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const NightCity = () => {
  const cameraTexture = useXRCameraTexture();
  const { texture: maskTexture } = usePersonMaskTexture();
  const uniforms = useMemo(
    () => ({
      cameraTexture: { value: null as unknown },
      maskTexture: { value: null as unknown },
      hasMask: { value: 0 },
      texel: { value: [1 / 256, 1 / 256] },
      aspect: { value: 9 / 16 },
      time: { value: 0 },
      skyTop: { value: [...NIGHT.skyTop] },
      skyLow: { value: [...NIGHT.skyLow] },
      glowColor: { value: [...NIGHT.glow] },
      nearRange: { value: [...NIGHT.near] },
      farRange: { value: [...NIGHT.far] },
      windowColor: { value: [...NIGHT.window] },
      lit: { value: NIGHT.lit },
      youTint: { value: [...NIGHT.you] },
      vignette: { value: NIGHT.vignette },
    }),
    [],
  );
  useFrame((state) => {
    uniforms.time.value = state.clock.elapsedTime;
    uniforms.aspect.value = state.size.width / Math.max(1, state.size.height);
    personMask.mask.value = (maskTexture as Texture | null) ?? null;
    state.gl.getDrawingBufferSize(personMask.size.value);
    const img = (maskTexture as { image?: { width?: number; height?: number } })
      ?.image;
    if (img?.width && img.height)
      uniforms.texel.value = [1 / img.width, 1 / img.height];
  });
  if (!cameraTexture) return null; // tracker / media startup and source swaps
  uniforms.cameraTexture.value = cameraTexture;
  uniforms.maskTexture.value = maskTexture ?? null;
  uniforms.hasMask.value = maskTexture ? 1 : 0;
  return (
    <mesh renderOrder={-998} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};
