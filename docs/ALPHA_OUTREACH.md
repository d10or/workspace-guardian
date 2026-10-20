# Alpha outreach (G3-02): where the five testers come from and what to say

Sending is the founder's job. Every target below posted, in public, about this exact problem and
in most cases built a workaround. Follow each venue's rules; one message per person, no follow-up
unless they reply.

## Targets (from docs/RESEARCH_G1.md sources)

| Where | Who | Why they fit |
|---|---|---|
| anthropics/claude-code issue #11455 (session handoff) | people who posted DIY handoff tools in the thread | built their own handoff; will judge ours quickly |
| anthropics/claude-code issue #76727 (cross-session coordination) | the original poster, who measured 44% wrong-tree writes | heavy user, ~20 worktrees, data-driven |
| anthropics/claude-code issue #89509 (enforced role guardrails) | the author ("a rule with no mechanism") | asked for exactly task ownership |
| openai/codex issue #36719 (intent map) | the author | asked for an intent map; the CLI is agent-agnostic |
| Cursor forum threads 160928 and 166666 | authors of "disjoint write scopes" and "overwrite dirty worktree" posts | have the pain on another tool; CLI only |
| Hacker News "Show HN: wt" and worktree threads | commenters who mentioned conflicts burning agent context | worktrunk users; pre-merge hook recipe |

## Message (GitHub issue comment or forum reply; adapt the first line)

> You described [the overwrite / handoff / ownership problem] in this thread. I built a small,
> local, free-to-use, source-available tool for it and would value 20 minutes of your judgment before I show it to
> anyone else. It lets you declare which task owns which paths, holds an edit from another session
> that crosses that line and asks you, reports overlap across worktrees before you merge, and
> writes a handoff that only says "verified" when it ran your tests itself. No account, no
> network, never merges or pushes. Repo and a 20-minute guide: https://github.com/d10or/workspace-guardian
> (docs/ALPHA_GUIDE.md). If you try it, I will fix what you find first.

## Rules

- No incentives, no friends-and-family, no bulk posting. Five people, named in the Alpha Testers
  sheet of the tracker with date, source, and outcome.
- Record each session's result in the tracker: minutes, completion, confusions, usefulness,
  requests, defects. G3 passes at 4 of 5 completing the workflow with 0 critical safety events.
