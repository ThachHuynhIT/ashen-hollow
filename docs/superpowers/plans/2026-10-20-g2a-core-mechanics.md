# G2a — Cơ chế lõi (cấp, vàng, Bùa, sách phép, lịch 2 vua, chinh phục) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng toàn bộ luật ván của G2 ở tầng `src/game` + `src/data` (không Phaser): vàng, đổi bài, mua ô, cấp, Bùa, sách phép, bộ máy tính chỉ số, lịch 15 năm với 2 vua địch, chinh phục, bot headless cập nhật. Nội dung 3 vua và mở rộng trận nằm ở G2b; giao diện ở G2c.

**Architecture:** Mở rộng kiểu dữ liệu (`src/data/types.ts`) và `RunState`, thêm các hàm thuần theo từng luật (calendar, income, enchant/level/sacrifice trên bàn cờ, bộ gộp modifier §5.3) rồi nối vào `applyCommand` và `buildBattleSetup`. Mọi test dùng thẻ giả dựng trong `src/game/testing/fixtures.ts`, không phụ thuộc nội dung thật của G2b. Hiệu ứng riêng của từng thẻ (`custom`) chỉ có khung đăng ký ở đây; từng handler được viết cùng thẻ ở G2b.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`) · Vitest · ESLint (luật deterministic).

**Spec:** `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` §3.1–3.8, §3.10–3.11, §4, §5.1–5.5, §6.0, §14 (G2). **Điều kiện đầu vào:** Phần A của `docs/superpowers/plans/2026-10-20-g2-depth.md` đã xong (chồng rút/bỏ, `discard`, `setAutoFire`, `RULES_G1.autoStart`, spec đã sửa ở Task A0).

## Global Constraints

- Deterministic (§8.12): trong `src/game`, `src/data`, `src/core` chỉ dùng `+ − × ÷` và `Math.sqrt/floor/ceil/round/min/max/abs`; cấm `Math.random`, `Date`, `performance`, `**`, `Math.pow`. `Rng` chỉ ở tầng ván: luồng `'draw'`, `'reward'`, `'calendar'` (mỗi luồng `new Rng(hashSeed(\`${seed}:${stream}\`))`, trạng thái ở `RunState.rng`) và `'army'` (`hashSeed(\`${seed}:army:${year}\`)`). Không để thứ tự `Map`/`Set` quyết định kết quả.
- Lớp: `src/game`/`src/data`/`src/core` không import `phaser`, `scenes`, `render`, `ui`; `src/data` không import `src/game`.
- Mọi hằng số gameplay ở `src/data/*`; mọi con số trong plan này lấy nguyên văn từ spec đã nêu.
- Hàm thuần: `applyCommand` và mọi hàm bàn cờ trả bản mới, không sửa đầu vào (test bằng `structuredClone` trước/sau).
- G2 **không** có: perk, độ khó Gai, hội đồng/sắc lệnh, nhiệm vụ, boss, `yearStart` phase, vua Du Mục (`freeMoves`), cây tăng trưởng theo tuổi (`ageBonus`), `counters`, `movedYear`. Các trường đó của `BuildingState`/`RunState` trong spec §5.1 để lại cho G3/G4.
- Cuối **mọi** task: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit 0. Commit bằng `git add` từng đường dẫn; message kết thúc bằng dòng trống rồi `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Quyết định (của plan này; spec im lặng hoặc cần chốt)

1. **Quy tắc ván nằm trong `RunState.rules`** (`{ years, calendar, autoStart }`), thay cho tham số `rules` của `RunController` ở Phần A (xóa tham số đó, đọc `state.rules.autoStart`). `newRun(seed, kingId, content, rules = RULES_G2)`.
2. **`discard` (bán bài) trả `RUN.skipPlayGold` (2 vàng)** và vẫn bỏ đúng một lá; đây là cách hiện thực "Bỏ lượt (+2)" của spec §3.2 trong mô hình giữ bài. *(Quyết định của tôi; đảo lại nếu bạn không muốn bán bài lấy vàng.)*
3. **`reroll`:** bỏ cả tay vào `discardPile` rồi `refillHand` đủ `handSize`; trả `rerollCost(rerollsThisYear + 1)`; không đổi được sau khi đã `played`.
4. **Hai vua địch của G2** = hai vua còn lại trong {`wheat`,`stone`,`arcane`} sau khi bỏ vua người chơi; thứ tự K1/K2 bằng xáo `Rng('calendar')`.
5. **Mở rộng union của §5.1** (ghi vào spec ở Task 1): `EffectDef` thêm `{ type: 'goldPerNeighbour'; cardId; amount: Scalar }`; `StatKey` thêm `'gold'`; `stat.mode` thêm `'flatPost'` (cộng sau mọi %, dùng cho Bùa Tia Lửa); `OnHitDef` thêm `stun` và `rampSameTarget`.
6. Quy tắc `armor`: với công trình `troop` là giáp của lính sinh ra, với `tower`/`support`/`economy`/Ngai là giáp của chính công trình. `hp` luôn là HP lính; `structureHp` là máu công trình.
7. Mỗi công trình lên cấp bằng "chơi trùng" chỉ khi cùng `CardId` và cấp < 5; thẻ Ngai không bao giờ vào tay.

## Review Focus

1. Chơi trùng ở cấp 5, Bùa quá `maxEnchantStacks`, Bùa lên công trình sai loại, sách phép không có mục tiêu → mỗi cái trả đúng `IllegalReason` và không đổi state (Task 5).
2. Vàng không đủ cho `reroll`/`unlockPlot` → `notEnoughGold`, vàng không âm; vàng chính xác tới đơn vị sau chuỗi tax → income → thắng → bán bài (Task 4).
3. Mercenary camp khi không đủ vàng trả phí → không sinh lính năm đó, không đưa vàng xuống âm (Task 4, 6).
4. Lịch: không vua nào tấn công hai lần cách nhau < 3 năm; vua người chơi không bao giờ là vua địch; cùng seed cùng lịch (Task 2).
5. Chinh phục: lần tấn công thứ 3 thắng → đúng 3 thẻ khác nhau từ 9 thẻ vua bại trận (không gồm Ngai), phải chọn (`pickOffer null` bị từ chối); thua lần 3 → `fled`, không chinh phục (Task 7).

---

### Task 1: Kiểu dữ liệu, hằng số ván và hồ sơ cấp

**Files:**
- Modify: `src/data/types.ts`, `src/data/run.ts`, `src/data/scaling.ts`, `src/data/battle.ts` (chỉ nếu cần xuất `ENEMY_BUDGET` đã có)
- Create: `src/data/rules.ts` (`Rules`, `RULES_G1`, `RULES_G2`)
- Modify (spec): `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` — ghi các mở rộng của Quyết định 5 vào §5.1
- Test: `src/data/run.test.ts`, `src/data/scaling.test.ts`

**Interfaces:**
- Produces: các kiểu `Scalar`, `Scope`, `Filter`, `StatKey`, `StatMode = 'flat' | 'pct' | 'flatPost'`, `EffectDef` đầy đủ cho G2 (`spawn`, `tower`, `pulse`, `gold`, `goldPerNeighbour`, `stat`, `taunt`, `shieldPulse`, `custom`), `OnHitDef` (`slow`, `stun`, `rampSameTarget`), `AttackSpec` (+`splash`, `chain`), `UnitBehaviourDef` (`deathSpawn`), `UnitDef.behaviours?`, `BuildingCardDef.kind` mở thêm `'economy' | 'support'`, `EnchantCardDef`, `TomeTarget` đầy đủ (`'none' | 'building' | 'buildingThenPlot' | 'buildingThenBuilding' | 'lockedPlot' | 'emptyPlot'`), `TomeAction` (`levelUp`, `unlockPlot`, `move`, `sacrifice`, `custom`), `CustomEffectId` (union đóng), `BannerDef { id; nameVi; textVi; effects: BannerEffect[] }` với `BannerEffect = { type: 'enemyCostPct'; pct } | { type: 'enemyStat'; stat: 'hp' | 'speed'; pct } | { type: 'enemyShieldPct'; pct }`, `KingDef.banner`.
- Produces: `RUN` đủ trường G2 (`years`, `startLives`, `maxLives`, `startGold: 5`, `taxPerYear: 3`, `handSize`, `skipPlayGold: 2`, `skipRewardGold: 3`, `conquestGold: 5`, `maxLevel: 5`, `maxEnchantStacks: 4`) và `battleGold(year)`, `rerollCost(n)`, `unlockCost(k)` đúng §3.1; `Rules = { years: number; calendar: 'raiders' | 'short'; autoStart: boolean }`, `RULES_G1`, `RULES_G2 = { years: 15, calendar: 'short', autoStart: false }`; `SLOT_MULT.kingAttack = [0.9, 1.0, 1.2]` (đã có `raiders`); hồ sơ `TROOP_STD`, `TOWER_STD`, `STRUCT_STD`, `THRONE_STD` (`PerLevel` theo §5.2), `TOWER_RANGE = [0, 4, 8, 12, 16]`, `levelMult(profile: PerLevel, level: Level): number`.

- [ ] **Step 1: Viết test thất bại:** `battleGold(1) = 3`, `battleGold(10) = 6`, `battleGold(30) = 12`; `rerollCost(1..4) = 1, 2, 4, 8`; `unlockCost(0) = 4`, `unlockCost(15) = 34`; `levelMult(TROOP_STD, 3) = 1.5`, `levelMult(TOWER_STD, 5) = 2.4`, `TOWER_RANGE[4] = 16`; `RULES_G2.years = 15`, `RULES_G2.autoStart = false`, `RULES_G1.autoStart = true`.
- [ ] **Step 2: Chạy `npm test < /dev/null -- src/data`**, thấy FAIL.
- [ ] **Step 3: Cài đặt** theo Interfaces; chuyển `RULES_G1` sang `src/data/rules.ts` (giữ re-export ở `run.ts` để không vỡ import cũ, rồi sửa import); các union cũ chỉ được thêm, không đổi nghĩa (typecheck phải sạch với mã G1). Ghi Quyết định 5 vào spec §5.1.
- [ ] **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(data): G2 types, run constants, level scaling profiles`.

### Task 2: Trạng thái ván G2 và lịch 15 năm

**Files:**
- Modify: `src/game/run/state.ts`, `src/game/run/yearFlow.ts`, `src/game/run/RunController.ts`, `src/game/run/board.ts` (`initialPlots` giữ nguyên)
- Create: `src/game/run/calendar.ts`
- Test: `src/game/run/calendar.test.ts`, `src/game/run/commands.test.ts`

**Interfaces:**
- Produces: `RunState` thêm `rules: Rules`, `gold: number`, `rerollsThisYear: number`, `purchasedPlots: number`, `enemyKings: readonly KingId[]` (độ dài 2), `enemies: Partial<Record<KingId, { attacks: number; status: 'pending' | 'conquered' | 'fled' }>>`, `stats` thêm `goldEarned: number` và `conquered: number`; `RunState.idleUids: number[]` (uid công trình không trả được phí duy trì năm nay, xóa và tính lại mỗi `startYear`); `BuildingState` thêm `enchants: { cardId: CardId; stacks: number }[]` và `permanent: Partial<Record<StatKey, number>>`; `RunPhase` thêm `'conquest'`; `RUN_SAVE_VERSION = 3`; `type CalendarSlot = { kind: 'raiders' } | { kind: 'king'; king: 1 | 2; attack: 1 | 2 | 3 }`; `calendarFor(rules: Rules): readonly CalendarSlot[]` (độ dài `rules.years`); `pickEnemyKings(seed: number, playerKing: KingId, pool: readonly KingId[]): KingId[]`; `newRun(seed, kingId, content, rules: Rules = RULES_G2): RunState`; `startDeck(king: KingDef): CardId[]` (thẻ `common` ×2 + `uncommon` ×1, không Ngai; G1 vẫn dùng `START_DECK_G1` khi `rules.calendar === 'raiders'`).
- Calendar `'short'` (spec §14): năm 1 N, 2 N, 3 K1(1), 4 K2(1), 5 N, 6 K1(2), 7 N, 8 K2(2), 9 K1(3), 10 N, 11 N, 12 K2(3), 13 N, 14 N, 15 N. Calendar `'raiders'`: mọi năm N.

- [ ] **Step 1: Viết test thất bại** (`calendar.test.ts`): bảng `'short'` đúng từng năm như trên; mỗi vua đúng 3 lần, hai lần liên tiếp cách nhau ≥ 3 năm; `pickEnemyKings` không chứa `playerKing`, độ dài 2, cùng seed cùng thứ tự, khác seed có thể khác thứ tự; `'raiders'` toàn N. Trong `commands.test.ts`: `newRun` với `RULES_G2` có `gold === RUN.startGold`, `stats.conquered === 0`, `enemies[K1/K2].status === 'pending'`, `rules.years === 15`; `RunController` không còn nhận `rules` và đọc `state.rules.autoStart`.
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt:** các trường mới, `calendar.ts` (thuần, bảng cố định), `pickEnemyKings` xáo bằng `Rng(hashSeed(\`${seed}:calendar\`))` và lưu trạng thái luồng vào `rng.calendar`; cập nhật `startYear` chỉ giữ chỗ cho Task 3 (chưa dùng lịch). Xóa tham số `rules` của `RunController` và đọc `state.rules`. Sửa mọi fixture/test cũ cho đủ trường mới.
- [ ] **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(run): G2 run state, rules in state, 15-year calendar`.

### Task 3: Đạo quân theo lịch (vua địch, cờ hiệu, hệ số lần tấn công)

**Files:**
- Modify: `src/game/battle/compose.ts`, `src/game/battle/types.ts` (`ArmyPlan.attacker: 'raiders' | KingId`, thêm `attackNo?: 1 | 2 | 3`, `banner?: string`), `src/game/run/yearFlow.ts`, `src/game/cards/registry.ts` (thêm `enemyRoster(king: KingId)`)
- Test: `src/game/battle/compose.test.ts`, `src/game/run/yearFlow.test.ts` (tạo nếu chưa có)

**Interfaces:**
- Consumes: `calendarFor`, `RunState.rules/enemyKings` ở Task 2.
- Produces: `slotMultFor(slot: CalendarSlot): number` (`raiders → SLOT_MULT.raiders`; vua → `SLOT_MULT.kingAttack[attack − 1]`); `Content.enemyRoster(king: KingId): readonly { unit: UnitDef; weight: number }[]`; `startYear` chọn roster theo `calendarFor(state.rules)[year − 1]`, ngân sách `armyBudget(year, slotMultFor(slot))`, và nhân `enemyCost` theo `BannerEffect` `enemyCostPct` của vua tấn công trước khi gọi `composeArmy`.

- [ ] **Step 1: Viết test thất bại:** năm 3 (K1 lần 1) ngân sách = `round(ENEMY_BUDGET[2] × 0.9)`; năm 9 (K1 lần 3) hệ số 1.2; `army.attacker` là id vua và `attackNo` đúng; năm Thổ Phỉ vẫn như G1 (`bandit` roster); cờ hiệu `enemyCostPct: −20` làm số đơn vị tăng so với không cờ hiệu với cùng ngân sách (dùng roster giả); cùng seed/năm → cùng đạo quân.
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt** theo Interfaces; `composeArmy` giữ nguyên thuật toán (chỉ nhận `ComposeEntry` đã nhân giá), `ArmyPlan` thêm các trường mới; `Content` không biết vua nào có thẻ gì nên dùng `KingDef.enemyRoster` + `units`.
- [ ] **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(run): army composition follows the 15-year calendar and king banners`.

### Task 4: Vàng — thuế, thu nhập, đổi bài, bán bài, mua ô, vàng trận

**Files:**
- Modify: `src/game/run/commands.ts`, `src/game/run/state.ts` (`RunCommand`, `IllegalReason`), `src/game/run/yearFlow.ts`
- Create: `src/game/run/income.ts`
- Test: `src/game/run/commands.test.ts`, `src/game/run/income.test.ts`

**Interfaces:**
- Produces: `RunCommand` thêm `{ type: 'reroll' }` và `{ type: 'unlockPlot'; plot: number }`; `IllegalReason` thêm `'notEnoughGold'`; `type IncomeHandler = (ctx: StatCtx, params: Readonly<Record<string, Scalar>>) => number` và `CUSTOM_INCOME_HANDLERS: Partial<Record<CustomEffectId, IncomeHandler>>` (rỗng ở G2a; G2b điền, trả số âm cho phí duy trì); `yearIncome(state: RunState, content: Content, goldBefore: number): { delta: number; idleUids: number[] }` (duyệt Ngai → plot 0..24; cộng hiệu ứng `gold` + `goldPerNeighbour` + modifier `stat gold` + handler custom; một khoản âm chỉ được trừ khi `vàng đang có ≥ khoản đó`, nếu không thì công trình vào `idleUids` và không trừ); `startYear` đặt `idleUids`, cộng `RUN.taxPerYear` rồi `yearIncome(state, content, gold)`; `discard` cộng `RUN.skipPlayGold`; `battleResult` thắng cộng `battleGold(year)`; `pickOffer null` ở thưởng cộng `RUN.skipRewardGold`; `stats.goldEarned` cộng mọi khoản thu.
- `reroll`: `phase === 'planning'`, `!played` (`alreadyPlayed` nếu đã), đủ vàng (`notEnoughGold`), bỏ cả tay vào `discardPile` rồi `refillHand`, `rerollsThisYear += 1` (về 0 ở `startYear`). `unlockPlot`: ô phải khóa và kề ô đã mở (`adjacentToUnlocked`; `locked`/`notAdjacent` nếu sai), đủ vàng `unlockCost(purchasedPlots)`, rồi `purchasedPlots += 1`; không cần `played`, không đặt `played`.

- [ ] **Step 1: Viết test thất bại** (ví dụ số): vàng khởi đầu 5 → sau `startYear` năm 1 là `5 + 3`; `reroll` lần 1 trừ 1, lần 2 trừ 2, lần 3 trừ 4; vàng 0 → `notEnoughGold`, state không đổi; `reroll` bỏ cả tay (3 lá) vào `discardPile` và tay mới đủ 3; `unlockPlot` ô kề giá 4 rồi 6, ô không kề → `notAdjacent`, ô đã mở → `badTarget`; `discard` +2; thắng trận năm 10 +6 (`battleGold(10)`); `pickOffer null` +3; `yearIncome` với Giếng Làng giả (gold `[1,2,3,4,5]`) và Cối Xay Gió giả (`goldPerNeighbour`) cộng đúng; mercenary giả (handler phí −1 qua `CUSTOM_INCOME_HANDLERS` dựng trong test) với vàng 0 → `idleUids` chứa uid, vàng không âm.
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt** theo Interfaces; `yearIncome` thuần, duyệt công trình theo plot tăng dần.
- [ ] **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(run): gold economy, reroll, plot purchase`.

### Task 5: Cấp, Bùa và sách phép trên bàn cờ

**Files:**
- Modify: `src/game/run/board.ts`, `src/game/run/commands.ts`, `src/game/run/state.ts` (`PlayTarget`, `IllegalReason`), `src/game/cards/registry.ts` (thẻ `economy`/`support`/`enchantment`)
- Test: `src/game/run/board.test.ts`, `src/game/run/commands.test.ts`

**Interfaces:**
- Produces: `IllegalReason` thêm `'maxLevel' | 'wrongKind' | 'stacksFull'`; `PlayTarget` giữ `{kind:'two'}` cho hai mục tiêu (dùng cho `buildingThenPlot` và `buildingThenBuilding`) và `{kind:'plot'}`/`{kind:'none'}`; hàm thuần trong `board.ts` (trả `PlotState[]` mới): `levelUpBuilding(plots, plot, amount)`, `attachEnchant(plots, plot, cardId, maxStacks)`, `sacrificeBuilding(plots, plot)`, `copyEnchants(plots, from, to, maxStacks)`, `moveBuilding` (đã có; giữ cấp và Bùa, đổi chỗ nếu đích có công trình); `checkPlay` mở rộng đủ bảng §4.4 (công trình: ô mở trống → cấp 1, cùng `CardId` cấp < 5 → +1 cấp, khác `CardId` → `occupied`, cấp 5 → `maxLevel`; Bùa: công trình có `kind ∈ targets` còn chỗ stack, sai loại `wrongKind`, đủ `maxEnchantStacks` `stacksFull`, ô trống `noBuilding`, Ngai chỉ khi `targets` có `'throne'`; sách phép theo `target`, không còn mục tiêu `noTarget`); `hasAnyTarget` cập nhật tương ứng (`'none'` luôn có mục tiêu).
- Tome actions: `levelUp` (không Ngai), `unlockPlot` (miễn phí, mọi ô khóa như Khai Hoang), `move`, `sacrifice { goldPerLevel }` (xóa công trình + Bùa, cộng `goldPerLevel × level` vàng), `custom` (gọi handler của G2b; ở task này đăng ký `CUSTOM_TOME_HANDLERS: Partial<Record<CustomEffectId, TomeHandler>>` rỗng với `TomeHandler = (state: RunState, content: Content, params: Readonly<Record<string, Scalar>>, target: PlayTarget) => RunState | IllegalReason`, và trả `badTarget` khi thiếu handler).

- [ ] **Step 1: Viết test thất bại** cho mọi `IllegalReason` mới và cũ trong §4.4, kể cả: chơi trùng cấp 1→2, cấp 5 → `maxLevel`; Bùa đủ `maxEnchantStacks` (4) → `stacksFull`, đặt Bùa lên `economy` khi `targets` chỉ `troop` → `wrongKind`; dời giữ Bùa và cấp, đổi chỗ khi đích có công trình; `sacrifice` cộng `2 × level` vàng và xóa Bùa; sách `none` chơi được với `{ kind: 'none' }`; `applyCommand` không sửa state đầu vào. Dùng thẻ giả trong `fixtures.ts`.
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt** các hàm và mở rộng `applyCommand` `play`; thẻ vẫn vào `discardPile` (Task A1 của Phần A); không có hiệu ứng `onPlay` ở đây.
- [ ] **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(run): building levels, enchantments and tome actions`.

### Task 6: Bộ máy chỉ số (modifier pass §5.3) và `buildBattleSetup`

**Files:**
- Create: `src/game/run/modifiers.ts`
- Modify: `src/game/run/battleSetup.ts`
- Test: `src/game/run/modifiers.test.ts`, `src/game/run/battleSetup.test.ts`

**Interfaces:**
- Consumes: `levelMult` và hồ sơ ở Task 1; `BuildingState.enchants/permanent` ở Task 2.
- Produces: `type StatSheet = Record<StatKey, { flat: number; pct: number; flatPost: number }>`; `collectStatSheet(state: RunState, content: Content, plot: number, unit?: UnitDef): StatSheet` (nguồn theo thứ tự §5.3: (a) `stat` scope `self` của chính thẻ, (b) Bùa × stack theo thứ tự gắn, (c) `stat` scope `neighbours`/`board` của công trình khác duyệt Ngai trước rồi plot 0..24, lân cận Bắc→Đông→Nam→Tây, (d) bị động Ngai, (g) `permanent`; filter theo `kinds`/`tags`/`unitTags`/`cardIds`; sắc lệnh/perk/tuổi không có ở G2); `finalStat(base: number, sheet: StatSheet[K]): number = (base + flat) × (1 + pct / 100) + flatPost`; `StatCtx = { state: RunState; content: Content; source: { plot: number; level: Level; stacks: number }; target: { plot: number; building: BuildingState } }`, `Modifier = { stat: StatKey; mode: StatMode; value: number }`, `StatHandler = (ctx: StatCtx, params: Readonly<Record<string, Scalar>>) => Modifier[]` và `CUSTOM_STAT_HANDLERS: Partial<Record<CustomEffectId, StatHandler>>` (rỗng ở G2a, G2b điền); bộ máy gọi handler cho từng cặp (nguồn có hiệu ứng `custom`, đích = chính nguồn hoặc một công trình khác) và để handler tự quyết có áp cho đích đó không (kề, đủ stack…); công trình trong `state.idleUids` có `unitCount` về 0; `buildBattleSetup(state, content): BattleSetup` mới tính: HP/DMG lính theo `TROOP_STD`, DMG tháp theo `TOWER_STD`, tầm theo `TOWER_RANGE`, máu công trình theo `structureHp` hoặc `STRUCT_HP × STRUCT_STD` (`economy`/`support` cũng có máu nhưng không đánh), Ngai theo `THRONE_STD` và `throneLevel`, rồi áp `StatSheet`; giới hạn §5.3 bước 4 (`armor ≤ 0.75`, `hp ≥ 30%` gốc, khoảng đánh hiệu dụng ≥ 50% `interval`, `unitCount` kẹp 0..`MAX_UNITS_PER_BUILDING`, `speed ≥ 30%` gốc). Công trình `economy`/`support` đi vào `BattleSetup.structures` như công trình không tấn công (`attack: null`, `spawn: null`).

- [ ] **Step 1: Viết test thất bại** (số lấy từ spec): lính cấp 3 có HP/DMG × 1.5; tháp cấp 5 DMG × 2.4 và tầm + 16; `(gốc + flat) × (1 + Σpct)`: hai Bùa +15% và +20% cộng thành +35% chứ không nhân; `flatPost` cộng sau %; "Dân Quân L3 cạnh Ruộng Lúa L1 → 8 + 1 = 9 lính" bằng thẻ giả; `armor` kẹp 0.75; `hp` không dưới 30% gốc; nhịp đánh không dưới 50% `interval`; `unitCount` kẹp 20; thứ tự `plot` không ảnh hưởng kết quả khi chỉ có modifier cộng; setup giống hệt khi đảo thứ tự khai báo công trình trong mảng đầu vào (test "không phụ thuộc thứ tự chèn" §13.2).
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt** theo Interfaces; tách mã tính từng nguồn thành hàm nhỏ trong `modifiers.ts`, giữ `battleSetup.ts` ngắn.
- [ ] **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task (các test G1 của `battleSetup` phải vẫn pass với cấp 1 và không Bùa). **Step 5: Commit** `feat(run): stat modifier pass and level-aware battle setup`.

### Task 7: Thưởng 3 vua, chinh phục và sau trận

**Files:**
- Modify: `src/game/run/rewards.ts`, `src/game/run/commands.ts`, `src/game/run/state.ts` (`OfferState`)
- Test: `src/game/run/rewards.test.ts`, `src/game/run/commands.test.ts`

**Interfaces:**
- Produces: `OfferState = { kind: 'reward' | 'conquest'; cardIds: CardId[]; king?: KingId }`; `rollConquestOffers(rng: Rng, king: KingDef): CardId[]` (3 thẻ khác nhau từ `king.cards`, không Ngai, theo `Rng('reward')`); `rollOffers` giữ luật §3.8 (65% thẻ vua người chơi / 35% bể trung lập, trọng số độ hiếm theo năm, hạ độ hiếm rồi đổi nguồn khi hết thẻ khác id); `battleResult` ở G2: tăng `enemies[K].attacks` khi `army.attacker` là vua (cả thắng và thua), thắng lần 3 → `status = 'conquered'`, `+RUN.conquestGold`, `stats.conquered += 1`, `phase = 'conquest'` với `offers = { kind: 'conquest', … }` (sau bước thưởng nếu có), thua lần 3 → `status = 'fled'`; `pickOffer`: ở `conquest` bắt buộc chọn (`index: null` → `badTarget`), chọn → thêm vào `deck` và `discardPile`; thứ tự phase `battle → reward → conquest → (năm sau)`; năm cuối với mạng > 0 vẫn thắng ván trước khi vào thưởng (như G1, theo `rules.years`).

- [ ] **Step 1: Viết test thất bại:** thắng trận K1 lần 3 với bộ thẻ giả → `phase` đi `reward` rồi `conquest`, 3 thẻ khác nhau, không phải Ngai, đều thuộc K1; `pickOffer null` ở `conquest` bị từ chối; thua lần 3 → `fled`, không có `conquest`; Thổ Phỉ không tăng `attacks`; sau chọn, thẻ có mặt trong `deck` và `discardPile`; `conquered` tăng đúng 1; cùng seed cùng đề nghị.
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt** theo Interfaces. **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(run): conquest flow and three-king rewards`.

### Task 8: Bot, headless và kiểm tra xác định

**Files:**
- Modify: `src/game/sim/bots/random.ts`, `src/game/sim/headless.ts`, `src/game/testing/fixtures.ts`
- Test: `src/game/sim/headless.test.ts`

**Interfaces:**
- Produces: `randomBot` sinh mọi lệnh hợp lệ của G2: `reroll` (khi đủ vàng, xác suất cố định bằng `Rng`), `unlockPlot` (khi đủ vàng và có ô kề khóa), `play` cho mọi `TomeTarget` (hai mục tiêu cho `buildingThenPlot`/`buildingThenBuilding`, `{kind:'none'}` cho `none`), `discard`, `startBattle` (vì `autoStart = false`), `pickOffer` (bắt buộc chọn ở `conquest`); `runHeadless` nhận `rules` (mặc định `RULES_G2`) và `kingId`, mô phỏng trận bằng `simulateBattle` rồi `battleResult` như G1; `HeadlessResult.state` giữ `stats`.
- [ ] **Step 1: Viết test thất bại:** với bộ thẻ giả đủ loại, bot hoàn thành ván G2 15 năm cho 3 vua × 3 seed không ném lỗi và không lệnh nào bị từ chối (`runHeadless` ném khi lệnh bất hợp pháp); cùng seed hai lần cho cùng `RunState` (so sánh JSON); bất biến "hand ∪ drawPile ∪ discardPile = deck" sau mọi lệnh; vàng không bao giờ âm.
- [ ] **Step 2: Chạy test, thấy FAIL.** **Step 3: Cài đặt** theo Interfaces. **Step 4: Chạy lại, PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(sim): G2-aware random bot and headless runner`.

---

Sau G2a: `npm run lint && npm run typecheck && npm test && npm run build` xanh, game G1 vẫn chơi được (`RULES_G1`), G2 chạy headless nhưng chưa có nội dung 3 vua (G2b) hay giao diện (G2c).
