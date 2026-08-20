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

## When do I need a new one — the in-product answer

The create-trigger, in one line: **make a new workspace when a different set of people should see
the work.** Not to organise, not per quarter, not per campaign.

Empty state copy for "New workspace":

> **Workspaces separate work by who can see it.**
> Everything in a workspace is visible to the teams you give access to. Create a new one when a
> different group of people should see the work — a different department, a client, or a programme
> with its own confidentiality.
>
> _Not sure? You probably don't need one. Use tags to organise surveys inside a workspace._

That last line is load-bearing. If the workspace becomes purely an access boundary and it is the
only way to group things, people will create workspaces to tidy up — "Q3", "archive", "NPS" — and the
container thickens again within a quarter. The 2026-08-19 design meeting settled the mechanism:
**tags, not folders** — _"we would add yet another container, it would make things more
complicated"_, and _"if you filter by tag, it kind of functions like a folder"_. Whatever it is
called, ship a grouping with **no access semantics** alongside, or the clean definition erodes.

## Should users see it, and what should it be called?

**Yes, unavoidably** — it is where work is created and what access is granted on. But it should stay
invisible until it earns its place: one workspace auto-created, switcher hidden until there is a
second, and a private survey lives in no workspace at all, so a solo user can go a long time without
meeting the word.

**Keep the name "Workspace."** The word was never the problem — the missing definition was, and
`project → environment → workspace` has already cost enough naming credibility (`legacyEnvironmentId`
is still a third name for the same thing in the schema). Two things instead of a rename:

1. **Never let "workspace" mean the tenant.** In Linear, Slack and Notion — which these buyers use
   daily — _workspace_ is the whole company. Here that is the **Organization**. The switcher should
   always read `Organization ▸ Workspace`.
2. **Give the nesting level its own word.** "A workspace inside a workspace" is unsayable. Call the
   parent level a **Division** — Qualtrics and SurveyMonkey both use it, so enterprise buyers already
   know it. One recursive object underneath, two words on the surface.

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

## A worked example — why two objects, in one grid

Boehringer Ingelheim. Teams are the org chart; workspaces are the bodies of work. They do not line up.

|                                 | Insights DE | Insights US | HR People Analytics | Kantar (agency)           | Animal Health CX |
| ------------------------------- | ----------- | ----------- | ------------------- | ------------------------- | ---------------- |
| **Employee Engagement 2027**    | –           | –           | **manage**          | –                         | –                |
| **Patient Support — Jardiance** | **manage**  | read        | –                   | **edit** (expires 31 Mar) | –                |
| **Brand Tracking DACH**         | **manage**  | –           | –                   | **edit**                  | –                |
| **Animal Health — Vet NPS**     | read        | –           | –                   | –                         | **manage**       |
| **Works Council Pilot**         | –           | –           | read                | –                         | –                |

Three facts in that grid are the whole argument:

- **Insights DE appears three times at two levels** — manage on two programmes, read-only on a third.
- **Jardiance has three groups at three levels** — manage, read, and an expiring agency edit.
- **HR People Analytics manages the engagement survey and must never see Jardiance** — patient data
  and employee data have different legal bases.

**Without a container**, Kantar's edit access is one grant per survey across ~40 surveys and three
years, re-applied on every create, and revoked 40 times when the contract ends. **With the container
merged into the team**, you invent a "Jardiance team" nobody is a member of, and then have to answer
whether Kantar is _in_ it — they can edit its surveys but must not appear in the roster. One object,
two meanings.

**The deciding requirement, stated so it can be checked:** the container earns its place if and only
if the triple `(group, body of work, level)` has a life of its own — one group across several bodies
of work at different levels, or several groups on one body at different levels, or a body of work
that outlives its staffing. Count non-blank cells per row and per column in that grid, and count
distinct levels. All ones, all the same level → merge workspace into team and nest it, Linear-style.

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
