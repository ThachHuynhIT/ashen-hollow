import { describe, expect, it } from 'vitest';
import { RUN } from '../data/run';
import { CONTENT } from '../game/cards/registry';
import { createPreviewRun, previewTargets, type PreviewTarget } from './previewRun';

describe('preview_targets_follow_data', () => {
  it('offers exactly the quest, council and boss years of RUN', () => {
    const targets = previewTargets();
    const years = (kind: PreviewTarget['kind']): number[] => targets.filter((t) => t.kind === kind).map((t) => t.year);
    expect(years('quest')).toEqual([...RUN.questYears]);
    expect(years('council')).toEqual([...RUN.councilYears]);
    expect(years('boss')).toEqual([...RUN.bossYears]);
    expect(targets).toHaveLength(RUN.questYears.length + RUN.councilYears.length + RUN.bossYears.length);
  });

  it('rejects a year the data does not list, 0, 31 and NaN', () => {
    for (const bad of [
      { kind: 'quest', year: 4 },
      { kind: 'council', year: 3 },
      { kind: 'boss', year: 9 },
      { kind: 'quest', year: 0 },
      { kind: 'boss', year: 31 },
      { kind: 'council', year: Number.NaN },
    ] as PreviewTarget[]) {
      expect(() => createPreviewRun(bad, CONTENT), JSON.stringify(bad)).toThrow();
    }
  });
});

describe('fixtures are real rule states, not claims of earlier wins', () => {
  it('a quest year opens the real quest offer', () => {
    for (const year of RUN.questYears) {
      const { state } = createPreviewRun({ kind: 'quest', year }, CONTENT);
      expect(state.year, `year ${year}`).toBe(year);
      expect(state.phase).toBe('quest');
      expect(state.offers?.kind).toBe('quest');
      expect(state.stats.battlesWon).toBe(0);
    }
  });

  it('a council year opens a council with three decrees to choose from', () => {
    for (const year of RUN.councilYears) {
      const { state } = createPreviewRun({ kind: 'council', year }, CONTENT);
      expect(state.year).toBe(year);
      expect(state.phase).toBe('council');
      expect(state.offers?.kind === 'council' && state.offers.decreeIds.length).toBe(3);
    }
  });

  it('a boss year is ready to fight: the boss is in the army, the card already played', () => {
    for (const year of RUN.bossYears) {
      const { state } = createPreviewRun({ kind: 'boss', year }, CONTENT);
      expect(state.year).toBe(year);
      expect(state.phase).toBe('planning');
      expect(state.played).toBe(true);
      expect(state.army?.boss).toBeDefined();
    }
  });

  it('every jump is a fresh independent run', () => {
    const a = createPreviewRun({ kind: 'quest', year: 3 }, CONTENT);
    const b = createPreviewRun({ kind: 'quest', year: 3 }, CONTENT);
    expect(a.state).toEqual(b.state);
    expect(a.state).not.toBe(b.state);
    expect(a.persistence).not.toBe(b.persistence);
  });
});
