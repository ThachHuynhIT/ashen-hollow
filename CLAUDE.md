# CLAUDE.md

Guidance for AI coding assistants working in this repo.

## Project

Ashen Hollow — dark fantasy colony builder. Phaser 4 + TypeScript (strict) + Vite + bitECS + Vitest. **Gridless world** (everything at continuous pixel coordinates; buildings placed freely; units move RTS-style), real-time with active pause, pixel art. Design docs are in Vietnamese: `docs/GDD.md`, `docs/ART_STYLE.md`, `docs/ROADMAP.md` (the phase plan; check it before starting a feature).

## Commands

```bash
npm run dev        # Vite dev server :5173
npm test           # Vitest (src/**/*.test.ts)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

Run `npm test && npm run lint && npm run typecheck` before calling work done.

## Architecture rules

- **`src/sim`, `src/data`, `src/core` must not import Phaser** (ESLint `no-restricted-imports` enforces it). They are pure TS so they can be unit-tested and moved into a worker. Test fixtures live in `src/sim/testing/` (e.g. `terrainFromAscii`).
- **Determinism:** the sim never uses `Math.random()` or wall-clock time. Use `Rng` (`src/sim/random.ts`) and advance via `SimClock` fixed ticks (10/s). `stepWorld` in `src/sim/GameWorld.ts` is where systems get registered.
- **Free world, hidden grids.** Positions are float world pixels (`Position`). Grids are acceleration structures only and are never shown to the player:
  - `TerrainGrid` (16 px) — ground type; rendered seamlessly by dual-grid (`src/render/dualGrid.ts`).
  - `NavGrid` (8 px) — walkability/cost for pathfinding; obstacles are reference-counted (`block`/`unblock`).
  - `SpatialHash` (64 px) — neighbour and overlap queries.
- **Shapes:** footprints/colliders are `Shape` (axis-aligned rect or circle, `src/sim/geom.ts`). Touching edges is not overlap (buildings may sit flush).
- **Placement** goes through `checkPlacement` / `placeBuilding` (`src/sim/GameWorld.ts`): free by default, magnet-snaps to neighbouring buildings, optional 8 px snap (Shift / "Bám lưới").
- **Pathfinding:** `findPath` (8-dir A*, no corner cutting) → `smoothPath` (string pulling via `lineWalkable`).
- **Data-driven:** gameplay numbers live in `src/data/*` (terrain, doodads, buildings), not in systems.
- **World ↔ UI:** the HUD may _read_ world state but never mutates it; player intents go through the typed `EventBus` (`src/core/events.ts`). Scenes launched with `scene.launch` start next frame — pass initial state in launch data, don't rely on events emitted in `create`.
- **Phaser scene instances are reused** across restarts: reset per-game fields at the top of `create()`.
- **Pixel art:** colours only from `PALETTE` (`src/data/palette.ts`); integer camera zoom only (`ZOOM_LEVELS`); sprites anchored at their feet and depth-sorted by that y; never rotate sprites.
- **HUD text:** use `FONT_UI` — it must cover Vietnamese precomposed glyphs (Georgia does not).

## Phaser 4 notes

Phaser 4 ships AI docs in `node_modules/phaser/skills/*/SKILL.md` (v3→v4 migration, cameras, input, tilemaps…) — read those instead of relying on Phaser 3 knowledge. Notable: `roundPixels` defaults false (set via `pixelArt: true`), FX/masks are now filters, `Geom.Point` → `Vector2`, `TilemapGPULayer` is orthographic-only and needs `generateLayerDataTexture()` after edits (we use plain `TilemapLayer`).

## Dev server gotcha (Windows)

Vite's watcher can read a file before the write finishes and serve stale code; `vite.config.ts` sets `server.watch.awaitWriteFinish`. If the browser still shows old behaviour, restart `npm run dev`. Note the served module is transformed (`0.5` → `.5`), so don't grep it for exact literals.
