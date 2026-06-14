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
| `opening-scene.patch.json` | update_scene 参数示例（含 actions） |

以这些为起点——复制并修改适配你的场景。

## 互动按钮（actions）

玩家点击地图上的角色时弹出菜单。默认有"互动"按钮，可通过 `actions` 添加自定义按钮。

### 设置方式

在 `update_scene` 的 `characters` 中为角色添加 `actions`：

```json
{
  "id": "bartender",
  "name": "老陈",
  "role": "npc",
  "location": "2,2",
  "actions": [
    { "id": "talk", "label": "对话" },
    { "id": "trade", "label": "交易" }
  ]
}
```

### 事件格式

玩家点击自定义按钮后，你会收到：

```
<event source="map" type="action" character="老陈" action="talk"/>
```

### 设计建议

- **每个 NPC 都应该有 actions**——至少一个"对话"或角色特有的交互
- 敌人角色用 `attack`（如 `{ "id": "attack", "label": "攻击" }`）
- 可交互物品用 overlay + 合适的 label
- label 用简短中文（2-4 字），如：对话、交易、攻击、查看、打开、拾取
