import { site } from "@/lib/site.config";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="font-mono text-xs text-muted">
          © 2026 {site.name}. Built with Next.js + Tailwind.
        </p>
        <div className="flex items-center gap-6">
          <a
            href={site.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted transition-colors hover:text-primary"
          >
            GitHub
          </a>
          <a
            href={site.links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted transition-colors hover:text-primary"
          >
            LinkedIn
          </a>
          <a
            href={`mailto:${site.email}`}
            className="text-xs text-muted transition-colors hover:text-primary"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}
