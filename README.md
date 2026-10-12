# Portfolio

Personal developer portfolio — Next.js 16, React 19, Tailwind CSS v4, Motion.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Edit your content — one file

Everything you need to personalise lives in **`lib/site.config.ts`**:

| What | Where |
| --- | --- |
| Your name | `site.name` |
| Hero headline | `site.headline` |
| Tagline + About copy | `site.tagline`, `site.about.paragraphs` |
| The three projects | `projects` |
| Skills + levels | `skillGroups` |
| Tech stack badges | `techStack` |
| GitHub / LinkedIn / email | `site.links`, `site.email` |

Search the codebase for `PLACEHOLDER` to find every spot still holding dummy data.

Also update:
- `app/layout.tsx` → `metadataBase` and the `openGraph.url`/`twitter` URLs
- `public/` → drop in your resume as `resume.pdf` if you link it

## Design system

Colour tokens are defined once as CSS variables in `app/globals.css` and exposed to
Tailwind via `@theme inline`, so utilities like `bg-surface`, `text-primary` and
`border-border` all exist. Change a hex there and the whole site follows.

| Token | Value | Use |
| --- | --- | --- |
| `--text` | `#FCFCF9` | body + headings |
| `--background` | `#381919` | page canvas |
| `--primary` | `#ed7878` | CTAs, links, focus ring |
| `--secondary` | `#f6d0d0` | soft highlights |
| `--accent` | `#e58f8f` | dividers, hover states |

Derived tokens (`--surface`, `--border`, `--muted`, ...) build the elevation ramp.

## Performance / accessibility notes

- The hero particle canvas is **skipped on mobile** and on coarse-pointer devices,
  and never runs when `prefers-reduced-motion: reduce` is set.
- All scroll animations (fade-in, text reveal, skill bars) collapse to static
  content under reduced motion.
- The particle canvas freezes via `IntersectionObserver` when scrolled out of view
  and when the browser tab is hidden.
- `devicePixelRatio` is capped at 2 to avoid rendering 9M pixels on retina phones.

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Deploy

Push to `main` — Vercel builds and deploys automatically.
