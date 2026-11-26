import { memo, type RefCallback } from 'react';
import { KIND_LABEL, silhouetteOf, type Room as RoomData } from './rooms';

interface RoomProps {
  room: RoomData;
  index: number;
  active: boolean;
  register: RefCallback<HTMLElement>;
}

/**
 * One room of the corridor.
 *
 * The hall — arch, columns, floor, the lit door and the altar — belongs to the
 * stage and never moves. A room is a pool of light and the copy it lights. That
 * division lets the architecture repeat without the rooms reading as slides.
 *
 * The element is never unmounted and never hidden from the document; the
 * corridor only fades and drifts it. Its transform is written imperatively by
 * `Corridor`, so it must not be passed back through React as a style.
 */
function RoomView({ room, index, active, register }: RoomProps) {
  const titleId = `room-${room.id}-title`;
  const silhouette = silhouetteOf(room);

  return (
    <article
      className="room"
      id={`room-${room.id}`}
      data-kind={room.kind}
      data-silhouette={silhouette}
      data-active={active ? 'true' : 'false'}
      ref={register}
      aria-labelledby={titleId}
    >
      <div className="room__spot" aria-hidden="true" />

      <div className="room__body">
        <p className="room__kicker">
          <span>{KIND_LABEL[room.kind]}</span>
          <span className="room__dot" aria-hidden="true" />
          <span>{room.year}</span>
        </p>
        <h3 className="room__title" id={titleId}>
          {room.title}
        </h3>
        <p className="room__line">{room.line}</p>
      </div>

      <p className="room__folio" aria-hidden="true">
        Room {String(index + 1).padStart(2, '0')}
      </p>
    </article>
  );
}

export default memo(RoomView);