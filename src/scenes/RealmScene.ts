import Phaser from 'phaser';
import type { EventBus } from '../core/events';
import { BATTLE } from '../data/battle';
import type { Edge } from '../game/battle/types';
import { drainEvents } from '../game/battle/world';
import { CONTENT } from '../game/cards/registry';
import { createGameBus, type GameEvents } from '../game/events';
import { RunController } from '../game/run/RunController';
import { checkTargetStep, targetCount } from '../game/run/board';
import type { PlayTarget, RunState } from '../game/run/state';
import { newRun } from '../game/run/yearFlow';
import { BoardRenderer } from '../render/BoardRenderer';
import { FieldRenderer } from '../render/FieldRenderer';
import { FxRenderer } from '../render/FxRenderer';
import { UnitRenderer } from '../render/UnitRenderer';
import { buildSpritesTexture } from '../render/atlas';
import { DRAG_SLOP, type Size } from '../ui/hud/layout';
import { plotHighlights } from '../ui/planning/targetHints';
import { PLANNING_ZOOM, battleCamera, cameraScroll, planningLayout } from '../ui/realm/realmLayout';
import { SCENES } from './keys';
import type { RunEndData } from './RunEndScene';

export interface RealmData {
  seed: number;
}

/** Launch data of the HUD scenes layered over the realm. */
export interface RealmHudData {
  bus: EventBus<GameEvents>;
  controller: RunController;
}

/** A card being aimed: its hand slot and the plots picked so far (2 for Dời Nhà). */
interface PendingPlay {
  handIndex: number;
  targets: number[];
}

/** Toast shown when the battle reaches the rage tick (§10.7). */
export const RAGE_TEXT = 'Quân địch nổi cơn cuồng nộ!';

/** Centre of the 5×5 board in world px (the board spans boardOrigin … +5 plots). */
const BOARD_CENTRE = {
  x: BATTLE.boardOrigin + (BATTLE.plot * 5) / 2,
  y: BATTLE.boardOrigin + (BATTLE.plot * 5) / 2,
};

/**
 * The world of a run (§10.4, §10.7, §12.1): field, board, units and effects in both phases.
 * It owns the run's bus and RunController, is the only caller of `controller.update`, turns
 * board clicks into the pending play, and layers PlanningHudScene / BattleHudScene on top.
 */
export class RealmScene extends Phaser.Scene {
  private bus!: EventBus<GameEvents>;
  private controller!: RunController;
  private field: FieldRenderer | null = null;
  private board: BoardRenderer | null = null;
  private units: UnitRenderer | null = null;
  private fx: FxRenderer | null = null;
  private pending: PendingPlay | null = null;
  private inBattle = false;
  /** The controller's auto-start check runs once, on the first frame after the HUD is up. */
  private kicked = false;
  /** The press that may become a board click (only that pointer's release counts). */
  private down: { id: number; x: number; y: number } | null = null;

  constructor() {
    super(SCENES.realm);
  }

  create(data: Partial<RealmData> = {}): void {
    // Scene instances are reused: reset every per-run field first.
    this.pending = null;
    this.inBattle = false;
    this.kicked = false;
    this.down = null;
    const seed = data.seed ?? 1;

    buildSpritesTexture(this.textures, CONTENT); // no-op once PreloadScene built it
    this.bus = createGameBus();
    this.controller = new RunController(this.bus, CONTENT, newRun(seed, 'wheat', CONTENT));
    this.field = new FieldRenderer(this, seed);
    this.board = new BoardRenderer(this, CONTENT);
    this.units = new UnitRenderer(this);
    this.fx = new FxRenderer(this);

    const bus = this.bus;
    bus.on('run:state', ({ state }) => this.onState(state));
    bus.on('battle:started', () => this.onBattleStarted());
    bus.on('ui:select-card', ({ handIndex }) => this.select(handIndex));
    bus.on('ui:cancel-play', () => this.bus.emit('ui:select-card', { handIndex: null }));
    bus.on('ui:confirm-play', () => this.confirm());
    bus.on('ui:continue', () => this.onContinue());

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.placeCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.showPlanning(this.controller.state);
    const hud: RealmHudData = { bus: this.bus, controller: this.controller };
    this.scene.launch(SCENES.planningHud, hud);
  }

  update(_time: number, delta: number): void {
    // Taken before update: the tick that ends the battle drops the runner, and that final
    // state (deaths included) must still be drawn.
    if (!this.kicked) {
      this.kicked = true;
      this.controller.kickoff(); // starts the battle at once when no card in hand is playable
    }
    const runner = this.controller.runner;
    this.controller.update(delta);
    if (runner && this.units && this.fx) {
      const alpha = runner.clock.alpha;
      const events = drainEvents(runner.world);
      this.units.sync(runner.world, alpha);
      this.fx.sync(runner.world, events, alpha);
      if (events.some((e) => e.type === 'rage')) this.bus.emit('log', { text: RAGE_TEXT });
    }
  }

  // ---- run flow --------------------------------------------------------------------------

  private onState(state: RunState): void {
    if (state.phase === 'planning') this.showPlanning(state);
  }

  private showPlanning(state: RunState): void {
    if (this.inBattle) {
      // Back from a battle: drop its sprites, show the buildings again.
      this.inBattle = false;
      this.units?.destroy();
      this.fx?.destroy();
      this.units = new UnitRenderer(this);
      this.fx = new FxRenderer(this);
      this.board?.setBuildingsVisible(true);
    }
    this.board?.render(state);
    const edges = new Set<Edge>();
    for (const wave of state.army?.waves ?? []) for (const u of wave.units) edges.add(u.edge);
    this.board?.setEdgeArrows([...edges].sort());
    if (state.played) this.setPending(null);
    else this.refreshHighlights();
    this.placeCamera();
  }

  private onBattleStarted(): void {
    this.inBattle = true;
    this.setPending(null);
    this.board?.setEdgeArrows([]);
    this.board?.setBuildingsVisible(false);
    this.placeCamera();
    this.scene.stop(SCENES.planningHud);
    const hud: RealmHudData = { bus: this.bus, controller: this.controller };
    this.scene.launch(SCENES.battleHud, hud);
  }

  /** "Tiếp tục" after the battle summary (BattleHudScene). */
  private onContinue(): void {
    const state = this.controller.state;
    if (state.phase === 'reward') {
      this.relaunchPlanningHud(); // shows the RewardModal
    } else if (state.phase === 'yearEnd') {
      this.bus.emit('ui:command', { command: { type: 'advance' } });
      // advancing may start the next battle at once (nothing playable): keep the battle HUD
      if (this.controller.state.phase === 'planning') this.relaunchPlanningHud();
    } else if (state.phase === 'ended') {
      const data: RunEndData = { state };
      this.scene.start(SCENES.runEnd, data);
    }
  }

  private relaunchPlanningHud(): void {
    this.scene.stop(SCENES.battleHud);
    const hud: RealmHudData = { bus: this.bus, controller: this.controller };
    this.scene.launch(SCENES.planningHud, hud);
  }

  // ---- pending play --------------------------------------------------------------------

  private select(handIndex: number | null): void {
    const state = this.controller.state;
    const ok =
      handIndex !== null &&
      state.phase === 'planning' &&
      !state.played &&
      state.hand[handIndex] !== undefined;
    this.setPending(ok ? { handIndex, targets: [] } : null);
  }

  private setPending(next: PendingPlay | null): void {
    this.pending = next;
    this.refreshHighlights();
    this.bus.emit('ui:pending-play', {
      handIndex: next?.handIndex ?? null,
      targets: next ? [...next.targets] : [],
      ready: this.ready(),
    });
  }

  private ready(): boolean {
    const p = this.pending;
    if (!p) return false;
    const cardId = this.controller.state.hand[p.handIndex];
    return cardId !== undefined && p.targets.length === targetCount(CONTENT.card(cardId));
  }

  private refreshHighlights(): void {
    const board = this.board;
    if (!board) return;
    const p = this.pending;
    const state = this.controller.state;
    const cardId = p ? state.hand[p.handIndex] : undefined;
    if (!p || cardId === undefined) {
      board.setHighlights(new Map());
      return;
    }
    board.setHighlights(plotHighlights(state.plots, CONTENT.card(cardId), p.targets));
  }

  /** A click on `plot` while aiming: add it as the next target (replacing the last if full). */
  private pick(plot: number): void {
    const p = this.pending;
    const cardId = p ? this.controller.state.hand[p.handIndex] : undefined;
    if (!p || cardId === undefined) return;
    const card = CONTENT.card(cardId);
    const need = targetCount(card);
    const chosen = p.targets.slice(0, need - 1);
    if (checkTargetStep(this.controller.state.plots, card, chosen, plot) !== null) return;
    this.setPending({ handIndex: p.handIndex, targets: [...chosen, plot] });
  }

  private confirm(): void {
    const p = this.pending;
    if (!p || !this.ready()) return;
    const [first, second] = p.targets;
    const target: PlayTarget =
      second === undefined
        ? { kind: 'plot', plot: first! }
        : { kind: 'two', first: first!, second };
    this.bus.emit('ui:command', { command: { type: 'play', handIndex: p.handIndex, target } });
  }

  // ---- input -----------------------------------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.down = { id: pointer.id, x: pointer.x, y: pointer.y };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const down = this.down;
    if (!down || down.id !== pointer.id) return;
    this.down = null;
    if (this.inBattle || !this.pending || !this.board) return;
    const dx = pointer.x - down.x;
    const dy = pointer.y - down.y;
    if (dx * dx + dy * dy > DRAG_SLOP * DRAG_SLOP) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const plot = this.board.plotAt(world.x, world.y);
    if (plot !== null) this.pick(plot);
  }

  // ---- camera ----------------------------------------------------------------------------

  /** Planning: zoom 2 with the board on planningLayout().board; battle: §10.7 zoom on the throne. */
  private placeCamera(): void {
    const screen: Size = { w: this.scale.width, h: this.scale.height };
    const cam = this.cameras.main;
    if (this.inBattle) {
      const { zoom, scroll } = battleCamera(screen);
      cam.setZoom(zoom).setScroll(scroll.x, scroll.y);
      return;
    }
    const board = planningLayout(screen).board;
    const target = { x: board.x + board.w / 2, y: board.y + board.h / 2 };
    const s = cameraScroll(BOARD_CENTRE, target, screen, PLANNING_ZOOM);
    cam.setZoom(PLANNING_ZOOM).setScroll(s.x, s.y);
  }

  private teardown(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.placeCamera, this);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.stop(SCENES.planningHud);
    this.scene.stop(SCENES.battleHud);
    this.controller.dispose();
    this.units?.destroy();
    this.fx?.destroy();
    this.board?.destroy();
    this.field?.destroy();
    this.units = null;
    this.fx = null;
    this.board = null;
    this.field = null;
    this.pending = null;
    this.bus.clear();
  }
}
