import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { runChartQuery } from "@/modules/ee/analysis/lib/run-chart-query";
import { getMemberAttributeValuesByKey } from "@/modules/ee/member-attributes/lib/service";
import {
  VIEWER_ACCESS_PROBE_CONCURRENCY,
  getViewerAccessRecordMatch,
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

describe("getViewerAccessRecordMatch", () => {
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
    expect(await getViewerAccessRecordMatch(reader, ["ds_1"], probe)).toBe("unmatched");
    expect(vi.mocked(runChartQuery).mock.calls[0][0].viewerAccess).not.toBeNull();
  });

  test("stays restricted when at least one record matches", async () => {
    vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 3 }] } as never);
    expect(await getViewerAccessRecordMatch(reader, ["ds_1"], probe)).toBe("restricted");
  });

  test("stays restricted, and the read goes on, when the probe cannot reach Cube", async () => {
    vi.mocked(runChartQuery).mockRejectedValue(new Error("fetch failed"));
    expect(await getViewerAccessRecordMatch(reader, ["ds_1"], probe)).toBe("restricted");
  });

  test("probes only the dataset with values when another one has none", async () => {
    vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue([
      {
        id: "ds_empty",
        viewerAccessJoin: "all",
        viewerAccessConditions: [
          {
            field: "FeedbackRecords.sourceName",
            attributeKeyId: "key_none",
            attributeKey: { label: "Team" },
          },
        ],
      },
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
    vi.mocked(runChartQuery).mockReset();
    vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 2 }] } as never);
    expect(await getViewerAccessRecordMatch(reader, ["ds_empty", "ds_1"], probe)).toBe("restricted");
    expect(runChartQuery).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runChartQuery).mock.calls[0][0].datasetId).toBe("ds_1");
  });

  test("stays restricted without probing when another dataset has no conditions", async () => {
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
    vi.mocked(runChartQuery).mockReset();
    vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
    expect(await getViewerAccessRecordMatch(reader, ["ds_open", "ds_1"], probe)).toBe("restricted");
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("is unrestricted for a reader who is not a Dashboard Viewer", async () => {
    vi.mocked(runChartQuery).mockClear();
    expect(await getViewerAccessRecordMatch(null, ["ds_1"], probe)).toBe("unrestricted");
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("probes nothing when the viewer holds no value for a condition", async () => {
    vi.mocked(getMemberAttributeValuesByKey).mockResolvedValue(new Map());
    vi.mocked(runChartQuery).mockClear();
    expect(await getViewerAccessRecordMatch(reader, ["ds_1"], probe)).toBe("unmatched");
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
      expect(await getViewerAccessRecordMatch(reader, ids, probe)).toBe("restricted");
      expect(runChartQuery).toHaveBeenCalledTimes(VIEWER_ACCESS_PROBE_CONCURRENCY);
    });

    test("is unmatched when none of many restricted datasets matches", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(12) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
      const ids = Array.from({ length: 12 }, (_, i) => `ds_${i}`);
      expect(await getViewerAccessRecordMatch(reader, ids, probe)).toBe("unmatched");
      expect(runChartQuery).toHaveBeenCalledTimes(12);
    });

    test("reuses recent probe answers on the next read", async () => {
      vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(datasets(12) as never);
      vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
      const ids = Array.from({ length: 12 }, (_, i) => `ds_${i}`);
      await getViewerAccessRecordMatch(reader, ids, probe);
      vi.mocked(runChartQuery).mockClear();
      expect(await getViewerAccessRecordMatch(reader, ids, probe)).toBe("unmatched");
      expect(runChartQuery).not.toHaveBeenCalled();
    });
  });
});

describe("getViewerAccessSummary", () => {
  const restrictedDatasets = (count: number) =>
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

  beforeEach(() => {
    resetViewerAccessProbeCache();
    vi.mocked(runChartQuery).mockReset();
    vi.mocked(runChartQuery).mockResolvedValue({ rows: [{ "FeedbackRecords.count": 0 }] } as never);
  });

  test("reads 250 restricted datasets without a single record query", async () => {
    vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(restrictedDatasets(250) as never);
    vi.mocked(getMemberAttributeValuesByKey).mockResolvedValue(new Map([["key_1", ["Swedn"]]]));
    const ids = Array.from({ length: 250 }, (_, i) => `ds_${i}`);
    const summary = await getViewerAccessSummary(reader, ids);
    expect(summary).toEqual({
      status: "restricted",
      chips: [{ label: "Country", attributeLabel: "Country", values: ["Swedn"] }],
    });
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("is unmatched from the conditions alone when the viewer holds no value", async () => {
    vi.mocked(prisma.feedbackDirectory.findMany).mockResolvedValue(restrictedDatasets(1) as never);
    vi.mocked(getMemberAttributeValuesByKey).mockResolvedValue(new Map());
    expect((await getViewerAccessSummary(reader, ["ds_0"])).status).toBe("unmatched");
    expect(runChartQuery).not.toHaveBeenCalled();
  });

  test("is unrestricted for a reader who is not a Dashboard Viewer", async () => {
    vi.mocked(prisma.feedbackDirectory.findMany).mockClear();
    expect(await getViewerAccessSummary(null, ["ds_0"])).toEqual({ status: "unrestricted", chips: [] });
    expect(prisma.feedbackDirectory.findMany).not.toHaveBeenCalled();
  });
});
