import { describe, expect, it } from 'vitest';
import { RULES_FULL } from '../../data/rules';
import type { KingId } from '../../data/types';
import { CONTENT } from '../../game/cards/registry';
import { fullCalendar } from '../realm/calendarModel';
import { calendarCellText } from './CalendarStrip';

const kings: KingId[] = ['grove', 'tide', 'forge', 'clock', 'moon', 'nomad'];
const cells = fullCalendar(RULES_FULL, kings);
const text = (year: number): string[] => calendarCellText(cells[year - 1]!, CONTENT);

describe('calendarCellText', () => {
  it('names the king and the attack number', () => {
    expect(text(3)).toEqual(['Năm 3', `${CONTENT.enemyKing('grove').nameVi} tấn công (lần 1/3).`, 'Đầu năm: có thể có nhiệm vụ.']);
  });

  it('names the boss', () => {
    expect(text(10)).toEqual(['Năm 10', 'Boss Ông Kẹ Đầm Lầy tấn công.', 'Sau trận: Hội Đồng Hoàng Gia.']);
    expect(text(30)[1]).toBe('Boss Vua Không Ngai tấn công.');
  });

  it('names both kings of a coalition', () => {
    const [head, line] = text(23);
    expect(head).toBe('Năm 23');
    expect(line).toBe(`Liên Quân ${CONTENT.enemyKing('grove').nameVi} + ${CONTENT.enemyKing('tide').nameVi} tấn công.`);
  });

  it('says raiders, and adds the council or quest lines only on their years', () => {
    expect(text(1)).toEqual(['Năm 1', 'Thổ Phỉ tấn công.']);
    expect(text(5)).toContain('Sau trận: Hội Đồng Hoàng Gia.');
    expect(text(7)).toContain('Đầu năm: có thể có nhiệm vụ.');
    expect(text(8)).not.toContain('Sau trận: Hội Đồng Hoàng Gia.');
  });
});
