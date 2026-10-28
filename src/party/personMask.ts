// The portrait mask, shared: NightCity.tsx keeps it and the drawing size
// current, and the far fireworks hide wherever it says you are.
import { Vector2, type Texture } from "three";

export const personMask = {
  mask: { value: null as Texture | null },
  /** Drawing-buffer size in pixels: gl_FragCoord → screen uv. */
  size: { value: new Vector2(1, 1) },
};
