import { describe, expect, it } from 'vitest';
import { Reservations } from './reservations';

describe('Reservations', () => {
  it('lets one colonist hold a target exclusively', () => {
    const r = new Reservations();
    expect(r.reserve(100, 1)).toBe(true);
    expect(r.reserve(100, 2)).toBe(false);
    expect(r.reserve(100, 1)).toBe(true); // re-reserving your own is fine
    expect(r.isFree(100)).toBe(false);
    expect(r.isFree(100, 1)).toBe(true);
    expect(r.holder(100)).toBe(1);
  });

  it('releases by target (only for the holder) and by colonist', () => {
    const r = new Reservations();
    r.reserve(100, 1);
    r.reserve(200, 1);
    r.release(100, 2); // not the holder: no effect
    expect(r.holder(100)).toBe(1);
    r.releaseColonist(1);
    expect(r.isFree(100)).toBe(true);
    expect(r.isFree(200)).toBe(true);
  });
});
