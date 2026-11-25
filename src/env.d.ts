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

declare global {
  interface Window {
    /**
     * Development-only inspection hook. Used by the visual QA harness to render
     * an exact film frame without scrolling, or to walk the corridor. Never
     * present in production builds.
     */
    __palace?: Partial<PalaceDevHook>;
  }
}

export {};
