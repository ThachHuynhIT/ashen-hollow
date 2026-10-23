import Phaser from 'phaser';
import { HELP_TABS, type HelpTab } from '../../data/help';
import { UI_PALETTE } from '../../data/uiPalette';
import type { CardId } from '../../data/types';
import { describeCard } from '../../game/cards/describe';
import type { Content } from '../../game/cards/registry';
import { ContentBox } from '../ContentBox';
import { textContent, type Rect, type TooltipContent } from '../hud/layout';
import { scrollLinesForDrag, scrollLinesForWheel } from '../info/inspectionLayout';
import { levelStars } from '../info/inspectionModel';
import { createOverlay, fitOverlay } from '../modals/overlay';
import { addUiText, createButton, createPanel, type Button, type TooltipHost, type UiBox } from '../theme';
import { HelpCardBrowser } from './HelpCardBrowser';
import { helpLayout, type HelpLayout } from './helpLayout';
import { buildHelpCatalog, type HelpCatalog, type HelpEntry, type HelpFilter } from './helpModel';
import {
  KIND_LABEL,
  RARITY_LABEL,
  cycleFilter,
  initialHelpView,
  selectEntry,
  setHelpTab,
  type HelpView,
} from './helpView';

const inside = (r: Rect, p: { x: number; y: number }): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * Modal Trợ giúp (§10): tab theo `HELP_TABS`, bộ lọc thẻ (vua, loại, độ hiếm, cấp), lưới thẻ cuộn và chi tiết.
 * Chỉ hiển thị: không nhận bus nên không thể gửi lệnh game. Vòng đời: owner gọi layout() khi đổi cỡ, destroy() khi đóng.
 */
export class HelpModal {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly title: Phaser.GameObjects.Text;
  private readonly close: Button;
  private readonly tabs: Button[];
  private readonly filters: Button[];
  private readonly root: Phaser.GameObjects.Container;
  private readonly browser: HelpCardBrowser;
  private readonly detail: ContentBox;
  private readonly list: ContentBox;
  private readonly catalog: HelpCatalog;
  private state: HelpView;
  private lay: HelpLayout;
  private dragFrom: { y: number; applied: number } | null = null;

  private readonly onWheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
    if (this.showsText() && inside(this.lay.wide, p)) this.list.scrollBy(scrollLinesForWheel(dy));
  };
  private readonly onDown = (p: Phaser.Input.Pointer): void => {
    this.dragFrom = this.showsText() && inside(this.lay.wide, p) ? { y: p.y, applied: 0 } : null;
  };
  private readonly onMove = (p: Phaser.Input.Pointer): void => {
    if (!this.dragFrom || !p.isDown) return;
    const step = scrollLinesForDrag(0, p.y - this.dragFrom.y);
    if (!step.dragging) return;
    this.list.scrollBy(step.lines - this.dragFrom.applied);
    this.dragFrom.applied = step.lines;
  };
  private readonly onUp = (): void => {
    this.dragFrom = null;
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly content: Content,
    tooltip: TooltipHost,
    onClose: () => void,
    tab: HelpTab = 'cards',
  ) {
    this.catalog = buildHelpCatalog(content);
    this.state = initialHelpView(tab);
    this.lay = helpLayout({ w: scene.scale.width, h: scene.scale.height });
    this.overlay = createOverlay(scene);
    this.box = createPanel(scene, 'panel', 64, 64);
    this.box.image.setInteractive(); // a click on the panel never reaches anything below
    this.title = addUiText(scene, 0, 0, 'Trợ giúp', 20).setOrigin(0, 0.5).setFontStyle('bold');
    this.close = createButton(scene, 0, 0, '✕', {
      width: 48,
      height: 48,
      fontSize: 20,
      onClick: onClose,
      tooltip: { host: tooltip, content: () => textContent(['Đóng (Esc)']) },
    });
    this.tabs = HELP_TABS.map(({ id, labelVi }) =>
      createButton(scene, 0, 0, labelVi, { width: 80, height: 44, fontSize: 13, onClick: () => this.setTab(id) }),
    );
    this.filters = [0, 1, 2, 3].map((i) =>
      createButton(scene, 0, 0, '', { width: 120, height: 44, fontSize: 13, onClick: () => this.cycle(i) }),
    );
    this.root = scene.add.container(0, 0, [
      this.overlay,
      this.box.image,
      this.title,
      this.close.container,
      ...this.tabs.map((t) => t.container),
      ...this.filters.map((f) => f.container),
    ]);
    this.detail = new ContentBox(scene, 'panel', 340, { blocking: true });
    this.list = new ContentBox(scene, 'panel', 1000, { blocking: true });
    this.root.add([this.detail.container, this.list.container]);
    this.browser = new HelpCardBrowser(scene, content, tooltip, this.root, (entry) => this.choose(entry));
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp);
    this.refresh();
  }

  get view(): HelpView {
    return this.state;
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  setTab(tab: HelpTab): void {
    this.state = setHelpTab(this.state, tab);
    this.refresh();
  }

  setFilter(filter: HelpFilter): void {
    this.state = { ...this.state, filter, entryId: null, scroll: 0 };
    this.refresh();
  }

  layout(): void {
    this.refresh();
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel);
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove);
    input.off(Phaser.Input.Events.POINTER_UP, this.onUp);
    this.browser.destroy();
    this.detail.destroy();
    this.list.destroy();
    this.root.destroy();
  }

  // ---- bên trong ----------------------------------------------------------------------------

  private showsText(): boolean {
    return this.state.tab !== 'cards';
  }

  private cycle(i: number): void {
    const key = (['owner', 'kind', 'rarity', 'level'] as const)[i]!;
    this.state = cycleFilter(
      this.state,
      key,
      this.catalog.owners.map((o) => o.id),
    );
    this.refresh();
  }

  private choose(entry: HelpEntry): void {
    this.state = selectEntry(this.state, entry.id);
    this.showDetail();
  }

  private filterLabels(): string[] {
    const f = this.state.filter;
    const owner = f.owner === 'all' ? 'Tất cả' : (this.catalog.owners.find((o) => o.id === f.owner)?.nameVi ?? f.owner);
    return [
      `Vua: ${owner}`,
      `Loại: ${f.kind === 'all' ? 'Tất cả' : KIND_LABEL[f.kind]}`,
      `Hiếm: ${f.rarity === 'all' ? 'Tất cả' : RARITY_LABEL[f.rarity]}`,
      `Cấp: ${f.level}`,
    ];
  }

  private refresh(): void {
    const { width, height } = this.scene.scale;
    const l = (this.lay = helpLayout({ w: width, h: height }));
    fitOverlay(this.scene, this.overlay);
    this.box.resize(l.panel.w, l.panel.h);
    this.box.image.setPosition(l.panel.x, l.panel.y);
    this.title.setPosition(l.title.x, l.title.y + l.title.h / 2);
    this.close.container.setPosition(l.close.x + l.close.w / 2, l.close.y + l.close.h / 2);
    this.tabs.forEach((t, i) => {
      const r = l.tabs[i]!;
      t.resize(r.w, r.h);
      t.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
      t.setActive(HELP_TABS[i]!.id === this.state.tab);
    });
    const cards = this.state.tab === 'cards';
    const labels = this.filterLabels();
    this.filters.forEach((f, i) => {
      const r = l.filters[i]!;
      f.resize(r.w, r.h);
      f.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
      f.setLabel(labels[i]!);
      f.setVisible(cards);
    });
    this.browser.setShown(cards);
    this.detail.container.setVisible(false);
    this.list.container.setVisible(false);
    if (cards) {
      this.browser.layout(l.viewport);
      this.browser.setFilter(this.state.filter);
      this.browser.setSelected(this.state.entryId);
      this.showDetail();
    } else {
      this.showList();
    }
  }

  private showDetail(): void {
    const id = this.state.entryId;
    const r = this.lay.detail;
    this.detail.setMaxWidth(r.w);
    this.detail.setMaxHeight(r.h);
    if (id === null) {
      this.detail.setContent(null);
      return;
    }
    const def = this.content.card(id as CardId);
    const lines = [levelStars(this.state.filter.level).label, ...describeCard(def, this.state.filter.level).lines];
    this.detail.setContent({
      title: def.nameVi,
      lines: lines.map((text) => [{ text }]),
    });
    this.detail.setPosition(r.x, r.y);
  }

  private showList(): void {
    const w = this.lay.wide;
    const entries = this.catalog.tabs[this.state.tab];
    const lines: TooltipContent['lines'][number][] = [];
    for (const e of entries) {
      lines.push([{ text: e.title, color: UI_PALETTE.woodDark }]);
      for (const text of e.lines) lines.push([{ text }]);
      lines.push([{ text: ' ' }]);
    }
    this.list.setMaxWidth(w.w);
    this.list.setMaxHeight(w.h);
    this.list.setContent({ title: HELP_TABS.find((t) => t.id === this.state.tab)?.labelVi, lines });
    this.list.setPosition(w.x, w.y);
  }
}
