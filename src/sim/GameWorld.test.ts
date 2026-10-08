import { addComponent, addEntity, query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { HexPosition } from './components';
import { createGameWorld } from './GameWorld';

describe('createGameWorld', () => {
  it('builds a map and an ECS world that can hold hex-positioned entities', () => {
    const world = createGameWorld({ seed: 7, width: 16, height: 12 });
    expect(world.map.width).toBe(16);
    expect(world.map.isPassable(world.start)).toBe(true);

    const eid = addEntity(world.ecs);
    addComponent(world.ecs, eid, HexPosition);
    HexPosition.q[eid] = world.start.q;
    HexPosition.r[eid] = world.start.r;

    const found = query(world.ecs, [HexPosition]);
    expect(Array.from(found)).toEqual([eid]);
    expect(HexPosition.q[eid]).toBe(world.start.q);
  });
});
