// Confetti when the new year lands: little paper rectangles in party colours
// that flutter, spin and sway down in front of everything, a shower at
// first, thinning out. Drawn straight in screen space, one draw call.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color } from "three";

import { getParty } from "./state";

const CONFETTI = {
  count: 160,
  /** Seconds it keeps coming. */
  pour: 4.5,
  /** Fall speed (screen heights / s), size (CSS px). */
  fall: [0.14, 0.26] as const,
  size: [18, 26] as const,
  colors: ["#f4d968", "#ff6fae", "#64a8ff", "#7ef0c8", "#ffffff", "#c38bff"],
};

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float spin;
  attribute float flip;
  attribute float alpha;
  attribute vec3 tint;
  uniform float pixelRatio;
  varying float vSpin;
  varying float vFlip;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    gl_Position = vec4(position.xy, -0.999, 1.0);
    gl_PointSize = size * pixelRatio;
    vSpin = spin;
    vFlip = flip;
    vAlpha = alpha;
    vTint = tint;
  }
`;

// A paper strip turning: rotated by spin, its width squeezed by flip (the
// strip turning over), the far side a little darker.
const fragmentShader = /* glsl */ `
  varying float vSpin;
  varying float vFlip;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    if (vAlpha <= 0.0) discard;
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin);
    float s = sin(vSpin);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float w = 0.2 * abs(vFlip) + 0.04;
    if (abs(p.x) > w || abs(p.y) > 0.4) discard;
    vec3 col = vTint * (vFlip > 0.0 ? 1.0 : 0.72);
    gl_FragColor = vec4(col, vAlpha);
  }
`;

type Piece = {
  x: number;
  y: number;
  fall: number;
  sway: number;
  spin: number;
  turn: number;
  at: number;
};

export const Confetti = () => {
  const gl = useThree((s) => s.gl);
  const { geometry, attrs } = useMemo(() => {
    const g = new BufferGeometry();
    const n = CONFETTI.count;
    const a = {
      position: new BufferAttribute(new Float32Array(n * 3), 3),
      size: new BufferAttribute(new Float32Array(n), 1),
      spin: new BufferAttribute(new Float32Array(n), 1),
      flip: new BufferAttribute(new Float32Array(n), 1),
      alpha: new BufferAttribute(new Float32Array(n), 1),
      tint: new BufferAttribute(new Float32Array(n * 3), 3),
    };
    Object.entries(a).forEach(([name, attr]) => g.setAttribute(name, attr));
    const col = new Color();
    for (let i = 0; i < n; i += 1) {
      col.set(CONFETTI.colors[i % CONFETTI.colors.length]);
      a.tint.setXYZ(i, col.r, col.g, col.b);
      a.size.setX(
        i,
        CONFETTI.size[0] +
          Math.random() * (CONFETTI.size[1] - CONFETTI.size[0]),
      );
    }
    return { geometry: g, attrs: a };
  }, []);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  const pieces = useRef<Piece[]>([]);
  const since = useRef(-1);

  useFrame((st) => {
    const t = performance.now() / 1000;
    const half = st.size.width / Math.max(1, st.size.height) / 2;
    const party = getParty();
    if (party.phase === "party" && party.since !== since.current) {
      since.current = party.since;
      // Each piece starts somewhere above the screen, the later ones later,
      // so it pours and then thins out.
      pieces.current = Array.from({ length: CONFETTI.count }, () => ({
        x: (Math.random() * 2 - 1) * half,
        y: 0.52 + Math.random() * 0.1,
        fall:
          CONFETTI.fall[0] +
          Math.random() * (CONFETTI.fall[1] - CONFETTI.fall[0]),
        sway: Math.random() * Math.PI * 2,
        spin: (Math.random() * 2 - 1) * 5,
        turn: 4 + Math.random() * 6,
        at: t + Math.random() ** 1.6 * CONFETTI.pour,
      }));
    }
    const on = party.phase === "party";
    pieces.current.forEach((p, i) => {
      const age = t - p.at;
      if (!on || age < 0 || p.y - p.fall * age < -0.6) {
        attrs.alpha.setX(i, 0);
        return;
      }
      attrs.position.setXYZ(
        i,
        (p.x + Math.sin(age * 2 + p.sway) * 0.025) / half,
        (p.y - p.fall * age) * 2,
        0,
      );
      attrs.spin.setX(i, p.sway + p.spin * age);
      attrs.flip.setX(i, Math.cos(p.turn * age + p.sway));
      attrs.alpha.setX(i, 1);
    });
    Object.values(attrs).forEach((a) => {
      // eslint-disable-next-line no-param-reassign
      a.needsUpdate = true;
    });
    uniforms.pixelRatio.value = gl.getPixelRatio();
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={1000}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
};
