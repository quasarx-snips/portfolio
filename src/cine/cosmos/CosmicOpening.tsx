import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { clamp01, smoothstep } from '../easing';
import { BH_FRAG, BH_VERT } from './bh-render';
import { FrameGovernor, quality } from '../../perf';
import { lockScroll } from '../../scrollLock';
import '../../styles/cosmos.css';

/**
 * The prologue: a black hole waiting in the dark.
 *
 * There is no scrolling here. The page is locked until the visitor presses and
 * holds the hole; the hold charges it, then the camera falls in on its own and
 * the light floods to warm white. Once the white clears, the temple film is
 * already sitting at its first frame and is held there for a beat before
 * scrolling is handed back.
 *
 * The whole handover is one requestAnimationFrame timeline driven by absolute
 * timestamps, not a chain of setTimeouts: that keeps the documented durations
 * exact, lets the sequence pause cleanly when the tab is hidden or a QA run
 * freezes a frame, and leaves nothing behind when the overlay unmounts.
 */

/** Hold the press this long to commit to the fall. */
const HOLD_MS = 720;
/** The fall itself, from progress 0 to exactly 1. */
const IGNITE_MS = 3000;
/** The frame sits on #F8F6F0 for this long before the dissolve starts. */
const WHITE_HOLD_MS = 200;
/** White sheet -> temple. */
const REVEAL_MS = 900;
/** The temple is held at its first frame this long before scroll is handed back. */
const TEMPLE_PAUSE_MS = 2600;
/** The idle ring starts asking for a press after this long without input. */
const HINT_AFTER_MS = 2600;

/** Charge release decays at this rate (units per second) back to rest. */
const CHARGE_DECAY = 3.6;

type Phase = 'idle' | 'charging' | 'igniting' | 'holding' | 'revealed' | 'done';

/**
 * The fall: a slow outward drift that turns into an accelerating plunge.
 *
 * f(0) = 0, f(1) = 1, and the derivative 0.06 + 2.068 * t^1.2 is positive
 * everywhere, so progress is strictly monotonic. The tiny linear term keeps
 * the opening second alive instead of freezing the establishing shot.
 */
const fallCurve = (t: number): number => {
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  return 0.06 * t + 0.94 * Math.pow(t, 2.2);
};

interface GLState {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  uP: WebGLUniformLocation | null;
  uRes: WebGLUniformLocation | null;
  uAspect: WebGLUniformLocation | null;
  uCharge: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
}

type GLFailure = 'unavailable' | 'compile' | 'link';

interface GLResult {
  state: GLState | null;
  error: GLFailure | null;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    if (import.meta.env.DEV) {
      console.warn('[cosmos] shader compile failed:', gl.getShaderInfoLog(shader));
    }
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initGL(canvas: HTMLCanvasElement): GLResult {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return { state: null, error: 'unavailable' };

  const vert = compile(gl, gl.VERTEX_SHADER, BH_VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, BH_FRAG);
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return { state: null, error: 'compile' };
  }

  const program = gl.createProgram();
  if (!program) return { state: null, error: 'compile' };
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) {
      console.warn('[cosmos] program link failed:', gl.getProgramInfoLog(program));
    }
    gl.deleteProgram(program);
    return { state: null, error: 'link' };
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    gl.deleteProgram(program);
    return { state: null, error: 'compile' };
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  return {
    state: {
      gl,
      program,
      buffer,
      uP: gl.getUniformLocation(program, 'uP'),
      uRes: gl.getUniformLocation(program, 'uRes'),
      uAspect: gl.getUniformLocation(program, 'uAspect'),
      uCharge: gl.getUniformLocation(program, 'uCharge'),
      uTime: gl.getUniformLocation(program, 'uTime'),
    },
    error: null,
  };
}

function readPerfIsolation(): boolean {
  // Dev/QA only: ?cosmosPerf=1 keeps the timeline and DOM running but skips
  // every GL draw, so phase timings can be measured without the software
  // renderer's frame cost. Production never takes this path.
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('cosmosPerf') === '1';
}

function readForcedProgress(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('cosmos');
  if (raw === null) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? clamp01(value) : null;
}

interface Timeline {
  press: number;
  ignite: number;
  white: number;
  reveal: number;
  unlock: number;
}

interface PhaseEvent {
  phase: Phase;
  at: number;
}

export default function CosmicOpening({ onCovered }: { onCovered?: () => void }) {
  // Dev-only: ?cosmos=0.6 freezes the sequence at a given fall progress so the
  // shader can be inspected frame by frame in a still screenshot.
  const [perfIsolation] = useState<boolean>(readPerfIsolation);
  const [forced] = useState<number | null>(readForcedProgress);
  // Any #hash is a direct link into the film; the prologue is skipped.
  const [skipped] = useState(
    () => typeof window !== 'undefined' && Boolean(window.location.hash),
  );

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<GLState | null>(null);
  const governorRef = useRef<FrameGovernor | null>(null);
  const resizeRef = useRef<() => void>(() => undefined);
  const idleDrawRef = useRef(quality.idleDrawMs);
  const coveredRef = useRef(false);

  // One governor per prologue. It owns only the resolution scale; the tier
  // owns the hard pixel budget and the DPR ceiling.
  const governor = () => {
    if (!governorRef.current) {
      governorRef.current = new FrameGovernor({
        targetFps: quality.targetFps,
        minScale: 0.55,
      });
    }
    return governorRef.current;
  };

  const phaseRef = useRef<Phase>(
    forced !== null ? 'holding' : skipped ? 'done' : 'idle',
  );
  const progressRef = useRef(forced ?? 0);
  /** Pointer that owns the current press (null = keyboard / QA press). */
  const activePointerRef = useRef<number | null>(null);
  const chargeRef = useRef(0);
  const timeRef = useRef(0);
  const lastRef = useRef(0);
  const lastDrawRef = useRef(0);
  const lastFlashRef = useRef(-1);
  const lastCssRef = useRef({ p: -1, charge: -1 });

  const chargeStartRef = useRef(0);
  const chargeFromRef = useRef(0);
  const idleSinceRef = useRef(0);
  const mountAtRef = useRef(0);
  const hintArmedRef = useRef(true);
  const hintShownRef = useRef(false);
  const fallbackRef = useRef(false);
  const dirtyRef = useRef(true);
  const drawEnabledRef = useRef(!perfIsolation);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(0);
  const rafRef = useRef(0);
  const aliveRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const glCleanupRef = useRef<(() => void) | null>(null);
  const unlockScrollRef = useRef<(() => void) | null>(null);
  const scrollingRef = useRef(false);
  const statusRef = useRef<GLFailure | 'ok' | 'lost'>('ok');
  const timelineRef = useRef<Timeline>({ press: 0, ignite: 0, white: 0, reveal: 0, unlock: 0 });
  const eventsRef = useRef<PhaseEvent[]>([]);

  const [phase, setPhase] = useState<Phase>(
    forced !== null ? 'holding' : skipped ? 'done' : 'idle',
  );

  // The moment the white sheet owns the screen, the host may mount the scroll
  // film underneath it: expensive layout happens while nothing is visible.
  useEffect(() => {
    if (coveredRef.current) return;
    if (phase !== 'holding' && phase !== 'revealed') return;
    coveredRef.current = true;
    onCovered?.();
  }, [phase, onCovered]);
  const [hinting, setHinting] = useState(false);
  const [locked, setLocked] = useState(!skipped || forced !== null);
  const [fallback, setFallback] = useState(false);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const mark = useCallback((next: Phase) => {
    if (!import.meta.env.DEV) return;
    eventsRef.current.push({ phase: next, at: Math.round(performance.now()) });
  }, []);

  /**
   * The visitor's "skip" path: jump the rAF timeline straight to the handover
   * and let the sequence finish on its own frame, releasing scroll and mounting
   * the temple as usual. No charge, no fall, no hold — just the end state.
   */
  const skipToEnd = useCallback(() => {
    const now = performance.now();
    const timeline = timelineRef.current;
    // Position the hold/reveal/unlock anchors just past the handover so the
    // running loop walks straight through to 'done' on its next frames.
    timeline.reveal = now - REVEAL_MS;
    timeline.unlock = now;
    phaseRef.current = 'revealed';
    setPhaseSafe('revealed');
    setHinting(false);
    mark('revealed');
  }, [mark, setPhaseSafe]);

  const draw = useCallback((p: number, charge: number, time: number) => {
    const state = glRef.current;
    const canvas = canvasRef.current;
    if (!state || !canvas || !drawEnabledRef.current) return;
    const { gl } = state;
    gl.useProgram(state.program);
    gl.uniform1f(state.uP, p);
    gl.uniform2f(state.uRes, canvas.width, canvas.height);
    gl.uniform1f(state.uAspect, canvas.width / Math.max(canvas.height, 1));
    gl.uniform1f(state.uCharge, charge);
    gl.uniform1f(state.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, []);

  // WebGL setup, sizing and teardown; failure reveals the CSS composition.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    // Mirror the shader's horizon radius so the idle hint hugs the hole on
    // every aspect ratio. --hole is the horizon diameter in CSS pixels; the
    // CSS fallback and the hint ring are both built from it.
    const applyHole = () => {
      const width = Math.max(stage.clientWidth, 1);
      const height = Math.max(stage.clientHeight, 1);
      const aspect = width / height;
      // Same width-first framing as the shader (16:10 reference, 0.85 curve):
      // a portrait stage pulls the camera back, so the published horizon — and
      // the hint ring built from it — shrinks with the disk instead of spilling
      // past the edges of a phone.
      const framing = Math.min(1, Math.pow(aspect / 1.6, 0.85));
      stage.style.setProperty('--hole', `${Math.round(0.14 * framing * height * 2)}px`);
    };

    // Resolution is a budget, not a constant: the tier fixes the ceiling, the
    // governor moves within it as real frames arrive.
    const size = () => {
      const cssWidth = Math.max(1, stage.clientWidth);
      const cssHeight = Math.max(1, stage.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, quality.prologueDprCap);
      const budgetScale = Math.sqrt(
        quality.maxPixels / Math.max(cssWidth * cssHeight * dpr * dpr, 1),
      );
      const ratio = Math.max(
        0.32,
        dpr * Math.min(1, budgetScale) * quality.prologueScale * governor().scale,
      );
      const width = Math.max(1, Math.round(cssWidth * ratio));
      const height = Math.max(1, Math.round(cssHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return { width, height };
    };

    const resize = () => {
      const state = glRef.current;
      if (!state) return;
      const next = size();
      state.gl.viewport(0, 0, next.width, next.height);
      dirtyRef.current = true;
    };
    resizeRef.current = resize;

    applyHole();

    const result = initGL(canvas);
    if (!result.state) {
      statusRef.current = result.error ?? 'unavailable';
      fallbackRef.current = true;
      setFallback(true);
      stage.style.setProperty('--p', '0');
      stage.style.setProperty('--charge', '0');
    } else {
      glRef.current = result.state;
      const initial = size();
      result.state.gl.viewport(0, 0, initial.width, initial.height);
      // Paint once synchronously so the first frame is never a blank canvas.
      draw(progressRef.current, chargeRef.current, timeRef.current);
    }

    // Observe the stage on both paths: the fallback geometry is built from
    // --hole too, so a resize must update it even without WebGL. Later resizes
    // only mark the canvas dirty; the single rAF loop redraws it once at the
    // new size (never twice in the same frame).
    const observer = new ResizeObserver(() => {
      applyHole();
      resize();
    });
    observer.observe(stage);

    const onLost = (event: Event) => {
      event.preventDefault();
      const lost = glRef.current;
      glRef.current = null;
      statusRef.current = 'lost';
      fallbackRef.current = true;
      // Hide the dead canvas immediately (the class arrives a render later) and
      // seed the CSS fallback at the current progress so there is no black or
      // blank frame during a mid-fall context loss.
      canvas.style.display = 'none';
      const p = progressRef.current;
      const charge = chargeRef.current;
      stage.style.setProperty('--p', p.toFixed(4));
      stage.style.setProperty('--charge', charge.toFixed(4));
      lastCssRef.current = { p, charge };
      setFallback(true);
      if (lost) {
        lost.gl.deleteBuffer(lost.buffer);
        lost.gl.deleteProgram(lost.program);
      }
    };
    canvas.addEventListener('webglcontextlost', onLost);

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      resizeRef.current = () => undefined;
      canvas.removeEventListener('webglcontextlost', onLost);
      const state = glRef.current;
      glRef.current = null;
      if (state) {
        state.gl.deleteBuffer(state.buffer);
        state.gl.deleteProgram(state.program);
      }
      // Not loseContext(): this effect also runs twice under StrictMode and a
      // lost context cannot be re-acquired on the same canvas.
    };
    glCleanupRef.current = dispose;
    return dispose;
  }, [draw]);

  // Interaction plus the single rAF timeline.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;

    let alive = true;
    aliveRef.current = true;
    pausedRef.current = false;
    hiddenAtRef.current = document.hidden ? performance.now() : null;
    mountAtRef.current = performance.now();
    idleSinceRef.current = mountAtRef.current;
    lastRef.current = 0;
    lastDrawRef.current = 0;

    const timeline = timelineRef.current;

    const shift = (delta: number) => {
      if (!(delta > 0)) return;
      if (chargeStartRef.current) chargeStartRef.current += delta;
      if (idleSinceRef.current) idleSinceRef.current += delta;
      if (timeline.press) timeline.press += delta;
      if (timeline.ignite) timeline.ignite += delta;
      if (timeline.white) timeline.white += delta;
      if (timeline.reveal) timeline.reveal += delta;
      if (timeline.unlock) timeline.unlock += delta;
    };

    const beginCharge = () => {
      if (!alive || pausedRef.current) return;
      if (phaseRef.current !== 'idle') return;
      const now = performance.now();
      phaseRef.current = 'charging';
      setPhaseSafe('charging');
      setHinting(false);
      hintShownRef.current = false;
      hintArmedRef.current = false;
      idleSinceRef.current = 0;
      chargeStartRef.current = now;
      chargeFromRef.current = chargeRef.current;
      if (flashRef.current) {
        flashRef.current.style.opacity = '0';
        lastFlashRef.current = 0;
      }
      mark('charging');
    };

    const commitIgnition = (at: number) => {
      if (phaseRef.current !== 'charging') return;
      const press = chargeStartRef.current || at;
      timeline.press = press;
      timeline.ignite = press + HOLD_MS;
      timeline.white = timeline.ignite + IGNITE_MS;
      timeline.reveal = timeline.white + WHITE_HOLD_MS;
      timeline.unlock = timeline.reveal + REVEAL_MS + TEMPLE_PAUSE_MS;
      phaseRef.current = 'igniting';
      setPhaseSafe('igniting');
      setHinting(false);
      mark('igniting');
    };

    const cancelCharge = (force = false) => {
      if (phaseRef.current !== 'charging') return;
      // A release at or after the hold duration is a completed press, even if
      // the frame that would have noticed it has not run yet.
      if (!force && performance.now() - chargeStartRef.current >= HOLD_MS) {
        commitIgnition(performance.now());
        return;
      }
      phaseRef.current = 'idle';
      setPhaseSafe('idle');
      setHinting(false);
      hintShownRef.current = false;
      hintArmedRef.current = true;
      idleSinceRef.current = performance.now();
      mark('idle');
    };

    const pause = () => {
      if (pausedRef.current || !alive) return;
      pausedAtRef.current = performance.now();
      pausedRef.current = true;
      // Stop the clock completely: no rAF callbacks, no draws, no timeline.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };

    const resume = () => {
      if (!pausedRef.current || !alive) return;
      const now = performance.now();
      const delta = now - pausedAtRef.current;
      pausedRef.current = false;
      pausedAtRef.current = 0;
      shift(delta);
      lastRef.current = 0;
      if (!rafRef.current && !document.hidden) rafRef.current = requestAnimationFrame(step);
    };

    const writeCssVars = (p: number, charge: number) => {
      if (!fallbackRef.current) return;
      const last = lastCssRef.current;
      if (Math.abs(p - last.p) > 0.0005) {
        stage.style.setProperty('--p', p.toFixed(4));
        last.p = p;
      }
      if (Math.abs(charge - last.charge) > 0.0005) {
        stage.style.setProperty('--charge', charge.toFixed(4));
        last.charge = charge;
      }
    };

    const step = (now: number) => {
      if (!alive) return;
      rafRef.current = 0;

      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      if (document.hidden) {
        // Stop dead. The visibility handler restarts the loop on return; a
        // hidden tab must not keep a rAF chain alive at all.
        rafRef.current = 0;
        return;
      }

      const frameDelta = lastRef.current ? Math.max(0, now - lastRef.current) : 0;
      const dt = lastRef.current ? Math.min(0.05, frameDelta / 1000) : 1 / 60;
      lastRef.current = now;
      timeRef.current += dt;

      // Adapt the backing store to measured frame times. Forced QA stills skip
      // this so a screenshot is always the same resolution.
      if (forced === null) {
        const governorState = governor();
        const previousScale = governorState.scale;
        governorState.sample(frameDelta);
        if (governorState.scale !== previousScale) resizeRef.current();
      }

      // A forced still (?cosmos=0.4) never advances the timeline.
      if (forced !== null) {
        progressRef.current = forced;
        chargeRef.current = 0;
        writeCssVars(forced, 0);
        if (dirtyRef.current || now - lastDrawRef.current >= idleDrawRef.current) {
          draw(forced, 0, timeRef.current);
          lastDrawRef.current = now;
          dirtyRef.current = false;
        }
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      let current = phaseRef.current;
      let progress = progressRef.current;
      let charge = chargeRef.current;
      let flash = lastFlashRef.current >= 0 ? lastFlashRef.current : 0;
      let done = false;

      if (current === 'idle') {
        charge = Math.max(0, charge - CHARGE_DECAY * dt);
        if (
          hintArmedRef.current &&
          !hintShownRef.current &&
          now - idleSinceRef.current >= HINT_AFTER_MS
        ) {
          hintShownRef.current = true;
          hintArmedRef.current = false;
          setHinting(true);
        }
      } else if (current === 'charging') {
        const t = clamp01((now - chargeStartRef.current) / HOLD_MS);
        charge = chargeFromRef.current + (1 - chargeFromRef.current) * smoothstep(t, 0, 1);
        if (t >= 1) {
          commitIgnition(now);
          current = 'igniting';
        }
      }

      if (current === 'igniting') {
        const t = clamp01((now - timeline.ignite) / IGNITE_MS);
        progress = fallCurve(t);
        charge = 1 - smoothstep(t, 0, 0.6);
        // The sheet reaches full #F8F6F0 only on the frame where uP is exactly
        // 1, never earlier: the white hold is a true pause on the handover
        // colour, and the last shader frame cannot be washed out by a flash
        // that ran ahead of the fall. The tiny cap keeps the quantised CSS
        // value below 1 until the fall is actually over.
        flash = progress >= 1 ? 1 : Math.min(0.9999, smoothstep(progress, 0.9, 1));
        if (t >= 1) {
          progress = 1;
          charge = 0;
          flash = 1;
          // The white hold starts on the first frame that actually shows p=1,
          // so a late frame can never swallow the 200ms pause (and a QA run
          // can always freeze the sheet). The fall itself still finishes on
          // its 3000ms anchor.
          timeline.white = now;
          timeline.reveal = now + WHITE_HOLD_MS;
          timeline.unlock = timeline.reveal + REVEAL_MS + TEMPLE_PAUSE_MS;
          current = 'holding';
          setPhaseSafe('holding');
          mark('holding');
          dirtyRef.current = true;
        }
      }

      if (current === 'holding') {
        progress = 1;
        charge = 0;
        flash = 1;
        if (now >= timeline.reveal) {
          // Anchor the dissolve to the frame that starts it; opacity 1 -> 0
          // then always takes REVEAL_MS, whatever the frame rate.
          timeline.reveal = now;
          timeline.unlock = now + REVEAL_MS + TEMPLE_PAUSE_MS;
          current = 'revealed';
          setPhaseSafe('revealed');
          mark('revealed');
          root.style.opacity = '1';
        }
      }

      if (current === 'revealed') {
        const t = clamp01((now - timeline.reveal) / REVEAL_MS);
        root.style.opacity = (1 - t).toFixed(4);
        if (scrollingRef.current || now >= timeline.unlock) {
          root.style.opacity = '0';
          // The overlay is finished; hide it immediately and hand scrolling
          // back on the exact anchor. React may schedule the unmount a few
          // frames later, and the visitor must not wait for that.
          // A visitor who was already scrolling gets the film back with that
          // gesture instead of being held past the handover for the pause.
          root.style.display = 'none';
          unlockScrollRef.current?.();
          mark('done');
          setLocked(false);
          setPhaseSafe('done');
          done = true;
        }
      }

      progressRef.current = progress;
      chargeRef.current = charge;
      writeCssVars(progress, charge);

      if (flashRef.current && (flash === 1 ? lastFlashRef.current !== 1 : Math.abs(flash - lastFlashRef.current) > 0.002)) {
        flashRef.current.style.opacity = flash === 1 ? '1' : flash.toFixed(5);
        lastFlashRef.current = flash;
      }

      const fullRate = current === 'charging' || current === 'igniting';
      const ambient = current === 'idle' && now - lastDrawRef.current >= idleDrawRef.current;
      if (!done && (dirtyRef.current || fullRate || ambient)) {
        draw(progress, charge, timeRef.current);
        lastDrawRef.current = now;
        dirtyRef.current = false;
      }

      if (!done && alive) rafRef.current = requestAnimationFrame(step);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      // A second finger must not steal or cancel the press that is already
      // charging; the first pointer keeps ownership until it is released.
      if (activePointerRef.current !== null) return;
      activePointerRef.current = event.pointerId;
      root.focus({ preventScroll: true });
      try {
        stage.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
      beginCharge();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (activePointerRef.current !== null && event.pointerId !== activePointerRef.current) {
        return;
      }
      activePointerRef.current = null;
      cancelCharge();
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (activePointerRef.current !== null && event.pointerId !== activePointerRef.current) {
        return;
      }
      activePointerRef.current = null;
      cancelCharge(true);
    };
    const onLostCapture = (event: PointerEvent) => {
      if (activePointerRef.current !== null && event.pointerId !== activePointerRef.current) {
        return;
      }
      activePointerRef.current = null;
      cancelCharge(true);
    };
    const onBlur = () => {
      activePointerRef.current = null;
      cancelCharge(true);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && !root.contains(target) && target.closest('a, button, input, textarea, select')) {
        return;
      }
      if (
        event.key === ' ' ||
        event.key === 'Enter' ||
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp'
      ) {
        event.preventDefault();
      }
      if (event.key === ' ' || event.key === 'Enter') beginCharge();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && !root.contains(target) && target.closest('a, button, input, textarea, select')) {
        return;
      }
      event.preventDefault();
      activePointerRef.current = null;
      cancelCharge();
    };
    const noMenu = (event: Event) => event.preventDefault();

    const stopLoop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = performance.now();
        activePointerRef.current = null;
        cancelCharge(true);
        stopLoop();
        return;
      }
      const now = performance.now();
      const hiddenFor = hiddenAtRef.current ? now - hiddenAtRef.current : 0;
      hiddenAtRef.current = null;
      if (hiddenFor > 0) shift(hiddenFor);
      // Re-arm the idle hint after a hidden period so it never appears stale.
      idleSinceRef.current = now;
      hintArmedRef.current = true;
      hintShownRef.current = false;
      setHinting(false);
      lastRef.current = 0;
      if (alive && !pausedRef.current && !rafRef.current) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('lostpointercapture', onLostCapture);
    stage.addEventListener('contextmenu', noMenu);
    // Window-level releases cover a pointer that leaves the stage before the
    // browser hands it back (capture is not implemented everywhere).
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onBlur);
    // Keys are global while the prologue owns the screen; the guard above
    // leaves the skip link and any other real control alone.
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    root.addEventListener('contextmenu', noMenu);
    document.addEventListener('visibilitychange', onVisibility);

    if (!document.hidden) rafRef.current = requestAnimationFrame(step);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__cosmos = {
        press: beginCharge,
        release: () => cancelCharge(),
        phase: () => phaseRef.current,
        progress: () => progressRef.current,
        charge: () => chargeRef.current,
        status: () => statusRef.current,
        fallback: () => fallbackRef.current,
        mountedAt: () => mountAtRef.current,
        // QA-only: restart the idle clock (and dismiss the hint) without
        // touching the sequence. Used to capture a clean idle frame when a
        // software renderer makes the first draw outlast the 2.6s hint delay.
        resetIdle: () => {
          idleSinceRef.current = performance.now();
          hintArmedRef.current = true;
          hintShownRef.current = false;
          setHinting(false);
        },
        pause,
        resume,
        // QA-only: keep the timeline running at full rAF rate while skipping
        // the GPU draw, so the phase timings can be measured independently of
        // software-rendering frame cost. Never used by the experience itself.
        setDrawEnabled: (value: boolean) => {
          drawEnabledRef.current = Boolean(value);
        },
        timeline: () => ({
          ...timelineRef.current,
          events: eventsRef.current.slice(),
        }),
      };
    }

    const teardown = () => {
      if (!alive) return;
      alive = false;
      aliveRef.current = false;
      activePointerRef.current = null;
      stopLoop();
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerCancel);
      stage.removeEventListener('lostpointercapture', onLostCapture);
      stage.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      root.removeEventListener('contextmenu', noMenu);
      document.removeEventListener('visibilitychange', onVisibility);
      if (import.meta.env.DEV) delete (window as unknown as Record<string, unknown>).__cosmos;
    };
    cleanupRef.current = teardown;
    return teardown;
  }, [draw, forced, mark, setPhaseSafe]);

  // Once the handover is complete the overlay is removed; drop its listeners,
  // stop the loop and release the shader/program so the temple owns the GPU.
  useEffect(() => {
    if (phase !== 'done') return;
    cleanupRef.current?.();
    glCleanupRef.current?.();
  }, [phase]);

  // Scrolling belongs to the temple, never to the prologue.
  useEffect(() => {
    if (!locked) return;
    // The boot veil may still hold the shared scroll lock when this mounts;
    // counting keeps its release from restoring 'hidden' as the pre-lock value.
    const releaseScroll = lockScroll();
    let lockedNow = true;
    window.scrollTo(0, 0);

    // overflow:hidden already stops the wheel, but a trackpad or a focused
    // page can still nudge scroll on some browsers. The prologue owns input
    // until the handover.
    const blockScroll = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      scrollingRef.current = true;
    };
    window.addEventListener('wheel', blockScroll, { passive: false });
    window.addEventListener('touchmove', blockScroll, { passive: false });

    // Idempotent so the sequence can release scroll on the exact unlock frame
    // while React's state update catches up later.
    const unlock = () => {
      if (!lockedNow) return;
      lockedNow = false;
      releaseScroll();
      window.removeEventListener('wheel', blockScroll);
      window.removeEventListener('touchmove', blockScroll);
      unlockScrollRef.current = null;
    };
    unlockScrollRef.current = unlock;

    return unlock;
  }, [locked]);

  if (phase === 'done') return null;

  return (
    <>
      {/* The escape hatch arrives with the idle ring, so the first frame stays
          nothing but the hole. */}
      {phase === 'idle' && hinting ? (
        <button type="button" className="cosmos-skip" onClick={() => skipToEnd()}>
          Skip the opening
        </button>
      ) : null}
      <section
        className={`cosmos cosmos--${phase}${hinting ? ' is-hinting' : ''}${fallback ? ' is-fallback' : ''}`}
        ref={rootRef}
        role="button"
        tabIndex={0}
        aria-label="Press and hold the black hole to enter the Palace"
      >
        <div className="cosmos-stage" ref={stageRef}>
          <div className="cosmos-shake">
            <div className="cosmos-fallback" aria-hidden="true" />
            <canvas className="cosmos-canvas" ref={canvasRef} aria-hidden="true" />
          </div>
          <div className="cosmos-vignette" aria-hidden="true" />
          <div className="cosmos-hint" aria-hidden="true" />
          <div className="cosmos-flash" ref={flashRef} aria-hidden="true" />
        </div>
      </section>
    </>
  );
}
