---
name: Bug report
about: Something behaved wrongly or unsafely
labels: bug
---

**What happened / what you expected**

**Command or action** (e.g. `guardian check --json`, `/task add ...`, an edit that was held)

**Output** (paste; remove anything private; `--json` output is most useful)

**Environment**: OS, Git version, Node version, Claude Code version (`claude --version`), mod version (last line of `/sessions`)

**Safety**: did the tool write anywhere other than `.guardian/` or the path you gave `--out`? Did it run any git command that changed your repo? (Both should be "no". If "yes", say so first.)
