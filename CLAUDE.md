# CLAUDE.md

Guidance for AI coding assistants working in this repo.

## Project

Chín Vương Miện (_Nine Crowns_, working title; repo/package `ashen-hollow`) — a kingdom-building roguelite auto-battler: each year draw 3 cards, play 1 onto a 5×5 kingdom board, then watch your army fight a neighbouring king automatically. Phaser 4 + TypeScript (strict) + Vite + Vitest, generated pixel art, Stardew-style UI, web-first. The binding design is `docs/superpowers/specs/2026-10-16-nine-crowns-design.md` (Vietnamese), split into sub-projects G0–G5, each with its own plan in `docs/superpowers/plans/`. Summary docs: `docs/GDD.md`, `docs/ART_STYLE.md`, `docs/ROADMAP.md` (check it before starting a feature).

## Commands

```bash
npm run dev        # Vite dev server :5173
npm test           # Vitest (src/**/*.test.ts)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

Run `npm run lint && npm run typecheck && npm test && npm run build` before calling work done. In Git Bash on Windows, run npm/npx with `< /dev/null` or they can hang.

## Architecture rules

- **Layers** (spec §12.1): `src/core` (pure infra: `EventBus`/`GameEvents`, `Rng`/`hashSeed`, `SimClock`, `SpatialHash`, `geom`, `noise`), `src/data` (values and types only), `src/game` (rules: run, cards, battle, save), `src/render` (generated art + Phaser renderers), `src/ui` (theme, shared widgets, HUD parts), `src/scenes`, `src/platform`, `src/audio`.
- **`src/game`, `src/data`, `src/core` must not import Phaser or `scenes/render/ui/platform/audio`; `src/data` must not import `src/game`** (ESLint `no-restricted-imports`, spec §12.4). Test files there obey the same rules.
- **Determinism** (spec §8.12): `src/game`, `src/data`, `src/core` never use `Math.random`, `Date.now`, `performance.now`, `Math.hypot/sin/cos/tan/atan2/exp/log/pow` (ESLint `no-restricted-properties`); only `+ − × ÷` and `Math.sqrt/floor/ceil/round/min/max/abs`. Randomness goes through `Rng` (`src/core/random.ts`) seeded per stream with `hashSeed`; the battle uses no `Rng` at all (ties broken by id/plot). Never let `Map`/`Set` iteration order decide a simulation result — sort by id first. Battles advance in `SimClock` fixed ticks (10/s).
- **Data-driven:** every gameplay number lives in `src/data/*`.
- **Logic ↔ UI:** render/UI/scenes only read state and send intents through the typed `EventBus` (`src/core/events.ts`). Scenes launched with `scene.launch` start next frame — pass initial state in launch data, don't rely on events emitted in `create`.
- **Phaser scene instances are reused** across restarts: reset per-game fields at the top of `create()`.
- **Pixel art:** world colours only from `PALETTE` (Hearth 32, `src/data/palette.ts`); UI colours (frames, cards, overlays, menu backdrop) only from `UI_PALETTE` (`src/data/uiPalette.ts`) — see `docs/ART_STYLE.md`. Integer camera zoom only; sprites anchored at their feet and depth-sorted by that y; never rotate sprites (horizontal flip is fine). Sprites are referenced only by frame name (spec §11.4).
- **UI:** frames are nine-slices from the generated `ui` texture referenced by name (`UI_FRAMES` in `src/render/uiArt.ts`); size them in logical px with `createPanel` (`src/ui/theme.ts`), never with raw `Rectangle` backgrounds. Buttons come from `createButton`, tooltips from `Tooltip` (hover, or 400 ms long-press on touch), self-sizing boxes from `ContentBox`. Pure UI maths lives in `src/ui/hud/layout.ts` and `src/ui/menuLayout.ts` (tested). Every touch target is ≥ 44×44 logical px; recompute positions in `layout()` on resize; "desktop" = 1280×720, "mobile" = 375×812, `width ≥ 768` uses the desktop layout.
- **HUD text:** use `FONT_UI` — it must cover Vietnamese precomposed glyphs (Georgia does not). Player-facing text is Vietnamese; ids in code are English.

## Phaser 4 notes

Official Phaser 4 agent skills live in `.claude/skills/*/SKILL.md` (also shipped in `node_modules/phaser/skills/`) — v3→v4 migration, cameras, input, tilemaps, sprites (NineSlice)… Read those instead of relying on Phaser 3 knowledge, and check signatures in `node_modules/phaser/types/phaser.d.ts`. Notable: `roundPixels` defaults false (set via `pixelArt: true`), FX/masks are now filters, `Geom.Point` → `Vector2`, `TileSprite` was rewritten (no texture cropping, supports atlas frames).

## Dev server gotcha (Windows)

Vite's watcher can read a file before the write finishes and serve stale code; `vite.config.ts` sets `server.watch.awaitWriteFinish`. If the browser still shows old behaviour, restart `npm run dev`. Note the served module is transformed (`0.5` → `.5`), so don't grep it for exact literals.
