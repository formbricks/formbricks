import { beforeEach, describe, expect, test, vi } from "vitest";
import { getWorkflowEmailAuthoringContext } from "./email-authoring-context";

const {
  mockGetSession,
  mockGetWorkflowById,
  mockGetWorkspaceWithTeamIds,
  mockGetTeamMemberDetails,
  mockGetUserEmail,
  mockGetUserLocale,
  mockGetSurvey,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetWorkflowById: vi.fn(),
  mockGetWorkspaceWithTeamIds: vi.fn(),
  mockGetTeamMemberDetails: vi.fn(),
  mockGetUserEmail: vi.fn(),
  mockGetUserLocale: vi.fn(),
  mockGetSurvey: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@formbricks/workflows/server", () => ({
  createWorkflowsService: () => ({ getWorkflowById: mockGetWorkflowById }),
}));
// Keep ZWorkflowDefinition real so trigger surveyId parsing is exercised end-to-end.
vi.mock("@/lib/constants", () => ({ MAIL_FROM: undefined, DEFAULT_LOCALE: "en-US" }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mockGetSession }));
vi.mock("@/modules/survey/editor/lib/team", () => ({ getTeamMemberDetails: mockGetTeamMemberDetails }));
vi.mock("@/modules/survey/editor/lib/user", () => ({
  getUserEmail: mockGetUserEmail,
  getUserLocale: mockGetUserLocale,
}));
vi.mock("@/modules/survey/lib/survey", () => ({ getSurvey: mockGetSurvey }));
vi.mock("@/modules/survey/lib/workspace", () => ({ getWorkspaceWithTeamIds: mockGetWorkspaceWithTeamIds }));

const WORKSPACE_ID = "cm9zr4wsp000508l8y6nh9r2v";
const SURVEY_ID = "cm9zr4mps000008l8btfy1vtz";

const definitionForSurvey = (surveyId: string) => ({
  schemaVersion: 1,
  entryNodeId: "trigger",
  trigger: {
    id: "trigger",
    type: "trigger",
    triggerType: "response.completed",
    config: { surveyId, endingCardIds: [] },
  },
  nodes: [],
  edges: [],
});

describe("getWorkflowEmailAuthoringContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user1" } });
    mockGetWorkflowById.mockResolvedValue({
      id: "wf1",
      workspaceId: WORKSPACE_ID,
      definition: definitionForSurvey(SURVEY_ID),
    });
    mockGetWorkspaceWithTeamIds.mockResolvedValue({ organizationId: "org1", teamIds: ["team1"] });
    mockGetTeamMemberDetails.mockResolvedValue([{ name: "Alice", email: "alice@example.com" }]);
    mockGetUserEmail.mockResolvedValue("me@example.com");
    mockGetUserLocale.mockResolvedValue("de-DE");
    mockGetSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: WORKSPACE_ID, blocks: [] });
  });

  test("returns the bound survey + team/user/sender context for a same-workspace survey", async () => {
    const ctx = await getWorkflowEmailAuthoringContext({ workflowId: "wf1", workspaceId: WORKSPACE_ID });

    expect(ctx.survey).toMatchObject({ id: SURVEY_ID, workspaceId: WORKSPACE_ID });
    expect(ctx.teamMemberDetails).toEqual([{ name: "Alice", email: "alice@example.com" }]);
    expect(ctx.userEmail).toBe("me@example.com");
    expect(ctx.locale).toBe("de-DE");
  });

  test("drops a survey that belongs to another workspace (IDOR guard)", async () => {
    mockGetSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: "other-workspace", blocks: [] });

    const ctx = await getWorkflowEmailAuthoringContext({ workflowId: "wf1", workspaceId: WORKSPACE_ID });

    expect(ctx.survey).toBeNull();
    // The rest of the context still loads so the form can render (degraded to plain inputs).
    expect(ctx.userEmail).toBe("me@example.com");
  });

  test("returns a null survey when the workflow has no survey bound", async () => {
    mockGetWorkflowById.mockResolvedValue({
      id: "wf1",
      workspaceId: WORKSPACE_ID,
      definition: definitionForSurvey(""),
    });

    const ctx = await getWorkflowEmailAuthoringContext({ workflowId: "wf1", workspaceId: WORKSPACE_ID });

    expect(ctx.survey).toBeNull();
    expect(mockGetSurvey).not.toHaveBeenCalled();
  });

  test("drops context for a workflow that belongs to another workspace", async () => {
    mockGetWorkflowById.mockResolvedValue({
      id: "wf1",
      workspaceId: "other-workspace",
      definition: definitionForSurvey(SURVEY_ID),
    });

    const ctx = await getWorkflowEmailAuthoringContext({ workflowId: "wf1", workspaceId: WORKSPACE_ID });

    expect(ctx.survey).toBeNull();
    expect(ctx.teamMemberDetails).toEqual([]);
    expect(mockGetSurvey).not.toHaveBeenCalled();
  });

  test("falls back to the app default sender when MAIL_FROM is unset", async () => {
    const ctx = await getWorkflowEmailAuthoringContext({ workflowId: "wf1", workspaceId: WORKSPACE_ID });
    expect(ctx.mailFrom).toBe("noreply@formbricks.com");
  });

  test("returns an empty context when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const ctx = await getWorkflowEmailAuthoringContext({ workflowId: "wf1", workspaceId: WORKSPACE_ID });

    expect(ctx.survey).toBeNull();
    expect(ctx.userEmail).toBe("");
    expect(mockGetWorkflowById).not.toHaveBeenCalled();
  });
});
