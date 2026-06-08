---
name: dnd
description: DND-style tabletop adventures — builder rules, per-session instances, and runtime scripts under skills/dnd/.
---

# DND Skill Package

| Directory | Purpose |
|-----------|---------|
| `builder/` | Static build rules, templates, schema, review checklist → use skill `dnd-builder` |
| `instances/<slug>/` | Per-adventure content (Builder writes new slugs; `example_ring` is a built-in demo) |
| `instances/<slug>/runtime/` | Per-game save state (`state.json`), created when DM runs `state.py init` |
| `runtime/` | Shared play-time scripts (roll/state) → use skill `dnd-runtime` |

**Paths are under your workspace** (`data/workspaces/<id>/skills/dnd/`), not the repo `templates/` folder.

Do **not** use `skills/dice/` for DND — use `skills/dnd/runtime/scripts/` instead.

Try the demo: `/play example_ring`
