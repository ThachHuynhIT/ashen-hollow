import Phaser from 'phaser';
import { PALETTE, toCss } from '../data/palette';
import { createButton, FONT_TITLE, textStyle, type Button } from '../ui/theme';
import { SCENES } from './keys';

/**
 * Temporary menu while the colony sim is gone: the title and one disabled "Ván mới"
 * button. Replaced by the Stardew-style menu later in G0.
 */
export class MainMenuScene extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private newRunButton!: Button;

  constructor() {
    super(SCENES.mainMenu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));
    this.title = this.add
      .text(0, 0, 'Chín Vương Miện', {
        ...textStyle(40, PALETTE.parchment, FONT_TITLE),
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.newRunButton = createButton(this, 0, 0, 'Ván mới — Sắp có', {
      width: 200,
      height: 52,
      fontSize: 18,
      onClick: () => undefined,
    });
    this.newRunButton.container.setAlpha(0.5);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.title.setPosition(width / 2, height / 3);
    this.newRunButton.container.setPosition(width / 2, height / 2 + 26);
  }
}
