# The Palace of Many Worlds

A scroll-driven opening cinematic: it begins on a black hole, the visitor
presses and holds to fall through it, and the temple film unrolls from there.

Vite + React 19 + GSAP, no framework, no CMS. Everything rendered is in `src/`
and `public/`. QA harnesses are zero-dependency Node scripts (Node 22+ for the
global `WebSocket` used by the CDP probes).

## Run it

```bash
npm install
npm run dev        # http://localhost:5188  (strictPort, see vite.config.ts)
```

Press and hold the black hole (or hold Space/Enter) to enter, or use
"Skip the opening". Append any `#hash` to the URL to land straight in the
temple at the film's first frame.

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serves dist/ on :4173 (build first)
npm run typecheck  # tsc -b --noEmit
```

## URL parameters

| Parameter | Builds | Effect |
| --- | --- | --- |
| `#anything` | all | Any hash skips the prologue; the film mounts immediately at progress 0. |
| `?boot=skip` | all | No boot veil, no scroll lock, no gate timing. |
| `?p=<0..1>` | all (forcing is dev-only) | Skips the boot veil and mounts the film. In dev it also renders one forced frame via `window.__palace.force()` for screenshots. |
| `?cosmos=<0..1>` | dev | Freezes the prologue at a fall progress; the timeline never advances. For shader QA stills. |
| `?cosmosPerf=1` | dev | Runs the prologue timeline and DOM at full rate but skips every GL draw, so phase timings can be measured without the software renderer's frame cost. |

## Layout

```
index.html                  boot shell, tier probe, temple plate preload
src/main.tsx                mount point; builds the boot manifest and starts the scheduler
src/App.tsx                 boot gate -> prologue -> film -> aftermath
src/scrollLock.ts           shared, reference-counted scroll lock (veil + prologue)
src/content/opening.ts      narration lines, the three names, subtitle
src/cine/cosmos/            the black hole: CosmicOpening (rAF timeline), bh-render (shader)
src/cine/                   the temple film: Cinematic, Chapters, PointerCamera,
                            film (frame store), frame (deterministic frame math), easing
src/cine/art/               dust + smoke: smokeEngine, smokeSprites, dustEngine, noise
src/cine/scenes/            World, Identity, Narrative, Atmosphere, Smoke, useCanvas
src/cine/useViewMode.ts     narrow/portrait/reduced-motion media queries
src/load/                   boot manifest, boot scheduler, boot store, asset helpers
src/perf/                   device detection + tier, quality table, frame governor
src/ui/boot/                BootGate (veil) + BootScreen (progress UI)
src/styles/                 tokens, boot, cosmos, cinematic, reduced css + font registration
public/world/               temple plates (1280/2000 webp + jpg fallback)
qa/                         dev-only timing harnesses, screenshot harness, baselines
```

## How a visit loads

- `src/load/manifest.ts` declares four pages (prologue, film, identity,
  aftermath) and every task each needs: code chunks, images, fonts, prep work.
- `src/load/boot.ts` is the scheduler: critical tasks first, weighted progress,
  concurrency derived from the connection, hidden-tab parking, bounded retries,
  and hard timeouts. The gate opens on facts, not timers.
- `src/perf/device.ts` classifies the device into `low`/`mid`/`high` (memory,
  cores, pointer, GPU string, connection) and `src/perf/quality.ts` maps that
  onto concrete budgets: DPR caps, pixel budget, particle counts, plate width.
- `src/perf/governor.ts` adapts the prologue's render resolution to measured
  frame times (drops fast, recovers slowly).
- `prefers-reduced-motion` swaps the entire cinematic for `ReducedExperience`:
  four static, readable acts, no pinning, no timers.

## The sequence

```
hold 0.7s -> fall 3.0s -> white 0.2s -> reveal 0.9s -> temple pause 2.6s -> scroll unlocked
```

Scrolling is locked until the handover (shared lock in `src/scrollLock.ts`, so
the veil and the prologue never fight over `overflow`).

The establishing shot is composed by the frame's **width**, not its height: the
shader's focal length is normalised against a 16:10 reference and widens as the
frame narrows (`framing = min(1, (aspect / 1.6) ^ 0.85)`, mirrored into the CSS
`--hole` variable). A phone therefore pulls back until the whole disk fits
instead of cropping it to the horizon and running the ring off both edges;
desktop and landscape keep the original lens.

## QA (development only)

All harnesses drive headless Chrome over CDP on `http://localhost:9222`. Start
Chrome first:

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new \
  --remote-debugging-port=9222 --user-data-dir=.qa/.chrome-profile about:blank
```

| Script | Target | Measures |
| --- | --- | --- |
| `node qa/gate-baseline.mjs` | production preview `:4173` | Boot shell replaced, app mounted behind veil, veil fade, prologue interactive. `TARGET_URL` env overrides the URL. |
| `node qa/baseline.mjs` | dev `:5188` | Full first-load path: gate, press-and-hold fall, handover, first scroll. Uses `window.__cosmos`, so it needs the dev server (`TARGET_URL=http://localhost:5188/`); on a production build the press is a silent no-op and only the gate milestones are real. |
| `node qa/prologue-baseline.mjs` | dev `:5188` | Prologue leg timings: interactive, fall, reveal, unlock, first scroll. `TARGET_URL` override. |
| `node qa/scroll-probe.mjs` | dev `:5188` | Scroll-lock/unlock probes: overflow state, wheel, keyboard. |
| `node qa/screenshot-harness/capture.mjs` | dev `:5188` | Screenshots at forced film progress or scroll offsets; see `qa/screenshot-harness/README.md`. |

Screenshots, contact sheets, lighthouse reports and the throwaway Chrome
profile all live under `.qa/` (gitignored).

Measured numbers are recorded in `qa/baselines/*.md` (dated, append-only —
re-run the same commands after each fix round and add a new section).

### Dev-only hooks

`window.__cosmos` (prologue): `press()`, `release()`, `phase()`,
`progress()`, `charge()`, `status()`, `timeline()`, `pause()`, `resume()`,
`resetIdle()`, `setDrawEnabled()`. Gone once the handover completes.
`window.__palace` (film): `force(p)`, `release()`, `progress()`, `frame()`.

Both exist only in dev builds; production journeys cannot be scripted.

## Deploy

Vercel builds this repo as a static Vite app (`vercel.json` sets
`outputDirectory: dist` and security headers). Push and it ships.
