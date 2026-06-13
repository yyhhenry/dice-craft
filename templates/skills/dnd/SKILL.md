---
name: dnd
description: "DND/TRPG 冒险创建与游玩。提供构建工作流、GM 游玩模式、d20 脚本、NPC 子 agent 流程、场景集成。"
---

# DND 技能

构建和游玩 DND 风格的桌游冒险。同时加载 `skill("map")` 获取 CSV 网格地图和 `update_scene` 规则。

## 模式

**默认 Build 模式。** 只有用户明确说要玩/开始（如"开始玩"、"play"）时才进入 Play 模式。

| 模式 | 文档 | 触发条件 |
|------|------|----------|
| Build | `builder.md` | 默认 — 创建或编辑冒险内容 |
| Play (GM) | `gm.md` | 用户明确说要开始游戏 |

## 目录结构

```
skills/dnd/
├── SKILL.md            (本文件)
├── builder.md          (构建工作流、schema、检查清单)
├── gm.md              (GM 启动、工具、NPC 流程)
├── instances/<slug>/   (每个冒险一个，参考 example_ring)
└── scripts/            (roll.py, state.py)
```

## 关键规则

- 脚本：`skills/dnd/scripts/`（roll.py, state.py）
- 状态：`skills/dnd/instances/<slug>/runtime/state.json`
- 地图：CSV 格式，参见 `skill("map")`
- NPC 对话：总是通过 `notify` → 收到回应后用 `message(sender_name="角色名")` 转发
