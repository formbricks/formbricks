import { describe, expect, test, vi } from "vitest";
import { type WorkflowRunEnvironment, createInitialRunContext } from "./run-environment";

vi.mock("@/lib/response/service", () => ({ getResponse: vi.fn() }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: vi.fn() }));
vi.mock("@/lib/organization/service", () => ({ getOrganizationByWorkspaceId: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceMemberEmails: vi.fn() }));

const environment = (overrides: Partial<WorkflowRunEnvironment> = {}): WorkflowRunEnvironment => ({
  runId: "run",
  workflowId: "wf",
  workspaceId: "ws",
  surveyResponse: null,
  logoUrl: "",
  hideLogo: false,
  allowedRecipientEmails: new Set(),
  secretValues: new Map(),
  rateLimit: { actorUserId: null },
  publicDomain: "https://app.example.com",
  surveyLinkSurveys: new Map(),
  ...overrides,
});

describe("createInitialRunContext", () => {
  test("a Webhook run starts with its payload as the `payload` Variable source", () => {
    expect(createInitialRunContext(environment({ payload: { order: { id: 42 } } }))).toEqual({
      steps: {},
      payload: { order: { id: 42 } },
    });
  });

  test("a run with no payload has no `payload` source", () => {
    expect(createInitialRunContext(environment())).toEqual({ steps: {} });
  });

  test("computed Embedded Data reads under response.<storageKey>, next to the answers", () => {
    const surveyResponse = {
      response: { data: { plan: "gold", q1: "Yes" }, variables: { score_total: 82 } },
    } as unknown as WorkflowRunEnvironment["surveyResponse"];

    expect(createInitialRunContext(environment({ surveyResponse }))).toEqual({
      steps: {},
      response: { data: { plan: "gold", q1: "Yes", score_total: 82 } },
    });
  });

  test("built-in Survey info values read under response.<name>, and the survey's own fields win a clash", () => {
    const surveyResponse = {
      response: {
        data: { q1: "Yes", source: "from the survey" },
        variables: {},
        language: "de",
        meta: { url: "https://acme.example/pricing", source: "link" },
      },
    } as unknown as WorkflowRunEnvironment["surveyResponse"];

    const data = createInitialRunContext(environment({ surveyResponse })).response?.data;

    expect(data).toMatchObject({ q1: "Yes", language: "de", url: "https://acme.example/pricing" });
    expect(data?.source).toBe("from the survey");
  });
});
