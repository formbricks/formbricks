import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { getMemberAttributeValuesByKey } from "@/modules/ee/member-attributes/lib/service";
import {
  VIEWER_ACCESS_PROBE_CONCURRENCY,
  getViewerAccessSummary,
  resetViewerAccessProbeCache,
} from "./viewer-data-access";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { feedbackDirectory: { findMany: vi.fn() }, user: { findUnique: vi.fn() } },
}));
vi.mock("@/modules/ee/member-attributes/lib/service", () => ({ getMemberAttributeValuesByKey: vi.fn() }));
vi.mock("@/modules/ee/analysis/lib/run-chart-query", () => ({ runChartQuery: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));

const reader = { userId: "user_1", organizationId: "org_1" };
const probe = { workspaceId: "ws_1", actor: { type: "user" as const, id: "user_1" } };

describe("getViewerAccessSummary", () => {
  beforeEach(() => {
    resetViewerAccessProbeCache();
    vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue([
      {
        id: "ds_1",
        viewerAccessJoin: "all",
        viewerAccessConditions: [
          {
            field: "FeedbackRecords.metadataCountry",
            attributeKeyId: "key_1",
            attributeKey: { label: "Country" },
          },
        ],
      },
    ] as never);
    vi.mocked(getMemberAttributeValuesByKey).mockResolvedValue(new Map([["key_1", ["Swedn"]]]));
  });

  test("is unmatched when the viewer's values match no record", async () => {
    vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
    const summary = await getViewerAccessSummary(reader, ["ds_1"], probe);
    expect(summary.status).toBe("unmatched");
    expect(vi.mocked(runChartQuery).mock.calls[0][0].viewerAccess).not.toBeNull();
  });

  test("stays restricted when at least one record matches", async () => {
    vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 3 }] } as never);
    expect((await getViewerAccessSummary(reader, ["ds_1"], probe)).status).toBe("restricted");
  });

  test("stays restricted, and the read goes on, when the probe cannot reach Cube", async () => {
    vi.mocked(runChartQuery).mockRejectedValue(new Error("fetch failed"));
    expect((await getViewerAccessSummary(reader, ["ds_1"], probe)).status).toBe("restricted");
  });

  test("runs no probe without a probe scope", async () => {
    vi.mocked(runChartQuery).mockClear();
    expect((await getViewerAccessSummary(reader, ["ds_1"])).status).toBe("restricted");
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  describe("with many restricted datasets", () => {
    const datasets = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `ds_${i}`,
        viewerAccessJoin: "all",
        viewerAccessConditions: [
          {
            field: "FeedbackRecords.metadataCountry",
            attributeKeyId: "key_1",
            attributeKey: { label: "Country" },
          },
        ],
      }));

    beforeEach(() => vi.mocked(runChartQuery).mockReset());

    test("starts no new probe once one dataset matched", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(20) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 1 }] } as never);
      const ids = Array.from({ length: 20 }, (_, i) => `ds_${i}`);
      expect((await getViewerAccessSummary(reader, ids, probe)).status).toBe("restricted");
      expect(runChartQuery).toHaveBeenCalledTimes(VIEWER_ACCESS_PROBE_CONCURRENCY);
    });

    test("is unmatched when none of many restricted datasets matches", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(12) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
      const ids = Array.from({ length: 12 }, (_, i) => `ds_${i}`);
      expect((await getViewerAccessSummary(reader, ids, probe)).status).toBe("unmatched");
      expect(runChartQuery).toHaveBeenCalledTimes(12);
    });

    test("reuses recent probe answers on the next read", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(12) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
      const ids = Array.from({ length: 12 }, (_, i) => `ds_${i}`);
      await getViewerAccessSummary(reader, ids, probe);
      vi.mocked(runChartQuery).mockClear();
      expect((await getViewerAccessSummary(reader, ids, probe)).status).toBe("unmatched");
      expect(runChartQuery).not.toHaveBeenCalled();
    });
  });
});
