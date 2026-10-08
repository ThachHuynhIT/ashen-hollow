import { describe, expect, it } from 'vitest';
import { SimClock, TICK_MS } from './SimClock';

describe('SimClock', () => {
  it('emits whole ticks and carries the remainder', () => {
    const clock = new SimClock();
    expect(clock.advance(TICK_MS * 0.6)).toBe(0);
    expect(clock.advance(TICK_MS * 0.6)).toBe(1);
    expect(clock.tick).toBe(1);
    expect(clock.alpha).toBeCloseTo(0.2);
  });

  it('scales with game speed', () => {
    const clock = new SimClock();
    clock.setSpeed(3);
    expect(clock.advance(TICK_MS * 2)).toBe(6);
  });

  it('does nothing while paused and resumes at the previous speed', () => {
    const clock = new SimClock();
    clock.setSpeed(2);
    clock.togglePause();
    expect(clock.paused).toBe(true);
    expect(clock.advance(TICK_MS * 10)).toBe(0);
    clock.togglePause();
    expect(clock.speed).toBe(2);
  });

  it('caps catch-up after a long stall', () => {
    const clock = new SimClock();
    expect(clock.advance(60_000)).toBe(12);
    expect(clock.alpha).toBe(0);
  });

  it('ignores negative deltas', () => {
    const clock = new SimClock();
    expect(clock.advance(-500)).toBe(0);
  });
});
