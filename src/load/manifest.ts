import type { BootTask, PageSpec } from './types';
import { choosePlateWidth, nextIdle, preloadImage, waitForFont } from './assets';

/**
 * The app-specific part of the boot: which pages exist, what each one needs,
 * and what a failure costs. Kept apart from the scheduler so the loading rules
 * stay generic and testable.
 */

export interface ManifestInput {
  dpr: number;
  dprCap: number;
  /** Highest plate variant this device is allowed to fetch (1280 or 2000). */
  plateWidthCap: 1280 | 2000;
  mobile: boolean;
  reducedData: boolean;
  /** The reduced-motion journey replaces the scroll film; load its chunk. */
  reducedMotion: boolean;
  viewportWidth: number;
  /** Resolves to the built asset prefix (Vite serves from /). */
  basePath: string;
}

export interface Manifest {
  pages: PageSpec[];
  tasks: BootTask[];
}

const FONT_FILM = [
  '400 1em "Newsreader Variable"',
  'italic 400 1em "Newsreader Variable"',
  '400 1em "Neucha"',
  '500 1em "Playfair Display Variable"',
];

const FONT_IDENTITY = [
  '500 1em "Cormorant Garamond"',
  '500 1em "Noto Serif Devanagari"',
  '500 1em "Noto Serif Bengali"',
];

/** One import for the CSS that registers every face, shared by all font tasks. */
let fontFaces: Promise<unknown> | null = null;
function registerFontFaces(): Promise<unknown> {
  fontFaces ??= import('../styles/fonts');
  return fontFaces;
}

function fontTask(id: string, page: BootTask['page'], spec: string, weight: number): BootTask {
  return {
    id,
    page,
    kind: 'font',
    weight,
    critical: false,
    run: async (signal) => {
      await registerFontFaces();
      if (signal.aborted) return;
      await waitForFont(spec);
    },
  };
}

export function buildManifest(input: ManifestInput): Manifest {
  const pages: PageSpec[] = [
    {
      id: 'prologue',
      label: 'The Prologue',
      detail: 'Waking the dark.',
      minDwellMs: 480,
    },
    {
      id: 'film',
      label: 'The Temple',
      detail: 'Raising the stone and the sky.',
      minDwellMs: 560,
    },
    {
      id: 'identity',
      label: 'The Name',
      detail: 'Setting the letters in gold.',
      minDwellMs: 380,
    },
    {
      id: 'aftermath',
      label: 'The Aftermath',
      detail: 'Settling the room.',
      minDwellMs: 240,
    },
  ];

  const plateWidth = choosePlateWidth(input.viewportWidth, input.dpr, input.dprCap, input.plateWidthCap);
  const darkUrl = `${input.basePath}world/temple-dark-${plateWidth}.webp`;
  const clearUrl = `${input.basePath}world/temple-clear-${plateWidth}.webp`;

  const tasks: BootTask[] = [
    // ------------------------------------------------------------- prologue
    {
      id: 'prologue-app',
      page: 'prologue',
      kind: 'module',
      weight: 180_000,
      critical: true,
      run: () => import('../App'),
    },
    {
      id: 'font-sheet',
      page: 'prologue',
      kind: 'module',
      weight: 55_000,
      critical: false,
      run: () => registerFontFaces(),
    },
    ...(input.reducedMotion
      ? [
          {
            id: 'reduced-journey',
            page: 'prologue' as const,
            kind: 'module' as const,
            weight: 120_000,
            critical: true,
            run: () => import('../cine/ReducedExperience'),
          },
        ]
      : []),

    // ----------------------------------------------------------------- film
    {
      id: 'plate-dark',
      page: 'film',
      kind: 'image',
      weight: plateWidth === 2000 ? 49_470 : 26_658,
      critical: false,
      run: (signal) => preloadImage(darkUrl, { signal, highPriority: true }),
    },
    {
      id: 'plate-clear',
      page: 'film',
      kind: 'image',
      weight: plateWidth === 2000 ? 147_646 : 83_644,
      critical: false,
      run: (signal) => preloadImage(clearUrl, { signal }),
    },
    ...(input.reducedMotion
      ? []
      : [
          {
            id: 'film-chunk',
            page: 'film' as const,
            kind: 'module' as const,
            weight: 260_000,
            critical: true,
            run: () => import('../cine/Cinematic'),
          },
          {
            id: 'smoke-sprites',
            page: 'film' as const,
            kind: 'work' as const,
            weight: 28_000,
            critical: false,
            run: async (signal: AbortSignal) => {
              if (input.reducedData) return;
              const smoke = await import('../cine/art/smokeEngine');
              if (signal.aborted) return;
              await smoke.prepareSmoke(input.mobile);
            },
          },
        ]),
    ...FONT_FILM.map((spec, index) =>
      fontTask(`film-font-${index}`, 'film', spec, 82_000),
    ),

    // ------------------------------------------------------------- identity
    ...FONT_IDENTITY.map((spec, index) =>
      fontTask(`identity-font-${index}`, 'identity', spec, 90_000),
    ),

    // ------------------------------------------------------------- aftermath
    {
      id: 'aftermath-settle',
      page: 'aftermath',
      kind: 'work',
      weight: 1,
      critical: false,
      run: (signal) => {
        if (signal.aborted) return Promise.resolve();
        return nextIdle();
      },
    },
  ];

  return { pages, tasks };
}
