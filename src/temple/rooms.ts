/**
 * The rooms of the Palace.
 *
 * Each room is one folio entry: a project, a research thread, a note, or the
 * threshold. The corridor's architecture repeats; only these contents change,
 * which is why the data is deliberately small and copy is never generated.
 *
 * PLACEHOLDER CONTENT — every title, year, line and link is a stand-in until
 * the owner supplies the real folio. Nothing here claims a client, a metric or
 * a result. Replacing this array is the only edit needed to change the rooms.
 */

export type RoomKind = 'project' | 'research' | 'note' | 'contact';

export type RoomSilhouette = 'plinth' | 'shelf' | 'stele' | 'portal';

export interface RoomLink {
  label: string;
  href: string;
  /** External links open in a new tab and are announced as such. */
  external?: boolean;
}

export interface RoomMedia {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}

export interface Room {
  /** Stable id, also the deep link (`#room-<id>`). */
  id: string;
  kind: RoomKind;
  title: string;
  year: string;
  /** One sentence, shown in the corridor. Keep it under ~90 characters. */
  line: string;
  /** Paragraphs shown only inside the room. */
  body?: string[];
  links?: RoomLink[];
  media?: RoomMedia;
  silhouette?: RoomSilhouette;
}

export const KIND_LABEL: Record<RoomKind, string> = {
  project: 'Project',
  research: 'Research',
  note: 'Note',
  contact: 'Contact',
};

const DEFAULT_SILHOUETTE: Record<RoomKind, RoomSilhouette> = {
  project: 'plinth',
  research: 'shelf',
  note: 'stele',
  contact: 'portal',
};

export function silhouetteOf(room: Room): RoomSilhouette {
  return room.silhouette ?? DEFAULT_SILHOUETTE[room.kind];
}

export const ROOMS: readonly Room[] = [
  {
    id: 'first-room',
    kind: 'project',
    title: 'The First Room',
    year: '2026',
    line: 'A door that opens only once the world behind you has gone quiet.',
  },
  {
    id: 'paper-lanterns',
    kind: 'note',
    title: 'Notes on Paper Lanterns',
    year: '2025',
    line: 'What a room remembers after the light is taken out of it.',
  },
  {
    id: 'quiet-machines',
    kind: 'project',
    title: 'Quiet Machines',
    year: '2025',
    line: 'Interfaces that wait, and the patience a good pause asks for.',
  },
  {
    id: 'inventory-of-light',
    kind: 'research',
    title: 'An Inventory of Light',
    year: '2024',
    line: 'Counting the small decisions that make a space feel inhabited.',
  },
  {
    id: 'long-corridor',
    kind: 'note',
    title: 'The Long Corridor',
    year: '2024',
    line: 'On repetition, orientation, and how a hall teaches you to walk.',
  },
  {
    id: 'letters-to-the-future',
    kind: 'project',
    title: 'Letters to the Future',
    year: '2024',
    line: 'Correspondence between a maker and the machine that helps them.',
  },
  {
    id: 'map-room',
    kind: 'research',
    title: 'The Map Room',
    year: '2023',
    line: 'Every index is an argument about what deserves to be found.',
  },
  {
    id: 'threshold',
    kind: 'contact',
    title: 'The Threshold',
    year: 'Now',
    line: 'The hall continues past this room. Write to the keeper of the house.',
  },
];

export function roomIndex(id: string): number {
  return ROOMS.findIndex((room) => room.id === id);
}
