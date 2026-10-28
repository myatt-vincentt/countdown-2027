// One model on the head: loaded once (shared cache), cloned, recoloured by
// swapping to the file's own materials for the chosen preset, playing the
// loops its author marked autoplay (scenes[0].extras.vincentt_config),
// following the face triggers (rig.ts), wobbling on a head shake, popping in
// about its own middle, and shrinking away when it leaves.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AnimationMixer,
  Box3,
  LoopOnce,
  LoopRepeat,
  Vector3,
  type AnimationClip,
  type Group,
  type Material,
  type Mesh,
  type Object3D,
  type Color,
} from "three";
// eslint-disable-next-line import/extensions
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
// eslint-disable-next-line import/extensions
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  defineGltfAsset,
  useXRAsset,
  type XRAssetDefinition,
} from "@vincentt-xr/sdk";

import { modelUrl, type Part as PartSpec } from "./outfit";
import { live } from "./live";
import { buildRig, type FaceTrigger } from "./rig";

const assets = new Map<string, XRAssetDefinition<GLTF>>();
export const assetFor = (id: string) => {
  let a = assets.get(id);
  if (!a) {
    a = defineGltfAsset(modelUrl(id));
    assets.set(id, a);
  }
  return a;
};

type ClipConfig = { clip: string; loop?: boolean; autoplay?: boolean };
type ItemConfig = {
  presets?: { name?: string; finish?: string }[];
  finishes?: { id: string; map?: Record<string, string> }[];
  animations?: ClipConfig[];
  rig?: { autoplay?: boolean };
  face_triggers?: FaceTrigger[];
  actions?: { clip: string; triggers?: string[] }[];
};

/** Clips that loop while worn. */
const autoplayClips = (cfg: ItemConfig, clips: AnimationClip[]) => {
  if (cfg.animations?.length)
    return cfg.animations
      .filter((a) => a.autoplay)
      .map((a) => clips.find((c) => c.name === a.clip))
      .filter((c): c is AnimationClip => !!c);
  return cfg.rig?.autoplay ? clips : [];
};

/** The one-shot clip a head shake plays (only where the author asked). */
const shakeClip = (cfg: ItemConfig, clips: AnimationClip[]) => {
  const a = cfg.actions?.find((x) => x.triggers?.includes("headShake"));
  return a ? clips.find((c) => c.name === a.clip) : undefined;
};

/** Mesh renderOrder: opaque / see-through (the head occluder is -1). */
export const ORDER = [5, 6] as const;

/** `Spooky Night` → `spooky_night`: how a preset names its material variants. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/**
 * The swaps a part gets: its preset's finish, then the preset's colour
 * variant of each material that has one, then its own.
 */
const swapsFor = (cfg: ItemConfig, part: PartSpec, names: string[]) => {
  const preset =
    cfg.presets?.find((p) => p.name === part.preset) ?? cfg.presets?.[0];
  const finish = cfg.finishes?.find((f) => f.id === preset?.finish)?.map ?? {};
  const variant: Record<string, string> = {};
  if (part.preset) {
    const have = new Set(names);
    const tag = `__${slug(part.preset)}`;
    names.forEach((n) => {
      if (!n.includes("__") && have.has(n + tag)) variant[n] = n + tag;
    });
  }
  return { ...finish, ...variant, ...part.materials };
};

const materialNames = (value: GLTF) =>
  ((value.parser.json.materials ?? []) as { name?: string }[]).map(
    (d) => d.name ?? "",
  );

const prepare = (
  root: Object3D,
  swaps: Record<string, string>,
  spare: Map<string, Material>,
  colors?: Record<string, string>,
) => {
  const tinted = new Map<Material, Material>();
  root.traverse((o) => {
    // The finish swatches only preview a file's finishes in its editor.
    if (o.name.includes("finish_swatch")) {
      // eslint-disable-next-line no-param-reassign
      o.visible = false;
      return;
    }
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    if (!Array.isArray(m.material)) {
      const to = spare.get(swaps[m.material.name]);
      if (to) m.material = to;
      const tint = colors?.[m.material.name];
      if (tint) {
        // Its own copy, so other parts sharing the material keep theirs.
        let t = tinted.get(m.material);
        if (!t) {
          t = m.material.clone();
          (t as Material & { color?: Color }).color?.set(tint);
          tinted.set(m.material, t);
        }
        m.material = t;
      }
    }
    const mats = (
      Array.isArray(m.material) ? m.material : [m.material]
    ) as Material[];
    const clear = mats.some((x) => x.transparent);
    m.renderOrder = clear ? ORDER[1] : ORDER[0];
    if (clear)
      mats.forEach((x) => {
        // eslint-disable-next-line no-param-reassign
        x.depthWrite = false;
      });
  });
  return root;
};

const POP = 0.3; // s
/** Seconds a `drop` part takes to fall into place. */
const DROP = 0.55;

/** The face readings with some of a part's inputs read from other keys. */
const remap = (
  face: Readonly<Record<string, number | undefined>>,
  inputs: Record<string, string>,
) => {
  const out: Record<string, number | undefined> = { ...face };
  Object.entries(inputs).forEach(([to, from]) => {
    out[to] = face[from];
  });
  return out;
};
/** Seconds to shrink away when it leaves. */
export const LEAVE = 0.22;
/** House motion: strict ease-out, never an overshoot. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * The spare materials a part swaps to: in the file but on no mesh, so the
 * loader never built them — load them by name.
 */
const useSpareMaterials = (value: GLTF | null | undefined, part: PartSpec) => {
  const [spare, setSpare] = useState<Map<string, Material> | null>(null);
  useEffect(() => {
    if (!value) return undefined;
    let alive = true;
    const cfg = (value.scene.userData?.vincentt_config ?? {}) as ItemConfig;
    const want = new Set(
      Object.values(swapsFor(cfg, part, materialNames(value))),
    );
    const defs = (value.parser.json.materials ?? []) as { name?: string }[];
    const idx = defs
      .map((d, i) => [d.name, i] as const)
      .filter(([n]) => n && want.has(n));
    Promise.all(
      idx.map(([n, i]) =>
        value.parser
          .getDependency("material", i)
          .then((m: Material) => [n as string, m] as const),
      ),
    )
      .then((pairs) => {
        if (alive) setSpare(new Map(pairs));
      })
      .catch(() => {
        if (alive) setSpare(new Map());
      });
    return () => {
      alive = false;
    };
  }, [value, part]);
  return spare;
};

/**
 * Rearranges a prepared model once (with its mixer and clips, to play its
 * own actions); the returned function runs every frame with the clock (s).
 */
export type Arrange = (
  root: Object3D,
  mixer: AnimationMixer,
  clips: AnimationClip[],
) => (t: number) => void;

export const Part = ({
  part,
  leaving = false,
  arrange,
}: {
  part: PartSpec;
  /** On its way out: shrink away (the scene unmounts it after). */
  leaving?: boolean;
  arrange?: Arrange;
}) => {
  const { value } = useXRAsset(assetFor(part.id));
  const spare = useSpareMaterials(value, part);
  const holder = useRef<Group>(null);
  const born = useRef(-1);
  const left = useRef(-1);

  const model = useMemo(() => {
    if (!value || !spare) return null;
    const cfg = (value.scene.userData?.vincentt_config ?? {}) as ItemConfig;
    const root = prepare(
      cloneSkinned(value.scene),
      swapsFor(cfg, part, materialNames(value)),
      spare,
      part.colors,
    );
    const mixer = new AnimationMixer(root);
    autoplayClips(cfg, value.animations).forEach((c) =>
      mixer.clipAction(c).setLoop(LoopRepeat, Infinity).play(),
    );
    const tick = arrange?.(root, mixer, value.animations);
    const centre = new Box3().setFromObject(root).getCenter(new Vector3());
    return {
      root,
      centre,
      mixer,
      shake: shakeClip(cfg, value.animations),
      rig: buildRig(root, cfg.face_triggers ?? [], mixer, value.animations),
      tick,
    };
  }, [value, spare, part, arrange]);

  useEffect(
    () => () => {
      model?.mixer.stopAllAction();
    },
    [model],
  );

  const lastShake = useRef(live.shakes);
  useFrame((state, dt) => {
    if (!model || !holder.current) return;
    const face = live.override ?? live.blendshapes;
    model.rig(part.inputs ? remap(face, part.inputs) : face);
    if (live.shakes !== lastShake.current) {
      lastShake.current = live.shakes;
      if (model.shake) {
        const a = model.mixer.clipAction(model.shake);
        a.setLoop(LoopOnce, 1);
        a.reset().play();
      }
    }
    model.mixer.update(Math.min(dt, 0.1));
    model.tick?.(state.clock.elapsedTime);
    if (born.current < 0) born.current = state.clock.elapsedTime;
    const now = state.clock.elapsedTime;
    const k = Math.min(1, (now - born.current) / POP);
    let size = 0.6 + 0.4 * easeOut(k);
    if (leaving) {
      if (left.current < 0) left.current = now;
      size *= 1 - easeOut(Math.min(1, (now - left.current) / LEAVE));
    } else left.current = -1;
    const f = part.fit;
    holder.current.visible = size > 0.01;
    holder.current.scale.setScalar(Math.max(size, 1e-4) * (f?.scale ?? 1));
    holder.current.position.set(
      model.centre.x + (f?.x ?? 0) / 100,
      model.centre.y +
        ((f?.y ?? 0) +
          (part.drop ?? 0) *
            (1 - easeOut(Math.min(1, (now - born.current) / DROP)))) /
          100,
      model.centre.z + (f?.z ?? 0) / 100,
    );
  });

  if (!model) return null;
  return (
    <group ref={holder} position={model.centre} scale={0.6}>
      <group position={model.centre.clone().negate()}>
        <primitive object={model.root} />
      </group>
    </group>
  );
};
