/** Nối bus với RunState + BattleRunner: nhận `ui:command`, phát `run:*` / `battle:*` (spec §12.5). */
import type { EventBus } from '../../core/events';
import { SimClock, type GameSpeed } from '../../core/SimClock';
import { BattleRunner } from '../battle/BattleRunner';
import type { Content } from '../cards/registry';
import type { GameEvents } from '../events';
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

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly content: Content,
    initial: RunState,
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
    if (this.active === null && this.shouldAutoStart()) this.handle({ type: 'startBattle' });
  }

  update(deltaMs: number): void {
    this.active?.update(deltaMs);
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.active?.dispose();
    this.active = null;
  }

  private handle(command: RunCommand): void {
    const result = applyCommand(this.current, command, this.content);
    if ('error' in result) {
      this.bus.emit('run:illegal', { reason: result.error });
      return;
    }
    this.current = result.state;
    this.bus.emit('run:state', { state: this.current });
    for (const event of result.events) {
      if (event.type === 'runEnded') {
        // G4 (meta-progression) fills crownPoints and unlocks.
        this.bus.emit('run:ended', { won: event.won, crownPoints: 0, unlocks: [] });
      }
    }
    if (command.type === 'setAutoFire') this.active?.setAutoFire(command.on);
    if (command.type === 'startBattle') {
      const setup = buildBattleSetup(this.current, this.content);
      const clock = new SimClock();
      clock.setSpeed(rememberedSpeed);
      this.active = new BattleRunner(setup, this.bus, clock);
      this.bus.emit('battle:started', { setup });
    } else if (this.shouldAutoStart()) {
      this.handle({ type: 'startBattle' });
    }
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
