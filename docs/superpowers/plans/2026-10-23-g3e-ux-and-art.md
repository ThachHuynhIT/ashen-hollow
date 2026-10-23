# G3e — UX, Help và nâng cấp pixel art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Claude sẽ thực thi sau khi chủ dự án review; lượt viết tài liệu này không thực thi task.

**Goal:** Làm ván G3 dễ hiểu và dễ tra cứu, hiện đúng thông tin và tầm hiệu dụng, nâng chất lượng hình ảnh giữ pixel look, ưu tiên PC rồi tối ưu mobile.

**Architecture:** Giữ nguyên reducer, checkpoint và schema G3; UI model thuần lấy dữ liệu từ registry và dùng lại phép dựng chỉ số của battleSetup. Help, panel thông tin và overlay tầm là lớp trình bày có vòng đời riêng; công cụ preview năm chạy trong session RAM riêng và chỉ được nhập ở DEV. Art đổi qua hợp đồng frame hiện có, sau task đồng bộ luật và cổng duyệt từng bộ.

**Tech Stack:** Phaser 4.2.x · TypeScript strict · Vite · Vitest · PixelCanvas/paintBitmap · trình duyệt preview. Không thêm thư viện runtime hoặc pack asset ngoài trong đợt này.

**Spec:** `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md` §3.1, §4.2–4.3, §5.2–5.6, §6, §7, §8.4/8.10/8.12, §9.3, §10, §11, §12.4, §13.4; yêu cầu chủ dự án ngày 23/10/2026 thay thế các giới hạn màu/kích thước cũ. Mẫu: `2026-10-22-g3d-save-and-ui.md` và `2026-10-22-g3-full-run.md`.

## Lựa chọn đã chốt bởi chủ dự án — 23/10/2026

1. **Art:** tự sinh bằng code, giữ ô logic 32 px, nới màu; không nhập pack ngoài đợt này. Giữ sân logic 384 px và phép tính mô phỏng; kích thước hình theo metadata. Khung Kenney đã có chỉ là fallback hiện hữu, không phải pack mới được nhập trong G3e.
2. **Cấp:** 5 icon sao pixel kèm nhãn “Cấp N/5”; sao đã đạt tô đầy, các sao còn lại rỗng.
3. **Help:** modal overlay, mở bằng F1 hoặc H từ menu và trong ván; chưa có tìm kiếm.
4. **Mobile:** tối ưu đầy đủ phần chức năng mới ở 375 × 812 trong task E8 cuối cùng; các task trước vẫn giữ bố cục mobile không hỏng.

Bốn lựa chọn này đã được chủ dự án xác nhận, không còn là giả định hoặc câu hỏi chờ trả lời. E1 ghi lại chúng trong DECISIONS khi thực thi, không hỏi duyệt lại. Việc duyệt mẫu mỹ thuật từng bộ trước khi dùng vẫn là cổng riêng; chốt hướng art không có nghĩa tự động nghiệm thu mọi hình. Lượt này chỉ cập nhật plan, chưa bắt đầu triển khai.

## Mốc code đã đối chiếu và phạm vi

- Root `D:\WorkSpace\crowned-kingdoms` đang ở main/G1 `8e6e094`; không dùng nó làm baseline thực thi G3e. Code G3 đã đọc tại `.claude/worktrees/pr-4-project-skills-review-4a6da9`, nhánh `g3-full-run`, commit `bd52238`. `origin/develop` ở phiên khảo sát là `1a931ba` (G2). Trước thực thi: fetch, xác nhận G3 đã vào develop; nếu chưa, chờ PR G3 vào develop rồi tạo feature branch từ develop. Không mở feature PR vào main hoặc tự merge G3 trong task này.
- G3 đã có QuestModal, CouncilModal, DecreeQuestPanel, CalendarCellView, InfoPanel/ContentBox, `statusLines`, 9 enemy kings/81 thẻ vua không gồm Ngai, 18 sắc lệnh, 13 nhiệm vụ, 3 boss, IndexedDB. Mở rộng chúng, không dựng lại các cơ chế này.
- `CONTENT.kings()` chỉ là 3 vua chơi được; Help dùng `enemyKings()` cho bộ lọc 9 vua, `allCards()/allUnits()` cho nội dung, `BOSSES` cho boss. Sáu Ngai/perk/chọn vua/meta chưa thuộc G3, không tự tạo nội dung G4 để lấp Help. Khi registry G4 thêm thẻ, coverage Help phải nhận tự động.
- Nhánh thử ảnh `codex/asset-batch-five`/`c0f18d6` là nhánh G2 riêng, chưa nằm trong G3. Không giả định `assetPreview.ts` hay loader của nhánh đó tồn tại ở baseline này; không cherry-pick cả nhánh G2 lên G3. Ba ảnh batch 005 còn chờ duyệt native; chỉ là reference khi chủ dự án chọn, không tự coi đã nghiệm thu.
- Chỉ tạo file plan này ở lượt hiện tại. Những `Create/Modify` bên dưới là công việc tương lai, bao gồm sửa spec/CLAUDE ở E1; không sửa chúng bây giờ. G3e ở đây là UX/art, không phải đề xuất cũ “g3e-conquest-cards” trong plan tổng G3; 54 thẻ đã triển khai, không làm lại.

## Global Constraints

- `src/core`, `src/data`, `src/game` không import Phaser hoặc `scenes/render/ui/platform/audio`; `src/data` không import `src/game`; giữ ESLint §12.4, không nới rule để làm Help/debug.
- Trong ba lớp thuần cấm `Math.random`, `Date.now`, `performance.now`, `Math.pow/hypot/sin/cos/tan/atan2/exp/log`; dùng `Rng` + `hashSeed`, thứ tự id/plot ổn định, tick cố định 10/s (§8.12). UI không sửa RNG/state để hiển thị.
- Số gameplay chỉ ở `src/data/*`; không đổi cân bằng, ngân sách, thời hạn, giá, cap hoặc kích thước mô phỏng vì art. UI model ở `src/ui`; E2a chỉ công khai hàm luật đã có, không chuyển công thức sang UI.
- UI đọc state, gửi intents qua `EventBus<GameEvents>` tại `src/game/events.ts`; không đưa UI state vào reducer. Menu/Help có local UI coordinator; thao tác chỉ xem không phát `ui:command`.
- `RUN_SAVE_VERSION = 4`, envelope `formatVersion = 1`, DB `crowned-kingdoms` v1, run/current và meta/profile giữ nguyên. Không đổi codec/migration hoặc cấu trúc save; không đọc/ghi/xoá meta. Tuỳ chọn UI nếu thêm phải dùng localStorage `try/catch`, không run/meta; plan không thêm tuỳ chọn UI cần lưu.
- Reload battle đánh lại từ tick 0 cùng setup; checkpoint chỉ theo luồng G3 hiện có. Help/inspect/hover không checkpoint, không làm mất offer hoặc selection.
- Full 30 năm; council `[5, 10, 15, 20, 25]` sau trận; quest `[3, 7, 12, 17, 22, 27]` đầu năm; active quest < 2 mới được đề nghị; boss `[10, 20, 30]`; level 1–5; bùa tối đa 4 stack (§3.1/§7). Không tăng tần suất sứ giả để dễ preview.
- Giữ tương thích `RULES_G1` 10 năm và `RULES_G2` 15 năm; event marker full không xuất hiện trong lịch ngắn. Thua vẫn hợp lệ, không sửa điều kiện thắng để demo.
- PC nghiệm thu 1280 × 720 và 1920 × 1080; mobile 375 × 812 tối ưu ở E8 cuối. Mọi task giữ các test layout mobile hiện có pass; breakpoint width ≥ 768, vùng chạm ≥ 44 × 44 logic, close 48 × 48, tooltip giữ 400 ms, bố cục tính lại khi resize (§10.1/§10.5).
- Dùng `FONT_UI` đủ glyph tiếng Việt; mọi chữ người chơi bằng tiếng Việt. `createPanel`, `createButton`, `ContentBox`, `Tooltip` tiếp tục là primitives chuẩn; overlay modal alpha 0.6.
- Luật mới sau E1: không giới hạn mọi RGB vào Hearth 32/UI_PALETTE hoặc đóng cứng canvas vào các số cũ. Giữ exports/màu cũ làm tương thích; mọi kích thước được khai báo và test theo metadata, không tự resize luật trận. Trước E1 vẫn tuân luật cũ.
- Giữ pixel look: `pixelArt: true`, nearest sampling, integer camera zoom và integer scale, sprite/scroll hiển thị snap pixel; không xoay sprite, chỉ flip; neo chân `(0.5, 1)`, y-sort, tên frame qua `*Frame`. Không thay float của world để snap render.
- Art raster không AA/blur: mép sprite alpha 0/255; bóng riêng được alpha 128 có khai báo; không resample tuyến tính hoặc glow mờ. Chữ `FONT_UI` vẽ ở kích thước hiển thị gốc, không phóng texture text theo tỷ lệ lẻ; kiểm độ rõ/glyph bằng browser, không dùng test palette để phán chất lượng font.
- Một atlas thế giới `sprites`, mỗi chiều ≤ 4096; UI atlas riêng vẫn qua `uiFrameDef`. Cap trận 512 entity/400 projectile giữ nguyên; render mục tiêu ≥ 60 fps PC/≥ 30 fps mobile (§8.10), test mô phỏng ≤ 2 ms/tick vẫn giữ.
- Scene reset fields ở đầu `create()`, initial HUD qua launch data, unsubscribe/kill tween/destroy overlay khi shutdown. Không khởi tạo Graphics/tween mới mỗi frame vì hover/inspect.
- Asset ngoài theo `docs/ASSET_LICENSES.md`: bằng chứng giấy phép trước adopt, manifest + CREDITS trước commit; CC-BY phải có ghi công trong game. Duyệt từng bộ trước dùng, không tải và commit chỉ từ một URL.
- Mỗi task có **đúng một** dòng “Lệnh nghiệm thu cuối” như dưới; chạy bằng Git Bash trên Windows, tất cả exit 0. Browser ghi screenshot/kết quả PC cho mỗi task, cả với task thuần (smoke baseline, không giả có UI mới). Mobile browser toàn luồng ở E8; layout unit mobile chạy mọi task.
- Feature branch từ develop → PR vào develop; không push trực tiếp develop/main, không động main. Stage đúng file của task; commit message tiếng Anh, không giả danh tác giả mẫu.

## Quyết định (của plan này)

1. **Đã chốt — Art:** tự sinh bằng code, ô logic 32 px, nới màu; không mua/tải/nhập pack ngoài. Giữ kích thước công trình 32 × 40, Ngai 32 × 48 và lính theo UnitDef.sprite trong đợt này; đó là lựa chọn triển khai trong metadata mở, không khôi phục giới hạn đồ hoạ cũ. Màu chủ/phe vẫn phân biệt bằng hình/viền.
2. **Đã chốt — Cấp:** 5 icon sao kèm nhãn “Cấp N/5”; icon mới qua `iconFrame('star')`, E2/E3 dùng nhãn cấp tạm tới khi E6c cấp frame. Không đổi cấp thật hoặc màu rarity; bản bàn giao cuối có đủ icon và nhãn.
3. **Đã chốt — Help:** modal trên HelpScene overlay, F1 và H mở/đóng, chưa có tìm kiếm; Esc đóng Help trước modal phía dưới. Mở trên council/quest/reward không xác nhận/bỏ qua chúng. Battle tạm dừng qua intent, đóng trả đúng tốc độ trước đó, kể cả 0; không ghi save.
4. **Đã chốt — Mobile:** E8 cuối cùng tối ưu đầy đủ phần chức năng mới ở 375 × 812. Không hạ chuẩn PC để nhét mobile; không thêm landscape/PWA/audio.
5. **Tầm:** không nhân bán kính với zoom trong model. Attack đo khoảng cách mép theo `edgeDistance`; vòng tới mép mục tiêu có bán kính `attack.range + radius của nguồn`, chưa cộng radius mục tiêu chưa biết. Min-range vẽ vòng trong tương ứng, nhãn giải thích khoảng cách mép; aura/pulse đo tâm thì dùng đúng radius runtime. Không hứa vòng là ranh giới tâm của mọi loại địch.
6. **Giữ luật hiện hữu:** `structureFor` hiện cộng `TOWER_RANGE` cho pulse nhưng không áp `sheet.range`; aura/shield/bell có radius riêng. Plan lấy đúng kết quả runtime này, không tự “sửa cân bằng” cho tất cả bán kính. Test chỉ rõ Cung Thủ Hoàng Gia đổi attack range, còn pulse/aura chỉ đổi khi runtime hiện hành thực sự đổi. Nếu chủ dự án muốn buff áp cho pulse/aura, cần bugfix luật riêng kèm đối chiếu §5.3; không lén nhân công thức trong UI.
7. **Không dùng Pixelate toàn màn:** skill Phaser 4 tại `.claude/skills/filters-and-postfx/SKILL.md` mô tả Pixelate trộn màu, pixel size = `2 + amount`; không phù hợp yêu cầu mép sắc/chữ rõ. Dùng PixelCanvas, nearest, snap và pixel contour, không shader cho đợt này. Đọc thêm `v3-to-v4-migration`, `sprites-and-images`, `graphics-and-shapes`, `game-setup-and-config`, `cameras` khi thực thi.
8. **Preview an toàn:** nhảy năm là tạo **ván mẫu mới ở RAM**, không tua ván thật. Seed 1 và vua Wheat là fixture của plan; tạo lại năm mục tiêu qua hàm năm hiện có để mở quest thật, hoặc offer council mẫu có ghi nhãn. Kết quả không phải bằng chứng chơi thật tới boss/năm 30; không ghi đè session registry/IndexedDB thật.
9. **Hiệu năng trình bày:** một Graphics cho tập vòng đang chọn/hover, tối đa 8 vòng; selection ưu tiên hover, không vẽ tầm mọi đơn vị cùng lúc. Raster contour cache 64 radius gần nhất; không rebuild khi chỉ đổi vị trí. Đây là ngân sách trình bày do plan đặt, không số gameplay.
10. **Thứ tự và chia nhỏ:** giữ nhóm E1 → E2 → E3 → E4 → E5 → E6 → E7 → E8. Chia E2/E3/E4/E5/E6/E7 vì khác sản phẩm/test và tránh > 10 file production/task. Giữ một file plan theo yêu cầu, không tự tách g3e thành nhiều tài liệu.

## Review Focus

1. Tháp L5 + bùa + `decree_royal_archers`, pulse/aura, zoom 1/2/3: model bằng runtime; bán kính màn = bán kính world × zoom, không nhân đôi; `shared_ranges_and_edge_semantics` E2a/E2b, `range_zoom_and_camera_transition` E3b.
2. Đổi số trong registry/RUN/QUEST_RULES/DECREE_RULES/BOSS_RULES: Help cập nhật, không giữ bản mô tả chép tay; `help_reacts_to_balance_changes`, `catalog_covers_live_content` E4b.
3. Nội dung dài, bốn bùa × 4 stack, unit nhiều status, 1280 × 720/1920 × 1080: panel cuộn trong vùng, không che nút điều khiển và không click xuyên; `inspection_layout_avoids_controls`, `panel_input_is_consumed` E3a/E7b.
4. Art mới thiếu một frame hoặc scale 1.5: kiểm build/review báo lỗi có tên, không sprite mất/blur; `art_contract_rejects_fractional_scale`, `atlas_has_complete_frames` E1/E6c; fallback Kenney vẫn có test E7a.
5. Hover lặp 1000 lần, 512 entity/400 đạn: chỉ một range Graphics, cache ≤ 64, atlas ≤ 4096 mỗi chiều, không rò scene; `range_renderer_reuses_objects` E3b, `atlas_budget_and_render_smoke` E6c.
6. F1/H khi reward/council/quest, đang aim hoặc đang pause: Help xử lý trước, ngăn browser F1, không kích hoạt 1–4/S/R/D/L/P/Space/B/Enter/Esc phía dưới; `shortcut_modal_priority` E4a, `help_preserves_pending_and_speed` E4d.
7. DEV jump sau khi đã có save thật, rồi build production: save/meta thật không đổi, prod không có module/nút/route/string marker debug; `preview_cannot_touch_real_store` và `production_has_no_debug_jump` E5b.
8. Mở Help rồi reload trong battle hoặc pending quest/council: save vẫn state 4/envelope 1 và cùng lựa chọn; `view_actions_do_not_checkpoint` E4d, ma trận reload E8.

## Thứ tự, phạm vi file và cổng duyệt

| Thứ tự | Task     | Sản phẩm độc lập                                  | File production tối đa |
| ------ | -------- | ------------------------------------------------- | ---------------------- |
| 1      | E1       | Luật art mới + test hợp đồng, chưa đổi art        | 2                      |
| 2–3    | E2a, E2b | Chỉ số chung; model thông tin/tầm                 | 1; 4                   |
| 4–5    | E3a, E3b | Hai panel riêng; vòng tầm trên world              | 8; 6                   |
| 6–9    | E4a–E4d  | Phím chuẩn; Help data; Help view; nối scene/pause | 9; 6; 4; 9             |
| 10–11  | E5a, E5b | Sứ giả/HUD; DEV sandbox                           | 7; 5                   |
| 12–14  | E6a–E6c  | Đất/nhà/thẻ; lính/boss; FX/icon/atlas             | 7; 4; 6                |
| 15–16  | E7a, E7b | UI skin; bố cục PC                                | 6; 6                   |
| 17     | E8       | Mobile và bàn giao PR                             | 8                      |

Docs/test/tooling được liệt kê riêng, không tính là file production runtime; không dùng cách này để giấu thay đổi game trong tools. Không task nào cần > 10 file production. Cổng asset: E1 chốt brief → E6a mẫu đất/nhà/thẻ → duyệt → E6b mẫu lính/boss → duyệt → E6c mẫu FX/icon → duyệt → E7a mẫu UI → duyệt; mỗi bộ chỉ nối vào atlas/runtime sau khi đã duyệt bộ đó. Task bị chờ duyệt phải dừng phần adopt và ghi trạng thái, không đánh dấu hoàn thành hoặc tạo bộ tiếp theo.

---

### Task E1: Đồng bộ luật art và thay test ép palette bằng hợp đồng pixel

**Files:**

- Modify: `docs/superpowers/specs/2026-10-16-crowned-kingdoms-design.md`, `docs/ART_STYLE.md`, `CLAUDE.md` (chỉ khi thực thi task).
- Create: `src/render/artPolicy.ts`, `docs/art-review/g3e/DECISIONS.md`.
- Modify: `src/data/types.ts` (chỉ type UnitDef.sprite, không sửa size dữ liệu hoặc physics).
- Test (Modify): `src/data/palette.test.ts`, `src/render/worldArt.test.ts`, `src/render/uiArt.test.ts`, `src/render/atlas.test.ts`, `src/render/uiKit.test.ts`.
- Test (Create): `src/render/artPolicy.test.ts`; Test (Modify): `src/data/content.test.ts` (fixture type size mở và positive-integer contract).

**Interfaces:**

- Consumes `PixelCanvas(width:number,height:number)`, `UnitDef.sprite`, `UI_FRAMES`, `uiFrameDef(frame:UiFrame)` và hàm frame hiện có.
- Produces `ART_POLICY = {maxAtlasSide:4096, allowedSpriteAlpha:[0,255], shadowAlpha:128}`; `checkArtFrame(name:string,art:PixelCanvas,expected:{w:number;h:number},shadow:boolean):readonly string[]`; `isIntegerDisplayScale(scale:number):boolean` ở `artPolicy.ts`. Không giới hạn RGB hoặc số lượng màu.

- [ ] **Step 1 — Test fail:** `accepts_extended_rgb` dùng pixel `0x123456`, đúng size và alpha 255 → không lỗi; `rejects_aa_edge` alpha 127 → lỗi chứa frame/x/y; alpha 128 chỉ được khi `shadow=true`; `art_contract_rejects_fractional_scale`: 1/2/3 hợp lệ, 1.5/0/NaN không hợp lệ. Đơn vị mọi frame phải khớp `UnitDef.sprite`; không thay assert bằng “size > 0”.
- [ ] **Step 2 — FAIL:** `npx vitest run src/render/artPolicy.test.ts < /dev/null`; mong module chưa có. Lưu baseline số test, không xoá test cũ để đạt gate.
- [ ] **Step 3 — Cài đặt:** contracts trên; ghi nguyên bốn lựa chọn chủ dự án đã chốt ngày 23/10/2026 và brief từng bộ trong DECISIONS, không xin xác nhận lại bốn lựa chọn. Sửa spec §11.1–11.4 thành metadata mở + pixel look; đồng bộ các câu còn ép palette ở §1 mục 6, §2 Chủ đề và §10.1, chỉ đổi ràng buộc trình bày, giữ primitive UI. Sửa ART_STYLE, luật “Pixel art” CLAUDE và ghi nguồn yêu cầu chủ dự án. Đổi UnitDef.sprite từ union kích thước đóng sang `{readonly w:number;readonly h:number}`; checkArtFrame kiểm positive integer và so đúng metadata; fixture UnitDef 32 × 40 phải typecheck/render validator pass, không đổi kích thước của bất kỳ UnitDef thật nào. Đây là nới type metadata, không đổi shape save hay version. Chưa đổi art runtime.
- [ ] **Step 3b — Sửa test cũ cụ thể:** palette.test bỏ `length === 32` và cố định hex; thay bằng tất cả giá trị hữu hạn/int 0..0xffffff, tên semantic còn tồn tại và `toCss` đúng. worldArt giữ deterministic/khác frame/phe/neo chân, chuyển membership palette sang `checkArtFrame`, size lấy metadata; không ép đúng 1 pixel đỏ. uiArt giữ slice/border/core opaque/state khác nhau, bỏ membership và đúng màu cream cố định. atlas giữ đầy đủ/unique frame, mọi UnitDef gồm boss, thay số size hardcode bằng metadata. uiKit giữ mapping chỉ frame hợp lệ, size/slice đồng bộ giữa trạng thái, fallback khi thiếu kit; không biến “không kiểm palette” thành bỏ kiểm geometry. Các assert màu ở test còn lại chỉ giữ khi đó là hợp đồng semantic hiện hành, không tuyên bố toàn art phải thuộc bảng cũ.
- [ ] **Step 4 — PASS:** `npx vitest run src/data/palette.test.ts src/render/artPolicy.test.ts src/render/worldArt.test.ts src/render/uiArt.test.ts src/render/atlas.test.ts src/render/uiKit.test.ts < /dev/null` → pass. Browser preview 1280 × 720 và 1920 × 1080: baseline hình cũ vẫn rõ, console sạch; lưu ảnh trước đổi art.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `docs(art): adopt flexible pixel art contracts and validation`.

### Task E2a: Công khai phép dựng chỉ số dùng chung, không nhân đôi luật

**Files:**

- Modify: `src/game/run/battleSetup.ts`.
- Test (Create): `src/game/run/effectiveStructure.test.ts`.
- Test (Modify): `src/game/run/battleSetupG2.test.ts`.

**Interfaces:**

- Consumes `collectStatSheet(state:RunState,content:Content,plot:number,unit?:UnitDef):StatSheet`, `finalStat(base:number,cell:StatCell):number`, `TOWER_RANGE`, `buildBattleSetup(state:RunState,content:Content):BattleSetup`.
- Produces public export **của hàm đang có** `structureFor(state:RunState,plot:number,content:Content):StructureSetup`; `attackStats(a:AttackSpec,dmgMult?:number,rangeBonus?:number,sheet?:StatSheet):AttackStats`. Giữ tên/chữ ký/thân luật hiện tại; `buildBattleSetup` vẫn gọi cùng các hàm này.

- [ ] **Step 1 — Test fail:** `shared_ranges_and_edge_semantics`: `neutral_archer_tower` L5, không buff → range `88 + 16 = 104`; thêm `decree_royal_archers` → 116; thêm fixture Bùa hợp lệ flat range 8 + pct range 25 qua Content fixture → `finalStat(104,sheet.range)`, không đoán thứ tự pct. So **deep equality** `structureFor` với structure cùng plot trong `buildBattleSetup`, kể cả HP/spawn/attack/pulse/aura/shield/taunt/bell; Ngai cũng bằng setup.throne.
- [ ] `pulse_is_runtime_not_invented_buff`: Tim Núi L5 → radius `48 + 16 = 64`, thêm decree nói trên giữ đúng radius runtime hiện có; healAura/shieldPulse/bell/taunt dùng scalar riêng. `public_stats_do_not_mutate`: deep-freeze state/content fixture, gọi hai lần cùng kết quả; không phụ thuộc `army` để inspect planning. Empty plot/out-of-range không được UI gọi; test caller E2b trả null trước khi dùng.
- [ ] **Step 2 — FAIL:** `npx vitest run src/game/run/effectiveStructure.test.ts < /dev/null`; mong import export còn thiếu.
- [ ] **Step 3 — Cài đặt:** chỉ export các hàm hiện hữu và comment đơn vị range/interval. Không tạo `effectiveRange` tính lại công thức trong ui; không đổi pulse modifier trong task này. Giữ test G1/G2/G3 golden kết quả, không đổi save/version.
- [ ] **Step 4 — PASS:** `npx vitest run src/game/run/effectiveStructure.test.ts src/game/run/battleSetupG2.test.ts < /dev/null`. Browser smoke hai cỡ PC, kiểm nhà/tháp cũ vẫn dựng được trước khi UI mới dùng export.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `refactor(game): expose shared effective structure stats`.

### Task E2b: Model thông tin nhà/lính và tầm thuần

**Files:**

- Create: `src/ui/info/inspectionModel.ts`, `src/ui/info/rangeModel.ts`, `src/ui/info/labels.ts`.
- Modify: `src/ui/info/infoLines.ts`.
- Test (Create): `src/ui/info/inspectionModel.test.ts`, `src/ui/info/rangeModel.test.ts`.
- Test (Modify): `src/ui/info/infoLines.test.ts`.

**Interfaces:**

- Consumes E2a `structureFor(state,plot,content):StructureSetup`; `describeCard(def:CardDef,level?:Level):CardDescription`; `statusLines(world:BattleWorld,id:number):string[]`; `BattleWorld.sourceUid`, stats arrays và `RunState.plots`.
- Produces `LevelStars={filled:Level;total:5;label:string}`; `levelStars(level:Level):LevelStars`.
- Produces `BuildingInfoModel={plot:number;uid:number;title:string;stars:LevelStars;hp:number;description:readonly string[];next:readonly string[]|null;enchants:readonly string[];age:{years:number;bonus:number}|null;spawn:UnitInfoModel|null}`; `buildingInfoModel(state:RunState,plot:number,content:Content):BuildingInfoModel|null`.
- Produces `UnitInfoModel={title:string;sourceLevel:Level|null;hp:number;maxHp:number;dmg:number;damageType:string;range:number;attacksPerSecond:number;armorPct:number;speed:number;tags:readonly string[];behaviours:readonly string[];statuses:readonly string[]}`; `unitInfoModel(world:BattleWorld,id:number,state:RunState,content:Content):UnitInfoModel|null`; `unitPreviewModel(stats:UnitStats,def:UnitDef,sourceLevel:Level|null):UnitInfoModel`.
- Produces `RangeSpec={kind:'attack'|'minimum'|'pulse'|'aura'|'shield'|'taunt'|'bell'|'heal';radius:number;label:string}`; `buildingRanges(state:RunState,plot:number,content:Content):readonly RangeSpec[]`; `entityRanges(world:BattleWorld,id:number):readonly RangeSpec[]`. `buildingModelLines(model:BuildingInfoModel):readonly string[]` và `unitModelLines(model:UnitInfoModel):readonly string[]` trong infoLines chỉ format model. `labels.ts` sở hữu mapping tiếng Việt exhaustive cho DamageType/UnitTag/UnitBehaviourDef['type']; không sửa game để dịch chữ.

- [ ] **Step 1 — Test fail:** `stars_1_to_5` → filled 1..5/total 5; `effective_building_and_next_level` Dân Quân L3 HP `150 × 1.5 = 225`, spawn theo setup, mô tả hiện tại = describeCard L3, next chứa describeCard L4 trên clone và so sánh HP hiệu dụng 225 → 262.5 cùng thay đổi spawn/dmg/range tương ứng; L5 next null; Ngai đọc throneLevel. Tháp/kinh tế/hỗ trợ đều có HP, không chỉ troop/tower như helper cũ.
- [ ] `age_and_enchants`: year 12, placedYear 7, ageBonus 2 → tuổi 7, bonus 2 riêng; không cộng thêm 1. Nhà chưa có tuổi/tag liên quan thì age null; bùa liệt kê đủ 4 loại/stack theo state, không tính virtual stack thành bùa thật. `separate_unit_model`: building.description không chứa khối stats lính; spawn là model riêng để mở panel lính.
- [ ] `live_unit_stats_and_unknown_origin`: sourceUid khớp nhà L4 → 4 sao; địch/summon không có nhà tương ứng → sourceLevel null, hiện “Không từ công trình của bạn”, không gán 1 sao. Lấy HP/dmg/interval/speed hiện tại từ world, type/tag/behaviour dịch từ registry, interval 10 ở 10 tick/s → 1 đòn/s; interval 0 → 0, không Infinity; chết/ID -1/world.count → null, statusLines giữ đủ status G3.
- [ ] `ranges_share_setup`: E2a case 116 tạo attack ring `116 + BATTLE.structureRadius`; minRange của Tháp Ném Đá là `24 + radius nguồn`; pulse 64, aura/shield/bell/taunt đúng setup, không cộng nguồn cho phạm vi đo tâm. Unit dùng world.range và world.radius đang sống; không dùng range gốc UnitDef. Range 0/no effect → không vẽ vòng giả. Deep-freeze state qua mọi selector, RNG/save unchanged.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/info/inspectionModel.test.ts src/ui/info/rangeModel.test.ts < /dev/null`; mong module thiếu.
- [ ] **Step 3 — Cài đặt:** contracts; next-level chỉ clone đúng nhà/throneLevel rồi gọi chung structureFor/describeCard, không chạy lệnh thật hoặc tăng counters. Thêm hai formatter model vào infoLines. Tạm giữ nguyên `buildingInfoLines(building:BuildingState,content:Content):string[]`/`entityInfoLines(world:BattleWorld,id:number,content:Content):string[]` cũ để các scene chưa chuyển ở E3a vẫn compile; không đổi chữ ký giữa chừng. Test model mới assert 225, legacy test chỉ giữ tạm đến E3a. Giữ entityAt/statusLines/runSummary/infoContent/placeInfoBox, không đổi unrelated summary.
- [ ] **Step 4 — PASS:** `npx vitest run src/ui/info/inspectionModel.test.ts src/ui/info/rangeModel.test.ts src/ui/info/infoLines.test.ts < /dev/null`. Browser smoke hai cỡ PC, chưa đổi panel UI; inspect baseline không throw.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(ui): model effective building and unit inspection`.

### Task E3a: Panel nhà có sao và panel lính riêng, nội dung cuộn có giới hạn

**Files:**

- Modify: `src/ui/info/InfoPanel.ts`, `src/ui/info/infoLines.ts`, `src/ui/ContentBox.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/BattleHudScene.ts`.
- Create: `src/ui/info/UnitInfoPanel.ts`, `src/ui/info/inspectionLayout.ts`, `src/ui/info/InspectionView.ts`.
- Test (Create): `src/ui/info/inspectionLayout.test.ts`, `src/ui/info/InspectionView.test.ts`; Test (Modify): `src/ui/info/infoLines.test.ts` (chuyển legacy tests sang formatter model).

**Interfaces:**

- Consumes E2b model signatures; `ContentBox(scene,frame,maxWidth,{blocking:true})`, `planningLayout(screen:Size,handSize?:number)`, `battleLayout(screen:Size)` và `Rect`.
- Produces `inspectionLayout(screen:Size,anchor:Point,measured:Size,reserved:readonly Rect[]):{panel:Rect;viewport:Rect;close:Rect;unitButton:Rect|null}`; desktop width cap 320, height cap min(480,room), margin 10, close 48.
- Produces `InfoPanel.showBuilding(model:BuildingInfoModel,anchor:Point,screen:Size,reserved:readonly Rect[]):void`; giữ show/setLines adapter tới khi callers chuyển. `UnitInfoPanel.show(model:UnitInfoModel,anchor:Point,screen:Size,reserved:readonly Rect[]):void`, `setModel(model:UnitInfoModel):void`, `hide():void`, `layout(screen:Size,reserved:readonly Rect[]):void`, `destroy():void`; panel lính là instance/root riêng.
- Produces `InspectionView(scene:Phaser.Scene,depth:number)` với `showBuilding(model,anchor,screen,reserved)`, `showUnit(model,anchor,screen,reserved)`, `hide():void`, `layout(screen:Size,reserved:readonly Rect[]):void`, `destroy():void`. Một panel hiện tại; nút “Xem lính” mở model spawn và có “Về công trình”.

- [ ] **Step 1 — Test fail:** `inspection_layout_avoids_controls`: anchor bốn góc, 30 dòng/bùa/status dài, 1280 × 720/1920 × 1080, reserved lấy từ layout thật (hand/fight/speed/intervene/confirm/cancel); panel và close trong màn, panel không giao reserved. Nếu không có slot bên cạnh, dùng vùng modal blocking có cuộn, không đẩy vượt màn. 375 × 812 có fallback vừa màn ngay từ task này.
- [ ] `panel_input_is_consumed`: fake scene/hit-test harness: pointer down/up/wheel trong panel không tới board và không phát `ui:command`; drag cuộn không trở thành click “Xem lính”. `building_and_unit_are_separate` có hai view roots, nhà không nhồi unit stats, chuyển qua/lại giữ nhà được chọn; L5 không có nút cấp tiếp. `destroy_unsubscribes` mở/đóng/recreate 20 lần listener count về baseline.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/info/inspectionLayout.test.ts src/ui/info/InspectionView.test.ts < /dev/null`; mong thiếu exports/views.
- [ ] **Step 3 — Cài đặt:** mở rộng ContentBox thêm `setMaxHeight(height:number):void`, viewport cuộn và clamp, chỉ giới hạn khi được gọi để Tooltip cũ không đổi. Dùng createPanel/ContentBox cho hai panel; star dùng nhãn tạm của E2b, chuyển icon ở E6c. Planning click nhà gọi buildingInfoModel; Battle click KIND_UNIT mở UnitInfoPanel, structure/throne mở building model và HP hiện tại từ world. Sau khi đổi hết hai scene, xoá buildingInfoLines/entityInfoLines/structureHp/spawnedUnitLines cũ, chuyển test sang buildingModelLines/unitModelLines (HP L3 225 thay 150); không để công thức HP cũ sống song song. Cập nhật stats trên tick/thay đổi dữ liệu, không tạo lại text mỗi frame nếu không đổi; close/empty-map/death/scene shutdown dọn selection.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC: inspect nhà L1/L5, Xem lính, địch/boss và 4 bùa; cuộn, Esc, resize, click trong panel không chơi bài/can thiệp; screenshot cả hai panel.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(ui): add bounded building and separate unit panels`.

### Task E3b: Vòng tầm pixel dùng world camera thực, tái sử dụng Graphics

**Files:**

- Create: `src/render/RangeRenderer.ts`, `src/ui/info/pixelCircle.ts`.
- Modify: `src/game/events.ts`, `src/scenes/RealmScene.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/BattleHudScene.ts`.
- Test (Create): `src/ui/info/pixelCircle.test.ts`, `src/render/RangeRenderer.test.ts`.

**Interfaces:**

- Consumes E2b buildingRanges/entityRanges; E3a selection; `plotCenter(plot:number):Point`, `realmCameraMix(...)` và **camera đang render**, không dùng preset battleCamera khi camera còn ease.
- Produces event `'ui:range-selection':{target:{kind:'plot';plot:number}|{kind:'entity';id:number}|null;mode:'selected'|'hover'}` trong GameEvents. Realm là chủ sở hữu renderer và theo dõi selection; hover không đổi RunState.
- Produces `pixelCircle(radius:number):readonly {x:number;y:number}[]` (midpoint circle integer, round radius chỉ lúc raster, không đổi model); `RangeRenderer(scene:Phaser.Scene)` với `show(center:Point,ranges:readonly RangeSpec[]):void`, `move(center:Point):void`, `hide():void`, `destroy():void`. Graphics depth = 90_000: trên nhà/quân, dưới HP 99_000 và arrows 100_000, không interactive.

- [ ] **Step 1 — Test fail:** `range_zoom_and_camera_transition`: world radius R, zoom 1/2/3 → screen R/2R/3R; tâm = world.x/y hoặc plotCenter, **không footY**; trong transition dùng đúng camera matrix hiện tại, không nhảy tâm. `pixel_contour` radius 0/1/64, symmetry 8 phía, toạ độ integer, không strokeCircle AA, radial error ≤ 1 world px.
- [ ] `range_renderer_reuses_objects`: show/move/hover 1000 lần → scene.add.graphics gọi đúng 1; move không regenerate contour; cache tối đa 64; không vẽ > 8 vòng trùng, hue/nhãn phân biệt attack/minimum/aura. Chọn ưu tiên hover; rời hover chỉ xoá hover; khi aim, modal, entity chết, thay world hoặc shutdown → hide/destroy, listener không tăng sau restart.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/info/pixelCircle.test.ts src/render/RangeRenderer.test.ts < /dev/null`; mong thiếu modules.
- [ ] **Step 3 — Cài đặt:** dùng Graphics.fillRect các đoạn/pixel 1 world px và alpha fill 0; không cấp một Graphics mỗi vòng. Realm quản lý một renderer, dùng rangeModel; HUD chỉ gửi selection/hover intent. Hover chỉ chuột, click chọn dùng cho mọi input; pan/zoom tự qua world camera, không setScrollFactor(0). Sửa nhánh cameraEase hiện có: ease scroll trong 400 ms và snap scroll ở render; zoom đổi theo bước nguyên 1 ↔ 2, không tween trực tiếp camera.zoom qua 1.5; test mọi frame transition đều Number.isInteger(zoom). Mỗi update chỉ move tâm đơn vị đã chọn nếu đổi pixel; không quét 512 entity để vẽ vòng toàn bộ.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC: tháp buff/cấp, pulse, aura và địch; rê/chọn/aim/cancel, vào trận và resize giữa ease, vòng khớp nguồn; kiểm số Graphics ổn định.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(render): show shared effective ranges with pixel contours`.

### Task E4a: Một bảng phím tắt và resolver dùng chung, thêm Help intent

**Files:**

- Create: `src/data/shortcuts.ts`, `src/data/help.ts`, `src/ui/input/shortcuts.ts`.
- Modify: `src/scenes/MainMenuScene.ts`, `src/scenes/KingSelectScene.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/BattleHudScene.ts`, `src/scenes/RunEndScene.ts`, `src/game/events.ts`.
- Create (tool/docs): `tools/sync-shortcuts.mjs`; Modify: `README.md` (vùng generated có marker).
- Test (Create): `src/ui/input/shortcuts.test.ts`, `src/ui/input/readmeShortcuts.test.ts`.

**Interfaces:**

- Consumes `GameEvents`/`EventBus<GameEvents>` hiện có và các onKey của 5 scene; input chỉ chuyển thành action, scene vẫn gửi các intents hiện hữu (`ui:command`, `ui:set-speed`, `ui:toggle-pause`, `ui:continue`).
- Produces `HelpTab='cards'|'mechanics'|'shortcuts'|'units'|'decrees'|'quests'|'banners'|'bosses'` trong `src/data/help.ts` (E4b chỉ thêm data tab/nội dung, không tạo lại type).
- Produces `ShortcutAction='help.toggle'|'confirm'|'cancel'|'select.1'|'select.2'|'select.3'|'select.4'|'reroll'|'sell'|'deck'|'calendar'|'pause'|'speed.1'|'speed.2'|'speed.3'|'intervene'|'newRun'|'back'`; `ShortcutContext='menu'|'kingSelect'|'planning'|'battle'|'runEnd'|'help'`; `ShortcutDef={id:string;contexts:readonly ShortcutContext[];keys:readonly string[];labelVi:string;action:ShortcutAction;priority:number}`; `SHORTCUTS:readonly ShortcutDef[]` (duy nhất chứa binding).
- Produces `resolveShortcut(key:string,context:ShortcutContext,flags:{helpOpen:boolean;mandatoryOpen:boolean;sideModalOpen:boolean;summaryOpen:boolean;repeat:boolean;editable:boolean;modified:boolean}):ShortcutAction|null`; `shortcutLabel(id:string):string`; event `'ui:help':{open:boolean;tab?:HelpTab}`. Scene tiếp tục thực hiện action qua intents hiện có, không bỏ state guards.

- [ ] **Step 1 — Test fail:** `shortcut_modal_priority` F1/H tại mọi context → help.toggle trước reward/council/quest guard; khi Help mở chỉ help.toggle/Escape nhận, Enter/1–4/S/R/D/L/P/Space/B không xuyên. Editable, Ctrl/Alt/Meta hoặc repeat → null (F1 không modified vẫn mở và preventDefault). H thường/hoa giống nhau.
- [ ] `existing_bindings_unchanged`: 1–3 kingSelect, Enter start/Esc back; planning 1–4/R/S/D/L/Enter/Esc; battle P/1–3/Space/B/Enter/Esc đúng nhánh aim/summary; runEnd Enter/Esc giữ. Menu Enter nếu handler hiện có thì giữ, không phát minh shortcut tiếp tục. `no_conflicting_keys_per_context` cho phép trùng key chỉ khi điều kiện summary/Help tách rõ; `readme_generated_matches_table` đọc giữa `<!-- shortcuts:start -->`/`<!-- shortcuts:end -->`, bằng output tool từ SHORTCUTS, không trích chữ từ README làm data.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/input/shortcuts.test.ts src/ui/input/readmeShortcuts.test.ts < /dev/null`; mong thiếu bảng/resolver/markers.
- [ ] **Step 3 — Cài đặt:** bảng + resolver, đổi các literal key trong scene thành action dispatch; giữ lệnh/speed/confirm/skip guard hiện tại. F1 gọi preventDefault chỉ khi resolver nhận. Nút/tooltip lấy shortcutLabel, không chép “F1” ở nhiều nơi. Tool Node dùng TypeScript.transpileModule (dev dependency đã có) để nhập bảng TS không có side effects, rồi render Markdown theo thứ tự contexts trong SHORTCUTS; `--check` không ghi file, mặc định chỉ thay vùng markers, giữ văn README khác. Help intent chưa có consumer tới E4d, không tự mở modal giả.
- [ ] **Step 4 — PASS:** lệnh Step 2; `node tools/sync-shortcuts.mjs --check`. Browser hai cỡ PC: smoke phím cũ, F1 không mở help trình duyệt; console sạch, chưa có view Help ở task này.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `refactor(ui): centralize keyboard shortcuts and documentation`.

### Task E4b: Catalog Help sống từ registry và số liệu luật

**Files:**

- Create: `src/ui/help/helpModel.ts`, `src/ui/help/mechanics.ts`.
- Modify: `src/data/help.ts` (type HelpTab đã có E4a), `src/data/quests.ts`, `src/data/decrees.ts`, `src/game/run/council.ts` (chỉ nguồn hằng/text, không đổi giá trị/ID/effect/action).
- Test (Create): `src/ui/help/helpModel.test.ts`, `src/ui/help/mechanics.test.ts`.

**Interfaces:**

- Consumes `Content.allCards/allUnits/enemyKings/conquestCards`, `describeCard(def,level)`, `DECREES`, `QUESTS/QUEST_RULES`, `BOSSES/BOSS_RULES`, `RUN`, `DECREE_RULES`, `SHORTCUTS` E4a, labels E2b. Không dùng `CONTENT.king` để duyệt 9 vua.
- Consumes E4a `HelpTab` từ data/help; Produces `HelpFilter={owner:KingId|'neutral'|'all';kind:CardKind|'all';rarity:Rarity|'all';level:Level}`.
- Produces `HelpEntry={id:string;title:string;lines:readonly string[];frame:string|null}`; `HelpCatalog={tabs:Readonly<Record<HelpTab,readonly HelpEntry[]>>;owners:readonly {id:KingId|'neutral';nameVi:string}[]}`; `buildHelpCatalog(content:Content,level:Level=1):HelpCatalog`; `helpCards(content:Content,filter:HelpFilter):readonly HelpEntry[]`.
- `help.ts` sở hữu thứ tự tab/tên mục/đoạn giải thích không số; `mechanics.ts` sở hữu `mechanicEntries(content:Content):readonly HelpEntry[]` và biến số đọc từ data, không bảng số thứ hai.

- [ ] **Step 1 — Test fail:** `catalog_covers_live_content`: set CardId bằng allCards; mỗi 9 owner có 9 thẻ không Ngai (81), neutral bằng neutralPool cộng thẻ neutral đã đăng ký; Ngai chỉ 3 hiện có, không tạo 6 Ngai giả; đủ tất cả allUnits/boss summons, 18 DecreeId, 13 QuestId, 3 BossId, cờ hiệu đủ 9 enemyKing. Mọi entry có tên và dòng tiếng Việt, không `{placeholder}` chưa resolve, không ID tiếng Anh làm mô tả người chơi.
- [ ] `cards_use_describe_card_at_level`: L1/L5 lines = describeCard cho cùng CardDef, lọc owner/kind/rarity bằng giao tập, kết quả sort id ổn định và không duplicate. Coverage mọi hiệu ứng/tag/behaviour trong registry có bản dịch E2b; metadata chưa có nội dung G4 được ghi rõ chưa chơi được, không mở khoá vua.
- [ ] `help_reacts_to_balance_changes`: Content fixture đổi attack dmg của một thẻ và interval một lính → Help lấy giá trị mới; mock module RUN đổi taxPerYear/questYears, QUEST_RULES đổi wagerFee, DECREE_RULES đổi reward, BOSS_RULES đổi mudRange → build catalog sau import mới chứa giá trị mới, không chứa con số cũ ở mục tương ứng. Không dùng snapshot toàn catalog thay test này.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/help/helpModel.test.ts src/ui/help/mechanics.test.ts < /dev/null`; mong modules thiếu.
- [ ] **Step 3 — Cài đặt:** mục cơ chế bắt buộc: vòng năm/thứ tự quest đầu năm–battle–reward/conquest–council, vàng/giá, cấp/bùa/lân cận, chinh phục, Liên Quân/cờ hiệu, hội đồng, nhiệm vụ/hạn/phí, boss, save/reload, thắng/thua (900 tick còn Ngai thắng trận khác hạ boss/Vương Miện Vàng). Số đọc RUN/scaling/battle/rules/council/quest/decree/boss exports; không gõ lại số trong help.ts. Với textVi/rewardTextVi có số ở quests/decrees, chuyển sang template nội suy cùng QUEST_RULES/DECREE_RULES/effects/action values để cả QuestModal và Help nhận cùng dòng; giữ QuestDef/DecreeDef và id/count hiện có. Các hằng số council đang private trong game (PICKS/MAX_EXPAND/MAX_PURGE/TREASURY_GOLD/AMNESTY_GOLD) chuyển nguyên giá trị 3/2/2/15/10 sang DECREE_RULES.choices/expand/purge/treasuryGold/amnestyGold; council.ts đọc cùng nguồn, export MAX_PURGE giữ alias tương thích. Help không đọc số từ text rồi parse lại; không copy hằng game private thành số mới trong UI. Test enact/selection cũ phải giữ nguyên kết quả. Help boss lấy attack UnitDef và BOSS_RULES; không rút gọn mất phase/miễn nhiễm.
- [ ] **Step 4 — PASS:** lệnh Step 2 và các test quest/decree hiện có. Browser smoke hai cỡ PC, tooltip/QuestModal vẫn cùng nội dung sau đổi nguồn text, chưa dựng lại modal.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(help): derive complete Vietnamese reference from live content`.

### Task E4c: Help modal có tab/bộ lọc, model pause và bố cục thuần

**Files:**

- Create: `src/ui/help/HelpModal.ts`, `src/ui/help/helpLayout.ts`, `src/ui/help/helpSession.ts`, `src/ui/help/HelpCardBrowser.ts`.
- Test (Create): `src/ui/help/helpLayout.test.ts`, `src/ui/help/helpSession.test.ts`, `src/ui/help/HelpModal.test.ts`.

**Interfaces:**

- Consumes E4b HelpCatalog/HelpFilter/helpCards; E4a SHORTCUTS; `CardView`, Tooltip, ContentBox, createPanel/createButton, overlay helpers.
- Produces `HelpLayout={panel:Rect;close:Rect;tabs:readonly Rect[];filters:readonly Rect[];viewport:Rect;detail:Rect}`; `helpLayout(screen:Size):HelpLayout`.
- Produces `HelpModal(scene:Phaser.Scene,content:Content,onClose:()=>void)` với `setTab(tab:HelpTab):void`, `setFilter(filter:HelpFilter):void`, `layout():void`, `destroy():void`; `HelpCardBrowser(scene:Phaser.Scene,content:Content,tooltip:TooltipHost)` có `setFilter(filter:HelpFilter):void`, `layout(viewport:Rect,detail:Rect):void`, `destroy():void`, chỉ dựng card trong viewport, cuộn như DeckModal, xem L1–L5 không gửi lệnh.
- Produces `HelpSession={open:boolean;restoreSpeed:GameSpeed|null}`; `openHelpSession(speed:GameSpeed|null,current?:HelpSession):HelpSession`, `closeHelpSession(session:HelpSession):{speed:GameSpeed|null}`. Null = menu/planning không có runner, 0 = đang pause; không gộp null và 0.

- [ ] **Step 1 — Test fail:** `help_layout_inside_screen`: PC panel tối đa 1120 × 660 ở 1280, 1440 × 960 ở 1920, margin 10; 375 fallback panel vừa màn, tabs cuộn ngang và mỗi hit ≥ 44, close 48; không overlap viewport/close, mọi entry truy cập qua cuộn. `help_filters_preserve_selection_on_resize`: owner/kind/rarity/level/entryId giữ khi resize hoặc chuyển tab rồi quay lại; empty filter hiện “Không có thẻ phù hợp.”.
- [ ] `help_session_preserves_zero`: speed 0/1/2/3/null mở hai lần không ghi đè restoreSpeed, đóng trả đúng; `modal_cannot_emit_game_commands` click card/chuyển level/lọc/tab/scroll chỉ đổi UI, không có ui:command; wheel/drag/tap panel không truyền nền. Hết entry/đổi filter reset scroll clamp, card ngoài viewport không giữ hit area.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/help/helpLayout.test.ts src/ui/help/helpSession.test.ts src/ui/help/HelpModal.test.ts < /dev/null`; mong thiếu views/model.
- [ ] **Step 3 — Cài đặt:** modal overlay blocking, close luôn thấy, createPanel/ContentBox cho detail dài; tabs lấy help.ts, filter kind/owner/rarity/level có nhãn Việt, toàn bộ danh sách tra từ model, không hardcode thẻ. Không thêm search theo quyết định Help đã chốt. HelpSession chỉ tính UI state, không set clock trực tiếp; E4d gửi intent. Dùng destroy/lifecycle như DeckModal, không listener global rò.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser preview hai cỡ PC qua harness view: mở đủ 8 tab, lọc vua thứ 9/trung lập, xem card L5, cuộn cuối; panel không tràn/blur, console sạch. Harness không đưa dữ liệu giả vào save.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(help): add tabbed reference modal and bounded card browser`.

### Task E4d: Nút Help menu/HUD, HelpScene và khóa input lớp dưới

**Files:**

- Create: `src/scenes/HelpScene.ts`, `src/ui/help/helpGate.ts`.
- Modify: `src/main.ts`, `src/scenes/keys.ts`, `src/scenes/MainMenuScene.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/BattleHudScene.ts`, `src/scenes/RealmScene.ts`, `src/ui/menuLayout.ts`.
- Test (Create): `src/ui/help/helpGate.test.ts`, `src/ui/help/helpIntegration.test.ts`.
- Test (Modify): `src/ui/menuLayout.test.ts`.

**Interfaces:**

- Consumes E4a `'ui:help':{open:boolean;tab?:HelpTab}`, resolveShortcut; E4c HelpModal/HelpSession; `RunController.runner`, runner.clock.speed, bus `ui:set-speed`, SessionPersistence.
- Produces `HelpLaunch={owner:string;bus:EventBus<GameEvents>|null;speed:GameSpeed|null;tab?:HelpTab}`; `SCENES.help='Help'`; HelpScene launch bằng data này, gọi HelpModal.setTab(data.tab) nếu có; không newRun/load/save. Menu mở bằng scene launch với bus null; HUD tiêu thụ ui:help qua bus ván.
- Produces `HelpGate` trong helpGate.ts: `get isOpen():boolean`, `open():boolean`, `close():void` (open false nếu đã mở); token gate giữ trong Phaser registry cho một game instance, không session run/meta. Caller scene kiểm gate trước input/key/drag/hover, HelpScene được miễn gate.

- [ ] **Step 1 — Test fail:** `help_preserves_pending_and_speed`: mở/đóng từ planning có card hai target, reward/council subselection, QuestModal; state deep equal, modal instance/selection giữ, không ui:command. Battle speed 0/1/3 → gửi ui:set-speed 0 đúng 1 lần nếu đang chạy, đóng trả 0/1/3; đã pause không tự resume. Scene đóng/shutdown khi Help mở phải trả gate/input, không điều khiển runner phiên mới.
- [ ] `view_actions_do_not_checkpoint`: spy SessionPersistence.checkpoint/flush và SaveStore save/clear/meta; 20 lần Help/inspect/tab/close → 0 cuộc ghi mới. `help_blocks_every_owner_input`: F1 preventDefault; Enter trong Help không nhận quest/reward, pointer/dnd không rơi xuống Realm, Space không bật aim. Escape đóng Help rồi Escape sau đó mới xử lý modal phụ; council/quest vẫn không skip.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/help/helpGate.test.ts src/ui/help/helpIntegration.test.ts src/ui/menuLayout.test.ts < /dev/null`; mong thiếu scene/gate/nút Help.
- [ ] **Step 3 — Cài đặt:** thêm nút “Trợ giúp” ở menu và hai HUD (52 × 48 PC, fallback 44 × 44), tooltip lấy shortcutLabel; HUD anchor tạm `x=10,y=116`, E7b dàn lại cùng layout; menuLayout thêm button slot 200 × 52 và test tránh backdrop title. HelpScene chạy trên tất cả scene đang active, root depth 1000 trong scene riêng; gate cả keyboard các scene dưới lẫn Realm map input, không chỉ tắt menu button. Không pause Realm scene vì đó là chủ runner; pause qua intent để clock không tích backlog. Shutdown clear listeners/token, resume chỉ runner/owner còn đúng phiên; cấp initial data, không dựa event phát trước khi scene launch.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC: menu → Help → đóng; planning/quest/council/reward/battle paused/running → Help → đóng, thử phím/drag/click xuyên; refresh giữa battle vẫn resume theo G3, không theo state Help. Lưu screenshot và số write spy của harness.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(help): wire menu and run help with safe input and pause ownership`.

### Task E5a: Sứ giả nổi bật trên lịch, báo trước và chỉ báo nhiệm vụ

**Files:**

- Create: `src/ui/planning/questNotice.ts`, `src/ui/planning/QuestNoticeView.ts`.
- Modify: `src/ui/planning/CalendarStrip.ts`, `src/ui/modals/CalendarModal.ts`, `src/ui/planning/DecreeQuestPanel.ts`, `src/ui/modals/QuestModal.ts`, `src/scenes/PlanningHudScene.ts`.
- Test (Create): `src/ui/planning/questNotice.test.ts`, `src/ui/planning/QuestNoticeView.test.ts`.
- Test (Modify): `src/ui/planning/calendarText.test.ts`.

**Interfaces:**

- Consumes RUN.questYears/maxActiveQuests/councilYears/bossYears; `offerQuest(state:RunState):RunState` (chỉ test so điều kiện, không gọi để hiển thị); `calendarCells`, `calendarCellText`, QuestModal/questOfferView và decreeQuestLines hiện có.
- Produces `QuestNotice={nextYear:number|null;active:number;capacity:number;headline:string;detail:string;blocked:boolean}`; `questNotice(state:RunState):QuestNotice`; `questCalendarLabel(year:number):string|null` → “Sứ giả” hoặc null theo RUN, chỉ full qua caller.
- Produces `QuestNoticeView(scene:Phaser.Scene,onOpen:()=>void)` với `setState(state:RunState):void`, `layout(rect:Rect):void`, `destroy():void`; PlanningHud mở DecreeQuestPanel ở phần nhiệm vụ, không tạo modal luật thứ hai. Thêm `DecreeQuestPanel.openQuests():void` và nhãn nút “Sắc lệnh · Nhiệm vụ” khi cần.

- [ ] **Step 1 — Test fail:** `scheduled_not_guaranteed`: năm 2/6/11/16/21/26, active 0 → “Năm tới: Sứ giả”, detail đề nghị có điều kiện; năm 3 phase quest → “Sứ giả đang chờ”, không nói thêm một quest sau khi đã trả lời cùng năm. Năm 3 planning sau answer → nextYear 7, year 27 đã trả lời → null; không báo năm 31. Tìm năm kế từ RUN, không copy literal schedule.
- [ ] `two_active_explains_absence`: active 2 ở năm 7 → “Đã đủ 2 nhiệm vụ”, detail không có đề nghị mới khi đủ chỗ; 1 active/QUESTS còn pool → điều kiện khớp offerQuest; pool hết cũng giải thích không còn nhiệm vụ mới. Rules G1/G2 → headline rỗng, không giả có sứ giả.
- [ ] `calendar_has_readable_messenger`: mọi full quest year có chữ “Sứ giả”, cả strip/full calendar và tooltip nói **đầu năm**, có điều kiện < 2; council nói **sau trận**, boss có tên. `active_quest_summary`: badge “Nhiệm vụ 1/2”, tên/trạng thái/hạn từ QuestState; notification không roll RNG, không viết state/save; xem/đóng không trả lời quest. QuestModal giữ tiêu đề “Sứ giả mang tin…”, thêm giải thích vì sao xuất hiện và nút “Xem cách làm” dẫn tab quests Help.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/planning/questNotice.test.ts src/ui/planning/QuestNoticeView.test.ts src/ui/planning/calendarText.test.ts < /dev/null`; mong thiếu notice/readable label.
- [ ] **Step 3 — Cài đặt:** calendar giữ cell 52 × 52, badge chữ “Sứ giả” 10–12 px ở dải dưới, dời attacker/dots đủ chỗ; không chỉ icon nhỏ. Notice luôn có chỗ khi ván full (kể cả active=0), PC banner 280 × 48 dưới năm, dock trái vẫn DecreeQuestPanel; mobile fallback một dòng có thể chạm mở chi tiết, E8 tối ưu. Không thêm toast lặp mỗi run:state/reload; chọn banner tĩnh thay timer/persist “đã đọc”. QuestNoticeView nhận callback mở panel; QuestModal mở Help bằng `ui:help` payload `{open:true,tab:'quests'}` chứ không answer.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC: năm 2→3, 6→7 có 2 active, cuối năm 27, mở Help từ QuestModal rồi quay lại; cả lịch ngắn không có marker sai. Có thể dựng fixture browser tạm trước E5b nhưng không ghi save thật.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(quests): make messenger timing and active quests visible`.

### Task E5b: Công cụ DEV mở năm mẫu trong sandbox RAM riêng

**Files:**

- Create: `src/dev/previewRun.ts`, `src/dev/DevJumpPanel.ts`, `src/dev/registerPreview.ts`.
- Modify: `src/main.ts`, `src/scenes/RealmScene.ts` (gồm type RealmData; tổng runtime 5 file).
- Create (tool): `tools/check-production-debug.mjs`.
- Test (Create): `src/dev/previewRun.test.ts`, `src/dev/previewIsolation.test.ts`.

**Interfaces:**

- Consumes `newRun(seed:number,kingId:KingId,content:Content,rules?:Rules):RunState`, `startYear(input:RunState,content:Content):RunState`, `rollCouncil(state:RunState):RunState`, `MemorySaveStore`, `SaveCoordinator(store,content)`, E4d HelpGate.
- Produces DEV-only `PreviewTarget={kind:'quest'|'council'|'boss';year:number}`; `createPreviewRun(target:PreviewTarget,content:Content):{state:RunState;persistence:SessionPersistence}`; `registerPreview(game:Phaser.Game):()=>void`.
- Extends RealmData bằng `{preview:{state:RunState;persistence:SessionPersistence}}` chỉ được nhận trong `import.meta.env.DEV`; production launch data cũ `{seed,kingId}|{resume}` giữ nguyên. Realm dùng persistence được inject cho sandbox, không `setSession` và không gọi getSession().persistence trong nhánh preview. Không lưu cờ preview vào RunState.

- [ ] **Step 1 — Test fail:** `preview_targets_follow_data`: nút quest cho 3/7/12/17/22/27, council 5/10/15/20/25, boss 10/20/30 từ RUN; reject kind/year không có trong bảng, 0/31/NaN. Quest fixture từ clone năm `target.year - 1` rồi startYear → phase quest/offer thật khi có chỗ; boss fixture có army.boss đúng data, phase planning, `played=true` để bấm Ra trận ngay; council fixture phase council với 3 lựa chọn hợp lệ từ council roll. Không tuyên bố đã thắng các năm trước.
- [ ] `preview_cannot_touch_real_store`: thật có save state 4 và meta sentinel; mở/nhảy/chơi/kết thúc/thoát sandbox, MemorySaveStore đổi còn realStore spy save/clear/loadMeta/saveMeta đều 0, bytes thật nguyên. Mỗi jump tạo session RAM mới, không kế thừa RNG/state ván đang chơi. Banner “BẢN XEM THỬ — không lưu ván thật”, nút “Thoát xem thử” về menu load ván thật; không gọi clearRun thật. Test shutdown 10 lần không rò listener/persistence reference.
- [ ] **Step 2 — FAIL:** `npx vitest run src/dev/previewRun.test.ts src/dev/previewIsolation.test.ts < /dev/null`; mong modules thiếu.
- [ ] **Step 3 — Cài đặt:** duy nhất entry tại `main.ts`: `if (import.meta.env.DEV) { void import('./dev/registerPreview').then(...) }`; dynamic chunk không có static import quay từ production sang dev. Dev panel mở bằng nút “Xem thử (DEV)” hoặc hotkey có xử lý cục bộ DEV, không đưa debug binding vào SHORTCUTS người chơi. Thêm `DEV_PREVIEW_ONLY_JUMP` marker chỉ trong dev module để kiểm bundle; không route/query trigger trong prod. Dựng fixture bằng luật chuẩn, phần ép pha council là fixture được gắn nhãn, không command cheat trên controller thật. Realm preview guard phải loại được trong build, session thật không đổi.
- [ ] **Step 4 — PASS:** lệnh Step 2. `production_has_no_debug_jump`: sau build dùng `node tools/check-production-debug.mjs` scan JS/HTML phát hành → không marker, không dev chunk hoặc URL route, fail có tên file nếu thấy; script `--self-test` dùng fixture có/không marker để chứng minh có phát hiện. Browser dev hai cỡ PC nhảy tới 3/5/10/20/30, thấy QuestModal/CouncilModal/boss năm đúng; browser production `npm run preview` không có nút/hotkey/route, save thật vẫn Tiếp tục được. Build kiểm trước bước browser production; lệnh nghiệm thu cuối vẫn là cổng duy nhất dưới đây.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0; chạy lại script scan trên output của lần build này trước commit.
- [ ] **Step 5 — Commit:** `feat(dev): add isolated event-year previews excluded from production`.

### Task E6a: Đất, ô, công trình và tranh thẻ có bản sắc theo CardId

**Files:**

- Create: `src/render/worldStyle.ts`, `src/render/buildingVariants.ts`.
- Modify: `src/render/fieldArt.ts`, `src/render/plotArt.ts`, `src/render/buildingArt.ts`, `src/render/cardArt.ts`, `src/render/atlas.ts`.
- Create (tool/docs): `tools/render-art-review.mjs`, `docs/art-review/g3e/world-v1.md`, `docs/art-review/g3e/world-v1.png`.
- Test (Create): `src/render/buildingVariants.test.ts`.
- Test (Modify): `src/render/worldArt.test.ts`, `src/render/atlas.test.ts`.

- Modify (provenance khi adopt): `docs/assets.manifest.yml`, `CREDITS.md`; chỉ ghi nguồn custom/code-generated và output thực dùng; không thêm asset ngoài mới.

**Interfaces:**

- Consumes E1 artPolicy, frame naming, existing PixelCanvas/pixelHash/paintBitmap; E5b dev preview chỉ để xem, không dependency runtime. Không phụ thuộc loader thử G2.
- Produces `paintCardBuilding(def:CardDef,accent:number):PixelCanvas` trong buildingVariants, chỉ nhận placeable; exports `BUILDING_VARIANTS:Readonly<Record<string,string>>` ánh xạ CardId → motif có chủ đích, test exact coverage placeable của registry. `paintBuilding(kind,accent)` cũ giữ fallback; atlas gọi paintCardBuilding theo def thay vì tất cả economy cùng stall.
- `worldStyle.ts` sở hữu màu/vật liệu trình bày mở và `paintStyledGround(terrain:number,mask:number):PixelCanvas`; fieldArt vẫn sở hữu generateField/computeDualGrid, không thay geography/RNG của seed.

- [ ] **Step 1 — Test fail:** `distinct_building_silhouettes` ruộng/cối xay/kho thóc khác pixel và silhouette; ít nhất motif xác định cho mọi placeable CardId; Ngai chỉ các Ngai đã đăng ký. Native size lấy BUILDING_SIZE/THRONE_SIZE metadata (khuyến nghị giữ 32 × 40/32 × 48), feet/bbox trong canvas; card_art đúng CARD_ART metadata và mô tả không nằm trong ảnh.
- [ ] `terrain_preserves_seed_geometry`: generateField seed 1/7 bytes như baseline, 16 terrain masks không seam, ô open/locked/throne khác nhau/nhìn rõ; `art_contract_for_all_cards` mọi ảnh qua E1, opaque không bị thiếu/đen, no duplicate frames, cùng input cùng output. Không test “art đẹp” bằng hash snapshot đơn độc.
- [ ] **Step 2 — FAIL:** `npx vitest run src/render/buildingVariants.test.ts src/render/worldArt.test.ts src/render/atlas.test.ts < /dev/null`; mong thiếu painter/motifs, chưa làm đổi atlas để test tự pass.
- [ ] **Step 3 — Cài đặt bản mẫu:** dựng worldStyle/buildingVariants và review tool dùng chúng trực tiếp, chưa thay painter đang được atlas gọi. Mẫu gồm ground 5 terrain × 16 mask, 3 plot state, tất cả placeable/Ngai/card-art theo owner, 1×/2×/3× trên nền sáng/tối. Code-generated theo hướng code-generated đã chốt và brief E1: fantasy ấm, mái/chất liệu nhận diện, bớt nhiễu nền, dấu phe rõ; RGB không bị khoá 32 màu. Không làm portrait Ngai G4 giả.
- [ ] **Step 3b — Cổng chủ dự án duyệt asset:** lưu PNG, metadata `origin: custom`, kích thước, prompt không áp dụng (code-generated), module/commit nguồn và khác biệt so baseline; ghi lựa chọn/chỉnh sửa/duyệt trong world-v1.md. Chưa duyệt → dừng adopt, không tự đánh dấu task xong hoặc đi tạo bộ lính tiếp theo. Batch 005 AI chỉ là reference đã có, không adopt PNG AI thành runtime trong đợt art sinh bằng code này.
- [ ] **Step 3c — Sau duyệt:** nối field/plot/building/cardArt/atlas qua painter đã duyệt; cardArt dùng cùng motif, fit integer/không crop mất đầu/chân; register output custom trong `docs/assets.manifest.yml` và `CREDITS.md` nếu xuất PNG để runtime, nguồn thuần code ghi credit module. Không nhập asset ngoài thay cho code trong đợt này; không tự mở lại phạm vi đã chốt.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC trên seed 1/7 và nhiều vua: đọc bàn, ô khoá/giá, nhà không che sai ô, card và nhà cùng motif; so ảnh trước/sau đã duyệt.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(art): add approved terrain and card-specific building art`.

### Task E6b: Lính, boss và animation phân biệt thật ở native size

**Files:**

- Create: `src/render/unitVariants.ts`.
- Modify: `src/render/unitArt.ts`, `src/render/UnitRenderer.ts`, `src/render/atlas.ts`.
- Modify (tool): `tools/render-art-review.mjs`.
- Create (docs): `docs/art-review/g3e/units-v1.md`, `docs/art-review/g3e/units-v1.png`.
- Test (Create): `src/render/unitVariants.test.ts`.
- Test (Modify): `src/render/worldArt.test.ts`, `src/render/atlas.test.ts`.

- Modify (provenance khi adopt): `docs/assets.manifest.yml`, `CREDITS.md`; chỉ ghi nguồn custom/code-generated và output thực dùng; không thêm asset ngoài mới.

**Interfaces:**

- Consumes E1/E6a art contracts, `CONTENT.allUnits`, UnitDef.sprite/tags/behaviours, `unitFrame(unit,team,anim,n)`, `UNIT_FRAME_COUNT=2`, `unitCloth(def)`; không sửa UnitDef/radius/speed để khớp art.
- Produces `paintUnitVariant(def:UnitDef,team:UnitTeam,anim:UnitAnim,frame:0|1,cloth:number):PixelCanvas` trong unitVariants; `paintUnit` hiện có gọi lại nó sau duyệt. Giữ unitFrame/idle/walk/attack/2 frame để renderer và save setup tương thích.

- [ ] **Step 1 — Test fail:** `all_units_match_declared_sprite` mọi UnitDef/2 phe/3 animation/2 frame đúng `def.sprite`, không cố định tất cả 16 × 16; ba boss 48 × 48 vì data hiện hành, frog/hornet có art riêng. `roles_have_distinct_silhouettes`: militia/archer/mage/golem/horse/flying/skeleton không cùng bitmap đổi màu; boss không phải lính phóng to.
- [ ] `animation_has_real_pose_changes`: idle/walk/attack khác tư thế chân/tay/vũ khí theo anim, không chỉ dịch cả ảnh; neo chân/bbox không nhảy ngoài canvas; phe khác cả viền/dấu hình, đọc được không chỉ hue. `unit_renderer_snaps_display_only`: prev/current nội suy → sprite x/y nguyên, world x/y/prev/radius không đổi, flip không angle, bars đọc đúng frame.height metadata.
- [ ] **Step 2 — FAIL:** `npx vitest run src/render/unitVariants.test.ts src/render/worldArt.test.ts src/render/atlas.test.ts < /dev/null`; mong thiếu variants/snap assertion.
- [ ] **Step 3 — Cài đặt bản mẫu:** UnitVariants code-generated theo motif UnitId, outline rõ trên cỏ, vũ khí/động tác đúng tag; bóng alpha được khai báo E1. Review tool xuất toàn unit matrix 1×/integer zoom và boss cạnh nhà/quân để so scale. Chưa nối runtime trước duyệt.
- [ ] **Step 3b — Cổng duyệt bộ lính/boss:** chủ dự án duyệt units-v1; lưu nhận xét và chỉnh cùng bộ trước khi dùng, không tạo FX tiếp khi chưa duyệt. Sau duyệt mới nối paintUnit/atlas và snap UnitRenderer theo pixel camera, giữ interpolated simulation nguyên. Đổi death tween scale lẻ sang alpha/visibility theo bước pixel, không setScale(0.8) hoặc xoay. Không thêm hit/death frame runtime ngoài hợp đồng trong task này.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC: một trận đông và ba boss qua DEV sandbox; pause/1×/3×, silhouette/animation/phe rõ, HP/foot không lệch, không rách frame.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(art): add approved unit silhouettes and boss animation poses`.

### Task E6c: FX/icon pixel, sao cấp và cổng đủ frame/atlas/hiệu năng

**Files:**

- Modify: `src/render/fxArt.ts`, `src/render/FxRenderer.ts`, `src/render/iconArt.ts`, `src/render/atlas.ts`, `src/ui/info/InspectionView.ts`, `src/ui/info/UnitInfoPanel.ts`.
- Modify (tool): `tools/render-art-review.mjs`.
- Create (docs): `docs/art-review/g3e/fx-icons-v1.md`, `docs/art-review/g3e/fx-icons-v1.png`.
- Test (Create): `src/render/atlasBudget.test.ts`, `src/render/FxRenderer.test.ts`.
- Test (Modify): `src/render/atlas.test.ts`, `src/render/worldArt.test.ts`.

- Modify (provenance khi adopt): `docs/assets.manifest.yml`, `CREDITS.md`; chỉ ghi nguồn custom/code-generated và output thực dùng; không thêm asset ngoài mới.

**Interfaces:**

- Consumes E1 ART_POLICY/checkArtFrame; E2b LevelStars; E3b reusable renderer; `packShelves`, `spriteList`, iconFrame/fxFrame và FxRenderer.sync(world,events,alpha) hiện có.
- Produces IconId bổ sung `'star'|'star_empty'|'messenger'|'help'` và frame qua iconFrame; `packCheckedSprites(sprites:readonly {name:string;art:PixelCanvas}[],maxWidth?:number):ReturnType<typeof packShelves>` (default width 1024) trong atlas.ts (validate unique/name/nonempty/size trước upload, fail tên frame khi vượt 4096). `packShelves` giữ API cũ.

- [ ] **Step 1 — Test fail:** `atlas_has_complete_frames`: mọi card/placeable/unit/team/anim/frame, đủ FX/plot/icon, không duplicate, manifest sprite name match; `atlas_budget_and_render_smoke`: packed width/height ≤ 4096, vị trí integer không overlap frame; fixture frame rộng 4097 và duplicate → throw có tên, không allocate canvas khổng lồ. Không xoá coverage 54 thẻ G3.
- [ ] `fx_reuses_pools`: sync 1000 frame/512 entity/400 đạn không tạo pool vô hạn; khi thu projectileCount thì hide phần dư; destroy mọi pool/tween/Graphics. `star_icons_not_text_glyphs`: L1/L5 có đúng 1/5 sao đầy trong 5 slot, kèm text cấp; damage/burn/slow/shield/pulse/boulder phân biệt shape, không blur tween scale 1.5 hoặc sprite rotation.
- [ ] **Step 2 — FAIL:** `npx vitest run src/render/atlasBudget.test.ts src/render/FxRenderer.test.ts src/render/atlas.test.ts < /dev/null`; mong thiếu validator/icon/reuse assertions.
- [ ] **Step 3 — Cài đặt bản mẫu + duyệt:** xuất fx/icons-v1 native và integer zoom, ghi mức alpha/bóng. Chủ dự án duyệt trước nối; sau duyệt cập nhật fxArt/iconArt/atlas và dùng sao ở InspectionView/UnitInfoPanel; UI fallback trước đó không còn cần glyph sao. FX nổ/nhẫn vẽ contour pixel, opacity theo thời gian được nhưng không resample mờ, vị trí snap, arrow 8 hướng có sẵn không xoay.
- [ ] **Step 4 — PASS:** lệnh Step 2; browser hai cỡ PC chạy stress seed cố định, đo ít nhất 10 s sau warm-up và ghi p50/p95 frame time, số texture/Graphics/pool trước–sau restart. Mục tiêu PC ≥ 60 fps; không giả báo fps nếu browser bị throttle, ghi máy/điều kiện và lỗi đo; nếu vượt atlas gate thì chia shelves/bớt padding có căn cứ, không tăng 4096 hoặc tách world thành nhiều atlas cho qua.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(render): approve pixel effects and enforce complete bounded atlases`.

### Task E7a: Khung/nút/thẻ/menu và chữ rõ theo skin mới đã duyệt

**Files:**

- Modify: `src/render/uiArt.ts`, `src/render/uiKit.ts`, `src/ui/theme.ts`, `src/ui/cards/CardView.ts`, `src/scenes/MainMenuScene.ts`.
- Create: `src/render/uiSkin.ts`.
- Modify (tool): `tools/render-art-review.mjs`.
- Create (docs): `docs/art-review/g3e/ui-v1.md`, `docs/art-review/g3e/ui-v1.png`.
- Test (Modify): `src/render/uiArt.test.ts`, `src/render/uiKit.test.ts`.
- Test (Create): `src/render/uiSkin.test.ts`.

- Modify (provenance khi adopt): `docs/assets.manifest.yml`, `CREDITS.md`; chỉ ghi nguồn custom/code-generated và output thực dùng; không thêm asset ngoài mới.

**Interfaces:**

- Consumes E1 flexible RGB/pixel policy, UI_FRAME_IDS/UiFrameDef/uiFrameDef, FONT_UI, createPanel/createButton, E4/E5 Help/notice models; giữ helpers mà caller đang dùng.
- Produces `UI_SKIN` trong uiSkin.ts: semantic text/background/border/focus/disabled/rarity/status colours và typography sizes (body 14 PC, label 13, title 20, Help detail 15; mobile không < 12). `uiFrameDef` vẫn duy nhất sở hữu kích thước/slice/border thực dùng; không thêm registry frame thứ hai.

- [ ] **Step 1 — Test fail:** `skin_frames_stretch_without_blur`: mỗi frame/state đủ tên, slice × 2 < min(w,h), border ≤ slice, core opaque, góc pixel rõ; các trạng thái hover/down/active/rare khác hình/viền, không chỉ màu. `skin_text_contrast`: semantic body trên nền paper đạt contrast ≥ 4.5:1, large ≥ 3:1 (ngưỡng thiết kế của plan, không số gameplay), disabled vẫn đọc được.
- [ ] `kit_fallback_preserves_geometry`: khi kit file thiếu hoặc active → uiFrameDef trả đúng generated/kit def, trạng thái button/card đổi frame không nhảy bounds; không xoá mapping Kenney chỉ vì skin mới. `card_art_integer_scale`: source metadata fit scale nguyên, label dài clamp/tooltip đầy đủ, FONT_UI không mất “Sứ giả, Cối Xay Gió, Sắc lệnh, Vương Miện”. Browser kiểm glyph thật; unit test chỉ kiểm cấu hình/font family và scale, không tuyên bố chứng minh font render.
- [ ] **Step 2 — FAIL:** `npx vitest run src/render/uiSkin.test.ts src/render/uiArt.test.ts src/render/uiKit.test.ts < /dev/null`; mong thiếu skin/contract.
- [ ] **Step 3 — Bản mẫu và duyệt UI:** review sheet panel/button/card 4 rarity/slot/bar/tooltips/menu, so đủ enabled/disabled/hover/down và chữ Việt thật. Chủ dự án duyệt trước dùng; source code custom, Kenney CC0 đã đăng ký giữ fallback; không nhập CC0/CC-BY hoặc pack ngoài mới. Sau duyệt nối UI_SKIN vào uiArt/theme/CardView/MainMenu; giữ `FONT_UI`, không scale toàn HUD bằng CSS transform hoặc pixelate shader; backdrop pixel dither và integer parallax, không thêm blur/glow.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser hai cỡ PC qua menu/Help/quest/council/reward/battle; kiểm chữ Việt, focus, disabled, card rarity/level, panel/nút không nhảy size khi hover; so ảnh ui-v1 đã duyệt.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(ui): apply approved pixel skin and readable typography`.

### Task E7b: HUD PC hai độ phân giải và bố cục mọi overlay mới

**Files:**

- Modify: `src/ui/realm/realmLayout.ts`, `src/ui/menuLayout.ts`, `src/ui/info/inspectionLayout.ts`, `src/ui/help/helpLayout.ts`, `src/scenes/PlanningHudScene.ts`, `src/scenes/BattleHudScene.ts`.
- Test (Modify): `src/ui/realm/realmLayout.test.ts`, `src/ui/menuLayout.test.ts`, `src/ui/info/inspectionLayout.test.ts`, `src/ui/help/helpLayout.test.ts`.
- Test (Create): `src/ui/realm/pcUxLayout.test.ts`.

**Interfaces:**

- Consumes E3a inspectionLayout, E4c helpLayout, E5a QuestNoticeView; `PlanningLayout`, `BattleLayout`, `planningLayout(screen,handSize)` và `battleLayout(screen)` hiện có.
- Produces fields `help:Rect`, `questNotice:Rect` của PlanningLayout; field `help:Rect` của BattleLayout; `inspectionReserved(layout:PlanningLayout|BattleLayout):readonly Rect[]` trong inspectionLayout. Chuyển HUD Help anchor E4d vào layout, không để literal x/y rải rác.

- [ ] **Step 1 — Test fail:** `pc_hud_no_overlap` ở 1280 × 720 và 1920 × 1080, hand size 3/4, long labels/2 nhiệm vụ/18 sắc lệnh/boss: board/hud/notice/help/speed/intervene/fight/confirm không giao nhau; panel có viewport scroll khi chật. Camera world vẫn dùng công thức hiện có → zoom 2 ở 1280 × 720, 3 ở 1920 × 1080; không hardcode zoom 2 cho màn lớn.
- [ ] `inspection_layout_avoids_controls` kiểm với reserved thật sau dàn HUD; `resize_keeps_help_and_selection` đang mở Help, selected unit/bùa hoặc quest modal → resize qua hai cỡ PC, state/selection/filter giữ; body reflow, không duplicate callback; ≤ 44 px không được giấu bằng scale 0.8.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/realm/pcUxLayout.test.ts src/ui/info/inspectionLayout.test.ts src/ui/help/helpLayout.test.ts < /dev/null`; mong thiếu layout fields hoặc collision.
- [ ] **Step 3 — Cài đặt:** thêm fields và dàn PC theo vùng reserved: top cho lives/gold/year/calendar/help, notice dưới year, cột trái decree/quest cuộn, phải scout, dưới hand và actions; camera target không bị thay theo kích thước art. Dùng room thực thay nhân toàn UI theo 1920/1280; Help giới hạn panel đọc được, không kéo giãn chữ/frame lẻ; scene layout() cập nhật mọi view và reserve arrays. Chưa polish mobile, giữ fallback E4/E5 và các test 375 hiện có.
- [ ] **Step 4 — PASS:** lệnh Step 2. Browser cả hai cỡ PC: mở/đóng Help/panel/tháp hover, chơi một vòng năm có quest, một council và boss qua sandbox, resize khi modal đang chọn; không click xuyên, console sạch. Screenshot chuẩn có nhãn seed/năm/mode thật hoặc DEV rõ ràng.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0.
- [ ] **Step 5 — Commit:** `feat(ui): refine desktop HUD and overlay placement at both PC sizes`.

### Task E8: Tối ưu mobile cuối cùng, chống regression save và bàn giao

**Files:**

- Modify: `src/ui/realm/realmLayout.ts`, `src/ui/hud/layout.ts`, `src/ui/menuLayout.ts`, `src/ui/modals/modalLayout.ts`, `src/ui/help/helpLayout.ts`, `src/ui/info/inspectionLayout.ts`, `src/ui/help/HelpCardBrowser.ts`, `src/ui/info/InspectionView.ts`.
- Modify (docs): `README.md`, `docs/ROADMAP.md`, `docs/GDD.md`, `CLAUDE.md`, `docs/art-review/g3e/DECISIONS.md`.
- Test (Create): `src/ui/mobileUx.test.ts`.
- Test (Modify): `src/ui/realm/realmLayout.test.ts`, `src/ui/modals/modalLayout.test.ts`, `src/ui/help/helpLayout.test.ts`, `src/ui/info/inspectionLayout.test.ts`, `src/platform/resumeIntegration.test.ts`.

**Interfaces:**

- Consumes tất cả model/view/layout đã sở hữu ở E2–E7; `decodeRun(raw:unknown,content:Content):LoadRunResult`, `encodeRun(state:RunState,content:Content):SaveEnvelope`, persistence/session G3, không sửa chữ ký.
- Produces bố cục mobile ổn định cho cùng APIs; không type/field mới trong RunState hoặc envelope. PR bàn giao vào develop, có ma trận coverage, bốn quyết định đã chốt và asset approval thực tế.

- [ ] **Step 1 — Test fail:** `mobile_all_controls_reachable` 375 × 812, hand 3/4, Help đủ 8 tab+3 filter+level, badge nhiệm vụ2, quest fee dài, council subselection, info 30 dòng: mọi hit ≥ 44 × 44, close 48, content có viewport cuộn, không tràn width/che CTA. Tab/filter khi không đủ hàng dùng cuộn ngang hoặc chọn lần lượt, không thu nút nhỏ hơn 44. Long press 400 ms mở tooltip, drag vượt DRAG_SLOP không click hoặc chơi bài, world ring không nhận input.
- [ ] `mobile_resize_preserves_state` 1280 × 720 → 375 × 812 → 1920 × 1080 khi Help/quest/council/info đang mở: cùng selected ID/filter/subselection, scroll clamp, không callback hai lần. `save_ui_independence`: encode trước/sau Help/inspect/notice/filter bằng nhau; envelope format 1/state.version 4, meta sentinel nguyên; battle resume tick 0 đúng G3. Không thêm persistence UI vào snapshot để làm test pass.
- [ ] **Step 2 — FAIL:** `npx vitest run src/ui/mobileUx.test.ts src/platform/resumeIntegration.test.ts < /dev/null`; mong các assertion gesture/layout mới fail, không hạ test bố cục cũ.
- [ ] **Step 3 — Cài đặt:** mobile Help dùng tabs cuộn 44 cao, bộ lọc nhiều hàng có cuộn, list/detail chuyển trong cùng modal giữ “Quay lại”; info dạng bottom sheet có viewport, không chặn CTA ngoài sheet khi đóng, khi mở block nền đúng; sao/HP/text không scale lẻ. Notice rút gọn có thể chạm xem đầy đủ, lịch badge “Sứ giả” có tooltip 400 ms. Dùng layout/primitive đã có, không dựng mobile scene thứ hai; gesture cần thay nhiều hơn Files thì tách follow-up có lý do trước khi vượt 10 runtime files.
- [ ] **Step 4 — PASS:** lệnh Step 2; `node tools/sync-shortcuts.mjs --check`. Browser **1280 × 720, 1920 × 1080 và 375 × 812**: menu Help, mọi tab, filter vua thứ 9/trung lập/L5, cuộn dài, inspect nhà/lính/boss/range, sứ giả/council, portrait resize qua PC; reload planning/quest/council/battle rồi Tiếp tục, không mất quyết định. Kiểm console sạch, đo hit area thật, kiểm touch emulator và ít nhất một cảm ứng thật nếu có thiết bị; nếu chỉ emulator, ghi rõ chưa nghiệm thu cảm ứng thật. Đo ≥ 30 fps mobile có ghi thiết bị/throttle; chưa đo được thì ghi chưa có bằng chứng, không giả số.
- [ ] **Step 4b — Tài liệu:** README đồng bộ phím bằng tool và giới thiệu Help/inspect/sứ giả, marker DEV không quảng cáo như tính năng người chơi. ROADMAP/GDD ghi G3e hoàn thành theo kết quả thật, G4/G5 chưa làm; CLAUDE cập nhật module/API, luật art đã chốt, dev isolation. Ghi bản duyệt từng bộ, asset credits/license, bốn lựa chọn chủ dự án đã chốt và mọi sai lệch; không ghi đã duyệt khi chưa có phản hồi.
- [ ] **Lệnh nghiệm thu cuối:** `npm run lint < /dev/null && npm run typecheck < /dev/null && npm test < /dev/null && npm run build < /dev/null` — tất cả exit 0; scan `node tools/check-production-debug.mjs` trên output cuối, production browser không có debug jump.
- [ ] **Step 5 — Commit và PR:** `feat(ui): complete mobile UX and document G3e acceptance`. Stage file theo task, push feature branch, mở PR **base develop**, đính kèm ảnh trước/sau 3 kích thước, kết quả test/build/scan/frame budget, save regression, số liệu performance thực đo và phần chưa kiểm bằng thiết bị thật. Không merge, không push main/develop. Nếu G3 chưa vào develop thì không mở PR giả “hoàn thành”; giải quyết điều kiện baseline đầu plan trước khi thực thi.

## Tự kiểm và ma trận phủ yêu cầu

| Yêu cầu                                                                                                  | Task sở hữu / bằng chứng                                                                |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Nới màu/kích thước nhưng pixel look, sửa văn bản ràng buộc trước art                                     | E1; E6/E7 chỉ adopt sau E1 và duyệt mẫu; không shader trộn màu                          |
| Thay đúng test palette/geometry, giữ coverage                                                            | E1 artPolicy; E6a/b/c size, frame, animation, alpha, atlas; E7a uiKit geometry/fallback |
| Cấp sao/HP hiệu dụng/next-level/bùa/tuổi                                                                 | E2a/E2b → E3a; E6c sao icon                                                             |
| Panel lính riêng đủ damage type/range/rate/armor/speed/tag/behaviour/status/source level                 | E2b → E3a, không đoán sao cho địch/summon                                               |
| Tháp/aura/pulse và lính/địch có vòng đúng runtime, hover/select/camera                                   | E2a/E2b → E3b; ghi rõ distance mép và khác biệt pulse hiện có                           |
| Help menu/trong ván/hotkey, đủ thẻ của 9 vua + trung lập, cơ chế, lính/boss, sắc lệnh, nhiệm vụ, cờ hiệu | E4a/b/c/d, coverage dựa tập ID sống, describeCard là nguồn mô tả                        |
| Help không lệch khi cân bằng, README phím một nguồn                                                      | E4a tool + E4b mock data/fixture + E8 sync check                                        |
| Sứ giả chữ dễ thấy/tooltip/báo trước, active badge và lý do không có quest                               | E5a, dùng lịch/rule hiện có không thêm tần suất                                         |
| DEV jump cô lập và vắng trong production                                                                 | E5b MemorySaveStore/session inject, bundle scan + production browser                    |
| Đất/ô/nhà/thẻ/lính/boss/FX/icon/UI/menu/chữ tốt hơn, duyệt từng bộ                                       | E6a/E6b/E6c/E7a; review sheet native và trong game, ghi người duyệt                     |
| PC 1280/1920 trước; giữ mobile không vỡ; mobile polish cuối                                              | Tất cả task giữ layout375 tests; E7b PC và E8 mobile browser                            |
| Save state4/envelope1, không meta write/UI checkpoint                                                    | E4d, E5b, E8; không task sửa schema/codec                                               |
| Một atlas world, đủ frame, ≤4096, không rò Graphics/FX                                                   | E3b/E6c và E8 performance evidence                                                      |
| Docs + PR develop, không main                                                                            | E1 cập nhật luật tương lai; E8 tài liệu/nghiệm thu/PR                                   |

**Rà interface/ownership:** structureFor/attackStats chỉ E2a công khai; E2b tiêu thụ chúng, không có effective-range formula thứ hai. HelpTab chỉ E4a tạo trong data/help, E4b/E4c/E4d/E5a cùng tiêu thụ, game/events không import ui; LevelStars/BuildingInfoModel/UnitInfoModel/RangeSpec chỉ E2b sở hữu; E3 views và E6c chỉ dùng. RangeRenderer chỉ E3b; Help data chỉ E4b; HelpModal/HelpSession chỉ E4c; HelpGate/HelpScene chỉ E4d. SHORTCUTS chỉ E4a, README và Help cùng tiêu thụ. PreviewTarget/createPreviewRun chỉ E5b, không ngược dependency từ game sang dev. Metadata UI frame vẫn uiFrameDef, không trùng UI_SKIN; packCheckedSprites chỉ E6c. Files lặp giữa task là mở rộng hành vi theo thứ tự, không tạo export trùng chủ sở hữu.

**Phần còn cần duyệt khi thực thi:** mẫu mỹ thuật từng bộ. Bốn lựa chọn đầu plan đã chốt; giữ hành vi range runtime hiện có, nếu sau này muốn buff áp thêm cho pulse/aura thì cần yêu cầu thay đổi luật riêng. Phương án hiện tại bao phủ phạm vi chức năng, giữ luật runtime; không tuyên bố đã có sáu Ngai/perk G4, không coi fixture DEV là ván thật. Không thiếu hạng mục đã chốt của yêu cầu; các phạm vi G4/G5/pack mới/tăng kích thước mô phỏng không tự kéo vào.

**Tự kiểm thực thi:** 17 task, mỗi task có Files/Interfaces, test fail cụ thể → lệnh FAIL → chữ ký/cài đặt → PASS/browser → đúng một cổng toàn dự án → commit. Không task consume export tạo sau nó; UI sao tạm có label trước khi icon E6c xuất hiện; Help E4c có harness trước khi E4d nối scene; DEV dùng luật G3 đã tồn tại, không phụ thuộc art E6. Mọi thay đổi spec/CLAUDE ở E1/E8 là bước tương lai, file plan này không trao quyền tự bắt đầu thực thi trong lượt viết plan.
