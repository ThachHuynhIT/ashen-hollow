import type { QuestId } from './types';

/** Nhiệm vụ (spec §7.2). `duration`: hạn N năm = phải xong trước khi hết năm `offeredYear + N − 1`. */
export interface QuestDef {
  readonly id: QuestId;
  readonly nameVi: string;
  readonly textVi: string;
  readonly duration: number;
  readonly rewardTextVi: string;
  /** Vàng phải trả ngay khi nhận (chỉ Đặt Cược). */
  readonly acceptGold: number;
}

/** Ngưỡng và phần thưởng của từng nhiệm vụ (spec §7.2). */
export const QUEST_RULES = {
  untouchedGold: 6,
  barracks: 3, // công trình lính cùng lúc
  rareChoices: 3, // thẻ hiếm để chọn
  noRerollGold: 8,
  kills: 100,
  stacks: 2, // tổng stack Bùa trên một công trình
  doubleRuneFullGold: 4,
  opened: 2, // ô mở thêm
  landGrabGold: 10,
  level: 4, // cấp công trình
  blitzTicks: 300,
  blitzGold: 5,
  hoardGold: 20,
  hoardReward: 5,
  noHelpDmgPct: 20,
  offeringBase: 4,
  diversityGold: 8,
  wagerFee: 5,
  wagerWins: 2,
  wagerGold: 15,
  promoteCard: 'neutral_promote',
  diversityKinds: ['troop', 'tower', 'economy', 'support'],
} as const;

export const QUESTS: readonly QuestDef[] = [
  {
    id: 'quest_untouched',
    nameVi: 'Ngai Vô Sự',
    textVi: 'Thắng một trận mà Ngai không mất máu.',
    duration: 1,
    rewardTextVi: '+6 vàng',
    acceptGold: 0,
  },
  {
    id: 'quest_three_barracks',
    nameVi: 'Ba Doanh Trại',
    textVi: 'Có ít nhất 3 công trình lính cùng lúc.',
    duration: 3,
    rewardTextVi: 'Chọn 1 trong 3 thẻ hiếm',
    acceptGold: 0,
  },
  {
    id: 'quest_no_reroll',
    nameVi: 'Tiết Kiệm',
    textVi: 'Không đổi bài lần nào trong suốt hạn.',
    duration: 3,
    rewardTextVi: '+8 vàng',
    acceptGold: 0,
  },
  {
    id: 'quest_slaughter',
    nameVi: 'Đại Thắng',
    textVi: 'Hạ ít nhất 100 địch trong một trận.',
    duration: 3,
    rewardTextVi: '+1 thẻ Thăng Cấp vào bộ bài',
    acceptGold: 0,
  },
  {
    id: 'quest_double_rune',
    nameVi: 'Bùa Chồng Bùa',
    textVi: 'Một công trình có tổng ít nhất 2 stack Bùa.',
    duration: 2,
    rewardTextVi: 'Công trình đó +1 stack Bùa gắn đầu tiên (hết chỗ thì +4 vàng)',
    acceptGold: 0,
  },
  {
    id: 'quest_land_grab',
    nameVi: 'Khai Phá',
    textVi: 'Mở thêm 2 ô (bằng mọi cách) trong hạn.',
    duration: 3,
    rewardTextVi: '+10 vàng',
    acceptGold: 0,
  },
  {
    id: 'quest_master_builder',
    nameVi: 'Thợ Cả',
    textVi: 'Có công trình cấp 4 trở lên.',
    duration: 4,
    rewardTextVi: '+1 cấp cho công trình cấp thấp nhất (không phải Ngai)',
    acceptGold: 0,
  },
  {
    id: 'quest_blitz',
    nameVi: 'Chớp Nhoáng',
    textVi: 'Thắng một trận trong không quá 300 tick.',
    duration: 2,
    rewardTextVi: '+5 vàng',
    acceptGold: 0,
  },
  {
    id: 'quest_hoard',
    nameVi: 'Kho Đầy',
    textVi: 'Kết thúc một năm với ít nhất 20 vàng.',
    duration: 3,
    rewardTextVi: '+5 vàng',
    acceptGold: 0,
  },
  {
    id: 'quest_no_help',
    nameVi: 'Tự Lực',
    textVi: 'Thắng một trận mà không dùng Can Thiệp.',
    duration: 2,
    rewardTextVi: 'Can Thiệp +20% sát thương vĩnh viễn',
    acceptGold: 0,
  },
  {
    id: 'quest_offering',
    nameVi: 'Lễ Vật',
    textVi: 'Chơi một thẻ hiến tế.',
    duration: 3,
    rewardTextVi: '+4 vàng, thêm +1 vàng mỗi cấp của công trình bị hiến',
    acceptGold: 0,
  },
  {
    id: 'quest_diversity',
    nameVi: 'Trăm Nghề',
    textVi: 'Có cùng lúc đủ 4 loại công trình: lính, tháp, kinh tế, hỗ trợ.',
    duration: 3,
    rewardTextVi: '+1 mạng (đủ mạng thì +8 vàng)',
    acceptGold: 0,
  },
  {
    id: 'quest_wager',
    nameVi: 'Đặt Cược',
    textVi: 'Trả 5 vàng khi nhận; thắng 2 trận liên tiếp ngay sau đó.',
    duration: 2,
    rewardTextVi: '+15 vàng',
    acceptGold: 5,
  },
];
