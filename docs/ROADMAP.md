> Bản kế hoạch tổng thể (đồng bộ từ phiên lập kế hoạch 2026-10-08, cập nhật v3: bỏ lưới hex). Trạng thái: **Phase 0 + 0b xong** — xem README.

# Kế hoạch: Dark Fantasy Colony Builder (2D Pixel, Web, đa nền tảng)

## Context

Bạn muốn làm một game **Dark Fantasy Colony Builder** dạng 2D pixel art, chạy trên web và đa nền tảng. Các lựa chọn đã chốt:

- **Repo riêng** (không nhét vào portfolio Next.js — portfolio chỉ link sang).
- **Phaser** (TypeScript) làm engine.
- **Hobby, không deadline** → chia milestone mở, mỗi phase kết thúc bằng một bản _chơi được_.
- Gameplay **kết hợp**: colonist sim kiểu RimWorld + phòng thủ đêm kiểu They Are Billions + áp lực sinh tồn/luật lệ kiểu Frostpunk, xoay quanh trục **Sanity / Corruption**.

Tên tạm: **"Ashen Hollow"** (đổi tuỳ ý).

**Cập nhật v2:** Cây công nghệ kiểu **Civilization VI** (Lore + Doctrine, Kỷ nguyên, Eureka/Inspiration, Policy Card) — **giữ nguyên**.

**Cập nhật v3 (2026-10-08) — BỎ LƯỚI HEX, ĐẶT TỰ DO:**

- **Công trình đặt tự do** ở mọi vị trí pixel; giữ **Shift** (hoặc nút trên mobile) để snap lưới 8 px; tự "hút" mép vào công trình bên cạnh (magnet). **Tường vẽ bằng cách kéo đường** theo mọi góc. Không xoay sprite.
- **Lính & colonist di chuyển tự do kiểu RTS**: đi tới bất kỳ điểm nào, đường mượt, né nhau (steering), đội hình. Bỏ 1-lính/ô và ZOC theo ô → thay bằng **va chạm + vùng giao chiến theo bán kính**.
- **Địa hình**: tilemap vuông **16 px** với chuyển tiếp mượt (**dual-grid autotile**) nên không thấy ô; cây/đá/xương/nấm là **vật thể đặt tự do** (Poisson disk), y-sort theo chiều sâu.
- Bên dưới vẫn có **lưới điều hướng ẩn 8 px** cho pathfinding/va chạm — người chơi không thấy.
- Mọi cơ chế Civ phụ thuộc hex được chuyển sang dạng **bán kính/khoảng cách** (xem 3.1, 3.7).
- Phần code Phase 0 đã làm theo hex sẽ được chuyển đổi — xem **mục 10**.

---

## 1. Game Concept (Pillars)

**Elevator pitch:** Bạn dẫn một nhóm người sống sót tới một thung lũng bị nguyền. Ban ngày khai thác, xây dựng, nghiên cứu; ban đêm _Màn Sương (The Veil)_ trồi lên, quái vật tấn công và tâm trí colonist bị bào mòn. Càng dùng sức mạnh hắc ám để sống sót, colony càng mạnh — và càng mục ruỗng.

**4 trụ cột thiết kế:**

1. **Ngày/Đêm là nhịp chính** – ngày = kinh tế, đêm = sinh tồn.
2. **Sanity & Corruption** – mọi quyết định mạnh đều có cái giá tinh thần.
3. **Colonist có câu chuyện** – trait, mối quan hệ, chấn thương, cái chết có ý nghĩa.
4. **Ánh sáng là tài nguyên** – vùng sáng an toàn, bóng tối nguy hiểm (cơ chế + thẩm mỹ cùng lúc).

**Win/Lose:**

- Thua: toàn bộ colonist chết / phát điên, hoặc Corruption = 100% (colony biến thành tổ quái).
- Thắng (mode chiến dịch): sống sót qua N mùa và hoàn thành nghi lễ _Phong Ấn Màn Sương_; hoặc kết thúc thay thế "Trở thành Bóng Tối" nếu Corruption cao.
- Endless mode: sống càng lâu càng tốt, có leaderboard.

---

## 2. Tech Stack & Kiến trúc

| Hạng mục            | Lựa chọn                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ngôn ngữ            | TypeScript strict                                                                                                                                                            |
| Engine              | Phaser (bản stable mới nhất; dùng Phaser 4 nếu đã ổn định, không thì 3.90)                                                                                                   |
| Build               | Vite                                                                                                                                                                         |
| ECS / logic         | **bitECS** (tách simulation khỏi render, xử lý hàng trăm entity)                                                                                                             |
| Toạ độ              | **Pixel thế giới liên tục (float)**; terrain grid 16 px; nav grid ẩn 8 px                                                                                                    |
| Pathfinding         | A* 8 hướng trên nav grid + **làm mượt đường (string pulling)** + **steering** (separation/arrival) cho chuyển động tự do; flow field cho bầy quái; chạy trong **Web Worker** |
| Truy vấn không gian | **Spatial hash** (tìm đơn vị/vật thể lân cận, kiểm tra chồng lấn khi đặt công trình)                                                                                         |
| UI                  | Phaser cho HUD trong game + **Preact/HTML overlay** cho menu phức tạp (bảng colonist, research tree)                                                                         |
| State/Save          | Serializable world state → **IndexedDB** (idb-keyval) + export/import file JSON nén (lz-string)                                                                              |
| Map                 | **Tiled** (map handcrafted) + procedural generation (simplex-noise)                                                                                                          |
| Audio               | Phaser Sound (WebAudio) + **Howler.js** nếu cần layering nhạc                                                                                                                |
| Test                | Vitest cho logic simulation (thuần TS, không phụ thuộc Phaser)                                                                                                               |
| Đóng gói            | Web (itch.io / Vercel / Cloudflare Pages), **PWA** (offline), **Tauri** (Win/Mac/Linux → Steam), **Capacitor** (Android/iOS)                                                 |
| CI                  | GitHub Actions: lint + test + build web, release Tauri                                                                                                                       |

**Nguyên tắc kiến trúc:**

- **Simulation tách khỏi render**: `sim/` chạy tick cố định (vd. 10 tick/s), deterministic, không import Phaser → test được, save/load dễ, sau này có thể chạy trong worker.
- **Data-driven**: building, item, colonist trait, monster, event, research đều là file JSON/TS trong `data/` → thêm nội dung không cần sửa code.
- **Event bus** giữa sim ↔ render ↔ UI.

**Cấu trúc thư mục đề xuất:**

```
ashen-hollow/
  src/
    main.ts                # Phaser config, scale mode FIT + pixel-art
    scenes/                # Boot, Preload, MainMenu, World, UIOverlay, GameOver
    sim/                   # ECS world, systems (job, needs, sanity, combat, weather...)
      components/
      systems/
      ai/                  # utility AI, pathfinding worker
    render/                # sprite sync, lighting, fog, particles
    ui/                    # Preact overlay components
    data/                  # buildings.json, items.json, traits.json, monsters.json, events.json, research.json
    audio/                 # music state machine, sfx bank
    save/                  # serialize, migrate versions
    platform/              # input abstraction (mouse/touch/gamepad), storage, tauri/capacitor adapters
  public/assets/           # sprites, tilesets, audio (đã qua pipeline)
  tools/                   # script pack atlas, convert aseprite, generate data types
  tests/
```

**Đa nền tảng – lưu ý sớm:**

- Độ phân giải gốc **480×270** (hoặc 640×360), scale số nguyên (`pixelArt: true`, `roundPixels: true`) → nét trên mọi màn hình.
- Input abstraction từ đầu: chuột/bàn phím, **touch** (pinch zoom, long-press = chuột phải, radial menu), gamepad (sau).
- UI phải có layout cho màn dọc/ngang nhỏ; button tối thiểu 44px trên mobile.
- Ngân sách hiệu năng: 60 FPS trên laptop tầm trung, 30 FPS trên điện thoại tầm trung với ~50 colonist + 200 quái.

---

## 3. Cơ chế game chi tiết

### 3.1 Bản đồ & Thế giới

- **Thế giới liên tục**: toạ độ pixel float, map **2048×2048 px**. Ba lớp dữ liệu:
  1. **Terrain grid 16 px** (128×128 ô): loại mặt đất (cỏ chết, đầm, đồi, vách đá chặn, nước đen, đất nguyền, nền rừng). Mỗi loại có `speed` (hệ số tốc độ đi), `defenseBonus`, `blocksSight`, `passable`. Hiển thị bằng dual-grid autotile → chuyển tiếp mượt, không thấy ô.
  2. **Vật thể tự do (doodad/resource node)**: cây chết, tảng đá, đống xương, nấm phát quang… vị trí float, collider hình tròn, có thể khai thác. Rải bằng **Poisson disk** theo biome (rừng dày, đồi nhiều đá).
  3. **Nav grid ẩn 8 px**: ô đi được/không, chi phí; cập nhật khi đặt/phá công trình, chặt cây.
- **Lãnh thổ kiểu Civ → vùng ảnh hưởng theo bán kính**: Hearthfire và một số công trình phát ra bán kính ảnh hưởng (hợp các hình tròn), vẽ thành đường biên mềm; chỉ xây trong vùng; vùng nở rộng theo Culture/Faith.
- **Adjacency bonus → bonus lân cận theo khoảng cách**: tính trong bán kính R (vd. Xưởng mộc +10% mỗi cây trong 96 px, tối đa +50%; Nhà nguyện gần nghĩa trang +Faith; Bàn thờ Máu gần Rift +Soul Ash). UI hiện vòng bán kính + số bonus khi đang đặt.
- **Biome**: Rừng Chết, Đầm Lầy Thối, Đồi Xương, Tàn Tích Cổ, Vết Nứt Hư Không (nguồn quái).
- Tile layers: địa hình, tài nguyên (cây, đá, quặng, nấm phát quang), công trình, sàn, sương/fog-of-war.
- Procedural: noise cho địa hình + đặt tài nguyên theo biome; đặt "Rift" (cổng quái) ở rìa map; vài POI (đền đổ nát, xác lính, rương).
- **Fog of war**: chưa khám phá / đã thấy / đang thấy.

### 3.2 Chu kỳ Ngày/Đêm & Mùa

- 1 ngày ≈ 8–10 phút thực (tuỳ chỉnh). Bình minh → Ngày → Hoàng hôn → **Đêm (The Veil)**.
- Ánh sáng toàn cục giảm dần; đêm chỉ thấy vùng có nguồn sáng.
- **Mùa**: Thu Mục → Đông Tro → Xuân Máu → Hạ Khô; mỗi mùa thay đổi sản lượng nông nghiệp, nhiệt độ, loại quái.
- **Blood Moon** định kỳ: đợt tấn công lớn + boss.

### 3.3 Colonist (trái tim của game)

- **Thuộc tính**: HP (theo bộ phận cơ thể đơn giản: đầu/thân/tay/chân), Sanity 0–100, Hunger, Rest, Warmth, Mood.
- **Kỹ năng** (0–20, tăng theo kinh nghiệm): Lao động, Xây dựng, Khai thác, Trồng trọt, Nấu ăn, Chế tác, Y học, Chiến đấu cận chiến, Bắn cung, Nghi thức (Occult).
- **Trait** (2–3/người): Can đảm, Hèn nhát, Sùng đạo, Hoài nghi, Ăn thịt người, Mất ngủ, Bị ám, Lãnh đạo bẩm sinh…
- **Mối quan hệ**: bạn bè, kẻ thù, người yêu, gia đình → ảnh hưởng mood khi người kia chết/bị thương.
- **Ký ức/Chấn thương**: sự kiện để lại _Scar_ (vd. "Thấy bạn bị xé xác": −10 Sanity lâu dài).
- **AI**: Utility AI chấm điểm nhu cầu (đói, ngủ, an toàn) vs công việc; người chơi đặt **ưu tiên công việc** (bảng ma trận như RimWorld) và có thể **draft** để điều khiển trực tiếp khi chiến đấu.

### 3.4 Sanity & Corruption (cơ chế đặc trưng)

- **Sanity cá nhân** giảm khi: ở trong bóng tối, thấy quái/xác, đói, làm nghi thức hắc ám, đồng đội chết. Tăng khi: ngủ đủ, ăn ngon, ở gần lửa, nhà thờ, giải trí, lễ hội.
- Ngưỡng Sanity:
  - 70–100: bình thường.
  - 40–70: _Bất an_ – giảm hiệu suất, ảo giác nhẹ (hiệu ứng hình ảnh).
  - 15–40: _Rạn vỡ_ – có thể bỏ việc, la hét làm người khác mất sanity, ăn đồ sống.
  - 0–15: **Mental break** – bỏ chạy vào bóng tối, tấn công đồng đội, tự hại, hoặc **Possessed** (biến thành quái).
- **Corruption colony** (0–100%): tăng khi dùng công trình/nghi thức hắc ám, xác chết không chôn, Rift gần căn cứ. Corruption cao → buff sức mạnh (vũ khí nguyền, quái thuần phục) nhưng: đất mục, colonist sinh đột biến, event tà ác, quái mạnh hơn.
- Đây là **trục lựa chọn đạo đức** chính: "Ánh Sáng" (an toàn, chậm) vs "Bóng Tối" (mạnh, rủi ro).

### 3.5 Tài nguyên & Kinh tế

| Tầng        | Tài nguyên                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------- |
| Thô         | Gỗ, Đá, Quặng sắt, Than, Nấm, Thịt, Thảo dược, Xương                                        |
| Chế biến    | Ván, Gạch, Thỏi sắt, Bữa ăn, Thuốc, Vải, Dầu đèn                                            |
| Hiếm/Hắc ám | **Tro Linh Hồn (Soul Ash)** (rơi từ quái), Bạc thánh, Máu cổ, Mảnh Hư Không                 |
| Đặc biệt    | **Ánh sáng** (dầu/than đốt trong đèn), **Niềm tin (Faith)** – điểm dùng cho luật lệ/nghi lễ |

- Kho chứa: stockpile zone với bộ lọc; colonist tự vận chuyển (hauling job).
- Đồ ăn hư theo thời gian; tủ lạnh = hầm băng/đông.

### 3.6 Xây dựng

- Đặt blueprint → colonist mang vật liệu → xây theo kỹ năng.
- Nhóm công trình:
  - **Cơ bản**: Lều, Nhà gỗ, Giường, Lửa trại, Kho, Tường gỗ/đá, Cửa.
  - **Sản xuất**: Xưởng mộc, Lò rèn, Bếp, Ruộng nấm, Chuồng, Phòng thuốc.
  - **Ánh sáng**: Đuốc, Đèn dầu, Lò lửa lớn, **Ngọn Hải Đăng Thánh** (vùng sáng lớn, giảm sanity loss).
  - **Phòng thủ**: Hàng rào gai, Tháp cung, Bẫy, Ballista, Tường đá, Cổng thánh.
  - **Tinh thần**: Nhà nguyện, Nghĩa trang (chôn xác giảm corruption), Quán rượu.
  - **Hắc ám**: Bàn thờ Máu, Lồng Linh Hồn, Tháp Xương (tower dùng soul ash), Cổng Triệu Hồi.
- **Đặt tự do**: công trình có **footprint** (hình chữ nhật hoặc tròn, kích thước pixel trong data). Bóng mờ (ghost) đi theo con trỏ: xanh = hợp lệ, đỏ = chồng lấn công trình/cây/địa hình chặn hoặc ngoài lãnh thổ.
  - **Shift / nút "Snap"**: snap lưới 8 px. **Magnet**: mép cách công trình khác < 6 px thì tự hút sát → dãy nhà thẳng hàng dễ dàng.
  - Mobile: chạm để đặt ghost → kéo chỉnh → nút ✓/✕ xác nhận (không đặt nhầm).
- **Tường & hàng rào vẽ bằng kéo**: kéo từ A tới B (nhiều đoạn, mọi góc) → sinh chuỗi **cọc/khối nhỏ 8 px** đặt dọc đường, nên tường chéo vẫn là pixel art sạch mà không cần xoay sprite. Cổng chèn vào đoạn tường. Nav grid rasterize đoạn tường với độ dày.
- **Phòng** = vùng kín bởi tường/công trình, phát hiện bằng flood-fill trên nav grid → nhiệt độ, ánh sáng, chất lượng phòng ngủ.
- Công trình có **cấp độ** (nâng cấp mở bằng tech) và **slot chuyên gia** (gán colonist làm việc tại đó, kiểu citizen của Civ).
- Phá cây/đá để lấy chỗ: đặt blueprint đè lên cây → tự sinh job chặt trước khi xây.

### 3.7 Quân đội & Chiến đấu (real-time, di chuyển tự do kiểu RTS)

**Di chuyển tự do:**

- Đơn vị có vị trí float + **collider tròn** (người r=4 px, quái lớn r=10–16 px). Đi tới bất kỳ điểm nào.
- Pipeline: A* 8 hướng trên nav grid 8 px → **làm mượt đường** (string pulling bằng raycast trên grid) → bám theo waypoint với **steering**: arrival (giảm tốc khi tới), separation (đẩy nhẹ khỏi đồng đội), tránh vật cản tĩnh. Kẹt > 1,5 s → tính lại đường.
- **Tốc độ theo địa hình** dưới chân: cỏ ×1.0, nền rừng/đồi ×0.7, đầm ×0.45, đường lát ×1.3; nước đen/vách đá không đi được.
- **Di chuyển nhóm theo đội hình**: chọn nhiều lính và ra lệnh → xếp hàng ngang/khối/rải theo hướng kéo (kéo chuột phải để vẽ hướng và độ rộng đội hình như Total War/AoE).
- **Thay 1UPT** bằng va chạm cứng giữa lính (không đi xuyên nhau) → chặn hẻm, bịt cổng là chiến thuật thật.
- **Thay ZOC theo ô** bằng **vùng giao chiến (engagement radius)**: vào trong bán kính cận chiến của địch (≈ 24 px) → tốc độ ×0.3 và bị "khoá giao chiến", rút ra mất 1 giây; Wraith/kỵ bỏ qua.

**Điều khiển (RTS-lite):**

- Chọn: click, kéo khung, double-click chọn cùng loại, phím nhóm `Ctrl+1..9`; mobile: chạm, nút "chọn tất cả lính", kéo khung bằng 2 ngón hoặc nút chế độ chọn.
- Lệnh: Di chuyển, Tấn công-di chuyển, Giữ vị trí (Fortify +def theo thời gian đứng yên), Tuần tra giữa các điểm, Rút lui, Dựng phòng tuyến theo đường kéo.
- **Xem trước đường đi** (đường mượt + số giây tới đích + vùng giao chiến địch tô đỏ).
- Hàng đợi lệnh (Shift+click). Active pause để ra lệnh trên mobile.

**Chiến đấu:**

- **Combat Strength (CS)** kiểu Civ 6: sát thương = f(chênh lệch CS) có ngẫu nhiên nhỏ; HP 100 mỗi đơn vị. Tấn công theo **nhịp đòn** (cooldown).
- **Bonus địa hình**: đứng trên đồi/nền rừng +3 def; tấn công từ đầm −3; công sự/tường thấp +def.
- **Flanking & Support theo khoảng cách/góc**: +2 CS mỗi đồng minh đang đánh cùng mục tiêu trong bán kính 32 px (flank), +3 nếu đánh từ cung sau 120° của mục tiêu; +1 support mỗi đồng minh trong 24 px quanh bản thân (tối đa +3).
- **Tầm xa theo pixel** (Hunter 96 px, Longbow 144 px, Ballista 192 px) + **line of sight**: raycast trên lưới chặn tầm nhìn (cây, vách đá, công trình cao); đứng trên đồi bỏ qua vật cản thấp.
- **Ánh sáng là chiến thuật**: quái mất CS trong vùng sáng; Shade bất tử trong bóng tối.
- Thương tích theo bộ phận vẫn áp cho colonist (gãy chân = chậm).

**Lớp đơn vị (mở khoá bằng tech):**

| Lớp                  | Ví dụ                                                                        | Đặc điểm                                          |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| Dân quân             | Militia (colonist cầm vũ khí)                                                | Rẻ, rút từ lao động                               |
| Cận chiến            | Man-at-arms → Inquisitor Knight                                              | Giữ tuyến                                         |
| Chống kỵ/quái lớn    | Pikeman → Silver Halberd                                                     | Bonus vs Brute/boss                               |
| Tầm xa               | Hunter → Longbow → Crossbow                                                  | Tầm 96–144 px                                     |
| Công thành/Phòng thủ | Ballista, Flame Cart                                                         | Tầm 192 px, phải dựng (setup)                     |
| Hỗ trợ               | Chaplain (hồi sanity vùng), Lantern Bearer (nguồn sáng di động), Field Medic | Không chiến đấu                                   |
| Hắc ám (Occult)      | Ghoul thuần phục, Bone Golem, Blood Witch                                    | Mạnh, +Corruption                                 |
| Anh hùng             | 1–3 Hero có kỹ năng chủ động                                                 | Kiểu Great General: aura +CS trong bán kính 64 px |

- **Promotion tree** kiểu Civ 6: lính lên cấp bằng XP, chọn 1 trong 2 nhánh thăng cấp (vd. "Tuyến thép: +def khi Fortify" vs "Truy kích: +move sau khi giết").
- Lính là **colonist được huấn luyện** tại Doanh trại (giữ tên, trait, sanity, quan hệ) → lính chết là mất người thật — giữ chất kể chuyện RimWorld.
- **Bảo trì**: lính tiêu thức ăn + vàng/vật liệu mỗi ngày.

**Quái & đợt tấn công:**

- **Wave system**: mỗi đêm sinh quái từ Rift theo ngân sách độ khó (ngày + giàu có + corruption).
- Quái di chuyển tự do theo **flow field** trên nav grid tới mục tiêu (nguồn sáng/colonist/công trình) + separation để tràn như bầy; phá tường nếu bị chặn; bị vùng giao chiến của lính ta làm chậm.
- Ví dụ: Ghoul (đông, yếu), Hollow Wraith (bay qua tường, bỏ qua vùng giao chiến, hút sanity), Bone Brute (phá tường), Shade, Plague Rat swarm (hàng chục con nhỏ), Possessed Colonist, **Boss** collider lớn (r≈24 px): The Weeping Matron, Antler King, Veil Leviathan.
- **Tổ quái (Lair)** trên bản đồ như trại man rợ Civ: phá tổ để giảm đợt tấn công và nhận Eureka.

### 3.8 Cây công nghệ kiểu Civilization VI

**Hai cây song song:**

| Cây                            | Điểm dùng           | Nguồn điểm                                     | Mở khoá                                                    |
| ------------------------------ | ------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| **Lore (Tech)** ≈ Technology   | **Knowledge** 📜    | Bàn nghiên cứu, thư viện, học giả, tài liệu cổ | Công trình, đơn vị, nâng cấp, cải tạo địa hình             |
| **Doctrine (Civics)** ≈ Civics | **Faith/Culture** 🕯 | Nhà nguyện, lễ hội, nghĩa trang, nghi lễ       | Policy Card, chế độ cai trị, lễ nghi, công trình tinh thần |

**Kỷ nguyên (Eras)** – cây chia cột theo thời đại; vào kỷ mới thì quái cũng mạnh hơn:

1. **Kỷ Tro Tàn** (sinh tồn: rìu đá, lửa trại, săn bắn)
2. **Kỷ Sắt Gỉ** (luyện kim, tường đá, cung dài)
3. **Kỷ Thánh Quang / Kỷ Hắc Ấn** (rẽ nhánh theo lựa chọn Ánh sáng/Bóng tối)
4. **Kỷ Hư Không** (nghi lễ cuối, phong ấn/hợp nhất Màn Sương)

**Cơ chế cốt lõi copy từ Civ 6:**

- **Đồ thị prerequisite**: mỗi node cần 1–3 node trước (không phải nhánh thẳng), hiển thị đường nối.
- **Một node đang nghiên cứu** + hàng đợi (click node xa → tự xếp đường đi ngắn nhất qua các prerequisite).
- **Eureka (Lore) / Inspiration (Doctrine)**: mỗi node có 1 thử thách trong game; hoàn thành → **giảm 40–50% chi phí**. Ví dụ:
  - _Luyện Sắt_: "Khai thác 2 mỏ quặng" → Eureka.
  - _Cung Dài_: "Giết 5 quái bằng Hunter".
  - _Đèn Thánh_: "Sống sót 1 đêm mà không ai rơi xuống dưới 40 Sanity".
  - _Thuần Phục_: "Bắt sống 1 Ghoul" (Occult).
  - _Y Thuật_: "Chữa khỏi 3 vết thương nặng".
    Eureka biến hành động hằng ngày thành mục tiêu nhỏ → rất hợp colony sim.
- **Boost từ khám phá**: tài liệu cổ trong tàn tích / tổ quái cho Eureka ngẫu nhiên.
- **Chi phí tăng theo kỷ**, và (tuỳ chọn) tăng nhẹ theo số ô lãnh thổ để chống bành trướng quá nhanh.
- **Nhánh loại trừ ở Kỷ 3**: chọn Thánh Quang thì node Hắc Ấn bị khoá cao giá hơn (hoặc ngược lại) → hai lối chơi rõ rệt; có node "Dị Giáo" lai hai bên cho người chơi liều.
- **Ẩn danh xa (fog of tech)**: chỉ thấy tên node 1–2 bước kế tiếp, xa hơn hiện "???" → giữ bí ẩn dark fantasy.

**Quy mô gợi ý**: Lore ~45 node, Doctrine ~30 node, mỗi kỷ ~10–15 node.

**UI cây công nghệ:** màn hình riêng cuộn ngang theo kỷ (giống Civ 6), node pixel 48×48 có icon + thanh tiến độ + biểu tượng Eureka (sáng lên khi đạt), tooltip liệt kê mọi thứ mở khoá; mobile: pinch zoom + chạm giữ để xem chi tiết. Data-driven: `data/tech_lore.json`, `data/tech_doctrine.json` (id, era, cost, prereqs[], eureka{type, target, count}, unlocks[]).

### 3.9 Chế độ cai trị & Policy Card (thay Edicts, kiểu Civ 6 + Frostpunk)

- **Chế độ cai trị (Government)** mở trong Doctrine: _Hội Đồng Người Sống Sót_ → _Thần Quyền_ (Ánh sáng) / _Giáo Phái Màn Sương_ (Bóng tối) / _Quân Quản_. Mỗi chế độ có bonus riêng + số slot thẻ khác nhau.
- **4 loại slot**: ⚔ Quân sự, ⚒ Kinh tế, 🕯 Tín ngưỡng, 🩸 Hắc ám (chỉ có ở chế độ Bóng tối) + slot Wildcard.
- **Policy Card** mở từ Doctrine, thay đổi được khi hoàn thành một node Doctrine (hoặc trả Faith để đổi sớm). Thẻ giữ tinh thần "có lợi có hại" của Frostpunk:
  - ⚒ _Ca Làm Đêm_: +25% sản lượng, −Rest.
  - ⚒ _Ăn Thịt Người Chết_: giải đói, −Sanity toàn colony, +Corruption.
  - ⚔ _Lệnh Tổng Động Viên_: huấn luyện lính nhanh 50%, −Mood.
  - ⚔ _Bức Tường Đức Tin_: +3 CS khi đứng trong lãnh thổ.
  - 🕯 _Chôn Cất Thánh_ vs _Thiêu Xác_ (loại trừ nhau).
  - 🕯 _Tòa Án Dị Giáo_: tự xử người bị ám, −Mood.
  - 🩸 _Hiến Tế Trăng Máu_: Blood Moon cho gấp đôi Soul Ash.
- Thẻ "Hắc ám" tăng Corruption theo thời gian khi đang gắn.

### 3.10 Sự kiện & Storyteller

- **Storyteller AI** điều phối nhịp: căng thẳng tăng dần, có quãng nghỉ (như RimWorld). 3 mức: _Người Kể Chuyện Tử Tế / Cân Bằng / Ác Mộng_.
- Event mẫu: người lạ xin gia nhập (có thể là quái đội lốt), thương nhân bí ẩn, dịch bệnh, giấc mơ tiên tri, bão tro, cây cổ thụ biết nói, colonist nghe tiếng thì thầm.
- Event có **lựa chọn** (popup văn bản + minh hoạ pixel) → hậu quả dài hạn.

### 3.11 Khám phá (Expeditions)

- Gửi đội ra khỏi map (màn hình bản đồ vùng) tới POI → kết quả theo xác suất + kỹ năng, mang về tài liệu, người sống sót, hiện vật.

### 3.12 Meta-progression (tuỳ chọn, phase sau)

- Sau mỗi run mở khoá: khởi đầu khác (Giáo đoàn, Băng cướp, Nhóm Phù thủy), trait mới, biome mới.

### 3.13 UI/UX

- HUD: tài nguyên trên cùng, thanh thời gian/ngày/mùa, chỉ số Corruption, nút tốc độ (pause/1x/2x/3x).
- Panel dưới: menu xây dựng theo tab; panel colonist (portrait, needs, skills, traits, sanity).
- Bảng Work Priorities, **Tech Tree (Lore) + Doctrine Tree**, **Government & Policy Cards**, bảng quân đội (danh sách đơn vị, promotion), Log sự kiện.
- Thông báo kiểu Civ 6 góc phải: "Eureka đạt được!", "Chọn nghiên cứu mới", "Đơn vị chờ lệnh", "Có thể đổi Policy".
- **Pause & ra lệnh** (active pause) – bắt buộc cho mobile.
- Tooltip giải thích mọi con số (người chơi colony sim rất cần).
- Accessibility: chỉnh cỡ chữ UI, chế độ mù màu cho chỉ số, tắt hiệu ứng rung/ảo giác.

---

## 4. Asset hình ảnh (Pixel Art)

### Quy chuẩn

- **Terrain tile 16×16**, vẽ theo **dual-grid**: mỗi loại địa hình chỉ cần **16 tile mặt nạ góc** (+2–3 biến thể nền) thay vì 47 ô autotile; các lớp địa hình chồng theo độ ưu tiên (nước < đầm < cỏ < nền rừng < đồi < đất nguyền < vách đá).
- **Vật thể tự do** (cây, đá, xương, nấm) vẽ thành sprite riêng, **gốc (origin) ở chân** để y-sort đúng; bóng đổ 1–2 px hình elip bên dưới.
- Nhân vật **16×24**, công trình theo footprint (lều 24×20, nhà 32×28, tháp 16×40…), mọi sprite **không xoay** — hướng thể hiện bằng frame 4/8 hướng.
- Tường/hàng rào: bộ **cọc/khối 8×12 px** (vài biến thể) rải dọc đường kéo → tường mọi góc vẫn sạch pixel.
- **Palette giới hạn 32–48 màu** (gợi ý xuất phát: _Resurrect 64_ rút gọn hoặc _Endesga 32_ + tông xám-tím-xanh rêu, điểm nhấn: cam lửa, đỏ máu, xanh lục ma). Ánh sáng ấm (lửa) vs bóng tối lạnh (tím/xanh) là ngôn ngữ thị giác chính.
- Công cụ: **Aseprite** (vẽ + animation + xuất JSON atlas), **Tiled** (map), **TexturePacker** hoặc `free-tex-packer` (atlas).
- Pipeline: `.aseprite` → script xuất spritesheet + JSON → `public/assets/atlases/`.

### Danh sách asset (theo phase, MVP trước)

**Tileset**

- Địa hình theo biome (cỏ chết, bùn/đầm, đồi, vách đá, nước đen, tuyết tro, đất nguyền, nền rừng) – mỗi loại 16 tile mặt nạ dual-grid + 2–3 biến thể nền; đường mòn/đường lát là một lớp địa hình riêng.
- **Overlay chiến thuật**: viền lãnh thổ mềm, vòng chọn dưới chân đơn vị, ghost công trình xanh/đỏ, vòng bán kính bonus, đường đi xem trước, vùng giao chiến địch (đỏ), tầm bắn, vùng sáng.
- Tài nguyên: 3–4 loại cây chết, đá, quặng, nấm phát quang, bụi gai, xương.
- Sàn & tường (gỗ, đá, xương) có autotile.

**Nhân vật (mỗi loại: idle, walk 4 hướng hoặc 2 hướng + flip, work, attack, hurt, die)**

- Colonist base body + **layer**: tóc, quần áo, vũ khí, giáp (paper-doll → đa dạng không cần vẽ nhiều).
- Portrait 32×32 cho UI (cũng ghép layer).
- Quái: 6–8 loại + 3 boss (boss sprite 48×48 hoặc 64×64, collider lớn).
- **Lính**: 10–14 loại đơn vị (bảng 3.7), mỗi loại có huy hiệu lớp đơn vị (icon 8×8 trên đầu, giống Civ 6) + thanh HP; biến thể màu theo cấp promotion.
- **Icon cây công nghệ**: ~75 icon 48×48 (Lore + Doctrine), ~25 Policy Card minh hoạ 64×96, 4 banner kỷ nguyên.

**Công trình**: ~40–60 sprite (trạng thái: blueprint, đang xây, hoàn thành, hư hỏng, cháy).

**Item icon**: 16×16, ~60–80 icon.

**VFX**: lửa, khói, máu, tro bay, hạt linh hồn, sương mù, phép thuật, sét, mưa tro, vết nứt Rift. Dùng Phaser particles + sprite anim.

**Lighting**: lightmap render-texture (vẽ gradient tròn tại nguồn sáng, multiply lên scene) + flicker lửa; đêm có vignette và noise shader. Ảo giác sanity: shader méo, chromatic aberration nhẹ.

**UI**: khung 9-slice gothic (gỗ đen + viền sắt), nút, icon chỉ số, font pixel (vd. _m5x7_, _Alagard_ cho tiêu đề – kiểm tra license; cần font hỗ trợ **tiếng Việt** nếu bản địa hoá → cân nhắc _Pixel Operator_ hoặc tự vẽ dấu).

**Key art / menu**: 1 cảnh minh hoạ pixel lớn (480×270) có parallax + animation lửa.

### Nguồn asset

- **Prototype**: pack miễn phí/rẻ trên itch.io (từ khoá "dark fantasy tileset 16x16", "pixel colony"), Kenney (placeholder), OpenGameArt — ghi chép license (CC0/CC-BY) vào `CREDITS.md`.
- **Bản chính**: tự vẽ trên Aseprite hoặc commission. AI chỉ dùng để phác concept/moodboard, không dùng trực tiếp làm sprite cuối (khó giữ nhất quán palette và grid; nhiều store yêu cầu khai báo AI).

---

## 5. Âm thanh

### Nhạc (dynamic music)

- **Music state machine**: Menu → Ngày (yên, ambient đàn dây trầm, lute, choir xa) → Hoàng hôn (căng dần) → Đêm (drone, percussion) → Combat (layer trống + dây gắt chồng lên) → Blood Moon/Boss (theme riêng) → Sau trận (nốt buồn).
- Kỹ thuật: **vertical layering** (cùng tempo/key, fade layer theo cường độ) + crossfade giữa state.
- Số track MVP: 5–6; bản đầy đủ: 12–15.
- Nguồn: tự làm (LMMS, Reaper, BeepBox/FamiStudio nếu muốn chiptune; hoặc dark ambient lo-fi hợp pixel), hoặc pack trên itch.io/OpenGameArt, hoặc commission.

### SFX (danh mục)

- **UI**: click, hover, mở/đóng panel, đặt blueprint, lỗi, thông báo event, lên cấp, **hoàn thành nghiên cứu, Eureka (stinger ngắn đặc trưng), sang kỷ nguyên mới (fanfare tối), gắn Policy Card**.
- **Lệnh quân**: "acknowledge" khi chọn/ra lệnh (giọng gibberish theo loại lính), tiếng giáp bước, kèn tập hợp.
- **Công việc**: chặt cây, đập đá, búa xây, cưa, rèn, nấu, cuốc đất, nhặt đồ.
- **Môi trường (ambience loop)**: gió, quạ, côn trùng đêm, mưa tro, lửa lách tách, nước đầm, thì thầm Màn Sương (to dần khi sanity thấp).
- **Chiến đấu**: chém, đâm, bắn cung, trúng đòn, giáp đỡ, chết, tường vỡ, bẫy sập.
- **Quái**: gầm, rít, tiếng bước, mỗi loại 2–3 biến thể; boss có tiếng riêng.
- **Colonist**: "vocal" dạng gibberish ngắn (như Animal Crossing/Darkest Dungeon lite) cho la hét, đau, mental break.
- **Sanity**: tiếng tim đập, ù tai, thì thầm theo ngưỡng.
- Nguồn: sfxr/**jsfxr**/ChipTone cho SFX retro, Freesound (CC0), thu âm Foley tự làm, pack Sonniss GDC (miễn phí).
- Kỹ thuật: random pitch ±5–10% & chọn ngẫu nhiên biến thể để tránh lặp; positional audio (âm lượng/pan theo khoảng cách camera); giới hạn số voice đồng thời.
- Định dạng: **.ogg + .m4a** fallback (Safari/iOS), mono cho SFX, nén nhỏ; unlock AudioContext ở lần chạm đầu (mobile).

---

## 6. Lộ trình theo Phase

Mỗi phase có **Mục tiêu → Đầu việc → Tiêu chí hoàn thành (DoD)**. Không deadline, nhưng ước lượng công sức cho một người làm part-time để dễ tự đo.

### Phase 0 – Pre-production & Nền móng (~2–3 tuần)

- Viết GDD 1 trang + moodboard (Darkest Dungeon, Don't Starve, Blasphemous, RimWorld, They Are Billions).
- Chốt palette, kích thước tile, độ phân giải gốc.
- Khởi tạo repo: Vite + TS + Phaser + bitECS + Vitest + ESLint/Prettier + GitHub Actions + deploy preview (Vercel/Cloudflare Pages).
- Scene skeleton: Boot → Preload → MainMenu → World.
- Camera: pan (WASD/kéo), zoom (wheel/pinch) với scale số nguyên.
- ~~Hex core~~ (đã làm rồi bỏ ở v3) → **Phase 0b – chuyển sang thế giới tự do** (mục 10): terrain grid 16 px + dual-grid, doodad Poisson, nav grid 8 px, spatial hash, đặt công trình tự do có snap.
- **DoD**: mở URL thấy map liền mạch không thấy ô, cây/đá rải tự nhiên; đặt thử công trình ở bất kỳ đâu (Shift = snap), ghost đỏ khi chồng lấn; pan/zoom trên PC và điện thoại.

### Phase 1 – Prototype Core Loop (~4–6 tuần)

- Grid map + procedural generation cơ bản (1 biome).
- ECS: Position, Sprite, Colonist, Job, Inventory.
- Pathfinding A* 8 hướng trên nav grid + làm mượt đường, chạy trong Web Worker; di chuyển tự do bằng steering (arrival + separation).
- Lãnh thổ cơ bản quanh Hearthfire.
- Job system: chặt cây, đào đá, vận chuyển về kho, xây công trình từ blueprint.
- 3 colonist, 5 công trình (lửa trại, kho, tường, giường, đuốc), 3 tài nguyên.
- Nhu cầu: Hunger + Rest. Tốc độ game & pause.
- **DoD**: ra lệnh → colonist tự khai thác và xây; nếu không ăn ngủ thì chết. Unit test cho job & pathfinding.

### Phase 2 – Ngày/Đêm, Ánh sáng & Sinh tồn (~4–6 tuần)

- Chu kỳ ngày/đêm + lighting lightmap + nguồn sáng tiêu nhiên liệu.
- **Sanity** cơ bản (bóng tối, đói, ngủ, lửa trại).
- Quái đêm đơn giản (Ghoul) spawn từ Rift, flow field, tấn công.
- **Điều khiển lính kiểu RTS**: chọn/kéo khung, move, attack-move, fortify, đội hình khi kéo, xem trước đường đi; va chạm giữa lính; vùng giao chiến; Combat Strength + bonus địa hình/flank theo khoảng cách; 3 lớp đơn vị (Militia, Man-at-arms, Hunter) + tháp cung + tường kéo đường.
- **Tech tree tối thiểu**: ~10 node Lore Kỷ 1 có prerequisite + Eureka (để kiểm chứng cơ chế sớm).
- Save/Load IndexedDB (versioned).
- **DoD**: sống sót được 5 đêm là một thử thách thật; có thể thua. **→ Đây là vertical slice đầu tiên, cho bạn bè chơi thử.**

### Phase 3 – Chiều sâu Colonist (~6–8 tuần)

- Kỹ năng + kinh nghiệm, trait, mối quan hệ, mood, chấn thương/Scar.
- Work priority matrix UI, panel colonist với portrait ghép layer.
- Mental break các loại; y tế (băng bó, giường bệnh).
- Chế biến: bếp, xưởng, lò rèn; vũ khí & giáp.
- Room detection + chất lượng phòng.
- **DoD**: colonist cảm giác "khác nhau"; các câu chuyện tự phát sinh (log sự kiện đọc thấy thú vị).

### Phase 4 – Civ-style Progression, Corruption & Quân đội đầy đủ (~8–10 tuần)

- Tài nguyên Knowledge, Faith/Culture, Soul Ash; Corruption colony + hiệu ứng.
- **Lore tree (~45 node) + Doctrine tree (~30 node)**, 4 kỷ nguyên, Eureka/Inspiration cho mọi node, hàng đợi nghiên cứu, fog of tech, rẽ nhánh Thánh Quang/Hắc Ấn.
- **Government + Policy Card** (~25 thẻ, 4 loại slot).
- Adjacency bonus cho công trình; mở rộng lãnh thổ bằng culture.
- Đủ 10–14 lớp đơn vị, promotion tree, Hero/aura, ranged LOS, đơn vị setup (Ballista).
- Quái đa dạng (5–6 loại) + Lair trên bản đồ + Blood Moon + 1 boss.
- **DoD**: hai lối chơi Ánh sáng / Bóng tối khác nhau rõ rệt; người chơi có lý do để "săn Eureka"; trận đêm thắng nhờ dàn trận, bịt hẻm và đặt đèn chứ không chỉ nhờ số đông.

### Phase 5 – Storyteller, Event, Khám phá, Mùa (~6–8 tuần)

- Storyteller + 3 độ khó; 30–40 event có lựa chọn.
- Mùa & thời tiết (bão tro, đông, nhiệt độ).
- Expedition map; POI; nhiều biome (3+).
- Mục tiêu chiến dịch + ending (2–3 kết thúc).
- **DoD**: một run đầy đủ 2–4 giờ có mở đầu – cao trào – kết.

### Phase 6 – Art & Audio Pass (song song từ Phase 3, chốt ở đây)

- Thay toàn bộ placeholder bằng art chính; VFX, shader ảo giác.
- Dynamic music + SFX đầy đủ + ambience.
- Juice: screen shake, hit-stop, particle, tween UI.
- **DoD**: chụp màn hình bất kỳ cũng đủ đẹp làm trailer.

### Phase 7 – Đa nền tảng & Polish (~4–6 tuần)

- Touch UX hoàn chỉnh (radial menu, long-press, UI scale), gamepad.
- PWA (offline, cài lên màn hình chính).
- Tauri build (Win/Mac/Linux) + Steam (Steamworks qua plugin, achievement, cloud save – tuỳ chọn).
- Capacitor build Android/iOS.
- Tối ưu: object pooling, culling ngoài camera, chunked tilemap, giảm draw call (atlas), profiling trên máy yếu.
- Tutorial + tooltip; settings (âm lượng, keybind, ngôn ngữ **VI/EN** dùng i18n JSON).
- **DoD**: chạy mượt trên PC + 1 Android + 1 iPhone tầm trung; save hoạt động trên mọi nền tảng.

### Phase 8 – Release & Live (mở)

- Bản demo trên itch.io / Newgrounds, trang Steam "Coming soon", devlog.
- Thu feedback (form + analytics ẩn danh tuỳ chọn), cân bằng.
- Nội dung thêm: meta-progression, mod support (load data JSON từ thư mục), endless mode + leaderboard.

---

## 7. Cân bằng & Dữ liệu

- Mọi con số trong `data/*.json` + bảng Google Sheets → script export sang JSON.
- Debug overlay (phím `~`): spawn quái, set thời gian, xem utility score của colonist, xem flow field, tua nhanh.
- Seed cố định để tái hiện bug; ghi replay đơn giản (log input theo tick) nếu cần.

## 8. Rủi ro chính & Cách giảm

| Rủi ro                                           | Giảm thiểu                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Scope phình to (colony sim là thể loại khổng lồ) | Phase 2 phải chơi được; mỗi phase cắt nội dung trước khi cắt chất lượng                           |
| Hiệu năng pathfinding với nhiều entity           | Worker + flow field cho quái + cache path + tick AI theo lô                                       |
| Mobile UI quá chật                               | Thiết kế touch-first từ Phase 0, active pause                                                     |
| Save hỏng khi đổi version                        | Save có `version` + hàm migrate, test round-trip                                                  |
| Asset không nhất quán                            | Khoá palette + kích thước + style guide 1 trang từ Phase 0                                        |
| Mất động lực (hobby)                             | Devlog định kỳ, deploy preview mỗi tuần để thấy tiến độ                                           |
| Đơn vị tự do bị kẹt / dồn cục                    | Steering separation + timeout re-path + đồng đội nhường đường (push nhẹ); flow field cho bầy quái |
| Đặt tự do làm base lộn xộn, khó căn hàng         | Snap 8 px (Shift), magnet mép, ghost hiển thị khoảng cách                                         |
| Hiệu năng va chạm với nhiều entity               | Spatial hash, tick AI theo lô, nav grid cập nhật cục bộ khi đặt/phá công trình                    |
| Micro lính real-time quá tải trên mobile         | Active pause, lệnh nhóm, "dựng phòng tuyến" tự động, tốc độ game chậm                             |
| Cây tech quá to làm loãng                        | Bắt đầu 10 node ở Phase 2, chỉ mở rộng khi Eureka chứng minh vui                                  |
| Chuyển tiếp địa hình trông "ô vuông"             | Dual-grid với mặt nạ góc dither/hữu cơ + doodad che mép                                           |

---

## 9. Bước đầu tiên khi bắt đầu code (sau khi duyệt plan)

1. Tạo repo `ashen-hollow` (ngoài portfolio), scaffold Vite + TS + Phaser + bitECS + Vitest.
2. Viết `docs/GDD.md` (rút gọn từ plan này) + `docs/ART_STYLE.md` (palette, kích thước, quy tắc).
3. Làm Phase 0 → deploy preview → kiểm tra trên điện thoại.

## 10. Phase 0b — Chuyển code hiện tại sang thế giới tự do (việc cần làm ngay)

Repo: `D:\WorkSpace\ashen-hollow` (Phase 0 hex đã xong, chưa commit). **Commit trạng thái hex hiện tại trước** ("Phase 0: hex prototype") để có điểm quay lại, rồi làm trên đó.

### Giữ nguyên (tái sử dụng)

- `src/sim/random.ts` (`Rng`, `hashSeed`), `src/sim/noise.ts` (`fractalNoise2D`), `src/sim/SimClock.ts`, `src/core/events.ts` (`EventBus`), `src/data/palette.ts`, `src/ui/theme.ts`, `src/platform/CameraController.ts` (pan/zoom/pinch/tap — chỉ đổi callback), Boot/Preload/MainMenu scene, CI, ESLint boundary.
- `PixelCanvas` trong `src/render/pixel.ts` (bỏ phần mask hex).

### Xoá

- `src/hex/*` (hex.ts, offset.ts, layout.ts, index.ts, hex.test.ts), `src/sim/map/HexMap.ts`, `src/render/HexMapRenderer.ts`, phần mask hex trong `src/render/pixel.ts` + `pixel.test.ts`, component `HexPosition`.

### Thêm / viết lại (thuần TS, không Phaser, có test)

| File                                 | Nội dung                                                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sim/geom.ts`                    | `Vec2`, khoảng cách, AABB/circle overlap, segment helpers                                                                                                                                                                                         |
| `src/data/terrain.ts` (viết lại)     | Bỏ `moveCost` → `speed` (hệ số), `passable`, `defenseBonus`, `blocksSight`, `priority` (thứ tự lớp dual-grid); thêm `forestFloor`, bỏ `deadForest`/`mountain` → `cliff`                                                                           |
| `src/data/doodads.ts`                | deadTree, boulder, boneHeap, glowShroom: kích thước sprite, bán kính collider, chặn tầm nhìn, sản lượng khai thác                                                                                                                                 |
| `src/data/buildings.ts`              | Vài công trình thử: Hearthfire (footprint tròn r8), Tent (sprite 24×20, footprint 24×14), Storage (sprite 32×24, footprint 32×18), Watchtower (sprite 16×40, footprint 16×12). Footprint = phần chạm đất, nhỏ hơn sprite vì mái/tầng nhô lên trên |
| `src/sim/map/TerrainGrid.ts`         | Lưới 16 px (128×128) Uint8Array; `cellAt(x,y)`, `terrainAtWorld(x,y)`, `forEach`                                                                                                                                                                  |
| `src/sim/map/generate.ts` (viết lại) | Noise → terrain theo ô; vành đai vách đá quanh map; khoảng trống quanh điểm xuất phát (tâm map); **Poisson disk** rải doodad theo biome; trả `{ terrain, doodads, start }`                                                                        |
| `src/sim/map/poisson.ts`             | Poisson disk sampling có seed (Bridson)                                                                                                                                                                                                           |
| `src/sim/spatial/SpatialHash.ts`     | insert/remove/update/query theo vòng tròn & AABB                                                                                                                                                                                                  |
| `src/sim/nav/NavGrid.ts`             | Lưới 8 px: walkable + cost (từ `speed` địa hình); `blockCircle/blockRect` có đếm tham chiếu để gỡ khi phá/chặt                                                                                                                                    |
| `src/sim/nav/astar.ts` + `smooth.ts` | A* 8 hướng (octile, không cắt góc) + string pulling bằng raycast grid (Phase 1 dùng, Phase 0b chỉ cần có + test)                                                                                                                                  |
| `src/sim/placement.ts`               | `snapToGrid(p, 8)`, `magnetSnap(footprint, neighbors, 6)`, `validatePlacement(footprint, world)` → `{ ok, reason }` (chồng công trình/doodad, địa hình chặn, ngoài map)                                                                           |
| `src/sim/components.ts` (viết lại)   | `Position {x,y}` Float32, `Collider {radius}`, `Footprint`, `Doodad {kind}`, `Building {kind}`                                                                                                                                                    |
| `src/sim/GameWorld.ts`               | Tạo terrain + doodad entity + Hearthfire; `placeBuilding()` cập nhật ECS, spatial hash, nav grid                                                                                                                                                  |

### Render / Phaser

| File                                      | Nội dung                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/render/dualGrid.ts` (thuần, có test) | Với mỗi ô render (lệch nửa ô), tính mặt nạ 4 góc (0–15) cho từng loại địa hình có mặt, theo `priority`                                                                            |
| `src/render/terrainArt.ts` (viết lại)     | Sinh tile 16×16 placeholder: nền (2–3 biến thể dither) + 16 mặt nạ góc mép hữu cơ cho mỗi địa hình; sprite doodad (cây chết 16×24, đá, xương, nấm); sprite công trình placeholder |
| `src/render/atlas.ts`                     | Gom tất cả vào 1 texture như hiện tại                                                                                                                                             |
| `src/render/TerrainRenderer.ts`           | Phaser `Tilemap` trống (orthographic, 16 px), mỗi địa hình 1 layer theo `priority`, đặt tile index = mặt nạ dual-grid; layer nền                                                  |
| `src/render/EntityRenderer.ts`            | Sprite doodad/công trình, **y-sort** (`setDepth(y)`), bóng đổ                                                                                                                     |
| `src/render/PlacementPreview.ts`          | Ghost công trình theo con trỏ, tint xanh/đỏ, viền footprint                                                                                                                       |
| `src/render/DebugOverlay.ts`              | F3: vẽ nav grid (ô chặn đỏ mờ) & collider                                                                                                                                         |

### Scene & input

- `WorldScene`: dùng renderer mới; hover = toạ độ thế giới; chế độ **Xây (B)**: chọn Tent/Storage/Watchtower bằng nút trên thanh xây dựng HUD hoặc phím Z/X/C (1–3 vẫn là tốc độ game, WASD là camera), click đặt, Shift = snap 8 px, Esc/chuột phải = huỷ. Mobile: nút "Xây" → chạm đặt ghost → kéo → ✓/✕.
- `HudScene`: info dưới con trỏ (địa hình, hệ số tốc độ, vật thể nếu có, toạ độ px); thanh xây dựng đơn giản; lý do không hợp lệ khi đặt ("Chồng lên cây", "Địa hình không xây được").
- `CameraController`: không đổi logic; bounds theo 2048×2048.

### Docs

- `docs/GDD.md`, `docs/ART_STYLE.md` (bỏ phần hex, thêm dual-grid 16 px, doodad origin ở chân, y-sort, cọc tường 8×12), `docs/ROADMAP.md` (đồng bộ lại từ file plan này), `CLAUDE.md` (bỏ quy tắc hex, thêm: toạ độ pixel float, nav grid 8 px, spatial hash, mọi sprite không xoay), `README.md` (điều khiển mới).

### Kiểm thử Phase 0b

- Vitest: dual-grid mask (ô đồng nhất → mask 15, biên → đúng bit), generate deterministic + doodad không nằm trên nước/vách + khoảng trống quanh start, Poisson khoảng cách tối thiểu, SpatialHash query, NavGrid block/unblock đếm tham chiếu, A* + smoothing (đi vòng vật cản, không xuyên góc), placement (snap, magnet, chồng lấn → invalid).
- `npm run lint && npm test && npm run build`.
- Browser pane: desktop + mobile 375×812 — map liền mạch không thấy ô, cây y-sort đúng (đứng sau/trước), đặt công trình tự do + Shift snap, ghost đỏ khi chồng cây, F3 thấy nav grid bị chặn đúng chỗ; console không lỗi.

## Verification (cho mỗi phase)

- `npm run test` (Vitest) cho logic sim: job, pathfinding, needs, sanity, save round-trip.
- `npm run build` + mở preview deploy trên desktop & mobile thật.
- Playtest checklist theo DoD của phase; profile FPS bằng Phaser debug + Chrome Performance.
- Ở Phase 7: build Tauri và Capacitor, cài thử trên thiết bị thật.
