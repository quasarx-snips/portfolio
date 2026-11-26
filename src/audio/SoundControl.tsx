import { useEffect, useState } from 'react';
import { disable, enable, isEnabled, subscribeStatus } from './engine';
import '../styles/sound.css';

/**
 * The score's only control: one button, one choice.
 *
 * It shows the decision, not the browser's mood: `aria-pressed` is the
 * visitor's intent, and the dot only pulses when the context is actually
 * running, so a suspended context reads as "asked for, not yet allowed"
 * rather than as sound that silently is not there.
 */
export default function SoundControl() {
  const [on, setOn] = useState(isEnabled);
  const [live, setLive] = useState(false);

  useEffect(
    () =>
      subscribeStatus((status) => {
        setOn(status.enabled);
        setLive(status.running);
      }),
    [],
  );

  useEffect(() => {
    // A returning visitor keeps their choice; the context itself still waits
    // for the first gesture the engine can find.
    if (isEnabled()) void enable();
  }, []);

  return (
    <button
      className="sound-control"
      type="button"
      aria-pressed={on}
      data-live={live ? 'true' : 'false'}
      onClick={() => {
        if (on) disable();
        else void enable();
      }}
    >
      <span className="sound-control__dot" aria-hidden="true" />
      <span className="sound-control__label">Sound</span>
      <span className="sound-control__state" aria-hidden="true">
        {on ? 'on' : 'off'}
      </span>
    </button>
  );
}