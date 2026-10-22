/** Hiệu ứng riêng của thẻ chinh phục Vua Đồng Hồ (spec §6.9). */
import type { FullRunCardHooks } from './fullRunTypes';
import type { TomeHandler } from './types';
import { THRONE_PLOT } from '../../run/board';

/** Tua Ngược: công trình được chọn lên dây trước thêm `seconds` giây vĩnh viễn (tối đa `cap`). */
export const rewind: TomeHandler = (state, _content, params, target) => {
  if (target.kind !== 'plot' || target.plot === THRONE_PLOT) return 'badTarget';
  const seconds = typeof params.seconds === 'number' ? params.seconds : 0;
  const cap = typeof params.cap === 'number' ? params.cap : 0;
  const plots = state.plots.map((p) => ({ ...p, building: p.building ? structuredClone(p.building) : null }));
  const b = plots[target.plot]!.building;
  if (b === null) return 'badTarget';
  b.counters.prewind = Math.min(cap, (b.counters.prewind ?? 0) + seconds);
  return { ...state, plots };
};

/** Đồng Hồ không có móc theo thời điểm: lên dây trước nằm trong `counters.prewind` và chỉ số. */
export const CLOCK_HOOKS: Partial<FullRunCardHooks> = {};
