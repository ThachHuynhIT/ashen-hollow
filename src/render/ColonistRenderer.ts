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
      const frame = dead
        ? GRAVE_FRAME
        : colonistFrame(Colonist.shirt[eid]!, this.pose(eid, asleep));
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
      carry: this.scene.add
        .image(0, 0, SPRITES_KEY, iconFrame('wood'))
        .setOrigin(0.5, 1)
        .setVisible(false),
      zzz: this.scene.add
        .text(0, 0, 'z', textStyle(8, PALETTE.bone))
        .setOrigin(0.5, 1)
        .setVisible(false),
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
