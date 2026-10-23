/** Trạng thái nút "Tiếp tục" của menu chính, suy từ kết quả đọc ván đã lưu (thuần, có test). */
import type { RunState } from '../game/run/state';
import type { LoadRunResult } from '../game/save/types';

export interface ResumeTarget {
  enabled: boolean;
  state: RunState | null;
  /** Dòng báo người chơi một lần (ván hỏng / không còn tương thích); `null` nếu không có. */
  warning: string | null;
}

export const resumeTarget = (result: LoadRunResult): ResumeTarget => {
  switch (result.kind) {
    case 'ok':
      return { enabled: true, state: result.state, warning: null };
    case 'empty':
      return { enabled: false, state: null, warning: null };
    case 'incompatible':
      return { enabled: false, state: null, warning: result.message };
  }
};

/**
 * Generation token for async loads: every `begin()` (scene create) and `invalidate()` (scene
 * shutdown) makes older tokens stale, so a slow load never touches a scene that has moved on.
 */
export class LoadGuard {
  private generation = 0;

  begin(): number {
    return ++this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }
}
