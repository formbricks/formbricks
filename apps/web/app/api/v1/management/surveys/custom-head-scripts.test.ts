import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { can } from "@/lib/authorization";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { createSurveyInput, updateSurveyInput } from "@/lib/survey/__mock__/survey.mock";
import { createSurvey, getSurvey, updateSurvey } from "@/lib/survey/service";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { PUT } from "./[surveyId]/route";
import { POST } from "./route";

/**
 * `withV1ApiWrapper` is reduced to its handler: authentication, rate limiting and audit logging are
 * orthogonal to the survey head-scripts boundary this file proves for API keys.
 */
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

const workspaceId = "clxworkspace00000000000001";
const apiKey = { apiKeyId: "key_1", workspacePermissions: [], organizationId: "org_1" };
const script = "<script>analytics()</script>";

const storedSurvey = { ...updateSurveyInput, workspaceId } as TSurvey;

// A key with `write` on the workspace: `workspace.write` passes, `workspace.manage` does not.
const actAsWriteKey = () =>
  vi.mocked(can).mockImplementation(async (_actor, action) => action !== "workspace.manage");

const put = (body: Record<string, unknown>) =>
  (PUT as unknown as (args: object) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/management/surveys/${storedSurvey.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    props: { params: Promise.resolve({ surveyId: storedSurvey.id }) },
    authentication: apiKey,
  });

const post = (body: Record<string, unknown>) =>
  (POST as unknown as (args: object) => Promise<{ response: Response }>)({
    req: new Request("http://localhost/api/v1/management/surveys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    authentication: apiKey,
  });

beforeEach(() => {
  vi.mocked(can).mockReset();
  vi.mocked(getExternalUrlsPermission).mockResolvedValue(true);
  vi.mocked(getSurvey).mockResolvedValue(storedSurvey);
  vi.mocked(updateSurvey).mockReset();
  vi.mocked(updateSurvey).mockImplementation(async (survey) => survey);
  vi.mocked(createSurvey).mockReset();
  vi.mocked(createSurvey).mockImplementation(
    async (_workspaceId, survey) => ({ ...storedSurvey, ...survey }) as TSurvey
  );
  vi.mocked(getOrganizationByWorkspaceId).mockResolvedValue({ id: "org_1" } as never);
  vi.mocked(resolveBodyIds).mockImplementation(async (body) => ({
    ok: true,
    body: { ...body, workspaceId },
    alreadyAuthorized: false,
  }));
});

describe("PUT /api/v1/management/surveys/[surveyId] custom head scripts", () => {
  test("refuses a write-only API key that sets survey head scripts", async () => {
    actAsWriteKey();

    const { response } = await put({ customHeadScripts: script });

    expect(response.status).toBe(403);
    expect(updateSurvey).not.toHaveBeenCalled();
  });

  test("lets a write-only API key update other fields of a survey that has scripts", async () => {
    vi.mocked(getSurvey).mockResolvedValue({ ...storedSurvey, customHeadScripts: script });
    actAsWriteKey();

    const { response } = await put({ name: "Renamed" });

    expect(response.status).toBe(200);
    expect(updateSurvey).toHaveBeenCalledWith(expect.objectContaining({ customHeadScripts: script }));
  });

  test("lets a manage API key set survey head scripts", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const { response } = await put({ customHeadScripts: script });

    expect(response.status).toBe(200);
    expect(updateSurvey).toHaveBeenCalledWith(expect.objectContaining({ customHeadScripts: script }));
  });
});

describe("POST /api/v1/management/surveys custom head scripts", () => {
  test("refuses a write-only API key that creates a survey with head scripts", async () => {
    actAsWriteKey();

    const { response } = await post({ ...createSurveyInput, customHeadScripts: script });

    expect(response.status).toBe(403);
    expect(createSurvey).not.toHaveBeenCalled();
  });

  test("lets a write-only API key create a survey without head scripts", async () => {
    actAsWriteKey();

    const { response } = await post({ ...createSurveyInput });

    expect(response.status).toBe(200);
    expect(createSurvey).toHaveBeenCalled();
  });
});
