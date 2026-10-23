/** Test helper: a factory that opens for real, then lets the test patch the fresh connection. */
export function patched(real: IDBFactory, patch: (db: IDBDatabase) => void): IDBFactory {
  return {
    open(name: string, version?: number) {
      const req = real.open(name, version);
      req.addEventListener('success', () => patch(req.result));
      return req;
    },
  } as unknown as IDBFactory;
}
