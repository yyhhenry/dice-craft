#!/usr/bin/env python3
"""DND d20 roll utilities — outputs single-line JSON."""

from __future__ import annotations

import argparse
import json
import random
import re
import sys


def roll_die(sides: int, rng: random.Random) -> int:
    return rng.randint(1, sides)


def roll_d20(rng: random.Random, advantage: bool = False, disadvantage: bool = False) -> list[int]:
    if advantage and disadvantage:
        return [roll_die(20, rng)]
    if advantage:
        a, b = roll_die(20, rng), roll_die(20, rng)
        return [a, b] if a >= b else [b, a]
    if disadvantage:
        a, b = roll_die(20, rng), roll_die(20, rng)
        return [a, b] if a <= b else [b, a]
    return [roll_die(20, rng)]


def parse_damage(notation: str, rng: random.Random) -> tuple[list[int], int]:
    m = re.match(r"^(\d+)d(\d+)(?:([+-])(\d+))?$", notation.strip().lower())
    if not m:
        raise ValueError(f"Invalid damage notation: {notation!r}")
    num, sides = int(m.group(1)), int(m.group(2))
    mod = int(m.group(4) or 0)
    if m.group(3) == "-":
        mod = -mod
    rolls = [roll_die(sides, rng) for _ in range(num)]
    return rolls, sum(rolls) + mod


def cmd_check(args: argparse.Namespace, rng: random.Random) -> dict:
    rolls = roll_d20(rng, args.advantage, args.disadvantage)
    total = max(rolls) + args.mod
    out: dict = {
        "kind": "check",
        "rolls": rolls,
        "modifier": args.mod,
        "total": total,
        "reason": args.reason or None,
    }
    if args.dc is not None:
        out["dc"] = args.dc
        out["success"] = total >= args.dc
    return out


def cmd_attack(args: argparse.Namespace, rng: random.Random) -> dict:
    rolls = roll_d20(rng, args.advantage, args.disadvantage)
    attack_roll = max(rolls) + args.attack_mod
    hit = attack_roll >= args.ac
    out: dict = {
        "kind": "attack",
        "attack_rolls": rolls,
        "attack_modifier": args.attack_mod,
        "attack_total": attack_roll,
        "ac": args.ac,
        "hit": hit,
        "reason": args.reason or None,
    }
    if hit and args.damage:
        dmg_rolls, dmg_total = parse_damage(args.damage, rng)
        out["damage_rolls"] = dmg_rolls
        out["damage_total"] = dmg_total
        out["damage_notation"] = args.damage
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="DND roll utilities")
    sub = parser.add_subparsers(dest="command", required=True)

    p_check = sub.add_parser("check", help="d20 ability check or save")
    p_check.add_argument("--mod", type=int, default=0)
    p_check.add_argument("--dc", type=int, default=None)
    p_check.add_argument("--reason", type=str, default="")
    p_check.add_argument("--advantage", action="store_true")
    p_check.add_argument("--disadvantage", action="store_true")

    p_attack = sub.add_parser("attack", help="d20 attack vs AC")
    p_attack.add_argument("--attack-mod", type=int, required=True)
    p_attack.add_argument("--ac", type=int, required=True)
    p_attack.add_argument("--damage", type=str, default="")
    p_attack.add_argument("--reason", type=str, default="")
    p_attack.add_argument("--advantage", action="store_true")
    p_attack.add_argument("--disadvantage", action="store_true")

    args = parser.parse_args()
    rng = random.Random()

    if args.command == "check":
        result = cmd_check(args, rng)
    else:
        result = cmd_attack(args, rng)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
