# Plan — Countdown 2027

A New Year's Eve countdown in your camera, made to be recorded. Built on SDK 2.0.0-alpha.9 with
the vincentt.studio head accessories.

## Design

- Behind you, a New Year's Eve night: a navy-to-violet sky with stars and a warm horizon glow over
  a city skyline of lit windows. You stay lit in front of it.
- Waiting: gold star boppers on your head; the record button pulses with "Tap to record" above it.
- Tap record and the countdown starts from 5 with the recording, even if one was already running,
  so the video catches the whole moment. Big gold digits below the face, one a second.
- At zero the party blower pops into your mouth and toots on its own.
- The new year: fireworks in the sky behind you (some in front, by the edges), the boppers pop off
  and the 2027 crown drops onto your head, confetti pours down. After eight seconds it's back to
  waiting.
- The recording stops by itself when the party ends (or at a second tap; 30 s at most) and goes
  to the phone's share sheet (on a computer it downloads), with the Made with Vincentt mark burned
  in, bottom right.
- Nobody recording: after six seconds of waiting the countdown starts on its own, round and
  round.
- No sound. The only words on screen are the record caption and the REC time.

## How it works

- `state.ts`: the phases (waiting, counting, the toot, the party) and their times;
  `PartyScene.tsx` moves them on by the clock, including the auto start.
- `outfit.ts` + `Part.tsx`: the pieces, their presets and fit; a part can read one face input from
  another (the blower unrolls on "blow", set by the toot) and fall into place (the crown).
  `Swap.tsx`: a new piece pops in as the old one shrinks away.
- `FilteredHead.tsx` + `headFilter.ts` (unit-tested): the SDK's canonical head fit through a
  speed-adaptive critically damped spring, with the depth-only v3 head occluder and the SDK's
  `NeckOccluder`. Face model 20 Hz.
- `NightCity.tsx`: one shader over the camera, split by the portrait mask (`usePersonMaskTexture`),
  which it also shares (`personMask.ts`) so far fireworks hide behind you.
- `Digits.tsx`: drei's `Text3D` in gold, pinned to a place on the screen below the face.
- `Fireworks.tsx`: rockets and bursts of sparks with short trails, two additive layers.
  `Confetti.tsx`: turning paper strips.
- `Capture.tsx`: the record button (the way in), REC chip and caption (page UI, never recorded),
  the mark drawn into the picture while recording, the stop at the party's end, and the save
  (share sheet on touch devices, download otherwise). It records at the best the device can do:
  the canvas at its full size, 30 fps, a bitrate scaled to the picture (8–25 Mbit/s), H.264 MP4
  where the browser has it, and the SDK's adaptive quality held at its top tier while recording.
- Dev only: `DevKeys.tsx` (1–4 phases, `window.__party`), `DevMediaSwitcher.tsx`, `?occ`.

## Known limits

- When your face fills the screen, the crown's top and most of the sky are out of the picture;
  stand back a little to see the fireworks.
- The Made with Vincentt mark shows on screen while a video records, as it is drawn into the
  picture.
