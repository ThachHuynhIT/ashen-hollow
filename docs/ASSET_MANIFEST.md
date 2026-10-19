# Ashen Hollow — Asset Manifest

> Template. Chỉ ghi asset đã thực sự được chọn và kiểm tra.

## 1. Required Fields

| Field | Required | Meaning |
|---|---|---|
| id | yes | Stable asset identifier |
| path | yes | Repo path |
| category | yes | terrain/building/unit/ui/etc. |
| source | yes for external | Original source |
| creator | yes for external | Creator |
| license | yes for external | License |
| attribution | yes | Credit required? |
| modified | yes | Modified? |
| projection | yes for world | `topdown_free` (gridless, sprite anchored at feet) / other |
| nativeSize | yes | Native canvas size |
| finalSize | yes | Size used in game |
| notes | no | Integration notes |

## 2. Example

```yaml
id: example_building
path: public/assets/buildings/example_building.png
category: building
source: https://example.com
creator: Example Author
license: CC0-1.0
attribution: false
modified: true
projection: topdown_free
nativeSize: 16x24
finalSize: 16x24
notes: Example only
```

## 3. Naming

Use lowercase `snake_case`, e.g. `tent`, `watchtower`, `dead_tree`, `worker_walk_00`, `icon_ember`.

## 4. Variants

Prefer `base asset + palette data` over duplicated files when the visual design permits it.

## 5. Validation

- [ ] file exists
- [ ] source recorded
- [ ] license recorded
- [ ] attribution recorded
- [ ] projection checked (no rotation; feet-anchored)
- [ ] native size checked
- [ ] palette checked (Ashen 32 only)
- [ ] atlas frame checked
- [ ] credits updated
