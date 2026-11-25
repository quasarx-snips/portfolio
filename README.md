# The Palace of Many Worlds

A scroll-driven opening cinematic: it begins on a black hole, the visitor presses
and holds to fall through it, and the temple film unrolls from there.

Vite + React 19 + GSAP, no framework, no CMS. Everything rendered is in `src/`
and `public/`.

## Run it

```bash
npm install
npm run dev        # http://localhost:5188  (strictPort)
```

Press and hold the black hole (or hold Space/Enter) to enter, or use
"Skip the opening". Append any `#hash` to the URL to land straight in the temple.

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serves dist/ on :4173 (build first)
npm run typecheck  # tsc -b --noEmit
```

## Layout

```
index.html              boot shell, tier probe, temple preload
src/main.tsx            mount point
src/App.tsx             boot gate -> prologue -> film
src/cine/cosmos/        the black hole: CosmicOpening (timeline), bh-render (shader)
src/cine/               the temple film: Cinematic, Chapters, frame, film
src/cine/art/           dust + smoke engines
src/cine/scenes/        World, Identity, Narrative, Atmosphere
src/load/               asset manifest, boot store, loader
src/perf/               device tier, quality, frame governor
src/styles/             tokens, boot, cosmos, cinematic, reduced-motion
public/world/           temple plates (1280/2000 webp + jpg fallback)
qa/                     dev-only timing harnesses + baselines
```

## The sequence

```
hold 0.7s -> fall 3.0s -> white 0.2s -> reveal 0.9s -> temple pause 2.6s -> scroll unlocked
```

Scrolling is locked until the handover. `prefers-reduced-motion` swaps the
whole thing for a static, readable version via `ReducedExperience`.

## QA (development only)

```bash
npm run build && npm run preview &   # :4173, production build
node qa/gate-baseline.mjs            # boot -> veil -> prologue interactive
node qa/baseline.mjs                 # full first-load path, wall clock

npm run dev &                        # :5188, needs __cosmos hooks
node qa/prologue-baseline.mjs        # prologue leg timings
node qa/scroll-probe.mjs             # scroll-lock / unlock probe
```

The harnesses drive headless Chrome over CDP on `localhost:9222`; start Chrome
with `--remote-debugging-port=9222 --user-data-dir=<temp>` first. Baselines live
in `qa/baselines/`. The screenshot harness is
`node qa/screenshot-harness/capture.mjs --url=http://localhost:5188/ --out=qa/shots`.

`window.__cosmos` (dev only) exposes `press()`, `release()`, `phase()`,
`progress()`, `timeline()` for those runs and is not in production builds.

## Deploy

Vercel builds this repo as a static Vite app (`vercel.json` sets
`outputDirectory: dist` and security headers). Push and it ships.
