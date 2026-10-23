import { describe, expect, it } from 'vitest';
import { HelpGate } from './helpGate';

describe('HelpGate', () => {
  it('opens once and refuses a second open until closed', () => {
    const g = new HelpGate();
    expect(g.isOpen).toBe(false);
    expect(g.open()).toBe(true);
    expect(g.isOpen).toBe(true);
    expect(g.open()).toBe(false);
    g.close();
    expect(g.isOpen).toBe(false);
    expect(g.open()).toBe(true);
  });

  it('close is idempotent', () => {
    const g = new HelpGate();
    g.close();
    g.close();
    expect(g.isOpen).toBe(false);
  });
});
