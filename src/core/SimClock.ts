/**
 * Fixed-timestep clock. Rendering runs at whatever FPS the device manages; the
 * simulation always advances in whole ticks of TICK_MS so results are deterministic
 * and identical across machines.
 */
export const TICKS_PER_SECOND = 10;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

/** 0 = paused (active pause), then 1×, 2×, 3×. */
export const GAME_SPEEDS = [0, 1, 2, 3] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

/** Never simulate more than this many ticks per frame (spiral-of-death guard). */
const MAX_TICKS_PER_FRAME = 12;

export class SimClock {
  private accumulator = 0;
  private _tick = 0;
  private _speed: GameSpeed = 1;
  private speedBeforePause: GameSpeed = 1;

  get tick(): number {
    return this._tick;
  }

  get speed(): GameSpeed {
    return this._speed;
  }

  get paused(): boolean {
    return this._speed === 0;
  }

  setSpeed(speed: GameSpeed): void {
    if (speed !== 0) this.speedBeforePause = speed;
    this._speed = speed;
  }

  togglePause(): void {
    this.setSpeed(this.paused ? this.speedBeforePause : 0);
  }

  /**
   * Advance by real elapsed time and return how many sim ticks should run now.
   * Fractional leftovers carry over to the next frame.
   */
  advance(realDeltaMs: number): number {
    if (this.paused) return 0;
    this.accumulator += Math.max(0, realDeltaMs) * this._speed;
    let ticks = Math.floor(this.accumulator / TICK_MS);
    if (ticks > MAX_TICKS_PER_FRAME) {
      ticks = MAX_TICKS_PER_FRAME;
      this.accumulator = 0;
    } else {
      this.accumulator -= ticks * TICK_MS;
    }
    this._tick += ticks;
    return ticks;
  }

  /** 0..1 progress towards the next tick, for smooth render interpolation. */
  get alpha(): number {
    return this.accumulator / TICK_MS;
  }

  restore(tick: number): void {
    this._tick = tick;
    this.accumulator = 0;
  }
}
