// Recording, the Vincentt camera way (camera-ui), and the way in: one
// shutter in the control band. Waiting, it pulses softly with "Tap to
// record" above it. A tap starts recording and the countdown from 5 (even
// mid-countdown), so the video catches the whole moment; it stops by itself
// when the party ends, or at a second tap. While recording, its ring fills
// in Arles toward the time limit and its disc becomes a rounded square, a REC
// chip with the elapsed time sits in the HUD band, and "Tap to stop" shows
// above it. The finished video flashes white, then goes to the phone's share
// sheet (save to Photos, send…) or, on a computer, downloads. The Made with
// Vincentt mark is burned into the video, bottom right, drawn into the
// picture while it records. The controls are page UI, so they never appear
// in the video.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TextureLoader } from "three";

import { useMediaRecorder, useXRQuality } from "@vincentt-xr/sdk";

import { saveToDevice, shareMedia, type CapturedMedia } from "../capture";
import { getParty, setPhase } from "./state";

const SHOT = {
  /** Longest recording (s). */
  limit: 30,
  /** Frame rate, and the bitrate per pixel per frame, within these bounds (bit/s). */
  fps: 30,
  bitsPerPixel: 0.12,
  bitrate: [8_000_000, 25_000_000] as const,
  /** The mark: height (share of the picture's height) and margin. */
  markHeight: 0.05,
  markMargin: 0.025,
};

const MARK_URL = "/images/made-with-vincentt.png";
const ARLES = "#f4d968";
const GLASS = "rgb(35 37 40 / 0.64)";
const EDGE = "1px solid rgb(235 246 253 / 0.18)";
const BLUR = "blur(20px) saturate(1.5)";
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const extOf = (type: string) => (type.includes("mp4") ? "mp4" : "webm");

/** The best format this browser can record: H.264 MP4 first (phones' own), then WebM. */
const bestType = () =>
  [
    "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ].find((t) => window.MediaRecorder?.isTypeSupported?.(t));

/**
 * Records the picture at the best the device can do: the canvas at its full
 * size, a bitrate that scales with it, the best format, and the SDK's
 * adaptive quality held at its top tier for the length of the recording (it
 * would otherwise lower the picture's sharpness when the device is busy).
 */
const useBestRecorder = () => {
  const canvas = useThree((s) => s.gl.domElement);
  const quality = useXRQuality();
  // The bitrate for the picture at full quality (the top tier renders at
  // the screen's size × its pixel ratio, up to 3). Read when the recorder
  // renders, so it's worked out here.
  const size = useThree((s) => s.size);
  const full =
    size.width *
    size.height *
    Math.min(window.devicePixelRatio || 1, 3) ** 2 *
    SHOT.fps *
    SHOT.bitsPerPixel;
  const recorder = useMediaRecorder({
    mimeType: bestType(),
    bitsPerSecond: Math.round(
      Math.min(SHOT.bitrate[1], Math.max(SHOT.bitrate[0], full)),
    ),
  });
  const done = useRef<((m: CapturedMedia) => void) | null>(null);
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  useEffect(() => {
    const blob = recorder.recordedBlob;
    if (!blob || !done.current) return;
    const resolve = done.current;
    done.current = null;
    const reader = new FileReader();
    reader.onload = () => resolve({ blob, dataUrl: reader.result as string });
    reader.readAsDataURL(blob);
  }, [recorder.recordedBlob]);

  const start = async () => {
    const q = qualityRef.current;
    if (q.tiers.length) {
      q.setTier(0);
      q.lock();
    }
    await recorder.start(canvas.captureStream(SHOT.fps));
  };

  const stop = () =>
    new Promise<CapturedMedia>((resolve) => {
      done.current = resolve;
      recorder.stop();
      qualityRef.current.unlock();
    });

  return { start, stop, isRecording: recorder.isRecording };
};

/**
 * Save a capture the device's own way: the share sheet on a phone or tablet
 * (save to Photos, send…), a download on a computer.
 */
const keep = async (media: CapturedMedia, filename: string) => {
  if (window.matchMedia?.("(pointer: coarse)").matches)
    await shareMedia(media, { filename, title: "Countdown 2027" });
  else saveToDevice(media, filename);
};
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

/** The mark's own shape (width / height), until its image has loaded. */
const MARK_ASPECT = 570 / 216;

/**
 * The mark in the picture itself, while a video records. Loaded without
 * suspending, so a missing image never holds up the scene.
 */
const VideoMark = ({ show }: { show: boolean }) => {
  const texture = useMemo(() => new TextureLoader().load(MARK_URL), []);
  const size = useThree((s) => s.size);
  const box = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    // NDC: height 2 = the picture's height.
    const h = SHOT.markHeight * 2;
    const w = (h * MARK_ASPECT) / aspect;
    const m = SHOT.markMargin * 2;
    return [1 - m / aspect - w / 2, -1 + m + h / 2, w, h];
  }, [size]);
  const uniforms = useMemo(
    () => ({ map: { value: texture }, box: { value: box } }),
    [texture, box],
  );
  return (
    <mesh visible={show} frustumCulled={false} renderOrder={1002}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={
          /* glsl */ `
          uniform vec4 box;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(box.xy + position.xy * box.zw, -1.0, 1.0);
          }
        `
        }
        fragmentShader={
          /* glsl */ `
          uniform sampler2D map;
          varying vec2 vUv;
          void main() { gl_FragColor = texture2D(map, vUv); }
        `
        }
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

const pill = {
  background: GLASS,
  border: EDGE,
  backdropFilter: BLUR,
  WebkitBackdropFilter: BLUR,
  borderRadius: 999,
  color: "#fff",
} as const;

export const Capture = () => {
  const { start, stop, isRecording } = useBestRecorder();
  const [flash, setFlash] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recStart = useRef(0);
  const recording = useRef(false);

  const finish = async () => {
    if (!recording.current) return;
    recording.current = false;
    const video = await stop();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 360);
    await keep(video, `countdown-2027-${stamp()}.${extOf(video.blob.type)}`);
  };

  // The elapsed time for the chip and the ring; the end of the show (back
  // to waiting after the party) or the time limit stops it.
  useFrame(() => {
    if (!recording.current) return;
    const now = performance.now();
    const s = (now - recStart.current) / 1000;
    if (Math.floor(s * 4) !== Math.floor(elapsed * 4)) setElapsed(s);
    const { phase, since } = getParty();
    const showOver = phase === "wait" && since * 1000 > recStart.current;
    if (showOver || s >= SHOT.limit) finish();
  });

  const onTap = () => {
    if (recording.current) {
      finish();
      return;
    }
    recording.current = true;
    recStart.current = performance.now();
    setElapsed(0);
    start();
    // The show starts with the recording: the countdown from 5.
    setPhase("count");
  };

  const progress = Math.min(1, elapsed / SHOT.limit) * 100;
  const time = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`;

  return (
    <>
      <VideoMark show={isRecording} />
      <Html fullscreen zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        <style>
          {`@keyframes vt-rec-pulse {
            0% { box-shadow: 0 0 0 0 rgb(244 217 104 / 0.6); }
            100% { box-shadow: 0 0 0 16px rgb(244 217 104 / 0); }
          }`}
        </style>
        {/* The white flash when a video is saved. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            opacity: flash ? 0.85 : 0,
            transition: `opacity ${flash ? 60 : 300}ms ${EASE}`,
          }}
        />
        {/* REC chip, HUD band. */}
        <div
          style={{
            ...pill,
            position: "absolute",
            top: "calc(env(safe-area-inset-top) + 12px)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            font: "600 15px/1 system-ui, sans-serif",
            fontVariantNumeric: "tabular-nums",
            opacity: isRecording ? 1 : 0,
            transition: `opacity 160ms ${EASE}`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: ARLES,
            }}
          />
          REC {time}
        </div>
        {/* "Tap to record" / "Tap to stop", above the shutter. */}
        <div
          style={{
            ...pill,
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom) + 112px)",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 14px",
            font: "500 14px/1.2 system-ui, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {isRecording ? "Tap to stop" : "Tap to record"}
        </div>
        {/* The shutter: tap to record, tap again to stop. */}
        <button
          type="button"
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          onClick={onTap}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom) + 24px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 76,
            height: 76,
            padding: 0,
            borderRadius: 38,
            border: "none",
            background: GLASS,
            backdropFilter: BLUR,
            WebkitBackdropFilter: BLUR,
            pointerEvents: "auto",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          {/* Waiting: a soft Arles pulse around the shutter. */}
          {isRecording ? null : (
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                animation: `vt-rec-pulse 1.8s ${EASE} infinite`,
              }}
            />
          )}
          {/* Ring: white, or the recording's progress in Arles. */}
          <span
            style={{
              position: "absolute",
              inset: 5,
              borderRadius: "50%",
              border: isRecording ? "none" : "3px solid #fff",
              background: isRecording
                ? `conic-gradient(${ARLES} 0 ${progress}%, rgb(255 255 255 / 0.35) 0)`
                : "none",
              mask: isRecording
                ? "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))"
                : "none",
              WebkitMask: isRecording
                ? "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))"
                : "none",
            }}
          />
          {/* Disc: a circle, or a rounded square while recording. */}
          <span
            style={{
              position: "absolute",
              inset: isRecording ? 26 : 13,
              borderRadius: isRecording ? 7 : "50%",
              background: ARLES,
              transition: `inset 200ms ${EASE}, border-radius 200ms ${EASE}`,
            }}
          />
        </button>
      </Html>
    </>
  );
};
