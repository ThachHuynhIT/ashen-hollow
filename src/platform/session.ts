/** Phiên chơi của trình duyệt: kho lưu + cầu checkpoint + đọc ván. `src/game` không import file này. */
import type { Content } from '../game/cards/registry';
import { decodeRun } from '../game/save/codec';
import { SaveCoordinator } from '../game/save/SaveCoordinator';
import type { LoadRunResult, SaveStore, SessionPersistence } from '../game/save/types';
import { createSaveStore } from './storage/createSaveStore';

export interface GameSession {
  store: SaveStore;
  persistence: SessionPersistence;
  /** Đọc và kiểm ván đã lưu; ván không dùng được bị xoá (không đụng meta) trước khi trả kết quả. */
  load(): Promise<LoadRunResult>;
}

export async function createSession(
  factory: IDBFactory | null,
  onWarning: (text: string) => void,
  content: Content,
): Promise<GameSession> {
  const store = await createSaveStore({ factory, onWarning });
  return {
    store,
    persistence: new SaveCoordinator(store, content),
    async load() {
      const result = decodeRun(await store.loadRun(), content);
      if (result.kind === 'incompatible') await store.clearRun();
      return result;
    },
  };
}

/** The browser's IndexedDB, or null when it is missing or access is denied. */
export const browserIdbFactory = (): IDBFactory | null => {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB;
  } catch {
    return null;
  }
};
