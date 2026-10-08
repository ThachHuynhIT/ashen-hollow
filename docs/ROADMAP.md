> Bản kế hoạch tổng thể (đồng bộ từ phiên lập kế hoạch 2026-10-08). Trạng thái: **Phase 0 xong** — xem README.

# Kế hoạch: Dark Fantasy Colony Builder (2D Pixel, Web, đa nền tảng)

## Context

Bạn muốn làm một game **Dark Fantasy Colony Builder** dạng 2D pixel art, chạy trên web và đa nền tảng. Các lựa chọn đã chốt:

- **Repo riêng** (không nhét vào portfolio Next.js — portfolio chỉ link sang).
- **Phaser** (TypeScript) làm engine.
- **Hobby, không deadline** → chia milestone mở, mỗi phase kết thúc bằng một bản _chơi được_.
- Gameplay **kết hợp**: colonist sim kiểu RimWorld + phòng thủ đêm kiểu They Are Billions + áp lực sinh tồn/luật lệ kiểu Frostpunk, xoay quanh trục **Sanity / Corruption**.

Tên tạm: **"Ashen Hollow"** (đổi tuỳ ý).

**Cập nhật v2 (theo yêu cầu bổ sung):**

- **Cây công nghệ kiểu Civilization VI**: 2 cây song song (Tech + Doctrine/Civics), chia theo Kỷ nguyên, có **Eureka/Inspiration** (hoàn thành thử thách trong game để giảm chi phí), mở khoá **Policy Card** cắm vào slot.
- **Quân lính điều khiển theo ô, real-time**: toàn bộ game chạy real-time (có pause), bản đồ là **lưới hex**, mọi đơn vị di chuyển _bám ô_ (từ tâm hex này sang tâm hex kế), có chi phí địa hình, ZOC, giới hạn chồng quân, bonus đồi/rừng/sườn — giống chiến thuật Civ 6 nhưng không có lượt.

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

| Hạng mục    | Lựa chọn                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Ngôn ngữ    | TypeScript strict                                                                                                                   |
| Engine      | Phaser (bản stable mới nhất; dùng Phaser 4 nếu đã ổn định, không thì 3.90)                                                          |
| Build       | Vite                                                                                                                                |
| ECS / logic | **bitECS** (tách simulation khỏi render, xử lý hàng trăm entity)                                                                    |
| Hex math    | **honeycomb-grid** (hoặc tự viết theo Red Blob Games): toạ độ **axial/cube**, láng giềng, khoảng cách, line-of-sight, vùng bán kính |
| Pathfinding | A* trên **hex graph** (chi phí theo địa hình) + flow field hex cho bầy quái; chạy trong **Web Worker**                              |
| UI          | Phaser cho HUD trong game + **Preact/HTML overlay** cho menu phức tạp (bảng colonist, research tree)                                |
| State/Save  | Serializable world state → **IndexedDB** (idb-keyval) + export/import file JSON nén (lz-string)                                     |
| Map         | **Tiled** (map handcrafted) + procedural generation (simplex-noise)                                                                 |
| Audio       | Phaser Sound (WebAudio) + **Howler.js** nếu cần layering nhạc                                                                       |
| Test        | Vitest cho logic simulation (thuần TS, không phụ thuộc Phaser)                                                                      |
| Đóng gói    | Web (itch.io / Vercel / Cloudflare Pages), **PWA** (offline), **Tauri** (Win/Mac/Linux → Steam), **Capacitor** (Android/iOS)        |
| CI          | GitHub Actions: lint + test + build web, release Tauri                                                                              |

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

- **Lưới hex pointy-top**, mỗi ô vẽ trong khung **32×28 px** (hoặc 24×22 nếu muốn nhỏ hơn); Phaser hỗ trợ tilemap hex xuất từ Tiled (`orientation: hexagonal`). Map 64×64 hex (mở rộng 96×96 sau) — hex lớn hơn ô vuông 16px nên số ô ít hơn.
- Mỗi hex có: **địa hình** (đồng bằng, đồi, núi chặn, rừng, đầm, nước, đất nguyền), **đặc điểm** (sông giữa 2 hex, đường), **tài nguyên**, **công trình**, **chủ sở hữu** (thuộc colony hay chưa).
- **Lãnh thổ kiểu Civ**: colony mở rộng biên giới theo ô quanh công trình trung tâm (Hearthfire); chỉ xây được trong lãnh thổ; mua thêm ô bằng vật liệu/Faith hoặc tự mở rộng theo điểm văn hoá.
- **Adjacency bonus kiểu Civ 6**: công trình hưởng thưởng theo hex kề (Xưởng mộc cạnh rừng +sản lượng, Nhà nguyện cạnh nghĩa trang +Faith, Bàn thờ Máu cạnh Rift +Soul Ash).
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
- Trên hex: **mỗi công trình chiếm 1 hex** (công trình lớn chiếm cụm 3 hoặc 7 hex). Tường là công trình chiếm hex; cổng cho phe mình đi qua. "Phòng" = cụm hex được bao kín bởi tường (flood-fill trên hex) → ảnh hưởng nhiệt độ, ánh sáng, chất lượng phòng ngủ.
- Công trình có **cấp độ** (nâng cấp mở bằng tech) và **slot chuyên gia** (gán colonist vào làm việc tại hex đó, kiểu citizen của Civ).

### 3.7 Quân đội & Chiến đấu theo ô (real-time, hex)

**Nguyên tắc di chuyển "bám ô":**

- Mọi đơn vị (lính, colonist, quái) luôn **thuộc về đúng 1 hex**; di chuyển = trượt mượt từ tâm hex sang tâm hex kề (tween), không đứng giữa 2 ô.
- **Đặt chỗ ô (hex reservation)**: trước khi bước, đơn vị "giữ chỗ" hex đích → không bao giờ 2 đơn vị quân sự đứng cùng ô ngoài giới hạn chồng quân; tránh kẹt bằng re-path khi bị chặn > N giây.
- **Chi phí di chuyển** theo địa hình (Civ 6): đồng bằng 1, rừng/đồi 2, đầm 3, sông +1 khi vượt, đường 0.5, núi không đi được. Real-time: chi phí → **thời gian đi qua ô** (tốc độ đơn vị ÷ chi phí).
- **Giới hạn chồng quân**: 1 đơn vị quân sự/hex (1UPT như Civ 6) + tối đa 1 đơn vị dân sự; hoặc biến thể "đội tối đa 3 lính/hex" nếu muốn đông hơn — quyết định khi prototype.
- **Zone of Control (ZOC)**: hex kề quân địch là vùng kiểm soát → đi vào sẽ bị **chậm mạnh** và phải dừng lại (không lách qua được); đơn vị kỵ/ma có thể bỏ qua ZOC.

**Điều khiển (RTS-lite):**

- Chọn đơn vị: click, kéo khung, phím nhóm `Ctrl+1..9`; mobile: chạm + nút chọn nhóm.
- Lệnh: Di chuyển, Tấn công-di chuyển, Giữ vị trí (Fortify +def theo thời gian đứng yên), Tuần tra giữa các hex, Rút lui, Dựng phòng tuyến (tự dàn đội hình lên dải hex).
- **Xem trước đường đi** trên hex (đường + số giây tới đích + ô ZOC tô đỏ) — chuẩn Civ 6.
- Hàng đợi lệnh (Shift+click). Active pause để ra lệnh trên mobile.

**Chiến đấu:**

- **Combat Strength (CS)** kiểu Civ 6: sát thương = f(chênh lệch CS) có ngẫu nhiên nhỏ; HP 100 mỗi đơn vị.
- Tấn công theo **nhịp đòn** (attack cooldown) thay vì lượt.
- **Bonus địa hình**: đồi/rừng +3 def, sông −5 khi tấn công qua sông, công sự +def.
- **Flanking & Support**: +2 CS cho mỗi đơn vị phe mình kề mục tiêu (flank) / kề bản thân (support) → khuyến khích bao vây theo hex.
- **Tầm xa**: cung/ballista có **range theo số hex** + cần **line of sight** (đồi/rừng chặn tầm nhìn, đứng trên đồi bắn qua được).
- **Ánh sáng là chiến thuật**: quái mất CS trong vùng sáng; Shade bất tử trong bóng tối.
- Thương tích theo bộ phận vẫn áp cho colonist (gãy chân = chậm qua ô).

**Lớp đơn vị (mở khoá bằng tech):**

| Lớp                  | Ví dụ                                                                        | Đặc điểm                            |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| Dân quân             | Militia (colonist cầm vũ khí)                                                | Rẻ, rút từ lao động                 |
| Cận chiến            | Man-at-arms → Inquisitor Knight                                              | Giữ tuyến                           |
| Chống kỵ/quái lớn    | Pikeman → Silver Halberd                                                     | Bonus vs Brute/boss                 |
| Tầm xa               | Hunter → Longbow → Crossbow                                                  | Range 2 hex                         |
| Công thành/Phòng thủ | Ballista, Flame Cart                                                         | Range 3, phải dựng (setup)          |
| Hỗ trợ               | Chaplain (hồi sanity vùng), Lantern Bearer (nguồn sáng di động), Field Medic | Không chiến đấu                     |
| Hắc ám (Occult)      | Ghoul thuần phục, Bone Golem, Blood Witch                                    | Mạnh, +Corruption                   |
| Anh hùng             | 1–3 Hero có kỹ năng chủ động                                                 | Kiểu Great General: aura +CS hex kề |

- **Promotion tree** kiểu Civ 6: lính lên cấp bằng XP, chọn 1 trong 2 nhánh thăng cấp (vd. "Tuyến thép: +def khi Fortify" vs "Truy kích: +move sau khi giết").
- Lính là **colonist được huấn luyện** tại Doanh trại (giữ tên, trait, sanity, quan hệ) → lính chết là mất người thật — giữ chất kể chuyện RimWorld.
- **Bảo trì**: lính tiêu thức ăn + vàng/vật liệu mỗi ngày.

**Quái & đợt tấn công:**

- **Wave system**: mỗi đêm sinh quái từ Rift theo ngân sách độ khó (ngày + giàu có + corruption).
- Quái cũng bám ô, dùng **flow field hex** tới mục tiêu (nguồn sáng/colonist/công trình), phá tường nếu bị chặn, tôn trọng ZOC của lính ta.
- Ví dụ: Ghoul (đông, yếu), Hollow Wraith (bay qua tường, bỏ qua ZOC, hút sanity), Bone Brute (phá tường), Shade, Plague Rat swarm (nhiều con/hex), Possessed Colonist, **Boss** chiếm 3 hex: The Weeping Matron, Antler King, Veil Leviathan.
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

- **Hex tile pointy-top 32×28 px** (vẽ trong canvas 32×32 để có chỗ cho độ cao: đồi, cây nhô lên trên). Nhân vật **16×24**, đứng ở tâm hex. Công trình 1 hex vẽ trong 32×40 (nhô cao), công trình 3/7 hex vẽ thành sprite lớn.
- Mẹo pixel hex: dùng template viền hex cố định, cạnh xiên theo nhịp 2:1 pixel để không bị răng cưa xấu; vẽ **transition giữa biome** bằng overlay cạnh (6 cạnh × các loại địa hình) thay vì autotile 47 ô kiểu vuông.
- **Palette giới hạn 32–48 màu** (gợi ý xuất phát: _Resurrect 64_ rút gọn hoặc _Endesga 32_ + tông xám-tím-xanh rêu, điểm nhấn: cam lửa, đỏ máu, xanh lục ma). Ánh sáng ấm (lửa) vs bóng tối lạnh (tím/xanh) là ngôn ngữ thị giác chính.
- Công cụ: **Aseprite** (vẽ + animation + xuất JSON atlas), **Tiled** (map), **TexturePacker** hoặc `free-tex-packer` (atlas).
- Pipeline: `.aseprite` → script xuất spritesheet + JSON → `public/assets/atlases/`.

### Danh sách asset (theo phase, MVP trước)

**Tileset**

- Địa hình hex theo biome (cỏ chết, đất, bùn, đồi, núi, nước đen, tuyết tro, đất nguyền) – mỗi loại 3–4 biến thể + overlay cạnh chuyển tiếp, overlay sông/đường theo cạnh hex.
- **Overlay chiến thuật**: viền lãnh thổ, hex được chọn, đường đi xem trước, ô ZOC (đỏ), tầm bắn, vùng sáng, hex có Eureka/tài nguyên.
- Tài nguyên: 3–4 loại cây chết, đá, quặng, nấm phát quang, bụi gai, xương.
- Sàn & tường (gỗ, đá, xương) có autotile.

**Nhân vật (mỗi loại: idle, walk 4 hướng hoặc 2 hướng + flip, work, attack, hurt, die)**

- Colonist base body + **layer**: tóc, quần áo, vũ khí, giáp (paper-doll → đa dạng không cần vẽ nhiều).
- Portrait 32×32 cho UI (cũng ghép layer).
- Quái: 6–8 loại + 3 boss (boss chiếm 3 hex, sprite 48×48 hoặc 64×64).
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
- **Hex core**: module `hex/` (axial coords, neighbors, distance, pixel↔hex, ring/range, line) + unit test; render map hex placeholder + hover/chọn hex.
- **DoD**: mở URL thấy map hex placeholder, hover/click chọn đúng ô, pan/zoom được trên PC và điện thoại.

### Phase 1 – Prototype Core Loop (~4–6 tuần)

- Grid map + procedural generation cơ bản (1 biome).
- ECS: Position, Sprite, Colonist, Job, Inventory.
- Pathfinding A* trên hex (chi phí địa hình) trong Web Worker; di chuyển bám ô + hex reservation.
- Lãnh thổ cơ bản quanh Hearthfire.
- Job system: chặt cây, đào đá, vận chuyển về kho, xây công trình từ blueprint.
- 3 colonist, 5 công trình (lửa trại, kho, tường, giường, đuốc), 3 tài nguyên.
- Nhu cầu: Hunger + Rest. Tốc độ game & pause.
- **DoD**: ra lệnh → colonist tự khai thác và xây; nếu không ăn ngủ thì chết. Unit test cho job & pathfinding.

### Phase 2 – Ngày/Đêm, Ánh sáng & Sinh tồn (~4–6 tuần)

- Chu kỳ ngày/đêm + lighting lightmap + nguồn sáng tiêu nhiên liệu.
- **Sanity** cơ bản (bóng tối, đói, ngủ, lửa trại).
- Quái đêm đơn giản (Ghoul) spawn từ Rift, flow field, tấn công.
- **Điều khiển lính real-time theo ô**: chọn/kéo khung, move, attack-move, fortify, xem trước đường đi; 1UPT; ZOC; Combat Strength + bonus địa hình/flank; 3 lớp đơn vị (Militia, Man-at-arms, Hunter) + tháp cung + tường.
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
- Quái đa dạng (5–6 loại) + Lair trên bản đồ + Blood Moon + 1 boss 3-hex.
- **DoD**: hai lối chơi Ánh sáng / Bóng tối khác nhau rõ rệt; người chơi có lý do để "săn Eureka"; trận đêm thắng nhờ dàn trận hex chứ không chỉ nhờ số đông.

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

| Rủi ro                                           | Giảm thiểu                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Scope phình to (colony sim là thể loại khổng lồ) | Phase 2 phải chơi được; mỗi phase cắt nội dung trước khi cắt chất lượng       |
| Hiệu năng pathfinding với nhiều entity           | Worker + flow field cho quái + cache path + tick AI theo lô                   |
| Mobile UI quá chật                               | Thiết kế touch-first từ Phase 0, active pause                                 |
| Save hỏng khi đổi version                        | Save có `version` + hàm migrate, test round-trip                              |
| Asset không nhất quán                            | Khoá palette + kích thước + style guide 1 trang từ Phase 0                    |
| Mất động lực (hobby)                             | Devlog định kỳ, deploy preview mỗi tuần để thấy tiến độ                       |
| Real-time + bám ô bị kẹt/tắc đường               | Hex reservation + timeout re-path + cho phép "đổi chỗ" giữa 2 đơn vị cùng phe |
| Micro lính real-time quá tải trên mobile         | Active pause, lệnh nhóm, "dựng phòng tuyến" tự động, tốc độ game chậm         |
| Cây tech quá to làm loãng                        | Bắt đầu 10 node ở Phase 2, chỉ mở rộng khi Eureka chứng minh vui              |
| Pixel art hex khó vẽ                             | Khoá template hex + overlay cạnh ngay Phase 0, thử 1 biome trước              |

---

## 9. Bước đầu tiên khi bắt đầu code (sau khi duyệt plan)

1. Tạo repo `ashen-hollow` (ngoài portfolio), scaffold Vite + TS + Phaser + bitECS + Vitest.
2. Viết `docs/GDD.md` (rút gọn từ plan này) + `docs/ART_STYLE.md` (palette, kích thước, quy tắc).
3. Làm Phase 0 → deploy preview → kiểm tra trên điện thoại.

## Verification (cho mỗi phase)

- `npm run test` (Vitest) cho logic sim: job, pathfinding, needs, sanity, save round-trip.
- `npm run build` + mở preview deploy trên desktop & mobile thật.
- Playtest checklist theo DoD của phase; profile FPS bằng Phaser debug + Chrome Performance.
- Ở Phase 7: build Tauri và Capacitor, cài thử trên thiết bị thật.
