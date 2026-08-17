import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import {
  enqueueAuthorizationComparison,
  getAuthorizationRolloutTarget,
  recordAuthorizationCheckIssued,
} from "./context";
import { recordAuthorizationComparison } from "./metrics";
import { getWorkspaceOrganizationReferences } from "./resolvers";
import { type TAuthorizationRolloutConfig, getAuthorizationRolloutConfig } from "./rollout-config";
import { observeWorkspaceListAuthorization } from "./workspace-list-observer";

const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("@formbricks/logger", () => ({ logger: loggerMocks }));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./context", () => ({
  enqueueAuthorizationComparison: vi.fn(),
  getAuthorizationRolloutTarget: vi.fn(),
  recordAuthorizationCheckIssued: vi.fn(),
}));
vi.mock("./metrics", () => ({ recordAuthorizationComparison: vi.fn() }));
vi.mock("./rollout-config", () => ({
  getAuthorizationRolloutConfig: vi.fn(),
  matchesRolloutRule: vi.fn(
    (rule, target, organizationId) =>
      rule.targets.includes(target) &&
      (rule.organizations.all || rule.organizations.ids.includes(organizationId))
  ),
  targetsRolloutSurface: vi.fn(
    (rule, target) =>
      rule.targets.includes(target) && (rule.organizations.all || rule.organizations.ids.length > 0)
  ),
}));
vi.mock("./resolvers", () => ({ getWorkspaceOrganizationReferences: vi.fn() }));

const emptyRule = (): TAuthorizationRolloutConfig["shadow"] => ({
  organizations: { all: false, ids: [] },
  targets: [],
});

const config = (overrides: Partial<TAuthorizationRolloutConfig> = {}): TAuthorizationRolloutConfig => ({
  cohort: "sandbox",
  enabled: true,
  enforcement: emptyRule(),
  shadow: {
    organizations: { all: false, ids: ["org-1"] },
    targets: ["mcp:user", "mcp:apiKey"],
  },
  ...overrides,
});

const lookupResources = vi.fn();
const queuedJobs: Array<() => Promise<void>> = [];

const userObservation = {
  actor: { id: "user-private-id", type: "user" },
  organizationIds: ["org-1", "org-2"],
  workspaces: [
    { id: "workspace-private-a", organizationId: "org-1" },
    { id: "workspace-private-b", organizationId: "org-2" },
  ],
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  queuedJobs.length = 0;
  vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(config());
  vi.mocked(getAuthorizationRolloutTarget).mockReturnValue("mcp:user");
  vi.mocked(enqueueAuthorizationComparison).mockImplementation((job) => {
    queuedJobs.push(job);
    return true;
  });
  vi.mocked(getAuthzedClient).mockReturnValue({ lookupResources } as never);
  lookupResources.mockResolvedValue({ resourceIds: ["workspace-private-a"] });
  vi.mocked(getWorkspaceOrganizationReferences).mockResolvedValue([
    { id: "workspace-private-a", organizationId: "org-1" },
  ]);
});

describe("observeWorkspaceListAuthorization", () => {
  test.each([
    [false, "mcp:user", ["org-1"]],
    [true, null, ["org-1"]],
    [true, "mcp:user", ["org-3"]],
  ] as const)(
    "does not construct an AuthZed client when enabled=%s, target=%s, cohort=%s",
    (enabled, target, cohort) => {
      vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
        config({
          enabled,
          shadow: { organizations: { all: false, ids: [...cohort] }, targets: ["mcp:user"] },
        })
      );
      vi.mocked(getAuthorizationRolloutTarget).mockReturnValue(target);

      observeWorkspaceListAuthorization(userObservation);

      expect(recordAuthorizationCheckIssued).toHaveBeenCalledOnce();
      expect(enqueueAuthorizationComparison).not.toHaveBeenCalled();
      expect(getAuthzedClient).not.toHaveBeenCalled();
    }
  );

  test("queues one lookup and records one match for identical selected sets", async () => {
    observeWorkspaceListAuthorization(userObservation);

    expect(queuedJobs).toHaveLength(1);
    expect(getAuthzedClient).not.toHaveBeenCalled();
    await queuedJobs[0]();

    expect(lookupResources).toHaveBeenCalledExactlyOnceWith({
      permission: "read",
      resourceType: "workspace",
      subject: { objectId: "user-private-id", objectType: "user" },
    });
    expect(recordAuthorizationComparison).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        action: "workspace.read",
        authzedDecision: "allow",
        legacyDecision: "allow",
        mode: "shadow",
        outcome: "match",
        resourceType: "workspace",
        surface: "mcp",
      })
    );
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  test("records a deny/deny match for two empty sets", async () => {
    lookupResources.mockResolvedValue({ resourceIds: [] });
    vi.mocked(getWorkspaceOrganizationReferences).mockResolvedValue([]);

    observeWorkspaceListAuthorization({ ...userObservation, workspaces: [] });
    await queuedJobs[0]();

    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ authzedDecision: "deny", legacyDecision: "deny", outcome: "match" })
    );
  });

  test("emits both mismatch directions for bidirectional drift without logging identifiers", async () => {
    lookupResources.mockResolvedValue({ resourceIds: ["workspace-authzed-only"] });
    vi.mocked(getWorkspaceOrganizationReferences).mockResolvedValue([
      { id: "workspace-authzed-only", organizationId: "org-1" },
    ]);

    observeWorkspaceListAuthorization(userObservation);
    await queuedJobs[0]();

    expect(recordAuthorizationComparison).toHaveBeenCalledTimes(2);
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "legacy_allow_authzed_deny" })
    );
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "legacy_deny_authzed_allow" })
    );
    expect(loggerMocks.warn).toHaveBeenCalledTimes(2);
    const logged = JSON.stringify(loggerMocks.warn.mock.calls);
    expect(logged).not.toContain("workspace-private-a");
    expect(logged).not.toContain("workspace-authzed-only");
    expect(logged).not.toContain("org-1");
    expect(logged).not.toContain("user-private-id");
    expect(logged).toContain("differenceCount");
  });

  test("treats an unresolved lookup result as AuthZed-extra drift", async () => {
    lookupResources.mockResolvedValue({ resourceIds: ["unknown-private-workspace"] });
    vi.mocked(getWorkspaceOrganizationReferences).mockResolvedValue([]);

    observeWorkspaceListAuthorization({ ...userObservation, workspaces: [] });
    await queuedJobs[0]();

    expect(recordAuthorizationComparison).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ outcome: "legacy_deny_authzed_allow" })
    );
    expect(JSON.stringify(loggerMocks.warn.mock.calls)).not.toContain("unknown-private-workspace");
  });

  test("treats API-key results from a foreign organization as AuthZed-extra drift", async () => {
    vi.mocked(getAuthorizationRolloutTarget).mockReturnValue("mcp:apiKey");
    lookupResources.mockResolvedValue({ resourceIds: ["foreign-private-workspace"] });
    vi.mocked(getWorkspaceOrganizationReferences).mockResolvedValue([
      { id: "foreign-private-workspace", organizationId: "org-foreign" },
    ]);

    observeWorkspaceListAuthorization({
      actor: { id: "api-key-private-id", type: "apiKey" },
      organizationIds: ["org-1"],
      workspaces: [],
    });
    await queuedJobs[0]();

    expect(lookupResources).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { objectId: "api-key-private-id", objectType: "api_key" } })
    );
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "legacy_deny_authzed_allow" })
    );
  });

  test("excludes organizations selected for enforcement because list observation is shadow-only", () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        enforcement: {
          organizations: { all: false, ids: ["org-1"] },
          targets: ["mcp:user"],
        },
      })
    );

    observeWorkspaceListAuthorization(userObservation);

    expect(enqueueAuthorizationComparison).not.toHaveBeenCalled();
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("records a sanitized operational error for lookup failures", async () => {
    lookupResources.mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "lookup_resources",
        retryable: true,
      })
    );

    observeWorkspaceListAuthorization(userObservation);
    await expect(queuedJobs[0]()).resolves.toBeUndefined();

    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AUTHZED_ERROR_CODES.UNAVAILABLE,
        errorSource: "authzed",
        outcome: "operational_error",
      })
    );
    expect(JSON.stringify(loggerMocks.warn.mock.calls)).not.toContain("workspace-private-a");
  });

  test("records a scheduler error without constructing an AuthZed client", () => {
    vi.mocked(enqueueAuthorizationComparison).mockReturnValue(false);

    observeWorkspaceListAuthorization(userObservation);

    expect(getAuthzedClient).not.toHaveBeenCalled();
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ errorSource: "scheduler", outcome: "operational_error" })
    );
  });

  test("performs one lookup regardless of legacy list cardinality", async () => {
    const workspaces = Array.from({ length: 100 }, (_, index) => ({
      id: `workspace-${index}`,
      organizationId: "org-1",
    }));
    lookupResources.mockResolvedValue({ resourceIds: workspaces.map(({ id }) => id) });
    vi.mocked(getWorkspaceOrganizationReferences).mockResolvedValue(workspaces);

    observeWorkspaceListAuthorization({ ...userObservation, workspaces });
    await queuedJobs[0]();

    expect(lookupResources).toHaveBeenCalledOnce();
    expect(recordAuthorizationCheckIssued).toHaveBeenCalledOnce();
  });
});
