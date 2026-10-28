// Scene.tsx — Countdown 2027: tap record (or wait) for a five-second
// countdown; at zero the party blower toots and the new year lands with
// fireworks, the 2027 crown and confetti, over a New Year's Eve city. See
// PLAN.md.
import { lazy, Suspense } from "react";

import { PartyScene } from "./party/PartyScene";

// Dev-only helpers for previewing without a camera. Lazy and behind a
// constant esbuild folds to false in production. Two rules:
// `process.env.NODE_ENV`, not `import.meta.env.DEV` (vincentt-xr/v2-template#112);
// and write the check INSIDE the ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevKeys =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./party/DevKeys"))
    : null;

export const Scene = () => (
  <>
    <PartyScene />
    {DevMediaSwitcher && DevKeys ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
        <DevKeys />
      </Suspense>
    ) : null}
  </>
);
