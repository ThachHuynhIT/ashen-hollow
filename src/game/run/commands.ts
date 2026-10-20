/** Lệnh người chơi lên RunState (spec §5.1, §5.5). Thuần: làm việc trên bản sao, không sửa đầu vào. */
import { Rng } from '../../core/random';
import { RULES_G1 } from '../../data/rules';
import { RUN, battleGold, rerollCost, unlockCost } from '../../data/run';
import type { CardId } from '../../data/types';
import { CUSTOM_TOME_HANDLERS } from '../cards/custom';
import type { Content } from '../cards/registry';
import {
  adjacentToUnlocked,
  attachEnchant,
  checkPlay,
  levelUpBuilding,
  moveBuilding,
  placeBuilding,
  plotCol,
  plotRow,
  sacrificeBuilding,
  unlockPlot,
} from './board';
import { refillHand } from './deck';
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

const manhattan = (a: number, b: number): number =>
  Math.abs(plotCol(a) - plotCol(b)) + Math.abs(plotRow(a) - plotRow(b));

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
      const illegal = checkPlay(state.plots, card, cmd.target, content);
      if (illegal !== null) return fail(illegal);

      const target = cmd.target;
      if (card.kind === 'tome') {
        for (const action of card.actions) {
          switch (action.type) {
            case 'unlockPlot':
              if (target.kind !== 'plot') return fail('badTarget');
              state.plots = unlockPlot(state.plots, target.plot);
              break;
            case 'levelUp':
              if (target.kind !== 'plot') return fail('badTarget');
              state.plots = levelUpBuilding(state.plots, target.plot, action.amount);
              break;
            case 'move': {
              if (target.kind !== 'two') return fail('badTarget');
              state.plots = moveBuilding(state.plots, target.first, target.second);
              const far = manhattan(target.first, target.second) >= 2;
              if (far && action.levelIfFar > 0) {
                state.plots = levelUpBuilding(state.plots, target.second, action.levelIfFar);
              }
              break;
            }
            case 'sacrifice': {
              if (target.kind !== 'plot') return fail('badTarget');
              const level = state.plots[target.plot]!.building!.level;
              state.plots = sacrificeBuilding(state.plots, target.plot);
              const prize = action.goldPerLevel * level;
              state.gold += prize;
              state.stats.goldEarned += prize;
              break;
            }
            case 'custom': {
              const handler = CUSTOM_TOME_HANDLERS[action.id];
              if (!handler) return fail('badTarget');
              const out = handler(state, content, action.params ?? {}, target);
              if (typeof out === 'string') return fail(out);
              Object.assign(state, out);
              break;
            }
          }
        }
      } else if (target.kind !== 'plot') {
        return fail('badTarget');
      } else if (card.kind === 'enchantment') {
        state.plots = attachEnchant(state.plots, target.plot, card.id, RUN.maxEnchantStacks);
      } else {
        const here = state.plots[target.plot]!.building;
        if (here === null) {
          state.plots = placeBuilding(state.plots, target.plot, {
            uid: state.nextUid,
            cardId,
            level: 1,
            enchants: [],
            placedYear: state.year,
            permanent: {},
          });
          state.nextUid += 1;
        } else {
          state.plots = levelUpBuilding(state.plots, target.plot, 1);
        }
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
      state.gold += RUN.skipPlayGold;
      state.stats.goldEarned += RUN.skipPlayGold;
      return { state, events };
    }

    case 'reroll': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      if (state.played) return fail('alreadyPlayed');
      const cost = rerollCost(state.rerollsThisYear + 1);
      if (state.gold < cost) return fail('notEnoughGold');
      const rng = new Rng(state.rng.draw);
      const piles = refillHand([], state.drawPile, [...state.discardPile, ...state.hand], rng, RUN.handSize);
      state.hand = piles.hand;
      state.drawPile = piles.drawPile;
      state.discardPile = piles.discardPile;
      state.gold -= cost;
      state.rerollsThisYear += 1;
      state.rng.draw = rng.getState();
      return { state, events };
    }

    case 'unlockPlot': {
      if (state.phase !== 'planning') return fail('wrongPhase');
      const { plot } = cmd;
      if (!Number.isInteger(plot) || plot < 0 || plot >= state.plots.length) return fail('badTarget');
      if (state.plots[plot]!.unlocked) return fail('badTarget');
      if (!adjacentToUnlocked(state.plots, plot)) return fail('notAdjacent');
      const cost = unlockCost(state.purchasedPlots);
      if (state.gold < cost) return fail('notEnoughGold');
      state.plots = unlockPlot(state.plots, plot);
      state.gold -= cost;
      state.purchasedPlots += 1;
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
      if (result.won) {
        state.stats.battlesWon += 1;
        const prize = battleGold(state.year);
        state.gold += prize;
        state.stats.goldEarned += prize;
      }
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
      let gold = state.gold;
      let goldEarned = state.stats.goldEarned;
      if (index === null) {
        gold += RUN.skipRewardGold;
        goldEarned += RUN.skipRewardGold;
      } else {
        const picked = Number.isInteger(index) ? state.offers.cardIds[index] : undefined;
        if (picked === undefined) return fail('badTarget');
        deck = [...deck, picked];
        discardPile = [...discardPile, picked];
      }
      const stats = { ...state.stats, goldEarned };
      return { state: begin({ ...state, deck, discardPile, gold, stats }, content, events), events };
    }

    case 'advance':
      if (state.phase !== 'yearEnd') return fail('wrongPhase');
      return { state: begin(state, content, events), events };
  }
}
