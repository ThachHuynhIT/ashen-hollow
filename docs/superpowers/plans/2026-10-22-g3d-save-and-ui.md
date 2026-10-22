# G3d — Lưu ván, UI và nghiệm thu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (hoặc superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lưu/tải checkpoint G3 và chơi được hội đồng, nhiệm vụ, boss ở hai bố cục.

**Architecture:** Codec/migration và SaveStore interface thuần nằm trong game/save; IndexedDB adapter trong platform/storage. Controller nhận persistence port; scene chỉ gửi intents, phục hồi từ state, không gọi newRun khi resume. Tái dùng modal/layout G2.

**Tech Stack:** TypeScript strict · Phaser4 · Vitest · IndexedDB native · fake-indexeddb (dev-only) · Vite.

**Spec:** §5.1/5.5, §9.3, §10.1–10.8, §12–14; A/B/C hoàn thành; [plan tổng](2026-10-22-g3-full-run.md).

## Global Constraints

- Kế thừa toàn bộ Global Constraints tổng; SaveStore game không import DOM IDB/platform; inject dependency từ composition ngoài game.
- DB crowned-kingdoms version 1; store run/current, meta/profile; envelope format 1/state 4; G3 không ghi/xóa meta.
- Save lệnh thành công ngoài trận và vào/ra battle; không lưu từng tick; ended clear; load battle restart0 cùng army/hand/piles/entry autoFire.
- UI vùng chạm ≥44,1280×720/375×812,breakpoint768,close48×48,overlay0.6; reset create/unsubscribe shutdown, chữ Việt/palette/frame rules hiện hành.
- Feature PR develop, không main; không push develop/main.

## Quyết định (của plan này)

1. SaveStore.loadRun trả unknown, codec validate trước controller. Meta interface unknown cho G4, G3 không gọi hoặc migrate meta.
2. Factory inject IDBFactory; fallback giữ snapshot mới nhất RAM và cảnh báo một lần; không hứa RAM survive reload.
3. Continue enabled sau load/validate; busy chống doubleclick. Ván mới thay checkpoint khi Bắt đầu, không xóa chỉ vì mở chọn vua.
4. Scene async dùng generation token: completion của create cũ không điều hướng/hiện toast trong scene mới.

## Review Focus

1. Write1 chậm hơn write2 và clear cuối → FIFO, không hồi sinh ended run (D2/D3).
2. Deck hợp lệ nhưng army/queue có ID thiếu → reject/toast, meta nguyên (D1).
3. Reload pending council/questReward → cùng phase/options/RNG, không cộng reward lần2 (D3/D6).
4. Resize1280→375 giữa modal4 cards → selection giữ, không click xuyên (D4).
5. Resume battle đúng frame launch HUD → chỉ một runner, không thuế/rút lại (D3/D6).

---

### Task D1: Schema save, contentHash, validation và migration thuần

**Files:**

- Create: `src/game/save/types.ts`, `src/game/save/codec.ts`, `src/game/save/migrate.ts`, `src/game/save/MemorySaveStore.ts`, `src/data/save.ts`.
- Test: `src/game/save/codec.test.ts`, `src/game/save/migrate.test.ts`, `src/game/save/MemorySaveStore.test.ts` (Create).

**Interfaces:**

- Consumes state 4 A1 (+paidRerollsThisYear A2), Content allCards/allUnits, hashSeed(value:string):number.
- Produces `SaveEnvelope={formatVersion:1;version:number;contentHash:number;state:RunState}` (version state 4); `LoadRunResult={kind:'ok';state:RunState}|{kind:'empty'}|{kind:'incompatible';message:string}`.
- Produces SaveStore methods `loadRun():Promise<unknown|null>`, `saveRun(save:SaveEnvelope):Promise<void>`, `clearRun():Promise<void>`, `loadMeta():Promise<unknown|null>`, `saveMeta(profile:unknown):Promise<void>`; MemorySaveStore implements, deep clones read/write.
- Produces `contentHash(content:Content):number`, `encodeRun(state:RunState,content:Content):SaveEnvelope`, `decodeRun(raw:unknown,content:Content):LoadRunResult` codec; `migrateRunState(raw:unknown):unknown` migrate; data/save.ts `SAVE_FORMAT_VERSION=1`, DB config, `INCOMPATIBLE_RUN_TEXT='Ván đang chơi không còn tương thích với bản cập nhật này.'`.

- [ ] **Step 1: Test fail:** roundtrip planning/battle/reward/conquest/council/quest/yearEnd, queue/subselection/RNG/piles unchanged; JSON parse/stringify same logical state. `migrate_v3_to4` fixture đúng state 3 baseline: preserve seed/year/rules/hand/piles/army/gold/enemies; add neutral defaults, council/quest seed, building counters/age/movedYear; paidRerollsThisYear=v3.rerollsThisYear. Calendar RNG cũ thiếu state sau shuffle: giữ enemyKings/army, seed calendar cho import vì không shuffle lại giữa ván.
- [ ] `unknown_versions`: state1/2 không migrator,5 future,format2,JSON hỏng→incompatible; hash thêm ID accepts, missing CardId/UnitId rejects. Check deck,piles,plots.building,enchants,offers/queue,councilselection,quests IDs,army waves/boss/enemyKings/kingId, không chỉ deck. Hash match không bỏ qua validation.
- [ ] Schema asserts25plots/throne12,unique uid/nextUid>max,level1..5,stacks1..4,integergold≥0,year≤rules.years,no31,phase consistency,finite numbers/RNGuint32,multiset hand+draw+discard=deck,activequests≤2,attacks0..3. `memory_clones`: sửa caller/load copy không sửa stored. `meta_untouched`: decode/reject không write/clear meta.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/save/codec.test.ts src/game/save/migrate.test.ts src/game/save/MemorySaveStore.test.ts < /dev/null`; mong module thiếu.
- [ ] **Step 3: Cài đặt** contracts; migration chain3→4; accepts tested envelope format 1/version3 và raw state 3 import, không đoán1/2. encode clones; hash JSON sorted IDs đúng công thức tổng; không World/Phaser/Promise/Map/Set trong snapshot.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(save): run codec validation and state migration`.

### Task D2: IndexedDB adapter và transaction fallback

**Files:**

- Create: `src/platform/storage/idbSaveStore.ts`, `src/platform/storage/createSaveStore.ts`.
- Modify: `package.json`, `package-lock.json` (dev dependency fake-indexeddb).
- Test: `src/platform/storage/idbSaveStore.test.ts`, `src/platform/storage/createSaveStore.test.ts` (Create).

**Interfaces:**

- Consumes D1 SaveStore/SaveEnvelope/MemorySaveStore/config.
- Produces `openIdbSaveStore(factory:IDBFactory):Promise<SaveStore>`, `createSaveStore(options:{factory:IDBFactory|null;onWarning:(text:string)=>void}):Promise<SaveStore>`; proxy fallback một chiều sang memory, toast `Trình duyệt này không lưu được tiến trình.` một lần/session. saveRun resolves transaction complete, không request success.

- [ ] **Step 1: Test fail** fake IDB name/version 1, storesrun/meta và keyscurrent/profile, save/load/clear; seededmeta nguyên khi clearRun. OpenSecurityError/blocked,putQuotaExceededError,transactionabort→fallbackRAM+warning1; request success rồi abort không báo saved. factory null fallback. Blocked reject ngay theo plan, không bịa timeout.
- [ ] `memory_mirror`: trước mỗi write clone mới vào RAM; disk load thành công cập nhật mirror; write fail checkpoint mới vẫn load được trong session; không tự ghi disk lại sau fallback. Sequencing A/B/clear dùng deferred store tại D3, adapter chỉ đảm bảo transaction thật complete.
- [ ] **Step 2: FAIL:** `npx vitest run src/platform/storage/idbSaveStore.test.ts src/platform/storage/createSaveStore.test.ts < /dev/null`; mong module/dependency thiếu.
- [ ] **Step 3: Cài đặt** native IDB, factory injection,onerror/onabort/onblocked/versionchange/close; giữ interface meta cho G4 nhưng lifecycle G3 không gọi. Không mở schema version2 để đổi state version4; hai version độc lập.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0.
- [ ] **Step 5: Commit** `feat(platform): indexeddb run storage with memory fallback`.

### Task D3: Persistence coordinator, controller resume và Continue

**Files:**

- Create: `src/game/save/SaveCoordinator.ts`, `src/platform/session.ts`, `src/ui/resumeModel.ts`.
- Modify: `src/game/save/types.ts`, `src/game/run/RunController.ts`, `src/game/events.ts`, `src/scenes/BootScene.ts`, `src/scenes/MainMenuScene.ts`, `src/scenes/KingSelectScene.ts`, `src/scenes/RealmScene.ts`.
- Test: `src/game/save/SaveCoordinator.test.ts`, `src/game/run/RunController.test.ts`, `src/ui/resumeModel.test.ts` (Create where absent).

**Interfaces:**

- Consumes D1 encode/decode/store,D2 factory,B6 RULES_FULL; existing RunController(bus,content,initial), kickoff()/dispose()/update(deltaMs).
- Produces `SessionPersistence={checkpoint(state:RunState):Promise<void>;flush():Promise<void>}` in save/types; class SaveCoordinator constructor `(store:SaveStore,content:Content)` implements, ended queues clear notsave.
- Produces optional fourth constructor arg `persistence?:SessionPersistence`, `RunController.whenIdle():Promise<void>`; kickoff initial battle builds runner once without startBattle command wrongphase; no-port path stays synchronous for G1/G2 tests.
- Produces platform `GameSession={store:SaveStore;persistence:SessionPersistence;load():Promise<LoadRunResult>}`, `createSession(factory:IDBFactory|null,onWarning:(text:string)=>void,content:Content):Promise<GameSession>`; RealmData union `{seed:number;kingId:KingId}|{resume:RunState}` plus injected session in launch composition, game không import platform.
- Produces `resumeTarget(result:LoadRunResult):{enabled:boolean;state:RunState|null;warning:string|null}` ui/resumeModel; scene navigation stays outside game, state commands through ui:command.

- [ ] **Step 1: Test fail** initial/planning successful reroll/buy/play/discard/quest/decree/offer/advance checkpoints; illegal0writes; battleentry1write trước tick0, result1write trước emit new modal; tick/speed/intervene/battle setAutoFire0writes. Clone snapshot không mutate bởi lệnh sau.
- [ ] Deferred writes: hai command nhanh FIFO/no lost state; runner không tick trước entry save complete; A,B,ended→A,B,clear dù A chậm; whenIdle sau flush; dispose ngừng input nhưng không bỏ pending write. Reload battle tick250→world tick0,same setup/hand/army/entry autoFire, toggle giữa trận không lưu; reload modal không income/draw/roll lại. Chỉ Bắt đầu new run mới thay checkpoint.
- [ ] `stale_menu_load`: create2/shutdown1 trước load1 resolve không navigate/enable UI cũ. Continue enabled chỉ valid; invalid toast một lần/clearRun await, không meta; HUD initial launchdata và runner chỉ1.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/save/SaveCoordinator.test.ts src/game/run/RunController.test.ts src/ui/resumeModel.test.ts < /dev/null`; mong port/resume thiếu.
- [ ] **Step 3: Cài đặt** contracts; có persistence thì serialize dispatch async, checkpoint trước run:state/battle start, battle:ended cùng queue; UI busy chặn doubleclick. Nhánh new run của RealmScene gọi `newRun(seed,kingId,CONTENT,RULES_FULL)` tường minh; nhánh resume không gọi newRun/startYear. Storage errors do D2 fallback/toast, không swallow promise vô hạn; load generation token như quyết định4.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0. Browser1280×720/375×812 new run→reload→Continue planning/battle, không lỗi consoleerror/Continue200×52/vùng chạm ≥44; chụp và kiểm IDBcurrent.
- [ ] **Step 5: Commit** `feat(save): checkpoint run commands and resume sessions`.

### Task D4: Council/quest UI và layout4 thẻ

**Files:**

- Create: `src/ui/modals/CouncilModal.ts`, `src/ui/modals/QuestModal.ts`, `src/ui/planning/DecreeQuestPanel.ts`, `src/ui/modals/councilModel.ts`.
- Modify: `src/ui/modals/modalLayout.ts`, `src/ui/modals/RewardModal.ts`, `src/ui/realm/realmLayout.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/RealmScene.ts`, `src/game/events.ts`, `src/ui/planning/HandView.ts`, `src/ui/realm/calendarModel.ts`.
- Test: `src/ui/modals/councilModel.test.ts` (Create), `src/ui/modals/modalLayout.test.ts`, `src/ui/realm/realmLayout.test.ts`.

**Interfaces:**

- Consumes A1offers/commands,A3transactions,A4answerQuest,A5questReward; RewardModal constructor hiện có giữ callbacks nhưng chỉ emitbus.
- Produces `councilLayout(screen:Size,inset:number):{panel:Rect;choices:readonly Rect[];enact:Rect}`, `questLayout(screen:Size,inset:number):{panel:Rect;body:Rect;accept:Rect;decline:Rect}`; existing `rewardLayout(screen:Size,inset:number,count?:number):RewardLayout` thêm mobile4 card2×2.
- Produces `pendingCouncilIntent(state:RunState,selection:CouncilSelection):RunCommand`, `modalKind(state:RunState):'council'|'quest'|'cards'|null` in councilModel. CouncilModal/QuestModal/DecreeQuestPanel constructor `(scene:Phaser.Scene,bus:EventBus<GameEvents>,state:RunState)` + setState(state):void/layout():void/destroy():void; không dispatch trong constructor.

- [ ] **Step 1: Test fail** council3panels300×120 desktop ngang,355×110 mobile dọc,icon32,title “Hội Đồng Hoàng Gia — Năm N”; Ban hành disabled tới chọn. Quest “Sứ giả mang tin…” điều kiện/hạn/thưởng/Nhận/Từchối, wagergold4disabled/5enabled. Subselection Academy2rare,expansion0/1/2,purge0–2occurrence đúng state.
- [ ] Reward4 desktop150×210/card,mobile108×152 2×2,bounds; hand4 dùng cuộn/centerHand hiện có; questReward/conquest không skip,normalreward+3gold. Rect1280×720/375×812/900×600,vùng chạm ≥44; resize giữ selected/decree/plot state; overlay consume worldclick; doubleclick mộtaccepted intent.
- [ ] **Step 2: FAIL:** `npx vitest run src/ui/modals/councilModel.test.ts src/ui/modals/modalLayout.test.ts src/ui/realm/realmLayout.test.ts < /dev/null`; mong thiếu layout hoặc4 cards tràn.
- [ ] **Step 3: Cài đặt** contracts; desktoppanel260px trái y72–520,mobile nútSắc lệnh (§10.4); questdeadline/progress từ state. Esc chỉ hủy ngắm/đóng bảng xem, không bỏ quyết định bắt buộc. Modal lock world, HUD initial data; reset/destroy/off shutdown. IllegalReason.lastLife có chuỗi Việt.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0. Browser hai kích thước council/subselection/quest/rare/4 cards,resize+reload mỗi modal,không lỗi console/vùng chạm ≥44,screenshot.
- [ ] **Step 5: Commit** `feat(ui): council quests and four-choice rewards`.

### Task D5: Lịch30,scout/boss HUD,art và kết quả

**Files:**

- Modify: `src/ui/realm/calendarModel.ts`, `src/ui/planning/CalendarStrip.ts`, `src/ui/modals/CalendarModal.ts`, `src/ui/planning/ScoutPanel.ts`, `src/ui/battle/battleReadout.ts`, `src/ui/info/infoLines.ts`, `src/scenes/BattleHudScene.ts`, `src/scenes/RunEndScene.ts`, `src/render/unitArt.ts`, `src/render/cardArt.ts`, `src/render/atlas.ts`, `src/render/FxRenderer.ts`, `src/render/UnitRenderer.ts`.
- Test: `src/ui/realm/calendarModel.test.ts`, `src/ui/battle/battleReadout.test.ts`, `src/ui/info/infoLines.test.ts`, `src/render/atlas.test.ts`, `src/render/worldArt.test.ts`.

**Interfaces:**

- Consumes B6CalendarSlot/ArmyPlan,C3bossPhase,C4result/stats,A1offers.
- Produces CalendarCell attacker thêmcoalition/boss,optional kings/boss,council:boolean,quest:boolean; giữ calendarCells(state,count)/fullCalendar(rules,enemyKings). `bossReadout(world:BattleWorld):{nameVi:string;hp:number;maxHp:number;phase:string}|null` in battleReadout; `runSummary(state:RunState):readonly string[]` infoLines.

- [ ] **Step 1: Test fail** fullCalendar30/grid6×5,strip28→28..30/30→1;skull10/20/30,council5/10/15/20/25,quest3/7/12/17/22/27;coalition2huy hiệu;scout đúng unit/count/level/edge,boss spawn120,không có banner giả. Bossreadout HP/phase; summary completedYears/conquered/bosses,golden chỉ boss3defeated,crownPoints/unlocks vẫn0/[] G3.
- [ ] Full registered unit/card frames đủ incl3boss/frog/hornet/54 cards,size đúng UnitDef.sprite,palette world/UI đúng; không fake6portraits/thrones. Atlas không dùng height cố định cũ; UNIT_CLOTH fallback. FX chỉ trình bày không damage lần2; info đúng buffs/status.
- [ ] **Step 2: FAIL:** `npx vitest run src/ui/realm/calendarModel.test.ts src/ui/battle/battleReadout.test.ts src/ui/info/infoLines.test.ts src/render/atlas.test.ts src/render/worldArt.test.ts < /dev/null`; mong unknownattacker/frame thiếu.
- [ ] **Step 3: Cài đặt** contracts/calendar6×5 fit≥44; một atlas; placeholder boss48×48/skills,không nhập asset ngoài. RunEnd thống kêG3,không cấp điểm meta giả. Đọc Phaser4 skills scenes/sprites/loading trước code tương lai.
- [ ] **Step 4: PASS** Step2; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0. Browser1280×720/375×812 lịch/scout/boss/status/end,cả3tốc độ,không lỗi console/vùng chạm ≥44,screenshot.
- [ ] **Step 5: Commit** `feat(ui): full calendar boss readouts and full-run art coverage`.

### Task D6: E2E logic,9 run thực và ma trận reload

**Files:**

- Modify: `src/game/sim/headless.ts`, `src/game/sim/bots/random.ts`, `src/game/testing/fixtures.ts`.
- Create/Test: `src/game/sim/fullRun.test.ts`, `src/game/save/resumeIntegration.test.ts`.
- Test: `src/game/run/RunController.test.ts`, `src/game/battle/benchmark.test.ts`.

**Interfaces:**

- Consumes all prior exports; existing `runHeadless(opts:HeadlessOptions,content:Content=CONTENT):HeadlessResult`, `Bot=(state:RunState,content:Content,rng:Rng)=>RunCommand` giữ signature/defaultG1.
- Produces bot đủ phase, giữ HeadlessResult state/commands; fixture `fullRunFixture(seed:number,kingId:KingId):RunState` chỉ test; không production cheat/injectfake simulator.

- [ ] **Step 1: Test fail** `full_run_real_3x3`: wheat/stone/arcane×seeds1/2/3,RULES_FULL,commands<5000,rerun2lần same state/hash,no throw/NaN; log year/won/bosses/capped/time. Assert ended/year≤30 để bắt crash và **gate Done riêng** tất cả9 completedYears30. Chưa tới30 phải report fail,không đổi gate rồi nhận Done.
- [ ] `orchestration30` reducer fixture battleResultwon30trận: council5lần,quest≤6offers,bosscheckpoints10/20/30,no31; không dùng làm chứng cứ9 runthật. Legacy defaultG1/explicitG2 giữ.
- [ ] `resume_matrix`: planning trước/sauplay/reroll,battleentry sau tick>0,reward/conquest/council selected+subselection/quest/questReward/yearEnd; encode→fake IndexedDB→decode→controller cùng future inputs ra same next state. Battle fresh0 so setup entry,không so future manual inputs đã mất. Reload10lần không tax/draw/rewardlặp; endedclear sau pending write,hashaddedIDsaccepts/removedreference rejects.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/sim/fullRun.test.ts src/game/save/resumeIntegration.test.ts src/game/run/RunController.test.ts src/game/battle/benchmark.test.ts < /dev/null`; mong bot thiếuphase/reload mismatch; gate30 có thể fail vì balance và phải báo.
- [ ] **Step 3: Cài đặt** bot hợp lệ choquest/decree/subselection/rare,giá dùng helpers; chỉ tinh chỉnh policy không số gameplay/HP/lives/fakeresult. Nếu9 run không tới30: chưa Done,nêu kết quả cụ thể để chủ sản phẩm quyết định cân bằng,không chefailure.
- [ ] **Step 4: PASS** Step2 khi gates đạt; `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0. Browser cả hai kích thước chơi tay qua boss1+1council,quest,reload planning/battle,resize modal;không lỗi console/vùng chạm ≥44; ghi seed/king/year/tick/screenshot/kết quả,không fixture thay manual.
- [ ] **Step 5: Commit** `test(g3): full-run and persistence acceptance coverage`.

### Task D7: Tài liệu và PR triển khai G3 vào develop

**Files:**

- Modify (triển khai tương lai, không lượt viết plan): `README.md`, `docs/ROADMAP.md`, `docs/GDD.md`, `CLAUDE.md`.
- Test: `src/game/sim/fullRun.test.ts`, `src/game/save/resumeIntegration.test.ts`, `src/game/cards/conquestCoverage.test.ts`, `src/game/run/decrees.test.ts`, `src/game/run/questRewards.test.ts`, `src/game/battle/bogOgre.test.ts`, `src/game/battle/hornetQueen.test.ts`, `src/game/battle/crownlessKing.test.ts` (rerun).

**Interfaces:**

- Consumes D6report/screenshots/suite; Produces tài liệu đúng trạng thái và PR base develop với ma trận Done§14; không export code.

- [ ] **Step 1: Acceptance đỏ trước cập nhật docs:** `npx vitest run src/game/sim/fullRun.test.ts src/game/save/resumeIntegration.test.ts src/game/cards/conquestCoverage.test.ts src/game/run/decrees.test.ts src/game/run/questRewards.test.ts src/game/battle/bogOgre.test.ts src/game/battle/hornetQueen.test.ts src/game/battle/crownlessKing.test.ts < /dev/null`; thiếu gate/manual chứng cứ→chưa Done,không đánh dấu G3✔. Task docs không tạo testfail giả choMarkdown đã đúng.
- [ ] **Step 2: Xác nhận PASS** và checklist§14:3vua×3seed tới30,manualboss1+council,reload planning/battle§9.3,18decree/13quest/3bossskills cótest,54 cardcoverage,giữ G1/G2. Ghi số test/benchmark/caps/fallback/migration/browser/lỗ hổng vào PR; lỗi trả task sở hữu sửa+rerun.
- [ ] **Step 3: Cập nhật** README30năm/Continue/phím/modal;ROADMAP/GDDG3 và54 thẻ kéo sớm đã duyệt,G4cònNgai/chọn vua/perk/meta;CLAUDElayout/exports/state 4/envelope1/platform/rules/commands. Không tự đổi số gameplay/spec; ghi quyết định và phê duyệt phạm vi trong PR.
- [ ] **Step 4: Verify:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit0; `git diff --check`; browser menu→Continue/new run hai kích thước,không lỗi console/vùng chạm ≥44. PR ghi kết quả thực,không chỉ tên lệnh.
- [ ] **Step 5: Commit** `docs: record G3 full-run completion`,stage từng file;push featurebranch,mở PR `--base develop`,không main/không merge. Gh body nhiều dòng dùng file và `--body-file`;attachPR URL bằng tool app. Đây là PR triển khai tương lai,không tự mở trong lượt chỉ viết plan.
