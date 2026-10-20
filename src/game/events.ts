/** Bản đồ sự kiện giữa logic game và UI/scene (spec §12.5). Bus chung nằm ở `core/events`. */
import { EventBus } from '../core/events';
import type { GameSpeed } from '../core/SimClock';
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
  'ui:confirm-play': Record<string, never>;
  'ui:cancel-play': Record<string, never>;
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
  'ui:intervene': { x: number; y: number };
  'ui:continue': Record<string, never>;
  /** A tap on the realm: the plot with a building under it (null = none), at screen (x, y). */
  'ui:inspect': { plot: number | null; x: number; y: number };
  'ui:open-modal': { modal: 'scout' };
  'ui:close-modal': Record<string, never>;
}

/** One bus per running game session; recreated when a new run starts. */
export const createGameBus = (): EventBus<GameEvents> => new EventBus<GameEvents>();
