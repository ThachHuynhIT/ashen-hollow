import type { Content } from '../cards/registry';
import type { RunState } from '../run/state';
import { encodeRun } from './codec';
import type { SaveStore, SessionPersistence } from './types';

/**
 * Xếp hàng các lần ghi checkpoint theo đúng thứ tự gọi (FIFO): lệnh A rồi B luôn lưu A rồi B dù A chậm.
 * Ván đã kết thúc không được lưu mà xoá ván đang lưu, cũng đi qua cùng hàng đợi.
 */
export class SaveCoordinator implements SessionPersistence {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: SaveStore,
    private readonly content: Content,
  ) {}

  checkpoint(state: RunState): Promise<void> {
    // Phong bì được dựng ngay lúc gọi: lệnh sau không đổi được thứ sắp ghi.
    const job: () => Promise<void> =
      state.phase === 'ended'
        ? () => this.store.clearRun()
        : ((envelope) => () => this.store.saveRun(envelope))(encodeRun(state, this.content));
    const run = this.tail.then(job);
    this.tail = run.catch(() => undefined); // một lần ghi hỏng không làm kẹt hàng đợi
    return run;
  }

  flush(): Promise<void> {
    return this.tail;
  }
}
