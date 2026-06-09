# DND Builder — Build Mode

Load `skill("map")` when creating `maps/*.map.csv` files.

## 1. Slug

Choose a lowercase slug: `[a-z][a-z0-9_]*`, max 40 chars (e.g. `ring_adventure`).

## 2. Output path

`skills/dnd/instances/<slug>/`

## 3. Files to create

| File | Source |
|------|--------|
| `meta.json` | New — title, slug, theme, skill, status, created_at |
| `world.md` | From `skills/dnd/templates/world.md` |
| `adventure.json` | From `skills/dnd/templates/adventure.json` |
| `monsters.json` | From `skills/dnd/templates/monsters.json` |
| `rules.md` | From `skills/dnd/templates/rules.md` |
| `items.md` | From `skills/dnd/templates/items.md` |
| `maps/opening.map.csv` | Optional 6×6 to 10×10 CSV map |

## 4. meta.json

```json
{
  "slug": "<slug>",
  "title": "Adventure Title",
  "theme": "player theme e.g. lord_of_the_rings_style",
  "skill": "dnd",
  "status": "ready",
  "created_at": "<ISO8601>"
}
```

## 5. Review

```
spawn_subagent(review, "Review skills/dnd/instances/<slug>/ using the checklist in skills/dnd/builder.md section 8")
```

Fix critical issues before delivery.

## 6. Deliver

`message` to player:

- Adventure title and one-line summary
- Review verdict
- **Type `/play <slug>` to start playing**

## 7. Build mode restrictions

- Do NOT use `update_scene`
- Do NOT spawn `npc` subagents for play

---

## 8. Field Visibility (Schema)

### Player-visible (safe in `message` and `update_scene`)

- `world.md` — summary and factions table
- `adventure.json` — `premise`, `quests[].player_visible_goal`, `maps[].description`, `characters[].public_background`
- `monsters.json` — name and public description only when encountered
- `items.md` — player-visible descriptions

### DM-only (never in chat or SceneState)

- `world.md` — section "DM Private Lore"
- `adventure.json` — `hidden_clues`, `quests[].dm_private_goal`, `maps[].dm_private_notes`, NPC `private_goal`
- `items.md` — DM notes sections
- `instances/<slug>/runtime/state.json` — full file

### NPC spawn fields

From `important_npcs[]`: use `name`, `personality`, `public_identity`, `private_goal`, `known_information` in spawn prompt.

---

## 9. Review Checklist

Review all files under the given `skills/dnd/instances/<slug>/` path.

### Logic

- [ ] `opening_scene_id` references a map in `adventure.json`
- [ ] Quest IDs referenced in `hidden_clues.related_entity_ids` exist
- [ ] `important_npcs` IDs are unique

### Balance

- [ ] Monster HP/CR reasonable for party level in `characters` or default level 1
- [ ] Not more than 3 monsters for a minimal adventure

### Info leaks

- [ ] No `dm_private_*` or `hidden_clues` text copied into `premise` or `summary`
- [ ] `hidden_clues[].revealed` is false at build time

### Completeness

- [ ] `meta.json`, `world.md`, `adventure.json`, `monsters.json`, `rules.md`, `items.md` exist
- [ ] `adventure.json` has at least one quest and one map
- [ ] `premise` is non-empty

Output: Summary, Issues (Critical/Warning/Info), Verdict (Ready / Needs fixes).
