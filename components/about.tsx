import { FadeIn } from "@/components/motion-primitives";
import { site } from "@/lib/site.config";
import { Section } from "@/components/section";

export function About() {
  return (
    <Section id="about" eyebrow="About" title={site.about.heading}>
      <div className="grid gap-12 md:grid-cols-[1.4fr_1fr] md:gap-16">
        <FadeIn className="space-y-6">
          {site.about.paragraphs.map((paragraph, i) => (
            <p key={i} className="text-lg leading-relaxed text-muted text-pretty">
              {paragraph}
            </p>
          ))}
        </FadeIn>

        <FadeIn delay={0.15}>
          <dl className="divide-y divide-border border-y border-border-strong">
            {[
              { label: "Focus", value: "Machine learning + interfaces" },
              { label: "Studying", value: "Math & Computer Science" },
              { label: "Location", value: "Remote / hybrid" },
              { label: "Status", value: site.status.label },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-6 py-4">
                <dt className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
                  {row.label}
                </dt>
                <dd className="text-right text-sm text-text">{row.value}</dd>
              </div>
            ))}
          </dl>
        </FadeIn>
      </div>
    </Section>
  );
}
