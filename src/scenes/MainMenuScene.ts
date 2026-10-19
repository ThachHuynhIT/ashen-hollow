import Phaser from 'phaser';
import { toCss } from '../data/palette';
import { UI_PALETTE } from '../data/uiPalette';
import { UI_KEY, addPixelTexture } from '../render/atlas';
import { HILL_LAYERS, MENU_SKY_H, menuPixelScale, paintHills, paintSky } from '../render/uiArt';
import { MENU_BUTTON, layoutMenu } from '../ui/menuLayout';
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
import { SCENES } from './keys';

const TITLE = 'Crowned Kingdoms';
const SUBTITLE = 'Một vương quốc nhỏ, chín ngai vàng';
const SKY_KEY = 'menu-sky';
const hillKey = (layer: number): string => `menu-hills-${layer}`;
/** Drift speed of each hill layer, far → near (screen px per second). */
const PARALLAX = [4, 8, 16] as const;
const FIREFLIES = 24;

/**
 * One §10.2 menu button. Buttons of features that do not exist yet are simply not listed
 * ("Tiếp tục" G3, "Vương Miện" G4, "Cài đặt" G5). G0 lists "Ván mới" disabled ("Sắp có")
 * because King select / Realm arrive in G1.
 */
interface MenuEntry {
  readonly label: string;
  readonly enabled: boolean;
  readonly onClick: () => void;
}

const MENU_ENTRIES: readonly MenuEntry[] = [
  { label: 'Ván mới — Sắp có', enabled: false, onClick: () => undefined },
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
        onClick: entry.onClick,
      });
      button.setEnabled(entry.enabled);
      return button;
    });
    this.footer = this.add
      .text(0, 0, `v${__APP_VERSION__}`, textStyle(11, UI_PALETTE.creamLight))
      .setOrigin(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
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
