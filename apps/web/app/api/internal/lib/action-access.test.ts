import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireActionAccess } from "./action-access";
import { requireResponseActionAccess } from "./response-access";
import { requireSurveyActionAccess } from "./survey-access";
import { requireWorkspaceActionAccess } from "./workspace-access";

const { mockCan } = vi.hoisted(() => ({ mockCan: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: mockCan }));

const USER_ID = "user_1";
const session = { user: { id: USER_ID }, expires: "2099-01-01" } as never;
const actor = { type: "user", id: USER_ID };

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockResolvedValue(true);
});

describe("requireActionAccess", () => {
  const check = (authentication = session) =>
    requireActionAccess({
      authentication,
      action: "survey.write",
      resource: { type: "survey", id: "survey_1" },
      requestId: "req_1",
    });

  test("authorizes a session user who may take the action on the resource", async () => {
    await expect(check()).resolves.toEqual({ userId: USER_ID });
    expect(mockCan).toHaveBeenCalledWith(actor, "survey.write", { type: "survey", id: "survey_1" });
  });

  test("answers the uniform 403 to a user without the action", async () => {
    mockCan.mockResolvedValue(false);
    const response = (await check()) as Response;
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("answers 401 without a session user, asking nothing", async () => {
    expect(((await check(null as never)) as Response).status).toBe(401);
    expect(mockCan).not.toHaveBeenCalled();
  });
});

describe("the per-resource wrappers", () => {
  test("each asks about its own resource type", async () => {
    const context = { authentication: session, requestId: "req_1" };
    await requireResponseActionAccess({ ...context, responseId: "response_1", action: "response.read" });
    await requireSurveyActionAccess({ ...context, surveyId: "survey_1", action: "survey.manage" });
    await requireWorkspaceActionAccess({ ...context, workspaceId: "workspace_1", action: "workspace.write" });

    expect(mockCan.mock.calls).toEqual([
      [actor, "response.read", { type: "response", id: "response_1" }],
      [actor, "survey.manage", { type: "survey", id: "survey_1" }],
      [actor, "workspace.write", { type: "workspace", id: "workspace_1" }],
    ]);
  });
});
