/** Bản đồ sự kiện giữa logic game và UI/scene (spec §12.5). Bus chung nằm ở `core/events`. */
import { EventBus } from '../core/events';
import type { GameSpeed } from '../core/SimClock';
import type { HelpTab } from '../data/help';
import type { BattleResult, BattleSetup } from './battle/types';
import type { IllegalReason, RunCommand, RunState } from './run/state';

export interface GameEvents {
  'clock:speed': { speed: GameSpeed };
  /** A line for the toast stack. */
  log: { text: string };
  'run:state': { state: RunState };
  'run:illegal': { reason: IllegalReason };
  'run:ended': { won: boolean; crownPoints: number; unlocks: string[] };
  'battle:started': { setup: BattleSetup };
  'battle:tick': { tick: number };
  'battle:ended': { result: BattleResult };
  'ui:command': { command: RunCommand };
  'ui:select-card': { handIndex: number | null };
  'ui:pending-play': { handIndex: number | null; targets: number[]; ready: boolean };
  /** A hand card dropped on a plot: select it, aim at the plot and play it if that is all it needs. */
  'ui:drop-card': { handIndex: number; plot: number };
  /** A locked plot picked for purchase (null = none); ✓ buys it, ✕ drops it. */
  'ui:pending-buy': { plot: number | null; price: number };
  'ui:confirm-play': Record<string, never>;
  'ui:cancel-play': Record<string, never>;
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
  'ui:intervene': { x: number; y: number };
  'ui:continue': Record<string, never>;
  /** A tap on the realm: the plot with a building under it (null = none), at screen (x, y). */
  'ui:inspect': { plot: number | null; x: number; y: number };
  /**
   * What the range rings should follow: a plot with a building or a live battle entity, as the chosen
   * thing or just hovered (hover wins while it lasts); null clears that mode.
   */
  'ui:range-selection': {
    target: { kind: 'plot'; plot: number } | { kind: 'entity'; id: number } | null;
    mode: 'selected' | 'hover';
  };
  /** Ask the Help view to open (or close); handled by the Help scene wiring (G3e E4d). */
  'ui:help': { open: boolean; tab?: HelpTab };
  'ui:open-modal': { modal: 'scout' | 'calendar' | 'deck' };
  'ui:close-modal': Record<string, never>;
}

/** One bus per running game session; recreated when a new run starts. */
export const createGameBus = (): EventBus<GameEvents> => new EventBus<GameEvents>();
