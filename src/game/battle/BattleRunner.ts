/** Chạy một trận theo SimClock: tick cố định, hàng chờ can thiệp, sự kiện ra bus (spec §8.10). */
import type { EventBus } from '../../core/events';
import { SimClock, TICKS_PER_SECOND } from '../../core/SimClock';
import type { GameEvents } from '../events';
import { battleResult, stepBattle } from './step';
import type { BattleInput, BattleResult, BattleSetup } from './types';
import { createBattle, type BattleWorld } from './world';

export class BattleRunner {
  readonly world: BattleWorld;
  readonly clock: SimClock;
  private readonly bus: EventBus<GameEvents>;
  private queue: BattleInput[] = [];
  private finished: BattleResult | null = null;
  private disposed = false;
  private readonly unsubscribe: (() => void)[];

  constructor(setup: BattleSetup, bus: EventBus<GameEvents>, clock: SimClock = new SimClock()) {
    this.world = createBattle(setup);
    this.bus = bus;
    this.clock = clock;
    this.unsubscribe = [
      bus.on('ui:set-speed', ({ speed }) => {
        this.clock.setSpeed(speed);
        this.bus.emit('clock:speed', { speed: this.clock.speed });
      }),
      bus.on('ui:toggle-pause', () => {
        this.clock.togglePause();
        this.bus.emit('clock:speed', { speed: this.clock.speed });
      }),
      bus.on('ui:intervene', ({ x, y }) => this.intervene(x, y)),
    ];
  }

  get result(): BattleResult | null {
    return this.finished;
  }

  /** Xếp lệnh can thiệp cho tick kế tiếp được chạy (kể cả khi đang tạm dừng). */
  intervene(x: number, y: number): void {
    if (this.finished !== null || this.disposed) return;
    this.queue.push({ tick: this.world.tick, x, y });
  }

  update(deltaMs: number): void {
    if (this.finished !== null || this.disposed) return;
    const ticks = this.clock.advance(deltaMs);
    for (let i = 0; i < ticks; i++) {
      const tick = this.world.tick;
      const inputs = this.queue.filter((q) => q.tick === tick);
      this.queue = this.queue.filter((q) => q.tick > tick);
      stepBattle(this.world, inputs);
      if (this.world.tick % TICKS_PER_SECOND === 0) {
        this.bus.emit('battle:tick', { tick: this.world.tick });
      }
      const result = battleResult(this.world);
      if (result !== null) {
        this.finished = result;
        this.bus.emit('battle:ended', { result });
        return;
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
  }
}
