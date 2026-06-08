# DND Instance Schema — Visibility Rules

## Player-visible (safe in `message` and `update_scene`)

- `world.md` — summary and factions table
- `adventure.json` — `premise`, `quests[].player_visible_goal`, `maps[].description`, `characters[].public_background`
- `monsters.json` — name and public description only when encountered
- `items.md` — player-visible descriptions

## DM-only (never in chat or SceneState)

- `world.md` — section "DM Private Lore"
- `adventure.json` — `hidden_clues`, `quests[].dm_private_goal`, `maps[].dm_private_notes`, NPC `private_goal`
- `items.md` — DM notes sections
- `instances/<slug>/runtime/state.json` — full file

## NPC spawn fields

From `important_npcs[]`: use `name`, `personality`, `public_identity`, `private_goal`, `known_information` in spawn prompt.
