import type Phaser from 'phaser';
import type { EventBus } from '../../core/events';
import { DECREES } from '../../data/decrees';
import { UI_PALETTE } from '../../data/uiPalette';
import { CONTENT } from '../../game/cards/registry';
import type { GameEvents } from '../../game/events';
import type { CouncilSelection, RunCommand, RunState } from '../../game/run/state';
import { SPRITES_KEY, iconFrame } from '../../render/atlas';
import { CardView } from '../cards/CardView';
import type { Rect } from '../hud/layout';
import { addUiText, createButton, createPanel, frameBorder, type Button, type TooltipHost, type UiBox } from '../theme';
import {
  canEnact,
  councilOffer,
  deckGroups,
  pendingCouncilIntent,
  subselection,
  toggleDeckCard,
  toggleSubselection,
} from './councilModel';
import { COUNCIL_BUTTON, councilLayout } from './modalLayout';
import { createOverlay, fitOverlay } from './overlay';

const PAD_DESKTOP = 12;
const PAD_MOBILE = 4;
const HEADER_H = 24;
const CELL = 44;
const CELL_GAP = 2;
const CHIP_H = 44;
const CHIP_GAP = 4;
const RARE_CARD = { w: 100, h: 140 } as const;

/** The title of the council panel. */
export const councilTitle = (year: number): string => `Hội Đồng Hoàng Gia — Năm ${year}`;

/** Where the chosen decree's extra step is drawn, and what to remove when the area is rebuilt. */
interface AreaPart {
  destroy(): void;
}

/**
 * The royal council (§3.9): three decrees to pick from, the chosen decree's extra step (plots to
 * open, a rare card, cards to purge) and **Ban hành**. Every click is a `ui:command`; the state
 * (chosen decree, partial selection) lives in the run, so a resize or a reload shows it again.
 * `setState` swaps in a newer state; call `layout()` on resize and `destroy()` when closed.
 */
export class CouncilModal {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: UiBox;
  private readonly title: Phaser.GameObjects.Text;
  private readonly choices: { box: UiBox; icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; text: Phaser.GameObjects.Text }[] = [];
  private readonly enact: Button;
  private readonly root: Phaser.GameObjects.Container;
  private area: AreaPart[] = [];
  private page = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus<GameEvents>,
    private state: RunState,
    private readonly tooltip: TooltipHost,
  ) {
    this.overlay = createOverlay(scene);
    this.box = createPanel(scene, 'panel', 64, 64);
    this.box.image.setInteractive();
    this.title = addUiText(scene, 0, 0, councilTitle(state.year), 18).setOrigin(0.5, 0).setFontStyle('bold');
    for (let i = 0; i < 3; i++) {
      const box = createPanel(scene, 'slot', 64, 64);
      box.image.setInteractive({ useHandCursor: true });
      box.image.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() <= 8) this.choose(i);
      });
      const icon = scene.add.image(0, 0, SPRITES_KEY, iconFrame('crown')).setOrigin(0, 0).setScale(2);
      const name = addUiText(scene, 0, 0, '', 15).setFontStyle('bold');
      const text = addUiText(scene, 0, 0, '', 12);
      this.choices.push({ box, icon, name, text });
    }
    this.enact = createButton(scene, 0, 0, 'Ban hành', {
      width: COUNCIL_BUTTON.w,
      height: COUNCIL_BUTTON.h,
      fontSize: 16,
      onClick: () => this.enactNow(),
    });
    this.root = scene.add.container(0, 0, [
      this.overlay,
      this.box.image,
      this.title,
      ...this.choices.flatMap((c) => [c.box.image, c.icon, c.name, c.text]),
      this.enact.container,
    ]);
    this.layout();
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  /** A newer run state (the chosen decree or the selection changed). */
  setState(state: RunState): void {
    this.state = state;
    this.title.setText(councilTitle(state.year));
    this.layout();
  }

  layout(): void {
    const offer = councilOffer(this.state);
    if (offer === null) return;
    const { width, height } = this.scene.scale;
    const desktop = width >= 768;
    const inset = frameBorder(this.scene, 'panel') + (desktop ? PAD_DESKTOP : PAD_MOBILE);
    const l = councilLayout({ w: width, h: height }, inset);
    fitOverlay(this.scene, this.overlay);
    this.box.resize(l.panel.w, l.panel.h);
    this.box.image.setPosition(l.panel.x, l.panel.y);
    this.title.setPosition(l.title.x + l.title.w / 2, l.title.y + 4);
    this.title.setFontSize(desktop ? 18 : 15);
    offer.decreeIds.forEach((id, i) => {
      const view = this.choices[i]!;
      const def = DECREES.find((d) => d.id === id);
      const r = l.choices[i]!;
      view.box.resize(r.w, r.h);
      view.box.image.setPosition(r.x, r.y);
      view.box.setFrame(offer.selected === id ? 'slotSelected' : 'slot');
      view.icon.setPosition(r.x + 10, r.y + 10);
      const textX = r.x + 10 + 32 + 8;
      const wrap = Math.max(40, r.w - (textX - r.x) - 10);
      view.name.setText(def?.nameVi ?? id).setPosition(textX, r.y + 8).setWordWrapWidth(wrap);
      view.text.setText(def?.textVi ?? '').setPosition(textX, r.y + 8 + view.name.height + 2).setWordWrapWidth(wrap);
    });
    this.enact.container.setPosition(l.enact.x + l.enact.w / 2, l.enact.y + l.enact.h / 2);
    this.enact.setEnabled(canEnact(this.state, CONTENT));
    this.buildArea(l.area);
  }

  destroy(): void {
    this.clearArea();
    this.root.destroy();
  }

  // ---- commands ------------------------------------------------------------------------

  private send(command: RunCommand): void {
    this.bus.emit('ui:command', { command });
  }

  private choose(index: number): void {
    const offer = councilOffer(this.state);
    const id = offer?.decreeIds[index];
    if (offer === null || id === undefined || offer.selected === id) return; // a repeat tap changes nothing
    this.page = 0;
    this.send({ type: 'chooseDecree', index });
  }

  private enactNow(): void {
    const offer = councilOffer(this.state);
    if (offer === null || !canEnact(this.state, CONTENT)) return;
    this.send(pendingCouncilIntent(this.state, offer.selection));
  }

  private select(selection: CouncilSelection): void {
    this.send(pendingCouncilIntent(this.state, selection));
  }

  // ---- the detail area -----------------------------------------------------------------

  private clearArea(): void {
    for (const part of this.area) part.destroy();
    this.area = [];
  }

  private add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.root.add(object);
    this.area.push(object);
    return object;
  }

  private header(a: Rect, text: string): void {
    this.add(addUiText(this.scene, a.x, a.y, text, 14).setFontStyle('bold').setWordWrapWidth(a.w));
  }

  private buildArea(a: Rect): void {
    this.clearArea();
    const offer = councilOffer(this.state);
    if (offer === null) return;
    const sub = subselection(this.state, CONTENT);
    if (offer.selected === null) {
      this.header(a, 'Chọn một sắc lệnh.');
      return;
    }
    const def = DECREES.find((d) => d.id === offer.selected);
    if (sub === null) {
      this.header(a, def ? `${def.nameVi}: ${def.textVi}` : '');
      return;
    }
    const body = { x: a.x, y: a.y + HEADER_H + 4, w: a.w, h: a.h - HEADER_H - 4 };
    if (sub.kind === 'plots') this.buildPlots(a, body, sub);
    else if (sub.kind === 'card') this.buildCards(a, body, sub);
    else this.buildDeck(a, body);
  }

  private buildPlots(a: Rect, body: Rect, sub: Extract<NonNullable<ReturnType<typeof subselection>>, { kind: 'plots' }>): void {
    if (sub.limit === 0) {
      this.header(a, 'Không còn ô khoá nào để mở: ban hành để xác nhận.');
      return;
    }
    this.header(a, `Chọn ${sub.limit} ô khoá để mở (${sub.picked.length}/${sub.limit})`);
    const side = 5 * CELL + 4 * CELL_GAP;
    const x0 = Math.round(body.x + (body.w - side) / 2);
    for (let plot = 0; plot < 25; plot++) {
      const r = { x: x0 + (plot % 5) * (CELL + CELL_GAP), y: body.y + Math.floor(plot / 5) * (CELL + CELL_GAP), w: CELL, h: CELL };
      const state = this.state.plots[plot]!;
      const picked = sub.picked.includes(plot);
      const eligible = sub.eligible.includes(plot);
      const colour = picked ? UI_PALETTE.good : state.unlocked ? UI_PALETTE.creamDark : eligible ? UI_PALETTE.gold : UI_PALETTE.woodDark;
      const cell = this.add(this.scene.add.rectangle(r.x, r.y, r.w, r.h, colour).setOrigin(0, 0).setStrokeStyle(2, UI_PALETTE.outline));
      if (picked || eligible) {
        cell.setInteractive({ useHandCursor: true });
        cell.on('pointerup', (p: Phaser.Input.Pointer) => {
          if (p.getDistance() <= 8) this.select(toggleSubselection(this.state, CONTENT, { plot }));
        });
      }
      if (picked) this.add(addUiText(this.scene, r.x + r.w / 2, r.y + r.h / 2, String(sub.picked.indexOf(plot) + 1), 16).setOrigin(0.5));
    }
  }

  private buildCards(a: Rect, body: Rect, sub: Extract<NonNullable<ReturnType<typeof subselection>>, { kind: 'card' }>): void {
    if (sub.options.length === 0) {
      this.header(a, 'Không có thẻ hiếm nào: ban hành để xác nhận.');
      return;
    }
    this.header(a, 'Chọn 1 thẻ hiếm cho bộ bài');
    const gap = 12;
    const row = sub.options.length * RARE_CARD.w + (sub.options.length - 1) * gap;
    const x0 = Math.round(body.x + (body.w - row) / 2);
    sub.options.forEach((card, i) => {
      const view = new CardView(this.scene, CONTENT, RARE_CARD, this.tooltip);
      view.setCard(card);
      view.setSelected(sub.picked === card);
      view.setPosition(x0 + i * (RARE_CARD.w + gap), body.y + (sub.picked === card ? 0 : 12));
      view.onClick(() => this.select(toggleSubselection(this.state, CONTENT, { card })));
      this.root.add(view.container);
      this.area.push({ destroy: () => view.destroy() });
    });
  }

  private buildDeck(a: Rect, body: Rect): void {
    const sub = subselection(this.state, CONTENT);
    if (sub?.kind !== 'deck') return;
    this.header(a, `Chọn tối đa ${sub.limit} lá để loại khỏi bộ bài (${sub.picked.length}/${sub.limit})`);
    const groups = deckGroups(this.state);
    const cols = Math.max(2, Math.min(6, Math.floor((body.w + CHIP_GAP) / (110 + CHIP_GAP))));
    const chipW = Math.floor((body.w - (cols - 1) * CHIP_GAP) / cols);
    const rows = Math.max(1, Math.floor((body.h - CHIP_H - CHIP_GAP + CHIP_GAP) / (CHIP_H + CHIP_GAP)));
    const perPage = cols * rows;
    const pages = Math.max(1, Math.ceil(groups.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    groups.slice(this.page * perPage, (this.page + 1) * perPage).forEach((g, i) => {
      const x = body.x + (i % cols) * (chipW + CHIP_GAP);
      const y = body.y + Math.floor(i / cols) * (CHIP_H + CHIP_GAP);
      const chosen = g.picked > 0;
      const chip = this.add(
        this.scene.add
          .rectangle(x, y, chipW, CHIP_H, chosen ? UI_PALETTE.good : UI_PALETTE.creamLight)
          .setOrigin(0, 0)
          .setStrokeStyle(2, UI_PALETTE.outline)
          .setInteractive({ useHandCursor: true }),
      );
      chip.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() <= 8) this.select(toggleDeckCard(this.state, CONTENT, g.cardId));
      });
      const name = CONTENT.card(g.cardId).nameVi;
      const suffix = `×${g.indices.length}${g.picked > 0 ? ` (bỏ ${g.picked})` : ''}`;
      this.add(
        addUiText(this.scene, x + chipW / 2, y + CHIP_H / 2, `${name} ${suffix}`, 11)
          .setOrigin(0.5)
          .setAlign('center')
          .setWordWrapWidth(chipW - 6),
      );
    });
    if (pages > 1) {
      const y = body.y + rows * (CHIP_H + CHIP_GAP);
      const go = (delta: number): void => {
        this.page = Math.max(0, Math.min(pages - 1, this.page + delta));
        this.layout();
      };
      const prev = createButton(this.scene, body.x + 22, y + CHIP_H / 2, '‹', { width: 44, height: CHIP_H, fontSize: 20, onClick: () => go(-1) });
      const next = createButton(this.scene, body.x + body.w - 22, y + CHIP_H / 2, '›', { width: 44, height: CHIP_H, fontSize: 20, onClick: () => go(1) });
      prev.setEnabled(this.page > 0);
      next.setEnabled(this.page < pages - 1);
      this.root.add([prev.container, next.container]);
      this.area.push({ destroy: () => prev.container.destroy() }, { destroy: () => next.container.destroy() });
      this.add(addUiText(this.scene, body.x + body.w / 2, y + CHIP_H / 2, `${this.page + 1}/${pages}`, 13).setOrigin(0.5));
    }
  }
}
