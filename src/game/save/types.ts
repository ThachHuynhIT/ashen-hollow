/** Kiểu của lớp lưu ván (spec §9.3). Thuần: không DOM, không Phaser; kho thật nằm ở `src/platform`. */
import type { RunState } from '../run/state';

/** Phong bì một ván đang chơi. `version` là phiên bản RunState; `contentHash` băm các id thẻ / đơn vị. */
export interface SaveEnvelope {
  formatVersion: 1;
  version: number;
  contentHash: number;
  state: RunState;
}

/** Kết quả đọc ván: có ván hợp lệ, không có ván, hoặc có nhưng không dùng được. */
export type LoadRunResult =
  | { kind: 'ok'; state: RunState }
  | { kind: 'empty' }
  | { kind: 'incompatible'; message: string };

/**
 * Kho lưu: ván đang chơi và hồ sơ meta (G4). `loadRun` trả dữ liệu thô — chỉ `decodeRun` mới được tin.
 * G3 không gọi các hàm meta; chúng có mặt để G4 không phải đổi giao diện.
 */
export interface SaveStore {
  loadRun(): Promise<unknown>;
  saveRun(save: SaveEnvelope): Promise<void>;
  clearRun(): Promise<void>;
  loadMeta(): Promise<unknown>;
  saveMeta(profile: unknown): Promise<void>;
}

/** Cầu nối từ RunController sang kho: lưu sau mỗi lệnh thành công, xếp hàng tuần tự. */
export interface SessionPersistence {
  /** Lưu ảnh chụp `state` (hoặc xoá ván nếu đã kết thúc); xong khi giao dịch thật sự hoàn tất. */
  checkpoint(state: RunState): Promise<void>;
  /** Chờ mọi ghi đang xếp hàng xong. */
  flush(): Promise<void>;
}
