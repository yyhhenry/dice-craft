---
name: dnd
description: DND adventures — build instances and play them with d20 scripts and scene maps.
---

# DND Skill

Build and play DND-style tabletop adventures. Also load `skill("map")` for CSV grid maps and `update_scene`.

## Modes

| Mode | Doc | When |
|------|-----|------|
| Build | `builder.md` | Creating a new adventure instance |
| Play (GM) | `gm.md` | Running a game session as DM |

## Directory Layout

```
skills/dnd/
├── SKILL.md            (this file)
├── builder.md          (build workflow, schema, checklist)
├── gm.md              (GM startup, tools, NPC flow)
├── templates/          (instance file skeletons)
├── instances/<slug>/   (one per adventure)
└── scripts/            (roll.py, state.py)
```

## Key Rules

- Scripts: `skills/dnd/scripts/` — **never** use `skills/dice/`
- State: `skills/dnd/instances/<slug>/runtime/state.json`
- Maps: CSV format per `skill("map")`
- NPC dialogue: always via `notify` → subagent, never speak NPC lines as GM
