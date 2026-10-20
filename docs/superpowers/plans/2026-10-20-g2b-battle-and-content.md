# G2b — Mở rộng trận và nội dung 3 vua (Lúa Mì, Đá Núi, Phép Thuật) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm những cơ chế trận mà thẻ G2 cần (splash, chain, tăng dần theo đòn, choáng, khiên, xung vòng, khiêu khích, đẻ khi chết) và toàn bộ dữ liệu G2: 6 thẻ trung lập mới, 9 thẻ + Ngai + đơn vị + cờ hiệu + roster cho mỗi vua trong Lúa Mì, Đá Núi, Phép Thuật, kèm handler `custom`.

**Architecture:** Tầng trận (`src/game/battle`) mở rộng theo hướng struct-of-arrays có sẵn: kiểu trong `types.ts`, mảng trong `world.ts`, hash phủ mảng mới, rồi từng pha trong `combat.ts`/`step.ts`/`targeting.ts`; mỗi cơ chế TDD bằng `BattleSetup` dựng tay (trận không biết thẻ là gì). Nội dung là dữ liệu thuần trong `src/data` + handler trong `src/game/cards/custom/*`, kiểm bằng test bảng đối chiếu số trong spec.

**Tech Stack:** TypeScript strict · Vitest · ESLint (luật deterministic).

**Spec:** `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` §5.3–5.4, §6.1, §6.3–6.5, §8.3–8.9, §13.1–13.3. **Điều kiện đầu vào:** G2a xong (`docs/superpowers/plans/2026-10-20-g2a-core-mechanics.md`).

## Global Constraints

- Trận **không dùng `Rng`**; mọi lựa chọn hòa theo id; duyệt thực thể theo id tăng dần; chỉ `+ − × ÷`, `Math.sqrt/floor/ceil/round/min/max/abs`; không dùng `**`/`Math.pow/hypot/sin/cos…`. Cosine nón/lượng giác không cần ở G2.
- Thứ tự một tick đúng §8.9 (các bước 3 và 10 là chỗ gắn pulse và `deathSpawn`); sự kiện sát thương áp theo (id nguồn, id mục tiêu, thứ tự tạo).
- Nội dung chép **nguyên văn** từ các bảng spec §6.1 (chỉ hàng cột G = G2), §6.3, §6.4, §6.5: tên, số, tag, độ hiếm, `textVi` (placeholder `{count}`, `{gold}`, `{pct}`, `{dmg}`, `{range}`… phải giải được ở cấp 1..5). Mỗi vua đúng 1 Ngai + 9 thẻ (4 T, 3 V, 2 H); id đúng tiền tố `owner_`; mọi `PerLevel` dài 5.
- Mọi số gameplay ở `src/data/*`. Lớp: không import `phaser`, `scenes`, `render`, `ui`; `src/data` không import `src/game`.
- G2 không có: perk, thẻ meta (`neutral_duplicate`, `neutral_royal_seal`), boss, bay (`flying`), burn/poison, kite, charge, reviveOnce.
- Cuối **mọi** task: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit 0. Commit bằng `git add` từng đường dẫn; message kết thúc bằng dòng trống rồi `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Quyết định (của plan này)

1. **Quy ước dữ liệu → trận:** `AttackStats` thêm `splash: number` (0 = không), `chain: { count: number; radius: number; falloff: number } | null`, `stunTicks: number`, `rampPctPerHit: number`, `rampCapPct: number` (0 = không); `UnitStats` thêm `deathSpawn: { stats: UnitStats; count: number } | null` và `shield: number` (khiên lúc xuất hiện); `StructureSetup` thêm `pulse: { everyTicks: number; radius: number; dmg: number; dmgType: DamageType; stunTicks: number } | null`, `taunt: number` (bán kính, 0 = không), `shieldPulse: { everyTicks: number; radius: number; amount: number } | null`.
2. **Splash/cleave** dùng tâm mục tiêu chính, địch khác trong bán kính nhận 50%; **chain** nhảy sang địch gần nhất chưa trúng (id nhỏ hơn khi hòa) trong `radius` quanh mục tiêu trước, mỗi lần nhân `falloff` (Tháp Pháp Sư: 1 lần, bán kính 32, 60%).
3. **`rampSameTarget`:** đòn đầu vào mục tiêu mới nhân 1; mỗi đòn liên tiếp vào cùng mục tiêu cộng `pctPerHit`, tối đa `cap` (Tháp Pha Lê: +20% mỗi đòn, tối đa +200%); đổi mục tiêu hoặc mục tiêu chết → về 0.
4. **Khiên** hấp thụ trước HP (§8.5); khiên Vòng Kết Giới tối đa `2 × amount` mỗi lính.
5. **Choáng:** `stunTicks = max(cũ, mới)`; đang choáng không đi, không đánh, cooldown vẫn giảm; giảm 1 mỗi tick ở bước 9.
6. **`pulse`** bắn ở bước 3 mỗi `everyTicks` tick (lần đầu ở tick `everyTicks`), đánh mọi địch có tâm trong `radius` (kể cả bay), chỉ khi công trình còn sống; **`shieldPulse`** tương tự với lính phe mình trong `radius`.
7. **Banner khi làm địch** (`BannerEffect`) áp trong `buildBattleSetup`: `enemyStat hp/speed` nhân chỉ số địch, `enemyShieldPct` đặt `UnitStats.shield = hp × pct / 100`, `enemyCostPct` xử lý ở `startYear` (G2a Task 3).

## Review Focus

1. Hai đòn splash/chain/pulse trúng cùng một mục tiêu trong cùng tick → thứ tự áp sát thương cố định, kết quả giống nhau khi chạy lại và khi đảo thứ tự công trình trong `BattleSetup` (Task 1, 9).
2. Đơn vị chết do `deathSpawn` khi đã chạm `playerUnitCap`/`entityCap` → không tràn mảng, `capped` tăng, không ném lỗi (Task 4).
3. Khiên + sát thương cùng tick, khiên lớn hơn sát thương → HP không đổi, `hit` vẫn phát sự kiện (Task 3).
4. Tháp Pha Lê ngắm một mục tiêu chết rồi chuyển mục tiêu → bộ đếm ramp về 0 (Task 2).
5. `buildBattleSetup` với công trình `economy`/`support` đã bị phá hoặc `idleUids` → không sinh lính, không bắn, không xung (Task 4, 9).

---

### Task 1: Kiểu trận mới, mảng thế giới và hash

**Files:**
- Modify: `src/game/battle/types.ts`, `src/game/battle/world.ts`, `src/game/battle/hash.ts`, `src/game/battle/BattleRunner.ts` (không đổi logic), `src/game/testing/fixtures.ts`
- Test: `src/game/battle/world.test.ts`, `src/game/battle/determinism.test.ts`

**Interfaces:**
- Produces: các trường ở Quyết định 1; `BattleWorld` thêm mảng `shield: Float64Array`, `stunTicks: Int32Array`, `splash`, `chainCount`, `chainRadius`, `chainFalloff`, `onHitStunTicks`, `rampPct`, `rampCap`, `rampTarget: Int32Array`, `rampStacks: Int32Array`, `taunt`, `pulseEvery`, `pulseRadius`, `pulseDmg`, `pulseStun`, `shieldEvery`, `shieldRadius`, `shieldAmount`, và `deathSpawn` (lưu tham chiếu `UnitStats` theo id thực thể); `BattleEvent` thêm `{ type: 'pulse'; id: number }` và `{ type: 'shield'; id: number }`; `hash.ts` phủ mọi mảng mới.
- [ ] **Step 1: Viết test thất bại:** `createBattle` nhận `BattleSetup` có đủ trường mới (mặc định "không có": `splash 0`, `chain null`, `pulse null`…) và mảng mới được điền đúng cho từng thực thể; `shield` khởi tạo = `UnitStats.shield`; hash của hai thế giới giống hệt cho cùng setup và **khác** khi đổi một giá trị mới (ví dụ `pulse.everyTicks`).
- [ ] **Step 2: Chạy `npm test < /dev/null -- src/game/battle`**, thấy FAIL. **Step 3: Cài đặt** theo Interfaces; các trường mới có giá trị mặc định ở `fixtures.ts` để test cũ không phải sửa hàng loạt. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(battle): setup types and world storage for G2 mechanics`.

### Task 2: Splash, chain và tăng dần theo đòn

**Files:**
- Modify: `src/game/battle/combat.ts`
- Test: `src/game/battle/combat.test.ts`

**Interfaces:**
- Consumes: Task 1.
- [ ] **Step 1: Viết test thất bại:** (a) `splash 16`: mục tiêu chính nhận 100%, địch trong 16 px quanh nó 50%, địch ngoài 16 px 0%, phe mình không bị; áp cả với đòn có đạn (nổ tại vị trí cuối nếu mục tiêu chết trước khi trúng, §8.5); (b) `chain {count 1, radius 32, falloff 0.6}`: nhảy sang địch gần nhất chưa trúng trong 32 px quanh mục tiêu, nhận 60%, hòa → id nhỏ; không có địch thứ hai → không nhảy; (c) `rampSameTarget {20, 200}`: dãy 12 đòn liên tiếp vào cùng mục tiêu có hệ số 1.0, 1.2, …, 3.0, 3.0; đổi mục tiêu và mục tiêu chết đều đặt lại về 1.0; (d) cùng setup chạy hai lần cho cùng hash.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** trong `strikeInstant`/`projectilePhase`/`queueHit` (đọc thuộc tính từ `world.*[sourceId]` nên đạn không cần mang thêm trường); mọi mục tiêu phụ duyệt theo id tăng dần. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(battle): splash, chain and same-target ramp damage`.

### Task 3: Choáng, khiên, xung vòng và xung khiên

**Files:**
- Modify: `src/game/battle/combat.ts`, `src/game/battle/step.ts`, `src/game/battle/movement.ts`, `src/game/battle/types.ts` (`QueuedDamage` thêm `stunTicks`)
- Create: `src/game/battle/structures.ts` (pha công trình: `pulsePhase`, `shieldPulsePhase`)
- Test: `src/game/battle/combat.test.ts`, `src/game/battle/step.test.ts`, `src/game/battle/structures.test.ts`

**Interfaces:**
- Produces: `pulsePhase(world: BattleWorld): void` và `shieldPulsePhase(world: BattleWorld): void`, gọi ở bước 3 của `stepBattle` (thay chỗ "hook chưa có"), duyệt công trình theo id tăng dần.
- [ ] **Step 1: Viết test thất bại:** (a) khiên 30 hấp thụ đòn 20 (HP không đổi, khiên còn 10, sự kiện `hit` vẫn phát), đòn 50 chỉ phần dư 20 vào HP; (b) `stun`: đang choáng thì không đi và không đánh nhưng `cooldown` vẫn giảm, hết choáng sau đúng `stunTicks` tick, `stun` đến sau lấy `max`; (c) `pulse {everyTicks 40, radius 48, dmg 30 vật lý, stun 10}`: bắn ở các tick 40, 80, …; chỉ trúng địch có tâm trong 48; công trình đã bị phá không xung; sự kiện `pulse` phát; (d) `shieldPulse {every 50, radius 64, amount 20}`: lính phe mình trong 64 nhận +20, tối đa 40; địch không nhận; (e) cùng setup hai lần cùng hash.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** áp khiên trong `applyDamagePhase` trước khi trừ HP; stun xử lý cùng chỗ với chậm (áp ở bước 8, giảm ở bước 9); `moveEntities` và `attackPhase` bỏ qua thực thể đang choáng (nhưng vẫn giảm `cooldown`). **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(battle): stun, shields and structure pulses`.

### Task 4: Khiêu khích, đẻ khi chết và cờ hiệu địch

**Files:**
- Modify: `src/game/battle/targeting.ts`, `src/game/battle/combat.ts` (`deathPhase`), `src/game/battle/world.ts` (`spawnWave` đặt khiên), `src/game/run/battleSetup.ts` (áp `BannerEffect`)
- Test: `src/game/battle/targeting.test.ts`, `src/game/battle/combat.test.ts`, `src/game/run/battleSetup.test.ts`

**Interfaces:**
- Consumes: Task 1; `BannerEffect` ở G2a Task 1.
- [ ] **Step 1: Viết test thất bại:** (a) khiêu khích: địch có tâm trong `taunt` của một công trình còn sống chọn công trình khiêu khích gần nhất (hòa → id nhỏ) thay vì mục tiêu thường; ngoài bán kính thì bỏ qua; Cuồng Nộ (`tick ≥ rageTick`) bỏ qua khiêu khích; (b) `deathSpawn rubble ×1`: Thợ Mỏ chết sinh đúng 1 Đá Vụn cùng phe tại vị trí chết (dịch theo `SPAWN_OFFSETS`), id mới lớn hơn mọi id cũ, đơn vị mới không chết trong cùng tick; chạm `playerUnitCap` (phe mình) hoặc `entityCap` → không sinh, `capped` tăng; địch sinh bình thường dưới trần; (c) cờ hiệu: `enemyStat hp +20` và `speed −10` nhân đúng HP/tốc đơn vị địch trong `buildBattleSetup`; `enemyShieldPct 15` đặt `shield = 0.15 × hp` cho mọi địch lúc xuất hiện; quân Thổ Phỉ không chịu cờ hiệu.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** theo Interfaces; `deathPhase` chỉ sinh sau khi duyệt hết chết (ghi danh sách rồi sinh theo id nguồn tăng dần). **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(battle): taunt, death spawns and enemy banners`.

### Task 5: Thẻ trung lập G2

**Files:**
- Modify: `src/data/neutral.ts` (`NEUTRAL_UNITS` thêm `mercenary`; `NEUTRAL_CARDS` thêm `neutral_well`, `neutral_mercenary_camp`, `neutral_sharpen`, `neutral_fortify`, `neutral_promote`, `neutral_demolish` theo §6.1), `src/game/cards/registry.ts` (`neutralPool()` gồm 4 thẻ G1 + 6 thẻ G2; loại thẻ `unlock: 'meta'`)
- Create: `src/game/cards/custom/index.ts` (gom `CUSTOM_STAT_HANDLERS`, `CUSTOM_INCOME_HANDLERS`, `CUSTOM_TOME_HANDLERS` đã định nghĩa ở G2a; các module khác import từ đây), `src/game/cards/custom/neutral.ts` (handler `mercenary_upkeep`: trả −1 vàng qua `IncomeHandler`)
- Test: `src/data/content.test.ts`, `src/game/cards/cards.effects.test.ts`

- [ ] **Step 1: Viết test thất bại** (bảng đối chiếu §6.1): Giếng Làng cấp 1..5 cho 1/2/3/4/5 vàng qua `yearIncome`; Trại Đánh Thuê sinh `mercenary` 2/3/3/4/5, phí 1 vàng, không đủ vàng thì `buildBattleSetup` cho `unitCount 0`; Bùa Sắc Bén ×1 cho +15% DMG lính/tháp/Ngai, ×2 cộng thành +30%; Bùa Vững Chãi +20% HP lính và máu công trình; Thăng Cấp +1 cấp công trình thường, từ chối Ngai (`badTarget`); Dỡ Bỏ nhận `2 × cấp` vàng và xóa công trình. Dữ liệu: id duy nhất, tiền tố `neutral_`, mọi placeholder giải được ở cấp 1..5 qua `describeCard`.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** dữ liệu và handler; `describeCard` hỗ trợ placeholder `{gold}`, `{pct}` mới cho các loại thẻ này. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(content): neutral G2 cards`.

### Task 6: Vua Lúa Mì đầy đủ

**Files:**
- Modify: `src/data/kings/wheat.ts`
- Create: `src/game/cards/custom/wheat.ts`
- Test: `src/data/content.test.ts`, `src/game/cards/cards.effects.test.ts`

- [ ] **Step 1: Viết test thất bại** (§6.3; mỗi thẻ ít nhất một khẳng định số cuối): Ruộng Lúa +1/1/2/2/3 vàng và lân cận công trình lính +1/1/2/2/3 lính; Bùa Phân Bón: lính +1 lính, kinh tế +1 vàng (cộng dồn theo stack); Cối Xay Gió +2/3/4/5/6 vàng, +1 vàng cho mỗi Ruộng Lúa lân cận (`goldPerNeighbour`); Lễ Hội Mùa Màng (sách `none`) nhận vàng = tổng cấp mọi công trình `farm`, tối thiểu 2; Kho Thóc lân cận lính +15/20/25/30/35% HP và +1 vàng mỗi Ruộng lân cận; Khởi Nghĩa Nông Dân sinh `peasant` `4 + k × (số công trình farm)` với k = 2/2/3/3/4, kẹp 20; Mùa Gặt của Ngai: +1 vàng mỗi 2 công trình `farm` (làm tròn xuống), từ Ngai cấp 3 +1 mỗi công trình `farm`. Dữ liệu: 4 T (`wheat_militia`, `wheat_field`, `wheat_scarecrow`, `wheat_fertilizer`), 3 V (`wheat_reapers`, `wheat_windmill`, `wheat_harvest_festival`), 2 H (`wheat_granary`, `wheat_peasant_horde`); cờ hiệu **Đông Như Kiến** (`enemyCostPct −20`); roster `militia` 50, `reaper` 25, `peasant` 25; thêm đơn vị `peasant`.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** Khởi Nghĩa dùng `spawn` với `count [4,4,4,4,4]` + `custom 'peasant_horde'` (`StatHandler` trả modifier `unitCount flat = k × farms`); Mùa Gặt = `custom 'wheat_harvest'` (`IncomeHandler`); Lễ Hội = `TomeHandler 'harvest_festival'`. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(content): Wheat King full card set`.

### Task 7: Vua Đá Núi

**Files:**
- Create: `src/data/kings/stone.ts`, `src/game/cards/custom/stone.ts`
- Test: `src/data/content.test.ts`, `src/game/cards/cards.effects.test.ts`

- [ ] **Step 1: Viết test thất bại** (§6.4): Tháp Ném Đá `splash 16`, tầm tối thiểu 24 (địch trong 24 px không bị bắn); Xưởng Người Đá sinh `golem` 1/1/2/2/3; Mỏ Đá +1/2/2/3/3 vàng, lân cận tháp +10/15/20/25/30% DMG; Bùa Da Đá +20% HP lính và máu công trình và +0.05 giáp; Tường Thành máu 400/550/700/850/1000, giáp 0.3, `taunt` 40, lân cận +20% máu công trình; Tháp Pha Lê tia 4 phép, tầm 64, nhịp 3, tức thời, ramp +20%/đòn tối đa +200%; Đội Thợ Mỏ sinh `miner` 3/4/5/6/7 và mỗi `miner` chết sinh 1 `rubble`; Khắc Ấn Núi: mọi tháp trên bàn nhận vĩnh viễn +8% DMG (`permanent.dmg`, cộng dồn nếu chơi hai lần); Tim Núi máu 600/750/900/1050/1200, xung mỗi 40 tick bán kính 48: 30 vật lý + choáng 10 tick, lân cận `golem` +30% HP; Ngai Đá Tảng HP 450, giáp 0.2, ném 12 vật lý tầm 56 nhịp 14 đạn 6, bị động +10/12/15/18/20% DMG mọi tháp theo cấp Ngai. Dữ liệu: 4 T (`stone_catapult`, `stone_golem_forge`, `stone_quarry`, `stone_stoneskin`), 3 V (`stone_wall`, `stone_crystal`, `stone_miners`), 2 H (`stone_rune_carving`, `stone_mountain_heart`); đơn vị `golem`, `miner`, `rubble`, `slinger` (chỉ địch, `enemyCost` theo bảng); cờ hiệu **Da Đá** (`enemyStat hp +20`, `enemyStat speed −10`); roster `miner` 50, `slinger` 35, `golem` 15.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** dữ liệu (dùng `pulse`, `taunt`, `stat`, `onHit rampSameTarget`) và `TomeHandler 'rune_carving'`. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(content): Stone King card set`.

### Task 8: Vua Phép Thuật

**Files:**
- Create: `src/data/kings/arcane.ts`, `src/game/cards/custom/arcane.ts`
- Test: `src/data/content.test.ts`, `src/game/cards/cards.effects.test.ts`

- [ ] **Step 1: Viết test thất bại** (§6.5): Tháp Pháp Sư 9 phép, tầm 80, nhịp 14, đạn 8, nảy 1 lần 60% trong 32 px; Học Viện sinh `apprentice` 3/4/5/6/7; Bùa Tia Lửa +2 sát thương phép mỗi đòn **sau** mọi % (`flatPost`) và cộng theo stack; Bùa Tốc Biến +12% tốc đánh (nhịp hiệu dụng `interval / 1.12`, không dưới 50%); Thư Viện +1 vàng và công trình lân cận có ≥ 1 Bùa nhận +1/1/1/2/2 stack ảo của Bùa gắn đầu tiên (không tính vào giới hạn stack); Tháp Băng Sư sinh `frost_mage` 2/3/3/4/5 (chậm 30%/20 tick); Gương Chép Bùa chép mọi stack Bùa từ công trình thứ nhất sang thứ hai, dừng ở `maxEnchantStacks`, theo thứ tự gắn; Vòng Kết Giới xung khiên 20/25/30/35/40 mỗi 50 tick bán kính 64 (tối đa 2×); Tháp Đại Pháp Sư sinh `archmage` 1/1/1/2/2, mỗi `archmage` +4% DMG cho mỗi stack Bùa trên toàn bàn cờ (tối đa +100%); Ngai Tinh Tú HP 280, bắn 10 phép tầm 80 nhịp 12 đạn 8, Hòa Âm: công trình có tổng ≥ 2 stack Bùa nhận +10/12/15/18/20% HP và DMG theo cấp Ngai. Dữ liệu: 4 T (`arcane_mage_tower`, `arcane_apprentices`, `arcane_spark_rune`, `arcane_haste_rune`), 3 V (`arcane_library`, `arcane_frost_mages`, `arcane_mirror`), 2 H (`arcane_ward`, `arcane_archmage`); đơn vị `apprentice`, `frost_mage`, `archmage`, `construct` (chỉ địch); cờ hiệu **Kết Giới** (`enemyShieldPct 15`); roster `apprentice` 50, `frost_mage` 25, `construct` 25.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** `StatHandler` `library_virtual_stacks`, `archmage_ramp`, `arcane_harmony`; `TomeHandler` `mirror_enchants`. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(content): Arcane King card set`.

### Task 9: Đăng ký vua, bộ bài khởi đầu và kiểm tra toàn ván

**Files:**
- Modify: `src/data/kings/index.ts` (`KINGS_G2 = [WHEAT, STONE, ARCANE]`, giữ `KINGS_G1`), `src/game/cards/registry.ts` (dùng `KINGS_G2`; `kings()`, `enemyRoster(king)`, `playableKings()`), `src/game/run/yearFlow.ts` (`startDeck` dùng thẻ vua), `src/game/battle/benchmark.test.ts`
- Test: `src/data/content.test.ts`, `src/game/sim/headless.test.ts`, `src/game/battle/determinism.test.ts`

- [ ] **Step 1: Viết test thất bại:** mỗi vua có đúng 1 Ngai + 9 thẻ (4 T, 3 V, 2 H), roster không rỗng, cờ hiệu có `textVi`, mọi `UnitId` tham chiếu tồn tại, id duy nhất toàn cục, mọi `color` thuộc `PALETTE`; bộ bài khởi đầu mỗi vua đúng 11 bản (thường ×2 + vừa ×1); `runHeadless` bằng bot `random` hoàn thành ván G2 15 năm cho 3 vua × 3 seed không ném lỗi và cùng seed cho cùng `RunState`; trận determinism: chạy cùng `BattleSetup` (dựng từ một ván headless năm 12) hai lần cho cùng hash từng tick, đổi thứ tự công trình trong mảng đầu vào cho cùng kết quả; benchmark ≤ 2 ms/tick với kịch bản có 160 lính mình, 120 địch, 25 công trình (có xung và chuỗi) và 150 đạn.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** đăng ký và đổi `newRun` mặc định dùng `KINGS_G2` khi `rules.calendar === 'short'`. **Step 4: PASS** + bộ lệnh kiểm cuối task; ghi kết quả benchmark và tỉ lệ thắng của bot `random` (chỉ để tham khảo, cân bằng thật ở G5) vào `docs/ROADMAP.md`. **Step 5: Commit** `feat(content): register three kings and verify full headless runs`.

---

Sau G2b: ba vua chạy trọn 15 năm headless với mọi thẻ G2, trận có đủ cơ chế; giao diện chưa dùng được (G2c).
