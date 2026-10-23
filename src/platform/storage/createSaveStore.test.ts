import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { STORAGE_WARNING_TEXT } from '../../data/save';
import { CONTENT } from '../../game/cards/registry';
import { encodeRun } from '../../game/save/codec';
import { runState } from '../../game/testing/fixtures';
import { createSaveStore } from './createSaveStore';
import { patched } from './fakeFactory';
import { openIdbSaveStore } from './idbSaveStore';

const envelope = (gold = 10) => {
  const e = encodeRun(runState(), CONTENT);
  e.state.gold = gold;
  return e;
};

const setup = (factory: IDBFactory | null) => {
  const warnings: string[] = [];
  return { warnings, make: () => createSaveStore({ factory, onWarning: (t) => warnings.push(t) }) };
};

/** Every readwrite transaction fails once `failing.on` is set. */
const breakable = (real: IDBFactory) => {
  const failing = { on: false };
  const factory = patched(real, (db) => {
    const transaction = db.transaction.bind(db);
    db.transaction = ((name: string, mode?: IDBTransactionMode) => {
      if (failing.on && mode === 'readwrite') throw new DOMException('full', 'QuotaExceededError');
      return transaction(name, mode);
    }) as never;
  });
  return { factory, failing };
};

describe('createSaveStore', () => {
  it('uses the disk when it works and warns about nothing', async () => {
    const real = new IDBFactory();
    const { warnings, make } = setup(real);
    const store = await make();
    await store.saveRun(envelope(3));
    expect(warnings).toEqual([]);
    expect(await (await openIdbSaveStore(real)).loadRun()).toEqual(envelope(3));
  });

  it('a null factory falls back to memory with one warning, and still keeps the run', async () => {
    const { warnings, make } = setup(null);
    const store = await make();
    expect(warnings).toEqual([STORAGE_WARNING_TEXT]);
    await store.saveRun(envelope(4));
    await store.saveRun(envelope(5));
    expect(await store.loadRun()).toEqual(envelope(5));
    await store.clearRun();
    expect(await store.loadRun()).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it('open failure (SecurityError) falls back to memory with one warning', async () => {
    const factory = {
      open() {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as IDBFactory;
    const { warnings, make } = setup(factory);
    const store = await make();
    await store.saveRun(envelope(6));
    expect(await store.loadRun()).toEqual(envelope(6));
    expect(warnings).toEqual([STORAGE_WARNING_TEXT]);
  });

  it('memory_mirror: a failed disk write still loads back in the session, warns once, never retries the disk', async () => {
    const real = new IDBFactory();
    const { factory, failing } = breakable(real);
    const { warnings, make } = setup(factory);
    const store = await make();
    await store.saveRun(envelope(1));
    failing.on = true;
    await store.saveRun(envelope(2));
    await store.saveRun(envelope(3));
    expect(warnings).toEqual([STORAGE_WARNING_TEXT]);
    expect(await store.loadRun()).toEqual(envelope(3));
    failing.on = false;
    await store.saveRun(envelope(4));
    expect(await store.loadRun()).toEqual(envelope(4));
    expect(await (await openIdbSaveStore(real)).loadRun()).toEqual(envelope(1));
    expect(warnings).toHaveLength(1);
  });

  it('memory_mirror: a successful disk load refreshes the mirror used after a later failure', async () => {
    const real = new IDBFactory();
    await (await openIdbSaveStore(real)).saveRun(envelope(9));
    const { factory, failing } = breakable(real);
    const { make } = setup(factory);
    const store = await make();
    expect(await store.loadRun()).toEqual(envelope(9));
    failing.on = true;
    await store.clearRun();
    expect(await store.loadRun()).toBeNull();
  });

  it('meta is untouched when the run is cleared', async () => {
    const { make } = setup(new IDBFactory());
    const store = await make();
    await store.saveMeta({ crowns: 2 });
    await store.saveRun(envelope());
    await store.clearRun();
    expect(await store.loadMeta()).toEqual({ crowns: 2 });
  });
});
