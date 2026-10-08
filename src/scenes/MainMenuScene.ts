import Phaser from 'phaser';
import { PALETTE, toCss } from '../data/palette';
import { createButton, FONT_TITLE, textStyle, type Button } from '../ui/theme';
import { SCENES, type WorldSceneData } from './keys';

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

export class MainMenuScene extends Phaser.Scene {
  private seed = randomSeed();
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private startButton!: Button;
  private rerollButton!: Button;
  private embers: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    this.seed = randomSeed();
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));

    this.createEmbers();

    this.title = this.add
      .text(0, 0, 'ASHEN HOLLOW', {
        ...textStyle(48, PALETTE.parchment, FONT_TITLE),
        fontStyle: 'bold',
        // Room for the glow so the blur isn't clipped into a visible box.
        padding: { x: 24, y: 24 },
      })
      .setOrigin(0.5)
      .setShadow(0, 0, toCss(PALETTE.ember), 18, false, true);
    this.subtitle = this.add
      .text(0, 0, 'Thung lũng bị nguyền · Dark Fantasy Colony Builder', {
        ...textStyle(14, PALETTE.boneGrey),
        align: 'center',
      })
      .setOrigin(0.5, 0);
    this.seedText = this.add.text(0, 0, '', textStyle(14, PALETTE.ashGrey)).setOrigin(0.5);
    this.footer = this.add
      .text(0, 0, `Phase 0 prototype · v${__APP_VERSION__}`, textStyle(11, PALETTE.dusk))
      .setOrigin(0.5);

    this.startButton = createButton(this, 0, 0, 'Trò chơi mới', {
      width: 220,
      height: 52,
      fontSize: 18,
      onClick: () => this.startGame(),
    });
    this.rerollButton = createButton(this, 0, 0, 'Đổi hạt giống', {
      width: 220,
      height: 44,
      fontSize: 14,
      onClick: () => {
        this.seed = randomSeed();
        this.refreshSeed();
      },
    });

    this.refreshSeed();
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
  }

  private refreshSeed(): void {
    this.seedText.setText(`Hạt giống: ${this.seed}`);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const titleSize = Phaser.Math.Clamp(Math.floor(width / 14), 28, 64);
    this.title.setFontSize(titleSize).setPosition(cx, height * 0.3);
    this.subtitle.setWordWrapWidth(width - 32).setPosition(cx, height * 0.3 + titleSize * 0.6);
    this.startButton.container.setPosition(cx, height * 0.55);
    this.rerollButton.container.setPosition(cx, height * 0.55 + 64);
    this.seedText.setPosition(cx, height * 0.55 + 112);
    this.footer.setPosition(cx, height - 20);
  }

  /** Drifting embers — cheap atmosphere until the real key art exists. */
  private createEmbers(): void {
    const colors = [PALETTE.ember, PALETTE.flame, PALETTE.emberDark, PALETTE.candle];
    for (let i = 0; i < 40; i++) {
      const size = Phaser.Math.Between(1, 3);
      const ember = this.add.rectangle(0, 0, size, size, Phaser.Utils.Array.GetRandom(colors));
      this.embers.push(ember);
      this.launchEmber(ember, true);
    }
  }

  private launchEmber(ember: Phaser.GameObjects.Rectangle, initial = false): void {
    const { width, height } = this.scale;
    const startY = initial ? Phaser.Math.Between(0, height) : height + 10;
    ember
      .setPosition(Phaser.Math.Between(0, width), startY)
      .setAlpha(Phaser.Math.FloatBetween(0.3, 1));
    this.tweens.add({
      targets: ember,
      y: startY - Phaser.Math.Between(height * 0.4, height),
      x: ember.x + Phaser.Math.Between(-60, 60),
      alpha: 0,
      duration: Phaser.Math.Between(4000, 9000),
      onComplete: () => this.launchEmber(ember),
    });
  }

  private startGame(): void {
    const data: WorldSceneData = { seed: this.seed };
    this.scene.start(SCENES.world, data);
  }
}
