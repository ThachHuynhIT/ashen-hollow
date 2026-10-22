# G3d — Lưu ván, UI và nghiệm thu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (hoặc superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lưu / tải checkpoint G3 và chơi được hội đồng, nhiệm vụ, boss ở hai bố cục.

**Architecture:** Codec / migration và SaveStore interface thuần nằm trong game / save; IndexedDB adapter trong platform / storage. Controller nhận persistence port; scene chỉ gửi intents, phục hồi từ state, không gọi newRun khi resume. Tái dùng modal / layout G2.

**Tech Stack:** TypeScript strict · Phaser 4 · Vitest · IndexedDB native · fake-indexeddb (dev-only) · Vite.

**Spec:** §5.1 / 5.5, §9.3, §10.1–10.8, §12–14; A / B / C hoàn thành; [plan tổng](2026-10-22-g3-full-run.md).

## Global Constraints

- Kế thừa toàn bộ Global Constraints tổng; SaveStore game không import DOM IDB / platform; inject dependency từ composition ngoài game.
- DB crowned-kingdoms version 1; store run / current, meta / profile; envelope format 1 / state 4; G3 không ghi / xóa meta.
- Save lệnh thành công ngoài trận và vào / ra battle; không lưu từng tick; ended clear; load battle restart 0 cùng army / hand / piles / entry autoFire.
- UI vùng chạm ≥ 44, 1280 × 720 / 375 × 812, breakpoint 768, close 48 × 48, overlay 0.6; reset create / unsubscribe shutdown, chữ Việt / palette / frame rules hiện hành.
- Feature PR develop, không main; không push develop / main.

## Quyết định (của plan này)

1. SaveStore.loadRun trả unknown, codec validate trước controller. Meta interface unknown cho G4, G3 không gọi hoặc migrate meta.
2. Factory inject IDBFactory; fallback giữ snapshot mới nhất RAM và cảnh báo một lần; không hứa RAM survive reload.
3. Continue enabled sau load / validate; busy chống doubleclick. Ván mới thay checkpoint khi Bắt đầu, không xóa chỉ vì mở chọn vua.
4. Scene async dùng generation token: completion của create cũ không điều hướng / hiện toast trong scene mới.

## Review Focus

1. Write 1 chậm hơn write 2 và clear cuối → FIFO, không hồi sinh ended run (D2/D3).
2. Deck hợp lệ nhưng army / queue có ID thiếu → reject / toast, meta nguyên (D1).
3. Reload pending council / questReward → cùng phase / options / RNG, không cộng reward lần 2 (D3/D6).
4. Resize 1280 → 375 giữa modal 4 cards → selection giữ, không click xuyên (D4).
5. Resume battle đúng frame launch HUD → chỉ một runner, không thuế / rút lại (D3/D6).

---

### Task D1: Schema save, contentHash, validation và migration thuần

**Files:**

- Create: `src/game/save/types.ts`, `src/game/save/codec.ts`, `src/game/save/migrate.ts`, `src/game/save/MemorySaveStore.ts`, `src/data/save.ts`.
- Test: `src/game/save/codec.test.ts`, `src/game/save/migrate.test.ts`, `src/game/save/MemorySaveStore.test.ts` (Create).

**Interfaces:**

- Consumes state 4 A1 (+paidRerollsThisYear A2), Content allCards / allUnits, hashSeed(value:string):number.
- Produces `SaveEnvelope={formatVersion:1;version:number;contentHash:number;state:RunState}` (version state 4); `LoadRunResult={kind:'ok';state:RunState}|{kind:'empty'}|{kind:'incompatible';message:string}`.
- Produces SaveStore methods `loadRun():Promise<unknown|null>`, `saveRun(save:SaveEnvelope):Promise<void>`, `clearRun():Promise<void>`, `loadMeta():Promise<unknown|null>`, `saveMeta(profile:unknown):Promise<void>`; MemorySaveStore implements, deep clones read / write.
- Produces `contentHash(content:Content):number`, `encodeRun(state:RunState,content:Content):SaveEnvelope`, `decodeRun(raw:unknown,content:Content):LoadRunResult` codec; `migrateRunState(raw:unknown):unknown` migrate; data/save.ts `SAVE_FORMAT_VERSION=1`, DB config, `INCOMPATIBLE_RUN_TEXT='Ván đang chơi không còn tương thích với bản cập nhật này.'`.

- [ ] **Step 1: Test fail:** roundtrip planning / battle / reward / conquest / council / quest / yearEnd, queue / subselection / RNG / piles unchanged; JSON parse / stringify same logical state. `migrate_v3_to4` fixture đúng state 3 baseline: preserve seed / year / rules / hand / piles / army / gold / enemies; add neutral defaults, council / quest seed, building counters / age / movedYear; paidRerollsThisYear=v3.rerollsThisYear. Calendar RNG cũ thiếu state sau shuffle: giữ enemyKings / army, seed calendar cho import vì không shuffle lại giữa ván.
- [ ] `unknown_versions`: state 1 / 2 không migrator, 5 future, format 2, JSON hỏng → incompatible; hash thêm ID accepts, missing CardId / UnitId rejects. Check deck, piles, plots.building, enchants, offers / queue, council selection, quests IDs, army waves / boss / enemyKings / kingId, không chỉ deck. Hash match không bỏ qua validation.
- [ ] Schema asserts 25 plots / throne 12, unique uid / nextUid > max, level 1..5, stacks 1..4, integer gold ≥ 0, year ≤ rules.years, no 31, phase consistency, finite numbers / RNG uint32, multiset hand + draw + discard = deck, active quests ≤ 2, attacks 0..3. `memory_clones`: sửa caller / load copy không sửa stored. `meta_untouched`: decode / reject không write / clear meta.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/save/codec.test.ts src/game/save/migrate.test.ts src/game/save/MemorySaveStore.test.ts < /dev/null`; mong module thiếu.
- [ ] **Step 3: Cài đặt** contracts; migration chain 3 → 4; accepts tested envelope format 1 / version 3 và raw state 3 import, không đoán 1 / 2. encode clones; hash JSON sorted IDs đúng công thức tổng; không World / Phaser / Promise / Map / Set trong snapshot.
- [ ] **Step 4: PASS** Step 2; **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0.
- [ ] **Step 5: Commit** `feat(save): run codec validation and state migration`.

### Task D2: IndexedDB adapter và transaction fallback

**Files:**

- Create: `src/platform/storage/idbSaveStore.ts`, `src/platform/storage/createSaveStore.ts`.
- Modify: `package.json`, `package-lock.json` (dev dependency fake-indexeddb).
- Test: `src/platform/storage/idbSaveStore.test.ts`, `src/platform/storage/createSaveStore.test.ts` (Create).

**Interfaces:**

- Consumes D1 SaveStore / SaveEnvelope / MemorySaveStore / config.
- Produces `openIdbSaveStore(factory:IDBFactory):Promise<SaveStore>`, `createSaveStore(options:{factory:IDBFactory|null;onWarning:(text:string)=>void}):Promise<SaveStore>`; proxy fallback một chiều sang memory, toast `Trình duyệt này không lưu được tiến trình.` một lần / session. saveRun resolves transaction complete, không request success.

- [ ] **Step 1: Test fail** fake IDB name / version 1, stores run / meta và keys current / profile, save / load / clear; meta đã seed nguyên khi clearRun. open SecurityError / blocked, put QuotaExceededError, transaction abort → fallback RAM + warning 1; request success rồi abort không báo saved. factory null fallback. Blocked reject ngay theo plan, không bịa timeout.
- [ ] `memory_mirror`: trước mỗi write clone mới vào RAM; disk load thành công cập nhật mirror; write fail checkpoint mới vẫn load được trong session; không tự ghi disk lại sau fallback. Sequencing A / B / clear dùng deferred store tại D3, adapter chỉ đảm bảo transaction thật complete.
- [ ] **Step 2: FAIL:** `npx vitest run src/platform/storage/idbSaveStore.test.ts src/platform/storage/createSaveStore.test.ts < /dev/null`; mong module / dependency thiếu.
- [ ] **Step 3: Cài đặt** native IDB, factory injection, onerror / onabort / onblocked / versionchange / close; giữ interface meta cho G4 nhưng lifecycle G3 không gọi. Không mở schema version 2 để đổi state version 4; hai version độc lập.
- [ ] **Step 4: PASS** Step 2; **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0.
- [ ] **Step 5: Commit** `feat(platform): indexeddb run storage with memory fallback`.

### Task D3: Persistence coordinator, controller resume và Continue

**Files:**

- Create: `src/game/save/SaveCoordinator.ts`, `src/platform/session.ts`, `src/ui/resumeModel.ts`.
- Modify: `src/game/save/types.ts`, `src/game/run/RunController.ts`, `src/game/events.ts`, `src/scenes/BootScene.ts`, `src/scenes/MainMenuScene.ts`, `src/scenes/KingSelectScene.ts`, `src/scenes/RealmScene.ts`.
- Test: `src/game/save/SaveCoordinator.test.ts`, `src/game/run/RunController.test.ts`, `src/ui/resumeModel.test.ts` (Create where absent).

**Phạm vi task:** 10 file production, không vượt ngưỡng 10: giữ coordinator / controller / session / Continue cùng task vì checkpoint barrier và resume phải được kiểm end-to-end. Unit tests vẫn tách queue, controller và model UI.

**Interfaces:**

- Consumes D1 encode / decode / store,D2 factory,B6 RULES_FULL; existing RunController(bus, content, initial), kickoff()/dispose()/update(deltaMs).
- Produces `SessionPersistence={checkpoint(state:RunState):Promise<void>;flush():Promise<void>}` in save / types; class SaveCoordinator constructor `(store:SaveStore,content:Content)` implements, ended queues clear không save.
- Produces optional fourth constructor arg `persistence?:SessionPersistence`, `RunController.whenIdle():Promise<void>`; kickoff initial battle builds runner once without startBattle command wrong phase; no-port path stays synchronous for G1/G2 tests.
- Produces platform `GameSession={store:SaveStore;persistence:SessionPersistence;load():Promise<LoadRunResult>}`, `createSession(factory:IDBFactory|null,onWarning:(text:string)=>void,content:Content):Promise<GameSession>`; RealmData union `{seed:number;kingId:KingId}|{resume:RunState}` plus injected session in launch composition, game không import platform.
- Produces `resumeTarget(result:LoadRunResult):{enabled:boolean;state:RunState|null;warning:string|null}` ui / resumeModel; scene navigation stays outside game, state commands through ui:command.

- [ ] **Step 1: Test fail** initial / planning successful reroll / buy / play / discard / quest / decree / offer / advance checkpoints; illegal 0 writes; battle entry 1 write trước tick 0, result 1 write trước emit new modal; tick / speed / intervene / battle setAutoFire 0 writes. Clone snapshot không mutate bởi lệnh sau.
- [ ] Deferred writes: hai command nhanh FIFO / no lost state; runner không tick trước entry save complete; A, B, ended → A, B, clear dù A chậm; whenIdle sau flush; dispose ngừng input nhưng không bỏ pending write. Reload battle tick 250 → world tick 0, same setup / hand / army / entry autoFire, toggle giữa trận không lưu; reload modal không income / draw / roll lại. Chỉ Bắt đầu new run mới thay checkpoint.
- [ ] `stale_menu_load`: create 2 / shutdown 1 trước load 1 resolve không navigate / enable UI cũ. Continue enabled chỉ valid; invalid toast một lần / clearRun await, không meta; HUD initial launch data và runner chỉ 1.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/save/SaveCoordinator.test.ts src/game/run/RunController.test.ts src/ui/resumeModel.test.ts < /dev/null`; mong port / resume thiếu.
- [ ] **Step 3: Cài đặt** contracts; có persistence thì serialize dispatch async, checkpoint trước run:state / battle start, battle:ended cùng queue; UI busy chặn doubleclick. Nhánh new run của RealmScene gọi `newRun(seed,kingId,CONTENT,RULES_FULL)` tường minh; nhánh resume không gọi newRun / startYear. Storage errors do D2 fallback / toast, không swallow promise vô hạn; load generation token như quyết định 4.
- [ ] **Step 4: PASS** Step 2; **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0. Browser 1280 × 720 / 375 × 812 new run → reload → Continue planning / battle, không lỗi console / Continue 200 × 52 / vùng chạm ≥ 44; chụp và kiểm IDBcurrent.
- [ ] **Step 5: Commit** `feat(save): checkpoint run commands and resume sessions`.

### Task D4: Council / quest UI và layout 4 thẻ

**Files:**

- Create: `src/ui/modals/CouncilModal.ts`, `src/ui/modals/QuestModal.ts`, `src/ui/planning/DecreeQuestPanel.ts`, `src/ui/modals/councilModel.ts`.
- Modify: `src/ui/modals/modalLayout.ts`, `src/ui/modals/RewardModal.ts`, `src/ui/realm/realmLayout.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/RealmScene.ts`, `src/game/events.ts`, `src/ui/planning/HandView.ts`, `src/ui/realm/calendarModel.ts`.
- Test: `src/ui/modals/councilModel.test.ts` (Create), `src/ui/modals/modalLayout.test.ts`, `src/ui/realm/realmLayout.test.ts`.

**Phạm vi task:** 12 file production: giữ lớp modal, pure layout, HUD và bus cùng task để không có UI gửi intent chưa được phase / router xử lý. Tests layout / model và kiểm trình duyệt là hai lớp kiểm riêng.

**Interfaces:**

- Consumes A1 offers / commands, A3 transactions, A4 answerQuest, A5 questReward và B5 `IllegalReason.lastLife` cùng chuỗi Việt đã có; RewardModal constructor hiện có giữ callbacks nhưng chỉ emit bus.
- Produces `councilLayout(screen:Size,inset:number):{panel:Rect;choices:readonly Rect[];enact:Rect}`, `questLayout(screen:Size,inset:number):{panel:Rect;body:Rect;accept:Rect;decline:Rect}`; existing `rewardLayout(screen:Size,inset:number,count?:number):RewardLayout` thêm mobile 4 card 2 × 2.
- Produces `pendingCouncilIntent(state:RunState,selection:CouncilSelection):RunCommand`, `modalKind(state:RunState):'council'|'quest'|'cards'|null` in councilModel. CouncilModal / QuestModal / DecreeQuestPanel constructor `(scene:Phaser.Scene,bus:EventBus<GameEvents>,state:RunState)` + setState(state):void / layout():void / destroy():void; không dispatch trong constructor.

- [ ] **Step 1: Test fail** council: 3 panel 300 × 120 desktop ngang, 355 × 110 mobile dọc, icon 32, title “Hội Đồng Hoàng Gia — Năm N”; Ban hành disabled tới chọn. Quest “Sứ giả mang tin…” điều kiện / hạn / thưởng / Nhận / Từ chối, wager gold 4 disabled / 5 enabled. Subselection Academy 2 rare, expansion 0 / 1 / 2, purge 0–2 occurrence đúng state.
- [ ] Reward 4 desktop 150 × 210 / card, mobile 108 × 152 2 × 2, bounds; hand 4 dùng cuộn / centerHand hiện có; questReward / conquest không skip, normal reward + 3 gold. Rect 1280 × 720 / 375 × 812 / 900 × 600, vùng chạm ≥ 44; resize giữ selected / decree / plot state; overlay consume world click; doubleclick một intent được chấp nhận intent.
- [ ] **Step 2: FAIL:** `npx vitest run src/ui/modals/councilModel.test.ts src/ui/modals/modalLayout.test.ts src/ui/realm/realmLayout.test.ts < /dev/null`; mong thiếu layout hoặc 4 cards tràn.
- [ ] **Step 3: Cài đặt** contracts; desktop panel 260 px trái y 72–520, mobile nút Sắc lệnh (§10.4); quest deadline / progress từ state. Esc chỉ hủy ngắm / đóng bảng xem, không bỏ quyết định bắt buộc. Modal lock world, HUD initial data; reset / destroy / off shutdown. Chỉ hiển thị `IllegalReason.lastLife` do B5 sở hữu; không mở rộng lại union hoặc thêm bản dịch thứ hai.
- [ ] **Step 4: PASS** Step 2; **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0. Browser hai kích thước council / subselection / quest / rare / 4 cards, resize + reload mỗi modal, không lỗi console / vùng chạm ≥ 44, screenshot.
- [ ] **Step 5: Commit** `feat(ui): council quests and four-choice rewards`.

### Task D5: Lịch 30, scout / boss HUD, art và kết quả

**Files:**

- Modify: `src/ui/realm/calendarModel.ts`, `src/ui/planning/CalendarStrip.ts`, `src/ui/modals/CalendarModal.ts`, `src/ui/planning/ScoutPanel.ts`, `src/ui/battle/battleReadout.ts`, `src/ui/info/infoLines.ts`, `src/scenes/BattleHudScene.ts`, `src/scenes/RunEndScene.ts`, `src/render/unitArt.ts`, `src/render/cardArt.ts`, `src/render/atlas.ts`, `src/render/FxRenderer.ts`, `src/render/UnitRenderer.ts`.
- Test: `src/ui/realm/calendarModel.test.ts`, `src/ui/battle/battleReadout.test.ts`, `src/ui/info/infoLines.test.ts`, `src/render/atlas.test.ts`, `src/render/worldArt.test.ts`.

**Phạm vi task:** 13 file production: cập nhật cùng một union attacker / boss và frame catalog từ model tới render. Giữ một task để không xuất hiện Unknown frame / attacker trong ván G3; các tests model, atlas và info vẫn chạy độc lập.

**Interfaces:**

- Consumes B6 CalendarSlot / ArmyPlan, C3 bossPhase, C4 result / stats, A1 offers.
- Produces CalendarCell attacker thêm coalition / boss, optional kings / boss, council:boolean, quest:boolean; giữ calendarCells(state, count)/fullCalendar(rules, enemyKings). `bossReadout(world:BattleWorld):{nameVi:string;hp:number;maxHp:number;phase:string}|null` in battleReadout; `runSummary(state:RunState):readonly string[]` infoLines.

- [ ] **Step 1: Test fail** fullCalendar 30 / grid 6 × 5, strip 28 → 28..30 / 30 → 1; skull 10 / 20 / 30, council 5 / 10 / 15 / 20 / 25, quest 3 / 7 / 12 / 17 / 22 / 27; coalition 2 huy hiệu; scout đúng unit / count / level / edge, boss spawn 120, không có banner giả. Boss readout HP / phase; summary completedYears / conquered / bosses, golden chỉ boss 3 defeated, crownPoints / unlocks vẫn 0/[] G3.
- [ ] Full registered unit / card frames đủ incl 3 boss / frog / hornet / 54 cards, size đúng UnitDef.sprite, palette world / UI đúng; không fake 6 portraits / thrones. Atlas không dùng height cố định cũ; UNIT_CLOTH fallback. FX chỉ trình bày không damage lần 2; info đúng buffs / status.
- [ ] **Step 2: FAIL:** `npx vitest run src/ui/realm/calendarModel.test.ts src/ui/battle/battleReadout.test.ts src/ui/info/infoLines.test.ts src/render/atlas.test.ts src/render/worldArt.test.ts < /dev/null`; mong unknown attacker / frame thiếu.
- [ ] **Step 3: Cài đặt** contracts / calendar 6 × 5 fit ≥ 44; một atlas; placeholder boss 48 × 48 / skills, không nhập asset ngoài. RunEnd thống kê G3, không cấp điểm meta giả. Đọc Phaser 4 skills scenes / sprites / loading trước code tương lai.
- [ ] **Step 4: PASS** Step 2; **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0. Browser 1280 × 720 / 375 × 812 lịch / scout / boss / status / end, cả 3 tốc độ, không lỗi console / vùng chạm ≥ 44, screenshot.
- [ ] **Step 5: Commit** `feat(ui): full calendar boss readouts and full-run art coverage`.

### Task D6: E2E logic, 9 run thật, bot scripted và ma trận reload

**Files:**

- Modify: `src/game/sim/headless.ts`, `src/game/sim/bots/random.ts`, `src/game/testing/fixtures.ts`.
- Create: `src/game/sim/bots/scripted.ts`.
- Create / Test: `src/game/sim/fullRun.test.ts`, `src/game/save/resumeIntegration.test.ts`, `src/game/sim/bots/scripted.test.ts`.
- Test: `src/game/run/RunController.test.ts`, `src/game/battle/benchmark.test.ts`.

**Phạm vi task:** 4 file production (headless, random bot, scripted bot, test fixtures), không vượt ngưỡng 10. Giữ task tích hợp vì 9 run, run scripted và reload matrix dùng cùng harness; test files không tính là production.

**Interfaces:**

- Consumes A5 quest / year flow, B6 RULES_FULL, C4 kết quả boss và D1–D5 save / UI contracts; `runHeadless(opts:HeadlessOptions,content:Content=CONTENT):HeadlessResult` và `Bot=(state:RunState,content:Content,rng:Rng)=>RunCommand` giữ chữ ký / default G1.
- Produces fixture `fullRunFixture(seed:number,kingId:KingId):RunState` trong testing / fixtures (chỉ test), bot random hỗ trợ đủ phase và `scriptedBot:Bot` trong bots/scripted.ts. Không thay cấu trúc HeadlessResult, không inject kết quả trận giả vào production headless.

- [ ] **Step 1: Test fail:** `full_run_real_3x3` chạy wheat / stone / arcane × seeds [1, 2, 3] với RULES_FULL, mỗi case chạy lại hai lần. Assert `phase === 'ended'`, `won` là boolean (thắng hoặc thua), `year <= 30`, commands < 5000, mọi số hữu hạn, không throw / NaN / treo và state / hash / commands giống nhau khi chạy lại. Báo seed, vua, năm đạt được, won, bosses, capped và thời gian từng run. Không assert cả 9 run tới năm 30.
- [ ] `orchestration30`: reducer fixture với 30 battleResult thắng kiểm luồng năm 30, không năm 31, đúng 5 hội đồng, tối đa 6 quest offers và boss checkpoints 10 / 20 / 30. Fixture không được dùng làm bằng chứng 9 run thật hoặc chứng cứ chơi tay. Giữ regression default G1 và explicit G2.
- [ ] `resume_matrix`: planning trước / sau play / reroll, battle entry sau tick > 0, reward / conquest / council selected + subselection / quest / questReward / yearEnd. Encode → fake IndexedDB → decode → controller với cùng future inputs phải ra cùng next state; battle load ở tick 0 so với setup entry, không phục hồi input giữa trận đã mất. Reload 10 lần không thuế / rút bài / reward lặp; ended clear sau pending write, hash thêm ID nhận và reference mất bị từ chối.
- [ ] **Step 2: FAIL:** `npx vitest run src/game/sim/fullRun.test.ts src/game/save/resumeIntegration.test.ts src/game/run/RunController.test.ts src/game/battle/benchmark.test.ts < /dev/null`; mong bot thiếu phase hoặc resume mismatch. Lỗi test phải thuộc luật, termination, determinism hoặc save; thua sớm hợp lệ không phải lỗi gate.
- [ ] **Step 3: Cài đặt:** hoàn thiện bot random cho quest / decree / subselection / rare; đọc giá từ helper. Headless chỉ dùng applyCommand và mô phỏng thật; không đổi số gameplay, HP, lives hoặc kết quả trận để đạt gate.
- [ ] **Step 3b: Bot scripted và run thật:** viết `scriptedBot:Bot` theo policy deterministic: trong planning, nếu autoFire đang tắt thì gửi `setAutoFire` bật một lần; nếu played thì `startBattle`. Nếu chưa played, ưu tiên chơi / nâng cấp troop hoặc tower hợp lệ (tie handIndex rồi plot), tiếp đến economy / support, sau đó bùa / sách có target hợp lệ đầu tiên. Khi không có play hợp lệ, discard handIndex 0 nếu tay còn lá; tay trống thì startBattle. Không reroll hoặc mua ô lặp vô hạn. Modal thẻ chọn index hợp lệ nhỏ nhất; quest nhận nếu đủ phí, không đủ thì từ chối. Council ưu tiên decree_mobilize, rồi decree_royal_armory nếu được offer, sau đó index nhỏ nhất; lựa chọn phụ lấy ô/card/occurrence hợp lệ theo thứ tự plot/CardId/deckIndex, gửi setCouncilSelection rồi enactDecree. Bot không bỏ qua validation của applyCommand. `scripted_legal_commands` chạy từng intent qua applyCommand, assert không error và input state không bị bot sửa; cùng seed cho cùng command trace. Chạy một run thật với vua stone, seed 1, RULES_FULL, ghi năm đạt được và việc vào trận năm 10 (boss 1). Nếu không đạt năm 10, báo đúng kết quả trong PR; không giả kết quả, không đổi số gameplay và không làm thất bại cổng 9 run kết thúc hợp lệ chỉ vì mốc chẩn đoán này chưa đạt. Kiểm riêng bằng `npx vitest run src/game/sim/bots/scripted.test.ts < /dev/null`.
- [ ] **Step 4: PASS** lệnh Step 2 và test scripted; **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0. Browser cả hai kích thước: chơi tay qua boss 1 và một hội đồng, quest, reload planning / battle, resize modal; không lỗi console, vùng chạm ≥ 44 px. Ghi seed / king / year / tick / screenshot / kết quả; không dùng fixture thay manual.
- [ ] **Step 5: Commit** `test(g3): full-run and persistence acceptance coverage`.

### Task D7: Tài liệu và PR triển khai G3 vào develop

**Files:**

- Modify (triển khai tương lai, không lượt viết plan): `README.md`, `docs/ROADMAP.md`, `docs/GDD.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` (chỉ sửa dòng phạm vi G3/G4 khi thực thi D7).
- Test: `src/game/sim/fullRun.test.ts`, `src/game/save/resumeIntegration.test.ts`, `src/game/cards/conquestCoverage.test.ts`, `src/game/run/decrees.test.ts`, `src/game/run/questRewards.test.ts`, `src/game/battle/bogOgre.test.ts`, `src/game/battle/hornetQueen.test.ts`, `src/game/battle/crownlessKing.test.ts`, `src/game/sim/bots/scripted.test.ts` (rerun).

**Interfaces:**

- Consumes D6 report / screenshots / suite; Produces tài liệu đúng trạng thái và PR base develop với ma trận Done §14; không export code.

- [ ] **Step 1: Acceptance đỏ trước cập nhật docs:** `npx vitest run src/game/sim/fullRun.test.ts src/game/save/resumeIntegration.test.ts src/game/cards/conquestCoverage.test.ts src/game/run/decrees.test.ts src/game/run/questRewards.test.ts src/game/battle/bogOgre.test.ts src/game/battle/hornetQueen.test.ts src/game/battle/crownlessKing.test.ts < /dev/null`; thiếu gate / manual chứng cứ → chưa Done, không đánh dấu G3✔. Task docs không tạo test fail giả cho Markdown đã đúng.
- [ ] **Step 2: Xác nhận PASS** và checklist §14 theo quyết định chủ sản phẩm: 9 run thật đều kết thúc hợp lệ, thắng hoặc thua, year ≤ 30 và deterministic khi chạy lại; PR có bảng năm đạt được của từng vua / seed. `orchestration30` chứng minh năm 30 / không năm 31 / 5 hội đồng / boss 10–20–30. Ghi riêng run bot scripted (stone, seed 1) đã tới năm 10 hay chưa; chưa đạt thì báo cáo, không giả kết quả. Giữ bằng chứng manual boss 1 + council, reload planning / battle §9.3, tests 18 decree / 13 quest / 3 boss skills, 54 card coverage và regression G1/G2. Ghi số test / benchmark / caps / fallback / migration / browser / lỗ hổng vào PR; lỗi trả task sở hữu sửa và chạy lại.
- [ ] **Step 3: Cập nhật** README luật 30 năm / Continue / phím / modal; ROADMAP / GDD trạng thái thực tế; CLAUDE layout / exports / state 4 / envelope 1 / platform / rules / commands. **Sửa spec §14 G3/G4 để khớp:** dòng G3 ghi 9 thẻ chinh phục của mỗi vua mới (54 thẻ) và cơ chế chơi chúng; dòng G4 chỉ còn Ngai / bị động, perk, chọn vua và meta của sáu vua mới, không làm lại thẻ. Không đổi số gameplay hoặc phần spec khác. Trong mô tả PR thực thi, ghi rõ phạm vi 54 thẻ đã chốt, rare nhiệm vụ chỉ có 2 lựa chọn khi bể có 2, và timeout 900 tick là thắng trận nhưng Vương Miện Vàng chỉ khi boss bị hạ. Lượt sửa plan này không sửa spec / CLAUDE.md.
- [ ] **Step 4: Verify:** **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` exit 0; `git diff --check`; browser menu → Continue / new run hai kích thước, không lỗi console / vùng chạm ≥ 44. PR ghi kết quả thực, không chỉ tên lệnh.
- [ ] **Step 5: Commit** `docs: record G3 full-run completion`, stage từng file; push feature branch, mở PR `--base develop`, không main / không merge. Gh body nhiều dòng dùng file và `--body-file`; attach PR URL bằng tool app. Đây là PR triển khai tương lai, không tự mở trong lượt chỉ viết plan.
