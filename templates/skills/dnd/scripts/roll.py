#!/usr/bin/env python3
"""DND 掷骰：检定与攻击，输出单行 JSON。

用法:
    python roll.py check --mod 3 --dc 13 --reason "察觉"
    python roll.py check --mod 3 --dc 13 --advantage --reason "察觉"
    python roll.py attack --attack-mod 5 --ac 15 --damage "1d8+3" --reason "长剑"
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys


def _roll_d20(rng: random.Random, advantage: bool, disadvantage: bool) -> tuple[int, list[int]]:
    if advantage and disadvantage:
        advantage = disadvantage = False
    if advantage:
        rolls = [rng.randint(1, 20), rng.randint(1, 20)]
        return max(rolls), rolls
    if disadvantage:
        rolls = [rng.randint(1, 20), rng.randint(1, 20)]
        return min(rolls), rolls
    v = rng.randint(1, 20)
    return v, [v]


def _parse_damage(notation: str, rng: random.Random) -> dict:
    m = re.match(r"^(\d+)d(\d+)(?:([+-])(\d+))?$", notation.strip().lower())
    if not m:
        raise ValueError(f"Invalid damage notation: {notation!r}")
    num, sides = int(m.group(1)), int(m.group(2))
    rolls = [rng.randint(1, sides) for _ in range(num)]
    mod = 0
    if m.group(3):
        mod = int(m.group(4)) if m.group(3) == "+" else -int(m.group(4))
    total = sum(rolls) + mod
    return {"notation": notation, "rolls": rolls, "modifier": mod, "total": total}


def cmd_check(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    natural, d20_rolls = _roll_d20(rng, args.advantage, args.disadvantage)
    total = natural + args.mod
    result: dict = {
        "check_type": "check",
        "reason": args.reason or "",
        "modifier": args.mod,
        "natural": natural,
        "d20_rolls": d20_rolls,
        "total": total,
        "target": args.dc,
        "advantage": bool(args.advantage),
        "disadvantage": bool(args.disadvantage),
    }
    if natural == 20:
        result["outcome"] = "critical_success"
        result["success"] = True
    elif natural == 1:
        result["outcome"] = "critical_failure"
        result["success"] = False
    else:
        result["success"] = total >= args.dc
        result["outcome"] = "success" if result["success"] else "failure"
    print(json.dumps(result, ensure_ascii=False))


def cmd_attack(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)
    natural, d20_rolls = _roll_d20(rng, args.advantage, args.disadvantage)
    attack_total = natural + args.attack_mod
    result: dict = {
        "check_type": "attack",
        "reason": args.reason or "",
        "attack_modifier": args.attack_mod,
        "natural": natural,
        "d20_rolls": d20_rolls,
        "attack_total": attack_total,
        "ac": args.ac,
        "advantage": bool(args.advantage),
        "disadvantage": bool(args.disadvantage),
    }
    if natural == 20:
        result["hit"] = True
        result["outcome"] = "critical_hit"
    elif natural == 1:
        result["hit"] = False
        result["outcome"] = "critical_miss"
    else:
        result["hit"] = attack_total >= args.ac
        result["outcome"] = "hit" if result["hit"] else "miss"

    if result["hit"] and args.damage:
        dmg = _parse_damage(args.damage, rng)
        if result["outcome"] == "critical_hit":
            extra = _parse_damage(args.damage, rng)
            dmg["rolls"] = dmg["rolls"] + extra["rolls"]
            dmg["total"] = dmg["total"] + extra["total"] - extra["modifier"]
            dmg["critical_extra"] = extra["rolls"]
        result["damage"] = dmg

    print(json.dumps(result, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="DND roll helper")
    sub = parser.add_subparsers(dest="command", required=True)

    p_check = sub.add_parser("check")
    p_check.add_argument("--mod", type=int, default=0)
    p_check.add_argument("--dc", type=int, required=True)
    p_check.add_argument("--advantage", action="store_true")
    p_check.add_argument("--disadvantage", action="store_true")
    p_check.add_argument("--reason", default="")
    p_check.add_argument("--seed", type=int, default=None)
    p_check.set_defaults(func=cmd_check)

    p_atk = sub.add_parser("attack")
    p_atk.add_argument("--attack-mod", type=int, default=0, dest="attack_mod")
    p_atk.add_argument("--ac", type=int, required=True)
    p_atk.add_argument("--damage", default="")
    p_atk.add_argument("--advantage", action="store_true")
    p_atk.add_argument("--disadvantage", action="store_true")
    p_atk.add_argument("--reason", default="")
    p_atk.add_argument("--seed", type=int, default=None)
    p_atk.set_defaults(func=cmd_attack)

    args = parser.parse_args()
    try:
        args.func(args)
    except ValueError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
