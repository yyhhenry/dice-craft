---
name: dice
description: "桌面骰子工具。掷骰、DND 检定、攻击判定、生命值计算。使用 bash 执行 dice.py 时加载。"
---

# Dice Skill — 桌面骰子工具

使用 `bash` 执行 `dice.py` 进行骰子掷骰。脚本位于 `templates/skills/dice/dice.py`（workspace 内为 `skills/dice/dice.py`）。

## 基础掷骰

```bash
python3 skills/dice/dice.py "2d6"       # 掷 2 个六面骰
python3 skills/dice/dice.py "1d20+5"    # 掷 1 个二十面骰 +5 修正
python3 skills/dice/dice.py "4d6kh3"    # 掷 4 个六面骰，保留最高的 3 个
python3 skills/dice/dice.py "2d20kh1"   # 优势骰（取高）
python3 skills/dice/dice.py "2d20kl1"   # 劣势骰（取低）
python3 skills/dice/dice.py "2d6rh1"    # 掷 2d6，≤1 的骰子重掷一次
```

输出 JSON：`{"notation": "2d6", "rolls": [3, 5], "kept": [3, 5], "modifier": 0, "total": 8}`

## 语法速查

| 语法 | 含义 | 示例 |
|------|------|------|
| `NdS` | N 个 S 面骰 | `1d20`、`3d6` |
| `NdS+M` / `NdS-M` | 加/减修正值 | `1d20+5`、`2d6-1` |
| `NdSkhK` | 保留最高 K 个 | `4d6kh3`（DND 属性骰） |
| `NdSklK` | 保留最低 K 个 | `2d20kl1`（劣势） |
| `NdSrhR` | ≤R 的骰子重掷一次 | `2d6rh1` |

## DND 检定规则

### 三种掷骰类型

| 类型 | 公式 | 何时使用 |
|------|------|----------|
| **攻击检定** | `1d20+攻击修正` | 角色发起攻击时，对抗目标 AC |
| **属性检定** | `1d20+属性调整值+熟练加值` | 尝试做某事（攀爬、说服、调查等） |
| **豁免检定** | `1d20+属性调整值+熟练加值` | 抵抗效果（毒药、法术、陷阱等） |

### 检定判定流程

```
掷骰结果 vs 目标值（DC 或 AC）
  ≥ 目标值 → 成功
  < 目标值 → 失败
  自然 20（骰面本身出 20）→ 大成功：攻击自动命中，检定视为最佳可能结果
  自然 1（骰面本身出 1）→ 大失败：攻击自动未中，检定视为最差可能结果
```

**执行检定时的掷骰命令：**

```bash
# 普通检定（目标 DC 15，修正 +3）
python3 skills/dice/dice.py "1d20+3"

# 优势检定（有优势时）
python3 skills/dice/dice.py "2d20kh1+3"

# 劣势检定（有劣势时）
python3 skills/dice/dice.py "2d20kl1+3"

# 带 DC 自动判定（输出含 success/outcome 字段）
python3 skills/dice/dice.py "1d20+6" --dc 15

# 攻击判定（对抗 AC）
python3 skills/dice/dice.py "1d20+6" --ac 16
```

### 难度等级（DC）参考

| DC | 难度 | 示例 |
|----|------|------|
| 5 | 极简单 | 注意到明显的声音 |
| 10 | 简单 | 攀爬粗糙的墙壁 |
| 15 | 中等 | 解开简单锁具 |
| 20 | 困难 | 在暴风雪中辨认方向 |
| 25 | 极难 | 徒手撬开铁门 |
| 30 | 近乎不可能 | 在沉默中说服狂热信徒 |

### 攻击与 AC（护甲等级）

攻击检定对抗目标 AC，无需指定 DC：

```bash
# 近战攻击（力量修正 +4，熟练加值 +2）
python3 skills/dice/dice.py "1d20+6"

# 远程攻击（敏捷修正 +3，熟练加值 +2）
python3 skills/dice/dice.py "1d20+5"

# 带 AC 自动判定
python3 skills/dice/dice.py "1d20+6" --ac 16

# 掷出自然 20 → 大成功，伤害骰翻倍
# 掷出自然 1 → 大失败，必然未中
```

**AC 参考：** 裸体 10、皮甲 11+DEX、链甲 16、板甲 18

### 伤害掷骰

命中后掷伤害：

```bash
# 长剑（1d8+力量修正）
python3 skills/dice/dice.py "1d8+4"

# 火球术（8d6，大成功翻倍为 16d6）
python3 skills/dice/dice.py "8d6"

# 匕首（1d4+敏捷修正）
python3 skills/dice/dice.py "1d4+3"
```

### 生命值

```bash
# 1 级战士（10 + 体质修正）
python3 skills/dice/dice.py "1d10+2"

# 升级时的生命骰恢复
python3 skills/dice/dice.py "1d10+2"
```

## 熟练加值参考

| 角色等级 | 熟练加值 |
|----------|----------|
| 1-4 | +2 |
| 5-8 | +3 |
| 9-12 | +4 |
| 13-16 | +5 |
| 17-20 | +6 |

## 属性调整值

| 属性值 | 调整值 |
|--------|--------|
| 1 | -5 |
| 2-3 | -4 |
| 4-5 | -3 |
| 6-7 | -2 |
| 8-9 | -1 |
| 10-11 | +0 |
| 12-13 | +1 |
| 14-15 | +2 |
| 16-17 | +3 |
| 18-19 | +4 |
| 20 | +5 |

## 使用约定

- 掷骰结果由 GM（builder agent）判定，NPC 和玩家角色都使用同一套规则
- 大成功/大失败只适用于 d20 掷骰（攻击、检定、豁免），不适用于伤害骰
- 掷骰结果对玩家透明：告诉玩家骰了多少、修正多少、最终多少、成功还是失败
