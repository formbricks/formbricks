import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import {
  type TSurveyAuthorizationScopeRow,
  getApiKeyOrganizationId,
  getSurveyAuthorizationScopeRow,
  isAuthorizationUserActive,
} from "./resolvers";
import { spicedbEvaluator } from "./spicedb-evaluator";

/**
 * ENG-3282: a survey just created or copied has no edges on its graph node until the outbox delivers
 * it. The real scope resolution and the real evaluator run here, over a graph that only knows the
 * workspace (every actor below may read and write it; nobody administers the organization) — so any
 * `allowed` proves the decision never consulted the empty survey node.
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
const apiKey = { type: "apiKey", id: "key-1" } as const;
const survey = { type: "survey", id: "survey-1" } as const;

const checkPermission = vi.fn(async ({ permission, resource }) => ({
  allowed: resource.objectType === "workspace" && permission !== "administer",
}));

const storeRow = (overrides: Partial<TSurveyAuthorizationScopeRow>) =>
  vi.mocked(getSurveyAuthorizationScopeRow).mockResolvedValue({
    id: "survey-1",
    organizationId: "org-1",
    ownerId: "owner-1",
    visibility: "workspace",
    // Just inserted: one version ahead of an acknowledgement that has never happened.
    visibilityProjectedVersion: 0,
    visibilityVersion: 1,
    workspaceId: "workspace-1",
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthzedClient).mockReturnValue({ checkPermission } as never);
  vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
  vi.mocked(isAuthorizationUserActive).mockResolvedValue(true);
  vi.mocked(getApiKeyOrganizationId).mockResolvedValue("org-1");
});

const surveyNodeChecks = () =>
  checkPermission.mock.calls.filter(([check]) => check.resource.objectType === "survey");

describe("a survey inserted workspace-visible and not yet projected", () => {
  beforeEach(() => storeRow({}));

  test("the API key that created it can read and write it at once (GET, PUT, response POST)", async () => {
    await expect(spicedbEvaluator.can(apiKey, "survey.read", survey)).resolves.toBe(true);
    await expect(spicedbEvaluator.can(apiKey, "survey.write", survey)).resolves.toBe(true);
    await expect(spicedbEvaluator.can(apiKey, "survey.response_read", survey)).resolves.toBe(true);
    expect(surveyNodeChecks()).toEqual([]);
  });

  test("any workspace member can open it, not only its owner", async () => {
    await expect(spicedbEvaluator.can(member, "survey.read", survey)).resolves.toBe(true);
    await expect(spicedbEvaluator.can(owner, "survey.write", survey)).resolves.toBe(true);
    expect(surveyNodeChecks()).toEqual([]);
  });
});

describe("a survey inserted restricted and not yet projected", () => {
  beforeEach(() => storeRow({ visibility: "restricted" }));

  test("its owner can read and write it with no edges on the survey node", async () => {
    await expect(spicedbEvaluator.can(owner, "survey.read", survey)).resolves.toBe(true);
    await expect(spicedbEvaluator.can(owner, "survey.write", survey)).resolves.toBe(true);
    expect(surveyNodeChecks()).toEqual([]);
  });

  test("anyone else needs to administer the organization, and an API key never gets in", async () => {
    await expect(spicedbEvaluator.can(member, "survey.read", survey)).resolves.toBe(false);
    expect(checkPermission).toHaveBeenCalledWith(expect.objectContaining({ permission: "administer" }));
    await expect(spicedbEvaluator.can(apiKey, "survey.read", survey)).resolves.toBe(false);
  });
});

describe("a grant made before the first acknowledgement (restricted, then back to workspace)", () => {
  beforeEach(() => storeRow({ visibilityVersion: 2 }));

  test("stays pending: a member and an API key are refused until the graph holds it", async () => {
    await expect(spicedbEvaluator.can(member, "survey.read", survey)).resolves.toBe(false);
    await expect(spicedbEvaluator.can(apiKey, "survey.read", survey)).resolves.toBe(false);
    await expect(spicedbEvaluator.can(owner, "survey.read", survey)).resolves.toBe(true);
  });
});
