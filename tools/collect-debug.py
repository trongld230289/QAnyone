#!/usr/bin/env python3
"""Collect everything needed to debug a QAnyone test project into ONE markdown file.

Usage (run inside the test project, or pass its path):
    python collect-debug.py [project_dir] [--out FILE] [--sessions N] [--run-setup]
                            [--no-tsc] [--no-transcript] [--max-kb N]

Collects: environment, framework file hashes, generated project files, .env KEY NAMES only,
auth-state metadata, test-results (error-context.md, .last-run.json), `tsc` output, and the
latest Claude Code / Copilot Chat transcripts for this folder. Secrets are redacted: every
non-whitelisted .env value, JWTs, Bearer/Basic tokens. Never includes .env values,
playwright/.auth/*.json contents, traces or videos. Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import urllib.parse
from pathlib import Path

# ----------------------------------------------------------------------------- config
PROJECT_FILES = [
    "QANYONE_STATE.md", "qanyone.config.md", "playwright.config.ts", "tsconfig.json",
    "package.json", ".mcp.json", ".vscode/mcp.json", ".gitignore",
    "CLAUDE.md", ".github/copilot-instructions.md",
]
PROJECT_GLOBS = [
    "tests/**/*.ts", "pages/*.ts", "fixtures/*.ts", "helpers/*.ts", "scripts/*.ts",
    "pom-registry/**/*.md", "test-cases/**/*.md",
]
FRAMEWORK_GLOBS = ["QAnyone/*.md", "QAnyone/templates/**/*", "QAnyone/setup/*.html"]
# .env keys whose VALUE is safe to show. Everything else is shown as <set> / <empty>.
ENV_VALUE_WHITELIST = {
    "BASE_URL", "AUTH_REQUIRED", "HEADLESS", "TRACE", "VIDEO", "SCREENSHOT",
    "ADO_ORG", "ADO_PROJECT", "LOGIN_URL",
}
TOOL_RESULT_CHARS = 1500       # per tool result in transcripts
TOOL_INPUT_CHARS = 1200        # per tool input in transcripts
SECRET_PATTERNS = [
    (re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"), "<REDACTED:JWT>"),
    (re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{16,}"), "Bearer <REDACTED>"),
    (re.compile(r"(?i)\bBasic\s+[A-Za-z0-9+/=]{16,}"), "Basic <REDACTED>"),
    # key = "literal"  or  key = token-with-a-digit (8+ chars). Type annotations and code such as
    # `password: Locator` / `this.password = page.getByLabel(` are left alone.
    (re.compile(r"(?i)\b(password|passwd|pwd|secret|token|pat)(\s*[=:]\s*)(['\"])[^'\"]{4,}\3"), r"\1\2\3<REDACTED>\3"),
    (re.compile(r"(?i)\b(password|passwd|pwd|secret|token|pat)(\s*[=:]\s*)(?=[A-Za-z0-9._~+/=-]*\d)[A-Za-z0-9._~+/=-]{8,}(?![\w(])"), r"\1\2<REDACTED>"),
]

OUT: list[str] = []


def h(level: int, title: str) -> None:
    OUT.append(f"\n{'#' * level} {title}\n")


def fence(text: str, lang: str = "") -> None:
    text = text.rstrip("\n")
    bt = "```"
    while bt in text:
        bt += "`"
    OUT.append(f"{bt}{lang}\n{text}\n{bt}\n")


def note(text: str) -> None:
    OUT.append(text + "\n")


def read_text(p: Path, max_bytes: int) -> str:
    data = p.read_bytes()
    truncated = len(data) > max_bytes
    txt = data[:max_bytes].decode("utf-8", errors="replace")
    if truncated:
        txt += f"\n… [truncated: {len(data)} bytes total, showing {max_bytes}]"
    return txt


def sha1(p: Path) -> str:
    return hashlib.sha1(p.read_bytes()).hexdigest()[:12]


def fmt_time(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def run(cmd: list[str], cwd: Path, timeout: int) -> str:
    exe = shutil.which(cmd[0])
    if not exe:
        return f"[{cmd[0]} not found on PATH]"
    try:
        r = subprocess.run([exe, *cmd[1:]], cwd=str(cwd), capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
        out = (r.stdout or "") + (("\n[stderr]\n" + r.stderr) if r.stderr.strip() else "")
        return f"$ {' '.join(cmd)}\n[exit {r.returncode}]\n{out.strip()}"
    except subprocess.TimeoutExpired:
        return f"$ {' '.join(cmd)}\n[timed out after {timeout}s]"
    except OSError as e:
        return f"$ {' '.join(cmd)}\n[failed to start: {e}]"


# ----------------------------------------------------------------------------- sections
def section_env(root: Path) -> None:
    h(2, "Environment")
    rows = [
        ("generated", dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ("project", str(root)),
        ("os", f"{platform.system()} {platform.release()} ({platform.version()})"),
        ("python", sys.version.split()[0]),
    ]
    fence("\n".join(f"{k:<10} {v}" for k, v in rows))
    fence(run(["node", "-v"], root, 20) + "\n\n" + run(["npx", "playwright", "--version"], root, 90))
    if (root / ".git").exists():
        fence(run(["git", "status", "--short", "--branch"], root, 20) + "\n\n"
              + run(["git", "log", "--oneline", "-5"], root, 20))


def section_framework(root: Path) -> None:
    h(2, "Framework files (QAnyone/) — hashes to compare with the branch")
    files = []
    for g in FRAMEWORK_GLOBS:
        files += [p for p in root.glob(g) if p.is_file()]
    if not files:
        note("_No `QAnyone/` folder found — was `npx … init` run here?_")
        return
    lines = [f"{sha1(p)}  {p.stat().st_size:>7}  {p.relative_to(root).as_posix()}" for p in sorted(set(files))]
    fence("\n".join(lines))
    for rel in ("CLAUDE.md", ".github/copilot-instructions.md"):
        p = root / rel
        if p.exists():
            txt = p.read_text("utf-8", errors="replace")
            ok = "<!-- qanyone:start -->" in txt and "<!-- qanyone:end -->" in txt
            note(f"- `{rel}`: {'QAnyone block present' if ok else '**QAnyone block MISSING**'}")
        else:
            note(f"- `{rel}`: **missing**")


def section_project_files(root: Path, max_bytes: int) -> None:
    h(2, "Generated project files")
    paths: list[Path] = []
    for rel in PROJECT_FILES:
        p = root / rel
        if p.is_file():
            paths.append(p)
    for g in PROJECT_GLOBS:
        paths += sorted(p for p in root.glob(g) if p.is_file() and "node_modules" not in p.parts)
    seen = set()
    for p in paths:
        if p in seen:
            continue
        seen.add(p)
        rel = p.relative_to(root).as_posix()
        h(3, f"`{rel}` ({p.stat().st_size} bytes, {fmt_time(p.stat().st_mtime)})")
        lang = {"ts": "ts", "md": "md", "json": "json"}.get(p.suffix.lstrip("."), "")
        fence(read_text(p, max_bytes), lang)
    missing = [rel for rel in PROJECT_FILES if not (root / rel).exists()]
    if missing:
        note("Missing (may be expected): " + ", ".join(f"`{m}`" for m in missing))


def parse_env(p: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in p.read_text("utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        v = v.split(" #", 1)[0].strip().strip("'\"")
        env[k.strip()] = v
    return env


def section_env_files(root: Path) -> dict[str, str]:
    h(2, ".env / .env.example — key names only")
    secrets: dict[str, str] = {}
    for name in (".env", ".env.example"):
        p = root / name
        if not p.exists():
            note(f"- `{name}`: missing")
            continue
        env = parse_env(p)
        rows = []
        for k, v in env.items():
            if k in ENV_VALUE_WHITELIST:
                rows.append(f"{k}={v}")
            else:
                rows.append(f"{k}=<{'set' if v else 'empty'}>")
                if v and len(v) >= 4 and v.lower() not in ("true", "false", "none"):
                    secrets[k] = v
        h(3, f"`{name}` ({fmt_time(p.stat().st_mtime)})")
        fence("\n".join(rows) or "[empty]")
    return secrets


def section_auth_state(root: Path) -> None:
    h(2, "Auth state (metadata only)")
    found = False
    for p in sorted(root.glob("playwright/.auth/*.json")):
        found = True
        try:
            data = json.loads(p.read_text("utf-8"))
            cookies = data.get("cookies", [])
            origins = data.get("origins", [])
            domains = sorted({c.get("domain", "?") for c in cookies})
            info = f"cookies={len(cookies)} origins={len(origins)} domains={', '.join(domains) or '-'}"
        except Exception as e:  # noqa: BLE001
            info = f"[unreadable JSON: {e}]"
        note(f"- `{p.relative_to(root).as_posix()}`: {p.stat().st_size} bytes, {fmt_time(p.stat().st_mtime)}, {info}")
    if not found:
        note("- no `playwright/.auth/*.json` — the `setup` project has not run yet")


def section_test_results(root: Path, max_bytes: int) -> None:
    h(2, "test-results/")
    tr = root / "test-results"
    if not tr.exists():
        note("_no `test-results/` folder_")
    else:
        last = tr / ".last-run.json"
        if last.exists():
            h(3, "`.last-run.json`")
            fence(read_text(last, 20_000), "json")
        entries = sorted(p for p in tr.rglob("*") if p.is_file())
        fence("\n".join(f"{p.stat().st_size:>9}  {fmt_time(p.stat().st_mtime)}  {p.relative_to(root).as_posix()}"
                        for p in entries) or "[empty]")
        for p in entries:
            if p.name == "error-context.md" or p.suffix in (".txt", ".log"):
                h(3, f"`{p.relative_to(root).as_posix()}`")
                fence(read_text(p, max_bytes))
    rep = root / "playwright-report" / "index.html"
    if rep.exists():
        note(f"- `playwright-report/index.html`: {fmt_time(rep.stat().st_mtime)} (open with `npx playwright show-report`)")


def section_commands(root: Path, run_tsc: bool, run_setup: bool) -> None:
    h(2, "Commands")
    if not (root / "node_modules").exists():
        note("_`node_modules/` missing — skipped tsc / playwright commands. Run `npm install` first._")
        return
    if run_tsc and (root / "tsconfig.json").exists():
        fence(run(["npx", "tsc", "-p", "tsconfig.json", "--noEmit", "--pretty", "false"], root, 180))
    if run_setup:
        fence(run(["npx", "playwright", "test", "--project=setup", "--reporter=line"], root, 300))
    else:
        note("_`--run-setup` not given: paste the terminal output of your last `npx playwright test` run below "
             "if it is not in `test-results/`._")


# ----------------------------------------------------------------------------- transcripts
def fenced(text: str) -> str:
    bt = "```"
    while bt in text:
        bt += "`"
    return f"{bt}\n{text.rstrip()}\n{bt}"


def clip(s: str, n: int) -> str:
    s = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + f"… [+{len(s) - n} chars]"


def claude_project_dirs(root: Path) -> list[Path]:
    base = Path.home() / ".claude" / "projects"
    if not base.exists():
        return []
    cands = {re.sub(r"[^A-Za-z0-9]", "-", str(root)), re.sub(r"[^A-Za-z0-9]", "-", str(root.resolve()))}
    return [base / c for c in cands if (base / c).is_dir()]


def render_claude_jsonl(p: Path) -> str:
    lines: list[str] = []
    for raw in p.read_text("utf-8", errors="replace").splitlines():
        try:
            o = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if o.get("isSidechain"):
            continue
        t = o.get("type")
        msg = o.get("message") or {}
        content = msg.get("content")
        ts = (o.get("timestamp") or "")[11:19]
        if t == "user":
            if isinstance(content, str):
                lines.append(f"\n### 👤 USER {ts}\n{content.strip()}")
            elif isinstance(content, list):
                for part in content:
                    if part.get("type") == "text":
                        lines.append(f"\n### 👤 USER {ts}\n{part.get('text', '').strip()}")
                    elif part.get("type") == "tool_result":
                        body = part.get("content")
                        if isinstance(body, list):
                            body = "\n".join(x.get("text", "") for x in body if isinstance(x, dict))
                        flag = " (ERROR)" if part.get("is_error") else ""
                        lines.append(f"\n#### ↩ tool_result{flag}\n{fenced(clip(body or '', TOOL_RESULT_CHARS))}")
        elif t == "assistant" and isinstance(content, list):
            for part in content:
                k = part.get("type")
                if k == "text":
                    lines.append(f"\n### 🤖 ASSISTANT {ts}\n{part.get('text', '').strip()}")
                elif k == "tool_use":
                    inp = part.get("input") or {}
                    name = part.get("name")
                    if name in ("Bash", "PowerShell"):
                        shown = inp.get("command", "")
                    elif name in ("Write",):
                        shown = f"{inp.get('file_path')}\n{clip(inp.get('content', ''), 600)}"
                    elif name in ("Edit",):
                        shown = (f"{inp.get('file_path')}\n--- old\n{clip(inp.get('old_string', ''), 400)}"
                                 f"\n+++ new\n{clip(inp.get('new_string', ''), 400)}")
                    else:
                        shown = json.dumps(inp, ensure_ascii=False)
                    lines.append(f"\n#### 🔧 {name}\n{fenced(clip(shown, TOOL_INPUT_CHARS))}")
    return "\n".join(lines).strip()


def copilot_workspace_dirs(root: Path) -> list[Path]:
    bases = []
    appdata = os.environ.get("APPDATA")
    if appdata:
        bases += [Path(appdata) / "Code" / "User" / "workspaceStorage",
                  Path(appdata) / "Code - Insiders" / "User" / "workspaceStorage"]
    home = Path.home()
    bases += [home / "Library" / "Application Support" / "Code" / "User" / "workspaceStorage",
              home / ".config" / "Code" / "User" / "workspaceStorage"]
    want = {os.path.normcase(str(root)), os.path.normcase(str(root.resolve()))}
    out = []
    for b in bases:
        if not b.exists():
            continue
        for ws in b.iterdir():
            wj = ws / "workspace.json"
            if not wj.exists():
                continue
            try:
                folder = json.loads(wj.read_text("utf-8")).get("folder", "")
            except Exception:  # noqa: BLE001
                continue
            if not folder.startswith("file:"):
                continue
            local = urllib.parse.unquote(folder[len("file://"):]).lstrip("/")
            local = os.path.normcase(str(Path(local)))
            if local in want and (ws / "chatSessions").exists():
                out.append(ws / "chatSessions")
    return out


def walk_copilot(node, acc: list[str]) -> None:
    """Best-effort: pull user prompts, assistant text and tool names out of any Copilot session JSON shape."""
    if isinstance(node, dict):
        if "message" in node and isinstance(node["message"], dict) and "text" in node["message"]:
            acc.append(f"\n### 👤 USER\n{node['message']['text']}")
            walk_copilot(node.get("response"), acc)
            if node.get("result"):
                err = node["result"].get("errorDetails") if isinstance(node["result"], dict) else None
                if err:
                    acc.append(f"\n#### ⚠ error\n{clip(err, 800)}")
            return
        if node.get("kind") == "toolInvocationSerialized" or "toolId" in node:
            name = node.get("toolId") or node.get("toolCallId") or "tool"
            msg = node.get("invocationMessage") or node.get("pastTenseMessage") or ""
            if isinstance(msg, dict):
                msg = msg.get("value", "")
            acc.append(f"\n#### 🔧 {name}\n{clip(msg, 400)}")
            return
        if isinstance(node.get("value"), str) and node.get("kind") in (None, "markdownContent", "inlineReference") \
                and "supportThemeIcons" in node:
            acc.append(f"\n### 🤖 ASSISTANT\n{node['value']}")
            return
        for v in node.values():
            walk_copilot(v, acc)
    elif isinstance(node, list):
        for v in node:
            walk_copilot(v, acc)


def render_copilot(p: Path) -> str:
    acc: list[str] = []
    if p.suffix == ".jsonl":
        for raw in p.read_text("utf-8", errors="replace").splitlines():
            try:
                o = json.loads(raw)
            except json.JSONDecodeError:
                continue
            walk_copilot(o.get("v"), acc)
    else:
        walk_copilot(json.loads(p.read_text("utf-8", errors="replace")), acc)
    return "\n".join(acc).strip()


def section_transcripts(root: Path, sessions: int) -> None:
    h(2, "AI transcripts (latest sessions for this folder)")
    found = False
    for d in claude_project_dirs(root):
        files = sorted(d.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)[:sessions]
        for p in files:
            found = True
            h(3, f"Claude Code — `{p.name}` ({fmt_time(p.stat().st_mtime)}, {p.stat().st_size} bytes)")
            body = render_claude_jsonl(p)
            OUT.append((body or "_[no readable messages]_") + "\n")
    for d in copilot_workspace_dirs(root):
        files = sorted((p for p in d.iterdir() if p.suffix in (".json", ".jsonl")),
                       key=lambda p: p.stat().st_mtime, reverse=True)[:sessions]
        for p in files:
            found = True
            h(3, f"Copilot Chat — `{p.name}` ({fmt_time(p.stat().st_mtime)}, {p.stat().st_size} bytes)")
            try:
                body = render_copilot(p)
            except Exception as e:  # noqa: BLE001
                body = f"_[could not parse: {e}]_"
            OUT.append((body or "_[no readable messages — export manually: Command Palette → "
                                "`Chat: Export Chat...` and attach the file]_") + "\n")
    if not found:
        note("_No transcript found automatically. Claude Code: run `/export` in the chat. "
             "Copilot Chat: Command Palette → `Chat: Export Chat...`. Attach that file._")


# ----------------------------------------------------------------------------- main
def redact(text: str, secrets: dict[str, str]) -> tuple[str, int]:
    count = 0
    for k, v in sorted(secrets.items(), key=lambda kv: -len(kv[1])):
        n = text.count(v)
        if n:
            text = text.replace(v, f"<REDACTED:{k}>")
            count += n
    for rx, rep in SECRET_PATTERNS:
        text, n = rx.subn(rep, text)
        count += n
    return text, count


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?", default=".", help="test project folder (default: cwd)")
    ap.add_argument("--out", help="output file (default: <project>/qanyone-debug-<timestamp>.md)")
    ap.add_argument("--sessions", type=int, default=1, help="how many latest chat sessions per tool (default 1)")
    ap.add_argument("--run-setup", action="store_true", help="also run `npx playwright test --project=setup`")
    ap.add_argument("--no-tsc", action="store_true", help="skip `npx tsc`")
    ap.add_argument("--no-transcript", action="store_true", help="skip chat transcripts")
    ap.add_argument("--max-kb", type=int, default=200, help="per-file cap in KB (default 200)")
    a = ap.parse_args()

    root = Path(a.project).resolve()
    if not root.is_dir():
        print(f"not a folder: {root}", file=sys.stderr)
        return 2
    max_bytes = a.max_kb * 1024
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    out = Path(a.out).resolve() if a.out else root / f"qanyone-debug-{stamp}.md"

    OUT.append(f"# QAnyone debug bundle — {root.name} — {stamp}\n")
    OUT.append("_Generated by tools/collect-debug.py. Secrets redacted; skim once before sending._\n")
    section_env(root)
    section_framework(root)
    secrets = section_env_files(root)
    section_auth_state(root)
    section_project_files(root, max_bytes)
    section_test_results(root, max_bytes)
    section_commands(root, run_tsc=not a.no_tsc, run_setup=a.run_setup)
    if not a.no_transcript:
        section_transcripts(root, a.sessions)

    text, n = redact("\n".join(OUT), secrets)
    out.write_text(text, encoding="utf-8", newline="\n")
    print(f"written: {out}  ({out.stat().st_size // 1024} KB, {n} redactions)")
    print("Skim it once, then send the file. Do NOT send .env, playwright/.auth/*.json, trace.zip or videos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
