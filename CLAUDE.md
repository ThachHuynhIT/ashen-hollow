# CLAUDE.md

Guidance for AI coding assistants working in this repo.

## Project

Ashen Hollow — dark fantasy colony builder. Phaser 4 + TypeScript (strict) + Vite + bitECS + Vitest. Pointy-top **hex grid**, real-time with active pause, pixel art. Design docs are in Vietnamese: `docs/GDD.md`, `docs/ART_STYLE.md`, `docs/ROADMAP.md` (the phase plan; check it before starting a feature).

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

- **`src/sim`, `src/hex`, `src/data`, `src/core` must not import Phaser** (ESLint `no-restricted-imports` enforces it). They are pure TS so they can be unit-tested and moved into a worker.
- **Determinism:** the sim never uses `Math.random()` or wall-clock time. Use `Rng` (`src/sim/random.ts`) and advance via `SimClock` fixed ticks (10/s). `stepWorld` in `src/sim/GameWorld.ts` is where systems get registered.
- **Hex math:** axial `{q, r}` everywhere in gameplay code; odd-r offset (`src/hex/offset.ts`) only for rectangular map storage. Pixel layout is `DEFAULT_LAYOUT` (32×32 tile, step 32×24) — see `docs/ART_STYLE.md` for why.
- **Units occupy exactly one hex** (`HexPosition` component); movement is hex-to-hex.
- **Data-driven:** gameplay numbers live in `src/data/*`, not in systems.
- **World ↔ UI** communicate only through the typed `EventBus` (`src/core/events.ts`). `HudScene` never touches the sim directly. Scenes launched with `scene.launch` start next frame — pass initial state in launch data, don't rely on events emitted in `create`.
- **Phaser scene instances are reused** across restarts: reset per-game fields at the top of `create()`.
- **Pixel art:** colours only from `PALETTE` (`src/data/palette.ts`); integer camera zoom only (`ZOOM_LEVELS`).

## Phaser 4 notes

Phaser 4 ships AI docs in `node_modules/phaser/skills/*/SKILL.md` (v3→v4 migration, cameras, input, etc.) — read those instead of relying on Phaser 3 knowledge. Notable: `roundPixels` defaults false (set via `pixelArt: true`), FX/masks are now filters, `Geom.Point` → `Vector2`, the hex tilemap helpers are limited (we use our own hex layout instead).
