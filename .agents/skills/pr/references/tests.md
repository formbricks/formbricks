# Tests: what the PR owes, and proof they can fail

Two jobs, in order: **route** the change to the tests it needs, then **prove** each new test goes red
when the change is reverted. A test that cannot fail reports protection that does not exist.

Rules: no production code changes; every new test is run; every regression test is proven against
the reverted change; missing tests are named, never silent; where `AGENTS.md` forbids a test type,
say so instead of working around it.

If the branch or PR names a Linear ticket, fetch it over MCP. Read its acceptance criteria as a
starting point, not a specification.

## 1. Route the change

Classify by what the diff touches, not by the PR title. Most PRs match more than one row.

| Change | Owes |
|---|---|
| Bug fix | One test that fails before the fix and passes after (step 4 proves it) |
| New or changed endpoint, permission check, scope gate, or business rule | Vitest unit tests |
| New user-facing flow, or a mutation on a core object | One Playwright spec, happy path |
| `.tsx` behaviour | No component unit test. Lift real logic into a `.ts` module and unit-test that. UI detail below the journey level gets a manual check plus a screenshot |
| Pure refactor | Nothing new; the existing suite stays green |
| Copy, styling, docs | Nothing |

## 2. List the guarantees, not the functions

Line coverage is not the target. List every promise the diff makes: each claim in a new comment or
docstring, each bullet in the PR body, each acceptance criterion, each invariant a new type implies.
For each, name the test that fails if that promise breaks. The headline guarantee is usually tested.
The quiet ones are not.

## 3. Write the tests

Default to Vitest, colocated as `*.test.ts` beside the unit. Playwright specs live under
`apps/web/playwright/`. For these shapes, use `test-recipes.md`:

- a declared contract enforced somewhere else (scopes, permissions, hints)
- the same rule implemented in two places that must agree
- an error shape from a driver, adapter, or third-party library
- a fix living in a `package.json` script, CLI flag, or config
- seeded multi-org or multi-role state

To review tests someone else wrote, use `reviewing-tests.md`.

## 4. Prove it can fail

The question: if I reverted this change, would any test in this PR go red?

```bash
git stash push -- <changed source paths>
pnpm test <test path>     # MUST fail. If it passes, the test is worthless.
git stash pop
pnpm test <test path>     # MUST pass
```

Never chain the stash and the pop in one command, and gate the pop on the top stash message. Use
absolute paths. If the test passes on reverted source, diagnose it against the gotchas and rewrite.
Where a revert cannot be isolated (a deletion, a migration), say so and name what the test pins
instead.

## 5. What goes in the PR

Each proven test becomes an Evidence row. Show it as pseudocode:

```text
test("revoked workspace member gets no workflow email")
  revoke member from workspace
  run workflow
  expect no email sent        // red on main: email was sent
```

## Gotchas

Each one has burned a real PR here.

- **`.tsx` unit tests are forbidden, and that is not a cue to write an E2E.** `CODING_STANDARDS.md`
  ("Do not") says the missing component test creates no coverage obligation. Do not E2E a single
  component, and do not build a variant matrix. Read its "Testing Guidelines" before adding any spec.
- **Nothing else covers you.** `.tsx` is outside Sonar coverage, `**/*.test.ts` is outside the
  typecheck config, and Chromatic runs only on `main`. No red check is not evidence.
- **Never import the constant you assert.** Test and code share the value, so it compares a value to
  itself. Assert a literal or the shape.
- **Check every mocked value the code branches on** against what production emits.
- **Assert only values the test passes in.**
- **Assert the thing the change adds**, such as the new scope name, not the generic prefix that was
  already there.
- **Test through the shipped entrypoint.** A fix in a script's flags is not exercised by importing
  the TS.
- **Type fixtures narrowly.** A role typed `string` lets a misspelling compile.
- **Assert a populated case**, not only the empty one, especially for anything security-related.
- **Capture baselines before the mutation.**
- **Test the destructive branch.** It is the least covered and the one that matters.
- **Restore spies in `afterEach`**, not inline.
- **Tenancy has no automated enforcement.** A new query is a candidate for the cross-tenant case.
- **i18n lives in `en-US.json`.** New strings need `pnpm scan-translations`, not a unit test.

## Self-check

- [ ] Every applicable row of step 1 is met, or declined with a reason
- [ ] Every guarantee from step 2 has a test, or is listed under Open gaps
- [ ] Every new test was run and passes
- [ ] Every regression test went red under step 4
- [ ] No assertion matches a gotcha
- [ ] No production file was modified
