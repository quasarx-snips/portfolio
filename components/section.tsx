import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion-primitives";

/**
 * Section — one shared shell so every section has identical spacing,
 * max-width, and heading rhythm. `id` is what the header links target.
 */
export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 px-6 py-24 sm:px-8 sm:py-32 ${className}`}>
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-4 text-base leading-relaxed text-muted text-pretty">{description}</p>
          ) : null}
        </FadeIn>
        {children}
      </div>
    </section>
  );
}

/** Hairline divider used between sections — matches the light-grey-divider intent. */
export function Divider() {
  return <div aria-hidden="true" className="mx-auto max-w-6xl px-6 sm:px-8"><div className="h-px w-full bg-border-strong" /></div>;
}
