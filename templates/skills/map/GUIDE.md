# Map & Scene Canvas Guide

## CSV format

One terrain token per cell, comma-separated rows.

### Comments

Lines starting with `#` are ignored by the parser. Use them for:

- Map title and dimensions (`# 标准酒馆` / `# 6x6 standard tavern`)
- Suggested overlay positions (`# overlay: door at 2,0 — south entrance`)
- Notes for the GM (`# players enter from the bottom`)

```
# 标准酒馆
# 6x6 standard tavern with bar counter
# overlay: door at 2,5 — main entrance
wall,wall,wall,wall,wall,wall
wall,wood,wood,wood,wood,wall
wall,wood,dirt,dirt,wood,wall
wall,wall,wall,wall,wall,wall
```

### Terrain tokens

`wall`, `grass`, `stone`, `wood`, `dirt`, `sand`, `water`, `lava`, `ice`, `void` (empty cell = void).

Shade variants: `.dark` or `.light` (e.g. `wood.dark`, `stone.light`).

**Size:** 6×6 to 12×12; keep every row the same width.

## Build mode

Write files only — **do not** call `update_scene`.

Store paths are defined by each game skill. Common patterns:

| Pattern | Path |
|---------|------|
| Instance pack (DND) | `skills/<pack>/instances/<slug>/maps/<name>.map.csv` |
| Skill-level | `skills/<pack>/maps/<name>.map.csv` |
| Scratch | `.game-state/<name>.map.csv` |

## Play mode

1. `write` / `edit` the CSV if needed.
2. `update_scene` with workspace-relative `map.mapFile`.

### update_scene rules

- **`map.mapFile`** — parses CSV into grid cells.
- **`characters`**, **`map.overlays`**, **`map.labels`**, **`mainQuest`** — **full replacement** when provided; pass every item you want kept.
- Switching scenes: clear stale `characters` / `mainQuest` if starting fresh.
- **Never** put GM-only secrets into scene fields or map labels.

### Overlays

`type`: `door`, `chest`, `trap`, `stairs`, `marker` — `id`, `x`, `y`, optional `label`.

### Characters on grid

`location`: `"x,y"`; `role`: `player` | `npc` | `enemy` | `ally` | `neutral`; `hidden: true` hides token; `sessionId` links NPC subagent.

See `skills/map/examples/opening-scene.patch.json` for a full payload example.
