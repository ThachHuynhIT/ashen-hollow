# G1 — Lõi chơi được (ván ngắn 10 năm) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chơi được trọn một ván 10 năm của Vua Lúa Mì: mỗi năm rút 3 thẻ, chơi 1 thẻ lên bàn cờ 5×5, xem trước đạo quân Thổ Phỉ, rồi xem quân mình tự đánh (có can thiệp Đá Tảng Hoàng Gia) — trên cả desktop 1280×720 và mobile 375×812, kèm headless + bot `random`.

**Architecture:** Dựng từ dưới lên, mỗi lớp thuần TS có Vitest trước khi Phaser đụng tới: `src/data` (kiểu + hằng số + nội dung G1) → `src/game/battle` (đạo quân, `BattleWorld` struct-of-arrays, bước trận deterministic §8.9) → `src/game/run` (`RunState`, luật bàn cờ, `applyCommand`, thưởng, `buildBattleSetup`) → `RunController`/`BattleRunner` nối `EventBus` → headless + bot → art placeholder sinh bằng code + atlas + renderer → scene (`RealmScene`, `PlanningHudScene`, `BattleHudScene`, `RunEndScene`). Trận chỉ đọc một `BattleSetup` đã giải sẵn chỉ số (không biết thẻ là gì), nên test trận không phụ thuộc nội dung.

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`) · Phaser 4.2.1 · Vite 8 · Vitest 5 · ESLint 10 (flat config, luật deterministic của G0).

**Spec:** `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` — plan này chỉ làm **G1** (§14 "G1" + "Done khi"), dựa trên §3.1–3.2, §3.5–3.6, §3.8, §3.10, §4.1, §4.4, §5.1–5.2, §5.5, §6.1–6.3, §7.4, §8, §10.1, §10.4, §10.6–10.8, §11.2–11.4, §12, §13. Code đã có từ G0 (`PALETTE`, `UI_PALETTE`, `createPanel`/`createButton`/`Tooltip`/`ContentBox`, `layout.ts`, `steering.ts`, `Rng`, `SimClock`, `SpatialHash`, `noise.ts`, `dualGrid.ts`, `pixel.ts`, `bitmap.ts`, `atlas.ts`) được dùng lại, không viết lại.

**Repo:** làm trong worktree hiện tại (`claude/claude-md-project-skills-b77005`, đã chứa G0). Trong Git Bash trên Windows chạy mọi lệnh npm/npx kèm `< /dev/null`. Nếu trình duyệt hiện code cũ thì khởi động lại `npm run dev`.

## Global Constraints

- Chỉ làm G1 (§14): Vua Lúa Mì với `wheat_militia`, `wheat_reapers`, `wheat_scarecrow`; trung lập `neutral_barracks`, `neutral_archer_tower`, `neutral_clear_land`, `neutral_move`; Thổ Phỉ §6.2; **không** vàng, cấp > 1, Bùa, lân cận, đổi bài, bộ bài/lịch/sắc lệnh UI, boss, nhiệm vụ, hội đồng, lưu ván, perk, cờ hiệu.
- `RULES_G1 = { years: 10, calendar: 'raiders' }`: cả 10 năm là Thổ Phỉ (`SLOT_MULT.raiders = 0.8`), thắng khi qua năm 10 còn mạng. Chơi thẻ công trình lên ô đã có công trình là `occupied`.
- Bộ bài khởi đầu cố định (11 bản): Dân Quân ×2, Bù Nhìn Gác ×2, Đội Thợ Gặt ×1, Trại Lính ×2, Tháp Cung ×2, Khai Hoang ×1, Dời Nhà ×1. Rút `RUN.handSize = 3` bản không hoàn lại mỗi năm; thẻ không chơi không mất khỏi bộ bài. `RUN.startLives = 3`.
- Bàn cờ 5×5, `plot = row × 5 + col`, Ngai ở `plot 12` = (2,2); khởi đầu mở 3×3 giữa (`col,row ∈ 1..3`); lân cận duyệt Bắc, Đông, Nam, Tây.
- Ngân sách địch `round(ENEMY_BUDGET[y−1] × SLOT_MULT.raiders)`; `ENEMY_CAP = 120`; `WAVES.share = [0.4, 0.35, 0.25]`, `WAVES.spawnTick = [0, 120, 240]`; năm < 10 một mép/đợt, năm ≥ 10 hai mép/đợt. Ví dụ: năm 1 → 10 EP.
- Thưởng sau trận thắng (trừ năm 10): 3 thẻ khác `CardId`, 65% từ thẻ vua / 35% trung lập, trọng số độ hiếm theo năm (1–9: 60/30/10 · 10–19: 45/35/20 · 20–30: 30/40/30), hạ độ hiếm rồi đổi nguồn nếu hết thẻ; chọn → thêm 1 bản vào bộ bài.
- Trận: `BATTLE` và `SPAWN_OFFSETS` đúng §8.2; `INTERVENTION` đúng §7.4 (`dmgBase 40 + dmgPerYear 10 × (year−1)`, loại phép bỏ qua giáp, `radius 24`, `delayTicks 6`, `knockback 12`, `cooldownTicks 150`, `firstReadyTick 30`); thua khi Ngai ≤ 0 HP (ưu tiên hơn thắng nếu cùng tick); Cuồng Nộ từ tick 600, hết giờ tick 900 → thắng nếu Ngai còn HP; 10 tick/giây.
- Deterministic (§8.12): trong `src/game`, `src/data`, `src/core` chỉ dùng `+ − × ÷` và `Math.sqrt/floor/ceil/round/min/max/abs` (+ `imul`); cấm `**`, `Math.random`, `Date`, `performance`; trận không dùng `Rng`; `Rng` chỉ ở tầng ván với luồng `'draw'`, `'reward'` (trạng thái lưu trong `RunState.rng`) và luồng `'army'` đổi seed mỗi năm `hashSeed(\`${seed}:army:${year}\`)`; không để thứ tự lặp `Map`/`Set` quyết định kết quả (sắp theo id/plot trước).
- Lớp: `src/game`/`src/data`/`src/core` không import `phaser`, `scenes`, `render`, `ui`, `platform`, `audio`; `src/data` không import `src/game`; `src/core` không import `src/game`.
- Mọi hằng số gameplay nằm ở `src/data/*`. Sprite chỉ gọi theo tên frame qua các hàm `*Frame(...)` trong `atlas.ts`; không xoay sprite (lật ngang được); neo ở chân, y-sort. Pixel thế giới chỉ từ `PALETTE`; pixel UI (khung, icon, lớp phủ) chỉ từ `UI_PALETTE`.
- UI: dùng `createPanel`/`createButton`/`Tooltip`/`ContentBox`, vùng chạm ≥ 44×44 logic, `width ≥ 768` dùng bố cục desktop, tính lại vị trí trong `layout()` khi resize, chữ `FONT_UI` tiếng Việt; scene `launch` truyền trạng thái đầu qua launch data; đặt lại trường per-game ở đầu `create()`.
- Cuối **mọi** task: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit 0. Commit bằng `git add` từng đường dẫn cụ thể (không `git add -A`/`.`); message kết thúc bằng một dòng trống rồi `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Không sửa `docs/superpowers/specs/*` và các plan cũ.

## Quyết định của plan này (spec im lặng hoặc mâu thuẫn với lint)

1. **`GameEvents` nằm ở `src/game/events.ts`**, không phải `src/core/events.ts` như §12.5: ESLint (G0) cấm `core` import `game`, mà `GameEvents` cần `RunState`/`BattleSetup`. `core/events.ts` chỉ còn `EventBus` generic.
2. `RunPhase` của G1 = `'planning' | 'battle' | 'reward' | 'yearEnd' | 'ended'`; `'yearEnd'` = vừa thua một trận còn mạng, chờ lệnh `advance` để sang năm mới. Thắng → `reward` (trừ năm 10 → `ended` thắng).
3. `IllegalReason` G1 = `locked | throne | occupied | noBuilding | noTarget | notAdjacent | wrongPhase | alreadyPlayed | notPlayed | badTarget` (5 cái cuối là bổ sung của plan: `badTarget` = chỉ số tay bài/ô ngoài phạm vi, sai kiểu `PlayTarget`, hoặc ô không phải loại mục tiêu của thẻ).
4. "Bỏ lượt" và "Bỏ qua thưởng" **không** cộng vàng trong G1 (chưa có vàng); `RunState` không có `gold`.
5. `KingDef` G1 không có `banner`, `perks`, `unlockCost`; `cards` có đúng 3 thẻ (đủ 9 từ G2). `BattleResult` không có `goldDelta`. Các union `EffectDef`/`TomeAction`/`OnHitDef`/`TomeTarget` chỉ gồm biến thể G1 (`spawn`,`tower` / `unlockPlot`,`move` / `slow` / `lockedPlot`,`buildingThenPlot`); G2+ mở rộng.
6. `composeArmy` chọn đơn vị **trong số những loại còn đủ ngân sách** (giữ trọng số) thay vì bốc-rồi-bỏ, để vòng lặp kết thúc chắc chắn; phân phối gần như không đổi.
7. Cooldown đánh: mỗi tick `cooldown = max(cooldown − 1, 0)`; khi `= 0` và có mục tiêu trong tầm thì đánh và `cooldown += interval` (đơn vị rảnh không "để dành" đòn).
8. `SPAWN_OFFSETS` "trong bán kính 14" thực ra có `(10,10)` cách tâm 14.14: test kiểm Chebyshev ≤ 14.
9. Icon (`icon_*`) vẽ bằng `UI_PALETTE` (chúng là UI); tranh thẻ, công trình, lính, hiệu ứng thế giới dùng `PALETTE`.
10. Vòng ngắm Can Thiệp và mũi tên mép xuất hiện là lớp phủ UI nên do HUD scene vẽ (không đưa vào `FxRenderer`).

## Review Focus

1. **Lệnh sai pha / chơi hai lần / chỉ số ngoài phạm vi** (`play` khi đang `battle`, `startBattle` trước khi chơi, `pickOffer(3)`, `play` handIndex 5, `advance` khi đang `planning`): trả `{ error }`, state đầu vào không đổi → test Task 10.
2. **Bộ bài ít hơn 3 bản / rút không lặp quá số bản có**: `drawHand` rút hết, không lặp quá số bản → test Task 4.
3. **Ngân sách khổng lồ chạm `ENEMY_CAP`** (cấp tăng, `surplus` nhân HP/DMG bằng `√surplus`) và **năm ≥ 10 hai mép** → test Task 3.
4. **Lính phe mình vượt `playerUnitCap` 160 hoặc `entityCap` 512**: không sinh thêm, ghi `capped`, không ghi ngoài mảng → test Task 5.
5. **Can thiệp không hợp lệ** (trước tick 30, trong hồi chiêu, toạ độ NaN/ngoài cánh đồng) bị bỏ qua và không ghi vào `inputs`; **Ngai chết cùng tick với địch cuối** = thua; **hết giờ tick 900** = thắng → test Task 7–8.

---

## File Structure

**Tạo — `src/data/`:** `types.ts` (kiểu §5.1 bản G1) · `run.ts` (`RUN`, `RULES_G1`, `START_DECK_G1`, `REWARD`, `rewardRarityWeights`) · `battle.ts` (`BATTLE`, `SPAWN_OFFSETS`, `INTERVENTION`, `ENEMY_*`, `SLOT_MULT`, `WAVES`) · `scaling.ts` (`STRUCT_HP`, `MAX_UNITS_PER_BUILDING`) · `neutral.ts` · `raiders.ts` · `kings/wheat.ts` · `kings/index.ts`.

**Tạo — `src/game/`:** `events.ts` · `cards/registry.ts`, `cards/describe.ts` · `battle/types.ts`, `world.ts`, `compose.ts`, `targeting.ts`, `movement.ts`, `combat.ts`, `intervention.ts`, `step.ts`, `hash.ts`, `BattleRunner.ts` · `run/state.ts`, `board.ts`, `deck.ts`, `rewards.ts`, `battleSetup.ts`, `yearFlow.ts`, `commands.ts`, `RunController.ts` · `sim/headless.ts`, `sim/bots/random.ts` · `testing/fixtures.ts`.

**Tạo — `src/render/`:** `fieldArt.ts`, `plotArt.ts`, `buildingArt.ts`, `unitArt.ts`, `iconArt.ts`, `fxArt.ts`, `cardArt.ts` · `FieldRenderer.ts`, `BoardRenderer.ts`, `UnitRenderer.ts`, `FxRenderer.ts`. **Sửa:** `atlas.ts` (atlas `sprites`, hàm `*Frame`), `uiArt.ts` (4 khung thẻ).

**Tạo — `src/ui/`:** `realm/realmLayout.ts` (thuần, có test) · `cards/CardView.ts` · `planning/ScoutPanel.ts`, `planning/HandView.ts` · `modals/RewardModal.ts`.

**Tạo — `src/scenes/`:** `RealmScene.ts`, `PlanningHudScene.ts`, `BattleHudScene.ts`, `RunEndScene.ts`. **Sửa:** `keys.ts`, `MainMenuScene.ts` ("Ván mới" bật), `main.ts` (danh sách scene), `core/events.ts` (bỏ `GameEvents`).

**Sửa tài liệu:** `docs/ROADMAP.md`, `CLAUDE.md`, `README.md` (Task 18).

---

### Task 1: Hằng số và kiểu dữ liệu (`src/data`)

**Files:**
- Create: `src/data/types.ts`, `src/data/run.ts`, `src/data/battle.ts`, `src/data/scaling.ts`
- Test: `src/data/run.test.ts`, `src/data/battle.test.ts`

**Interfaces:**
- Produces (dùng ở mọi task sau):
  - `types.ts`: `Level`, `PerLevel`, `KingId` (9 id §5.1), `CardOwner`, `CardId = \`${CardOwner}_${string}\``, `UnitId = string`, `CardKind`, `BuildingKind`, `Rarity`, `CardTag`, `DamageType`, `UnitTag`, `TargetMode`, `AttackSpec` (`dmg, type, range, minRange?, interval, projectileSpeed?, cleave?, onHit?: readonly OnHitDef[]`), `OnHitDef = { type: 'slow'; pct: number; ticks: number }`, `UnitDef` (§5.1 không có `behaviours`), `EffectDef = { type: 'spawn'; unit: UnitId; count: PerLevel } | { type: 'tower'; attack: AttackSpec; targeting: TargetMode }`, `TomeTarget = 'lockedPlot' | 'buildingThenPlot'`, `TomeAction = { type: 'unlockPlot'; gold: number } | { type: 'move'; levelIfFar: number }`, `ThroneDef`, `BuildingCardDef` (`kind: 'troop' | 'tower'`), `TomeCardDef`, `CardDef = ThroneDef | BuildingCardDef | TomeCardDef`, `KingDef` (`id, nameVi, name, color: PaletteColor, throne, cards, units, enemyRoster`).
  - `run.ts`: `RUN = { startLives: 3, handSize: 3, maxLevel: 5 } as const`; `RULES_G1 = { years: 10, calendar: 'raiders' } as const`; `START_DECK_G1: readonly CardId[]`; `REWARD = { choices: 3, kingShare: 0.65 } as const`; `rewardRarityWeights(year: number): readonly [number, number, number]` (thường, vừa, hiếm).
  - `battle.ts`: `BATTLE`, `SPAWN_OFFSETS`, `INTERVENTION`, `ENEMY_BUDGET`, `SLOT_MULT`, `ENEMY_CAP`, `ENEMY_LEVEL_COST`, `ENEMY_LEVEL_STAT`, `WAVES` — giá trị chép nguyên văn §8.2, §7.4, §3.6.
  - `scaling.ts`: `STRUCT_HP = { troop: 150, tower: 220, economy: 120, support: 160 } as const`; `MAX_UNITS_PER_BUILDING = 20`.

- [ ] **Step 1: Write the failing tests**

`src/data/run.test.ts`: `RULES_G1.years === 10`; `RUN.startLives === 3`, `RUN.handSize === 3`; `START_DECK_G1.length === 11` và đếm đúng 2/2/1/2/2/1/1 cho `wheat_militia`/`wheat_scarecrow`/`wheat_reapers`/`neutral_barracks`/`neutral_archer_tower`/`neutral_clear_land`/`neutral_move`; `rewardRarityWeights(1)` và `(9)` = `[60,30,10]`, `(10)` và `(19)` = `[45,35,20]`, `(20)` và `(30)` = `[30,40,30]`; mỗi bộ cộng 100.

`src/data/battle.test.ts`: `ENEMY_BUDGET.length === 30`, `ENEMY_BUDGET[0] === 12`, `[29] === 691`; mỗi phần tử bằng `Math.round(12 × 1.15^(y−1))` tính bằng nhân lặp trong test (`let v = 12; for … v *= 1.15`); `Math.round(ENEMY_BUDGET[0]! × SLOT_MULT.raiders) === 10`; `WAVES.share` cộng 1 và `WAVES.spawnTick` = `[0,120,240]`; `ENEMY_LEVEL_STAT` tăng nghiêm ngặt, dài 5; `SPAWN_OFFSETS.length === 16` và mọi phần tử có `Math.max(|x|,|y|) ≤ 14`, phần tử 0 = `[0,-8]`; `BATTLE.entityCap ≥ ENEMY_CAP + BATTLE.playerUnitCap + 25 + 1`; `INTERVENTION.cooldownTicks === 150`, `firstReadyTick === 30`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/data/run.test.ts src/data/battle.test.ts < /dev/null` — Expected: FAIL (modules không tồn tại).

- [ ] **Step 3: Implement** các file theo khối Interfaces; chép đúng giá trị từ §3.6 (`ENEMY_BUDGET`, `SLOT_MULT`, `ENEMY_CAP`, `ENEMY_LEVEL_COST`, `ENEMY_LEVEL_STAT`, `WAVES`), §7.4 (`INTERVENTION`), §8.2 (`BATTLE`, `SPAWN_OFFSETS`). `START_DECK_G1` liệt kê id theo thứ tự trong bullet Global Constraints. `rewardRarityWeights` chọn dải bằng `year < 10`, `year < 20`. Không dùng `**`.

- [ ] **Step 4: Run to verify pass** — cùng lệnh Step 2 → PASS; rồi chạy bộ kiểm tra đầy đủ (Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/data/run.ts src/data/battle.ts src/data/scaling.ts src/data/run.test.ts src/data/battle.test.ts
git commit -m "feat(data): G1 types and run/battle constants"
```

---

### Task 2: Nội dung G1, registry và mô tả thẻ

**Files:**
- Create: `src/data/raiders.ts`, `src/data/neutral.ts`, `src/data/kings/wheat.ts`, `src/data/kings/index.ts`, `src/game/cards/registry.ts`, `src/game/cards/describe.ts`
- Test: `src/data/content.test.ts`, `src/game/cards/registry.test.ts`, `src/game/cards/describe.test.ts`

**Interfaces:**
- Consumes: Task 1 kiểu dữ liệu.
- Produces:
  - `raiders.ts`: `RAIDER_UNITS: readonly UnitDef[]` (`bandit`, `bandit_archer`, `boar_rider`, `ogre` đúng bảng §6.2), `RAIDER_ROSTER: readonly { unit: UnitId; weight: number }[]` (50/25/15/10).
  - `neutral.ts`: `NEUTRAL_UNITS` (`footman` §6.1), `NEUTRAL_CARDS: readonly CardDef[]` (4 thẻ G1).
  - `kings/wheat.ts`: `WHEAT: KingDef` (Ngai `wheat_throne`, 3 thẻ, `units` = `militia`, `reaper`, `enemyRoster` = `militia 50, reaper 25, peasant 25` nhưng `peasant` chưa có → roster chỉ `militia 50, reaper 25`); `kings/index.ts`: `KINGS_G1: readonly KingDef[] = [WHEAT]`.
  - `registry.ts`: `interface Content { card(id: CardId): CardDef; unit(id: UnitId): UnitDef; king(id: KingId): KingDef; raiderRoster(): readonly { unit: UnitDef; weight: number }[]; neutralPool(): readonly CardDef[] }`, `export const CONTENT: Content`. `card`/`unit`/`king` ném `Error('Unknown card id: <id>')` v.v. nếu thiếu.
  - `describe.ts`: `describeCard(def: CardDef, level: Level = 1): TooltipContent` (kiểu từ `src/ui/hud/layout.ts` **không** được import vì `game` không import `ui`) → trả `{ title: string; lines: readonly string[] }` (kiểu `CardDescription` định nghĩa trong `describe.ts`); `resolvePlaceholders(text: string, values: Readonly<Record<string, number>>): string` ném lỗi nếu còn `{key}` không có giá trị.

- [ ] **Step 1: Write the failing tests**
  - `content.test.ts`: id thẻ/đơn vị duy nhất; mọi `CardId` có tiền tố `${owner}_`; mọi `UnitId` được tham chiếu (spawn, `enemyRoster`, `RAIDER_ROSTER`) tồn tại; `nameVi`/`textVi` không rỗng; `WHEAT.cards` đúng 3 thẻ với độ hiếm `common, uncommon, common` cho `wheat_militia`, `wheat_reapers`, `wheat_scarecrow`; `WHEAT.color` ∈ `PALETTE` (so `Object.keys(PALETTE)` với `PaletteColor`); chỉ số chính xác: `wheat_throne` HP 300, armor 0, attack `{dmg 8, physical, range 72, interval 10, projectileSpeed 8}`; `militia` HP 32, dmg 5, range 2, interval 10, speed 1, radius 4, enemyCost 0.8; `reaper` HP 45, dmg 9, cleave 2, interval 12, speed 0.9, armor 0.05, enemyCost 1.6; `footman` HP 45 dmg 7 speed 0.9 armor 0.1; `ogre` HP 180 dmg 16 range 4 interval 18 speed 0.6 radius 9 armor 0.2 tags gồm `siege`; thẻ: `wheat_militia` spawn `militia` `[4,6,8,10,12]`, `wheat_reapers` spawn `reaper` `[3,4,5,6,7]`, `neutral_barracks` spawn `footman` `[3,4,5,6,7]`, `wheat_scarecrow` tower dmg 6 range 72 interval 12 projectileSpeed 6 + `onHit slow pct 20 ticks 20`, `neutral_archer_tower` tower dmg 7 range 88 interval 12 projectileSpeed 8 targeting `closestToThrone`, `neutral_clear_land` tome `lockedPlot` + `unlockPlot gold 0`, `neutral_move` tome `buildingThenPlot` + `move levelIfFar 0`; mọi `PerLevel` dài 5.
  - `registry.test.ts`: `CONTENT.card('wheat_militia').kind === 'troop'`; `CONTENT.unit('bandit').enemyCost === 1`; `CONTENT.card('nope_x' as CardId)` ném lỗi chứa `Unknown card id`; `CONTENT.raiderRoster()` có 4 phần tử, tổng trọng số 100; `CONTENT.neutralPool().length === 4`.
  - `describe.test.ts`: mọi thẻ trong `CONTENT` (Ngai + 3 + 4) gọi `describeCard(def, level)` với `level` 1..5 không ném lỗi và không còn `{`; `describeCard(CONTENT.card('wheat_militia'), 1).lines[0] === 'Sinh 4 Dân Quân khi ra trận.'`, ở cấp 2 → `'Sinh 6 Dân Quân khi ra trận.'`; `wheat_scarecrow` L1 dòng đầu `'Bắn 6 sát thương, tầm 72; trúng: chậm 20%.'`; `resolvePlaceholders('a {x}', {})` ném lỗi.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/data/content.test.ts src/game/cards < /dev/null` → FAIL.

- [ ] **Step 3: Implement** dữ liệu theo §6.1–6.3 (tên Việt đúng bảng: Trại Lính, Tháp Cung, Khai Hoang, Dời Nhà, Dân Quân, Đội Thợ Gặt, Bù Nhìn Gác, Ngai Bó Lúa, Lính Bộ, Thổ Phỉ, Cung Thủ Phỉ, Kỵ Lợn Rừng, Gã Hộ Pháp). Kích thước sprite: 16×16 cho `militia`, `footman`, `bandit`, `bandit_archer`; 16×24 cho `reaper`; 24×24 cho `boar_rider`; 24×32 cho `ogre`. `textVi` chỉ dùng placeholder `{count}`, `{dmg}`, `{range}`, `{slowPct}`; mẫu: troop `Sinh {count} <Tên> khi ra trận.`, tower `Bắn {dmg} sát thương, tầm {range}.` (+ `; trúng: chậm {slowPct}%.` cho Bù Nhìn), Khai Hoang `Mở một ô khoá kề ô đã mở.`, Dời Nhà `Dời một công trình sang ô đã mở khác (đổi chỗ nếu có).`. `describeCard` lấy `count`/`dmg`/`range`/`slowPct` từ `effects`/`attack` ở cấp `level` (`PerLevel[level−1]`). `registry.ts` dựng `Map` từ danh sách, tra O(1).

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/data/raiders.ts src/data/neutral.ts src/data/kings src/game/cards src/data/content.test.ts
git commit -m "feat(content): wheat king, neutral cards, raiders, registry and card text"
```

---

### Task 3: Đạo quân địch (`composeArmy`)

**Files:**
- Create: `src/game/battle/compose.ts`, `src/game/battle/types.ts` (tạo mới trong task này: `Edge`, `ArmyPlan` và các kiểu `BattleInput`, `BattleResult`; Task 5 thêm phần còn lại)
- Test: `src/game/battle/compose.test.ts`

**Interfaces:**
- Consumes: `ENEMY_BUDGET`, `SLOT_MULT`, `ENEMY_CAP`, `ENEMY_LEVEL_COST`, `WAVES`, `RUN`, `Rng`, `hashSeed`.
- Produces:
  - `types.ts`: `type Edge = 'N' | 'E' | 'S' | 'W'`; `interface ArmySpawn { unit: UnitId; edge: Edge }`; `interface ArmyWave { spawnTick: number; units: readonly ArmySpawn[] }`; `interface ArmyPlan { attacker: 'raiders'; budget: number; level: 1|2|3|4|5; statMult: number; waves: readonly ArmyWave[] }`; `BattleInput` và `BattleResult` (định nghĩa đầy đủ ở khối Interfaces của Task 5; tạo luôn ở đây để `RunState`/`RunCommand` ở Task 4 import được).
  - `compose.ts`: `armyBudget(year: number, slot: number): number` (`round(ENEMY_BUDGET[year−1] × slot)`, độ khó Gai 0); `interface ComposeEntry { unit: UnitId; weight: number; enemyCost: number }`; `composeArmy(roster: readonly ComposeEntry[], budget: number, year: number, seed: number): ArmyPlan` (thuần; tự tạo `new Rng(hashSeed(\`${seed}:army:${year}\`))`).

- [ ] **Step 1: Write the failing tests** (roster thử = bảng Thổ Phỉ: `bandit` 1.0/50, `bandit_archer` 1.2/25, `boar_rider` 2.0/15, `ogre` 5.0/10)
  - `armyBudget(1, SLOT_MULT.raiders) === 10`; `armyBudget(10, 0.8) === 34`.
  - Không vượt ngân sách: với `year` 1..10, `seed` 1..20, `spent` = tổng `enemyCost × ENEMY_LEVEL_COST[level−1]` của mọi đơn vị thoả `spent ≤ budget` và `budget − spent < 1.0 × ENEMY_LEVEL_COST[level−1]` (phần còn lại nhỏ hơn giá của loại rẻ nhất).
  - Cấp: `budget 34` → `level 1`; `budget 1000` → `level 4` (`avg = 1.6`: cấp 3 cho `1000/(1.6×4) = 156 > 120`, cấp 4 cho `1000/(1.6×8) = 78 ≤ 120`); `budget 1e7` → `level 5`.
  - Chạm cap: `budget 1e7` → tổng đơn vị = `ENEMY_CAP` (120) và `statMult === Math.sqrt(budget / spent)` (> 1); `budget 34` → `statMult === 1`.
  - Chia đợt: tổng N = 20 → các đợt 8/7/5 (floor(0.4N), floor(0.35N), phần dư); `spawnTick` = `[0,120,240]`; mọi đợt giữ thứ tự tạo.
  - Mép: năm 1..9 mỗi đợt dùng đúng 1 mép; năm 10 mỗi đợt dùng đúng 2 mép khác nhau (khi đợt có ≥ 2 lính), lính xen kẽ mép (chỉ số chẵn → mép A, lẻ → mép B).
  - Deterministic: cùng `(roster, budget, year, seed)` hai lần → `toEqual`; khác `seed` → khác ít nhất 1 trong 20 seed; khác `year` → luồng khác.
  - Không sửa `roster` đầu vào (`Object.freeze` roster và kiểm tra không ném).

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/battle/compose.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo §3.6: `level` = cấp nhỏ nhất ∈ 1..5 với `budget / (avg × ENEMY_LEVEL_COST[ℓ−1]) ≤ ENEMY_CAP` (không có → 5), `avg` = trung bình `enemyCost` theo trọng số; lặp bốc theo trọng số **trong số loại còn đủ `enemyCost × cost ≤ remaining`** (Quyết định 6) tới khi không loại nào đủ hoặc đủ `ENEMY_CAP` đơn vị; nếu dừng vì cap và `spent < budget` thì `statMult = Math.sqrt(budget / spent)`; chia đợt `floor(N × share)` (đợt 3 nhận dư); mỗi đợt bốc mép bằng `rng.pick(['N','E','S','W'])` (đợt có hai mép: bốc mép thứ hai trong 3 mép còn lại).

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/battle/types.ts src/game/battle/compose.ts src/game/battle/compose.test.ts
git commit -m "feat(battle): composeArmy with level selection, surplus and waves"
```

---

### Task 4: Trạng thái ván, luật bàn cờ và rút bài

**Files:**
- Create: `src/game/run/state.ts`, `src/game/run/board.ts`, `src/game/run/deck.ts`
- Test: `src/game/run/board.test.ts`, `src/game/run/deck.test.ts`

**Interfaces:**
- Consumes: Task 1–3 (`CardId`, `Level`, `ArmyPlan`, `Content`, `Rng`).
- Produces:
  - `state.ts` (JSON thuần): `BuildingState { uid: number; cardId: CardId; level: Level; placedYear: number }`; `PlotState { unlocked: boolean; building: BuildingState | null }`; `RunPhase = 'planning' | 'battle' | 'reward' | 'yearEnd' | 'ended'`; `RngStream = 'draw' | 'reward'`; `OfferState { kind: 'reward'; cardIds: CardId[] }`; `RunStats { kills: number; battlesWon: number; battlesLost: number }`; `RunState { version: number; seed: number; kingId: KingId; year: number; phase: RunPhase; lives: number; plots: PlotState[]; throneLevel: Level; deck: CardId[]; hand: CardId[]; played: boolean; army: ArmyPlan | null; offers: OfferState | null; rng: Record<RngStream, number>; stats: RunStats; nextUid: number; won: boolean | null }`; `IllegalReason` (Quyết định 3); `RunCommand` = `{ type: 'play'; handIndex: number; target: PlayTarget } | { type: 'skip' } | { type: 'startBattle' } | { type: 'battleResult'; result: BattleResult } | { type: 'pickOffer'; index: number | null } | { type: 'advance' }`; `PlayTarget = { kind: 'none' } | { kind: 'plot'; plot: number } | { kind: 'two'; first: number; second: number }`; `RUN_SAVE_VERSION = 1`. (`BattleResult` import type từ `../battle/types`, đã có từ Task 3.)
  - `board.ts`: `plotCol(plot: number): number`, `plotRow(plot: number): number`, `THRONE_PLOT = 12`, `neighbours(plot: number): number[]` (Bắc, Đông, Nam, Tây, bỏ ô ngoài bàn), `initialPlots(): PlotState[]` (25 ô, mở khi `col,row ∈ 1..3`, **không** đặt Ngai), `hasAnyTarget(plots: readonly PlotState[], card: CardDef): boolean`, `checkPlay(plots: readonly PlotState[], card: CardDef, target: PlayTarget): IllegalReason | null`, `placeBuilding(plots, plot, building): PlotState[]`, `moveBuilding(plots, from, to): PlotState[]` (đổi chỗ nếu ô đích có công trình), `unlockPlot(plots, plot): PlotState[]` — đều trả mảng mới, không sửa đầu vào.
  - `deck.ts`: `drawHand(deck: readonly CardId[], rng: Rng, size: number): CardId[]` (Fisher–Yates bán phần trên bản sao theo chỉ số; deck nhỏ hơn `size` thì trả hết, thứ tự đã xáo).

- [ ] **Step 1: Write the failing tests**
  - `neighbours(12)` = `[7, 13, 17, 11]`; `neighbours(0)` = `[1, 5]`; `neighbours(4)` = `[9, 3]`; `neighbours(24)` = `[19, 23]`.
  - `initialPlots()`: 25 ô; số ô mở = 9; ô 6,7,8,11,12,13,16,17,18 mở; ô 0 và 24 khoá; không ô nào có `building`.
  - `checkPlay` (card troop, plots gồm Ngai ở 12 và một công trình ở 7): `plot 0` → `'locked'`; `plot 12` → `'throne'`; `plot 7` → `'occupied'`; `plot 6` → `null`; `target { kind: 'none' }` → `'badTarget'`; `plot 99` → `'badTarget'`.
  - Khai Hoang (`lockedPlot`): `plot 0` (khoá, hai láng giềng 1 và 5 đều khoá) → `'notAdjacent'`; `plot 1` (láng giềng 6 mở) → `null`; `plot 6` (đã mở) → `'badTarget'`; khi cả 25 ô mở → `hasAnyTarget` false.
  - Dời Nhà (`buildingThenPlot`, `two`): `first 12` → `'throne'`; `first 6` (trống) → `'noBuilding'`; `first 0` → `'locked'`; `second 0` → `'locked'`; `second 12` → `'throne'`; `second === first` → `'badTarget'`; `first 7, second 6` → `null`; không có công trình nào ngoài Ngai → `hasAnyTarget` false.
  - `moveBuilding` đổi chỗ khi ô đích có công trình (uid hoán đổi); không sửa mảng gốc (so `structuredClone` trước/sau).
  - `drawHand`: deck 11 bản (START_DECK_G1) → 3 phần tử, mỗi id không xuất hiện nhiều hơn số bản trong deck; deck 2 bản → đúng 2 phần tử, đúng 2 bản đó; deck rỗng → `[]`; cùng `Rng(seed)` → cùng kết quả; không sửa `deck`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/run < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo các chữ ký; `checkPlay` kiểm theo thứ tự: kiểu `PlayTarget` đúng thẻ (`troop|tower` → `plot`; `lockedPlot` → `plot`; `buildingThenPlot` → `two`) rồi chỉ số trong 0..24 (nếu sai → `badTarget`), sau đó luật từng loại như bảng test. `hasAnyTarget`: troop/tower → có ô mở trống ≠ 12; `lockedPlot` → có ô khoá kề ô mở; `buildingThenPlot` → có công trình ≠ Ngai **và** có ô mở khác nó. `checkPlay` trả `'noTarget'` khi `hasAnyTarget` false (kiểm trước các luật theo ô).

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/run/state.ts src/game/run/board.ts src/game/run/deck.ts src/game/run/board.test.ts src/game/run/deck.test.ts
git commit -m "feat(run): run state, board rules and hand drawing"
```

---

### Task 5: Thế giới trận (`BattleWorld`) và xuất quân

**Files:**
- Modify: `src/game/battle/types.ts` (thêm các kiểu trận còn lại; `BattleInput`/`BattleResult` đã có từ Task 3)
- Create: `src/game/battle/world.ts`, `src/game/battle/hash.ts`, `src/game/testing/fixtures.ts`
- Test: `src/game/battle/world.test.ts`

**Interfaces:**
- Consumes: Task 1 (`BATTLE`, `SPAWN_OFFSETS`, `MAX_UNITS_PER_BUILDING`), Task 3 (`Edge`).
- Produces (`types.ts`):
  - `AttackStats { dmg: number; dmgType: DamageType; range: number; minRange: number; interval: number; projectileSpeed: number /* 0 = đánh tức thời */; cleave: number /* 1 = một mục tiêu */; slowPct: number; slowTicks: number }`
  - `UnitStats extends AttackStats { unit: UnitId; hp: number; speed: number; radius: number; armor: number; siege: boolean; sprite: { w: number; h: number } }`
  - `StructureSetup { plot: number; uid: number; cardId: CardId; kind: 'throne' | 'troop' | 'tower'; hp: number; armor: number; attack: AttackStats | null; targeting: TargetMode; spawn: { stats: UnitStats; count: number } | null }`
  - `WaveSetup { spawnTick: number; spawns: readonly { stats: UnitStats; edge: Edge }[] }`
  - `BattleSetup { year: number; throne: StructureSetup; structures: readonly StructureSetup[]; waves: readonly WaveSetup[] }`
  - `BattleInput { tick: number; x: number; y: number }` (đã tạo ở Task 3)
  - `BattleResult { won: boolean; ticks: number; throneHpLostPct: number; kills: number; killsBySource: Record<number, number>; interventionsUsed: number; unitsLost: number; capped: number; inputs: BattleInput[] }`
  - `BattleEvent` = `{ type: 'spawn'; id: number } | { type: 'hit'; id: number; dmg: number } | { type: 'death'; id: number } | { type: 'boulder'; phase: 'drop' | 'impact'; x: number; y: number } | { type: 'waveSpawned'; index: number; edges: readonly Edge[] } | { type: 'rage' } | { type: 'ended'; won: boolean }`
- Produces (`world.ts`): `TEAM_ALLY = 0`, `TEAM_FOE = 1`, `KIND_UNIT = 0`, `KIND_STRUCTURE = 1`, `KIND_THRONE = 2`; `class BattleWorld` với `readonly setup: BattleSetup`, `tick: number` (số tick đã chạy), `count: number` (cao nhất + 1; id = chỉ số, không tái dùng), mảng typed dài `BATTLE.entityCap`: `Float64Array` — `x, y, prevX, prevY, hp, maxHp, dmg, range, minRange, interval, cooldown, speed, radius, armor, slowPct, projSpeed, cleave, onHitSlowPct, homeX, homeY, kbX, kbY`; `Int32Array` — `team, kind, alive, siege, target, slowTicks, onHitSlowTicks, sourceUid, kbTicks, targeting` (0 nearest, 1 closestToThrone); `label: string[]` (id đơn vị hoặc `cardId`, để render chọn frame); `dmgType: Uint8Array` (0 physical, 1 fire, 2 magic); pool đạn `projectiles` (mảng typed dài `BATTLE.projectileCap`: `px, py, speed, dmg, slowPct, targetId (Int32), sourceUid (Int32), dmgType, alive`) với `projectileCount: number`; `events: BattleEvent[]`; số liệu thống kê `kills`, `unitsLost`, `capped`, `interventionsUsed`, `killsBySource`, `inputs`; `spawnedWaves: number`; `throneId: number` (= 0). Hàm: `createBattle(setup: BattleSetup): BattleWorld`; `spawnWave(world, index: number): void`; `plotCenter(plot: number): { x: number; y: number }`; `edgePositions(edge: Edge, count: number): { x: number; y: number }[]`; `drainEvents(world): BattleEvent[]`.
- Produces (`hash.ts`): `hashWorld(world: BattleWorld): number` — FNV‑1a 32-bit trên các `Uint32Array` view của mọi mảng typed (chỉ `0..count−1`), cộng `tick`, `projectileCount`.
- Produces (`fixtures.ts`): `attackStats(over?: Partial<AttackStats>): AttackStats`, `unitStats(over?: Partial<UnitStats>): UnitStats` (mặc định: hp 40, dmg 5, melee range 2, interval 10, speed 1, radius 4, armor 0), `structure(plot: number, over?: Partial<StructureSetup>): StructureSetup`, `throneSetup(over?): StructureSetup` (plot 12, uid 0, hp 300, attack bắn tầm 72), `battleSetup(over?: Partial<BattleSetup>): BattleSetup`.

- [ ] **Step 1: Write the failing tests** (`world.test.ts`)
  - `plotCenter(12)` = `(192, 192)`; `plotCenter(7)` = `(192, 160)`; `plotCenter(0)` = `(128, 128)`.
  - `createBattle`: Ngai là id 0 tại `(192,192)` với `kind KIND_THRONE`; công trình theo `plot` tăng dần là các id kế tiếp; một Trại Lính ở plot 7 với `spawn.count 3` sinh 3 lính phe mình tại `plotCenter(7) + SPAWN_OFFSETS[k]` → toạ độ `(192,152)`, `(200,160)`, `(192,168)`; mỗi lính có `homeX/homeY = plotCenter(7)` và `sourceUid` = uid công trình; có sự kiện `spawn` cho từng id.
  - Vòng thứ hai: công trình `count 20` → lính thứ 16 dùng `SPAWN_OFFSETS[0] × 1.5` làm tròn = `(0, −12)`.
  - Không phụ thuộc thứ tự chèn: `createBattle` với `structures` đảo ngược cho `hashWorld` bằng nhau.
  - Trần: 9 công trình `troop` mỗi cái `count 20` → đúng 160 lính phe mình, `world.capped === 20`, `world.count ≤ BATTLE.entityCap`, không ném lỗi; thêm wave 150 lính địch vào `entityCap` không ghi ngoài mảng (số lính địch được tạo = `entityCap − world.count` tại thời điểm đó, phần thiếu bị bỏ).
  - `edgePositions('N', 3)` = `[(182,−12), (192,−12), (202,−12)]`; `edgePositions('S', 1)` = `[(192, 396)]`; `edgePositions('E', 2)` có `x = 396`, `y = 187, 197`; `edgePositions('W', 1)` có `x = −12`; 25 lính trên mép `'N'`: hàng 1 có 24 lính ở `y = −12`, hàng 2 có 1 lính ở `y = −22`.
  - `spawnWave(world, 0)` tạo lính địch với `team TEAM_FOE`, `sourceUid −1`, sự kiện `waveSpawned` với `index 0` và danh sách mép; `world.spawnedWaves` tăng 1.
  - `hashWorld`: hai `createBattle` cùng setup → bằng nhau; sau khi đổi `world.x[1] += 1` → khác.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/battle/world.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo §8.1–8.3, §8.7: `createBattle` sắp `structures` theo `plot`; tick 0: Ngai → công trình → lính của từng công trình `troop` theo `plot` (lính thứ k ở `plotCenter + SPAWN_OFFSETS[k % 16]`, vòng thứ hai trở đi nhân 1.5 rồi `Math.round`) — lính phe mình vượt `BATTLE.playerUnitCap` hoặc `entityCap` thì bỏ, `capped++`. Entity `alive = 1`, `cooldown = 0`. `edgePositions` theo §8.2 (đoạn giữa `edgeSpan × field`, `perRow = floor(edgeSpan × field / spawnSpacing) + 1`, hàng đầy lùi ra thêm `spawnRowGap`; mỗi hàng căn giữa quanh trung điểm mép với `spawnSpacing`), `N`: `y = −spawnOutside`, `S`: `y = field + spawnOutside`, `W`: `x = −spawnOutside`, `E`: `x = field + spawnOutside`. `spawnWave` tạo lính theo thứ tự `spawns`, mỗi mép lấy `edgePositions(edge, số lính của mép)` theo thứ tự xuất hiện. `drainEvents` trả mảng hiện tại và đặt `world.events = []`.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/battle/types.ts src/game/battle/world.ts src/game/battle/hash.ts src/game/testing/fixtures.ts src/game/battle/world.test.ts
git commit -m "feat(battle): struct-of-arrays BattleWorld, spawning and state hash"
```

---

### Task 6: Chọn mục tiêu và di chuyển

**Files:**
- Create: `src/game/battle/targeting.ts`, `src/game/battle/movement.ts`
- Test: `src/game/battle/targeting.test.ts`, `src/game/battle/movement.test.ts`

**Interfaces:**
- Consumes: Task 5 (`BattleWorld`, hằng `TEAM_*`/`KIND_*`), `separationPush` (`steering.ts`), `SpatialHash`.
- Produces:
  - `targeting.ts`: `edgeDistance(world: BattleWorld, a: number, b: number): number` (khoảng cách tâm trừ hai bán kính); `inRange(world, attacker: number, victim: number): boolean` (`edgeDistance ≤ range` và `≥ minRange`); `retarget(world: BattleWorld): void` (§8.4 cho mọi lính, id tăng dần, chỉ chọn lại mỗi `BATTLE.retargetTicks` tick hoặc khi mục tiêu chết); `pickShotTarget(world: BattleWorld, shooter: number): number` (−1 nếu không có; tháp/Ngai chọn theo `targeting`, hoà → id nhỏ).
  - `movement.ts`: `moveEntities(world: BattleWorld): void` (§8.9 bước 5).

- [ ] **Step 1: Write the failing tests**
  - Lính phe mình chọn địch gần nhất (so bình phương); hai địch cùng khoảng cách → id nhỏ hơn; không còn địch → `target = −1` và đi về `homeX/homeY`.
  - Địch: trong `enemyAggro` (48 px) có lính/công trình phe mình → chọn gần nhất; ngoài 48 → Ngai; đơn vị `siege` bỏ qua lính phe mình, chỉ chọn công trình trong `siegeAggro` (96) rồi Ngai.
  - Cuồng Nộ: `world.tick = BATTLE.rageTick` → địch chỉ nhắm Ngai dù lính phe mình sát bên, và tốc độ hiệu dụng × 1.5; `world.tick = rageTick − 1` thì chưa.
  - `retarget` không chạy lại khi `tick % retargetTicks ≠ 0` và mục tiêu còn sống; chạy ngay khi mục tiêu `alive = 0`.
  - `pickShotTarget`: tháp `closestToThrone` chọn địch gần Ngai nhất trong tầm; Ngai `nearest` chọn địch gần Ngai (bản thân) nhất; hoà → id nhỏ; không có địch trong tầm → −1; công trình `alive = 0` không bắn (trả −1).
  - Di chuyển: footman (range 2, r 4) tiến về địch (r 4) cách 100 px: sau đủ tick khoảng cách mép–mép `= 2` (không vượt quá), mỗi tick đi `≤ speed`; `slowPct 50` → mỗi tick đi `speed × 0.5`; lính đã trong tầm đứng yên; `prevX/prevY` = vị trí đầu tick; kẹp trong `[−32, 416]`; hai lính trùng tâm → tách dọc trục x (không NaN), mỗi bên `≤ separationPushMax`; công trình không bao giờ bị đẩy; lính rảnh về tâm ô nhà rồi đứng yên (không rung: khi cách `< 0.5` px thì đặt đúng vị trí).
  - Đẩy lùi: `kbTicks 3`, `kbX = 4` → tổng dịch `12` trong 3 tick (`kbX` là dịch mỗi tick) rồi dừng.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/battle/targeting.test.ts src/game/battle/movement.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo §8.3–8.4, §8.9 bước 4–5, §8.11: `retarget` duyệt id tăng dần; tìm gần nhất bằng `SpatialHash` (`cell = BATTLE.spatialCell`) xây lại mỗi tick cho thực thể còn sống và **sắp kết quả `query` theo id** trước khi so sánh (hoặc duyệt tuyến tính toàn bộ; chọn cách đơn giản nhất qua benchmark Task 8). Vận tốc mong muốn = hướng tới mục tiêu chuẩn hoá bằng `Math.sqrt`, độ dài `min(speed × (1 − slowPct/100) × (rage ? 1.5 : 1), gap)` với `gap = edgeDistance − range` (không vượt). Separation: lập `SeparationBodies` từ ảnh chụp vị trí (`fixed = kind ≠ KIND_UNIT`, `flying = 0` trong G1), gọi `separationPush(bodies, BATTLE.separationPushMax, outX, outY)` rồi cộng đồng thời; sau đó áp đẩy lùi, rồi kẹp biên `fieldClampMargin`.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/battle/targeting.ts src/game/battle/movement.ts src/game/battle/targeting.test.ts src/game/battle/movement.test.ts
git commit -m "feat(battle): target selection, rage and movement with separation"
```

---

### Task 7: Chiến đấu, đạn, trạng thái và kết thúc trận

**Files:**
- Create: `src/game/battle/combat.ts`, `src/game/battle/step.ts`
- Test: `src/game/battle/combat.test.ts`, `src/game/battle/step.test.ts`

**Interfaces:**
- Consumes: Task 5–6.
- Produces:
  - `combat.ts`: `mitigate(raw: number, type: DamageType, armor: number): number` (§8.5: vật lý `raw × (1 − armor)`, lửa `raw × (1 − armor/2)`, phép `raw`); `attackPhase(world): void` (§8.9 bước 6: giảm cooldown rồi đánh; tạo sự kiện sát thương hoặc đạn), `projectilePhase(world): void` (bước 7), `applyDamagePhase(world): void` (bước 8, gồm `onHit` chậm), `statusPhase(world): void` (bước 9: giảm `slowTicks`/`onHitSlowTicks` mỗi tick, hết thì `slowPct = 0`), `deathPhase(world): void` (bước 10, id tăng dần; cập nhật `kills`, `killsBySource`, `unitsLost`, sự kiện `death`), `queueDamage(world, victim, raw, type, sourceUid, slow?)` (hàng đợi sát thương trong tick; áp theo thứ tự `(id nguồn, id mục tiêu, thứ tự tạo)`).
  - `step.ts`: `stepBattle(world: BattleWorld, inputs: readonly BattleInput[]): void` (một tick đủ §8.9; `inputs` là các lệnh của tick này; ở task này `inputs` bị bỏ qua, Task 8 nối vào) ; `battleResult(world: BattleWorld): BattleResult | null` (null khi chưa kết thúc); `simulateBattle(setup: BattleSetup, inputs?: readonly BattleInput[]): BattleResult` (tạo world, lặp tới khi có kết quả; ném lỗi nếu quá `BATTLE.hardLimitTick + 1` tick).

- [ ] **Step 1: Write the failing tests**
  - `mitigate(10,'physical',0.1) === 9`; `mitigate(10,'fire',0.2) === 9`; `mitigate(10,'magic',0.5) === 10`.
  - Nhịp đánh: lính `interval 10` đánh ở tick T rồi T+10 (không T+9 hay T+11); lính rảnh nhiều tick rồi gặp địch đánh ngay một lần (không đánh dồn).
  - Cận chiến tức thời: footman dmg 7 vs địch armor 0 → HP giảm 7; armor 0.1 → giảm 6.3.
  - `cleave 2`: reaper dmg 9 có hai địch trong tầm → mục tiêu chính −9, địch thứ hai gần nhất −4.5; địch thứ ba không bị đánh.
  - Đạn: tháp bắn tại địch cách 80 px (đo mép–mép), `projectileSpeed 8` → đạn bay mỗi tick 8 px tới **vị trí hiện tại** của mục tiêu (mục tiêu đi thì đạn bám theo), sát thương áp đúng một lần khi tới; mục tiêu chết trước khi đạn tới → đạn biến mất, không gây sát thương cho ai khác; pool đầy (`projectileCount = projectileCap`) → đòn trúng ngay lập tức.
  - Chậm (`onHit slow 20% / 20 tick`): mục tiêu bị trúng có `slowPct 20`, `slowTicks 20`; trúng lần hai làm mới `slowTicks 20` không cộng dồn; hai nguồn chậm 20% và 50% → lấy 50%; nguồn 80% bị kẹp 60% (`BATTLE.maxSlowPct`); hết hạn → `slowPct 0`.
  - Công trình bị phá (`hp ≤ 0`): `alive = 0`, tháp ngừng bắn, lính đã sinh vẫn chiến đấu, mục tiêu địch chuyển sang đích kế tiếp.
  - Sát thương dồn trong tick: hai lính cùng giết một địch trong tick → địch chết một lần, `kills` tăng 1, `killsBySource` ghi cho nguồn có id nhỏ hơn (người áp sát thương trước theo thứ tự §8.9).
  - Kết thúc: thắng khi mọi đợt đã xuất hiện và không còn địch sống (`BattleResult.won true`, `ticks` = tick kết thúc); **Ngai về 0 HP cùng tick với địch cuối chết → `won false`**; `world.tick = hardLimitTick` với Ngai còn HP và còn địch → `won true`; địch Cuồng Nộ ở tick 600 (sự kiện `rage` đúng một lần); `throneHpLostPct = Math.round((1 − hp/maxHp) × 100)`; `unitsLost` đếm lính phe mình chết; `capped` lấy từ world; có sự kiện `ended` đúng một lần.
  - `simulateBattle` trên setup 1 Ngai + 4 lính Dân Quân + 1 Tháp Cung vs 1 đợt 6 Thổ Phỉ ở mép N → kết thúc, `won true`, `ticks < 900`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/battle/combat.test.ts src/game/battle/step.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo §8.5–8.9 và Quyết định 7 (cooldown). Thứ tự `stepBattle`: (1) `spawnWave` cho mọi đợt có `spawnTick === world.tick` chưa xuất hiện (đợt 1 ở tick 0) — sau `createBattle` tick 0 chưa spawn đợt nào; (2) *(Task 8)* can thiệp; (3) bỏ trống; (4) `retarget`; (5) `moveEntities`; (6) `attackPhase`; (7) `projectilePhase`; (8) `applyDamagePhase`; (9) `statusPhase`; (10) `deathPhase`; (11) kiểm tra kết thúc rồi `world.tick += 1`. Sự kiện `rage` phát một lần khi `world.tick === rageTick`. Đạn hết hiệu lực khi `targetId` chết (`alive = 0`). Không dùng `Rng`.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/battle/combat.ts src/game/battle/step.ts src/game/battle/combat.test.ts src/game/battle/step.test.ts
git commit -m "feat(battle): combat, projectiles, slow, deaths and end conditions"
```

---

### Task 8: Can thiệp hoàng gia, deterministic và benchmark

**Files:**
- Create: `src/game/battle/intervention.ts`
- Modify: `src/game/battle/step.ts` (nối bước 2), `src/game/battle/world.ts` (thêm `readyTick`, `boulders` nếu chưa có)
- Test: `src/game/battle/intervention.test.ts`, `src/game/battle/determinism.test.ts`, `src/game/battle/benchmark.test.ts`

**Interfaces:**
- Consumes: Task 5–7, `INTERVENTION`, `BATTLE`.
- Produces: `tryIntervene(world: BattleWorld, input: BattleInput): boolean` (hợp lệ khi `input.tick === world.tick`, `Number.isFinite(x/y)`, `0 ≤ x,y ≤ BATTLE.field`, `world.tick ≥ INTERVENTION.firstReadyTick`, `world.tick ≥ readyTick`; hợp lệ thì lên lịch tảng đá, `readyTick = tick + cooldownTicks`, `interventionsUsed++`, ghi `world.inputs`); `boulderPhase(world: BattleWorld): void` (rơi tảng đã hết `delayTicks`); `stepBattle` gọi `tryIntervene` cho từng `input` của tick rồi `boulderPhase` ở bước 2. Sự kiện `boulder` `drop` khi thả, `impact` khi rơi.

- [ ] **Step 1: Write the failing tests**
  - `intervention.test.ts`: lệnh ở tick 29 → `false`, không vào `inputs`; tick 30 → `true`; lệnh thứ hai ở tick 179 → `false`, tick 180 → `true` (150 tick sau lần thả); `x = NaN`, `y = −1`, `x = 385` → `false`; lệnh có `tick ≠ world.tick` → `false`. Tảng rơi sau `delayTicks 6` (sự kiện `impact` ở tick thả + 6): địch trong bán kính 24 nhận `40 + 10 × (year − 1)` sát thương **phép bỏ qua giáp** (armor 0.5 vẫn nhận đủ); năm 5 → 80; địch ngoài 24 px không bị; lính phe mình và công trình không bị; địch trong tầm bị đẩy ra xa tâm tổng 12 px trong 3 tick; địch chết vì tảng đá được tính vào `kills`.
  - `determinism.test.ts`: dựng setup lớn (Ngai, 6 công trình lính + 3 tháp, hai đợt 30 địch hai mép) và `inputs = [{tick 30,x 192,y 100}]`; chạy hai `BattleWorld` song song bằng `stepBattle`, so `hashWorld` bằng nhau ở **mọi** tick tới khi `battleResult` khác null; đổi `inputs[0].x` thành 100 → `hashWorld` cuối khác; đảo thứ tự `structures` trong setup → cùng `BattleResult` (`toEqual`).
  - `benchmark.test.ts`: kịch bản chuẩn — 8 công trình lính × 20 = 160 lính phe mình, 3 tháp, 120 địch xuất hiện ở tick 0 (4 mép × 30) → đo `stepBattle` trung bình trên 100 tick đầu bằng `process.hrtime.bigint()` (`performance.now` bị ESLint cấm trong `src/game`, kể cả file test): trung bình ≤ 2 ms/tick (ngưỡng chống flaky; mục tiêu thiết kế 0.5 ms).

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/battle < /dev/null` → các test mới FAIL.

- [ ] **Step 3: Implement** theo §7.4, §8.9 bước 2. Đẩy lùi dùng `kbX/kbY` (dịch mỗi tick = tổng/`knockbackTicks`) và `kbTicks`. Sát thương tảng đá đi qua `queueDamage` với `dmgType = 2` (phép) và `sourceUid = −2`. Nếu benchmark vượt ngưỡng: thay vòng lặp O(n²) của `separationPush` bằng chỉ duyệt cặp trong cùng/ô kề của `SpatialHash` (giữ nguyên chữ ký và thứ tự cặp tăng dần theo chỉ số) rồi chạy lại `steering.test.ts`.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/battle
git commit -m "feat(battle): royal boulder intervention, determinism and benchmark tests"
```

---

### Task 9: Thưởng và `buildBattleSetup`

**Files:**
- Create: `src/game/run/rewards.ts`, `src/game/run/battleSetup.ts`
- Test: `src/game/run/rewards.test.ts`, `src/game/run/battleSetup.test.ts`

**Interfaces:**
- Consumes: Task 2 (`Content`), Task 3 (`ArmyPlan`), Task 4 (`RunState`), Task 5 (`BattleSetup`, `StructureSetup`, `UnitStats`), `REWARD`, `rewardRarityWeights`, `ENEMY_LEVEL_STAT`, `STRUCT_HP`.
- Produces:
  - `rewards.ts`: `interface RewardPools { king: readonly CardDef[]; neutral: readonly CardDef[] }`; `rollOffers(rng: Rng, year: number, pools: RewardPools, count?: number): CardId[]` (mặc định `REWARD.choices`; các id khác nhau; luật §3.8: bốc nguồn bằng `rng.next() < REWARD.kingShare`, bốc độ hiếm theo `rewardRarityWeights(year)`, hạ độ hiếm rồi đổi nguồn nếu hết thẻ khác id; trả ít hơn `count` nếu tổng số thẻ không đủ).
  - `battleSetup.ts`: `buildBattleSetup(state: RunState, content: Content): BattleSetup` (thuần; throw nếu `state.army === null`).

- [ ] **Step 1: Write the failing tests**
  - `rollOffers`: với pools G1 (`king` = 3 thẻ Lúa Mì, `neutral` = 4 thẻ trung lập), mọi seed 1..200 cho đúng 3 id khác nhau thuộc 7 thẻ; cùng `Rng(seed)` → cùng kết quả; trạng thái `Rng` đổi sau khi gọi; pool `king` chỉ có 1 thẻ hiếm và `neutral` rỗng, `count 3` → trả đúng 1 thẻ (không ném lỗi, không lặp); năm 1 với trọng số `[60,30,10]` — pool mỗi nguồn chỉ có `rare` → vẫn trả thẻ (hạ độ hiếm không có thẻ thấp hơn thì đổi nguồn rồi lấy nguồn còn lại); thống kê 2000 lần bốc ở pools G1: tỉ lệ thẻ vua nằm trong 55–75% mỗi lựa chọn (đúng ±10% quanh 65%, vì luật khác id làm lệch nhẹ).
  - `buildBattleSetup` (state `fixtures`: Dân Quân ở plot 7, Tháp Cung ở plot 11, Trại Lính ở plot 13, `army` = `composeArmy` năm 1): `structures` sắp theo `plot` tăng dần (7, 11, 13); `structures[0].spawn.count === 4` với `stats.unit === 'militia'` (cấp 1), `hp === STRUCT_HP.troop (150)`, `kind 'troop'`; Tháp Cung `kind 'tower'`, `hp 220`, `attack.dmg === 7`, `attack.range === 88`, `attack.projectileSpeed === 8`, `targeting 'closestToThrone'`; Ngai `throne.hp === 300`, `throne.attack.range === 72`, `uid` của Ngai = 0; `waves.length === 3`; tổng số `spawns` bằng tổng số đơn vị trong `state.army`; năm có `level 2`/`statMult` thì mỗi `stats.hp` địch = `hp gốc × ENEMY_LEVEL_STAT[level−1] × statMult` (test bằng `ArmyPlan` thủ công `level 2, statMult 1.5` và bandit HP 30 → 30 × 1.45 × 1.5 = 65.25), `dmg` tương tự; `year` bằng `state.year`; hai lần gọi `toEqual`; không sửa `state` (`structuredClone` so sánh).
  - Công trình có `placedYear`/`uid` khác nhau giữ `uid` trong `StructureSetup`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/run/rewards.test.ts src/game/run/battleSetup.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement.** `buildBattleSetup`: Ngai = `plots[12].building` (card `ThroneDef`); công trình = mọi ô `building` ≠ null và `plot ≠ 12`, sắp theo `plot`; chỉ số lính = `UnitDef` cấp 1 (hồ sơ cấp = ×1 trong G1); tháp lấy `attack` từ effect `tower`, `slowPct/slowTicks` từ `onHit` loại `slow`; foe: duyệt `army.waves`, tra `content.unit(spawn.unit)`, nhân HP/DMG bằng `ENEMY_LEVEL_STAT[level−1] × statMult`. `rollOffers` theo §3.8 (xem Interfaces).

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/run/rewards.ts src/game/run/battleSetup.ts src/game/run/rewards.test.ts src/game/run/battleSetup.test.ts
git commit -m "feat(run): reward offers and BattleSetup builder"
```

---

### Task 10: Vòng năm và `applyCommand`

**Files:**
- Create: `src/game/run/yearFlow.ts`, `src/game/run/commands.ts`
- Modify: `src/game/testing/fixtures.ts` (thêm `runState(over?)`)
- Test: `src/game/run/commands.test.ts`

**Interfaces:**
- Consumes: Task 1–9.
- Produces:
  - `yearFlow.ts`: `newRun(seed: number, kingId: KingId, content: Content): RunState` (năm 1, `planning`, `lives 3`, 25 ô theo `initialPlots`, Ngai `uid 0` ở plot 12 với `cardId = king.throne.id`, `throneLevel 1`, `deck = [...START_DECK_G1]`, `rng = { draw: hashSeed(\`${seed}:draw\`), reward: hashSeed(\`${seed}:reward\`) }`, `nextUid 1`, `stats` 0, `won null`); `startYear(state: RunState, content: Content): RunState` (§5.5 bước 1,6: `year += 1`, `army = composeArmy(...)` từ roster Thổ Phỉ với `armyBudget(year, SLOT_MULT.raiders)`, `hand = drawHand(deck, Rng(rng.draw), handSize)` rồi lưu lại `rng.draw`, `played false`, `phase 'planning'`, `offers null`); `newRun` gọi `startYear` từ `year 0`.
  - `commands.ts`: `type RunEvent = { type: 'cardPlayed'; cardId: CardId } | { type: 'yearStarted'; year: number } | { type: 'battleEnded'; won: boolean } | { type: 'runEnded'; won: boolean }`; `type CommandResult = { state: RunState; events: RunEvent[] } | { error: IllegalReason }`; `applyCommand(state: RunState, cmd: RunCommand, content: Content): CommandResult` — thuần, không sửa `state`.
  - `fixtures.ts`: `runState(over?: Partial<RunState>): RunState` (= `newRun(1, 'wheat', CONTENT)` rồi ghi đè).

- [ ] **Step 1: Write the failing tests** (`commands.test.ts`)
  - `newRun(7,'wheat',CONTENT)`: `year 1`, `phase 'planning'`, `lives 3`, 9 ô mở, `plots[12].building.cardId === 'wheat_throne'`, `deck` bằng `START_DECK_G1`, `hand.length === 3` và mỗi bản có trong `deck`, `played false`, `army` khớp `composeArmy(...)` cho năm 1 (`budget 10`), cùng seed → `toEqual`, khác seed → khác `hand` hoặc `army` ít nhất 1 trong 10 seed.
  - `play` Dân Quân (`handIndex 0` là `wheat_militia` — dùng `runState({ hand: ['wheat_militia','neutral_barracks','neutral_move'] })`) lên plot 6: `plots[6].building` có `uid 1`, `level 1`, `placedYear` = năm; `nextUid 2`; `hand = []`; `played true`; `deck` không đổi; events chứa `cardPlayed`; `state` đầu vào không đổi (`structuredClone` trước/sau `toEqual`).
  - Khai Hoang lên plot 1 → `plots[1].unlocked true`; Dời Nhà `{first 7, second 6}` khi plot 7 có công trình → công trình sang 6; đích có công trình → đổi chỗ.
  - `skip` → `played true`, `hand []`.
  - Lỗi (state không đổi): `play` sau khi `played` → `alreadyPlayed`; `play` khi `phase 'battle'` → `wrongPhase`; `handIndex 5` và `−1` → `badTarget`; `startBattle` khi chưa chơi → `notPlayed`; `pickOffer` khi `planning` → `wrongPhase`; `pickOffer index 3` khi có 3 lựa chọn → `badTarget`; `advance` khi `planning` → `wrongPhase`; `battleResult` khi `planning` → `wrongPhase`; `play` ô khoá → `locked` v.v. (một dòng mỗi `IllegalReason` đã liệt kê ở Task 4 mà `applyCommand` có thể trả).
  - `startBattle` sau `skip` → `phase 'battle'`.
  - `battleResult` (dùng `BattleResult` mẫu): thắng năm 3 → `phase 'reward'`, `offers.cardIds.length === 3`, `stats.battlesWon 1`, `stats.kills` cộng; thua với 3 mạng → `lives 2`, `phase 'yearEnd'`, `offers null`, `stats.battlesLost 1`; `advance` từ `yearEnd` → `year + 1`, `phase 'planning'`, `hand.length 3`, `army` mới, `played false`; thua với `lives 1` → `phase 'ended'`, `won false`, `lives 0`, event `runEnded`; thắng năm 10 → `phase 'ended'`, `won true`, `offers null`.
  - `pickOffer 0` ở `reward` → thẻ được thêm vào `deck` (dài 12), sang năm kế (`phase 'planning'`, `year + 1`); `pickOffer null` → `deck` không đổi, sang năm kế; `rng.reward` thay đổi sau khi tạo lựa chọn.
  - Trọn vòng: chuỗi `play → startBattle → battleResult(thắng) → pickOffer → …` lặp 10 năm bằng `battleResult` thắng giả → năm 10 `ended` `won true`; hai lần chạy cùng chuỗi lệnh → `toEqual` từng bước.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/run/commands.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo §3.2, §3.10, §5.5; `applyCommand` làm việc trên `structuredClone(state)` và trả bản sao; bước thua: `lives − 1`; `lives === 0` → `ended`; thắng năm = `RULES_G1.years` → `ended`, `won true`, bỏ thưởng; thắng khác → `rollOffers` với `Rng(state.rng.reward)` rồi lưu lại. Thứ tự kiểm tra lỗi: pha (`wrongPhase`) → `alreadyPlayed`/`notPlayed` → chỉ số (`badTarget`) → `checkPlay`.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/run/yearFlow.ts src/game/run/commands.ts src/game/run/commands.test.ts src/game/testing/fixtures.ts
git commit -m "feat(run): newRun, year flow and applyCommand"
```

---

### Task 11: `GameEvents`, `BattleRunner` và `RunController`

**Files:**
- Create: `src/game/events.ts`, `src/game/battle/BattleRunner.ts`, `src/game/run/RunController.ts`
- Modify: `src/core/events.ts` (bỏ `GameEvents`, `createGameBus`), `src/core/events.test.ts` (không đổi nếu chỉ dùng `EventBus`)
- Test: `src/game/battle/BattleRunner.test.ts`, `src/game/run/RunController.test.ts`

**Interfaces:**
- Consumes: Task 5–10, `EventBus`, `SimClock`, `GameSpeed`.
- Produces:
  - `events.ts`: `interface GameEvents` gồm giữ nguyên `clock:speed`, `log`, `ui:set-speed`, `ui:toggle-pause` và thêm `'run:state': { state: RunState }`, `'run:illegal': { reason: IllegalReason }`, `'run:ended': { won: boolean; crownPoints: number; unlocks: string[] }`, `'battle:started': { setup: BattleSetup }`, `'battle:tick': { tick: number }`, `'battle:ended': { result: BattleResult }`, `'ui:command': { command: RunCommand }`, `'ui:select-card': { handIndex: number | null }`, `'ui:pending-play': { handIndex: number | null; targets: number[]; ready: boolean }`, `'ui:confirm-play': Record<string, never>`, `'ui:cancel-play': Record<string, never>`, `'ui:intervene': { x: number; y: number }`, `'ui:continue': Record<string, never>`, `'ui:open-modal': { modal: 'scout' }`, `'ui:close-modal': Record<string, never>`; `createGameBus(): EventBus<GameEvents>`.
  - `BattleRunner.ts`: `class BattleRunner { constructor(setup: BattleSetup, bus: EventBus<GameEvents>, clock?: SimClock); readonly world: BattleWorld; readonly clock: SimClock; update(deltaMs: number): void; intervene(x: number, y: number): void; get result(): BattleResult | null; dispose(): void }`. `update` chạy `clock.advance(deltaMs)` tick, mỗi tick gọi `stepBattle(world, pendingInputsForThisTick)`; phát `battle:tick` mỗi khi `world.tick % TICKS_PER_SECOND === 0`; khi `battleResult` ≠ null lần đầu phát `battle:ended` đúng một lần rồi ngừng chạy; nghe `ui:set-speed` / `ui:toggle-pause` (phát lại `clock:speed`) và `ui:intervene` (gọi `intervene`). `intervene` đẩy `{ tick: world.tick, x, y }` vào hàng chờ của tick kế tiếp được chạy.
  - `RunController.ts`: `class RunController { constructor(bus: EventBus<GameEvents>, content: Content, initial: RunState); get state(): RunState; get runner(): BattleRunner | null; update(deltaMs: number): void; dispose(): void }`. Nghe `ui:command` → `applyCommand`; lỗi → `run:illegal`; thành công → cập nhật `state`, phát `run:state`; sau `startBattle` thành công tạo `BattleRunner` từ `buildBattleSetup` và phát `battle:started`; nghe `battle:ended` (do runner phát) → tự áp `battleResult` (kết quả nằm trong payload của sự kiện, scene không cần giữ runner), đặt `runner = null`, phát `run:state`, và `run:ended` (`crownPoints 0`, `unlocks []`) khi `phase === 'ended'`. `update` chuyển tiếp cho `runner.update`.

- [ ] **Step 1: Write the failing tests**
  - `BattleRunner.test.ts` (bus giả = `createGameBus()`): `update(100)` ở tốc độ 1× chạy đúng 1 tick (`world.tick === 1`); `ui:toggle-pause` → `update(1000)` chạy 0 tick và phát `clock:speed {speed: 0}`; tốc độ 3× + `update(100)` → 3 tick; `battle:tick` phát khi `world.tick` chia hết 10 (đếm số lần sau 25 tick = 2 hoặc 3 tuỳ lúc đầu — khẳng định giá trị `tick` trong payload đều chia hết cho 10); `battle:ended` phát đúng một lần với `result` khớp `simulateBattle` cùng setup + cùng `inputs` (so `toEqual`); `intervene` khi đang tạm dừng ở tick 40 ghi `inputs[0].tick === 40`, và `ui:intervene` có tác dụng tương đương; sau `dispose` không còn nghe bus.
  - `RunController.test.ts`: `ui:command play` hợp lệ → `run:state` phát với `state.played true`; lệnh sai → `run:illegal` với đúng `reason` và `controller.state` không đổi; `startBattle` → `battle:started` có `setup.year === 1`, `controller.runner` ≠ null; chạy `update(100)` lặp đến khi `battle:ended` (giới hạn 1000 vòng) → `run:state` mới có `phase` ∈ `reward | yearEnd | ended`, `controller.runner === null`; ván thua hết mạng → phát `run:ended { won: false }`; `dispose` ngừng nghe.
  - Dùng `core/events.test.ts` hiện có (chỉ `EventBus`) vẫn pass sau khi bỏ `GameEvents`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/battle/BattleRunner.test.ts src/game/run/RunController.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement** theo §12.5 (với Quyết định 1). `core/events.ts`: xoá `GameEvents` và `createGameBus`, giữ `EventBus` + `Handler`; cập nhật import ở nơi dùng (hiện chưa file nào ngoài `core/events.ts`). Bus chỉ dùng trong `game`/`scenes`.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/events.ts src/game/battle/BattleRunner.ts src/game/run/RunController.ts src/game/battle/BattleRunner.test.ts src/game/run/RunController.test.ts src/core/events.ts
git commit -m "feat(game): GameEvents, BattleRunner and RunController"
```

---

### Task 12: Headless và bot `random`

**Files:**
- Create: `src/game/sim/headless.ts`, `src/game/sim/bots/random.ts`
- Test: `src/game/sim/headless.test.ts`

**Interfaces:**
- Consumes: Task 2, 4, 10 (`applyCommand`, `newRun`), Task 7 (`simulateBattle`), Task 9.
- Produces: `bots/random.ts`: `type Bot = (state: RunState, content: Content, rng: Rng) => RunCommand`; `randomBot: Bot` (planning: nếu có thẻ trên tay có ô hợp lệ thì chọn ngẫu nhiên một thẻ + một mục tiêu hợp lệ — duyệt mọi ô/cặp ô hợp lệ theo thứ tự tăng dần rồi `rng.pick` — ngược lại `skip`; đã chơi → `startBattle`; `reward` → `pickOffer` ngẫu nhiên (hoặc `null` 1/4 số lần); `yearEnd` → `advance`). `headless.ts`: `interface HeadlessOptions { seed: number; kingId: KingId; bot?: Bot }`; `interface HeadlessResult { state: RunState; commands: number }`; `runHeadless(opts: HeadlessOptions, content?: Content): HeadlessResult` (vòng lặp bot → `applyCommand`; khi `startBattle` thành công: `simulateBattle(buildBattleSetup(state), [])` rồi áp `battleResult`; dừng khi `phase === 'ended'`; ném lỗi nếu bot sinh lệnh bất hợp lệ hoặc vượt 5000 lệnh).

- [ ] **Step 1: Write the failing tests**: `runHeadless({ seed, kingId: 'wheat' })` với `seed ∈ {1, 2, 3}` đều kết thúc với `state.phase === 'ended'`, `state.year ≤ 10`, `stats.battlesWon + stats.battlesLost === state.year` (mỗi năm đúng một trận đã đánh), `lives ≥ 0`, không ném lỗi; cùng seed hai lần → `JSON.stringify(state)` bằng nhau; ít nhất một trong 10 seed khác nhau cho kết quả (`won` hoặc `stats.kills`) khác nhau; `randomBot` không bao giờ trả `{type:'play'}` bị `applyCommand` từ chối (chạy 20 seed, không ném lỗi).

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/game/sim < /dev/null` → FAIL.

- [ ] **Step 3: Implement.** Bot dùng `new Rng(hashSeed(\`${seed}:bot\`))` (trong `game`, được phép). Dùng `checkPlay` để liệt kê mục tiêu hợp lệ.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/game/sim
git commit -m "feat(sim): headless run driver and random bot"
```

---

### Task 13: Art placeholder sinh bằng code (thuần, có test)

**Files:**
- Create: `src/render/unitArt.ts`, `src/render/buildingArt.ts`, `src/render/plotArt.ts`, `src/render/fieldArt.ts`, `src/render/iconArt.ts`, `src/render/fxArt.ts`, `src/render/cardArt.ts`
- Modify: `src/render/uiArt.ts` (4 khung thẻ), `src/render/uiArt.test.ts` (bảng `CORE`)
- Test: `src/render/worldArt.test.ts`

**Interfaces:**
- Consumes: `PixelCanvas`, `paintBitmap`, `pixelHash`, `computeDualGrid`, `valueNoise2D`/`fractalNoise2D`, `PALETTE`, `UI_PALETTE`, `UnitDef`, `CardDef`.
- Produces:
  - `unitArt.ts`: `type UnitTeam = 'ally' | 'foe'`; `type UnitAnim = 'idle' | 'walk' | 'attack'`; `UNIT_FRAME_COUNT = 2`; `paintUnit(def: UnitDef, team: UnitTeam, anim: UnitAnim, frame: 0 | 1, cloth: number): PixelCanvas` (kích thước `def.sprite`; thân màu vải `cloth`, đầu ≈ 40% chiều cao, viền `PALETTE.outline` cho phe mình, `PALETTE.redDark` cho phe địch kèm 1 pixel cờ `PALETTE.red`; `frame 1` của `walk` nhún 1 px, của `attack` lệch 1 px sang phải; có bóng elip `PALETTE.shadow` alpha 128 ở chân); `unitCloth(def: UnitDef): number` (id tiền tố `wheat` → `PALETTE.wheat`, đơn vị trung lập → `PALETTE.blue`, Thổ Phỉ → `PALETTE.soil`; tra theo bảng `UNIT_CLOTH: Record<string, number>` khoá bằng `UnitId`).
  - `buildingArt.ts`: `BUILDING_SIZE = { w: 32, h: 40 }`, `THRONE_SIZE = { w: 32, h: 48 }`; `paintBuilding(kind: 'troop' | 'tower', accent: number): PixelCanvas`; `paintThrone(accent: number): PixelCanvas`.
  - `plotArt.ts`: `PLOT_SIZE = 32`; `paintPlot(state: 'open' | 'locked' | 'throne'): PixelCanvas`.
  - `fieldArt.ts`: `FIELD_TERRAINS = ['grass', 'flowers', 'path', 'sand', 'water'] as const` (thứ tự = ưu tiên tăng dần); `generateField(seed: number): Uint8Array` (24×24 chỉ số vào `FIELD_TERRAINS`; ô trong vùng bàn cờ `col,row ∈ 7..16` luôn là `grass` hoặc `flowers`); `paintFieldTile(terrain: number, mask: number, seed: number): PixelCanvas` (16×16); `paintField(seed: number): PixelCanvas` (384×384: lưới dữ liệu 24×24, `computeDualGrid`, vẽ 25×25 ô hiển thị rồi cắt lệch nửa ô).
  - `iconArt.ts`: `ICON_IDS = ['troop', 'tower', 'tome', 'throne', 'crown', 'boulder', 'skull'] as const`; `paintIcon(id): PixelCanvas` 16×16, chỉ `UI_PALETTE`.
  - `fxArt.ts`: `ARROW_DIRS = ['e','ne','n','nw','w','sw','s','se'] as const`; `paintArrow(dir): PixelCanvas` 8×8 (mỗi hướng vẽ riêng, không xoay); `arrowDir(dx: number, dy: number): (typeof ARROW_DIRS)[number]` (màn hình: y xuống; `|dy|×5 < |dx|×2` → ngang; `|dx|×5 < |dy|×2` → dọc; còn lại chéo; `(0,0)` → `'e'`); `paintBoulder(): PixelCanvas` 16×16; `paintBoulderShadow(): PixelCanvas` 24×8; `paintSpark(): PixelCanvas` 4×4; đều `PALETTE`.
  - `cardArt.ts`: `CARD_ART = { w: 32, h: 24 }`; `paintCardArt(def: CardDef, accent: number): PixelCanvas` (nền `meadow`/`leaf`, công trình/sách vẽ lên bằng `PALETTE`).
  - `uiArt.ts`: thêm `'card' | 'cardUncommon' | 'cardRare' | 'cardSelected'` vào `UI_FRAME_IDS` và `UI_FRAMES` (`w 24, h 32, slice 8, border 4`; `cardSelected` `border 5`); khung thường viền `wood`, vừa viền đôi `woodLight`, hiếm viền trong `gold`, chọn viền ngoài `select` 2 px, lõi `cream`.

- [ ] **Step 1: Write the failing tests** (`worldArt.test.ts`; helper `foreign(c, colors)` như `uiArt.test.ts`)
  - Mọi `paintUnit` cho từng `UnitDef` trong `CONTENT` (7 đơn vị + `ogre`…), đủ `team × anim × frame`: kích thước đúng `def.sprite`; chỉ chứa màu `PALETTE`; phe mình có ít nhất 1 pixel `PALETTE.outline` và không có `PALETTE.redDark`; phe địch có `PALETTE.redDark` và đúng 1 pixel `PALETTE.red`; `idle` frame 0 ≠ frame 1 (so `data`); ally ≠ foe; pixel đáy (hàng cuối) có bóng (alpha > 0) trong khung `idle`.
  - `paintBuilding('troop', c)` 32×40, `paintBuilding('tower', c)` 32×40, `paintThrone(c)` 32×48, `paintPlot` 3 trạng thái 32×32; chỉ `PALETTE`; hai trạng thái `open` ≠ `locked`.
  - `generateField(1)` dài 576, mọi phần tử < 5, ô `col,row ∈ 7..16` ∈ `{0,1}`; cùng seed bằng nhau, seed khác khác ít nhất 1 trong 10; `paintFieldTile` 16×16 cho mọi `terrain × mask 0..15` (không ném lỗi, chỉ `PALETTE`); `paintField(1)` 384×384, chỉ `PALETTE`, mọi pixel opaque (alpha 255), cùng seed bằng nhau.
  - `paintIcon` (7 id) 16×16, chỉ `UI_COLORS`; `paintArrow` 8 hướng 8×8, đôi một khác nhau, chỉ `PALETTE`; `arrowDir(1,0)='e'`, `(0,-1)='n'`, `(1,-1)='ne'`, `(-1,1)='sw'`, `(0,1)='s'`, `(1,0.3)='e'`, `(0.3,1)='s'`, `(0,0)='e'`; `paintBoulder` 16×16, `paintBoulderShadow` 24×8, `paintSpark` 4×4.
  - `paintCardArt` cho 7 thẻ 32×24, chỉ `PALETTE`.
  - `uiArt.test.ts` hiện có (lặp qua `UI_FRAME_IDS`): thêm `card*` vào bảng `CORE` (`UI_PALETTE.cream`); các test hiện có vẫn pass.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/render < /dev/null` → FAIL.

- [ ] **Step 3: Implement.** Placeholder đủ để phân biệt phe/loại, không cần đẹp (art thật thay sau qua tên frame, §11.4). `paintUnit` dùng `PixelCanvas.fillRect`/`fillEllipse`; công trình lính = nhà nhỏ mái `accent`, tháp = cột đá + chóp; Ngai = bệ đá + ngai `gold`. `generateField`: nền `grass`; `flowers` khi `fractalNoise2D(seed, …) > 0.72`; ao `water` quanh một tâm do `hashSeed`-ish lấy từ `valueNoise2D` nằm ngoài vùng bàn cờ, viền `sand`; vài ô `path` dọc cột/hàng giữa ngoài vùng bàn cờ. Mỗi ô terrain vẽ bằng `pixelHash` để có chi tiết ổn định.

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/render/unitArt.ts src/render/buildingArt.ts src/render/plotArt.ts src/render/fieldArt.ts src/render/iconArt.ts src/render/fxArt.ts src/render/cardArt.ts src/render/uiArt.ts src/render/uiArt.test.ts src/render/worldArt.test.ts
git commit -m "feat(art): placeholder world, unit, icon, fx and card art"
```

---

### Task 14: Atlas `sprites`, hàm `*Frame` và renderer thế giới

**Files:**
- Modify: `src/render/atlas.ts`
- Create: `src/render/FieldRenderer.ts`, `src/render/BoardRenderer.ts`, `src/render/UnitRenderer.ts`, `src/render/FxRenderer.ts`
- Test: `src/render/atlas.test.ts` (phần thuần: tên frame)

**Interfaces:**
- Consumes: Task 13, `BattleWorld`, `RunState`, `Content`.
- Produces (`atlas.ts`): `SPRITES_KEY = 'sprites'`; `buildSpritesTexture(textures: Phaser.Textures.TextureManager, content: Content): void` (một lần: mọi khung `unit_<id>_<team>_<anim><n>`, `building_<cardId>` (gồm Ngai), `plot_<state>`, `card_art_<cardId>`, `icon_<id>`, `fx_arrow_<dir>`, `fx_boulder`, `fx_boulder_shadow`, `fx_spark`); `fieldKey(seed: number): string` (`field-<seed>`); `ensureFieldTexture(textures, seed): string` (tạo nếu chưa có, xoá texture field cũ khi seed khác); các hàm thuần trả tên frame: `unitFrame(unit: UnitId, team: UnitTeam, anim: UnitAnim, n: number): string`, `buildingFrame(cardId: CardId): string`, `plotFrame(state: 'open'|'locked'|'throne'): string`, `cardArtFrame(cardId: CardId): string`, `iconFrame(id: IconId): string`, `fxFrame(name: string): string`.
- Produces (renderer, Phaser): 
  - `FieldRenderer(scene, seed)`: ảnh cánh đồng ở `(0,0)`, depth 0; `destroy()`.
  - `BoardRenderer(scene, content)`: `render(state: RunState): void` (ô, công trình đặt theo `plotCenter`, neo ở chân, depth = y chân); `setHighlights(map: ReadonlyMap<number, 'good' | 'bad'>): void` (viền `UI_PALETTE.good/bad` bằng `Graphics`, quản lý trong renderer); `setEdgeArrows(edges: readonly Edge[]): void` (mũi tên `UI_PALETTE.gold` ở mép); `plotAt(worldX: number, worldY: number): number | null`; `destroy()`.
  - `UnitRenderer(scene)`: `sync(world: BattleWorld, alpha: number): void` — mỗi thực thể một sprite (tạo khi `spawn`, ẩn khi `alive = 0` + hiệu ứng chết); vị trí nội suy `prev + (cur − prev) × alpha`; lật ngang theo hướng di chuyển/mục tiêu; hoạt ảnh idle/walk/attack theo trạng thái (2 frame, 6–8 fps đi/đứng, 10–12 fps đánh, lấy từ `scene.time.now`); thanh máu nhỏ (UI_PALETTE `good`/`bad`) cho Ngai, công trình và lính đã bị thương; depth = y chân; `destroy()`.
  - `FxRenderer(scene)`: `sync(world: BattleWorld, events: readonly BattleEvent[], alpha: number): void` — đạn từ pool (frame theo `arrowDir`), tia lửa `hit`, tảng đá rơi (bóng + tảng từ trên xuống trong `delayTicks`) và vòng nổ khi `impact`; `destroy()`.

- [ ] **Step 1: Write the failing tests** (`atlas.test.ts`, thuần): `unitFrame('militia','ally','walk',1) === 'unit_militia_ally_walk1'`; `buildingFrame('wheat_throne') === 'building_wheat_throne'`; `plotFrame('locked') === 'plot_locked'`; `cardArtFrame('neutral_barracks') === 'card_art_neutral_barracks'`; `iconFrame('crown') === 'icon_crown'`; `fieldKey(42) === 'field-42'`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/render/atlas.test.ts < /dev/null` → FAIL.

- [ ] **Step 3: Implement.** `buildSpritesTexture` dùng `packShelves` (atlas rộng 512) + `toCanvas` như `buildUiTexture`; frame lính: với mỗi `UnitDef` trong `CONTENT` (cả của Thổ Phỉ) đủ `team × anim × 2`. Renderer đọc Phaser 4 skills `sprites-and-images`, `cameras`, `graphics-and-shapes` (Graphics) trước khi dùng API; chỉ tham chiếu sprite bằng tên frame qua các hàm `*Frame`; không xoay (`setFlipX` được); depth = `y` chân; `BoardRenderer.plotAt` dùng `Math.floor((x − boardOrigin) / plot)`.

- [ ] **Step 4: Run to verify pass** — test thuần PASS; `npm run typecheck < /dev/null` và `npm run lint < /dev/null` exit 0 (renderer Phaser không có Vitest; kiểm bằng trình duyệt ở Task 16–18).

- [ ] **Step 5: Commit**

```bash
git add src/render/atlas.ts src/render/atlas.test.ts src/render/FieldRenderer.ts src/render/BoardRenderer.ts src/render/UnitRenderer.ts src/render/FxRenderer.ts
git commit -m "feat(render): sprites atlas, frame helpers and world renderers"
```

---

### Task 15: Bố cục thuần của Realm/HUD và `CardView`

**Files:**
- Create: `src/ui/realm/realmLayout.ts`, `src/ui/cards/CardView.ts`
- Test: `src/ui/realm/realmLayout.test.ts`

**Interfaces:**
- Consumes: `Rect`, `Size`, `Point`, `MARGIN`, `GAP`, `TOUCH_TARGET`, `SPEED_GAP` (`src/ui/hud/layout.ts`), `BATTLE`.
- Produces (`realmLayout.ts`, thuần):
  - `isDesktop(width: number): boolean` (`width ≥ 768`); `PLANNING_ZOOM = 2`; `battleZoom(width: number, height: number): number` = `max(1, floor(min(width, height + 96) / BATTLE.field))`.
  - `interface PlanningLayout { desktop: boolean; lives: Rect; year: Rect; board: Rect; scout: Rect; hand: readonly Rect[]; skip: Rect; fight: Rect; confirm: Rect; cancel: Rect }` và `planningLayout(screen: Size): PlanningLayout` theo §10.4 (chỉ phần G1): **desktop** — `lives` 120×52 tại `(MARGIN, MARGIN)`; `year` 160×52 giữa trên (`x = round((w − 160)/2)`, `y = MARGIN`); `board` 320×320 tâm `(640, 340)` cho 1280×720 (tổng quát: tâm `x = w/2`, `y = 340`, làm tròn); `scout` cột phải 260 px (`x = w − MARGIN − 260`, `y = 92`, cao tới y 520); `hand` 3 thẻ 120×168 cách 12, căn giữa ngang, `y = h − 168 − 10`; `skip` 140×52 bên trái tay bài; `fight` 200×56 căn giữa tại vùng tay bài. **mobile** — `lives` 96×48 tại `(MARGIN, MARGIN)`; `year` phần còn lại hàng 1 (`x = MARGIN + 96 + GAP`, rộng tới `w − MARGIN`, cao 48); `board` 320×320 tại `y = 124`, giữa ngang (`x = round((w − 320)/2)`); `scout` tóm tắt `x = MARGIN`, `y = 508`, rộng `w − 2·MARGIN`, cao 134; `hand` 3 thẻ 108×152 cách 8, căn giữa, `y = h − 152 − 10`; `skip` 84×48 tại hàng `y = 452` bên phải; `fight` 200×56 căn giữa vùng tay bài; `confirm`/`cancel` 48×48 phía trên bàn cờ (mobile) / cạnh ô được chọn (desktop dùng `confirmFor(layout, plotRect)`).
  - `plotScreenRect(layout: PlanningLayout, plot: number): Rect` (ô màn hình 64×64: `x = board.x + col × 64`, `y = board.y + row × 64`).
  - `confirmFor(layout: PlanningLayout, plotRect: Rect, screen: Size): { confirm: Rect; cancel: Rect }` (cạnh phải ô, lật sang trái nếu tràn; mobile: hàng trên bàn cờ).
  - `interface BattleLayout { clock: Rect; lives: Rect; foes: Rect; speed: readonly Rect[]; intervene: Rect }` và `battleLayout(screen: Size): BattleLayout` theo §10.7: `clock` 260×52 giữa trên; `lives` như planning; `foes` góc phải trên (rộng 140, cao 52); `speed` 4 nút 48×48 cách `SPEED_GAP` ở góc trái dưới; `intervene` 72×72 góc phải dưới (cách mép `MARGIN`).
  - `cameraScroll(world: Point, target: Point, screen: Size, zoom: number): Point` (scroll để điểm thế giới `world` hiện ở `target` trên màn hình, với camera zoom quanh tâm màn hình: `scroll = world − mid − (target − mid)/zoom`, `mid = screen/2`); `screenToWorld(p: Point, scroll: Point, screen: Size, zoom: number): Point` (nghịch đảo).
- Produces (`CardView.ts`, Phaser): `class CardView { constructor(scene: Phaser.Scene, content: Content, size: Size); setCard(cardId: CardId | null, opts?: { levelUp?: boolean }): void; setSelected(selected: boolean): void; setDimmed(dimmed: boolean): void; setPosition(x: number, y: number): void; onClick(handler: () => void): void; readonly container: Phaser.GameObjects.Container; destroy(): void }` — khung `card`/`cardUncommon`/`cardRare` theo độ hiếm (`cardSelected` khi chọn), băng tên, tranh `card_art_<id>` (nhân 3 desktop / 2 mobile theo `size`), icon loại, dòng đầu `describeCard` tối đa 2 dòng cắt `…` bằng `ellipsize`; bấm giữ/hover hiện tooltip đầy đủ qua `Tooltip` (dùng `bindPress`).

- [ ] **Step 1: Write the failing tests** (`realmLayout.test.ts`)
  - Desktop 1280×720: `lives = {x:10,y:10,w:120,h:52}`; `year = {x:560,y:10,w:160,h:52}`; `board = {x:480,y:180,w:320,h:320}`; `scout.x === 1010`, `scout.w === 260`; `hand[0] = {x:448,y:542,w:120,h:168}`, `hand[2].x === 448 + 2×132`; `fight` rộng 200 cao 56.
  - Mobile 375×812: `lives = {x:10,y:10,w:96,h:48}`; `year.x === 110`, `year.x + year.w === 365`; `board = {x:28,y:124,w:320,h:320}`; `hand[0] = {x:18,y:650,w:108,h:152}`, `hand[1].x === 134`; `scout = {x:10,y:508,w:355,h:134}`.
  - Với hai kích thước trên: mọi `Rect` (lives, year, board, scout, hand, skip, fight) nằm trọn trong màn hình; mọi nút (`skip`, `fight`, `confirm`, `cancel`) ≥ 44×44; không hai trong {lives, year, board, scout, hand[0..2], skip} chồng lên nhau (trừ `fight` đè lên vùng tay bài vì hiện thay thế — loại `fight` khỏi kiểm tra chồng).
  - `battleZoom(1280,720) === 2`; `battleZoom(375,812) === 1`; `battleZoom(1920,1080) === 2`; `battleZoom(100,100) === 1`.
  - `battleLayout(1280,720)`: `speed` 4 nút 48×48 cách 2; `intervene` 72×72 với `x + w = 1270`, `y + h = 710`; mọi rect trong màn hình, không chồng; `battleLayout(375,812)` tương tự.
  - `cameraScroll`/`screenToWorld` là nghịch đảo: với `world (192,192)`, `target (640,340)`, `screen 1280×720`, `zoom 2` → `screenToWorld(target, scroll, …)` ≈ `world` (sai số < 1e-9); `plotScreenRect(desktop, 12)` = `{x:608,y:308,w:64,h:64}` và ô 0 ở góc trên-trái bàn cờ; `confirmFor` nằm trong màn hình ở cả hai kích thước với ô ở mép phải/trái bàn cờ.

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/ui/realm < /dev/null` → FAIL.

- [ ] **Step 3: Implement.** Làm tròn bằng `Math.round`. Đọc skills `scale-and-responsive`, `cameras`, `text-and-bitmaptext`; kiểm tra công thức `cameraScroll` bằng trình duyệt ở Task 16 (nếu Phaser 4 khác → sửa công thức **và** test cùng lúc, giữ tính nghịch đảo).

- [ ] **Step 4: Run to verify pass**, rồi bộ kiểm tra đầy đủ.

- [ ] **Step 5: Commit**

```bash
git add src/ui/realm src/ui/cards
git commit -m "feat(ui): realm/battle HUD layout and CardView"
```

---

### Task 16: `RealmScene` và `PlanningHudScene` (lập kế hoạch, Trinh sát, thưởng)

**Files:**
- Create: `src/scenes/RealmScene.ts`, `src/scenes/PlanningHudScene.ts`, `src/ui/planning/ScoutPanel.ts`, `src/ui/planning/HandView.ts`, `src/ui/modals/RewardModal.ts`
- Modify: `src/scenes/keys.ts` (`realm`, `planningHud`, `battleHud`, `runEnd`)

**Interfaces:**
- Consumes: Task 11 (`createGameBus`, `RunController`), Task 14–15, `UI_PALETTE`.
- Produces:
  - `RealmScene` (key `SCENES.realm`, launch data `{ seed: number }`): `create()` đặt lại mọi trường; tạo `bus`, `RunController(newRun(seed,'wheat'))`, `ensureFieldTexture`, `FieldRenderer`, `BoardRenderer`, `UnitRenderer`, `FxRenderer`, camera zoom `PLANNING_ZOOM` đặt bằng `cameraScroll`; launch `PlanningHudScene` với launch data `{ bus, controller }`; `update(_, delta)` gọi `controller.update(delta)` và, khi có `runner`, `unitRenderer.sync(world, clock.alpha)` + `fxRenderer.sync(world, drainEvents(world), clock.alpha)`; nghe `run:state`: `planning` → `boardRenderer.render(state)`, camera zoom 2 quanh bàn cờ, `setEdgeArrows(các mép của đợt trong state.army)`; `battle:started` → camera `battleZoom` tâm ở Ngai, ẩn `plot` highlights, launch `BattleHudScene` (Task 17) và dừng `PlanningHudScene`; nghe `ui:select-card` → `setHighlights` ô hợp lệ `good`/không hợp lệ `bad` bằng `checkPlay`; nghe `ui:continue` → theo `controller.state.phase`: `reward` → launch lại `PlanningHudScene` (hiện `RewardModal`); `yearEnd` → `bus.emit('ui:command', {command:{type:'advance'}})` rồi launch `PlanningHudScene`; `ended` → `scene.start(SCENES.runEnd, { state })`. Khi `scene` shutdown: `controller.dispose()`, huỷ renderer, `bus.clear()`.
  - `PlanningHudScene` (key `SCENES.planningHud`, launch data `{ bus, controller }`): panel Mạng (`icon_crown` × số), Năm "Năm N / 10", `ScoutPanel` (đợt: tick xuất hiện, mũi tên mép, icon lính × số, cấp; tên "Thổ Phỉ"; desktop panel cột phải, mobile tóm tắt bấm mở bảng đầy đủ `ui:open-modal scout`), tay bài (`HandView` = 3 `CardView`, phím 1/2/3), chọn thẻ → `ui:select-card`; bấm ô: click vào ô được xử lý ở `RealmScene` (qua `boardRenderer.plotAt`), không ở HUD; `RealmScene` giữ `pendingPlay { handIndex: number; targets: number[] }` (1 ô, hoặc 2 ô cho Dời Nhà), phát `ui:pending-play` mỗi khi nó đổi, và chỉ gửi `ui:command play` khi nhận `ui:confirm-play`; nhận `ui:cancel-play` thì xoá `pendingPlay` và phát `ui:select-card { handIndex: null }`; HUD vẽ ✓/✕ tại `confirmFor(layout, plotScreenRect(layout, targets.at(-1)), screen)` khi `ready`; nút "Bỏ lượt" (S) gửi `skip`; sau khi chơi/bỏ lượt tay bài thu lại và nút **Ra trận** (Enter) gửi `startBattle`; ✓ Đặt / ✕ Huỷ 48×48 (Enter/Esc) theo `confirmFor`; thẻ hai mục tiêu (Dời Nhà): chọn lần lượt, dòng hướng dẫn trong hộp `tooltip`; `RewardModal` khi `state.phase === 'reward'`: tiêu đề "Phần thưởng — chọn 1 thẻ", 3 `CardView` (150×210 desktop; 108×152 mobile), nút **Nhận** và **Bỏ qua** (gửi `pickOffer` index/`null`); mọi nút ≥ 44×44; `layout()` tính lại khi `scale.on('resize')` bằng `planningLayout`.
  - Tooltip ô không hợp lệ: hover/bấm giữ ô đỏ hiện lý do tiếng Việt từ `IllegalReason` (bảng `ILLEGAL_TEXT: Record<IllegalReason, string>` trong `PlanningHudScene.ts`: `locked` "Ô chưa mở.", `throne` "Không thể đặt lên Ngai.", `occupied` "Ô đã có công trình.", `noBuilding` "Ô này chưa có công trình.", `noTarget` "Không còn mục tiêu hợp lệ.", `notAdjacent` "Ô phải kề một ô đã mở.", `wrongPhase` "Lúc này chưa dùng được.", `alreadyPlayed` "Năm nay bạn đã chơi thẻ.", `notPlayed` "Hãy chơi thẻ hoặc bỏ lượt trước.", `badTarget` "Mục tiêu không hợp lệ.").

- [ ] **Step 1: Build/verify scaffolding** (không có Vitest cho scene): thêm các khoá vào `SCENES`; đăng ký `RealmScene`, `PlanningHudScene` trong `main.ts` (BattleHud/RunEnd ở Task 17). Đọc skills `scenes`, `input-keyboard-mouse-touch`, `cameras` trước khi code.

- [ ] **Step 2: Implement** theo khối Interfaces; mọi chuyển trạng thái đi qua `bus` (`ui:command`), scene chỉ đọc `controller.state`. Dùng `createPanel`/`createButton`/`Tooltip`; vùng chạm ≥ 44; chữ `FONT_UI` tiếng Việt.

- [ ] **Step 3: Verify bằng lệnh** — `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0.

- [ ] **Step 4: Verify trong trình duyệt** (`npm run dev < /dev/null`, `preview_start`): vào `RealmScene` trực tiếp bằng `window.game.scene.start('Realm', { seed: 1 })` ở **1280×720** và **375×812** (`preview_resize`): chụp màn hình; kiểm bằng `preview_inspect`/`preview_eval` rằng không chữ đè/tràn, mọi nút ≥ 44×44 (đo `getBounds` của các nút), bàn cờ đúng `planningLayout().board`; chơi một thẻ lên một ô (chọn thẻ → ô viền xanh → ✓) rồi "Ra trận" gửi `startBattle` (trận hiển thị ở Task 17); console không lỗi (`preview_console_logs level error`).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/RealmScene.ts src/scenes/PlanningHudScene.ts src/scenes/keys.ts src/ui/planning src/ui/modals src/main.ts
git commit -m "feat(scenes): realm and planning HUD with scout and reward"
```

---

### Task 17: `BattleHudScene`, `RunEndScene` và menu "Ván mới"

**Files:**
- Create: `src/scenes/BattleHudScene.ts`, `src/scenes/RunEndScene.ts`
- Modify: `src/scenes/MainMenuScene.ts`, `src/main.ts`

**Interfaces:**
- Consumes: Task 11, 15–16, `battleLayout`, `screenToWorld`, `cameraScroll`, `INTERVENTION`.
- Produces:
  - `BattleHudScene` (key `SCENES.battleHud`, launch data `{ bus, controller }`) theo §10.7: `panel` 260×52 giữa trên với đồng hồ "m:ss" (từ `battle:tick`) + thanh HP Ngai (`bar` frame, đọc `controller.runner.world`); trái trên Mạng; phải trên "Địch còn: N" + 3 chấm đợt (đợt đã xuất hiện tô `gold`); 4 nút tốc độ ❚❚/1×/2×/3× 48×48 (`ui:set-speed`; phím P = `ui:toggle-pause`, 1–3 = tốc độ); nút **Can Thiệp** tròn 72×72 phủ tối từ dưới lên theo hồi chiêu (`readyTick − world.tick`) kèm số giây còn lại; bấm → chế độ ngắm (vòng `UI_PALETTE.gold` bán kính `INTERVENTION.radius × battleZoom` theo con trỏ) → bấm cánh đồng = `ui:intervene` với toạ độ thế giới bằng `screenToWorld`; bấm lại nút = huỷ; kéo từ nút ra cánh đồng = thả; Space/B bật ngắm; ngắm được khi đang tạm dừng; toast "Quân địch nổi cơn cuồng nộ!" khi `RealmScene` thấy sự kiện `rage` (mỗi frame `RealmScene.update` gọi `drainEvents(world)` đúng một lần, đưa danh sách cho `FxRenderer` và, nếu có `rage`, phát `bus.emit('log', { text })`; HUD nghe `log` để hiện toast); khi `battle:ended`: băng "Chiến thắng!"/"Ngai thất thủ!" 1.2 s rồi bảng tổng kết (số địch hạ `result.kills`, mạng còn, thời gian) + nút **Tiếp tục** gửi `ui:continue`.
  - `RunEndScene` (key `SCENES.runEnd`, data `{ state: RunState }`) theo §10.8 phần G1: `panel` lớn: "Chiến thắng!"/"Vương quốc sụp đổ", "Năm đạt được N / 10", số trận thắng/thua, địch đã hạ; nút **Về menu** (→ `SCENES.mainMenu`) và **Ván mới** (→ `SCENES.realm` với seed mới); `layout()` tính lại khi resize; mọi nút ≥ 44×44.
  - `MainMenuScene`: `MENU_ENTRIES` có "Ván mới" **bật** → `scene.start(SCENES.realm, { seed })` với `seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0` (cho phép trong `scenes`); bỏ "— Sắp có".
  - `main.ts`: danh sách scene thêm `RealmScene, PlanningHudScene, BattleHudScene, RunEndScene`.

- [ ] **Step 1: Implement** theo khối Interfaces (không có Vitest cho scene); phần pure đã được test ở Task 15 (`battleLayout`, `screenToWorld`).

- [ ] **Step 2: Verify bằng lệnh** — bộ kiểm tra đầy đủ exit 0.

- [ ] **Step 3: Verify trong trình duyệt** (cả 1280×720 và 375×812): từ menu bấm "Ván mới" → chơi một thẻ → "Ra trận": lính phe mình xuất ở các ô, địch vào từ mép khớp mũi tên Trinh sát (so danh sách `controller.state.army` với đơn vị thực tế xuất hiện: đếm theo mép/đợt bằng `preview_eval` trên `game.scene.getScene('Realm')`), tháp bắn, tốc độ ❚❚/1×/2×/3× hoạt động, Can Thiệp: nút tối đến tick 30, ngắm + thả gây sát thương (`world.interventionsUsed === 1`), hồi chiêu hiển thị; cuối trận băng "Chiến thắng!" rồi **Tiếp tục** → Thưởng → chọn thẻ → năm kế; console không lỗi; vùng chạm của mọi nút ≥ 44×44 (`getBounds`).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BattleHudScene.ts src/scenes/RunEndScene.ts src/scenes/MainMenuScene.ts src/main.ts
git commit -m "feat(scenes): battle HUD, run end screen and playable New Game"
```

---

### Task 18: Kiểm tra toàn bộ G1 và cập nhật tài liệu

**Files:**
- Modify: `docs/ROADMAP.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Bộ kiểm tra đầy đủ** — `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit 0 (ghi lại số test pass).

- [ ] **Step 2: Chơi trọn ván (Done khi của G1)** trong trình duyệt ở 1280×720 **và** 375×812: một ván **thắng** 10 năm (dùng `preview_eval` để chọn seed dễ — ví dụ thử seed đến khi bot `random` headless thắng, rồi chơi tay seed đó) và một ván **thua** (đặt `lives` = 1 qua `controller` hoặc chọn seed khó, chơi không đặt công trình) kết thúc ở `RunEndScene`; mỗi năm so khớp bản xem trước Trinh sát với đạo quân xuất hiện thực tế (tổng số, mép, loại); chụp màn hình: planning, battle, reward, run end ở cả hai bố cục; không chữ đè/tràn; console không lỗi.

- [ ] **Step 3: Headless** — chạy một script tạm (`npx tsx` hoặc test Vitest tạm) `runHeadless` cho seed 1, 2, 3: hoàn thành 3 ván không lỗi; xoá script tạm. Xác nhận test deterministic (`determinism.test.ts`) và benchmark (`benchmark.test.ts`) nằm trong `npm test` và pass.

- [ ] **Step 4: Ghi chú ESLint** — tạo file tạm `src/game/tmp-lint.ts` chứa `import Phaser from 'phaser'; export const r = Math.random();` → `npm run lint < /dev/null` phải báo lỗi cả hai dòng; xoá file.

- [ ] **Step 5: Cập nhật tài liệu.** `docs/ROADMAP.md`: thêm cột/dòng trạng thái "G0 ✔ · G1 ✔" (chỉ ghi G1 xong khi Step 1–4 đều đạt); `CLAUDE.md`: kiến trúc — `src/game` nay có `run/`, `cards/`, `battle/`, `sim/`, `testing/`; `GameEvents` ở `src/game/events.ts` (core chỉ có `EventBus`), cách chạy headless (`runHeadless`), `src/platform` và `src/audio` vẫn chưa tạo; `README.md`: mô tả G1 chơi được ("Ván mới" → Vua Lúa Mì, 10 năm). Không sửa spec.

- [ ] **Step 6: Commit**

```bash
git add docs/ROADMAP.md CLAUDE.md README.md
git commit -m "docs: mark G1 playable core done and update architecture notes"
```

---

## Self-Review

**1. Spec coverage (G1 §14):** luật ván G1 (Task 1, 10) · nội dung Vua Lúa Mì + 4 trung lập + Thổ Phỉ (Task 2) · bộ bài khởi đầu cố định (Task 1, 10) · thưởng 3 lựa chọn theo §3.8 (Task 9–10) · `RunState` + `applyCommand` với `play/skip/startBattle/battleResult/pickOffer/advance` (Task 4, 10) · vòng năm §5.5 (Task 10) · `composeArmy` (Task 3) · trận §8 trừ boss (Task 5–8) · can thiệp §7.4 (Task 8) · mạng §3.10 (Task 10) · `RealmScene`/`PlanningHudScene`/`BattleHudScene`/`RunEndScene` (Task 16–17) · "Ván mới" vào thẳng Vua Lúa Mì seed ngẫu nhiên (Task 17) · art placeholder (Task 13–14) · headless + bot `random` (Task 12) · test deterministic §13.2 + benchmark (Task 8) · "Done khi" (Task 18). Xem trước đạo quân khớp: kiểm ở Task 17 Step 3 và Task 18 Step 2. Ngoài G1 có chủ đích: gold, cấp, Bùa, lân cận, đổi bài, bộ bài/lịch UI, boss, lưu ván.

**2. Step scan:** mỗi task có test (tên + giá trị spec) hoặc, với scene/renderer Phaser không có Vitest, bước kiểm bằng lệnh + trình duyệt với tiêu chí đo được. Các thuật toán chưa quyết định bởi chữ ký đã nêu cách làm (một dòng).

**3. Type consistency:** `Edge`/`ArmyPlan` (Task 3) → `WaveSetup.spawns[].edge`/`StructureSetup` (Task 5) → `buildBattleSetup` (Task 9); `BattleResult` (Task 5) dùng ở `RunCommand.battleResult` (Task 4) và `GameEvents['battle:ended']` (Task 11); `IllegalReason` (Task 4) khớp bảng `ILLEGAL_TEXT` (Task 16); `Content` (Task 2) truyền qua `applyCommand`/`buildBattleSetup`/`RunController`; `*Frame` helpers (Task 14) dùng bởi renderer và `CardView`.

**4. Review Focus:** (1) Task 10; (2) Task 4; (3) Task 3; (4) Task 5; (5) Task 7–8 — mỗi mục đều có test trong task sở hữu.

**5. Proportion:** plan dài hơn spec G1 nhờ giữ test dưới dạng giá trị cụ thể; không chép thân hàm; code block chỉ cho chữ ký/lệnh.
