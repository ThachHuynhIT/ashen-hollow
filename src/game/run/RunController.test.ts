import { describe, expect, it } from 'vitest';
import { RULES_G1 } from '../../data/rules';
import { CONTENT } from '../cards/registry';
import { createGameBus } from '../events';
import { runState } from '../testing/fixtures';
import { RunController } from './RunController';
import type { BattleResult } from '../battle/types';
import type { RunState } from './state';
import { startYear } from './yearFlow';

const setup = (initial: RunState = runState()) => {
  const bus = createGameBus();
  const controller = new RunController(bus, CONTENT, initial);
  const states: RunState[] = [];
  bus.on('run:state', (p) => states.push(p.state));
  return { bus, controller, states };
};

const runBattle = (bus: ReturnType<typeof createGameBus>, controller: RunController): number => {
  let ended = 0;
  bus.on('battle:ended', () => (ended += 1));
  for (let i = 0; i < 1000 && ended === 0; i++) controller.update(100);
  return ended;
};

const allOpenHand = (): RunState => {
  const s = runState({ hand: ['neutral_clear_land'] });
  return { ...s, plots: s.plots.map((p) => ({ ...p, unlocked: true })) };
};

describe('RunController auto-start', () => {
  it('starts the battle right after the action when rules.autoStart is on', () => {
    const { bus, controller } = setup();
    const started: number[] = [];
    bus.on('battle:started', (p) => started.push(p.setup.year));
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(started).toEqual([1]);
    expect(controller.state.phase).toBe('battle');
    expect(controller.runner).not.toBeNull();
  });

  it('waits for startBattle when rules.autoStart is off', () => {
    const bus = createGameBus();
    const controller = new RunController(
      bus,
      CONTENT,
      runState({ rules: { ...RULES_G1, autoStart: false } }),
    );
    const started: number[] = [];
    bus.on('battle:started', (p) => started.push(p.setup.year));
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(started).toEqual([]);
    expect(controller.state.phase).toBe('planning');
    controller.kickoff();
    expect(started).toEqual([]);
    bus.emit('ui:command', { command: { type: 'startBattle' } });
    expect(started).toEqual([1]);
  });

  it('kickoff starts a battle once when no card in hand has a target', () => {
    const bus = createGameBus();
    const controller = new RunController(bus, CONTENT, allOpenHand());
    const started: number[] = [];
    bus.on('battle:started', (p) => started.push(p.setup.year));
    controller.kickoff();
    controller.kickoff();
    expect(started).toEqual([1]);
    expect(controller.state.phase).toBe('battle');
  });

  it('kickoff does nothing while some card is playable', () => {
    const bus = createGameBus();
    const controller = new RunController(bus, CONTENT, runState({ hand: ['wheat_militia'] }));
    const started: number[] = [];
    bus.on('battle:started', () => started.push(1));
    controller.kickoff();
    expect(started).toEqual([]);
    expect(controller.state.phase).toBe('planning');
  });

  it('forwards setAutoFire to the running battle and records it in the state', () => {
    const { bus, controller } = setup();
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    bus.emit('ui:command', { command: { type: 'setAutoFire', on: true } });
    expect(controller.state.autoFire).toBe(true);
    for (let i = 0; i < 40; i++) controller.update(100);
    expect(controller.runner!.world.autoFire).toBe(true);
    expect(controller.runner!.world.interventionsUsed).toBeGreaterThanOrEqual(1);
  });
});

describe('RunController', () => {
  it('valid play emits run:state with played true', () => {
    const { bus, controller, states } = setup();
    expect(controller.state.hand.length).toBeGreaterThan(0);
    for (let plot = 0; plot < 25 && states.length === 0; plot++) {
      bus.emit('ui:command', {
        command: { type: 'play', handIndex: 0, target: { kind: 'plot', plot } },
      });
    }
    // with autoStart (G1) the play is followed by the battle starting
    expect(states).toHaveLength(2);
    expect(states[0]!.played).toBe(true);
    expect(states[1]!.phase).toBe('battle');
    expect(controller.state).toBe(states[1]);
  });

  it('illegal command emits run:illegal and keeps state', () => {
    const { bus, controller, states } = setup();
    const before = controller.state;
    const reasons: string[] = [];
    bus.on('run:illegal', (p) => reasons.push(p.reason));
    bus.emit('ui:command', { command: { type: 'startBattle' } });
    expect(reasons).toEqual(['notPlayed']);
    expect(controller.state).toBe(before);
    expect(states).toHaveLength(0);
  });

  it('startBattle creates a runner and emits battle:started', () => {
    const { bus, controller } = setup();
    const years: number[] = [];
    bus.on('battle:started', (p) => years.push(p.setup.year));
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(years).toEqual([1]);
    expect(controller.runner).not.toBeNull();
    expect(controller.state.phase).toBe('battle');
  });

  it('runs a battle to the end and applies the result', () => {
    const { bus, controller, states } = setup();
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(runBattle(bus, controller)).toBe(1);
    expect(['reward', 'yearEnd', 'ended']).toContain(states[states.length - 1]!.phase);
    expect(controller.runner).toBeNull();
  });

  it('losing the last life emits run:ended { won: false } after run:state', () => {
    // Phụ thuộc vào bố trí này: năm 5, 1 mạng, bàn trống — Ngai một mình không thể thắng.
    // Cân bằng lại đạo quân năm 5 hoặc chỉ số Ngai có thể làm test này hỏng.
    const { bus, controller } = setup(startYear(runState({ lives: 1, year: 4 }), CONTENT));
    const order: string[] = [];
    const ended: { won: boolean; crownPoints: number; unlocks: string[] }[] = [];
    bus.on('run:state', () => order.push('state'));
    bus.on('run:ended', (p) => {
      order.push('ended');
      ended.push(p);
    });
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    runBattle(bus, controller);
    expect(controller.state.phase).toBe('ended');
    expect(order.slice(-2)).toEqual(['state', 'ended']);
    expect(ended).toEqual([{ won: false, crownPoints: 0, unlocks: [] }]);
  });

  it('dispose stops handling ui:command', () => {
    const { bus, controller, states } = setup();
    const before = controller.state;
    const emitted: string[] = [];
    bus.on('run:illegal', () => emitted.push('illegal'));
    controller.dispose();
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(states).toHaveLength(0);
    expect(emitted).toEqual([]);
    expect(controller.state).toBe(before);
  });

  it('dispose stops handling battle:ended and disposes the active runner', () => {
    const { bus, controller, states } = setup();
    let result: BattleResult | null = null;
    bus.on('battle:ended', (p) => (result = p.result));
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    runBattle(bus, controller);
    // thu một kết quả thật rồi dựng lại ván đang đánh
    const { bus: bus2, controller: c2, states: s2 } = setup();
    bus2.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    const runner = c2.runner!;
    const before = c2.state;
    const n = s2.length;
    c2.dispose();
    bus2.emit('battle:ended', { result: result! });
    bus2.emit('ui:set-speed', { speed: 3 });
    expect(c2.state).toBe(before);
    expect(s2).toHaveLength(n);
    expect(runner.clock.speed).toBe(1);
    expect(states.length).toBeGreaterThan(0);
  });

  it('keeps the speed chosen in one battle for the next battle and for a fresh controller', () => {
    const { bus, controller } = setup();
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    bus.emit('ui:set-speed', { speed: 3 });
    expect(controller.runner!.clock.speed).toBe(3);
    runBattle(bus, controller);
    const { bus: bus2, controller: c2 } = setup();
    bus2.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(c2.runner!.clock.speed).toBe(3);
    bus2.emit('ui:set-speed', { speed: 1 });
  });

  it('does not carry a pause into the next battle', () => {
    const { bus, controller } = setup();
    bus.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    bus.emit('ui:set-speed', { speed: 2 });
    bus.emit('ui:toggle-pause', {});
    expect(controller.runner!.clock.speed).toBe(0);
    const { bus: bus2, controller: c2 } = setup();
    bus2.emit('ui:command', { command: { type: 'discard', handIndex: 0 } });
    expect(c2.runner!.clock.speed).toBe(2);
    bus.emit('ui:set-speed', { speed: 1 });
  });

  it('ignores a stray battle:ended when no battle is active', () => {
    const { bus, controller, states } = setup();
    const before = controller.state;
    const illegal: string[] = [];
    bus.on('run:illegal', () => illegal.push('illegal'));
    bus.emit('battle:ended', {
      result: {
        won: true,
        ticks: 1,
        throneHpLostPct: 0,
        kills: 0,
        killsBySource: {},
        interventionsUsed: 0,
        unitsLost: 0,
        capped: 0,
        inputs: [],
      },
    });
    expect(illegal).toEqual([]);
    expect(states).toHaveLength(0);
    expect(controller.state).toBe(before);
  });
});
