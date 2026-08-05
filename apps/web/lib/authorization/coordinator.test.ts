import { beforeEach, describe, expect, test, vi } from "vitest";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { enqueueAuthorizationComparison, getAuthorizationRolloutTarget } from "./context";
import { authorizationCoordinator } from "./coordinator";
import { legacyEvaluator } from "./legacy-evaluator";
import { recordAuthorizationComparison } from "./metrics";
import { getAuthorizationRolloutConfig } from "./rollout-config";
import { resolveAuthorizationScope } from "./source-scope";
import { checkSpicedbPermissionAtScope } from "./spicedb-evaluator";

vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("./context", () => ({
  enqueueAuthorizationComparison: vi.fn(),
  getAuthorizationRolloutTarget: vi.fn(),
}));
vi.mock("./legacy-evaluator", () => ({ legacyEvaluator: { can: vi.fn() } }));
vi.mock("./metrics", () => ({ recordAuthorizationComparison: vi.fn() }));
vi.mock("./rollout-config", () => ({
  getAuthorizationRolloutConfig: vi.fn(),
  matchesRolloutRule: vi.fn(
    (rule, target, organizationId) =>
      rule.targets.includes(target) &&
      (rule.organizations.all || rule.organizations.ids.includes(organizationId))
  ),
  targetsRolloutSurface: vi.fn((rule, target) => rule.targets.includes(target)),
}));
vi.mock("./source-scope", () => ({ resolveAuthorizationScope: vi.fn() }));
vi.mock("./spicedb-evaluator", () => ({ checkSpicedbPermissionAtScope: vi.fn() }));

const emptyRule = () => ({ organizations: { all: false, ids: [] }, targets: [] });
const config = (overrides: Record<string, unknown> = {}) => ({
  cohort: "sandbox",
  enabled: true,
  enforcement: emptyRule(),
  shadow: emptyRule(),
  ...overrides,
});

const actor = { type: "user", id: "user-1" } as const;
const resource = { type: "survey", id: "survey-1" } as const;
const queuedJobs: Array<() => Promise<void>> = [];

beforeEach(() => {
  vi.clearAllMocks();
  queuedJobs.length = 0;
  vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(config() as never);
  vi.mocked(getAuthorizationRolloutTarget).mockReturnValue("server_action:user");
  vi.mocked(enqueueAuthorizationComparison).mockImplementation((job) => {
    queuedJobs.push(job);
    return true;
  });
  vi.mocked(legacyEvaluator.can).mockResolvedValue(true);
  vi.mocked(resolveAuthorizationScope).mockResolvedValue({
    actorValid: true,
    organizationId: "org-1",
    permissionResource: { type: "workspace", id: "workspace-1" },
  });
  vi.mocked(checkSpicedbPermissionAtScope).mockResolvedValue(true);
});

describe("authorizationCoordinator", () => {
  test.each([
    [false, "server_action:user"],
    [true, null],
  ] as const)("uses only legacy when enabled=%s and target=%s", async (enabled, target) => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(config({ enabled }) as never);
    vi.mocked(getAuthorizationRolloutTarget).mockReturnValue(target);

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).resolves.toBe(true);

    expect(legacyEvaluator.can).toHaveBeenCalledOnce();
    expect(resolveAuthorizationScope).not.toHaveBeenCalled();
    expect(checkSpicedbPermissionAtScope).not.toHaveBeenCalled();
  });

  test("returns legacy inline and compares AuthZed after the response in shadow mode", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        shadow: {
          organizations: { all: false, ids: ["org-1"] },
          targets: ["server_action:user"],
        },
      }) as never
    );
    vi.mocked(checkSpicedbPermissionAtScope).mockResolvedValue(false);

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).resolves.toBe(true);
    expect(legacyEvaluator.can).toHaveBeenCalledOnce();
    expect(resolveAuthorizationScope).not.toHaveBeenCalled();
    expect(queuedJobs).toHaveLength(1);

    await queuedJobs[0]();
    expect(resolveAuthorizationScope).toHaveBeenCalledOnce();
    expect(checkSpicedbPermissionAtScope).toHaveBeenCalledOnce();
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        authzedDecision: "deny",
        legacyDecision: "allow",
        mode: "shadow",
        outcome: "legacy_allow_authzed_deny",
      })
    );
  });

  test("records a shadow outage without changing the legacy result", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        shadow: {
          organizations: { all: true, ids: [] },
          targets: ["server_action:user"],
        },
      }) as never
    );
    vi.mocked(checkSpicedbPermissionAtScope).mockRejectedValue(
      new AuthzedError({
        attempts: 3,
        code: AUTHZED_ERROR_CODES.UNAVAILABLE,
        operation: "check_permission",
        retryable: true,
      })
    );

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).resolves.toBe(true);
    await expect(queuedJobs[0]()).resolves.toBeUndefined();
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "authzed_unavailable", outcome: "operational_error" })
    );
  });

  test("enforces AuthZed inline and compares legacy after the response", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        enforcement: {
          organizations: { all: false, ids: ["org-1"] },
          targets: ["server_action:user"],
        },
      }) as never
    );
    vi.mocked(checkSpicedbPermissionAtScope).mockResolvedValue(false);

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).resolves.toBe(false);
    expect(checkSpicedbPermissionAtScope).toHaveBeenCalledOnce();
    expect(legacyEvaluator.can).not.toHaveBeenCalled();
    expect(queuedJobs).toHaveLength(1);

    await queuedJobs[0]();
    expect(legacyEvaluator.can).toHaveBeenCalledOnce();
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        authzedDecision: "deny",
        legacyDecision: "allow",
        mode: "enforcement",
        outcome: "legacy_allow_authzed_deny",
      })
    );
  });

  test("enforcement takes precedence over an overlapping shadow rule", async () => {
    const rule = {
      organizations: { all: true, ids: [] },
      targets: ["server_action:user"],
    };
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({ enforcement: rule, shadow: rule }) as never
    );

    await authorizationCoordinator.can(actor, "survey.read", resource);

    expect(checkSpicedbPermissionAtScope).toHaveBeenCalledOnce();
    expect(queuedJobs).toHaveLength(1);
    expect(legacyEvaluator.can).not.toHaveBeenCalled();
  });

  test("uses legacy when the resolved organization is outside both cohorts", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        enforcement: {
          organizations: { all: false, ids: ["org-2"] },
          targets: ["server_action:user"],
        },
      }) as never
    );

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).resolves.toBe(true);
    expect(resolveAuthorizationScope).toHaveBeenCalledOnce();
    expect(checkSpicedbPermissionAtScope).not.toHaveBeenCalled();
    expect(legacyEvaluator.can).toHaveBeenCalledOnce();
  });

  test("fails closed with a stable AuthZed error when enforcement resolution fails", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        enforcement: {
          organizations: { all: true, ids: [] },
          targets: ["server_action:user"],
        },
      }) as never
    );
    vi.mocked(resolveAuthorizationScope).mockRejectedValue(new Error("database unavailable"));

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.INTERNAL,
    });
    expect(legacyEvaluator.can).not.toHaveBeenCalled();
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "authzed_internal", errorSource: "source" })
    );
  });

  test("propagates an enforcement AuthZed outage rather than returning a denial", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        enforcement: {
          organizations: { all: true, ids: [] },
          targets: ["server_action:user"],
        },
      }) as never
    );
    const outage = new AuthzedError({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      operation: "check_permission",
      retryable: true,
    });
    vi.mocked(checkSpicedbPermissionAtScope).mockRejectedValue(outage);

    const thrown = await authorizationCoordinator
      .can(actor, "survey.read", resource)
      .catch((error: unknown) => error);
    expect(thrown).toMatchObject({
      attempts: 3,
      code: AUTHZED_ERROR_CODES.UNAVAILABLE,
      operation: "authorization_enforcement",
      retryable: true,
    });
    expect(thrown).not.toHaveProperty("cause", outage);
    expect(legacyEvaluator.can).not.toHaveBeenCalled();
  });

  test("records scheduler failure without changing the authoritative decision", async () => {
    vi.mocked(getAuthorizationRolloutConfig).mockReturnValue(
      config({
        shadow: {
          organizations: { all: true, ids: [] },
          targets: ["server_action:user"],
        },
      }) as never
    );
    vi.mocked(enqueueAuthorizationComparison).mockReturnValue(false);

    await expect(authorizationCoordinator.can(actor, "survey.read", resource)).resolves.toBe(true);
    expect(recordAuthorizationComparison).toHaveBeenCalledWith(
      expect.objectContaining({ errorSource: "scheduler", outcome: "operational_error" })
    );
  });
});
