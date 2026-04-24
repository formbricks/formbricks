# Question Bank - Linear Ticket Package (3 Scopes)

## Problem statement
Teams currently recreate the same survey questions across workspaces, which slows authors down, creates inconsistent wording, and makes reporting harder to standardize. We need a shared question bank at the organization level so authenticated creators can reuse high-quality questions quickly without breaking existing surveys.

## Success metrics
- Time to add a reusable question into a survey decreases by at least 50%.
- At least 40% of newly created surveys use one or more question bank entries within 60 days.
- Duplicate-question creation rate declines over time (measured by title/similarity heuristics).
- Permission failures are explicit and non-destructive (0 ambiguous auth errors in tracked flows).

## Locked auth model for all scopes
- Sharing boundary: all workspaces in the same organization.
- Publish eligibility: authenticated users with `readWrite` or `manage` in at least one workspace.
- Edit/delete: creator plus org `Owner/Manager`.
- Unpublish: org `Owner/Manager`.
- API keys: keep existing explicit workspace/org scopes (no owner-role inheritance change).
- Deprovisioned creators: ownership transfers to org admin group.
- Audit baseline: `createdBy`, `updatedBy`, timestamps.

---

## Ticket 1 - Scope 1 Core MVP

### Goal
Launch a usable organization-level question bank that supports the full core lifecycle and detached insertion into surveys.

### In scope
- Browse and insert global questions from survey creation/editing flow.
- Create and publish global questions with locked auth model.
- Edit/delete with creator + org admin override model.
- Unpublish with org admin permissions.
- Insert behavior is copy-detached (future question bank edits do not affect already inserted survey questions).
- Basic metadata in UI: title, category, creator, updated time.
- Empty state, unauthorized state, and no-results state messaging.

### Explicitly out of scope
- Approval workflows.
- Certified/locked question sets.
- Sensitive-category permission differences.
- Version history, diff, restore.
- Live-linked question sync into existing surveys.

### Acceptance criteria
- A user with `readWrite/manage` in at least one workspace can create and publish.
- A user without required workspace permission cannot publish and gets clear guidance.
- Creator can edit/delete own global questions.
- Org `Owner/Manager` can edit/delete/unpublish any global question.
- Inserting a question creates an independent survey copy that does not change on later bank edits.
- Unpublishing hides the question from new insertions but does not alter surveys that already copied it.
- All successful mutations capture attribution metadata (`createdBy`/`updatedBy` and timestamps).

### Scope 1 edge-case handling
- Creator loses workspace write access after publishing: question remains available; creator can no longer mutate unless still authorized by current rules.
- Creator is removed/deactivated: ownership is transferred to org admin group without content loss.
- Admin edits creator-owned content: latest updater attribution is visible.
- Cross-workspace discoverability remains consistent inside the same org.

---

## Ticket 2 - Scope 2 Adoption and Operational Quality

### Goal
Increase discoverability and operational reliability so the bank is easy to use at scale for both UI users and scoped API clients.

### In scope
- Search, category filtering, and sorting.
- API-key read/write support under current explicit workspace/org scope model.
- Ownership transfer flow for deprovisioned creators (admin stewardship).
- Basic moderation operations for org admins focused on unpublish/recoverability.
- Audit visibility in product UX (created by, last updated by, published status timestamps).

### Acceptance criteria
- Users can find bank questions by keyword, category, and sort order with predictable results.
- API key mutations respect explicit scope boundaries; out-of-scope writes are rejected clearly.
- Admins can view and complete ownership transfer for deprovisioned creators.
- Admin can recover previously unpublished items using a clear operational flow.
- Audit fields are visible and understandable in bank listing/detail surfaces.

### Scope 2 edge-case handling
- API key with partial workspace grants attempts org-wide mutation: request is denied with explicit reason.
- Large volume of near-duplicate questions: list remains navigable via filters and sort defaults.
- Simultaneous edits by creator and admin: user-facing result is deterministic and auditable.

---

## Ticket 3 - Scope 3 Governance and Enterprise Depth (Optional/Future)

### Goal
Introduce governance controls for organizations that need stronger quality gates and policy enforcement.

### In scope (optional controls)
- Approval gate before global publication.
- Curator workflow for elevated stewardship.
- Certified/locked question sets (or semi-locked variants).
- Sensitive-category restrictions (if compliance needs require).
- Extended versioning: history, fork, restore.
- Org policy controls for publishing standards and lifecycle rules.

### Acceptance criteria
- Governance controls are configurable per organization and can be rolled out progressively.
- Approval workflow supports clear pending/approved/rejected states.
- Certified or locked items are visibly distinct and enforce expected edit restrictions.
- Version history supports safe recovery without impacting existing detached survey copies.
- Policy changes are auditable and reversible.

### Scope 3 edge-case handling
- Approval backlog delays publication: pending state remains visible and actionable.
- Policy changes after content is already published: no retroactive corruption of survey copies.
- Governance disabled for some orgs: core flows continue without governance regressions.

---

## Prioritization rationale (Qualtrics-informed)
- Start with the minimum reusable-library primitives users expect: browse, search, insert, categorize.
- Keep insertion detached by default to prevent retroactive survey changes.
- Defer certified and strict governance controls until adoption data justifies added complexity.

Reference: [Qualtrics pre-made library questions](https://www.qualtrics.com/support/survey-platform/survey-module/editing-questions/question-types-guide/pre-made-qualtrics-library-questions/)
