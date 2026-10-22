# G3b — Nội dung chinh phục và lịch đầy đủ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (hoặc superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đăng ký sáu vua địch, chơi được54 thẻ chinh phục và dựng lịch/đạo quân30 năm chính xác.

**Architecture:** Giữ `Content.king()/kings()` cho ba vua chơi được; thêm enemy catalog không cần tạo Ngai giả. Mở rộng combat/handlers hiện hành, không sao chép engine hoặc cho hai chiều import giữa data và game.

**Tech Stack:** TypeScript strict · Vitest · typed arrays hiện hành.

**Spec:** §3.5–3.8, §4–5, §6.6–6.11, §8.3–8.12, §14; điều kiện A1–A5 xong; [plan tổng](2026-10-22-g3-full-run.md) Quyết định1 đã được người dùng chốt.

## Global Constraints

- Kế thừa toàn bộ Global Constraints của plan tổng; ba vua chơi được vẫn wheat/stone/arcane, không thêm perk/meta/Ngai sáu vua.
- Không RNG trận; tick10/s; nguồn id/plot có thứ tự; số liệu nội dung lấy đúng bảng §6, không balance ở đây.
- Các bảng tests phải có expected literals độc lập với data runtime; không dùng chính data làm oracle hoặc đọc Markdown trong game.
- G1/G2 exports, defaults và kết quả fixtures giữ nguyên khi không có effect mới; cap160/120/40/512/400, maxLevel5, HP tối thiểu30%, giáp≤0.75, nhịp≥50% base (§5.3).

## Quyết định (của plan này)

1. `EnemyKingDef` riêng chứa identity/color/units/roster/banner/conquestCards; ba vua G2 có adapter từ KingDef. `kings()` vẫn chỉ trả3 nên màn chọn vua không vô tình mở sáu vua.
2. Conquest sample từ9 thẻ của địch như §3.7, không đưa54 thẻ vào ordinary reward pool. Registry allCards có chúng để save/atlas tra được.
3. Sprite mới: canvas nhóm theo §11.2; roster người nhỏ16×16, pháp sư/người vũ khí dài16×24, thú lớn/golem/colossus/moon_reaper/iron_drake24×32, kỵ binh24×24. Đây là placeholder proposal, không đổi collision radius spec; art có thể chốt lại trong G5.
4. Charge chưa có reset rule trong spec: kích hoạt một lần/đơn vị khi đánh đầu tiên sau di chuyển từ spawn; không tự tạo multiplier theo khoảng cách. Boss/structure miễn kéo/đẩy. Healing tie id; prewind cộng; overflow spawn theo quyết định caps tổng. Chi phí đổi: behaviour fixtures.

## Review Focus

1. Gộp coalition có cùng UnitId từ hai nguồn → trọng số cộng, không áp cờ hiệu riêng từng vua (B6).
2. Thẻ chinh phục từ6 vua được chơi ngay và qua reload, không `Unknown card`/handler thiếu (B2–B5,D1).
3. Bất Tử + skeleton revive → chỉ hồi sinh một lần, không nhân soul/kill (B1/B5).
4. Poison/burn cùng nguồn refresh, nhiều nguồn cộng, projectile mất target vẫn splash (B1).
5. Reroll/di chuyển/bùa/library/permanent kết hợp thẻ chinh phục → đúng additive order, không nhân lũy thừa (B3–B5).

---

### Task B1: Combat primitives cho roster mới và thẻ chinh phục

**Files:**

- Modify: `src/data/types.ts`, `src/game/battle/types.ts`, `src/game/battle/world.ts`, `src/game/battle/combat.ts`, `src/game/battle/movement.ts`, `src/game/battle/targeting.ts`, `src/game/battle/step.ts`, `src/game/battle/hash.ts`, `src/game/run/battleSetup.ts`.
- Create: `src/game/battle/behaviours.ts`, `src/game/battle/statuses.ts`.
- Test: `src/game/battle/behaviours.test.ts`, `src/game/battle/statuses.test.ts` (Create), `src/game/battle/determinism.test.ts`.

**Interfaces:**

- Consumes existing `createBattle(setup:BattleSetup):BattleWorld`, `stepBattle(world:BattleWorld,inputs:readonly BattleCommand[]):void`, `addUnit(w:BattleWorld,stats:UnitStats,team:number,x:number,y:number,homeX:number,homeY:number,sourceUid:number):number`, `hashWorld(world:BattleWorld):number`.
- Produces expanded OnHitDef/UnitBehaviourDef/AttackSpec đúng union §5.1; UnitStats adds optional `tags:readonly UnitTag[]`, `behaviours:readonly UnitBehaviourDef[]`, `onHit:readonly OnHitDef[]`, `cone:{range:number;halfAngleCos:number}|null`, `defIndex:number`, `prewind:number` (optional fields default legacy-safe).
- Produces `tickBehaviours(world:BattleWorld):void`, `hitBehaviours(world:BattleWorld,source:number,target:number,damageDealt:number):void`, `deathBehaviours(world:BattleWorld,id:number):boolean` (true=revived, caller không final-death), `tickStatuses(world:BattleWorld):void`; các state mới per world, không global mutable. `BattleResult.goldDelta?:number` nhận world.goldDelta, default0.

- [ ] **Step 1: Test fail:** burn2/s30ticks cùng defIndex hai đòn→2/s refreshed, khác nguồn→4/s; poison2/s max3 stacks→6/s, lần4 không8; regen không vượt maxHp. Lifesteal40% sau giáp0.25 của raw10→heal3; healAlly hp4/radius40 chọn HP thấp nhất/tie id, không heal địch.
- [ ] Flying immune melee range2; ranged56/tower/pulse/boulder đánh được; kite distance24 rút khi cooldown, charge×2/knockback8 hoặc stun10; pull16 mỗi đòn4; immunity structure/boss. Enrage bear HP79/160 dmg16→24,HP80 chưa; tin ramp2%/s capped80%, gear attackSpeed1%/s capped60%, colossus100tick +20%dmg/+10%speed tối đa6; soulScaling2%/soul, killHeal10, revive skeleton50% một lần. Khi tái sinh không ghi kill/death lần1, deathSpawn không chạy trước revive.
- [ ] `cone_without_trig` dot boundary45° và ngoài; `projectile_dead_target` rơi vị trí cuối/splash50%; `status_tick_order` trừ duration không mất tick cuối (giữ fix G2); `hash_new_fields` thay từng cooldown/status/soul/ramp/gold state→hash đổi, cùng setup+inputs1000tick→hash giống.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/battle/behaviours.test.ts src/game/battle/statuses.test.ts src/game/battle/determinism.test.ts < /dev/null`; mong union/export thiếu hoặc effect không áp.
- [ ] **Step 3: Cài đặt** exports ở trên, spec §8.9 thứ tự spawn→input→hook→retarget→move→attack→projectile→damage→status→death→end. Hash mọi state mới, cả queued statuses/behaviours và goldDelta; không chỉ typed arrays cũ. Nguồn DoT ally=sourceUid, foe=defIndex; defIndex là vị trí UnitId sorted registry, không entityId. Giữ base stats riêng, ramp tính lại từ tick/prewind không nhân chồng mỗi tick. Scalar/config mới ở `src/data/battle.ts` (Modify) nếu là số gameplay; cone cos45 dùng hằng dữ liệu, không Math.cos.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(battle): deterministic behaviours and statuses for full-run content`.

### Task B2: Enemy catalog và9 cờ hiệu, chưa mở vua mới

**Files:**

- Create: `src/data/kings/grove.ts`, `src/data/kings/tide.ts`, `src/data/kings/forge.ts`, `src/data/kings/clock.ts`, `src/data/kings/moon.ts`, `src/data/kings/nomad.ts`.
- Modify: `src/data/types.ts`, `src/data/kings/index.ts`, `src/game/cards/registry.ts`, `src/game/run/battleSetup.ts`, `src/game/battle/types.ts`, `src/game/battle/behaviours.ts`, `src/game/battle/combat.ts`.
- Test: `src/data/enemyContent.test.ts`, `src/game/battle/bannersFull.test.ts` (Create).

**Interfaces:**

- Consumes B1 behaviours and existing `Content.enemyRoster(king:KingId):readonly {unit:UnitDef;weight:number}[]`.
- Produces `EnemyKingDef={id:KingId;nameVi:string;name:string;color:PaletteColor;units:readonly UnitDef[];enemyRoster:readonly {unit:UnitId;weight:number}[];banner:BannerDef;conquestCards:readonly CardDef[]}` in data/types.
- Produces `Content.enemyKing(id:KingId):EnemyKingDef`, `Content.enemyKings():readonly EnemyKingDef[]`, `Content.conquestCards(id:KingId):readonly CardDef[]`; giữ các signature cũ, kings()=3. Six exports `GROVE_ENEMY`, `TIDE_ENEMY`, `FORGE_ENEMY`, `CLOCK_ENEMY`, `MOON_ENEMY`, `NOMAD_ENEMY`; conquestCards tạm[] đến B3–B5, chưa enable FULL. `ENEMY_KINGS` chứa9, sorted ID để RNG ổn định.
- Produces `BattleSetup.banner?:BannerDef`, `BattleWorld.goldDelta:number`, banner per-world counters; `enemyRoster` dùng enemy catalog, không `content.king` cho6 vua chưa chơi được.

- [ ] **Step 1: Test fail** `enemy_catalog_9_playable_3` và golden literal UnitDef tables HP/dmg/range/interval/speed/radius/armor/EP/tags/behaviours cho23 unit §6.6–6.11: wolf,bear,stag,treant,dryad,pirate,hookman,musketeer,swordsman,bombardier,iron_drake,shieldbearer,tin_soldier,spider,colossus,gear_gunner,skeleton,wraith,vampire,moon_reaper,rider,horse_archer,khan_guard; không có missing child summon.
- [ ] `roster_weights`: grove50/25/15/10,wolf/stag/bear/dryad; tide55/25/20; forge55/30/15; clock55/30/15; moon55/25/20; nomad45/40/15. Existing wheat50/25/25,stone50/35/15,arcane50/25/25 regression.
- [ ] `banner_effects`: grove heal1%maxHP/s; tide mỗi10%HP mất thêm trừ1gold, max3, không âm, không mất thêm vì heal rồi damage lại cùng mốc (high-watermark); forge armor+0.15 clamped0.75; clock dmg+1%/s max50%; moon floor20% tổng quân ngân sách có one-revive30%HP; nomad speed+25% và thêm1edge. Bất Tử revive cùng id một lần cả skeleton. Địch coalition/boss không banner.
- [ ] **Step 2: FAIL:** `npx vitest run src/data/enemyContent.test.ts src/game/battle/bannersFull.test.ts < /dev/null`; mong Unknown enemy hoặc chưa áp cờ mới.
- [ ] **Step 3: Cài đặt** catalog/exports trên; không tạo fake throne/KingDef bằng ép kiểu. Unit data đủ cả quân chỉ sinh từ thẻ khi chinh phục; golden expected độc lập literals từ các bảng spec. Cập nhật buildBattleSetup để đọc `enemyKing` và banner theo meta, giữ G1/G2.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(content): enemy kings and complete banner effects`.

### Task B3:18 thẻ chinh phục Rừng Xanh và Thuỷ Triều

**Files:**

- Modify: `src/data/kings/grove.ts`, `src/data/kings/tide.ts`, `src/data/types.ts`, `src/game/cards/custom/index.ts`, `src/game/run/modifiers.ts`, `src/game/run/income.ts`, `src/game/run/commands.ts`, `src/game/run/yearFlow.ts`, `src/game/run/battleSetup.ts`, `src/game/battle/structures.ts`, `src/game/battle/types.ts`, `src/game/battle/behaviours.ts`.
- Create: `src/game/cards/custom/grove.ts`, `src/game/cards/custom/tide.ts`, `src/game/cards/custom/fullRunTypes.ts`.
- Test: `src/game/cards/groveConquest.test.ts`, `src/game/cards/tideConquest.test.ts` (Create).

**Interfaces:**

- Consumes B2 conquestCards, B1 runtime; existing CUSTOM_STAT_HANDLERS/CUSTOM_INCOME_HANDLERS/CUSTOM_TOME_HANDLERS theo kiểu ở `src/game/cards/custom/types.ts`, không đổi handler params hiện có.
- Produces `FullRunCardHooks` in fullRunTypes.ts: `yearGrowth(state:RunState,content:Content):RunState`, `afterPlay(before:RunState,after:RunState,card:CardDef,target:PlayTarget,content:Content):RunState`, `afterMove(state:RunState,from:number,to:number,content:Content):RunState`, `battleEnd(state:RunState,result:BattleResult,content:Content):RunState`; `GROVE_HOOKS`, `TIDE_HOOKS:Partial<FullRunCardHooks>` exports từ custom modules. Thêm hook registry `FULL_RUN_CARD_HOOKS:readonly Partial<FullRunCardHooks>[]` index, thứ tự declaration grove/tide/forge/clock/moon/nomad; duyệt nguồn nội bộ theo §5.5.
- Produces StructureSetup optional `healAura`, `summonEvery`, `multiAttack`, `prewind`, `spawnAtThrone`; mỗi field dùng kiểu data tương ứng §5.1 hoặc scalar đã resolve, không callback. BattleSetup snapshot chứa đủ stats sinh thêm, không import Content vào battle world.

- [ ] **Step 1: Test fail** 9 case ID mỗi phe, mỗi case assert kết quả effect ở L1 và L5 qua commands/setup/tick (không chỉ existence), literals từ §6.6/6.7. Grove: wolf3/7; sapling tuổi3→+1 cấp và buff8/40%; spring heal2/6HP/s trong64; roots3% mỗi năm cap90; thorn dmg5/range64/nhịp8 poison2/s30ticks3 lớp; bear1/3; rain ageBonus+2 và sapling+1; stag2/5; treant1/2 healAura48/3HP/s.
- [ ] Tide: pirates4/8,8kills/source→1gold max3; cannon dmg16/splash12/knockback16; harbor2/6gold; rune+6knockback/+8%speed; wave50ticks radius72 dmg10 knockback24; treasure floor(gold/5) cap3/7 (gold14→2); hookmen2/5; privateers gold17 trả16→8mercenary tại Ngai, gold1 trả1→0, không âm; kraken4 mục tiêu khác nhau, dmg14/range56/nhịp12/kb8. Growth trước income; root % cộng với bùa; live counters serialize; thêm18 exact CardIds expected set từ hai bảng spec, mỗi ID gắn một test effect.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/cards/groveConquest.test.ts src/game/cards/tideConquest.test.ts < /dev/null`; mong registry thiếu hoặc handler chưa có.
- [ ] **Step 3: Cài đặt**18 card data theo spec, hooks/structure fields trên; sinh vàng trong trận gom world.goldDelta, không sửa RunState từ battle. Age giữ movedYear/placedYear, không tăng tuổi hai lần khi reload; Không thêm Ngai/perk Rừng/Tide. Thêm `healAura`/`summonEvery` union đúng §5.1 nếu chưa có.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(cards): grove and tide conquest cards`.

### Task B4:18 thẻ chinh phục Lò Rèn và Đồng Hồ

**Files:**

- Modify: `src/data/kings/forge.ts`, `src/data/kings/clock.ts`, `src/data/types.ts`, `src/game/cards/custom/index.ts`, `src/game/run/modifiers.ts`, `src/game/run/battleSetup.ts`, `src/game/battle/structures.ts`, `src/game/battle/behaviours.ts`.
- Create: `src/game/cards/custom/forge.ts`, `src/game/cards/custom/clock.ts`.
- Test: `src/game/cards/forgeConquest.test.ts`, `src/game/cards/clockConquest.test.ts` (Create).

**Interfaces:**

- Consumes B3 FullRunCardHooks và B1 ramp/status; giữ custom handler types cũ.
- Produces `FORGE_HOOKS`, `CLOCK_HOOKS:Partial<FullRunCardHooks>` và handler registrations đầy đủ; registry conquestCards mỗi phe đúng9.

- [ ] **Step 1: Test fail**18 ID effect cases L1/L5 §6.8/6.9. Forge: swordsmen3/7; flame dmg4/cone40/cos45°/nhịp4/burn1/s20tick; smithy12/28%DMG,+0.05armor; ember burn+2/s30tick; hammer selected+1 và neighbor minLevel+1 tie Bắc/Đông/Nam/Tây, bỏ Ngai; bombardiers2/5; furnace1/3gold, neighbour burn25/50%; armory board armor0.04/0.08 chỉ max một nguồn, neighbourHP+10%; drake1/2,cone32/burn4/s30tick.
- [ ] Clock: soldiers4/8; tower5dmg72range10interval +2%AS/s cap100%; workshop1/3gold prewind10/20s; rune+1%AS/s cap30%/stack; bell100tick radius80 buff25/45%AS30tick, L3+stun5; spiders3/7, mỗi150tick hồi1 nếu còn sống<initial; rewind +5s cap30 vĩnh viễn, không reset lúc dời; cannon30/splash18/range104/nhịp40 +1.5%AS/s cap90%; colossus1/2. Test AS cap50%base interval, prewind cộng nhưng ramp từng nguồn cap đúng, nhiều furnace/stat cộng theo §5.3.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/cards/forgeConquest.test.ts src/game/cards/clockConquest.test.ts < /dev/null`; mong không có card/handler.
- [ ] **Step 3: Cài đặt**18 dữ liệu và typed custom ID; `prewind` đi vào resolved setup, đếm lại từ world.tick/10, không nhân dmg đã buff; army clock banner là nguồn khác, không dùng Ngai Clock của người chơi chưa có. Sinh lại nhện giữ sourceUid và cap160/lifetime512.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(cards): forge and clock conquest cards`.

### Task B5:18 thẻ Ánh Trăng/Du Mục và integration chinh phục

**Files:**

- Modify: `src/data/kings/moon.ts`, `src/data/kings/nomad.ts`, `src/data/types.ts`, `src/game/cards/custom/index.ts`, `src/game/run/commands.ts`, `src/game/run/rewards.ts`, `src/game/run/modifiers.ts`, `src/game/run/income.ts`, `src/game/run/battleSetup.ts`, `src/game/battle/behaviours.ts`, `src/ui/realm/calendarModel.ts` (IllegalReason.lastLife → chuỗi Việt để typecheck không đợi D4).
- Create: `src/game/cards/custom/moon.ts`, `src/game/cards/custom/nomad.ts`.
- Test: `src/game/cards/moonConquest.test.ts`, `src/game/cards/nomadConquest.test.ts`, `src/game/cards/conquestCoverage.test.ts` (Create), `src/game/run/conquest.test.ts`.

**Interfaces:**

- Consumes B2 `Content.conquestCards`, B3 `FullRunCardHooks`.
- Produces `MOON_HOOKS`,`NOMAD_HOOKS:Partial<FullRunCardHooks>`; `rollConquestCards(rng:Rng,cards:readonly CardDef[],count:number=3):CardId[]` trong rewards.ts. Giữ `rollConquestOffers(rng,king,count?)` wrapper cho tests G2, dispatch FULL dùng content.conquestCards.

- [ ] **Step 1: Test fail**18 ID L1/L5 §6.10/6.11. Moon: crypt3/7 skeleton revive50%; spire7dmg72range10interval, kill→wraith cap3/8; blood pact sacrifice cấp3→9gold + chuyển bùa đúng order/cap4; blood rune dmg+30/hp−10%; altar offerings×1/3 cap12/20; vampires2/5; circle80/40tick max8; eclipse lives2→1,level+2 clamp5,+5gold; lives1 reject nguyên state (thêm IllegalReason `lastLife` và tiếng Việt); reaper1/2,killHeal10/soulScaling2%.
- [ ] Nomad: riders2/6; horseArchers2/6; stables15/35% cavalry speed/dmg; relocate distance Manhattan2→+1level,1→không, swap giữ uid; bazaar1/3+1 mỗi loại neighbor khác nhau; wind+10speed/+10dmg, movedYear hiện tại→20/20; watchtower7dmg96range12interval +20% mỗi ô mở trống; caravan2/5gold +1 mỗi move max3/năm kể cả swap chỉ tính một hành động; khan2/4. `afterMove` hook dùng cho neutral_move lẫn nomad_relocate, không chỉ thẻ nomad.
- [ ] `all54_have_effect_tests`: expected set54 literal IDs từ §6.6–6.11, mỗi ID map test case kết quả cụ thể, không chỉ grep tên file. `all9_conquest_pools`: 9 unique/phe, sample3 không Ngai, chọn thêm deck/draw rồi chơi được; sáu vua vẫn không chọn chơi; no perk/freeMove của Ngai Nomad. Conquest reward không đi qua content.king(newEnemy).
- [ ] **Step 2: FAIL:** `npx vitest run src/game/cards/moonConquest.test.ts src/game/cards/nomadConquest.test.ts src/game/cards/conquestCoverage.test.ts src/game/run/conquest.test.ts < /dev/null`; mong thiếu thẻ mới và conquest king lookup lỗi.
- [ ] **Step 3: Cài đặt** hooks/cards/rollConquestCards; schema state đã có counters/age/movedYear; soul counter reset theo battle mới, không persist quân sống. Chỉ thêm runtime card dependencies, không unlock/Ngai mới. Foreign cards thưởng chinh phục không vào startDeck của vua player.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(cards): moon and nomad conquest cards and full coverage`.

### Task B6: RULES_FULL, lịch30 và compose coalition/boss entourage

**Files:**

- Modify: `src/data/rules.ts`, `src/game/run/calendar.ts`, `src/game/run/yearFlow.ts`, `src/game/battle/types.ts`, `src/game/battle/compose.ts`, `src/game/run/battleSetup.ts`.
- Create: `src/data/calendar.ts`, `src/game/run/enemyArmy.ts`.
- Test: `src/game/run/fullCalendar.test.ts`, `src/game/run/enemyArmy.test.ts` (Create), `src/game/run/calendar.test.ts`.

**Interfaces:**

- Consumes B2 enemyKings()/enemyRoster and B5 playable conquest, A1 RNG council/quest. Existing `calendarFor(rules:Rules):readonly CalendarSlot[]`, `pickEnemyKings(seed:number,playerKing:KingId,pool:readonly KingId[]):KingId[]`, `slotMultFor(slot:CalendarSlot):number` giữ wrappers.
- Produces Rules.calendar thêm 'full', `RULES_FULL={years:30,calendar:'full',autoStart:false}`; CalendarSlot union thêm `{kind:'king';king:1|2|3|4|5|6;attack:1|2|3}`, `{kind:'coalition';kings:readonly [number,number]}`, `{kind:'boss';boss:BossId;ordinal:1|2|3}`; full slots data theo §3.5 trong data/calendar.ts.
- Produces `pickEnemyKingsWithState(seed:number,playerKing:KingId,pool:readonly KingId[],count:number):{kings:KingId[];rngState:number}`, wrapper cũ count2. `buildYearArmy(state:RunState,content:Content):ArmyPlan` in enemyArmy.ts; ArmyPlan attacker thêm 'coalition'|'boss', optional `kings:readonly KingId[]`, `boss:BossId`, `bossOrdinal:1|2|3`; banner chỉ king slot. `buildBattleSetup` optional boss snapshot do C1 giải, chưa spawn ở task này.

- [ ] **Step 1: Test fail** fullCalendar expected30 slots literal §3.5, mỗi K đúng3 lần cách≥3 năm, coalition23=K1+K2,25=K3+K4,27=K5+K6,28=K1+K4,29=K2+K5; boss10/20/30; sample6 từ8 trừ player, lưu RNG sau shuffle; short/raiders fixtures giữ đúng.
- [ ] `army_budgets`: year1 raiders10EP; boss10 round42×1.5=63,20 round171×1.75=299,30=1382; difficulty0..5 hệ số1+0.1d (§9.2), không tạo UI difficulty G3. Coalition weights giữ nguyên (trùng UnitId gộp sum), banner absent; boss2 K3/K4, boss3 normalized mỗi vua tổng bằng nhau; không dùng floor làm sai tỷ trọng. Hai edges từ năm10, Nomad thêm1, khác nhau. Composition ≤120, zero-cost summon không vào random pool, lvl và surplus đúng §3.6.
- [ ] `preview_equals_setup` mọi slot1..30, army lưu đầu năm, không compose lại trong scene; coalition không tăng attacks/conquest; king lần3 thắng+5gold và3 offers, thua fled; sáu enemy lookup không Unknown king.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/run/fullCalendar.test.ts src/game/run/enemyArmy.test.ts src/game/run/calendar.test.ts < /dev/null`; mong rules.full/type missing và lịch cũ chỉraiders.
- [ ] **Step 3: Cài đặt** signatures trên; full calendar constant ở data, `newRun` FULL sample6 dùng enemy catalog; G1/G2 wrapper và pick order giữ. `buildYearArmy` roster, slot budget, difficulty, banner edge count; lưu calendar RNG sau shuffle; composeArmy vẫn seed army/year local. `buildBattleSetup` không đọc content.king cho coalition/boss. Gate A council/quest bằng rules.calendar==='full'.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(run): full calendar and deterministic coalition armies`.
