import { techStack } from "@/lib/site.config";

/**
 * Marquee — an infinite horizontal ticker for the tech stack.
 *
 * The trick: render the list twice inside a track and translate it by exactly
 * -50%. When the first copy has fully exited, the second is in its place, so
 * the loop is seamless with no JS and no scroll listener.
 *
 * The duplicate is aria-hidden so screen readers only hear the list once.
 * Pauses on hover via CSS. Disabled entirely under prefers-reduced-motion,
 * where it becomes a static centred row.
 */
export function Marquee() {
  const items = [...techStack];

  return (
    <div
      aria-hidden="true"
      className="marquee relative flex w-full overflow-hidden border-y border-border-strong py-5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
    >
      <div className="marquee-track flex w-max shrink-0 items-center gap-10 pr-10">
        {items.map((tech, i) => (
          <span key={`a-${tech}-${i}`} className="flex items-center gap-10">
            <span className="font-mono text-sm tracking-wide text-muted-strong whitespace-nowrap">
              {tech}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" />
          </span>
        ))}
      </div>
      {/* second copy — makes the -50% loop seamless */}
      <div className="marquee-track flex w-max shrink-0 items-center gap-10 pr-10">
        {items.map((tech, i) => (
          <span key={`b-${tech}-${i}`} className="flex items-center gap-10">
            <span className="font-mono text-sm tracking-wide text-muted-strong whitespace-nowrap">
              {tech}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-primary/60" />
          </span>
        ))}
      </div>
    </div>
  );
}
