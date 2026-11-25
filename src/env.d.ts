/// <reference types="vite/client" />

import type { Frame } from './cine/frame';

interface PalaceDevHook {
  force: (progress: number) => void;
  release: () => void;
  progress: () => number;
  frame: () => Frame;
  /** Corridor: jump to a room by index or id. */
  walk: (room: number | string) => void;
  /** Corridor: index of the room at the centre of the stage. */
  room: () => number;
  /** Corridor: room ids, in walking order. */
  rooms: () => string[];
}

interface PalaceAudioHook {
  /** The real state of the AudioContext, or 'unbuilt' before the first gesture. */
  state: () => AudioContextState | 'unbuilt';
  /** Which section currently owns the score. */
  mode: () => 'prologue' | 'film' | 'corridor';
  /** How many playhead updates the engine has received (wiring check). */
  filmCalls: () => number;
  setFilm: (p: number) => void;
  setRoom: (depth: number, index: number) => void;
  /** RMS of the master output, sampled from the analyser. */
  level: () => number;
  /** Absolute peak of the master output, for clipping checks. */
  peak: () => number;
  /** Strongest partial between 240 and 950 Hz, in Hz. */
  tone: () => number;
  /** The mix the engine is currently applying. */
  mix: () => unknown;
  enable: () => Promise<void>;
  disable: () => void;
}

declare global {
  interface Window {
    /**
     * Development-only inspection hook. Used by the visual QA harness to render
     * an exact film frame without scrolling, or to walk the corridor. Never
     * present in production builds.
     */
    __palace?: Partial<PalaceDevHook>;
    /** Development-only score inspection, for the audio QA harness. */
    __palaceAudio?: PalaceAudioHook;
  }
}

export {};
