import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { SINGLE_USE_ID_MAX_LENGTH } from "@/lib/utils/single-use-surveys";
import { POST } from "./route";
import { SINGLE_USE_LINKS_MAX_COUNT } from "./schemas";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  generateSurveySingleUseLinkParams: vi.fn(),
  generateSurveySingleUseLinkParamsList: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/helper", () => ({ getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId }));
vi.mock("@/lib/utils/single-use-surveys", () => ({
  SINGLE_USE_ID_MAX_LENGTH: 255,
  generateSurveySingleUseLinkParams: mocks.generateSurveySingleUseLinkParams,
  generateSurveySingleUseLinkParamsList: mocks.generateSurveySingleUseLinkParamsList,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const actor = { type: "user", id: USER_ID };
const link = (suId: string) => ({ suId, suToken: `token-${suId}` });

const generate = (body: unknown) =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/single-use-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.generateSurveySingleUseLinkParamsList.mockImplementation((count: number) =>
    Array.from({ length: count }, (_, index) => link(`su${index}`))
  );
  mocks.generateSurveySingleUseLinkParams.mockImplementation((_surveyId: string, _enc: boolean, id: string) =>
    link(id)
  );
});

describe("POST /api/internal/surveys/{surveyId}/single-use-links", () => {
  test("mints links for a writer of the survey and its workspace, checked in that order", async () => {
    const response = await generate({ isEncrypted: false, count: 2 });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([link("su0"), link("su1")]);
    expect(checkedActions()).toEqual([
      ["workspace.write", { type: "workspace", id: WORKSPACE_ID }],
      ["survey.write", { type: "survey", id: SURVEY_ID }],
    ]);
    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.write", { type: "survey", id: SURVEY_ID });
    expect(mocks.generateSurveySingleUseLinkParamsList).toHaveBeenCalledWith(2, SURVEY_ID, false);
  });

  test("mints one link when no count is sent", async () => {
    await generate({ isEncrypted: true });
    expect(mocks.generateSurveySingleUseLinkParamsList).toHaveBeenCalledWith(1, SURVEY_ID, true);
  });

  test("signs a custom id, trimmed, unencrypted", async () => {
    const response = await generate({ isEncrypted: false, count: 1, singleUseId: "  customer-42 " });

    expect((await response.json()).data).toEqual([link("customer-42")]);
    expect(mocks.generateSurveySingleUseLinkParams).toHaveBeenCalledWith(SURVEY_ID, false, "customer-42");
    expect(mocks.generateSurveySingleUseLinkParamsList).not.toHaveBeenCalled();
  });

  // ENG-3282: the minted links write responses into this survey.
  test("mints no links for a survey the caller cannot write", async () => {
    mocks.can.mockImplementation(async (_actor, action: string) => action !== "survey.write");

    const response = await generate({ isEncrypted: false, count: 2 });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.generateSurveySingleUseLinkParamsList).not.toHaveBeenCalled();
  });

  test("mints no links for a caller who can't write the workspace, before asking about the survey", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await generate({ isEncrypted: false })).status).toBe(403);
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
  });

  test("answers the uniform 403 for a survey that doesn't exist", async () => {
    mocks.getWorkspaceIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));

    const response = await generate({ isEncrypted: false });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("answers 400 with the rule for a custom id with encryption or a count", async () => {
    const response = await generate({ isEncrypted: true, count: 1, singleUseId: "customer-42" });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      expect.objectContaining({
        reason: "Custom single-use IDs can only be generated one at a time without encryption",
      }),
    ]);
    expect((await generate({ isEncrypted: false, count: 2, singleUseId: "customer-42" })).status).toBe(400);
  });

  test.each([
    ["no links", { isEncrypted: false, count: 0 }],
    ["more links than the cap", { isEncrypted: false, count: SINGLE_USE_LINKS_MAX_COUNT + 1 }],
    [
      "a custom id past the cap",
      { isEncrypted: false, singleUseId: "a".repeat(SINGLE_USE_ID_MAX_LENGTH + 1) },
    ],
    ["a blank custom id", { isEncrypted: false, singleUseId: "   " }],
    ["no encryption flag", { count: 1 }],
    ["an unknown key", { isEncrypted: false, surveyId: SURVEY_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await generate(body)).status).toBe(400);
    expect(mocks.generateSurveySingleUseLinkParamsList).not.toHaveBeenCalled();
    expect(mocks.generateSurveySingleUseLinkParams).not.toHaveBeenCalled();
  });

  test("mints the cap", async () => {
    expect((await generate({ isEncrypted: false, count: SINGLE_USE_LINKS_MAX_COUNT })).status).toBe(200);
  });
});
