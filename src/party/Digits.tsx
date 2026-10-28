// The countdown: big glossy gold 3D digits, 5 to 1, one a second, each
// popping in (strict ease-out, no overshoot). Held at a fixed place on the
// screen, below the face where you can still see yourself (the feedback
// band), the same size however near or far you stand.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, Text3D } from "@react-three/drei";
import { Vector3, type Group, type PerspectiveCamera } from "three";

import { COUNT_FROM, useParty } from "./state";

const DIGITS = {
  /** Where on screen (NDC, y up), and the digit height (screen heights). */
  at: [0, -0.38] as const,
  height: 0.17,
  /** Distance in front of the camera it's placed at (scene units). */
  distance: 3,
  /** Text size the height is measured against. */
  size: 10,
  depth: 2.2,
  /** Pop: from this scale, over this long (s). */
  from: 1.25,
  pop: 0.2,
  /** Arles, the brand gold. */
  color: "#f4d968",
};

const FONT = "/fonts/Poppins_Regular.json";
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** What the digits say now, and when that began (s), or null for nothing. */
const labelAt = (
  phase: string,
  since: number,
  now: number,
): { text: string; at: number } | null => {
  if (phase === "count") {
    const k = Math.min(COUNT_FROM - 1, Math.floor(now - since));
    return { text: String(COUNT_FROM - k), at: since + k };
  }
  return null;
};

export const Digits = () => {
  const party = useParty();
  const g = useRef<Group>(null);
  const [text, setText] = useState("");
  const v = useRef(new Vector3());
  useFrame((state) => {
    const o = g.current;
    if (!o) return;
    // Pin it to the screen: a point down the view at `distance`, facing the
    // camera, sized to a share of the screen's height.
    const cam = state.camera as PerspectiveCamera;
    v.current.set(DIGITS.at[0], DIGITS.at[1], 0.5).unproject(cam);
    v.current.sub(cam.position).normalize().multiplyScalar(DIGITS.distance);
    o.position.copy(cam.position).add(v.current);
    o.quaternion.copy(cam.quaternion);
    const viewH =
      2 * DIGITS.distance * Math.tan(((cam.fov ?? 50) * Math.PI) / 360);
    const fit = (DIGITS.height * viewH) / DIGITS.size;
    const now = performance.now() / 1000;
    const label = labelAt(party.phase, party.since, now);
    const next = label?.text ?? "";
    if (next !== text) setText(next);
    if (!label) {
      o.visible = false;
      return;
    }
    const k = Math.min(1, (now - label.at) / DIGITS.pop);
    o.visible = true;
    o.scale.setScalar(fit * (DIGITS.from + (1 - DIGITS.from) * easeOut(k)));
  });
  return (
    <group ref={g} visible={false} renderOrder={20}>
      {text ? (
        <Center key={text}>
          <Text3D
            font={FONT}
            size={DIGITS.size}
            height={DIGITS.depth}
            bevelEnabled
            bevelSize={0.35}
            bevelThickness={0.5}
            curveSegments={8}
          >
            {text}
            <meshStandardMaterial
              color={DIGITS.color}
              metalness={0.85}
              roughness={0.22}
              emissive={DIGITS.color}
              emissiveIntensity={0.18}
            />
          </Text3D>
        </Center>
      ) : null}
    </group>
  );
};
