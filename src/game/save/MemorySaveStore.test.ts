import { describe, expect, it } from 'vitest';
import { CONTENT } from '../cards/registry';
import { runState } from '../testing/fixtures';
import { encodeRun } from './codec';
import { MemorySaveStore } from './MemorySaveStore';

describe('MemorySaveStore', () => {
  it('starts empty', async () => {
    const store = new MemorySaveStore();
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toBeNull();
  });

  it('saves, loads and clears the run without touching the meta', async () => {
    const store = new MemorySaveStore();
    await store.saveMeta({ crowns: 3 });
    const env = encodeRun(runState(), CONTENT);
    await store.saveRun(env);
    expect(await store.loadRun()).toEqual(env);
    await store.clearRun();
    expect(await store.loadRun()).toBeNull();
    expect(await store.loadMeta()).toEqual({ crowns: 3 });
  });

  it('memory_clones: changing what was saved or what was loaded never changes the stored copy', async () => {
    const store = new MemorySaveStore();
    const env = encodeRun(runState(), CONTENT);
    await store.saveRun(env);
    env.state.gold = 12345;
    const first = (await store.loadRun()) as typeof env;
    expect(first.state.gold).not.toBe(12345);
    first.state.hand.length = 0;
    const second = (await store.loadRun()) as typeof env;
    expect(second.state.hand.length).toBeGreaterThan(0);
    const profile = { a: [1] };
    await store.saveMeta(profile);
    profile.a.push(2);
    expect(await store.loadMeta()).toEqual({ a: [1] });
  });
});
