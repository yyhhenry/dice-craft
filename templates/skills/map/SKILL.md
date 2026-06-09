---
name: map
description: CSV grid maps and update_scene — terrain tokens, overlays, characters on grid.
---

# Map Skill

Read **`skills/map/GUIDE.md`** for format spec, terrain tokens, overlays, and update_scene rules.

- **Build mode:** write `.map.csv` files only (no `update_scene`).
- **Play mode:** `update_scene` with `map.mapFile` pointing at a workspace CSV path.

## Examples

Reference maps in `skills/map/examples/`:

| File | Scene |
|------|-------|
| `tavern.map.csv` | 标准酒馆 (6×6) |
| `tavern-large.map.csv` | 大型酒馆 (10×8) |
| `tavern-small.map.csv` | 路边小酒馆 (5×4) |
| `forest-path.map.csv` | 森林小径 (6×8) |
| `dungeon-cave.map.csv` | 地下洞穴 (8×8) |
| `village-square.map.csv` | 村庄广场 (8×8) |
| `river-crossing.map.csv` | 河岸渡口 (8×6) |
| `castle-hall.map.csv` | 城堡大厅 (8×10) |
| `market-street.map.csv` | 市集街道 (10×6) |
| `opening-scene.patch.json` | update_scene payload 示例 |

Use these as starting points — copy and modify for your scenario.
