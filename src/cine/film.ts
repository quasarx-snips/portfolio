import { createContext, useContext } from 'react';
import { getFrame, type Frame } from './frame';

type Listener = (frame: Frame) => void;

/**
 * A tiny non-React store for the current film frame.
 *
 * Scroll updates arrive at display rate, so the canvas and the DOM write their
 * own styles imperatively instead of re-rendering React for every frame.
 */
export class Film {
  frame: Frame;
  private readonly listeners = new Set<Listener>();

  constructor(initialProgress = 0) {
    this.frame = getFrame(initialProgress);
  }

  set(progress: number): void {
    const next = getFrame(progress);
    if (Math.abs(next.p - this.frame.p) < 0.00005) return;
    this.frame = next;
    for (const listener of this.listeners) listener(next);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.frame);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const FilmContext = createContext<Film | null>(null);

export function useFilm(): Film {
  const film = useContext(FilmContext);
  if (!film) throw new Error('FilmContext is missing');
  return film;
}
