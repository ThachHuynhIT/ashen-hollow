import { describe, expect, it } from 'vitest';
import { CONTENT } from '../cards/registry';
import { createGameBus } from '../events';
import { runState } from '../testing/fixtures';
import { RunController } from './RunController';
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

describe('RunController', () => {
  it('valid play emits run:state with played true', () => {
    const { bus, controller, states } = setup();
    expect(controller.state.hand.length).toBeGreaterThan(0);
    for (let plot = 0; plot < 25 && states.length === 0; plot++) {
      bus.emit('ui:command', {
        command: { type: 'play', handIndex: 0, target: { kind: 'plot', plot } },
      });
    }
    expect(states).toHaveLength(1);
    expect(states[0]!.played).toBe(true);
    expect(controller.state).toBe(states[0]);
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
    bus.emit('ui:command', { command: { type: 'skip' } });
    bus.emit('ui:command', { command: { type: 'startBattle' } });
    expect(years).toEqual([1]);
    expect(controller.runner).not.toBeNull();
    expect(controller.state.phase).toBe('battle');
  });

  it('runs a battle to the end and applies the result', () => {
    const { bus, controller, states } = setup();
    bus.emit('ui:command', { command: { type: 'skip' } });
    bus.emit('ui:command', { command: { type: 'startBattle' } });
    expect(runBattle(bus, controller)).toBe(1);
    expect(['reward', 'yearEnd', 'ended']).toContain(states[states.length - 1]!.phase);
    expect(controller.runner).toBeNull();
  });

  it('losing the last life emits run:ended { won: false } after run:state', () => {
    // Năm 5, 1 mạng, bàn trống: Ngai một mình không thể thắng.
    const { bus, controller } = setup(startYear(runState({ lives: 1, year: 4 }), CONTENT));
    const order: string[] = [];
    const ended: { won: boolean; crownPoints: number; unlocks: string[] }[] = [];
    bus.on('run:state', () => order.push('state'));
    bus.on('run:ended', (p) => {
      order.push('ended');
      ended.push(p);
    });
    bus.emit('ui:command', { command: { type: 'skip' } });
    bus.emit('ui:command', { command: { type: 'startBattle' } });
    runBattle(bus, controller);
    expect(controller.state.phase).toBe('ended');
    expect(order.slice(-2)).toEqual(['state', 'ended']);
    expect(ended).toEqual([{ won: false, crownPoints: 0, unlocks: [] }]);
  });

  it('dispose stops listening and disposes the runner', () => {
    const { bus, controller, states } = setup();
    bus.emit('ui:command', { command: { type: 'skip' } });
    bus.emit('ui:command', { command: { type: 'startBattle' } });
    const runner = controller.runner!;
    const n = states.length;
    controller.dispose();
    bus.emit('ui:command', { command: { type: 'advance' } });
    bus.emit('ui:set-speed', { speed: 3 });
    expect(states).toHaveLength(n);
    expect(runner.clock.speed).toBe(1);
  });
});
