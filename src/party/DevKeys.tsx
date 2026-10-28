// Dev only: 1 waits, 2 starts the countdown, 3 jumps to the toot, 4 to the
// party; window.__party exposes the store and the live readings for
// debugging. Scene.tsx lazy-imports this behind an inline NODE_ENV check, so
// it never reaches production.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { live } from "./live";
import { getParty, setPhase, type Phase } from "./state";

const KEYS: Record<string, Phase> = {
  "1": "wait",
  "2": "count",
  "3": "blow",
  "4": "party",
};

const DevKeys = () => {
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__party = {
      get: getParty,
      set: setPhase,
      live,
      scene,
    };
    const onKey = (e: KeyboardEvent) => {
      const phase = KEYS[e.key];
      if (phase) setPhase(phase);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene]);
  return null;
};

export default DevKeys;
