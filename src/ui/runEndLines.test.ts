import { describe, expect, it } from 'vitest';
import { RULES_G2 } from '../data/rules';
import { runState } from '../game/testing/fixtures';
import { runEndLines } from './runEndLines';

const base = runState({ rules: RULES_G2, year: 9 });

describe('runEndLines', () => {
  it('lists the year reached out of the rules years, battles and kills', () => {
    const lines = runEndLines({
      ...base,
      stats: { ...base.stats, battlesWon: 6, battlesLost: 2, kills: 120 },
    });
    expect(lines).toContain('Năm đạt được: 9 / 15');
    expect(lines).toContain('Trận thắng: 6 · Trận thua: 2');
    expect(lines).toContain('Địch đã hạ: 120');
  });

  it('shows how many enemy kings were conquered and the gold earned', () => {
    const lines = runEndLines({
      ...base,
      stats: { ...base.stats, conquered: 1, goldEarned: 47 },
    });
    expect(lines).toContain('Vua đã chinh phục: 1 / 2');
    expect(lines).toContain('Vàng kiếm được: 47');
  });
});
