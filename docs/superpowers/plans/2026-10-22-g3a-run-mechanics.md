# G3a — State, hội đồng và nhiệm vụ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (hoặc superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm state JSON4 và reducer kiểm thử được cho18 sắc lệnh,13 nhiệm vụ và vòng hậu trận đúng thứ tự.

**Architecture:** Tiếp tục `applyCommand`, `startYear`, income/modifiers hiện có; tách reducer nhỏ theo cơ chế. Offers dùng discriminated union và queue lưu được; không có platform hoặc Phaser ở lớp luật.

**Tech Stack:** TypeScript strict · Vitest; không thư viện runtime mới.

**Spec:** spec tổng §3.1–3.10, §4.2, §5.1–5.5, §7.1/7.2, §14 G3; đọc [plan tổng](2026-10-22-g3-full-run.md) và G2c trước.

## Global Constraints

- Áp dụng từng dòng Global Constraints và Quyết định1–14 của plan tổng; các giá trị ở đó là hợp đồng chung, không override ở plan con.
- Logic thuần không Phaser/platform/UI; data-driven, không wall clock/random ngoài Rng; `applyCommand` không sửa input; giữ RULES_G1/G2/defaults.
- Tick10/s; maxLevel5, maxStack4; council5/10/15/20/25; quest3/7/12/17/22/27; maxActive2; mọi UI mới là G3d.
- Cuối từng task: lint/typecheck/test/build exit0, commit feature branch, không push develop/main.

## Quyết định (của plan này)

1. Dùng `yearEnd` hiện có làm checkpoint nội bộ; không tạo public `yearStart` command chỉ để khớp tên trong sơ đồ spec. Nhiệm vụ chặn trước refill; `finishYearStart` chỉ được gọi một lần.
2. Mỗi reward quest chọn thẻ là `questReward`, dùng stream reward và pool §3.8 lọc rare; queue giữ order nhận quest. Quest fee/settlement đi qua state, không callback UI.
3. Snapshot progress gồm baseline tại lúc nhận (unlocked count, reroll count, sacrifice level), không suy ngược từ board cuối; bộ đếm event được serialize.

## Review Focus

1. Quest ở năm cuối hạn vừa hoàn thành vừa hết hạn → hoàn thành thắng, không reward2 lần (A5).
2. Bàn Tay Thứ Tư + Thanh Lọc còn3 bản → refill3, không tạo card giả hoặc mất multiset (A3).
3. Đặt Cược vàng4/5 → reject không mutation hoặc nhận trừ5 chính xác (A4).
4. Council sau thua năm5 còn1 mạng và sau thua hết mạng → lần lượt council/ended (A5).
5. Pending expansion thứ2 sau khi mở thứ1 → tính lại adjacency trong transaction, replay không mở lần nữa (A3).

---

### Task A1: State4 và hợp đồng flow mới, giữ tương thích G1/G2

**Files:**

- Modify: `src/game/run/state.ts`, `src/game/run/yearFlow.ts`, `src/game/run/commands.ts`, `src/game/sim/bots/random.ts`, `src/data/types.ts`, `src/data/rules.ts` (thêm discriminant full, chưa bật luật), `src/scenes/PlanningHudScene.ts`, `src/ui/modals/offerModel.ts` (chỉ narrow union, chưa tạo UI cơ chế mới).
- Create: `src/game/run/flow.ts`.
- Test: `src/game/run/flow.test.ts`, `src/game/run/yearFlow.test.ts`, `src/game/run/commands.test.ts`.
- Modify fixtures/Test khi thêm required BuildingState fields: `src/game/run/battleSetup.test.ts`, `src/game/run/battleSetupG2.test.ts`, `src/game/run/board.test.ts`, `src/game/run/boardG2.test.ts`, `src/game/cards/cards.effects.test.ts`, `src/game/run/income.test.ts`, `src/ui/info/infoLines.test.ts`, `src/game/run/modifiers.test.ts`, `src/game/run/playable.test.ts`, `src/ui/planning/targetHints.test.ts`, `src/ui/cards/cardText.test.ts`, `src/game/run/playG2.test.ts`, `src/game/battle/g2Determinism.test.ts`; thêm ageBonus0/counters{}/movedYearnull, không đổi expected gameplay.

**Interfaces:**

- Consumes: `newRun(seed:number, kingId:KingId, content:Content, rules:Rules=RULES_G1):RunState`, `startYear(state:RunState, content:Content):RunState`, `applyCommand(input:RunState, cmd:RunCommand, content:Content):CommandResult`; `CommandResult={state:RunState;events:RunEvent[]}|{error:IllegalReason}` đã có.
- Produces in `state.ts`: `RUN_SAVE_VERSION=4`; `DecreeId`/`QuestId` template literal unions liệt kê đóng đủ ID §7 ở `src/data/types.ts`; `QuestState={id:QuestId;offeredYear:number;deadlineYear:number;status:'active'|'completed'|'failed';progress:Record<string,number>}`; `CouncilSelection={plots:number[];cardId:CardId|null;deckIndices:number[]}`.
- Produces `CardOfferState={kind:'reward'|'conquest'|'questReward';cardIds:CardId[];king?:KingId;questId?:QuestId}`; `OfferState=CardOfferState|{kind:'council';decreeIds:DecreeId[];selected:DecreeId|null;selection:CouncilSelection}|{kind:'quest';questId:QuestId}`. Giữ shape cardIds hiện có trong nhánh card, narrow mọi consumer hiện có trước khi đọc. `offerTitle` trong offerModel nhận `Pick<CardOfferState,'kind'|'king'>`, không Pick toàn union.
- Produces state fields: `decrees:DecreeId[]`, `quests:QuestState[]`, `offeredQuestIds:QuestId[]`, `pendingOffers:OfferState[]`, `freeRerollsLeft:number`, `interventionDmgPct:number`, `difficulty:number` (=0 cho G3), `yearStartPendingDraw:boolean`; building thêm `ageBonus:number`, `counters:Record<string,number>`, `movedYear:number|null`; stats thêm `bossesWon:number`, `bossesDefeated:BossId[]`, `completedYears:number`; `BossId` đóng ba ID §7.3. RNG thêm council/quest; army vẫn seed từng năm, không tạo global RNG army giả.
- Produces commands thêm `{type:'chooseDecree';index:number} | {type:'setCouncilSelection';selection:CouncilSelection} | {type:'enactDecree'} | {type:'answerQuest';accept:boolean}`; dùng `pickOffer` cho questReward; phase thêm council/quest. `enqueueOffers(state:RunState, offers:readonly OfferState[]):RunState`, `finishYearStart(state:RunState,content:Content):RunState` ở flow. Các hàm thuần trả bản sao.

- [ ] **Step 1: Viết test fail:** `new_state4_defaults` assert version4, difficulty0, decrees/quests/queue rỗng, boss count0, council/quest RNG đúng hash seed; `g1_g2_regression` assert rules years10/15, autoStart true/false, card multiset deck=hand+drawPile+discardPile; `pending_draw_once` assert năm3 quest phase trước rút và finish draw lần2 không thay RNG/hand. Dùng fixture thủ công cho queue trước khi A4 cung cấp quest roll.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/run/flow.test.ts src/game/run/yearFlow.test.ts src/game/run/commands.test.ts < /dev/null`; mong thiếu field/export hoặc version nhận3.
- [ ] **Step 3: Cài đặt** exports trên và khởi tạo đủ fields ở `newRun`; narrow union tại `commands.ts` và bot hiện có; không implement hiệu ứng decree/quest trong task này. Queue mở offer đầu, shift sau khi resolve, không roll lại. `startYear` tách chuẩn bị năm và refill để A4 chen quest ở bước5 §5.5; giữ đường G1/G2 hiện hành.
- [ ] **Step 4: PASS:** cùng lệnh Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit0.
- [ ] **Step 5: Commit** các Files bằng đường dẫn cụ thể: `refactor(run): define versioned full-run state and offer queue`.

### Task A2: Dữ liệu18 sắc lệnh và modifier/thu nhập thường trực

**Files:**

- Create: `src/data/decrees.ts`, `src/game/run/decrees.ts`.
- Modify: `src/game/run/modifiers.ts`, `src/game/run/income.ts`, `src/game/run/battleSetup.ts`, `src/game/run/commands.ts`, `src/game/run/yearFlow.ts`, `src/data/run.ts`, `src/game/battle/types.ts`, `src/game/battle/world.ts`, `src/game/battle/intervention.ts`.
- Test: `src/game/run/decrees.test.ts`, `src/game/run/modifiers.test.ts`, `src/game/battle/intervention.test.ts`.

**Interfaces:**

- Consumes A1 fields; `collectStatSheet(state:RunState,content:Content,plot:number,unit?:UnitDef):StatSheet`, `finalStat(base:number,cell:StatCell):number`, `yearIncome(state,content,goldBefore,handlers?):YearIncome` giữ signature hiện có.
- Produces `DecreeDef={id:DecreeId;nameVi:string;textVi:string;effects:readonly EffectDef[];action:'none'|'expand'|'crown'|'amnesty'|'treasury'|'academy'|'purge'|'runeFestival'}` và `DECREES:readonly DecreeDef[]` ở data; các giá trị runtime không biểu diễn bằng EffectDef nằm `DECREE_RULES` data (hand4,freeReroll1,reward4,boulder50/radius8,cooldown30,moat10).
- Produces `decree(id:DecreeId):DecreeDef`, `handLimit(state:RunState):number`, `rewardCount(state:RunState):number`, `rerollPrice(state:RunState):number`, `interventionStats(state:RunState):{dmgPct:number;radius:number;cooldownTicks:number}` trong decrees.ts. BattleSetup thêm optional `intervention:{dmgPct:number;radius:number;cooldownTicks:number}`; absent giữ legacy.

- [ ] **Step 1: Test fail** `all_18_decrees_unique` so set đủ ID §7.1 và count18; `decree_stat_matrix` table cases: mobilize militia4→5; armory DMG5→5.5; newArmor HP32→36.8; archers tower range88→100 và throne72→84; moat speed1→0.9; tax +2/năm sau phí duy trì, trại thiếu vàng vẫn idle trước thuế.
- [ ] Test `free_reroll_paid_sequence`: miễn phí đầu rồi trả1,2,4; giữ `rerollsThisYear` theo số lần trả phí hoặc thêm paid counter rõ trong state, không dùng tổng lượt làm sai giá; quest Tiết Kiệm vẫn đếm cả lần miễn phí. `fourth_hand` refill4, `trade` reward4 unique bằng `rollOffers` count đã có; `boulder_modifiers` base năm1 dmg40→60, radius24→32, cooldown150→105; cộng quest20% vào cùng pct thành70%, trần cooldown reduction60%→60 ticks (§7.4).
- [ ] **Step 2: FAIL:** `npx vitest run src/game/run/decrees.test.ts src/game/run/modifiers.test.ts src/game/battle/intervention.test.ts < /dev/null`; mong count0/missing exports hoặc giá/số sai.
- [ ] **Step 3: Cài đặt** signatures trên; bổ sung `paidRerollsThisYear:number` khởi tạo0 trong A1 state/year reset (version4 đang phát triển, không phát hành giữa task). Modifier decree sau Ngai trước permanent theo §5.3; mỗi decree một nguồn, không mutate data. Intervention setup chốt đầu trận, auto/manual cùng radius/cooldown. `rerollPrice` dùng paid count; `rerollsThisYear` tiếp tục đếm tổng để quest. FULL mới reset free quota đầu năm; G1/G2 không có decree nên giữ giá cũ.
- [ ] **Step 4: PASS** lệnh Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(run): decree catalog and persistent modifiers`.

### Task A3: Council roll và transaction cho lựa chọn phụ

**Files:**

- Modify: `src/game/run/decrees.ts`, `src/game/run/commands.ts`, `src/game/run/flow.ts`, `src/game/run/rewards.ts`.
- Test: `src/game/run/council.test.ts` (Create).

**Interfaces:**

- Consumes A1 `CouncilSelection`, queue và commands; A2 `decree`; existing `levelUpBuilding(plots:readonly PlotState[],plot:number,amount:number):PlotState[]`.
- Produces `rollCouncil(state:RunState):RunState`, `selectDecree(state:RunState,index:number):RunState|IllegalReason`, `setCouncilSelection(state:RunState,selection:CouncilSelection,content:Content):RunState|IllegalReason`, `enactDecree(state:RunState,content:Content):RunState|IllegalReason` trong decrees.ts; dispatch qua applyCommand, không emit UI trực tiếp.

- [ ] **Step 1: Test fail** `roll_three_unowned` ở năm5/10/15/20/25:3 unique từ18 trừ sở hữu, chỉ council RNG đổi, reload không roll lại; `choose_not_enact` chọn chỉ ghi pending, gold/plots/decrees chưa đổi.
- [ ] `immediate_decrees`: crown level4→5,5→5 đồng bộ throne building; treasury +15; amnesty lives3→4,4→4/+10gold; festival first enchant stacks3→4,4→4, không động bùa thứ2.
- [ ] `expansion_transaction`: chọn2 ô hợp lệ theo thứ tự adjacency sau mở thứ1, purchasedPlots không tăng; sai ô thứ2 trả badTarget và nguyên input; còn1/full board dùng1/0. `academy`: đúng2 rare vua hiện tại, chọn1 thêm deck và drawPile đầu, không consume play. `purge_duplicates`: chọn indices của2 bản cùng CardId chỉ xóa2 occurrence qua hand/draw/discard theo thứ tự hand→draw→discard; không xóa mọi bản; reject nếu deck còn<3, chọn0 hợp lệ, thứ tự indices normalize trước splice; multiset luôn đúng. `double_enact` sai phase lần2, không cộng15 lần2.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/run/council.test.ts < /dev/null`; mong missing council reducer/phase.
- [ ] **Step 3: Cài đặt** transaction không áp trước commit; `rollCouncil` dùng `Rng(state.rng.council)` và lưu state RNG sau sample, không dùng stream reward. Subselection schema đã có, command payload không tin client. Đủ bước thì `enactDecree` áp một lần, nối queue; no-op target vẫn cho xác nhận; reject command không consume RNG.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(run): council offers and atomic decree enactment`.

### Task A4: Quest catalog, đề nghị và theo dõi tiến độ

**Files:**

- Create: `src/data/quests.ts`, `src/game/run/quests.ts`.
- Modify: `src/game/run/yearFlow.ts`, `src/game/run/commands.ts`, `src/game/run/flow.ts`.
- Test: `src/game/run/quests.test.ts` (Create).

**Interfaces:**

- Consumes A1 `QuestState`, `offeredQuestIds`, pending draw và `answerQuest`; A2 tổng rerolls; existing board actions.
- Produces data `QuestDef={id:QuestId;nameVi:string;textVi:string;duration:number;rewardTextVi:string;acceptGold:number}`, `QUESTS:readonly QuestDef[]` (13 rows §7.2), `QUEST_RULES` chứa ngưỡng/reward đúng spec.
- Produces `offerQuest(state:RunState):RunState`, `answerQuest(state:RunState,accept:boolean,content:Content):RunState|IllegalReason`, `recordQuestCommand(before:RunState,after:RunState,command:RunCommand,content:Content):RunState`, `settleQuests(state:RunState,result:BattleResult|null,at:'afterBattle'|'yearEnd',content:Content):RunState` trong quests.ts (settlement triển khai A5).

- [ ] **Step 1: Test fail** `quest_years_and_capacity`: chỉ năm3/7/12/17/22/27, active2 không offer, completed/failed không chiếm slot; `declined_not_reoffered` vẫn thêm offeredQuestIds; RNG quest thay đổi, draw/reward không đổi trước trả lời; answer xong mới refill đúng handLimit.
- [ ] `wager_fee_atomic`: gold4 accept→notEnoughGold, toàn state/RNG giữ; gold5→0, deadline=offeredYear+2−1; decline gold giữ5. `progress_events`: mua ô và Khai Hoang đều cộng landGrab, bắt đầu từ baseline lúc nhận; reroll miễn phí vẫn phá noReroll; sacrifice ghi level trước xóa; dời/nhân bản không ghi nhầm thành sacrifice. Không ghi command thất bại.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/run/quests.test.ts < /dev/null`; mong missing catalogue hoặc không có quest phase.
- [ ] **Step 3: Cài đặt** offer/answer/record signatures; đặt offer giữa thu nhập và refill §5.5; active progress keys `rerolls`, `opened`, `sacrificeLevel`, `winsInRow`, `failedCondition` với baseline0 lúc nhận. Skeleton settlement chỉ được return state cho đến A5, chưa bật full rules vào UI.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(run): quest offers and deterministic progress tracking`.

### Task A5: Đủ13 quest reward và nối thứ tự năm/hậu trận

**Files:**

- Modify: `src/game/run/quests.ts`, `src/game/run/flow.ts`, `src/game/run/commands.ts`, `src/game/run/yearFlow.ts`, `src/game/run/rewards.ts`, `src/game/sim/bots/random.ts`.
- Test: `src/game/run/questRewards.test.ts`, `src/game/run/fullFlow.test.ts` (Create).

**Interfaces:**

- Consumes A1–A4; existing `rollOffers(rng:Rng,year:number,pools:RewardPools,count?:number):CardId[]`.
- Produces completed `settleQuests(...)`; `advanceAfterBattle(state:RunState,content:Content):RunState`, `finishYear(state:RunState,content:Content):RunState` ở flow; `rollRareOffers(rng:Rng,pools:RewardPools,count:number):CardId[]` rewards. `BattleResult` thêm optional `goldDelta?:number` (default0 cho legacy fixtures); C4 bổ sung boss flags. `pickOffer` resolve questReward không +skip gold và không skip; no silent reward loss.

- [ ] **Step 1: Test fail** table-driven test13 rows dưới đây; mỗi row kiểm true boundary, false boundary, reward một lần, deadline `offered+N−1`, input immutable. Rare fixture có≥3 rare đã hỗ trợ, không meta. Source share65/35 như §3.8, chỉ rare, không hạ rarity; hết nguồn đổi nguồn, thiếu3 trả số còn lại theo quyết định an toàn, không loop vô hạn.

| QuestId suffix | Điều kiện/assert                                          | Hạn | Reward assert (§7.2)                        |
| -------------- | --------------------------------------------------------- | --: | ------------------------------------------- |
| untouched      | won && throneHpLostPct=0, giá trị1 không đạt              |   1 | gold+6                                      |
| three_barracks | troop buildings3 đạt,2 chưa                               |   3 | queue questReward3 rare unique              |
| no_reroll      | không reroll tới cuối hạn, kể cả free                     |   3 | gold+8 chỉ cuối hạn                         |
| slaughter      | kills100 đạt,99 chưa                                      |   3 | deck/draw thêm neutral_promote1             |
| double_rune    | tổngstack2 đạt; chọn plot nhỏ nhất nếu nhiều              |   2 | first enchant+1, full4 thì gold+4           |
| land_grab      | mở mới2,1 chưa                                            |   3 | gold+10                                     |
| master_builder | level4 đạt,3 chưa                                         |   4 | minLevel nonthrone+1, tie plot; full5 no-op |
| blitz          | won && ticks300 đạt,301 chưa                              |   2 | gold+5                                      |
| hoard          | yearEnd gold20 đạt,19 chưa                                |   3 | gold+5                                      |
| no_help        | won && interventionsUsed0, tự bắn1 cũng không đạt         |   2 | interventionDmgPct+20                       |
| offering       | một sacrifice level3                                      |   3 | gold+4+3=7                                  |
| diversity      | đủ troop/tower/economy/support, Ngai không thay support   |   3 | lives2→3; lives3/4 giữ, gold+8              |
| wager          | hai won liên tiếp sau nhận; một lost fail, không hoàn phí |   2 | gold+15                                     |

- [ ] `late_year_boundaries`: council sau thua còn mạng, mất mạng cuối→ended ngay; quest xong đúng năm hạn→completed, chưa xong→failed; queue questReward→reward→conquest→council; council ngay năm10 sau boss settlement; năm30 không năm31. `snapshot_offer_reload` clone state ở mỗi queue bước rồi resolve cùng command cho kết quả giống hệt, RNG không roll lần2. `multiple_quests_order` reward thứ nhất có thể tác động quest thứ hai theo order nhận, mỗi quest xử lý một lần.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/run/questRewards.test.ts src/game/run/fullFlow.test.ts < /dev/null`; mong reward thiếu hoặc begin() nhảy năm trước council.
- [ ] **Step 3: Cài đặt** signatures trên; thay các begin trực tiếp sau reward/conquest bằng advance queue; `finishYear` kiểm quest cuối hạn rồi end/year advance. Cộng goldDelta trước check quest; ordinary reward/conquest rules cũ giữ nếu không FULL. Bot trả command hợp lệ cho quest/council/subselection, không gọi reducer khác để lách flow.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(run): settle all quests and full post-battle sequence`.
