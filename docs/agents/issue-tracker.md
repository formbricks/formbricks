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

## When a skill says "publish to the issue tracker"

Create a Linear issue in `ENG`, in the project the work belongs to. Issues are for units of work.

A spec or PRD (for example from `/to-spec`) is not a unit of work: publish it as a Linear document in the project the work belongs to, numbered after the project's existing documents (`5. Engineering spec`). Tickets are cut from it.

## When a skill says "fetch the relevant ticket"

`get_issue` with its identifier.

## Wayfinding operations

- **Map**: one parent issue holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map. Its type goes in a title prefix (`Research:`, `Prototype:`, `Grill:`, `Task:`), not a label.
- **Blocking**: Linear `blockedBy` relations. A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier**: children in Todo with no open blocker and no assignee; first in map order wins. Children waiting on information stay in Backlog, so they are never picked.
- **Claim**: assign to yourself, as the session's first write.
- **Resolve**: comment the answer, set Done, and append a gist plus link to the map's Decisions-so-far.
