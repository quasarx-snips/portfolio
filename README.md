# Bibhab Saha — Portfolio

Personal portfolio. Next.js 16, React 19, Tailwind CSS v4, Motion.

## Repository layout

This is an npm-workspaces monorepo with two independent apps:

- **root** — the Next.js portfolio (this README, `app/`, `components/`, `lib/`).
  Deploys to Vercel from `main`; `vercel.json` adds security headers.
- **`apps/cinematic`** — "The Palace of Many Worlds", the scroll-driven opening
  cinematic (Vite + React + GSAP). Runs on its own toolchain and never shares
  build output with the portfolio.

```bash
npm install            # installs both workspaces (hoisted to root node_modules)
npm run dev            # portfolio      → http://localhost:3000
npm run cinematic:dev  # cinematic      → http://localhost:5188
npm run cinematic:build / cinematic:preview / cinematic:typecheck
```

QA harnesses live in `qa/` (baseline timing + the screenshot harness). They are
development-only and never ship.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Push to `main` and Vercel builds it automatically. Nothing to configure —
`vercel.json` only adds security headers.

## Editing your content

Everything user-facing lives in **`lib/site.config.ts`**: name, headline,
tagline, awards, education, the six featured projects, the `moreProjects`
list, skills, and links.

Two TODOs remain in that file, both marked `TODO`:
1. `links.email` — currently `you@example.com`
2. `links.resume` — drop your PDF into `public/` as `resume.pdf`

Also update `metadataBase` and `openGraph.url` in `app/layout.tsx` once your
domain is live.

## Design system

Colour tokens are defined once as CSS variables in `app/globals.css` and
exposed to Tailwind via `@theme inline`.

| Token | Value | Use |
| --- | --- | --- |
| `--text` | `#FFFFFF` | body + headings |
| `--background` | `#2b1517` | page canvas |
| `--primary` | `#d97d76` | CTAs, links, focus ring |
| `--secondary` | `#f3d1cc` | soft highlights |
| `--accent` | `#eba39c` | dividers, hover states |

Derived tokens (`--surface`, `--border`, `--muted`, ...) build the elevation
ramp. `--border-strong` sits at 3.02:1 against the background, which meets the
WCAG 3:1 minimum for meaningful boundaries.

## Performance / accessibility

- The particle field is **skipped on mobile** and on coarse-pointer devices,
  and never runs when `prefers-reduced-motion: reduce` is set.
- The custom cursor mounts only on fine pointers with motion allowed.
- Every animation collapses to static content under reduced motion.
- The particle canvas freezes via `IntersectionObserver` when scrolled out of
  view and when the tab is hidden.
- `devicePixelRatio` is capped at 2.
- All decorative layers are `aria-hidden` and `pointer-events: none`.

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```
