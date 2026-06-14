---
name: dnd
description: "DND/TRPG 冒险：实例格式、字段规则、掷骰与状态脚本。用户要创建或游玩 DND 冒险时加载。"
---

# DND 冒险技能

构建与主持流程见 primary 系统提示。本文件提供 **DND 实例结构、保密规则、脚本用法**；完整骨架见 `skills/dnd/templates/`。

## 目录

```text
skills/dnd/
├── SKILL.md
├── scripts/              roll.py、state.py
├── templates/            新实例骨架（复制后改名填写）
└── instances/<slug>/   每局冒险产物
```

关联：`skill("map")` 地图 CSV；`skill("dice")` 通用掷骰（可选）。

---

## Build：创建实例

写入 `skills/dnd/instances/<slug>/`。slug：小写 `[a-z][a-z0-9_]*`，最长 40 字符。

### 文件结构

```text
instances/<slug>/
├── meta.json
├── world.md
├── adventure.json
├── monsters.json
├── rules.md
├── items.md
├── maps/<场景id>.map.csv
└── runtime/state.json    ← 游玩时由 state.py 生成
```

从 `templates/` 复制后按主题填写，语言与用户一致。

### meta.json 示例

```json
{
  "slug": "ring_quest",
  "title": "夏尔疑云",
  "theme": "lord_of_the_rings_style",
  "skill": "dnd",
  "status": "ready",
  "created_at": "2026-05-31T00:00:00Z"
}
```

### adventure.json 字段

| 字段 | 说明 |
|------|------|
| `premise` | 玩家可见引子 |
| `opening_scene_id` | 须对应 `maps[]` 中某 `id` |
| `maps[]` | `id`、`name`、`file`、`description`（公开）、`dm_private_notes`（私密） |
| `quests[]` | `player_visible_goal` / `dm_private_goal` |
| `important_npcs[]` | `personality`、`public_identity`、`private_goal`、`known_information` |
| `hidden_clues[]` | `revealed: false`，`reveal_condition` |
| `characters[]` | `public_background`、`stats`（hp、max_hp、ac、attack_mod 等） |

示例片段（完整见 `templates/adventure.json`）：

```json
{
  "premise": "甘道夫交给你一封密信，要在日出前送到绿龙酒馆。",
  "opening_scene_id": "opening",
  "maps": [{
    "id": "opening",
    "name": "袋底洞外小径",
    "file": "maps/opening.map.csv",
    "description": "青草小径蜿蜒穿过霍比特人的花园。",
    "dm_private_notes": "村口有可疑旅人套话。"
  }],
  "quests": [{
    "id": "main",
    "title": "密信",
    "player_visible_goal": "日出前送达绿龙酒馆。",
    "dm_private_goal": "收信人是游侠线人。",
    "status": "active"
  }],
  "important_npcs": [{
    "id": "sam",
    "name": "山姆",
    "personality": "忠诚朴实，有点唠叨。",
    "public_identity": "园丁，你的邻居。",
    "private_goal": "保护朋友。",
    "known_information": ["绿龙酒馆老板可靠"]
  }],
  "hidden_clues": [{
    "id": "clue_boot",
    "text": "旅人靴底有老林黑泥。",
    "related_entity_ids": ["stranger"],
    "reveal_condition": "DC 12 察觉或调查",
    "revealed": false
  }],
  "characters": [{
    "id": "player",
    "name": "玩家",
    "role": "player",
    "public_background": "夏尔霍比特人。",
    "stats": { "hp": 11, "max_hp": 11, "ac": 13, "attack_mod": 3 }
  }]
}
```

### monsters.json 示例

```json
{
  "monsters": [{
    "id": "goblin",
    "name": "哥布林",
    "cr": "1/4",
    "ac": 13,
    "hp": 7,
    "attack_mod": 4,
    "damage": "1d6+2",
    "player_visible": "矮小绿皮人，手持生锈短刀。",
    "dm_notes": "血量低时会逃跑。"
  }]
}
```

### 地图

路径 `instances/<slug>/maps/<场景id>.map.csv`，格式见 `skills/map/GUIDE.md`，在 `adventure.json` 的 `maps[]` 登记。构建时可 `update_scene` 预览。

### 字段可见性

**可写入 message / update_scene：** `premise`、`quests[].player_visible_goal`、`maps[].description`、`characters[].public_background`、`monsters[].player_visible`

**不可泄露：** 未揭示的 `hidden_clues`、`dm_private_notes`、`dm_private_goal`、NPC `private_goal`、`monsters[].dm_notes`

### 交付自检

- `opening_scene_id` 与地图 CSV 存在
- `important_npcs[].id` 唯一，必备文件齐全
- 至少 1 任务、1 地图、非空 `premise`

---

## Play：运行实例

实例路径 `skills/dnd/instances/<slug>/`。配合 primary 的 message、notify、update_scene。

### 开场顺序

1. 读取实例全部文件
2. `python skills/dnd/scripts/state.py init --instance <slug>`
3. 将 `characters` 写入 state（`state.py set`）
4. 对 `important_npcs`：`spawn_subagent(npc, …)`，记录 sessionId
5. `update_scene` 加载开场地图与 `mainQuest`
6. `message(sender_name="GM")` 开场，不剧透隐藏线索

### 掷骰（roll.py）

单行 JSON，禁止随意口算：

```bash
python skills/dnd/scripts/roll.py check --mod 3 --dc 13 --reason "察觉"
python skills/dnd/scripts/roll.py check --mod 3 --dc 13 --advantage --reason "察觉"
python skills/dnd/scripts/roll.py attack --attack-mod 5 --ac 15 --damage "1d8+3" --reason "长剑"
```

规则：d20 + 调整值 vs DC/AC；自然 20 大成功/重击，自然 1 大失败/失手。也可用 `skills/dice/dice.py`。

### 状态（state.py）

路径：`skills/dnd/instances/<slug>/runtime/state.json`

```bash
python skills/dnd/scripts/state.py init --instance <slug>
python skills/dnd/scripts/state.py get --instance <slug> --path party.0.hp
python skills/dnd/scripts/state.py set --instance <slug> --path party.0.hp --json 8
python skills/dnd/scripts/state.py dump --instance <slug>
```

初始：`{ "party": [], "quests": {}, "revealed_clues": [], "round": 0 }`。裁定后更新 state，再同步 `update_scene` 与 `message`。

### 游玩保密

未满足 `reveal_condition` 的线索不得公开；战斗前只描述 `player_visible`。

---

## 简化规则

采用简化 D&D 5e。社交默认无需掷骰；欺骗、洞察等 DC 通常 12～15。各实例可在 `rules.md` 补充种族特性等。
