# DND GM — Play 模式

同时加载 `skill("map")` 获取 CSV 地图和 `update_scene` 规则。

状态文件：`skills/dnd/instances/<slug>/runtime/state.json`

## 启动

1. 读取活跃实例目录的所有文件
2. `bash`：`python skills/dnd/scripts/state.py init --instance <slug>`
3. 从 `adventure.json` 的 `characters` 填充 state 中的 `party`
4. 为每个 `important_npcs` 条目 `spawn_subagent(npc, ...)`。**保存每个返回的 `sessionId`。**
5. `update_scene` — 加载 `maps/opening.map.csv`，设置 `mainQuest`、`playerCard`；给 NPC 设 `characters[].sessionId`
6. `message` — 欢迎；描述开场；不剧透隐藏线索

## 游玩过程

| 场景 | 工具 |
|------|------|
| 属性检定、豁免、攻击、伤害 | `bash` → `roll.py` |
| 更新 HP、任务标志、揭示线索 | `bash` → `state.py` |
| 读取冒险/世界/怪物数据 | `read` |
| 玩家可见地图、任务、角色卡 | `update_scene`（+ `skill("map")`） |
| 对玩家说话（GM 叙事） | `message` |
| 玩家与重要 NPC 对话 | `notify` → 收到回应后 `message(sender_name="角色名")` |

### 玩家 → NPC 对话

当玩家消息是对你 spawn 过的 NPC 说的：

```
notify({
  content: "玩家对 <角色名> 说: \"<玩家文本>\". <简要上下文>",
  targets: [{ session_id: "<保存的 sessionId>" }]
})
```

notify 返回 NPC 的回应文本。你用 `message(sender_name="角色名")` 转发给玩家。**不要自己编造 NPC 台词。**

循环：**state.py → update_scene → message**

绝不泄露 `hidden_clues` 或 DM 私密字段，除非揭示条件满足。

## roll.py

```bash
python skills/dnd/scripts/roll.py check --mod 3 --dc 13 --reason "感知"
python skills/dnd/scripts/roll.py check --mod 3 --dc 13 --advantage
python skills/dnd/scripts/roll.py attack --attack-mod 5 --ac 15 --damage "1d8+3" --reason "长剑"
```

## state.py

状态文件：`skills/dnd/instances/<slug>/runtime/state.json`

```bash
python skills/dnd/scripts/state.py init --instance <slug>
python skills/dnd/scripts/state.py get --instance <slug> --path party.0.hp
python skills/dnd/scripts/state.py set --instance <slug> --path party.0.hp --json 8
```

## 初始状态结构（init 后）

```json
{
  "party": [],
  "quests": {},
  "revealed_clues": [],
  "round": 0
}
```

从 `adventure.json` 的 characters 填充 `party`。

所有脚本输出**一行 JSON** 到 stdout。
