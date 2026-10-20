import type { RunState } from '../../game/run/state';

/**
 * Whether the "Ra trận" button is shown: battles start by hand (G2 rules) and the year's
 * action is done, or there is nothing left in hand to act on. The button sits where the hand
 * is, so it must never appear while the player can still select, sell or reroll cards.
 */
export const canFight = (
  state: Pick<RunState, 'phase' | 'rules' | 'played' | 'hand'>,
): boolean =>
  state.phase === 'planning' &&
  !state.rules.autoStart &&
  (state.played || state.hand.length === 0);
