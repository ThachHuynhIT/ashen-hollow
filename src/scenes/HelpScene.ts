import Phaser from 'phaser';
import type { EventBus } from '../core/events';
import type { GameSpeed } from '../core/SimClock';
import type { HelpTab } from '../data/help';
import { CONTENT } from '../game/cards/registry';
import type { GameEvents } from '../game/events';
import { Tooltip } from '../ui/Tooltip';
import { getHelpGate } from '../ui/help/helpGate';
import { HelpModal } from '../ui/help/HelpModal';
import { closeHelpSession, helpPauseSpeed, helpResumeSpeed, openHelpSession, type HelpSession } from '../ui/help/helpSession';
import { resolveShortcut, shortcutFlags } from '../ui/input/shortcuts';
import { SCENES } from './keys';

/** Launch data of the Help overlay: who opened it, its bus (null in the menus), and the battle speed to give back. */
export interface HelpLaunch {
  owner: string;
  bus: EventBus<GameEvents> | null;
  speed: GameSpeed | null;
  tab?: HelpTab;
}

const HELP_DEPTH = 1000;

/**
 * The Help overlay: a modal view on top of whichever scenes are running. While it is open the scenes below take no
 * keys or pointer input, a running battle is paused through the normal speed intent and gets its speed back on close
 * (an already paused one stays paused), and nothing is saved. Opened/closed only through `openHelp`/`closeHelp`.
 */
export class HelpScene extends Phaser.Scene {
  private modal: HelpModal | null = null;
  private tooltip: Tooltip | null = null;
  private data0: HelpLaunch | null = null;
  private session: HelpSession = { open: false, restoreSpeed: null };
  private locked: { scene: Phaser.Scene; input: boolean; keyboard: boolean }[] = [];
  private closed = false;

  constructor() {
    super(SCENES.help);
  }

  create(data: HelpLaunch): void {
    // Scene instances are reused: reset every field first.
    this.closed = false;
    this.locked = [];
    this.data0 = data;
    this.session = openHelpSession(data.speed);
    this.lockOthers();
    const pause = helpPauseSpeed(this.session.restoreSpeed);
    if (pause !== null) data.bus?.emit('ui:set-speed', { speed: pause });
    this.scene.bringToTop();
    this.tooltip = new Tooltip(this);
    this.modal = new HelpModal(this, CONTENT, this.tooltip, () => this.closeHelp(), data.tab).setDepth(HELP_DEPTH);
    this.input.keyboard?.on(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
  }

  private readonly onResize = (): void => this.modal?.layout();

  private onKey(event: KeyboardEvent): void {
    const action = resolveShortcut(event.key, 'help', shortcutFlags(event, { helpOpen: true }));
    if (action === 'help.toggle') event.preventDefault();
    if (action === 'help.toggle' || action === 'cancel') this.closeHelp();
  }

  /** Close the overlay, give the battle its speed back (only if its owner is still running) and unlock the scenes below. */
  closeHelp(): void {
    if (this.closed) return;
    this.closed = true;
    const data = this.data0;
    const resume = helpResumeSpeed(closeHelpSession(this.session).speed);
    if (data && resume !== null && this.scene.manager.isActive(data.owner)) data.bus?.emit('ui:set-speed', { speed: resume });
    this.scene.stop();
  }

  private lockOthers(): void {
    for (const scene of this.scene.manager.getScenes(true)) {
      if (scene === this) continue;
      this.locked.push({ scene, input: scene.input.enabled, keyboard: scene.input.keyboard?.enabled ?? false });
      scene.input.enabled = false;
      if (scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
  }

  private unlockOthers(): void {
    for (const l of this.locked) {
      if (!l.scene.sys.isActive()) continue;
      l.scene.input.enabled = l.input;
      if (l.scene.input.keyboard) l.scene.input.keyboard.enabled = l.keyboard;
    }
    this.locked = [];
  }

  private teardown(): void {
    this.input.keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.onKey, this);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.modal?.destroy();
    this.modal = null;
    this.tooltip?.destroy();
    this.tooltip = null;
    // The key that closed Help may still be on its way to the scenes below: give them input back one tick later.
    const locked = this.locked;
    setTimeout(() => {
      this.locked = locked;
      this.unlockOthers();
      getHelpGate(this.game).close();
    }, 0);
    this.locked = [];
  }
}
