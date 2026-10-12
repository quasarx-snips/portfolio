import Image from "next/image";
import { Aurora } from "@/components/aurora";
import { TiltCard } from "@/components/tilt-card";
import { FadeIn } from "@/components/motion-primitives";
import { MagneticButton } from "@/components/magnetic-button";
import { site } from "@/lib/site.config";

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1a2.6 2.6 0 0 1 .7-1.6c-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3 0 0 1-.4 3.3 1.2a11.5 11.5 0 0 1 6 0C17.1 4.8 18 5.2 18 5.2c.7 1.6.3 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05A4.2 4.2 0 0 1 17.5 8.7c3 0 3.5 1.9 3.5 4.5V21h-4v-6.3c0-1.5 0-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21h-4V9Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

function HashnodeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
      <path d="M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6Zm0 1.5a8.3 8.3 0 0 1 4.6 15.2V8.9a1.4 1.4 0 0 0-1.4-1.4h-6.4A1.4 1.4 0 0 0 7.4 8.9v10a8.3 8.3 0 0 1 4.6-15.2ZM8.9 9.6h6.2v9.3a8.3 8.3 0 0 1-6.2-9.3Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

const channels = [
  { label: "GitHub", value: "@quasarx-snips", href: site.links.github, Icon: GithubIcon },
  { label: "LinkedIn", value: "in/bibhab-saha", href: site.links.linkedin, Icon: LinkedinIcon },
  { label: "Hashnode", value: "@bibhab2209", href: site.links.hashnode, Icon: HashnodeIcon },
];

export function Contact() {
  return (
    <section id="contact" className="relative isolate scroll-mt-24 overflow-hidden px-6 py-28 sm:px-8 sm:py-36">
      {/* echo of the hero blob, so the page closes where it opened */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <Aurora />
        <Image
          src="/blob.svg"
          alt=""
          width={800}
          height={800}
          className="absolute bottom-[-24rem] left-1/2 h-[42rem] w-[42rem] max-w-none -translate-x-1/2 opacity-25 blur-3xl"
        />
      </div>

      <div className="mx-auto max-w-6xl">
        <FadeIn className="max-w-2xl">
          <p className="eyebrow mb-3">Contact</p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Let&apos;s build something
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted text-pretty">
            I&apos;m always up for talking about neural nets, data viz, or an interesting problem.
            Fastest way to reach me is email.
          </p>
        </FadeIn>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {channels.map(({ label, value, href, Icon }, i) => (
            <FadeIn key={label} delay={i * 0.08}>
              <TiltCard className="h-full">
              <a
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-surface p-6 transition-[transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-accent hover:bg-surface-raised hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)]"
              >
                <span className="text-primary transition-colors group-hover:text-secondary">
                  <Icon />
                </span>
                <span className="mt-auto">
                  <span className="block text-sm font-medium text-text">{label}</span>
                  <span className="mt-0.5 block font-mono text-xs break-all text-muted">{value}</span>
                </span>
              </a>
              </TiltCard>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3} className="mt-12 flex flex-wrap items-center gap-4">
          <MagneticButton
            href={`mailto:${site.links.email}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-background transition-colors duration-200 hover:bg-secondary"
          >
            <MailIcon />
            Send me an email
          </MagneticButton>

          <MagneticButton
            href={site.links.resume}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border-strong px-7 text-sm font-medium text-text transition-colors duration-200 hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            <FileIcon />
            Download résumé
          </MagneticButton>
        </FadeIn>
      </div>
    </section>
  );
}
