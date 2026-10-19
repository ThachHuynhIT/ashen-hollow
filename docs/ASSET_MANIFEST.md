# Chín Vương Miện — Asset Manifest

Sổ đăng ký asset thật sự được đưa vào dự án. **Dữ liệu nằm ở [`assets.manifest.yml`](assets.manifest.yml)** (máy đọc được, để script kiểm tra); file này chỉ mô tả schema, quy ước đặt tên và checklist. Chỉ ghi asset đã được chọn và kiểm tra license theo [ASSET_LICENSES.md](ASSET_LICENSES.md).

## 1. Schema

| Field       | Required         | Meaning                                                                    |
| ----------- | ---------------- | -------------------------------------------------------------------------- |
| id          | yes              | Stable identifier, `snake_case`, trùng frame name (xem §2)                 |
| path        | yes              | Đường dẫn trong repo                                                       |
| category    | yes              | terrain / doodad / building / unit / ui / icon / fx / font / audio         |
| origin      | yes              | `external` hoặc `custom` (tự vẽ / code-generated)                          |
| source      | external         | URL gốc                                                                    |
| creator     | external         | Tác giả                                                                    |
| license     | external         | SPDX-like: `CC0-1.0`, `CC-BY-4.0`, `OFL-1.1`…                              |
| attribution | yes              | `true` nếu bắt buộc ghi công                                               |
| redistribute| external         | `true` nếu license cho phép phân phối lại (repo công khai **và** bản game) |
| evidence    | external         | Thư mục `docs/licenses/<asset-name>/` (license + ngày kiểm tra)            |
| modified    | yes              | Đã chỉnh sửa/đổi palette chưa                                              |
| nativeSize  | yes (hình)       | `WxH` canvas gốc                                                           |
| finalSize   | yes (hình)       | `WxH` dùng trong game (chỉ scale số nguyên)                                |
| projection  | yes (world)      | `iso_2_1` / khác                                                           |
| anchor      | yes (world)      | Mặc định `feet` = origin (0.5, 1)                                          |
| notes       | no               | Ghi chú tích hợp                                                           |

Ví dụ một entry trong `assets.manifest.yml`:

```yaml
- id: building_farm
  path: public/assets/buildings/example_building.png
  category: building
  origin: external
  source: https://example.com/pack
  creator: Example Author
  license: CC0-1.0
  attribution: false
  redistribute: true
  evidence: docs/licenses/example-pack/
  modified: true
  projection: iso_2_1
  nativeSize: 32x40
  finalSize: 32x40
  anchor: feet
  notes: Example only
```

Asset `origin: custom` bỏ qua `source/creator/license/redistribute/evidence`.

## 2. Quy ước đặt tên (theo atlas contract, spec §11.4)

`id` của asset = tên frame trong atlas; `snake_case`, một chuẩn duy nhất:

| Loại       | Mẫu                          | Ví dụ                       |
| ---------- | ---------------------------- | --------------------------- |
| Công trình | `building_<cardId>`          | `building_farm`             |
| Đơn vị     | `unit_<id>_<team>_<anim><n>` | `unit_swordsman_ally_walk0` |
| Tranh thẻ  | `card_art_<cardId>`          | `card_art_farm`             |
| Icon       | `icon_<id>`                  | `icon_gold`                 |
| VFX        | `fx_<id>`                    | `fx_hit`                    |

- `<team>` ∈ `ally|foe` (biến thể sinh từ atlas, không phải màu faction); `<anim>` ∈ `idle|walk|attack|hit|death|spawn`; `<n>` là chỉ số frame, không đệm số 0 (`attack0`, `attack1`).
- Không nhân bản frame chỉ vì faction nếu faction được palette-swap lúc chạy.
- Code gameplay không truy cập tên file trực tiếp; đi qua các hàm `*Frame(...)` trong `src/render/atlas.ts`.

## 3. Biến thể

Ưu tiên `asset gốc + dữ liệu palette` thay vì nhân bản file khi thiết kế cho phép.

## 4. Validation

Mỗi entry (script kiểm tra tương lai đọc `assets.manifest.yml`):

- [ ] file tồn tại
- [ ] đủ field bắt buộc; asset `external` có `license`, `redistribute: true`, `evidence`
- [ ] `attribution: true` ⇒ có dòng trong `CREDITS.md` **và** trong màn hình credits của game
- [ ] đúng `nativeSize`, chỉ dùng Hearth 32 (world), không anti-aliasing
- [ ] đúng projection, anchor chân, không xoay sprite
- [ ] frame name đúng quy ước §2
