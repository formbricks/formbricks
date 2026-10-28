import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { capturePostHogEvent } from "@/lib/posthog";
import { generateV3Survey } from "./operations";
import { V3SurveyGeneratePromptError, generateV3SurveyCreatePayloadFromPrompt } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: vi.fn() }));
vi.mock("../lib/operations", () => ({
  getSessionUserId: (authentication: { user?: { id: string } }) => authentication?.user?.id ?? null,
}));
vi.mock("./service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./service")>()),
  generateV3SurveyCreatePayloadFromPrompt: vi.fn(),
}));

const workspaceId = "tz4a98xxat96iws9zmbrgj3a";
const body = { workspaceId, prompt: "Find out why new users stop during onboarding", type: "link" as const };
const user = { user: { id: "user_1", email: "a@b.c", name: "A" }, expires: "2026-07-01T00:00:00.000Z" };
const params = { body, requestId: "req_1", instance: "/api/v3/surveys/generate" };

describe("generateV3Survey", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue({
      organizationId: "org_1",
      workspaceId,
    } as Awaited<ReturnType<typeof requireV3WorkspaceAccess>>);
  });

  test("answers the access refusal without calling the AI", async () => {
    vi.mocked(requireV3WorkspaceAccess).mockResolvedValue(problemForbidden("req_1", "no", "/x"));

    const response = await generateV3Survey({ ...params, authentication: user });

    expect(response.status).toBe(403);
    expect(generateV3SurveyCreatePayloadFromPrompt).not.toHaveBeenCalled();
  });

  test("needs read-write access and answers the generated draft, recording the event for a signed-in user", async () => {
    const generated = { language: "en-US", payload: {}, validation: { valid: true } };
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockResolvedValue(
      generated as Awaited<ReturnType<typeof generateV3SurveyCreatePayloadFromPrompt>>
    );

    const response = await generateV3Survey({ ...params, authentication: user });

    expect(requireV3WorkspaceAccess).toHaveBeenCalledWith(
      user,
      workspaceId,
      "readWrite",
      "req_1",
      params.instance
    );
    expect(generateV3SurveyCreatePayloadFromPrompt).toHaveBeenCalledWith({
      organizationId: "org_1",
      workspaceId,
      userId: "user_1",
      input: body,
    });
    expect(await response.json()).toEqual({ data: generated });
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      "user_1",
      "ai_survey_generated",
      { prompt_length: body.prompt.length },
      { organizationId: "org_1", workspaceId }
    );
  });

  test("records no event for an API key, which has no user", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockResolvedValue(
      {} as Awaited<ReturnType<typeof generateV3SurveyCreatePayloadFromPrompt>>
    );

    const response = await generateV3Survey({
      ...params,
      authentication: { type: "apiKey", apiKeyId: "key_1" } as never,
    });

    expect(response.status).toBe(200);
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("maps a thin prompt to a 400 problem", async () => {
    vi.mocked(generateV3SurveyCreatePayloadFromPrompt).mockRejectedValue(
      new V3SurveyGeneratePromptError([{ name: "prompt", reason: "Add detail" }])
    );

    const response = await generateV3Survey({ ...params, authentication: user });

    expect(response.status).toBe(400);
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });
});
