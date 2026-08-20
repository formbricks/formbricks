# What each container is FOR

The complaint that started this — _"we don't really know what a team is, what a workspace is"_ —
is the real problem. Linear does not have this argument, because Linear can finish the sentence
"you create a team when…" in one line. Below is that sentence for each Formbricks object, plus
the test that settles any "where does this go?" question.

## The four words

|                                                                | One-line definition                                                                                                                 | You create one when…                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Organization**                                               | The customer. One contract, one member list, one hard security boundary.                                                            | Never — it comes with the account.                                  |
| **Team**                                                       | **WHO.** A group of people who work together. It owns no content.                                                                   | A set of people needs to be granted things together, repeatedly.    |
| **Workspace**                                                  | **WHAT.** A body of work with its own access list — the surveys, dashboards and workflows for one programme, product or department. | A body of work needs a different access list from your other work.  |
| **Pool** (Brand Kit, Contact Directory, Dataset, Distribution) | A shared asset owned by the organization and lent to workspaces.                                                                    | An asset must be usable in several workspaces without being copied. |

**A private survey is not a fourth concept.** It is a survey with an owner and no workspace. That
keeps "private" out of the container vocabulary entirely, and it is why there is no personal
workspace in this model: _private surveys_ is the product requirement; a _personal workspace_ was
only ever one way to implement it — and the weaker one, because it cannot express a draft that
starts private and later joins a shared body of work without moving between containers.

## The test that settles arguments

> **If the list of people in the team and the list of people who should see this work are always
> identical, you do not need both objects — put the work in that team's workspace and stop.**
>
> You need a second workspace the moment those two lists come apart: the same people working on
> two things with different audiences, or two groups needing different levels on one thing.

That is the whole distinction, and it is why Formbricks needs two objects where Linear needs one.
Linear is **open by default** — anyone can view and join any non-private team — so the two lists
never come apart in a way that matters. Formbricks sells to banks, government and works-council
industrials, where **closed by default** is the requirement. Under closed-by-default those two
lists come apart constantly, and the triple `(group, body of work, level)` has to be stored
somewhere. Merging team and workspace does not delete it; it moves it onto a team→team edge,
where "I am a member of this" and "my team was granted read on this" become the same kind of edge
on the same object. `zed` itself flags this in candidate B — _"Relation `writer_team` references
parent type `team` in its name"_ — four times.

## Where does this go?

| Thing                                     | Home                                                  | Why                                                                                                                  |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A survey, dashboard, chart, workflow      | A workspace                                           | It is work, and work has an audience.                                                                                |
| A person                                  | A team                                                | People are grouped by who they are, not by what they are touching this quarter.                                      |
| Styling, logo                             | **Brand Kit** (pool)                                  | Every workspace wants the corporate one; nobody wants five copies.                                                   |
| App/SDK config, placement, recontact days | **Distribution** (pool)                               | It describes a channel, not a body of work.                                                                          |
| Contacts, attribute keys, segments        | **Contact Directory** (pool)                          | Org-wide PII with its own, stricter grant.                                                                           |
| Feedback records                          | **Dataset** (pool)                                    | Already org-level; the precedent the others follow.                                                                  |
| A private draft                           | **Nowhere** — a survey with an owner and no workspace | Privacy is the absence of a container edge, not a special kind of container. "My drafts" is a view, not a workspace. |
| A division or department                  | A **parent workspace**                                | Nesting, not a new noun.                                                                                             |
| "Which manager may see whose responses"   | **Org unit** — a separate tree                        | See below. This is the important one.                                                                                |

## The trap: the org-unit hierarchy is not a workspace

The strongest pull on the workspace concept in the next two years will be employee experience.
A works agreement says _a manager sees their own organisational unit and below_. It is tempting
to express that by making org units into workspaces.

**Don't.** They are different trees with different shapes, lifecycles and owners:

- A **workspace** is where the people who _build_ a survey collaborate. Product users create it;
  it changes when programmes change.
- An **org unit** is where a _respondent_ sits. It is fed from the HRIS, changes when the company
  reorganises, and must be versioned at survey close so a reorg cannot retroactively rewrite who
  could see last year's results.

Trying to make one container serve both is how Qualtrics ended up with Brand + Division + Group +
User Type + Org Hierarchy — five objects and a support article whose only job is to stop customers
confusing two of them. Medallia keeps unit groups strictly separate from users for the same reason.

Keep the workspace thin and let the org unit be its own dimension. `candidate-a-container.zed`
models both, and they never touch.

## The one warning worth carrying forward

Qualtrics' release notes show its mid-tier container still absorbing new responsibilities in 2026
— credit allocation, confidentiality thresholds — more than a decade in. Whatever Formbricks
scopes to the workspace will, over time, also want to carry quota, retention policy, branding
defaults and admin delegation. Decide deliberately each time whether the answer is "the workspace"
or "a pool assigned to it". The version of this model that ages badly is the one where the
workspace quietly re-accumulates the attributes we are about to take out of it.
