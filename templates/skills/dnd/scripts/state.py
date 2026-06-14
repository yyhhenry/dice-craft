#!/usr/bin/env python3
"""DND 实例运行时状态 CRUD。

状态文件: skills/dnd/instances/<slug>/runtime/state.json

用法:
    python state.py init --instance <slug>
    python state.py get --instance <slug> --path party.0.hp
    python state.py set --instance <slug> --path party.0.hp --json 8
    python state.py dump --instance <slug>
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

DEFAULT_STATE: dict[str, Any] = {
    "party": [],
    "quests": {},
    "revealed_clues": [],
    "round": 0,
}


def state_path(instance: str) -> Path:
    return Path("skills/dnd/instances") / instance / "runtime" / "state.json"


def load_state(instance: str) -> dict[str, Any]:
    path = state_path(instance)
    if not path.exists():
        raise FileNotFoundError(f"State not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(instance: str, data: dict[str, Any]) -> None:
    path = state_path(instance)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_path(path: str) -> list[str]:
    return [p for p in path.split(".") if p]


def get_at(data: Any, path: str) -> Any:
    cur = data
    for key in parse_path(path):
        if isinstance(cur, list):
            cur = cur[int(key)]
        elif isinstance(cur, dict):
            cur = cur[key]
        else:
            raise KeyError(path)
    return cur


def set_at(data: dict[str, Any], path: str, value: Any) -> None:
    keys = parse_path(path)
    if not keys:
        raise ValueError("path must not be empty")
    cur: Any = data
    for i, key in enumerate(keys[:-1]):
        next_key = keys[i + 1]
        if isinstance(cur, list):
            idx = int(key)
            while len(cur) <= idx:
                cur.append({})
            if cur[idx] is None:
                cur[idx] = [] if next_key.isdigit() else {}
            cur = cur[idx]
        else:
            if key not in cur or cur[key] is None:
                cur[key] = [] if next_key.isdigit() else {}
            cur = cur[key]
    last = keys[-1]
    if isinstance(cur, list):
        idx = int(last)
        while len(cur) <= idx:
            cur.append(None)
        cur[idx] = value
    else:
        cur[last] = value


def cmd_init(args: argparse.Namespace) -> None:
    path = state_path(args.instance)
    if path.exists() and not args.force:
        print(json.dumps({"ok": False, "error": "state already exists", "path": str(path)}, ensure_ascii=False))
        sys.exit(1)
    save_state(args.instance, dict(DEFAULT_STATE))
    print(json.dumps({"ok": True, "path": str(path)}, ensure_ascii=False))


def cmd_get(args: argparse.Namespace) -> None:
    data = load_state(args.instance)
    value = get_at(data, args.path) if args.path else data
    print(json.dumps({"ok": True, "value": value}, ensure_ascii=False))


def cmd_set(args: argparse.Namespace) -> None:
    data = load_state(args.instance)
    value = json.loads(args.json)
    set_at(data, args.path, value)
    save_state(args.instance, data)
    print(json.dumps({"ok": True, "path": args.path, "value": value}, ensure_ascii=False))


def cmd_dump(args: argparse.Namespace) -> None:
    data = load_state(args.instance)
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="DND instance state CRUD")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init")
    p_init.add_argument("--instance", required=True)
    p_init.add_argument("--force", action="store_true")
    p_init.set_defaults(func=cmd_init)

    p_get = sub.add_parser("get")
    p_get.add_argument("--instance", required=True)
    p_get.add_argument("--path", default="")
    p_get.set_defaults(func=cmd_get)

    p_set = sub.add_parser("set")
    p_set.add_argument("--instance", required=True)
    p_set.add_argument("--path", required=True)
    p_set.add_argument("--json", required=True)
    p_set.set_defaults(func=cmd_set)

    p_dump = sub.add_parser("dump")
    p_dump.add_argument("--instance", required=True)
    p_dump.set_defaults(func=cmd_dump)

    args = parser.parse_args()
    try:
        args.func(args)
    except (FileNotFoundError, KeyError, json.JSONDecodeError, ValueError) as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
