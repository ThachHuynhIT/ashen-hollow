/** Lệnh người chơi lên RunState (spec §5.1, §5.5). Thuần: làm việc trên bản sao, không sửa đầu vào. */
import { Rng } from '../../core/random';
import { RULES_G1 } from '../../data/run';
import type { CardId } from '../../data/types';
import type { Content } from '../cards/registry';
import { checkPlay, moveBuilding, placeBuilding, unlockPlot } from './board';
import { hasPlayableCard } from './playable';
import { rollOffers } from './rewards';
import type { IllegalReason, RunCommand, RunState } from './state';
import { startYear } from './yearFlow';

export type RunEvent =
  | { type: 'cardPlayed'; cardId: CardId }
  | { type: 'yearStarted'; year: number }
  | { type: 'battleEnded'; won: boolean }
  | { type: 'runEnded'; won: boolean };

export type CommandResult = { state: RunState; events: RunEvent[] } | { error: IllegalReason };

const fail = (error: IllegalReason): CommandResult => ({ error });

function begin(state: RunState, content: Content, events: RunEvent[]): RunState {
  const next = startYear(state, content);
  events.push({ type: 'yearStarted', year: next.year });
  return next;
}

export function applyCommand(input: RunState, cmd: RunCommand, content: Content): CommandResult {
  const state = structuredClone(input);
  const events: RunEvent[] = [];

  switch (cmd.type) {
    case 'play': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (state.played) return fail('alreadyPlayed');
      const cardId = state.hand[cmd.handIndex];
      if (!Number.isInteger(cmd.handIndex) || cardId === undefined) return fail('badTarget');
      const card = content.card(cardId);
      const illegal = checkPlay(state.plots, card, cmd.target);
      if (illegal !== null) return fail(illegal);

      if (card.kind === 'tome') {
        if (cmd.target.kind === 'plot' && card.id === 'neutral_clear_land') {
          state.plots = unlockPlot(state.plots, cmd.target.plot);
        } else if (cmd.target.kind === 'two' && card.id === 'neutral_move') {
          state.plots = moveBuilding(state.plots, cmd.target.first, cmd.target.second);
        } else {
          return fail('badTarget');
        }
      } else if (cmd.target.kind === 'plot') {
        state.plots = placeBuilding(state.plots, cmd.target.plot, {
          uid: state.nextUid,
          cardId,
          level: 1,
          placedYear: state.year,
        });
        state.nextUid += 1;
      } else {
        return fail('badTarget');
      }
      state.hand.splice(cmd.handIndex, 1);
      state.discardPile.push(cardId);
      state.played = true;
      events.push({ type: 'cardPlayed', cardId });
      return { state, events };
    }

    case 'discard': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (state.played) return fail('alreadyPlayed');
      const { handIndex } = cmd;
      const sold = Number.isInteger(handIndex) ? state.hand[handIndex] : undefined;
      if (sold === undefined) return fail('badTarget');
      state.hand.splice(handIndex, 1);
      state.discardPile.push(sold);
      state.played = true;
      return { state, events };
    }

    case 'setAutoFire':
      if (state.phase === 'ended') return fail('wrongPhase');
      state.autoFire = cmd.on;
      return { state, events };

    case 'startBattle':
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (!state.played && hasPlayableCard(state, content)) return fail('notPlayed');
      state.phase = 'battle';
      return { state, events };

    case 'battleResult': {
      if (state.phase !== 'battle') return fail('wrongPhase');
      const { result } = cmd;
      state.stats.kills += result.kills;
      events.push({ type: 'battleEnded', won: result.won });
      if (result.won) state.stats.battlesWon += 1;
      else {
        state.stats.battlesLost += 1;
        state.lives -= 1;
      }

      const finalYear = state.year >= RULES_G1.years;
      if (state.lives <= 0 || finalYear) {
        // §3.10: sau trận năm cuối, còn mạng thì thắng ván (thắng hay thua trận đều vậy).
        state.lives = Math.max(state.lives, 0);
        state.phase = 'ended';
        state.won = state.lives > 0;
        state.offers = null;
        events.push({ type: 'runEnded', won: state.won });
      } else if (result.won) {
        const rng = new Rng(state.rng.reward);
        const cardIds = rollOffers(rng, state.year, {
          king: content.king(state.kingId).cards,
          neutral: content.neutralPool(),
        });
        state.rng.reward = rng.getState();
        state.offers = { kind: 'reward', cardIds };
        state.phase = 'reward';
      } else {
        state.offers = null;
        state.phase = 'yearEnd';
      }
      return { state, events };
    }

    case 'pickOffer': {
      if (state.phase !== 'reward' || state.offers === null) return fail('wrongPhase');
      const { index } = cmd;
      let { deck, discardPile } = state;
      if (index !== null) {
        const picked = Number.isInteger(index) ? state.offers.cardIds[index] : undefined;
        if (picked === undefined) return fail('badTarget');
        deck = [...deck, picked];
        discardPile = [...discardPile, picked];
      }
      return { state: begin({ ...state, deck, discardPile }, content, events), events };
    }

    case 'advance':
      if (state.phase !== 'yearEnd') return fail('wrongPhase');
      return { state: begin(state, content, events), events };
  }
}
