# CLAUDE.md

Guidance for AI coding assistants working in this repo.

## Project

Crowned Kingdoms (formerly _Chín Vương Miện_ / _Nine Crowns_; repo and package `crowned-kingdoms`) — a kingdom-building roguelite auto-battler: each year draw 3 cards, play 1 onto a 5×5 kingdom board, then watch your army fight a neighbouring king automatically. Phaser 4 + TypeScript (strict) + Vite + Vitest, generated pixel art, Stardew-style UI, web-first. The binding design is `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` (Vietnamese), split into sub-projects G0–G5, each with its own plan in `docs/superpowers/plans/`. Summary docs: `docs/GDD.md`, `docs/ART_STYLE.md`, `docs/ROADMAP.md` (check it before starting a feature).

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

- **Layers** (spec §12.1): `src/core` (pure infra: generic `EventBus`, `Rng`/`hashSeed`, `SimClock`, `SpatialHash`, `geom`, `noise`), `src/data` (values and types only; `save.ts` holds the IndexedDB names and the player-facing storage texts), `src/game` (rules: `run/` state (RunState **version 4**: offers + `pendingOffers` queue, decrees, quests, rng streams draw/reward/calendar/council/quest)·board·deck (draw/discard piles, `refillHand`)·playable·rewards·battleSetup·yearFlow·flow (`cardOffer`, `enqueueOffers`, `closeOffer`)·yearEnd·commands·council·decrees·quests·enemyArmy·calendar (`RULES_FULL` = 30 years, 'full' calendar, council + quests + 3 bosses, manual battle start; `RULES_G2` = 15 years, 'short'; `RULES_G1` is the default of `newRun`/`runHeadless`)·income·modifiers·RunController (optional 4th arg `persistence`: with it every command is applied, checkpointed, then announced in FIFO order and `whenIdle()` waits; without it everything stays synchronous; `kickoff()` rebuilds a battle loaded in phase `battle` from tick 0; remembers the chosen battle speed), `cards/` registry (`ALL_KINGS`: nine kings; the three playable ones are Wheat, Stone, Arcane)·describe·`custom/` (handlers for the `custom` effects of cards and thrones), `battle/` types·world·compose·targeting·movement·combat·behaviours·statuses·bosses·structures·intervention (manual + auto-fire boulder)·step·hash·BattleRunner·steering, `save/` (`encodeRun`/`decodeRun` envelope `{formatVersion: 1, version, contentHash, state}` — `decodeRun` never trusts the disk: it validates everything, migrates state 3 → 4, accepts a changed content hash while every id still resolves, and answers ok / empty / incompatible; `SaveCoordinator` = FIFO write queue, an ended run clears the save; `MemorySaveStore`), `sim/` headless + `bots/random` + `bots/scripted`, `testing/fixtures.ts` (+ `bossKit` for boss battles), `events.ts`), `src/platform` (the only code that touches IndexedDB: `storage/idbSaveStore` + `createSaveStore` with a one-way fallback to memory and one warning, `session.ts` `createSession`; `src/game` must not import it — scenes inject the session through the Phaser registry, see `scenes/sessionRegistry.ts`), `src/render` (generated art + Phaser renderers), `src/ui` (theme, shared widgets, HUD parts, `info/` building/unit info box + `runSummary`, `modals/` reward·conquest·calendar (6×5 for 30 years)·deck·`CouncilModal`·`QuestModal`·`councilModel`, `planning/` hand (4 slots)·calendar strip·scout·`DecreeQuestPanel`, `realm/` layout and calendar model, `battle/battleReadout` (incl. `bossReadout`), `resumeModel`, `kingSelectLayout`), `src/scenes` (Boot (opens the save session) → Preload → MainMenu (Continue) → KingSelect → Realm + PlanningHud/BattleHud → RunEnd; `RealmData = { seed, kingId } | { resume: RunState }`), `src/audio` is still not created.
- **Events:** `src/core/events.ts` is only the generic `EventBus`; `GameEvents` + `createGameBus` live in `src/game/events.ts` (ESLint forbids core → game imports, so spec §12.5's "core" location does not apply).
- **Headless:** `runHeadless({ seed, kingId: 'wheat' })` in `src/game/sim/headless.ts` plays a whole run with `randomBot` (no Phaser); `determinism.test.ts` and `benchmark.test.ts` in `src/game/battle/` run under `npm test`.
- **Preview:** `.claude/launch.json` defines the `dev` preview config (Vite :5173); `window.game` is exposed for `preview_eval`.
- **`src/game`, `src/data`, `src/core` must not import Phaser or `scenes/render/ui/platform/audio`; `src/data` must not import `src/game`** (ESLint `no-restricted-imports`, spec §12.4). Test files there obey the same rules.
- **Determinism** (spec §8.12): `src/game`, `src/data`, `src/core` never use `Math.random`, `Date.now`, `performance.now`, `Math.hypot/sin/cos/tan/atan2/exp/log/pow` (ESLint `no-restricted-properties`); only `+ − × ÷` and `Math.sqrt/floor/ceil/round/min/max/abs`. Randomness goes through `Rng` (`src/core/random.ts`) seeded per stream with `hashSeed`; the battle uses no `Rng` at all (ties broken by id/plot). Never let `Map`/`Set` iteration order decide a simulation result — sort by id first. Battles advance in `SimClock` fixed ticks (10/s).
- **Data-driven:** every gameplay number lives in `src/data/*`.
- **External assets:** follow `docs/ASSET_LICENSES.md`; register them in `docs/assets.manifest.yml` (schema: `docs/ASSET_MANIFEST.md`) and `CREDITS.md` before committing. Never download and commit an asset just because a URL was found.
- **Saving (spec §9.3):** the run is written (IndexedDB db `crowned-kingdoms` v1, stores `run`/`meta`, key `current`; G3 never touches `meta`) after every successful command outside battle and on battle entry and exit — never per tick, speed change, intervene or the auto-fire toggle. Reload mid-battle restarts the battle from tick 0 with the same setup; an ended run clears the save. Bumping `RUN_SAVE_VERSION` needs a migrator in `src/game/save/migrate.ts` and a fixture test. G3 tests: `fullRun.test.ts` (9 real runs), `src/platform/resumeIntegration.test.ts` (reload matrix; it lives in `platform/` because `src/game` cannot import it).
- **Logic ↔ UI:** render/UI/scenes only read state and send intents through the typed `EventBus` (`src/core/events.ts`). Scenes launched with `scene.launch` start next frame — pass initial state in launch data, don't rely on events emitted in `create`.
- **Phaser scene instances are reused** across restarts: reset per-game fields at the top of `create()`.
- **Pixel art:** world colours only from `PALETTE` (Hearth 32, `src/data/palette.ts`); UI colours (frames, cards, overlays, menu backdrop) only from `UI_PALETTE` (`src/data/uiPalette.ts`) — see `docs/ART_STYLE.md`. Registered exception: the CC0 Kenney Pixel UI Pack frames (panel/tooltip/button/card) overlay the generated ones via `src/render/uiKit.ts`; read frame size/slice/border through `uiFrameDef`, not `UI_FRAMES` directly. Integer camera zoom only; sprites anchored at their feet and depth-sorted by that y; never rotate sprites (horizontal flip is fine). Sprites are referenced only by frame name (spec §11.4).
- **UI:** frames are nine-slices from the generated `ui` texture referenced by name (`UI_FRAMES` in `src/render/uiArt.ts`); size them in logical px with `createPanel` (`src/ui/theme.ts`), never with raw `Rectangle` backgrounds. Buttons come from `createButton`, tooltips from `Tooltip` (hover, or 400 ms long-press on touch), self-sizing boxes from `ContentBox`. Pure UI maths lives in `src/ui/hud/layout.ts` and `src/ui/menuLayout.ts` (tested). Every touch target is ≥ 44×44 logical px; recompute positions in `layout()` on resize; "desktop" = 1280×720, "mobile" = 375×812, `width ≥ 768` uses the desktop layout.
- **HUD text:** use `FONT_UI` — it must cover Vietnamese precomposed glyphs (Georgia does not). Player-facing text is Vietnamese; ids in code are English.

## Git workflow

`main` is release-only: it only receives a **release PR from `develop`**. Flow: feature branch → PR into `develop` → (when releasing) PR `develop` → `main`. Never open a feature PR against `main`, and never push directly to `main` or `develop`. Branch feature work from `develop`; after a release merge `develop` already contains `main`, so keep `develop` ahead of or equal to `main`.

## Phaser 4 notes

Official Phaser 4 agent skills live in `.claude/skills/*/SKILL.md` (also shipped in `node_modules/phaser/skills/`) — v3→v4 migration, cameras, input, tilemaps, sprites (NineSlice)… Read those instead of relying on Phaser 3 knowledge, and check signatures in `node_modules/phaser/types/phaser.d.ts`. Notable: `roundPixels` defaults false (set via `pixelArt: true`), FX/masks are now filters, `Geom.Point` → `Vector2`, `TileSprite` was rewritten (no texture cropping, supports atlas frames).

### Which Phaser skill to read

Always read `v3-to-v4-migration` before writing Phaser code from memory. Then by task:

| Priority | Skills | Use for |
|---|---|---|
| High | `scenes`, `sprites-and-images`, `game-setup-and-config`, `scale-and-responsive`, `input-keyboard-mouse-touch`, `text-and-bitmaptext`, `events-system` | Scenes, nine-slice UI, pixel-art config, desktop/mobile layout, cards and touch, HUD text, `EventBus` |
| Medium | `cameras`, `tweens`, `animations`, `loading-assets`, `graphics-and-shapes`, `render-textures`, `groups-and-containers`, `game-object-components`, `time-and-timers`, `v4-new-features`, `geometry-and-math` | Effects, unit animation, generated art/atlases, depth-sort/flip. Render/UI layers only |
| Low | `filters-and-postfx`, `particles`, `audio-and-sound`, `data-manager`, `actions-and-utilities` | Polish, audio (`src/audio` not created yet). Game state lives in `src/game`, not on game objects |
| Do not use for gameplay | `physics-arcade`, `physics-matter`, `tilemaps`, `curves-and-paths` | Battles are a custom deterministic sim (`SimClock`); the 5×5 board is not a tilemap. Phaser physics would break determinism |

## Workflow (superpowers)

New feature or behaviour change: `brainstorming` → `writing-plans` (spec in `docs/superpowers/specs/`, plan in `docs/superpowers/plans/`) → `test-driven-development` for `src/game`/`src/core`/`src/data` → `verification-before-completion` (the lint/typecheck/test/build command above) → `requesting-code-review` / `finishing-a-development-branch`. Bugs: `systematic-debugging` first.

## Dev server gotcha (Windows)

Vite's watcher can read a file before the write finishes and serve stale code; `vite.config.ts` sets `server.watch.awaitWriteFinish`. If the browser still shows old behaviour, restart `npm run dev`. Note the served module is transformed (`0.5` → `.5`), so don't grep it for exact literals.
