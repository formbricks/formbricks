import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurveyWithMetadata } from "./data";
import { getServableLinkSurvey } from "./servable-survey";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("./data", () => ({ getSurveyWithMetadata: vi.fn() }));

const surveyId = "clsurvey00000000000000000";

const loaded = (overrides: Record<string, unknown> = {}) => {
  const survey = {
    id: surveyId,
    workspaceId: "workspace-1",
    type: "link",
    status: "inProgress",
    archivedAt: null,
    singleUse: { enabled: true, isEncrypted: true },
    ...overrides,
  };
  vi.mocked(getSurveyWithMetadata).mockResolvedValue(survey as never);
  return survey;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServableLinkSurvey", () => {
  // Each of these is a single-use survey, the case whose "link invalid" screen used to render before the
  // page's gate and confirm the survey existed.
  test.each([
    ["a draft", { status: "draft" }],
    ["an archived", { status: "paused", archivedAt: new Date("2026-10-01T00:00:00Z") }],
    ["an app", { type: "app" }],
  ])("withholds %s survey from the page", async (_label, state) => {
    loaded(state);

    expect(await getServableLinkSurvey(surveyId)).toBeNull();
  });

  test.each([
    ["in progress", { status: "inProgress" }],
    ["paused, shown as its inactive screen", { status: "paused" }],
    ["completed, shown as its inactive screen", { status: "completed" }],
  ])("returns a public survey that is %s", async (_label, state) => {
    const survey = loaded(state);

    expect(await getServableLinkSurvey(surveyId)).toEqual(survey);
  });

  test.each([
    ["missing", new ResourceNotFoundError("Survey", surveyId)],
    ["failing to load", new DatabaseError("connection lost")],
  ])("treats a survey %s as absent and logs it", async (_label, error) => {
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(error);

    expect(await getServableLinkSurvey(surveyId)).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(error, expect.any(String));
  });
});
