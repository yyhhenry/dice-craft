#!/usr/bin/env python3
"""Bluff Number Guessing — the system never has a real answer.

Usage:
    python game.py --init [max] [--bluff N]
    python game.py --num 500
    python game.py --exp "x > 500"
    python game.py --exp "x % 2 == 0"
    python game.py --status
    python game.py --undo
"""

import argparse
import json
import random
import sys
from pathlib import Path

STATE_FILE = Path.cwd() / ".game-state" / "bluff-number-guess.json"


def load_state() -> dict | None:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return None


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=2))


def bluff_weights(counts: dict[str, int], bluff_n: float) -> dict[str, float]:
    if len(counts) <= 1:
        return {k: 1.0 for k in counts}
    max_count = max(counts.values())
    return {
        name: count * (1.0 if count == max_count else bluff_n)
        for name, count in counts.items()
    }


def pick(options: dict[str, float]) -> str:
    names = list(options.keys())
    return random.choices(names, weights=[options[n] for n in names], k=1)[0]


def do_init(max_num: int, bluff_n: float):
    state = {
        "max_num": max_num,
        "bluff_n": bluff_n,
        "candidates": list(range(1, max_num + 1)),
        "round": 0,
        "history": [],
    }
    save_state(state)
    print(json.dumps({"status": "new_game", "max_num": max_num, "bluff_n": bluff_n}))


def apply_guess(state: dict, remaining: list, result_label: str, guess_repr: str, guess_type: str):
    entry = {
        "round": state["round"] + 1,
        "type": guess_type,
        "guess": guess_repr,
        "result": result_label,
        "remaining_count": len(remaining),
    }
    if len(remaining) <= 10:
        entry["candidates"] = remaining

    state["candidates"] = remaining
    state["round"] = entry["round"]
    state["history"].append(entry)
    save_state(state)
    print(json.dumps(entry, ensure_ascii=False))


def do_guess_num(state: dict, guess: int):
    cands = set(state["candidates"])
    lo = [x for x in cands if x < guess]
    eq = [guess] if guess in cands else []
    hi = [x for x in cands if x > guess]

    dirs: dict[str, int] = {}
    if lo:
        dirs["小了"] = len(lo)
    if eq:
        dirs["猜对了"] = len(eq)
    if hi:
        dirs["大了"] = len(hi)

    if not dirs:
        print(json.dumps({"error": f"{guess} 不在候选范围内"}))
        return

    chosen = pick(bluff_weights(dirs, state["bluff_n"]))
    remaining = {"猜对了": eq, "小了": lo, "大了": hi}[chosen]
    apply_guess(state, remaining, chosen, str(guess), "number")


def do_guess_expr(state: dict, expr: str):
    cands = state["candidates"]
    predicate = eval(f"lambda x: {expr}", {"__builtins__": {}}, {})
    yes = [x for x in cands if predicate(x)]
    no = [x for x in cands if not predicate(x)]

    dirs: dict[str, int] = {}
    if yes: dirs["是"] = len(yes)
    if no: dirs["否"] = len(no)

    if not dirs:
        print(json.dumps({"error": "没有符合条件的候选"}))
        return

    chosen = pick(bluff_weights(dirs, state["bluff_n"]))
    remaining = yes if chosen == "是" else no
    apply_guess(state, remaining, chosen, expr, "expression")


def do_status(state: dict):
    cands = state["candidates"]
    out = {
        "round": state["round"],
        "remaining_count": len(cands),
        "bluff_n": state["bluff_n"],
        "max_num": state["max_num"],
    }
    if len(cands) <= 10:
        out["candidates"] = cands
    out["history"] = state["history"][-5:]
    print(json.dumps(out, ensure_ascii=False))


def do_undo(state: dict):
    if not state["history"]:
        print(json.dumps({"error": "没有可以撤销的操作"}))
        return

    state["history"].pop()
    state["round"] -= 1

    # Rebuild candidates by replaying history
    cands = list(range(1, state["max_num"] + 1))
    for entry in state["history"]:
        if entry["type"] == "number":
            g = int(entry["guess"])
            if entry["result"] == "猜对了":
                cands = [g]
            elif entry["result"] == "小了":
                cands = [x for x in cands if x < g]
            else:
                cands = [x for x in cands if x > g]
        else:
            pred = eval(f"lambda x: {entry['guess']}", {"__builtins__": {}}, {})
            if entry["result"] == "是":
                cands = [x for x in cands if pred(x)]
            else:
                cands = [x for x in cands if not pred(x)]

    state["candidates"] = cands
    save_state(state)
    print(json.dumps({"status": "undone", "round": state["round"], "remaining_count": len(cands)}))


def main():
    parser = argparse.ArgumentParser(description="Bluff Number Guessing Game")
    parser.add_argument("--init", nargs="?", const=999, type=int, metavar="MAX", help="Start new game")
    parser.add_argument("--bluff", type=float, default=10.0, help="Bluff intensity (default 10)")
    parser.add_argument("--num", type=int, help="Guess a number")
    parser.add_argument("--exp", type=str, help="Guess an expression, e.g. 'x > 500'")
    parser.add_argument("--status", action="store_true", help="Show current state")
    parser.add_argument("--undo", action="store_true", help="Undo last round")
    args = parser.parse_args()

    if args.init is not None:
        do_init(args.init, args.bluff)
        return

    state = load_state()
    if state is None:
        print(json.dumps({"error": "游戏未初始化，请先运行: python game.py --init"}))
        sys.exit(1)

    if args.status:
        do_status(state)
    elif args.undo:
        do_undo(state)
    elif args.num is not None:
        do_guess_num(state, args.num)
    elif args.exp is not None:
        do_guess_expr(state, args.exp)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
