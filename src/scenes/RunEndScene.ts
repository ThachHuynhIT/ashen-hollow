import Phaser from 'phaser';
import { toCss } from '../data/palette';
import { RULES_G1 } from '../data/run';
import { UI_PALETTE } from '../data/uiPalette';
import type { RunState } from '../game/run/state';
import { RESULT_BUTTON, resultLayout } from '../ui/modals/modalLayout';
import {
  addUiText,
  createButton,
  createPanel,
  frameBorder,
  type Button,
  type UiBox,
} from '../ui/theme';
import { SCENES } from './keys';
import { newRunSeed } from './MainMenuScene';
import type { RealmData } from './RealmScene';

export interface RunEndData {
  state: RunState;
}

/** Space between the panel border and its content. */
const PAD = 16;

/** The lines of the run summary (§10.8, G1 part). */
export const runEndLines = (state: RunState): string[] => [
  `Năm đạt được: ${state.year} / ${RULES_G1.years}`,
  `Trận thắng: ${state.stats.battlesWon} · Trận thua: ${state.stats.battlesLost}`,
  `Địch đã hạ: ${state.stats.kills}`,
];

/**
 * End of a run (§10.8, G1 subset): a big panel with the outcome, the year reached, battles
 * won/lost and enemies defeated, then **Về menu** and **Ván mới** (a fresh seed). Crown
 * points, conquered kings and unlocks arrive with G3/G4.
 */
export class RunEndScene extends Phaser.Scene {
  private state: RunState | null = null;
  private panel!: UiBox;
  private title!: Phaser.GameObjects.Text;
  private lines: Phaser.GameObjects.Text[] = [];
  private buttons: Button[] = [];

  constructor() {
    super(SCENES.runEnd);
  }

  create(data: Partial<RunEndData> = {}): void {
    // Scene instances are reused: reset every per-run field first.
    this.state = data.state ?? null;
    this.lines = [];
    this.buttons = [];
    this.cameras.main.setBackgroundColor(toCss(UI_PALETTE.sky[3]));

    const state = this.state;
    const won = state?.won === true;
    this.panel = createPanel(this, 'panel', 320, 240);
    this.title = addUiText(this, 0, 0, won ? 'Chiến thắng!' : 'Vương quốc sụp đổ', 30)
      .setOrigin(0.5)
      .setFontStyle('bold');
    this.lines = (state ? runEndLines(state) : []).map((line) =>
      addUiText(this, 0, 0, line, 18).setOrigin(0.5),
    );
    this.buttons = [
      createButton(this, 0, 0, 'Về menu', {
        width: RESULT_BUTTON.w,
        height: RESULT_BUTTON.h,
        fontSize: 18,
        onClick: () => this.toMenu(),
      }),
      createButton(this, 0, 0, 'Ván mới', {
        width: RESULT_BUTTON.w,
        height: RESULT_BUTTON.h,
        fontSize: 18,
        onClick: () => this.newRun(),
      }),
    ];

    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.layout();
  }

  private toMenu(): void {
    this.scene.start(SCENES.mainMenu);
  }

  private newRun(): void {
    const data: RealmData = { seed: newRunSeed() };
    this.scene.start(SCENES.realm, data);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.key === 'Enter') this.newRun();
    else if (event.key === 'Escape') this.toMenu();
  }

  private layout(): void {
    const screen = { w: this.scale.width, h: this.scale.height };
    const inset = frameBorder(this, 'panel') + PAD;
    const l = resultLayout(screen, inset, this.lines.length, this.buttons.length);
    this.panel.resize(l.panel.w, l.panel.h);
    this.panel.image.setPosition(l.panel.x, l.panel.y);
    this.title.setFontSize(screen.w >= 768 ? 30 : 26);
    this.title.setPosition(l.title.x + l.title.w / 2, l.title.y + l.title.h / 2);
    this.lines.forEach((t, i) => {
      const r = l.lines[i]!;
      t.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    });
    this.buttons.forEach((b, i) => {
      const r = l.buttons[i]!;
      b.container.setPosition(r.x + r.w / 2, r.y + r.h / 2);
    });
  }

  private teardown(): void {
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.state = null;
  }
}
