/**
 * ============================================================
 * SITE CONTENT — the ONLY file you need to edit
 * ------------------------------------------------------------
 * Everything user-facing lives here: your name, the three
 * projects, skills, and contact links. The components read
 * from this file, so the design never breaks when you edit
 * copy. Replace the PLACEHOLDER values with your own.
 * ============================================================
 */

export const site = {
  /** PLACEHOLDER — your name, shown in the hero + header. */
  name: "Your Name",

  /** PLACEHOLDER — the hero headline. First line is the accent word. */
  headline: {
    accent: "I build neural nets",
    rest: "+ data viz",
  },

  /** PLACEHOLDER — one sentence under the headline. */
  tagline:
    "ML engineer and front-end developer turning dense math into interfaces people can actually feel. Currently exploring how models think.",

  /** Small rotating/static status line. Set `available` false to hide the dot. */
  status: {
    available: true,
    label: "Open to Summer 2026 internships",
  },

  /** PLACEHOLDER — two lines for the About section. */
  about: {
    heading: "About",
    paragraphs: [
      "I study math and machine learning, then build the tooling that makes both legible — visualizers, dashboards, and small interactive explanations.",
      "Most of my work lives at the seam between a training loop and a render loop.",
    ],
  },

  email: "you@example.com",

  links: {
    github: "https://github.com/your-username",
    linkedin: "https://www.linkedin.com/in/your-username",
    /** PLACEHOLDER — drop your resume PDF in /public and point here. */
    resume: "/resume.pdf",
  },
} as const;

export type Project = {
  title: string;
  description: string;
  tags: string[];
  github: string;
  live: string;
  /** "wide" spans two columns in the bento grid, "tall" spans two rows. */
  span?: "wide" | "tall";
  /** Short metric or detail shown as a footer stat. */
  stat?: string;
  featured?: boolean;
};

/**
 * PLACEHOLDER — your three best projects. The first is the featured
 * bento card (wide), the other two sit below it.
 */
export const projects: Project[] = [
  {
    title: "Neural Network Visualizer",
    description:
      "Interactive 3D playground for watching a network learn — live forward passes, backprop gradients, and neuron activations rendered layer by layer.",
    tags: ["Python", "PyTorch", "Three.js", "React"],
    github: "https://github.com/your-username/neural-viz",
    live: "https://neural-viz.vercel.app",
    span: "wide",
    stat: "40k+ interactive neurons",
    featured: true,
  },
  {
    title: "DataViz Dashboard",
    description:
      "Real-time analytics dashboard streaming millions of rows into charts that stay under 60ms per frame.",
    tags: ["React", "TypeScript", "D3", "WebGL"],
    github: "https://github.com/your-username/dataviz",
    live: "https://dataviz.vercel.app",
    stat: "1M+ rows / 60fps",
  },
  {
    title: "Your Third Project",
    description:
      "Swap this for the third thing you're proudest of. One line on what it does and why it was hard.",
    tags: ["Python", "NumPy", "FastAPI"],
    github: "https://github.com/your-username/project-three",
    live: "https://project-three.vercel.app",
    stat: "Describe the result",
  },
];

/**
 * Skills, grouped. `level` drives the little meter bar (0-100) —
 * keep it honest, recruiters do read these.
 */
export const skillGroups = [
  {
    label: "Machine Learning",
    items: [
      { name: "Python", level: 92 },
      { name: "PyTorch", level: 85 },
      { name: "NumPy / Pandas", level: 88 },
    ],
  },
  {
    label: "Frontend",
    items: [
      { name: "React", level: 86 },
      { name: "TypeScript", level: 80 },
      { name: "Next.js", level: 78 },
      { name: "Tailwind CSS", level: 88 },
    ],
  },
  {
    label: "Math & Data",
    items: [
      { name: "Linear Algebra", level: 90 },
      { name: "Calculus", level: 84 },
      { name: "Statistics", level: 82 },
    ],
  },
] as const;

/** Flat list used for the marquee / badge row under the hero. */
export const techStack = [
  "Python",
  "PyTorch",
  "React",
  "TypeScript",
  "Next.js",
  "Tailwind CSS",
  "NumPy",
  "Pandas",
  "Three.js",
  "D3.js",
  "FastAPI",
  "PostgreSQL",
] as const;

export const nav = [
  { label: "Work", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
] as const;
