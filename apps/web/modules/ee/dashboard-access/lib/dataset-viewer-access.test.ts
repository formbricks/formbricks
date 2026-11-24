import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DatasetViewerAccessConflictError,
  DatasetViewerAccessInvalidError,
  getDatasetOrganizationId,
  getDatasetViewerAccess,
  replaceDatasetViewerAccess,
} from "./dataset-viewer-access";
import { VIEWER_ACCESS_MAX_CONDITIONS } from "./viewer-access-claim";

vi.mock("server-only", () => ({}));

const ORG = "org_1";
const DATASET = "ds_1";
const t0 = new Date("2026-01-01T00:00:00.000Z");
const t1 = new Date("2026-01-02T00:00:00.000Z");

const row = (
  conditions: { field: string; attributeKeyId: string | null; attributeKey: { label: string } | null }[],
  updatedAt = t0
) => ({ id: DATASET, updatedAt, viewerAccessJoin: "all", viewerAccessConditions: conditions });

const COUNTRY = "FeedbackRecords.metadataCountry";

beforeEach(() => {
  prisma.$transaction.mockImplementation(((fn: (tx: typeof prisma) => unknown) => fn(prisma)) as never);
});

describe("getDatasetOrganizationId", () => {
  test("returns the dataset's organization, or null for none", async () => {
    prisma.feedbackDirectory.findUnique.mockResolvedValueOnce({ organizationId: ORG } as never);
    expect(await getDatasetOrganizationId(DATASET)).toBe(ORG);
    prisma.feedbackDirectory.findUnique.mockResolvedValueOnce(null);
    expect(await getDatasetOrganizationId(DATASET)).toBeNull();
  });
});

describe("getDatasetViewerAccess", () => {
  test("returns null for a dataset outside the organization", async () => {
    prisma.feedbackDirectory.findFirst.mockResolvedValue(null);
    expect(await getDatasetViewerAccess(ORG, DATASET)).toBeNull();
    expect(prisma.feedbackDirectory.findFirst.mock.calls[0][0]?.where).toEqual({
      id: DATASET,
      organizationId: ORG,
    });
  });

  test("labels record fields, embedded keys and the built-in Email attribute", async () => {
    prisma.feedbackDirectory.findFirst.mockResolvedValue(
      row([
        { field: COUNTRY, attributeKeyId: "k1", attributeKey: { label: "Country" } },
        { field: "ed:region", attributeKeyId: null, attributeKey: null },
      ]) as never
    );

    expect(await getDatasetViewerAccess(ORG, DATASET)).toEqual({
      datasetId: DATASET,
      join: "all",
      updatedAt: t0,
      conditions: [
        { field: COUNTRY, fieldLabel: "Country", attributeKeyId: "k1", attributeLabel: "Country" },
        { field: "ed:region", fieldLabel: "region", attributeKeyId: null, attributeLabel: "Email" },
      ],
    });
  });
});

describe("replaceDatasetViewerAccess", () => {
  test("refuses too many conditions and unknown fields before touching the dataset", async () => {
    const conditions = Array.from({ length: VIEWER_ACCESS_MAX_CONDITIONS + 1 }, (_, index) => ({
      field: index === 0 ? "FeedbackRecords.secret" : COUNTRY,
      attributeKeyId: null,
    }));

    const error = await replaceDatasetViewerAccess(ORG, DATASET, { join: "all", conditions }, t0).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(DatasetViewerAccessInvalidError);
    expect((error as DatasetViewerAccessInvalidError).issues.map(({ name }) => name)).toEqual([
      "conditions",
      "conditions[0].field",
    ]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("refuses a Member attribute of another organization, naming its position", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([{ id: "k1" }] as never);

    const error = await replaceDatasetViewerAccess(
      ORG,
      DATASET,
      {
        join: "any",
        conditions: [
          { field: COUNTRY, attributeKeyId: "k1" },
          { field: COUNTRY, attributeKeyId: "k_foreign" },
        ],
      },
      t0
    ).catch((e: unknown) => e);

    expect((error as DatasetViewerAccessInvalidError).issues).toEqual([
      { name: "conditions[1].attributeKeyId", reason: "is not a Member attribute of this organization" },
    ]);
    expect(prisma.memberAttributeKey.findMany.mock.calls[0][0]?.where).toEqual({
      organizationId: ORG,
      id: { in: ["k1", "k_foreign"] },
    });
  });

  test("returns null for a dataset outside the organization", async () => {
    prisma.feedbackDirectory.findFirst.mockResolvedValue(null);
    expect(await replaceDatasetViewerAccess(ORG, DATASET, { join: "all", conditions: [] }, t0)).toBeNull();
    expect(prisma.feedbackDirectory.updateMany).not.toHaveBeenCalled();
  });

  test("refuses a dataset changed since it was read, with its current updatedAt", async () => {
    prisma.feedbackDirectory.findFirst.mockResolvedValue(row([], t1) as never);
    prisma.feedbackDirectory.updateMany.mockResolvedValue({ count: 0 });

    const error = await replaceDatasetViewerAccess(ORG, DATASET, { join: "all", conditions: [] }, t0).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(DatasetViewerAccessConflictError);
    expect((error as DatasetViewerAccessConflictError).currentUpdatedAt).toEqual(t1);
    expect(prisma.feedbackDirectoryViewerCondition.deleteMany).not.toHaveBeenCalled();
  });

  test("replaces the join and conditions in order and returns before and after", async () => {
    prisma.memberAttributeKey.findMany.mockResolvedValue([{ id: "k1" }] as never);
    prisma.feedbackDirectory.findFirst.mockResolvedValue(row([]) as never);
    prisma.feedbackDirectory.updateMany.mockResolvedValue({ count: 1 });
    prisma.feedbackDirectory.findFirstOrThrow.mockResolvedValue({
      ...row([{ field: COUNTRY, attributeKeyId: "k1", attributeKey: { label: "Country" } }], t1),
      viewerAccessJoin: "any",
    } as never);

    const result = await replaceDatasetViewerAccess(
      ORG,
      DATASET,
      {
        join: "any",
        conditions: [
          { field: COUNTRY, attributeKeyId: "k1" },
          { field: "ed:region", attributeKeyId: null },
        ],
      },
      t0
    );

    expect(prisma.feedbackDirectory.updateMany).toHaveBeenCalledWith({
      where: { id: DATASET, organizationId: ORG, updatedAt: t0 },
      data: { viewerAccessJoin: "any" },
    });
    expect(prisma.feedbackDirectoryViewerCondition.deleteMany).toHaveBeenCalledWith({
      where: { feedbackDirectoryId: DATASET },
    });
    expect(prisma.feedbackDirectoryViewerCondition.createMany).toHaveBeenCalledWith({
      data: [
        { feedbackDirectoryId: DATASET, field: COUNTRY, attributeKeyId: "k1", order: 0 },
        { feedbackDirectoryId: DATASET, field: "ed:region", attributeKeyId: null, order: 1 },
      ],
    });
    expect(result?.before.conditions).toEqual([]);
    expect(result?.after).toMatchObject({ join: "any", updatedAt: t1 });
  });

  test("clears the conditions without inserting when none are sent", async () => {
    prisma.feedbackDirectory.findFirst.mockResolvedValue(row([]) as never);
    prisma.feedbackDirectory.updateMany.mockResolvedValue({ count: 1 });
    prisma.feedbackDirectory.findFirstOrThrow.mockResolvedValue(row([]) as never);

    await replaceDatasetViewerAccess(ORG, DATASET, { join: "all", conditions: [] }, t0);

    expect(prisma.memberAttributeKey.findMany).not.toHaveBeenCalled();
    expect(prisma.feedbackDirectoryViewerCondition.deleteMany).toHaveBeenCalled();
    expect(prisma.feedbackDirectoryViewerCondition.createMany).not.toHaveBeenCalled();
  });
});
