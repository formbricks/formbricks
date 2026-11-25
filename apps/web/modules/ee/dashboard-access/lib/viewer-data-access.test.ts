import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { getMemberAttributeValuesByKey } from "@/modules/ee/member-attributes/lib/service";
import { MAX_VIEWER_ACCESS_PROBES, getViewerAccessSummary } from "./viewer-data-access";

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

    test("probes one dataset at a time and stops at the first match", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(3) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 1 }] } as never);
      const ids = ["ds_0", "ds_1", "ds_2"];
      expect((await getViewerAccessSummary(reader, ids, probe)).status).toBe("restricted");
      expect(runChartQuery).toHaveBeenCalledTimes(1);
    });

    test("runs at most MAX_VIEWER_ACCESS_PROBES probes, and stays restricted past them", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(250) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
      const ids = Array.from({ length: 250 }, (_, i) => `ds_${i}`);
      expect((await getViewerAccessSummary(reader, ids, probe)).status).toBe("restricted");
      expect(runChartQuery).toHaveBeenCalledTimes(MAX_VIEWER_ACCESS_PROBES);
    });
  });
});
