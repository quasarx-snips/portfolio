"use client";

import { useEffect, useRef, useState } from "react";
import { skillGroups } from "@/lib/site.config";
import { Section } from "@/components/section";
import { FadeIn } from "@/components/motion-primitives";

/**
 * SkillBar — the fill width animates from 0 to `level` once the row scrolls
 * into view. Uses a CSS transition (not JS) for the width, so it stays cheap.
 */
function SkillBar({ name, level }: { name: string; level: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="group">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-text">{name}</span>
        <span className="font-mono text-xs text-muted">{level}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        role="meter"
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${name} proficiency`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: shown ? `${level}%` : "0%" }}
        />
      </div>
    </div>
  );
}

export function Skills() {
  return (
    <Section
      id="skills"
      eyebrow="Toolkit"
      title="What I work with"
      description="The stack behind the projects above — from low-level C to orbital mechanics to the web."
    >
      <div className="grid grid-cols-1 gap-x-12 gap-y-14 md:grid-cols-3">
        {skillGroups.map((group, i) => (
          <FadeIn key={group.label} delay={i * 0.1}>
            <h3 className="mb-7 border-b border-border-strong pb-3 font-mono text-xs tracking-[0.18em] text-primary uppercase">
              {group.label}
            </h3>
            <div className="space-y-6">
              {group.items.map((item) => (
                <SkillBar key={item.name} name={item.name} level={item.level} />
              ))}
            </div>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}
