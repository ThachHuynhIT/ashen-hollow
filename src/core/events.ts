import type { BuildingId } from '../data/buildings';
import type { DesignationKind } from '../data/doodads';
import type { ResourceId } from '../data/resources';
import type { PlacementProblem } from '../sim/placement';
import type { GameSpeed } from '../sim/SimClock';

/**
 * Typed event bus between the world (sim + render) and the UI layers.
 * Kept engine-free so React/Preact overlays can subscribe too.
 */
export interface GameEvents {
  /** World position under the mouse (null when it left the map / touch device). */
  'cursor:move': { x: number; y: number } | null;
  'entity:select': { eid: number | null };
  'camera:zoom': { zoom: number };
  'clock:speed': { speed: GameSpeed };
  'clock:tick': { tick: number };
  /** Build mode changed: which building is being placed (null = left build mode). */
  'build:mode': { kind: BuildingId | null; snap: boolean };
  /** Live placement feedback for the ghost; `pending` = touch ghost awaiting confirm. */
  'build:status': { ok: boolean; reason: PlacementProblem | null; pending: boolean };
  'build:placed': { kind: BuildingId; eid: number };
  'stock:changed': { stock: Record<ResourceId, number> };
  /** A line for the event log ("… đã chết vì đói."). */
  log: { text: string };
  'ui:zoom-step': { direction: 1 | -1 };
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
  'ui:build': { kind: BuildingId | null };
  'ui:toggle-snap': Record<string, never>;
  'ui:build-confirm': Record<string, never>;
  'ui:build-cancel': Record<string, never>;
  'ui:tool': { tool: OrderTool | null };
  'tool:changed': { tool: OrderTool | null };
  'ui:focus-colonist': { eid: number };
}

/** Map tools that aren't buildings: harvest designations, clearing them, walls. */
export type OrderTool = DesignationKind | 'clear' | 'wall';

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
