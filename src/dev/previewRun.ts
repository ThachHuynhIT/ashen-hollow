/**
 * DEV only: sample runs opened at a quest, council or boss year, for looking at those screens without playing
 * to them. Each is a NEW run built with the normal rules (never a fast-forward of a real run) and its own
 * in-memory save, so the real save and profile are never read or written. Not part of the production bundle.
 */
import { RULES_FULL } from '../data/rules';
import { RUN } from '../data/run';
import type { Content } from '../game/cards/registry';
import { MemorySaveStore } from '../game/save/MemorySaveStore';
import { SaveCoordinator } from '../game/save/SaveCoordinator';
import type { SessionPersistence } from '../game/save/types';
import type { RunState } from '../game/run/state';
import { rollCouncil } from '../game/run/council';
import { newRun, startYear } from '../game/run/yearFlow';

export interface PreviewTarget {
  kind: 'quest' | 'council' | 'boss';
  year: number;
}

const YEARS: Record<PreviewTarget['kind'], readonly number[]> = {
  quest: RUN.questYears,
  council: RUN.councilYears,
  boss: RUN.bossYears,
};

/** Every jump the panel offers, straight from the run data. */
export const previewTargets = (): readonly PreviewTarget[] =>
  (['quest', 'council', 'boss'] as const).flatMap((kind) => YEARS[kind].map((year) => ({ kind, year })));

const SEED = 1;

export const createPreviewRun = (
  target: PreviewTarget,
  content: Content,
): { state: RunState; persistence: SessionPersistence } => {
  if (!YEARS[target.kind]?.includes(target.year)) {
    throw new Error(`No ${target.kind} preview for year ${target.year}`);
  }
  const base = newRun(SEED, 'wheat', content, RULES_FULL);
  let state: RunState;
  if (target.kind === 'council') {
    state = rollCouncil({ ...base, year: target.year, phase: 'planning' });
  } else {
    // The normal start of the target year, from the year before it.
    state = startYear({ ...base, year: target.year - 1 }, content);
    if (target.kind === 'boss') state = { ...state, played: true };
  }
  return { state, persistence: new SaveCoordinator(new MemorySaveStore(), content) };
};
