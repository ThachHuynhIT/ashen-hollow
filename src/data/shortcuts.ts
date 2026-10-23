/** Bảng phím tắt duy nhất (G3e): scene, Help và README đều đọc từ đây. */
export type ShortcutAction =
  | 'help.toggle'
  | 'confirm'
  | 'cancel'
  | 'select.1'
  | 'select.2'
  | 'select.3'
  | 'select.4'
  | 'reroll'
  | 'sell'
  | 'deck'
  | 'calendar'
  | 'pause'
  | 'speed.1'
  | 'speed.2'
  | 'speed.3'
  | 'intervene'
  | 'newRun'
  | 'back';

export type ShortcutContext = 'menu' | 'kingSelect' | 'planning' | 'battle' | 'runEnd' | 'help';

export interface ShortcutDef {
  readonly id: string;
  readonly contexts: readonly ShortcutContext[];
  /** `KeyboardEvent.key`; chữ cái viết thường (chữ hoa được coi như nhau), phím đặc biệt đúng tên ('F1', 'Enter', ' '). */
  readonly keys: readonly string[];
  readonly labelVi: string;
  readonly action: ShortcutAction;
  /** Số lớn được xét trước khi trùng phím trong cùng ngữ cảnh. */
  readonly priority: number;
  /** `summary`: chỉ khi bảng tóm tắt cuối trận đang mở; `any`: luôn; mặc định (`free`) chỉ khi không có tóm tắt. */
  readonly when?: 'free' | 'summary' | 'any';
}

const ALL = ['menu', 'kingSelect', 'planning', 'battle', 'runEnd', 'help'] as const;

export const SHORTCUTS: readonly ShortcutDef[] = [
  { id: 'help', contexts: ALL, keys: ['F1', 'h'], labelVi: 'Mở / đóng Trợ giúp', action: 'help.toggle', priority: 100, when: 'any' },
  { id: 'help.close', contexts: ['help'], keys: ['Escape'], labelVi: 'Đóng Trợ giúp', action: 'cancel', priority: 90, when: 'any' },

  { id: 'king.1', contexts: ['kingSelect'], keys: ['1'], labelVi: 'Chọn vua 1', action: 'select.1', priority: 10 },
  { id: 'king.2', contexts: ['kingSelect'], keys: ['2'], labelVi: 'Chọn vua 2', action: 'select.2', priority: 10 },
  { id: 'king.3', contexts: ['kingSelect'], keys: ['3'], labelVi: 'Chọn vua 3', action: 'select.3', priority: 10 },
  { id: 'king.start', contexts: ['kingSelect'], keys: ['Enter'], labelVi: 'Bắt đầu ván', action: 'confirm', priority: 10 },
  { id: 'king.back', contexts: ['kingSelect'], keys: ['Escape'], labelVi: 'Về menu', action: 'back', priority: 10 },

  { id: 'plan.1', contexts: ['planning'], keys: ['1'], labelVi: 'Chọn thẻ 1', action: 'select.1', priority: 10 },
  { id: 'plan.2', contexts: ['planning'], keys: ['2'], labelVi: 'Chọn thẻ 2', action: 'select.2', priority: 10 },
  { id: 'plan.3', contexts: ['planning'], keys: ['3'], labelVi: 'Chọn thẻ 3', action: 'select.3', priority: 10 },
  { id: 'plan.4', contexts: ['planning'], keys: ['4'], labelVi: 'Chọn thẻ 4', action: 'select.4', priority: 10 },
  { id: 'plan.reroll', contexts: ['planning'], keys: ['r'], labelVi: 'Đổi bài', action: 'reroll', priority: 10 },
  { id: 'plan.sell', contexts: ['planning'], keys: ['s'], labelVi: 'Bán bài', action: 'sell', priority: 10 },
  { id: 'plan.deck', contexts: ['planning'], keys: ['d'], labelVi: 'Xem bộ bài', action: 'deck', priority: 10 },
  { id: 'plan.calendar', contexts: ['planning'], keys: ['l'], labelVi: 'Xem lịch', action: 'calendar', priority: 10 },
  { id: 'plan.confirm', contexts: ['planning'], keys: ['Enter'], labelVi: 'Xác nhận / ra trận', action: 'confirm', priority: 10 },
  { id: 'plan.cancel', contexts: ['planning'], keys: ['Escape'], labelVi: 'Huỷ chọn / đóng bảng', action: 'cancel', priority: 10 },

  { id: 'battle.pause', contexts: ['battle'], keys: ['p'], labelVi: 'Tạm dừng', action: 'pause', priority: 10 },
  { id: 'battle.speed1', contexts: ['battle'], keys: ['1'], labelVi: 'Tốc độ ×1', action: 'speed.1', priority: 10 },
  { id: 'battle.speed2', contexts: ['battle'], keys: ['2'], labelVi: 'Tốc độ ×2', action: 'speed.2', priority: 10 },
  { id: 'battle.speed3', contexts: ['battle'], keys: ['3'], labelVi: 'Tốc độ ×3', action: 'speed.3', priority: 10 },
  { id: 'battle.intervene', contexts: ['battle'], keys: [' ', 'b'], labelVi: 'Can thiệp (ngắm tảng đá)', action: 'intervene', priority: 10 },
  { id: 'battle.cancel', contexts: ['battle'], keys: ['Escape'], labelVi: 'Thôi ngắm / đóng bảng', action: 'cancel', priority: 10 },
  { id: 'battle.continue', contexts: ['battle'], keys: ['Enter', ' '], labelVi: 'Tiếp tục sau trận', action: 'confirm', priority: 10, when: 'summary' },

  { id: 'end.new', contexts: ['runEnd'], keys: ['Enter'], labelVi: 'Ván mới', action: 'newRun', priority: 10 },
  { id: 'end.menu', contexts: ['runEnd'], keys: ['Escape'], labelVi: 'Về menu', action: 'back', priority: 10 },
];
