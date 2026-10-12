import { FadeIn } from "@/components/motion-primitives";
import { TiltCard } from "@/components/tilt-card";
import { Marquee } from "@/components/marquee";
import { projects, type Project } from "@/lib/site.config";
import { Section } from "@/components/section";

/** Small inline icon set — keeps the build dependency-free. */
function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7 0-.7 0-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1a2.6 2.6 0 0 1 .7-1.6c-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3 0 0 1-.4 3.3 1.2a11.5 11.5 0 0 1 6 0C17.1 4.8 18 5.2 18 5.2c.7 1.6.3 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const spanClass = project.span === "wide" ? "sm:col-span-2" : "";

  return (
    <FadeIn as="article" delay={index * 0.12} className={spanClass}>
      <TiltCard className="h-full">
      <div className="group relative flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition-[transform,box-shadow,background-color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-accent hover:bg-surface-raised hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.65)] sm:p-8">
        {project.featured ? (
          <span className="eyebrow mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[0.65rem]">
            Featured
          </span>
        ) : (
          <span className="mb-5 font-mono text-xs text-muted">
            0{index + 1}
          </span>
        )}

        <h3 className="text-xl font-semibold tracking-tight text-text">{project.title}</h3>

        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted text-pretty">
          {project.description}
        </p>

        {project.stat ? (
          <p className="mt-5 font-mono text-xs text-secondary">{project.stat}</p>
        ) : null}

        <ul className="mt-5 flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-md border border-border bg-background/40 px-2 py-0.5 font-mono text-[0.7rem] text-muted-strong"
            >
              {tag}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center gap-5 border-t border-border pt-5">
          <a
            href={project.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
          >
            <GithubIcon />
            Code
          </a>
          <a
            href={project.live}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
          >
            <ExternalIcon />
            Live
          </a>
        </div>
      </div>
      </TiltCard>
    </FadeIn>
  );
}

export function Projects() {
  return (
    <Section
      id="projects"
      eyebrow="Selected work"
      title="Things I've built"
      description="Three projects I'd actually want to talk about in an interview. Each one taught me something about maths, rendering, or both."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {projects.map((project, i) => (
          <ProjectCard key={project.title} project={project} index={i} />
        ))}
      </div>

      {/* infinite tech ticker under the grid */}
      <FadeIn delay={0.2} className="mt-16">
        <Marquee />
      </FadeIn>
    </Section>
  );
}
