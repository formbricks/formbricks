# Workbench

The workbench is the project work surface for durable product truth, execution records, reusable prompts, helper scripts, scratch notes, and local-only data.

## Agent Quickstart

1. Read `AGENTS.md`, then `workbench/GUIDE.md`.
2. Use indexes and `rg` to find the relevant `workbench/blueprint/` truth before planning or implementation.
3. Use reviewed `workbench/cowork/` plans, bug fixes, and checkpoints for execution context.
4. Stop before planning or implementation if the relevant milestone, plan, or bug-fix record lacks a completed human review gate.
5. After editing workbench records or workflow instructions, run `node workbench/scripts/validate-workbench.mjs workbench`.

## Directory Map

```text
workbench/
  GUIDE.md
  blueprint/
  cowork/
  local/
  research/
  scratch/
  scripts/
```

- `blueprint/`: stable product and application truth.
- `cowork/`: active AI and human development workflow.
- `blueprint/guidelines/`: guidelines for AI and human development. It expands `AGENTS.md` with concrete rules and best practices.
- `cowork/prompts/`: reusable prompts and handoff text.
- `research/`: research notes, reference screenshots, diagrams, and prototype logic.
- `local/`: ignored local data such as Docker-mounted database directories.
- `scratch/`: ignored temporary thinking space.
- `scripts/`: helper scripts for maintaining the local development environment and the workbench.
