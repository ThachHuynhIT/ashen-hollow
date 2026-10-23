/**
 * DEV only: the "Xem thử (DEV)" button and its panel of year jumps, plus the banner shown while a sample run is
 * open. Plain DOM next to the canvas, so no player-facing scene or shortcut table knows about it. The marker
 * constant below is what `tools/check-production-debug.mjs` looks for in a production build.
 */
import type { PreviewTarget } from './previewRun';

export const DEV_PREVIEW_ONLY_JUMP = 'DEV_PREVIEW_ONLY_JUMP';

const KIND_LABEL: Record<PreviewTarget['kind'], string> = {
  quest: 'Sứ giả (nhiệm vụ)',
  council: 'Hội đồng',
  boss: 'Boss',
};

const style = (el: HTMLElement, css: string): void => {
  el.style.cssText = css;
};

export class DevJumpPanel {
  private readonly root: HTMLDivElement;
  private banner: HTMLDivElement | null = null;

  constructor(
    targets: readonly PreviewTarget[],
    private readonly onJump: (target: PreviewTarget) => void,
    private readonly onExit: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.dataset.marker = DEV_PREVIEW_ONLY_JUMP;
    style(this.root, 'position:fixed;left:8px;bottom:8px;z-index:50;font:12px sans-serif;color:#fff');
    const body = document.createElement('div');
    style(body, 'display:none;background:#222c;padding:6px;margin-bottom:4px;border-radius:4px');
    for (const kind of ['quest', 'council', 'boss'] as const) {
      const row = document.createElement('div');
      row.append(`${KIND_LABEL[kind]}: `);
      for (const t of targets.filter((x) => x.kind === kind)) {
        const b = document.createElement('button');
        b.textContent = String(t.year);
        b.onclick = () => this.onJump(t);
        row.append(b, ' ');
      }
      body.append(row);
    }
    const toggle = document.createElement('button');
    toggle.textContent = 'Xem thử (DEV)';
    toggle.onclick = () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    };
    this.root.append(body, toggle);
    document.body.append(this.root);
  }

  /** Show the "sample run" banner with its exit button. */
  showBanner(): void {
    this.hideBanner();
    const b = document.createElement('div');
    style(b, 'position:fixed;top:0;left:0;right:0;z-index:60;background:#a33;color:#fff;font:13px sans-serif;text-align:center;padding:4px');
    b.append('BẢN XEM THỬ — không lưu ván thật ');
    const exit = document.createElement('button');
    exit.textContent = 'Thoát xem thử';
    exit.onclick = () => {
      this.hideBanner();
      this.onExit();
    };
    b.append(exit);
    document.body.append(b);
    this.banner = b;
  }

  hideBanner(): void {
    this.banner?.remove();
    this.banner = null;
  }

  destroy(): void {
    this.hideBanner();
    this.root.remove();
  }
}
