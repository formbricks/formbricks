# Test recipes

Load a section only when the change matches its shape. Each recipe is derived from a real 5.3 QA
finding that a PR-level test would have caught. Names are illustrative — match them to the actual
modules in the diff.

Contents: [Declared vs enforced contract](#declared-vs-enforced-contract) ·
[Same rule in two places](#same-rule-in-two-places) ·
[Library error shapes](#library-error-shapes) ·
[Fixes outside TypeScript](#fixes-outside-typescript) ·
[Silent drops](#silent-drops) ·
[Seeded state](#seeded-state)

---

## Declared vs enforced contract

**When:** the diff registers something with a declared capability — an MCP tool's scope, a
`readOnlyHint`, a permission annotation — while a layer underneath does the enforcing.

**The failure:** three separate 5.3 findings, all this shape. A tool registered `["surveys:read"]`
with `readOnlyHint: true`, whose v3 operation hard-codes `readWrite`, so read-only credentials still
403. The code comment described behaviour the code did not implement. A second tool had the identical
mismatch and was found only by going looking for more instances.

**Do not** write one test per tool. Parameterize over the registry, so instances that do not exist
yet are covered too:

```ts
describe.each(registeredTools)("$name", (tool) => {
  it("is usable with exactly the scope it declares", async () => {
    const credential = credentialWithScopes(tool.declaredScopes);
    const res = await callTool(tool.name, minimalValidPayload(tool), credential);
    expect(res.status).not.toBe(403);
  });

  it("is refused without its declared scope", async () => {
    const res = await callTool(tool.name, minimalValidPayload(tool), credentialWithScopes([]));
    expect(res.status).toBe(403);
  });
});
```

The second case matters as much as the first: without it, a gate that silently stopped enforcing
anything still passes. Assert the specific scope in the denial, not the generic error prefix.

---

## Same rule in two places

**When:** the diff implements a rule in one place that also exists somewhere else — a UI picker and a
runtime allowlist, a client validator and a server validator, an enable gate and a send-time
backstop.

**The failure:** the workflow recipient bug. The picker resolved allowed recipients from the
workspace's teams; the allowlist resolved them from org membership. Revoking a team's workspace
access emptied the picker while the emails kept sending. Both sides were individually correct. The
ticket's acceptance criterion tested org removal and passed.

**Assert the two agree**, rather than testing each against a list of cases you thought of:

```ts
it("runtime allowlist agrees with what the editor offers", async () => {
  await revokeWorkspaceAccess(teamId, workspaceB.id);

  expect(await runtimeAllowedRecipients(workflowInB).then(sorted))
    .toEqual(await editorOfferedRecipients(workspaceB.id).then(sorted));
});
```

This catches the cases nobody enumerated, which is the entire point. Run it across each state
transition that could move one side without the other: grant, revoke, deactivate, delete.

---

## Library error shapes

**When:** the diff parses or branches on an error produced by Prisma, a driver adapter, an SDK, or
any code you do not own.

**The failure:** the Prisma 7 duplicate-response 500s. A shared helper read the right field, but the
adapter returns camelCase column names wrapped in literal double quotes, so every comparison failed
and duplicate single-use submissions still 500'd on the public submission endpoint. **A test existed
and passed** — it asserted a hand-written mock of the error, an unquoted array. It could only confirm
the author's assumption. It also only broke for camelCase columns, because Postgres quotes
identifiers only when it must, which is why it went unnoticed.

**Trigger the real error.** Never hand-write the shape:

```ts
it("extracts constraint fields from a real adapter error", async () => {
  await createResponse({ surveyId, singleUseId: "dup-001" });
  const err = await createResponse({ surveyId, singleUseId: "dup-001" }).catch((e) => e);

  expect(getUniqueConstraintFields(err)).toEqual(["surveyId", "singleUseId"]);
});
```

Then assert the user-visible outcome too — the mapped domain error, not a 500. If a unit test must
mock the shape, capture it from a real error first and paste it verbatim, camelCase column included.

---

## Fixes outside TypeScript

**When:** the fix lives in a `package.json` script, a CLI flag, `cross-env` values, a Dockerfile, a
Helm chart, or CI config.

**The failure:** a fix making `typegen` exit non-zero was tested by executing the TS entry directly,
while the bug was in the script's hardcoded env values. The test bypassed the entrypoint, so
`pnpm typegen` still exited 0 with a green suite.

**Run what CI and humans run:**

```ts
it("exits non-zero when env validation fails", () => {
  const res = spawnSync("pnpm", ["typegen"], { env: { ...process.env, ...invalidEnv } });
  expect(res.status).not.toBe(0);
});
```

Same principle for container and chart changes: assert against the rendered output, not the template
source.

---

## Silent drops

**When:** the diff adds a side effect that is not on the request's critical path — an audit event, a
metric, a webhook, a queued job. Failures here are invisible by construction.

**The failure:** MCP mutations produced no audit log at all, because the URL failed validation and
the event was discarded without surfacing anything.

**Assert the effect happened, and assert the failure is loud:**

```ts
it("emits an audit event for a mutation", async () => {
  await callTool("create_survey", payload, credential);
  expect(auditEventsFor(credential)).toHaveLength(1);
});

it("surfaces a rejected audit event rather than swallowing it", async () => {
  await expect(emitAudit(invalidEvent)).rejects.toThrow();
});
```

Assert a literal or the shape — never a constant imported from production, or the test compares a
value to itself and survives the regression it exists to prevent.

---

## Seeded state

**When:** the test needs more than one org, more than one role, API keys at several permission
levels, or surveys with responses.

Build state through the shared seed fixtures rather than inside the test. Tests that construct their
own multi-org state drift apart, are slow, and make failures irreproducible for whoever picks up the
bug.

If the fixture you need does not exist, extend the seed rather than inlining it — the next test needs
it too, and so does manual QA, which is where most of the setup cost currently goes.

For Playwright specifically: one spec per flow, happy path, asserting the user-visible outcome via
stable test ids. Do not assert exact chart ticks or pixel values — those need seeded aggregates and
are brittle enough to get muted, which is worse than not having them. This is the test recipe.
