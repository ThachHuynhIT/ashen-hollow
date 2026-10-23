import { describe, expect, it } from 'vitest';
import type { GameSpeed } from '../../core/SimClock';
import { closeHelpSession, helpPauseSpeed, helpResumeSpeed, openHelpSession } from './helpSession';

/** What the HelpScene sends around a session, driven only by the pure rules. */
const run = (speed: GameSpeed | null): { sent: GameSpeed[] } => {
  const sent: GameSpeed[] = [];
  const open = openHelpSession(speed);
  const pause = helpPauseSpeed(open.restoreSpeed);
  if (pause !== null) sent.push(pause);
  const back = helpResumeSpeed(closeHelpSession(open).speed);
  if (back !== null) sent.push(back);
  return { sent };
};

describe('help_preserves_pending_and_speed', () => {
  it('a running battle is paused once and gets its exact speed back', () => {
    expect(run(1).sent).toEqual([0, 1]);
    expect(run(3).sent).toEqual([0, 3]);
  });

  it('an already paused battle is left alone, and a non-battle screen sends nothing', () => {
    expect(run(0).sent).toEqual([]);
    expect(run(null).sent).toEqual([]);
  });

  it('opening twice still returns the first speed', () => {
    const first = openHelpSession(2);
    const again = openHelpSession(0, first);
    expect(helpResumeSpeed(closeHelpSession(again).speed)).toBe(2);
  });
});
