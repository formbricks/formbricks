# Reviewing tests — do the tests in this PR make sense?

The *detect* direction. `tests.md` authors tests that can fail; this is how a reviewer confirms
someone else's tests can. Same knowledge, review-time. Each check below maps to a real Formbricks
miss — a test that was green and shipped a bug anyway.

## The one mechanical check

Everything else is reading for this failure by eye. When you can run the suite, run this:

```bash
git stash push -- <source files only>   # keep the test files
pnpm test <test path>                    # MUST fail — green here means the test is worthless
git stash pop
pnpm test <test path>                    # MUST pass
```

Green against reverted source → reject the test. It reports protection that does not exist.

Where the change *is* a revert, a deletion, or spans a migration, the stash can't isolate it — say so
and name what the test does pin instead, rather than skipping the check silently.

## Read-cold checklist

Run down this list against every new or changed assertion. Most rot is one of the first two.

- **Constant imported from production on both sides.** `expect(x).toBe(SCOPE_NAME)` where test and
  code both import `SCOPE_NAME` compares a value to itself and survives any regression. Require a
  literal or the shape.
- **Asserts a value the test never supplied.** Searching a recorded call for a string the test didn't
  pass in passes regardless of the implementation.
- **Asserts the generic error, not the specific thing added.** If the change adds a scope name to a
  denial, the test must assert the scope name — not the error prefix that was already there.
- **Hand-written mock of a library error.** A mock of a Prisma/adapter/SDK error confirms only the
  author's assumption. Trigger the real error, or capture its shape verbatim (camelCase columns and
  literal quotes included) — the duplicate-response 500 shipped because the mock was an unquoted array.
- **Mock omits a field the code branches on.** Production pre-seeds it truthy; the mock drops it; the
  filter never filters and the test stays green. Check every mocked value against what production emits.
- **Empty-case only.** An assertion on the empty input proves nothing — especially for anything
  security-relevant (a privilege detector needs a *populated* case that would actually catch escalation).
- **Baseline captured after the mutation.** A snapshot or signature taken after the edit it exists to
  detect cannot fail. Baselines come first.
- **Destructive branch untested.** delete / revoke / deactivate is reliably the least-covered path and
  the one that matters. If the diff adds one, the test must exercise it.
- **`.tsx` unit test.** Reject outright — `CODING_STANDARDS.md` forbids component unit tests. The fix is to
  lift the logic into a `.ts` module and test that, or to add nothing. Do not accept an E2E invented
  as a substitute either.
- **New query with no cross-tenant test.** Tenancy has zero lint enforcement in this repo. Any new
  query is a candidate for the wrong-org / wrong-environment case.
- **Same rule in two places, tested on one side.** A picker + a runtime allowlist, a client + server
  validator — assert the two *agree* across grant/revoke/deactivate/delete, not each against a
  hand-listed set. The workflow-recipient bug passed its acceptance criterion this way.

## Triage order

1. Does a test exist for the diff's **headline guarantee**? If not, that absence is the finding.
2. Revert-run it. Green against broken source = dead test.
3. Scan assertions against the checklist. Report by the specific line it violates, not "looks weak".

Report a bad test as a blocker with the exact failure mode named, and the shape that would actually
fail. Do not rewrite the author's test silently — name the defect, propose the fix.
