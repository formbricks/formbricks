import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TViewerAccessJoin,
  VIEWER_ACCESS_MAX_CONDITIONS,
  getViewerAccessFieldLabel,
  isViewerAccessField,
} from "./viewer-access-claim";

/**
 * A Feedback Dataset's Dashboard Viewer access (ENG-7476, ADR-0061): the conditions a record must meet
 * for a Dashboard Viewer to see it, read and replaced as one. The dataset's `updatedAt` is the version a
 * write compares against, so two people saving at once never silently overwrite each other.
 */

/** The built-in Email attribute's label. A condition with `attributeKeyId: null` matches on it. */
export const EMAIL_ATTRIBUTE_LABEL = "Email";

export type TDatasetViewerCondition = {
  field: string;
  fieldLabel: string;
  /** `null` is the built-in Email attribute. */
  attributeKeyId: string | null;
  attributeLabel: string;
};

export type TDatasetViewerAccess = {
  datasetId: string;
  join: TViewerAccessJoin;
  conditions: TDatasetViewerCondition[];
  updatedAt: Date;
};

export type TDatasetViewerAccessInput = {
  join: TViewerAccessJoin;
  conditions: { field: string; attributeKeyId: string | null }[];
};

export class DatasetViewerAccessConflictError extends Error {
  constructor(readonly currentUpdatedAt: Date) {
    super("The Feedback Dataset changed since it was read");
    this.name = "DatasetViewerAccessConflictError";
  }
}

/** A condition the organization cannot hold: an unknown Member attribute, or a field no condition takes. */
export class DatasetViewerAccessInvalidError extends Error {
  constructor(readonly issues: { name: string; reason: string }[]) {
    super("The Dashboard Viewer access is not valid");
    this.name = "DatasetViewerAccessInvalidError";
  }
}

const selectAccess = {
  id: true,
  updatedAt: true,
  viewerAccessJoin: true,
  viewerAccessConditions: {
    orderBy: [{ order: "asc" as const }, { id: "asc" as const }],
    take: VIEWER_ACCESS_MAX_CONDITIONS,
    select: { field: true, attributeKeyId: true, attributeKey: { select: { label: true } } },
  },
};

type TAccessRow = {
  id: string;
  updatedAt: Date;
  viewerAccessJoin: TViewerAccessJoin;
  viewerAccessConditions: {
    field: string;
    attributeKeyId: string | null;
    attributeKey: { label: string } | null;
  }[];
};

const toAccess = (row: TAccessRow): TDatasetViewerAccess => ({
  datasetId: row.id,
  join: row.viewerAccessJoin,
  updatedAt: row.updatedAt,
  conditions: row.viewerAccessConditions.map(({ field, attributeKeyId, attributeKey }) => ({
    field,
    fieldLabel: getViewerAccessFieldLabel(field),
    attributeKeyId,
    attributeLabel: attributeKey?.label ?? EMAIL_ATTRIBUTE_LABEL,
  })),
});

/** The organization a dataset belongs to, or `null` for none. Archived datasets keep their settings. */
export const getDatasetOrganizationId = async (datasetId: string): Promise<string | null> =>
  (await prisma.feedbackDirectory.findUnique({ where: { id: datasetId }, select: { organizationId: true } }))
    ?.organizationId ?? null;

export const getDatasetViewerAccess = async (
  organizationId: string,
  datasetId: string
): Promise<TDatasetViewerAccess | null> => {
  const row = await prisma.feedbackDirectory.findFirst({
    where: { id: datasetId, organizationId },
    select: selectAccess,
  });
  return row ? toAccess(row) : null;
};

/**
 * Replaces the dataset's join and conditions when it is still at `expectedUpdatedAt`. Every attribute key
 * must belong to the organization; fields are Feedback Record string fields or `ed:<key>`. Returns the
 * access before and after, for the audit trail. `null` when the dataset is not the organization's.
 */
export const replaceDatasetViewerAccess = async (
  organizationId: string,
  datasetId: string,
  input: TDatasetViewerAccessInput,
  expectedUpdatedAt: Date
): Promise<{ before: TDatasetViewerAccess; after: TDatasetViewerAccess } | null> => {
  const issues: { name: string; reason: string }[] = [];
  if (input.conditions.length > VIEWER_ACCESS_MAX_CONDITIONS) {
    issues.push({ name: "conditions", reason: `at most ${VIEWER_ACCESS_MAX_CONDITIONS} conditions` });
  }
  input.conditions.forEach(({ field }, index) => {
    if (!isViewerAccessField(field)) {
      issues.push({
        name: `conditions[${index}].field`,
        reason: "must be a Feedback Record string field or ed:<embedded data key>",
      });
    }
  });
  const keyIds = [
    ...new Set(input.conditions.flatMap(({ attributeKeyId }) => (attributeKeyId ? [attributeKeyId] : []))),
  ];
  if (keyIds.length > 0) {
    const known = new Set(
      (
        await prisma.memberAttributeKey.findMany({
          where: { organizationId, id: { in: keyIds } },
          select: { id: true },
        })
      ).map(({ id }) => id)
    );
    input.conditions.forEach(({ attributeKeyId }, index) => {
      if (attributeKeyId && !known.has(attributeKeyId)) {
        issues.push({
          name: `conditions[${index}].attributeKeyId`,
          reason: "is not a Member attribute of this organization",
        });
      }
    });
  }
  if (issues.length > 0) throw new DatasetViewerAccessInvalidError(issues);

  return prisma.$transaction(async (tx) => {
    const current = await tx.feedbackDirectory.findFirst({
      where: { id: datasetId, organizationId },
      select: selectAccess,
    });
    if (!current) return null;
    // Compare-and-set on the dataset row: the update matches only the version that was read.
    const updated = await tx.feedbackDirectory.updateMany({
      where: { id: datasetId, organizationId, updatedAt: expectedUpdatedAt },
      data: { viewerAccessJoin: input.join },
    });
    if (updated.count === 0) throw new DatasetViewerAccessConflictError(current.updatedAt);

    await tx.feedbackDirectoryViewerCondition.deleteMany({ where: { feedbackDirectoryId: datasetId } });
    if (input.conditions.length > 0) {
      await tx.feedbackDirectoryViewerCondition.createMany({
        data: input.conditions.map(({ field, attributeKeyId }, order) => ({
          feedbackDirectoryId: datasetId,
          field,
          attributeKeyId,
          order,
        })),
      });
    }
    const after = await tx.feedbackDirectory.findFirstOrThrow({
      where: { id: datasetId },
      select: selectAccess,
    });
    return { before: toAccess(current), after: toAccess(after) };
  });
};
