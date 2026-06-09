# DND Adventure — Build Guide

Load **`skill("map")`** when creating `maps/*.map.csv` files.

Output: `skills/dnd/instances/<slug>/`

## 1. Slug

Lowercase `[a-z][a-z0-9_]*`, max 40 chars (e.g. `ring_adventure`).

## 2. Files to create

| File | Source |
|------|--------|
| `meta.json` | New — see below |
| `world.md` | `builder/templates/world.md` |
| `adventure.json` | `builder/templates/adventure.json` |
| `monsters.json` | `builder/templates/monsters.json` |
| `rules.md` | `builder/templates/rules.md` |
| `items.md` | `builder/templates/items.md` |
| `maps/opening.map.csv` | Optional 6×6–10×10; see **Maps** below |

### meta.json

```json
{
  "slug": "<slug>",
  "title": "Adventure Title",
  "theme": "lord_of_the_rings_style",
  "skill": "dnd",
  "status": "ready",
  "created_at": "<ISO8601>"
}
```

## 3. Maps

- Directory: `skills/dnd/instances/<slug>/maps/`
- CSV format: **`skill("map")`** → `skills/map/GUIDE.md`
- Link in `adventure.json`:

```json
{
  "opening_scene_id": "scene_start",
  "maps": [
    {
      "id": "scene_start",
      "name": "Starting Location",
      "kind": "scene",
      "description": "Player-visible description",
      "dm_private_notes": "Secrets"
    }
  ]
}
```

`opening_scene_id` must match a `maps[].id`. Add more maps + CSV files as needed.

## 4. Field visibility

**Player-visible** (safe in `message` / `update_scene`):

- `world.md` summary; `adventure.json` `premise`, `quests[].player_visible_goal`, `maps[].description`, `characters[].public_background`
- `monsters.json` public descriptions; `items.md` player text

**DM-only** (never in chat or SceneState):

- `world.md` "DM Private Lore"; `hidden_clues`; `quests[].dm_private_goal`; `maps[].dm_private_notes`; NPC `private_goal`; `runtime/state.json`

**NPC spawn:** from `important_npcs[]` pass `name`, `personality`, `public_identity`, `private_goal`, `known_information`.

## 5. Quality check (self-review)

Read this checklist before delivery. **Do not** spawn `review` unless the **player asks** for a formal review.

### Logic

- [ ] `opening_scene_id` references a map in `adventure.json`
- [ ] Quest IDs in `hidden_clues.related_entity_ids` exist
- [ ] `important_npcs` IDs are unique

### Balance

- [ ] Monster HP/CR reasonable for party level (default level 1)
- [ ] At most ~3 monsters for a minimal adventure

### Info leaks

- [ ] No `dm_private_*` or `hidden_clues` in `premise` or player summaries
- [ ] `hidden_clues[].revealed` is false at build time

### Completeness

- [ ] `meta.json`, `world.md`, `adventure.json`, `monsters.json`, `rules.md`, `items.md` exist
- [ ] At least one quest and one map in `adventure.json`
- [ ] `premise` is non-empty

If the player requests review: `spawn_subagent(review, "Review skills/dnd/instances/<slug>/ using the checklist in skills/dnd/builder/BUILD.md section 5")`

## 6. Deliver

`message` to player:

- Adventure title and one-line summary
- Note any known gaps from your self-check
- **`/play <slug>`** to start

## Restrictions

- Do **not** use `update_scene` or spawn `npc` subagents in build mode.
