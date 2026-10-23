/** Nối bus với RunState + BattleRunner: nhận `ui:command`, phát `run:*` / `battle:*` (spec §12.5). */
import type { EventBus } from '../../core/events';
import { SimClock, type GameSpeed } from '../../core/SimClock';
import { BattleRunner } from '../battle/BattleRunner';
import type { Content } from '../cards/registry';
import type { GameEvents } from '../events';
import type { SessionPersistence } from '../save/types';
import { buildBattleSetup } from './battleSetup';
import { applyCommand } from './commands';
import { hasPlayableCard } from './playable';
import type { RunCommand, RunState } from './state';

/**
 * Tốc độ chơi (1×–3×) người chơi chọn lần gần nhất: trận sau và ván sau bắt đầu ở tốc độ này.
 * Chỉ ảnh hưởng nhịp hiển thị, không ảnh hưởng mô phỏng; tạm dừng không được nhớ.
 */
let rememberedSpeed: GameSpeed = 1;

export class RunController {
  private current: RunState;
  private active: BattleRunner | null = null;
  private readonly unsubscribe: (() => void)[];
  /** Hàng đợi lệnh khi có `persistence`: mỗi lệnh áp dụng, lưu xong rồi mới phát sự kiện. */
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly content: Content,
    initial: RunState,
    private readonly persistence?: SessionPersistence,
  ) {
    this.current = initial;
    this.unsubscribe = [
      bus.on('ui:command', ({ command }) => this.handle(command)),
      bus.on('clock:speed', ({ speed }) => {
        if (speed !== 0 && this.active !== null) rememberedSpeed = speed;
      }),
      bus.on('battle:ended', ({ result }) => {
        if (this.active === null) return; // stray event: no battle in progress
        this.active?.dispose();
        this.active = null;
        this.handle({ type: 'battleResult', result });
      }),
    ];
  }

  get state(): RunState {
    return this.current;
  }

  get runner(): BattleRunner | null {
    return this.active;
  }

  /**
   * Kiểm tra tự vào trận cho trạng thái hiện tại (ví dụ đầu ván, khi không lá nào có mục tiêu).
   * Gọi sau khi scene đã đăng ký xong các sự kiện bus.
   */
  kickoff(): void {
    if (this.active !== null) return;
    if (this.current.phase === 'battle') this.startRunner(); // ván tải lại giữa trận: dựng lại trận từ tick 0
    else if (this.shouldAutoStart()) this.handle({ type: 'startBattle' });
  }

  /** Lưu trạng thái đầu của ván mới (không gọi khi tiếp tục ván cũ: không ghi đè checkpoint). */
  checkpointInitial(): Promise<void> {
    return this.persistence ? this.persistence.checkpoint(this.current).catch(() => undefined) : Promise.resolve();
  }

  /** Xong khi mọi lệnh đã nhận được xử lý và ghi. */
  async whenIdle(): Promise<void> {
    let seen: Promise<void>;
    do {
      seen = this.queue;
      await seen;
    } while (seen !== this.queue);
    await this.persistence?.flush();
  }

  update(deltaMs: number): void {
    this.active?.update(deltaMs);
  }

  dispose(): void {
    this.disposed = true; // lệnh đã xếp hàng vẫn được lưu, nhưng không phát sự kiện nữa
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.active?.dispose();
    this.active = null;
  }

  private handle(command: RunCommand): void {
    if (this.disposed) return;
    if (!this.persistence) {
      this.process(command);
      return;
    }
    // A handler that throws must not poison the queue: log it and carry on with the next command.
    this.queue = this.queue.then(() => this.process(command)).catch((e: unknown) => {
      console.error('RunController: command failed', command.type, e);
    });
  }

  /** Áp dụng một lệnh; có `persistence` thì lưu xong mới phát `run:state` / bắt đầu trận. */
  private process(command: RunCommand): void | Promise<void> {
    const before = this.current.phase;
    const result = applyCommand(this.current, command, this.content);
    if ('error' in result) {
      if (!this.disposed) this.bus.emit('run:illegal', { reason: result.error });
      return;
    }
    this.current = result.state;
    const finish = (): void => {
      if (this.disposed) return;
      this.bus.emit('run:state', { state: this.current });
      for (const event of result.events) {
        if (event.type === 'runEnded') {
          // G4 (meta-progression) fills crownPoints and unlocks.
          this.bus.emit('run:ended', { won: event.won, crownPoints: 0, unlocks: [] });
        }
      }
      if (command.type === 'setAutoFire') this.active?.setAutoFire(command.on);
      if (command.type === 'startBattle') this.startRunner();
      else if (this.shouldAutoStart()) this.handle({ type: 'startBattle' });
    };
    // Bật / tắt tự bắn giữa trận không đổi thứ cần lưu (tải lại sẽ dựng lại trận từ đầu).
    const save = this.persistence && !(command.type === 'setAutoFire' && before === 'battle');
    if (!save) {
      finish();
      return;
    }
    return this.persistence!.checkpoint(this.current).catch(() => undefined).then(finish);
  }

  private startRunner(): void {
    const setup = buildBattleSetup(this.current, this.content);
    const clock = new SimClock();
    clock.setSpeed(rememberedSpeed);
    this.active = new BattleRunner(setup, this.bus, clock);
    this.bus.emit('battle:started', { setup });
  }

  /** Luật G1 (`autoStart`): đã chơi/bán thẻ, hoặc không lá nào trên tay có mục tiêu. */
  private shouldAutoStart(): boolean {
    const s = this.current;
    return (
      s.rules.autoStart &&
      s.phase === 'planning' &&
      (s.played || !hasPlayableCard(s, this.content))
    );
  }
}
