import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthzedBackfillResult } from "./backfill";
import { parseAuthzedBackfillCommand, runAuthzedBackfillCli } from "./backfill-cli";
import { AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN } from "./constants";
import { AUTHZED_ERROR_CODES, AuthzedError } from "./errors";

// Neutralize the real default dependencies at import time; behaviour comes from per-test overrides.
vi.mock("./api-key", () => ({ reconcileApiKeyRelationships: vi.fn() }));
vi.mock("./backfill", () => ({ runAuthzedBackfill: vi.fn() }));
vi.mock("./client", () => ({ closeAuthzedClient: vi.fn(), getAuthzedClient: vi.fn() }));
vi.mock("./config", () => ({ isAuthzedEnabled: vi.fn() }));
vi.mock("./organization-membership", () => ({ reconcileOrganizationMemberships: vi.fn() }));
vi.mock("./team-workspace", () => ({ reconcileTeamWorkspaceRelationships: vi.fn() }));

const ORGANIZATION_ID = "clhx8n2p40000qwer1234asdf";
const OTHER_ORGANIZATION_ID = "clhx8n2p40001qwer1234asdf";
const WORKSPACE_ID = "clhx8n2p40002qwer1234asdf";
const ENDPOINT = "spicedb.internal:50051";

const result = (overrides: Partial<TAuthzedBackfillResult> = {}): TAuthzedBackfillResult => ({
  completedAtSnapshot: "revision-1",
  counters: {
    failed: 0,
    ignored: 0,
    invalid: 0,
    mismatchedParents: 0,
    missing: 0,
    orphaned: 0,
    pruned: 0,
    reconciled: 1,
    scanned: 1,
    skipped: 0,
  },
  failures: [],
  lastOrganizationId: ORGANIZATION_ID,
  mismatchedParents: [],
  mode: "apply",
  orphanScope: "all",
  orphans: [],
  scope: "all",
  status: "reconciled",
  truncated: false,
  unmanaged: [],
  ...overrides,
});

const command = (overrides: Partial<Parameters<typeof runAuthzedBackfillCli>[0]> = {}) => ({
  maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
  mode: "dry_run" as const,
  prune: false,
  ...overrides,
});

const deps = (overrides = {}) => ({
  closeClient: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(true),
  resolveEndpoint: vi.fn().mockReturnValue(ENDPOINT),
  run: vi.fn().mockResolvedValue(result()),
  writeOutput: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseAuthzedBackfillCommand", () => {
  test("defaults to a dry run over every organization, so a mistyped invocation is inert", () => {
    expect(parseAuthzedBackfillCommand([])).toEqual({
      afterOrganizationId: undefined,
      expectedEndpoint: undefined,
      maxPrune: AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN,
      mode: "dry_run",
      organizationId: undefined,
      prune: false,
    });
  });

  test("accepts an applying run without pruning", () => {
    expect(parseAuthzedBackfillCommand(["--apply"])).toMatchObject({ mode: "apply", prune: false });
  });

  test("accepts a confirmed prune scoped to one workspace", () => {
    // The workspace scope satisfies the explicit-scope requirement, and it is the path that removes
    // every relationship on a stale workspace ID — so it needs the same coverage as the organization.
    expect(
      parseAuthzedBackfillCommand([
        "--apply",
        "--prune",
        "--confirm-prune",
        `--workspace-id=${WORKSPACE_ID}`,
        `--expected-endpoint=${ENDPOINT}`,
      ])
    ).toMatchObject({ mode: "apply", prune: true, workspaceId: WORKSPACE_ID });
  });

  test.each([
    ["a workspace combined with the full sweep", [`--workspace-id=${WORKSPACE_ID}`, "--scope=all"]],
    [
      "a workspace combined with an organization",
      [`--workspace-id=${WORKSPACE_ID}`, `--organization-id=${ORGANIZATION_ID}`],
    ],
    [
      "a workspace combined with a resume cursor",
      [`--workspace-id=${WORKSPACE_ID}`, `--after-organization-id=${ORGANIZATION_ID}`],
    ],
    ["a malformed workspace id", ["--workspace-id=not-a-cuid"]],
    ["a repeated workspace id", [`--workspace-id=${WORKSPACE_ID}`, `--workspace-id=${WORKSPACE_ID}`]],
  ])("refuses %s", (_label, args) => {
    expect(parseAuthzedBackfillCommand(args)).toBeUndefined();
  });

  test("refuses a workspace prune that is missing a confirmation", () => {
    expect(
      parseAuthzedBackfillCommand([
        "--apply",
        "--prune",
        `--workspace-id=${WORKSPACE_ID}`,
        `--expected-endpoint=${ENDPOINT}`,
      ])
    ).toBeUndefined();
  });

  test("accepts a fully-confirmed prune", () => {
    expect(
      parseAuthzedBackfillCommand([
        "--apply",
        "--prune",
        "--confirm-prune",
        "--scope=all",
        `--expected-endpoint=${ENDPOINT}`,
      ])
    ).toMatchObject({ expectedEndpoint: ENDPOINT, mode: "apply", prune: true });
  });

  test("accepts a confirmed prune scoped to one organization", () => {
    expect(
      parseAuthzedBackfillCommand([
        "--apply",
        "--prune",
        "--confirm-prune",
        `--organization-id=${ORGANIZATION_ID}`,
        `--expected-endpoint=${ENDPOINT}`,
      ])
    ).toMatchObject({ organizationId: ORGANIZATION_ID, prune: true });
  });

  test.each([
    ["without --apply", ["--prune", "--confirm-prune", "--scope=all", `--expected-endpoint=${ENDPOINT}`]],
    ["without --confirm-prune", ["--apply", "--prune", "--scope=all", `--expected-endpoint=${ENDPOINT}`]],
    [
      "without an explicit scope",
      ["--apply", "--prune", "--confirm-prune", `--expected-endpoint=${ENDPOINT}`],
    ],
    ["without --expected-endpoint", ["--apply", "--prune", "--confirm-prune", "--scope=all"]],
  ])("refuses a prune %s", (_label, args) => {
    // Removing relationships must never be reachable by a shorter command than the full spelling.
    expect(parseAuthzedBackfillCommand(args)).toBeUndefined();
  });

  test("refuses --confirm-prune without --prune, so the confirmation cannot be left lying around", () => {
    expect(parseAuthzedBackfillCommand(["--apply", "--confirm-prune"])).toBeUndefined();
  });

  test.each([
    ["an unknown flag", ["--force"]],
    ["a bare argument", ["all"]],
    ["a misspelled flag", ["--dry-run"]],
    ["an unsupported scope value", ["--scope=organization"]],
    ["a malformed organization id", ["--organization-id=not-a-cuid!"]],
    ["a malformed resume cursor", ["--after-organization-id=nope"]],
    ["both a scope and an organization", ["--scope=all", `--organization-id=${ORGANIZATION_ID}`]],
    [
      "an organization together with a resume cursor",
      [`--organization-id=${ORGANIZATION_ID}`, `--after-organization-id=${OTHER_ORGANIZATION_ID}`],
    ],
    ["a non-numeric prune cap", ["--max-prune=lots"]],
    ["a zero prune cap", ["--max-prune=0"]],
    // Silently taking the first would let an operator who typed a value twice act on a different value
    // than the one they last wrote.
    ["a repeated prune cap", ["--max-prune=1", "--max-prune=400"]],
    [
      "a repeated organization",
      [`--organization-id=${ORGANIZATION_ID}`, `--organization-id=${OTHER_ORGANIZATION_ID}`],
    ],
    ["a repeated endpoint", [`--expected-endpoint=${ENDPOINT}`, "--expected-endpoint=other:50051"]],
    ["a repeated scope", ["--scope=all", "--scope=all"]],
  ])("refuses %s", (_label, args) => {
    expect(parseAuthzedBackfillCommand(args)).toBeUndefined();
  });

  test("allows lowering the prune cap", () => {
    expect(parseAuthzedBackfillCommand(["--max-prune=10"])).toMatchObject({ maxPrune: 10 });
  });

  test("refuses raising the prune cap above the built-in bound", () => {
    // The cap exists because a large orphan count is a symptom; an operator must not be able to
    // configure the symptom away.
    expect(
      parseAuthzedBackfillCommand([`--max-prune=${AUTHZED_MAX_PRUNED_RESOURCES_PER_RUN + 1}`])
    ).toBeUndefined();
  });

  test("accepts a resume cursor", () => {
    expect(parseAuthzedBackfillCommand([`--after-organization-id=${ORGANIZATION_ID}`])).toMatchObject({
      afterOrganizationId: ORGANIZATION_ID,
    });
  });
});

describe("runAuthzedBackfillCli", () => {
  test.each([
    ["reconciled", 0],
    ["drifted", 2],
    ["failed", 1],
  ] as const)("returns exit code %s -> %i and serializes the result exactly", async (status, exitCode) => {
    const backfillResult = result({ status });
    const dependencies = deps({ run: vi.fn().mockResolvedValue(backfillResult) });

    await expect(runAuthzedBackfillCli(command(), dependencies)).resolves.toBe(exitCode);

    expect(dependencies.writeOutput).toHaveBeenCalledOnce();
    expect(dependencies.writeOutput).toHaveBeenCalledWith(`${JSON.stringify(backfillResult)}\n`);
    expect(dependencies.closeClient).toHaveBeenCalledOnce();
  });

  test("refuses to run at all when AuthZed is disabled", async () => {
    // A per-unit `disabled` result would otherwise read as "not failed" and the run would claim to have
    // reconciled organizations it never touched.
    const dependencies = deps({ isEnabled: vi.fn().mockReturnValue(false) });

    await expect(runAuthzedBackfillCli(command(), dependencies)).resolves.toBe(1);

    expect(dependencies.run).not.toHaveBeenCalled();
    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({ code: AUTHZED_ERROR_CODES.DISABLED, retryable: false, status: "failed" })}\n`
    );
  });

  test("refuses to run when the named endpoint is not the configured one", async () => {
    // The guard against a stale .env aiming the destructive path at the wrong instance.
    const dependencies = deps({ resolveEndpoint: vi.fn().mockReturnValue("spicedb.production:50051") });

    await expect(
      runAuthzedBackfillCli(command({ expectedEndpoint: ENDPOINT, mode: "apply", prune: true }), dependencies)
    ).resolves.toBe(1);

    expect(dependencies.run).not.toHaveBeenCalled();
    // A distinct code from a mistyped flag: aiming the destructive path at the wrong instance is a very
    // different mistake, and the operator should be able to tell which one happened.
    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({ code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION, retryable: false, status: "failed" })}\n`
    );
  });

  test("proceeds when the named endpoint matches", async () => {
    const dependencies = deps();

    await expect(
      runAuthzedBackfillCli(command({ expectedEndpoint: ENDPOINT, mode: "apply" }), dependencies)
    ).resolves.toBe(0);

    expect(dependencies.run).toHaveBeenCalledOnce();
  });

  test("supplies inert reconcilers for a dry run", async () => {
    const dependencies = deps();

    await runAuthzedBackfillCli(command({ mode: "dry_run" }), dependencies);

    const [request, apply] = dependencies.run.mock.calls[0];
    expect(request.mode).toBe("dry_run");
    await expect(apply.reconcileMemberships({})).resolves.toEqual({ passes: 0, status: "projected" });
    await expect(apply.reconcileTeamWorkspace({})).resolves.toEqual({ passes: 0, status: "projected" });
    await expect(apply.reconcileApiKeys({})).resolves.toEqual({ passes: 0, status: "projected" });
  });

  test("translates a named organization into a single-organization scope", async () => {
    const dependencies = deps();

    await runAuthzedBackfillCli(command({ organizationId: ORGANIZATION_ID }), dependencies);

    expect(dependencies.run.mock.calls[0][0].scope).toEqual({
      kind: "organization",
      organizationId: ORGANIZATION_ID,
    });
  });

  test("translates a resume cursor into a full scope that starts after it", async () => {
    const dependencies = deps();

    await runAuthzedBackfillCli(command({ afterOrganizationId: ORGANIZATION_ID }), dependencies);

    expect(dependencies.run.mock.calls[0][0].scope).toEqual({
      afterOrganizationId: ORGANIZATION_ID,
      kind: "all",
    });
  });

  test("prints only the stable error contract and closes the client on failure", async () => {
    const secret = "never-log-this-authzed-token";
    const dependencies = deps({
      run: vi.fn().mockRejectedValue(
        new AuthzedError({
          attempts: 1,
          cause: new Error(secret),
          code: AUTHZED_ERROR_CODES.UNAVAILABLE,
          operation: "read_relationships",
          retryable: true,
        })
      ),
    });

    await expect(runAuthzedBackfillCli(command(), dependencies)).resolves.toBe(1);

    expect(dependencies.writeOutput).toHaveBeenCalledWith(
      `${JSON.stringify({ code: AUTHZED_ERROR_CODES.UNAVAILABLE, retryable: true, status: "failed" })}\n`
    );
    expect(JSON.stringify(dependencies.writeOutput.mock.calls)).not.toContain(secret);
    expect(dependencies.closeClient).toHaveBeenCalledOnce();
  });

  test("maps a non-AuthZed failure onto the same sanitized contract", async () => {
    const dependencies = deps({ run: vi.fn().mockRejectedValue(new Error("Organization not found")) });

    await expect(runAuthzedBackfillCli(command(), dependencies)).resolves.toBe(1);

    expect(JSON.stringify(dependencies.writeOutput.mock.calls)).not.toContain("Organization not found");
  });

  test("a cleanup failure does not replace the result or the exit code", async () => {
    const backfillResult = result({ status: "drifted" });
    const dependencies = deps({
      closeClient: vi.fn().mockImplementation(() => {
        throw new Error("channel already closed");
      }),
      run: vi.fn().mockResolvedValue(backfillResult),
    });

    await expect(runAuthzedBackfillCli(command(), dependencies)).resolves.toBe(2);

    expect(dependencies.writeOutput).toHaveBeenCalledWith(`${JSON.stringify(backfillResult)}\n`);
  });
});
