import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getSurveyAuthorizationScopeRow, isAuthorizationUserActive } from "./resolvers";
import { spicedbEvaluator } from "./spicedb-evaluator";

/**
 * ENG-3282: a survey just created or copied has no edges on its graph node until the outbox delivers
 * it. The real scope resolution and the real evaluator run here, over a graph that only knows the
 * workspace — so the owner being allowed proves the decision never consults the empty survey node.
 */
vi.mock("@/lib/constants", () => ({ USER_MANAGEMENT_MINIMUM_ROLE: "manager" }));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("./resolvers", () => ({
  getApiKeyOrganizationId: vi.fn(),
  getSurveyAuthorizationScopeRow: vi.fn(),
  isAuthorizationUserActive: vi.fn(),
}));

const owner = { type: "user", id: "owner-1" } as const;
const member = { type: "user", id: "member-1" } as const;
const survey = { type: "survey", id: "survey-1" } as const;

/** Workspace edges exist for both users; the survey node has none, and nobody administers. */
const checkPermission = vi.fn(async ({ permission, resource }) => ({
  allowed: resource.objectType === "workspace" && permission !== "administer",
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthzedClient).mockReturnValue({ checkPermission } as never);
  vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
  vi.mocked(isAuthorizationUserActive).mockResolvedValue(true);
  vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue({
    id: "survey-1",
    organizationId: "org-1",
    ownerId: "owner-1",
    visibility: "workspace",
    // Just inserted: one version ahead of an acknowledgement that has never happened.
    visibilityProjectedVersion: 0,
    visibilityVersion: 1,
    workspaceId: "workspace-1",
  });
});

describe("a never-projected survey under enforced visibility", () => {
  test("its owner can read and write it with no edges on the survey node", async () => {
    await expect(spicedbEvaluator.can(owner, "survey.read", survey)).resolves.toBe(true);
    await expect(spicedbEvaluator.can(owner, "survey.write", survey)).resolves.toBe(true);

    const resources = checkPermission.mock.calls.map(([check]) => check.resource.objectType);
    expect(resources).toEqual(["workspace", "workspace"]);
  });

  test("anyone else still needs to administer the organization until it is projected", async () => {
    await expect(spicedbEvaluator.can(member, "survey.read", survey)).resolves.toBe(false);
    expect(checkPermission).toHaveBeenCalledWith(expect.objectContaining({ permission: "administer" }));
  });
});
