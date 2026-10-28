# Issue tracker: Linear

Work items live as Linear issues in the Engineering team (`ENG`); specs and PRDs live as Linear project documents (see below). Use the Linear MCP tools.

## Conventions

- **Create**: `save_issue` with team `Engineering`, plus the project and milestone the work belongs to, a priority and labels. File straight into Backlog or Todo. Triage is only for externally reported items and vulnerabilities, which follow the security process.
- **Read**: `get_issue` by identifier (`ENG-1234`); `list_comments` for the thread.
- **List**: `list_issues`, filtered by project, state, label or assignee.
- **Sub-issue**: `save_issue` with `parentId`.
- **Comment**: `save_comment`.
- **Labels**: `addLabels` / `removeLabels`, using existing labels only. Don't create labels without asking.
- **Close**: state `Done`; won't do → `Canceled`; duplicate → `duplicateOf`.
- **Blocking**: `blocks` / `blockedBy` relations.
- Never put unpublished exploit details or secrets in Linear.

## Pull requests

PRs link to issues through the template's ticket line (`Fixes ENG-1234` / `Ref ENG-1234`) and the branch name (`type/ENG-1234_feature`). PRs are not a triage surface.

A PR built from a spec, including the draft PR `/implement-spec` opens, names the build's Linear issue on that line. The spec document and local tickets have no issue identifier, so the PR never references them.

## When a skill says "publish to the issue tracker"

Create a Linear issue in `ENG`, in the project the work belongs to. Issues are for units of work.

A spec or PRD (for example from `/to-spec`) is not a unit of work: publish it as a Linear document in the project the work belongs to, numbered after the project's existing documents (`5. Engineering spec`). Tickets are cut from it when the build needs them (next section).

## Before running `/to-tickets` on a spec

Tickets earn their place for one of two readers:

- **Agents**: the build outgrows one session. A session that holds the spec, the code it touches and the tests can build it in one go; past that, the build needs tickets, each sized for one fresh session. Rough guide: one session holds a PR of a few dozen hand-written files. The Dashboard & Chart API (271 files in one PR) did not.
- **People**: engineers split the build between them and track it in the weekly sync.

Pick the path from those two questions:

| The build                                  | Path                                                                                                                | Where the tickets go                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Fits one session                           | `/implement` against the spec, in the session that wrote it                                                         | No tickets. One Linear issue for the build, which the PR closes                                               |
| Outgrows one session, one engineer runs it | `/to-tickets`, then `/implement-spec` to build them in parallel, or `/implement` per ticket in a fresh session each | Local files under `.scratch/<feature-slug>/issues/`, plus one Linear issue for the build, which the PR closes |
| Engineers split it                         | `/to-tickets`, then each engineer runs `/implement` per ticket                                                      | Linear issues, as in Conventions, with `blockedBy` edges                                                      |

This table decides where `/to-tickets` publishes, ahead of the configured tracker: the middle row writes local files even though the tracker is Linear.

Local tickets are the agent's working files: they follow `/to-tickets`' local template, close by setting their `Status:` line to `done` (whenever a skill says to resolve a ticket the way the tracker closes work), and stay out of git (`.scratch/` is gitignored).

Because `.scratch/` is gitignored, a new worktree has no copy of it. When a skill hands a local ticket to a subagent in its own worktree (as `/implement-spec` does), pass the ticket's absolute path in the main checkout, or its full contents.

When `/to-tickets` asks about granularity, cut the coarsest vertical slices that still fit one fresh context window.

## When a skill says "fetch the relevant ticket"

An `ENG-1234` identifier: `get_issue`. A local ticket (a `.scratch/<feature-slug>/issues/` path, or a ticket number or title from that folder): read the file. That includes `/implement` given a local ticket.

## Wayfinding operations

- **Map**: one parent issue holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map. Its type goes in a title prefix (`Research:`, `Prototype:`, `Grill:`, `Task:`), not a label.
- **Blocking**: Linear `blockedBy` relations. A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier**: children in Todo with no open blocker and no assignee; first in map order wins. Children waiting on information stay in Backlog, so they are never picked.
- **Claim**: assign to yourself, as the session's first write.
- **Resolve**: comment the answer, set Done, and append a gist plus link to the map's Decisions-so-far.
