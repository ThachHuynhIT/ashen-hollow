import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { INCOMPATIBLE_RUN_TEXT, STORAGE_WARNING_TEXT } from '../data/save';
import { CONTENT } from '../game/cards/registry';
import { encodeRun } from '../game/save/codec';
import { runState } from '../game/testing/fixtures';
import { createSession } from './session';

describe('createSession', () => {
  it('loads nothing from a fresh browser', async () => {
    const s = await createSession(new IDBFactory(), () => undefined, CONTENT);
    expect(await s.load()).toEqual({ kind: 'empty' });
  });

  it('checkpoints a run and loads it back after a reload (a second session on the same disk)', async () => {
    const disk = new IDBFactory();
    const first = await createSession(disk, () => undefined, CONTENT);
    const state = runState();
    await first.persistence.checkpoint(state);
    const second = await createSession(disk, () => undefined, CONTENT);
    expect(await second.load()).toEqual({ kind: 'ok', state });
  });

  it('an unusable save is reported once, removed, and the profile is not touched', async () => {
    const disk = new IDBFactory();
    const s = await createSession(disk, () => undefined, CONTENT);
    await s.store.saveMeta({ crowns: 1 });
    await s.store.saveRun({ ...encodeRun(runState(), CONTENT), formatVersion: 9 } as never);
    expect(await s.load()).toEqual({ kind: 'incompatible', message: INCOMPATIBLE_RUN_TEXT });
    expect(await s.load()).toEqual({ kind: 'empty' });
    expect(await s.store.loadMeta()).toEqual({ crowns: 1 });
  });

  it('without IndexedDB the session still works in memory and warns once', async () => {
    const warnings: string[] = [];
    const s = await createSession(null, (t) => warnings.push(t), CONTENT);
    await s.persistence.checkpoint(runState());
    expect((await s.load()).kind).toBe('ok');
    expect(warnings).toEqual([STORAGE_WARNING_TEXT]);
  });
});
