/**
 * Kho lưu của phiên chơi: IndexedDB nếu dùng được, nếu không (hoặc khi một lần ghi / đọc hỏng)
 * chuyển một chiều sang RAM kèm đúng một cảnh báo. Mọi ghi đều sao chép vào RAM trước, nên
 * checkpoint mới nhất vẫn đọc lại được trong phiên dù đĩa không ghi được.
 */
import { STORAGE_WARNING_TEXT } from '../../data/save';
import { MemorySaveStore } from '../../game/save/MemorySaveStore';
import type { SaveEnvelope, SaveStore } from '../../game/save/types';
import { openIdbSaveStore } from './idbSaveStore';

export interface SaveStoreOptions {
  factory: IDBFactory | null;
  onWarning: (text: string) => void;
}

export async function createSaveStore(options: SaveStoreOptions): Promise<SaveStore> {
  const mirror = new MemorySaveStore();
  let disk: SaveStore | null = null;
  let warned = false;

  const fallBack = (): void => {
    disk = null;
    if (warned) return;
    warned = true;
    options.onWarning(STORAGE_WARNING_TEXT);
  };

  if (options.factory) {
    try {
      disk = await openIdbSaveStore(options.factory);
    } catch {
      fallBack();
    }
  } else {
    fallBack();
  }

  /** Chạy trên đĩa nếu còn; lỗi thì bỏ đĩa và trả `undefined` để người gọi dùng bản RAM. */
  const onDisk = async <T>(op: (s: SaveStore) => Promise<T>): Promise<{ value: T } | null> => {
    if (!disk) return null;
    try {
      return { value: await op(disk) };
    } catch {
      fallBack();
      return null;
    }
  };

  return {
    async loadRun() {
      const r = await onDisk((s) => s.loadRun());
      if (!r) return mirror.loadRun();
      if (r.value === null) await mirror.clearRun();
      else await mirror.saveRun(r.value as SaveEnvelope);
      return mirror.loadRun();
    },
    async saveRun(save) {
      await mirror.saveRun(save);
      await onDisk((s) => s.saveRun(save));
    },
    async clearRun() {
      await mirror.clearRun();
      await onDisk((s) => s.clearRun());
    },
    async loadMeta() {
      const r = await onDisk((s) => s.loadMeta());
      if (!r) return mirror.loadMeta();
      await mirror.saveMeta(r.value);
      return mirror.loadMeta();
    },
    async saveMeta(profile) {
      await mirror.saveMeta(profile);
      await onDisk((s) => s.saveMeta(profile));
    },
  };
}
