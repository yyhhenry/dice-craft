---
name: map
description: "网格地图创建与展示。CSV 格式规范、地形 token、覆盖物/标签放置、update_scene 规则。"
---

# 地图技能

阅读 **`skills/map/GUIDE.md`** 获取格式规范、地形 token、覆盖物和 update_scene 规则。

- **Build 模式：** 只写 `.map.csv` 文件（不调 `update_scene`）
- **Play 模式：** `update_scene` 的 `map.mapFile` 指向工作区中的 CSV 路径

## 示例

参考地图在 `skills/map/examples/`：

| 文件 | 场景 |
|------|------|
| `tavern.map.csv` | 标准酒馆 (6×6) |
| `tavern-large.map.csv` | 大型酒馆 (10×8) |
| `tavern-small.map.csv` | 路边小酒馆 (5×4) |
| `forest-path.map.csv` | 森林小径 (6×8) |
| `dungeon-cave.map.csv` | 地下洞穴 (8×8) |
| `village-square.map.csv` | 村庄广场 (8×8) |
| `river-crossing.map.csv` | 河岸渡口 (8×6) |
| `castle-hall.map.csv` | 城堡大厅 (8×10) |
| `market-street.map.csv` | 市集街道 (10×6) |
| `opening-scene.patch.json` | update_scene 参数示例 |

以这些为起点——复制并修改适配你的场景。
