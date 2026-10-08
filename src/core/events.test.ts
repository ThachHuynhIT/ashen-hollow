import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events';

interface TestEvents {
  ping: { n: number };
}

describe('EventBus', () => {
  it('delivers payloads and unsubscribes', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const off = bus.on('ping', handler);
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it('tolerates handlers removing themselves mid-emit', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const off = bus.on('ping', () => off());
    bus.on('ping', second);
    bus.emit('ping', { n: 1 });
    expect(second).toHaveBeenCalledOnce();
  });
});
