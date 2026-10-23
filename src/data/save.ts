/** Cấu hình lưu ván (spec §9.3): IndexedDB và các chuỗi người chơi thấy. */

/** Phiên bản định dạng phong bì lưu; độc lập với `RUN_SAVE_VERSION` (phiên bản RunState). */
export const SAVE_FORMAT_VERSION = 1;

/** IndexedDB: một cơ sở dữ liệu, hai kho; phiên bản cơ sở dữ liệu độc lập với hai phiên bản trên. */
export const SAVE_DB = {
  name: 'crowned-kingdoms',
  version: 1,
  runStore: 'run',
  metaStore: 'meta',
  runKey: 'current',
  metaKey: 'profile',
} as const;

export const INCOMPATIBLE_RUN_TEXT = 'Ván đang chơi không còn tương thích với bản cập nhật này.';
export const STORAGE_WARNING_TEXT = 'Trình duyệt này không lưu được tiến trình.';
