/** Bot chơi ngẫu nhiên hợp lệ (spec §13.3): dùng cho headless/cân bằng, luôn sinh lệnh hợp lệ. */
import type { Rng } from '../../../core/random';
import type { Content } from '../../cards/registry';
import { checkPlay } from '../../run/board';
import type { PlayTarget, RunCommand, RunState } from '../../run/state';

export type Bot = (state: RunState, content: Content, rng: Rng) => RunCommand;

const PLOTS = 25;

export const randomBot: Bot = (state, content, rng) => {
  switch (state.phase) {
    case 'planning': {
      if (state.played) return { type: 'startBattle' };
      const options: RunCommand[] = [];
      state.hand.forEach((cardId, handIndex) => {
        const card = content.card(cardId);
        const targets: PlayTarget[] = [];
        if (card.kind === 'tome' && card.target === 'buildingThenPlot') {
          for (let first = 0; first < PLOTS; first++) {
            for (let second = 0; second < PLOTS; second++) {
              targets.push({ kind: 'two', first, second });
            }
          }
        } else {
          for (let plot = 0; plot < PLOTS; plot++) targets.push({ kind: 'plot', plot });
        }
        for (const target of targets) {
          if (checkPlay(state.plots, card, target) === null) {
            options.push({ type: 'play', handIndex, target });
          }
        }
      });
      return options.length === 0 ? { type: 'skip' } : rng.pick(options);
    }
    case 'reward': {
      const count = state.offers?.cardIds.length ?? 0;
      if (count === 0 || rng.int(0, 3) === 0) return { type: 'pickOffer', index: null };
      return { type: 'pickOffer', index: rng.int(0, count - 1) };
    }
    case 'yearEnd':
      return { type: 'advance' };
    default:
      throw new Error(`randomBot: no command in phase ${state.phase}`);
  }
};
