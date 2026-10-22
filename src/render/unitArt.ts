import { PALETTE } from '../data/palette';
import type { UnitDef, UnitId } from '../data/types';
import { PixelCanvas } from './pixel';

export type UnitTeam = 'ally' | 'foe';
export type UnitAnim = 'idle' | 'walk' | 'attack';
/** Frames per animation. */
export const UNIT_FRAME_COUNT = 2;

/** Cloth colour per unit: wheat kingdom = wheat, neutral = blue, raiders = soil. */
export const UNIT_CLOTH: Readonly<Record<UnitId, number>> = {
  militia: PALETTE.wheat,
  reaper: PALETTE.wheat,
  footman: PALETTE.blue,
  bandit: PALETTE.soil,
  bandit_archer: PALETTE.soil,
  boar_rider: PALETTE.soil,
  ogre: PALETTE.soil,
  peasant: PALETTE.wheatLight,
  slinger: PALETTE.soil,
  miner: PALETTE.soilDark,
  golem: PALETTE.stone,
  rubble: PALETTE.stoneDark,
  apprentice: PALETTE.purple,
  archmage: PALETTE.plum,
  construct: PALETTE.stoneLight,
  frost_mage: PALETTE.waterLight,
  mercenary: PALETTE.teal,
  // Vua địch G3 (placeholder; art chốt ở G3d/G5)
  wolf: PALETTE.stoneDark,
  bear: PALETTE.soilDark,
  stag: PALETTE.soil,
  treant: PALETTE.leafDark,
  dryad: PALETTE.leaf,
  pirate: PALETTE.waterDeep,
  hookman: PALETTE.water,
  musketeer: PALETTE.waterLight,
  swordsman: PALETTE.stone,
  bombardier: PALETTE.orange,
  iron_drake: PALETTE.shadow,
  shieldbearer: PALETTE.stoneDark,
  tin_soldier: PALETTE.gold,
  spider: PALETTE.wheat,
  colossus: PALETTE.path,
  gear_gunner: PALETTE.wheatLight,
  skeleton: PALETTE.cream,
  wraith: PALETTE.stoneLight,
  vampire: PALETTE.plum,
  moon_reaper: PALETTE.purple,
  rider: PALETTE.sand,
  horse_archer: PALETTE.path,
  khan_guard: PALETTE.soil,
};

export const unitCloth = (def: UnitDef): number => UNIT_CLOTH[def.id] ?? PALETTE.blue;

/** Box with a 1 px outline around a filled rect. */
const outlined = (
  c: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  line: number,
): void => {
  c.fillRect(x - 1, y - 1, w + 2, h + 2, line);
  c.fillRect(x, y, w, h, fill);
};

/**
 * Placeholder unit: shadow ellipse, legs, cloth torso, skin head (about 40% of the height)
 * and a weapon picked from the tags. Allies are outlined dark brown; foes in dark red with a
 * single red flag pixel on the head. Frame 1 shifts the body: idle sinks 1 px, walk hops
 * 1 px, attack lunges 1 px to the right.
 */
export const paintUnit = (
  def: UnitDef,
  team: UnitTeam,
  anim: UnitAnim,
  frame: 0 | 1,
  cloth: number,
): PixelCanvas => {
  const { w, h } = def.sprite;
  const c = new PixelCanvas(w, h);
  const line = team === 'ally' ? PALETTE.outline : PALETTE.redDark;
  const ox = anim === 'attack' && frame === 1 ? 1 : 0;
  const oy = frame === 0 ? 0 : anim === 'idle' ? 1 : anim === 'walk' ? -1 : 0;

  c.fillEllipse(w / 2, h - 2, Math.max(3, w * 0.35), 2, PALETTE.shadow, 128);

  const headH = Math.round(h * 0.4);
  const headW = Math.max(6, Math.round(w * 0.45));
  const torsoW = Math.round(w * 0.6);
  const torsoX = Math.floor((w - torsoW) / 2) + ox;
  const headX = Math.floor((w - headW) / 2) + ox;
  const legsY = h - 4;
  const headY = 2 + oy;
  const torsoY = headY + headH;
  const torsoH = Math.max(2, legsY - torsoY);

  // Cavalry: a wide low mount body under the rider.
  if (def.tags.includes('cavalry')) outlined(c, 1 + ox, h - 9, w - 2, 5, PALETTE.soilDark, line);
  // Legs.
  const legW = Math.max(2, Math.round(torsoW / 4));
  outlined(c, torsoX + 1, legsY, legW, 2, PALETTE.soilDark, line);
  outlined(c, torsoX + torsoW - 1 - legW, legsY, legW, 2, PALETTE.soilDark, line);
  // Torso and head.
  outlined(c, torsoX, torsoY, torsoW, torsoH, cloth, line);
  outlined(c, headX, headY, headW, headH, PALETTE.skin, line);
  c.fillRect(headX, headY + headH - 2, headW, 1, PALETTE.skinShadow);
  c.set(headX + 1, headY + 2, PALETTE.outline);
  c.set(headX + headW - 2, headY + 2, PALETTE.outline);

  // Weapon on the right, chosen by role.
  const wx = torsoX + torsoW + 1;
  if (def.tags.includes('ranged')) {
    c.fillRect(wx, torsoY - 1, 1, 5, PALETTE.soilDark);
    c.fillRect(wx + 1, torsoY, 1, 3, PALETTE.cream);
  } else if (def.tags.includes('boss') || h >= 32) {
    c.fillRect(wx, torsoY - 2, 2, torsoH + 3, PALETTE.soilDark);
    c.fillRect(wx - 1, torsoY - 4, 4, 3, PALETTE.stone);
  } else {
    c.fillRect(wx, torsoY - 3, 1, 8, PALETTE.soilDark);
    c.fillRect(wx, torsoY - 4, 1, 2, PALETTE.stoneLight);
  }

  if (team === 'foe') c.set(headX + Math.floor(headW / 2), headY - 1, PALETTE.red);
  return c;
};
