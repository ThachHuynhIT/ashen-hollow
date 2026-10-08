# Phase 1 — Core Loop: colonist, công việc, nhu cầu (Design Spec)

- **Ngày:** 2026-10-08
- **Trạng thái:** chờ duyệt
- **Liên quan:** [ROADMAP.md](../../ROADMAP.md) Phase 1 · [GDD.md](../../GDD.md) · [ART_STYLE.md](../../ART_STYLE.md)

## 1. Mục tiêu & tiêu chí hoàn thành

Biến bản đồ tĩnh của Phase 0b thành một colony **tự vận hành**: người chơi ra lệnh, colonist tự làm.

**Done khi:**

1. Người chơi đánh dấu cây/đá → colonist tự đi chặt/đào, vác tài nguyên về kho, con số trong HUD tăng.
2. Người chơi đặt công trình → thành **bản thiết kế**; colonist chở vật liệu từ kho đến rồi xây; xong thì công trình thật xuất hiện.
3. Colonist tự ăn và ngủ khi cần; nếu **không có gì ăn / không được ngủ** đủ lâu thì chết.
4. Unit test cho pathfinding/di chuyển và hệ thống công việc (kịch bản headless chạy N tick).

**Ngoài phạm vi (để phase sau):** ngày/đêm & ánh sáng thật (Phase 2), quái & chiến đấu & draft lính (Phase 2), kỹ năng/trait/mood (Phase 3), chế biến (Phase 3), lãnh thổ nở rộng theo văn hoá (Phase 4), Web Worker cho pathfinding (chỉ làm khi đo thấy cần — xem §9).

## 2. Quyết định đã chốt (từ brainstorming)

| Câu hỏi           | Chọn                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| Ra lệnh khai thác | **Kéo vùng đánh dấu** (Chặt / Đào / Bỏ đánh dấu); mobile chạm từng vật  |
| Xây dựng          | **Bản thiết kế + chở vật liệu** rồi xây theo thời gian                  |
| Kho               | **Vác về điểm nhận hàng; kho là con số** (không có đồ vật nằm trên đất) |
| Kiến trúc AI      | **Bảng công việc + utility AI** (không behavior tree / GOAP)            |

## 3. Dữ liệu & tài nguyên

### 3.1 Tài nguyên (3 loại)

| id      | Tên     | Nguồn                                       |
| ------- | ------- | ------------------------------------------- |
| `wood`  | Gỗ      | Chặt `deadTree` (+20)                       |
| `stone` | Đá      | Đào `boulder` (+30)                         |
| `food`  | Thức ăn | Hái `glowShroom` (+5), cũng ăn tại chỗ được |

`boneHeap` (xương) chưa có tác dụng ở Phase 1 — không đánh dấu được.

**Kho khởi đầu:** gỗ 30, đá 10, thức ăn 30. Kho là `Stockpile` — một bộ đếm toàn cục trong `GameWorld` (`Record<ResourceId, number>`), chỉ thay đổi khi colonist **thả hàng tại điểm nhận** hoặc **lấy hàng ra**.

**Điểm nhận hàng (drop point):** Lửa Thiêng và mọi Kho đã xây xong. Colonist luôn chọn điểm gần nhất (theo đường đi ước lượng — khoảng cách thẳng là đủ cho Phase 1).

### 3.2 Công trình (Phase 1)

| id           | Tên        | Footprint | Chi phí      | Xây (tick) | Vai trò                                        |
| ------------ | ---------- | --------- | ------------ | ---------- | ---------------------------------------------- |
| `hearthfire` | Lửa Thiêng | tròn r8   | — (có sẵn)   | —          | Điểm nhận hàng, chỗ ăn, tâm lãnh thổ           |
| `storage`    | Kho        | 32×18     | 20 gỗ        | 150        | Điểm nhận hàng                                 |
| `tent`       | Lều        | 24×14     | 10 gỗ        | 100        | Ngủ, sức chứa 2                                |
| `torch`      | Đuốc       | tròn r3   | 2 gỗ         | 30         | Placeholder ánh sáng (Phase 2 mới có tác dụng) |
| `wallStake`  | Cọc tường  | tròn r4   | 1 gỗ         | 20         | Đặt hàng loạt bằng kéo đường (§7.3)            |
| `watchtower` | Tháp Canh  | 16×12     | 15 gỗ, 10 đá | 200        | Chưa có tác dụng (Phase 2)                     |

Số liệu nằm ở `src/data/buildings.ts` (thêm `cost`, `buildTicks`, `role`).

### 3.3 Component ECS mới (`src/sim/components.ts`)

| Component           | Trường                                                   | Ghi chú                                                          |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| `Colonist`          | `nameIndex`                                              | Tên lấy từ danh sách tên tiếng Việt cổ trong `src/data/names.ts` |
| `Needs`             | `hunger`, `rest`, `health` (Float32, 0–100)              | 100 = no/khoẻ                                                    |
| `Mover`             | `speed` (px/tick), `targetX/Y`, `stuckTicks`             | Đường đi lưu ngoài ECS: `world.paths: Map<eid, Vec2[]>`          |
| `Carry`             | `resource` (index, −1 = rỗng), `amount`                  | Tối đa 20                                                        |
| `Designation`       | `kind` (chop/mine/forage)                                | Gắn lên doodad                                                   |
| `Blueprint`         | `kind`, `delivered[]` theo tài nguyên, `progress` (tick) | Gắn lên entity công trình chưa xong                              |
| `Sleeping` / `Dead` | tag                                                      |                                                                  |

Trạng thái công việc của từng colonist (`JobState`) lưu ở `world.jobs: Map<eid, Job>` — dữ liệu thuần, serialize được.

## 4. Di chuyển

- **`PathService`** (interface): `request(from, to) → Vec2[] | null`. Bản Phase 1 chạy đồng bộ: `findPath` + `smoothPath` có sẵn. Cache theo (ô xuất phát, ô đích) trong 1 tick để nhiều colonist cùng đích không tính lại.
- **Điểm tiếp cận (approach point):** colonist không đi vào trong vật cản. Với mục tiêu có shape, tìm ô nav **đi được gần nhất nằm ngoài shape**, quét vòng từ trong ra ngoài, tối đa 3 vòng (24 px). Không có → mục tiêu không tới được, huỷ việc + đánh dấu mục tiêu "không tới được" trong 600 tick.
- **Bám đường:** mỗi tick tiến `speed × terrainSpeed(dưới chân)` px về waypoint kế; tới (< 1 px) thì sang waypoint sau.
- **Separation:** colonist đẩy nhẹ nhau khi cách < 6 px (0.3 px/tick), không đẩy vào ô không đi được. Colonist **không** chặn nav grid.
- **Kẹt:** nếu 15 tick (1,5 s) tiến < 1 px → tính lại đường; kẹt 3 lần liên tiếp → huỷ việc.
- **Tốc độ cơ bản:** 2,4 px/tick = 24 px/s ở 1× (≈ 1,5 ô đất/s); đi ngang lãnh thổ (r 192) mất ~8 s. Hằng số trong `src/data/colonists.ts`, chỉnh khi playtest.

## 5. Hệ thống công việc

### 5.1 Vòng đời

Mỗi tick, với mỗi colonist sống:

1. **Cập nhật nhu cầu** (§6).
2. Nếu đang có `Job` → chạy bước hiện tại. Bước trả về `running | done | failed`.
3. Nếu rảnh (hoặc vừa xong/thất bại) → **chọn việc mới** bằng hàm chấm điểm (§5.3), **giữ chỗ** mục tiêu, bắt đầu.

### 5.2 Các loại việc và các bước

| Việc                     | Các bước                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `harvest` (chặt/đào/hái) | đi tới cạnh doodad → làm N tick (chặt 40, đào 60, hái 10) → xoá doodad (gỡ nav, spatial, sprite) → cầm sản lượng → `haulToDrop`                             |
| `haulToDrop`             | đi tới điểm nhận gần nhất → thả hàng (stock += amount)                                                                                                      |
| `deliver`                | đi tới điểm nhận gần nhất có hàng → lấy `min(cần, 20, tồn kho)` (stock −=) → đi tới blueprint → bỏ vào `delivered`                                          |
| `construct`              | đi tới cạnh blueprint → làm `buildTicks` tick → công trình thành thật (chặn nav; colonist đứng trong footprint bị đẩy ra ô trống gần nhất)                  |
| `eat`                    | đi tới điểm nhận có `food ≥ 1` → ăn 30 tick → food −1, hunger +40. Không còn food trong kho → đi hái nấm phát quang gần nhất và ăn tại chỗ (+25 hunger/cây) |
| `sleep`                  | đi tới lều còn chỗ (giữ 1 chỗ) → ngủ đến khi rest ≥ 95. Không có lều → ngủ cạnh Lửa Thiêng (hồi chậm hơn 50%)                                               |
| `idle`                   | đi lang thang nhẹ trong 48 px quanh Lửa Thiêng                                                                                                              |

Nếu đang cầm hàng mà việc bị huỷ → việc kế tiếp bắt buộc là `haulToDrop`.

### 5.3 Chọn việc (utility)

Điểm = `ưu tiên × 1000 − khoảng cách(px)`. Ưu tiên:

| Ưu tiên | Điều kiện                                        |
| ------- | ------------------------------------------------ |
| 6       | đang cầm hàng (phải trả hàng trước)              |
| 5       | đói < 15 hoặc mệt < 15 (khẩn)                    |
| 4       | blueprint đủ vật liệu → `construct`              |
| 3       | blueprint thiếu vật liệu và kho có → `deliver`   |
| 2       | doodad được đánh dấu → `harvest`                 |
| 1       | đói < 30 hoặc mệt < 30 (khi không còn việc trên) |
| 0       | `idle`                                           |

Nhu cầu khẩn (ưu tiên 5) **ngắt** việc đang làm (trừ `eat`/`sleep`); các mức khác chỉ được xét khi rảnh.

### 5.4 Giữ chỗ (reservation)

`world.reservations: Map<targetEid, colonistEid>`. Một doodad/blueprint-construct chỉ có 1 người làm; `deliver` giữ theo **lượng** (`pendingDelivery` trên blueprint) để 2 người không chở thừa. Lều giữ theo **chỗ ngủ**. Giữ chỗ được giải phóng khi việc xong, thất bại, hoặc colonist chết.

### 5.5 Đánh dấu

- `designate(world, area: Bounds, kind)` gắn `Designation` cho mọi doodad trong vùng **đúng loại của công cụ**: Chặt → `deadTree`, Đào → `boulder`, Hái → `glowShroom`. Mỗi công cụ chỉ đánh dấu một loại, để kéo khung qua rừng không vô tình hái hết nấm.
- `undesignate(world, area)` gỡ; nếu đang có người làm thì việc đó thất bại → colonist chọn việc khác.

## 6. Nhu cầu, sức khoẻ, cái chết

| Hằng số  | Giá trị                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| 1 ngày   | 6 000 tick (10 phút thực ở 1×)                                                               |
| Đói giảm | 100 → 0 trong 1 ngày (−1/60 mỗi tick)                                                        |
| Mệt giảm | 100 → 0 trong 1,2 ngày khi thức                                                              |
| Ngủ hồi  | 0 → 100 trong ⅓ ngày (trong lều); ngoài trời ×0,5                                            |
| Sức khoẻ | khi đói = 0 **hoặc** mệt = 0: −100 trong ⅓ ngày; khi cả hai > 20: hồi +100 trong 1 ngày      |
| Chết     | sức khoẻ = 0 → thêm tag `Dead`, bỏ mọi giữ chỗ, rơi hàng đang cầm (mất), sprite thành **mộ** |

Tất cả ở `src/data/colonists.ts`. Không có gì liên quan tới đồng hồ thật — chỉ tick → deterministic.

## 7. Giao diện & tương tác

### 7.1 HUD

- **Thanh tài nguyên** (trên, giữa): Gỗ · Đá · Thức ăn với icon pixel 8×8 và số.
- **Thẻ colonist** (dưới thanh trạng thái, bên trái): tên + 2 thanh nhỏ (đói = cam, mệt = tím) + biểu tượng việc đang làm. Chạm thẻ → camera tới colonist và chọn.
- **Thanh công cụ** (dưới, trái): `Chặt` `Đào` `Hái` `Bỏ đánh dấu` | `Lều` `Kho` `Đuốc` `Tường` `Tháp` | `Bám lưới`. Nút nào chưa đủ vật liệu thì mờ đi nhưng vẫn đặt bản thiết kế được (colonist sẽ chờ vật liệu).
- **Nhật ký sự kiện** ngắn (3 dòng mới nhất): "Bùi Tân đã chết vì đói.", "Đã xây xong Kho." — dùng cho DoD #3.

### 7.2 Đánh dấu

- Desktop: chọn công cụ → kéo khung (khung viền màu theo công cụ) → thả để áp dụng. Click đơn = đánh dấu 1 vật.
- Mobile: chọn công cụ → chạm từng vật (kéo vẫn để di chuyển bản đồ).
- Vật được đánh dấu có **icon nhỏ** phía trên (rìu / cuốc / bàn tay) và viền nhấp nháy nhẹ.

### 7.3 Xây

- Đặt công trình như Phase 0b (ghost, snap, magnet) nhưng tạo **blueprint**: sprite công trình màu xanh xám mờ + thanh tiến độ khi đang xây.
- Blueprint **chặn đặt công trình khác** nhưng **không chặn đi lại** cho tới khi xây xong.
- **Lãnh thổ:** chỉ đặt được trong bán kính 192 px quanh Lửa Thiêng (lý do mới `outOfTerritory`: "Ngoài lãnh thổ — đặt gần Lửa Thiêng hơn."). Vẽ đường biên lãnh thổ mờ khi đang ở chế độ xây.
- **Tường:** công cụ Tường → nhấn tại A, kéo tới B → xem trước chuỗi cọc cách nhau 8 px dọc AB (cọc không hợp lệ hiện đỏ và bị bỏ qua) → thả = tạo blueprint cho mọi cọc hợp lệ. Mobile: chạm A, chạm B, bấm Đặt.

### 7.4 Hình ảnh placeholder mới

Colonist 16×24 (2 frame đi + 1 frame làm + 1 frame ngủ, áo màu khác nhau theo người), icon tài nguyên 8×8, icon đánh dấu 8×8, đuốc, cọc tường, mộ. Theo `ART_STYLE.md`.

## 8. Kiến trúc mã

```
src/sim/
  colony/
    stockpile.ts      Stockpile: add/take/has, điểm nhận hàng
    needs.ts          needsSystem (thuần, theo tick)
    designation.ts    designate / undesignate
    blueprint.ts      placeBlueprint, delivered/pending, completeBlueprint
    territory.ts      inTerritory(world, shape)
  movement/
    PathService.ts    interface + SyncPathService (findPath+smoothPath, cache 1 tick)
    approach.ts       approachPoint(world, shape)
    movementSystem.ts bám waypoint + separation + kẹt
  jobs/
    types.ts          Job, JobStep, kết quả bước
    chooseJob.ts      chấm điểm utility (thuần, có test riêng)
    steps.ts          goTo, work, pickUp, drop, eat, sleep...
    jobSystem.ts      chạy bước, giữ chỗ, ngắt khi khẩn
  GameWorld.ts        thêm stockpile, paths, jobs, reservations, spawnColonists, stepWorld đăng ký system
src/data/colonists.ts, names.ts, resources.ts
src/render/ColonistRenderer.ts, BlueprintRenderer (gộp vào EntityRenderer), DesignationMarkers.ts
src/scenes/WorldScene.ts  công cụ đánh dấu, kéo khung, kéo tường
src/scenes/HudScene.ts    thanh tài nguyên, thẻ colonist, nhật ký
```

**Thứ tự system trong `stepWorld`:** needs → jobs (chọn/chạy bước, có thể gọi PathService) → movement → dọn dẹp chết. Mọi thay đổi thế giới mà render cần biết (doodad bị xoá, blueprint xong, colonist chết, tài nguyên đổi) được đưa vào **hàng sự kiện** `world.events: WorldEvent[]` và `WorldScene` tiêu thụ sau mỗi tick → render và HUD không phải quét ECS mỗi khung hình.

**Ranh giới giữ nguyên:** `src/sim` không import Phaser; không `Math.random` (dùng `world.rng`); mọi số liệu ở `src/data`.

## 9. Hiệu năng

Mục tiêu: 3 colonist (Phase 1), thiết kế đủ cho 50 (Phase 3). A* trên lưới 256×256 mất vài ms; chọn việc gọi pathfinding nhiều nhất 1 lần/colonist/tick nhờ chấm điểm bằng **khoảng cách thẳng** trước, chỉ tìm đường cho việc thắng. **Web Worker:** không làm ở Phase 1; thêm benchmark (50 colonist, 1 000 tick) vào test — nếu > 4 ms/tick trung bình thì làm worker ở Phase 3.

## 10. Kiểm thử

Kịch bản headless trên map dựng tay (`openTerrain` + doodad cho sẵn, như `smallWorld` hiện có), chạy `stepWorld` N lần:

| Test                       | Kỳ vọng                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| Đánh dấu 1 cây, 1 colonist | trong ≤ 600 tick: cây mất, gỗ +20, colonist không cầm gì                  |
| 2 colonist, 1 cây          | chỉ 1 người chặt; người kia không nhận cây đó                             |
| Blueprint Lều, kho đủ gỗ   | trong ≤ 1 500 tick: thành Lều thật, gỗ −10, nav bị chặn                   |
| Blueprint khi kho thiếu    | không ai xây; thêm gỗ vào kho → được xây                                  |
| Đói, kho có food           | colonist đi ăn, food −1, hunger tăng                                      |
| Không food, không nấm      | colonist chết trong khoảng dự đoán; sự kiện chết phát ra                  |
| Không food, có nấm         | colonist hái/ăn nấm, sống                                                 |
| Ngủ                        | rest < 15 → vào lều; rest hồi đúng tốc độ; lều 2 chỗ không có người thứ 3 |
| Kẹt                        | mục tiêu bị bao kín → việc thất bại, không treo                           |
| Bỏ đánh dấu khi đang chặt  | việc dừng, giữ chỗ được trả                                               |
| Di chuyển                  | tới đúng approach point, không bao giờ đứng trong ô không đi được         |
| `chooseJob`                | bảng ưu tiên §5.3 bằng dữ liệu tay                                        |
| Lãnh thổ                   | đặt ngoài 192 px → `outOfTerritory`                                       |
| Tường                      | kéo A→B: số cọc = ⌊                                                       | AB  | /8⌋+1, cọc vướng cây bị bỏ |
| Deterministic              | cùng seed + cùng lệnh → trạng thái giống hệt sau 2 000 tick               |

Kiểm thử trình duyệt (Playwright + Browser pane mobile): đánh dấu kéo khung, xem colonist làm việc, đặt Lều và chờ xây xong, tường kéo, HUD cập nhật, console sạch.

## 11. Rủi ro

| Rủi ro                                 | Giảm thiểu                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------- |
| Colonist kẹt trong rừng dày            | approach point quét 3 vòng; kẹt → huỷ + đánh dấu "không tới được" 600 tick |
| Dao động chọn việc (đổi việc liên tục) | chỉ chọn lại khi rảnh; chỉ nhu cầu khẩn mới ngắt                           |
| Blueprint xong đè lên colonist         | đẩy ra ô trống gần nhất                                                    |
| Hiệu năng pathfinding                  | khoảng cách thẳng trước, cache 1 tick, benchmark trong test                |
