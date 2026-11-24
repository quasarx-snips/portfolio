# `.qa/` — visual QA screenshot harness

Self-contained, zero-dependency harness for capturing the scroll-driven
cinematic ("The Palace of Many Worlds") at fixed progress values. Drives
headless Chrome/Edge over the DevTools Protocol (CDP) with Node 22+ built-ins
only — no `npm install`, no puppeteer/playwright.

Nothing outside `.qa/` is touched.

## The debug contract (dev only)

The app exposes, **in dev builds only** (`npm run dev`):

```js
window.__palace.force(progress); // renders the cinematic at progress 0..1, no scrolling
window.__palace.progress();      // returns the last rendered progress
```

If the page never exposes `window.__palace.force`, the harness fails loudly
(with exit code 1) and explains why. Production builds do not include it.

## 1. Start the dev server

From the project root:

```bash
npm run dev
# Vite serves the app at http://localhost:5178/  (strictPort, see vite.config.ts)
```

Keep it running in a separate terminal while you capture.

## 2. Capture screenshots

```bash
# Desktop 1440x900 — progress sweep (default: 0, 0.2, 0.4, 0.6, 0.8, 0.95, 1)
node .qa/capture.mjs --url=http://localhost:5178/ --out=.qa/shots --width=1440 --height=900 --prefix=desktop

# Mobile portrait 390x844 (touch + mobile emulation)
node .qa/capture.mjs --url=http://localhost:5178/ --out=.qa/shots --width=390 --height=844 --mobile --prefix=m390x844

# Mobile landscape 844x390
node .qa/capture.mjs --url=http://localhost:5178/ --out=.qa/shots --width=844 --height=390 --mobile --prefix=m844x390

# Reduced motion (prefers-reduced-motion: reduce)
#   - emulates the media feature via CDP
#   - does NOT call window.__palace.force()
#   - captures the top of the page plus the optional --scroll positions
node .qa/capture.mjs --url=http://localhost:5178/ --out=.qa/shots --width=1440 --height=900 --reduced --scroll=0,900,1800 --prefix=reduced
```

### Options

| Flag | Default | Meaning |
| --- | --- | --- |
| `--url=<url>` | `http://localhost:5178/` | Page to capture (`http(s)://` or `file://`) |
| `--out=<dir>` | `.qa/shots` | Output directory (created recursively) |
| `--width=<px>` | `1440` | Viewport width |
| `--height=<px>` | `900` | Viewport height |
| `--mobile` | off | `Emulation` mobile + touch emulation |
| `--reduced` | off | Emulate `prefers-reduced-motion: reduce`; never calls `force()` |
| `--progress=<list>` | `0,0.2,0.4,0.6,0.8,0.95,1` | Comma-separated progress values `0..1` |
| `--scroll=<list>` | — | Comma-separated `scrollY` px offsets; alternative capture mode |
| `--prefix=<name>` | `desktop` | Output filename prefix |
| `--settle=<ms>` | `180` | Settle time after each `force()`/scroll, plus two `requestAnimationFrame` waits |
| `--chrome=<path>` | auto | Override Chrome/Edge executable |

Chrome/Edge is auto-detected at, in order:

1. `C:/Program Files/Google/Chrome/Application/chrome.exe`
2. `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`

### Output filenames

- Progress mode: `<prefix>-p<percent>.png` — percent is 0–100, zero-padded to 3
  digits. Progress `0.6` → `desktop-p060.png`, `0.95` → `desktop-p095.png`.
- Scroll mode: `<prefix>-s<pixels>.png` — `scrollY` zero-padded to 5 digits.
  `scrollY 900` → `reduced-s00900.png`, top of page → `reduced-s00000.png`.

Each capture prints one log line (file, forced progress, `progress()` reading
returned by the app, viewport, size) and a final summary. Exit code is `1` on
any failure.

## 3. Build the contact sheet

```bash
node .qa/make-sheet.mjs --dir=.qa/shots --out=.qa/contact-sheet.html
```

Generates a dark, responsive, **self-contained** HTML sheet (all PNGs embedded
as data URIs — no network needed) grouped by filename prefix, with progress /
scroll labels, per-image pixel dimensions and sizes, and a timestamp.

## Notes & troubleshooting

- `window.__palace` exists **only in dev**. Do not point the harness at a
  production build and expect `--progress` to work.
- `.qa/.chrome-profile/` is the throwaway Chrome profile used for headless
  runs (required for `--remote-debugging-port`). It is disposable cache and can
  be deleted at any time; the harness recreates it.
- If Chrome fails to start, the stderr tail is printed. Common fixes: pass
  `--chrome=<path>`, or close other automation using the same profile dir.
- If captures look blurry, ensure `--force-device-scale-factor=1` (already
  default in the harness) and that `--width/--height` match your intent.
- Every wait is bounded (page load 30 s, `window.__palace` 20 s, CDP commands
  30 s); the harness always kills Chrome on exit and cannot hang forever.
- `QA_DEBUG=1` prints stack traces for failures.
## Cosmic prologue (first screen)

The page opens on a fixed black-hole screen. Scrolling is locked; the visitor
must **press and hold** the hole (or hold Space/Enter). The hold charges the
hole, then the fall-in and the warm-white beam play on their own:

    hold 0.7s -> fall-in 3.0s -> white 0.2s -> fade to temple 0.9s
              -> temple hold 2.6s -> scrolling unlocked

- The prologue is `position: fixed` and removed from flow, so the temple film
  starts at `scrollY=0` exactly as it did before the prologue existed.
- `window.__cosmos` (dev only) exposes `press()`, `release()`, `phase()` and
  `progress()` for QA; it disappears once the handover is complete.
- QA harness: a fresh load always shows the prologue, so scroll captures of the
  temple need the flow completed first (see `.qa/` CDP probes) or a `#hash`
  URL, which skips the prologue.
