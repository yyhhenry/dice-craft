#!/usr/bin/env python3
"""Dice roller with standard tabletop notation.

Usage:
    python dice.py "2d6"
    python dice.py "4d6kh3"
    python dice.py "1d20+5"
    python dice.py "2d20kh1"    # advantage
    python dice.py "2d20kl1"    # disadvantage
    python dice.py "2d6rh1"     # reroll 1s once
    python dice.py "1d20+6" --dc 15   # check against DC 15
    python dice.py "1d20+6" --ac 16   # attack against AC 16
"""

import argparse
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


def _parse_dice(notation: str) -> list[tuple[int, int]]:
    """Parse NdS notation and return list of (num, sides) tuples."""
    pattern = r"^(\d+)d(\d+)"
    m = re.match(pattern, notation.strip().lower())
    if not m:
        return []
    return [(int(m.group(1)), int(m.group(2)))]


def main():
    parser = argparse.ArgumentParser(description="Dice roller with DND check support")
    parser.add_argument("notation", help="Dice notation (e.g. 1d20+5, 2d6kh1)")
    parser.add_argument("--dc", type=int, help="Difficulty Class for ability/save checks")
    parser.add_argument("--ac", type=int, help="Armor Class for attack rolls")
    args = parser.parse_args()

    try:
        result = parse_and_roll(args.notation)
    except ValueError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

    # Determine raw d20 value for crit detection (before modifiers)
    is_d20 = any(s == 20 for _, s in _parse_dice(args.notation))
    if is_d20 and result["rolls"]:
        raw_d20 = result["rolls"][0]  # first d20 roll (before kh/kl filter)
        result["natural"] = raw_d20
        result["critical_success"] = raw_d20 == 20
        result["critical_failure"] = raw_d20 == 1

    target = args.dc or args.ac
    if target is not None:
        check_type = "attack" if args.ac else "check"
        if result.get("critical_success"):
            result["outcome"] = "critical_success"
            result["success"] = True
        elif result.get("critical_failure"):
            result["outcome"] = "critical_failure"
            result["success"] = False
        else:
            result["success"] = result["total"] >= target
            result["outcome"] = "success" if result["success"] else "failure"
        result["target"] = target
        result["check_type"] = check_type

    print(json.dumps(result))


if __name__ == "__main__":
    main()
