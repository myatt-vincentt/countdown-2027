// The party pieces: gold star boppers while you wait, the party blower for
// the countdown's last beat, and the 2027 crown when the new year lands.
// vincentt.studio head accessories (public/models/vincentt-*.glb), authored
// in metres in the "Complete 3D Reference - Spark AR" face frame (origin at
// the front of the face, +Y up, +Z out of the face) — see FRAME.

export type Part = {
  /** File name in public/models without `vincentt-` / `.glb`. */
  id: string;
  /**
   * One of the file's own presets, by name: its finish, and its colour
   * variant of every material that has one (`mat_x` → `mat_x__<preset>`).
   * The first preset when unset.
   */
  preset?: string;
  /** Material swaps by name, to another material in the same file. */
  materials?: Record<string, string>;
  /** Tints by material name (on this part's own copy of the material). */
  colors?: Record<string, string>;
  /** Fine placement: `x` / `y` / `z` canonical cm, `scale` about its middle. */
  fit?: { x?: number; y?: number; z?: number; scale?: number };
  /** Its face triggers read these inputs from other face readings (`{ jawOpen: "blow" }`). */
  inputs?: Record<string, string>;
  /** Falls into place from this far above (cm) when it appears. */
  drop?: number;
};

export const BOPPERS: Part = { id: "bopper-stars", preset: "Gold" };
/** Unrolls as you blow (its own trigger follows an open mouth). */
export const BLOWER: Part = {
  id: "mouth-party-blower",
  preset: "Gold Foil",
  inputs: { jawOpen: "blow" },
};
/** Drops onto your head when the new year lands. */
export const CROWN: Part = { id: "new-year-2027-crown", drop: 35 };

/** A part's identity: the same model in another preset is another piece. */
export const partKey = (p: Part) => `${p.id}:${p.preset ?? ""}`;

export const modelUrl = (id: string) => `/models/vincentt-${id}.glb`;

/** The SDK's v3 head occluder, hosted here until the SDK CDN serves it. */
export const OCCLUDER_URL = "/models/head-occluder-v3.glb";

/** The SDK's neck-and-shoulders bust occluder (same story). */
export const NECK_OCCLUDER_URL = "/models/neck-occluder-bust-v1.glb";

/**
 * The models' frame → the SDK's canonical head frame (centimetres): ×100,
 * then the same shift the SDK used to move the Spark AR reference into the
 * canonical frame (chins and nose tips aligned; vincentt-xr-sdk
 * assets-src/head-occluder/README.md).
 */
export const FRAME = {
  scale: 100,
  position: [0, -1.03, 7.3] as const,
};
