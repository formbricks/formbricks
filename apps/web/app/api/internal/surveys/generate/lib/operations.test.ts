import { beforeEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import type { TV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import { streamV3SurveyGeneration } from "./operations";

const mocks = vi.hoisted(() => ({
  requireV3WorkspaceAccess: vi.fn(),
  getSessionUserId: vi.fn(),
  assertOrganizationAIConfigured: vi.fn(),
  streamOrganizationAIObject: vi.fn(),
  assertV3SurveyGeneratePrompt: vi.fn(),
  buildV3SurveyCreatePayloadFromDraft: vi.fn(),
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/app/api/v3/lib/auth", () => ({ requireV3WorkspaceAccess: mocks.requireV3WorkspaceAccess }));
vi.mock("@/app/api/v3/surveys/lib/operations", () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock("@/lib/ai/service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertOrganizationAIConfigured: mocks.assertOrganizationAIConfigured,
  streamOrganizationAIObject: mocks.streamOrganizationAIObject,
}));
vi.mock("@/app/api/v3/surveys/generate/service", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  assertV3SurveyGeneratePrompt: mocks.assertV3SurveyGeneratePrompt,
  buildV3SurveyGenerationRequest: () => ({ prompt: "built" }),
  buildV3SurveyGenerationTracing: () => undefined,
  buildV3SurveyCreatePayloadFromDraft: mocks.buildV3SurveyCreatePayloadFromDraft,
}));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));

const body: TV3SurveyGenerateBody = {
  workspaceId: "workspace1",
  prompt: "Understand why new users stop during onboarding",
  type: "link",
};

const call = (signal?: AbortSignal) =>
  streamV3SurveyGeneration({
    req: new Request("http://localhost/api/internal/surveys/generate/stream", { method: "POST", signal }),
    authentication: { type: "session", session: { user: { id: "user1" } } } as never,
    body,
    requestId: "req_1",
    instance: "/api/internal/surveys/generate/stream",
  });

/** Drain an NDJSON response body into parsed events. */
const readEvents = async (response: Response) => {
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
};

const asyncIterable = <T>(items: T[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const item of items) yield item;
  },
});

describe("streamV3SurveyGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireV3WorkspaceAccess.mockResolvedValue({
      organizationId: "org1",
      workspaceId: "workspace1",
    });
    mocks.getSessionUserId.mockReturnValue("user1");
    mocks.assertOrganizationAIConfigured.mockResolvedValue({ isInstanceConfigured: true });
    mocks.buildV3SurveyCreatePayloadFromDraft.mockReturnValue({
      language: "en-US",
      payload: { name: "Onboarding" },
      validation: { valid: true, invalid_params: [], languages: [] },
    });
  });

  test("answers with problem+json and never opens a stream when AI is not entitled", async () => {
    // The invariant the whole design turns on: once a 200 with a body has begun there is no way back
    // to an RFC 9457 response, so every guard has to run before the first byte.
    mocks.assertOrganizationAIConfigured.mockRejectedValueOnce(
      new OperationNotAllowedError("ai_smart_tools_disabled")
    );

    const response = await call();

    // The exact code is error-mapping.test.ts's business; what matters here is that it is a problem
    // response at all, which is only possible because no body had been opened.
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");
    expect(mocks.streamOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("answers with problem+json when the prompt is rejected", async () => {
    mocks.assertV3SurveyGeneratePrompt.mockImplementationOnce(() => {
      throw new OperationNotAllowedError("ai_smart_tools_disabled");
    });

    const response = await call();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.streamOrganizationAIObject).not.toHaveBeenCalled();
  });

  test("streams start, partials and done as NDJSON", async () => {
    mocks.streamOrganizationAIObject.mockResolvedValue({
      partialObjectStream: asyncIterable([{ name: "Onboarding" }]),
      completion: Promise.resolve({ name: "Onboarding", blocks: [] }),
    });

    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson; charset=utf-8");
    // Set for self-hosters behind nginx, where proxy_buffering would hold the whole response.
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    const events = await readEvents(response);
    // Two partials: the streamed chunk, then the completed draft as the final snapshot.
    expect(events.map((event) => event.type)).toEqual(["start", "partial", "partial", "done"]);
    expect(events.at(-1)).toMatchObject({ language: "en-US", payload: { name: "Onboarding" } });
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      "user1",
      "ai_survey_generated",
      expect.objectContaining({ streamed: true }),
      expect.anything()
    );
  });

  test("the final partial carries the completed draft, not the last streamed chunk", async () => {
    // The partial stream yields DeepPartials: the last one can be missing fields the finished object
    // has. The review step renders this draft while saving uses the payload, so a stale final
    // snapshot means the two disagree about what the survey contains.
    mocks.streamOrganizationAIObject.mockResolvedValue({
      partialObjectStream: asyncIterable([{ name: "Onboarding", blocks: [{ name: "Block" }] }]),
      completion: Promise.resolve({
        name: "Onboarding",
        blocks: [{ name: "Block", questions: [{ type: "openText", headline: "How was it?" }] }],
      }),
    });

    const events = await readEvents(await call());
    const partials = events.filter((event) => event.type === "partial");

    expect(partials.at(-1).draft).toEqual({
      name: "Onboarding",
      blocks: [{ name: "Block", questions: [{ type: "openText", headline: "How was it?" }] }],
    });
  });

  test("a generation that streams no partials still sends the draft to render", async () => {
    // A provider that returns its object in one final chunk yields nothing from the partial stream.
    mocks.streamOrganizationAIObject.mockResolvedValue({
      partialObjectStream: asyncIterable([]),
      completion: Promise.resolve({
        name: "Onboarding",
        blocks: [{ name: "Block", questions: [{ type: "openText", headline: "How was it?" }] }],
      }),
    });

    const events = await readEvents(await call());

    expect(events.map((event) => event.type)).toEqual(["start", "partial", "done"]);
  });

  test("a request that was already aborted starts the generation cancelled", async () => {
    // An abort that has already fired is never replayed to a listener registered afterwards, so a
    // client that disconnected during the entitlement checks would be billed for a full generation.
    mocks.streamOrganizationAIObject.mockResolvedValue({
      partialObjectStream: asyncIterable([]),
      completion: Promise.resolve({ name: "Onboarding", blocks: [] }),
    });

    const controller = new AbortController();
    controller.abort();

    await call(controller.signal);

    const passedSignal = mocks.streamOrganizationAIObject.mock.calls.at(-1)?.[0]?.abortSignal;
    expect(passedSignal?.aborted).toBe(true);
  });

  test("reports a mid-generation failure in band and still closes cleanly", async () => {
    // controller.error() would truncate the body and the client would see a bare network failure
    // with none of the code this event exists to carry.
    mocks.streamOrganizationAIObject.mockResolvedValue({
      partialObjectStream: asyncIterable([{ name: "Onboarding" }]),
      completion: Promise.reject(new Error("provider exploded")),
    });

    const response = await call();
    const events = await readEvents(response);

    expect(response.status).toBe(200);
    expect(events.at(-1)).toMatchObject({ type: "error", code: "ai_generation_failed" });
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });
});
