import type { SaveEnvelope, SaveStore } from './types';

const copy = <T>(value: T): T => (value === null || value === undefined ? value : structuredClone(value));

/** Kho trong RAM: đọc và ghi đều sao chép sâu, nên sửa bản của người gọi không đổi dữ liệu đã lưu. */
export class MemorySaveStore implements SaveStore {
  private run: unknown = null;
  private meta: unknown = null;

  loadRun(): Promise<unknown> {
    return Promise.resolve(copy(this.run));
  }

  saveRun(save: SaveEnvelope): Promise<void> {
    this.run = copy(save);
    return Promise.resolve();
  }

  clearRun(): Promise<void> {
    this.run = null;
    return Promise.resolve();
  }

  loadMeta(): Promise<unknown> {
    return Promise.resolve(copy(this.meta));
  }

  saveMeta(profile: unknown): Promise<void> {
    this.meta = copy(profile);
    return Promise.resolve();
  }
}
