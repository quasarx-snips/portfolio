/**
 * ============================================================
 * SITE CONTENT — the ONLY file you need to edit
 * ------------------------------------------------------------
 * Everything user-facing lives here, pulled from your resume:
 * your details, awards, projects, skills, and links.
 * ============================================================
 */

export const site = {
  name: "Bibhab Saha",
  initials: "BS",

  /** Shown under your name in the hero. */
  title: "Software Engineer — Aerospace Security & AI/ML",
  location: "Silchar, Assam",

  /** Hero headline. `accent` gets the gradient treatment. */
  headline: {
    accent: "I build secure systems",
    rest: "for space and AI",
  },

  tagline:
    "Integrated M.Tech Software Engineering student at VIT Vellore working where cybersecurity, AI/ML and aerospace systems meet — avionics intrusion detection, computer vision for lunar imagery, and orbital physics engines built from the ground up.",

  status: {
    available: true,
    label: "Open to internships & collaborations",
  },

  education: {
    school: "Vellore Institute of Technology",
    degree: "Integrated M.Tech, Software Engineering",
    location: "Vellore",
    focus: ["Software Architecture", "Cybersecurity", "Computer Vision", "Aerospace Systems"],
  },

  /** Two lines for the About section. */
  about: {
    heading: "About",
    paragraphs: [
      "I study software engineering with a focus on the seam where security, intelligence and physical systems meet — and I like understanding the abstractions underneath rather than just using them.",
      "My work spans avionics security protocols, computer vision for lunar imagery, and orbital physics engines, much of it built from scratch without leaning on high-level libraries.",
    ],
  },

  links: {
    github: "https://github.com/quasarx-snips",
    linkedin: "https://linkedin.com/in/bibhab-saha",
    hashnode: "https://hashnode.com/@bibhab2209",
    /** TODO — set this to your real email address. */
    email: "you@example.com",
    /** TODO — drop your resume PDF into /public and it will link up. */
    resume: "/resume.pdf",
  },
} as const;

/** Front-and-centre recognition. */
export const awards = [
  {
    icon: "trophy" as const,
    title: "Best Freshers",
    org: "Devjams '26 — VIT Vellore",
    detail:
      "Won for LunaP, a computer-vision pipeline that extracts structural features from lunar imagery.",
  },
  {
    icon: "medal" as const,
    title: "SIH Representative",
    org: "Smart India Hackathon",
    detail:
      "Selected to represent VIT Vellore, building and pitching national-level solutions to government problem statements.",
  },
];

export type Project = {
  title: string;
  description: string;
  tags: string[];
  /** Repo link. Optional — some projects are not public. */
  github?: string;
  /** Live demo link. Optional — most of these are not web apps. */
  live?: string;
  /** "wide" spans two columns in the bento grid. */
  span?: "wide";
  /** Short technical detail shown as a footer stat. */
  stat?: string;
  featured?: boolean;
};

/**
 * The six strongest projects, in the bento grid.
 * `live` is omitted where there is no deployed demo — honest beats a dead link.
 */
export const projects: Project[] = [
  {
    title: "LunaP — Lunar Feature Extraction",
    description:
      "Computer-vision pipeline that pulls structural features out of lunar imagery — craters, ridges, texture changes — then maps hazards using mathematical morphology and ML models.",
    tags: ["Python", "Computer Vision", "Mathematical Morphology", "ML"],
    github: "https://github.com/quasarx-snips",
    span: "wide",
    stat: "Best Freshers — Devjams '26",
    featured: true,
  },
  {
    title: "ARINC 429 IDS",
    description:
      "Software-based intrusion detection for legacy avionics. Runs Shannon Entropy over the bitstream to catch data injection and spoofing as statistical anomalies.",
    tags: ["C", "Avionics Security", "Shannon Entropy", "Threat Detection"],
    github: "https://github.com/quasarx-snips",
    stat: "Bitstream anomaly detection",
  },
  {
    title: "EXOLINE — Orbital Physics Engine",
    description:
      "Physics simulation agent for orbital mechanics: Earth–Moon transfer prediction, staging and ascent physics, with stability validation on the integrator.",
    tags: ["Python", "Orbital Mechanics", "Simulation"],
    github: "https://github.com/quasarx-snips",
    stat: "Earth–Moon transfers",
  },
  {
    title: "VERITAS — Geospatial Verification",
    description:
      "Geometric verification layer for Geospatial AI that stops downstream systems from reading image misalignment as real-world change.",
    tags: ["Python", "Geospatial AI", "Explainable AI"],
    github: "https://github.com/quasarx-snips",
  },
  {
    title: "Neural Network Visualizer",
    description:
      "Custom visualizer that animates neural-network mathematics 3Blue1Brown-style, turning matrix operations into something you can actually watch.",
    tags: ["Python", "Math Visualization", "NumPy"],
    github: "https://github.com/quasarx-snips",
  },
  {
    title: "DataViz Dashboard",
    description:
      "Clean, performant dashboard for complex datasets — minimal UI, fast load times, no chart-library bloat.",
    tags: ["React", "TypeScript", "Tailwind CSS"],
    github: "https://github.com/quasarx-snips",
    live: "https://github.com/quasarx-snips",
  },
];

/** Everything else — shown as a compact list under the grid. */
export const moreProjects = [
  {
    title: "CelestiNav",
    description:
      "Offline celestial navigation from phone-camera observations. No GPS, no internet.",
  },
  {
    title: "OrbitalTrust",
    description:
      "Forensic authenticity analysis for satellite imagery: manipulation, sensor noise, geospatial consistency.",
  },
  {
    title: "Custom CPU Emulator",
    description:
      "CPU emulator plus math and ML engines written from scratch, with no high-level abstractions.",
  },
];

/**
 * Skills, grouped exactly as they read on your resume.
 * `level` drives the meter bar — keep it honest.
 */
export const skillGroups = [
  {
    label: "Languages",
    items: [
      { name: "Python", level: 92 },
      { name: "Java", level: 80 },
      { name: "TypeScript", level: 82 },
      { name: "C / C++", level: 76 },
    ],
  },
  {
    label: "AI / ML & Data",
    items: [
      { name: "Computer Vision", level: 88 },
      { name: "Anomaly Detection", level: 84 },
      { name: "Geospatial AI", level: 80 },
      { name: "Data Visualization", level: 86 },
    ],
  },
  {
    label: "Cybersecurity",
    items: [
      { name: "Application Security", level: 84 },
      { name: "Threat Detection", level: 82 },
      { name: "Avionics Security", level: 86 },
      { name: "Cryptography", level: 78 },
    ],
  },
  {
    label: "Systems & Aerospace",
    items: [
      { name: "Software Architecture", level: 82 },
      { name: "Distributed Systems", level: 76 },
      { name: "ARINC 429", level: 85 },
      { name: "Orbital Mechanics", level: 80 },
    ],
  },
  {
    label: "Web & Tools",
    items: [
      { name: "Next.js", level: 82 },
      { name: "React", level: 84 },
      { name: "Tailwind CSS", level: 88 },
      { name: "Git / GitHub", level: 90 },
    ],
  },
] as const;

/** Flat list for the hero badge row and the marquee. */
export const techStack = [
  "Python",
  "Computer Vision",
  "Avionics Security",
  "ARINC 429",
  "Orbital Mechanics",
  "Anomaly Detection",
  "Geospatial AI",
  "Next.js",
  "React",
  "TypeScript",
  "Tailwind CSS",
  "Cryptography",
] as const;

export const nav = [
  { label: "Awards", href: "#awards" },
  { label: "Work", href: "#projects" },
  { label: "Skills", href: "#skills" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
] as const;


