# Ashen Hollow — Asset Manifest

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
| anchor      | yes (world)      | Mặc định `feet` = origin (0.5, 1)                                          |
| notes       | no               | Ghi chú tích hợp                                                           |

Ví dụ một entry trong `assets.manifest.yml`:

```yaml
- id: dead_tree
  path: public/assets/doodads/dead_tree.png
  category: doodad
  origin: external
  source: https://example.com/pack
  creator: Example Author
  license: CC0-1.0
  attribution: false
  redistribute: true
  evidence: docs/licenses/example-pack/
  modified: true
  nativeSize: 16x24
  finalSize: 16x24
  anchor: feet
  notes: Example only
```

Asset `origin: custom` bỏ qua `source/creator/license/redistribute/evidence`.

## 2. Quy ước đặt tên (một chuẩn duy nhất)

`snake_case`, thống nhất giữa `id`, tên file và frame trong atlas:

| Loại                  | Mẫu                    | Ví dụ                                   |
| --------------------- | ---------------------- | --------------------------------------- |
| Tĩnh                  | `<id>`                 | `tent`, `watchtower`, `dead_tree`       |
| Frame animation       | `<id>_<anim>_<nn>`     | `colonist_walk_00`, `ghoul_attack_01`   |
| Icon                  | `icon_<id>`            | `icon_ember`                            |
| VFX                   | `fx_<id>` / `fx_<id>_<nn>` | `fx_hit_00`                         |

- `<nn>` luôn **2 chữ số** (`00`, `01`…), `<anim>` ∈ `idle|walk|work|attack|hurt|die`.
- **Không đưa team/faction/hướng vào tên**: biến thể màu qua palette/data, hướng qua flip hoặc frame riêng `<id>_<anim>_<dir>_<nn>` chỉ khi thật sự cần (`dir` ∈ `n|e|s|w`).
- Code gameplay không truy cập tên file trực tiếp; đi qua helper trong `src/render/atlas.ts`.

## 3. Biến thể

Ưu tiên `asset gốc + dữ liệu palette` thay vì nhân bản file khi thiết kế cho phép.

## 4. Validation

Mỗi entry (script kiểm tra tương lai đọc `assets.manifest.yml`):

- [ ] file tồn tại
- [ ] đủ field bắt buộc; asset `external` có `license`, `redistribute: true`, `evidence`
- [ ] `attribution: true` ⇒ có dòng trong `CREDITS.md` **và** trong màn hình credits của game
- [ ] đúng `nativeSize`, chỉ dùng màu Ashen 32, không anti-aliasing
- [ ] anchor chân, không xoay sprite
- [ ] frame name đúng quy ước §2
