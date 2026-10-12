"use client";

import { useEffect, useState } from "react";
import { nav, site } from "@/lib/site.config";

/**
 * Sticky header. Turns translucent + gains a hairline border once you scroll
 * past the hero. The scroll listener is passive so it never blocks scrolling.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        <a
          href="#top"
          className="font-mono text-sm font-semibold tracking-tight text-text transition-colors hover:text-primary"
        >
          {site.name}
          <span className="text-primary">.</span>
        </a>

        <nav aria-label="Main" className="hidden items-center gap-8 sm:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-text"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href={`mailto:${site.email}`}
          className="rounded-full border border-border-strong px-4 py-1.5 text-sm text-text transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
        >
          Get in touch
        </a>
      </div>
    </header>
  );
}
