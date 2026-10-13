#!/usr/bin/env python3
"""Check the last RUN TC run of a QAnyone test project against the pipeline (dev eval, not shipped).

Usage: python tools/check-run.py [project_dir] [--session FILE]
Reads the latest Copilot Chat session of the folder (or FILE) and checks its last `RUN TC` turn
(`NEW TC`, the old name, counts too):
  progress  a chat message lists the pipeline steps 1 Intake … 9 Report before any work
            (command, file creation, browser); then each step starts with a line
            `Step <n> · <name> (<done>/9 done) — left: …` in order, counts right, `left` naming
            the next step
  steps     after the test case file is written, a chat message shows its Steps table
  rerun     after the last test run, a chat message has a code block holding only the
            `npx playwright test …` command (no --retries / --reporter), so the user can copy it
  report    the chat shows a `| Step | Result |` table with a row per pipeline step and a
            `| Page object | File | Status | Locators |` table (new / updated / reused)
Exit code 0 when every check passes. Standard library only.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

NAMES = ["Intake", "Normalize", "Map", "Discover", "POM", "Spec", "Run + self-heal", "Memory", "Report"]
PIPELINE = re.compile(".*?".join(re.escape(f"{n} {name}") for n, name in enumerate(NAMES, 1)), re.S)
MARK = re.compile(r"Step ([1-9])\s*[·:—-]\s*([A-Za-z][A-Za-z +-]*?)\**\s*\((\d+)/(\d+) done\)([^\n]*)")
TABLE = re.compile(r"\|\s*#\s*\|\s*Action\s*\|\s*Expected\s*\|", re.I)
RERUN = re.compile(r"```[^\n]*\n\s*(npx playwright test [^\n`]*?)\s*\n```")
STEP_TABLE = re.compile(r"\|\s*Step\s*\|\s*Result\s*\|", re.I)
POM_TABLE = re.compile(r"\|\s*Page object\s*\|\s*File\s*\|\s*Status\s*\|\s*Locators\s*\|[ \t]*\n[ \t]*\|[\s:|-]+\|[ \t]*\n"
                       r"((?:[ \t]*\|[^\n]*\|[ \t]*(?:\n|$))+)", re.I)
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


def check_progress(turn) -> tuple[bool, str]:
    work = next((i for i, (k, c) in enumerate(turn) if k == "tool" and
                 (c["toolId"] in WORK or c["toolId"].startswith("mcp_playwright"))), len(turn))
    shown = next((i for i, (k, v) in enumerate(turn) if k == "text" and PIPELINE.search(str(v))), None)
    if shown is None:
        return False, "the 9 pipeline steps are never listed in chat"
    if shown > work:
        return False, "pipeline listed in chat after work had started"
    marks = [m for k, v in turn if k == "text" for m in MARK.finditer(str(v))]
    nums = [int(m[1]) for m in marks]
    if not nums or nums[0] != 1 or nums[-1] != 9 or nums != sorted(set(nums)):
        return False, f"step lines must run 1 … 9 in order, got {nums}"
    for i, m in enumerate(marks):
        n, name, done, total, rest = int(m[1]), m[2].strip(), int(m[3]), int(m[4]), m[5]
        if name.lower() != NAMES[n - 1].lower():
            return False, f"step {n} is named {name!r}, expected {NAMES[n - 1]!r}"
        if (done, total) != (i, 9):
            return False, f"step {n} says ({done}/{total} done), expected ({i}/9 done)"
        if i + 1 < len(marks):
            nxt = f"{nums[i + 1]} {NAMES[nums[i + 1] - 1]}"
            if nxt not in rest.partition("left:")[2]:
                return False, f"step {n}: 'left:' does not name {nxt}"
    return True, f"pipeline listed first; step lines {nums} with counts and 'left'"


def check_steps(turn) -> tuple[bool, str]:
    written = next((i for i, (k, c) in enumerate(turn) if k == "tool" and c["toolId"].startswith("copilot_") and
                    "createFile" in c["toolId"] and "test-cases/" in json.dumps(c, ensure_ascii=False)), None)
    if written is None:
        return False, "no test case file written in this turn"
    if any(k == "text" and TABLE.search(str(v)) for k, v in turn[written:]):
        return True, "Steps table shown in chat"
    return False, "no chat message with the Steps table after the test case file was written"


def check_rerun(turn) -> tuple[bool, str]:
    runs = [i for i, (k, c) in enumerate(turn) if k == "tool" and c["toolId"] == "run_in_terminal" and
            "npx playwright test" in (s := json.dumps(c, ensure_ascii=False)) and "--project=setup" not in s]
    if not runs:
        return False, "the test was never run in this turn"
    for k, v in turn[runs[-1]:]:
        for cmd in RERUN.findall(str(v)) if k == "text" else []:
            if not re.search(r"--retries|--reporter", cmd):
                return True, f"rerun command shown: {cmd}"
    return False, "no code block holding only the npx playwright test command after the last run"


def check_report(turn) -> tuple[bool, str]:
    # file references are separate chat parts, so a table can be split over several text events
    text = "".join(str(v) for k, v in turn if k == "text")
    head = STEP_TABLE.search(text)
    if not head:
        return False, "no '| Step | Result |' table"
    missing = [f"{n} {name}" for n, name in enumerate(NAMES, 1)
               if not re.search(rf"\|\s*\**{n} {re.escape(name)}\**\s*\|", text[head.end():])]
    if missing:
        return False, f"step table has no row for: {', '.join(missing)}"
    pom = POM_TABLE.search(text)
    if not pom or not re.search(r"\b(new|updated|reused)\b", pom[1], re.I):
        return False, "no '| Page object | File | Status | Locators |' table with new / updated / reused rows"
    return True, "step table with 9 rows and page object table shown"


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
    for name, check in (("progress", check_progress), ("steps", check_steps), ("rerun", check_rerun),
                        ("report", check_report)):
        passed, why = check(turn)
        ok &= passed
        print(f"{'PASS' if passed else 'FAIL'} {name:<8} {why}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
