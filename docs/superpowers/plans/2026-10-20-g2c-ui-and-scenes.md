# G2c — Giao diện G2 (chọn vua, lịch, vàng, đổi/bán bài, mua ô, chinh phục, art) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chơi được G2 trong trình duyệt: chọn 1 trong 3 vua, thấy vàng, lịch 15 năm và đạo quân (vua địch, cờ hiệu), đổi bài / bán bài / mua ô / chơi mọi loại thẻ (công trình lên cấp, Bùa, sách phép), nhận thưởng và thẻ chinh phục, trên cả 1280×720 và 375×812.

**Architecture:** Logic trình bày thuần (kích thước, mô hình ô lịch, giá ô khóa, lý do bất hợp pháp bằng tiếng Việt) nằm trong `src/ui/*` và có Vitest; các lớp Phaser (`PlanningHudScene`, `RealmScene`, `CardView`, modal, `KingSelectScene`) chỉ vẽ và gửi lệnh qua `EventBus`. Art vẫn là placeholder sinh bằng code, chỉ dùng `PALETTE`/`UI_PALETTE`.

**Tech Stack:** TypeScript strict · Phaser 4 (đọc `.claude/skills/*/SKILL.md` trước khi viết mã Phaser, bắt đầu từ `v3-to-v4-migration`) · Vitest · Vite.

**Spec:** `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` §3.4–3.8, §4.4, §10.1, §10.3–10.6, §11. **Điều kiện đầu vào:** G2a và G2b xong (`docs/superpowers/plans/2026-10-20-g2a-core-mechanics.md`, `docs/superpowers/plans/2026-10-20-g2b-battle-and-content.md`) và Phần A của `docs/superpowers/plans/2026-10-20-g2-depth.md` (camera chung, `HandView` tay biến thiên, `InfoPanel`, `centerHand`).

## Global Constraints

- UI: khung 9-slice từ texture `ui` qua `createPanel`; nút `createButton`; tooltip `Tooltip` (hover, hoặc bấm giữ 400 ms trên cảm ứng); hộp tự co `ContentBox`; mọi vùng chạm ≥ 44×44 logic; `width ≥ 768` dùng bố cục desktop; tính lại vị trí trong `layout()` khi resize; chữ `FONT_UI` tiếng Việt (có dấu); màu thế giới chỉ từ `PALETTE`, màu UI chỉ từ `UI_PALETTE`.
- Camera zoom nguyên khi đứng yên; sprite neo ở chân, y-sort, không xoay; sprite chỉ gọi bằng tên frame qua các hàm `*Frame(...)` trong `src/render/atlas.ts`.
- Scene dùng lại instance: reset trường per-game ở đầu `create()`; scene `launch` truyền trạng thái đầu qua launch data, không dựa vào sự kiện phát trong `create`.
- UI chỉ đọc state và gửi lệnh qua `EventBus` (`ui:command`); không gọi `applyCommand` từ scene. Không import ngược từ `src/game` vào `src/ui`/`src/render` ngoài các hàm thuần đã export.
- Tiếng Việt cho mọi chữ người chơi thấy; id trong code là tiếng Anh.
- Cuối **mọi** task: `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` đều exit 0; với task có scene, thêm bước kiểm trình duyệt (`preview_*`) ở cả 1280×720 và 375×812, console không lỗi, vùng chạm ≥ 44 px (đo bằng `preview_inspect`). Commit bằng `git add` từng đường dẫn; message kết thúc bằng dòng trống rồi `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Quyết định (của plan này)

1. **Chọn vua** chỉ có 3 ô (Lúa Mì, Đá Núi, Phép Thuật), không perk, không độ khó (§14); các ô còn lại của lưới 3×3 ẩn.
2. **Nút "Bán bài (+2)"** = lệnh `discard` của lá đang chọn (G2a Quyết định 2); phím `S`. "Đổi bài (N vàng)" = `reroll`, phím `R`, N lấy từ `rerollCost`.
3. **Mua ô:** bấm ô khóa kề ô mở khi **không** đang ngắm thẻ → hiện giá `unlockCost(purchasedPlots)` và ✓/✕; ✓ gửi `unlockPlot`. Khi đang ngắm Khai Hoang thì ô khóa là mục tiêu thẻ, không phải mua.
4. **Lịch:** 5 ô (năm nay + 4 năm tới, tối đa tới năm 15); phím/nút `L` mở bảng lịch 15 năm (lưới 5×3). Ô lịch hiện số năm, huy hiệu màu vua tấn công + chấm lần 1–3, hoặc biểu tượng Thổ Phỉ.
5. **Không** có cột Sắc lệnh/Nhiệm vụ, nút Sắc lệnh (G3).
6. Chân dung vua là art placeholder sinh bằng code (`portraitArt.ts`, chỉ `UI_PALETTE`/màu chủ của vua).

## Review Focus

1. Mọi nút mới ở mọi trạng thái (vàng thiếu, tay trống, đã chơi) vẫn ≥ 44×44, không đè nhau và không tràn màn ở 1280×720, 375×812 và một cỡ lạ (900×600) (Task 2, 3).
2. Resize trình duyệt khi đang mở modal (thưởng/chinh phục/lịch/Bộ bài) và khi đang chọn thẻ → bố cục và lựa chọn vẫn đúng (Task 3, 6).
3. Bấm ô khóa khi đã chọn một thẻ khác loại, hoặc bấm ô khóa không kề → không gửi lệnh, tooltip giải thích bằng tiếng Việt (Task 5).
4. Hết vàng giữa chừng (reroll liên tiếp tới 0) → nút chuyển mờ có tooltip "Không đủ vàng", không gửi lệnh bị từ chối (Task 3).
5. Thẻ có tên hoặc mô tả dài (Khởi Nghĩa Nông Dân, Tháp Đại Pháp Sư) không tràn khỏi thẻ ở cả hai kích thước (Task 4).

---

### Task 1: Art cho nội dung G2

**Files:**
- Modify: `src/render/unitArt.ts` (`UNIT_CLOTH` cho mọi `UnitId` G2; hỗ trợ sprite 24×24/24×32 cho `golem`, `archmage`), `src/render/buildingArt.ts` (`paintBuilding` nhận thêm `'economy' | 'support'`, `accent` theo màu chủ vua), `src/render/cardArt.ts` (ảnh thẻ cho Bùa, sách, kinh tế, hỗ trợ), `src/render/iconArt.ts` (thêm `'gold' | 'level' | 'enchant' | 'reroll' | 'sell' | 'lock' | 'conquer'`), `src/render/atlas.ts` (dựng frame từ `CONTENT.allCards()`/`allUnits()`)
- Create: `src/render/portraitArt.ts` (`paintPortrait(king: KingDef): PixelCanvas`, 48×48)
- Test: `src/render/worldArt.test.ts`, `src/render/atlas.test.ts`

- [ ] **Step 1: Viết test thất bại:** mọi pixel của mọi sprite/ảnh/icon/chân dung mới nằm trong `PALETTE` (thế giới) hoặc `UI_PALETTE` (thẻ, icon, chân dung); với mọi thẻ trong `CONTENT.allCards()` tồn tại frame `buildingFrame`/`cardArtFrame` tương ứng và mọi `UnitId` có đủ frame `idle/walk/attack` cho cả hai phe (`unitFrame`); kích thước đúng `UnitDef.sprite`; hai thẻ khác nhau cùng loại có ảnh khác nhau (băm pixel khác).
- [ ] **Step 2: Chạy `npm test < /dev/null -- src/render`**, thấy FAIL. **Step 3: Cài đặt** placeholder deterministic (cùng seed → cùng pixel; dùng `pixelHash`/`PixelCanvas` có sẵn). **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(render): art for G2 buildings, units, cards, icons, portraits`.

### Task 2: Bố cục thuần của HUD G2

**Files:**
- Modify: `src/ui/realm/realmLayout.ts` (`PlanningLayout` thêm `gold`, `calendar: readonly Rect[]` (5 ô 52×52), `scoutButton` (mobile), `reroll`, `sell`, `deck`; giữ `fight`), `src/ui/hud/layout.ts` (nếu cần hằng chung)
- Create: `src/ui/realm/calendarModel.ts`
- Test: `src/ui/realm/realmLayout.test.ts`, `src/ui/realm/calendarModel.test.ts`

**Interfaces:**
- Produces: `calendarCells(state: Pick<RunState, 'year' | 'rules' | 'enemyKings' | 'enemies'>, count: number): CalendarCell[]` với `CalendarCell = { year: number; attacker: 'raiders' | KingId; attack: 1 | 2 | 3 | null; current: boolean }` (dùng `calendarFor` của G2a); `fullCalendar(rules, enemyKings): CalendarCell[]`; `lockedPlotPrice(state: Pick<RunState, 'purchasedPlots'>): number` (= `unlockCost`); `illegalText(reason: IllegalReason): string` (tiếng Việt cho mọi lý do §4.4: `locked`, `throne`, `occupied`, `maxLevel`, `noBuilding`, `wrongKind`, `stacksFull`, `noTarget`, `notEnoughGold`, `notAdjacent`, `badTarget`…).
- Bố cục theo §10.4: desktop — Mạng 120×52 trái trên, Vàng 120×52 cạnh Mạng, Năm 160×52 giữa trên, 5 ô lịch phải trên, Trinh sát 260 px cột phải (y 92–520), hai nút 140×52 xếp dọc bên trái hàng bài ("Đổi bài", "Bán bài"), bên phải "Bộ bài" và "Ra trận" (200×56 thay chỗ tay bài sau khi hành động); mobile — Mạng 96×48, Vàng 96×48, Năm phần còn lại của hàng 1; hàng 2: lịch + nút Trinh sát 52×52; hàng nút y 452–500: "Bộ bài", "Đổi bài", "Bán bài" 84×48.

- [ ] **Step 1: Viết test thất bại:** ở 1280×720, 375×812 và 900×600 mọi rect mới ≥ 44×44 (ô lịch 52×52), nằm trong màn, không chồng nhau và không chồng bàn cờ/hàng bài/`scout`; `calendarCells` năm 3 trả 5 ô năm 3..7 và ô đầu `current`; năm 14 chỉ trả 2 ô (không quá `rules.years`); `fullCalendar` đúng 15 ô; huy hiệu vua và chấm lần tấn công khớp `calendarFor`; `illegalText` có chuỗi không rỗng cho mọi `IllegalReason`.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** thuần, không Phaser. **Step 4: PASS** + bộ lệnh kiểm cuối task. **Step 5: Commit** `feat(ui): G2 planning layout and calendar model`.

### Task 3: HUD lập kế hoạch G2 (vàng, lịch, đổi/bán bài, Bộ bài, Ra trận)

**Files:**
- Modify: `src/scenes/PlanningHudScene.ts`, `src/ui/planning/ScoutPanel.ts` (tên vua + cờ hiệu), `src/ui/theme.ts` (chỉ nếu cần widget chung)
- Create: `src/ui/planning/CalendarStrip.ts`, `src/ui/modals/CalendarModal.ts`, `src/ui/modals/DeckModal.ts`
- Test: `src/ui/modals/modalLayout.test.ts` (mở rộng cho hai modal mới)

**Interfaces:**
- Consumes: `calendarCells`/`fullCalendar`/`illegalText` ở Task 2; lệnh `reroll`, `discard`, `unlockPlot`, `startBattle` ở G2a.
- [ ] **Step 1: Viết test thất bại** cho `modalLayout` của Lịch (lưới 5×3) và Bộ bài (desktop 6 cột 96×134, mobile 3 cột; có huy hiệu ×N, tab lọc theo loại, cuộn kéo): ô không tràn panel, vùng chạm ≥ 44, cuộn kẹp đúng, ở cả hai kích thước.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** panel Vàng (số + icon `gold`); `CalendarStrip` 5 ô, bấm ô → tooltip, nút/phím `L` mở `CalendarModal`; nút "Đổi bài (N vàng)" (phím `R`) và "Bán bài (+2)" (phím `S`, bật khi đã chọn thẻ) với trạng thái mờ + tooltip "Không đủ vàng"/"Chọn một thẻ để bán"; nút "Bộ bài (n)" (phím `D`) mở `DeckModal` đếm theo `CardId` từ `state.deck`; "Ra trận" hiện khi `rules.autoStart === false` và đã hành động (Phần A) — với `RULES_G2` luôn có mặt, Enter kích hoạt; `ScoutPanel` hiện tên kẻ tấn công (vua + cờ hiệu, hoặc Thổ Phỉ) và mép/mũi tên đã có. Mọi modal: nền phủ `outline` alpha 0.6, nút ✕ 48×48, Esc đóng, tính lại khi resize.
- [ ] **Step 4: PASS** + bộ lệnh kiểm cuối task; kiểm trình duyệt cả hai kích thước: bấm lịch, mở Bộ bài, đổi bài tới hết vàng. **Step 5: Commit** `feat(planning-hud): gold, calendar, reroll, sell, deck, start battle`.

### Task 4: Thẻ (`CardView`), tooltip và gợi ý mục tiêu

**Files:**
- Modify: `src/ui/cards/CardView.ts`, `src/ui/planning/targetHints.ts`, `src/ui/planning/HandView.ts`
- Test: `src/ui/planning/targetHints.test.ts`, `src/ui/cards/cardText.test.ts` (tạo, cho hàm thuần tách từ `CardView`)

**Interfaces:**
- Produces: `cardBadge(card: CardDef, willLevelUpTo: Level | null): string | null` ("Lên cấp N"); `nextLevelLine(card: CardDef, level: Level): string | null` (dòng "Cấp sau: …" từ `describeCard(def, level + 1)` khi cấp < 5); `plotHighlights(plots, card, picked, ctx)` mở rộng: công trình → ô trống mở `good`, ô cùng `CardId` cấp < 5 `good` (kèm nhãn lên cấp), còn lại `bad`; Bùa → công trình hợp `targets` còn chỗ `good`, còn lại `bad`; sách theo `target`; mỗi ô `bad` mang `IllegalReason` để tooltip hiện `illegalText`.
- [ ] **Step 1: Viết test thất bại:** `plotHighlights` cho từng loại thẻ trên một bàn cờ dựng tay (bao gồm Bùa lên ô trống, Bùa đủ stack, công trình trùng cấp 5, sách `buildingThenBuilding` bước hai); `cardBadge` trả "Lên cấp 2" khi chơi trùng; `nextLevelLine` null ở cấp 5; mọi thẻ G2 có dòng đầu `describeCard` ≤ 2 dòng sau khi cắt "…" ở độ rộng thẻ 120 và 108 px (hàm đo thuần bằng số ký tự tối đa).
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** `CardView` vẽ frame theo độ hiếm, icon loại (thêm economy/support/bùa/sách), chấm cấp hoặc huy hiệu, cắt mô tả; tooltip đầy đủ dùng `describeCard` + `nextLevelLine`; `HandView` hiện tới 3 lá (đã biến thiên từ Phần A). **Step 4: PASS** + bộ lệnh kiểm cuối task; chụp tay bài cả hai kích thước. **Step 5: Commit** `feat(ui): card view, tooltips and target hints for all G2 card kinds`.

### Task 5: Luồng chơi thẻ và mua ô trong `RealmScene`

**Files:**
- Modify: `src/scenes/RealmScene.ts`, `src/render/BoardRenderer.ts` (nhãn giá trên ô khóa kề ô mở, vòng sáng lên cấp, chấm Bùa), `src/scenes/PlanningHudScene.ts` (nút "Dùng" cho sách `none`, dòng hướng dẫn hai mục tiêu)
- Test: `src/ui/planning/targetHints.test.ts` (bổ sung), `src/ui/realm/realmLayout.test.ts` (vị trí ✓/✕ cho mọi ô)

- [ ] **Step 1: Viết test thất bại:** `confirmFor` đặt ✓/✕ trong màn cho mọi ô 0..24 ở hai kích thước; luồng chọn mục tiêu thuần (`targetCount`, `checkTargetStep` đã có) đủ cho `buildingThenBuilding`; hàm thuần `lockedPlotTap(state, selected): { kind: 'buy'; price: number } | { kind: 'ignore' } | { kind: 'target' }` trả `buy` chỉ khi không chọn thẻ và ô khóa kề ô mở, `target` khi đang ngắm sách `lockedPlot`, `ignore` còn lại.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** xem trước "Dân Quân → Cấp 2: 6 lính" ở tooltip ✓/✕; sách `none` dùng nút "Dùng"; mua ô gửi `unlockPlot` sau ✓ (không đặt `played`); `BoardRenderer` vẽ chấm Bùa (số stack) và cấp từng công trình. **Step 4: PASS** + bộ lệnh kiểm cuối task; kiểm trình duyệt: chơi trùng nâng cấp, gắn Bùa, dời nhà, mua ô, bán bài. **Step 5: Commit** `feat(realm): play flows for levels, enchantments, tomes and plot purchase`.

### Task 6: Thưởng, chinh phục và luồng sau trận

**Files:**
- Modify: `src/ui/modals/RewardModal.ts` (nút "Bỏ qua (+3 vàng)", tiêu đề theo `offers.kind`), `src/scenes/BattleHudScene.ts` (bảng tổng kết hiện vàng nhận được), `src/scenes/RealmScene.ts` (`onContinue` cho phase `conquest`), `src/scenes/PlanningHudScene.ts`
- Test: `src/ui/modals/modalLayout.test.ts`

- [ ] **Step 1: Viết test thất bại:** `modalLayout` cho thưởng 3 lựa chọn và chinh phục (không nút Bỏ qua) ở hai kích thước: thẻ không tràn, nút ≥ 44 px; hàm thuần `offerTitle(offers: OfferState, kings: …): string` ("Phần thưởng — chọn 1 thẻ" / "Chinh phục {tên vua} — chọn 1 thẻ").
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** chuỗi `reward → conquest → năm sau` nối đúng với `phase` của `RunState`; chinh phục bắt buộc chọn; `pickOffer` gửi qua bus; resize giữa modal giữ lựa chọn. **Step 4: PASS** + bộ lệnh kiểm cuối task; kiểm trình duyệt bằng ván headless tới trận thắng lần 3 của một vua. **Step 5: Commit** `feat(ui): reward skip gold and conquest modal flow`.

### Task 7: Chọn vua, menu và màn kết thúc ván

**Files:**
- Create: `src/scenes/KingSelectScene.ts`, `src/ui/kingSelectLayout.ts`
- Modify: `src/scenes/MainMenuScene.ts` ("Ván mới" → Chọn vua), `src/scenes/RealmScene.ts` (`RealmData { seed, kingId }`), `src/scenes/RunEndScene.ts` (số vua đã chinh phục, vàng kiếm được), `src/scenes/keys.ts`, `src/main.ts` (đăng ký scene)
- Test: `src/ui/kingSelectLayout.test.ts`

- [ ] **Step 1: Viết test thất bại:** `kingSelectLayout` ở 1280×720 và 375×812: lưới 3 ô (desktop `slot` 96×96 bên trái; mobile 100×100 phía trên), panel chi tiết (desktop 560 px; mobile cuộn dọc), hàng 9 thẻ nhỏ cuộn ngang (72×100), hàng seed + "Đổi seed" ≥ 44 px, nút **Bắt đầu** (200×52 desktop, 355×56 ghim đáy mobile); không rect nào chồng hoặc tràn.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt:** chọn ô → panel hiện tên, một dòng lối chơi, mô tả Ngai (từ `describeCard`), 9 thẻ; **Bắt đầu** truyền `{ seed, kingId }` cho `RealmScene`; seed ngẫu nhiên hiển thị và đổi được; `RunEndScene` đọc `state.stats`. **Step 4: PASS** + bộ lệnh kiểm cuối task; kiểm trình duyệt cả hai kích thước: menu → chọn từng vua → vào ván. **Step 5: Commit** `feat(scenes): king select, menu flow, run end stats`.

### Task 8: HUD trận và bảng thông tin cho G2

**Files:**
- Modify: `src/scenes/BattleHudScene.ts` (panel Vàng cạnh Mạng), `src/ui/info/infoLines.ts` (cấp, chấm Bùa, thông số xung/khiên/khiêu khích), `src/render/UnitRenderer.ts` (thanh khiên), `src/render/FxRenderer.ts` (hiệu ứng xung, khiên, choáng)
- Test: `src/ui/info/infoLines.test.ts`, `src/render/worldArt.test.ts` (fx mới chỉ dùng `PALETTE`)

- [ ] **Step 1: Viết test thất bại:** `buildingInfoLines` hiện cấp, từng Bùa và số stack, và dòng `describeCard` cấp hiện tại; `entityInfoLines` hiện khiên hiện tại khi > 0, "Choáng" khi đang choáng; frame fx `pulse`, `shield`, `stun` tồn tại và chỉ dùng `PALETTE`.
- [ ] **Step 2: Chạy test, FAIL.** **Step 3: Cài đặt** theo Interfaces; `FxRenderer` xử lý sự kiện `pulse`/`shield` mới của G2b. **Step 4: PASS** + bộ lệnh kiểm cuối task; kiểm trình duyệt: Tim Núi xung choáng, Vòng Kết Giới, địch Kết Giới có khiên. **Step 5: Commit** `feat(battle-hud): gold, shield bars, pulse effects, richer info panel`.

### Task 9: Tài liệu và kiểm tra "Done khi" của G2

**Files:**
- Modify: `README.md`, `docs/ROADMAP.md`, `docs/GDD.md`, `CLAUDE.md`, `docs/ART_STYLE.md` (nếu thêm frame/art quy ước)

- [ ] **Step 1:** README: phím tắt mới (`R` đổi bài, `S` bán bài, `D` Bộ bài, `L` lịch, `Enter` Ra trận), luật vàng/cấp/Bùa/chinh phục ngắn gọn, tiến độ G2 ✔; ROADMAP: đánh dấu G2 xong, ghi lỗ hổng còn lại; GDD: cập nhật phần trạng thái; CLAUDE.md: layout `src/game` (calendar, income, modifiers, custom), `RULES_G2`, `KINGS_G2`.
- [ ] **Step 2: Kiểm "Done khi" (spec §14 G2):** (a) cả ba vua chơi được tới năm 15 trong trình duyệt ở hai bố cục (một ván thắng, một thua) và qua headless (`runHeadless` 3 vua × 3 seed); (b) mỗi thẻ G2 có test hiệu ứng (đếm `cards.effects.test.ts` đủ 6 neutral + 9 + 9 + 3 Ngai); (c) chinh phục cả hai vua trong một ván thử và nhận thẻ của họ; (d) đổi bài và mua ô trừ vàng đúng công thức (`rerollCost`, `unlockCost`); (e) bố cục §10.3–10.6 (Chọn vua, thưởng, chinh phục) đúng hai kích thước. Ghi kết quả vào mô tả PR.
- [ ] **Step 3: Commit** `docs: record G2 completion`, rồi mở PR vào `main`.

---

Sau G2c: G2 đạt toàn bộ "Done khi" của spec §14.
