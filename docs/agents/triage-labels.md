# Triage roles

Engineering uses no triage labels (`agent-ready` was retired on 23 Sep 2026). The five roles the skills speak of map onto Linear workflow states:

| Role              | In Linear                                         | Meaning                                                                      |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `needs-triage`    | **Triage** state                                  | Externally reported items and vulnerabilities only; internal tickets skip it |
| `needs-info`      | **Backlog**, plus a comment naming what's missing | Waiting on the reporter; never picked up as work                             |
| `ready-for-agent` | **Todo**                                          | Fully specified; whoever picks it up decides who works it                    |
| `ready-for-human` | **Todo**                                          | Same as above                                                                |
| `wontfix`         | **Canceled** state                                | Will not be actioned                                                         |

When a skill says "apply the ready-for-agent label", move the issue to Todo instead.
