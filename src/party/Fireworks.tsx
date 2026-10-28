// The fireworks when the new year lands: rockets climb and burst into glowing
// sparks with short trails that slow, sag and fade. Most burst in the sky
// behind you (hidden wherever the portrait mask says you are, and behind
// the crown); about one in four bursts in front, near the edges. A volley
// opens the party, then one about every half second. Drawn straight in
// screen space, additive, one draw call a layer.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
} from "three";

import { personMask } from "./personMask";
import { getParty, PARTY_TIME } from "./state";

const FIRE = {
  /** Bursts alive at once per layer, sparks per burst, trail samples per spark. */
  bursts: 8,
  sparks: 80,
  trail: 3,
  /** Rocket climb (s), spark life (s), drag, sag (screen heights / s²). */
  climb: 0.45,
  life: 2,
  drag: 1.8,
  sag: 0.09,
  /** Spark speed (screen heights / s). */
  speed: [0.4, 0.7] as const,
  /** Opening volley, then a burst about every `every` s until near the end. */
  volley: 3,
  every: 0.45,
  /** One in this many bursts is in front of you. */
  front: 4,
  /** Spark size (CSS px), behind and in front. */
  size: [8, 12] as const,
  colors: ["#f4d968", "#ff6fae", "#64a8ff", "#7ef0c8", "#ffffff"],
};

type Burst = {
  x: number;
  y: number;
  at: number;
  color: Color;
  /** Spark directions × speed. */
  v: Float32Array;
};

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float pixelRatio;
  uniform float depth;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    gl_Position = vec4(position.xy, depth, 1.0);
    gl_PointSize = size * pixelRatio;
    vAlpha = alpha;
    vTint = tint;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float behind;
  uniform sampler2D personMask;
  uniform vec2 personMaskSize;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    if (vAlpha <= 0.0) discard;
    if (behind > 0.5 &&
        texture2D(personMask, gl_FragCoord.xy / personMaskSize).g > 0.5)
      discard;
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.45, 0.0, r);
    float glow = smoothstep(1.0, 0.0, r) * 0.45;
    vec3 c = mix(vTint, vec3(1.0), core * 0.6);
    gl_FragColor = vec4(c * (core + glow) * vAlpha, 1.0);
  }
`;

const between = ([a, b]: readonly [number, number]) =>
  a + Math.random() * (b - a);

const makeBurst = (half: number, front: boolean, at: number): Burst => {
  const v = new Float32Array(FIRE.sparks * 2);
  for (let i = 0; i < FIRE.sparks; i += 1) {
    const a = (i / FIRE.sparks) * Math.PI * 2 + Math.random() * 0.2;
    const s = between(FIRE.speed) * (0.75 + Math.random() * 0.25);
    v[i * 2] = Math.cos(a) * s;
    v[i * 2 + 1] = Math.sin(a) * s;
  }
  const side = Math.random() < 0.5 ? -1 : 1;
  return {
    // In front: out by the edges, clear of the face. Behind: anywhere up high.
    x: front
      ? side * half * (0.55 + Math.random() * 0.3)
      : (Math.random() * 2 - 1) * half * 0.85,
    y: front ? Math.random() * 0.3 : 0.05 + Math.random() * 0.37,
    at,
    color: new Color(
      FIRE.colors[Math.floor(Math.random() * FIRE.colors.length)],
    ),
    v,
  };
};

/** One layer's points: rockets and sparks with their trails. */
const useLayer = () =>
  useMemo(() => {
    const count = FIRE.bursts * (FIRE.sparks * FIRE.trail + 1);
    const g = new BufferGeometry();
    const attrs = {
      position: new BufferAttribute(new Float32Array(count * 3), 3),
      size: new BufferAttribute(new Float32Array(count), 1),
      alpha: new BufferAttribute(new Float32Array(count), 1),
      tint: new BufferAttribute(new Float32Array(count * 3), 3),
    };
    Object.entries(attrs).forEach(([n, a]) => g.setAttribute(n, a));
    return { geometry: g, attrs, count };
  }, []);

type Layer = ReturnType<typeof useLayer>;

/** Writes a layer's bursts into its points. */
const writeLayer = (
  layer: Layer,
  bursts: Burst[],
  t: number,
  half: number,
  size: number,
) => {
  const { attrs } = layer;
  let n = 0;
  const put = (x: number, y: number, s: number, a: number, c: Color) => {
    attrs.position.setXYZ(n, x / half, y * 2, 0);
    attrs.size.setX(n, s);
    attrs.alpha.setX(n, a);
    attrs.tint.setXYZ(n, c.r, c.g, c.b);
    n += 1;
  };
  bursts.forEach((b) => {
    const age = t - b.at;
    if (age < FIRE.climb) {
      // The rocket, climbing from below the screen with a fading tail.
      const k = 1 - (1 - age / FIRE.climb) ** 2;
      put(b.x, -0.55 + (b.y + 0.55) * k, size * 0.9, 0.9, b.color);
      return;
    }
    const a = age - FIRE.climb;
    for (let i = 0; i < FIRE.sparks; i += 1) {
      for (let j = 0; j < FIRE.trail; j += 1) {
        const tj = Math.max(0, a - j * 0.045);
        const out = (1 - Math.exp(-FIRE.drag * tj)) / FIRE.drag;
        const fade = Math.max(0, 1 - (tj / FIRE.life) ** 2);
        // Late sparks twinkle out.
        const twinkle =
          tj > FIRE.life * 0.6 ? 0.5 + 0.5 * Math.sin(tj * 40 + i) : 1;
        put(
          b.x + b.v[i * 2] * out,
          b.y + b.v[i * 2 + 1] * out - FIRE.sag * tj * tj,
          size * (1 - j * 0.25) * (1 - 0.4 * (tj / FIRE.life)),
          fade * twinkle * (1 - j * 0.35),
          b.color,
        );
      }
    }
  });
  for (; n < layer.count; n += 1) attrs.alpha.setX(n, 0);
  Object.values(attrs).forEach((x) => {
    // eslint-disable-next-line no-param-reassign
    x.needsUpdate = true;
  });
};

const Points = ({ layer, behind }: { layer: Layer; behind: boolean }) => {
  const uniforms = useMemo(
    () => ({
      pixelRatio: { value: 1 },
      // Behind: at the back, so the crown and the boppers hide them.
      depth: { value: behind ? 0.999 : -0.999 },
      behind: { value: behind ? 1 : 0 },
      personMask: personMask.mask,
      personMaskSize: personMask.size,
    }),
    [behind],
  );
  const gl = useThree((s) => s.gl);
  useFrame(() => {
    uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return (
    <points
      geometry={layer.geometry}
      frustumCulled={false}
      renderOrder={behind ? -997 : 999}
    >
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        depthTest={behind}
        toneMapped={false}
      />
    </points>
  );
};

export const Fireworks = () => {
  const back = useLayer();
  const front = useLayer();
  const state = useRef({
    since: -1,
    next: 0,
    count: 0,
    back: [] as Burst[],
    front: [] as Burst[],
  });
  useFrame((st) => {
    const t = performance.now() / 1000;
    const s = state.current;
    const half = st.size.width / Math.max(1, st.size.height) / 2;
    const party = getParty();
    if (party.phase === "party" && party.since !== s.since) {
      // A new year: the opening volley.
      s.since = party.since;
      s.next = t;
      s.count = 0;
    }
    const live = party.phase === "party" && t - party.since < PARTY_TIME - 1.5;
    while (live && t >= s.next) {
      const inFront = s.count % FIRE.front === FIRE.front - 1;
      const list = inFront ? s.front : s.back;
      list.push(makeBurst(half, inFront, s.next));
      s.count += 1;
      s.next +=
        s.count < FIRE.volley ? 0.12 : FIRE.every * (0.6 + Math.random() * 0.8);
    }
    const done = (b: Burst) => t - b.at < FIRE.climb + FIRE.life + 0.2;
    s.back = s.back.filter(done).slice(-FIRE.bursts);
    s.front = s.front.filter(done).slice(-FIRE.bursts);
    writeLayer(back, s.back, t, half, FIRE.size[0]);
    writeLayer(front, s.front, t, half, FIRE.size[1]);
  });
  return (
    <>
      <Points layer={back} behind />
      <Points layer={front} behind={false} />
    </>
  );
};
