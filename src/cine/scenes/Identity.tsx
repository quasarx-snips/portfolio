import { useLayoutEffect, useRef } from 'react';
import { clamp01 } from '../easing';
import { NAMES, SUBTITLE } from '../../content/opening';
import { useFilm } from '../film';


/**
 * The identity: one name, three scripts, one composition.
 *
 * Solo reveals and the final three-line arrangement are the same three elements
 * being re-slotted, so the change reads as the name settling rather than as
 * three unrelated cards swapping in and out.
 */
export default function Identity({ staticTrio = false }: { staticTrio?: boolean }) {
  const film = useFilm();
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);
  const nameRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (staticTrio) return;
    return film.subscribe((frame) => {
      const { identity } = frame;

      if (glowRef.current) {
        glowRef.current.style.opacity = (identity.glow * 0.8).toFixed(3);
        glowRef.current.style.transform = `translate(-50%, -50%) scale(${(0.86 + identity.glow * 0.22).toFixed(3)})`;
      }

      if (sweepRef.current) {
        const position = identity.sweep * 2 - 1;
        sweepRef.current.style.opacity = (
          Math.sin(Math.PI * clamp01(identity.sweep)) * 0.55
        ).toFixed(3);
        sweepRef.current.style.transform = `translateX(${(position * 130).toFixed(2)}%) rotate(-8deg)`;
      }

      for (const name of NAMES) {
        const element = nameRefs.current[name.script];
        const state = identity.names[name.script];
        if (!element || !state) continue;
        element.style.opacity = state.opacity.toFixed(3);
        element.style.filter = state.blur > 0.05 ? `blur(${state.blur.toFixed(2)}px)` : 'none';
        element.style.setProperty('--slot', state.slot.toFixed(4));
        element.style.setProperty('--scale', state.scale.toFixed(4));
      }

      if (subtitleRef.current) {
        subtitleRef.current.style.opacity = identity.subtitle.toFixed(3);
        subtitleRef.current.style.filter = `blur(${((1 - identity.subtitle) * 6).toFixed(2)}px)`;
        subtitleRef.current.style.transform = `translateX(-50%) translate3d(0, ${((1 - identity.subtitle) * 10).toFixed(2)}px, 0)`;
      }

      rootRef.current?.style.setProperty('--name-dissolve', identity.dissolve.toFixed(3));
    });
  }, [film, staticTrio]);

  return (
    <div
      className={`identity${staticTrio ? ' is-static' : ''}`}
      ref={rootRef}
      role="group"
      aria-label="The creator"
    >
      <div className="sr-only">
        <p lang="en">{NAMES[0].text}</p>
        <p lang="hi">{NAMES[1].text}</p>
        <p lang="bn">{NAMES[2].text}</p>
        <p>{SUBTITLE}</p>
      </div>

      <div className="identity-glow" ref={glowRef} aria-hidden="true" />
      <div className="identity-sweep" ref={sweepRef} aria-hidden="true" />
      <div className="identity-stage" aria-hidden="true">
        <div className="names">
          {NAMES.map((name) => (
            <p
              key={name.script}
              lang={name.lang}
              className={`name name-${name.script}`}
              ref={(element) => {
                nameRefs.current[name.script] = element;
              }}
            >
              {name.text}
            </p>
          ))}
        </div>
        <p className="identity-subtitle" ref={subtitleRef}>
          {SUBTITLE}
        </p>
      </div>
      <span className="sr-only" aria-live="off">
        Names shown: {NAMES.map((name) => name.text).join(', ')}.
      </span>
    </div>
  );
}
