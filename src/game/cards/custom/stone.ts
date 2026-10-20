/** Hiệu ứng `custom` của Vua Đá Núi (spec §6.4). */
import type { TomeHandler } from './types';

/** Khắc Ấn Núi: mọi tháp trên bàn cờ nhận vĩnh viễn +`pct`% sát thương (`permanent.dmg`, cộng dồn). */
export const runeCarving: TomeHandler = (state, content, params) => {
  const pct = typeof params.pct === 'number' ? params.pct : 8;
  const plots = state.plots.map((p) => {
    if (p.building === null || content.card(p.building.cardId).kind !== 'tower') return p;
    const permanent = { ...p.building.permanent, dmg: (p.building.permanent.dmg ?? 0) + pct };
    return { ...p, building: { ...p.building, permanent } };
  });
  return { ...state, plots };
};
