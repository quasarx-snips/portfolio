import type { Ref } from 'react';
import { KIND_LABEL, type RoomKind } from './rooms';

interface CorridorHudProps {
  index: number;
  total: number;
  kind: RoomKind;
  barRef: Ref<HTMLSpanElement>;
}

/**
 * The diegetic index of the corridor: which room you are in, what it holds,
 * and how far the hall has taken you. It is the only element that keeps the
 * visitor oriented while the architecture repeats.
 */
export default function CorridorHud({ index, total, kind, barRef }: CorridorHudProps) {
  const number = String(index + 1).padStart(2, '0');
  const count = String(total).padStart(2, '0');

  return (
    <>
      <div className="corridor-progress" aria-hidden="true">
        <span ref={barRef} />
      </div>
      <div className="corridor-hud">
        <p className="corridor-hud__count">
          <span className="corridor-hud__num">{number}</span>
          <span className="corridor-hud__of">/ {count}</span>
        </p>
        <p className="corridor-hud__kind">{KIND_LABEL[kind]}</p>
      </div>
    </>
  );
}
