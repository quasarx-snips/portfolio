/// <reference types="vite/client" />

import type { Frame } from './cine/frame';

declare global {
  interface Window {
    /**
     * Development-only inspection hook. Used by the visual QA harness to render
     * an exact film frame without scrolling. Never present in production builds.
     */
    __palace?: {
      force: (progress: number) => void;
      release: () => void;
      progress: () => number;
      frame: () => Frame;
    };
  }
}

export {};
