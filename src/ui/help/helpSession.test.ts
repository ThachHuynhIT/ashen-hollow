import { describe, expect, it } from 'vitest';
import type { GameSpeed } from '../../core/SimClock';
import { closeHelpSession, openHelpSession, type HelpSession } from './helpSession';

const CLOSED: HelpSession = { open: false, restoreSpeed: null };

describe('help_session_preserves_zero', () => {
  it('restores each speed exactly, 0 (paused) and null (no battle) included', () => {
    for (const speed of [0, 1, 2, 3, null] as (GameSpeed | null)[]) {
      const open = openHelpSession(speed);
      expect(open.open).toBe(true);
      expect(closeHelpSession(open).speed).toBe(speed);
    }
  });

  it('opening twice never overwrites the remembered speed', () => {
    const first = openHelpSession(2);
    const second = openHelpSession(0, first); // the clock is already paused by the first open
    expect(closeHelpSession(second).speed).toBe(2);
  });

  it('closing a closed session answers null and stays closed', () => {
    expect(closeHelpSession(CLOSED)).toEqual({ speed: null });
  });
});
