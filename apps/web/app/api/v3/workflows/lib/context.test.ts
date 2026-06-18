import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext } from "./context";

const { surveyFindUnique } = vi.hoisted(() => ({ surveyFindUnique: vi.fn() }));
vi.mock("@formbricks/database", () => ({
  prisma: { workflow: {}, survey: { findUnique: surveyFindUnique } },
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ warn: vi.fn(), error: vi.fn() })) },
}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));

const sessionAuth = {
  user: { id: "cm9zr52kh000508l8e3q7bw9j" },
  expires: "2026-12-01",
} as unknown as TV3Authentication;
const apiKeyAuth = {
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: "org_1",
  organizationAccess: { accessControl: { read: true, write: true } },
  workspacePermissions: [],
} as unknown as TAuthenticationApiKey;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildWorkflowApiContext", () => {
  test("derives userId from a session", () => {
    const ctx = buildWorkflowApiContext(sessionAuth, "req_1", "https://app.formbricks.com");
    expect(ctx.userId).toBe("cm9zr52kh000508l8e3q7bw9j");
  });

  test("leaves userId null for API-key authentication", () => {
    expect(buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").userId).toBeNull();
  });

  test("leaves userId null for unauthenticated requests", () => {
    expect(buildWorkflowApiContext(null, "req_1", "inst").userId).toBeNull();
  });

  test("authorize delegates to requireV3WorkspaceAccess and returns its result", async () => {
    const resolved = { workspaceId: "ws_1", organizationId: "org_1" };
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(resolved);

    const ctx = buildWorkflowApiContext(apiKeyAuth, "req_1", "https://app.formbricks.com");
    const result = await ctx.authorize("ws_1", "readWrite");

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      apiKeyAuth,
      "ws_1",
      "readWrite",
      "req_1",
      "https://app.formbricks.com"
    );
    expect(result).toEqual(resolved);
  });
});

describe("verifyTriggerSurvey (validates a workflow trigger's referenced survey)", () => {
  const verify = (input: { workspaceId: string; surveyId: string; endingCardIds: string[] }) =>
    buildWorkflowApiContext(apiKeyAuth, "req_1", "inst").verifyTriggerSurvey(input);

  test("rejects a workflow trigger whose survey no longer exists in the workspace", async () => {
    surveyFindUnique.mockResolvedValue(null);

    const result = await verify({ workspaceId: "ws_1", surveyId: "s_1", endingCardIds: ["e_1"] });

    expect(result).toEqual({ surveyExists: false, missingEndingCardIds: [] });
    expect(surveyFindUnique).toHaveBeenCalledWith({
      where: { id_workspaceId: { id: "s_1", workspaceId: "ws_1" } },
      select: { endings: true },
    });
  });

  test("flags the trigger's ending-card ids that are missing from the survey", async () => {
    surveyFindUnique.mockResolvedValue({ endings: [{ id: "e_1" }, { id: "e_2" }] });

    const result = await verify({
      workspaceId: "ws_1",
      surveyId: "s_1",
      endingCardIds: ["e_1", "e_missing"],
    });

    expect(result).toEqual({ surveyExists: true, missingEndingCardIds: ["e_missing"] });
  });

  test("accepts a workflow trigger whose survey and ending cards all exist", async () => {
    surveyFindUnique.mockResolvedValue({ endings: [{ id: "e_1" }] });

    const result = await verify({ workspaceId: "ws_1", surveyId: "s_1", endingCardIds: ["e_1"] });

    expect(result).toEqual({ surveyExists: true, missingEndingCardIds: [] });
  });
});
