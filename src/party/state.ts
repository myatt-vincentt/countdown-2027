// Where the party is: waiting, counting down, the toot, then the
// celebration. One small store for the scene, the shutter and the dev keys.
import { useSyncExternalStore } from "react";

export type Phase = "wait" | "count" | "blow" | "party";

/** The countdown starts at this many seconds. */
export const COUNT_FROM = 5;
/** Seconds of waiting before the countdown starts on its own. */
export const AUTO_START = 6;
/** Seconds the party blower takes to unroll and toot at zero; seconds the party lasts. */
export const BLOW_TIME = 0.8;
export const PARTY_TIME = 8;

export type Party = {
  phase: Phase;
  /** When the phase started (performance.now() s). */
  since: number;
};

let current: Party = { phase: "wait", since: 0 };
const listeners = new Set<() => void>();

export const getParty = () => current;

export const useParty = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getParty,
    getParty,
  );

export const setPhase = (phase: Phase) => {
  current = { phase, since: performance.now() / 1000 };
  listeners.forEach((l) => l());
};
