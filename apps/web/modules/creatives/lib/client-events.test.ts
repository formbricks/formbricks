import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { countCreativeEvents } from "./client-events";
import { incrementCreativeCounters } from "./counters";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { creative: { findMany: vi.fn() } } }));
vi.mock("@/lib/cache", () => ({
  cache: { withCache: vi.fn((read: () => Promise<unknown>) => read()) },
}));
vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(async (id: string) => ({ id, organizationId: "org" })),
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyIPRateLimit: vi.fn() }));
vi.mock("./counters", () => ({ incrementCreativeCounters: vi.fn() }));

const workspaceId = "clws1234567890123456789012";
const published = "clpublished000000000000000";
const restoredDraft = "clrestoreddraft00000000000";
const archived = "clarchived0000000000000000";

type TStoredCreative = Record<string, unknown>;

const stored: TStoredCreative[] = [
  { id: published, workspaceId, status: "inProgress", publishedAt: new Date(), archivedAt: null },
  // Restore keeps when it was first published but brings it back as a Draft.
  { id: restoredDraft, workspaceId, status: "draft", publishedAt: new Date(), archivedAt: null },
  { id: archived, workspaceId, status: "paused", publishedAt: new Date(), archivedAt: new Date() },
];

/** Prisma's `where` for the fields the countable read filters on: equality, `null`, or `{ not }`. */
const matches = (row: TStoredCreative, where: Record<string, unknown>) =>
  Object.entries(where).every(([field, condition]) =>
    condition !== null && typeof condition === "object" && "not" in condition
      ? row[field] !== condition.not
      : row[field] === condition
  );

const eventsRequest = (creativeIds: string[]) =>
  new Request(`https://app.formbricks.com/api/v2/client/${workspaceId}/creatives/events`, {
    method: "POST",
    headers: { "user-agent": "Mozilla/5.0 (Macintosh)", "content-type": "application/json" },
    body: JSON.stringify({
      page: "example.com/pricing",
      deviceType: "desktop",
      events: creativeIds.map((creativeId) => ({ creativeId, type: "click" })),
    }),
  });

describe("countCreativeEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.creative.findMany).mockImplementation((async ({ where }: { where: never }) =>
      stored.filter((row) => matches(row, where))) as never);
  });

  test("counts a published creative's events and drops a restored draft's and an archived one's", async () => {
    await countCreativeEvents(eventsRequest([published, restoredDraft, archived]), workspaceId);

    expect(incrementCreativeCounters).toHaveBeenCalledWith(
      expect.objectContaining({ creatives: [{ creativeId: published, impressions: 0, clicks: 1 }] })
    );
  });
});
