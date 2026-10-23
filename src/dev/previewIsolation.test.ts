import { describe, expect, it } from 'vitest';
import { CONTENT } from '../game/cards/registry';
import { RunController } from '../game/run/RunController';
import { createGameBus } from '../game/events';
import { MemorySaveStore } from '../game/save/MemorySaveStore';
import { SaveCoordinator } from '../game/save/SaveCoordinator';
import { runState } from '../game/testing/fixtures';
import { createPreviewRun } from './previewRun';
import previewRunSource from './previewRun.ts?raw';
import registerSource from './registerPreview.ts?raw';

/** A store that records every call so the test can say none reached it. */
class SpyStore extends MemorySaveStore {
  calls: string[] = [];
  override saveRun(save: Parameters<MemorySaveStore['saveRun']>[0]): Promise<void> {
    this.calls.push('saveRun');
    return super.saveRun(save);
  }
  override clearRun(): Promise<void> {
    this.calls.push('clearRun');
    return super.clearRun();
  }
  override saveMeta(profile: unknown): Promise<void> {
    this.calls.push('saveMeta');
    return super.saveMeta(profile);
  }
  override loadRun(): Promise<unknown> {
    this.calls.push('loadRun');
    return super.loadRun();
  }
  override loadMeta(): Promise<unknown> {
    this.calls.push('loadMeta');
    return super.loadMeta();
  }
}

describe('preview_cannot_touch_real_store', () => {
  it('playing, ending and leaving a sandbox never calls the real store', async () => {
    const real = new SpyStore();
    const realPersistence = new SaveCoordinator(real, CONTENT);
    await realPersistence.checkpoint(runState({ year: 4 }));
    await real.saveMeta({ sentinel: 1 });
    real.calls.length = 0;
    const before = JSON.stringify(await real.loadRun());
    real.calls.length = 0;

    for (let i = 0; i < 10; i++) {
      const { state, persistence } = createPreviewRun({ kind: 'boss', year: 10 }, CONTENT);
      const bus = createGameBus();
      const controller = new RunController(bus, CONTENT, state, persistence);
      await controller.checkpointInitial();
      bus.emit('ui:command', { command: { type: 'startBattle' } });
      await controller.whenIdle();
      controller.dispose();
    }
    expect(real.calls).toEqual([]);
    expect(JSON.stringify(await real.loadRun())).toBe(before);
  });

  it('the sandbox code never reaches for the real session, the IndexedDB code or the meta', () => {
    for (const source of [previewRunSource, registerSource]) {
      expect(source).not.toMatch(/getSession|createSession|setSession|idbSaveStore|createSaveStore|saveMeta|clearRun/);
    }
  });
});
