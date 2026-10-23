/**
 * Mã hoá / giải mã ván đang chơi (spec §9.3). `decodeRun` KHÔNG tin dữ liệu đọc từ đĩa: nó nâng cấp
 * phiên bản, rồi kiểm toàn bộ cấu trúc và mọi id tham chiếu (bộ bài, chồng bài, công trình, Bùa, hàng
 * đợi, nhiệm vụ, đạo quân, vua) trước khi trả state. Hash nội dung chỉ để ghi nhận: hash khác vẫn được
 * nhận nếu mọi tham chiếu còn hợp lệ (thêm id mới không phá ván cũ), còn hash khớp không bỏ qua kiểm tra.
 */
import { hashSeed } from '../../core/random';
import { BOSSES } from '../../data/bosses';
import { DECREES } from '../../data/decrees';
import { QUESTS } from '../../data/quests';
import { RUN } from '../../data/run';
import { INCOMPATIBLE_RUN_TEXT, SAVE_FORMAT_VERSION } from '../../data/save';
import type { Content } from '../cards/registry';
import type { RunPhase, RunState } from '../run/state';
import { RUN_SAVE_VERSION } from '../run/state';
import { migrateRunState } from './migrate';
import type { LoadRunResult, SaveEnvelope } from './types';

/** Hash của tập id thẻ và đơn vị (đã sắp), theo công thức của plan: `hashSeed(JSON.stringify({cards, units}))`. */
export function contentHash(content: Content): number {
  const cards = content.allCards().map((c) => c.id).sort();
  const units = content.allUnits().map((u) => u.id).sort();
  return hashSeed(JSON.stringify({ cards, units }));
}

/** Phong bì của `state` (sao chép sâu, không World / Phaser / Promise / Map / Set). */
export function encodeRun(state: RunState, content: Content): SaveEnvelope {
  return {
    formatVersion: SAVE_FORMAT_VERSION as 1,
    version: RUN_SAVE_VERSION,
    contentHash: contentHash(content),
    state: structuredClone(state),
  };
}

class Invalid extends Error {}
function ensure(ok: boolean, what: string): asserts ok {
  if (!ok) throw new Invalid(what);
}
type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isUint32 = (v: unknown): boolean => isInt(v) && v >= 0 && v <= 0xffffffff;
const inRange = (v: unknown, lo: number, hi: number): boolean => isInt(v) && v >= lo && v <= hi;
const arr = (v: unknown, what: string): unknown[] => {
  ensure(Array.isArray(v), what);
  return v as unknown[];
};

const PHASES: readonly RunPhase[] = ['planning', 'battle', 'reward', 'conquest', 'council', 'quest', 'yearEnd', 'ended'];
const CALENDARS = ['raiders', 'short', 'full'];
const OFFER_PHASE: Record<string, RunPhase> = { reward: 'reward', questReward: 'reward', conquest: 'conquest', council: 'council', quest: 'quest' };
const EDGES = ['N', 'E', 'S', 'W'];
const PLOTS = 25;
const THRONE = 12;

/** Mọi số trong cây phải hữu hạn (JSON không giữ NaN / Infinity, nhưng dữ liệu hỏng có thể có). */
const allFinite = (v: unknown): boolean => {
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(allFinite);
  if (isObject(v)) return Object.values(v).every(allFinite);
  return true;
};

/** Kiểm cấu trúc và tham chiếu của một RunState phiên bản hiện tại; ném `Invalid` nếu có gì sai. */
function validate(raw: unknown, content: Content): asserts raw is RunState {
  ensure(isObject(raw), 'state is not an object');
  const s = raw;
  ensure(s.version === RUN_SAVE_VERSION, 'wrong state version');
  ensure(allFinite(s), 'non-finite number');

  const cards = new Set(content.allCards().map((c) => c.id as string));
  const units = new Set(content.allUnits().map((u) => u.id as string));
  const kings = new Set(content.enemyKings().map((k) => k.id as string));
  const playable = new Set(content.kings().map((k) => k.id as string));
  const decrees = new Set(DECREES.map((d) => d.id as string));
  const quests = new Set(QUESTS.map((q) => q.id as string));
  const bosses = new Set(BOSSES.map((b) => b.id as string));
  const card = (id: unknown, what: string): void => ensure(typeof id === 'string' && cards.has(id), `unknown card in ${what}`);
  const cardList = (v: unknown, what: string): string[] => {
    const list = arr(v, what);
    for (const id of list) card(id, what);
    return list as string[];
  };

  // Luật và định danh.
  ensure(isObject(s.rules), 'rules');
  const rules = s.rules as Loose;
  ensure(isInt(rules.years) && (rules.years as number) >= 1 && CALENDARS.includes(rules.calendar as string), 'rules');
  ensure(typeof rules.autoStart === 'boolean', 'rules');
  ensure(typeof s.seed === 'number', 'seed');
  ensure(typeof s.kingId === 'string' && playable.has(s.kingId), 'unknown king');
  ensure(inRange(s.year, 1, rules.years as number), 'year out of range');
  ensure(typeof s.phase === 'string' && PHASES.includes(s.phase as RunPhase), 'phase');
  ensure(inRange(s.lives, 0, RUN.maxLives), 'lives');
  ensure(inRange(s.throneLevel, 1, RUN.maxLevel), 'throne level');
  ensure(isInt(s.gold) && (s.gold as number) >= 0, 'gold');
  for (const key of ['rerollsThisYear', 'paidRerollsThisYear', 'purchasedPlots', 'freeRerollsLeft', 'difficulty', 'nextUid', 'interventionDmgPct'] as const) {
    ensure(isInt(s[key]) && (s[key] as number) >= 0, key);
  }
  ensure(typeof s.autoFire === 'boolean' && typeof s.played === 'boolean' && typeof s.yearStartPendingDraw === 'boolean', 'flags');
  ensure(s.won === null || typeof s.won === 'boolean', 'won');

  // Bàn cờ.
  const plots = arr(s.plots, 'plots');
  ensure(plots.length === PLOTS, 'plot count');
  const uids = new Set<number>();
  let maxUid = -1;
  plots.forEach((p, i) => {
    ensure(isObject(p) && typeof p.unlocked === 'boolean', 'plot');
    const b = (p as Loose).building;
    if (b === null) return;
    ensure(isObject(b), 'building');
    const bd = b as Loose;
    card(bd.cardId, 'building');
    ensure(inRange(bd.level, 1, RUN.maxLevel), 'building level');
    ensure(isInt(bd.uid) && !uids.has(bd.uid as number), 'building uid');
    uids.add(bd.uid as number);
    maxUid = Math.max(maxUid, bd.uid as number);
    ensure(isInt(bd.placedYear) && isInt(bd.ageBonus), 'building age');
    ensure(bd.movedYear === null || isInt(bd.movedYear), 'movedYear');
    ensure(isObject(bd.counters) && Object.values(bd.counters as Loose).every(isInt), 'counters');
    ensure(isObject(bd.permanent), 'permanent');
    let stacks = 0;
    for (const e of arr(bd.enchants, 'enchants')) {
      ensure(isObject(e), 'enchant');
      card((e as Loose).cardId, 'enchant');
      ensure(inRange((e as Loose).stacks, 1, RUN.maxEnchantStacks), 'stacks');
      stacks += (e as Loose).stacks as number;
    }
    ensure(stacks <= RUN.maxEnchantStacks, 'too many stacks');
    if (i === THRONE) ensure(bd.level === s.throneLevel, 'throne building level');
  });
  const throne = (plots[THRONE] as Loose).building;
  ensure(throne !== null && isObject(throne), 'throne missing');
  ensure((s.nextUid as number) > maxUid, 'nextUid');
  ensure(isObject(s.rng) && (['draw', 'reward', 'calendar', 'council', 'quest'] as const).every((k) => isUint32((s.rng as Loose)[k])), 'rng');

  // Bộ bài: tay + rút + bỏ phải đúng bằng bộ bài.
  const deck = cardList(s.deck, 'deck');
  const all = [...cardList(s.hand, 'hand'), ...cardList(s.drawPile, 'drawPile'), ...cardList(s.discardPile, 'discardPile')];
  ensure(all.length === deck.length && [...all].sort().join('|') === [...deck].sort().join('|'), 'deck mismatch');

  // Vua địch, Thổ Phỉ / chinh phục.
  const enemyKings = arr(s.enemyKings, 'enemyKings');
  ensure(enemyKings.length <= 6 && enemyKings.every((k) => typeof k === 'string' && kings.has(k)), 'enemyKings');
  ensure(isObject(s.enemies), 'enemies');
  for (const [k, e] of Object.entries(s.enemies as Loose)) {
    ensure(kings.has(k) && isObject(e), 'enemy');
    ensure(inRange((e as Loose).attacks, 0, 3) && ['pending', 'conquered', 'fled'].includes((e as Loose).status as string), 'enemy state');
  }
  ensure(s.pendingConquest === null || (typeof s.pendingConquest === 'string' && kings.has(s.pendingConquest)), 'pendingConquest');

  // Đạo quân của năm.
  if (s.army !== null) {
    ensure(isObject(s.army), 'army');
    const a = s.army as Loose;
    const attacker = a.attacker;
    ensure(attacker === 'raiders' || attacker === 'coalition' || attacker === 'boss' || (typeof attacker === 'string' && kings.has(attacker)), 'army attacker');
    if (a.boss !== undefined) ensure(typeof a.boss === 'string' && bosses.has(a.boss), 'army boss');
    if (a.kings !== undefined) ensure(arr(a.kings, 'army kings').every((k) => typeof k === 'string' && kings.has(k)), 'army kings');
    ensure(inRange(a.level, 1, 5) && isInt(a.budget) && typeof a.statMult === 'number', 'army numbers');
    for (const w of arr(a.waves, 'waves')) {
      ensure(isObject(w) && isInt((w as Loose).spawnTick), 'wave');
      for (const u of arr((w as Loose).units, 'wave units')) {
        ensure(isObject(u) && typeof (u as Loose).unit === 'string' && units.has((u as Loose).unit as string), 'unknown unit in army');
        ensure(EDGES.includes((u as Loose).edge as string), 'edge');
      }
    }
  }

  // Hàng đợi lựa chọn.
  const offerOk = (o: unknown): Loose => {
    ensure(isObject(o), 'offer');
    const offer = o as Loose;
    ensure(typeof offer.kind === 'string' && offer.kind in OFFER_PHASE, 'offer kind');
    if (offer.kind === 'council') {
      ensure(arr(offer.decreeIds, 'decreeIds').every((d) => typeof d === 'string' && decrees.has(d)), 'unknown decree');
      ensure(offer.selected === null || (typeof offer.selected === 'string' && (offer.decreeIds as string[]).includes(offer.selected)), 'selected decree');
      const sel = offer.selection;
      ensure(isObject(sel), 'selection');
      ensure(arr((sel as Loose).plots, 'sel plots').every((p) => inRange(p, 0, PLOTS - 1)), 'selection plots');
      ensure(arr((sel as Loose).deckIndices, 'sel deck').every((i) => inRange(i, 0, deck.length)), 'selection deck');
      ensure((sel as Loose).cardId === null || (typeof (sel as Loose).cardId === 'string' && cards.has((sel as Loose).cardId as string)), 'selection card');
    } else if (offer.kind === 'quest') {
      ensure(typeof offer.questId === 'string' && quests.has(offer.questId), 'unknown quest');
    } else {
      cardList(offer.cardIds, 'offer');
      if (offer.king !== undefined) ensure(typeof offer.king === 'string' && kings.has(offer.king), 'offer king');
    }
    return offer;
  };
  const current = s.offers === null ? null : offerOk(s.offers);
  for (const o of arr(s.pendingOffers, 'pendingOffers')) offerOk(o);

  // Sắc lệnh và nhiệm vụ.
  const owned = arr(s.decrees, 'decrees');
  ensure(owned.every((d) => typeof d === 'string' && decrees.has(d)) && new Set(owned).size === owned.length, 'decrees');
  ensure(arr(s.offeredQuestIds, 'offeredQuestIds').every((q) => typeof q === 'string' && quests.has(q)), 'offeredQuestIds');
  const list = arr(s.quests, 'quests');
  for (const q of list) {
    ensure(isObject(q) && typeof (q as Loose).id === 'string' && quests.has((q as Loose).id as string), 'unknown quest');
    ensure(['active', 'completed', 'failed'].includes((q as Loose).status as string), 'quest status');
    ensure(isInt((q as Loose).offeredYear) && isInt((q as Loose).deadlineYear), 'quest years');
    ensure(isObject((q as Loose).progress) && Object.values((q as Loose).progress as Loose).every(isInt), 'quest progress');
  }
  ensure(list.filter((q) => (q as Loose).status === 'active').length <= RUN.maxActiveQuests, 'too many active quests');

  // Thống kê.
  ensure(isObject(s.stats), 'stats');
  const st = s.stats as Loose;
  for (const k of ['kills', 'battlesWon', 'battlesLost', 'goldEarned', 'conquered', 'bossesWon', 'completedYears']) {
    ensure(isInt(st[k]) && (st[k] as number) >= 0, `stats.${k}`);
  }
  ensure(arr(st.bossesDefeated, 'bossesDefeated').every((b) => typeof b === 'string' && bosses.has(b)), 'bossesDefeated');
  ensure(arr(s.idleUids, 'idleUids').every(isInt), 'idleUids');

  // Pha khớp với dữ liệu đi kèm.
  const phase = s.phase as RunPhase;
  if (phase === 'battle') ensure(s.army !== null, 'battle without an army');
  if (phase in { reward: 1, conquest: 1, council: 1, quest: 1 }) {
    ensure(current !== null && OFFER_PHASE[current.kind as string] === phase, 'phase does not match the open offer');
  } else {
    ensure(s.offers === null, 'offer outside an offer phase');
  }
}

/**
 * Giải mã dữ liệu đọc từ kho: `empty` nếu chưa có ván, `incompatible` nếu không dùng được (JSON hỏng, định
 * dạng / phiên bản lạ, tham chiếu id thiếu, cấu trúc sai), còn lại `ok` với bản sao sâu của state.
 * Nhận phong bì định dạng 1 (state phiên bản 3 hoặc 4) và state 3 / 4 trần.
 */
export function decodeRun(raw: unknown, content: Content): LoadRunResult {
  if (raw === null || raw === undefined) return { kind: 'empty' };
  const bad: LoadRunResult = { kind: 'incompatible', message: INCOMPATIBLE_RUN_TEXT };
  try {
    ensure(isObject(raw), 'not an object');
    let state: unknown = raw;
    if ('formatVersion' in raw) {
      ensure(raw.formatVersion === SAVE_FORMAT_VERSION, 'unknown format');
      ensure(isInt(raw.version) && isInt(raw.contentHash), 'envelope fields');
      state = raw.state;
      ensure(isObject(state) && state.version === raw.version, 'version mismatch');
    }
    const migrated = migrateRunState(structuredClone(state));
    validate(migrated, content);
    return { kind: 'ok', state: migrated };
  } catch (e) {
    if (e instanceof Invalid) return bad;
    return bad; // dữ liệu lạ làm ném lỗi khác (ví dụ không sao chép được): vẫn là không tương thích
  }
}
