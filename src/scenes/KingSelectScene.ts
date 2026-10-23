import Phaser from 'phaser';
import { toCss } from '../data/palette';
import type { KingDef, KingId } from '../data/types';
import { UI_PALETTE } from '../data/uiPalette';
import { describeCard } from '../game/cards/describe';
import { CONTENT } from '../game/cards/registry';
import { addPixelTexture, buildSpritesTexture } from '../render/atlas';
import { paintPortrait } from '../render/portraitArt';
import { CardView } from '../ui/cards/CardView';
import { snapScroll, textContent } from '../ui/hud/layout';
import { KING_CARD, kingCardRow, kingSelectLayout, type KingSelectLayout } from '../ui/kingSelectLayout';
import { Tooltip } from '../ui/Tooltip';
import {
  addUiText,
  createButton,
  createPanel,
  frameBorder,
  type Button,
  type UiBox,
} from '../ui/theme';
import { resolveShortcut, shortcutFlags } from '../ui/input/shortcuts';
import { SCENES } from './keys';
import { newRunSeed } from './MainMenuScene';
import type { RealmData } from './RealmScene';

/** The king picked last time is selected again when the screen reopens. */
let lastKing: KingId = 'wheat';

const portraitKey = (id: KingId): string => `portrait-${id}`;
const PAD_DESKTOP = 12;
const PAD_MOBILE = 6;

/**
 * Choose one of the three kings (§10.3): portrait slots, a detail panel with the king's
 * blurb, throne, enemy banner and nine cards (scroll the row by wheel or drag), the run seed
 * with **Đổi seed**, and **Bắt đầu**, which starts the realm with `{ seed, kingId }`.
 */
export class KingSelectScene extends Phaser.Scene {
  private kings: readonly KingDef[] = [];
  private selected = 0;
  private seed = 0;
  private scroll = 0;
  private lay!: KingSelectLayout;
  private tooltip!: Tooltip;
  private title!: Phaser.GameObjects.Text;
  private back!: Button;
  private reroll!: Button;
  private start!: Button;
  private slots: { box: UiBox; portrait: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];
  private detailBox!: UiBox;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private seedBox!: UiBox;
  private seedText!: Phaser.GameObjects.Text;
  private cards: CardView[] = [];
  private drag: { id: number; startX: number; startScroll: number } | null = null;

  constructor() {
    super(SCENES.kingSelect);
  }

  create(): void {
    // Scene instances are reused: reset every per-visit field first.
    this.kings = CONTENT.kings();
    this.selected = Math.max(0, this.kings.findIndex((k) => k.id === lastKing));
    this.seed = newRunSeed();
    this.scroll = 0;
    this.slots = [];
    this.cards = [];
    this.drag = null;
    this.cameras.main.setBackgroundColor(toCss(UI_PALETTE.sky[2]));
    buildSpritesTexture(this.textures, CONTENT); // no-op once PreloadScene built it

    this.tooltip = new Tooltip(this);
    this.title = addUiText(this, 0, 0, 'Chọn vua', 26, UI_PALETTE.creamLight)
      .setOrigin(0.5)
      .setFontStyle('bold')
      .setStroke(`#${UI_PALETTE.outline.toString(16).padStart(6, '0')}`, 5);
    this.back = createButton(this, 0, 0, '‹ Quay lại', {
      width: 120,
      height: 48,
      fontSize: 15,
      onClick: () => this.scene.start(SCENES.mainMenu),
      tooltip: { host: this.tooltip, content: () => textContent(['Về menu (Esc)']) },
    });

    this.kings.forEach((king, i) => {
      addPixelTexture(this.textures, portraitKey(king.id), paintPortrait(king));
      const box = createPanel(this, 'slot', 96, 96);
      box.image.setInteractive({ useHandCursor: true });
      box.image.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() <= 8) this.select(i);
      });
      box.image.on('pointerover', () =>
        this.tooltip.showAtPointer({ title: king.nameVi, lines: [] }, `slot-${i}`),
      );
      box.image.on('pointerout', () => this.tooltip.hide(`slot-${i}`));
      const portrait = this.add.image(0, 0, portraitKey(king.id)).setOrigin(0.5);
      const label = addUiText(this, 0, 0, king.nameVi, 11, UI_PALETTE.creamLight)
        .setOrigin(0.5, 1)
        .setFontStyle('bold')
        .setStroke(`#${UI_PALETTE.outline.toString(16).padStart(6, '0')}`, 4);
      this.slots.push({ box, portrait, label });
    });

    this.detailBox = createPanel(this, 'panel', 64, 64);
    this.nameText = addUiText(this, 0, 0, '', 22).setFontStyle('bold');
    this.bodyText = addUiText(this, 0, 0, '', 13);
    for (let i = 0; i < 9; i++) {
      this.cards.push(new CardView(this, CONTENT, { w: KING_CARD.w, h: KING_CARD.h }, this.tooltip));
    }
    this.seedBox = createPanel(this, 'slot', 64, 44);
    this.seedText = addUiText(this, 0, 0, '', 15).setOrigin(0, 0.5);
    this.reroll = createButton(this, 0, 0, 'Đổi seed', {
      width: 160,
      height: 44,
      fontSize: 15,
      onClick: () => {
        this.seed = newRunSeed();
        this.refresh();
      },
      tooltip: { host: this.tooltip, content: () => textContent(['Đổi seed', 'Một seed khác cho ván khác.']) },
    });
    this.start = createButton(this, 0, 0, 'Bắt đầu', {
      width: 200,
      height: 52,
      fontSize: 20,
      onClick: () => this.begin(),
      tooltip: { host: this.tooltip, content: () => textContent(['Bắt đầu (Enter)']) },
    });

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.refresh();
  }

  // ---- state → widgets ---------------------------------------------------------------------

  private king(): KingDef {
    return this.kings[this.selected]!;
  }

  private select(index: number): void {
    if (index === this.selected || this.kings[index] === undefined) return;
    this.selected = index;
    lastKing = this.king().id;
    this.scroll = 0;
    this.refresh();
  }

  private begin(): void {
    lastKing = this.king().id;
    const data: RealmData = { seed: this.seed, kingId: this.king().id };
    this.scene.start(SCENES.realm, data);
  }

  /** King-dependent texts, selected slot frame, card row contents. */
  private refresh(): void {
    const king = this.king();
    this.slots.forEach((s, i) => s.box.setFrame(i === this.selected ? 'slotSelected' : 'slot'));
    this.nameText.setText(king.nameVi);
    const throne = describeCard(king.throne);
    this.bodyText.setText(
      [
        king.blurbVi,
        '',
        `${throne.title}: ${throne.lines[0] ?? ''}`,
        '',
        `Khi làm địch — cờ hiệu ${king.banner.nameVi}: ${king.banner.textVi}`,
      ].join('\n'),
    );
    this.cards.forEach((view, i) => view.setCard(king.cards[i]?.id ?? null));
    this.seedText.setText(`Seed: ${this.seed}`);
    this.layout();
  }

  // ---- layout ------------------------------------------------------------------------------

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const inset = frameBorder(this, 'panel') + (w >= 768 ? PAD_DESKTOP : PAD_MOBILE);
    const l = (this.lay = kingSelectLayout({ w, h }, inset));
    this.title.setPosition(l.title.x + l.title.w / 2, l.title.y + l.title.h / 2);
    this.title.setFontSize(l.desktop ? 28 : 22);
    this.back.resize(l.back.w, l.back.h);
    this.back.container.setPosition(l.back.x + l.back.w / 2, l.back.y + l.back.h / 2);

    this.slots.forEach((s, i) => {
      const r = l.slots[i]!;
      s.box.resize(r.w, r.h);
      s.box.image.setPosition(r.x, r.y);
      s.portrait.setPosition(r.x + r.w / 2, r.y + r.h / 2 - 4).setScale(2);
      s.label.setPosition(r.x + r.w / 2, r.y + r.h - 3);
      s.box.setFrame(i === this.selected ? 'slotSelected' : 'slot');
    });

    this.detailBox.resize(l.detail.w, l.detail.h);
    this.detailBox.image.setPosition(l.detail.x, l.detail.y);
    this.nameText.setPosition(l.text.x, l.text.y);
    this.bodyText.setPosition(l.text.x, l.text.y + this.nameText.height + 6);
    this.bodyText.setWordWrapWidth(Math.max(40, l.text.w));
    this.bodyText.setFontSize(l.desktop ? 14 : 12);
    this.applyCards();

    this.seedBox.resize(l.seed.w, l.seed.h);
    this.seedBox.image.setPosition(l.seed.x, l.seed.y);
    this.seedText.setPosition(l.seed.x + 12, l.seed.y + l.seed.h / 2);
    this.reroll.resize(l.reroll.w, l.reroll.h);
    this.reroll.container.setPosition(l.reroll.x + l.reroll.w / 2, l.reroll.y + l.reroll.h / 2);
    this.start.resize(l.start.w, l.start.h);
    this.start.container.setPosition(l.start.x + l.start.w / 2, l.start.y + l.start.h / 2);
    this.tooltip.refresh();
  }

  private applyCards(): void {
    const row = kingCardRow(this.lay.cards, this.king().cards.length, this.scroll);
    this.scroll = row.scroll;
    const shown = new Set(row.visible);
    this.cards.forEach((view, i) => {
      const r = row.cards[i];
      const on = r !== undefined && shown.has(i);
      view.container.setVisible(on);
      if (on) view.setPosition(r.x, r.y);
    });
  }

  // ---- input -------------------------------------------------------------------------------

  private inCards(x: number, y: number): boolean {
    const c = this.lay.cards;
    return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number): void {
    if (!this.inCards(pointer.x, pointer.y)) return;
    this.scroll += (Math.abs(dx) > Math.abs(dy) ? dx : dy) * 0.5;
    this.applyCards();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.inCards(pointer.x, pointer.y)) this.drag = { id: pointer.id, startX: pointer.x, startScroll: this.scroll };
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || this.drag.id !== pointer.id || !pointer.isDown) return;
    this.scroll = this.drag.startScroll - (pointer.x - this.drag.startX);
    this.applyCards();
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || this.drag.id !== pointer.id) return;
    this.drag = null;
    const max = kingCardRow(this.lay.cards, this.king().cards.length, this.scroll).maxScroll;
    this.scroll = snapScroll(this.scroll, KING_CARD.w + KING_CARD.gap, max);
    this.applyCards();
  }

  private onKey(event: KeyboardEvent): void {
    const action = resolveShortcut(event.key, 'kingSelect', shortcutFlags(event));
    switch (action) {
      case 'help.toggle':
        event.preventDefault(); // F1 must not open the browser's help; the Help view is wired in G3e E4d
        break;
      case 'select.1':
      case 'select.2':
      case 'select.3':
        this.select(Number(action.slice(-1)) - 1);
        break;
      case 'confirm':
        this.begin();
        break;
      case 'back':
        this.scene.start(SCENES.mainMenu);
        break;
    }
  }

  private teardown(): void {
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    for (const c of this.cards) c.destroy();
    this.cards = [];
    this.tooltip.destroy();
  }
}

