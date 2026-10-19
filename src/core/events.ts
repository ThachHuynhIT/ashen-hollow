import type { GameSpeed } from './SimClock';

/**
 * Typed event bus between game logic and the UI layers. Kept engine-free so it can be
 * unit-tested. G0 only keeps the events that do not depend on run/battle types; the rest
 * of spec §12.5 (`run:*`, `battle:*`, `ui:command`, …) is added with those types in G1.
 */
export interface GameEvents {
  'clock:speed': { speed: GameSpeed };
  /** A line for the toast stack. */
  log: { text: string };
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
}

type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) (handler as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** One bus per running game session; recreated when a new run starts. */
export const createGameBus = (): EventBus<GameEvents> => new EventBus<GameEvents>();
