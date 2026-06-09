---
name: dnd-runtime
description: DND play mode — startup, roll/state scripts, and scene flow. Do not use skills/dice.
---

# DND Runtime (Play Mode)

Load **`skill("map")`** for CSV maps and `update_scene`.

State file: `skills/dnd/instances/<slug>/runtime/state.json`

## Startup

1. Read all files in the active instance directory.
2. `bash`: `python skills/dnd/runtime/scripts/state.py init --instance <slug>`
3. Populate `party` in state from `adventure.json` `characters` if needed.
4. `spawn_subagent(npc, ...)` for each `important_npcs` entry (full character fields). **Save each returned `sessionId`.**
5. `update_scene` — `maps/opening.map.csv` if present, plus `mainQuest`, `playerCard`; set `characters[].sessionId` for spawned NPCs.
6. `message` — welcome; describe opening; no hidden clue spoilers.

## During play

| Situation | Tool |
|-----------|------|
| Check, save, attack, damage | `bash` → `roll.py` |
| HP, quests, revealed clues | `bash` → `state.py` |
| Read adventure / world / monsters | `read` |
| Map, quest UI, character card | `update_scene` (+ `skill("map")`) |
| Speak to player | `message` |
| Player talks to important NPC | **`notify`** with `expect_reply: true` — never put NPC dialogue in `message` |

### Player → NPC dialogue

When a player message addresses an NPC you spawned:

```
notify({
  content: "The player says to <Name>: \"<player text>\". <brief context>",
  targets: [{ session_id: "<saved sessionId>", expect_reply: true }]
})
```

The NPC replies in chat via its own `message` tool. Do not speak their lines as DM.

Loop: **state.py → update_scene → message** (GM narration only). Never use `skills/dice/`.

Never leak `hidden_clues` or DM-only fields until reveal conditions are met.

## roll.py

```bash
python skills/dnd/runtime/scripts/roll.py check --mod 3 --dc 13 --reason "Perception"
python skills/dnd/runtime/scripts/roll.py check --mod 3 --dc 13 --advantage
python skills/dnd/runtime/scripts/roll.py attack --attack-mod 5 --ac 15 --damage "1d8+3" --reason "Longsword"
```

## state.py

```bash
python skills/dnd/runtime/scripts/state.py init --instance <slug>
python skills/dnd/runtime/scripts/state.py get --instance <slug> --path party.0.hp
python skills/dnd/runtime/scripts/state.py set --instance <slug> --path party.0.hp --json 8
```

Initial shape after init: `{ "party": [], "quests": {}, "revealed_clues": [], "round": 0 }`

All scripts print **one line of JSON** to stdout.
