import type { Hex } from '../hex';
import type { GameSpeed } from '../sim/SimClock';

/**
 * Typed event bus between the world (sim + render) and the UI layers.
 * Kept engine-free so React/Preact overlays can subscribe too.
 */
export interface GameEvents {
  'hex:hover': { hex: Hex | null };
  'hex:select': { hex: Hex | null };
  'camera:zoom': { zoom: number };
  'clock:speed': { speed: GameSpeed };
  'clock:tick': { tick: number };
  'ui:zoom-step': { direction: 1 | -1 };
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
  'ui:toggle-grid': Record<string, never>;
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

/** One bus per running game session; recreated when a new game starts. */
export const createGameBus = (): EventBus<GameEvents> => new EventBus<GameEvents>();
