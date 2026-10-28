// Live readings, written every frame (no re-renders).
export const live = {
  blendshapes: {} as Readonly<Record<string, number | undefined>>,
  /** A face is being tracked (FilteredHead). */
  tracked: false,
  /** Bumps on each head shake: the pieces play their wobble. */
  shakes: 0,
  /** Dev only (window.__party): stands in for the face's readings. */
  override: null as Readonly<Record<string, number | undefined>> | null,
};
