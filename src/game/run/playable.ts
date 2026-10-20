import type { Content } from '../cards/registry';
import { hasAnyTarget } from './board';
import type { RunState } from './state';

/** Có ít nhất một thẻ trên tay có mục tiêu hợp lệ trên bàn cờ hiện tại (spec §4.4). */
export function hasPlayableCard(state: RunState, content: Content): boolean {
  return state.hand.some((id) => hasAnyTarget(state.plots, content.card(id)));
}
