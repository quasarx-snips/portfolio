/**
 * The corridor's geometry, as pure math.
 *
 * (Named `geometry` rather than `corridor` so Windows' case-insensitive
 * resolver cannot confuse this module with `Corridor.tsx`.)
 *
 * Every visible value is a function of scroll position alone — the same
 * contract as `frame.ts`. Nothing here reads the clock, the DOM or React, so a
 * reverse scroll retraces the forward path exactly and the math can be checked
 * without a browser.
 *
 * The hall itself does not move. Rooms are exhibits in one continuous space:
 * the active room holds while it is near the centre, dissolves as the next bay
 * is entered, and the next room dissolves in on the far side of the gap. That
 * keeps two sets of copy from ever sharing the screen.
 */

/** How far a room drifts, in px, across a whole bay. */
const DRIFT_PX = 24;
/**
 * The outgoing room holds while it is centred, then clears out over ~11% of a
 * bay; the arriving room only begins once the hall is empty. The two windows
 * are deliberately disjoint — overlapping fades put two names in the same
 * place at once, which reads as a double exposure, not a walk.
 */
const OUT_START = 0.38;
const OUT_END = 0.5;
/** Relative distance at which the arriving room is fully lit. */
const IN_FULL = 0.44;
const IN_START = 0.56;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export interface CorridorFrame {
  /** Index of the room nearest the centre of the stage. */
  index: number;
  /** 0..1 progress through the current bay. */
  t: number;
  /** Continuous position in bays: 0 at the first room, n-1 at the last. */
  depth: number;
}

/**
 * Reads the corridor from a scroll offset already relative to the section top.
 * `bay` is the stage height in pixels; the caller owns that measurement.
 */
export function readCorridor(scrollTop: number, bay: number, count: number): CorridorFrame {
  if (bay <= 0 || count <= 0) return { index: 0, t: 0, depth: 0 };
  const depth = clamp(scrollTop / bay, 0, count - 1);
  const index = Math.min(count - 1, Math.floor(depth));
  return { index, t: clamp01(depth - index), depth };
}

export interface RoomPose {
  /** Relative position in bays; 0 is centred, positive is still ahead. */
  rel: number;
  /** Vertical drift in px. Always upward as the visitor advances. */
  drift: number;
  /** Whole-room opacity, 0..1. */
  opacity: number;
}

export function roomPose(index: number, depth: number): RoomPose {
  const rel = index - depth;
  const opacity =
    rel < 0 ? 1 - smoothstep(OUT_START, OUT_END, -rel) : 1 - smoothstep(IN_FULL, IN_START, rel);
  return {
    rel,
    drift: clamp(rel, -1, 1) * DRIFT_PX,
    opacity,
  };
}

/** True while a room is close enough to be worth writing styles for. */
export function isNear(rel: number, horizon = 1.25): boolean {
  return Math.abs(rel) < horizon;
}

/** Progress through the whole corridor, 0..1, for the hairline. */
export function corridorProgress(depth: number, count: number): number {
  if (count <= 1) return 0;
  return clamp01(depth / (count - 1));
}
