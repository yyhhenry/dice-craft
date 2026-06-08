# DND Runtime — Tool Usage

## When to use scripts

| Situation | Tool |
|-----------|------|
| Ability check, save, attack, damage | `bash` → `roll.py` |
| Update HP, quest flags, revealed clues | `bash` → `state.py` |
| Read adventure / world / monsters | `read` |
| Player-visible map, quest, character card | `update_scene` |
| Speak to player | `message` |

## roll.py

```bash
python skills/dnd/runtime/scripts/roll.py check --mod 3 --dc 13 --reason "Perception"
python skills/dnd/runtime/scripts/roll.py check --mod 3 --dc 13 --advantage
python skills/dnd/runtime/scripts/roll.py attack --attack-mod 5 --ac 15 --damage "1d8+3" --reason "Longsword"
```

## state.py

State file: `skills/dnd/instances/<slug>/runtime/state.json`

```bash
python skills/dnd/runtime/scripts/state.py init --instance ring_adventure
python skills/dnd/runtime/scripts/state.py get --instance ring_adventure --path party.0.hp
python skills/dnd/runtime/scripts/state.py set --instance ring_adventure --path party.0.hp --json 8
```

## Initial state shape (after init)

```json
{
  "party": [],
  "quests": {},
  "revealed_clues": [],
  "round": 0
}
```

Populate `party` from `adventure.json` characters on first init.
