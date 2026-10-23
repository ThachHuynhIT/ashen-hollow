import Phaser from 'phaser';
import type { EventBus } from '../core/events';
import { PALETTE } from '../data/palette';
import type { Edge } from '../game/battle/types';
import { drainEvents } from '../game/battle/world';
import { CONTENT } from '../game/cards/registry';
import { createGameBus, type GameEvents } from '../game/events';
import { RunController } from '../game/run/RunController';
import { checkTargetStep, targetCount } from '../game/run/board';
import type { PlayTarget, RunState } from '../game/run/state';
import { RULES_FULL } from '../data/rules';
import type { KingId } from '../data/types';
import { newRun } from '../game/run/yearFlow';
import { BoardRenderer } from '../render/BoardRenderer';
import { FieldRenderer } from '../render/FieldRenderer';
import { FxRenderer } from '../render/FxRenderer';
import { UnitRenderer } from '../render/UnitRenderer';
import { buildSpritesTexture } from '../render/atlas';
import { DRAG_SLOP, type Size } from '../ui/hud/layout';
import { lockedPlotTap, plotHighlights, plotIllegalReason } from '../ui/planning/targetHints';
import { lockedPlotPrice } from '../ui/realm/calendarModel';
import { realmCamera, realmCameraMix } from '../ui/realm/realmLayout';
import { SCENES } from './keys';
import { STORAGE_WARNING_KEY, WARNING_EVENT, getSession } from './sessionRegistry';
import type { RunEndData } from './RunEndScene';

/**
 * Launch data of the realm: a new run (seed + chosen king, from the king-select scene) or a
 * saved run to resume exactly as written (`resume`, from the menu's "Tiếp tục").
 */
export type RealmData = { seed: number; kingId: KingId } | { resume: RunState };

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

/** Duration of the planning → battle camera ease (only when the two zooms differ, i.e. mobile). */
const CAMERA_EASE_MS = 400;

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
  /** A locked plot waiting for ✓ to be bought. */
  private pendingBuy: number | null = null;
  private inBattle = false;
  /** The controller's auto-start check runs once, on the first frame after the HUD is up. */
  private kicked = false;
  /** A resumed run saved at the year's end goes on to the next year (its summary is not stored). */
  private resumedAtYearEnd = false;
  private readonly onResize = (): void => this.placeCamera();
  /** The running planning ↔ battle camera ease, if any. */
  private cameraEase: Phaser.Tweens.Tween | null = null;
  /** The press that may become a board click (only that pointer's release counts). */
  private down: { id: number; x: number; y: number } | null = null;

  constructor() {
    super(SCENES.realm);
  }

  create(data: RealmData | undefined): void {
    // Scene instances are reused: reset every per-run field first.
    this.pending = null;
    this.pendingBuy = null;
    this.inBattle = false;
    this.kicked = false;
    this.resumedAtYearEnd = false;
    this.cameraEase = null;
    this.down = null;
    const resume = data !== undefined && 'resume' in data ? data.resume : null;
    const fresh = data !== undefined && 'seed' in data ? data : { seed: 1, kingId: 'wheat' as KingId };
    const initial = resume ?? newRun(fresh.seed, fresh.kingId, CONTENT, RULES_FULL);
    const seed = initial.seed;
    this.resumedAtYearEnd = resume?.phase === 'yearEnd';

    buildSpritesTexture(this.textures, CONTENT); // no-op once PreloadScene built it
    this.bus = createGameBus();
    this.controller = new RunController(this.bus, CONTENT, initial, getSession(this)?.persistence);
    this.cameras.main.setBackgroundColor(PALETTE.grass);
    this.field = new FieldRenderer(this, seed);
    this.board = new BoardRenderer(this, CONTENT);
    this.units = new UnitRenderer(this);
    this.fx = new FxRenderer(this);

    const bus = this.bus;
    bus.on('run:state', ({ state }) => this.onState(state));
    bus.on('battle:started', () => this.onBattleStarted());
    bus.on('ui:select-card', ({ handIndex }) => this.select(handIndex));
    bus.on('ui:cancel-play', () => {
      this.setPendingBuy(null);
      this.bus.emit('ui:select-card', { handIndex: null });
    });
    bus.on('ui:drop-card', ({ handIndex, plot }) => this.drop(handIndex, plot));
    bus.on('ui:confirm-play', () => this.confirm());
    bus.on('ui:continue', () => this.onContinue());

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    this.showPlanning(this.controller.state);
    const hud: RealmHudData = { bus: this.bus, controller: this.controller };
    this.scene.launch(SCENES.planningHud, hud);
    // Only a new run replaces the saved one; resuming never rewrites it.
    if (resume === null) void this.controller.checkpointInitial();
    // A save that fails mid-run is told once, through the toast stack of whichever HUD is up.
    this.registry.events.on(WARNING_EVENT, this.onStorageWarning, this);
  }

  private readonly onStorageWarning = (_parent: unknown, text: unknown): void => {
    if (typeof text !== 'string') return;
    this.registry.remove(STORAGE_WARNING_KEY);
    this.bus.emit('log', { text });
  };

  update(_time: number, delta: number): void {
    // Taken before update: the tick that ends the battle drops the runner, and that final
    // state (deaths included) must still be drawn.
    if (!this.kicked) {
      this.kicked = true;
      this.controller.kickoff(); // starts the battle at once when no card in hand is playable
      if (this.resumedAtYearEnd) this.onContinue();
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
    this.setPendingBuy(null);
    this.board?.setEdgeArrows([]);
    this.board?.setBuildingsVisible(false);
    this.placeCamera(true);
    this.scene.stop(SCENES.planningHud);
    const hud: RealmHudData = { bus: this.bus, controller: this.controller };
    this.scene.launch(SCENES.battleHud, hud);
  }

  /** "Tiếp tục" after the battle summary (BattleHudScene). */
  private onContinue(): void {
    const state = this.controller.state;
    if (state.phase === 'reward' || state.phase === 'conquest') {
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
    if (handIndex !== null) this.setPendingBuy(null);
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
      board.setHighlights(this.pendingBuy === null ? new Map() : new Map([[this.pendingBuy, 'selected']]));
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

  /** A card dropped on `plot`: aim at it and, when that was all the card needs, play it. */
  private drop(handIndex: number, plot: number): void {
    this.select(handIndex);
    const cardId = this.controller.state.hand[handIndex];
    if (!this.pending || cardId === undefined) return;
    const count = targetCount(CONTENT.card(cardId));
    if (count > 0) this.pick(plot);
    if (count <= 1 && this.ready()) this.confirm();
  }

  /** Offer to buy the locked `plot` (null clears): the HUD shows the price with ✓/✕. */
  private setPendingBuy(plot: number | null): void {
    if (plot === this.pendingBuy) return;
    this.pendingBuy = plot;
    this.refreshHighlights();
    this.bus.emit('ui:pending-buy', {
      plot,
      price: lockedPlotPrice(this.controller.state),
    });
  }

  private confirm(): void {
    if (this.pendingBuy !== null) {
      const plot = this.pendingBuy;
      if (this.controller.state.gold < lockedPlotPrice(this.controller.state)) {
        // Keep the offer open: the HUD says why instead of the game rejecting a command.
        this.bus.emit('run:illegal', { reason: 'notEnoughGold' });
        return;
      }
      this.setPendingBuy(null);
      this.bus.emit('ui:command', { command: { type: 'unlockPlot', plot } });
      return;
    }
    const p = this.pending;
    if (!p || !this.ready()) return;
    const [first, second] = p.targets;
    const target: PlayTarget =
      first === undefined
        ? { kind: 'none' }
        : second === undefined
          ? { kind: 'plot', plot: first }
          : { kind: 'two', first, second };
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
    if (this.inBattle || !this.board) return;
    const dx = pointer.x - down.x;
    const dy = pointer.y - down.y;
    if (dx * dx + dy * dy > DRAG_SLOP * DRAG_SLOP) return;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const plot = this.board.plotAt(world.x, world.y);
    const state = this.controller.state;
    const aimedId = this.pending ? state.hand[this.pending.handIndex] : undefined;
    const aiming = aimedId === undefined ? null : CONTENT.card(aimedId);
    if (plot !== null && state.plots[plot]?.unlocked === false) {
      if (aiming !== null) {
        // A tap has no hover or long-press: say why the aimed card cannot go on this plot.
        const reason = plotIllegalReason(state.plots, aiming, this.pending?.targets ?? [], plot);
        if (reason !== null) {
          this.bus.emit('run:illegal', { reason });
          return;
        }
      }
      const tap = lockedPlotTap(state, plot, aiming);
      if (tap.kind === 'buy') {
        this.bus.emit('ui:inspect', { plot: null, x: pointer.x, y: pointer.y });
        this.setPendingBuy(plot);
        return;
      }
      if (tap.kind === 'target') {
        this.pick(plot);
        return;
      }
      if (aiming === null) this.bus.emit('run:illegal', { reason: 'notAdjacent' });
    }
    this.setPendingBuy(null);
    if (this.pending) {
      if (plot !== null) this.pick(plot);
      return;
    }
    // Not aiming a card: a tap on a building asks the HUD for its info box, any other tap closes it.
    const built = plot !== null && this.controller.state.plots[plot]?.building ? plot : null;
    this.bus.emit('ui:inspect', { plot: built, x: pointer.x, y: pointer.y });
  }

  // ---- camera ----------------------------------------------------------------------------

  /**
   * One camera for both phases (§10.4, §10.7). `ease` slides from the planning to the battle
   * camera when their zooms differ (mobile); a resize or any other call sets it at once.
   */
  private placeCamera(ease = false): void {
    const screen: Size = { w: this.scale.width, h: this.scale.height };
    const cam = this.cameras.main;
    this.cameraEase?.stop();
    this.cameraEase = null;
    const phase = this.inBattle ? 'battle' : 'planning';
    const target = realmCamera(screen, phase);
    if (!ease || realmCamera(screen, 'planning').zoom === target.zoom) {
      cam.setZoom(target.zoom).setScroll(target.scroll.x, target.scroll.y);
      return;
    }
    this.cameraEase = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: CAMERA_EASE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const now = realmCameraMix(screen, 'planning', 'battle', tween.getValue() ?? 1);
        cam.setZoom(now.zoom).setScroll(now.scroll.x, now.scroll.y);
      },
      onComplete: () => {
        cam.setZoom(target.zoom).setScroll(target.scroll.x, target.scroll.y);
        this.cameraEase = null;
      },
    });
  }

  private teardown(): void {
    this.cameraEase?.stop();
    this.cameraEase = null;
    this.registry.events.off(WARNING_EVENT, this.onStorageWarning, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
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
