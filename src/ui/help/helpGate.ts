import type Phaser from 'phaser';

/** Cờ "Trợ giúp đang mở" của một game: scene dưới kiểm cờ này trước khi xử lý phím hoặc chuột. */
export class HelpGate {
  private openFlag = false;

  get isOpen(): boolean {
    return this.openFlag;
  }

  /** Mở; false nếu đã mở. */
  open(): boolean {
    if (this.openFlag) return false;
    this.openFlag = true;
    return true;
  }

  close(): void {
    this.openFlag = false;
  }
}

const GATES = new WeakMap<Phaser.Game, HelpGate>();

/** Cổng riêng của game này (không nằm trong session/save). */
export const getHelpGate = (game: Phaser.Game): HelpGate => {
  let gate = GATES.get(game);
  if (!gate) {
    gate = new HelpGate();
    GATES.set(game, gate);
  }
  return gate;
};
