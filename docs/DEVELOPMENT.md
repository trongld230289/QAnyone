# Developing QAnyone

- The package is `QAnyone/`, `CLAUDE.md`, `.github/copilot-instructions.md` and `bin/` — nothing else is shipped.
- `npm test` must pass before a PR: lint (size budget, forbidden strings, links), script tests, form tests, scaffold smoke.
- Size budget per instruction file is enforced in `tools/check-package.mjs`; if you need more room, split a section into a new file and add it to the command table in `core.md`.
- Personal repo: commits use `trongld230289 <trongld232@gmail.com>`; never company identifiers, URLs or machine paths. The lint blocks the known ones.
- Dogfood checklist: `docs/superpowers/plans/2026-10-10-qanyone-v2.md` Task 14.
- Private identifiers to block are listed in the git-ignored `tools/forbidden.local` (one regex per line); the lint loads it when present. Keep that file on your machine, never commit it.
- Debugging a test project: `python tools/collect-debug.py <project_dir>` writes one redacted markdown bundle (files, state, test-results, tsc, latest Claude Code / Copilot transcripts) to send back for analysis. Dev tool only, not shipped.
