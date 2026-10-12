import { FadeIn } from "@/components/motion-primitives";
import { awards, site } from "@/lib/site.config";

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H5a2 2 0 0 0 2 4M17 6h2a2 2 0 0 1-2 4" />
      <path d="M12 14v3M9 21h6M10 17h4" />
    </svg>
  );
}

function MedalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="15" r="5" />
      <path d="m8.5 10.5 1.5-8 2 3 2-3 1.5 8" />
      <path d="m12 12.5 1 2 2-.6-1 1.9.8 1.9-2.2-.4-1.4 1.7" />
    </svg>
  );
}

/**
 * Awards — placed directly under the hero because this is the single most
 * persuasive thing on the page for a fresher. A recruiter who reads nothing
 * else still sees the win and the national-level selection.
 */
export function Awards() {
  return (
    <section id="awards" className="relative scroll-mt-24 px-6 pt-4 pb-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-5 md:grid-cols-2">
          {awards.map((award, i) => {
            const Icon = award.icon === "trophy" ? TrophyIcon : MedalIcon;
            return (
              <FadeIn key={award.title} delay={i * 0.12}>
                <div className="group relative flex h-full gap-5 overflow-hidden rounded-2xl border border-border-strong bg-surface p-6 transition-[transform,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:bg-surface-raised hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)] sm:p-7">
                  {/* warm glow behind the icon, only visible on hover */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-16 -left-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100 md:opacity-60"
                  />

                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary transition-colors duration-300 group-hover:border-primary group-hover:text-secondary">
                    <Icon />
                  </span>

                  <div className="relative">
                    <h3 className="text-lg font-semibold tracking-tight text-text">
                      {award.title}
                    </h3>
                    <p className="eyebrow mt-1.5 text-[0.7rem]">{award.org}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted text-pretty">
                      {award.detail}
                    </p>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* education strip */}
        <FadeIn delay={0.24}>
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text">{site.education.school}</p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {site.education.degree} · {site.education.location}
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {site.education.focus.map((area) => (
                <li
                  key={area}
                  className="rounded-md border border-border bg-background/40 px-2 py-0.5 font-mono text-[0.7rem] text-muted-strong"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
