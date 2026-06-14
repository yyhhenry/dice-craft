# 地图与场景画布指南

## CSV 格式

每格一个地形 token，逗号分隔行。

### 注释

以 `#` 开头的行被解析器忽略。用于：

- 地图标题和尺寸（`# 标准酒馆` / `# 6x6`）
- 建议的覆盖物位置（`# overlay: door at 2,0 — 南入口`）
- GM 备注（`# 玩家从底部进入`）

```
# 标准酒馆
# 6x6 带吧台
# overlay: door at 2,5 — 正门
wall,wall,wall,wall,wall,wall
wall,wood,wood,wood,wood,wall
wall,wood,dirt,dirt,wood,wall
wall,wall,wall,wall,wall,wall
```

### 地形 token

`wall`、`grass`、`stone`、`wood`、`dirt`、`sand`、`water`、`lava`、`ice`、`void`（空格 = void）。

色调变体：`.dark` 或 `.light`（如 `wood.dark`、`stone.light`）。

**尺寸：** 6×6 到 12×12；保持每行宽度一致。

## Build 模式

只写文件——**不要**调用 `update_scene`。

存储路径由游戏技能定义。常见模式：

| 模式 | 路径 |
|------|------|
| 实例包（DND） | `skills/<pack>/instances/<slug>/maps/<name>.map.csv` |
| 技能级别 | `skills/<pack>/maps/<name>.map.csv` |
| 临时 | `.game-state/<name>.map.csv` |

## Play 模式

1. 需要时 `write` / `edit` CSV
2. `update_scene` 传入工作区相对路径的 `map.mapFile`

### update_scene 规则

- **`map.mapFile`** — 解析 CSV 为网格单元格
- **`characters`**、**`map.overlays`**、**`map.labels`**、**`mainQuest`** — 传入时**全量替换**；传入所有要保留的项
- 切换场景时：如果重新开始，清除旧的 `characters` / `mainQuest`
- **绝不**在场景字段或地图标签中放 GM 私密信息

### 覆盖物

`type`：`door`、`chest`、`trap`、`stairs`、`marker` — 必须有 `id`、`x`、`y`，可选 `label`。

### 网格上的角色

`location`：`"x,y"`；`role`：`player` | `npc` | `enemy` | `ally` | `neutral`；`hidden: true` 隐藏 token；`sessionId` 关联 NPC 子 agent。

参见 `skills/map/examples/opening-scene.patch.json` 获取完整参数示例。
