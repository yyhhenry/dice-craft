---
name: map
description: "网格地图创建与展示。CSV 格式、地形 token、互动按钮。"
---

# 地图技能

## CSV 格式

每格一个地形 token，逗号分隔行。以 `#` 开头的行被解析器忽略（用于标题、尺寸、GM 备注）。

```
# 标准酒馆
# 6x6 带吧台
# overlay: door at 2,5 — 正门
wall,wall,wall,wall,wall,wall
wall,wood,wood,wood,wood,wall
wall,wood,dirt,dirt,wood,wall
wall,wall,wall,wall,wall,wall
```

**地形 token：** `wall`、`grass`、`stone`、`wood`、`dirt`、`sand`、`water`、`lava`、`ice`、`void`（空格 = void）

**色调变体：** `.dark` 或 `.light`（如 `wood.dark` 用于家具，`wood` 用于地板）

**尺寸：** 6×6 到 12×12，每行宽度一致

## 示例地图

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

以这些为起点——复制并修改适配你的场景。
