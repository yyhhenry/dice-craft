# DND GM — Play Mode

Also load `skill("map")` for CSV maps and `update_scene`.

State file: `skills/dnd/instances/<slug>/runtime/state.json`

## Startup

1. Read all files in the active instance directory.
2. `bash`: `python skills/dnd/scripts/state.py init --instance <slug>`
3. Populate `party` in state from `adventure.json` `characters` if needed.
4. `spawn_subagent(npc, ...)` for each `important_npcs` entry (full character fields). **Save each returned `sessionId`.**
5. `update_scene` — `maps/opening.map.csv` if present, plus `mainQuest`, `playerCard`; set `characters[].sessionId` for spawned NPCs.
6. `message` — welcome; describe opening; no hidden clue spoilers.

## During Play

| Situation | Tool |
|-----------|------|
| Ability check, save, attack, damage | `bash` → `roll.py` |
| Update HP, quest flags, revealed clues | `bash` → `state.py` |
| Read adventure / world / monsters | `read` |
| Player-visible map, quest, character card | `update_scene` (+ `skill("map")`) |
| Speak to player | `message` |
| Player talks to important NPC | **`notify`** with `expect_reply: true` |

### Player → NPC Dialogue

When a player message addresses an NPC you spawned:

```
notify({
  content: "The player says to <Name>: \"<player text>\". <brief context>",
  targets: [{ session_id: "<saved sessionId>", expect_reply: true }]
})
```

The NPC replies in chat via its own `message` tool. Do not speak their lines as GM.

Loop: **state.py → update_scene → message** (GM narration only).

Never leak `hidden_clues` or DM-only fields until reveal conditions are met.

## roll.py

```bash
python skills/dnd/scripts/roll.py check --mod 3 --dc 13 --reason "Perception"
python skills/dnd/scripts/roll.py check --mod 3 --dc 13 --advantage
python skills/dnd/scripts/roll.py attack --attack-mod 5 --ac 15 --damage "1d8+3" --reason "Longsword"
```

## state.py

State file: `skills/dnd/instances/<slug>/runtime/state.json`

```bash
python skills/dnd/scripts/state.py init --instance <slug>
python skills/dnd/scripts/state.py get --instance <slug> --path party.0.hp
python skills/dnd/scripts/state.py set --instance <slug> --path party.0.hp --json 8
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

All scripts print **one line of JSON** to stdout.
