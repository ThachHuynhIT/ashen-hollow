/** Mục "Cơ chế" của Trợ giúp: chữ tiếng Việt, mọi con số đọc từ data/luật (không gõ lại). */
import { TICKS_PER_SECOND } from '../../core/SimClock';
import { BATTLE } from '../../data/battle';
import { BOSS_RULES } from '../../data/bosses';
import { DECREE_RULES } from '../../data/decrees';
import { QUEST_RULES } from '../../data/quests';
import { RUN, REWARD, battleGold, rerollCost } from '../../data/run';
import type { BossId } from '../../data/types';
import type { Content } from '../../game/cards/registry';
import type { HelpEntry } from './helpModel';

const entry = (id: string, title: string, lines: readonly string[]): HelpEntry => ({
  id,
  title,
  lines,
  frame: null,
});

const seconds = (ticks: number): number => Math.round((ticks / TICKS_PER_SECOND) * 10) / 10;

/** Các dòng mô tả kỹ năng của một boss, số lấy từ `BOSS_RULES`. */
export const bossSkillLines = (id: BossId): readonly string[] => {
  if (id === 'boss_bog_ogre') {
    const r = BOSS_RULES.bog;
    return [
      `Ném Bùn: mỗi ${r.mudEveryTicks} tick ném vào mục tiêu trong ${r.mudRange} px, gây ${r.mudDmg} sát thương vật lý và vô hiệu tháp ${seconds(r.mudDisableTicks)} giây.`,
      `Gọi Ếch: lần đầu máu xuống dưới ${r.frogBelowHpPct}%, gọi ${r.frogCount} con ếch.`,
    ];
  }
  if (id === 'boss_hornet_queen') {
    const r = BOSS_RULES.hornet;
    return [
      `Đàn Ong: mỗi ${r.swarmEveryTicks} tick thả ${r.swarmCount} con ong.`,
      `Hạ Cánh: mỗi ${r.landEveryTicks} tick đáp xuống ${seconds(r.landTicks)} giây, lúc đó nhận thêm ${r.landDmgTakenPct}% sát thương.`,
    ];
  }
  const r = BOSS_RULES.crownless;
  return [
    `Bóng Gương: khi máu trên ${r.mirrorAbovePct}%, mỗi ${r.mirrorEveryTicks} tick tạo một bóng.`,
    `Khiên Ngai Vỡ: khi máu từ ${r.shieldAbovePct}% đến ${r.shieldBelowPct}%, nhận khiên ${r.shield} trong ${seconds(r.shieldWindowTicks)} giây.`,
    `Cuồng Vương: dưới ${r.rageBelowPct}% máu, +${r.rageSpeedPct}% tốc và +${r.rageAttackSpeedPct}% tốc đánh. Tảng đá Can Thiệp gây ×${r.boulderMult} sát thương.`,
  ];
};

export const mechanicEntries = (content: Content): readonly HelpEntry[] => {
  const kings = content.enemyKings().length;
  const lastYear = RUN.bossYears[RUN.bossYears.length - 1]!;
  const rerolls = [1, 2, 3].map(rerollCost).join(', ');
  return [
    entry('year', 'Một năm', [
      `Mỗi năm bạn rút ${RUN.handSize} thẻ và chơi một thẻ lên bàn cờ 5×5 (hoặc bán thẻ lấy ${RUN.skipPlayGold} vàng), rồi quân bạn tự đánh một trận.`,
      `Đầu năm ${RUN.questYears.join(', ')} có thể có sứ giả đề nghị nhiệm vụ; sau trận bạn nhận thưởng hoặc chinh phục, và năm ${RUN.councilYears.join(', ')} có hội đồng.`,
      `Ván đầy đủ dài ${lastYear} năm; sống qua năm cuối là thắng, hết mạng là thua.`,
    ]),
    entry('gold', 'Vàng', [
      `Bạn bắt đầu với ${RUN.startGold} vàng và nhận ${RUN.taxPerYear} vàng mỗi năm.`,
      `Thắng trận được ${battleGold(1)} vàng ở năm 1 và ${battleGold(lastYear)} vàng ở năm ${lastYear}; trận boss nhân ${RUN.bossGoldMult}.`,
      `Đổi bài: lần 1, 2, 3 trong năm tốn ${rerolls} vàng (cứ tăng gấp đôi).`,
      `Bỏ qua thẻ thưởng được ${RUN.skipRewardGold} vàng; chinh phục một vua được ${RUN.conquestGold} vàng.`,
      `Sắc lệnh Phường Hội Thương Nhân cho thêm ${DECREE_RULES.freeReroll} lần đổi miễn phí mỗi năm.`,
    ]),
    entry('levels', 'Cấp, Bùa và lân cận', [
      `Công trình lên tối đa cấp ${RUN.maxLevel}; cấp càng cao càng mạnh (xem số liệu ở bảng thông tin).`,
      `Bùa gắn vào công trình, chồng tối đa ${RUN.maxEnchantStacks} lần.`,
      'Nhiều thẻ có hiệu ứng "lân cận": chỉ tác dụng lên các ô kề sát công trình.',
    ]),
    entry('conquest', 'Chinh phục', [
      `Mỗi vua địch có 3 lần tấn công theo lịch. Thắng lần thứ 3, bạn chinh phục vua đó: chọn một thẻ của họ cho bộ bài và nhận ${RUN.conquestGold} vàng (có ${kings} vua).`,
    ]),
    entry('banners', 'Liên Quân và cờ hiệu', [
      'Mỗi vua địch mang một cờ hiệu thay đổi cách quân của họ chiến đấu (xem tab Cờ hiệu).',
      'Thổ Phỉ không có cờ hiệu. Liên Quân gộp quân của hai vua cùng lúc và cũng không áp cờ hiệu.',
    ]),
    entry('council', 'Hội đồng', [
      `Các năm ${RUN.councilYears.join(', ')}, sau trận, hội đồng đưa ra ${DECREE_RULES.choices} sắc lệnh; chọn một và ban hành.`,
      'Mỗi sắc lệnh chỉ nhận được một lần mỗi ván.',
    ]),
    entry('quests', 'Nhiệm vụ', [
      `Các năm ${RUN.questYears.join(', ')} có thể có sứ giả đề nghị nhiệm vụ; bạn nhận hoặc từ chối.`,
      `Tối đa ${RUN.maxActiveQuests} nhiệm vụ cùng lúc. Hết hạn mà chưa xong thì không có thưởng.`,
      `Đặt Cược tốn ${QUEST_RULES.wagerFee} vàng khi nhận.`,
    ]),
    entry('boss', 'Boss', [
      `Boss xuất hiện ở các năm ${RUN.bossYears.join(', ')}.`,
      `Hết ${BATTLE.hardLimitTick} tick mà Ngai còn sống là thắng trận, nhưng chỉ hạ được boss mới tính boss đã thắng.`,
    ]),
    entry('save', 'Lưu ván và tải lại', [
      'Ván được lưu tự động sau mỗi hành động ngoài trận và khi vào/ra trận.',
      'Tải lại giữa trận thì trận bắt đầu lại từ đầu với cùng đội hình.',
    ]),
    entry('result', 'Thắng và thua', [
      `Ngai về 0 máu là thua trận và mất 1 mạng (bắt đầu ${RUN.startLives} mạng); hết mạng là thua ván.`,
      `Hết ${BATTLE.hardLimitTick} tick (${seconds(BATTLE.hardLimitTick)} giây) mà Ngai còn sống là thắng trận.`,
      `Vương Miện Vàng chỉ có khi bạn thật sự hạ được boss cuối (năm ${lastYear}), không chỉ sống sót đến hết giờ.`,
    ]),
    entry('rewards', 'Thẻ thưởng', [
      `Thẻ thưởng cho ${REWARD.choices} lựa chọn (sắc lệnh Giao Thương tăng lên ${DECREE_RULES.reward}).`,
    ]),
  ];
};
