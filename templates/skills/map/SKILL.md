---
name: map
description: CSV grid maps and update_scene — use when a game skill references maps or the scene canvas.
---

# Map Skill

Read **`skills/map/GUIDE.md`** for the full specification.

- **Build mode:** write `.map.csv` files only (no `update_scene`).
- **Play mode:** `update_scene` with `map.mapFile` pointing at a workspace CSV path.

Other game skills (e.g. `dnd-builder`) tell you **where** to store map files; this skill defines **how**.

Examples: `skills/map/examples/`
