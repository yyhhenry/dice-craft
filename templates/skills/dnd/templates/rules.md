# Rules (minimal d20)

Use **DND runtime scripts**:

```bash
python skills/dnd/runtime/scripts/roll.py check --mod MOD --dc DC --reason "Reason"
python skills/dnd/runtime/scripts/state.py get --instance SLUG --path party.0.hp
python skills/dnd/runtime/scripts/state.py set --instance SLUG --path party.0.hp --json 8
```

## Ability Checks

Roll `1d20 + modifier` vs DC: Easy 10, Medium 13, Hard 16, Very Hard 20.

## Combat (simplified)

1. Initiative: `roll.py check --mod DEX_MOD`
2. Attack: `roll.py attack --attack-mod N --ac AC --damage "1d8+3"`
3. Track HP via `state.py`

## Advantage / Disadvantage

Add `--advantage` or `--disadvantage` to `roll.py check`.
