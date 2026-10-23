import Phaser from 'phaser';
import { ContentBox } from '../ContentBox';
import type { Point, Rect, Size } from '../hud/layout';
import { createButton, type Button } from '../theme';
import { buildingModelLines, infoContent, unitModelLines } from './infoLines';
import type { BuildingInfoModel, UnitInfoModel } from './inspectionModel';
import { inspectionLayout, scrollLinesForDrag, scrollLinesForWheel } from './inspectionLayout';

const MAX_W = 320;

/**
 * Bảng thông tin đang chọn: một panel hiện tại, hoặc nhà hoặc lính (spec §10.7). Nhà có nút "Xem lính" mở
 * model lính sinh ra, lính mở từ nhà có "Về công trình". Chặn input (không xuyên xuống bản đồ), cuộn bằng
 * lăn chuột hoặc kéo, không đè `reserved`. Vòng đời: HUD scene gọi layout() khi đổi cỡ và destroy() khi SHUTDOWN.
 */
export class InspectionView {
  private readonly box: ContentBox;
  private readonly close: Button;
  private readonly switchButton: Button;
  private building: BuildingInfoModel | null = null;
  private unit: UnitInfoModel | null = null;
  private fromBuilding = false;
  private anchor: Point = { x: 0, y: 0 };
  private screen: Size = { w: 0, h: 0 };
  private reserved: readonly Rect[] = [];
  private panel: Rect | null = null;
  private dragFrom: number | null = null;
  private applied = 0;
  private dragged = false;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    private readonly onClose: () => void = () => undefined,
  ) {
    this.box = new ContentBox(scene, 'panel', MAX_W, { blocking: true });
    this.box.container.setDepth(depth);
    this.close = createButton(scene, 0, 0, '×', {
      width: 48,
      height: 48,
      fontSize: 22,
      onClick: () => {
        this.hide();
        this.onClose();
      },
    });
    this.close.container.setDepth(depth + 1).setVisible(false);
    this.switchButton = createButton(scene, 0, 0, 'Xem lính', {
      width: 140,
      height: 44,
      onClick: () => this.toggleUnit(),
    });
    this.switchButton.container.setDepth(depth + 1).setVisible(false);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
  }

  get visible(): boolean {
    return this.box.visible;
  }

  /** True when the last press that began on the panel turned into a drag (so a click must be ignored). */
  get wasDrag(): boolean {
    return this.dragged;
  }

  showBuilding(model: BuildingInfoModel, anchor: Point, screen: Size, reserved: readonly Rect[]): void {
    this.building = model;
    this.unit = null;
    this.fromBuilding = false;
    this.open(anchor, screen, reserved);
  }

  showUnit(model: UnitInfoModel, anchor: Point, screen: Size, reserved: readonly Rect[]): void {
    this.unit = model;
    this.fromBuilding = false;
    this.building = null;
    this.open(anchor, screen, reserved);
  }

  /** Replace the model of the open panel in place (HP ticking); no-op while hidden. */
  setBuilding(model: BuildingInfoModel): void {
    if (this.building === null) return;
    this.building = model;
    this.render();
  }

  setUnit(model: UnitInfoModel): void {
    if (this.unit === null) return;
    this.unit = model;
    this.render();
  }

  hide(): void {
    this.building = null;
    this.unit = null;
    this.fromBuilding = false;
    this.panel = null;
    this.dragFrom = null;
    this.box.setContent(null);
    this.close.container.setVisible(false);
    this.switchButton.setVisible(false);
  }

  layout(screen: Size, reserved: readonly Rect[]): void {
    this.screen = screen;
    this.reserved = reserved;
    this.box.refresh();
    if (this.visible) this.place();
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.box.destroy();
    this.close.container.destroy();
    this.switchButton.container.destroy();
  }

  // ---- bên trong ----------------------------------------------------------------------------

  private open(anchor: Point, screen: Size, reserved: readonly Rect[]): void {
    this.anchor = anchor;
    this.screen = screen;
    this.reserved = reserved;
    this.render();
  }

  private toggleUnit(): void {
    if (this.fromBuilding && this.unit !== null) {
      const back = this.building;
      this.unit = null;
      this.fromBuilding = false;
      this.building = back;
    } else if (this.building?.spawn) {
      this.unit = this.building.spawn;
      this.fromBuilding = true;
    }
    this.render();
  }

  private lines(): readonly string[] {
    if (this.unit !== null) return unitModelLines(this.unit);
    return this.building ? buildingModelLines(this.building) : [];
  }

  private render(): void {
    const lines = this.lines();
    if (lines.length === 0) return;
    this.box.setMaxHeight(null);
    this.box.setMaxWidth(MAX_W);
    this.box.setContent(infoContent(lines));
    this.place();
  }

  private place(): void {
    const showSwitch = this.unit !== null ? this.fromBuilding : this.building?.spawn != null;
    const r = inspectionLayout(
      this.screen,
      this.anchor,
      { w: this.box.width, h: this.box.height },
      this.reserved,
      showSwitch,
    );
    this.panel = r.panel;
    this.box.setMaxWidth(r.panel.w);
    this.box.setMaxHeight(r.panel.h - (r.unitButton ? r.unitButton.h + 6 : 0));
    this.box.setPosition(r.panel.x, r.panel.y);
    this.close.container.setPosition(r.close.x + r.close.w / 2, r.close.y + r.close.h / 2).setVisible(true);
    this.switchButton.setVisible(showSwitch);
    if (r.unitButton) {
      this.switchButton.setLabel(this.unit !== null ? 'Về công trình' : 'Xem lính');
      this.switchButton.container.setPosition(
        r.unitButton.x + r.unitButton.w / 2,
        r.unitButton.y + r.unitButton.h / 2,
      );
    }
  }

  private inside(p: Point): boolean {
    const r = this.panel;
    return r !== null && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (this.visible && this.inside(pointer)) this.box.scrollBy(scrollLinesForWheel(dy));
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    this.dragged = false;
    this.applied = 0;
    this.dragFrom = this.visible && this.inside(pointer) ? pointer.y : null;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragFrom === null || !pointer.isDown) return;
    const step = scrollLinesForDrag(0, pointer.y - this.dragFrom);
    if (!step.dragging) return;
    this.dragged = true;
    // `lines` is the total since the press; apply only what is new.
    if (step.lines !== this.applied) {
      this.box.scrollBy(step.lines - this.applied);
      this.applied = step.lines;
    }
  }

  private onUp(): void {
    this.dragFrom = null;
  }
}
