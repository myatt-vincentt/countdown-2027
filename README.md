# Countdown 2027

New Year's Eve in your camera: the room behind you becomes a night sky over a city skyline, and
you wear gold star boppers. Tap the record button and big gold digits count down 5, 4, 3, 2, 1
below your face; at zero a party blower pops into your mouth and toots, and the new year lands —
fireworks burst in the sky behind you and around you, the 2027 crown drops onto your head and
confetti pours down. The recording stops by itself when the party ends and goes to your phone's
share sheet to save (on a computer it downloads), with the Made with Vincentt mark. Don't want to
record? After a few quiet seconds the countdown starts on its own, again and again.

- The pieces are vincentt.studio head accessories on the SDK's canonical head fit, steadied by a
  speed-adaptive spring with the head occluder in the same group. The party blower unrolls by
  itself at zero; the crown falls into place.
- The night city, the fireworks and the confetti are drawn in code (`NightCity.tsx`,
  `Fireworks.tsx`, `Confetti.tsx`); the sky and the far fireworks stay behind you using the
  portrait mask.
- Recording (`src/party/Capture.tsx`) uses the template's `src/capture.ts`; the record button
  starts the countdown, from 5, every time.
- Thumbnail: `public/images/countdown-2027-thumbnail.jpg` (the share image).
- Models: `public/models/vincentt-*.glb` (`src/party/outfit.ts`). Credits in `CREDITS.md`.
- Dev preview without a camera: the media switcher starts on `dev-media/countdown.mp4` if you
  add one, else the SDK's sample video; 1–4 jump to waiting, the countdown, the toot and the party;
  `?occ` draws the occluders. How it works: `PLAN.md`.

---

# v2-template

The Vincentt starter app: a real React + R3F + Vincentt XR SDK (`@vincentt-xr/sdk`)
WebXR app, bundled by esbuild.

## Shape

```
src/
  main.tsx            mount — never edited
  App.tsx             protected shell: XRProvider + AspectRatioContainer +
                      XRScene + media-source binding, camera, lighting,
                      VideoBackground, PreviewAnchors — never edited
  Scene.tsx           the agent's surface: add SDK components and R3F
                      primitives here
  PreviewAnchors.tsx  editor-preview integration — never edited
```

See `AGENTS.md` and `GROUNDING.md` for the API reference and how to author scenes.

## Develop

```
pnpm install
pnpm dev          # esbuild dev server on localhost:5173 (output in .dev/)
pnpm preview      # on-device preview over a secure tunnel (needs `vincentt login`)
pnpm typecheck
pnpm build        # production bundle to dist/
```

## Release

`vincentt init` scaffolds from the **`latest` tag**, not from `main`. Merging to `main` does
not ship a template to creators — cutting a release does.

```
git tag 1.1.0 <sha>      # bare semver, no `v` prefix
git push origin 1.1.0    # the Release workflow verifies the tag, then moves `latest`
```

The Release workflow (`.github/workflows/release.yml`) installs from the frozen lockfile,
builds, and typechecks **the tagged tree** before force-updating `latest` to it. A tag that
fails leaves `latest` where it was, so a broken release cannot reach a new creator.

The job runs in the `release` environment, which accepts bare-semver tags only. To re-run it by
hand, dispatch it from the tag itself ("Use workflow from: 1.1.0"); a dispatch from `main` is
refused.

**Never move `latest` by hand.** It is force-updated by that workflow and nowhere else; moving
it manually decouples the pointer from the version it claims to be.

Creators can pin a specific version — `vincentt init --template 1.0.0` — which is the escape
hatch when a release turns out to be bad. That is why the version tags are immutable and only
`latest` moves.

### `MIGRATION.md` and the platform release row

Root `MIGRATION.md` carries one entry per released tag, newest first, authored in the same
PR as the change: `required: true|false`, a one-line summary, and optional notes bullets.
`required: false` means no consumer action is needed, never that the entry was skipped. The
Release workflow refuses to move `latest` for a tag with no valid entry, then — once `latest`
has moved — posts that entry as this release's row to the platform (`POST
/platform/releases`, component `template`), via `scripts/release-row.mjs`. Both steps read
`MIGRATION.md` from `main`, not from the tagged tree: the note is reviewed via PR into `main`
and is append-only per version, so `main`'s copy is the reviewed source for any tag, including
one cut before this file existed. That row is what `vincentt outdated` reads back to tell a
creator's agent what changed and what to do about it.
