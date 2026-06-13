# DND 构建模式

创建地图时加载 `skill("map")`。

## 1. Slug

选择小写 slug：`[a-z][a-z0-9_]*`，最多 40 字符（如 `ring_adventure`）。

## 2. 输出路径

`skills/dnd/instances/<slug>/`

## 3. 构建循环 — 边建边展示

对冒险中的每个场景/地图，重复此循环：

1. **创建文件** — 写 map CSV + 相关数据（怪物、物品、NPC）
2. **预览** — `update_scene` 指向新地图，放置相关角色到网格
3. **描述** — `message` 告诉玩家：场景名、这里有什么、关键 NPC、氛围

不用等用户确认每个场景——持续构建。用户会看到每个场景闪过作为进度指示。

### 文件创建顺序

| 步骤 | 文件 | 预览 |
|------|------|------|
| 实例骨架 | `meta.json`、`world.md`、`rules.md`、`items.md` | message: 世界观概述 |
| 冒险结构 | `adventure.json` | message: 任务概览 |
| 场景 1（开场） | `maps/opening.map.csv`、怪物/NPC | update_scene + message |
| 场景 2..N | `maps/<name>.map.csv`、相关数据 | update_scene + message |

## 4. meta.json

```json
{
  "slug": "<slug>",
  "title": "冒险标题",
  "theme": "主题风格",
  "skill": "dnd",
  "status": "ready",
  "created_at": "<ISO8601>"
}
```

## 5. 审查

自己过一遍**第 9 节（审查清单）**。修复严重问题。

只在以下情况创建审查子 agent：
- 实例很复杂（3+ 任务、5+ NPC、多张地图）
- 用户明确要求彻底审查

```
spawn_subagent(review, "审查 skills/dnd/instances/<slug>/，使用 skills/dnd/builder.md 第 9 节的检查清单")
```

## 6. 交付

`message` 告诉玩家：

- 冒险准备好了 — 标题和一行总结
- 场景数量和亮点
- 审查中发现的问题
- 询问是否要调整或准备开始游戏

## 7. Build 模式限制

- 不要创建 `npc` 子 agent（构建时没有游玩对话）
- `update_scene` 仅用于预览——展示地图和 NPC 位置

---

## 8. 字段可见性（Schema）

### 玩家可见（可以出现在 `message` 和 `update_scene` 中）

- `world.md` — 概要和阵营表
- `adventure.json` — `premise`、`quests[].player_visible_goal`、`maps[].description`、`characters[].public_background`
- `monsters.json` — 遇到时只显示名字和公开描述
- `items.md` — 玩家可见描述

### 仅 DM 可见（绝不出现在聊天或 SceneState 中）

- `world.md` — "DM 私密设定" 部分
- `adventure.json` — `hidden_clues`、`quests[].dm_private_goal`、`maps[].dm_private_notes`、NPC `private_goal`
- `items.md` — DM 备注部分
- `instances/<slug>/runtime/state.json` — 全部内容

### NPC spawn 字段

从 `important_npcs[]` 中使用：`name`、`personality`、`public_identity`、`private_goal`、`known_information` 放入 spawn prompt。

---

## 9. 审查清单

审查给定 `skills/dnd/instances/<slug>/` 路径下的所有文件。

### 逻辑

- [ ] `opening_scene_id` 引用了 `adventure.json` 中存在的地图
- [ ] `hidden_clues.related_entity_ids` 引用的任务 ID 存在
- [ ] `important_npcs` ID 唯一

### 平衡

- [ ] 怪物 HP/CR 对队伍等级合理
- [ ] 最小冒险不超过 3 个怪物

### 信息泄露

- [ ] 没有把 `dm_private_*` 或 `hidden_clues` 文本复制到 `premise` 或 `summary`
- [ ] `hidden_clues[].revealed` 在构建时为 false

### 完整性

- [ ] `meta.json`、`world.md`、`adventure.json`、`monsters.json`、`rules.md`、`items.md` 存在
- [ ] `adventure.json` 至少有一个任务和一张地图
- [ ] `premise` 非空

输出：摘要、问题（严重/警告/信息）、结论（就绪 / 需要修复）。
