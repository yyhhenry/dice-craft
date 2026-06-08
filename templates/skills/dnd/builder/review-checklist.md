# DND Instance Review Checklist

Review all files under the given `skills/dnd/instances/<slug>/` path.

## Logic

- [ ] `opening_scene_id` references a map in `adventure.json`
- [ ] Quest IDs referenced in `hidden_clues.related_entity_ids` exist
- [ ] `important_npcs` IDs are unique

## Balance

- [ ] Monster HP/CR reasonable for party level in `characters` or default level 1
- [ ] Not more than 3 monsters for a minimal adventure

## Info leaks

- [ ] No `dm_private_*` or `hidden_clues` text copied into `premise` or `summary`
- [ ] `hidden_clues[].revealed` is false at build time

## Completeness

- [ ] `meta.json`, `world.md`, `adventure.json`, `monsters.json`, `rules.md`, `items.md` exist
- [ ] `adventure.json` has at least one quest and one map
- [ ] `premise` is non-empty

Output: Summary, Issues (Critical/Warning/Info), Verdict (Ready / Needs fixes).
