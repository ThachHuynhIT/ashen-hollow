import Phaser from 'phaser';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import type { RunState } from '../game/run/state';
import { UI_KEY, addPixelTexture } from '../render/atlas';
import { HILL_LAYERS, MENU_SKY_H, menuPixelScale, paintHills, paintSky } from '../render/uiArt';
import { resolveShortcut, shortcutFlags } from '../ui/input/shortcuts';
import { MENU_BUTTON, layoutMenu } from '../ui/menuLayout';
import { openHelp } from './helpLauncher';
import {
  addUiText,
  createButton,
  createPanel,
  FONT_TITLE,
  frameBorder,
  textStyle,
  type Button,
  type UiBox,
} from '../ui/theme';
import { LoadGuard, resumeTarget } from '../ui/resumeModel';
import { SCENES } from './keys';
import type { RealmData } from './RealmScene';
import { getSession, takeStorageWarning } from './sessionRegistry';

const TITLE = 'Crowned Kingdoms';
const SUBTITLE = 'Một vương quốc nhỏ, chín ngai vàng';
const SKY_KEY = 'menu-sky';
const hillKey = (layer: number): string => `menu-hills-${layer}`;
/** Drift speed of each hill layer, far → near (screen px per second). */
const PARALLAX = [4, 8, 16] as const;
const FIREFLIES = 24;

/**
 * One §10.2 menu button. Buttons of features that do not exist yet are simply not listed
 * ("Vương Miện" G4, "Cài đặt" G5). "Tiếp tục" starts disabled and is enabled once a valid
 * saved run has loaded; "Ván mới" opens the king select.
 */
interface MenuEntry {
  readonly label: string;
  readonly enabled: boolean;
  readonly onClick: (scene: MainMenuScene) => void;
}

/** A fresh run seed; scenes may use wall-clock randomness (the run itself is seeded). */
export const newRunSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;

const MENU_ENTRIES: readonly MenuEntry[] = [
  {
    label: 'Tiếp tục',
    enabled: false,
    onClick: (scene) => scene.resume(),
  },
  {
    label: 'Ván mới',
    enabled: true,
    onClick: (scene) => {
      scene.scene.start(SCENES.kingSelect);
    },
  },
  {
    label: 'Trợ giúp',
    enabled: true,
    onClick: (scene) => openHelp(scene, null, null),
  },
];

export class MainMenuScene extends Phaser.Scene {
  private pix = 2;
  private sky!: Phaser.GameObjects.TileSprite;
  private hills: Phaser.GameObjects.TileSprite[] = [];
  private fireflies: Phaser.GameObjects.Image[] = [];
  private logo!: UiBox;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private notice!: Phaser.GameObjects.Text;
  /** Saved run waiting behind "Tiếp tục"; null while loading or when there is none. */
  private saved: RunState | null = null;
  /** A load that resolves for an older create (or after shutdown) is ignored. */
  private readonly guard = new LoadGuard();

  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    this.hills = [];
    this.fireflies = [];
    this.buttons = [];
    this.pix = menuPixelScale(this.scale.height);
    this.cameras.main.setBackgroundColor(toCss(UI_PALETTE.sky[3]));

    // Dithered dusk sky, three drifting hill silhouettes, fireflies.
    addPixelTexture(this.textures, SKY_KEY, paintSky());
    HILL_LAYERS.forEach((_, i) => addPixelTexture(this.textures, hillKey(i), paintHills(i)));
    this.sky = this.add.tileSprite(0, 0, 4, MENU_SKY_H, SKY_KEY).setOrigin(0, 0);
    this.hills = HILL_LAYERS.map((layer, i) =>
      this.add.tileSprite(0, 0, 4, layer.height, hillKey(i)).setOrigin(0, 1),
    );
    this.createFireflies();

    // Logo board.
    this.logo = createPanel(this, 'panel', 200, 100, 0.5, 0.5);
    this.title = this.add
      .text(0, 0, TITLE, {
        ...textStyle(48, UI_PALETTE.text, FONT_TITLE),
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setShadow(2, 2, toCss(UI_PALETTE.textShadow), 0, false, true);
    this.subtitle = addUiText(this, 0, 0, SUBTITLE, 14).setOrigin(0.5, 0).setAlign('center');

    this.buttons = MENU_ENTRIES.map((entry) => {
      const button = createButton(this, 0, 0, entry.label, {
        width: MENU_BUTTON.w,
        height: MENU_BUTTON.h,
        fontSize: 18,
        onClick: () => entry.onClick(this),
      });
      button.setEnabled(entry.enabled);
      return button;
    });
    this.footer = this.add
      .text(0, 0, `v${__APP_VERSION__}`, textStyle(11, UI_PALETTE.creamLight))
      .setOrigin(0.5);
    this.notice = this.add
      .text(0, 0, takeStorageWarning(this) ?? '', textStyle(13, UI_PALETTE.creamLight))
      .setOrigin(0.5, 1)
      .setAlign('center');
    this.saved = null;
    this.loadSaved(this.guard.begin());

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
      this.guard.invalidate();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private onKey(event: KeyboardEvent): void {
    if (resolveShortcut(event.key, 'menu', shortcutFlags(event)) !== 'help.toggle') return;
    event.preventDefault();
    openHelp(this, null, null);
  }

  /** Reads the saved run; the answer is dropped if the menu was left or reopened meanwhile. */
  private loadSaved(token: number): void {
    const session = getSession(this);
    if (!session) return;
    void session.load().then((result) => {
      if (!this.guard.isCurrent(token)) return;
      const target = resumeTarget(result);
      this.saved = target.state;
      this.buttons[0]?.setEnabled(target.enabled);
      if (target.warning !== null) this.showNotice(target.warning);
    });
  }

  private showNotice(text: string): void {
    this.notice.setText(text);
    this.layout();
  }

  /** "Tiếp tục": open the saved run exactly as it was written. */
  resume(): void {
    if (this.saved === null) return;
    const data: RealmData = { resume: this.saved };
    this.scene.start(SCENES.realm, data);
  }

  update(_time: number, delta: number): void {
    this.hills.forEach((hill, i) => {
      hill.tilePositionX += ((PARALLAX[i] ?? 0) * delta) / 1000 / this.pix;
    });
  }

  private layout(): void {
    const { width, height } = this.scale;

    this.pix = menuPixelScale(height);
    const texW = Math.ceil(width / this.pix) + 1;
    this.sky.setSize(texW, MENU_SKY_H).setScale(this.pix);
    this.hills.forEach((hill, i) =>
      hill.setSize(texW, HILL_LAYERS[i]!.height).setScale(this.pix).setPosition(0, height),
    );
    for (const fly of this.fireflies) fly.setScale(this.pix);

    // Logo board size from its text (title size: same clamp as before).
    const inset = frameBorder(this, 'panel') + 16;
    const titleSize = Phaser.Math.Clamp(Math.floor(width / 14), 28, 64);
    this.title.setFontSize(titleSize);
    this.subtitle.setWordWrapWidth(Math.min(520, width - 32 - inset * 2));
    const logoW = Math.min(width - 16, Math.max(this.title.width, this.subtitle.width) + inset * 2);
    const logoH = inset * 2 + this.title.height + 4 + this.subtitle.height;

    const m = layoutMenu({ w: width, h: height }, { w: logoW, h: logoH }, this.buttons.length);
    this.logo.resize(logoW, logoH);
    this.logo.image.setPosition(m.logo.x, m.logo.y);
    const logoTop = m.logo.y - logoH / 2;
    this.title.setPosition(m.logo.x, logoTop + inset + this.title.height / 2);
    this.subtitle.setPosition(m.logo.x, logoTop + inset + this.title.height + 4);
    this.buttons.forEach((button, i) => {
      const at = m.buttons[i]!;
      button.container.setPosition(at.x, at.y);
    });
    this.footer.setPosition(m.footer.x, m.footer.y);
    this.notice.setWordWrapWidth(Math.max(120, width - 32));
    this.notice.setPosition(m.footer.x, m.footer.y - 18);
  }

  /** Fireflies drift over the hills; one that wanders off screen comes back elsewhere. */
  private createFireflies(): void {
    for (let i = 0; i < FIREFLIES; i++) {
      const fly = this.add.image(0, 0, UI_KEY, 'firefly').setScale(this.pix);
      this.fireflies.push(fly);
      this.tweens.add({
        targets: fly,
        alpha: { from: 0.15, to: 1 },
        duration: Phaser.Math.Between(500, 1500),
        delay: Phaser.Math.Between(0, 1500),
        yoyo: true,
        repeat: -1,
      });
      this.respawn(fly);
      this.wander(fly);
    }
  }

  private respawn(fly: Phaser.GameObjects.Image): void {
    const { width, height } = this.scale;
    fly.setPosition(
      Phaser.Math.Between(0, width),
      Phaser.Math.Between(Math.floor(height * 0.3), height),
    );
  }

  private wander(fly: Phaser.GameObjects.Image): void {
    const { width, height } = this.scale;
    if (fly.x < -8 || fly.x > width + 8 || fly.y < -8 || fly.y > height + 8) this.respawn(fly);
    this.tweens.add({
      targets: fly,
      x: fly.x + Phaser.Math.Between(-60, 60),
      y: fly.y + Phaser.Math.Between(-40, 30),
      duration: Phaser.Math.Between(2000, 4000),
      ease: 'Sine.easeInOut',
      onComplete: () => this.wander(fly),
    });
  }
}
