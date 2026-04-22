import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobExecutionContext } from "@formbricks/jobs";

const mocks = vi.hoisted(() => ({
  generateOrganizationAIText: vi.fn(),
  cacheSet: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/service", () => ({ generateOrganizationAIText: mocks.generateOrganizationAIText }));
vi.mock("@/lib/cache", () => ({ cache: { set: mocks.cacheSet } }));
vi.mock("@formbricks/logger", () => ({
  logger: { info: mocks.loggerInfo, error: mocks.loggerError },
}));

const makeData = () => ({
  organizationId: "org_1",
  workspaceId: "ws_1",
  userId: "user_1",
  fields: [
    { path: "q1.headline", defaultText: "Hello", isRichText: false },
    { path: "q1.subheader", defaultText: "World", isRichText: true },
  ],
  sourceLanguage: "English",
  targetLanguage: "German",
});

const makeContext = (overrides?: Partial<JobExecutionContext>): JobExecutionContext => ({
  attempt: 1,
  jobId: "42",
  jobName: "ai-translation.translate",
  maxAttempts: 3,
  queueName: "background-jobs",
  ...overrides,
});

describe("processAITranslationJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheSet.mockResolvedValue({ ok: true });
  });

  test("parses AI response, filters to valid keys, and caches result", async () => {
    mocks.generateOrganizationAIText.mockResolvedValue({
      text: '{"q1.headline":"Hallo","q1.subheader":"Welt","extra":"ignored"}',
    });

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await processAITranslationJob(makeData(), makeContext());

    expect(mocks.cacheSet).toHaveBeenCalledWith(
      "ai-translation-result:42",
      { userId: "user_1", translations: { "q1.headline": "Hallo", "q1.subheader": "Welt" } },
      300_000
    );
    expect(mocks.loggerInfo).toHaveBeenCalled();
  });

  test("extracts JSON from markdown code fences", async () => {
    mocks.generateOrganizationAIText.mockResolvedValue({
      text: '```json\n{"q1.headline":"Hallo"}\n```',
    });

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await processAITranslationJob(makeData(), makeContext());

    expect(mocks.cacheSet).toHaveBeenCalledWith(
      "ai-translation-result:42",
      expect.objectContaining({ translations: expect.objectContaining({ "q1.headline": "Hallo" }) }),
      300_000
    );
  });

  test("throws when AI response contains no JSON object", async () => {
    mocks.generateOrganizationAIText.mockResolvedValue({ text: "no json here" });

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await expect(processAITranslationJob(makeData(), makeContext())).rejects.toThrow(
      "Failed to parse AI translation response"
    );
  });

  test("throws when cache.set fails on success path", async () => {
    mocks.generateOrganizationAIText.mockResolvedValue({ text: '{"q1.headline":"Hallo"}' });
    mocks.cacheSet.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await expect(processAITranslationJob(makeData(), makeContext())).rejects.toThrow(
      "Failed to store AI translation result in cache"
    );
  });

  test("stores failure marker on last attempt", async () => {
    const aiError = new Error("ai_features_not_enabled");
    mocks.generateOrganizationAIText.mockRejectedValue(aiError);

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await expect(
      processAITranslationJob(makeData(), makeContext({ attempt: 3, maxAttempts: 3 }))
    ).rejects.toThrow(aiError);

    expect(mocks.cacheSet).toHaveBeenCalledWith(
      "ai-translation-result:42",
      { userId: "user_1", error: "ai_features_not_enabled" },
      300_000
    );
  });

  test("does not store failure marker on non-last attempt", async () => {
    mocks.generateOrganizationAIText.mockRejectedValue(new Error("transient"));

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await expect(
      processAITranslationJob(makeData(), makeContext({ attempt: 1, maxAttempts: 3 }))
    ).rejects.toThrow("transient");

    expect(mocks.cacheSet).not.toHaveBeenCalled();
  });

  test("logs error when failure marker cache.set fails", async () => {
    mocks.generateOrganizationAIText.mockRejectedValue(new Error("boom"));
    mocks.cacheSet.mockResolvedValue({ ok: false, error: { code: "RedisConnectionError" } });

    const { processAITranslationJob } = await import("./process-ai-translation-job");
    await expect(
      processAITranslationJob(makeData(), makeContext({ attempt: 3, maxAttempts: 3 }))
    ).rejects.toThrow("boom");

    expect(mocks.loggerError).toHaveBeenCalledWith(
      { jobId: "42" },
      "Failed to store AI translation failure marker in cache"
    );
  });
});

describe("getAITranslationCacheKey", () => {
  test("returns prefixed key", async () => {
    const { getAITranslationCacheKey } = await import("./process-ai-translation-job");
    expect(getAITranslationCacheKey("99")).toBe("ai-translation-result:99");
  });
});
