# DND Builder — Build Mode

Load `skill("map")` when creating `maps/*.map.csv` files.

## 1. Slug

Choose a lowercase slug: `[a-z][a-z0-9_]*`, max 40 chars (e.g. `ring_adventure`).

## 2. Output path

`skills/dnd/instances/<slug>/`

## 3. Build Loop — 边建边展示

For each scene/map in the adventure, repeat this cycle:

1. **Create files** — write the map CSV + related data (monsters, items, NPCs for this scene)
2. **Preview** — `update_scene` with `map.mapFile` pointing at the new map, place relevant characters on grid
3. **Describe** — `message` to player: scene name, what's here, key NPCs present, atmosphere

Do NOT wait for user confirmation between scenes — keep building. The user sees each scene flash by as a progress indicator.

### File creation order

| Step | Files | Preview |
|------|-------|---------|
| Instance skeleton | `meta.json`, `world.md`, `rules.md`, `items.md` | message: 世界观概述 |
| Adventure structure | `adventure.json` | message: 任务概览 |
| Scene 1 (opening) | `maps/opening.map.csv`, monsters/NPCs for scene | update_scene + message |
| Scene 2..N | `maps/<name>.map.csv`, related data | update_scene + message |

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

Run through **Section 9 (Review Checklist)** yourself. Fix critical issues.

Only spawn a separate review subagent when:
- The instance is complex (3+ quests, 5+ NPCs, multiple maps)
- The user explicitly asks for a thorough review

```
spawn_subagent(review, "Review skills/dnd/instances/<slug>/ using the checklist in skills/dnd/builder.md section 9")
```

## 6. Deliver

`message` to player:

- Adventure ready — title and one-line summary
- Scene count and highlights
- Any issues found during review
- Ask if the user wants adjustments or is ready to play

## 7. Build mode restrictions

- Do NOT spawn `npc` subagents (no play-mode dialogue during build)
- `update_scene` is used for preview only — show maps and NPC placement as you build

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
