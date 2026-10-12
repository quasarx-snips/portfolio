/**
 * Aurora — three blurred gradient meshes that drift on independent cycles.
 *
 * Pure CSS keyframes on transform/opacity only, so this costs nothing on the
 * main thread. Each blob is a radial-gradient div rather than an image, so
 * there is no extra network request and it scales to any viewport.
 */
export function Aurora() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="aurora-a absolute top-[-14rem] left-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,var(--primary)_0%,transparent_65%)] opacity-25 blur-3xl" />
      <div className="aurora-b absolute top-[6rem] right-[-12rem] h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,var(--accent)_0%,transparent_65%)] opacity-20 blur-3xl" />
      <div className="aurora-c absolute bottom-[-16rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,var(--secondary)_0%,transparent_65%)] opacity-15 blur-3xl" />
    </div>
  );
}

/**
 * Grain — a fixed film-texture overlay. Flat dark colour reads as "unstyled"
 * to the eye; a 3% noise layer makes it read as intentional. Pure CSS,
 * zero JS, and it never intercepts pointer events.
 */
export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="grain pointer-events-none fixed inset-0 z-[100] opacity-[0.035] mix-blend-overlay"
    />
  );
}
