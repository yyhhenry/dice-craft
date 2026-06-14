---
name: dice
description: Roll dice with standard notation (e.g. 2d6, 4d6kh3, 1d20+5). Supports advantage/disadvantage, keep highest/lowest, and modifiers.
---

# Dice Rolling

Roll dice using standard tabletop notation. Use this skill whenever a game mechanic requires random number generation.

## Usage

Run via bash:

```bash
python skills/dice/dice.py "2d6"
python skills/dice/dice.py "4d6kh3"
python skills/dice/dice.py "1d20+5"
python skills/dice/dice.py "2d20kh1"   # advantage
python skills/dice/dice.py "2d20kl1"   # disadvantage
```

## Notation

| Syntax | Meaning | Example |
|--------|---------|---------|
| `NdS` | Roll N dice with S sides | `2d6` → roll 2 six-sided dice |
| `NdS+M` | Roll and add modifier | `1d20+5` → roll 1d20, add 5 |
| `NdS-M` | Roll and subtract modifier | `1d4-1` → roll 1d4, subtract 1 |
| `NdSkhK` | Keep K highest | `4d6kh3` → roll 4, keep best 3 |
| `NdSklK` | Keep K lowest | `4d6kl1` → roll 4, keep lowest 1 |
| `NdSrhR` | Reroll R lowest (once) | `2d6rh1` → reroll any 1s once |

## Common Patterns

- **Ability scores**: `4d6kh3` (roll 4, keep highest 3)
- **Advantage**: `2d20kh1`
- **Disadvantage**: `2d20kl1`
- **Damage**: `2d6+3`
- **D20 check**: `1d20` or `1d20+modifier`

## Output Format

The script outputs JSON for easy parsing:

```json
{"notation": "4d6kh3", "rolls": [5, 3, 6, 2], "kept": [5, 6, 3], "modifier": 0, "total": 14}
```

## When to Use

- Player makes an attack roll, saving throw, or ability check
- Rolling for damage
- Any game mechanic that calls for randomness
- NPC or environmental events with uncertain outcomes

Always announce what is being rolled before calling the tool, then report the result to the player.
