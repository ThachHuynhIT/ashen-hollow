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

/** Job score = priority × this − distance; must exceed the map diagonal so distance only breaks ties within a priority band. */
export const JOB_PRIORITY_WEIGHT = 10_000;
