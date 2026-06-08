# DND Adventure Build Workflow

## 1. Slug

Choose a lowercase slug: `[a-z][a-z0-9_]*`, max 40 chars (e.g. `ring_adventure`).

## 2. Output path

`skills/dnd/instances/<slug>/`

## 3. Files to create

| File | Source |
|------|--------|
| `meta.json` | New — title, slug, theme, skill, status, created_at |
| `world.md` | From `builder/templates/world.md` |
| `adventure.json` | From `builder/templates/adventure.json` |
| `monsters.json` | From `builder/templates/monsters.json` |
| `rules.md` | From `builder/templates/rules.md` |
| `items.md` | From `builder/templates/items.md` |
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
spawn_subagent(review, "Review skills/dnd/instances/<slug>/ using skills/dnd/builder/review-checklist.md and schema.md")
```

Fix critical issues before delivery.

## 6. Deliver

`message` to player:

- Adventure title and one-line summary
- Review verdict
- **Type `/play <slug>` to start playing**

## Build mode restrictions

- Do NOT use `update_scene`
- Do NOT spawn `npc` subagents for play
