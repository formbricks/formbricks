import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { can } from "@/lib/authorization";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurveyInput } from "@/lib/survey/__mock__/survey.mock";
import { createSurvey } from "@/lib/survey/service";
import { SurveyWriteAfterCommitError } from "@/lib/survey/write-transaction";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { POST } from "./route";

// The harness of `custom-head-scripts.test.ts`: the wrapper reduced to its handler, the survey service
// and the organization's lookups stubbed.
vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn(async () => false) }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));

vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({
  createSurvey: vi.fn(),
  getSurvey: vi.fn(),
  updateSurvey: vi.fn(),
}));
vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({ resolveBodyIds: vi.fn() }));
// The real `checkSurveyWritePermissions` runs; only the organization's entitlement lookups are stubbed.
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsSpamProtectionEnabled: vi.fn() }));
vi.mock("@/modules/survey/follow-ups/lib/utils", () => ({ getSurveyFollowUpsPermission: vi.fn() }));
vi.mock("@/modules/survey/lib/permission", () => ({ getExternalUrlsPermission: vi.fn() }));
vi.mock("@/app/api/v1/management/surveys/lib/surveys", () => ({ getSurveys: vi.fn() }));
vi.mock("@/app/api/v1/management/surveys/[surveyId]/lib/surveys", () => ({ deleteSurvey: vi.fn() }));
vi.mock("@/app/lib/api/legacy-environment-id", () => ({
  addLegacyEnvironmentId: vi.fn(async (value) => value),
  addLegacyEnvironmentIdBestEffort: vi.fn(async (value) => value),
  addLegacyEnvironmentIdToList: vi.fn(async (value) => value),
}));
vi.mock("@/modules/storage/utils", () => ({ resolveStorageUrlsInObject: vi.fn((value) => value) }));
// Survey visibility (ENG-3282) is orthogonal here: an API key creates a workspace-visible, ownerless survey.
vi.mock("@/lib/survey/visibility/limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/survey/visibility/limit")>()),
  assertWorkspaceSurveyLimit: vi.fn(),
}));
vi.mock("@/lib/survey/visibility/creation", () => ({
  resolveSurveyCreationFacts: vi.fn(async () => ({ ownerId: null, visibility: "workspace" })),
}));

vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const workspaceId = "clxworkspace00000000000001";
const apiKey = { apiKeyId: "key_1", workspacePermissions: [], organizationId: "org_1" };

const post = (body: Record<string, unknown>) =>
  (POST as unknown as (args: object) => Promise<{ response: Response }>)({
    req: new Request("http://localhost/api/v1/management/surveys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    authentication: apiKey,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(can).mockResolvedValue(true);
  vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
  vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({ id: "org_1" } as never);
  vi.mocked(resolveBodyIds).mockImplementation(async (body) => ({
    ok: true,
    body: { ...body, workspaceId },
    alreadyAuthorized: false,
  }));
});

describe("POST /api/v1/management/surveys after the survey committed", () => {
  test("answers a create whose work after the commit failed as created, and logs the failure", async () => {
    const created = {
      ...createSurveyInput,
      id: "clsurvey0000000000000001",
      workspaceId,
    } as unknown as TSurvey;
    vi.mocked(createSurvey).mockRejectedValue(
      new SurveyWriteAfterCommitError(created, new Error("response alert subscription failed"))
    );

    const { response } = await post({ ...createSurveyInput });

    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { id: string } }).data.id).toBe(created.id);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ errName: "Error", surveyId: created.id }),
      expect.any(String)
    );
  });

  test("still answers any other create failure as an error", async () => {
    vi.mocked(createSurvey).mockRejectedValue(new Error("connection reset"));

    const { response } = await post({ ...createSurveyInput });

    expect(response.status).toBe(500);
  });
});
