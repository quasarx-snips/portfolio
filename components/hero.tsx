"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Aurora } from "@/components/aurora";
import { ParticleField } from "@/components/particle-field";
import { MagneticButton } from "@/components/magnetic-button";
import { FadeIn, TextReveal } from "@/components/motion-primitives";
import { site, techStack } from "@/lib/site.config";

/**
 * Hero — the "hero with grid background" layout, re-skinned.
 *
 * Layering, back to front:
 *   1. .bg-grid        faint 56px grid
 *   2. Aurora          three drifting gradient blobs (CSS keyframes)
 *   3. /blob.svg       warped Haikei-style blob
 *   4. ParticleField   flow-field particles + cursor links (desktop only)
 *   5. content
 *
 * The whole content block parallaxes up and fades as you scroll away, using
 * motion's useScroll (which reads the native scroll position, no listeners).
 */
export function Hero() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const contentY = useTransform(scrollYProgress, [0, 0.25], [0, -110]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* ---------- background layers ---------- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-grid mask-fade-edges absolute inset-0 opacity-70" />
        <Aurora />
        <Image
          src="/blob.svg"
          alt=""
          width={800}
          height={800}
          priority
          className="absolute left-1/2 top-[-18rem] h-[46rem] w-[46rem] max-w-none -translate-x-1/2 opacity-40 blur-2xl"
        />
        <ParticleField className="absolute inset-0 h-full w-full opacity-70" />
        {/* blends the bottom of the hero into the page background */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>


      {/* ---------- content ---------- */}
      <motion.div
        style={reduceMotion ? undefined : { y: contentY, opacity: contentOpacity }}
        className="mx-auto max-w-6xl px-6 pb-28 pt-24 sm:px-8 sm:pb-36 sm:pt-36"
      >
        {site.status.available ? (
          <FadeIn className="mb-8">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-surface/60 px-3.5 py-1.5 text-xs text-muted-strong backdrop-blur-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {site.status.label}
            </span>
          </FadeIn>
        ) : null}

        <h1 className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
          <TextReveal text={site.name} className="block text-text" />
          <TextReveal
            text={`${site.headline.accent} ${site.headline.rest}`}
            className="text-gradient mt-2 block"
            delay={0.25}
          />
        </h1>

        <FadeIn delay={0.45} className="mt-8 max-w-xl">
          <p className="text-lg leading-relaxed text-muted text-pretty">{site.tagline}</p>
        </FadeIn>

        <FadeIn delay={0.55} className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-sm text-secondary">{site.title}</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-border-strong" />
          <span className="font-mono text-sm text-muted">{site.location}</span>
        </FadeIn>

        <FadeIn delay={0.6} className="mt-10 flex flex-wrap items-center gap-4">
          <MagneticButton
            href="#projects"
            className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-background transition-colors duration-200 hover:bg-secondary"
          >
            View my work
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 8h12M9 3l5 5-5 5" />
            </svg>
          </MagneticButton>

          <MagneticButton
            href={`mailto:${site.links.email}`}
            className="inline-flex h-12 items-center justify-center rounded-full border border-border-strong px-7 text-sm font-medium text-text transition-colors duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            Contact me
          </MagneticButton>
        </FadeIn>

        {/* tech stack row — the 21st.dev "tech stack badge" idea */}
        <FadeIn delay={0.75} className="mt-16">
          <p className="eyebrow mb-4">Stack</p>
          <ul className="flex flex-wrap gap-2">
            {techStack.map((tech) => (
              <li
                key={tech}
                className="rounded-full border border-border bg-surface/50 px-3 py-1 font-mono text-xs text-muted-strong transition-colors duration-200 hover:border-accent hover:text-text"
              >
                {tech}
              </li>
            ))}
          </ul>
        </FadeIn>
      </motion.div>
    </section>
  );
}
