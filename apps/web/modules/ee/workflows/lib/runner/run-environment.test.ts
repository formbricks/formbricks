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
  allowedRecipientEmails: new Set(),
  secretValues: new Map(),
  rateLimit: { actorUserId: null },
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
});
