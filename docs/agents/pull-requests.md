# Commit & Pull Request Guidelines

Read before committing, or opening or updating a pull request.

## Commits

Use Conventional Commits (`fix:`, `chore:`, `feat:`), keep commits scoped, and run the relevant checks.
The rule against publishing agent session links lives in `AGENTS.md` and applies to every commit.

## Pull requests

Read `.github/pull_request_template.md` and follow its inline guidance when opening or updating a PR.
It owns the structure, word budget, ticket syntax, coverage evidence, breaking-change decision, and
migration/env reporting. Update the description with every scope change or review fix.

Complete QA on the change's PR before requesting review. The author accounts for each changed behavior
and names unverified behavior under Open gaps; reviewers challenge that evidence. Release review checks
interactions between changes rather than repeating each PR's QA.

## Agent attribution

The agent note names the exact model id the vendor serves — `claude-opus-5`, `gpt-5.1-codex` — not the harness it runs in; Claude Code, Codex CLI and Cursor are harnesses, so name one in parentheses only when it adds something (`claude-opus-5 (Claude Code 2.1.237)`). The reasoning level is whatever knob that vendor exposes, in its own units: an effort level (`max`, `high`), a thinking budget (`32k tokens`), or `n/a`. Read both out of the tool, never from memory — Claude Code reports them in `/status` or as the session's `model` and `effort_level`, Codex CLI in `/model` or its startup line. A value you cannot look up is `unknown`, never a guess and never the harness name standing in for the model.
