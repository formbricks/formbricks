import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { can } from "@/lib/authorization";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { updateSurveyInput } from "@/lib/survey/__mock__/survey.mock";
import { createSurvey, getSurvey, updateSurvey } from "@/lib/survey/service";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import { PUT } from "./[surveyId]/route";

/**
 * `withV1ApiWrapper` is reduced to its handler: authentication, rate limiting and audit logging are
 * orthogonal to the question-code handling this file proves for the v1 PUT (ENG-6782).
 */
// Survey visibility (ENG-3282) is not enforced here: the readiness marker is off, not read from a database.
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

const workspaceId = "clxworkspace00000000000001";
const apiKey = { apiKeyId: "key_1", workspacePermissions: [], organizationId: "org_1" };

const storedSurvey = { ...updateSurveyInput, workspaceId } as TSurvey;

const put = (body: Record<string, unknown>) =>
  (PUT as unknown as (args: object) => Promise<{ response: Response }>)({
    req: new Request(`http://localhost/api/v1/management/surveys/${storedSurvey.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    props: { params: Promise.resolve({ surveyId: storedSurvey.id }) },
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

const legacyQuestion = (id: string) => ({
  id,
  type: "openText",
  headline: { default: id },
  required: false,
  inputType: "text",
  charLimit: { enabled: false },
});

describe("PUT /api/v1/management/surveys/[surveyId] question codes", () => {
  test("a code-less payload reaches updateSurvey uncoded, so the stored codes can be carried over by id", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const { response } = await put({ questions: [legacyQuestion("a"), legacyQuestion("c")] });

    expect(response.status).toBe(200);
    const sent = vi.mocked(updateSurvey).mock.calls[0][0];
    const codes = sent.blocks.flatMap((block) =>
      block.elements.map((element) => ("code" in element ? element.code : undefined))
    );
    // Not `q1`, `q2` by position: `a` stored `q1` and `c` stored `q3`, and the service decides.
    expect(codes).toEqual([undefined, undefined]);
  });

  test("a code the payload does carry is kept as sent", async () => {
    vi.mocked(can).mockResolvedValue(true);

    const { response } = await put({
      questions: [{ ...legacyQuestion("a"), code: "age" }, legacyQuestion("c")],
    });

    expect(response.status).toBe(200);
    const sent = vi.mocked(updateSurvey).mock.calls[0][0];
    expect(
      sent.blocks.flatMap((block) =>
        block.elements.map((element) => ("code" in element ? element.code : undefined))
      )
    ).toEqual(["age", undefined]);
  });
});
