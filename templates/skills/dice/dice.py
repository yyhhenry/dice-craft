#!/usr/bin/env python3
"""Dice roller with standard tabletop notation.

Usage:
    python dice.py "2d6"
    python dice.py "4d6kh3"
    python dice.py "1d20+5"
    python dice.py "2d20kh1"    # advantage
    python dice.py "2d20kl1"    # disadvantage
    python dice.py "2d6rh1"     # reroll 1s once
"""

import json
import random
import re
import sys


def parse_and_roll(notation: str, rng: random.Random | None = None) -> dict:
    """Parse dice notation and roll.

    Supported: NdS, NdS+M, NdS-M, NdSkhK, NdSklK, NdSrhR
    """
    r = rng or random.Random()

    pattern = r"^(\d+)d(\d+)(?:kh(\d+))?(?:kl(\d+))?(?:rh(\d+))?(?:([+-])(\d+))?$"
    m = re.match(pattern, notation.strip().lower())
    if not m:
        raise ValueError(f"Invalid dice notation: {notation!r}")

    num = int(m.group(1))
    sides = int(m.group(2))
    keep_high = int(m.group(3)) if m.group(3) else None
    keep_low = int(m.group(4)) if m.group(4) else None
    reroll_at_most = int(m.group(5)) if m.group(5) else None
    mod_sign = m.group(6)
    mod_val = int(m.group(7)) if m.group(7) else 0

    if num < 1 or num > 100:
        raise ValueError(f"Number of dice must be 1-100, got {num}")
    if sides < 2 or sides > 1000:
        raise ValueError(f"Sides must be 2-1000, got {sides}")

    # Roll all dice
    rolls = [r.randint(1, sides) for _ in range(num)]

    # Reroll lowest dice that are <= threshold (once)
    if reroll_at_most is not None:
        rolls = [r.randint(1, sides) if v <= reroll_at_most else v for v in rolls]

    # Determine which dice to keep
    kept = list(rolls)
    if keep_high is not None:
        kept = sorted(rolls, reverse=True)[:keep_high]
    elif keep_low is not None:
        kept = sorted(rolls)[:keep_low]

    modifier = mod_val if mod_sign == "+" else -mod_val if mod_sign == "-" else 0
    total = sum(kept) + modifier

    return {
        "notation": notation,
        "rolls": rolls,
        "kept": kept,
        "modifier": modifier,
        "total": total,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: dice.py <notation>"}))
        sys.exit(1)

    notation = sys.argv[1]
    try:
        result = parse_and_roll(notation)
        print(json.dumps(result))
    except ValueError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
