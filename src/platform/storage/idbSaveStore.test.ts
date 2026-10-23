import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { SAVE_DB } from '../../data/save';
import { CONTENT } from '../../game/cards/registry';
import { encodeRun } from '../../game/save/codec';
import { runState } from '../../game/testing/fixtures';
import { patched } from './fakeFactory';
import { openIdbSaveStore } from './idbSaveStore';

const envelope = () => encodeRun(runState(), CONTENT);

/** Open with the raw API to see the real on-disk structure. */
const rawOpen = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const r = factory.open(SAVE_DB.name);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

describe('idbSaveStore', () => {
  it('creates database crowned-kingdoms v1 with stores run and meta', async () => {
    const factory = new IDBFactory();
    await openIdbSaveStore(factory);
    const db = await rawOpen(factory);
    expect(db.name).toBe('crowned-kingdoms');
    expect(db.version).toBe(1);
    expect([...db.objectStoreNames].sort()).toEqual(['meta', 'run']);
    db.close();
  });

  it('saves, loads and clears the run under key current', async () => {
    const factory = new IDBFactory();
    const store = await openIdbSaveStore(factory);
    expect(await store.loadRun()).toBeNull();
    const env = envelope();
    await store.saveRun(env);
    expect(await store.loadRun()).toEqual(env);
    const db = await rawOpen(factory);
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const r = db.transaction('run').objectStore('run').getAllKeys();
      r.onsuccess = () => resolve(r.result);
    });
    expect(keys).toEqual(['current']);
    db.close();
    await store.clearRun();
    expect(await store.loadRun()).toBeNull();
  });

  it('overwrites the previous checkpoint', async () => {
    const store = await openIdbSaveStore(new IDBFactory());
    const a = envelope();
    await store.saveRun(a);
    const b = envelope();
    b.state.gold = a.state.gold + 7;
    await store.saveRun(b);
    expect(await store.loadRun()).toEqual(b);
  });

  it('meta stays whole when the run is cleared, and survives reopening', async () => {
    const factory = new IDBFactory();
    const store = await openIdbSaveStore(factory);
    await store.saveMeta({ crowns: 5 });
    await store.saveRun(envelope());
    await store.clearRun();
    expect(await store.loadMeta()).toEqual({ crowns: 5 });
    const again = await openIdbSaveStore(factory);
    expect(await again.loadMeta()).toEqual({ crowns: 5 });
    expect(await again.loadRun()).toBeNull();
  });

  it('rejects at once when open throws (SecurityError)', async () => {
    const factory = {
      open() {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as IDBFactory;
    await expect(openIdbSaveStore(factory)).rejects.toThrow('denied');
  });

  it('rejects at once when open is blocked, without waiting for a timer', async () => {
    const factory = {
      open() {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => (req.onblocked as () => void)());
        return req;
      },
    } as unknown as IDBFactory;
    await expect(openIdbSaveStore(factory)).rejects.toThrow('blocked');
  });

  it('a put that fails (QuotaExceededError) rejects saveRun', async () => {
    const factory = patched(new IDBFactory(), (db) => {
      db.transaction = (() => {
        throw new DOMException('full', 'QuotaExceededError');
      }) as never;
    });
    const store = await openIdbSaveStore(factory);
    await expect(store.saveRun(envelope())).rejects.toThrow('full');
  });

  it('request success followed by an abort is not reported as saved', async () => {
    const real = new IDBFactory();
    const factory = patched(real, (db) => {
      const transaction = db.transaction.bind(db);
      db.transaction = ((name: string, mode?: IDBTransactionMode) => {
        const tx = transaction(name, mode);
        const objectStore = tx.objectStore.bind(tx);
        tx.objectStore = ((n: string) => {
          const s = objectStore(n);
          const put = s.put.bind(s);
          s.put = ((value: unknown, key?: IDBValidKey) => {
            const r = put(value, key);
            r.addEventListener('success', () => tx.abort());
            return r;
          }) as never;
          return s;
        }) as never;
        return tx;
      }) as never;
    });
    const store = await openIdbSaveStore(factory);
    await expect(store.saveRun(envelope())).rejects.toBeDefined();
    expect(await (await openIdbSaveStore(real)).loadRun()).toBeNull();
  });
});
