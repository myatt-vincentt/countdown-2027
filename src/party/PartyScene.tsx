// Countdown 2027: the New Year's Eve city behind you (NightCity.tsx), gold
// star boppers on the filtered head (FilteredHead.tsx: the SDK's canonical
// head fit through a spring, with the depth-only head occluder in the same
// group), the countdown digits below the face, the party blower for the last beat
// and the 2027 crown when the year turns. The pieces are in metres in the
// Spark AR face frame; FRAME turns them into canonical centimetres.
import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
// eslint-disable-next-line import/extensions
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useFaceInfo, useGesture } from "@vincentt-xr/sdk/tracking";

import { Capture } from "./Capture";
import { Confetti } from "./Confetti";
import { Digits } from "./Digits";
import { Fireworks } from "./Fireworks";
import { FACE_FPS, FilteredHead } from "./FilteredHead";
import { live } from "./live";
import { NightCity } from "./NightCity";
import { BLOWER, BOPPERS, CROWN, FRAME } from "./outfit";
import {
  AUTO_START,
  BLOW_TIME,
  COUNT_FROM,
  getParty,
  PARTY_TIME,
  setPhase,
  useParty,
} from "./state";
import { Swap } from "./Swap";

/** The blendshapes the pieces' face_triggers read (see rig.ts). */
const FACE_INPUTS = [
  "jawOpen",
  "mouthSmileLeft",
  "mouthSmileRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "browInnerUp",
  "browDownLeft",
  "browDownRight",
];
/** Per-second easing of the readings (higher = snappier, noisier). */
const FACE_EASE = 14;
/** Seconds the blower stays, unrolled, after it sets the new year off. */
const TOOT = 0.9;

/** Copies the face's blendshapes into `live` and counts head shakes. */
const FaceSignals = () => {
  // Same options as FilteredHead's FaceTracker: the first consumer of the
  // shared face model sets its face count and rate.
  const face = useFaceInfo({ active: true, numFaces: 1, targetFps: FACE_FPS });
  const raw = useRef<Readonly<Record<string, number | undefined>>>({});
  raw.current = face?.blendshapes ?? {};
  // Raw blendshapes flicker a few percent frame to frame; ease toward them.
  const smooth = useRef<Record<string, number>>({});
  useFrame((_st, dt) => {
    const k = 1 - Math.exp(-FACE_EASE * Math.min(dt, 0.1));
    const out = smooth.current;
    FACE_INPUTS.forEach((name) => {
      const v = raw.current[name] ?? 0;
      out[name] = (out[name] ?? v) + (v - (out[name] ?? v)) * k;
    });
    // "blow" drives the party blower: it unrolls by itself at zero and
    // stays out for the new year's first moment (the toot).
    const { phase, since } = getParty();
    const age = performance.now() / 1000 - since;
    if (phase === "blow") out.blow = Math.min(1, age / (BLOW_TIME * 0.75));
    else out.blow = phase === "party" && age < TOOT ? 1 : 0;
    live.blendshapes = out;
  }, -1);
  useGesture("headShake", {
    onBegin: () => {
      live.shakes += 1;
    },
  });
  return null;
};

/**
 * Moves the party on by the clock: wait → count (on its own after a while,
 * or at once from the shutter) → the toot → party → wait.
 */
const PhaseClock = () => {
  useFrame(() => {
    const { phase, since } = getParty();
    const age = performance.now() / 1000 - since;
    if (phase === "wait" && age >= AUTO_START) setPhase("count");
    else if (phase === "count" && age >= COUNT_FROM) setPhase("blow");
    else if (phase === "blow" && age >= BLOW_TIME) setPhase("party");
    else if (phase === "party" && age >= PARTY_TIME) setPhase("wait");
  });
  return null;
};

/** Soft studio reflections, so the gold reads on camera. */
const useStudioLight = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const before = scene.environment;
    scene.environment = tex;
    return () => {
      scene.environment = before;
      tex.dispose();
    };
  }, [gl, scene]);
};

/** True for the new year's first TOOT seconds. */
const useTooting = (phase: string, since: number) => {
  const [tooting, setTooting] = useState(false);
  useEffect(() => {
    if (phase !== "party") {
      setTooting(false);
      return undefined;
    }
    setTooting(true);
    const id = window.setTimeout(() => setTooting(false), TOOT * 1000);
    return () => window.clearTimeout(id);
  }, [phase, since]);
  return tooting;
};

export const PartyScene = () => {
  const { phase, since } = useParty();
  const tooting = useTooting(phase, since);
  useStudioLight();
  return (
    <>
      <NightCity />
      <Fireworks />
      <Confetti />
      <FaceSignals />
      <PhaseClock />
      <Capture />
      <FilteredHead>
        <group name="party-frame" scale={FRAME.scale} position={FRAME.position}>
          <Swap part={phase === "party" ? CROWN : BOPPERS} />
          <Swap part={phase === "blow" || tooting ? BLOWER : null} />
        </group>
      </FilteredHead>
      <Suspense fallback={null}>
        <Digits />
      </Suspense>
    </>
  );
};
