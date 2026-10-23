import { describe, expect, it } from 'vitest';
import { RULES_G1 } from '../../data/rules';
import type { BattleSetup } from '../battle/types';
import { CONTENT } from '../cards/registry';
import { createGameBus } from '../events';
import { MemorySaveStore } from '../save/MemorySaveStore';
import { SaveCoordinator } from '../save/SaveCoordinator';
import type { SessionPersistence } from '../save/types';
import { runState } from '../testing/fixtures';
import { RunController } from './RunController';
import type { RunState } from './state';

/** Records every checkpoint; with `hold` each one stays pending until `release()`. */
class FakePersistence implements SessionPersistence {
  writes: RunState[] = [];
  private pending: (() => void)[] = [];
  constructor(private readonly hold = false) {}
  checkpoint(state: RunState): Promise<void> {
    this.writes.push(state);
    if (!this.hold) return Promise.resolve();
    return new Promise((resolve) => this.pending.push(resolve));
  }
  flush(): Promise<void> {
    return Promise.resolve();
  }
  release(): void {
    this.pending.shift()?.();
  }
}

const manual = (): RunState => runState({ rules: { ...RULES_G1, autoStart: false } });
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const setup = (initial: RunState, persistence: SessionPersistence) => {
  const bus = createGameBus();
  const controller = new RunController(bus, CONTENT, initial, persistence);
  const order: string[] = [];
  bus.on('run:state', ({ state }) => order.push(`state:${state.phase}`));
  bus.on('battle:started', () => order.push('battle:started'));
  bus.on('run:illegal', () => order.push('illegal'));
  return { bus, controller, order };
};

const cmd = (bus: ReturnType<typeof createGameBus>, command: Parameters<typeof bus.emit<'ui:command'>>[1]['command']) =>
  bus.emit('ui:command', { command });

describe('RunController with persistence', () => {
  it('checkpoints every successful planning command once, and an illegal one never', async () => {
    const p = new FakePersistence();
    const { bus, controller } = setup(manual(), p);
    cmd(bus, { type: 'discard', handIndex: 0 });
    await controller.whenIdle();
    expect(p.writes).toHaveLength(1);
    cmd(bus, { type: 'unlockPlot', plot: 12 }); // already open → illegal
    cmd(bus, { type: 'advance' }); // wrong phase → illegal
    await controller.whenIdle();
    expect(p.writes).toHaveLength(1);
    cmd(bus, { type: 'setAutoFire', on: true });
    await controller.whenIdle();
    expect(p.writes).toHaveLength(2);
  });

  it('checkpointInitial writes the starting state once; kickoff of a planning state writes nothing more', async () => {
    const p = new FakePersistence();
    const { controller } = setup(manual(), p);
    await controller.checkpointInitial();
    controller.kickoff();
    await controller.whenIdle();
    expect(p.writes).toHaveLength(1);
    expect(p.writes[0]!.phase).toBe('planning');
  });

  it('writes the battle entry before tick 0: no runner and no battle:started until the write completes', async () => {
    const p = new FakePersistence(true);
    const { bus, controller, order } = setup(manual(), p);
    cmd(bus, { type: 'discard', handIndex: 0 });
    await tick();
    p.release();
    await controller.whenIdle();
    cmd(bus, { type: 'startBattle' });
    await tick();
    expect(p.writes.at(-1)!.phase).toBe('battle');
    expect(controller.runner).toBeNull();
    controller.update(500); // no runner yet: nothing may tick
    expect(order).not.toContain('battle:started');
    p.release();
    await controller.whenIdle();
    expect(controller.runner).not.toBeNull();
    expect(controller.runner!.world.tick).toBe(0);
    expect(order.slice(-2)).toEqual(['state:battle', 'battle:started']);
  });

  it('writes the battle result before the new phase is announced, and not on ticks, speed, intervene or auto-fire', async () => {
    const p = new FakePersistence();
    const { bus, controller, order } = setup(manual(), p);
    cmd(bus, { type: 'discard', handIndex: 0 });
    cmd(bus, { type: 'startBattle' });
    await controller.whenIdle();
    const afterEntry = p.writes.length;
    bus.emit('ui:set-speed', { speed: 2 });
    bus.emit('clock:speed', { speed: 2 });
    cmd(bus, { type: 'setAutoFire', on: false });
    bus.emit('ui:intervene', { x: 100, y: 100 });
    let ended = 0;
    bus.on('battle:ended', () => (ended += 1));
    for (let i = 0; i < 2000 && ended === 0; i++) controller.update(100);
    expect(ended).toBe(1);
    expect(p.writes.length).toBe(afterEntry); // ticks/speed/intervene/toggle wrote nothing
    await controller.whenIdle();
    expect(p.writes.length).toBe(afterEntry + 1);
    expect(p.writes.at(-1)!.phase).not.toBe('battle');
    expect(order.at(-1)).toBe(`state:${controller.state.phase}`);
  });

  it('two quick commands apply and write in order without losing state', async () => {
    const p = new FakePersistence(true);
    const { bus, controller } = setup(manual(), p);
    const hand = controller.state.hand.length;
    cmd(bus, { type: 'discard', handIndex: 0 });
    cmd(bus, { type: 'setAutoFire', on: true });
    await tick();
    expect(p.writes).toHaveLength(1);
    p.release();
    await tick();
    expect(p.writes).toHaveLength(2);
    p.release();
    await controller.whenIdle();
    expect(p.writes[0]!.autoFire).not.toBe(true);
    expect(p.writes[1]!.autoFire).toBe(true);
    expect(p.writes[1]!.played).toBe(true);
    expect(controller.state.hand.length).toBeLessThan(hand + 1);
  });

  it('clones: a later command does not change an earlier written snapshot', async () => {
    const p = new FakePersistence();
    const { bus, controller } = setup(manual(), p);
    cmd(bus, { type: 'discard', handIndex: 0 });
    cmd(bus, { type: 'setAutoFire', on: true });
    await controller.whenIdle();
    expect(p.writes[0]!.autoFire).toBe(false);
  });

  it('dispose stops new input but a write already queued still completes', async () => {
    const store = new MemorySaveStore();
    const persistence = new SaveCoordinator(store, CONTENT);
    const { bus, controller } = setup(manual(), persistence);
    cmd(bus, { type: 'discard', handIndex: 0 });
    controller.dispose();
    cmd(bus, { type: 'setAutoFire', on: true }); // ignored: no listener, no write
    await controller.whenIdle();
    const saved = (await store.loadRun()) as { state: RunState };
    expect(saved.state.played).toBe(true);
    expect(saved.state.autoFire).not.toBe(true);
  });

  it('a loaded battle restarts from tick 0 with the same setup, builds one runner and writes nothing', async () => {
    const first = new FakePersistence();
    const a = setup(manual(), first);
    const firstSetups: BattleSetup[] = [];
    a.bus.on('battle:started', ({ setup: s }) => firstSetups.push(s));
    cmd(a.bus, { type: 'discard', handIndex: 0 });
    cmd(a.bus, { type: 'startBattle' });
    await a.controller.whenIdle();
    for (let i = 0; i < 5; i++) a.controller.update(100); // mid-battle
    const saved = first.writes.at(-1)!; // what the disk holds: the entry state
    expect(saved.phase).toBe('battle');

    const second = new FakePersistence();
    const b = setup(structuredClone(saved), second);
    const secondSetups: BattleSetup[] = [];
    b.bus.on('battle:started', ({ setup: s }) => secondSetups.push(s));
    b.controller.kickoff();
    b.controller.kickoff();
    await b.controller.whenIdle();
    expect(secondSetups).toHaveLength(1);
    expect(secondSetups[0]).toEqual(firstSetups[0]);
    expect(b.controller.runner!.world.tick).toBe(0);
    expect(second.writes).toHaveLength(0);
  });

  it('a loaded result modal does not roll, draw or pay again', async () => {
    const p = new FakePersistence();
    const { bus, controller } = setup(manual(), p);
    cmd(bus, { type: 'discard', handIndex: 0 });
    cmd(bus, { type: 'startBattle' });
    await controller.whenIdle();
    let ended = 0;
    bus.on('battle:ended', () => (ended += 1));
    for (let i = 0; i < 2000 && ended === 0; i++) controller.update(100);
    await controller.whenIdle();
    const saved = p.writes.at(-1)!;
    const reload = setup(structuredClone(saved), new FakePersistence());
    reload.controller.kickoff();
    await reload.controller.whenIdle();
    expect(reload.controller.state).toEqual(saved);
  });
});

describe('RunController without persistence', () => {
  it('stays synchronous: the state and the battle are there right after the command', () => {
    const bus = createGameBus();
    const controller = new RunController(bus, CONTENT, runState());
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(controller.state.phase).toBe('battle');
    expect(controller.runner).not.toBeNull();
  });
});
