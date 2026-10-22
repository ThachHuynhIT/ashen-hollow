import type { DecreeId, EffectDef } from './types';

/** Sắc lệnh hội đồng (spec §7.1). Mỗi sắc lệnh nhận tối đa 1 lần mỗi ván. */
export interface DecreeDef {
  readonly id: DecreeId;
  readonly nameVi: string;
  readonly textVi: string;
  /** Phần biểu diễn được bằng `EffectDef` (chỉ số toàn bàn cờ, vàng đầu năm). */
  readonly effects: readonly EffectDef[];
  /** Hiệu ứng tức thời cần luật riêng khi ban hành (G3a-A3); `none` = chỉ thường trực. */
  readonly action: 'none' | 'expand' | 'crown' | 'amnesty' | 'treasury' | 'academy' | 'purge' | 'runeFestival';
}

/** Các giá trị thường trực không phải `EffectDef` (spec §7.1, §7.4). */
export const DECREE_RULES = {
  hand: 4, // Bàn Tay Thứ Tư
  freeReroll: 1, // Phường Hội Thương Nhân: lần đổi bài miễn phí mỗi năm
  reward: 4, // Giao Thương: số thẻ thưởng
  boulderDmgPct: 50, // Đá Tảng Lớn: +% sát thương
  boulderRadius: 8, // Đá Tảng Lớn: +px bán kính
  cooldownPct: 30, // Phản Xạ Nhanh: −% hồi chiêu
  moatPct: 10, // Hào Nước: −% tốc địch
  cooldownCapPct: 60, // trần tổng giảm hồi chiêu Can Thiệp (§7.4)
} as const;

const board = (
  stat: 'hp' | 'dmg' | 'range' | 'unitCount',
  mode: 'flat' | 'pct',
  value: number,
  kinds: readonly ('troop' | 'tower' | 'throne')[],
): EffectDef => ({ type: 'stat', scope: 'board', filter: { kinds }, stat, mode, value });

export const DECREES: readonly DecreeDef[] = [
  {
    id: 'decree_harvest_tax',
    nameVi: 'Thuế Mùa Màng',
    textVi: 'Đầu năm +2 vàng.',
    effects: [{ type: 'gold', amount: 2 }],
    action: 'none',
  },
  {
    id: 'decree_expand_borders',
    nameVi: 'Mở Rộng Bờ Cõi',
    textVi: 'Mở ngay 2 ô khoá hợp lệ do bạn chọn (không tăng giá ô mua).',
    effects: [],
    action: 'expand',
  },
  {
    id: 'decree_mobilize',
    nameVi: 'Tổng Động Viên',
    textVi: 'Mọi công trình lính +1 lính.',
    effects: [board('unitCount', 'flat', 1, ['troop'])],
    action: 'none',
  },
  {
    id: 'decree_recast_crown',
    nameVi: 'Đúc Lại Vương Miện',
    textVi: 'Ngai +1 cấp.',
    effects: [],
    action: 'crown',
  },
  {
    id: 'decree_royal_armory',
    nameVi: 'Kho Vũ Khí Hoàng Gia',
    textVi: 'Mọi lính +10% sát thương.',
    effects: [board('dmg', 'pct', 10, ['troop'])],
    action: 'none',
  },
  {
    id: 'decree_new_armor',
    nameVi: 'Áo Giáp Mới',
    textVi: 'Mọi lính +15% máu.',
    effects: [board('hp', 'pct', 15, ['troop'])],
    action: 'none',
  },
  {
    id: 'decree_royal_archers',
    nameVi: 'Cung Thủ Hoàng Gia',
    textVi: 'Mọi tháp và Ngai +12 tầm.',
    effects: [board('range', 'flat', 12, ['tower', 'throne'])],
    action: 'none',
  },
  {
    id: 'decree_merchant_guild',
    nameVi: 'Phường Hội Thương Nhân',
    textVi: 'Thêm 1 lần đổi bài miễn phí mỗi năm.',
    effects: [],
    action: 'none',
  },
  {
    id: 'decree_fourth_hand',
    nameVi: 'Bàn Tay Thứ Tư',
    textVi: 'Rút 4 thẻ mỗi năm.',
    effects: [],
    action: 'none',
  },
  {
    id: 'decree_bigger_boulder',
    nameVi: 'Đá Tảng Lớn',
    textVi: 'Can Thiệp +50% sát thương, +8 bán kính.',
    effects: [],
    action: 'none',
  },
  {
    id: 'decree_quick_reflex',
    nameVi: 'Phản Xạ Nhanh',
    textVi: 'Hồi chiêu Can Thiệp −30%.',
    effects: [],
    action: 'none',
  },
  {
    id: 'decree_amnesty',
    nameVi: 'Lệnh Ân Xá',
    textVi: '+1 mạng (đã tối đa thì +10 vàng).',
    effects: [],
    action: 'amnesty',
  },
  {
    id: 'decree_treasury',
    nameVi: 'Ngân Khố',
    textVi: '+15 vàng ngay.',
    effects: [],
    action: 'treasury',
  },
  {
    id: 'decree_academy',
    nameVi: 'Học Viện Hoàng Gia',
    textVi: 'Chọn 1 trong 2 thẻ hiếm của vua mình, thêm vào bộ bài.',
    effects: [],
    action: 'academy',
  },
  {
    id: 'decree_purge',
    nameVi: 'Thanh Lọc',
    textVi: 'Loại tối đa 2 bản khỏi bộ bài (phải còn ít nhất 3 bản).',
    effects: [],
    action: 'purge',
  },
  {
    id: 'decree_trade',
    nameVi: 'Giao Thương',
    textVi: 'Thẻ thưởng có 4 lựa chọn.',
    effects: [],
    action: 'none',
  },
  {
    id: 'decree_rune_festival',
    nameVi: 'Lễ Hội Phù Chú',
    textVi: 'Mọi công trình có Bùa nhận +1 stack Bùa gắn đầu tiên.',
    effects: [],
    action: 'runeFestival',
  },
  {
    id: 'decree_moat',
    nameVi: 'Hào Nước',
    textVi: 'Mọi địch −10% tốc.',
    effects: [],
    action: 'none',
  },
];
