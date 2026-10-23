import type { EnemyKingDef, KingDef } from '../types';
import { ARCANE } from './arcane';
import { CLOCK_ENEMY } from './clock';
import { FORGE_ENEMY } from './forge';
import { GROVE_ENEMY } from './grove';
import { MOON_ENEMY } from './moon';
import { NOMAD_ENEMY } from './nomad';
import { STONE } from './stone';
import { TIDE_ENEMY } from './tide';
import { WHEAT } from './wheat';

export { CLOCK_ENEMY, FORGE_ENEMY, GROVE_ENEMY, MOON_ENEMY, NOMAD_ENEMY, TIDE_ENEMY };

/** Các vua chơi được trong G1. */
export const KINGS_G1: readonly KingDef[] = [WHEAT];

/** Các vua có nội dung đầy đủ cho G2 (thêm vua mới ở đây khi nội dung của họ xong). */
export const KINGS_G2: readonly KingDef[] = [WHEAT, STONE, ARCANE];

/** Phần kẻ địch của một vua chơi được: thẻ chinh phục là mọi thẻ của vua (không gồm Ngai). */
export const enemyFromKing = (k: KingDef): EnemyKingDef => ({
  id: k.id,
  nameVi: k.nameVi,
  name: k.name,
  color: k.color,
  units: k.units,
  enemyRoster: k.enemyRoster,
  banner: k.banner,
  conquestCards: k.cards,
});

const byId = (a: EnemyKingDef, b: EnemyKingDef): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Cả 9 vua dưới dạng kẻ địch, sắp theo id để thứ tự bốc ngẫu nhiên ổn định. */
export const ENEMY_KINGS: readonly EnemyKingDef[] = [
  ...KINGS_G2.map(enemyFromKing),
  GROVE_ENEMY,
  TIDE_ENEMY,
  FORGE_ENEMY,
  CLOCK_ENEMY,
  MOON_ENEMY,
  NOMAD_ENEMY,
].sort(byId);
