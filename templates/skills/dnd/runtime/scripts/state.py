#!/usr/bin/env python3
"""Read/write DND instance runtime state — outputs single-line JSON."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def instance_dir(instance: str) -> Path:
    return Path("skills/dnd/instances") / instance


def state_path(instance: str) -> Path:
    return instance_dir(instance) / "runtime" / "state.json"


def load_state(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def get_by_path(data: dict, dot_path: str):
    cur = data
    for part in dot_path.split("."):
        if part.isdigit():
            cur = cur[int(part)]
        else:
            cur = cur[part]
    return cur


def set_by_path(data: dict, dot_path: str, value) -> None:
    parts = dot_path.split(".")
    cur = data
    for part in parts[:-1]:
        key: str | int = int(part) if part.isdigit() else part
        if isinstance(key, int):
            while len(cur) <= key:
                cur.append({})
            cur = cur[key]
        else:
            if key not in cur or not isinstance(cur[key], (dict, list)):
                cur[key] = {}
            cur = cur[key]
    last = parts[-1]
    if last.isdigit():
        idx = int(last)
        while len(cur) <= idx:
            cur.append(None)
        cur[idx] = value
    else:
        cur[last] = value


def cmd_init(instance: str) -> dict:
    path = state_path(instance)
    if path.exists():
        return {"ok": True, "action": "init", "instance": instance, "message": "already exists", "path": str(path)}
    data = {"party": [], "quests": {}, "revealed_clues": [], "round": 0}
    save_state(path, data)
    return {"ok": True, "action": "init", "instance": instance, "path": str(path), "state": data}


def cmd_get(instance: str, dot_path: str) -> dict:
    path = state_path(instance)
    if not path.exists():
        return {"ok": False, "error": f"State not found: {path}. Run init first."}
    data = load_state(path)
    try:
        value = get_by_path(data, dot_path)
    except (KeyError, IndexError, TypeError) as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "action": "get", "instance": instance, "path": dot_path, "value": value}


def cmd_set(instance: str, dot_path: str, raw_json: str) -> dict:
    path = state_path(instance)
    if not path.exists():
        init_result = cmd_init(instance)
        if not init_result.get("ok"):
            return init_result
    data = load_state(path)
    try:
        value = json.loads(raw_json)
    except json.JSONDecodeError as e:
        return {"ok": False, "error": f"Invalid JSON: {e}"}
    try:
        set_by_path(data, dot_path, value)
    except (KeyError, IndexError, TypeError) as e:
        return {"ok": False, "error": str(e)}
    save_state(path, data)
    return {"ok": True, "action": "set", "instance": instance, "path": dot_path, "value": value}


def main() -> None:
    parser = argparse.ArgumentParser(description="DND runtime state")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init")
    p_init.add_argument("--instance", required=True)

    p_get = sub.add_parser("get")
    p_get.add_argument("--instance", required=True)
    p_get.add_argument("--path", required=True)

    p_set = sub.add_parser("set")
    p_set.add_argument("--instance", required=True)
    p_set.add_argument("--path", required=True)
    p_set.add_argument("--json", required=True, dest="raw_json")

    args = parser.parse_args()

    if args.command == "init":
        result = cmd_init(args.instance)
    elif args.command == "get":
        result = cmd_get(args.instance, args.path)
    else:
        result = cmd_set(args.instance, args.path, args.raw_json)

    print(json.dumps(result, ensure_ascii=False))
    if not result.get("ok", True):
        sys.exit(1)


if __name__ == "__main__":
    main()
