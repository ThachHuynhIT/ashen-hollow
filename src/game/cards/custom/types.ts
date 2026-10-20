/** Kiểu handler cho hiệu ứng `custom` của từng thẻ (spec §5.4); đăng ký ở `custom/index.ts`. */
import type { Level, Scalar, StatKey, StatMode } from '../../../data/types';
import type { BuildingState, IllegalReason, PlayTarget, RunState } from '../../run/state';
import type { Content } from '../registry';

/** Một công trình nguồn (có hiệu ứng) và một công trình đích đang được tính. */
export interface StatCtx {
  state: RunState;
  content: Content;
  source: { plot: number; level: Level; stacks: number };
  target: { plot: number; building: BuildingState };
}

/** Một thay đổi chỉ số do handler đề xuất. */
export interface Modifier {
  stat: StatKey;
  mode: StatMode;
  value: number;
}

export type Params = Readonly<Record<string, Scalar>>;

/** Modifier chỉ số cho một cặp (nguồn, đích); handler tự quyết có áp cho đích đó không. */
export type StatHandler = (ctx: StatCtx, params: Params) => Modifier[];

/** Vàng đầu năm của một công trình (âm = phí duy trì). */
export type IncomeHandler = (ctx: StatCtx, params: Params) => number;

/** Hành động của một sách phép `custom`: trả state mới hoặc lý do bất hợp pháp. */
export type TomeHandler = (
  state: RunState,
  content: Content,
  params: Params,
  target: PlayTarget,
) => RunState | IllegalReason;
