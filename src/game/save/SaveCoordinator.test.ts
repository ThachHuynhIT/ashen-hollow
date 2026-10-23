import { describe, expect, it } from 'vitest';
import { CONTENT } from '../cards/registry';
import type { RunState } from '../run/state';
import { runState } from '../testing/fixtures';
import { MemorySaveStore } from './MemorySaveStore';
import { SaveCoordinator } from './SaveCoordinator';
import type { SaveEnvelope, SaveStore } from './types';

/** A store whose writes finish only when the test says so; it logs when each one starts and ends. */
class DeferredStore implements SaveStore {
  log: string[] = [];
  private releases: (() => void)[] = [];
  private readonly inner = new MemorySaveStore();
  fail = false;

  private gate(label: string): Promise<void> {
    this.log.push(`start ${label}`);
    return new Promise<void>((resolve, reject) => {
      this.releases.push(() => {
        this.log.push(`end ${label}`);
        if (this.fail) reject(new Error('disk'));
        else resolve();
      });
    });
  }
  release(): void {
    this.releases.shift()?.();
  }
  async saveRun(save: SaveEnvelope): Promise<void> {
    await this.gate(`save ${save.state.gold}`);
    await this.inner.saveRun(save);
  }
  async clearRun(): Promise<void> {
    await this.gate('clear');
    await this.inner.clearRun();
  }
  loadRun = () => this.inner.loadRun();
  loadMeta = () => this.inner.loadMeta();
  saveMeta = (p: unknown) => this.inner.saveMeta(p);
}

const withGold = (gold: number, over: Partial<RunState> = {}): RunState => ({ ...runState(), gold, ...over });
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('SaveCoordinator', () => {
  it('stores a snapshot: later changes to the state do not reach what is written', async () => {
    const store = new MemorySaveStore();
    const c = new SaveCoordinator(store, CONTENT);
    const s = withGold(5);
    const done = c.checkpoint(s);
    s.gold = 99;
    await done;
    expect(((await store.loadRun()) as SaveEnvelope).state.gold).toBe(5);
  });

  it('writes A, B, ended as A, B, clear in order even when A is slow', async () => {
    const store = new DeferredStore();
    const c = new SaveCoordinator(store, CONTENT);
    const a = c.checkpoint(withGold(1));
    const b = c.checkpoint(withGold(2));
    const end = c.checkpoint(withGold(3, { phase: 'ended', offers: null }));
    await tick();
    expect(store.log).toEqual(['start save 1']); // B waits for A
    store.release();
    await tick();
    expect(store.log).toEqual(['start save 1', 'end save 1', 'start save 2']);
    store.release();
    await tick();
    store.release();
    await Promise.all([a, b, end]);
    expect(store.log).toEqual(['start save 1', 'end save 1', 'start save 2', 'end save 2', 'start clear', 'end clear']);
    expect(await store.loadRun()).toBeNull();
  });

  it('an ended run clears the save and writes nothing', async () => {
    const store = new MemorySaveStore();
    const c = new SaveCoordinator(store, CONTENT);
    await c.checkpoint(withGold(1));
    expect(await store.loadRun()).not.toBeNull();
    await c.checkpoint(withGold(1, { phase: 'ended', offers: null }));
    expect(await store.loadRun()).toBeNull();
  });

  it('flush waits for every queued write', async () => {
    const store = new DeferredStore();
    const c = new SaveCoordinator(store, CONTENT);
    void c.checkpoint(withGold(1));
    void c.checkpoint(withGold(2));
    let flushed = false;
    void c.flush().then(() => (flushed = true));
    await tick();
    expect(flushed).toBe(false);
    store.release();
    await tick();
    store.release();
    await tick();
    expect(flushed).toBe(true);
  });

  it('a failed write rejects its own checkpoint but does not block the next', async () => {
    const store = new DeferredStore();
    const c = new SaveCoordinator(store, CONTENT);
    store.fail = true;
    const a = c.checkpoint(withGold(1));
    const failed = expect(a).rejects.toThrow('disk');
    const b = c.checkpoint(withGold(2));
    await tick();
    store.release();
    await failed;
    store.fail = false;
    await tick();
    store.release();
    await b;
    expect(((await store.loadRun()) as SaveEnvelope).state.gold).toBe(2);
  });
});
