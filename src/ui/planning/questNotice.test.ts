import { describe, expect, it } from 'vitest';
import { RULES_FULL, RULES_G2 } from '../../data/rules';
import { QUESTS } from '../../data/quests';
import { RUN } from '../../data/run';
import type { QuestId } from '../../data/types';
import { runState } from '../../game/testing/fixtures';
import type { QuestState, RunState } from '../../game/run/state';
import { questCalendarLabel, questNotice } from './questNotice';

const full = (over: Partial<RunState> = {}): RunState => runState({ rules: RULES_FULL, ...over });
const active = (n: number): QuestState[] =>
  Array.from({ length: n }, (_, i) => ({
    id: QUESTS[i]!.id,
    status: 'active',
    deadlineYear: 9,
  })) as unknown as QuestState[];

describe('scheduled_not_guaranteed', () => {
  it('the year before each quest year says the messenger may come, with a condition', () => {
    for (const y of RUN.questYears) {
      const n = questNotice(full({ year: y - 1 }));
      expect(n.nextYear, `year ${y - 1}`).toBe(y);
      expect(n.headline).toContain('Sứ giả');
      expect(n.detail).toContain('có thể');
      expect(n.detail).toContain(String(RUN.maxActiveQuests));
      expect(n.blocked).toBe(false);
    }
  });

  it('while the messenger waits it says so, and after the answer points at the next quest year', () => {
    const waiting = questNotice(full({ year: 3, phase: 'quest' }));
    expect(waiting.headline).toBe('Sứ giả đang chờ');
    const after = questNotice(full({ year: 3, phase: 'planning' }));
    expect(after.nextYear).toBe(7);
  });

  it('after the last quest year there is no next year and never a year 31', () => {
    const last = RUN.questYears[RUN.questYears.length - 1]!;
    const n = questNotice(full({ year: last, phase: 'planning' }));
    expect(n.nextYear).toBeNull();
    expect(JSON.stringify(n)).not.toContain('31');
  });

  it('reads the schedule from RUN, not from a copied list', () => {
    expect(questCalendarLabel(RUN.questYears[0]!)).toBe('Sứ giả');
    expect(questCalendarLabel(RUN.questYears[0]! + 1)).toBeNull();
  });
});

describe('two_active_explains_absence', () => {
  it('a full quest log says why no messenger is expected', () => {
    const n = questNotice(full({ year: 6, quests: active(RUN.maxActiveQuests) }));
    expect(n.blocked).toBe(true);
    expect(n.headline).toBe(`Đã đủ ${RUN.maxActiveQuests} nhiệm vụ`);
    expect(n.active).toBe(RUN.maxActiveQuests);
    expect(n.capacity).toBe(RUN.maxActiveQuests);
    expect(n.detail).not.toMatch(/sẽ đề nghị/);
  });

  it('an exhausted quest pool says there is no new quest left', () => {
    const n = questNotice(full({ year: 6, offeredQuestIds: QUESTS.map((q) => q.id) as QuestId[] }));
    expect(n.headline).toContain('Không còn nhiệm vụ mới');
  });

  it('a short or G1 game shows no messenger notice', () => {
    for (const rules of [RULES_G2]) {
      const n = questNotice(runState({ rules, year: 2 }));
      expect(n.headline).toBe('');
      expect(n.nextYear).toBeNull();
    }
  });

  it('counts only active quests, not done or failed ones', () => {
    const mix = [...active(1), { id: QUESTS[5]!.id, status: 'done', deadlineYear: 4 }] as unknown as QuestState[];
    expect(questNotice(full({ year: 6, quests: mix })).active).toBe(1);
  });

  it('does not change the state it reads', () => {
    const s = full({ year: 6 });
    const copy = structuredClone(s);
    questNotice(s);
    expect(s).toEqual(copy);
  });
});
