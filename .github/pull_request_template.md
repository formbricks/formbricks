<!-- We require pull request titles to follow the Conventional Commits specification ( https://www.conventionalcommits.org/en/v1.0.0/#summary ). Please make sure your title follow these conventions -->

## What does this PR do?

<!-- Please include a summary of the change and which issue is fixed. Please also include relevant motivation and context. List any dependencies that are required for this change. -->

Fixes #(issue)

<!-- Please provide a screenshots or a loom video for visual changes to speed up reviews
 Loom Video: https://www.loom.com/
-->

## QA / Test Plan

<!--
This section is the source of truth for release QA — QA checklists are generated from it. Describe the
PR's ACTUAL behavior, not the commit titles. Keep steps click-by-click and grounded in real behavior.
Omit a subsection only when it genuinely does not apply. Flag any inferred specifics (thresholds, rate
limits, timeouts) for human verification.
-->

**How to test** <!-- happy path first, then edge cases (boundaries, negative input, permissions) -->

- [ ] Step → expected result (include route, error code, and any env flag/var)
- [ ] Edge case → expected result

**Preconditions / test data** <!-- accounts, seed data, feature flags, plan/entitlement, Cloud vs self-host -->

-

**Risks & regressions** <!-- what nearby behavior could break; what to re-check -->

-

**Migrations / env / cutover** <!-- new/changed env vars (diff .env.example), DB migrations, cutover steps; write "none" if none -->

- none

## Checklist

<!-- We're starting to get more and more contributions. Please help us making this efficient for all of us and go through this checklist. Please tick off what you did  -->

### Required

- [ ] Filled out the "QA / Test Plan" section in this PR (behavior, edge cases, preconditions, risks, migrations/env)
- [ ] Read [How we Code at Formbricks](<[https://github.com/formbricks/formbricks/blob/main/CONTRIBUTING.md](https://formbricks.com/docs/contributing/how-we-code)>)
- [ ] Self-reviewed my own code
- [ ] Commented on my code in hard-to-understand bits
- [ ] Ran `pnpm build`
- [ ] Checked for warnings, there are none
- [ ] Removed all `console.logs`
- [ ] Merged the latest changes from main onto my branch with `git pull origin main`
- [ ] My changes don't cause any responsiveness issues
- [ ] First PR at Formbricks? [Please sign the CLA!](https://cla-assistant.io/formbricks/formbricks) Without it we wont be able to merge it 🙏

### Appreciated

- [ ] If a UI change was made: Added a screen recording or screenshots to this PR
- [ ] Updated the Formbricks Docs if changes were necessary
