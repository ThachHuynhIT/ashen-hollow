import { SHORTCUTS, type ShortcutAction, type ShortcutContext } from '../../data/shortcuts';

/** Điều kiện của lúc bấm phím; scene tự tính từ trạng thái của nó. */
export interface ShortcutFlags {
  /** Modal Trợ giúp đang mở. */
  readonly helpOpen: boolean;
  /** Phần thưởng / hội đồng / nhiệm vụ đang chờ quyết định. */
  readonly mandatoryOpen: boolean;
  /** Bảng phụ (lịch, bộ bài, địch, sắc lệnh...) đang mở. */
  readonly sideModalOpen: boolean;
  /** Bảng tóm tắt cuối trận đang mở. */
  readonly summaryOpen: boolean;
  readonly repeat: boolean;
  /** Đang gõ trong ô nhập. */
  readonly editable: boolean;
  /** Ctrl / Alt / Meta đang giữ. */
  readonly modified: boolean;
}

const normalise = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

/**
 * Phím → hành động của ngữ cảnh, hoặc null. Trợ giúp đứng trước mọi thứ; khi Trợ giúp mở chỉ F1/H/Esc được nghe;
 * quyết định bắt buộc chỉ nghe `confirm`, bảng phụ chỉ nghe `cancel`. Scene vẫn tự giữ các guard trạng thái của nó.
 */
export const resolveShortcut = (
  key: string,
  context: ShortcutContext,
  flags: ShortcutFlags,
): ShortcutAction | null => {
  if (flags.repeat || flags.editable || flags.modified) return null;
  const k = normalise(key);
  const active: ShortcutContext = flags.helpOpen ? 'help' : context;
  const def = SHORTCUTS.filter(
    (d) =>
      d.contexts.includes(active) &&
      d.keys.some((x) => normalise(x) === k) &&
      (d.when === 'any' || (d.when === 'summary') === flags.summaryOpen),
  ).sort((a, b) => b.priority - a.priority)[0];
  if (!def) return null;
  if (def.action === 'help.toggle') return def.action;
  if (flags.helpOpen) return def.action === 'cancel' ? 'cancel' : null;
  if (flags.mandatoryOpen) return def.action === 'confirm' ? 'confirm' : null;
  if (flags.sideModalOpen) return def.action === 'cancel' ? 'cancel' : null;
  return def.action;
};

const keyName = (key: string): string => {
  if (key === ' ') return 'Space';
  if (key === 'Escape') return 'Esc';
  return key.length === 1 ? key.toUpperCase() : key;
};

/** Tên phím để hiện trên nút/tooltip, ví dụ "F1 / H"; rỗng nếu không có id. */
export const shortcutLabel = (id: string): string =>
  SHORTCUTS.find((d) => d.id === id)?.keys.map(keyName).join(' / ') ?? '';

const isEditable = (target: EventTarget | null): boolean =>
  typeof HTMLElement !== 'undefined' &&
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Điều kiện của một sự kiện phím; `state` là phần scene tự biết (modal nào đang mở). */
export const shortcutFlags = (
  event: KeyboardEvent,
  state: Partial<Pick<ShortcutFlags, 'helpOpen' | 'mandatoryOpen' | 'sideModalOpen' | 'summaryOpen'>> = {},
): ShortcutFlags => ({
  helpOpen: false,
  mandatoryOpen: false,
  sideModalOpen: false,
  summaryOpen: false,
  ...state,
  repeat: event.repeat,
  editable: isEditable(event.target),
  modified: event.ctrlKey || event.altKey || event.metaKey,
});
