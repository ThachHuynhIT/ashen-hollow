import { addComponent, hasComponent, removeComponent } from 'bitecs';
import {
  DESIGNATION_KINDS,
  DOODADS,
  DOODAD_IDS,
  designationIndex,
  type DesignationKind,
} from '../../data/doodads';
import { Designation, Doodad } from '../components';
import { emit } from '../events';
import type { GameWorld } from '../GameWorld';
import { rectShape, shapesOverlap, type Bounds } from '../geom';

const areaShape = (a: Bounds) =>
  rectShape((a.minX + a.maxX) / 2, (a.minY + a.maxY) / 2, a.maxX - a.minX, a.maxY - a.minY);

/** Doodads whose collider overlaps the area. */
const doodadsIn = (world: GameWorld, area: Bounds): number[] => {
  const shape = areaShape(area);
  return world.spatial.query(area).filter((eid) => {
    const o = world.obstacles.get(eid);
    return o?.type === 'doodad' && shapesOverlap(o.shape, shape);
  });
};

export const designationOf = (world: GameWorld, eid: number): DesignationKind | null =>
  hasComponent(world.ecs, eid, Designation) ? DESIGNATION_KINDS[Designation.kind[eid]!]! : null;

/** Mark every doodad in `area` that this tool applies to. Returns newly marked eids. */
export const designate = (world: GameWorld, area: Bounds, kind: DesignationKind): number[] => {
  const marked: number[] = [];
  for (const eid of doodadsIn(world, area)) {
    const def = DOODADS[DOODAD_IDS[Doodad.kind[eid]!]!];
    if (def.harvest?.tool !== kind || hasComponent(world.ecs, eid, Designation)) continue;
    addComponent(world.ecs, eid, Designation);
    Designation.kind[eid] = designationIndex(kind);
    marked.push(eid);
  }
  if (marked.length) emit(world, { type: 'designationChanged', eids: marked });
  return marked;
};

/** Clear designations in `area` (any kind). Returns the cleared eids. */
export const undesignate = (world: GameWorld, area: Bounds): number[] => {
  const cleared = doodadsIn(world, area).filter((eid) => hasComponent(world.ecs, eid, Designation));
  for (const eid of cleared) removeComponent(world.ecs, eid, Designation);
  if (cleared.length) emit(world, { type: 'designationChanged', eids: cleared });
  return cleared;
};
