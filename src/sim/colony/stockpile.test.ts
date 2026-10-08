import { describe, expect, it } from 'vitest';
import { Stockpile } from './stockpile';

describe('Stockpile', () => {
  it('starts from the given amounts and missing resources default to 0', () => {
    const s = new Stockpile({ wood: 5 });
    expect(s.snapshot()).toEqual({ wood: 5, stone: 0, food: 0 });
  });

  it('take never goes below zero and reports what it really took', () => {
    const s = new Stockpile({ wood: 7 });
    expect(s.take('wood', 10)).toBe(7);
    expect(s.get('wood')).toBe(0);
    expect(s.take('wood', 3)).toBe(0);
  });

  it('add and has', () => {
    const s = new Stockpile({});
    s.add('stone', 30);
    expect(s.has('stone', 30)).toBe(true);
    expect(s.has('stone', 31)).toBe(false);
  });

  it('rejects negative or fractional amounts', () => {
    const s = new Stockpile({});
    expect(() => s.add('wood', -1)).toThrow();
    expect(() => s.take('wood', 1.5)).toThrow();
  });
});
