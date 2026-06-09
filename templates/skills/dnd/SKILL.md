---
name: dnd
description: DND adventures — build instances, play with dnd-runtime + map skills.
---

# DND Package

| When | Skill | Doc |
|------|-------|-----|
| Build | `dnd-builder` | `skills/dnd/builder/BUILD.md` |
| Play | `dnd-runtime` | `skills/dnd/runtime/SKILL.md` |
| Maps (either mode) | `map` | `skills/map/GUIDE.md` |

- Instances: `skills/dnd/instances/<slug>/` (demo: `example_ring`)
- Per-game state: `instances/<slug>/runtime/state.json`
- Scripts: `skills/dnd/runtime/scripts/` — **not** `skills/dice/`

Workspace path: `data/workspaces/<id>/skills/dnd/`. Start demo: `/play example_ring`
