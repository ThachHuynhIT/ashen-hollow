/** Kho lưu IndexedDB (spec §9.3). Chỉ thuần trình duyệt: `src/game` không import file này. */
import { SAVE_DB } from '../../data/save';
import type { SaveEnvelope, SaveStore } from '../../game/save/types';

const failure = (error: DOMException | null | undefined, fallback: string): Error =>
  error ?? new Error(fallback);

/** Mở cơ sở dữ liệu; từ chối ngay khi bị chặn hoặc lỗi (không hẹn giờ). */
const open = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(SAVE_DB.name, SAVE_DB.version);
    } catch (e) {
      reject(e instanceof Error ? e : new Error('indexeddb open failed'));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [SAVE_DB.runStore, SAVE_DB.metaStore]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(failure(request.error, 'indexeddb open failed'));
    request.onblocked = () => reject(new Error('indexeddb open blocked'));
  });

class IdbSaveStore implements SaveStore {
  constructor(private readonly db: IDBDatabase) {
    // Một tab khác nâng phiên bản hoặc trình duyệt đóng kết nối: đóng để không chặn họ.
    db.onversionchange = () => db.close();
  }

  /** Chạy một thao tác; xong khi giao dịch `complete`, không phải khi request `success`. */
  private run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let result: T;
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => reject(failure(request.error, 'indexeddb request failed'));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('indexeddb transaction failed'));
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure(tx.error, 'indexeddb transaction aborted'));
      tx.onerror = () => reject(failure(tx.error, 'indexeddb transaction failed'));
    });
  }

  async loadRun(): Promise<unknown> {
    return (await this.run(SAVE_DB.runStore, 'readonly', (s) => s.get(SAVE_DB.runKey))) ?? null;
  }

  async saveRun(save: SaveEnvelope): Promise<void> {
    await this.run(SAVE_DB.runStore, 'readwrite', (s) => s.put(save, SAVE_DB.runKey));
  }

  async clearRun(): Promise<void> {
    await this.run(SAVE_DB.runStore, 'readwrite', (s) => s.delete(SAVE_DB.runKey));
  }

  async loadMeta(): Promise<unknown> {
    return (await this.run(SAVE_DB.metaStore, 'readonly', (s) => s.get(SAVE_DB.metaKey))) ?? null;
  }

  async saveMeta(profile: unknown): Promise<void> {
    await this.run(SAVE_DB.metaStore, 'readwrite', (s) => s.put(profile, SAVE_DB.metaKey));
  }
}

export async function openIdbSaveStore(factory: IDBFactory): Promise<SaveStore> {
  return new IdbSaveStore(await open(factory));
}
