---
name: dnd-runtime
description: DND play-time tools — d20 rolls and runtime state updates. Do not use skills/dice.
---

# DND Runtime Tools

Read `skills/dnd/runtime/RUNTIME.md` for when to use scripts vs file tools.

Scripts (via `bash`):

- `skills/dnd/runtime/scripts/roll.py` — checks, attacks, damage
- `skills/dnd/runtime/scripts/state.py` — read/write `skills/dnd/instances/<slug>/runtime/state.json`

All scripts print **one line of JSON** to stdout.
