import { beforeEach, describe, expect, test, vi } from "vitest";
import { AI_DATA_PROFILE_LIMITS } from "./ai-data-profile";
import { getAIDataProfile } from "./ai-data-profile.server";

const mocks = vi.hoisted(() => ({
  executeTenantScopedQuery: vi.fn(),
  withCache: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/cache", () => ({
  createCacheKey: {
    custom: (namespace: string, ...parts: string[]) => `${namespace}:${parts.join(":")}`,
  },
}));

// Pass-through: the caching contract is exercised by the cache package's own suite, and running the
// factory here keeps these tests about what the profile queries and what it does on failure.
vi.mock("@/lib/cache", () => ({ cache: { withCache: mocks.withCache } }));

vi.mock("@formbricks/logger", () => ({ logger: { warn: mocks.warn } }));

vi.mock("@/modules/ee/analysis/api/lib/cube-client", () => ({
  executeTenantScopedQuery: mocks.executeTenantScopedQuery,
}));

const input = {
  feedbackDirectoryId: "directory-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  userId: "user-1",
};

describe("getAIDataProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withCache.mockImplementation((factory: () => Promise<unknown>) => factory());
  });

  test("profiles the directory from the four cube queries", async () => {
    mocks.executeTenantScopedQuery
      .mockResolvedValueOnce([
        { "FeedbackRecords.sourceName": "Web widget prod", "FeedbackRecords.sourceType": "app" },
      ])
      .mockResolvedValueOnce([
        { "FeedbackRecords.fieldLabel": "How happy are you?", "FeedbackRecords.fieldType": "rating" },
      ])
      .mockResolvedValueOnce([{ "FeedbackRecords.language": "en" }])
      .mockResolvedValueOnce([
        { "FeedbackRecords.collectedAt.month": "2026-01-01T00:00:00.000", "FeedbackRecords.count": 7 },
      ]);

    const profile = await getAIDataProfile(input);

    expect(profile).toMatchObject({
      totalRecords: 7,
      sources: [{ name: "Web widget prod", type: "app" }],
      questions: [{ label: "How happy are you?", fieldType: "rating" }],
      languages: ["en"],
      earliestMonth: "2026-01",
    });
    expect(mocks.executeTenantScopedQuery).toHaveBeenCalledTimes(4);
  });

  test("scopes every query to the caller's directory under its own audit source", async () => {
    mocks.executeTenantScopedQuery.mockResolvedValue([]);

    await getAIDataProfile(input);

    for (const [call] of mocks.executeTenantScopedQuery.mock.calls) {
      expect(call).toMatchObject({ ...input, source: "charts.aiDataProfile" });
    }
  });

  test("caps the lookups so a large directory cannot flood the prompt", async () => {
    mocks.executeTenantScopedQuery.mockResolvedValue([]);

    await getAIDataProfile(input);

    const limits = mocks.executeTenantScopedQuery.mock.calls.map(([call]) => call.query.limit);
    expect(limits).toContain(AI_DATA_PROFILE_LIMITS.sources + 1);
    expect(limits).toContain(AI_DATA_PROFILE_LIMITS.questions + 1);
    expect(limits).toContain(AI_DATA_PROFILE_LIMITS.languages + 1);
  });

  test("caches the profile under the directory", async () => {
    mocks.executeTenantScopedQuery.mockResolvedValue([]);

    await getAIDataProfile(input);

    expect(mocks.withCache).toHaveBeenCalledWith(
      expect.any(Function),
      "analytics:directory-1:ai-data-profile",
      expect.any(Number)
    );
  });

  test("degrades to no profile when the cube is unreachable, rather than failing the generation", async () => {
    mocks.executeTenantScopedQuery.mockRejectedValue(new Error("cube unavailable"));

    await expect(getAIDataProfile(input)).resolves.toBeNull();
    expect(mocks.warn).toHaveBeenCalled();
  });
});
