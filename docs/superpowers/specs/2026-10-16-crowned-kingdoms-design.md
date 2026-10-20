# Crowned Kingdoms — roguelite xây vương quốc + tự động đánh (Design Spec tổng)

- **Ngày:** 2026-10-16
- **Trạng thái:** chờ duyệt
- **Liên quan:** [UI Stardew spec](2026-10-13-stardew-ui-design.md) · [UI Stardew plan](../plans/2026-10-15-stardew-ui.md) · [ART_STYLE.md](../../ART_STYLE.md) · [GDD.md](../../GDD.md) · [ROADMAP.md](../../ROADMAP.md) · [CLAUDE.md](../../../CLAUDE.md)
- **Điều kiện bắt đầu:** spec này được duyệt. Mọi việc mới rẽ nhánh từ `ui-stardew`. Nhánh `phase1-core-loop` được lưu trữ (không merge, không sửa thêm). Spec này **thay** thiết kế colony sim trong `GDD.md`/`ROADMAP.md`; lịch sử colony sim vẫn còn trong git.
- **Tên:** "Crowned Kingdoms" (trước đây "Chín Vương Miện" / *Nine Crowns*; repo và package `crowned-kingdoms`, trước là `ashen-hollow`).

Game đổi thể loại từ colony sim dark fantasy sang **roguelite xây vương quốc + tự động đánh** (cùng thể loại với *9 Kings* của Sad Socket). Chỉ học **cơ chế** của thể loại; mọi tên vua, tên thẻ, con số, art và chữ trong spec này là bản gốc của dự án.

Spec này là **spec tổng (umbrella)**: mô tả toàn bộ game, rồi chia thành 6 dự án con G0–G5 (§14), mỗi dự án con có plan riêng viết dựa trên spec này.

## 1. Mục tiêu & tiêu chí hoàn thành

Một ván (run) = 30 năm. Mỗi năm người chơi rút 3 thẻ, chơi 1 thẻ lên bàn cờ vương quốc 5×5, rồi xem quân mình **tự động đánh** với đạo quân của một vua láng giềng trong 30–60 giây trên cánh đồng quanh vương quốc. Sống qua năm 30 là thắng; mất hết 3 mạng là thua. Hết ván nhận Điểm Vương Miện để mở khoá vua, perk và thẻ.

Không khí: **fantasy ấm áp, dễ thương** — vương quốc nhỏ, lính chibi, đồng lúa, rừng cây, giao diện gỗ + giấy kem kiểu Stardew Valley.

**Done khi (toàn game, = Done của G5):**

1. Chơi được trọn ván 30 năm với cả 9 vua (§6), thắng/thua đúng luật §3.10; lưu/tải ván giữa các năm (§9.3) và meta-progression (§9.1–9.2) hoạt động.
2. Toàn bộ nội dung trong §6–§7 có trong `src/data/*` và chạy đúng như mô tả: 9 Ngai, 81 thẻ vua, 12 thẻ trung lập, 27 perk, 9 cờ hiệu, 18 sắc lệnh, 13 nhiệm vụ, 3 boss, 1 can thiệp hoàng gia.
3. Mô phỏng trận deterministic: cùng `BattleSetup` + cùng chuỗi lệnh can thiệp → cùng kết quả từng bit (test §13.2); một ván headless 30 năm do bot chơi chạy xong không lỗi.
4. Hiệu năng đạt §8.10 trên desktop và trên điện thoại tầm trung.
5. Mọi màn hình ở §10 đúng bố cục trên desktop 1280×720 và mobile 375×812: không chữ đè nhau, không phần nào tràn màn hình, mọi vùng chạm ≥ 44×44 px.
6. Mọi pixel thế giới lấy từ `PALETTE` mới (§11.1), mọi pixel UI lấy từ `UI_PALETTE` (UI spec §3).
7. Công cụ cân bằng (§14 G5) chạy được và tỉ lệ thắng của bot `greedy` ở độ khó 0 cho mỗi vua nằm trong 35–65%, chênh lệch giữa vua cao nhất và thấp nhất ≤ 15 điểm phần trăm.
8. `npm run lint && npm run typecheck && npm test && npm run build` đều exit 0; CI xanh.

**Ngoài phạm vi:**
- Multiplayer, PvP, leaderboard online, cloud save, tài khoản.
- Chế độ endless, daily run, mod.
- Bản dịch tiếng Anh cho người chơi (chữ in-game chỉ tiếng Việt; id trong code là tiếng Anh).
- Đóng gói native (Tauri/Capacitor); G5 chỉ làm PWA.
- Art vẽ tay cuối cùng và nhạc thu âm: spec này dùng art + âm thanh sinh bằng code, có ranh giới để thay sau (§11.4).
- Đổi font: giữ `FONT_UI` (như UI spec).

## 2. Quyết định đã chốt (từ brainstorming)

Các con số chuẩn nằm ở §3 (ván) và §8 (trận); bảng này chỉ ghi quyết định.

| Câu hỏi | Chọn |
|---|---|
| Repo | **Cùng repo, thay thế.** Giữ hạ tầng: Vite, Phaser 4, Vitest, ESLint, CI, `EventBus`, `SimClock`, `Rng`/`hashSeed`, pipeline pixel art sinh bằng code, `SpatialHash`, thuật toán tách đơn vị (separation). Xoá colony sim (jobs, needs, colonist, designation, nav grid). Lịch sử còn trong git. |
| Nhánh | `phase1-core-loop` lưu trữ, không merge, không sửa nữa. Việc mới rẽ từ `ui-stardew`. |
| Chủ đề | Fantasy ấm áp hợp UI Stardew: vương quốc nhỏ, lính chibi, đồng ruộng, rừng. Bảng màu thế giới **ấm** — bảng "Ashen 32" bị thay bằng bảng "Hearth 32" (§11.1); `UI_PALETTE` của UI spec giữ nguyên. |
| Tên | "Crowned Kingdoms" (trước đây "Chín Vương Miện" / *Nine Crowns*). |
| Phạm vi | **Toàn bộ game** trong spec tổng này, chia G0–G5, mỗi phần một plan (§14). |
| UI | Giữ UI Stardew. Từ plan UI dùng lại Task 1–4 và 9; bỏ Task 5–8 (HUD colony). |
| Vòng năm | Rút 3, chơi 1 (đổi bài tốn vàng, giá tăng dần); xem trước quân địch trên lịch; trận tự động thời gian thực 30–60 s nhìn từ trên xuống trên cánh đồng quanh bàn cờ; lính sinh từ ô lúc bắt đầu trận, tháp bắn, địch vào từ mép bản đồ; một kỹ năng can thiệp hoàng gia có hồi chiêu; mọi thứ hồi đầy sau trận. |
| Mạng | Địch phá Ngai → mất 1 trong 3 mạng; hết mạng = thua ván. |
| Thắng trận | Nhận vàng + chọn 1 trong 3 thẻ thưởng. |
| Chinh phục | Mỗi vua địch tấn công 3 lần; thắng lần thứ 3 = chinh phục, được chọn 1 thẻ của vua đó. |
| Hội đồng | Năm 5, 10, 15, 20, 25: chọn 1 trong 3 sắc lệnh. Boss năm 10, 20, 30. Sống qua năm 30 = thắng. |
| Bàn cờ | 5×5, mở sẵn 3×3 giữa, Ngai ở tâm; mở thêm ô bằng sách phép/sắc lệnh/vàng. |
| Loại thẻ | Ngai (1, quyết định vua, nâng cấp được) · Lính · Tháp · Kinh tế/Hỗ trợ · Bùa (gắn lên ô, cộng dồn vĩnh viễn) · Sách phép (dùng ngay). Nhiệm vụ ngẫu nhiên giữa ván. |
| Vua | 9 vua gốc (§6), mỗi vua 1 Ngai + 9 thẻ + 3 perk. Vua Du Mục mở bằng meta-progression. |
| Meta | Điểm Vương Miện cuối ván mở perk và vua. |

Quyết định bổ sung trong spec này (người dùng cần kiểm tra, xem phần trả lời kèm spec):
- Bỏ phụ thuộc `bitecs`: trận dùng mảng kiểu struct-of-arrays thuộc từng `BattleWorld` (§8.1) để chạy nhiều trận headless song song trong test/cân bằng.
- Chơi thẻ **miễn phí**; vàng chỉ dùng để đổi bài, mở ô và một số thẻ (§3.3).
- Công trình trên bàn cờ là mục tiêu trong trận (có máu, bị phá thì ngừng hoạt động tới hết trận).

## 3. Cấu trúc ván

### 3.1 Hằng số ván (`src/data/run.ts`)

Mọi con số dưới đây chỉ được định nghĩa ở đây; code đọc từ `RUN`. Tất cả là **giá trị tinh chỉnh ban đầu**.

```ts
export const RUN = {
  years: 30,
  startLives: 3,
  maxLives: 4,              // chỉ vượt 3 nhờ sắc lệnh/perk
  startGold: 5,
  taxPerYear: 3,            // thu nhập cố định đầu mỗi năm
  handSize: 3,
  skipPlayGold: 2,          // bán/bỏ một thẻ thay cho việc chơi thẻ
  skipRewardGold: 3,        // bỏ qua thẻ thưởng
  conquestGold: 5,
  bossGoldMult: 2,
  maxLevel: 5,
  maxEnchantStacks: 4,
  councilYears: [5, 10, 15, 20, 25],
  bossYears: [10, 20, 30],
  questYears: [3, 7, 12, 17, 22, 27],
  maxActiveQuests: 2,
  difficultyLevels: 5,      // độ khó "Gai" 0..5
  difficultyBudgetStep: 0.1,
  difficultyCrownStep: 0.2,
} as const;

/** Vàng khi thắng trận năm y (trước nhân boss). */
export const battleGold = (year: number): number => 2 + Math.ceil(year / 3);
/** Giá lần đổi bài thứ n (n = 1, 2, …) trong cùng một năm: 1, 2, 4, 8, … */
export const rerollCost = (n: number): number => 2 ** (n - 1);
/** Giá mở ô thứ k+1 bằng vàng (k = số ô đã MUA bằng vàng trước đó): 4, 6, 8, … 34. */
export const unlockCost = (k: number): number => 4 + 2 * k;
```

Ví dụ kiểm tra (dùng trong test): `battleGold(1) = 3`, `battleGold(10) = 6`, `battleGold(30) = 12`; `rerollCost(1..4) = 1, 2, 4, 8`; `unlockCost(0) = 4`, `unlockCost(15) = 34`.

### 3.2 Vòng một năm

```
Đầu năm ─► Lập kế hoạch ─► Trận ─► Sau trận ─► (Thưởng) ─► (Chinh phục) ─► (Hội đồng) ─► Cuối năm ─► Lưu
```

1. **Đầu năm** (`RunPhase = 'yearStart'`, tự chạy, thứ tự chính xác ở §5.5): năm += 1, phí duy trì, tăng trưởng tự động, thu nhập, có thể đề nghị nhiệm vụ (§7.2), rút bài.
2. **Lập kế hoạch** (`'planning'`): người chơi xem lịch + xem trước quân địch (§3.5), có thể: đổi bài (§3.4), mở ô bằng vàng (§3.11), dùng hành động miễn phí của Ngai nếu có (Vua Du Mục), rồi **chơi đúng 1 thẻ** hoặc **bán/bỏ 1 thẻ** (`discard`, +`RUN.skipPlayGold` vàng từ G2). Sau đó bấm "Ra trận". **G1** (`RULES_G1.autoStart = true`): không có nút "Ra trận" — trận tự bắt đầu ngay sau khi chơi hoặc bỏ thẻ, hoặc ngay đầu năm nếu không lá nào trên tay có mục tiêu hợp lệ; từ G2 (`autoStart = false`) nút "Ra trận" hiện lại vì pha này còn đổi bài, mua ô, dời miễn phí.
3. **Trận** (`'battle'`): mô phỏng §8.
4. **Sau trận**: áp dụng kết quả (§3.10), tăng bộ đếm tấn công của kẻ địch, kiểm tra chinh phục (§3.7), kiểm tra nhiệm vụ.
5. **Thưởng** (`'reward'`, chỉ khi thắng): chọn 1 trong 3 thẻ hoặc bỏ qua (§3.8).
6. **Chinh phục** (`'conquest'`, chỉ khi vừa chinh phục): chọn 1 trong 3 thẻ của vua bại trận.
7. **Hội đồng** (`'council'`, năm thuộc `RUN.councilYears`, thắng hay thua đều có): chọn 1 trong 3 sắc lệnh (§7.1).
8. **Cuối năm**: nếu năm = `RUN.years` hoặc mạng = 0 → kết thúc ván (`'ended'`). Ngược lại lưu ván (§9.3) và sang năm mới.

### 3.3 Vàng

- Khởi đầu `RUN.startGold`. Vàng là số nguyên ≥ 0, không giới hạn trên.
- **Thu vào:** thuế `RUN.taxPerYear` mỗi đầu năm; hiệu ứng thẻ kinh tế/Ngai/sắc lệnh/perk (đầu năm); thắng trận `battleGold(year)` (× `RUN.bossGoldMult` nếu năm boss); chinh phục `RUN.conquestGold`; bán/bỏ thẻ `RUN.skipPlayGold`; bỏ qua thưởng `RUN.skipRewardGold`; hiệu ứng trong trận (ví dụ cướp biển) cộng ở bước Sau trận.
- **Chi ra:** đổi bài, mở ô, thẻ có chi phí vàng ghi rõ trong hiệu ứng (ví dụ `tide_privateers`), phí duy trì (`neutral_mercenary_camp`), cờ hiệu "Cướp Bóc" của Vua Thuỷ Triều (§6.7).
- Chơi thẻ không tốn vàng.

### 3.4 Bộ bài, tay bài và đổi bài

- **Bộ bài (deck)** là danh sách `CardId` có thể trùng (mỗi phần tử là một "bản"). Bộ khởi đầu của vua = mỗi thẻ thường (`common`) ×2 + mỗi thẻ vừa (`uncommon`) ×1 = 11 bản; thẻ hiếm (`rare`) chỉ có qua thưởng. Thẻ Ngai không nằm trong bộ bài.
- **Rút bài:** `RunState` có chồng rút `drawPile` và chồng bỏ `discardPile`; `hand ∪ drawPile ∪ discardPile` luôn bằng `deck` (theo từng bản). Tay bài **giữ** giữa các năm: đầu năm chỉ rút thêm từ `drawPile` cho đủ `RUN.handSize`; `drawPile` hết thì xáo `discardPile` (bằng `Rng(stream 'draw')`) làm chồng rút mới. Thẻ đã chơi và thẻ bỏ vào `discardPile`; thẻ thưởng/chinh phục nhận được vào **đầu `drawPile`** để có ngay trên tay năm sau. Bộ bài ít hơn số cần rút thì rút hết, không lỗi. Tay bài và hai chồng lưu trong save (đổi bài không gian lận được bằng cách tải lại).
- **Đổi bài:** bỏ cả tay vào `discardPile`, rút lại `RUN.handSize` bản mới theo cùng luật, trả `rerollCost(n)` với `n` = số lần đã đổi trong năm + 1. Bộ đếm về 0 mỗi đầu năm.
- **Bán/bỏ thẻ (`discard`):** bỏ đúng một thẻ đã chọn vào `discardPile` thay cho việc chơi thẻ (tay còn lại giữ nguyên), nhận `RUN.skipPlayGold` (G2+; G1 chưa có vàng).
- Thẻ không được chơi không mất khỏi bộ bài (ở lại tay hoặc vào `discardPile`).
- Loại thẻ khỏi bộ bài chỉ bằng sắc lệnh "Thanh Lọc" (§7.1).

### 3.5 Lịch và kẻ địch

Mỗi ván có **6 vua địch** `K1…K6`, chọn bằng `Rng(stream 'calendar')` (xáo trộn rồi lấy 6) từ 8 vua còn lại (kể cả vua người chơi chưa mở khoá — để giới thiệu). Lịch 30 năm theo **mẫu cố định**:

| Năm | Kẻ tấn công | Năm | Kẻ tấn công | Năm | Kẻ tấn công |
|---|---|---|---|---|---|
| 1 | Thổ Phỉ | 11 | K3 (lần 2) | 21 | K4 (lần 3) |
| 2 | Thổ Phỉ | 12 | K4 (lần 1) | 22 | K6 (lần 2) |
| 3 | K1 (lần 1) | 13 | K2 (lần 3) | 23 | Liên Quân K1+K2 |
| 4 | K2 (lần 1) | 14 | Thổ Phỉ | 24 | K5 (lần 3) |
| 5 | Thổ Phỉ | 15 | K5 (lần 1) | 25 | Liên Quân K3+K4 |
| 6 | K1 (lần 2) | 16 | K3 (lần 3) | 26 | K6 (lần 3) |
| 7 | K3 (lần 1) | 17 | K4 (lần 2) | 27 | Liên Quân K5+K6 |
| 8 | K2 (lần 2) | 18 | K6 (lần 1) | 28 | Liên Quân K1+K4 |
| 9 | K1 (lần 3) | 19 | K5 (lần 2) | 29 | Liên Quân K2+K5 |
| 10 | **Boss 1** (§7.3) | 20 | **Boss 2** | 30 | **Boss 3** |

- Mỗi vua đúng 3 lần tấn công, cách nhau ≥ 3 năm.
- **Thổ Phỉ** dùng đạo quân trung lập (§6.2), không cờ hiệu. **Liên Quân** gộp `enemyRoster` của hai vua (trọng số giữ nguyên), không áp cờ hiệu.
- Đạo quân **vua** mang cờ hiệu (`banner`) của vua đó (§6.3–6.11).
- **Xem trước:** trước khi chơi thẻ, người chơi thấy lịch các năm tới (§10.3) và thành phần chính xác đạo quân năm nay: từng đợt, loại lính × số lượng, cấp và mép bản đồ xuất hiện (đạo quân được tạo deterministic ở đầu năm, §3.6).

### 3.6 Ngân sách quân địch

Ngân sách tính bằng **điểm quân (EP)**; mỗi `UnitDef` có `enemyCost` (EP ở cấp 1).

```ts
/** Ngân sách gốc năm 1..30 = round(12 × 1.15^(y−1)), lưu sẵn để không phụ thuộc Math.pow. */
export const ENEMY_BUDGET = [
  12, 14, 16, 18, 21, 24, 28, 32, 37, 42,
  49, 56, 64, 74, 85, 98, 112, 129, 149, 171,
  196, 226, 260, 299, 344, 395, 454, 522, 601, 691,
] as const;

export const SLOT_MULT = {
  raiders: 0.8,      // Thổ Phỉ
  coalition: 1.1,    // Liên Quân
  kingAttack: [0.9, 1.0, 1.2], // lần 1, 2, 3 của một vua
  boss: [1.5, 1.75, 2.0],      // đạo quân đi kèm boss 1, 2, 3 (chưa tính chính boss)
} as const;

export const ENEMY_CAP = 120;            // tối đa đơn vị địch được tạo từ ngân sách
export const ENEMY_LEVEL_COST = [1, 2, 4, 8, 16] as const;      // hệ số EP theo cấp 1..5
export const ENEMY_LEVEL_STAT = [1, 1.45, 2.1, 3.05, 4.42] as const; // hệ số HP & DMG theo cấp
export const WAVES = { share: [0.4, 0.35, 0.25], spawnTick: [0, 120, 240] } as const;
```

`budget = round(ENEMY_BUDGET[y−1] × slotMult × (1 + RUN.difficultyBudgetStep × gai))`, với cờ hiệu "Đông Như Kiến" (Vua Lúa Mì) nhân `enemyCost` × 0.8 khi tính.

**Thuật toán thành phần** (`composeArmy`, `src/game/battle/compose.ts`, dùng `Rng(stream 'army', year)`):
1. `roster` = danh sách `{unit, weight}` của kẻ tấn công. `avg` = trung bình `enemyCost` có trọng số.
2. Cấp `ℓ` = cấp nhỏ nhất trong 1..5 sao cho `budget / (avg × ENEMY_LEVEL_COST[ℓ−1]) ≤ ENEMY_CAP`; nếu cả cấp 5 vẫn vượt thì `ℓ = 5`.
3. Lặp: chọn đơn vị theo trọng số bằng `Rng`, nếu `cost × ENEMY_LEVEL_COST[ℓ−1] ≤ còn lại` thì thêm; dừng khi còn lại < giá rẻ nhất hoặc đã có `ENEMY_CAP` đơn vị.
4. Nếu dừng vì chạm `ENEMY_CAP` mà còn ngân sách: `surplus = budget / đã tiêu`, mọi đơn vị nhân HP và DMG thêm `√surplus` (dùng `Math.sqrt`, xác định).
5. Chia đợt: xếp đơn vị theo thứ tự đã tạo, cắt theo `WAVES.share` (làm tròn xuống, phần dư vào đợt 3). Mỗi đợt chọn mép bằng `Rng`: năm < 10 một mép, năm ≥ 10 hai mép (chia đôi số lính); cờ hiệu "Đột Kích" (Vua Du Mục) thêm một mép.
6. Kết quả `ArmyPlan` lưu trong `RunState` ở đầu năm (để xem trước và để tải lại ra cùng đạo quân).

Ví dụ: năm 1 Thổ Phỉ `round(12 × 0.8) = 10` EP; năm 30 boss 3 `round(691 × 2.0) = 1382` EP ở độ khó 0.

### 3.7 Chinh phục

- `RunState.enemies[K].attacks` tăng 1 sau mỗi trận với vua K (thắng hay thua). Liên Quân không tính vào lần tấn công.
- Thắng trận ở **lần 3** → vua K bị **chinh phục**: +`RUN.conquestGold`, mở bước Chinh phục: 3 thẻ khác nhau rút ngẫu nhiên từ 9 thẻ của vua K (không gồm Ngai), chọn 1 thêm vào bộ bài (bắt buộc chọn).
- Thua ở lần 3 → vua K **rút lui**, không chinh phục được nữa.
- Kết thúc ván thống kê số vua đã chinh phục (dùng cho §9.1).

### 3.8 Thẻ thưởng

- Chỉ khi thắng trận. 3 lựa chọn khác `CardId` nhau; mỗi lựa chọn: 65% từ 9 thẻ của vua người chơi, 35% từ bể trung lập đã mở khoá (§6.1); độ hiếm theo trọng số:

| Năm | Thường | Vừa | Hiếm |
|---|---|---|---|
| 1–9 | 60 | 30 | 10 |
| 10–19 | 45 | 35 | 20 |
| 20–30 | 30 | 40 | 30 |

- Nếu nhóm đã chọn không còn thẻ khác id ở độ hiếm đó, hạ xuống độ hiếm thấp hơn, rồi đổi nguồn.
- Chọn → thêm 1 bản vào bộ bài. "Bỏ qua" → +`RUN.skipRewardGold`.
- Sắc lệnh "Giao Thương" nâng số lựa chọn lên 4.

### 3.9 Hội đồng hoàng gia

Ở năm thuộc `RUN.councilYears`, sau Thưởng/Chinh phục: rút 3 sắc lệnh khác nhau chưa sở hữu từ bể §7.1 bằng `Rng(stream 'council')`, chọn đúng 1. Sắc lệnh vĩnh viễn tới hết ván.

### 3.10 Mạng, thắng và thua

- Trận kết thúc theo §8.8: **thắng** (diệt hết địch, hoặc hết giờ mà Ngai còn máu) hay **thua** (Ngai về 0 máu).
- **Thắng:** + vàng trận; mở bước Thưởng.
- **Thua:** −1 mạng; không vàng trận, không thưởng (trừ perk "Chuộc Tù").
- Mạng = 0 → **thua ván** ngay sau bước Sau trận.
- Sau trận năm 30, nếu mạng > 0 → **thắng ván**. Thắng boss 3 được ghi riêng ("Vương Miện Vàng", +điểm ở §9.1).
- Sau mỗi trận mọi công trình và Ngai hồi đầy; lính không tồn tại giữa các trận.

### 3.11 Mở ô

- Ô khoá chỉ mở được nếu kề cạnh (§4.1) với một ô đã mở.
- Mở bằng vàng trong pha Lập kế hoạch, giá `unlockCost(k)` với `k = RunState.purchasedPlots`; mở bằng sách phép/sắc lệnh/perk không tăng `k`.
- Không giới hạn số lần mở trong một năm (miễn đủ vàng); không phải là "chơi thẻ".

## 4. Bàn cờ & luật đặt thẻ

### 4.1 Toạ độ và kề cạnh

- Ô `(col, row)` với `col, row ∈ 0..4`; chỉ số `plot = row × 5 + col` (0..24). Ngai ở `(2,2)` = chỉ số 12, không bao giờ di chuyển.
- Khởi đầu mở 3×3 giữa: `col, row ∈ 1..3` (9 ô gồm Ngai → 8 ô xây được). 16 ô viền bị khoá.
- **Lân cận (neighbours)** của một ô = các ô **trực giao** (Bắc, Đông, Nam, Tây) nằm trong bàn cờ. Hiệu ứng "lân cận" chỉ tác động lên công trình đang đứng ở các ô đó (ô khoá/trống bị bỏ qua, trừ khi thẻ nói rõ ô trống). Thứ tự duyệt lân cận luôn là **Bắc, Đông, Nam, Tây**.
- "Toàn bàn cờ" = mọi công trình kể cả Ngai, trừ khi bộ lọc loại trừ.
- Khoảng cách Manhattan dùng cho "dời ≥ 2 ô".

### 4.2 Cấp

- Công trình có cấp 1..`RUN.maxLevel` (5). Đặt mới = cấp 1.
- **Chơi trùng:** chơi một thẻ công trình lên ô đang có **cùng `CardId`** → +1 cấp. Đây là cách lên cấp chính; sách phép "Thăng Cấp" và một số thẻ khác cũng nâng cấp.
- Hiệu ứng theo cấp đọc từ bảng `PerLevel` (5 giá trị) của thẻ; chỉ số chiến đấu theo hồ sơ chuẩn ở §5.2 trừ khi thẻ ghi khác.
- Ngai có cấp riêng 1..5: +1 khi thắng boss 1, +1 khi thắng boss 2, và qua "Ấn Triện" / sắc lệnh "Đúc Lại Vương Miện".

### 4.3 Bùa (enchantment)

- Gắn lên **công trình** (không phải lên ô trống), chỉ loại công trình nằm trong `targets` của thẻ Bùa.
- Mỗi lần chơi = +1 stack của Bùa đó; Bùa khác nhau cùng gắn được. Tổng stack mọi Bùa trên một công trình ≤ `RUN.maxEnchantStacks` (perk "Sách Phép Dày" nâng lên 6).
- Bùa đi theo công trình khi bị dời; mất khi công trình bị hiến tế/dỡ bỏ. Nhân bản không chép Bùa.
- Stack "ảo" của Thư Viện (§6.5) không tính vào giới hạn.

### 4.4 Luật chơi thẻ & nước đi không hợp lệ

| Thẻ | Mục tiêu hợp lệ |
|---|---|
| Công trình (lính/tháp/kinh tế/hỗ trợ) | Ô đã mở, trống → đặt cấp 1. Ô có cùng `CardId` và cấp < 5 → +1 cấp. |
| Bùa | Công trình có loại trong `targets`, còn chỗ stack. |
| Sách phép | Theo `target` của thẻ (§5.1); thẻ `target: 'none'` dùng bằng nút "Dùng". |

**Không hợp lệ** (UI hiện ô đỏ + lý do trong tooltip, `IllegalReason`):
- `locked` — ô chưa mở. `throne` — ô Ngai (chỉ Bùa và thẻ ghi rõ Ngai được nhắm Ngai). `occupied` — ô có công trình khác `CardId`. `maxLevel` — đã cấp 5. `noBuilding` — Bùa/sách phép cần công trình mà ô trống. `wrongKind` — loại công trình không thuộc `targets`. `stacksFull` — hết chỗ stack. `noTarget` — sách phép không còn mục tiêu nào trên bàn cờ. `notEnoughGold` — thiếu vàng. `lastLife` — thẻ cần mất mạng khi còn 1 mạng.
- Thẻ trên tay không có mục tiêu hợp lệ nào hiện mờ; người chơi vẫn có thể đổi bài hoặc bán/bỏ thẻ.
- Không có "huỷ nước đi": UI luôn có bước xác nhận ✓/✕ trước khi chơi (§10.3).

### 4.5 Dời, hiến tế, nhân bản

- **Dời:** công trình (không phải Ngai) sang ô đã mở khác; nếu ô đích có công trình thì **đổi chỗ**. Giữ cấp, Bùa, tuổi. Ghi `movedYear = year`.
- **Hiến tế / dỡ bỏ:** xoá công trình (không phải Ngai) cùng Bùa; ô trở về trống (vẫn mở). Mọi thẻ có tag `sacrifice` kích hoạt hook `onSacrifice`.
- **Nhân bản:** đặt bản sao (cùng `CardId`, cùng cấp, tuổi 0, không Bùa) lên một ô đã mở, trống.

## 5. Mô hình dữ liệu thẻ & hệ hiệu ứng

### 5.1 Kiểu dữ liệu (`src/data/types.ts`, thuần TS)

Dữ liệu chỉ là **mô tả** (không chứa hàm). Logic nằm ở `src/game/cards/effects/*` (hiệu ứng chung) và `src/game/cards/custom/<king>.ts` (hiệu ứng riêng), được tra theo `type`/`id`.

```ts
export type Level = 1 | 2 | 3 | 4 | 5;
/** Giá trị theo cấp L1..L5. */
export type PerLevel = readonly [number, number, number, number, number];
/** Số cố định hoặc theo cấp. Trong Bùa luôn là number (nhân với số stack). */
export type Scalar = number | PerLevel;

export type KingId =
  | 'wheat' | 'stone' | 'arcane' | 'grove' | 'tide' | 'forge' | 'clock' | 'moon' | 'nomad';
export type CardOwner = KingId | 'neutral';
export type CardKind = 'throne' | 'troop' | 'tower' | 'economy' | 'support' | 'enchantment' | 'tome';
export type BuildingKind = 'throne' | 'troop' | 'tower' | 'economy' | 'support';
export type Rarity = 'common' | 'uncommon' | 'rare';
export type CardTag =
  | 'farm' | 'grove' | 'fire' | 'clockwork' | 'undead' | 'pirate' | 'cavalry' | 'mage' | 'golem' | 'sacrifice';

export type DamageType = 'physical' | 'fire' | 'magic';
export type UnitTag =
  | 'melee' | 'ranged' | 'flying' | 'siege' | 'boss' | 'summon' | 'human' | 'beast' | 'undead'
  | 'clockwork' | 'golem' | 'mage' | 'pirate' | 'cavalry' | 'construct';
export type TargetMode = 'nearest' | 'closestToThrone' | 'lowestHp' | 'highestHp';

export interface AttackSpec {
  readonly dmg: number;
  readonly type: DamageType;
  readonly range: number;            // px, khoảng cách mép–mép (§8.4)
  readonly minRange?: number;
  readonly interval: number;         // tick giữa hai đòn
  readonly projectileSpeed?: number; // px/tick; không có = đánh tức thời
  readonly splash?: number;          // bán kính; mục tiêu phụ nhận 50%
  readonly cleave?: number;          // số mục tiêu tối đa trong tầm cận chiến; phụ nhận 50%
  readonly chain?: { readonly count: number; readonly radius: number; readonly falloff: number };
  readonly cone?: { readonly range: number; readonly halfAngleCos: number };
  readonly onHit?: readonly OnHitDef[];
}

export type OnHitDef =
  | { type: 'slow'; pct: number; ticks: number }
  | { type: 'stun'; ticks: number }
  | { type: 'burn'; dps: number; ticks: number }
  | { type: 'poison'; dps: number; ticks: number; maxStacks: number }
  | { type: 'knockback'; px: number }
  | { type: 'pull'; px: number; every: number }
  | { type: 'lifesteal'; pct: number }
  | { type: 'healAlly'; hp: number; radius: number }
  | { type: 'rampSameTarget'; pctPerHit: number; cap: number };

export type UnitBehaviourDef =
  | { type: 'reviveOnce'; hpPct: number }
  | { type: 'enrage'; belowHpPct: number; dmgPct: number }
  | { type: 'rampDmg'; pctPerSecond: number; cap: number }
  | { type: 'rampAttackSpeed'; pctPerSecond: number; cap: number }
  | { type: 'stepBuff'; everyTicks: number; dmgPct: number; speedPct: number; maxStacks: number }
  | { type: 'charge'; dmgMult: number; knockback: number; stunTicks: number }
  | { type: 'kite'; distance: number }
  | { type: 'healAura'; radius: number; hpPerSec: number }
  | { type: 'deathSpawn'; unit: UnitId; count: number }
  | { type: 'killHeal'; hp: number }
  | { type: 'soulScaling'; pctPerSoul: number }
  | { type: 'boss'; id: BossId };

export interface UnitDef {
  readonly id: UnitId;
  readonly nameVi: string;
  readonly hp: number;
  readonly attack: AttackSpec;
  readonly speed: number;   // px/tick
  readonly radius: number;  // px, va chạm
  readonly armor: number;   // 0..0.75
  readonly tags: readonly UnitTag[];
  readonly behaviours?: readonly UnitBehaviourDef[];
  readonly enemyCost: number; // EP ở cấp 1; 0 = không bao giờ được composeArmy chọn
  readonly sprite: { readonly w: 16 | 24 | 48; readonly h: 16 | 24 | 32 | 48 };
}

export type Scope = 'self' | 'neighbours' | 'board';
export interface Filter {
  readonly kinds?: readonly BuildingKind[];
  readonly tags?: readonly CardTag[];
  readonly unitTags?: readonly UnitTag[];
  readonly cardIds?: readonly CardId[];
}
export type StatKey =
  | 'hp' | 'dmg' | 'attackSpeed' | 'range' | 'speed' | 'armor' | 'unitCount'
  | 'structureHp' | 'knockback' | 'burnDps';

export type EffectDef =
  | { type: 'spawn'; unit: UnitId; count: PerLevel }
  | { type: 'tower'; attack: AttackSpec; targeting: TargetMode }
  | { type: 'pulse'; everyTicks: number; radius: Scalar; attack: AttackSpec } // đòn vòng tròn quanh công trình
  | { type: 'gold'; amount: Scalar }                                          // đầu năm
  | { type: 'stat'; scope: Scope; filter?: Filter; stat: StatKey; mode: 'flat' | 'pct'; value: Scalar }
  | { type: 'taunt'; radius: number }
  | { type: 'healAura'; radius: number; hpPerSec: Scalar }
  | { type: 'shieldPulse'; radius: number; amount: Scalar; everyTicks: number }
  | { type: 'summonEvery'; unit: UnitId; everyTicks: Scalar; maxPerBattle: Scalar }
  | { type: 'custom'; id: CustomEffectId; params?: Readonly<Record<string, Scalar>> };

export type TomeTarget =
  | 'none' | 'building' | 'buildingThenPlot' | 'buildingThenBuilding' | 'lockedPlot' | 'emptyPlot';
export type TomeAction =
  | { type: 'levelUp'; amount: number }
  | { type: 'unlockPlot'; gold: number }
  | { type: 'move'; levelIfFar: number }     // levelIfFar: +cấp nếu Manhattan ≥ 2 (0 = không)
  | { type: 'sacrifice'; goldPerLevel: number }
  | { type: 'duplicate' }
  | { type: 'throneLevel' }
  | { type: 'custom'; id: CustomEffectId; params?: Readonly<Record<string, Scalar>> };

interface CardBase {
  readonly id: CardId;            // `${owner}_${tên}`, ví dụ 'wheat_militia'
  readonly owner: CardOwner;
  readonly nameVi: string;
  readonly name: string;          // tên tiếng Anh, chỉ dùng trong code/debug
  readonly rarity: Rarity;        // Ngai: 'rare' (không dùng)
  readonly tags: readonly CardTag[];
  readonly textVi: string;        // mẫu có placeholder {key}, giải bởi describeCard (§5.6)
  readonly unlock?: 'meta';       // chỉ vào bể thưởng sau khi mở khoá ở §9.2
}
export interface ThroneDef extends CardBase {
  readonly kind: 'throne';
  readonly hp: number;
  readonly armor: number;
  readonly attack: AttackSpec;
  readonly passive: readonly EffectDef[];
}
export interface BuildingCardDef extends CardBase {
  readonly kind: 'troop' | 'tower' | 'economy' | 'support';
  readonly structureHp?: PerLevel;  // mặc định theo loại (§5.2)
  readonly effects: readonly EffectDef[];
}
export interface EnchantCardDef extends CardBase {
  readonly kind: 'enchantment';
  readonly targets: readonly BuildingKind[];
  readonly perStack: readonly EffectDef[];   // Scalar trong đây phải là number
}
export interface TomeCardDef extends CardBase {
  readonly kind: 'tome';
  readonly target: TomeTarget;
  readonly actions: readonly TomeAction[];
}
export type CardDef = ThroneDef | BuildingCardDef | EnchantCardDef | TomeCardDef;

export interface PerkDef { readonly id: PerkId; readonly nameVi: string; readonly textVi: string; readonly effects: readonly PerkEffect[] }
export interface BannerDef { readonly id: string; readonly nameVi: string; readonly textVi: string; readonly effects: readonly BannerEffect[] }
export interface KingDef {
  readonly id: KingId;
  readonly nameVi: string;
  readonly name: string;
  readonly color: PaletteColor;                  // màu chủ đạo (§11.1)
  readonly throne: ThroneDef;
  readonly cards: readonly CardDef[];            // đúng 9, không gồm Ngai
  readonly units: readonly UnitDef[];
  readonly enemyRoster: readonly { readonly unit: UnitId; readonly weight: number }[];
  readonly banner: BannerDef;
  readonly perks: readonly [PerkDef, PerkDef, PerkDef];
  readonly unlockCost: number;                   // Điểm Vương Miện; 0 = mở sẵn (§9.2)
}
```

`PerkEffect` và `BannerEffect` là union cùng cách viết: `{ type: 'stat'; … }` (dùng lại dạng `stat` của `EffectDef`, scope `'board'`), `{ type: 'startGold'; amount }`, `{ type: 'startBuilding'; card; plot }`, `{ type: 'startUnlocked'; plots }`, `{ type: 'startLives'; lives }`, `{ type: 'freeReroll' }`, `{ type: 'interventionCooldownPct'; pct }`, `{ type: 'maxEnchantStacks'; value }`, `{ type: 'custom'; id }`. Danh sách `id` custom đóng (`CustomEffectId`, union chuỗi) để TS bắt lỗi chính tả.

**Mở rộng ở G2** (kế hoạch G2a): `EffectDef` thêm `{ type: 'goldPerNeighbour'; cardId; amount: Scalar }` (vàng đầu năm cho mỗi công trình `cardId` lân cận); `StatKey` thêm `'gold'`; `stat.mode` thêm `'flatPost'` (cộng sau mọi %, dùng cho Bùa Tia Lửa); `OnHitDef` thêm `{ type: 'stun'; ticks }` và `{ type: 'rampSameTarget'; pctPerHit; cap }`; `BannerEffect` gồm `enemyCostPct`, `enemyStat` (hp/speed), `enemyShieldPct`; `Rules = { years; calendar; autoStart }` nằm trong `RunState.rules`.

**Trạng thái ván** (`src/game/run/state.ts`) là dữ liệu JSON thuần (lưu được bằng `structuredClone`):

```ts
export interface BuildingState {
  uid: number;                    // tăng dần trong ván, quyết định thứ tự khi cần
  cardId: CardId;
  level: Level;
  enchants: { cardId: CardId; stacks: number }[]; // theo thứ tự gắn lần đầu
  placedYear: number;
  ageBonus: number;               // năm tuổi cộng thêm (Mưa Xuân, perk)
  permanent: Partial<Record<StatKey, number>>;    // % vĩnh viễn từ sách phép (Khắc Ấn Núi…)
  counters: Record<string, number>;               // bộ đếm riêng (Lễ Vật, Tua Ngược…)
  movedYear: number | null;
}
export interface RunState {
  version: number;                // RUN_SAVE_VERSION
  seed: number; kingId: KingId; perkId: PerkId | null; difficulty: number;
  year: number; phase: RunPhase; gold: number; lives: number;
  plots: { unlocked: boolean; building: BuildingState | null }[]; // 25, Ngai ở 12 (building = Ngai)
  throneLevel: Level;
  deck: CardId[]; hand: CardId[]; drawPile: CardId[]; discardPile: CardId[]; autoFire: boolean; rerollsThisYear: number; purchasedPlots: number;
  freeMovesLeft: number;
  enemyKings: KingId[];           // K1..K6
  enemies: Record<KingId, { attacks: number; status: 'pending' | 'conquered' | 'fled' }>;
  army: ArmyPlan | null;          // đạo quân năm nay (§3.6)
  decrees: DecreeId[]; quests: QuestState[];
  offers: OfferState | null;      // lựa chọn đang chờ (thưởng/chinh phục/hội đồng/nhiệm vụ)
  rng: Record<RngStream, number>; // trạng thái từng luồng Rng
  stats: RunStats;                // kill, vàng kiếm, trận thắng, boss thắng, vua chinh phục
  nextUid: number;
}
export type RunPhase = 'yearStart' | 'planning' | 'battle' | 'reward' | 'conquest' | 'council' | 'quest' | 'ended';
```

**Lệnh** (`src/game/run/commands.ts`): mọi thay đổi trạng thái đi qua `applyCommand(state, cmd, content) → { state, events } | { error: IllegalReason }` — hàm thuần, không sửa `state` đầu vào.

```ts
export type RunCommand =
  | { type: 'reroll' }
  | { type: 'play'; handIndex: number; target: PlayTarget }
  | { type: 'discard'; handIndex: number }          // bán/bỏ đúng một thẻ thay cho việc chơi thẻ
  | { type: 'setAutoFire'; on: boolean }           // bật/tắt Đá Tảng tự bắn (mọi pha trừ 'ended')
  | { type: 'unlockPlot'; plot: number }
  | { type: 'freeMove'; from: number; to: number }
  | { type: 'startBattle' }
  | { type: 'battleResult'; result: BattleResult }
  | { type: 'pickOffer'; index: number | null }    // null = bỏ qua (chỉ thưởng/nhiệm vụ)
  | { type: 'advance' };                           // sang bước kế khi không cần lựa chọn
export type PlayTarget =
  | { kind: 'none' } | { kind: 'plot'; plot: number } | { kind: 'two'; first: number; second: number };
```

### 5.2 Hồ sơ tăng cấp chuẩn (`src/data/scaling.ts`)

Áp cho mọi thẻ trừ khi thẻ ghi giá trị riêng. Bảng hệ số cấp L1→L5:

| Hồ sơ | Áp vào | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|---|
| `TROOP_STD` | HP và DMG của lính do công trình sinh ra | ×1 | ×1.25 | ×1.5 | ×1.75 | ×2 |
| `TOWER_STD` | DMG của tháp/đòn `pulse` | ×1 | ×1.35 | ×1.7 | ×2.05 | ×2.4 |
| `TOWER_RANGE` | Tầm tháp/bán kính `pulse` | +0 | +4 | +8 | +12 | +16 px |
| `STRUCT_STD` | Máu công trình | ×1 | ×1.25 | ×1.5 | ×1.75 | ×2 |
| `THRONE_STD` | HP và DMG của Ngai | ×1 | ×1.25 | ×1.5 | ×1.75 | ×2 |

Máu công trình cấp 1 mặc định theo loại (`STRUCT_HP`): lính 150, tháp 220, kinh tế 120, hỗ trợ 160 (thẻ có `structureHp` riêng thì dùng bảng riêng, không nhân `STRUCT_STD`). Số lính `count` luôn là bảng riêng của từng thẻ. Mỗi công trình sinh tối đa `MAX_UNITS_PER_BUILDING = 20` lính.

### 5.3 Tính chỉ số (modifier pass)

`buildBattleSetup(run, content) → BattleSetup` (thuần, `src/game/run/battleSetup.ts`) tính chỉ số cuối cho Ngai, từng công trình và từng loại lính chúng sinh ra:

1. **Gốc:** chỉ số trong `UnitDef`/`AttackSpec` × hồ sơ cấp (§5.2) của công trình nguồn.
2. **Thu thập modifier** từ các nguồn theo thứ tự cố định: (a) hiệu ứng `stat` scope `self` của chính thẻ; (b) Bùa trên công trình (theo thứ tự gắn) × stack; (c) hiệu ứng `stat` scope `neighbours`/`board` của **công trình khác** — nguồn duyệt theo Ngai trước rồi `plot` 0→24; (d) bị động Ngai; (e) sắc lệnh theo thứ tự nhận; (f) perk; (g) `permanent` của công trình; (h) tăng trưởng theo tuổi (Vua Rừng Xanh). Với quân địch: cấp địch (§3.6) rồi cờ hiệu.
3. **Gộp:** `final = (gốc + Σflat) × (1 + Σpct / 100)`. Mọi modifier cùng loại **cộng** với nhau (không nhân chồng), nên thứ tự chỉ ảnh hưởng tới hiệu ứng `custom` và tới việc chọn mục tiêu khi hoà.
4. **Giới hạn:** `armor ≤ 0.75`; `hp ≥ 30% gốc` (Bùa Trăng Máu không giết được công trình); `attackSpeed`: khoảng đánh hiệu dụng = `interval / (1 + Σ attackSpeed% / 100)`, không dưới 50% `interval`; `unitCount = floor(...)`, kẹp 0..`MAX_UNITS_PER_BUILDING`; `speed` không dưới 30% gốc.
5. Hiệu ứng tăng theo thời gian trong trận (ramp) **không** nằm trong pass này; chúng chạy trong trận (§8.6) trên nền chỉ số đã tính.

### 5.4 Hook

Mỗi `EffectDef.type` và mỗi `CustomEffectId` có một `EffectHandler` cài các hook nó cần:

```ts
export interface EffectHandler<E> {
  onPlay?(ctx: RunCtx, src: EffectSource, e: E): void;       // vừa đặt / vừa lên cấp
  onYearStart?(ctx: RunCtx, src: EffectSource, e: E): void;  // tăng trưởng, thu nhập
  onComputeStats?(ctx: StatCtx, src: EffectSource, e: E): void;
  onBattleStart?(ctx: BattleCtx, src: EffectSource, e: E): void; // sinh lính, đặt timer
  onBattleTick?(ctx: BattleCtx, src: EffectSource, e: E): void;
  onUnitDeath?(ctx: BattleCtx, src: EffectSource, e: E, dead: UnitRef): void;
  onEnemyKilled?(ctx: BattleCtx, src: EffectSource, e: E, killer: UnitRef, victim: UnitRef): void;
  onBattleEnd?(ctx: RunCtx, src: EffectSource, e: E, result: BattleResult): void;
  onSacrifice?(ctx: RunCtx, src: EffectSource, e: E, removed: BuildingState): void;
  onMove?(ctx: RunCtx, src: EffectSource, e: E, moved: BuildingState): void;
}
```

`EffectSource` = `{ kind: 'building' | 'enchant' | 'throne' | 'decree' | 'perk' | 'banner'; building?: BuildingState; level: Level; stacks: number }`. Hook trong trận chỉ được đọc `BattleCtx` (thế giới trận) và ghi qua API của nó (`spawnUnit`, `dealDamage`, `addStatus`, `addGold`), không đụng `RunState`; vàng kiếm trong trận gom vào `BattleResult.goldDelta`.

### 5.5 Thứ tự sự kiện mỗi năm (deterministic)

Mọi bước "duyệt nguồn" dùng thứ tự: **Ngai → `plot` 0..24 (bỏ 12) → sắc lệnh theo thứ tự nhận → perk**; trong một công trình: hiệu ứng thẻ theo thứ tự khai báo, rồi Bùa theo thứ tự gắn.

1. `year += 1`; `rerollsThisYear = 0`; `freeMovesLeft` đặt lại; `army = composeArmy(...)`.
2. Phí duy trì (`neutral_mercenary_camp`).
3. Tăng trưởng: hook `onYearStart` loại tăng trưởng (Cây Mầm lên cấp, Bùa Rễ Sâu cộng %).
4. Thu nhập: `RUN.taxPerYear`, rồi hook `onYearStart` loại vàng.
5. Nhiệm vụ: nếu `year ∈ RUN.questYears` và số nhiệm vụ đang nhận < `RUN.maxActiveQuests` → `phase = 'quest'` (chấp nhận/từ chối).
6. Rút thêm cho đủ tay (§3.4) → `phase = 'planning'`.
7. (người chơi) đổi bài / mở ô / dời miễn phí / chơi thẻ (`onPlay`, `onSacrifice`, `onMove`) / bán-bỏ thẻ (`discard`). G1: sau bước này trận tự bắt đầu (§3.2).
8. `startBattle` → `buildBattleSetup` → `phase = 'battle'`.
9. `battleResult`: cộng `goldDelta` → thắng: vàng trận / thua: −1 mạng → `enemies[K].attacks += 1` → chinh phục/rút lui → hook `onBattleEnd` → kiểm tra nhiệm vụ (theo thứ tự nhận) → Ngai +1 cấp nếu thắng boss 1/boss 2.
10. Thưởng → Chinh phục → Hội đồng (bước nào không áp dụng thì bỏ qua).
11. Cuối năm: kiểm tra kết thúc ván; lưu.

### 5.6 Mô tả thẻ

`describeCard(def, level, stacks?) → TooltipContent` (`src/game/cards/describe.ts`) thay placeholder `{count}`, `{gold}`, `{pct}`… trong `textVi` bằng giá trị của cấp đang xem; tooltip cũng hiện dòng "Cấp sau: …" khi chưa tối đa. Test: mọi placeholder của mọi thẻ được giải (§13.1).

## 6. Nội dung: thẻ, đơn vị, vua

Mọi con số ở mục này là **giá trị tinh chỉnh ban đầu**; G5 chỉnh bằng công cụ cân bằng (§14). Dữ liệu: `src/data/neutral.ts`, `src/data/raiders.ts`, `src/data/bosses.ts`, `src/data/kings/<king>.ts`.

### 6.0 Quy ước đọc bảng

- `a/b/c/d/e` = giá trị ở cấp 1/2/3/4/5 (`PerLevel`).
- **Lính:** chỉ số cấp 1 ở bảng đơn vị của mỗi vua, HP/DMG theo `TROOP_STD`; số lính là bảng riêng của thẻ.
- **Tháp:** DMG theo `TOWER_STD`, tầm theo `TOWER_RANGE`, máu `STRUCT_STD × STRUCT_HP.tower` trừ khi ghi khác. Mục tiêu mặc định `closestToThrone`.
- **Bùa:** giá trị ghi là **mỗi stack**.
- Bảng đơn vị: **Tầm** = px mép–mép (2 = cận chiến); **Nhịp** = tick giữa hai đòn (10 tick = 1 s); **Tốc** = px/tick; **R** = bán kính va chạm; **EP** = `enemyCost`.
- Độ hiếm: **T** = thường (`common`), **V** = vừa (`uncommon`), **H** = hiếm (`rare`). Mỗi vua: 4 T, 3 V, 2 H.
- Cột "G" = dự án con đưa thẻ vào game (§14).
- Ô `(c,r)` = `(col,row)`; "(2,1)" là ô ngay phía Bắc Ngai.

### 6.1 Thẻ trung lập (`neutral`)

Bể trung lập vào thưởng của mọi vua (§3.8). Hai thẻ cuối cần mở khoá meta (§9.2).

| id | Tên | Loại | Hiếm | Hiệu ứng (cấp 1 → theo cấp) | G |
|---|---|---|---|---|---|
| `neutral_barracks` | Trại Lính | lính | T | Sinh `footman` 3/4/5/6/7. | G1 |
| `neutral_archer_tower` | Tháp Cung | tháp | T | Bắn 7 vật lý, tầm 88, nhịp 12, đạn 8 px/tick. | G1 |
| `neutral_well` | Giếng Làng | kinh tế | T | Đầu năm +1/2/3/4/5 vàng. | G2 |
| `neutral_mercenary_camp` | Trại Đánh Thuê | lính | V | Sinh `mercenary` 2/3/3/4/5. Đầu năm trả 1 vàng phí; không đủ vàng thì năm đó trại không sinh lính. | G2 |
| `neutral_sharpen` | Bùa Sắc Bén | bùa (lính, tháp, Ngai) | T | +15% DMG. | G2 |
| `neutral_fortify` | Bùa Vững Chãi | bùa (lính, tháp, hỗ trợ, Ngai) | T | +20% HP lính và máu công trình. | G2 |
| `neutral_promote` | Thăng Cấp | sách (`building`) | T | +1 cấp cho một công trình (không phải Ngai). | G2 |
| `neutral_clear_land` | Khai Hoang | sách (`lockedPlot`) | T | Mở một ô khoá bất kỳ (mở bằng vàng, §3.11, vẫn phải kề ô đã mở). | G1 |
| `neutral_move` | Dời Nhà | sách (`buildingThenPlot`) | T | Dời một công trình sang ô đã mở khác (đổi chỗ nếu có). | G1 |
| `neutral_demolish` | Dỡ Bỏ | sách (`building`), tag `sacrifice` | T | Hiến tế một công trình, nhận 2 vàng × cấp. | G2 |
| `neutral_duplicate` | Nhân Bản | sách (`buildingThenPlot`) | H | Đặt bản sao một công trình (cùng cấp, không Bùa) lên ô trống đã mở. Meta. | G4 |
| `neutral_royal_seal` | Ấn Triện | sách (`none`) | H | Ngai +1 cấp. Meta. | G4 |

Đơn vị trung lập:

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP |
|---|---|---|---|---|---|---|---|---|---|---|
| `footman` | Lính Bộ | 45 | 7 vật lý | 2 | 10 | 0.9 | 4 | 0.1 | melee, human | 1.5 |
| `mercenary` | Lính Đánh Thuê | 60 | 10 vật lý | 2 | 10 | 1.0 | 5 | 0.1 | melee, human | 2.0 |

### 6.2 Thổ Phỉ (quân trung lập, chỉ làm địch)

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Trọng số |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `bandit` | Thổ Phỉ | 30 | 5 vật lý | 2 | 10 | 0.9 | 4 | 0 | melee, human | 1.0 | 50 |
| `bandit_archer` | Cung Thủ Phỉ | 22 | 5 vật lý, đạn 7 | 56 | 14 | 0.8 | 4 | 0 | ranged, human | 1.2 | 25 |
| `boar_rider` | Kỵ Lợn Rừng | 50 | 8 vật lý | 2 | 12 | 1.5 | 5 | 0.1 | melee, cavalry | 2.0 | 15 |
| `ogre` | Gã Hộ Pháp | 180 | 16 vật lý | 4 | 18 | 0.6 | 9 | 0.2 | melee, siege | 5.0 | 10 |

Đơn vị triệu hồi của boss (`enemyCost = 0`): `frog` Ếch Đầm (HP 20, 4 vật lý, tầm 2, nhịp 10, tốc 1.2, R 3, melee, summon); `hornet` Ong Bắp Cày (HP 25, 6 vật lý, tầm 2, nhịp 8, tốc 1.6, R 3, melee, flying, summon).

### 6.3 Vua Lúa Mì (`wheat`) — kinh tế, ruộng buff lân cận, dân quân đông

Màu chủ `wheat`. Mở sẵn. Chơi trong G1 (§14).

**Ngai Bó Lúa** (`wheat_throne`): HP 300, giáp 0, bắn 8 vật lý, tầm 72, nhịp 10, đạn 8. Bị động **Mùa Gặt**: đầu năm +1 vàng cho mỗi 2 công trình tag `farm` (làm tròn xuống); từ Ngai cấp 3: +1 vàng cho mỗi công trình `farm`.

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `militia` | Dân Quân | 32 | 5 vật lý | 2 | 10 | 1.0 | 4 | 0 | melee, human | 0.8 | — |
| `reaper` | Thợ Gặt | 45 | 9 vật lý, `cleave 2` | 2 | 12 | 0.9 | 4 | 0.05 | melee, human | 1.6 | — |
| `peasant` | Nông Binh | 28 | 6 vật lý | 2 | 10 | 1.1 | 4 | 0 | melee, human | 0.8 | — |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `wheat_militia` | Dân Quân | lính | T | Sinh `militia` 4/6/8/10/12. | G1 |
| `wheat_field` | Ruộng Lúa | kinh tế, `farm` | T | Đầu năm +1/1/2/2/3 vàng. Lân cận: công trình lính +1/1/2/2/3 lính. | G2 |
| `wheat_scarecrow` | Bù Nhìn Gác | tháp | T | Bắn 6 vật lý, tầm 72, nhịp 12, đạn 6; trúng: chậm 20% trong 20 tick. | G1 |
| `wheat_fertilizer` | Bùa Phân Bón | bùa (lính, kinh tế) | T | Lính: +1 lính. Kinh tế: +1 vàng đầu năm. | G2 |
| `wheat_reapers` | Đội Thợ Gặt | lính | V | Sinh `reaper` 3/4/5/6/7. | G1 |
| `wheat_windmill` | Cối Xay Gió | kinh tế | V | Đầu năm +2/3/4/5/6 vàng, thêm +1 vàng cho mỗi Ruộng Lúa lân cận. | G2 |
| `wheat_harvest_festival` | Lễ Hội Mùa Màng | sách (`none`) | V | Nhận vàng = tổng cấp mọi công trình `farm` (tối thiểu 2). | G2 |
| `wheat_granary` | Kho Thóc | hỗ trợ | H | Lân cận: lính +15/20/25/30/35% HP. Đầu năm +1 vàng cho mỗi Ruộng Lúa lân cận. | G2 |
| `wheat_peasant_horde` | Khởi Nghĩa Nông Dân | lính | H | Sinh `peasant` = 4 + k × (số công trình `farm`), k = 2/2/3/3/4 (vẫn kẹp `MAX_UNITS_PER_BUILDING`). | G2 |

**Perk:** (1) **Hạt Giống Tốt** — bắt đầu có Ruộng Lúa cấp 1 ở (2,1). (2) **Thuế Nhẹ** — lần đổi bài đầu tiên mỗi năm miễn phí (lần sau tính tiếp từ `rerollCost(1)`). (3) **Toàn Dân Cầm Giáo** — `militia` và `peasant` +10 HP, +1 DMG (flat, cộng trước %).

**Cờ hiệu khi làm địch — Đông Như Kiến:** `enemyCost` của mọi đơn vị × 0.8. **Roster địch:** `militia` 50, `reaper` 25, `peasant` 25.

### 6.4 Vua Đá Núi (`stone`) — tháp, người đá trâu bò

Màu chủ `stone`. Mở sẵn.

**Ngai Đá Tảng** (`stone_throne`): HP 450, giáp 0.2, ném 12 vật lý, tầm 56, nhịp 14, đạn 6. Bị động **Núi Che Chở**: mọi tháp +10/12/15/18/20% DMG (theo cấp Ngai).

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `golem` | Người Đá | 220 | 14 vật lý | 3 | 15 | 0.6 | 7 | 0.3 | melee, golem | 6.0 | — |
| `miner` | Thợ Mỏ | 70 | 8 vật lý | 2 | 12 | 0.8 | 5 | 0.2 | melee, human | 2.2 | `deathSpawn rubble ×1` |
| `rubble` | Đá Vụn | 40 | 4 vật lý | 2 | 12 | 0.7 | 4 | 0.2 | melee, golem, summon | 0 | — |
| `slinger` | Lính Ném Đá | 30 | 7 vật lý, đạn 6 | 64 | 16 | 0.8 | 4 | 0.05 | ranged, human | 1.5 | chỉ làm địch |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `stone_catapult` | Tháp Ném Đá | tháp | T | Ném 14 vật lý, `splash 16`, tầm 96, tầm tối thiểu 24, nhịp 25, đạn 5. | G2 |
| `stone_golem_forge` | Xưởng Người Đá | lính, `golem` | T | Sinh `golem` 1/1/2/2/3. | G2 |
| `stone_quarry` | Mỏ Đá | kinh tế | T | Đầu năm +1/2/2/3/3 vàng. Lân cận: tháp +10/15/20/25/30% DMG. | G2 |
| `stone_stoneskin` | Bùa Da Đá | bùa (lính, tháp, hỗ trợ, Ngai) | T | +20% HP và máu công trình, +0.05 giáp. | G2 |
| `stone_wall` | Tường Thành | hỗ trợ | V | Máu 400/550/700/850/1000, giáp 0.3. Khiêu khích: địch trong `BATTLE.tauntRadiusDefault` phải đánh tường trước. Lân cận: công trình +20% máu. | G2 |
| `stone_crystal` | Tháp Pha Lê | tháp | V | Tia 4 phép, tầm 64, nhịp 3, tức thời; mỗi đòn liên tiếp vào cùng mục tiêu +20% (tối đa +200%). | G2 |
| `stone_miners` | Đội Thợ Mỏ | lính | V | Sinh `miner` 3/4/5/6/7. | G2 |
| `stone_rune_carving` | Khắc Ấn Núi | sách (`none`) | H | Mọi tháp đang có trên bàn cờ nhận vĩnh viễn +8% DMG (`permanent.dmg`). | G2 |
| `stone_mountain_heart` | Tim Núi | tháp | H | Máu 600/750/900/1050/1200. Mỗi 40 tick (`pulse`, bán kính 48): 30 vật lý + choáng 10 tick mọi địch trong vòng. Lân cận: `golem` +30% HP. | G2 |

**Perk:** (1) **Nền Móng Vững** — Ngai +200 HP (flat). (2) **Đá Gọi Đá** — bắt đầu có Tháp Ném Đá cấp 1 ở (2,1). (3) **Tường Không Đổ** — mọi công trình +30% máu.

**Cờ hiệu — Da Đá:** địch +20% HP, −10% tốc. **Roster:** `miner` 50, `slinger` 35, `golem` 15.

### 6.5 Vua Phép Thuật (`arcane`) — bùa, pháp sư

Màu chủ `purple`. Mở sẵn.

**Ngai Tinh Tú** (`arcane_throne`): HP 280, giáp 0, bắn 10 phép, tầm 80, nhịp 12, đạn 8. Bị động **Hoà Âm**: công trình có tổng ≥ 2 stack Bùa được +10/12/15/18/20% HP và DMG.

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `apprentice` | Học Đồ | 24 | 7 phép, đạn 7 | 56 | 14 | 0.9 | 4 | 0 | ranged, mage | 1.4 | — |
| `frost_mage` | Pháp Sư Băng | 30 | 6 phép, đạn 7; chậm 30%/20 tick | 64 | 14 | 0.8 | 4 | 0 | ranged, mage | 2.0 | — |
| `archmage` | Đại Pháp Sư | 90 | 22 phép, `splash 20`, đạn 6 | 88 | 20 | 0.7 | 5 | 0 | ranged, mage | 8.0 | xem thẻ |
| `construct` | Hộ Vệ Phù Chú | 90 | 8 phép | 2 | 12 | 0.8 | 6 | 0.1 | melee, construct | 2.5 | chỉ làm địch |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `arcane_mage_tower` | Tháp Pháp Sư | tháp, `mage` | T | Bắn 9 phép, tầm 80, nhịp 14, đạn 8; nảy sang 1 địch khác trong 32 px với 60% sát thương. | G2 |
| `arcane_apprentices` | Học Viện | lính, `mage` | T | Sinh `apprentice` 3/4/5/6/7. | G2 |
| `arcane_spark_rune` | Bùa Tia Lửa | bùa (lính, tháp, Ngai) | T | Mỗi đòn +2 sát thương phép (flat, cộng sau mọi %). | G2 |
| `arcane_haste_rune` | Bùa Tốc Biến | bùa (lính, tháp, Ngai) | T | +12% tốc đánh. | G2 |
| `arcane_library` | Thư Viện | hỗ trợ | V | Đầu năm +1 vàng. Lân cận: công trình có ≥ 1 Bùa được +1/1/1/2/2 stack ảo của Bùa gắn đầu tiên. | G2 |
| `arcane_frost_mages` | Tháp Băng Sư | lính, `mage` | V | Sinh `frost_mage` 2/3/3/4/5. | G2 |
| `arcane_mirror` | Gương Chép Bùa | sách (`buildingThenBuilding`) | V | Công trình thứ hai nhận bản sao mọi stack Bùa của công trình thứ nhất (tới giới hạn stack, theo thứ tự gắn). | G2 |
| `arcane_ward` | Vòng Kết Giới | hỗ trợ | H | Mỗi 50 tick: lính mình trong 64 px nhận khiên 20/25/30/35/40 (khiên tối đa = 2 × giá trị). | G2 |
| `arcane_archmage` | Tháp Đại Pháp Sư | lính, `mage` | H | Sinh `archmage` 1/1/1/2/2. `archmage` +4% DMG cho mỗi stack Bùa trên toàn bàn cờ (tối đa +100%). | G2 |

**Perk:** (1) **Sách Phép Dày** — giới hạn stack Bùa mỗi công trình = 6. (2) **Bùa Đầu Mùa** — Ngai bắt đầu với 1 stack Bùa Tia Lửa. (3) **Ma Lực Dồi Dào** — hồi chiêu Can Thiệp −30%.

**Cờ hiệu — Kết Giới:** mỗi địch xuất hiện với khiên = 15% HP tối đa. **Roster:** `apprentice` 50, `frost_mage` 25, `construct` 25.

### 6.6 Vua Rừng Xanh (`grove`) — mạnh dần theo năm, thú rừng, hồi máu

Màu chủ `leaf`. Mở bằng 25 Điểm Vương Miện.

**Tuổi:** công trình có tuổi = `year − placedYear + ageBonus` (năm). **Ngai Cổ Thụ** (`grove_throne`): HP 320, giáp 0, bắn gai 8 vật lý, tầm 64, nhịp 10, đạn 7; trúng: độc 1/s trong 30 tick (tối đa 1 lớp). Bị động **Sinh Trưởng**: công trình tag `grove` +2/2/3/3/4% HP và DMG mỗi năm tuổi (tối đa +60%).

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `wolf` | Sói | 36 | 7 vật lý | 2 | 9 | 1.6 | 4 | 0 | melee, beast | 1.3 | — |
| `bear` | Gấu Rừng | 160 | 16 vật lý | 3 | 14 | 1.0 | 7 | 0.1 | melee, beast | 5.0 | `enrage` dưới 50% HP: +50% DMG |
| `stag` | Hươu Thần | 60 | 9 vật lý; trúng: hồi 4 HP cho đồng minh máu thấp nhất trong 40 px | 2 | 11 | 1.4 | 5 | 0 | melee, beast | 2.2 | — |
| `treant` | Cổ Thụ | 400 | 20 vật lý | 4 | 16 | 0.5 | 9 | 0.2 | melee | 12.0 | `healAura` 48 px, 3 HP/s |
| `dryad` | Tiên Rừng | 26 | 6 phép, đạn 7; trúng: hồi 3 HP cho đồng minh máu thấp nhất trong 56 px | 56 | 14 | 0.9 | 4 | 0 | ranged | 1.6 | chỉ làm địch |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `grove_wolf_den` | Hang Sói | lính, `grove` | T | Sinh `wolf` 3/4/5/6/7. | G4 |
| `grove_sapling` | Cây Mầm | hỗ trợ, `grove` | T | Đầu năm, cứ đủ mỗi 3 năm tuổi thì +1 cấp (tối đa 5). Lân cận: lính +8/16/24/32/40% HP. | G4 |
| `grove_spring` | Suối Hồi Sinh | hỗ trợ, `grove` | T | Lính mình trong 64 px hồi 2/3/4/5/6 HP/s. | G4 |
| `grove_deep_roots` | Bùa Rễ Sâu | bùa (lính, tháp, hỗ trợ, Ngai) | T | Mỗi đầu năm công trình nhận vĩnh viễn +3% HP và DMG (từ bùa này tối đa +90% mỗi công trình). | G4 |
| `grove_thorn_tower` | Tháp Gai | tháp, `grove` | V | Bắn 5 vật lý, tầm 64, nhịp 8, đạn 8; trúng: độc 2/s trong 30 tick, cộng tối đa 3 lớp. | G4 |
| `grove_bear_cave` | Hang Gấu | lính, `grove` | V | Sinh `bear` 1/1/2/2/3. | G4 |
| `grove_spring_rain` | Mưa Xuân | sách (`none`) | V | Mọi công trình `grove` +2 năm tuổi (`ageBonus`); mọi Cây Mầm +1 cấp. | G4 |
| `grove_spirit_stags` | Đàn Hươu Thần | lính, `grove` | H | Sinh `stag` 2/3/3/4/5. | G4 |
| `grove_treant` | Cổ Thụ Thức Tỉnh | lính, `grove` | H | Sinh `treant` 1/1/1/2/2. | G4 |

**Perk:** (1) **Rễ Từ Trước** — công trình `grove` đặt mới có `ageBonus = 2`. (2) **Sói Đầu Đàn** — Hang Sói +1 sói mỗi cấp. (3) **Đất Lành** — Ngai hồi 1% HP tối đa mỗi giây trong trận.

**Cờ hiệu — Tái Sinh:** địch hồi 1% HP tối đa mỗi giây. **Roster:** `wolf` 50, `stag` 25, `bear` 15, `dryad` 10.

### 6.7 Vua Thuỷ Triều (`tide`) — cướp biển, cướp vàng, đẩy lùi

Màu chủ `water`. Mở bằng 25 điểm.

**Ngai San Hô** (`tide_throne`): HP 300, giáp 0, pháo 12 vật lý, `splash 10`, tầm 72, nhịp 16, đạn 6; trúng: đẩy lùi 8. Bị động **Chiến Lợi Phẩm**: mỗi 10 địch bị hạ trong trận +1 vàng, tối đa 3/3/4/4/5 vàng mỗi trận.

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `pirate` | Cướp Biển | 30 | 6 vật lý | 2 | 10 | 1.1 | 4 | 0 | melee, pirate | 1.0 | — |
| `hookman` | Lính Móc Câu | 45 | 8 vật lý, đạn 6; mỗi đòn thứ 4 kéo mục tiêu 16 px về phía mình | 40 | 14 | 0.9 | 4 | 0.05 | ranged, pirate | 1.8 | — |
| `musketeer` | Lính Hoả Mai | 28 | 12 vật lý, đạn 10 | 72 | 24 | 0.8 | 4 | 0 | ranged, pirate | 2.0 | chỉ làm địch |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `tide_pirates` | Thuyền Cướp Biển | lính, `pirate` | T | Sinh `pirate` 4/5/6/7/8. Mỗi 8 địch do `pirate` của trại này hạ: +1 vàng (tối đa 3 mỗi trận). | G4 |
| `tide_cannon` | Pháo Đài Biển | tháp | T | Pháo 16 vật lý, `splash 12`, tầm 88, nhịp 22, đạn 6; trúng: đẩy lùi 16. | G4 |
| `tide_harbor` | Bến Cảng | kinh tế | T | Đầu năm +2/3/4/5/6 vàng. | G4 |
| `tide_undertow_rune` | Bùa Sóng Ngầm | bùa (lính, tháp, Ngai) | T | Mỗi đòn đẩy lùi thêm 6 px; lính +8% tốc. | G4 |
| `tide_wave_tower` | Tháp Sóng | tháp | V | `pulse` mỗi 50 tick, bán kính 72: 10 phép + đẩy lùi 24 ra xa tháp. | G4 |
| `tide_treasure` | Rương Châu Báu | kinh tế | V | Đầu năm +1 vàng cho mỗi 5 vàng đang có, tối đa 3/4/5/6/7. | G4 |
| `tide_hookmen` | Đội Móc Câu | lính, `pirate` | V | Sinh `hookman` 2/3/4/5/6. | G4 |
| `tide_privateers` | Hợp Đồng Lính Đánh Thuê | sách (`none`) | H | Trả toàn bộ vàng (tối đa 16); trận năm nay sinh thêm 1 `mercenary` tại Ngai cho mỗi 2 vàng đã trả (làm tròn xuống). | G4 |
| `tide_kraken` | Vực Kraken | tháp | H | Máu 500/625/750/875/1000. 4 xúc tu, mỗi xúc tu: 14 vật lý, tầm 56, nhịp 12, tức thời, đẩy lùi 8; các xúc tu chọn 4 mục tiêu khác nhau (`nearest`). | G4 |

**Perk:** (1) **Túi Đầy** — +5 vàng khởi đầu. (2) **Gió Thuận** — mọi đẩy lùi +50%. (3) **Chuộc Tù** — thua trận vẫn nhận `floor(battleGold(year) / 2)`.

**Cờ hiệu — Cướp Bóc:** mỗi lần Ngai mất thêm 10% HP tối đa trong trận, người chơi mất 1 vàng (tối đa 3 mỗi trận, không xuống dưới 0). **Roster:** `pirate` 55, `hookman` 25, `musketeer` 20.

### 6.8 Vua Lò Rèn (`forge`) — rèn đúc, sát thương lửa

Màu chủ `orange`. Mở bằng 40 điểm.

**Bỏng (`burn`)** là sát thương lửa mỗi giây; xem luật cộng dồn ở §8.6. **Ngai Đe Sắt** (`forge_throne`): HP 340, giáp 0.1, bắn 9 lửa, tầm 64, nhịp 12, đạn 7; trúng: bỏng 2/s trong 30 tick. Bị động **Lửa Tôi**: công trình cấp ≥ 3 được +10/10/15/15/20% DMG.

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `swordsman` | Kiếm Sĩ Thép | 55 | 9 vật lý | 2 | 10 | 0.9 | 4 | 0.15 | melee, human | 2.0 | — |
| `bombardier` | Lính Ném Lửa | 32 | 10 lửa, `splash 14`, đạn 5; bỏng 2/s, 30 tick | 64 | 18 | 0.8 | 4 | 0 | ranged, human | 2.2 | — |
| `iron_drake` | Rồng Sắt | 180 | 12 lửa, `cone` 32 px nửa góc 45°; bỏng 4/s, 30 tick | 32 | 10 | 1.2 | 7 | 0.2 | ranged, flying | 9.0 | — |
| `shieldbearer` | Lính Khiên | 90 | 5 vật lý | 2 | 12 | 0.7 | 5 | 0.35 | melee, human | 2.5 | chỉ làm địch |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `forge_swordsmen` | Doanh Trại Kiếm Sĩ | lính | T | Sinh `swordsman` 3/4/5/6/7. | G4 |
| `forge_flame_tower` | Tháp Phun Lửa | tháp, `fire` | T | Phun 4 lửa, `cone` 40 px nửa góc 45°, nhịp 4, tức thời; bỏng 1/s trong 20 tick. | G4 |
| `forge_smithy` | Lò Rèn | hỗ trợ | T | Lân cận: lính +12/16/20/24/28% DMG và +0.05 giáp. | G4 |
| `forge_ember_rune` | Bùa Than Hồng | bùa (lính, tháp, Ngai), `fire` | T | Mỗi đòn gây thêm bỏng 2/s trong 30 tick (cộng vào bỏng cùng nguồn). | G4 |
| `forge_master_hammer` | Búa Thợ Cả | sách (`building`) | V | +1 cấp cho công trình được chọn (không phải Ngai) và +1 cấp cho công trình lân cận có cấp thấp nhất chưa tối đa (hoà: Bắc, Đông, Nam, Tây; Ngai bị bỏ qua). | G4 |
| `forge_bombardiers` | Đội Ném Lửa | lính, `fire` | V | Sinh `bombardier` 2/3/3/4/5. | G4 |
| `forge_blast_furnace` | Lò Cao | kinh tế | V | Đầu năm +1/2/2/3/3 vàng. Lân cận: công trình `fire` +25/30/35/40/50% sát thương bỏng. | G4 |
| `forge_armory` | Kho Giáp | hỗ trợ | H | Mọi lính trên bàn cờ +0.04/0.05/0.06/0.07/0.08 giáp (nhiều Kho Giáp: chỉ lấy cái cao nhất). Lân cận: +10% HP. | G4 |
| `forge_iron_drake` | Tổ Rồng Sắt | lính, `fire` | H | Sinh `iron_drake` 1/1/1/2/2. | G4 |

**Perk:** (1) **Than Hồng** — mọi sát thương bỏng +30%. (2) **Học Việc** — bắt đầu có Lò Rèn cấp 1 ở (2,1). (3) **Thép Tốt** — mọi lính +0.1 giáp.

**Cờ hiệu — Giáp Sắt:** địch +0.15 giáp. **Roster:** `swordsman` 55, `bombardier` 30, `shieldbearer` 15.

### 6.9 Vua Đồng Hồ (`clock`) — máy móc, mạnh dần trong trận

Màu chủ `gold`. Mở bằng 40 điểm.

**Tăng tiến (ramp)** tính theo `t` = giây trận đã qua (§8.6); "lên dây trước X s" nghĩa là tính như `t + X`. **Ngai Bánh Răng** (`clock_throne`): HP 300, giáp 0.1, bắn 8 vật lý, tầm 72, nhịp 12, đạn 8. Bị động **Lên Dây**: mọi lính và tháp của mình +0.5/0.6/0.7/0.8/1.0% tốc đánh mỗi giây (tối đa +40%).

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `tin_soldier` | Lính Thiếc | 34 | 5 vật lý | 2 | 10 | 0.9 | 4 | 0.1 | melee, clockwork | 1.2 | `rampDmg` +2%/s, tối đa +80% |
| `spider` | Nhện Cơ Khí | 28 | 6 vật lý | 2 | 8 | 1.5 | 4 | 0.1 | melee, clockwork | 1.1 | — |
| `colossus` | Khổng Lồ Đồng | 300 | 10 vật lý | 4 | 14 | 0.5 | 9 | 0.3 | melee, clockwork | 10.0 | `stepBuff` mỗi 100 tick +20% DMG, +10% tốc, tối đa 6 lần |
| `gear_gunner` | Xạ Thủ Bánh Răng | 30 | 6 vật lý, đạn 8 | 64 | 12 | 0.8 | 4 | 0.1 | ranged, clockwork | 1.6 | `rampAttackSpeed` +1%/s, tối đa +60%; chỉ làm địch |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `clock_windup_soldiers` | Xưởng Lính Thiếc | lính, `clockwork` | T | Sinh `tin_soldier` 4/5/6/7/8. | G4 |
| `clock_gear_tower` | Tháp Bánh Răng | tháp, `clockwork` | T | Bắn 5 vật lý, tầm 72, nhịp 10, đạn 8; +2% tốc đánh mỗi giây (tối đa +100%). | G4 |
| `clock_spring_workshop` | Xưởng Lò Xo | kinh tế | T | Đầu năm +1/1/2/2/3 vàng. Lân cận: mọi tăng tiến lên dây trước 10/12/14/16/20 s. | G4 |
| `clock_tick_rune` | Bùa Tích Tắc | bùa (lính, tháp, Ngai) | T | +1% tốc đánh mỗi giây (tối đa +30% mỗi stack). | G4 |
| `clock_bell_tower` | Tháp Chuông | hỗ trợ, `clockwork` | V | Mỗi 100 tick: lính mình trong 80 px +25/30/35/40/45% tốc đánh trong 30 tick; từ cấp 3 địch trong 80 px bị choáng 5 tick. | G4 |
| `clock_spiders` | Ổ Nhện Cơ Khí | lính, `clockwork` | V | Sinh `spider` 3/4/5/6/7. Mỗi 150 tick, nếu số nhện còn sống của ổ < số ban đầu: sinh lại 1 nhện tại ô. | G4 |
| `clock_rewind` | Tua Ngược | sách (`building`) | V | Công trình được chọn vĩnh viễn lên dây trước thêm 5 s (`counters.prewind`, tối đa 30 s). | G4 |
| `clock_steam_cannon` | Pháo Hơi Nước | tháp, `clockwork` | H | Pháo 30 vật lý, `splash 18`, tầm 104, nhịp 40, đạn 5; +1.5% tốc đánh mỗi giây (tối đa +90%). | G4 |
| `clock_colossus` | Lò Khổng Lồ Đồng | lính, `clockwork` | H | Sinh `colossus` 1/1/1/2/2. | G4 |

**Perk:** (1) **Dây Cót Căng** — mọi tăng tiến lên dây trước 5 s. (2) **Bánh Răng Dự Phòng** — bắt đầu có Tháp Bánh Răng cấp 1 ở (2,1). (3) **Giờ Vàng** — `RAGE_TICK` và `HARD_LIMIT_TICK` (§8.8) +150 tick.

**Cờ hiệu — Đếm Ngược:** địch +1% DMG mỗi giây (tối đa +50%). **Roster:** `tin_soldier` 55, `spider` 30, `gear_gunner` 15.

### 6.10 Vua Ánh Trăng (`moon`) — hiến tế, triệu hồi, rủi ro cao

Màu chủ `plum`. Mở bằng 60 điểm.

**Hồn:** mỗi lính của mình chết (kể cả triệu hồi) = 1 Hồn trong trận đó. **Ngai Nguyệt Thực** (`moon_throne`): HP 240, giáp 0, bắn 10 phép, tầm 72, nhịp 12, đạn 8. Bị động **Thu Hồn**: cứ mỗi 6/6/5/5/4 Hồn triệu hồi 1 `wraith` tại Ngai (tối đa 20 mỗi trận).

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `skeleton` | Bộ Xương | 26 | 6 vật lý | 2 | 10 | 0.9 | 4 | 0 | melee, undead | 1.1 | `reviveOnce` 50% HP |
| `wraith` | Bóng Ma | 30 | 8 phép | 2 | 10 | 1.3 | 4 | 0 | melee, undead | 1.0 | — (là `summon` khi do hiệu ứng tạo) |
| `vampire` | Ma Cà Rồng | 60 | 10 vật lý; hút máu 40% | 2 | 10 | 1.2 | 4 | 0 | melee, undead | 2.4 | — |
| `moon_reaper` | Thần Chết Trăng | 150 | 25 vật lý, `cleave 3` | 3 | 14 | 1.0 | 6 | 0.1 | melee, undead | 9.0 | `killHeal` 10; `soulScaling` +2% HP và DMG mỗi Hồn |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `moon_crypt` | Hầm Mộ | lính, `undead` | T | Sinh `skeleton` 3/4/5/6/7. | G4 |
| `moon_shadow_spire` | Tháp Bóng Đêm | tháp, `undead` | T | Bắn 7 phép, tầm 72, nhịp 10, đạn 8; mỗi lần hạ địch triệu hồi 1 `wraith` tại tháp (tối đa 3/4/5/6/8 mỗi trận). | G4 |
| `moon_blood_pact` | Khế Ước Máu | sách (`building`), `sacrifice` | T | Hiến tế một công trình (không phải Ngai): nhận 3 vàng × cấp; mọi stack Bùa của nó chuyển sang Ngai (tới giới hạn). | G4 |
| `moon_blood_moon_rune` | Bùa Trăng Máu | bùa (lính, tháp, Ngai) | T | +30% DMG, −10% HP (§5.3 kẹp HP ≥ 30%). | G4 |
| `moon_altar` | Đàn Tế | hỗ trợ, `undead` | V | Mỗi khi một thẻ `sacrifice` được chơi: `counters.offerings += 1` (vĩnh viễn). Đầu trận triệu hồi `wraith` = offerings × 1/1/2/2/3, tối đa 12/14/16/18/20. | G4 |
| `moon_vampires` | Lâu Đài Ma Cà Rồng | lính, `undead` | V | Sinh `vampire` 2/3/3/4/5. | G4 |
| `moon_summoning_circle` | Vòng Triệu Hồi | hỗ trợ, `undead` | V | Mỗi 80/70/60/50/40 tick triệu hồi 1 `wraith` tại ô (tối đa 8 mỗi trận). | G4 |
| `moon_eclipse_pact` | Giao Ước Nguyệt Thực | sách (`building`) | H | Mất 1 mạng (không hợp lệ khi còn 1 mạng — `lastLife`): công trình được chọn +2 cấp (không vượt 5), nhận 5 vàng. | G4 |
| `moon_reaper_shrine` | Điện Thần Chết | lính, `undead` | H | Sinh `moon_reaper` 1/1/1/2/2. | G4 |

**Perk:** (1) **Hồn Đói** — số Hồn cần cho Thu Hồn −2. (2) **Trăng Non** — bộ bài khởi đầu thêm 1 bản Khế Ước Máu. (3) **Mạng Thứ Tư** — bắt đầu với `RUN.maxLives` mạng, Ngai −20% HP.

**Cờ hiệu — Bất Tử:** `floor(20% × tổng số địch của trận)` địch đầu tiên bị hạ sẽ sống lại một lần với 30% HP. **Roster:** `skeleton` 55, `wraith` 25, `vampire` 20.

### 6.11 Vua Du Mục (`nomad`) — dời công trình, kỵ binh

Màu chủ `sand`. Mở bằng 80 điểm **và** đã thắng ít nhất một ván (§9.2).

**Ngai Lều Vàng** (`nomad_throne`): HP 300, giáp 0, bắn 9 vật lý, tầm 72, nhịp 10, đạn 8. Bị động **Lều Di Động**: mỗi năm ở pha Lập kế hoạch được dời miễn phí 1 công trình (không phải Ngai) sang ô đã mở kề cạnh (đổi chỗ nếu có); từ Ngai cấp 3: 2 lần mỗi năm. Dời miễn phí không phải chơi thẻ.

| id | Tên | HP | DMG | Tầm | Nhịp | Tốc | R | Giáp | Tag | EP | Hành vi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `rider` | Kỵ Binh | 50 | 9 vật lý | 2 | 10 | 2.0 | 5 | 0.05 | melee, cavalry | 2.0 | `charge` ×2 DMG, đẩy lùi 8 |
| `horse_archer` | Cung Kỵ | 34 | 6 vật lý, đạn 8 | 56 | 12 | 1.8 | 5 | 0 | ranged, cavalry | 1.8 | `kite` 24 px |
| `khan_guard` | Thiết Kỵ | 110 | 14 vật lý | 2 | 12 | 1.6 | 6 | 0.2 | melee, cavalry | 4.5 | `charge` ×2 DMG, choáng 10 tick |

| id | Tên | Loại | Hiếm | Hiệu ứng | G |
|---|---|---|---|---|---|
| `nomad_riders` | Trại Kỵ Binh | lính, `cavalry` | T | Sinh `rider` 2/3/4/5/6. | G4 |
| `nomad_horse_archers` | Trại Cung Kỵ | lính, `cavalry` | T | Sinh `horse_archer` 2/3/4/5/6. | G4 |
| `nomad_stables` | Chuồng Ngựa | hỗ trợ | T | Lân cận: lính `cavalry` +15/20/25/30/35% tốc và DMG. | G4 |
| `nomad_relocate` | Nhổ Trại | sách (`buildingThenPlot`) | T | Dời công trình tới bất kỳ ô đã mở nào (đổi chỗ nếu có); nếu khoảng cách Manhattan ≥ 2: +1 cấp. | G4 |
| `nomad_bazaar` | Chợ Phiên | kinh tế | V | Đầu năm +1/1/2/2/3 vàng, thêm +1 vàng cho mỗi loại công trình khác nhau (lính/tháp/kinh tế/hỗ trợ) trong lân cận. | G4 |
| `nomad_wind_rune` | Bùa Gió Thảo Nguyên | bùa (lính, tháp) | V | +10% tốc và +10% DMG; nhân đôi trong trận nếu `movedYear = year`. | G4 |
| `nomad_watchtower` | Chòi Canh Thảo Nguyên | tháp | V | Bắn 7 vật lý, tầm 96, nhịp 12, đạn 9; +20% DMG cho mỗi ô lân cận đã mở mà trống. | G4 |
| `nomad_caravan` | Đoàn Lữ Hành | kinh tế | H | Đầu năm +2/3/3/4/5 vàng. Mỗi lần một công trình được dời (kể cả dời miễn phí): +1 vàng ngay, tối đa 3 mỗi năm. | G4 |
| `nomad_khan_guard` | Ngự Lâm Thiết Kỵ | lính, `cavalry` | H | Sinh `khan_guard` 2/2/3/3/4. | G4 |

**Perk:** (1) **Vó Ngựa** — lính `cavalry` +10% tốc và +10% DMG. (2) **Thảo Nguyên Rộng** — bắt đầu với ô (2,0) và (2,4) đã mở. (3) **Nhổ Trại Nhanh** — Lều Di Động thêm 1 lần mỗi năm.

**Cờ hiệu — Đột Kích:** địch +25% tốc; mỗi đợt thêm 1 mép xuất hiện. **Roster:** `rider` 45, `horse_archer` 40, `khan_guard` 15.

## 7. Sắc lệnh, nhiệm vụ, boss, can thiệp

### 7.1 Sắc lệnh (`src/data/decrees.ts`, 18 cái)

Mỗi sắc lệnh nhận tối đa 1 lần mỗi ván. Sắc lệnh cần lựa chọn (Mở Rộng Bờ Cõi, Học Viện Hoàng Gia, Thanh Lọc) mở bước chọn phụ ngay sau khi nhận.

| id | Tên | Hiệu ứng |
|---|---|---|
| `decree_harvest_tax` | Thuế Mùa Màng | Đầu năm +2 vàng. |
| `decree_expand_borders` | Mở Rộng Bờ Cõi | Mở ngay 2 ô khoá hợp lệ do người chơi chọn (không tăng `purchasedPlots`). |
| `decree_mobilize` | Tổng Động Viên | Mọi công trình lính +1 lính. |
| `decree_recast_crown` | Đúc Lại Vương Miện | Ngai +1 cấp. |
| `decree_royal_armory` | Kho Vũ Khí Hoàng Gia | Mọi lính +10% DMG. |
| `decree_new_armor` | Áo Giáp Mới | Mọi lính +15% HP. |
| `decree_royal_archers` | Cung Thủ Hoàng Gia | Mọi tháp và Ngai +12 px tầm. |
| `decree_merchant_guild` | Phường Hội Thương Nhân | Thêm 1 lần đổi bài miễn phí mỗi năm (dùng trước các lần trả tiền; cộng với perk Thuế Nhẹ). |
| `decree_fourth_hand` | Bàn Tay Thứ Tư | Rút 4 thẻ thay vì `RUN.handSize`. |
| `decree_bigger_boulder` | Đá Tảng Lớn | Can Thiệp +50% sát thương, +8 px bán kính. |
| `decree_quick_reflex` | Phản Xạ Nhanh | Hồi chiêu Can Thiệp −30% (cộng với các nguồn khác, trần tổng giảm ở §7.4). |
| `decree_amnesty` | Lệnh Ân Xá | +1 mạng (không vượt `RUN.maxLives`); nếu đã tối đa thì +10 vàng. |
| `decree_treasury` | Ngân Khố | +15 vàng ngay. |
| `decree_academy` | Học Viện Hoàng Gia | Chọn 1 trong 2 thẻ hiếm của vua mình, thêm 1 bản vào bộ bài. |
| `decree_purge` | Thanh Lọc | Loại tối đa 2 bản khỏi bộ bài (bộ bài phải còn ≥ `RUN.handSize` bản). |
| `decree_trade` | Giao Thương | Thẻ thưởng có 4 lựa chọn. |
| `decree_rune_festival` | Lễ Hội Phù Chú | Mọi công trình đang có Bùa nhận ngay +1 stack của Bùa gắn đầu tiên (tới giới hạn). |
| `decree_moat` | Hào Nước | Mọi địch −10% tốc. |

### 7.2 Nhiệm vụ (`src/data/quests.ts`, 13 cái)

- Ở năm thuộc `RUN.questYears` (bước 5 của §5.5): rút 1 nhiệm vụ chưa từng được đề nghị trong ván bằng `Rng(stream 'quest')`; người chơi **Nhận** hoặc **Từ chối**. Đang có `RUN.maxActiveQuests` nhiệm vụ thì không đề nghị.
- "Hạn N năm" = phải hoàn thành trước khi hết năm `offeredYear + N − 1`. Kiểm tra sau mỗi trận (bước 9) và ở cuối năm (bước 11). Hết hạn = thất bại, không phạt (trừ Đặt Cược đã trả trước).

| id | Tên | Điều kiện | Hạn | Thưởng |
|---|---|---|---|---|
| `quest_untouched` | Ngai Vô Sự | Thắng một trận mà Ngai không mất HP. | 1 | +6 vàng |
| `quest_three_barracks` | Ba Doanh Trại | Có ≥ 3 công trình lính cùng lúc. | 3 | Chọn 1 trong 3 thẻ hiếm (nguồn như §3.8) |
| `quest_no_reroll` | Tiết Kiệm | Không đổi bài lần nào trong suốt hạn. | 3 | +8 vàng |
| `quest_slaughter` | Đại Thắng | Hạ ≥ 100 địch trong một trận. | 3 | +1 bản Thăng Cấp vào bộ bài |
| `quest_double_rune` | Bùa Chồng Bùa | Một công trình có tổng ≥ 2 stack Bùa. | 2 | Công trình đó +1 stack Bùa gắn đầu tiên; nếu hết chỗ thì +4 vàng |
| `quest_land_grab` | Khai Phá | Mở thêm 2 ô (bằng mọi cách) trong hạn. | 3 | +10 vàng |
| `quest_master_builder` | Thợ Cả | Có công trình cấp ≥ 4. | 4 | +1 cấp cho công trình cấp thấp nhất (không phải Ngai; hoà → `plot` nhỏ nhất) |
| `quest_blitz` | Chớp Nhoáng | Thắng một trận trong ≤ 300 tick. | 2 | +5 vàng |
| `quest_hoard` | Kho Đầy | Kết thúc một năm với ≥ 20 vàng. | 3 | +5 vàng |
| `quest_no_help` | Tự Lực | Thắng một trận mà không dùng Can Thiệp. | 2 | Can Thiệp +20% sát thương vĩnh viễn |
| `quest_offering` | Lễ Vật | Chơi một thẻ `sacrifice`. | 3 | +4 vàng, thêm +1 vàng mỗi cấp của công trình bị hiến |
| `quest_diversity` | Trăm Nghề | Có cùng lúc đủ 4 loại công trình lính, tháp, kinh tế, hỗ trợ. | 3 | +1 mạng (không vượt `RUN.startLives`); nếu đủ thì +8 vàng |
| `quest_wager` | Đặt Cược | Trả 5 vàng khi nhận (không nhận được nếu < 5 vàng); thắng 2 trận liên tiếp ngay sau đó. | 2 | +15 vàng |

### 7.3 Boss (`src/data/bosses.ts`)

Boss xuất hiện ở tick `WAVES.spawnTick[1]` từ mép đầu tiên của đợt 2, đi kèm đạo quân ngân sách `SLOT_MULT.boss`. HP boss × `(1 + RUN.difficultyBudgetStep × gai)`. Boss miễn đẩy lùi; choáng lên boss chỉ còn 50% thời gian (Boss 3 miễn hẳn choáng và chậm). Boss không bị tính vào `ENEMY_CAP`; đơn vị boss triệu hồi có giới hạn riêng `BATTLE.bossSummonCap`.

| | Boss 1 — Ông Kẹ Đầm Lầy (`boss_bog_ogre`) | Boss 2 — Nữ Hoàng Ong Bắp Cày (`boss_hornet_queen`) | Boss 3 — Vua Không Ngai (`boss_crownless_king`) |
|---|---|---|---|
| Năm | 10 | 20 | 30 |
| HP / Giáp | 2500 / 0.2 | 9000 / 0.1 | 30000 / 0.3 |
| Đòn | 40 vật lý, `cleave 3`, tầm 4, nhịp 20 | 50 vật lý, đạn 9, tầm 64, nhịp 15 | 120 vật lý, `cleave 4`, tầm 6, nhịp 18 |
| Tốc / R / Sprite | 0.5 / 14 / 48×48 | 0.8 / 12 / 48×48 | 0.6 / 16 / 48×48 |
| Tag | boss, melee, siege | boss, ranged, flying | boss, melee |
| Kỹ năng | **Ném Bùn:** mỗi 80 tick ném vào tháp có DMG cuối cao nhất trong 160 px (hoà → `plot` nhỏ nhất): 60 vật lý + vô hiệu tháp 30 tick. **Gọi Ếch:** lần đầu xuống dưới 50% HP sinh 10 `frog` quanh mình. | **Đàn Ong:** mỗi 50 tick sinh 4 `hornet`. **Hạ Cánh:** mỗi 150 tick đáp xuống 40 tick: mất tag `flying`, không tấn công, nhận +25% sát thương. | **Bóng Gương** (HP > 66%): mỗi 100 tick sinh, phía địch, `floor(unitCount / 2)` (tối thiểu 1) lính cùng loại với công trình lính cấp cao nhất của người chơi (hoà → `plot` nhỏ nhất), ở cấp địch `ℓ` của trận. **Khiên Ngai Vỡ** (33–66%): nhận khiên 3000 một lần; nếu không phá được trong 100 tick thì khiên hồi đầy (lặp lại). **Cuồng Vương** (< 33%): +50% tốc và tốc đánh. Can Thiệp gây ×3 sát thương lên boss này. |
| Quân đi kèm | Roster Thổ Phỉ | Liên Quân roster K3 + K4 | Gộp roster cả 6 vua, mỗi vua tổng trọng số bằng nhau |

### 7.4 Can thiệp hoàng gia — Đá Tảng Hoàng Gia (`royal_boulder`)

```ts
export const INTERVENTION = {
  dmgBase: 40, dmgPerYear: 10,  // sát thương = dmgBase + dmgPerYear × (year − 1), loại phép (bỏ qua giáp)
  radius: 24, delayTicks: 6, knockback: 12,
  cooldownTicks: 150, firstReadyTick: 30,
} as const;
```

- Người chơi chọn một điểm trong cánh đồng; sau `delayTicks` tảng đá rơi: mọi **địch** (kể cả bay) trong `radius` nhận sát thương và đẩy lùi ra xa tâm. Không gây hại phe mình.
- Dùng được khi `tick ≥ firstReadyTick` và hết hồi chiêu; hồi chiêu tính từ lúc thả. Các nguồn giảm hồi chiêu cộng lại, tổng tối đa 60%.
- Lệnh can thiệp là `BattleInput { tick, x, y }`, ghi vào `BattleResult.inputs` để chạy lại.
- **Tự bắn (tùy chọn):** `RunState.autoFire` (mặc định tắt) bật/tắt qua lệnh `setAutoFire` (ghi vào `inputs` dạng `{ tick, auto }`). Khi bật, ở bước can thiệp của mỗi tick, nếu `tick ≥ firstReadyTick` và hết hồi chiêu thì Ngai thả đá vào tâm một địch có nhiều địch nhất trong bán kính tảng đá (hòa → id nhỏ nhất); không còn địch sống thì không thả và không tốn hồi. Thả tay và tự thả dùng chung hồi chiêu, lệnh tay cùng tick được xử lý trước. Lần thả tự động không ghi vào `inputs` (suy ra lại từ trạng thái). Bán kính tảng đá là giá trị của thế giới trận (`world.boulderRadius`, khởi tạo từ `INTERVENTION.radius`) để sắc lệnh đổi được.

## 8. Mô phỏng trận (`src/game/battle/*`)

### 8.1 Thế giới trận

- `BattleWorld` là class thuần TS, chứa đơn vị và công trình trong mảng typed **struct-of-arrays** của chính instance (không phải mảng toàn cục kiểu bitECS), sức chứa `BATTLE.entityCap`, cộng một pool đạn `BATTLE.projectileCap`. Nhiều `BattleWorld` có thể cùng tồn tại (test, công cụ cân bằng). Phụ thuộc `bitecs` bị gỡ khỏi `package.json`.
- Id thực thể cấp tăng dần theo thứ tự tạo; không tái sử dụng id trong một trận.
- `createBattle(setup: BattleSetup): BattleWorld`, `stepBattle(world, inputs: readonly BattleInput[]): void` (một tick), `battleResult(world): BattleResult | null`. Sự kiện cho render (`spawn`, `hit`, `death`, `projectile`, `boulder`, `waveSpawned`, `rage`, `ended`) được đẩy vào `world.events` và scene rút ra mỗi frame (giữ mẫu `drainEvents` cũ).

### 8.2 Bản đồ

- Cánh đồng vuông `BATTLE.field × BATTLE.field` px thế giới; bàn cờ 5×5 ô `BATTLE.plot` px đặt giữa, góc trên-trái ở `BATTLE.boardOrigin`.
- Tâm ô `(c, r)` = `(boardOrigin + plot × c + plot/2, boardOrigin + plot × r + plot/2)`; Ngai ở tâm cánh đồng `(192, 192)`.
- Địa hình cánh đồng (cỏ, cỏ hoa, đường đất, ao nhỏ) chỉ để trang trí, sinh từ seed bằng `noise.ts`, vẽ bằng `dualGrid.ts`; **không** ảnh hưởng di chuyển. Không có pathfinding: đơn vị đi thẳng tới mục tiêu, tách nhau bằng separation (§8.11).
- **Xuất hiện:** mỗi mép dùng đoạn giữa `BATTLE.edgeSpan` chiều dài; lính xếp cách nhau `BATTLE.spawnSpacing` px, nằm ngoài cánh đồng `BATTLE.spawnOutside` px; quá một hàng thì hàng sau lùi ra thêm `BATTLE.spawnRowGap` px.

```ts
export const BATTLE = {
  field: 384, plot: 32, boardOrigin: 112,
  structureRadius: 12, throneRadius: 14,
  retargetTicks: 5,
  enemyAggro: 48, siegeAggro: 96, tauntRadiusDefault: 40,
  flyingHitMinRange: 24,           // đòn có tầm ≥ 24 (và tháp, pulse, can thiệp) mới đánh được đơn vị bay
  rageTick: 600, hardLimitTick: 900, rageSpeedPct: 50,
  playerUnitCap: 160, bossSummonCap: 40, entityCap: 512, projectileCap: 400,
  edgeSpan: 0.6, spawnSpacing: 10, spawnOutside: 12, spawnRowGap: 10,
  fieldClampMargin: 32,            // đơn vị bị kẹp trong [−32, field + 32]
  separationPushMax: 1, knockbackTicks: 3, maxSlowPct: 60, bossStunFactor: 0.5,
  spatialCell: 32,
} as const;
/** 16 vị trí xuất quân quanh tâm ô (px, số nguyên, trong bán kính 14). Lính thứ k dùng SPAWN_OFFSETS[k % 16]; vòng thứ hai trở đi nhân 1.5 rồi làm tròn. */
export const SPAWN_OFFSETS = [
  [0, -8], [8, 0], [0, 8], [-8, 0], [6, -6], [6, 6], [-6, 6], [-6, -6],
  [0, -14], [14, 0], [0, 14], [-14, 0], [10, -10], [10, 10], [-10, 10], [-10, -10],
] as const;
```

`ENEMY_CAP` (§3.6) là giới hạn địch; `BATTLE.playerUnitCap` gồm cả lính triệu hồi phe mình.

### 8.3 Mô hình đơn vị lúc chạy

Mỗi thực thể có: `x, y, prevX, prevY` (nội suy render), `team` (ally/foe), `kind` (unit/structure/throne/boss), `defIndex`, `hp, maxHp, shield`, `dmg, dmgType, range, minRange, interval, cooldown, speed, radius, armor`, `tags` (bitmask), `target`, `stunTicks, slowPct, slowTicks`, danh sách status, `sourceBuilding` (uid công trình sinh ra nó, cho thống kê và hiệu ứng theo nguồn), bộ đếm hành vi (ramp, stepBuff, revive đã dùng…). Công trình (kể cả tháp và Ngai) là thực thể đứng yên `speed = 0`, bán kính `structureRadius`/`throneRadius`.

- **Trong tầm:** `khoảngCáchTâm − rA − rB ≤ range` (và `≥ minRange` nếu có).
- **Cooldown:** số thực; mỗi tick −1; khi ≤ 0 và có mục tiêu trong tầm thì đánh và `cooldown += intervalHiệuDụng` (§5.3 + ramp).

### 8.4 Chọn mục tiêu

- **Lính phe mình:** chọn lại mỗi `retargetTicks` tick hoặc khi mục tiêu chết/không đánh được: địch **đánh được** gần nhất (so bình phương khoảng cách; hoà → id nhỏ hơn). Không còn địch → về tâm ô của công trình sinh ra nó và đứng yên.
- **Địch (bình thường):** (1) nếu trong `tauntRadius` của công trình khiêu khích còn sống → công trình khiêu khích gần nhất; (2) đơn vị/công trình phe mình gần nhất trong `enemyAggro` (đơn vị `siege`: chỉ công trình, trong `siegeAggro`); (3) Ngai.
- **Địch khi Cuồng Nộ** (`tick ≥ rageTick`): chỉ nhắm Ngai, bỏ qua khiêu khích, +`rageSpeedPct`% tốc.
- **Tháp/Ngai:** chọn mỗi lần sẵn sàng bắn theo `TargetMode` trong số địch trong tầm: `closestToThrone` (mặc định tháp), `nearest` (mặc định Ngai), `lowestHp`, `highestHp`; hoà → id nhỏ hơn.
- **Đánh được:** đơn vị `flying` chỉ bị đòn có `range ≥ flyingHitMinRange`, tháp, `pulse` và can thiệp nhắm tới.
- **Kite** (`kite d`): khi địch gần nhất < d px và đang hồi đòn, di chuyển thẳng ra xa nó.

### 8.5 Sát thương

- `sauGiáp = raw × (1 − giáp)` với vật lý; `raw × (1 − giáp/2)` với lửa; `raw` với phép. Khiên hấp thụ trước HP.
- `splash r`: mục tiêu chính nhận 100%, mọi địch khác trong r quanh điểm trúng nhận 50%.
- `cleave n`: tối đa n mục tiêu trong tầm của người đánh, gần nhất trước; chính 100%, còn lại 50%.
- `chain`: nhảy sang địch gần nhất chưa trúng trong `radius` quanh mục tiêu trước, mỗi lần × `falloff`.
- `cone`: mọi địch trong `cone.range` có `dot(hướngTớiMụcTiêu, hướngTớiĐịch) ≥ halfAngleCos × |hướngTớiĐịch|` (không dùng lượng giác).
- `lifesteal`: hồi `pct` của sát thương sau giáp. Hồi máu không vượt `maxHp`.
- Đạn có `projectileSpeed`: bay thẳng tới **vị trí hiện tại** của mục tiêu mỗi tick (homing); mục tiêu chết trước khi trúng thì đạn rơi tại vị trí cuối, `splash` vẫn nổ. Hết pool đạn → đòn trúng ngay lập tức.

### 8.6 Hiệu ứng trạng thái & tăng tiến

- **Bỏng / độc:** khoá theo nguồn (`sourceBuilding` của phe mình, hoặc `defIndex` của đơn vị địch). Cùng khoá: làm mới thời gian, `dps = max(cũ, mới)` cộng phần Bùa (Than Hồng) của nguồn; khác khoá: cộng dồn. Độc đếm lớp tới `maxStacks` mỗi khoá. Gây sát thương mỗi khi `tick % 10 = 0`.
- **Chậm:** lấy mạnh nhất, làm mới, tối đa `maxSlowPct`. **Choáng:** `stunTicks = max(cũ, mới)`; boss × `bossStunFactor`. Bị choáng: không đi, không đánh, cooldown vẫn giảm.
- **Đẩy lùi / kéo:** dịch chuyển theo hướng (mục tiêu − nguồn) chuẩn hoá bằng `Math.sqrt`, chia đều trong `knockbackTicks`. Công trình và boss miễn.
- **Hồi máu theo giây** (aura, regen, Đất Lành, Tái Sinh) áp khi `tick % 10 = 0`, theo id tăng dần.
- **Tăng tiến:** `t = tick / 10 + prewind` (giây). `prewind` = tổng "lên dây trước" từ Xưởng Lò Xo, Tua Ngược, perk Dây Cót Căng. Ramp `% mỗi giây` tính lại mỗi tick từ `t`, không tích luỹ trạng thái.

### 8.7 Xuất quân

- **Tick 0**, theo thứ tự: Ngai → công trình theo `plot` 0..24 → lính của từng công trình lính theo `plot` (lính thứ k ở tâm ô + `SPAWN_OFFSETS`) → triệu hồi đầu trận (Đàn Tế, lính đánh thuê của Hợp Đồng tại Ngai) → đợt địch 1. Lính phe mình vượt `playerUnitCap` không được sinh (ghi `BattleResult.capped`).
- Công trình **bị phá** trong trận (máu về 0) ngừng mọi hiệu ứng trận (bắn, aura, triệu hồi, sinh lại) tới hết trận; lính đã sinh vẫn chiến đấu.
- Đợt 2, 3 ở `WAVES.spawnTick`; boss theo §7.3.
- Triệu hồi giữa trận xuất hiện ở vị trí nguồn + `SPAWN_OFFSETS` theo bộ đếm triệu hồi của nguồn.

### 8.8 Kết thúc

- **Thắng:** mọi đợt đã xuất hiện, boss (nếu có) đã chết và không còn địch sống.
- **Thua:** HP Ngai ≤ 0 (kiểm tra cuối mỗi tick, ưu tiên hơn thắng nếu cùng tick).
- **Cuồng Nộ** từ `rageTick` (60 s). **Hết giờ** ở `hardLimitTick` (90 s): Ngai còn HP → thắng.
- `BattleResult = { won, ticks, throneHpLostPct, kills, killsBySource, goldDelta, interventionsUsed, unitsLost, capped, inputs }`.

### 8.9 Thứ tự một tick (deterministic)

1. Xuất hiện đợt/boss/triệu hồi định giờ của tick này.
2. Lệnh can thiệp của tick này (kiểm tra hồi chiêu) → lên lịch tảng đá; tảng đá đến hạn rơi.
3. Hook `onBattleTick` (tháp chuông, vòng triệu hồi, sinh lại nhện, kỹ năng boss…): nguồn theo id tăng dần.
4. Chọn mục tiêu (§8.4), id tăng dần.
5. Di chuyển: vận tốc mong muốn từ vị trí đầu tick; rồi separation (§8.11) tính từ **ảnh chụp vị trí** và áp cùng lúc; rồi đẩy lùi đang chạy; rồi kẹp biên.
6. Tấn công: mọi thực thể sẵn sàng theo id tăng dần tạo **sự kiện sát thương** hoặc đạn; chưa trừ máu.
7. Đạn bay; đạn trúng tạo sự kiện sát thương.
8. Áp sự kiện sát thương theo thứ tự (id nguồn, id mục tiêu, thứ tự tạo); hiệu ứng `onHit`.
9. Trạng thái (bỏng, độc, hồi máu, khiên) ở tick chia hết cho 10.
10. Xử lý chết theo id tăng dần: `reviveOnce`, `deathSpawn`, Hồn, `onUnitDeath`/`onEnemyKilled`, Bất Tử.
11. Kiểm tra kết thúc (§8.8).

### 8.10 Hiệu năng

- Trần thực thể: `ENEMY_CAP` + `playerUnitCap` + boss + `bossSummonCap` + 25 công trình ≤ `entityCap`; đạn ≤ `projectileCap`.
- **Ngân sách:** `stepBattle` trung bình ≤ 0.5 ms/tick trên Node desktop với kịch bản chuẩn 160 lính mình + 120 địch + 25 công trình + 150 đạn (test benchmark khẳng định ≤ 2 ms để không flaky). Render ≥ 60 fps desktop, ≥ 30 fps trên điện thoại Android tầm trung với số đơn vị tối đa; mọi sprite thế giới từ **một** atlas `sprites`.
- Trận chạy bằng `SimClock` (10 tick/s), tốc độ ❚❚/1×/2×/3× như `GAME_SPEEDS` hiện có; render nội suy bằng `clock.alpha`.

### 8.11 Dùng lại hạ tầng

- `SpatialHash` (`cell = BATTLE.spatialCell`) xây lại mỗi tick cho đơn vị; mọi kết quả `query` được **sắp theo id** trước khi dùng.
- Separation chuyển từ `movementSystem` cũ sang `src/game/battle/steering.ts`: cặp đơn vị chồng nhau (`d < rA + rB`) bị đẩy ra mỗi bên `min(overlap/2, separationPushMax)`; trùng tâm → tách theo trục cố định (1, 0) như code cũ; công trình đẩy một chiều đơn vị không bay ra khỏi bán kính của nó.

### 8.12 Luật deterministic

- Trận **không dùng `Rng`**: mọi lựa chọn có luật hoà theo id/`plot`. `Rng` chỉ dùng ở tầng ván với các luồng riêng: `'draw'`, `'reward'`, `'calendar'`, `'council'`, `'quest'`, `'army'` — mỗi luồng là `new Rng(hashSeed(\`${seed}:${stream}\`))`, trạng thái lưu trong `RunState.rng`. Luồng `'army'` đổi seed mỗi năm: `hashSeed(\`${seed}:army:${year}\`)`.
- Cấm trong `src/game` và `src/core`: `Math.random`, `Date.now`, `performance.now`, `Math.hypot`, `Math.sin/cos/tan/atan2/exp/log/pow` (độ chính xác khác nhau giữa engine JS); chỉ dùng `+ − × ÷` và `Math.sqrt/floor/ceil/round/min/max/abs`. ESLint chặn (§12.4). Hằng số mũ dùng bảng tính sẵn (`ENEMY_BUDGET`).
- Không lặp `Map`/`Set` theo thứ tự phụ thuộc dữ liệu khi kết quả ảnh hưởng mô phỏng (sắp theo id trước).

## 9. Meta-progression & lưu

### 9.1 Điểm Vương Miện

Cuối ván (thắng hay thua):

```
điểm = round((nămĐãHoànThành × 1 + vuaĐãChinhPhục × 3 + bossĐãThắng × 5 + (thắngVán ? 20 : 0))
             × (1 + RUN.difficultyCrownStep × gai))
```

`nămĐãHoànThành` = số trận đã đánh xong (tối đa 30). Tối đa ở độ khó 0: 30 + 18 + 15 + 20 = 83. Điểm cộng vào **số dư** (tiêu được) và vào **thông thạo** của vua vừa chơi (không bao giờ giảm).

### 9.2 Mở khoá (`src/data/meta.ts`)

| Mục | Điều kiện |
|---|---|
| Vua Lúa Mì, Đá Núi, Phép Thuật | Mở sẵn |
| Vua Rừng Xanh, Thuỷ Triều | 25 điểm (số dư) |
| Vua Lò Rèn, Đồng Hồ | 40 điểm |
| Vua Ánh Trăng | 60 điểm |
| Vua Du Mục | 80 điểm và đã thắng ≥ 1 ván |
| Perk 1 / 2 / 3 của một vua | Thông thạo vua đó ≥ 10 / 30 / 60 (tự mở, không tốn số dư) |
| Thẻ `neutral_duplicate` | 15 điểm |
| Thẻ `neutral_royal_seal` | 20 điểm |
| Độ khó Gai d (1..5) | Đã thắng ở Gai d − 1 với bất kỳ vua nào |

- Ở chọn vua: chọn **tối đa 1** perk đã mở của vua đó (hoặc không perk) và một độ khó đã mở.
- Mỗi độ khó Gai d: ngân sách địch × `(1 + RUN.difficultyBudgetStep × d)`, HP boss cùng hệ số, điểm × `(1 + RUN.difficultyCrownStep × d)`.

### 9.3 Lưu (IndexedDB)

- Database `crowned-kingdoms`, version 1, object store `run` (khoá `'current'`) và `meta` (khoá `'profile'`).
- **Ván:** lưu toàn bộ `RunState` (JSON) sau **mọi lệnh thành công ngoài trận** và khi vào/ra pha `battle`. Không lưu giữa trận: tải lại khi đang `battle` → dựng lại `BattleSetup` từ `RunState` và đánh lại từ tick 0 (cùng đạo quân, cùng tay bài và hai chồng bài). Ván kết thúc → xoá `run`.
- **Meta:** `{ version, crownPoints, mastery: Record<KingId, number>, unlockedKings, unlockedCards, wins: Record<KingId, number>, highestDifficultyWon, settings: { master, music, sfx } }`, lưu khi kết thúc ván, khi mở khoá, khi đổi cài đặt.
- **Phiên bản:** `RUN_SAVE_VERSION` (tăng khi `RunState` đổi: bản G1-polish thêm `drawPile`, `discardPile`, `autoFire`), `META_SAVE_VERSION = 1`. Mỗi bản lưu có `version` và `contentHash` (`hashSeed` của danh sách mọi `CardId` + `UnitId` đã sắp). Tải: `version` thấp hơn → chạy chuỗi migrator; không có migrator, version cao hơn, hoặc `contentHash` khác mà có `CardId` không còn tồn tại → bỏ ván, toast "Ván đang chơi không còn tương thích với bản cập nhật này." Meta **luôn** phải có migrator (không bao giờ xoá meta).
- `SaveStore` là interface thuần trong `src/game/save/types.ts` (`loadRun/saveRun/clearRun/loadMeta/saveMeta`); bản IndexedDB ở `src/platform/storage/idbSaveStore.ts`; test dùng `MemorySaveStore`. IndexedDB không dùng được (chế độ riêng tư) → dùng bộ nhớ + toast "Trình duyệt này không lưu được tiến trình."

## 10. Màn hình & UI (kiểu Stardew)

### 10.1 Chung

- Dùng nguyên các khối của UI spec/plan: `UI_PALETTE`, frame `panel/button/buttonHover/buttonDown/buttonActive/slot/slotSelected/tooltip/bar`, `createPanel`, `createButton`, `ContentBox`, `Tooltip` (bấm giữ 400 ms trên cảm ứng), toast, `uiScale`, `MARGIN = 10`, chữ `FONT_UI` màu `text` bóng `textShadow`.
- Mọi vùng chạm ≥ 44×44 px logic. Bố cục tính lại trong `layout()` khi resize. "Desktop" = 1280×720, "mobile" = 375×812 (dọc); kích thước giữa hai mức dùng luật của mức gần nhất theo chiều rộng (`width ≥ 768` → bố cục desktop).
- Lớp phủ trên thế giới (ô hợp lệ/không hợp lệ, vòng ngắm can thiệp, mũi tên mép xuất hiện) là UI: vẽ bằng `UI_PALETTE` (`good`, `bad`, `gold`).
- Phím tắt desktop có tooltip ghi phím.

### 10.2 Menu chính (`MainMenuScene`)

Theo UI plan Task 9 (trời dither, đồi parallax, đom đóm), đổi: logo "Crowned Kingdoms", phụ đề "Một vương quốc nhỏ, chín ngai vàng". Nút 200×52 xếp dọc: **Tiếp tục** (chỉ hiện khi có ván lưu), **Ván mới** (→ Chọn vua), **Vương Miện** (→ §10.9), **Cài đặt** (→ §10.10). Bỏ nút "Đổi seed" và dòng seed (chuyển sang Chọn vua). Nút của tính năng chưa có trong G hiện tại thì ẩn.

### 10.3 Chọn vua (`KingSelectScene`)

- **Desktop:** trái: lưới 3×3 ô `slot` 96×96, chân dung vua (vua khoá: bóng đen + giá/điều kiện). Phải: panel 560 px: tên + một dòng lối chơi, mô tả Ngai, hàng 3 nút perk (≥ 44 px cao; khoá ghi "Thông thạo N"), danh sách 9 thẻ dạng thẻ nhỏ 72×100 cuộn ngang, hàng nút độ khó Gai 0–5, dòng seed + nút "Đổi seed", nút chính **Bắt đầu** 200×52.
- **Mobile:** lưới 3×3 ô 100×100 ở trên (y 10–330), panel chi tiết cuộn dọc bên dưới, nút **Bắt đầu** 355×56 ghim đáy.

### 10.4 Vương quốc / Lập kế hoạch (`RealmScene` + `PlanningHudScene`)

`RealmScene` vẽ cánh đồng + bàn cờ. Camera **dùng chung** với pha trận: desktop cùng zoom (`z = max(1, floor(min(width, height + 96) / BATTLE.field))`) và Ngai ở giữa màn hình ở cả hai pha; mobile giữ zoom 2 khi chọn bài (ô 64 px, bàn cờ 320×320) rồi trượt về zoom 1 trong ~400 ms khi vào trận. Nền cỏ phủ kín mọi vùng camera nhìn thấy, sân 384×384 vẽ đè ở giữa. Các phần HUD:

| Phần | Desktop 1280×720 | Mobile 375×812 |
|---|---|---|
| Mạng (biểu tượng vương miện × số) | `panel` 120×52, trái trên | `panel` 96×48, hàng 1 (y 10–58) trái |
| Vàng | `panel` 120×52 cạnh Mạng | `panel` 96×48 cạnh Mạng |
| Năm "Năm 7 / 30" | `panel` 160×52 giữa trên | phần còn lại của hàng 1 |
| Lịch: 5 ô 52×52 (năm nay + 4 năm tới) | `panel` phải trên | hàng 2 (y 64–116) cùng nút "Trinh sát" 52×52 |
| Bàn cờ | tâm (640, 340) → y 180–500 | y 124–444, giữa ngang |
| Trinh sát (đạo quân năm nay) | panel 260 px cột phải, y 92–520 | panel tóm tắt y 508–642 (icon × số theo đợt); bấm → bảng đầy đủ |
| Sắc lệnh & nhiệm vụ | panel 260 px cột trái, y 72–520 | nút "Sắc lệnh" mở bảng |
| Tay bài | 3 thẻ 120×168 cách 12, giữa dưới (y 542–710) | 3 thẻ 108×152 cách 8, y 650–802 |
| Nút | trái tay bài: "Đổi bài (N vàng)", "Bỏ lượt (+2)" 140×52 xếp dọc; phải: "Bộ bài (11)", "Ra trận" | hàng y 452–500: "Bộ bài", "Sắc lệnh", "Đổi bài", "Bỏ lượt" 84×48 |

- **Ô lịch:** số năm, huy hiệu vua tấn công (màu chủ của vua) + chấm lần tấn công 1–3, đầu lâu cho boss, cuộn giấy cho năm Hội đồng, ngôi sao cho năm nhiệm vụ. Bấm → tooltip chi tiết; nút/phím L → bảng lịch đủ 30 năm.
- **Trinh sát:** từng đợt: tick xuất hiện, mép (mũi tên), icon lính × số, cấp; tên và cờ hiệu của kẻ tấn công. `RealmScene` vẽ mũi tên `gold` ở các mép sẽ xuất hiện.
- **Chơi thẻ:** bấm thẻ (nâng 12 px, frame `cardSelected`) → ô hợp lệ viền `good`, ô không hợp lệ viền `bad` (hover/bấm giữ hiện lý do §4.4) → bấm ô → tooltip xem trước ("Dân Quân → Cấp 2: 6 lính") + nút ✓ Đặt / ✕ Huỷ 48×48 cạnh ô (mobile: phía trên bàn cờ) → ✓ gửi lệnh `play`. Sách phép `none`: thẻ đang chọn có nút "Dùng". Sách hai mục tiêu: chọn lần lượt, có dòng hướng dẫn trong hộp `tooltip`. Desktop có thể kéo thẻ thả vào ô (vẫn cần ✓).
- Ô khoá kề ô mở hiện giá `unlockCost(k)`; bấm → xác nhận mở (G2+).
- Sau khi chơi thẻ/bán thẻ: **G2+** (`autoStart = false`) nút **Ra trận** 200×56 hiện ở chỗ tay bài (cả hai bố cục) và các thẻ còn lại giữ trên tay; **G1** (`autoStart = true`) trận tự bắt đầu, không có nút Ra trận. Tay bài căn giữa theo số thẻ đang có (1–3).
- **Phím desktop:** 1/2/3 chọn thẻ, R đổi bài, S bán/bỏ thẻ đang chọn, D bộ bài, L lịch, Enter ✓/Ra trận (khi nút hiện), Esc huỷ.
- **Thẻ (`CardView`, `src/ui/cards/CardView.ts`):** frame theo độ hiếm (§11.3), băng tên trên, cửa sổ tranh 32×24 px nguồn (× 3 desktop, × 2 mobile), icon loại 16×16 góc trái trên, chấm cấp/biển "Lên cấp N" nếu chơi sẽ nâng cấp, dòng đầu tiên của `describeCard` (tối đa 2 dòng, cắt "…"); tooltip/bấm giữ hiện đầy đủ.

### 10.5 Bảng phụ

- **Bộ bài:** lưới thẻ nhỏ (desktop 6 cột 96×134; mobile 3 cột) có huy hiệu ×N, tab lọc theo loại, cuộn kéo.
- **Lịch 30 năm:** lưới 6×5 ô như ô lịch.
- Mọi bảng phụ: nền phủ `outline` alpha 0.6, `panel` giữa màn hình, nút ✕ 48×48 góc phải trên, Esc đóng.

### 10.6 Thưởng, chinh phục, hội đồng, nhiệm vụ

- **Thưởng:** tiêu đề "Phần thưởng — chọn 1 thẻ"; 3 thẻ (desktop 150×210; mobile 108×152, 4 lựa chọn thì lưới 2×2); bấm thẻ → chọn, nút **Nhận**; nút **Bỏ qua (+3 vàng)**.
- **Chinh phục:** như Thưởng, tiêu đề "Chinh phục {tên vua} — chọn 1 thẻ", không có Bỏ qua.
- **Hội đồng:** tiêu đề "Hội Đồng Hoàng Gia — Năm N"; 3 cuộn sắc lệnh (`panel` 300×120 xếp ngang trên desktop, 355×110 xếp dọc trên mobile), icon 32×32 + tên + mô tả; chọn → **Ban hành**.
- **Nhiệm vụ:** hộp "Sứ giả mang tin…": điều kiện, hạn, thưởng; **Nhận** / **Từ chối**.

### 10.7 Trận (`RealmScene` + `BattleHudScene`)

- Camera: zoom `z = max(1, floor(min(width, height + 96) / BATTLE.field))` (desktop 2, mobile 1), tâm ở Ngai; cánh đồng được phép bị cắt tối đa 48 px trên/dưới. Nền cỏ phủ kín vùng ngoài sân (không còn dải tối). Camera chung với pha lập kế hoạch (§10.4).
- **HUD:** giữa trên `panel` 260×52: đồng hồ trận "0:42" + thanh HP Ngai (`bar`). Trái trên: mạng + vàng (như §10.4). Phải trên: "Địch còn: 37" + 3 chấm đợt. Trái dưới: 4 nút tốc độ ❚❚/1×/2×/3× 48×48 cách 2. Phải dưới: nút **Can Thiệp** tròn 72×72 (icon tảng đá, phủ tối từ dưới lên theo hồi chiêu, số giây còn lại). Cạnh Can Thiệp: nút **Tự bắn: Bật/Tắt** (§7.4) và nút **Địch** mở lại bảng Trinh sát đầy đủ của đạo quân năm nay. Bấm nhà hoặc lính (khi không đang ngắm) hiện bảng thông tin (tên, cấp, HP, sát thương, tầm, giáp). Desktop: Space/B = Can Thiệp, P = tạm dừng, 1–3 = tốc độ.
- **Ngắm:** bấm Can Thiệp → chế độ ngắm (vòng `gold` bán kính 24 theo con trỏ) → bấm cánh đồng = thả; bấm lại nút = huỷ; kéo từ nút thả ra cánh đồng = thả. Ngắm được khi tạm dừng (lệnh ghi ở tick hiện tại).
- Cuồng Nộ: toast "Quân địch nổi cơn cuồng nộ!".
- **Kết thúc:** băng "Chiến thắng!" / "Ngai thất thủ!" 1.2 s → bảng tổng kết (vàng, số địch hạ, mạng còn) + **Tiếp tục**.

### 10.8 Kết thúc ván (`RunEndScene`)

`panel` lớn: thắng/thua, năm đạt được, vua đã chinh phục (huy hiệu), boss đã thắng, bảng cộng Điểm Vương Miện theo §9.1, thông báo mở khoá mới; nút **Về menu**, **Ván mới**.

### 10.9 Vương Miện (`CrownsScene`)

Số dư điểm; hàng vua với nút mở khoá (giá) và thanh thông thạo (`bar`) có mốc perk 10/30/60; thẻ trung lập mở khoá; độ khó cao nhất đã thắng.

### 10.10 Cài đặt (G5)

Ba thanh trượt âm lượng (tổng, nhạc, hiệu ứng) 0–100 bước 10, nút −/+ 48×48; công tắc rung màn hình; nút "Xoá ván đang chơi" (xác nhận hai bước).

## 11. Art & âm thanh

### 11.1 Bảng màu thế giới "Hearth 32" (`src/data/palette.ts`, thay "Ashen 32")

Giữ tên export `PALETTE`, `PaletteColor`, `toCss`; thay toàn bộ giá trị. Ngôn ngữ thị giác: tông ấm, bão hoà vừa, bóng đổ nâu–mận (không đen/tím lạnh); **xanh dương = phe mình, đỏ = phe địch**.

```ts
export const PALETTE = {
  // Tối / viền
  outline: 0x2a1a14, shadow: 0x4a2f27, plum: 0x6b3f5a,
  // Cây cỏ
  leafDark: 0x2f5a35, grassDark: 0x3f6b2a, leaf: 0x4a8a3f, grass: 0x5d9b3a, grassLight: 0x8cc455, meadow: 0xb8d86a,
  // Đất
  soilDark: 0x6b4423, soil: 0x9a6634, path: 0xc89458, sand: 0xe8c68a,
  // Lúa
  wheat: 0xe8b84a, wheatLight: 0xf6dc7a,
  // Nước
  waterDeep: 0x2f6f9a, water: 0x4a9ac8, waterLight: 0x8fd0e8,
  // Đá
  stoneDark: 0x5e5a66, stone: 0x8c8794, stoneLight: 0xc2bcc4,
  // Da, vải sáng
  skin: 0xf2c49b, skinShadow: 0xc98a64, cream: 0xfaf0d7, white: 0xfffbf0,
  // Điểm nhấn
  red: 0xd04a3a, redDark: 0x8e2d2b, orange: 0xf08a3a, gold: 0xf6c445, blue: 0x4a6fc8, purple: 0x8a5ab8, teal: 0x3aa89a,
} as const;
```

Luật (ghi vào `ART_STYLE.md`): pixel thế giới (cánh đồng, ô, công trình, đơn vị, tranh trong thẻ) chỉ lấy từ `PALETTE`; pixel UI (khung, nút, thẻ, lớp phủ) chỉ lấy từ `UI_PALETTE`. Bóng đổ elip dùng `shadow` alpha 50%. Phông nền game (`main.ts`) = `outline`.

### 11.2 Kích thước

| Thứ | Kích thước | Ghi chú |
|---|---|---|
| Tile cánh đồng | 16×16 | dual-grid như cũ (cỏ < cỏ hoa < đường đất < cát; ao là nước) |
| Ô bàn cờ | 32×32 | ô mở trống (đất xới viền cỏ), ô khoá (cỏ rậm + cọc rào + biển giá), bệ Ngai (đá) |
| Công trình | 32×40 | đứng trên mép dưới ô, phần cao 8 px tràn lên ô phía Bắc (y-sort) |
| Ngai | 32×48 | |
| Lính nhỏ chibi | 16×16 | dân quân, sói, nhện, xương…; đầu ≈ 40% chiều cao |
| Lính cao | 16×24 | người cầm vũ khí dài, pháp sư, kỵ binh |
| Lính lớn | 24×24 / 24×32 | người đá, gấu, cổ thụ, rồng sắt, khổng lồ đồng, thần chết |
| Boss | 48×48 | |
| Đạn / hiệu ứng | 4×4 – 8×8 | tia lửa, mũi tên (4 hướng + 4 chéo, vẽ riêng, không xoay), đá, bùn |
| Tảng đá can thiệp | 16×16 + bóng 24×8 | |
| Tranh thẻ | 32×24 | cửa sổ tranh trong `CardView` |
| Icon loại thẻ / tài nguyên | 16×16 | |
| Chân dung vua | 32×32 | ghép trong ô chọn vua |
| Khung thẻ (UI) | ô nguồn 24×32, slice 8 | `card`, `cardUncommon`, `cardRare`, `cardSelected` |

### 11.3 Pipeline art sinh bằng code

- Giữ `PixelCanvas`/`pixelHash` (`pixel.ts`), `paintBitmap` (`bitmap.ts`), `dualGrid.ts`. Module mới (thuần TS, có test màu): `fieldArt.ts` (tile cánh đồng), `plotArt.ts`, `buildingArt.ts`, `unitArt.ts`, `cardArt.ts` (khung thẻ, chỉ `UI_PALETTE`), `iconArt.ts`, `fxArt.ts`, `portraitArt.ts`.
- Đơn vị vẽ bằng `paintBitmap` với ký tự màu cố định; ký tự `c` = màu vải → màu chủ vua; ký tự `o` = viền → `outline` (phe mình) hoặc `redDark` (phe địch, kèm 1 pixel cờ `red`). Atlas sinh hai biến thể `unit_<id>_ally` và `unit_<id>_foe`.
- Hoạt ảnh: idle 2 frame, đi 2 frame (nhún 1 px), đánh 2 frame; 6–8 fps idle/đi, 10–12 fps đánh (giữ ART_STYLE). Không xoay sprite; **lật ngang** để quay trái/phải được phép. Neo ở chân, y-sort.
- Khung thẻ theo độ hiếm (UI): thường = viền `wood`; vừa = viền đôi `woodLight`; hiếm = viền trong `gold`; đang chọn = viền ngoài `select` 2 px.
- `atlas.ts` dựng texture `field-tiles` và `sprites` (một atlas cho mọi sprite thế giới), frame theo tên (`building_<cardId>`, `unit_<id>_<team>_<anim><n>`, `card_art_<cardId>`, `icon_<id>`, `fx_<id>`); khung thẻ thêm vào texture `ui` của UI spec.

### 11.4 Ranh giới thay art thật

Mọi chỗ dùng sprite chỉ gọi frame theo tên qua các hàm `*Frame(...)` trong `atlas.ts`. Thay bằng atlas Aseprite = nạp atlas cùng tên frame trong `PreloadScene`; không sửa scene.

### 11.5 Âm thanh (G5)

- `src/audio/` dùng WebAudio, **sinh bằng code** (không file): `sfx.ts` tổng hợp từ tham số trong `src/data/sfx.ts` (sóng vuông/tam giác/nhiễu + bao biên ADSR + quét tần số), tạo `AudioBuffer` một lần lúc khởi động. Danh sách: `ui_click`, `ui_hover`, `card_draw`, `card_play`, `reroll`, `coin`, `plot_unlock`, `level_up`, `battle_horn`, `hit_light`, `hit_heavy`, `arrow`, `cannon`, `fire`, `magic`, `death_pop`, `boulder_whoosh`, `boulder_impact`, `throne_hit`, `victory`, `defeat`.
- Nhạc: 2 vòng lặp tuần tự từ nốt trong `src/data/music.ts`: `planning` (giai điệu ngũ cung trưởng, 90 BPM, sáo + đàn dây gảy) và `battle` (trống + kèn, 120 BPM); chuyển nhạc mờ chéo 600 ms.
- `AudioContext` chỉ khởi động sau lần chạm/bấm đầu tiên. Âm lượng theo `meta.settings`. Mỗi loại SFX tối đa 4 phát cùng lúc.
- **Juice (G5):** rung màn hình số nguyên 2 px trong 150 ms (tảng đá, boss đánh; tắt được); nháy trắng (`white`) 2 frame khi trúng; "bụp" 4 frame khi chết; thẻ bay tới ô 250 ms + ô nảy; đồng vàng bay về ô Vàng; số nổi chỉ cho đòn ≥ 50 sát thương và vàng nhận được.

## 12. Kiến trúc mã

### 12.1 Thư mục

```
src/core/            events.ts (GameEvents mới), random.ts, SimClock.ts, SpatialHash.ts, geom.ts, noise.ts — thuần TS
src/data/            types.ts, palette.ts (Hearth 32), uiPalette.ts, run.ts, battle.ts, scaling.ts, calendar.ts,
                     neutral.ts, raiders.ts, bosses.ts, decrees.ts, quests.ts, meta.ts, sfx.ts, music.ts,
                     kings/{wheat,stone,arcane,grove,tide,forge,clock,moon,nomad}.ts, kings/index.ts (KINGS)
src/game/run/        state.ts, commands.ts (applyCommand), newRun.ts, yearFlow.ts, deck.ts, board.ts (luật §4),
                     rewards.ts, council.ts, quests.ts, battleSetup.ts, RunController.ts (nghe bus, gọi SaveStore)
src/game/cards/      registry.ts (tra CardDef/UnitDef), describe.ts, effects/*.ts (một file mỗi EffectDef.type),
                     custom/{wheat,stone,…}.ts (CustomEffectId)
src/game/battle/     world.ts (BattleWorld SoA), compose.ts (composeArmy), spawn.ts, targeting.ts, steering.ts,
                     combat.ts, status.ts, projectiles.ts, bosses.ts, intervention.ts, step.ts, result.ts, BattleRunner.ts
src/game/meta/       crowns.ts, unlocks.ts
src/game/save/       types.ts (SaveStore), serialize.ts, migrate.ts, MemorySaveStore.ts
src/game/sim/        headless.ts (chạy ván bằng bot), bots/{greedy,random}.ts
src/game/testing/    fixtures.ts (dựng RunState/BattleSetup nhanh)
src/platform/        storage/idbSaveStore.ts
src/audio/           sfx.ts, music.ts, AudioManager.ts (G5)
src/render/          pixel.ts, bitmap.ts, dualGrid.ts, atlas.ts, uiArt.ts, fieldArt.ts, plotArt.ts, buildingArt.ts,
                     unitArt.ts, cardArt.ts, iconArt.ts, fxArt.ts, portraitArt.ts, FieldRenderer.ts, BoardRenderer.ts,
                     UnitRenderer.ts, FxRenderer.ts
src/ui/              theme.ts, ContentBox.ts, Tooltip.ts, hud/layout.ts (từ UI plan), cards/CardView.ts,
                     planning/*.ts, battle/*.ts, modals/{Reward,Council,Quest,Deck,Calendar}Modal.ts
src/scenes/          BootScene, PreloadScene, MainMenuScene, KingSelectScene, RealmScene, PlanningHudScene,
                     BattleHudScene, RunEndScene, CrownsScene, SettingsScene, keys.ts
tools/balance.ts     CLI cân bằng (G5)
```

- `src/data` chỉ chứa dữ liệu và kiểu; `src/game` chứa luật; `src/render`/`src/ui`/`src/scenes` chỉ đọc trạng thái và gửi ý định qua `EventBus`.
- `RealmScene` vẽ cánh đồng, bàn cờ, đơn vị và hiệu ứng ở cả hai pha; `PlanningHudScene` và `BattleHudScene` là lớp HUD (`scene.launch`, nhận trạng thái đầu qua launch data — giữ luật cũ của CLAUDE.md). Mỗi scene đặt lại trường per-game ở đầu `create()`.

### 12.2 Giữ / chuyển

| Từ (`ui-stardew`) | Thành |
|---|---|
| `src/sim/random.ts` | `src/core/random.ts` (không đổi nội dung) |
| `src/sim/SimClock.ts` (+test) | `src/core/SimClock.ts` |
| `src/sim/spatial/SpatialHash.ts` (+test) | `src/core/SpatialHash.ts` |
| `src/sim/geom.ts` (+test) | `src/core/geom.ts` (giữ `Vec2`, `Bounds`, `distance`, `distanceSq`, `vec`; bỏ `Shape` và các hàm chồng lấn nếu không còn ai dùng; thay `Math.hypot` bằng `Math.sqrt`) |
| `src/sim/noise.ts` | `src/core/noise.ts` |
| `src/core/events.ts` (+test) | giữ `EventBus`, viết lại `GameEvents` (§12.5) |
| `src/render/pixel.ts`, `bitmap.ts` (+test), `dualGrid.ts` (+test) | giữ nguyên |
| `src/render/atlas.ts` | giữ `toCanvas`, `packShelves`, `addPixelTexture`, `UI_KEY`/`buildUiTexture` (UI plan Task 3); thay phần sprite colony |
| `src/ui/theme.ts` | theo UI plan Task 3 |
| `src/scenes/BootScene.ts`, `PreloadScene.ts`, `MainMenuScene.ts`, `keys.ts`, `src/main.ts` | giữ, sửa danh sách scene/nhãn |
| Thuật toán separation trong `src/sim/movement/movement.ts` | chép sang `src/game/battle/steering.ts` (§8.11) |

### 12.3 Xoá

`src/sim/colony/*` (blueprint, buildings, colonists, designation, needs, stockpile, territory + test) · `src/sim/jobs/*` · `src/sim/nav/*` · `src/sim/map/*` (generate, poisson, TerrainGrid + test) · `src/sim/movement/*` (sau khi chép separation) · `src/sim/components.ts`, `GameWorld.ts`, `GameWorld.test.ts`, `step.ts`, `events.ts`, `placement.ts`, `placement.test.ts`, `simulation.test.ts`, `testing/scenario.ts`, `testing/terrainFixture.ts` · `src/data/buildings.ts`, `colonists.ts`, `doodads.ts`, `names.ts`, `resources.ts`, `terrain.ts`, `data.test.ts` · `src/render/ColonistRenderer.ts`, `DebugOverlay.ts`, `DesignationMarkers.ts`, `EntityRenderer.ts`, `PlacementPreview.ts`, `TerrainRenderer.ts`, `WallPreview.ts`, `terrainArt.ts` · `src/platform/CameraController.ts` · `src/scenes/WorldScene.ts`, `HudScene.ts` · dependency `bitecs`. Thư mục `src/sim/` biến mất.

### 12.4 ESLint

```js
{
  files: ['src/game/**/*.ts', 'src/data/**/*.ts', 'src/core/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{ name: 'phaser', message: 'game/, data/ and core/ must stay engine-agnostic.' }],
      patterns: [{ group: ['**/scenes/**', '**/render/**', '**/ui/**', '**/platform/**', '**/audio/**'],
                   message: 'game/, data/ and core/ must not depend on presentation or platform code.' }],
    }],
    'no-restricted-properties': ['error',
      ...['random', 'hypot', 'sin', 'cos', 'tan', 'atan2', 'exp', 'log', 'pow']
        .map((property) => ({ object: 'Math', property, message: 'Non-deterministic or engine-dependent; see spec §8.12.' })),
      { object: 'Date', property: 'now' }, { object: 'performance', property: 'now' }],
  },
},
{ files: ['src/data/**/*.ts'], rules: { 'no-restricted-imports': ['error', {
    paths: [{ name: 'phaser' }], patterns: [{ group: ['**/game/**', '**/scenes/**', '**/render/**', '**/ui/**', '**/platform/**', '**/audio/**'] }] }] } },
```

(Khối thứ hai ghi đè cho `src/data`: dữ liệu không import luật.) Test file (`*.test.ts`) dưới `src/game` vẫn chịu cùng luật.

### 12.5 Sự kiện `EventBus` (`GameEvents` mới)

```ts
export interface GameEvents {
  // Trạng thái → UI
  'run:state': { state: RunState };                       // sau mỗi lệnh thành công
  'run:illegal': { reason: IllegalReason };
  'run:ended': { won: boolean; crownPoints: number; unlocks: string[] };
  'battle:started': { setup: BattleSetup };
  'battle:tick': { tick: number };
  'battle:ended': { result: BattleResult };
  'clock:speed': { speed: GameSpeed };
  log: { text: string };                                  // → toast
  // Ý định UI → RunController / BattleRunner
  'ui:command': { command: RunCommand };
  'ui:select-card': { handIndex: number | null };         // chỉ để RealmScene tô ô hợp lệ
  'ui:intervene': { x: number; y: number };
  'ui:set-speed': { speed: GameSpeed };
  'ui:toggle-pause': Record<string, never>;
  'ui:open-modal': { modal: 'deck' | 'calendar' | 'decrees' | 'scout' };
  'ui:close-modal': Record<string, never>;
}
```

`RunController` là nơi duy nhất gọi `applyCommand` và `SaveStore`; `BattleRunner` là nơi duy nhất gọi `stepBattle`. Sự kiện thay đổi của trận đi qua `world.events` (rút mỗi frame), không qua bus mỗi tick (trừ `battle:tick` mỗi khi giây hiển thị đổi).

## 13. Kiểm thử

### 13.1 Vitest — dữ liệu & luật

- **Dữ liệu:** mỗi vua có đúng 1 Ngai + 9 thẻ (4 T, 3 V, 2 H), 3 perk, cờ hiệu, roster không rỗng; id thẻ/đơn vị/sắc lệnh/nhiệm vụ duy nhất và đúng tiền tố `owner_`; mọi `UnitId` được tham chiếu đều tồn tại; `perStack` của Bùa chỉ chứa số; mọi `PerLevel` dài 5; `nameVi`/`textVi` không rỗng; mọi placeholder của `textVi` giải được ở cấp 1..5; mọi `CustomEffectId` có handler; mọi `color` vua thuộc `PALETTE`; `PALETTE` có đúng 32 màu khác nhau.
- **Công thức:** `battleGold`, `rerollCost`, `unlockCost` theo ví dụ §3.1; `ENEMY_BUDGET` khớp `round(12 × 1.15^(y−1))` (tính lại trong test bằng nhân lặp); điểm Vương Miện (§9.1) với vài ván mẫu (tối đa 83).
- **Lịch:** mẫu §3.5 — mỗi K đúng 3 lần, cách nhau ≥ 3 năm, boss ở 10/20/30; 6 vua địch không gồm vua người chơi; cùng seed → cùng lịch.
- **Bàn cờ & lệnh:** mọi `IllegalReason` ở §4.4 có test; chơi trùng → +1 cấp; cấp 5 → `maxLevel`; dời đổi chỗ giữ Bùa; hiến tế xoá Bùa và kích `onSacrifice`; mở ô kề/không kề, giá tăng chỉ khi mua; `applyCommand` không sửa state đầu vào.
- **Hiệu ứng:** mỗi `EffectDef.type` và mỗi custom có ít nhất một test chỉ số cuối qua `buildBattleSetup` (ví dụ: Dân Quân L3 cạnh Ruộng Lúa L1 → 8 + 1 = 9 lính; Kho Thóc + Bùa Vững Chãi cộng % chứ không nhân); giới hạn §5.3 (giáp 0.75, HP ≥ 30%, nhịp ≥ 50%); thứ tự §5.5 (thu nhập sau tăng trưởng; Cây Mầm lên cấp trước khi tính vàng).
- **Đạo quân:** `composeArmy` không vượt ngân sách và `ENEMY_CAP`; chọn cấp đúng §3.6; chia đợt đúng tỉ lệ; cùng seed/năm → cùng đạo quân.
- **Lưu:** serialize → deserialize bằng nhau; migrator chạy theo chuỗi; `contentHash` sai → bỏ ván, giữ meta.

### 13.2 Vitest — trận

- **Đơn vị cơ bản:** trong tầm mép–mép; công thức giáp theo loại sát thương; splash/cleave/chain/cone; bỏng/độc cộng dồn theo khoá; choáng/chậm; đẩy lùi; bay chỉ bị đòn tầm ≥ 24; khiêu khích; Cuồng Nộ; hết giờ.
- **Deterministic:** chạy cùng `BattleSetup` + cùng `inputs` hai lần (hai `BattleWorld` song song) → băm (FNV trên mọi mảng trạng thái) bằng nhau ở mọi tick 0..kết thúc; đổi một lệnh can thiệp → băm khác.
- **Không phụ thuộc thứ tự chèn:** dựng cùng setup với thứ tự công trình trong mảng khác nhau → cùng kết quả (vì luôn sắp theo `plot`/id).
- **Benchmark** §8.10 (kịch bản chuẩn, ngưỡng 2 ms/tick).

### 13.3 Headless

`runHeadless({ seed, kingId, perk, difficulty, bot })` (`src/game/sim/headless.ts`) chơi cả ván bằng bot qua chính `applyCommand` + `stepBattle`. Test: bot `random` và `greedy` hoàn thành ván 30 năm (hoặc thua sớm) không ném lỗi với 9 vua × 3 seed; cùng seed → cùng `RunStats`. G5 dùng cùng hàm trong `tools/balance.ts`.

### 13.4 Trình duyệt (preview)

Mỗi G: chụp màn hình các scene mới ở 1280×720 và 375×812; kiểm tra không đè/tràn, vùng chạm ≥ 44 px (inspect); chơi kịch bản của G (ví dụ G1: một ván 10 năm thắng và một ván thua); console không lỗi; G5 thêm đo fps trên điện thoại thật hoặc throttle CPU 4×.

## 14. Dự án con G0–G5

Mỗi G có plan riêng (`docs/superpowers/plans/`), kết thúc bằng bản chạy được; `npm run lint && npm run typecheck && npm test && npm run build` exit 0 là điều kiện chung của mọi "Done khi". Thứ tự phụ thuộc: **G0 → G1 → G2 → G3 → G4 → G5**; trong G5, âm thanh và juice có thể làm song song từ sau G2, cân bằng chỉ sau G4.

### G0 — Nền UI & dọn dẹp

1. Xoá colony sim theo §12.3, chuyển hạ tầng theo §12.2, gỡ `bitecs`; tạm thời menu chỉ có nút "Ván mới" bị vô hiệu ("Sắp có").
2. UI plan **Task 1** (`UI_PALETTE`, `uiArt`) nguyên văn.
3. UI plan **Task 2 rút gọn:** tạo `src/ui/hud/layout.ts` chỉ với phần dùng chung: `TOUCH_TARGET`, `MARGIN`, `GAP`, `SPEED_GAP`, `LONG_PRESS_MS`, `MAP_DWELL_MS`, `DRAG_SLOP`, `TOOLTIP_*`, `TOAST`, `TOAST_STACK_H`, `HOTBAR`, kiểu `Rect/Size/Point/Tooltip*/ToastEntry/ToastPush/HotbarFit`, `textContent`, `uiScaleFor`, `pushToast`, `ellipsize`, `toastText`, `placeTooltip`, `placeAbove`, `hotbarWidth`, `hotbarSlotX`, `fitHotbar`, `clampScroll`, `iconScale`, `overlapsX` (+ test tương ứng). **Bỏ:** `clockAt`, `clockLabel`, `dialPoint`, `needColor`, `costTotal`, `CARD`, `layoutCards`, `visibleCards`, `RIGHT_COLUMN_W`, `descVi` và mọi sửa `buildings.ts`/`data.test.ts`.
4. UI plan **Task 3** (texture `ui`, `PreloadScene`, `theme.ts`); nhãn tải "Đang dựng vương quốc…".
5. UI plan **Task 4** (`ContentBox`, `Tooltip`).
6. UI plan **Task 9** (menu) với thay đổi ở §10.2.
7. Thay `PALETTE` bằng Hearth 32 (§11.1), `main.ts` nền `outline`.
8. ESLint §12.4; viết lại `GDD.md` (tóm tắt spec này), `ROADMAP.md` (bảng G0–G5), `ART_STYLE.md` (§11), `CLAUDE.md` (kiến trúc mới, bỏ luật colony), `README.md`, mô tả `package.json`.

**Done khi:** không còn file nào trong §12.3; `grep` không thấy import tới `src/sim`; test `uiArt` + `layout` + `PALETTE` 32 màu pass; menu đúng §10.2 ở hai bố cục, console không lỗi; ESLint báo lỗi khi thử import `phaser` hoặc `Math.random` trong `src/game` (kiểm bằng một file tạm rồi xoá).

### G1 — Lõi chơi được (ván ngắn 10 năm)

- **Luật ván G1:** `RULES_G1 = { years: 10, calendar: 'raiders' }` — cả 10 năm là Thổ Phỉ (`SLOT_MULT.raiders`), không hội đồng, không boss, không nhiệm vụ; thắng khi qua năm 10 còn mạng. Không có vàng, cấp, Bùa, lân cận (đến G2): chơi thẻ công trình lên ô có công trình bất kỳ là `occupied`.
- **Nội dung:** Vua Lúa Mì (Ngai chỉ có đòn bắn; bị động Mùa Gặt từ G2) với `wheat_militia`, `wheat_reapers`, `wheat_scarecrow`; trung lập `neutral_barracks`, `neutral_archer_tower`, `neutral_clear_land`, `neutral_move`; Thổ Phỉ §6.2. Bộ bài khởi đầu G1 cố định: Dân Quân ×2, Bù Nhìn Gác ×2, Đội Thợ Gặt ×1, Trại Lính ×2, Tháp Cung ×2, Khai Hoang ×1, Dời Nhà ×1 (11 bản). Thưởng: 3 lựa chọn từ 7 thẻ này theo luật §3.8.
- **Hệ thống:** `RunState` + `applyCommand` (play, discard, startBattle, battleResult, pickOffer, advance, setAutoFire; tay giữ bài với chồng rút/bỏ; trận tự bắt đầu theo `RULES_G1.autoStart`), vòng năm §5.5 (bỏ bước không áp dụng), `composeArmy`, trận đầy đủ §8 (trừ boss), can thiệp §7.4, mạng §3.10, `RealmScene` + `PlanningHudScene` + `BattleHudScene` + `RunEndScene` tối giản; "Ván mới" vào thẳng Vua Lúa Mì với seed ngẫu nhiên. Art placeholder cho mọi thứ trên. Headless + bot `random`.

**Done khi:** chơi được trọn ván 10 năm trên cả hai bố cục (thắng một ván, thua một ván); test deterministic §13.2 và benchmark pass; headless bot hoàn thành 3 seed; xem trước đạo quân khớp đúng đạo quân xuất hiện.

### G2 — Chiều sâu: bùa, lân cận, cấp, vàng, 3 vua, chinh phục

- Cấp (chơi trùng, `neutral_promote`, hồ sơ §5.2), Bùa (§4.3), hiệu ứng lân cận/toàn bàn cờ, vàng đầy đủ (§3.3: thuế, vàng trận, đổi bài §3.4, mua ô §3.11, phí duy trì), bỏ qua thưởng.
- Nội dung: mọi thẻ cột "G" = G2 (đủ Vua Lúa Mì, Vua Đá Núi, Vua Phép Thuật, trung lập trừ hai thẻ meta) với cờ hiệu của ba vua; bộ bài khởi đầu theo luật chuẩn §3.4.
- `KingSelectScene` (3 vua, chưa perk, chưa độ khó), bảng Bộ bài, lịch + Trinh sát có mép và mũi tên.
- **Luật ván G2:** `RULES_G2 = { years: 15, calendar: 'short' }`, 2 vua địch = hai vua còn lại trong ba vua: năm 1 N, 2 N, 3 K1, 4 K2, 5 N, 6 K1, 7 N, 8 K2, 9 K1 (lần 3), 10 N, 11 N, 12 K2 (lần 3), 13 N, 14 N, 15 N (N = Thổ Phỉ, hệ số như §3.6). Chinh phục §3.7.

**Done khi:** ba vua chơi được tới năm 15; mỗi thẻ G2 có test hiệu ứng; chinh phục cả hai vua trong một ván thử và nhận thẻ của họ; đổi bài/mua ô trừ vàng đúng công thức; bố cục §10.3–10.6 (phần Thưởng/Chinh phục) đúng hai kích thước.

### G3 — Ván đầy đủ: hội đồng, nhiệm vụ, boss, 30 năm, lưu ván

- Lịch đầy đủ §3.5 (`RULES_FULL`, bỏ `RULES_G1/G2`), Liên Quân, sắc lệnh §7.1, nhiệm vụ §7.2, 3 boss §7.3, Ngai lên cấp sau boss.
- Dữ liệu **phía địch** của 6 vua còn lại (`units`, `enemyRoster`, `banner` trong `src/data/kings/*.ts`) để đủ 6 vua địch; thẻ/Ngai/perk của họ chưa có.
- Lưu ván IndexedDB §9.3 (chưa có meta), nút "Tiếp tục".

**Done khi:** headless hoàn thành ván 30 năm với 3 vua × 3 seed; chơi tay một ván trong trình duyệt qua ít nhất boss 1 và một hội đồng; tải lại trang giữa pha Lập kế hoạch và giữa trận khôi phục đúng §9.3; mọi sắc lệnh/nhiệm vụ/kỹ năng boss có test.

### G4 — Đủ 9 vua, perk, meta-progression

- Ngai + 9 thẻ của Rừng Xanh, Thuỷ Triều, Lò Rèn, Đồng Hồ, Ánh Trăng, Du Mục (cột G = G4) và 27 perk; hai thẻ trung lập meta.
- Meta §9.1–9.2 (Điểm Vương Miện, thông thạo, mở khoá, độ khó Gai), meta save, `CrownsScene`, perk + độ khó ở Chọn vua.

**Done khi:** 9 vua chơi được, Du Mục khoá đúng điều kiện; mọi thẻ/perk G4 có test; điểm cuối ván khớp công thức; mở khoá còn sau khi tải lại trang; headless 9 vua × 3 seed pass.

### G5 — Cân bằng, âm thanh, juice, mobile, đóng gói

- `tools/balance.ts` (thêm devDependency `tsx`; script `npm run balance -- --king <id|all> --runs N --bot greedy --difficulty d`): in tỉ lệ thắng, năm trung bình đạt được, tỉ lệ chọn từng thẻ, tỉ lệ thua theo năm; xuất CSV vào `tools/out/` (gitignore). Bot `greedy` chấm điểm nước đi bằng heuristic (tăng sức mạnh ước lượng = Σ HP × DPS của lính + tháp sau `buildBattleSetup`).
- Vòng tinh chỉnh số ở `src/data/*` tới khi đạt Done #7 của §1 (500 ván mỗi vua ở Gai 0).
- Âm thanh + juice §11.5, `SettingsScene`.
- Mobile: safe-area inset (tai thỏ), chặn kéo-làm-mới trình duyệt, xoay ngang dùng bố cục desktop khi `width ≥ 768`, đo fps §8.10.
- PWA: `manifest.webmanifest`, service worker cache offline (viết tay, không thêm plugin), icon sinh bằng code (`tools/icons.ts`).

**Done khi:** toàn bộ "Done khi" của §1.

## 15. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Phạm vi rất lớn (81 thẻ, 9 vua) | Chia G0–G5, mỗi G chơi được; hiệu ứng mô tả bằng dữ liệu, chỉ thẻ độc đáo mới cần `custom` |
| Cân bằng tăng theo cấp số nhân khó kiểm soát | Mọi số ở `src/data/*`, bảng `ENEMY_BUDGET` sửa một chỗ; công cụ headless + bot ở G5 với tiêu chí đo được |
| Mất deterministic (float khác engine, thứ tự `Set`) | Cấm hàm toán học không ổn định bằng ESLint; sắp theo id; test băm trạng thái hai lần chạy |
| Hiệu năng điện thoại với ~300 đơn vị | Trần đơn vị/đạn, cấp địch thay vì số lượng (§3.6), một atlas, benchmark trong test, đo thật ở G5 |
| Màn 375 px chật (bàn cờ + 3 thẻ + lịch) | Bố cục §10.4 đã tính từng hàng (tổng ≤ 812 px); bảng phụ cho phần ít dùng; bấm giữ để xem chi tiết |
| Gần IP của *9 Kings* | Chỉ dùng cơ chế thể loại; tên, số, art, chữ đều gốc; tránh tái tạo bố cục/biểu tượng đặc trưng; lịch, cờ hiệu, sắc lệnh, boss là thiết kế riêng |
| Hệ hiệu ứng phình to, khó đọc | Hook cố định (§5.4), thứ tự cố định (§5.5, §8.9), mỗi `type` một file có test |
| Save cũ vỡ khi đổi nội dung | `version` + `contentHash` + migrator; meta luôn migrate |
| Art sinh bằng code kém hấp dẫn | Ranh giới frame theo tên (§11.4) cho phép thay atlas vẽ tay sau |
| Phaser 4 khác Phaser 3 (nineslice, filter) | Đọc `node_modules/phaser/skills/*` như CLAUDE.md yêu cầu; UI plan Task 3 đã xử lý nineslice |
