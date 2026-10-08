# Phase 1 — Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three colonists who chop, mine and forage what the player designates, haul it to storage, deliver materials to blueprints and build them, eat and sleep on their own — and die if they can't.

**Architecture:** Pure-TS simulation in `src/sim` (no Phaser), stepped at a fixed 10 ticks/s by `stepWorld` in a new `src/sim/step.ts`: needs → jobs → movement. Colonists pick work with a job board + utility scoring (`chooseJob`) and run each job as a small stage machine (`RUNNERS`). The sim reports changes through a `world.events` queue that `WorldScene` drains to update sprites and the HUD.

**Tech Stack:** TypeScript (strict) · Phaser 4.2 · bitECS 0.4 · Vitest 5 · Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-08-phase1-core-loop-design.md`

**Repo:** `D:\WorkSpace\ashen-hollow`. Run every npm/npx command with `< /dev/null` in this shell (Git Bash on Windows) or it may hang. Restart `npm run dev` if the browser shows stale code (see `CLAUDE.md`).

## Global Constraints

- `src/sim`, `src/data`, `src/core` must not import Phaser (ESLint enforces it).
- No `Math.random()` or wall-clock time in the sim: use `world.rng` and `world.tick`.
- All gameplay numbers live in `src/data/*` (`colonists.ts`, `resources.ts`, `buildings.ts`, `doodads.ts`).
- Pixel art colours only from `PALETTE`; sprites anchored at their feet, depth = feet y, never rotated.
- HUD text uses `FONT_UI` (Vietnamese glyphs); player-facing copy is Vietnamese, sentence case, says how to fix problems.
- Building indices are persisted in ECS components: **append** new ids to `BUILDING_IDS`, never reorder.
- 1 day = 6 000 ticks; colonist speed 2.4 px/tick; carry capacity 20; territory radius 192 px; starting stock wood 30 / stone 10 / food 30.
- Before calling a task done: `npm test`, `npm run lint`, `npm run typecheck` all pass.

## Review Focus

1. **A colonist starving while asleep.** Rest-urgent sleep must yield to urgent hunger when food exists, without flip-flopping every tick when it doesn't → tests in Task 10 ("wakes up to eat", "doesn't thrash when there's nothing to eat").
2. **A blueprint finishing on top of a colonist.** Nobody may end up standing inside a solid building → test in Task 9 ("pushes colonists out of the finished footprint").
3. **Undesignating or a target vanishing mid-job.** The job must stop, release its reservation and not crash; carried goods go back to storage → tests in Task 8 ("undesignate mid-chop") and Task 9 ("blueprint cancelled mid-delivery returns the goods").
4. **Two colonists competing for the last wood.** Over-commitment must fail gracefully: one delivery fails, its pending amount is released, the blueprint still gets built → test in Task 9 ("two deliveries for one stock").
5. **An unreachable target.** A walled-in tree must not trap a colonist in a retry loop → test in Task 8 ("gives up on unreachable targets").

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/resources.ts` (new) | Resource ids, Vietnamese names, starting stock, carry capacity |
| `src/data/colonists.ts` (new) | All colonist/needs/job/movement tuning constants |
| `src/data/names.ts` (new) | Colonist name list |
| `src/data/buildings.ts` (mod) | + `cost`, `buildTicks`, `role`, `sleepCapacity`; + `torch`, `wallStake` |
| `src/data/doodads.ts` (mod) | `yields.resource` typed; + `harvest` (designation tool, work ticks) |
| `src/sim/GameWorld.ts` (mod) | World state container, creation, placement, entity removal |
| `src/sim/step.ts` (new) | `stepWorld` — runs systems in order |
| `src/sim/events.ts` (new) | `WorldEvent` union, `emit`, `drainEvents` |
| `src/sim/components.ts` (mod) | + Colonist, Needs, Mover, Carry, Designation, Blueprint, Sleeping, Dead |
| `src/sim/placement.ts` (mod) | + `outOfTerritory` problem |
| `src/sim/colony/stockpile.ts` | `Stockpile`, drop points |
| `src/sim/colony/territory.ts` | `inTerritory` |
| `src/sim/colony/blueprint.ts` | Blueprints: place, missing materials, deliver, complete; walls |
| `src/sim/colony/designation.ts` | Designate / undesignate doodads |
| `src/sim/colony/colonists.ts` | Spawn, living colonists, carry helpers, `colonistAt`, `killColonist` |
| `src/sim/colony/needs.ts` | `needsSystem` |
| `src/sim/movement/PathService.ts` | Path-finding interface + synchronous implementation |
| `src/sim/movement/approach.ts` | `approachPoint` beside a shape |
| `src/sim/movement/movement.ts` | `moveTo` (per-job driver) + `movementSystem` |
| `src/sim/jobs/types.ts` | `Job`, `JobKind`, `JobStatus` |
| `src/sim/jobs/reservations.ts` | Exclusive target reservations |
| `src/sim/jobs/chooseJob.ts` | Utility scoring |
| `src/sim/jobs/runners.ts` | Stage machines per job kind |
| `src/sim/jobs/jobSystem.ts` | Start / run / interrupt / end jobs |
| `src/sim/testing/scenario.ts` | `scenarioWorld`, `runTicks` test helpers |
| `src/render/terrainArt.ts`, `atlas.ts` (mod) | Colonist, torch, stake, grave, icon placeholder art |
| `src/render/ColonistRenderer.ts` (new) | Colonist sprites, carry icon, sleep "z", graves |
| `src/render/EntityRenderer.ts` (mod) | Blueprints (tint + progress bar), removal, completion |
| `src/render/DesignationMarkers.ts` (new) | Tool icons over designated doodads |
| `src/render/WallPreview.ts` (new) | Stake ghosts while dragging a wall |
| `src/platform/CameraController.ts` (mod) | `onClaimedDragEnd` |
| `src/core/events.ts` (mod) | Order-tool, stock, log, colonist-focus events |
| `src/scenes/WorldScene.ts` (mod) | Order tools, wall tool, territory ring, event draining |
| `src/scenes/HudScene.ts` (mod) | Resource bar, colonist cards, event log, tabbed toolbar |

---

### Task 1: Game data for Phase 1

**Files:**
- Create: `src/data/resources.ts`, `src/data/colonists.ts`, `src/data/names.ts`, `src/data/data.test.ts`
- Modify: `src/data/buildings.ts`, `src/data/doodads.ts`

**Interfaces:**
- Produces: `ResourceId`, `RESOURCE_IDS`, `RESOURCES`, `resourceIndex(id)`, `STARTING_STOCK`, `CARRY_CAPACITY`; `DesignationKind`, `DESIGNATION_KINDS`, `designationIndex(kind)`; `DoodadDef.harvest: { tool: DesignationKind; workTicks: number } | null`; `DoodadDef.yields: { resource: ResourceId; amount: number } | null`; `BuildingDef.cost: Partial<Record<ResourceId, number>>`, `.buildTicks`, `.role: BuildingRole`, `.sleepCapacity`; building ids `torch`, `wallStake`; constants in `colonists.ts` (`DAY_TICKS`, `COLONIST_SPEED`, `NEEDS`, `EAT`, …); `COLONIST_NAMES`.

- [ ] **Step 1: Write the failing test** — `src/data/data.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_IDS } from './buildings';
import { DOODADS, DOODAD_IDS } from './doodads';
import { COLONIST_NAMES } from './names';
import { RESOURCE_IDS } from './resources';

describe('Phase 1 game data', () => {
  it('building costs only use known resources, in positive amounts', () => {
    for (const id of BUILDING_IDS) {
      for (const [resource, amount] of Object.entries(BUILDINGS[id].cost)) {
        expect(RESOURCE_IDS).toContain(resource);
        expect(amount).toBeGreaterThan(0);
      }
    }
  });

  it('every player building takes time to build and costs something', () => {
    for (const id of BUILDING_IDS) {
      const def = BUILDINGS[id];
      if (!def.playerBuildable) continue;
      expect(def.buildTicks, id).toBeGreaterThan(0);
      expect(Object.keys(def.cost).length, id).toBeGreaterThan(0);
    }
  });

  it('a doodad is harvestable exactly when it yields something', () => {
    for (const id of DOODAD_IDS) {
      expect(DOODADS[id].harvest === null, id).toBe(DOODADS[id].yields === null);
    }
    expect(DOODADS.deadTree.harvest?.tool).toBe('chop');
    expect(DOODADS.boulder.harvest?.tool).toBe('mine');
    expect(DOODADS.glowShroom.harvest?.tool).toBe('forage');
  });

  it('only tents sleep people', () => {
    for (const id of BUILDING_IDS) {
      expect(BUILDINGS[id].sleepCapacity > 0, id).toBe(BUILDINGS[id].role === 'sleep');
    }
  });

  it('keeps existing building indices stable (they are stored in the ECS)', () => {
    expect(BUILDING_IDS.slice(0, 4)).toEqual(['hearthfire', 'tent', 'storage', 'watchtower']);
  });

  it('has at least 12 distinct colonist names', () => {
    expect(new Set(COLONIST_NAMES).size).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 2: Run it — expect failure** (missing modules `./names`, `./resources`)

Run: `npx vitest run src/data < /dev/null`
Expected: FAIL `Cannot find module './names'`

- [ ] **Step 3: Create `src/data/resources.ts`**

```ts
/** The three Phase 1 resources. Stock is a plain counter — there are no item piles. */
export const RESOURCE_IDS = ['wood', 'stone', 'food'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceDef {
  readonly id: ResourceId;
  readonly name: string;
  readonly nameVi: string;
}

export const RESOURCES: Readonly<Record<ResourceId, ResourceDef>> = {
  wood: { id: 'wood', name: 'Wood', nameVi: 'Gỗ' },
  stone: { id: 'stone', name: 'Stone', nameVi: 'Đá' },
  food: { id: 'food', name: 'Food', nameVi: 'Thức ăn' },
};

export const resourceIndex = (id: ResourceId): number => RESOURCE_IDS.indexOf(id);

/** What the colony starts with, so the player can build straight away. */
export const STARTING_STOCK: Readonly<Record<ResourceId, number>> = { wood: 30, stone: 10, food: 30 };

/** Most a colonist can carry in one trip. */
export const CARRY_CAPACITY = 20;
```

- [ ] **Step 4: Create `src/data/colonists.ts`**

```ts
/**
 * Colonist tuning. Everything is in ticks (10 per second at 1×); nothing reads the
 * wall clock, so the simulation stays deterministic.
 */
export const DAY_TICKS = 6_000;

export const STARTING_COLONISTS = 3;
/** Walk speed on normal ground, px per tick (24 px/s at 1×). */
export const COLONIST_SPEED = 2.4;
/** Ground collider used for approach points and separation. */
export const COLONIST_RADIUS = 4;

export const NEEDS = {
  /** Full → empty in one day. */
  hungerPerTick: 100 / DAY_TICKS,
  /** Full → empty in 1.2 days while awake. */
  restPerTick: 100 / (DAY_TICKS * 1.2),
  /** Empty → full in a third of a day, in a tent. */
  sleepRestorePerTick: 100 / (DAY_TICKS / 3),
  /** Sleeping on the ground by the fire restores at half speed. */
  outdoorSleepFactor: 0.5,
  /** Health lost per tick while hunger or rest is at 0 (dead in a third of a day). */
  healthLossPerTick: 100 / (DAY_TICKS / 3),
  /** Health regained per tick while both needs are above `healthyAbove`. */
  healthGainPerTick: 100 / DAY_TICKS,
  healthyAbove: 20,
  /** Below this a need interrupts other work. */
  urgent: 15,
  /** Below this a need is taken care of when there is nothing else to do. */
  low: 30,
  /** Sleepers wake up at this much rest. */
  wakeAt: 95,
} as const;

export const EAT = {
  ticks: 30,
  hungerPerFood: 40,
  hungerPerWildShroom: 25,
} as const;

export const MOVEMENT = {
  /** Within this distance a destination counts as reached. */
  arriveDistance: 1,
  /** Colonists closer than this push each other apart… */
  separationRadius: 6,
  /** …by this much per tick. */
  separationPush: 0.3,
  /** Moving less than this per tick counts as "not moving". */
  stuckProgress: 0.2,
  /** That many not-moving ticks triggers a re-path… */
  stuckTicks: 15,
  /** …and after this many re-paths the move fails. */
  maxRepaths: 3,
  /** Approach points are searched up to this many nav-cell rings around a target. */
  approachRings: 3,
} as const;

/** A target that couldn't be reached is ignored for this long. */
export const UNREACHABLE_COOLDOWN = 600;
/** Idle colonists wander within this distance of the Hearthfire. */
export const IDLE_WANDER_RADIUS = 48;
/** Idle colonists pause this long (plus a per-colonist offset < 20) after wandering. */
export const IDLE_PAUSE_TICKS = 20;
/** Only build within this distance of the Hearthfire. */
export const TERRITORY_RADIUS = 192;
/** Spacing between wall stakes along a dragged wall. */
export const WALL_STAKE_SPACING = 8;
```

- [ ] **Step 5: Create `src/data/names.ts`**

```ts
/** Colonist names: old-fashioned Vietnamese, fitting a cursed valley. */
export const COLONIST_NAMES: readonly string[] = [
  'Bùi Tân',
  'Lê Khả',
  'Đinh Lan',
  'Trần Mộc',
  'Hà Sương',
  'Phạm Lục',
  'Vũ Hàn',
  'Ngô Tuyết',
  'Lý Tro',
  'Mai Khôi',
  'Đỗ Cầm',
  'Cao Liễu',
];
```

- [ ] **Step 6: Update `src/data/doodads.ts`**

Add after the imports:

```ts
import type { ResourceId } from './resources';

/** Order tools that mark doodads for harvesting. */
export const DESIGNATION_KINDS = ['chop', 'mine', 'forage'] as const;
export type DesignationKind = (typeof DESIGNATION_KINDS)[number];
export const designationIndex = (kind: DesignationKind): number => DESIGNATION_KINDS.indexOf(kind);
```

In `DoodadDef`, replace the `yields` field and add `harvest`:

```ts
  /** What harvesting gives (null = not harvestable). */
  readonly yields: { readonly resource: ResourceId; readonly amount: number } | null;
  /** Which order tool marks it, and how long the work takes (ticks). */
  readonly harvest: { readonly tool: DesignationKind; readonly workTicks: number } | null;
```

Set the values: `deadTree` → `yields: { resource: 'wood', amount: 20 }, harvest: { tool: 'chop', workTicks: 40 }`; `boulder` → `yields: { resource: 'stone', amount: 30 }, harvest: { tool: 'mine', workTicks: 60 }`; `boneHeap` → `yields: null, harvest: null`; `glowShroom` → `yields: { resource: 'food', amount: 5 }, harvest: { tool: 'forage', workTicks: 10 }`.

- [ ] **Step 7: Update `src/data/buildings.ts`**

Replace the file's types and table with:

```ts
import type { ResourceId } from './resources';

export type Footprint =
  | { readonly kind: 'rect'; readonly w: number; readonly h: number }
  | { readonly kind: 'circle'; readonly r: number };

/** What a finished building is for. */
export type BuildingRole = 'drop' | 'sleep' | 'light' | 'wall' | 'defense';

export interface BuildingDef {
  readonly id: BuildingId;
  readonly name: string;
  readonly nameVi: string;
  readonly footprint: Footprint;
  /** Only the Hearthfire is placed by the game, not the player. */
  readonly playerBuildable: boolean;
  /** Keyboard shortcut while in build mode. */
  readonly hotkey?: string;
  readonly cost: Readonly<Partial<Record<ResourceId, number>>>;
  /** Work ticks a colonist spends building it once all materials are delivered. */
  readonly buildTicks: number;
  readonly role: BuildingRole;
  /** Beds (only for role 'sleep'). */
  readonly sleepCapacity: number;
}

/** Append only — indices are stored in the ECS. */
export const BUILDING_IDS = ['hearthfire', 'tent', 'storage', 'watchtower', 'torch', 'wallStake'] as const;

export type BuildingId = (typeof BUILDING_IDS)[number];

export const BUILDINGS: Readonly<Record<BuildingId, BuildingDef>> = {
  hearthfire: {
    id: 'hearthfire',
    name: 'Hearthfire',
    nameVi: 'Lửa Thiêng',
    footprint: { kind: 'circle', r: 8 },
    playerBuildable: false,
    cost: {},
    buildTicks: 0,
    role: 'drop',
    sleepCapacity: 0,
  },
  tent: {
    id: 'tent',
    name: 'Tent',
    nameVi: 'Lều',
    footprint: { kind: 'rect', w: 24, h: 14 },
    playerBuildable: true,
    hotkey: 'Z',
    cost: { wood: 10 },
    buildTicks: 100,
    role: 'sleep',
    sleepCapacity: 2,
  },
  storage: {
    id: 'storage',
    name: 'Storehouse',
    nameVi: 'Kho',
    footprint: { kind: 'rect', w: 32, h: 18 },
    playerBuildable: true,
    hotkey: 'X',
    cost: { wood: 20 },
    buildTicks: 150,
    role: 'drop',
    sleepCapacity: 0,
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    nameVi: 'Tháp Canh',
    footprint: { kind: 'rect', w: 16, h: 12 },
    playerBuildable: true,
    hotkey: 'C',
    cost: { wood: 15, stone: 10 },
    buildTicks: 200,
    role: 'defense',
    sleepCapacity: 0,
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    nameVi: 'Đuốc',
    footprint: { kind: 'circle', r: 3 },
    playerBuildable: true,
    hotkey: 'V',
    cost: { wood: 2 },
    buildTicks: 30,
    role: 'light',
    sleepCapacity: 0,
  },
  wallStake: {
    id: 'wallStake',
    name: 'Wall stake',
    nameVi: 'Cọc tường',
    footprint: { kind: 'circle', r: 4 },
    playerBuildable: true,
    cost: { wood: 1 },
    buildTicks: 20,
    role: 'wall',
    sleepCapacity: 0,
  },
};

/** Buildings on the build bar (wall stakes are placed with the wall tool instead). */
export const PLAYER_BUILDINGS = BUILDING_IDS.filter(
  (id) => BUILDINGS[id].playerBuildable && id !== 'wallStake',
);
```

Keep `buildingIndex` and `buildingAt` unchanged at the bottom.

- [ ] **Step 8: Fix the HUD's resource lookup** — in `src/scenes/HudScene.ts` delete the `RESOURCE_VI` table at the bottom and replace its one use with `RESOURCES[def.yields.resource].nameVi` (import `RESOURCES` from `../data/resources`). Also add atlas frames for the two new buildings so `buildingFrame('torch' | 'wallStake')` exists — temporarily map them to the hearthfire art in `buildPlaceholderAtlas` (`{ name: buildingFrame('torch'), art: paintHearthfire() }`, same for `wallStake`); Task 12 replaces them with real placeholder art.

- [ ] **Step 9: Run tests, lint, typecheck**

Run: `npx vitest run < /dev/null && npm run lint < /dev/null && npm run typecheck < /dev/null`
Expected: all pass (the new data test included).

- [ ] **Step 10: Commit**

```bash
git add src/data src/scenes/HudScene.ts src/render/atlas.ts
git commit -m "feat(data): resources, costs, harvest tools and colonist tuning for Phase 1"
```

---

### Task 2: World model — stock, events, entity removal, step

**Files:**
- Create: `src/sim/colony/stockpile.ts`, `src/sim/events.ts`, `src/sim/step.ts`, `src/sim/jobs/types.ts`, `src/sim/jobs/reservations.ts`, `src/sim/colony/stockpile.test.ts`, `src/sim/jobs/reservations.test.ts`
- Modify: `src/sim/GameWorld.ts`, `src/sim/GameWorld.test.ts`, `src/scenes/WorldScene.ts` (import of `stepWorld`), `src/render/DebugOverlay.ts` (field rename)

**Interfaces:**
- Consumes: `STARTING_STOCK`, `ResourceId` (Task 1).
- Produces:
  - `class Stockpile { get(r): number; has(r, n): boolean; add(r, n): void; take(r, n): number; snapshot(): Record<ResourceId, number> }`
  - `type WorldEvent` (see code), `emit(world, e)`, `drainEvents(world): WorldEvent[]`
  - `ObstacleRecord { shape; type: 'building' | 'doodad'; blocksMovement: boolean; blocksPlacement: boolean }`
  - `GameWorld` new fields: `tick: number`, `hearthfire: number`, `stock`, `events`, `jobs: Map<number, Job>`, `reservations: Reservations`, `unreachable: Map<number, number>`
  - `NewWorldOptions.stock?: Partial<Record<ResourceId, number>>`
  - `removeWorldEntity(world, eid): void`
  - `stepWorld(world)` in `src/sim/step.ts`
  - `Job`, `JobKind`, `JobStatus` (types only), `class Reservations { reserve(t, c): boolean; holder(t): number | undefined; isFree(t, by?): boolean; release(t, c): void; releaseColonist(c): void }`

- [ ] **Step 1: Write failing tests**

`src/sim/colony/stockpile.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Stockpile } from './stockpile';

describe('Stockpile', () => {
  it('starts from the given amounts and missing resources default to 0', () => {
    const s = new Stockpile({ wood: 5 });
    expect(s.snapshot()).toEqual({ wood: 5, stone: 0, food: 0 });
  });

  it('take never goes below zero and reports what it really took', () => {
    const s = new Stockpile({ wood: 7 });
    expect(s.take('wood', 10)).toBe(7);
    expect(s.get('wood')).toBe(0);
    expect(s.take('wood', 3)).toBe(0);
  });

  it('add and has', () => {
    const s = new Stockpile({});
    s.add('stone', 30);
    expect(s.has('stone', 30)).toBe(true);
    expect(s.has('stone', 31)).toBe(false);
  });

  it('rejects negative or fractional amounts', () => {
    const s = new Stockpile({});
    expect(() => s.add('wood', -1)).toThrow();
    expect(() => s.take('wood', 1.5)).toThrow();
  });
});
```

`src/sim/jobs/reservations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Reservations } from './reservations';

describe('Reservations', () => {
  it('lets one colonist hold a target exclusively', () => {
    const r = new Reservations();
    expect(r.reserve(100, 1)).toBe(true);
    expect(r.reserve(100, 2)).toBe(false);
    expect(r.reserve(100, 1)).toBe(true); // re-reserving your own is fine
    expect(r.isFree(100)).toBe(false);
    expect(r.isFree(100, 1)).toBe(true);
    expect(r.holder(100)).toBe(1);
  });

  it('releases by target (only for the holder) and by colonist', () => {
    const r = new Reservations();
    r.reserve(100, 1);
    r.reserve(200, 1);
    r.release(100, 2); // not the holder: no effect
    expect(r.holder(100)).toBe(1);
    r.releaseColonist(1);
    expect(r.isFree(100)).toBe(true);
    expect(r.isFree(200)).toBe(true);
  });
});
```

Append to `src/sim/GameWorld.test.ts` (inside the file, new `describe`):

```ts
describe('world model', () => {
  it('starts with the configured stock and an empty event queue', () => {
    const world = smallWorld([]);
    expect(world.stock.snapshot()).toEqual({ wood: 30, stone: 10, food: 30 });
    const custom = createGameWorld({
      seed: 1,
      stock: { wood: 0 },
      map: { terrain: openTerrain(16, 16), doodads: [], start: { x: 128, y: 128 } },
    });
    expect(custom.stock.get('wood')).toBe(0);
    expect(drainEvents(custom)).toEqual([]);
  });

  it('removeWorldEntity frees navigation and the spatial index, and reports it', () => {
    const world = smallWorld([{ kind: 'boulder', x: 60, y: 60 }]);
    const boulder = entityAt(world, 60, 60)!;
    expect(navBlockedAt(world, 60, 60)).toBe(true);
    removeWorldEntity(world, boulder);
    expect(navBlockedAt(world, 60, 60)).toBe(false);
    expect(entityAt(world, 60, 60)).toBeNull();
    expect(world.obstacles.has(boulder)).toBe(false);
    expect(drainEvents(world)).toEqual([{ type: 'entityRemoved', eid: boulder }]);
    expect(drainEvents(world)).toEqual([]); // drained
  });

  it('stepWorld advances the sim tick', () => {
    const world = smallWorld([]);
    stepWorld(world);
    stepWorld(world);
    expect(world.tick).toBe(2);
  });
});
```

and add to that file's imports: `removeWorldEntity` from `./GameWorld`, `drainEvents` from `./events`, `stepWorld` from `./step`.

- [ ] **Step 2: Run — expect failures** (modules missing)

Run: `npx vitest run src/sim < /dev/null`
Expected: FAIL `Cannot find module './stockpile'` / `'./reservations'` / `'./events'`

- [ ] **Step 3: Create `src/sim/colony/stockpile.ts`**

```ts
import { RESOURCE_IDS, type ResourceId } from '../../data/resources';

const assertAmount = (n: number): void => {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid resource amount ${n}`);
};

/** The colony's shared store. Changes only when goods are dropped off or taken out. */
export class Stockpile {
  private readonly amounts: Record<ResourceId, number>;

  constructor(initial: Readonly<Partial<Record<ResourceId, number>>>) {
    this.amounts = Object.fromEntries(RESOURCE_IDS.map((r) => [r, initial[r] ?? 0])) as Record<
      ResourceId,
      number
    >;
  }

  get(resource: ResourceId): number {
    return this.amounts[resource];
  }

  has(resource: ResourceId, amount: number): boolean {
    return this.amounts[resource] >= amount;
  }

  add(resource: ResourceId, amount: number): void {
    assertAmount(amount);
    this.amounts[resource] += amount;
  }

  /** Take up to `amount`; returns how much was actually taken. */
  take(resource: ResourceId, amount: number): number {
    assertAmount(amount);
    const taken = Math.min(amount, this.amounts[resource]);
    this.amounts[resource] -= taken;
    return taken;
  }

  snapshot(): Record<ResourceId, number> {
    return { ...this.amounts };
  }
}
```

- [ ] **Step 4: Create `src/sim/events.ts`**

```ts
import type { GameWorld } from './GameWorld';

/**
 * Things the renderer and HUD need to hear about. The sim appends; WorldScene drains
 * once per frame — so nothing has to scan the ECS every frame to notice changes.
 */
export type WorldEvent =
  | { type: 'entityRemoved'; eid: number }
  | { type: 'blueprintPlaced'; eid: number }
  | { type: 'buildingCompleted'; eid: number }
  | { type: 'designationChanged'; eids: number[] }
  | { type: 'stockChanged' }
  | { type: 'colonistDied'; eid: number; cause: 'hunger' | 'exhaustion' };

export const emit = (world: GameWorld, event: WorldEvent): void => {
  world.events.push(event);
};

/** Take and clear all pending events. */
export const drainEvents = (world: GameWorld): WorldEvent[] => world.events.splice(0);
```

- [ ] **Step 5: Create `src/sim/jobs/types.ts`**

```ts
import type { ResourceId } from '../../data/resources';
import type { Vec2 } from '../geom';

export type JobKind = 'harvest' | 'haulToDrop' | 'deliver' | 'construct' | 'eat' | 'sleep' | 'idle';

export type JobStatus = 'running' | 'done' | 'failed';

/**
 * A colonist's current job: plain data (serialisable). `stage` indexes the job's own
 * stage machine in runners.ts; `timer` counts work ticks inside a stage; `dest` is
 * the walk destination chosen for the current stage.
 */
export interface Job {
  kind: JobKind;
  /** Doodad, blueprint, building or drop point the job is about. */
  target: number;
  stage: number;
  timer: number;
  dest?: Vec2;
  /** deliver: the drop point to fetch from. */
  source?: number;
  /** deliver: what and how much (reserved as pending on the blueprint). */
  resource?: ResourceId;
  amount?: number;
  /** eat: eating a wild glowcap instead of stored food. */
  wild?: boolean;
}

export const newJob = (kind: JobKind, target: number, extra: Partial<Job> = {}): Job => ({
  kind,
  target,
  stage: 0,
  timer: 0,
  ...extra,
});
```

- [ ] **Step 6: Create `src/sim/jobs/reservations.ts`**

```ts
/** Exclusive claims on targets (one tree, one blueprint to build, one wild glowcap). */
export class Reservations {
  private readonly byTarget = new Map<number, number>();

  /** Claim `target` for `colonist`; false if someone else holds it. */
  reserve(target: number, colonist: number): boolean {
    const holder = this.byTarget.get(target);
    if (holder !== undefined && holder !== colonist) return false;
    this.byTarget.set(target, colonist);
    return true;
  }

  holder(target: number): number | undefined {
    return this.byTarget.get(target);
  }

  /** Free, or held by `by`. */
  isFree(target: number, by?: number): boolean {
    const holder = this.byTarget.get(target);
    return holder === undefined || holder === by;
  }

  release(target: number, colonist: number): void {
    if (this.byTarget.get(target) === colonist) this.byTarget.delete(target);
  }

  releaseColonist(colonist: number): void {
    for (const [target, holder] of this.byTarget) {
      if (holder === colonist) this.byTarget.delete(target);
    }
  }

  /** Forget a target entirely (it was removed from the world). */
  forgetTarget(target: number): void {
    this.byTarget.delete(target);
  }
}
```

- [ ] **Step 7: Update `src/sim/GameWorld.ts`**

1. Imports: add `removeEntity` to the bitecs import; add
   ```ts
   import { STARTING_STOCK, type ResourceId } from '../data/resources';
   import { Stockpile } from './colony/stockpile';
   import { emit, type WorldEvent } from './events';
   import { Reservations } from './jobs/reservations';
   import type { Job } from './jobs/types';
   ```
2. Replace `ObstacleRecord` with:
   ```ts
   export interface ObstacleRecord {
     shape: Shape;
     type: 'building' | 'doodad';
     /** Stamped on the nav grid: units walk around it. */
     blocksMovement: boolean;
     /** Other buildings can't overlap it (true for blueprints too). */
     blocksPlacement: boolean;
   }
   ```
3. Add to `GameWorld`:
   ```ts
     /** Sim ticks since the world was created (advanced by stepWorld). */
     tick: number;
     /** Entity id of the Hearthfire. */
     hearthfire: number;
     readonly stock: Stockpile;
     readonly events: WorldEvent[];
     readonly jobs: Map<number, Job>;
     readonly reservations: Reservations;
     /** Target eid → tick until which it is considered unreachable. */
     readonly unreachable: Map<number, number>;
   ```
   (remove `readonly` from nothing else).
4. `NewWorldOptions` gets `stock?: Partial<Record<ResourceId, number>>;`
5. `register` stamps nav only when `record.blocksMovement`.
6. `spawnBuilding` registers `{ shape, type: 'building', blocksMovement: true, blocksPlacement: true }`.
7. Doodads register `{ shape, type: 'doodad', blocksMovement: def.blocksMovement, blocksPlacement: def.blocksMovement }`.
8. In `createGameWorld`, destructure `stock` from options and initialise the new fields:
   ```ts
       tick: 0,
       hearthfire: -1,
       stock: new Stockpile(stock ?? STARTING_STOCK),
       events: [],
       jobs: new Map(),
       reservations: new Reservations(),
       unreachable: new Map(),
   ```
   and set `world.hearthfire = spawnBuilding(world, 'hearthfire', …)`.
9. `nearbyObstacles` filters on `o?.blocksPlacement`.
10. Add after `placeBuilding`:
   ```ts
   /** Remove a doodad or building from every index and tell the renderer. */
   export const removeWorldEntity = (world: GameWorld, eid: number): void => {
     const record = world.obstacles.get(eid);
     if (record) {
       if (record.blocksMovement) world.nav.unblock(record.shape);
       world.spatial.remove(eid);
       world.obstacles.delete(eid);
     }
     world.reservations.forgetTarget(eid);
     removeEntity(world.ecs, eid);
     emit(world, { type: 'entityRemoved', eid });
   };
   ```
11. Delete the old `stepWorld` from this file.

- [ ] **Step 8: Create `src/sim/step.ts`**

```ts
import type { GameWorld } from './GameWorld';

/**
 * One fixed simulation tick. Order matters: needs first (so jobs see current needs),
 * then jobs (which may set paths), then movement (which follows them).
 */
export const stepWorld = (world: GameWorld): void => {
  world.tick++;
};
```

- [ ] **Step 9: Update callers** — `src/scenes/WorldScene.ts`: import `stepWorld` from `'../sim/step'` instead of `'../sim/GameWorld'`. `src/render/DebugOverlay.ts` needs no change (it reads `shape` only). Search for `.blocks` and fix any remaining use: `grep -rn "\.blocks\b" src`.

- [ ] **Step 10: Run tests, lint, typecheck** — all pass.

Run: `npx vitest run < /dev/null && npm run lint < /dev/null && npm run typecheck < /dev/null`

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "feat(sim): stockpile, world events, reservations, entity removal and stepWorld"
```

---

### Task 3: Territory, blueprints and walls

**Files:**
- Create: `src/sim/colony/territory.ts`, `src/sim/colony/blueprint.ts`, `src/sim/colony/blueprint.test.ts`
- Modify: `src/sim/components.ts`, `src/sim/placement.ts`, `src/sim/GameWorld.ts`, `src/scenes/HudScene.ts` (help text for the new problem)

**Interfaces:**
- Consumes: `BUILDINGS[].cost/buildTicks`, `RESOURCE_IDS`, `resourceIndex`, `TERRITORY_RADIUS`, `WALL_STAKE_SPACING` (Task 1); `emit`, `GameWorld` fields (Task 2).
- Produces:
  - Component `Blueprint = { progress: Uint16Array, delivered: Uint16Array[] , pending: Uint16Array[] }` (arrays indexed by `resourceIndex`)
  - `PlacementProblem` gains `'outOfTerritory'`
  - `inTerritory(world, x, y): boolean`
  - `placeBlueprint(world, kind, x, y, options?): PlaceResult` (emits `blueprintPlaced`)
  - `isBlueprint(world, eid): boolean`
  - `missingMaterials(eid): Partial<Record<ResourceId, number>>` (cost − delivered − pending, only positive entries)
  - `isFullySupplied(eid): boolean`
  - `reservePending(eid, r, n)`, `releasePending(eid, r, n)`, `deliverToBlueprint(world, eid, r, n)`
  - `completeBlueprint(world, eid): void` (emits `buildingCompleted`)
  - `planWall(world, a, b): { x: number; y: number; ok: boolean }[]`, `placeWall(world, a, b): number[]`

- [ ] **Step 1: Write the failing test** — `src/sim/colony/blueprint.test.ts`

```ts
import { hasComponent } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { Blueprint, Building } from '../components';
import { drainEvents } from '../events';
import { checkPlacement, createGameWorld } from '../GameWorld';
import { openTerrain } from '../testing/terrainFixture';
import {
  completeBlueprint,
  deliverToBlueprint,
  isBlueprint,
  isFullySupplied,
  missingMaterials,
  placeBlueprint,
  planWall,
  placeWall,
  reservePending,
} from './blueprint';
import { inTerritory } from './territory';

/** 512×512 px grass, Hearthfire at (256, 256). */
const world = () =>
  createGameWorld({
    seed: 1,
    map: { terrain: openTerrain(32, 32), doodads: [], start: { x: 256, y: 256 } },
  });

const navBlocked = (w: ReturnType<typeof world>, x: number, y: number) => {
  const { cx, cy } = w.nav.cellOf(x, y);
  return !w.nav.walkable(cx, cy);
};

describe('territory', () => {
  it('is a 192 px radius around the Hearthfire', () => {
    const w = world();
    expect(inTerritory(w, 256 + 192, 256)).toBe(true);
    expect(inTerritory(w, 256 + 193, 256)).toBe(false);
  });

  it('placement outside it is refused with a reason', () => {
    const w = world();
    // 200 px out: past the 192 px border but still inside the 512 px map.
    expect(checkPlacement(w, 'tent', 256 + 200, 256).reason).toBe('outOfTerritory');
    expect(checkPlacement(w, 'tent', 256 + 60, 256).ok).toBe(true);
  });
});

describe('blueprints', () => {
  it('a placed blueprint blocks placement but not movement, and costs nothing yet', () => {
    const w = world();
    const r = placeBlueprint(w, 'tent', 300, 256);
    expect(r.ok).toBe(true);
    const eid = r.eid!;
    expect(isBlueprint(w, eid)).toBe(true);
    expect(hasComponent(w.ecs, eid, Building)).toBe(true);
    expect(navBlocked(w, 300, 256)).toBe(false);
    expect(checkPlacement(w, 'tent', 304, 256).reason).toBe('building');
    expect(w.stock.get('wood')).toBe(30);
    expect(drainEvents(w)).toEqual([{ type: 'blueprintPlaced', eid }]);
  });

  it('tracks missing materials through pending and delivered amounts', () => {
    const w = world();
    const eid = placeBlueprint(w, 'watchtower', 300, 256).eid!; // 15 wood, 10 stone
    expect(missingMaterials(eid)).toEqual({ wood: 15, stone: 10 });
    reservePending(eid, 'wood', 10);
    expect(missingMaterials(eid)).toEqual({ wood: 5, stone: 10 });
    deliverToBlueprint(w, eid, 'wood', 10); // pending 10 → delivered 10
    expect(Blueprint.pending[0]![eid]).toBe(0);
    expect(missingMaterials(eid)).toEqual({ wood: 5, stone: 10 });
    expect(isFullySupplied(eid)).toBe(false);
    reservePending(eid, 'wood', 5);
    deliverToBlueprint(w, eid, 'wood', 5);
    reservePending(eid, 'stone', 10);
    deliverToBlueprint(w, eid, 'stone', 10);
    expect(missingMaterials(eid)).toEqual({});
    expect(isFullySupplied(eid)).toBe(true);
  });

  it('completing turns it into a solid building', () => {
    const w = world();
    const eid = placeBlueprint(w, 'tent', 300, 256).eid!;
    drainEvents(w);
    completeBlueprint(w, eid);
    expect(isBlueprint(w, eid)).toBe(false);
    expect(navBlocked(w, 300, 256)).toBe(true);
    expect(drainEvents(w)).toEqual([{ type: 'buildingCompleted', eid }]);
  });
});

describe('walls', () => {
  it('plans one stake every 8 px from A to B, inclusive', () => {
    const w = world();
    // |AB| = 40 → 40/8 + 1 = 6 stakes
    const plan = planWall(w, { x: 230, y: 300 }, { x: 270, y: 300 });
    expect(plan.map((p) => p.x)).toEqual([230, 238, 246, 254, 262, 270]);
    expect(plan.every((p) => p.ok)).toBe(true);
  });

  it('skips stakes that collide, places the rest as blueprints', () => {
    const w = world();
    placeBlueprint(w, 'tent', 254, 300); // occupies [242,266]×[293,307]
    const eids = placeWall(w, { x: 230, y: 300 }, { x: 270, y: 300 });
    // stakes at 246, 254, 262 overlap the tent; 230, 238, 270 survive
    expect(eids).toHaveLength(3);
    for (const eid of eids) expect(isBlueprint(w, eid)).toBe(true);
  });

  it('a zero-length drag places a single stake', () => {
    const w = world();
    expect(planWall(w, { x: 300, y: 300 }, { x: 300, y: 300 })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run — expect failure** (`Cannot find module './blueprint'`)

Run: `npx vitest run src/sim/colony < /dev/null`

- [ ] **Step 3: Add the component** — in `src/sim/components.ts`:

```ts
import { RESOURCE_IDS } from '../data/resources';

/** An unfinished building: materials delivered / in transit, and work done (ticks). */
export const Blueprint = {
  progress: new Uint16Array(MAX_ENTITIES),
  delivered: RESOURCE_IDS.map(() => new Uint16Array(MAX_ENTITIES)),
  pending: RESOURCE_IDS.map(() => new Uint16Array(MAX_ENTITIES)),
};
```

and add `Blueprint` to the `components` object.

- [ ] **Step 4: Extend placement problems** — in `src/sim/placement.ts`:

```ts
export type PlacementProblem = 'outOfBounds' | 'terrain' | 'building' | 'doodad' | 'outOfTerritory';
```

In `src/scenes/HudScene.ts` `PLACEMENT_HELP`, add:

```ts
  outOfTerritory: 'Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn.',
```

- [ ] **Step 5: Create `src/sim/colony/territory.ts`**

```ts
import { TERRITORY_RADIUS } from '../../data/colonists';
import type { GameWorld } from '../GameWorld';

/** Phase 1 territory: a fixed circle around the Hearthfire. */
export const inTerritory = (world: GameWorld, x: number, y: number): boolean =>
  (x - world.start.x) ** 2 + (y - world.start.y) ** 2 <= TERRITORY_RADIUS * TERRITORY_RADIUS;
```

- [ ] **Step 6: Enforce territory in `checkPlacement`** (`src/sim/GameWorld.ts`) — import `inTerritory`, and wrap the `validate` helper so a legal shape whose centre is outside territory fails:

```ts
  const validate = (shape: Shape): PlacementCheck => {
    const result = validatePlacement(shape, world.terrain, nearbyObstacles(world, shape, 0));
    if (result.ok && !inTerritory(world, shape.cx, shape.cy)) {
      return { ok: false, reason: 'outOfTerritory', shape };
    }
    return { ...result, shape };
  };
```

Also export `spawnBuilding` (the blueprint module uses it) and give it an options parameter:

```ts
export const spawnBuilding = (
  world: GameWorld,
  kind: BuildingId,
  shape: Shape,
  { solid = true }: { solid?: boolean } = {},
): number => {
  …
  register(world, eid, { shape, type: 'building', blocksMovement: solid, blocksPlacement: true });
  return eid;
};
```

- [ ] **Step 7: Create `src/sim/colony/blueprint.ts`**

```ts
import { addComponent, hasComponent, removeComponent } from 'bitecs';
import { BUILDINGS, BUILDING_IDS, type BuildingId } from '../../data/buildings';
import { WALL_STAKE_SPACING } from '../../data/colonists';
import { RESOURCE_IDS, resourceIndex, type ResourceId } from '../../data/resources';
import { Blueprint, Building } from '../components';
import { emit } from '../events';
import {
  checkPlacement,
  spawnBuilding,
  type GameWorld,
  type PlaceResult,
  type PlacementOptions,
} from '../GameWorld';
import type { Vec2 } from '../geom';

const costOf = (eid: number) => BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!].cost;

export const isBlueprint = (world: GameWorld, eid: number): boolean =>
  hasComponent(world.ecs, eid, Blueprint);

/** Place a building as a blueprint: reserves the spot, costs nothing until delivered. */
export const placeBlueprint = (
  world: GameWorld,
  kind: BuildingId,
  x: number,
  y: number,
  options: PlacementOptions = {},
): PlaceResult => {
  const check = checkPlacement(world, kind, x, y, options);
  if (!check.ok) return { ...check, eid: null };
  const eid = spawnBuilding(world, kind, check.shape, { solid: false });
  addComponent(world.ecs, eid, Blueprint);
  Blueprint.progress[eid] = 0;
  for (let r = 0; r < RESOURCE_IDS.length; r++) {
    Blueprint.delivered[r]![eid] = 0;
    Blueprint.pending[r]![eid] = 0;
  }
  emit(world, { type: 'blueprintPlaced', eid });
  return { ...check, eid };
};

/** Materials still to be brought: cost − delivered − in transit (positive entries only). */
export const missingMaterials = (eid: number): Partial<Record<ResourceId, number>> => {
  const out: Partial<Record<ResourceId, number>> = {};
  for (const [res, amount] of Object.entries(costOf(eid)) as [ResourceId, number][]) {
    const r = resourceIndex(res);
    const left = amount - Blueprint.delivered[r]![eid]! - Blueprint.pending[r]![eid]!;
    if (left > 0) out[res] = left;
  }
  return out;
};

/** Every material actually delivered (not just in transit). */
export const isFullySupplied = (eid: number): boolean =>
  (Object.entries(costOf(eid)) as [ResourceId, number][]).every(
    ([res, amount]) => Blueprint.delivered[resourceIndex(res)]![eid]! >= amount,
  );

/** A colonist promised to bring `amount` of `resource`. */
export const reservePending = (eid: number, resource: ResourceId, amount: number): void => {
  Blueprint.pending[resourceIndex(resource)]![eid]! += amount;
};

/** That promise was broken (job failed): give the amount back to "missing". */
export const releasePending = (eid: number, resource: ResourceId, amount: number): void => {
  const r = resourceIndex(resource);
  Blueprint.pending[r]![eid] = Math.max(0, Blueprint.pending[r]![eid]! - amount);
};

/** The goods arrived: pending → delivered. */
export const deliverToBlueprint = (
  _world: GameWorld,
  eid: number,
  resource: ResourceId,
  amount: number,
): void => {
  releasePending(eid, resource, amount);
  Blueprint.delivered[resourceIndex(resource)]![eid]! += amount;
};

/** The blueprint becomes a real, solid building. */
export const completeBlueprint = (world: GameWorld, eid: number): void => {
  removeComponent(world.ecs, eid, Blueprint);
  const record = world.obstacles.get(eid);
  if (record && !record.blocksMovement) {
    record.blocksMovement = true;
    world.nav.block(record.shape);
  }
  emit(world, { type: 'buildingCompleted', eid });
};

export interface WallStakePlan {
  x: number;
  y: number;
  ok: boolean;
}

/** Stakes every 8 px along A→B (inclusive), each checked for placement on its own. */
export const planWall = (world: GameWorld, a: Vec2, b: Vec2): WallStakePlan[] => {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const count = Math.floor(length / WALL_STAKE_SPACING) + 1;
  const plan: WallStakePlan[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (i * WALL_STAKE_SPACING) / length;
    const x = Math.round(a.x + (b.x - a.x) * t);
    const y = Math.round(a.y + (b.y - a.y) * t);
    plan.push({ x, y, ok: checkPlacement(world, 'wallStake', x, y).ok });
  }
  return plan;
};

/** Place every placeable stake of a planned wall as a blueprint. */
export const placeWall = (world: GameWorld, a: Vec2, b: Vec2): number[] => {
  const eids: number[] = [];
  for (const stake of planWall(world, a, b)) {
    if (!stake.ok) continue;
    const r = placeBlueprint(world, 'wallStake', stake.x, stake.y);
    if (r.eid !== null) eids.push(r.eid);
  }
  return eids;
};
```

> Note: `planWall` checks each stake against the world as it is; placed stakes are 8 px apart with radius 4, so neighbours touch but never overlap.

- [ ] **Step 8: Run tests** — `npx vitest run < /dev/null` → all pass. Then `npm run lint < /dev/null && npm run typecheck < /dev/null`.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat(sim): territory, blueprints with material tracking, wall planning"
```

---

### Task 4: Designations

**Files:**
- Create: `src/sim/colony/designation.ts`, `src/sim/colony/designation.test.ts`
- Modify: `src/sim/components.ts`

**Interfaces:**
- Consumes: `DOODADS[].harvest`, `DesignationKind`, `designationIndex`, `DESIGNATION_KINDS` (Task 1); `emit` (Task 2).
- Produces: component `Designation = { kind: Uint8Array }`; `designate(world, area: Bounds, kind): number[]`; `undesignate(world, area: Bounds): number[]`; `designationOf(world, eid): DesignationKind | null`.

- [ ] **Step 1: Write the failing test** — `src/sim/colony/designation.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { drainEvents } from '../events';
import { createGameWorld, entityAt } from '../GameWorld';
import type { DoodadSpawn } from '../map/generate';
import { openTerrain } from '../testing/terrainFixture';
import { designate, designationOf, undesignate } from './designation';

const world = (doodads: DoodadSpawn[]) =>
  createGameWorld({
    seed: 1,
    map: { terrain: openTerrain(32, 32), doodads, start: { x: 256, y: 256 } },
  });

const box = (minX: number, minY: number, maxX: number, maxY: number) => ({ minX, minY, maxX, maxY });

describe('designate', () => {
  const doodads: DoodadSpawn[] = [
    { kind: 'deadTree', x: 100, y: 100 },
    { kind: 'deadTree', x: 130, y: 100 },
    { kind: 'boulder', x: 160, y: 100 },
    { kind: 'glowShroom', x: 115, y: 120 },
    { kind: 'boneHeap', x: 145, y: 120 },
  ];

  it('only marks doodads that match the tool', () => {
    const w = world(doodads);
    const marked = designate(w, box(80, 80, 180, 140), 'chop');
    expect(marked).toHaveLength(2);
    for (const eid of marked) expect(designationOf(w, eid)).toBe('chop');
    expect(designationOf(w, entityAt(w, 160, 100)!)).toBeNull();
    expect(designationOf(w, entityAt(w, 115, 120)!)).toBeNull();
    expect(drainEvents(w)).toEqual([{ type: 'designationChanged', eids: marked }]);
  });

  it('catches doodads whose collider just touches the box edge', () => {
    const w = world(doodads);
    // Tree at (100,100) r=4 reaches x=104; box starts at x=103.
    expect(designate(w, box(103, 90, 110, 110), 'chop')).toHaveLength(1);
  });

  it('does not re-report doodads that were already designated', () => {
    const w = world(doodads);
    designate(w, box(80, 80, 180, 140), 'chop');
    drainEvents(w);
    expect(designate(w, box(80, 80, 180, 140), 'chop')).toEqual([]);
    expect(drainEvents(w)).toEqual([]);
  });

  it('undesignate clears every kind in the area', () => {
    const w = world(doodads);
    designate(w, box(80, 80, 180, 140), 'chop');
    designate(w, box(80, 80, 180, 140), 'mine');
    designate(w, box(80, 80, 180, 140), 'forage');
    drainEvents(w);
    const cleared = undesignate(w, box(80, 80, 180, 140));
    expect(cleared).toHaveLength(4);
    for (const eid of cleared) expect(designationOf(w, eid)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure** (`Cannot find module './designation'`)

- [ ] **Step 3: Add the component** — `src/sim/components.ts`:

```ts
/** A doodad the player marked for harvesting: index into DESIGNATION_KINDS. */
export const Designation = {
  kind: new Uint8Array(MAX_ENTITIES),
};
```

and add it to `components`.

- [ ] **Step 4: Create `src/sim/colony/designation.ts`**

```ts
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
```

- [ ] **Step 5: Run tests, lint, typecheck** — all pass.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(sim): designate and undesignate doodads by area and tool"
```

---
### Task 5: Colonists and needs

**Files:**
- Create: `src/sim/colony/colonists.ts`, `src/sim/colony/needs.ts`, `src/sim/colony/colonists.test.ts`
- Modify: `src/sim/components.ts`, `src/sim/GameWorld.ts`, `src/sim/step.ts`

**Interfaces:**
- Consumes: `COLONIST_NAMES`, `NEEDS`, `COLONIST_SPEED`, `STARTING_COLONISTS` (Task 1); `emit`, `world.jobs`, `world.reservations` (Task 2).
- Produces:
  - Components `Colonist { nameIndex, shirt }`, `Needs { hunger, rest, health }`, `Mover { speed, stuckTicks, repaths }`, `Carry { resource (−1 = empty), amount }`, `Sleeping { inTent }`, `Dead` (tag).
  - `spawnColonist(world, x, y, nameIndex): number`, `spawnColonists(world, count): number[]`, `livingColonists(world): readonly number[]`, `isCarrying(eid)`, `carryOf(eid): { resource: ResourceId; amount: number } | null`, `setCarry(eid, resource, amount)`, `clearCarry(eid)`, `colonistName(eid): string`, `colonistAt(world, x, y): number | null`.
  - `needsSystem(world)`, `killColonist(world, eid, cause)` (in `needs.ts` — **not** in `colonists.ts`, to avoid an import cycle with the job system in Task 8).
  - `NewWorldOptions.colonists?: number` (default `STARTING_COLONISTS`).

> **Module-global components.** bitECS component arrays are module-level and indexed by entity id, so two live `GameWorld`s overwrite each other's component data. The game only ever has one world. Tests that build several worlds must finish reading one before creating the next (copy values out, e.g. in a snapshot).

- [ ] **Step 1: Write the failing test** — `src/sim/colony/colonists.test.ts`

```ts
import { addComponent, hasComponent } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { NEEDS } from '../../data/colonists';
import { COLONIST_NAMES } from '../../data/names';
import { Colonist, Dead, Needs, Position, Sleeping } from '../components';
import { drainEvents } from '../events';
import { createGameWorld } from '../GameWorld';
import { openTerrain } from '../testing/terrainFixture';
import { colonistAt, colonistName, isCarrying, livingColonists } from './colonists';
import { needsSystem } from './needs';

const world = (colonists = 3) =>
  createGameWorld({
    seed: 1,
    colonists,
    map: { terrain: openTerrain(32, 32), doodads: [], start: { x: 256, y: 256 } },
  });

const tickNeeds = (w: ReturnType<typeof world>, n: number) => {
  for (let i = 0; i < n; i++) needsSystem(w);
};

describe('spawning', () => {
  it('spawns the starting colonists near the Hearthfire, fed, rested and empty-handed', () => {
    const w = world();
    const colonists = livingColonists(w);
    expect(colonists).toHaveLength(3);
    const names = colonists.map(colonistName);
    expect(new Set(names).size).toBe(3);
    for (const eid of colonists) {
      expect(COLONIST_NAMES).toContain(colonistName(eid));
      const d = Math.hypot(Position.x[eid]! - 256, Position.y[eid]! - 256);
      expect(d).toBeGreaterThan(8); // not inside the Hearthfire
      expect(d).toBeLessThan(40);
      const { cx, cy } = w.nav.cellOf(Position.x[eid]!, Position.y[eid]!);
      expect(w.nav.walkable(cx, cy)).toBe(true);
      expect([Needs.hunger[eid], Needs.rest[eid], Needs.health[eid]]).toEqual([100, 100, 100]);
      expect(isCarrying(eid)).toBe(false);
    }
  });

  it('colonistAt picks a colonist by their body, not just their feet', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    const x = Position.x[eid!]!;
    const y = Position.y[eid!]!;
    expect(colonistAt(w, x, y - 12)).toBe(eid); // chest
    expect(colonistAt(w, x + 20, y)).toBeNull();
  });
});

describe('needs', () => {
  it('hunger empties in one day and rest in 1.2 days while awake', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    tickNeeds(w, 600); // a tenth of a day
    expect(Needs.hunger[eid!]).toBeCloseTo(90, 1);
    expect(Needs.rest[eid!]).toBeCloseTo(100 - 600 * NEEDS.restPerTick, 1);
  });

  it('sleeping in a tent restores rest twice as fast as outdoors', () => {
    const w = world(2);
    const [inTent, outdoors] = livingColonists(w);
    for (const [eid, tent] of [
      [inTent!, 1],
      [outdoors!, 0],
    ] as const) {
      Needs.rest[eid] = 10;
      addComponent(w.ecs, eid, Sleeping);
      Sleeping.inTent[eid] = tent;
    }
    tickNeeds(w, 200);
    expect(Needs.rest[inTent!]).toBeCloseTo(10 + 200 * NEEDS.sleepRestorePerTick, 1); // 20
    expect(Needs.rest[outdoors!]).toBeCloseTo(10 + 100 * NEEDS.sleepRestorePerTick, 1); // 15
  });

  it('starving drains health; at 0 the colonist dies and it is reported', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    Needs.hunger[eid!] = 0;
    tickNeeds(w, 1000);
    expect(Needs.health[eid!]).toBeCloseTo(50, 0);
    drainEvents(w);
    let ticks = 0;
    while (!hasComponent(w.ecs, eid!, Dead) && ticks < 1100) {
      needsSystem(w);
      ticks++;
    }
    expect(ticks).toBeGreaterThan(990);
    expect(ticks).toBeLessThan(1010);
    expect(livingColonists(w)).toEqual([]);
    expect(drainEvents(w)).toEqual([{ type: 'colonistDied', eid, cause: 'hunger' }]);
  });

  it('health recovers while both needs are comfortable', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    Needs.health[eid!] = 50;
    tickNeeds(w, 600);
    expect(Needs.health[eid!]).toBeCloseTo(60, 0);
  });

  it('the dead are left alone by the needs system', () => {
    const w = world(1);
    const [eid] = livingColonists(w);
    addComponent(w.ecs, eid!, Dead);
    const before = Needs.hunger[eid!];
    tickNeeds(w, 100);
    expect(Needs.hunger[eid!]).toBe(before);
    expect(hasComponent(w.ecs, eid!, Colonist)).toBe(true); // stays as a grave
  });
});
```

- [ ] **Step 2: Run — expect failure** (`Cannot find module './colonists'`)

Run: `npx vitest run src/sim/colony/colonists.test.ts < /dev/null`

- [ ] **Step 3: Add components** — `src/sim/components.ts`:

```ts
/** A person. `nameIndex` → COLONIST_NAMES; `shirt` picks the sprite colour. */
export const Colonist = {
  nameIndex: new Uint8Array(MAX_ENTITIES),
  shirt: new Uint8Array(MAX_ENTITIES),
};

/** 0–100; 100 = fed / rested / healthy. */
export const Needs = {
  hunger: new Float32Array(MAX_ENTITIES),
  rest: new Float32Array(MAX_ENTITIES),
  health: new Float32Array(MAX_ENTITIES),
};

/** Free movement state. The path itself lives in world.paths. */
export const Mover = {
  speed: new Float32Array(MAX_ENTITIES),
  stuckTicks: new Uint16Array(MAX_ENTITIES),
  repaths: new Uint8Array(MAX_ENTITIES),
};

/** What a colonist carries: resource index (−1 = nothing) and amount. */
export const Carry = {
  resource: new Int8Array(MAX_ENTITIES),
  amount: new Uint16Array(MAX_ENTITIES),
};

/** Asleep; `inTent` 1 = proper bed (full restore speed). */
export const Sleeping = {
  inTent: new Uint8Array(MAX_ENTITIES),
};

/** Tag: died. The entity stays (drawn as a grave). */
export const Dead = {};
```

Add all six to `components`.

- [ ] **Step 4: Create `src/sim/colony/colonists.ts`**

```ts
import { addComponent, addEntity, Not, query } from 'bitecs';
import { COLONIST_SPEED } from '../../data/colonists';
import { COLONIST_NAMES } from '../../data/names';
import { RESOURCE_IDS, resourceIndex, type ResourceId } from '../../data/resources';
import { Carry, Colonist, Dead, Mover, Needs, Position } from '../components';
import type { GameWorld } from '../GameWorld';

const SHIRTS = 4;

export const spawnColonist = (world: GameWorld, x: number, y: number, nameIndex: number): number => {
  const eid = addEntity(world.ecs);
  for (const c of [Position, Colonist, Needs, Mover, Carry]) addComponent(world.ecs, eid, c);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Colonist.nameIndex[eid] = nameIndex;
  Colonist.shirt[eid] = nameIndex % SHIRTS;
  Needs.hunger[eid] = 100;
  Needs.rest[eid] = 100;
  Needs.health[eid] = 100;
  Mover.speed[eid] = COLONIST_SPEED;
  Mover.stuckTicks[eid] = 0;
  Mover.repaths[eid] = 0;
  Carry.resource[eid] = -1;
  Carry.amount[eid] = 0;
  return eid;
};

/**
 * Spawn colonists in rings around the Hearthfire on walkable ground, with distinct
 * names picked by the world's RNG (deterministic per seed).
 */
export const spawnColonists = (world: GameWorld, count: number): number[] => {
  const names = COLONIST_NAMES.map((_, i) => i);
  for (let i = names.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    [names[i], names[j]] = [names[j]!, names[i]!];
  }
  const perRing = 12;
  const eids: number[] = [];
  for (let i = 0; i < count; i++) {
    const angle = ((i % perRing) / Math.min(count, perRing)) * Math.PI * 2;
    for (let radius = 24 + 8 * Math.floor(i / perRing); radius < 120; radius += 8) {
      const x = Math.round(world.start.x + Math.cos(angle) * radius);
      const y = Math.round(world.start.y + Math.sin(angle) * radius);
      const { cx, cy } = world.nav.cellOf(x, y);
      if (!world.nav.walkable(cx, cy)) continue;
      eids.push(spawnColonist(world, x, y, names[i % names.length]!));
      break;
    }
  }
  return eids;
};

export const livingColonists = (world: GameWorld): readonly number[] =>
  query(world.ecs, [Colonist, Not(Dead)]);

export const colonistName = (eid: number): string => COLONIST_NAMES[Colonist.nameIndex[eid]!]!;

export const isCarrying = (eid: number): boolean =>
  Carry.resource[eid]! >= 0 && Carry.amount[eid]! > 0;

export const carryOf = (eid: number): { resource: ResourceId; amount: number } | null =>
  isCarrying(eid)
    ? { resource: RESOURCE_IDS[Carry.resource[eid]!]!, amount: Carry.amount[eid]! }
    : null;

export const setCarry = (eid: number, resource: ResourceId, amount: number): void => {
  Carry.resource[eid] = resourceIndex(resource);
  Carry.amount[eid] = amount;
};

export const clearCarry = (eid: number): void => {
  Carry.resource[eid] = -1;
  Carry.amount[eid] = 0;
};

/** The colonist whose body (16×24 sprite standing on its feet) covers the point. */
export const colonistAt = (world: GameWorld, x: number, y: number): number | null => {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const eid of query(world.ecs, [Colonist])) {
    const px = Position.x[eid]!;
    const py = Position.y[eid]!;
    if (Math.abs(x - px) > 6 || y < py - 22 || y > py + 3) continue;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bestDist) {
      best = eid;
      bestDist = d;
    }
  }
  return best;
};
```

- [ ] **Step 5: Create `src/sim/colony/needs.ts`**

```ts
import { addComponent, hasComponent, removeComponent } from 'bitecs';
import { NEEDS } from '../../data/colonists';
import { Dead, Needs, Sleeping } from '../components';
import { emit } from '../events';
import type { GameWorld } from '../GameWorld';
import { clearCarry, livingColonists } from './colonists';

const clamp = (v: number): number => Math.max(0, Math.min(100, v));

/** Mark a colonist dead: drop everything (goods are lost) and report it. */
export const killColonist = (
  world: GameWorld,
  eid: number,
  cause: 'hunger' | 'exhaustion',
): void => {
  world.jobs.delete(eid);
  world.reservations.releaseColonist(eid);
  if (hasComponent(world.ecs, eid, Sleeping)) removeComponent(world.ecs, eid, Sleeping);
  clearCarry(eid);
  addComponent(world.ecs, eid, Dead);
  emit(world, { type: 'colonistDied', eid, cause });
};

/** Hunger and rest drain over time; neglect drains health; health 0 is death. */
export const needsSystem = (world: GameWorld): void => {
  for (const eid of [...livingColonists(world)]) {
    Needs.hunger[eid] = clamp(Needs.hunger[eid]! - NEEDS.hungerPerTick);
    if (hasComponent(world.ecs, eid, Sleeping)) {
      const factor = Sleeping.inTent[eid] ? 1 : NEEDS.outdoorSleepFactor;
      Needs.rest[eid] = clamp(Needs.rest[eid]! + NEEDS.sleepRestorePerTick * factor);
    } else {
      Needs.rest[eid] = clamp(Needs.rest[eid]! - NEEDS.restPerTick);
    }
    const starving = Needs.hunger[eid]! <= 0;
    const exhausted = Needs.rest[eid]! <= 0;
    if (starving || exhausted) {
      Needs.health[eid] = clamp(Needs.health[eid]! - NEEDS.healthLossPerTick);
    } else if (Needs.hunger[eid]! > NEEDS.healthyAbove && Needs.rest[eid]! > NEEDS.healthyAbove) {
      Needs.health[eid] = clamp(Needs.health[eid]! + NEEDS.healthGainPerTick);
    }
    if (Needs.health[eid]! <= 0) killColonist(world, eid, starving ? 'hunger' : 'exhaustion');
  }
};
```

- [ ] **Step 6: Spawn colonists in `createGameWorld`** — `src/sim/GameWorld.ts`: import `STARTING_COLONISTS` from `../data/colonists` and `spawnColonists` from `./colony/colonists`; add `colonists?: number` to `NewWorldOptions`; destructure it in `createGameWorld`; after the Hearthfire is spawned call `spawnColonists(world, colonists ?? STARTING_COLONISTS);`.

- [ ] **Step 7: Register the system** — `src/sim/step.ts`:

```ts
import { needsSystem } from './colony/needs';
import type { GameWorld } from './GameWorld';

export const stepWorld = (world: GameWorld): void => {
  world.tick++;
  needsSystem(world);
};
```

- [ ] **Step 8: Run tests, lint, typecheck** — all pass (existing GameWorld tests still pass: colonists are not obstacles).

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat(sim): colonists with hunger, rest, health and death"
```

---

### Task 6: Movement

**Files:**
- Create: `src/sim/movement/PathService.ts`, `src/sim/movement/approach.ts`, `src/sim/movement/movement.ts`, `src/sim/movement/movement.test.ts`
- Modify: `src/sim/GameWorld.ts`, `src/sim/step.ts`

**Interfaces:**
- Consumes: `findPath`, `smoothPath`, `NavGrid`, `NAV_CELL` (Phase 0b); `MOVEMENT`, `COLONIST_RADIUS` (Task 1); `Position`, `Mover`, `livingColonists`, `spawnColonist` (Task 5).
- Produces:
  - `interface PathService { find(from: Vec2, to: Vec2): Vec2[] | null }`, `class SyncPathService`
  - `GameWorld.pathService`, `GameWorld.paths: Map<number, Vec2[]>`, `GameWorld.pathDest: Map<number, Vec2>`
  - `approachPoint(world, target: Shape, from: Vec2): Vec2 | null`
  - `type MoveResult = 'arrived' | 'moving' | 'failed'`, `moveTo(world, eid, dest): MoveResult`, `stopMoving(world, eid)`, `isMoving(world, eid): boolean`, `movementSystem(world)`

> Deviation from spec §4: no per-tick path cache yet (YAGNI). Task 11's benchmark decides if it's needed.

- [ ] **Step 1: Write the failing test** — `src/sim/movement/movement.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { livingColonists, spawnColonist } from '../colony/colonists';
import { Position } from '../components';
import { createGameWorld } from '../GameWorld';
import { circleShape, inflateShape, shapeContains } from '../geom';
import type { DoodadSpawn } from '../map/generate';
import type { TerrainGrid } from '../map/TerrainGrid';
import { openTerrain, terrainFromAscii } from '../testing/terrainFixture';
import { approachPoint } from './approach';
import { moveTo, movementSystem } from './movement';

const world = (
  terrain: TerrainGrid,
  start: { x: number; y: number },
  doodads: DoodadSpawn[] = [],
) => createGameWorld({ seed: 1, colonists: 0, map: { terrain, doodads, start } });

describe('approachPoint', () => {
  it('finds a walkable spot just outside the target, on the near side', () => {
    const w = world(openTerrain(32, 32), { x: 400, y: 400 }, [{ kind: 'deadTree', x: 200, y: 200 }]);
    const tree = circleShape(200, 200, 4);
    const p = approachPoint(w, tree, { x: 100, y: 200 })!;
    expect(p).not.toBeNull();
    expect(shapeContains(inflateShape(tree, 4), p.x, p.y)).toBe(false);
    const { cx, cy } = w.nav.cellOf(p.x, p.y);
    expect(w.nav.walkable(cx, cy)).toBe(true);
    expect(p.x).toBeLessThan(200);
    expect(Math.hypot(p.x - 200, p.y - 200)).toBeLessThan(20);
  });

  it('returns null when everything around the target is blocked', () => {
    // One grass cell ([16,32]²) walled by crag. The tree sits on the shared corner of
    // that cell's four 8 px nav cells, so all of them are blocked: nowhere to stand.
    const w = world(terrainFromAscii(['###', '#.#', '###']), { x: 24, y: 24 }, [
      { kind: 'deadTree', x: 24, y: 24 },
    ]);
    expect(approachPoint(w, circleShape(24, 24, 4), { x: 24, y: 24 })).toBeNull();
  });
});

describe('moving', () => {
  const walled = () =>
    terrainFromAscii([
      '..........', //
      '..........',
      '#######...',
      '..........',
      '..........',
    ]);

  it('walks around a wall to the destination, never standing on blocked ground', () => {
    const w = world(walled(), { x: 136, y: 40 });
    const eid = spawnColonist(w, 8, 8, 0);
    const dest = { x: 12, y: 68 };
    let result = 'moving';
    let ticks = 0;
    while (result !== 'arrived' && ticks < 300) {
      result = moveTo(w, eid, dest);
      movementSystem(w);
      const { cx, cy } = w.nav.cellOf(Position.x[eid]!, Position.y[eid]!);
      expect(w.nav.walkable(cx, cy)).toBe(true);
      ticks++;
    }
    expect(result).toBe('arrived');
    // Straight-line distance is 60 px, but the wall forces a ~250 px detour at 2.4 px/tick.
    expect(ticks).toBeGreaterThan(60);
    expect(ticks).toBeLessThan(200);
  });

  it('fails straight away for a destination that cannot be reached', () => {
    const w = world(walled(), { x: 136, y: 40 });
    const eid = spawnColonist(w, 8, 8, 0);
    expect(moveTo(w, eid, { x: 20, y: 40 })).toBe('failed'); // inside the crag
  });

  it('slows down on bog', () => {
    // Bog on row 0, grass on row 1; the Hearthfire sits on row 2, clear of both lanes.
    const w = world(terrainFromAscii(['mmmmmmmmmm', '..........', '..........']), {
      x: 136,
      y: 40,
    });
    const onBog = spawnColonist(w, 4, 4, 0);
    const onGrass = spawnColonist(w, 4, 20, 1);
    for (let i = 0; i < 20; i++) {
      moveTo(w, onBog, { x: 156, y: 4 });
      moveTo(w, onGrass, { x: 156, y: 20 });
      movementSystem(w);
    }
    // 20 ticks × 2.4 = 48 px on grass; × 0.45 on bog = 21.6 px.
    expect(Position.x[onGrass]! - 4).toBeCloseTo(48, 0);
    expect(Position.x[onBog]! - 4).toBeCloseTo(21.6, 0);
  });

  it('pushes colonists standing on the same spot apart', () => {
    const w = world(openTerrain(16, 16), { x: 128, y: 128 });
    spawnColonist(w, 60, 60, 0);
    spawnColonist(w, 60, 60, 1);
    for (let i = 0; i < 20; i++) movementSystem(w);
    const [a, b] = livingColonists(w);
    const gap = Math.hypot(Position.x[a!]! - Position.x[b!]!, Position.y[a!]! - Position.y[b!]!);
    expect(gap).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run — expect failure** (missing modules)

Run: `npx vitest run src/sim/movement < /dev/null`

- [ ] **Step 3: Create `src/sim/movement/PathService.ts`**

```ts
import type { Vec2 } from '../geom';
import { findPath } from '../nav/astar';
import type { NavGrid } from '../nav/NavGrid';
import { smoothPath } from '../nav/smooth';

/** Path-finding seam: synchronous now, swappable for a Web Worker later. */
export interface PathService {
  /** Smoothed waypoints from `from` to `to` (both included), or null if unreachable. */
  find(from: Vec2, to: Vec2): Vec2[] | null;
}

export class SyncPathService implements PathService {
  constructor(private readonly nav: NavGrid) {}

  find(from: Vec2, to: Vec2): Vec2[] | null {
    const raw = findPath(this.nav, from, to);
    return raw ? smoothPath(this.nav, raw, from, to) : null;
  }
}
```

- [ ] **Step 4: Create `src/sim/movement/approach.ts`**

```ts
import { COLONIST_RADIUS, MOVEMENT } from '../../data/colonists';
import type { GameWorld } from '../GameWorld';
import { inflateShape, shapeBounds, shapeContains, type Shape, type Vec2 } from '../geom';
import { NAV_CELL } from '../nav/NavGrid';

/**
 * Where to stand to work on `target`: the walkable nav-cell centre nearest to `from`
 * that is outside the target (plus a colonist's radius). Searched ring by ring up to
 * MOVEMENT.approachRings cells out; null if nothing is free.
 */
export const approachPoint = (world: GameWorld, target: Shape, from: Vec2): Vec2 | null => {
  const { nav } = world;
  const keepOut = inflateShape(target, COLONIST_RADIUS);
  for (let ring = 1; ring <= MOVEMENT.approachRings; ring++) {
    const area = shapeBounds(inflateShape(target, ring * NAV_CELL));
    const x0 = Math.max(0, Math.floor(area.minX / NAV_CELL));
    const y0 = Math.max(0, Math.floor(area.minY / NAV_CELL));
    const x1 = Math.min(nav.width - 1, Math.floor(area.maxX / NAV_CELL));
    const y1 = Math.min(nav.height - 1, Math.floor(area.maxY / NAV_CELL));
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!nav.walkable(cx, cy)) continue;
        const c = nav.cellCenter(cx, cy);
        if (shapeContains(keepOut, c.x, c.y)) continue;
        const d = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
        if (d < bestDist) {
          best = c;
          bestDist = d;
        }
      }
    }
    if (best) return best;
  }
  return null;
};
```

- [ ] **Step 5: Create `src/sim/movement/movement.ts`**

```ts
import { MOVEMENT } from '../../data/colonists';
import { livingColonists } from '../colony/colonists';
import { Mover, Position } from '../components';
import type { GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';

export type MoveResult = 'arrived' | 'moving' | 'failed';

const sameDest = (a: Vec2 | undefined, b: Vec2): boolean => !!a && a.x === b.x && a.y === b.y;

export const stopMoving = (world: GameWorld, eid: number): void => {
  world.paths.delete(eid);
  world.pathDest.delete(eid);
  Mover.stuckTicks[eid] = 0;
  Mover.repaths[eid] = 0;
};

export const isMoving = (world: GameWorld, eid: number): boolean =>
  (world.paths.get(eid)?.length ?? 0) > 0;

/**
 * Drive a colonist towards `dest`. Call every tick from a job stage: it (re)plans when
 * the destination changes, the path ran out, or the colonist is stuck, and gives up
 * after MOVEMENT.maxRepaths re-plans. The movement system does the actual walking.
 */
export const moveTo = (world: GameWorld, eid: number, dest: Vec2): MoveResult => {
  const here = { x: Position.x[eid]!, y: Position.y[eid]! };
  if (Math.hypot(dest.x - here.x, dest.y - here.y) <= MOVEMENT.arriveDistance) {
    stopMoving(world, eid);
    return 'arrived';
  }
  const path = world.paths.get(eid);
  const newDest = !sameDest(world.pathDest.get(eid), dest);
  const stuck = Mover.stuckTicks[eid]! >= MOVEMENT.stuckTicks;
  if (newDest || stuck || !path || path.length === 0) {
    if (newDest) {
      Mover.repaths[eid] = 0;
    } else if (Mover.repaths[eid]! >= MOVEMENT.maxRepaths) {
      stopMoving(world, eid);
      return 'failed';
    } else {
      Mover.repaths[eid]! += 1;
    }
    const found = world.pathService.find(here, dest);
    if (!found) {
      stopMoving(world, eid);
      return 'failed';
    }
    world.paths.set(eid, found.slice(1));
    world.pathDest.set(eid, dest);
    Mover.stuckTicks[eid] = 0;
  }
  return 'moving';
};

const terrainSpeedAt = (world: GameWorld, x: number, y: number): number => {
  const { cx, cy } = world.nav.cellOf(x, y);
  const s = world.nav.inBounds(cx, cy) ? world.nav.speed[cy * world.nav.width + cx]! : 0;
  return s > 0 ? s : 1;
};

const walkableAt = (world: GameWorld, x: number, y: number): boolean => {
  const { cx, cy } = world.nav.cellOf(x, y);
  return world.nav.walkable(cx, cy);
};

/** Follow paths at colonist speed × ground speed, then keep colonists from stacking. */
export const movementSystem = (world: GameWorld): void => {
  const living = livingColonists(world);
  for (const eid of living) {
    const path = world.paths.get(eid);
    if (!path || path.length === 0) continue;
    const x0 = Position.x[eid]!;
    const y0 = Position.y[eid]!;
    let budget = Mover.speed[eid]! * terrainSpeedAt(world, x0, y0);
    while (budget > 0 && path.length > 0) {
      const wp = path[0]!;
      const dx = wp.x - Position.x[eid]!;
      const dy = wp.y - Position.y[eid]!;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        Position.x[eid] = wp.x;
        Position.y[eid] = wp.y;
        path.shift();
        budget -= d;
      } else {
        Position.x[eid] = Position.x[eid]! + (dx / d) * budget;
        Position.y[eid] = Position.y[eid]! + (dy / d) * budget;
        budget = 0;
      }
    }
    const moved = Math.hypot(Position.x[eid]! - x0, Position.y[eid]! - y0);
    Mover.stuckTicks[eid] = moved < MOVEMENT.stuckProgress ? Mover.stuckTicks[eid]! + 1 : 0;
  }

  // Separation: nudge overlapping colonists apart (never onto blocked ground).
  const r = MOVEMENT.separationRadius;
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i]!;
      const b = living[j]!;
      let dx = Position.x[b]! - Position.x[a]!;
      let dy = Position.y[b]! - Position.y[a]!;
      let d = Math.hypot(dx, dy);
      if (d >= r) continue;
      if (d < 1e-3) {
        // Exactly on top of each other: split along a fixed, deterministic axis.
        dx = 1;
        dy = 0;
        d = 1;
      }
      const px = (dx / d) * MOVEMENT.separationPush;
      const py = (dy / d) * MOVEMENT.separationPush;
      if (walkableAt(world, Position.x[a]! - px, Position.y[a]! - py)) {
        Position.x[a] = Position.x[a]! - px;
        Position.y[a] = Position.y[a]! - py;
      }
      if (walkableAt(world, Position.x[b]! + px, Position.y[b]! + py)) {
        Position.x[b] = Position.x[b]! + px;
        Position.y[b] = Position.y[b]! + py;
      }
    }
  }
};
```

- [ ] **Step 6: World fields** — `src/sim/GameWorld.ts`: import `SyncPathService, type PathService` from `./movement/PathService`; add to `GameWorld`:

```ts
  readonly pathService: PathService;
  /** Remaining waypoints per moving colonist. */
  readonly paths: Map<number, Vec2[]>;
  /** The destination each current path leads to. */
  readonly pathDest: Map<number, Vec2>;
```

In `createGameWorld` create the nav grid first (`const nav = new NavGrid(terrain);`) and initialise `nav`, `pathService: new SyncPathService(nav)`, `paths: new Map()`, `pathDest: new Map()`.

- [ ] **Step 7: Register the system** — `src/sim/step.ts`:

```ts
import { needsSystem } from './colony/needs';
import type { GameWorld } from './GameWorld';
import { movementSystem } from './movement/movement';

export const stepWorld = (world: GameWorld): void => {
  world.tick++;
  needsSystem(world);
  movementSystem(world);
};
```

- [ ] **Step 8: Run tests, lint, typecheck** — all pass.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat(sim): free movement with approach points, path following and separation"
```

---

### Task 7: Choosing jobs

**Files:**
- Create: `src/sim/colony/buildings.ts`, `src/sim/jobs/chooseJob.ts`, `src/sim/jobs/chooseJob.test.ts`, `src/sim/testing/scenario.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–6.
- Produces:
  - `isUnreachable(world, target): boolean`, `markUnreachable(world, target)`, `buildingsWithRole(world, role): number[]` (finished only), `nearest(eids, from): number | null`, `nearestDropPoint(world, from, { skipUnreachable? }): number | null`, `freeBeds(world, tent, except?): number`
  - `chooseJob(world, eid): Job`, `findEat(world, eid): Job | null`, `findSleep(world, eid): Job`
  - Test helpers `scenarioWorld(options)`, `runTicks(world, max, until?)`

**Priority (spec §5.3, with one refinement):** carrying (6) > urgent needs (5) > construct (4) > deliver (3) > harvest (2) > low needs (1) > idle. Score = priority × 1000 − distance. **When both needs are urgent, hunger goes first** (eating is short; sleeping while starving kills). This replaces the spec's "worse need first", so an interrupted sleep can't immediately choose sleep again (see Task 10).

- [ ] **Step 1: Create the test helper** — `src/sim/testing/scenario.ts`

```ts
import type { ResourceId } from '../../data/resources';
import { createGameWorld, type GameWorld } from '../GameWorld';
import type { DoodadSpawn } from '../map/generate';
import type { TerrainGrid } from '../map/TerrainGrid';
import { stepWorld } from '../step';
import { openTerrain } from './terrainFixture';

/** Test-only: a 512×512 px world (Hearthfire at 256,256) with chosen doodads and stock. */
export const scenarioWorld = ({
  doodads = [],
  colonists = 1,
  stock,
  terrain,
}: {
  doodads?: DoodadSpawn[];
  colonists?: number;
  stock?: Partial<Record<ResourceId, number>>;
  terrain?: TerrainGrid;
} = {}): GameWorld =>
  createGameWorld({
    seed: 1,
    colonists,
    stock,
    map: { terrain: terrain ?? openTerrain(32, 32), doodads, start: { x: 256, y: 256 } },
  });

/** Step up to `max` ticks, stopping early when `until` holds. Returns ticks run. */
export const runTicks = (world: GameWorld, max: number, until?: () => boolean): number => {
  for (let i = 1; i <= max; i++) {
    stepWorld(world);
    if (until?.()) return i;
  }
  return max;
};
```

- [ ] **Step 2: Write the failing test** — `src/sim/jobs/chooseJob.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  completeBlueprint,
  deliverToBlueprint,
  placeBlueprint,
  reservePending,
} from '../colony/blueprint';
import { livingColonists, setCarry } from '../colony/colonists';
import { designate } from '../colony/designation';
import { Needs } from '../components';
import { entityAt } from '../GameWorld';
import { scenarioWorld } from '../testing/scenario';
import { chooseJob } from './chooseJob';
import { newJob } from './types';

const everything = { minX: 0, minY: 0, maxX: 512, maxY: 512 };
const first = (w: ReturnType<typeof scenarioWorld>) => livingColonists(w)[0]!;

describe('chooseJob', () => {
  it('idles when there is nothing to do', () => {
    const w = scenarioWorld();
    expect(chooseJob(w, first(w)).kind).toBe('idle');
  });

  it('hauls first when carrying something', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 300, y: 256 }] });
    designate(w, everything, 'chop');
    setCarry(first(w), 'wood', 20);
    expect(chooseJob(w, first(w))).toMatchObject({ kind: 'haulToDrop', target: w.hearthfire });
  });

  it('harvests designated doodads, skipping reserved and unreachable ones', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 300, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 300, 256)!;
    expect(chooseJob(w, first(w))).toMatchObject({ kind: 'harvest', target: tree });
    w.reservations.reserve(tree, 9999);
    expect(chooseJob(w, first(w)).kind).toBe('idle');
    w.reservations.releaseColonist(9999);
    w.unreachable.set(tree, w.tick + 600);
    expect(chooseJob(w, first(w)).kind).toBe('idle');
  });

  it('building a supplied blueprint beats a closer tree', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 270, y: 256 }] });
    designate(w, everything, 'chop');
    const bp = placeBlueprint(w, 'tent', 400, 300).eid!;
    reservePending(bp, 'wood', 10);
    deliverToBlueprint(w, bp, 'wood', 10);
    expect(chooseJob(w, first(w))).toMatchObject({ kind: 'construct', target: bp });
  });

  it('delivers what a blueprint lacks, as much as stock and hands allow', () => {
    const w = scenarioWorld({ stock: { wood: 7 } });
    const bp = placeBlueprint(w, 'storage', 300, 300).eid!; // needs 20 wood
    expect(chooseJob(w, first(w))).toMatchObject({
      kind: 'deliver',
      target: bp,
      source: w.hearthfire,
      resource: 'wood',
      amount: 7,
    });
  });

  it('does not deliver from an empty stock', () => {
    const w = scenarioWorld({ stock: { wood: 0 } });
    placeBlueprint(w, 'tent', 300, 300);
    expect(chooseJob(w, first(w)).kind).toBe('idle');
  });

  it('urgent hunger: stored food first, then wild glowcaps, otherwise carry on', () => {
    const w = scenarioWorld({
      doodads: [{ kind: 'glowShroom', x: 320, y: 256 }],
      stock: { food: 1 },
    });
    const eid = first(w);
    Needs.hunger[eid] = 10;
    expect(chooseJob(w, eid)).toMatchObject({ kind: 'eat', target: w.hearthfire, wild: false });
    w.stock.take('food', 1);
    expect(chooseJob(w, eid)).toMatchObject({
      kind: 'eat',
      target: entityAt(w, 320, 256),
      wild: true,
    });

    const starving = scenarioWorld({ stock: { food: 0 } });
    Needs.hunger[first(starving)] = 10;
    expect(chooseJob(starving, first(starving)).kind).toBe('idle');
  });

  it('urgent rest: a tent with a free bed, otherwise the ground by the fire', () => {
    const w = scenarioWorld({ colonists: 3 });
    const tent = placeBlueprint(w, 'tent', 300, 300).eid!;
    completeBlueprint(w, tent);
    const [a, b, c] = livingColonists(w);
    Needs.rest[a!] = 10;
    expect(chooseJob(w, a!)).toMatchObject({ kind: 'sleep', target: tent });
    w.jobs.set(b!, newJob('sleep', tent));
    w.jobs.set(c!, newJob('sleep', tent));
    expect(chooseJob(w, a!)).toMatchObject({ kind: 'sleep', target: w.hearthfire });
  });

  it('when both needs are urgent, eating comes first', () => {
    const w = scenarioWorld({ stock: { food: 5 } });
    const eid = first(w);
    Needs.hunger[eid] = 12;
    Needs.rest[eid] = 5;
    expect(chooseJob(w, eid).kind).toBe('eat');
  });

  it('low (not urgent) needs only win when there is no work', () => {
    const w = scenarioWorld({
      doodads: [{ kind: 'deadTree', x: 300, y: 256 }],
      stock: { food: 5 },
    });
    const eid = first(w);
    Needs.hunger[eid] = 25;
    designate(w, everything, 'chop');
    expect(chooseJob(w, eid).kind).toBe('harvest');
    const idle = scenarioWorld({ stock: { food: 5 } });
    Needs.hunger[first(idle)] = 25;
    expect(chooseJob(idle, first(idle)).kind).toBe('eat');
  });
});
```

- [ ] **Step 3: Run — expect failure** (`Cannot find module './chooseJob'`)

- [ ] **Step 4: Create `src/sim/colony/buildings.ts`**

```ts
import { Not, query } from 'bitecs';
import { BUILDINGS, BUILDING_IDS, type BuildingRole } from '../../data/buildings';
import { UNREACHABLE_COOLDOWN } from '../../data/colonists';
import { Blueprint, Building, Position } from '../components';
import type { GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';

export const isUnreachable = (world: GameWorld, target: number): boolean =>
  (world.unreachable.get(target) ?? -1) > world.tick;

export const markUnreachable = (world: GameWorld, target: number): void => {
  world.unreachable.set(target, world.tick + UNREACHABLE_COOLDOWN);
};

/** Finished buildings with this role. */
export const buildingsWithRole = (world: GameWorld, role: BuildingRole): number[] =>
  query(world.ecs, [Building, Not(Blueprint)]).filter(
    (eid) => BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!].role === role,
  );

export const nearest = (eids: readonly number[], from: Vec2): number | null => {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const eid of eids) {
    const d = (Position.x[eid]! - from.x) ** 2 + (Position.y[eid]! - from.y) ** 2;
    if (d < bestDist) {
      best = eid;
      bestDist = d;
    }
  }
  return best;
};

/** Closest place to drop goods off / take them out (Hearthfire, finished storehouses). */
export const nearestDropPoint = (
  world: GameWorld,
  from: Vec2,
  { skipUnreachable = true }: { skipUnreachable?: boolean } = {},
): number | null =>
  nearest(
    buildingsWithRole(world, 'drop').filter((eid) => !skipUnreachable || !isUnreachable(world, eid)),
    from,
  );

/** Beds left in a tent, not counting `except` (who may already be heading there). */
export const freeBeds = (world: GameWorld, tent: number, except?: number): number => {
  const capacity = BUILDINGS[BUILDING_IDS[Building.kind[tent]!]!].sleepCapacity;
  let taken = 0;
  for (const [colonist, job] of world.jobs) {
    if (colonist !== except && job.kind === 'sleep' && job.target === tent) taken++;
  }
  return capacity - taken;
};
```

- [ ] **Step 5: Create `src/sim/jobs/chooseJob.ts`**

```ts
import { query } from 'bitecs';
import { NEEDS } from '../../data/colonists';
import { DOODAD_IDS } from '../../data/doodads';
import { CARRY_CAPACITY, type ResourceId } from '../../data/resources';
import { isFullySupplied, missingMaterials } from '../colony/blueprint';
import {
  buildingsWithRole,
  freeBeds,
  isUnreachable,
  nearest,
  nearestDropPoint,
} from '../colony/buildings';
import { isCarrying } from '../colony/colonists';
import { Blueprint, Designation, Doodad, Needs, Position } from '../components';
import type { GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';
import { newJob, type Job } from './types';

const here = (eid: number): Vec2 => ({ x: Position.x[eid]!, y: Position.y[eid]! });

const distanceTo = (from: Vec2, target: number): number =>
  Math.hypot(Position.x[target]! - from.x, Position.y[target]! - from.y);

/** Eat stored food at a drop point, or else the nearest free wild glowcap. */
export const findEat = (world: GameWorld, eid: number): Job | null => {
  const me = here(eid);
  if (world.stock.get('food') >= 1) {
    const drop = nearestDropPoint(world, me);
    if (drop !== null) return newJob('eat', drop, { wild: false });
  }
  const shrooms = query(world.ecs, [Doodad]).filter(
    (d) =>
      DOODAD_IDS[Doodad.kind[d]!] === 'glowShroom' &&
      world.reservations.isFree(d, eid) &&
      !isUnreachable(world, d),
  );
  const shroom = nearest(shrooms, me);
  return shroom === null ? null : newJob('eat', shroom, { wild: true });
};

/** A tent with a free bed, or else the ground by the Hearthfire. */
export const findSleep = (world: GameWorld, eid: number): Job => {
  const tents = buildingsWithRole(world, 'sleep').filter(
    (t) => freeBeds(world, t, eid) > 0 && !isUnreachable(world, t),
  );
  return newJob('sleep', nearest(tents, here(eid)) ?? world.hearthfire);
};

/** Pick the best job for an idle colonist (spec §5.3, hunger before rest). */
export const chooseJob = (world: GameWorld, eid: number): Job => {
  const me = here(eid);

  // 6 — goods in hand go back first (or wait by the fire if nowhere is reachable).
  if (isCarrying(eid)) {
    const drop = nearestDropPoint(world, me);
    return drop !== null ? newJob('haulToDrop', drop) : newJob('idle', world.hearthfire);
  }

  // 5 — urgent needs; hunger first.
  const hunger = Needs.hunger[eid]!;
  const rest = Needs.rest[eid]!;
  if (hunger < NEEDS.urgent) {
    const eat = findEat(world, eid);
    if (eat) return eat;
  }
  if (rest < NEEDS.urgent) return findSleep(world, eid);

  const pick: { job: Job | null; score: number } = { job: null, score: -Infinity };
  const consider = (priority: number, target: number, job: Job) => {
    const score = priority * 1000 - distanceTo(me, target);
    if (score > pick.score) {
      pick.job = job;
      pick.score = score;
    }
  };

  // 4 / 3 — blueprints: build when supplied, otherwise bring what's missing.
  for (const bp of query(world.ecs, [Blueprint])) {
    if (isUnreachable(world, bp)) continue;
    if (isFullySupplied(bp)) {
      if (world.reservations.isFree(bp, eid)) consider(4, bp, newJob('construct', bp));
      continue;
    }
    for (const [resource, need] of Object.entries(missingMaterials(bp)) as [ResourceId, number][]) {
      const have = world.stock.get(resource);
      if (have <= 0) continue;
      const source = nearestDropPoint(world, me);
      if (source === null) break;
      const amount = Math.min(need, CARRY_CAPACITY, have);
      consider(3, bp, newJob('deliver', bp, { source, resource, amount }));
      break;
    }
  }

  // 2 — designated doodads.
  for (const d of query(world.ecs, [Designation])) {
    if (!isUnreachable(world, d) && world.reservations.isFree(d, eid)) {
      consider(2, d, newJob('harvest', d));
    }
  }

  // 1 — low (not urgent) needs.
  if (hunger < NEEDS.low) {
    const eat = findEat(world, eid);
    if (eat) consider(1, eat.target, eat);
  }
  if (rest < NEEDS.low) {
    const sleep = findSleep(world, eid);
    consider(1, sleep.target, sleep);
  }

  return pick.job ?? newJob('idle', world.hearthfire);
};
```

- [ ] **Step 6: Run tests, lint, typecheck** — all pass.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(sim): utility job chooser with priorities, reservations and needs"
```

---
### Task 8: Job system — harvesting, hauling, idling

**Files:**
- Create: `src/sim/jobs/runners.ts`, `src/sim/jobs/jobSystem.ts`, `src/sim/jobs/work.test.ts`
- Modify: `src/sim/step.ts`, `src/sim/colony/needs.ts` (`killColonist` uses `endJob`)

**Interfaces:**
- Consumes: `chooseJob` (Task 7), `moveTo`/`stopMoving`/`approachPoint` (Task 6), carry helpers (Task 5), `removeWorldEntity`/`emit` (Task 2), `releasePending`/`isBlueprint` (Task 3).
- Produces:
  - `type Runner = (world, eid, job) => JobStatus`; `RUNNERS: Record<JobKind, Runner>`; helpers `nextStage(job)`, `walkStage(world, eid, job, target): JobStatus`
  - `startJob(world, eid, job)`, `endJob(world, eid, job, status)`, `jobSystem(world)`
  - `stepWorld` order: needs → jobs → movement

> `deliver`, `construct`, `eat` and `sleep` runners are added in Tasks 9–10. Until then `RUNNERS` maps them to `notYetImplemented`, which fails the job (the colonist simply picks something else). Tasks 9 and 10 delete that function.

- [ ] **Step 1: Write the failing test** — `src/sim/jobs/work.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { terrainIndex } from '../../data/terrain';
import { isCarrying, livingColonists } from '../colony/colonists';
import { designate, undesignate } from '../colony/designation';
import { Needs, Position } from '../components';
import { entityAt } from '../GameWorld';
import { runTicks, scenarioWorld } from '../testing/scenario';
import { openTerrain } from '../testing/terrainFixture';

const everything = { minX: 0, minY: 0, maxX: 512, maxY: 512 };

describe('harvesting', () => {
  it('chops a designated tree and hauls the wood home', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    const [c] = livingColonists(w);
    const ticks = runTicks(w, 600, () => w.stock.get('wood') === 50 && !isCarrying(c!));
    expect(ticks).toBeLessThan(600);
    expect(w.obstacles.has(tree)).toBe(false);
    expect(w.reservations.isFree(tree)).toBe(true);
  });

  it('mines a designated boulder for stone', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'boulder', x: 200, y: 256 }] });
    designate(w, everything, 'mine');
    expect(runTicks(w, 600, () => w.stock.get('stone') === 40)).toBeLessThan(600);
  });

  it('never lets two colonists work the same tree', () => {
    const w = scenarioWorld({ colonists: 2, doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    let maxWorkers = 0;
    runTicks(w, 600, () => {
      const workers = [...w.jobs.values()].filter((j) => j.kind === 'harvest' && j.target === tree);
      maxWorkers = Math.max(maxWorkers, workers.length);
      return w.stock.get('wood') === 50;
    });
    expect(maxWorkers).toBe(1);
    runTicks(w, 100);
    expect(w.stock.get('wood')).toBe(50);
  });

  it('stops and releases the tree when it is undesignated mid-chop', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'harvest' && w.jobs.get(c!)!.stage === 1);
    undesignate(w, everything);
    runTicks(w, 1);
    const job = w.jobs.get(c!);
    expect(job?.kind === 'harvest' && job.target === tree).toBe(false);
    expect(w.reservations.isFree(tree)).toBe(true);
    runTicks(w, 200);
    expect(w.obstacles.has(tree)).toBe(true);
    expect(w.stock.get('wood')).toBe(30);
  });

  it('gives up on unreachable targets instead of retrying forever', () => {
    // A tree at the centre of a 7×7-cell block of crag (its own cell is grass),
    // well away from where the colonist spawns (east of the Hearthfire).
    const terrain = openTerrain(32, 32);
    for (let y = 5; y <= 11; y++) {
      for (let x = 5; x <= 11; x++) {
        if (x !== 8 || y !== 8) terrain.set(x, y, terrainIndex('cliff'));
      }
    }
    const w = scenarioWorld({ terrain, doodads: [{ kind: 'deadTree', x: 136, y: 136 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 136, 136)!;
    const [c] = livingColonists(w);
    runTicks(w, 100);
    expect(w.unreachable.get(tree)).toBeGreaterThan(w.tick);
    expect(w.jobs.get(c!)?.target === tree).toBe(false);
    expect(w.obstacles.has(tree)).toBe(true);
  });
});

describe('idling and dying', () => {
  it('idle colonists wander near the Hearthfire on walkable ground', () => {
    const w = scenarioWorld({ colonists: 3 });
    runTicks(w, 400, () => {
      for (const c of livingColonists(w)) {
        const { cx, cy } = w.nav.cellOf(Position.x[c]!, Position.y[c]!);
        expect(w.nav.walkable(cx, cy)).toBe(true);
        expect(Math.hypot(Position.x[c]! - 256, Position.y[c]! - 256)).toBeLessThan(64);
      }
      return false;
    });
  });

  it('a colonist who dies mid-job releases what they had reserved', () => {
    const w = scenarioWorld({ doodads: [{ kind: 'deadTree', x: 330, y: 256 }] });
    designate(w, everything, 'chop');
    const tree = entityAt(w, 330, 256)!;
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'harvest');
    Needs.hunger[c!] = 0;
    Needs.health[c!] = 0.01;
    runTicks(w, 1);
    expect(livingColonists(w)).toEqual([]);
    expect(w.jobs.has(c!)).toBe(false);
    expect(w.reservations.isFree(tree)).toBe(true);
    expect(w.paths.has(c!)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure** (colonists never work: no job system yet; the first test times out at 600 ticks)

Run: `npx vitest run src/sim/jobs/work.test.ts < /dev/null`
Expected: FAIL `expected 600 to be less than 600`

- [ ] **Step 3: Create `src/sim/jobs/runners.ts`**

```ts
import { hasComponent } from 'bitecs';
import { IDLE_PAUSE_TICKS, IDLE_WANDER_RADIUS } from '../../data/colonists';
import { DOODADS, DOODAD_IDS } from '../../data/doodads';
import { markUnreachable } from '../colony/buildings';
import { carryOf, clearCarry, isCarrying, setCarry } from '../colony/colonists';
import { Designation, Doodad, Position } from '../components';
import { emit } from '../events';
import { removeWorldEntity, type GameWorld } from '../GameWorld';
import type { Vec2 } from '../geom';
import { approachPoint } from '../movement/approach';
import { moveTo } from '../movement/movement';
import type { Job, JobKind, JobStatus } from './types';

export type Runner = (world: GameWorld, eid: number, job: Job) => JobStatus;

const here = (eid: number): Vec2 => ({ x: Position.x[eid]!, y: Position.y[eid]! });

export const nextStage = (job: Job): void => {
  job.stage++;
  job.timer = 0;
  job.dest = undefined;
};

/**
 * Walk next to `target` (an obstacle entity). Fails — and marks the target
 * unreachable for a while — if there is nowhere to stand or no path; advances the
 * job to its next stage on arrival.
 */
export const walkStage = (world: GameWorld, eid: number, job: Job, target: number): JobStatus => {
  const shape = world.obstacles.get(target)?.shape;
  if (!shape) return 'failed';
  if (!job.dest) {
    const spot = approachPoint(world, shape, here(eid));
    if (!spot) {
      markUnreachable(world, target);
      return 'failed';
    }
    job.dest = spot;
  }
  const result = moveTo(world, eid, job.dest);
  if (result === 'failed') {
    markUnreachable(world, target);
    return 'failed';
  }
  if (result === 'arrived') nextStage(job);
  return 'running';
};

/** Walk to a designated doodad, work it, pick up the yield. */
const runHarvest: Runner = (world, eid, job) => {
  const target = job.target;
  if (!world.obstacles.has(target) || !hasComponent(world.ecs, target, Designation)) return 'failed';
  if (job.stage === 0) return walkStage(world, eid, job, target);
  const def = DOODADS[DOODAD_IDS[Doodad.kind[target]!]!];
  job.timer++;
  if (job.timer < (def.harvest?.workTicks ?? 0)) return 'running';
  if (def.yields) setCarry(eid, def.yields.resource, def.yields.amount);
  removeWorldEntity(world, target);
  return 'done';
};

/** Carry goods in hand to a drop point and add them to the stock. */
const runHaul: Runner = (world, eid, job) => {
  if (!isCarrying(eid)) return 'done';
  if (job.stage === 0) return walkStage(world, eid, job, job.target);
  const carried = carryOf(eid)!;
  world.stock.add(carried.resource, carried.amount);
  clearCarry(eid);
  emit(world, { type: 'stockChanged' });
  return 'done';
};

/** A walkable spot near the Hearthfire (deterministic: world RNG). */
const wanderPoint = (world: GameWorld): Vec2 | null => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const angle = world.rng.next() * Math.PI * 2;
    const radius = world.rng.next() * IDLE_WANDER_RADIUS;
    const { cx, cy } = world.nav.cellOf(
      world.start.x + Math.cos(angle) * radius,
      world.start.y + Math.sin(angle) * radius,
    );
    if (world.nav.walkable(cx, cy)) return world.nav.cellCenter(cx, cy);
  }
  return null;
};

/** Stroll somewhere near the fire, then pause briefly. */
const runIdle: Runner = (world, eid, job) => {
  if (job.stage === 0) {
    if (!job.dest) {
      const spot = wanderPoint(world);
      if (!spot) return 'done';
      job.dest = spot;
    }
    const result = moveTo(world, eid, job.dest);
    if (result === 'failed') return 'done';
    if (result === 'arrived') nextStage(job);
    return 'running';
  }
  job.timer++;
  return job.timer >= IDLE_PAUSE_TICKS + (eid % 20) ? 'done' : 'running';
};

/** Replaced in Tasks 9–10. */
const notYetImplemented: Runner = () => 'failed';

export const RUNNERS: Record<JobKind, Runner> = {
  harvest: runHarvest,
  haulToDrop: runHaul,
  deliver: notYetImplemented,
  construct: notYetImplemented,
  eat: notYetImplemented,
  sleep: notYetImplemented,
  idle: runIdle,
};
```

- [ ] **Step 4: Create `src/sim/jobs/jobSystem.ts`**

```ts
import { hasComponent, removeComponent } from 'bitecs';
import { isBlueprint, releasePending, reservePending } from '../colony/blueprint';
import { livingColonists } from '../colony/colonists';
import { Sleeping } from '../components';
import type { GameWorld } from '../GameWorld';
import { stopMoving } from '../movement/movement';
import { chooseJob } from './chooseJob';
import { RUNNERS } from './runners';
import type { Job, JobStatus } from './types';

/** Jobs whose target only one colonist may work on at a time. */
const isExclusive = (job: Job): boolean =>
  job.kind === 'harvest' || job.kind === 'construct' || (job.kind === 'eat' && job.wild === true);

export const startJob = (world: GameWorld, eid: number, job: Job): void => {
  world.jobs.set(eid, job);
  if (isExclusive(job)) world.reservations.reserve(job.target, eid);
  if (job.kind === 'deliver') reservePending(job.target, job.resource!, job.amount!);
};

/**
 * Finish or abandon a job: free its reservations, stop walking, wake up, and give a
 * failed delivery's promised amount back to the blueprint. Goods in hand stay in hand
 * (the next job will be hauling them back).
 */
export const endJob = (world: GameWorld, eid: number, job: Job, status: JobStatus): void => {
  world.jobs.delete(eid);
  world.reservations.releaseColonist(eid);
  stopMoving(world, eid);
  const undelivered = job.kind === 'deliver' && status !== 'done' && job.stage < 3;
  if (undelivered && world.obstacles.has(job.target) && isBlueprint(world, job.target)) {
    releasePending(job.target, job.resource!, job.amount!);
  }
  if (hasComponent(world.ecs, eid, Sleeping)) removeComponent(world.ecs, eid, Sleeping);
};

/** Each living colonist: pick a job if idle, then run one tick of it. */
export const jobSystem = (world: GameWorld): void => {
  for (const eid of [...livingColonists(world)]) {
    let job = world.jobs.get(eid);
    if (!job) {
      job = chooseJob(world, eid);
      startJob(world, eid, job);
    }
    const status = RUNNERS[job.kind](world, eid, job);
    if (status !== 'running') endJob(world, eid, job, status);
  }
};
```

- [ ] **Step 5: Wire it in** — `src/sim/step.ts`:

```ts
import { needsSystem } from './colony/needs';
import type { GameWorld } from './GameWorld';
import { jobSystem } from './jobs/jobSystem';
import { movementSystem } from './movement/movement';

/**
 * One fixed simulation tick. Needs first (so jobs see current needs), then jobs
 * (which may set paths), then movement (which follows them).
 */
export const stepWorld = (world: GameWorld): void => {
  world.tick++;
  needsSystem(world);
  jobSystem(world);
  movementSystem(world);
};
```

- [ ] **Step 6: `killColonist` ends the job properly** — in `src/sim/colony/needs.ts` replace the first three lines of `killColonist`'s body (`world.jobs.delete…`, `world.reservations.releaseColonist…`, the `Sleeping` removal) with:

```ts
  const job = world.jobs.get(eid);
  if (job) endJob(world, eid, job, 'failed');
  world.reservations.releaseColonist(eid);
```

and import `endJob` from `'../jobs/jobSystem'`. (No import cycle: the job system never imports `needs.ts`.)

- [ ] **Step 7: Run tests, lint, typecheck** — all pass.

Run: `npx vitest run < /dev/null && npm run lint < /dev/null && npm run typecheck < /dev/null`

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "feat(sim): job system with harvesting, hauling and idling"
```

---

### Task 9: Delivering materials and building

**Files:**
- Create: `src/sim/jobs/build.test.ts`
- Modify: `src/sim/jobs/runners.ts`, `src/sim/colony/blueprint.ts` (push colonists out on completion)

**Interfaces:**
- Consumes: Task 3 blueprint API, Task 8 `walkStage`/`nextStage`/`RUNNERS`.
- Produces: `deliver` and `construct` runners; `completeBlueprint` now also moves any colonist standing in the footprint to the nearest free spot.

**Deliver stages:** 0 walk to `job.source` → 1 take from stock (fail if nothing; shrink `amount` and pending if less) → 2 walk to the blueprint → 3 hand over (`deliverToBlueprint`). **Construct stages:** 0 walk to the blueprint → 1 add 1 progress per tick until `buildTicks`, then `completeBlueprint`.

- [ ] **Step 1: Write the failing test** — `src/sim/jobs/build.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { completeBlueprint, isBlueprint, placeBlueprint } from '../colony/blueprint';
import { isCarrying, livingColonists } from '../colony/colonists';
import { Blueprint, Position } from '../components';
import { removeWorldEntity } from '../GameWorld';
import { inflateShape, shapeContains } from '../geom';
import { runTicks, scenarioWorld } from '../testing/scenario';

const navBlocked = (w: ReturnType<typeof scenarioWorld>, x: number, y: number) => {
  const { cx, cy } = w.nav.cellOf(x, y);
  return !w.nav.walkable(cx, cy);
};

describe('building', () => {
  it('delivers wood from stock and builds a tent', () => {
    const w = scenarioWorld({ stock: { wood: 30 } });
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    expect(runTicks(w, 1500, () => !isBlueprint(w, tent))).toBeLessThan(1500);
    expect(w.stock.get('wood')).toBe(20);
    expect(navBlocked(w, 330, 300)).toBe(true);
  });

  it('waits for materials, then builds once they arrive', () => {
    const w = scenarioWorld({ stock: { wood: 0 } });
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    runTicks(w, 300);
    expect(isBlueprint(w, tent)).toBe(true);
    expect(Blueprint.progress[tent]).toBe(0);
    w.stock.add('wood', 10);
    expect(runTicks(w, 1500, () => !isBlueprint(w, tent))).toBeLessThan(1500);
    expect(w.stock.get('wood')).toBe(0);
  });

  it('brings every kind of material a building needs', () => {
    const w = scenarioWorld({ stock: { wood: 30, stone: 10 } });
    const tower = placeBlueprint(w, 'watchtower', 330, 300).eid!; // 15 wood, 10 stone
    expect(runTicks(w, 2000, () => !isBlueprint(w, tower))).toBeLessThan(2000);
    expect(w.stock.snapshot()).toMatchObject({ wood: 15, stone: 0 });
  });

  it('two deliveries for one stock: one fails cleanly, one tent still gets built', () => {
    const w = scenarioWorld({ colonists: 2, stock: { wood: 10 } });
    const a = placeBlueprint(w, 'tent', 330, 300).eid!;
    const b = placeBlueprint(w, 'tent', 180, 300).eid!;
    runTicks(w, 3000);
    const built = [a, b].filter((t) => !isBlueprint(w, t));
    expect(built).toHaveLength(1);
    const waiting = [a, b].find((t) => isBlueprint(w, t))!;
    expect(Blueprint.pending[0]![waiting]).toBe(0);
    expect(Blueprint.delivered[0]![waiting]).toBe(0);
    expect(w.stock.get('wood')).toBe(0);
  });

  it('a blueprint cancelled mid-delivery returns the goods to stock', () => {
    const w = scenarioWorld({ stock: { wood: 30 } });
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'deliver' && w.jobs.get(c!)!.stage === 2);
    expect(isCarrying(c!)).toBe(true);
    expect(w.stock.get('wood')).toBe(20);
    removeWorldEntity(w, tent);
    expect(runTicks(w, 600, () => w.stock.get('wood') === 30 && !isCarrying(c!))).toBeLessThan(600);
  });

  it('pushes colonists out of the finished footprint', () => {
    const w = scenarioWorld();
    const tent = placeBlueprint(w, 'tent', 330, 300).eid!;
    const [c] = livingColonists(w);
    Position.x[c!] = 330;
    Position.y[c!] = 300;
    completeBlueprint(w, tent);
    const footprint = inflateShape(w.obstacles.get(tent)!.shape, 4);
    expect(shapeContains(footprint, Position.x[c!]!, Position.y[c!]!)).toBe(false);
    expect(navBlocked(w, Position.x[c!]!, Position.y[c!]!)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure** (deliver/construct fail immediately → blueprints never finish)

Run: `npx vitest run src/sim/jobs/build.test.ts < /dev/null`

- [ ] **Step 3: Push-out in `completeBlueprint`** — `src/sim/colony/blueprint.ts`: add imports

```ts
import { COLONIST_RADIUS } from '../../data/colonists';
import { Position } from '../components';
import { inflateShape, shapeContains, type Shape } from '../geom';
import { approachPoint } from '../movement/approach';
import { stopMoving } from '../movement/movement';
import { livingColonists } from './colonists';
```

add the helper

```ts
/** Anyone standing where the building just appeared steps to the nearest free spot. */
const pushColonistsOut = (world: GameWorld, shape: Shape): void => {
  const keepOut = inflateShape(shape, COLONIST_RADIUS);
  for (const eid of livingColonists(world)) {
    const x = Position.x[eid]!;
    const y = Position.y[eid]!;
    if (!shapeContains(keepOut, x, y)) continue;
    const spot = approachPoint(world, shape, { x, y });
    if (!spot) continue;
    Position.x[eid] = spot.x;
    Position.y[eid] = spot.y;
    stopMoving(world, eid);
    const job = world.jobs.get(eid);
    if (job) job.dest = undefined;
  }
};
```

and call it in `completeBlueprint` right after `world.nav.block(record.shape);`:

```ts
    pushColonistsOut(world, record.shape);
```

- [ ] **Step 4: Add the runners** — `src/sim/jobs/runners.ts`: add imports

```ts
import { BUILDINGS, BUILDING_IDS } from '../../data/buildings';
import { completeBlueprint, deliverToBlueprint, isBlueprint, releasePending } from '../colony/blueprint';
import { Blueprint, Building } from '../components';
```

add

```ts
const blueprintAlive = (world: GameWorld, eid: number): boolean =>
  world.obstacles.has(eid) && isBlueprint(world, eid);

/** Fetch materials from a drop point and hand them to a blueprint. */
const runDeliver: Runner = (world, eid, job) => {
  if (!blueprintAlive(world, job.target)) return 'failed';
  const resource = job.resource!;
  switch (job.stage) {
    case 0:
      return walkStage(world, eid, job, job.source!);
    case 1: {
      const taken = world.stock.take(resource, job.amount!);
      if (taken === 0) return 'failed';
      if (taken < job.amount!) {
        releasePending(job.target, resource, job.amount! - taken);
        job.amount = taken;
      }
      setCarry(eid, resource, taken);
      emit(world, { type: 'stockChanged' });
      nextStage(job);
      return 'running';
    }
    case 2:
      return walkStage(world, eid, job, job.target);
    default:
      deliverToBlueprint(world, job.target, resource, job.amount!);
      clearCarry(eid);
      return 'done';
  }
};

/** Work on a fully supplied blueprint until it is finished. */
const runConstruct: Runner = (world, eid, job) => {
  if (!blueprintAlive(world, job.target)) return 'failed';
  if (job.stage === 0) return walkStage(world, eid, job, job.target);
  const def = BUILDINGS[BUILDING_IDS[Building.kind[job.target]!]!];
  Blueprint.progress[job.target] = Blueprint.progress[job.target]! + 1;
  if (Blueprint.progress[job.target]! < def.buildTicks) return 'running';
  completeBlueprint(world, job.target);
  return 'done';
};
```

and in `RUNNERS` set `deliver: runDeliver, construct: runConstruct`.

- [ ] **Step 5: Run tests, lint, typecheck** — all pass.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(sim): colonists deliver materials to blueprints and build them"
```

---

### Task 10: Eating, sleeping and urgent needs

**Files:**
- Create: `src/sim/jobs/survival.test.ts`
- Modify: `src/sim/jobs/runners.ts`, `src/sim/jobs/jobSystem.ts`

**Interfaces:**
- Consumes: `findEat` (Task 7), `EAT`, `NEEDS` (Task 1), `Sleeping`, `Needs` (Task 5).
- Produces: `eat` and `sleep` runners; `shouldInterrupt(world, eid, job): boolean` used by `jobSystem`.

**Interrupt rules:** hauling and eating are never interrupted. Sleep is interrupted only by urgent hunger **when food is actually available** (otherwise the colonist would thrash between sleeping and looking for food). Any other job is interrupted by urgent hunger (when food is available) or urgent rest.

- [ ] **Step 1: Write the failing test** — `src/sim/jobs/survival.test.ts`

```ts
import { hasComponent, query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { completeBlueprint, placeBlueprint } from '../colony/blueprint';
import { livingColonists } from '../colony/colonists';
import { designate } from '../colony/designation';
import { Needs, Sleeping } from '../components';
import { drainEvents } from '../events';
import { entityAt } from '../GameWorld';
import { runTicks, scenarioWorld } from '../testing/scenario';

const everything = { minX: 0, minY: 0, maxX: 512, maxY: 512 };
const builtTent = (w: ReturnType<typeof scenarioWorld>) => {
  const tent = placeBlueprint(w, 'tent', 300, 300).eid!;
  completeBlueprint(w, tent);
  return tent;
};

describe('eating', () => {
  it('eats stored food when hungry', () => {
    const w = scenarioWorld({ stock: { food: 30 } });
    const [c] = livingColonists(w);
    Needs.hunger[c!] = 10;
    expect(runTicks(w, 300, () => w.stock.get('food') === 29)).toBeLessThan(300);
    expect(Needs.hunger[c!]).toBeGreaterThan(45);
  });

  it('eats a wild glowcap when the stores are empty', () => {
    const w = scenarioWorld({ stock: { food: 0 }, doodads: [{ kind: 'glowShroom', x: 320, y: 256 }] });
    const shroom = entityAt(w, 320, 256)!;
    const [c] = livingColonists(w);
    Needs.hunger[c!] = 10;
    expect(runTicks(w, 300, () => !w.obstacles.has(shroom))).toBeLessThan(300);
    expect(Needs.hunger[c!]).toBeGreaterThan(30);
  });

  it('starves to death with nothing to eat, and it is reported', () => {
    const w = scenarioWorld({ stock: { food: 0 } });
    const [c] = livingColonists(w);
    Needs.hunger[c!] = 1;
    const ticks = runTicks(w, 2500, () => livingColonists(w).length === 0);
    expect(ticks).toBeGreaterThan(1900);
    expect(ticks).toBeLessThan(2200);
    expect(drainEvents(w)).toContainEqual({ type: 'colonistDied', eid: c, cause: 'hunger' });
  });
});

describe('sleeping', () => {
  it('fills tent beds first, then sleeps by the fire', () => {
    const w = scenarioWorld({ colonists: 3 });
    builtTent(w);
    for (const c of livingColonists(w)) Needs.rest[c] = 10;
    runTicks(w, 150);
    const sleepers = query(w.ecs, [Sleeping]);
    expect(sleepers).toHaveLength(3);
    expect(sleepers.filter((c) => Sleeping.inTent[c] === 1)).toHaveLength(2);
  });

  it('wakes up to eat when hunger becomes urgent and food exists', () => {
    const w = scenarioWorld({ stock: { food: 5 } });
    builtTent(w);
    const [c] = livingColonists(w);
    Needs.rest[c!] = 10;
    runTicks(w, 150, () => hasComponent(w.ecs, c!, Sleeping));
    Needs.hunger[c!] = 10;
    runTicks(w, 1);
    expect(w.jobs.get(c!)?.kind).toBe('eat');
    expect(hasComponent(w.ecs, c!, Sleeping)).toBe(false);
    expect(runTicks(w, 300, () => w.stock.get('food') === 4)).toBeLessThan(300);
  });

  it("doesn't thrash between sleep and food when there is nothing to eat", () => {
    const w = scenarioWorld({ stock: { food: 0 } });
    const [c] = livingColonists(w);
    Needs.rest[c!] = 10;
    Needs.hunger[c!] = 10;
    runTicks(w, 150, () => hasComponent(w.ecs, c!, Sleeping));
    runTicks(w, 100, () => {
      expect(hasComponent(w.ecs, c!, Sleeping)).toBe(true);
      return false;
    });
  });
});

describe('urgent needs interrupt work', () => {
  const choppingWorld = () => {
    const w = scenarioWorld({
      stock: { food: 5 },
      doodads: [
        { kind: 'deadTree', x: 330, y: 256 },
        { kind: 'deadTree', x: 345, y: 256 },
      ],
    });
    designate(w, everything, 'chop');
    const [c] = livingColonists(w);
    runTicks(w, 600, () => w.jobs.get(c!)?.kind === 'harvest' && w.jobs.get(c!)!.stage === 1);
    return { w, c: c! };
  };

  it('urgent hunger', () => {
    const { w, c } = choppingWorld();
    Needs.hunger[c] = 10;
    runTicks(w, 1);
    expect(w.jobs.get(c)?.kind).toBe('eat');
  });

  it('urgent rest', () => {
    const { w, c } = choppingWorld();
    Needs.rest[c] = 10;
    runTicks(w, 1);
    expect(w.jobs.get(c)?.kind).toBe('sleep');
  });
});
```

- [ ] **Step 2: Run — expect failure** (eat/sleep runners still fail immediately)

Run: `npx vitest run src/sim/jobs/survival.test.ts < /dev/null`

- [ ] **Step 3: Add the runners** — `src/sim/jobs/runners.ts`: add imports

```ts
import { addComponent } from 'bitecs';
import { EAT, NEEDS } from '../../data/colonists';
import { Needs, Sleeping } from '../components';
```

(merge `addComponent` into the existing `bitecs` import), add

```ts
const clampNeed = (v: number): number => Math.max(0, Math.min(100, v));

/** Walk to food (a drop point, or a wild glowcap), eat for a moment. */
const runEat: Runner = (world, eid, job) => {
  if (!world.obstacles.has(job.target)) return 'failed';
  if (job.stage === 0) return walkStage(world, eid, job, job.target);
  job.timer++;
  if (job.timer < EAT.ticks) return 'running';
  if (job.wild) {
    removeWorldEntity(world, job.target);
    Needs.hunger[eid] = clampNeed(Needs.hunger[eid]! + EAT.hungerPerWildShroom);
    return 'done';
  }
  if (world.stock.take('food', 1) === 0) return 'failed';
  Needs.hunger[eid] = clampNeed(Needs.hunger[eid]! + EAT.hungerPerFood);
  emit(world, { type: 'stockChanged' });
  return 'done';
};

/** Walk to a bed (or the fire), sleep until rested. */
const runSleep: Runner = (world, eid, job) => {
  if (!world.obstacles.has(job.target)) return 'failed';
  if (job.stage === 0) return walkStage(world, eid, job, job.target);
  if (!hasComponent(world.ecs, eid, Sleeping)) {
    addComponent(world.ecs, eid, Sleeping);
    const role = BUILDINGS[BUILDING_IDS[Building.kind[job.target]!]!].role;
    Sleeping.inTent[eid] = role === 'sleep' ? 1 : 0;
  }
  return Needs.rest[eid]! >= NEEDS.wakeAt ? 'done' : 'running';
};
```

set `eat: runEat, sleep: runSleep` in `RUNNERS`, and delete `notYetImplemented`.

- [ ] **Step 4: Interrupts** — `src/sim/jobs/jobSystem.ts`: import `NEEDS`, `Needs`, `findEat`; add

```ts
/** Should the current job be dropped for an urgent need? (See the rules above.) */
export const shouldInterrupt = (world: GameWorld, eid: number, job: Job): boolean => {
  if (job.kind === 'haulToDrop' || job.kind === 'eat') return false;
  const starving = Needs.hunger[eid]! < NEEDS.urgent && findEat(world, eid) !== null;
  if (job.kind === 'sleep') return starving;
  return starving || Needs.rest[eid]! < NEEDS.urgent;
};
```

and in `jobSystem`, right after `let job = world.jobs.get(eid);`:

```ts
    if (job && shouldInterrupt(world, eid, job)) {
      endJob(world, eid, job, 'failed');
      job = undefined;
    }
```

- [ ] **Step 5: Run tests, lint, typecheck** — all pass.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(sim): eating, sleeping in tents or by the fire, urgent-need interrupts"
```

---

### Task 11: Determinism and performance

**Files:**
- Create: `src/sim/simulation.test.ts`

**Interfaces:** consumes everything; produces nothing new.

- [ ] **Step 1: Write the test** — `src/sim/simulation.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { placeBlueprint } from './colony/blueprint';
import { livingColonists } from './colony/colonists';
import { designate } from './colony/designation';
import { Needs, Position } from './components';
import { createGameWorld, type GameWorld } from './GameWorld';
import { runTicks } from './testing/scenario';

const around = (w: GameWorld, r: number) => ({
  minX: w.start.x - r,
  minY: w.start.y - r,
  maxX: w.start.x + r,
  maxY: w.start.y + r,
});

/** Copy out everything that matters (component arrays are shared between worlds). */
const snapshot = (w: GameWorld) => ({
  tick: w.tick,
  stock: w.stock.snapshot(),
  obstacles: w.obstacles.size,
  colonists: livingColonists(w).map((c) => [
    c,
    Position.x[c],
    Position.y[c],
    Needs.hunger[c],
    Needs.rest[c],
    w.jobs.get(c)?.kind ?? null,
  ]),
});

const play = () => {
  const w = createGameWorld({ seed: 7 });
  designate(w, around(w, 200), 'chop');
  placeBlueprint(w, 'tent', w.start.x + 40, w.start.y + 30);
  runTicks(w, 2000);
  return snapshot(w);
};

describe('simulation', () => {
  it('is deterministic: same seed and same orders give the same world', () => {
    const a = play();
    const b = play();
    expect(b).toEqual(a);
    expect(a.stock.wood).toBeGreaterThan(30); // and work actually happened
  });

  it('benchmark: 50 colonists for 1000 ticks', () => {
    const w = createGameWorld({ seed: 7, colonists: 50 });
    designate(w, around(w, 400), 'chop');
    const t0 = performance.now();
    runTicks(w, 1000);
    const perTick = (performance.now() - t0) / 1000;
    console.info(`[bench] ${perTick.toFixed(2)} ms/tick with 50 colonists`);
    // Spec §9: above 4 ms/tick → move path-finding into a Web Worker in Phase 3.
    // This assertion only guards against pathological regressions.
    expect(perTick).toBeLessThan(20);
  }, 60_000);
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/sim/simulation.test.ts < /dev/null`
Expected: PASS. Note the `[bench]` line. If it is above 4 ms/tick, add a line to `docs/ROADMAP.md` under Phase 3: "Move PathService to a Web Worker (benchmark: N ms/tick @ 50 colonists)". If the determinism test fails, find the `Math.random`/wall-clock or `Map`-order dependency before going on.

- [ ] **Step 3: Commit**

```bash
git add src docs
git commit -m "test(sim): determinism and 50-colonist performance benchmark"
```

---
### Task 12: Placeholder art and rendering colonists, blueprints, designations

**Files:**
- Create: `src/render/bitmap.ts`, `src/render/bitmap.test.ts`, `src/render/ColonistRenderer.ts`, `src/render/DesignationMarkers.ts`
- Modify: `src/render/terrainArt.ts`, `src/render/atlas.ts`, `src/render/EntityRenderer.ts`, `src/core/events.ts`, `src/scenes/WorldScene.ts`

**Interfaces:**
- Consumes: sim API from Tasks 2–10.
- Produces:
  - `paintBitmap(rows, colors): PixelCanvas`; `ICON_IDS`, `type IconId`; `paintIcon(id)`, `paintColonist(shirt, pose)`, `paintGrave()`, `paintTorch()`, `paintWallStake()`; `type ColonistPose = 'stand' | 'walk' | 'work' | 'sleep'`; `SHIRT_COLORS`
  - atlas frames: `colonistFrame(shirt, pose)`, `iconFrame(id)`, `GRAVE_FRAME`, `buildingFrame('torch' | 'wallStake')` (real art)
  - `ColonistRenderer.update()`, `DesignationMarkers.sync(eids)`, `.remove(eid)`
  - `EntityRenderer.remove(eid)`, `.completeBuilding(eid)`, `.updateBlueprints()`; blueprints drawn translucent blue-grey
  - bus events `'stock:changed': { stock: Record<ResourceId, number> }`, `'log': { text: string }`
  - `WorldScene` drains `world.events` every frame; player placement creates blueprints.

This task is visual: its automated check is the bitmap test plus build/lint; the behaviour is verified in the browser in Step 9.

- [ ] **Step 1: Write the failing test** — `src/render/bitmap.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { paintBitmap } from './bitmap';

describe('paintBitmap', () => {
  it('paints mapped characters and leaves "." transparent', () => {
    const c = paintBitmap(['.a', 'b.'], { a: 0xff0000, b: 0x0000ff });
    expect([c.width, c.height]).toEqual([2, 2]);
    expect(c.alphaAt(0, 0)).toBe(0);
    expect(Array.from(c.data.slice(4, 8))).toEqual([255, 0, 0, 255]);
    expect(Array.from(c.data.slice(8, 12))).toEqual([0, 0, 255, 255]);
  });

  it('rejects ragged rows and unknown characters', () => {
    expect(() => paintBitmap(['..', '.'], {})).toThrow();
    expect(() => paintBitmap(['x'], {})).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure** (`Cannot find module './bitmap'`)

- [ ] **Step 3: Create `src/render/bitmap.ts`**

```ts
import { PixelCanvas } from './pixel';

/**
 * Small pixel art from text: one string per row, one char per pixel. '.' is
 * transparent; every other char must be in `colors`.
 */
export const paintBitmap = (
  rows: readonly string[],
  colors: Readonly<Record<string, number>>,
): PixelCanvas => {
  const width = rows[0]?.length ?? 0;
  const c = new PixelCanvas(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Bitmap row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const color = colors[ch];
      if (color === undefined) throw new Error(`Bitmap char '${ch}' has no colour`);
      c.set(x, y, color);
    });
  });
  return c;
};
```

- [ ] **Step 4: Art** — append to `src/render/terrainArt.ts`:

```ts
import { paintBitmap } from './bitmap';

// --- Phase 1: icons, colonists, small buildings -------------------------------------

export const ICON_IDS = ['wood', 'stone', 'food', 'chop', 'mine', 'forage', 'clear', 'wall'] as const;
export type IconId = (typeof ICON_IDS)[number];

const ICONS: Record<IconId, { rows: string[]; colors: Record<string, number> }> = {
  wood: {
    rows: ['........', '........', '.LLLLLR.', 'LLLLLLRR', 'DDDDDDRR', '.DDDDDR.', '........', '........'],
    colors: { L: PALETTE.peat, D: PALETTE.rotBrown, R: PALETTE.driedMoss },
  },
  stone: {
    rows: ['........', '...HH...', '..HSSS..', '.HSSSSS.', '.SSSSSD.', '..SSSDD.', '...DDD..', '........'],
    colors: { H: PALETTE.stoneLight, S: PALETTE.stone, D: PALETTE.slateDark },
  },
  food: {
    rows: ['........', '..GGGG..', '.GCGGGG.', 'GGGGGGGG', '...SS...', '...SS...', '..SSSS..', '........'],
    colors: { G: PALETTE.ghostGreen, C: PALETTE.candle, S: PALETTE.boneGrey },
  },
  chop: {
    rows: ['.....HH.', '....HHHH', '.....HD.', '....D...', '...D....', '..D.....', '.D......', 'D.......'],
    colors: { H: PALETTE.stoneLight, D: PALETTE.peat },
  },
  mine: {
    rows: ['.HHHHH..', 'H..D..H.', '...D....', '...D....', '...D....', '...D....', '...D....', '........'],
    colors: { H: PALETTE.stoneLight, D: PALETTE.peat },
  },
  forage: {
    rows: ['..G..G..', '.GGG.GG.', '........', '.BBBBBB.', '.BDBDBB.', '.BBBBBB.', '..BBBB..', '........'],
    colors: { G: PALETTE.ghostGreen, B: PALETTE.peat, D: PALETTE.rotBrown },
  },
  clear: {
    rows: ['X......X', '.X....X.', '..X..X..', '...XX...', '...XX...', '..X..X..', '.X....X.', 'X......X'],
    colors: { X: PALETTE.ember },
  },
  wall: {
    rows: ['.T..T..T', '.S..S..S', '.S..S..S', '.SSSSSSS', '.S..S..S', '.S..S..S', '.S..S..S', '........'],
    colors: { T: PALETTE.bone, S: PALETTE.peat },
  },
};

export const paintIcon = (id: IconId): PixelCanvas => paintBitmap(ICONS[id].rows, ICONS[id].colors);

export const paintGrave = (): PixelCanvas =>
  paintBitmap(
    [
      '....BBBB....',
      '....BSSB....',
      '..BBBSSBBB..',
      '..BSSSSSSB..',
      '..BBBSSBBB..',
      '....BSSB....',
      '....BSSB....',
      '....BSSB....',
      '....BSSB....',
      '...BBSSBB...',
      '..MMMMMMMM..',
      '.MMMMMMMMMM.',
      '.VVVVVVVVVV.',
      '............',
    ],
    { B: PALETTE.slateDark, S: PALETTE.stone, M: PALETTE.mud, V: PALETTE.ink },
  );

export const paintTorch = (): PixelCanvas =>
  paintBitmap(
    [
      '..CC..',
      '.CFFC.',
      '.FFEF.',
      '..EE..',
      '..DD..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '..PP..',
      '.PPPP.',
      '.VVVV.',
    ],
    {
      C: PALETTE.candle,
      F: PALETTE.flame,
      E: PALETTE.ember,
      D: PALETTE.emberDark,
      P: PALETTE.peat,
      V: PALETTE.ink,
    },
  );

export const paintWallStake = (): PixelCanvas =>
  paintBitmap(
    [
      '...BB...',
      '..BPPB..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '..PPPD..',
      '.MMMMMM.',
      '..VVVV..',
    ],
    { B: PALETTE.driedMoss, P: PALETTE.peat, D: PALETTE.rotBrown, M: PALETTE.mud, V: PALETTE.ink },
  );

export const SHIRT_COLORS = [PALETTE.blood, PALETTE.pine, PALETTE.shadowPlum, PALETTE.emberDark] as const;
export type ColonistPose = 'stand' | 'walk' | 'work' | 'sleep';
export const COLONIST_POSES: readonly ColonistPose[] = ['stand', 'walk', 'work', 'sleep'];

/** 16×24 colonist standing on the bottom row, lit from the top-left. */
export const paintColonist = (shirt: number, pose: ColonistPose): PixelCanvas => {
  const c = new PixelCanvas(16, 24);
  c.fillEllipse(8, 22.5, 4, 1.2, PALETTE.void, 110);
  if (pose === 'sleep') {
    // Lying down, head to the left, on a bedroll.
    c.fillRect(2, 20, 13, 2, PALETTE.mud);
    c.fillRect(4, 18, 10, 3, shirt);
    c.fillRect(1, 17, 3, 3, PALETTE.bone);
    c.set(1, 17, PALETTE.rotBrown);
    c.fillRect(13, 19, 2, 2, PALETTE.rotBrown);
    return c;
  }
  const stride = pose === 'walk' ? 1 : 0;
  c.fillRect(6 - stride, 18, 2, 4, PALETTE.rotBrown); // legs
  c.fillRect(9 + stride, 18, 2, 4, PALETTE.rotBrown);
  c.fillRect(5, 11, 7, 8, shirt); // body
  c.fillRect(11, 11, 1, 8, PALETTE.ink); // shaded side
  if (pose === 'work') {
    c.fillRect(12, 9, 2, 2, PALETTE.bone); // raised arm + tool
    c.fillRect(13, 4, 1, 6, PALETTE.peat);
    c.fillRect(12, 3, 3, 2, PALETTE.stoneLight);
    c.fillRect(4, 12, 1, 5, PALETTE.bone);
  } else {
    c.fillRect(4, 12, 1, 5, PALETTE.bone);
    c.fillRect(12, 12, 1, 5, PALETTE.bone);
  }
  c.fillRect(6, 5, 5, 6, PALETTE.bone); // head
  c.fillRect(6, 4, 5, 2, PALETTE.rotBrown); // hair
  c.set(7, 8, PALETTE.ink);
  c.set(9, 8, PALETTE.ink);
  return c;
};
```

- [ ] **Step 5: Atlas frames** — `src/render/atlas.ts`: import the new painters and types; add

```ts
export const colonistFrame = (shirt: number, pose: ColonistPose): string => `colonist_${shirt}_${pose}`;
export const iconFrame = (id: IconId): string => `icon_${id}`;
export const GRAVE_FRAME = 'grave';
```

and in `buildPlaceholderAtlas` replace the two temporary torch/wallStake entries from Task 1 with:

```ts
    { name: buildingFrame('torch'), art: paintTorch() },
    { name: buildingFrame('wallStake'), art: paintWallStake() },
    { name: GRAVE_FRAME, art: paintGrave() },
    ...ICON_IDS.map((id) => ({ name: iconFrame(id), art: paintIcon(id) })),
    ...SHIRT_COLORS.flatMap((color, shirt) =>
      COLONIST_POSES.map((pose) => ({ name: colonistFrame(shirt, pose), art: paintColonist(color, pose) })),
    ),
```

- [ ] **Step 6: Blueprints in `src/render/EntityRenderer.ts`** — add imports `hasComponent` (bitecs), `BUILDINGS`, `RESOURCE_IDS`, `resourceIndex`, `Blueprint`, `PALETTE`, and:

```ts
const BLUEPRINT_TINT = 0x8fa7c8;
const BLUEPRINT_ALPHA = 0.55;
```

Add a field `private readonly bars: Phaser.GameObjects.Graphics;` created in the constructor as `scene.add.graphics().setDepth(999_000)` (before the loops). In `addBuilding`, after creating `img`:

```ts
    if (hasComponent(this.world.ecs, eid, Blueprint)) img.setTint(BLUEPRINT_TINT).setAlpha(BLUEPRINT_ALPHA);
```

and add the methods:

```ts
  remove(eid: number): void {
    this.sprites.get(eid)?.destroy();
    this.sprites.delete(eid);
  }

  /** A blueprint became a real building: full colour and a small "thud". */
  completeBuilding(eid: number): void {
    const img = this.sprites.get(eid);
    if (!img) return;
    img.clearTint().setAlpha(1).setScale(1, 0.85);
    this.scene.tweens.add({ targets: img, scaleY: 1, duration: 120, ease: 'Back.easeOut' });
  }

  /** Under each blueprint: materials delivered (bone) and build progress (flame). */
  updateBlueprints(): void {
    const g = this.bars.clear();
    for (const eid of query(this.world.ecs, [Blueprint])) {
      const record = this.world.obstacles.get(eid);
      if (!record) continue;
      const def = BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!];
      const shape = record.shape;
      const width = Math.max(12, shape.kind === 'rect' ? shape.hw * 2 : shape.r * 2);
      const x = Math.round(shape.cx - width / 2);
      const y = Math.round(shapeBottom(shape) + 3);
      let need = 0;
      let have = 0;
      for (const [res, amount] of Object.entries(def.cost)) {
        need += amount ?? 0;
        have += Blueprint.delivered[resourceIndex(res as (typeof RESOURCE_IDS)[number])]![eid]!;
      }
      g.fillStyle(PALETTE.ink, 0.85).fillRect(x - 1, y - 1, width + 2, 4);
      g.fillStyle(PALETTE.boneGrey, 1).fillRect(x, y, Math.round((width * have) / Math.max(1, need)), 1);
      g.fillStyle(PALETTE.flame, 1).fillRect(x, y + 1, Math.round((width * Blueprint.progress[eid]!) / def.buildTicks), 1);
    }
  }
```

- [ ] **Step 7: Create `src/render/ColonistRenderer.ts`**

```ts
import { hasComponent, query } from 'bitecs';
import type Phaser from 'phaser';
import { carryOf } from '../sim/colony/colonists';
import { Colonist, Dead, Position, Sleeping } from '../sim/components';
import type { GameWorld } from '../sim/GameWorld';
import { isMoving } from '../sim/movement/movement';
import { textStyle } from '../ui/theme';
import { PALETTE } from '../data/palette';
import { GRAVE_FRAME, SPRITES_KEY, colonistFrame, iconFrame } from './atlas';
import type { ColonistPose } from './terrainArt';

interface ColonistView {
  body: Phaser.GameObjects.Image;
  carry: Phaser.GameObjects.Image;
  zzz: Phaser.GameObjects.Text;
}

/** Colonist sprites: pose from what they're doing, a carry icon, "z" while asleep, a grave when dead. */
export class ColonistRenderer {
  private readonly views = new Map<number, ColonistView>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: GameWorld,
  ) {}

  update(): void {
    const { world } = this;
    for (const eid of query(world.ecs, [Colonist])) {
      const view = this.views.get(eid) ?? this.create(eid);
      const x = Math.round(Position.x[eid]!);
      const y = Math.round(Position.y[eid]!);
      const dead = hasComponent(world.ecs, eid, Dead);
      const asleep = !dead && hasComponent(world.ecs, eid, Sleeping);
      const frame = dead ? GRAVE_FRAME : colonistFrame(Colonist.shirt[eid]!, this.pose(eid, asleep));
      if (view.body.frame.name !== frame) view.body.setFrame(frame);
      view.body.setPosition(x, y + 1);
      if (view.body.depth !== y) view.body.setDepth(y);

      const carried = dead ? null : carryOf(eid);
      view.carry.setVisible(carried !== null);
      if (carried) {
        const icon = iconFrame(carried.resource);
        if (view.carry.frame.name !== icon) view.carry.setFrame(icon);
        view.carry.setPosition(x, y - 24);
        if (view.carry.depth !== y + 0.1) view.carry.setDepth(y + 0.1);
      }

      view.zzz.setVisible(asleep);
      if (asleep) {
        view.zzz.setPosition(x + 4, y - 14 - (Math.floor(world.tick / 8) % 3));
        if (view.zzz.depth !== y + 0.1) view.zzz.setDepth(y + 0.1);
      }
    }
  }

  private create(eid: number): ColonistView {
    const view: ColonistView = {
      body: this.scene.add.image(0, 0, SPRITES_KEY, colonistFrame(0, 'stand')).setOrigin(0.5, 1),
      carry: this.scene.add.image(0, 0, SPRITES_KEY, iconFrame('wood')).setOrigin(0.5, 1).setVisible(false),
      zzz: this.scene.add.text(0, 0, 'z', textStyle(8, PALETTE.bone)).setOrigin(0.5, 1).setVisible(false),
    };
    this.views.set(eid, view);
    return view;
  }

  private pose(eid: number, asleep: boolean): ColonistPose {
    if (asleep) return 'sleep';
    const { world } = this;
    if (isMoving(world, eid)) return Math.floor(world.tick / 3) % 2 === 0 ? 'walk' : 'stand';
    const job = world.jobs.get(eid);
    const working = job && job.stage > 0 && (job.kind === 'harvest' || job.kind === 'construct');
    if (working) return Math.floor(world.tick / 5) % 2 === 0 ? 'work' : 'stand';
    return 'stand';
  }
}
```

- [ ] **Step 8: Create `src/render/DesignationMarkers.ts`**

```ts
import type Phaser from 'phaser';
import { designationOf } from '../sim/colony/designation';
import { Position } from '../sim/components';
import type { GameWorld } from '../sim/GameWorld';
import { SPRITES_KEY, iconFrame } from './atlas';
import type { EntityRenderer } from './EntityRenderer';

/** A small tool icon floating above every designated doodad. */
export class DesignationMarkers {
  private readonly icons = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: GameWorld,
    private readonly entities: EntityRenderer,
  ) {}

  sync(eids: readonly number[]): void {
    for (const eid of eids) {
      const kind = this.world.obstacles.has(eid) ? designationOf(this.world, eid) : null;
      if (!kind) {
        this.remove(eid);
        continue;
      }
      const sprite = this.entities.spriteOf(eid);
      const top = sprite ? sprite.y - sprite.height : Position.y[eid]! - 12;
      const icon =
        this.icons.get(eid) ?? this.scene.add.image(0, 0, SPRITES_KEY, iconFrame(kind)).setOrigin(0.5, 1);
      icon.setFrame(iconFrame(kind)).setPosition(Math.round(Position.x[eid]!), Math.round(top - 1));
      icon.setDepth(Position.y[eid]! + 0.2).setAlpha(0.9);
      this.icons.set(eid, icon);
    }
  }

  remove(eid: number): void {
    this.icons.get(eid)?.destroy();
    this.icons.delete(eid);
  }
}
```

- [ ] **Step 9: Wire into the scene** — `src/core/events.ts`: import `type ResourceId`; add to `GameEvents`:

```ts
  'stock:changed': { stock: Record<ResourceId, number> };
  /** A line for the event log ("… đã chết vì đói."). */
  log: { text: string };
```

`src/scenes/WorldScene.ts`:

1. Imports: `ColonistRenderer`, `DesignationMarkers`, `placeBlueprint` (from `../sim/colony/blueprint`), `colonistAt`, `colonistName` (from `../sim/colony/colonists`), `drainEvents` (from `../sim/events`), `Building` (from `../sim/components`), `BUILDING_IDS`; drop `placeBuilding` from the GameWorld import.
2. Fields: `private colonists!: ColonistRenderer;` and `private markers!: DesignationMarkers;`, created in `create()` right after `this.entities = …`:
   ```ts
   this.colonists = new ColonistRenderer(this, this.world);
   this.markers = new DesignationMarkers(this, this.world, this.entities);
   ```
3. `update()` — after the sim tick loop:
   ```ts
   this.handleWorldEvents();
   this.colonists.update();
   this.entities.updateBlueprints();
   ```
4. Add:
   ```ts
   /** Apply what the simulation reported since last frame. */
   private handleWorldEvents(): void {
     for (const e of drainEvents(this.world)) {
       switch (e.type) {
         case 'entityRemoved':
           this.entities.remove(e.eid);
           this.markers.remove(e.eid);
           if (this.selected === e.eid) this.select(null);
           this.worldVersion++;
           this.debug.refresh();
           break;
         case 'blueprintPlaced':
           this.entities.addBuilding(e.eid);
           this.worldVersion++;
           break;
         case 'buildingCompleted': {
           this.entities.completeBuilding(e.eid);
           this.worldVersion++;
           this.debug.refresh();
           const name = BUILDINGS[BUILDING_IDS[Building.kind[e.eid]!]!].nameVi;
           this.bus.emit('log', { text: `Đã xây xong ${name}.` });
           break;
         }
         case 'designationChanged':
           this.markers.sync(e.eids);
           break;
         case 'stockChanged':
           this.bus.emit('stock:changed', { stock: this.world.stock.snapshot() });
           break;
         case 'colonistDied': {
           const why = e.cause === 'hunger' ? 'đói' : 'kiệt sức';
           this.bus.emit('log', { text: `${colonistName(e.eid)} đã chết vì ${why}.` });
           break;
         }
       }
     }
   }
   ```
5. `tryPlace`: call `placeBlueprint` instead of `placeBuilding`; delete the `addBuilding`/tween/`debug.refresh`/`worldVersion++` lines (the event handler does them) and call `this.handleWorldEvents()` right after a successful placement so the blueprint shows immediately.
6. `onTap` inspect branch: `this.select(colonistAt(this.world, x, y) ?? entityAt(this.world, x, y));`
7. `select(eid)`: just store `this.selected = eid` and emit; move the ring drawing into a new `drawSelection()` called from `update()` every frame, so the ring follows a walking colonist:
   ```ts
   private drawSelection(): void {
     const g = this.selection.clear();
     const eid = this.selected;
     if (eid === null) return;
     let cx: number;
     let bottom: number;
     let w: number;
     const record = this.world.obstacles.get(eid);
     if (record) {
       cx = record.shape.cx;
       bottom = shapeBottom(record.shape);
       w = record.shape.kind === 'rect' ? record.shape.hw * 2 + 6 : record.shape.r * 2 + 6;
     } else if (hasComponent(this.world.ecs, eid, Colonist)) {
       cx = Position.x[eid]!;
       bottom = Position.y[eid]!;
       w = 12;
     } else {
       return;
     }
     g.lineStyle(1, PALETTE.flame, 1).strokeEllipse(cx, bottom - 1, w, Math.max(5, w * 0.35));
     if (g.depth !== bottom - 0.25) g.setDepth(bottom - 0.25);
   }
   ```
   (import `hasComponent`, `Colonist`, `Position`).

- [ ] **Step 10: Run tests, lint, typecheck, build** — all pass.

Run: `npx vitest run < /dev/null && npm run lint < /dev/null && npm run typecheck < /dev/null && npm run build < /dev/null`

- [ ] **Step 11: Look at it** — `npm run dev`, start a game. Expect: three colonists near the fire, wandering; place a Lều → translucent blueprint → a colonist walks to the fire, carries wood (log icon over head), the bone bar fills, then the flame bar, then the tent turns solid with a thud. HUD will not show stock yet (Task 14). Console clean.

- [ ] **Step 12: Commit**

```bash
git add src
git commit -m "feat(render): colonists, blueprints with progress, designation icons, world events"
```

---

### Task 13: Order tools — designate, walls, territory

**Files:**
- Create: `src/render/WallPreview.ts`
- Modify: `src/platform/CameraController.ts`, `src/core/events.ts`, `src/scenes/WorldScene.ts` (full file below)

**Interfaces:**
- Consumes: `designate`/`undesignate` (Task 4), `planWall`/`placeWall` (Task 3), `TERRITORY_RADIUS` (Task 1).
- Produces:
  - `type OrderTool = DesignationKind | 'clear' | 'wall'` (in `src/core/events.ts`)
  - bus events `'ui:tool': { tool: OrderTool | null }`, `'tool:changed': { tool: OrderTool | null }`, `'ui:focus-colonist': { eid: number }`
  - `CameraControllerOptions.onClaimedDragEnd?: (worldX, worldY) => void`
  - Keys: `Q` chop · `E` mine · `R` forage · `T` clear · `F` wall (WASD stays the camera, 1–3 the speed).

**Behaviour:**
- Designate tools — mouse: drag a box (left button; right/middle still pan), click = small area at the point. Touch: tap a doodad (drag still pans).
- Wall — mouse: press at A, drag to B (stake ghosts preview), release places. Click = one stake. Touch: tap A, tap B (preview), press **Đặt**.
- Territory circle shows while placing a building or a wall.

- [ ] **Step 1: Camera drag end** — `src/platform/CameraController.ts`: add to `CameraControllerOptions`

```ts
  /** A claimed drag ended (the pointer was released after moving). */
  onClaimedDragEnd?: (worldX: number, worldY: number) => void;
```

and at the top of `onPointerUp`:

```ts
    if (drag && drag.pointerId === pointer.id && drag.claimed && drag.dragging) {
      const world = this.screenToWorld(pointer.x, pointer.y);
      this.options.onClaimedDragEnd?.(world.x, world.y);
    }
```

- [ ] **Step 2: Events** — `src/core/events.ts`: import `type DesignationKind` from `../data/doodads`; add

```ts
/** Map tools that aren't buildings: harvest designations, clearing them, walls. */
export type OrderTool = DesignationKind | 'clear' | 'wall';
```

and to `GameEvents`:

```ts
  'ui:tool': { tool: OrderTool | null };
  'tool:changed': { tool: OrderTool | null };
  'ui:focus-colonist': { eid: number };
```

- [ ] **Step 3: Create `src/render/WallPreview.ts`**

```ts
import type Phaser from 'phaser';
import type { WallStakePlan } from '../sim/colony/blueprint';
import { SPRITES_KEY, buildingFrame } from './atlas';

const OK_TINT = 0x9cffb0;
const BAD_TINT = 0xff7070;

/** Ghost stakes along a wall being dragged (pooled images). */
export class WallPreview {
  private readonly pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  show(plan: readonly WallStakePlan[]): void {
    while (this.pool.length < plan.length) {
      this.pool.push(
        this.scene.add.image(0, 0, SPRITES_KEY, buildingFrame('wallStake')).setOrigin(0.5, 1).setAlpha(0.7),
      );
    }
    this.pool.forEach((img, i) => {
      const stake = plan[i];
      img.setVisible(stake !== undefined);
      if (!stake) return;
      img.setPosition(stake.x, stake.y + 6).setTint(stake.ok ? OK_TINT : BAD_TINT);
      if (img.depth !== stake.y + 4) img.setDepth(stake.y + 4);
    });
  }

  hide(): void {
    for (const img of this.pool) img.setVisible(false);
  }
}
```

- [ ] **Step 4: Replace `src/scenes/WorldScene.ts`** with the complete file:

```ts
import { hasComponent } from 'bitecs';
import Phaser from 'phaser';
import {
  createGameBus,
  type EventBus,
  type GameEvents,
  type OrderTool,
} from '../core/events';
import { BUILDINGS, BUILDING_IDS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { TERRITORY_RADIUS } from '../data/colonists';
import { PALETTE, toCss } from '../data/palette';
import { CameraController } from '../platform/CameraController';
import { ColonistRenderer } from '../render/ColonistRenderer';
import { DebugOverlay } from '../render/DebugOverlay';
import { DesignationMarkers } from '../render/DesignationMarkers';
import { EntityRenderer } from '../render/EntityRenderer';
import { PlacementPreview } from '../render/PlacementPreview';
import { TerrainRenderer } from '../render/TerrainRenderer';
import { WallPreview } from '../render/WallPreview';
import { placeBlueprint, placeWall, planWall } from '../sim/colony/blueprint';
import { colonistAt, colonistName } from '../sim/colony/colonists';
import { designate, undesignate } from '../sim/colony/designation';
import { Building, Colonist, Position } from '../sim/components';
import { drainEvents } from '../sim/events';
import { checkPlacement, createGameWorld, entityAt, type GameWorld } from '../sim/GameWorld';
import {
  inflateShape,
  shapeBottom,
  shapeContains,
  type Bounds,
  type Shape,
  type Vec2,
} from '../sim/geom';
import type { GameSpeed } from '../sim/SimClock';
import { stepWorld } from '../sim/step';
import { SCENES, type WorldSceneData } from './keys';

/** Data handed to the HUD overlay scene. */
export interface HudSceneData {
  bus: EventBus<GameEvents>;
  world: GameWorld;
  initialZoom: number;
  isTouch: boolean;
}

/** Right-clicks that moved less than this (screen px) count as "cancel", not a pan. */
const RIGHT_CLICK_SLOP = 8;
/** Half-size of the area a single click/tap designates (world px). */
const TAP_AREA = 3;

const TOOL_COLORS: Record<Exclude<OrderTool, 'wall'>, number> = {
  chop: PALETTE.flame,
  mine: PALETTE.stoneLight,
  forage: PALETTE.ghostGreen,
  clear: PALETTE.ember,
};

const TOOL_KEYS: Record<string, OrderTool> = { Q: 'chop', E: 'mine', R: 'forage', T: 'clear', F: 'wall' };

const boxBetween = (a: Vec2, b: Vec2): Bounds => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});

/**
 * The main play scene: owns the simulation, renders the world and turns input into
 * selection, building placement and orders. UI lives in HudScene (event bus only).
 */
export class WorldScene extends Phaser.Scene {
  private world!: GameWorld;
  private bus!: EventBus<GameEvents>;
  private entities!: EntityRenderer;
  private colonists!: ColonistRenderer;
  private markers!: DesignationMarkers;
  private preview!: PlacementPreview;
  private wallPreview!: WallPreview;
  private debug!: DebugOverlay;
  private cameraController!: CameraController;
  private selection!: Phaser.GameObjects.Graphics;
  private box!: Phaser.GameObjects.Graphics;
  private territory!: Phaser.GameObjects.Graphics;
  private shiftKey: Phaser.Input.Keyboard.Key | undefined;

  private buildKind: BuildingId | null = null;
  private lastBuildKind: BuildingId = 'tent';
  private orderTool: OrderTool | null = null;
  private snapToggle = false;
  /** Touch flow: where the ghost was dropped, waiting for Đặt / Huỷ. */
  private pending: Vec2 | null = null;
  private cursor: Vec2 | null = null;
  private selected: number | null = null;
  private lastStatusKey = '';
  /** Inputs of the last ghost check; the ghost is only recomputed when they change. */
  private ghostKey = '';
  private ghostShape: Shape | null = null;
  /** Bumped whenever buildings change, so the cached ghost check is invalidated. */
  private worldVersion = 0;
  /** After a mouse placement, keep "Đã đặt …" on screen until the cursor moves. */
  private holdStatusAt: string | null = null;
  /** Touch: offset from the finger to the ghost while dragging it. */
  private dragOffset: Vec2 = { x: 0, y: 0 };
  /** What the current claimed drag is doing. */
  private claim: 'ghost' | 'tool' | null = null;
  /** Mouse drag start for box designation / wall. */
  private dragStart: Vec2 | null = null;
  /** Touch wall: first and second tap. */
  private wallStart: Vec2 | null = null;
  private wallEnd: Vec2 | null = null;

  constructor() {
    super(SCENES.world);
  }

  create(data: WorldSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.buildKind = null;
    this.orderTool = null;
    this.snapToggle = false;
    this.pending = null;
    this.cursor = null;
    this.selected = null;
    this.lastStatusKey = '';
    this.ghostKey = '';
    this.ghostShape = null;
    this.worldVersion = 0;
    this.holdStatusAt = null;
    this.claim = null;
    this.dragStart = null;
    this.wallStart = null;
    this.wallEnd = null;

    this.world = createGameWorld({ seed: data.seed });
    this.bus = createGameBus();
    this.cameras.main.setBackgroundColor(toCss(PALETTE.void));

    new TerrainRenderer(this, this.world.terrain);
    this.entities = new EntityRenderer(this, this.world);
    this.colonists = new ColonistRenderer(this, this.world);
    this.markers = new DesignationMarkers(this, this.world, this.entities);
    this.preview = new PlacementPreview(this);
    this.wallPreview = new WallPreview(this);
    this.debug = new DebugOverlay(this, this.world);
    this.selection = this.add.graphics();
    this.box = this.add.graphics().setDepth(999_500);
    this.territory = this.add
      .graphics()
      .setDepth(-900_000)
      .lineStyle(1, PALETTE.candle, 0.35)
      .strokeCircle(this.world.start.x, this.world.start.y, TERRITORY_RADIUS)
      .setVisible(false);

    const pad = 32;
    this.cameraController = new CameraController(this, {
      bounds: {
        x: -pad,
        y: -pad,
        width: this.world.terrain.widthPx + pad * 2,
        height: this.world.terrain.heightPx + pad * 2,
      },
      onTap: (x, y, pointer) => this.onTap(x, y, pointer),
      onZoomChange: (zoom) => this.bus.emit('camera:zoom', { zoom }),
      claimDrag: (x, y, pointer) => this.claimDrag(x, y, pointer),
      onClaimedDrag: (x, y) => this.onClaimedDrag(x, y),
      onClaimedDragEnd: (x, y) => this.onClaimedDragEnd(x, y),
    });
    this.cameraController.centerOn(this.world.start.x, this.world.start.y);

    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.bindBus();
    this.bindKeys();

    // The HUD starts on the next frame, so it reads initial state from this data
    // instead of relying on events emitted now.
    this.scene.launch(SCENES.hud, {
      bus: this.bus,
      world: this.world,
      initialZoom: this.cameraController.zoom,
      isTouch: this.sys.game.device.input.touch,
    } satisfies HudSceneData);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
      this.scene.stop(SCENES.hud);
      this.bus.clear();
    });
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);
    this.trackCursor();
    if (this.buildKind) this.refreshGhost();

    const ticks = this.world.clock.advance(delta);
    for (let i = 0; i < ticks; i++) stepWorld(this.world);
    if (ticks > 0) this.bus.emit('clock:tick', { tick: this.world.clock.tick });

    this.handleWorldEvents();
    this.colonists.update();
    this.entities.updateBlueprints();
    this.drawSelection();
  }

  // --- world events -------------------------------------------------------------------

  /** Apply what the simulation reported since last frame. */
  private handleWorldEvents(): void {
    for (const e of drainEvents(this.world)) {
      switch (e.type) {
        case 'entityRemoved':
          this.entities.remove(e.eid);
          this.markers.remove(e.eid);
          if (this.selected === e.eid) this.select(null);
          this.worldVersion++;
          this.debug.refresh();
          break;
        case 'blueprintPlaced':
          this.entities.addBuilding(e.eid);
          this.worldVersion++;
          break;
        case 'buildingCompleted': {
          this.entities.completeBuilding(e.eid);
          this.worldVersion++;
          this.debug.refresh();
          const name = BUILDINGS[BUILDING_IDS[Building.kind[e.eid]!]!].nameVi;
          this.bus.emit('log', { text: `Đã xây xong ${name}.` });
          break;
        }
        case 'designationChanged':
          this.markers.sync(e.eids);
          break;
        case 'stockChanged':
          this.bus.emit('stock:changed', { stock: this.world.stock.snapshot() });
          break;
        case 'colonistDied': {
          const why = e.cause === 'hunger' ? 'đói' : 'kiệt sức';
          this.bus.emit('log', { text: `${colonistName(e.eid)} đã chết vì ${why}.` });
          break;
        }
      }
    }
  }

  // --- cursor & selection ------------------------------------------------------------

  private trackCursor(): void {
    const pointer = this.input.activePointer;
    // Touch devices have no hover; only mice/pens report a cursor.
    if (pointer.wasTouch) return;
    // Same conversion and rounding as a click, so the ghost shows exactly what a click does.
    const p = this.cameraController.screenToWorld(pointer.x, pointer.y);
    const inside =
      p.x >= 0 && p.y >= 0 && p.x < this.world.terrain.widthPx && p.y < this.world.terrain.heightPx;
    const next = inside ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
    if (next?.x !== this.cursor?.x || next?.y !== this.cursor?.y) {
      this.cursor = next;
      this.bus.emit('cursor:move', next);
    }
  }

  private onTap(x: number, y: number, pointer: Phaser.Input.Pointer): void {
    this.claim = null;
    this.dragStart = null;
    const p = { x: Math.round(x), y: Math.round(y) };
    if (this.orderTool === 'wall') {
      this.tapWall(p, pointer.wasTouch);
      return;
    }
    if (this.orderTool) {
      this.applyArea({ minX: p.x - TAP_AREA, minY: p.y - TAP_AREA, maxX: p.x + TAP_AREA, maxY: p.y + TAP_AREA });
      return;
    }
    if (this.buildKind) {
      if (pointer.wasTouch) {
        // Touch: drop the ghost, then confirm with Đặt — no accidental builds.
        this.pending = p;
        this.refreshGhost();
      } else {
        this.tryPlace(p.x, p.y);
      }
      return;
    }
    this.select(colonistAt(this.world, x, y) ?? entityAt(this.world, x, y));
  }

  private claimDrag(x: number, y: number, pointer: Phaser.Input.Pointer): boolean {
    // Touch: pressing on the pending ghost drags it instead of panning the map.
    if (this.buildKind && this.pending && this.ghostShape && pointer.wasTouch) {
      if (shapeContains(inflateShape(this.ghostShape, 10), x, y)) {
        this.dragOffset = { x: this.pending.x - x, y: this.pending.y - y };
        this.claim = 'ghost';
        return true;
      }
    }
    // Mouse: with an order tool, the left button draws a box / a wall.
    if (this.orderTool && !pointer.wasTouch && pointer.button === 0) {
      this.dragStart = { x: Math.round(x), y: Math.round(y) };
      this.claim = 'tool';
      return true;
    }
    this.claim = null;
    return false;
  }

  private onClaimedDrag(x: number, y: number): void {
    if (this.claim === 'ghost') {
      this.pending = { x: Math.round(x + this.dragOffset.x), y: Math.round(y + this.dragOffset.y) };
      return;
    }
    if (this.claim !== 'tool' || !this.dragStart || !this.orderTool) return;
    const end = { x: Math.round(x), y: Math.round(y) };
    if (this.orderTool === 'wall') {
      this.wallPreview.show(planWall(this.world, this.dragStart, end));
      return;
    }
    const b = boxBetween(this.dragStart, end);
    const color = TOOL_COLORS[this.orderTool];
    this.box
      .clear()
      .fillStyle(color, 0.12)
      .fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY)
      .lineStyle(1, color, 0.9)
      .strokeRect(b.minX + 0.5, b.minY + 0.5, b.maxX - b.minX, b.maxY - b.minY);
  }

  private onClaimedDragEnd(x: number, y: number): void {
    if (this.claim === 'tool' && this.dragStart && this.orderTool) {
      const end = { x: Math.round(x), y: Math.round(y) };
      if (this.orderTool === 'wall') this.buildWall(this.dragStart, end);
      else this.applyArea(boxBetween(this.dragStart, end));
    }
    this.box.clear();
    this.claim = null;
    this.dragStart = null;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Right-click (without dragging) cancels the current tool.
    if (pointer.button === 2 && pointer.getDistance() < RIGHT_CLICK_SLOP) {
      if (this.buildKind) this.setBuildKind(null);
      else if (this.orderTool) this.setTool(null);
    }
  }

  private select(eid: number | null): void {
    this.selected = eid;
    this.bus.emit('entity:select', { eid });
  }

  /** Selection ring, redrawn every frame so it follows walking colonists. */
  private drawSelection(): void {
    const g = this.selection.clear();
    const eid = this.selected;
    if (eid === null) return;
    let cx: number;
    let bottom: number;
    let w: number;
    const record = this.world.obstacles.get(eid);
    if (record) {
      cx = record.shape.cx;
      bottom = shapeBottom(record.shape);
      w = record.shape.kind === 'rect' ? record.shape.hw * 2 + 6 : record.shape.r * 2 + 6;
    } else if (hasComponent(this.world.ecs, eid, Colonist)) {
      cx = Position.x[eid]!;
      bottom = Position.y[eid]!;
      w = 12;
    } else {
      return;
    }
    g.lineStyle(1, PALETTE.flame, 1).strokeEllipse(cx, bottom - 1, w, Math.max(5, w * 0.35));
    if (g.depth !== bottom - 0.25) g.setDepth(bottom - 0.25);
  }

  // --- orders ------------------------------------------------------------------------

  private setTool(tool: OrderTool | null): void {
    if (tool && this.buildKind) this.setBuildKind(null);
    this.orderTool = tool;
    this.claim = null;
    this.dragStart = null;
    this.wallStart = null;
    this.wallEnd = null;
    this.box.clear();
    this.wallPreview.hide();
    this.territory.setVisible(tool === 'wall' || this.buildKind !== null);
    if (tool) this.select(null);
    this.bus.emit('tool:changed', { tool });
  }

  private applyArea(area: Bounds): void {
    if (this.orderTool === 'clear') undesignate(this.world, area);
    else if (this.orderTool && this.orderTool !== 'wall') designate(this.world, area, this.orderTool);
    this.handleWorldEvents();
  }

  private buildWall(a: Vec2, b: Vec2): void {
    const placed = placeWall(this.world, a, b);
    this.wallPreview.hide();
    this.handleWorldEvents();
    if (placed.length > 0) this.bus.emit('build:placed', { kind: 'wallStake', eid: placed[0]! });
    else this.cameras.main.shake(80, 0.002);
  }

  /** Mouse click: a single stake. Touch: first tap = start, second tap = end (then Đặt). */
  private tapWall(p: Vec2, touch: boolean): void {
    if (!touch) {
      this.buildWall(p, p);
      return;
    }
    if (!this.wallStart || this.wallEnd) {
      this.wallStart = p;
      this.wallEnd = null;
      this.wallPreview.show(planWall(this.world, p, p));
      this.bus.emit('build:status', { ok: true, reason: null, pending: false });
      return;
    }
    this.wallEnd = p;
    const plan = planWall(this.world, this.wallStart, p);
    this.wallPreview.show(plan);
    this.bus.emit('build:status', { ok: plan.some((s) => s.ok), reason: null, pending: true });
  }

  // --- building placement ------------------------------------------------------------

  private get snapping(): boolean {
    return this.snapToggle || (this.shiftKey?.isDown ?? false);
  }

  private setBuildKind(kind: BuildingId | null): void {
    if (kind && this.orderTool) this.setTool(null);
    this.buildKind = kind;
    this.pending = null;
    if (kind) {
      this.lastBuildKind = kind;
      this.select(null);
    } else {
      this.preview.hide();
    }
    this.territory.setVisible(kind !== null || this.orderTool === 'wall');
    this.lastStatusKey = '';
    this.ghostKey = '';
    this.holdStatusAt = null;
    this.bus.emit('build:mode', { kind, snap: this.snapToggle });
  }

  private refreshGhost(): void {
    const kind = this.buildKind;
    const at = this.pending ?? this.cursor;
    if (!kind || !at) {
      this.preview.hide();
      this.ghostShape = null;
      this.ghostKey = '';
      return;
    }
    const pending = this.pending !== null;
    const key = `${kind}|${at.x}|${at.y}|${this.snapping}|${pending}|${this.worldVersion}`;
    if (key === this.ghostKey) return;
    this.ghostKey = key;

    const check = checkPlacement(this.world, kind, at.x, at.y, { snap: this.snapping });
    this.ghostShape = check.shape;
    this.preview.show(kind, check.shape, check.ok);
    const here = `${at.x}|${at.y}`;
    if (this.holdStatusAt === here) return;
    this.holdStatusAt = null;
    const statusKey = `${check.ok}|${check.reason}|${pending}`;
    if (statusKey !== this.lastStatusKey) {
      this.lastStatusKey = statusKey;
      this.bus.emit('build:status', { ok: check.ok, reason: check.reason, pending });
    }
  }

  private tryPlace(x: number, y: number): boolean {
    const kind = this.buildKind;
    if (!kind) return false;
    const result = placeBlueprint(this.world, kind, x, y, { snap: this.snapping });
    if (!result.ok || result.eid === null) {
      this.cameras.main.shake(80, 0.002);
      return false;
    }
    this.handleWorldEvents();
    this.lastStatusKey = '';
    // Mouse: the cursor still sits on the new blueprint; don't immediately replace
    // "Đã đặt …" with "overlaps a building" until the player moves on.
    if (this.cursor) this.holdStatusAt = `${this.cursor.x}|${this.cursor.y}`;
    this.bus.emit('build:placed', { kind, eid: result.eid });
    return true;
  }

  // --- wiring -------------------------------------------------------------------------

  private setSpeed(speed: GameSpeed): void {
    this.world.clock.setSpeed(speed);
    this.bus.emit('clock:speed', { speed: this.world.clock.speed });
  }

  private bindBus(): void {
    this.bus.on('ui:set-speed', ({ speed }) => this.setSpeed(speed));
    this.bus.on('ui:toggle-pause', () => {
      this.world.clock.togglePause();
      this.bus.emit('clock:speed', { speed: this.world.clock.speed });
    });
    this.bus.on('ui:zoom-step', ({ direction }) => this.cameraController.stepZoom(direction));
    this.bus.on('ui:build', ({ kind }) => this.setBuildKind(kind === this.buildKind ? null : kind));
    this.bus.on('ui:tool', ({ tool }) => this.setTool(tool === this.orderTool ? null : tool));
    this.bus.on('ui:toggle-snap', () => {
      this.snapToggle = !this.snapToggle;
      this.bus.emit('build:mode', { kind: this.buildKind, snap: this.snapToggle });
    });
    this.bus.on('ui:build-confirm', () => {
      if (this.orderTool === 'wall' && this.wallStart && this.wallEnd) {
        this.buildWall(this.wallStart, this.wallEnd);
        this.wallStart = null;
        this.wallEnd = null;
        return;
      }
      // On success the HUD hears 'build:placed' (and hides Đặt/Huỷ); keep that message.
      if (this.pending && this.tryPlace(this.pending.x, this.pending.y)) {
        this.pending = null;
        this.preview.hide();
      }
    });
    this.bus.on('ui:build-cancel', () => {
      this.setBuildKind(null);
      this.setTool(null);
    });
    this.bus.on('ui:focus-colonist', ({ eid }) => {
      this.cameraController.centerOn(Position.x[eid]!, Position.y[eid]!);
      this.select(eid);
    });
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.shiftKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    kb.on('keydown-SPACE', () => this.bus.emit('ui:toggle-pause', {}));
    kb.on('keydown-ONE', () => this.setSpeed(1));
    kb.on('keydown-TWO', () => this.setSpeed(2));
    kb.on('keydown-THREE', () => this.setSpeed(3));
    kb.on('keydown-PLUS', () => this.cameraController.stepZoom(1));
    kb.on('keydown-NUMPAD_ADD', () => this.cameraController.stepZoom(1));
    kb.on('keydown-MINUS', () => this.cameraController.stepZoom(-1));
    kb.on('keydown-NUMPAD_SUBTRACT', () => this.cameraController.stepZoom(-1));
    kb.on('keydown-B', () => this.setBuildKind(this.buildKind ? null : this.lastBuildKind));
    for (const id of PLAYER_BUILDINGS) {
      const hotkey = BUILDINGS[id].hotkey;
      if (hotkey) kb.on(`keydown-${hotkey}`, () => this.setBuildKind(id));
    }
    for (const [key, tool] of Object.entries(TOOL_KEYS)) {
      kb.on(`keydown-${key}`, () => this.setTool(this.orderTool === tool ? null : tool));
    }
    kb.on('keydown-F3', (e: KeyboardEvent) => {
      e.preventDefault();
      this.debug.toggle();
    });
    kb.on('keydown-ESC', () => {
      if (this.buildKind) this.setBuildKind(null);
      else if (this.orderTool) this.setTool(null);
      else if (this.selected !== null) this.select(null);
      else this.scene.start(SCENES.mainMenu);
    });
  }
}
```

- [ ] **Step 5: Run lint, typecheck, tests, build** — all pass. (HudScene still compiles: it doesn't use the new events yet.)

- [ ] **Step 6: Look at it** — `npm run dev`: press `Q`, drag a box over trees → axe icons appear; colonists chop and haul. `T` + drag clears. `F` + drag a line inside the ring → stake ghosts, release → stake blueprints get built. Right-click / Esc leaves the tool.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(input): designation box, wall drag, territory ring and order hotkeys"
```

---
### Task 14: HUD — resources, colonist cards, event log, tabbed toolbar

**Files:**
- Modify: `src/scenes/HudScene.ts` (full file below)

**Interfaces:**
- Consumes: bus events from Tasks 12–13 (`stock:changed`, `log`, `tool:changed`, `build:*`), emits `ui:tool`, `ui:build`, `ui:toggle-snap`, `ui:build-confirm`, `ui:build-cancel`, `ui:focus-colonist`; reads (never writes) `world` for colonist cards and info.
- Produces: the Phase 1 HUD.

**Layout (works at 375 px):**

```
[Ngày 1, 00:42 — đang chạy 1×]                 [❚❚][1×][2×][3×]
[🪵30  🪨10  🍄30]                          [info: cursor/selection]
[card: Bùi Tân  ▬▬▬ ▬▬  Đang chặt cây]
[card …]
[card …]
  log line (fades)                                          [+]
  hint / placement help                                     [−]
[Bám lưới] [Đặt] [Huỷ]            ← only while placing
[⇄][tool][tool][tool][tool][tool] ← tab: Lệnh (Chặt Đào Hái Bỏ dấu) / Xây (Lều Kho Đuốc Tháp Tường)
```

Toolbar buttons are 46×60 so 1 tab + 5 buttons fit left of the zoom buttons on a 375 px phone (12 + 46 + 6 + 5 × 50 = 314 < 319).

- [ ] **Step 1: Replace `src/scenes/HudScene.ts`** with:

```ts
import { hasComponent } from 'bitecs';
import Phaser from 'phaser';
import type { EventBus, GameEvents, OrderTool } from '../core/events';
import { BUILDINGS, BUILDING_IDS, PLAYER_BUILDINGS, type BuildingId } from '../data/buildings';
import { DOODADS, DOODAD_IDS } from '../data/doodads';
import { PALETTE, toCss } from '../data/palette';
import { RESOURCES, RESOURCE_IDS, type ResourceId } from '../data/resources';
import type { TerrainDef } from '../data/terrain';
import { SPRITES_KEY, buildingFrame, iconFrame } from '../render/atlas';
import { carryOf, colonistAt, colonistName } from '../sim/colony/colonists';
import { designationOf } from '../sim/colony/designation';
import { Building, Colonist, Dead, Doodad, Needs } from '../sim/components';
import { entityAt, type GameWorld } from '../sim/GameWorld';
import type { JobKind } from '../sim/jobs/types';
import type { PlacementProblem } from '../sim/placement';
import { TICKS_PER_SECOND, type GameSpeed } from '../sim/SimClock';
import { createButton, FONT_DEBUG, textStyle, TOUCH_TARGET, type Button } from '../ui/theme';
import { SCENES } from './keys';
import type { HudSceneData } from './WorldScene';

const SPEED_LABELS: Record<GameSpeed, string> = { 0: '❚❚', 1: '1×', 2: '2×', 3: '3×' };
const MARGIN = 12;
const GAP = 6;
const TOOL_BUTTON = { w: 46, h: 60 };
const CARD = { w: 150, h: 30 };
const LOG_LINES = 3;
const LOG_TTL_MS = 8_000;

type Tab = 'orders' | 'build';

const ORDER_TOOLS: { tool: Exclude<OrderTool, 'wall'>; label: string }[] = [
  { tool: 'chop', label: 'Chặt' },
  { tool: 'mine', label: 'Đào' },
  { tool: 'forage', label: 'Hái' },
  { tool: 'clear', label: 'Bỏ dấu' },
];

/** Placement problems, phrased as what to do about them. */
const PLACEMENT_HELP: Record<PlacementProblem, string> = {
  outOfBounds: 'Quá sát mép bản đồ — dời vào trong.',
  terrain: 'Nền này không xây được — chọn chỗ đất khô.',
  building: 'Chồng lên công trình khác — dời ra một chút.',
  doodad: 'Vướng cây hoặc đá — chọn chỗ trống khác.',
  outOfTerritory: 'Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn.',
};

const TOOL_HINTS: Record<OrderTool, { mouse: string; touch: string }> = {
  chop: { mouse: 'Kéo khung quanh cây chết để chặt.', touch: 'Chạm vào cây chết để đánh dấu chặt.' },
  mine: { mouse: 'Kéo khung quanh tảng đá để đào.', touch: 'Chạm vào tảng đá để đánh dấu đào.' },
  forage: { mouse: 'Kéo khung quanh nấm phát quang để hái.', touch: 'Chạm vào nấm để đánh dấu hái.' },
  clear: { mouse: 'Kéo khung để bỏ đánh dấu.', touch: 'Chạm vào vật đã đánh dấu để bỏ.' },
  wall: {
    mouse: 'Nhấn và kéo để vẽ tường. Chuột phải để thôi.',
    touch: 'Chạm điểm đầu, chạm điểm cuối, rồi bấm Đặt.',
  },
};

const JOB_LABELS: Record<JobKind, string> = {
  harvest: 'Đang khai thác',
  haulToDrop: 'Đang vác hàng về kho',
  deliver: 'Đang chở vật liệu',
  construct: 'Đang xây',
  eat: 'Đang ăn',
  sleep: 'Đang ngủ',
  idle: 'Đang nghỉ',
};

const HARVEST_LABELS = { chop: 'Đang chặt cây', mine: 'Đang đào đá', forage: 'Đang hái nấm' };

const describeTerrain = (t: TerrainDef): string[] => {
  const lines = [t.nameVi];
  if (!t.passable) lines.push('Không đi qua được');
  else if (t.speed === 1) lines.push('Đi lại bình thường');
  else lines.push(`Đi chậm, tốc độ ×${t.speed}`);
  lines.push(t.buildable ? 'Xây được' : 'Không xây được');
  if (t.defenseBonus) {
    lines.push(`Phòng thủ ${t.defenseBonus > 0 ? '+' : ''}${t.defenseBonus} khi đứng ở đây`);
  }
  return lines;
};

interface ColonistCard {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  job: Phaser.GameObjects.Text;
  bars: Phaser.GameObjects.Graphics;
}

/**
 * Screen-space overlay (camera zoom 1, never scrolls). Reads world state for display
 * and sends player intents back through the bus — it never mutates the simulation.
 */
export class HudScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private world!: GameWorld;
  private isTouch = false;
  private status!: Phaser.GameObjects.Text;
  private debugLine!: Phaser.GameObjects.Text;
  private resources = new Map<ResourceId, Phaser.GameObjects.Text>();
  private resourceIcons: Phaser.GameObjects.Image[] = [];
  private cards = new Map<number, ColonistCard>();
  private info!: Phaser.GameObjects.Text;
  private infoBg!: Phaser.GameObjects.Rectangle;
  private message!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private log: { text: string; at: number }[] = [];
  private speedButtons = new Map<GameSpeed, Button>();
  private tabButton!: Button;
  private orderButtons = new Map<OrderTool, Button>();
  private buildButtons = new Map<BuildingId | 'wall', Button>();
  private snapButton!: Button;
  private confirmButtons: Button[] = [];
  private zoomButtons: Button[] = [];
  private tab: Tab = 'orders';
  private cursor: { x: number; y: number } | null = null;
  private selected: number | null = null;
  private zoom = 1;
  private buildKind: BuildingId | null = null;
  private tool: OrderTool | null = null;
  private pending = false;
  private unsubscribers: (() => void)[] = [];

  constructor() {
    super(SCENES.hud);
  }

  create({ bus, world, initialZoom, isTouch }: HudSceneData): void {
    // Scene instances are reused between games; reset per-game state.
    this.bus = bus;
    this.world = world;
    this.isTouch = isTouch;
    this.zoom = initialZoom;
    this.cursor = null;
    this.selected = null;
    this.buildKind = null;
    this.tool = null;
    this.pending = false;
    this.tab = 'orders';
    this.log = [];
    this.cards = new Map();
    this.resources = new Map();
    this.resourceIcons = [];
    this.orderButtons = new Map();
    this.buildButtons = new Map();
    this.speedButtons = new Map();

    this.status = this.add.text(MARGIN, MARGIN, '', textStyle(15, PALETTE.parchment));
    this.status.setShadow(1, 1, '#000', 0);
    // FPS / seed / coordinates: developer readout, hidden in production builds.
    this.debugLine = this.add
      .text(MARGIN, 0, '', textStyle(10, PALETTE.ashGrey, FONT_DEBUG))
      .setVisible(import.meta.env.DEV);

    for (const r of RESOURCE_IDS) {
      this.resourceIcons.push(this.add.image(0, 0, SPRITES_KEY, iconFrame(r)).setScale(2).setOrigin(0, 0.5));
      this.resources.set(r, this.add.text(0, 0, '', textStyle(14, PALETTE.bone)).setOrigin(0, 0.5));
    }

    this.infoBg = this.add
      .rectangle(0, 0, 10, 10, PALETTE.ink, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.shadowPlum);
    this.info = this.add.text(0, 0, '', { ...textStyle(14), lineSpacing: 3 });

    this.logText = this.add
      .text(0, 0, '', { ...textStyle(13, PALETTE.boneGrey), lineSpacing: 2 })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000', 0);
    this.message = this.add
      .text(0, 0, '', { ...textStyle(14, PALETTE.bone), wordWrap: { width: 300 } })
      .setOrigin(0, 1)
      .setShadow(1, 1, '#000', 0);

    this.createButtons();
    this.subscribe();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      for (const off of this.unsubscribers) off();
    });

    for (const [s, button] of this.speedButtons) button.setActive(s === world.clock.speed);
    this.refreshStatus();
    this.refreshResources();
    this.refreshCards();
    this.refreshInfo();
    this.showTab('orders');
  }

  update(time: number): void {
    const c = this.cursor;
    this.debugLine.setText(
      `${Math.round(this.game.loop.actualFps)} fps   zoom ${this.zoom}×   seed ${this.world.seed}` +
        (c ? `   x ${c.x} y ${c.y}` : ''),
    );
    const before = this.log.length;
    this.log = this.log.filter((l) => time - l.at < LOG_TTL_MS);
    if (this.log.length !== before) this.refreshLog();
  }

  // --- construction -------------------------------------------------------------------

  private createButtons(): void {
    for (const speed of [0, 1, 2, 3] as const) {
      this.speedButtons.set(
        speed,
        createButton(this, 0, 0, SPEED_LABELS[speed], {
          fontSize: 14,
          onClick: () =>
            speed === 0
              ? this.bus.emit('ui:toggle-pause', {})
              : this.bus.emit('ui:set-speed', { speed }),
        }),
      );
    }

    this.tabButton = createButton(this, 0, 0, '', {
      width: TOOL_BUTTON.w,
      height: TOOL_BUTTON.h,
      fontSize: 12,
      onClick: () => this.showTab(this.tab === 'orders' ? 'build' : 'orders'),
    });

    for (const { tool, label } of ORDER_TOOLS) {
      this.orderButtons.set(
        tool,
        createButton(this, 0, 0, label, {
          width: TOOL_BUTTON.w,
          height: TOOL_BUTTON.h,
          fontSize: 12,
          icon: { key: SPRITES_KEY, frame: iconFrame(tool), scale: 2 },
          onClick: () => this.bus.emit('ui:tool', { tool }),
        }),
      );
    }
    for (const id of PLAYER_BUILDINGS) {
      this.buildButtons.set(
        id,
        createButton(this, 0, 0, BUILDINGS[id].nameVi, {
          width: TOOL_BUTTON.w,
          height: TOOL_BUTTON.h,
          fontSize: 11,
          icon: { key: SPRITES_KEY, frame: buildingFrame(id) },
          onClick: () => this.bus.emit('ui:build', { kind: id }),
        }),
      );
    }
    this.buildButtons.set(
      'wall',
      createButton(this, 0, 0, 'Tường', {
        width: TOOL_BUTTON.w,
        height: TOOL_BUTTON.h,
        fontSize: 11,
        icon: { key: SPRITES_KEY, frame: iconFrame('wall'), scale: 2 },
        onClick: () => this.bus.emit('ui:tool', { tool: 'wall' }),
      }),
    );

    this.snapButton = createButton(this, 0, 0, 'Bám lưới', {
      width: 84,
      fontSize: 13,
      onClick: () => this.bus.emit('ui:toggle-snap', {}),
    });
    this.confirmButtons = [
      createButton(this, 0, 0, 'Đặt', {
        width: 64,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-confirm', {}),
      }),
      createButton(this, 0, 0, 'Huỷ', {
        width: 64,
        fontSize: 15,
        onClick: () => this.bus.emit('ui:build-cancel', {}),
      }),
    ];
    this.confirmButtons[0]!.setActive(true);

    this.zoomButtons = [
      createButton(this, 0, 0, '+', {
        fontSize: 20,
        onClick: () => this.bus.emit('ui:zoom-step', { direction: 1 }),
      }),
      createButton(this, 0, 0, '−', {
        fontSize: 20,
        onClick: () => this.bus.emit('ui:zoom-step', { direction: -1 }),
      }),
    ];
  }

  private subscribe(): void {
    const { bus } = this;
    this.unsubscribers = [
      bus.on('cursor:move', (p) => {
        this.cursor = p;
        this.refreshInfo();
      }),
      bus.on('entity:select', ({ eid }) => {
        this.selected = eid;
        this.refreshInfo();
      }),
      bus.on('camera:zoom', ({ zoom }) => {
        this.zoom = zoom;
      }),
      bus.on('clock:speed', ({ speed }) => {
        for (const [s, button] of this.speedButtons) button.setActive(s === speed);
        this.refreshStatus();
      }),
      bus.on('clock:tick', () => {
        this.refreshStatus();
        this.refreshCards();
        if (this.selected !== null) this.refreshInfo();
      }),
      bus.on('stock:changed', () => this.refreshResources()),
      bus.on('log', ({ text }) => {
        this.log.push({ text, at: this.time.now });
        this.log = this.log.slice(-LOG_LINES);
        this.refreshLog();
      }),
      bus.on('build:mode', ({ kind, snap }) => {
        this.buildKind = kind;
        this.pending = false;
        if (kind) this.showTab('build');
        for (const [id, button] of this.buildButtons) button.setActive(id === kind);
        this.snapButton.setActive(snap);
        this.setHint();
        this.layout();
      }),
      bus.on('tool:changed', ({ tool }) => {
        this.tool = tool;
        this.pending = false;
        if (tool === 'wall') this.showTab('build');
        else if (tool) this.showTab('orders');
        for (const [t, button] of this.orderButtons) button.setActive(t === tool);
        this.buildButtons.get('wall')?.setActive(tool === 'wall');
        this.setHint();
        this.layout();
      }),
      bus.on('build:status', ({ ok, reason, pending }) => {
        if (!this.buildKind && this.tool !== 'wall') return;
        this.pending = pending;
        if (!ok && reason) this.message.setColor(toCss(PALETTE.flame)).setText(PLACEMENT_HELP[reason]);
        else this.setHint();
        this.layout();
      }),
      bus.on('build:placed', ({ kind }) => {
        this.pending = false;
        this.message.setColor(toCss(PALETTE.ghostGreen)).setText(`Đã đặt ${BUILDINGS[kind].nameVi}.`);
        this.layout();
      }),
    ];
  }

  // --- toolbar ------------------------------------------------------------------------

  private showTab(tab: Tab): void {
    this.tab = tab;
    // The tab button switches to the *other* group.
    const other = tab === 'orders' ? 'Xây' : 'Lệnh';
    this.tabButton.setLabel(`⇄\n${other}`);
    for (const b of this.orderButtons.values()) b.setVisible(tab === 'orders');
    for (const b of this.buildButtons.values()) b.setVisible(tab === 'build');
    this.layout();
  }

  private setHint(): void {
    let text = '';
    if (this.buildKind) {
      const name = BUILDINGS[this.buildKind].nameVi;
      text = this.isTouch
        ? `Chạm vào bản đồ để đặt ${name}, rồi bấm Đặt.`
        : `Nhấp để đặt ${name}. Giữ Shift để bám lưới, chuột phải để thôi.`;
    } else if (this.tool) {
      text = this.isTouch ? TOOL_HINTS[this.tool].touch : TOOL_HINTS[this.tool].mouse;
    }
    this.message.setColor(toCss(PALETTE.bone)).setText(text);
  }

  // --- layout -------------------------------------------------------------------------

  private layout(): void {
    const { width, height } = this.scale;
    const speedBarWidth = 4 * (TOUCH_TARGET + GAP);
    this.status.setWordWrapWidth(Math.max(120, width - speedBarWidth - MARGIN * 3));
    this.debugLine.setY(this.status.y + this.status.height + 2);

    [0, 1, 2, 3].forEach((speed, i) => {
      const x = width - MARGIN - TOUCH_TARGET / 2 - (3 - i) * (TOUCH_TARGET + GAP);
      this.speedButtons.get(speed as GameSpeed)?.container.setPosition(x, MARGIN + TOUCH_TARGET / 2);
    });

    // Resources, then colonist cards, under the status line.
    const above = this.debugLine.visible ? this.debugLine : this.status;
    const resY = above.y + above.height + 14;
    let x = MARGIN;
    RESOURCE_IDS.forEach((r, i) => {
      this.resourceIcons[i]!.setPosition(x, resY);
      const text = this.resources.get(r)!;
      text.setPosition(x + 20, resY);
      x += 20 + text.width + 14;
    });
    let cardY = resY + 14;
    for (const card of this.cards.values()) {
      card.container.setPosition(MARGIN, cardY);
      cardY += CARD.h + 4;
    }

    // Zoom: bottom-right, stacked.
    this.zoomButtons.forEach((button, i) => {
      button.container.setPosition(
        width - MARGIN - TOUCH_TARGET / 2,
        height - MARGIN - TOUCH_TARGET / 2 - (1 - i) * (TOUCH_TARGET + GAP),
      );
    });

    // Toolbar: tab button + the visible group, bottom-left.
    const barY = height - MARGIN - TOOL_BUTTON.h / 2;
    const step = TOOL_BUTTON.w + GAP;
    this.tabButton.container.setPosition(MARGIN + TOOL_BUTTON.w / 2, barY);
    const group = this.tab === 'orders' ? [...this.orderButtons.values()] : [...this.buildButtons.values()];
    group.forEach((b, i) => b.container.setPosition(MARGIN + TOOL_BUTTON.w / 2 + (i + 1) * step, barY));
    const barTop = height - MARGIN - TOOL_BUTTON.h;

    // Placement row: snap (building only) + Đặt/Huỷ (touch pending only).
    const rowY = barTop - GAP - TOUCH_TARGET / 2;
    const showSnap = this.buildKind !== null;
    this.snapButton.setVisible(showSnap);
    for (const b of this.confirmButtons) b.setVisible(this.pending);
    let rowX = MARGIN;
    if (showSnap) {
      this.snapButton.container.setPosition(rowX + 42, rowY);
      rowX += 84 + GAP;
    }
    this.confirmButtons.forEach((b, i) => b.container.setPosition(rowX + 32 + i * (64 + GAP), rowY));
    const rowShown = showSnap || this.pending;
    const messageBottom = rowShown ? rowY - TOUCH_TARGET / 2 - GAP : barTop - GAP;
    const textWidth = Math.min(420, width - MARGIN * 3 - TOUCH_TARGET);
    this.message.setWordWrapWidth(textWidth).setPosition(MARGIN, messageBottom);
    this.logText
      .setWordWrapWidth(textWidth)
      .setPosition(MARGIN, messageBottom - (this.message.text ? this.message.height + 4 : 0));

    this.positionInfo();
  }

  /** Info panel: top-right under the speed buttons, never over the colonist cards. */
  private positionInfo(): void {
    const pad = 8;
    const { width } = this.scale;
    const maxWidth = Math.min(260, width - MARGIN * 3 - CARD.w) - pad * 2;
    this.info.setWordWrapWidth(Math.max(80, maxWidth));
    const top = MARGIN + TOUCH_TARGET + GAP;
    const left = width - MARGIN - this.info.width - pad * 2;
    this.info.setPosition(left + pad, top + pad);
    this.infoBg
      .setPosition(left, top)
      .setSize(this.info.width + pad * 2, this.info.height + pad * 2)
      .setVisible(this.info.text.length > 0);
  }

  // --- content ------------------------------------------------------------------------

  private refreshStatus(): void {
    const { clock } = this.world;
    const seconds = Math.floor(clock.tick / TICKS_PER_SECOND);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    const state = clock.paused ? 'đang tạm dừng' : `đang chạy ${clock.speed}×`;
    this.status.setText(`Ngày 1, ${mm}:${ss} — ${state}`);
  }

  private refreshResources(): void {
    const stock = this.world.stock.snapshot();
    for (const r of RESOURCE_IDS) this.resources.get(r)!.setText(String(stock[r]));
    this.layout();
  }

  private refreshLog(): void {
    this.logText.setText(this.log.map((l) => l.text).join('\n'));
  }

  private jobLabel(eid: number): string {
    if (hasComponent(this.world.ecs, eid, Dead)) return 'Đã mất';
    const job = this.world.jobs.get(eid);
    if (!job) return JOB_LABELS.idle;
    if (job.kind === 'harvest' && this.world.obstacles.has(job.target)) {
      const tool = designationOf(this.world, job.target);
      if (tool) return HARVEST_LABELS[tool];
    }
    return JOB_LABELS[job.kind];
  }

  private refreshCards(): void {
    let added = false;
    for (const eid of queryColonists(this.world)) {
      let card = this.cards.get(eid);
      if (!card) {
        card = this.createCard(eid);
        this.cards.set(eid, card);
        added = true;
      }
      const dead = hasComponent(this.world.ecs, eid, Dead);
      card.job.setText(this.jobLabel(eid));
      card.name.setColor(toCss(dead ? PALETTE.ashGrey : PALETTE.bone));
      const g = card.bars.clear();
      if (!dead) {
        const barW = 56;
        g.fillStyle(PALETTE.ink, 1).fillRect(90, 6, barW, 3).fillRect(90, 13, barW, 3);
        g.fillStyle(PALETTE.ember, 1).fillRect(90, 6, (barW * Needs.hunger[eid]!) / 100, 3);
        g.fillStyle(PALETTE.veilViolet, 1).fillRect(90, 13, (barW * Needs.rest[eid]!) / 100, 3);
      }
    }
    if (added) this.layout();
  }

  private createCard(eid: number): ColonistCard {
    const bg = this.add
      .rectangle(0, 0, CARD.w, CARD.h, PALETTE.ink, 0.8)
      .setOrigin(0, 0)
      .setStrokeStyle(1, PALETTE.shadowPlum);
    const name = this.add.text(6, 3, colonistName(eid), textStyle(12, PALETTE.bone));
    const job = this.add.text(6, 16, '', textStyle(10, PALETTE.ashGrey));
    const bars = this.add.graphics();
    const container = this.add.container(0, 0, [bg, name, job, bars]);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.bus.emit('ui:focus-colonist', { eid }),
    );
    return { container, name, job, bars };
  }

  private refreshInfo(): void {
    this.info.setText(this.describe().join('\n'));
    this.positionInfo();
  }

  /** Selected thing first; otherwise whatever is under the mouse. */
  private describe(): string[] {
    const { world } = this;
    if (this.selected !== null) return this.describeEntity(this.selected);
    const c = this.cursor;
    if (!c) return [];
    const hovered = colonistAt(world, c.x, c.y) ?? entityAt(world, c.x, c.y);
    if (hovered !== null) return this.describeEntity(hovered);
    return describeTerrain(world.terrain.atWorld(c.x, c.y));
  }

  private describeEntity(eid: number): string[] {
    const { world } = this;
    if (hasComponent(world.ecs, eid, Colonist)) {
      const lines = [colonistName(eid), this.jobLabel(eid)];
      if (hasComponent(world.ecs, eid, Dead)) return lines;
      lines.push(`No bụng ${Math.round(Needs.hunger[eid]!)}/100`);
      lines.push(`Tỉnh táo ${Math.round(Needs.rest[eid]!)}/100`);
      lines.push(`Sức khoẻ ${Math.round(Needs.health[eid]!)}/100`);
      const carried = carryOf(eid);
      if (carried) lines.push(`Đang mang ${carried.amount} ${RESOURCES[carried.resource].nameVi.toLowerCase()}`);
      return lines;
    }
    if (hasComponent(world.ecs, eid, Doodad)) {
      const def = DOODADS[DOODAD_IDS[Doodad.kind[eid]!]!];
      const lines = [def.nameVi];
      if (def.yields) {
        lines.push(`Khai thác được ${def.yields.amount} ${RESOURCES[def.yields.resource].nameVi.toLowerCase()}`);
      }
      const tool = designationOf(world, eid);
      if (tool) lines.push('Đã đánh dấu');
      lines.push(def.blocksMovement ? 'Chắn đường đi' : 'Đi xuyên qua được');
      return lines;
    }
    if (hasComponent(world.ecs, eid, Building)) {
      const def = BUILDINGS[BUILDING_IDS[Building.kind[eid]!]!];
      return [def.nameVi, 'Công trình của bạn'];
    }
    return [];
  }
}

/** All colonists, alive or dead (cards stay to show who was lost). */
const queryColonists = (world: GameWorld): readonly number[] => query(world.ecs, [Colonist]);
```

and add `query` to the `bitecs` import. (Blueprints show up as buildings here; that's fine for Phase 1.)

- [ ] **Step 2: Run lint, typecheck, tests, build** — all pass.

- [ ] **Step 3: Look at it** at 1280×720 and 375×812 (Browser pane, mobile preset): resource numbers change when wood is hauled in; three cards with orange/violet bars; tapping a card centres the camera on that colonist and selects them; the tab button switches between Lệnh and Xây; nothing overlaps at 375 px; Vietnamese renders correctly.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat(hud): resources, colonist cards, event log and tabbed order/build toolbar"
```

---

### Task 15: Docs and end-to-end verification

**Files:**
- Modify: `README.md`, `docs/GDD.md`, `CLAUDE.md`, `docs/ROADMAP.md`

- [ ] **Step 1: README** — controls table: add rows

```markdown
| Lệnh khai thác | `Q` Chặt · `E` Đào · `R` Hái · `T` Bỏ dấu; kéo khung (chuột trái) | Tab **Lệnh**, chạm từng vật |
| Tường | `F`, nhấn rồi kéo một đường | Tab **Xây** → Tường: chạm đầu, chạm cuối, **Đặt** |
| Theo dõi colonist | Click colonist hoặc thẻ tên | Chạm thẻ tên |
```

update the Xây row to mention blueprints ("đặt bản thiết kế, colonist chở vật liệu đến xây") and the Lều/Kho/Đuốc/Tháp hotkeys `Z X V C`; status list: tick Phase 1 with a one-line summary.

- [ ] **Step 2: GDD** — add a "Phase 1 đã có" section summarising: 3 resources, stock counter, drop points, job priorities (with "hunger before rest"), needs numbers (link to `src/data/colonists.ts`), territory 192 px, walls as stakes.

- [ ] **Step 3: CLAUDE.md** — add under Architecture rules:

```markdown
- **Systems order** (`src/sim/step.ts`): needs → jobs → movement. Sim → render/HUD changes go through `world.events` (drained by WorldScene each frame); never scan the ECS per frame to detect changes.
- **Jobs** are plain data (`src/sim/jobs/types.ts`) run by per-kind stage machines (`runners.ts`); `chooseJob` scores candidates. Always end jobs through `endJob` (releases reservations, pending deliveries, sleep).
- **Component arrays are module-global** (bitECS): only one live GameWorld at a time; tests comparing worlds must copy values out first.
```

- [ ] **Step 4: ROADMAP** — at the top status line: "Phase 0, 0b, 1 xong". If Task 11's benchmark was > 4 ms/tick, make sure the Phase 3 worker note is there.

- [ ] **Step 5: Full verification**

Run: `npm run lint < /dev/null; npm run typecheck < /dev/null; npm test < /dev/null; npm run build < /dev/null` — each must exit 0; record the test count.

Then in the browser (Playwright at 1280×720, Browser pane mobile 375×812):
1. New game → 3 colonists wander by the fire; HUD shows Gỗ 30 · Đá 10 · Thức ăn 30 and three cards.
2. `Q` + drag over a grove → axe icons; within ~30 s at 3× colonists chop and the wood count rises.
3. Place a Kho (Xây tab) → blueprint → colonists deliver 20 wood (count drops) → built; log says "Đã xây xong Kho."
4. `F` + drag inside the ring → wall stake blueprints → built one by one.
5. Try to build outside the ring → "Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn."
6. Mobile: tab Lệnh → Chặt → tap a tree (icon appears); tab Xây → Lều → tap → Đặt; card tap focuses the colonist; nothing overlaps.
7. Console has no errors.

- [ ] **Step 6: Commit**

```bash
git add README.md docs CLAUDE.md
git commit -m "docs: Phase 1 controls, design notes and architecture rules"
```
