#!/usr/bin/env python3
"""Check the last RUN TC run of a QAnyone test project against the pipeline (dev eval, not shipped).

Usage: python tools/check-run.py [project_dir] [--session FILE]
Reads the latest Copilot Chat session of the folder (or FILE) and checks its last `RUN TC` turn
(`NEW TC`, the old name, counts too):
  tasks  the first task list lists the pipeline steps 1 Intake … 9 Report, is written before any
         work (command, file creation, browser) and keeps those items for the whole turn
  steps  after the test case file is written, a chat message shows its Steps table
Exit code 0 when every check passes. Standard library only.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

STEPS = ["intake", "normalize", "map", "discover", "pom", "spec", "run", "memory", "report"]
TABLE = re.compile(r"\|\s*#\s*\|\s*Action\s*\|\s*Expected\s*\|", re.I)
WORK = ("run_in_terminal", "copilot_createFile")


def collect_debug():
    sys.dont_write_bytecode = True  # no __pycache__ in the repo
    spec = importlib.util.spec_from_file_location("collect_debug", Path(__file__).with_name("collect-debug.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def events(path: Path) -> list[tuple[str, object]]:
    """User prompts, tool calls (last state of each) and chat text, in order of first appearance."""
    order: list[tuple[str, object]] = []
    users: set = set()
    texts: set = set()
    tools: dict = {}

    def walk(n) -> None:
        if isinstance(n, dict):
            m = n.get("message")
            if isinstance(m, dict) and isinstance(m.get("text"), str) and "timestamp" in n:
                key = (n["timestamp"], m["text"])
                if key not in users:
                    users.add(key)
                    order.append(("user", m["text"]))
            if n.get("toolId") and n.get("toolCallId"):
                if n["toolCallId"] not in tools:
                    order.append(("tool", n["toolCallId"]))
                tools[n["toolCallId"]] = n
                return
            v = n.get("value")
            if isinstance(v, str) and "supportThemeIcons" in n and v.strip() and v not in texts:
                texts.add(v)
                order.append(("text", v))
            for x in n.values():
                walk(x)
        elif isinstance(n, list):
            for x in n:
                walk(x)

    raw = path.read_text("utf-8", errors="replace")
    for line in raw.splitlines() if path.suffix == ".jsonl" else [raw]:
        try:
            walk(json.loads(line))
        except json.JSONDecodeError:
            continue
    return [(kind, tools[val] if kind == "tool" else val) for kind, val in order]


def last_new_tc(evts: list[tuple[str, object]]):
    starts = [i for i, (k, v) in enumerate(evts) if k == "user" and str(v).strip().upper().startswith(("RUN TC", "NEW TC"))]
    if not starts:
        return None, []
    s = starts[-1]
    e = next((i for i in range(s + 1, len(evts)) if evts[i][0] == "user"), len(evts))
    return evts[s][1], evts[s + 1 : e]


def titles(call: dict) -> list[str]:
    return [str(i.get("title", "")) for i in (call.get("toolSpecificData") or {}).get("todoList") or []]


def is_step_list(ts: list[str]) -> bool:
    return len(ts) == len(STEPS) and all(
        re.search(rf"(^|\D){n}\D.*{name}", t.lower()) for n, (t, name) in enumerate(zip(ts, STEPS), 1)
    )


def check_tasks(turn) -> tuple[bool, str]:
    work = next((i for i, (k, c) in enumerate(turn) if k == "tool" and
                 (c["toolId"] in WORK or c["toolId"].startswith("mcp_playwright"))), len(turn))
    lists = [(i, titles(c)) for i, (k, c) in enumerate(turn) if k == "tool" and c["toolId"] == "manage_todo_list" and titles(c)]
    if not lists:
        return False, "no task list written"
    i, first = lists[0]
    if not is_step_list(first):
        return False, f"first list is not the pipeline steps: {first}"
    if i > work:
        return False, "task list written after work had started"
    changed = [ts for _, ts in lists[1:] if ts != first]
    if changed:
        return False, f"items replaced later: {changed[0]}"
    return True, "9 pipeline steps, written first, kept"


def check_steps(turn) -> tuple[bool, str]:
    written = next((i for i, (k, c) in enumerate(turn) if k == "tool" and c["toolId"].startswith("copilot_") and
                    "createFile" in c["toolId"] and "test-cases/" in json.dumps(c, ensure_ascii=False)), None)
    if written is None:
        return False, "no test case file written in this turn"
    if any(k == "text" and TABLE.search(str(v)) for k, v in turn[written:]):
        return True, "Steps table shown in chat"
    return False, "no chat message with the Steps table after the test case file was written"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?", default=".", help="test project folder (default: cwd)")
    ap.add_argument("--session", help="a Copilot Chat session file instead of the latest one of the folder")
    a = ap.parse_args()
    if a.session:
        session = Path(a.session)
    else:
        files = [p for d in collect_debug().copilot_workspace_dirs(Path(a.project).resolve())
                 for p in d.iterdir() if p.suffix in (".json", ".jsonl")]
        if not files:
            print("no Copilot Chat session found for this folder (Claude Code transcripts are not checked yet)")
            return 2
        session = max(files, key=lambda p: p.stat().st_mtime)
    prompt, turn = last_new_tc(events(session))
    if prompt is None:
        print(f"no RUN TC turn in {session.name}")
        return 2
    print(f"{prompt.strip()}  ({session.name})")
    ok = True
    for name, check in (("tasks", check_tasks), ("steps", check_steps)):
        passed, why = check(turn)
        ok &= passed
        print(f"{'PASS' if passed else 'FAIL'} {name:<6} {why}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
