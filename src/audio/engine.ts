/**
 * The score's engine: one small Web Audio rig, built once, muted until the
 * visitor asks for it.
 *
 * Design rules, in order of importance:
 *  - Nothing plays before a real gesture. Browsers suspend an AudioContext
 *    until the visitor clicks or types, and pretending otherwise just plays
 *    a silent film. The control is the consent.
 *  - The score is the same pure function of position as the frame: `setFilm`
 *    only stores a number and asks for a throttled re-mix, so scrubbing is
 *    smooth and reversing re-traces the same harmony.
 *  - Everything is synthesised. A drone is three oscillators and an LFO, not
 *    a 4 MB mp3; the reverb is generated, not downloaded. The whole score
 *    costs a few kB of code and no network.
 *  - Nothing is left running: hidden tabs suspend, the tracery of bells is
 *    garbage-collected when it ends, and a slow device gets a delay instead
 *    of a convolution.
 */

import { device } from '../perf';
import {
  DRONE,
  FILM_CUES,
  PAD,
  RATIOS,
  SA_HZ,
  corridorMix,
  filmMix,
  prologueMix,
  roomHz,
  roomStep,
  type Mix,
  type Step,
} from './score';

const STORAGE_KEY = 'palace:sound';
/** Smoothing constant for every continuous gain: nothing steps, ever. */
const TAU = 0.25;

type Mode = 'prologue' | 'film' | 'corridor';

export interface SoundStatus {
  /** The visitor's choice. */
  enabled: boolean;
  /** True while the context is actually producing sound. */
  running: boolean;
}

type StatusListener = (status: SoundStatus) => void;

interface Rig {
  ctx: AudioContext;
  master: GainNode;
  mix: GainNode;
  wetSend: GainNode;
  analyser: AnalyserNode;
  droneFilter: BiquadFilterNode;
  droneGain: GainNode;
  airFilter: BiquadFilterNode;
  airGain: GainNode;
  padGain: GainNode;
  subGain: GainNode;
  roomGain: GainNode;
  roomVoices: readonly [OscillatorNode, OscillatorNode];
  shimmerGain: GainNode;
  samples: Float32Array<ArrayBuffer>;
  spec: Float32Array<ArrayBuffer>;
}

const listeners = new Set<StatusListener>();

let enabled = readStored();
let rig: Rig | null = null;
let mode: Mode = 'prologue';
let filmP = 0;
let roomDepth = 0;
let roomIndex = -1;
let lastFlush = 0;
let pending: number | null = null;
let lastStrike = 0;
/** Dev only: how many playhead updates the engine has actually received. */
let filmCalls = 0;
/**
 * The film's scrub keeps settling at p≈1 for a second after its pin ends,
 * writing the last frame over and over. Once the hall has claimed the score,
 * that tail must not take it back.
 */
let hallClaimed = false;
let gesturesArmed = false;
let visibilityBound = false;

function readStored(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function persist(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off');
  } catch {
    // Private mode: the choice simply does not survive the visit.
  }
}

function running(): boolean {
  return enabled && rig !== null && rig.ctx.state === 'running';
}

function notify(): void {
  const status: SoundStatus = { enabled, running: running() };
  for (const listener of listeners) listener(status);
}

/** Sets a parameter toward a value without ever stepping, and without
 * letting the automation timeline grow with every scroll frame. */
function approach(param: AudioParam, value: number, now: number, tau = TAU): void {
  param.cancelScheduledValues(now);
  param.setTargetAtTime(value, now, tau);
}

/** Brown-ish noise: air, not hiss. Loops without a seam via a short fade. */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const fade = Math.floor(rate * 0.25);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.4;
  }
  // Fold the tail into the head so the loop point is continuous, then drop
  // the folded tail: the buffer now loops from a value that matches its end.
  for (let i = 0; i < fade; i += 1) {
    const t = i / fade;
    data[i] = data[i] * t + data[length - fade + i] * (1 - t);
  }
  return buffer;
}

/** A generated hall: decaying, darkening noise, normalised so the send level
 * means something. No impulse response file is shipped or fetched. */
function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  let peak = 0;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      low += (Math.random() * 2 - 1 - low) * 0.35;
      const sample = low * Math.pow(1 - t, decay);
      data[i] = sample;
      if (Math.abs(sample) > peak) peak = Math.abs(sample);
    }
  }
  const scale = peak > 0 ? 0.55 / peak : 1;
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) data[i] *= scale;
  }
  return buffer;
}

function build(ctx: AudioContext): Rig {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.4;
  analyser.connect(master);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.008;
  comp.release.value = 0.3;
  comp.connect(analyser);

  const mix = ctx.createGain();
  mix.gain.value = 1;
  mix.connect(comp);

  const wetSend = ctx.createGain();
  wetSend.gain.value = 0.55;
  wetSend.connect(comp);

  if (device.tier === 'high') {
    const hall = ctx.createConvolver();
    hall.buffer = impulse(ctx, 2.8, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    wetSend.connect(hall);
    hall.connect(wet);
    wet.connect(comp);
  } else {
    // Cheaper echo: a damped feedback line reads as a small stone room.
    const delay = ctx.createDelay(0.6);
    delay.delayTime.value = 0.23;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2600;
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    wetSend.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(wet);
    wet.connect(comp);
  }

  // The drone: Sa, Pa, Sa above, slowly detuned so the strings beat.
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 760;
  droneFilter.Q.value = 0.55;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  droneFilter.connect(droneGain);
  droneGain.connect(mix);

  const drift = ctx.createOscillator();
  drift.frequency.value = 0.07;
  const driftDepth = ctx.createGain();
  driftDepth.gain.value = 5;
  drift.connect(driftDepth);
  drift.start();

  for (const voice of DRONE) {
    const osc = ctx.createOscillator();
    osc.type = voice.step === 'sa' ? 'triangle' : 'sine';
    osc.frequency.value = SA_HZ * RATIOS[voice.step] * 2 ** voice.octave;
    driftDepth.connect(osc.detune);
    const level = ctx.createGain();
    level.gain.value = voice.gain * 0.35;
    const pan = ctx.createStereoPanner();
    pan.pan.value = voice.pan;
    osc.connect(level);
    level.connect(pan);
    pan.connect(droneFilter);
    osc.start();
  }

  // Air: the smoke and the white, quiet enough to be felt rather than heard.
  const air = ctx.createBufferSource();
  air.buffer = noiseBuffer(ctx, 4);
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = 'bandpass';
  airFilter.frequency.value = 700;
  airFilter.Q.value = 0.7;
  const airGain = ctx.createGain();
  airGain.gain.value = 0;
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(mix);
  air.start();

  // The threshold pad: Sa Ga Pa Ni, a major seventh over the drone.
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1500;
  padFilter.Q.value = 0.4;
  const padGain = ctx.createGain();
  padGain.gain.value = 0;
  padFilter.connect(padGain);
  padGain.connect(mix);
  for (const voice of PAD) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = SA_HZ * RATIOS[voice.step] * 2 ** voice.octave;
    driftDepth.connect(osc.detune);
    const level = ctx.createGain();
    level.gain.value = voice.gain * 0.3;
    osc.connect(level);
    level.connect(padFilter);
    osc.start();
  }

  // Under the black hole only.
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = SA_HZ / 2;
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  subOsc.connect(subGain);
  subGain.connect(mix);
  subOsc.start();

  // The corridor's walking voice: the room's note, and its Pa above.
  const roomFilter = ctx.createBiquadFilter();
  roomFilter.type = 'lowpass';
  roomFilter.frequency.value = 1800;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0;
  roomFilter.connect(roomGain);
  roomGain.connect(mix);
  const roomVoices: OscillatorNode[] = [];
  for (const ratio of [1, RATIOS.pa]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = SA_HZ * 2 * ratio;
    const level = ctx.createGain();
    level.gain.value = ratio === 1 ? 0.5 : 0.18;
    osc.connect(level);
    level.connect(roomFilter);
    osc.start();
    roomVoices.push(osc);
  }

  // The white's high line, barely there.
  const shimmerOsc = ctx.createOscillator();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.value = SA_HZ * 8;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0;
  shimmerOsc.connect(shimmerGain);
  shimmerGain.connect(mix);
  shimmerOsc.start();

  return {
    ctx,
    master,
    mix,
    wetSend,
    analyser,
    droneFilter,
    droneGain,
    airFilter,
    airGain,
    padGain,
    subGain,
    roomGain,
    roomVoices: roomVoices as unknown as readonly [OscillatorNode, OscillatorNode],
    shimmerGain,
    samples: new Float32Array(analyser.fftSize),
    spec: new Float32Array(analyser.frequencyBinCount),
  };
}

function ensureRig(): Rig | null {
  if (rig) return rig;
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    rig = build(new Ctor({ latencyHint: 'playback' }));
  } catch {
    return null;
  }
  bindVisibility();
  if (import.meta.env.DEV) exposeDev();
  return rig;
}

function loadMix(): Mix {
  if (mode === 'film') return filmMix(filmP);
  if (mode === 'corridor') return corridorMix(roomDepth);
  return prologueMix();
}

function applyMix(current: Rig, mix: Mix, now: number): void {
  approach(current.droneGain.gain, mix.drone * 0.6, now);
  approach(current.droneFilter.frequency, mix.bright, now, 0.5);
  approach(current.airGain.gain, mix.air, now, 0.7);
  approach(current.airFilter.frequency, mix.airTone, now, 0.7);
  approach(current.padGain.gain, mix.pad * 0.3, now, 0.6);
  approach(current.subGain.gain, mix.sub * 0.2, now, 0.8);
  approach(current.roomGain.gain, mix.room * 0.3, now, 0.9);
  approach(current.shimmerGain.gain, mix.shimmer * 0.05, now, 0.7);
}

function flush(): void {
  pending = null;
  lastFlush = performance.now();
  if (!rig || !enabled) return;
  applyMix(rig, loadMix(), rig.ctx.currentTime);
}

function schedule(): void {
  if (pending !== null || !enabled || !rig) return;
  // 10 Hz is plenty for a score: faster would only add automation events.
  const wait = Math.max(0, 100 - (performance.now() - lastFlush));
  pending = window.setTimeout(flush, wait);
}

/** One struck note: a bowl, not a beep. Three inharmonic partials, long decay. */
function strike(step: Step, octave: number, gain: number): void {
  if (!rig || !enabled) return;
  const now = rig.ctx.currentTime;
  if (now - lastStrike < 0.13) return;
  lastStrike = now;

  const fundamental = SA_HZ * RATIOS[step] * 2 ** octave;
  const partials: ReadonlyArray<readonly [number, number, number]> = [
    [1, 1, 5.4],
    [2.4, 0.34, 3.2],
    [3.9, 0.15, 2],
  ];

  for (const [multiple, amplitude, decay] of partials) {
    const osc = rig.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = fundamental * multiple;
    const env = rig.ctx.createGain();
    const peak = Math.max(0.0002, gain * amplitude * 0.2);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(env);
    env.connect(rig.mix);
    env.connect(rig.wetSend);
    osc.start(now);
    osc.stop(now + decay + 0.05);
    osc.addEventListener('ended', () => {
      osc.disconnect();
      env.disconnect();
    });
  }
}

function retune(index: number): void {
  if (!rig) return;
  const now = rig.ctx.currentTime;
  const hz = roomHz(index);
  approach(rig.roomVoices[0].frequency, hz, now, 0.7);
  approach(rig.roomVoices[1].frequency, hz * RATIOS.pa, now, 0.7);
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    if (!rig) return;
    if (document.hidden) {
      void rig.ctx.suspend().catch(() => undefined);
    } else if (enabled) {
      void rig.ctx.resume().then(notify).catch(() => undefined);
    }
  });
}

/** A stored preference can only begin on a real gesture; wait for one. */
function armGestures(): void {
  if (gesturesArmed || typeof window === 'undefined') return;
  gesturesArmed = true;
  const start = () => {
    gesturesArmed = false;
    window.removeEventListener('pointerup', start);
    window.removeEventListener('keydown', start);
    window.removeEventListener('touchend', start);
    if (!rig || !enabled) return;
    void rig.ctx
      .resume()
      .then(() => {
        applyMix(rig as Rig, loadMix(), (rig as Rig).ctx.currentTime);
        notify();
      })
      .catch(() => undefined);
  };
  window.addEventListener('pointerup', start, { once: true });
  window.addEventListener('keydown', start, { once: true });
  window.addEventListener('touchend', start, { once: true });
}

export function isEnabled(): boolean {
  return enabled;
}

export function subscribeStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener({ enabled, running: running() });
  return () => {
    listeners.delete(listener);
  };
}

export async function enable(): Promise<void> {
  const current = ensureRig();
  if (!current) return;
  enabled = true;
  persist(true);
  try {
    await current.ctx.resume();
  } catch {
    // Still suspended: armGestures below will finish the job.
  }
  const now = current.ctx.currentTime;
  approach(current.master.gain, 0.9, now, 0.5);
  applyMix(current, loadMix(), now);
  notify();
  if (current.ctx.state !== 'running') armGestures();
}

export function disable(): void {
  enabled = false;
  persist(false);
  const current = rig;
  if (current) {
    const now = current.ctx.currentTime;
    approach(current.master.gain, 0.0001, now, 0.2);
    window.setTimeout(() => {
      if (!enabled && current.ctx.state === 'running') {
        void current.ctx.suspend().catch(() => undefined);
      }
    }, 700);
  }
  notify();
}

/**
 * The film's playhead. Cheap by design: it stores the number, strikes any cue
 * the visitor has just crossed, and lets the throttle do the rest.
 */
export function setFilm(p: number): void {
  filmCalls += 1;
  // A playhead that is genuinely below the end hands the score back to the
  // film; one that is merely holding its final frame while the hall starts
  // does not.
  if (hallClaimed && p >= 0.985) {
    mode = 'corridor';
  } else {
    hallClaimed = false;
    mode = 'film';
  }
  const previous = filmP;
  filmP = p;
  if (running()) {
    // Only a cue genuinely crossed under the playhead rings: a jump from the
    // top of the page to the door should not fire every bell on the way.
    if (p > previous && p - previous < 0.2) {
      for (const cue of FILM_CUES) {
        if (previous < cue.at && p >= cue.at) strike(cue.step, cue.octave, cue.gain);
      }
    }
    schedule();
  }
}

/** Called when the visitor is back above the seam: the film has the score. */
export function releaseHall(): void {
  hallClaimed = false;
}

export function setPrologue(): void {
  mode = 'prologue';
  if (running()) schedule();
}

/**
 * The corridor's playhead, in bays, plus the room at the centre. A new room
 * rings its own note and glides the walking voice to it.
 */
export function setRoom(depth: number, index: number): void {
  mode = 'corridor';
  hallClaimed = true;
  roomDepth = depth;
  if (index !== roomIndex) {
    roomIndex = index;
    if (running()) {
      retune(index);
      strike(roomStep(index), 2, 0.42);
    }
  }
  if (running()) schedule();
}

function level(): number {
  if (!rig) return 0;
  rig.analyser.getFloatTimeDomainData(rig.samples);
  let sum = 0;
  for (let i = 0; i < rig.samples.length; i += 1) {
    const value = rig.samples[i];
    sum += value * value;
  }
  return Math.sqrt(sum / rig.samples.length);
}

/** Strongest partial between 240 and 950 Hz, for checking the room tones. */
function tone(): number {
  if (!rig) return 0;
  rig.analyser.getFloatFrequencyData(rig.spec);
  const hz = rig.ctx.sampleRate / rig.analyser.fftSize;
  const from = Math.max(1, Math.floor(240 / hz));
  const to = Math.min(rig.spec.length - 2, Math.ceil(950 / hz));
  let best = from;
  for (let i = from; i <= to; i += 1) {
    if (rig.spec[i] > rig.spec[best]) best = i;
  }
  return Math.round(best * hz);
}

function peak(): number {
  if (!rig) return 0;
  rig.analyser.getFloatTimeDomainData(rig.samples);
  let high = 0;
  for (let i = 0; i < rig.samples.length; i += 1) {
    const value = Math.abs(rig.samples[i]);
    if (value > high) high = value;
  }
  return high;
}

/** Dev-only: lets the QA harness read the real output level without ears. */
function exposeDev(): void {
  window.__palaceAudio = {
    state: () => (rig ? rig.ctx.state : 'unbuilt'),
    mode: () => mode,
    filmCalls: () => filmCalls,
    setFilm,
    setRoom,
    level,
    peak,
    tone,
    mix: () => loadMix(),
    enable,
    disable,
  };
}