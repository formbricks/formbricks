import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import {
  type TEmbeddedDataDefaultValue,
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
  isLocalEmbeddedData,
} from "@formbricks/types/embedded-data";
import { type TDesiredEmbeddedField } from "@formbricks/types/embedded-data-mapping";
import { InvalidInputError } from "@formbricks/types/errors";

/** One field a survey currently has, as the link plus the definition it points at. */
export interface TCurrentEmbeddedField {
  linkId: string;
  storageKey: string;
  field: {
    id: string;
    /** The owning survey for a local definition, null for a shared library one. */
    surveyId: string | null;
    name: string;
    source: TEmbeddedDataSource;
    dataType: TEmbeddedDataType;
    defaultValue: TEmbeddedDataDefaultValue;
  };
}

export interface TEmbeddedDataReconcilePlan {
  toCreate: TDesiredEmbeddedField[];
  toUpdate: {
    fieldId: string;
    name: string;
    dataType: TEmbeddedDataType;
    defaultValue: TEmbeddedDataDefaultValue;
  }[];
  /** Links to drop. `fieldIdToDelete` is null when the definition must outlive the link. */
  toUnlink: { linkId: string; fieldIdToDelete: string | null }[];
}

const SELECT_CURRENT_FIELDS = {
  id: true,
  storageKey: true,
  embeddedData: {
    select: { id: true, surveyId: true, name: true, source: true, dataType: true, defaultValue: true },
  },
} satisfies Prisma.SurveyEmbeddedDataSelect;

/**
 * Prisma distinguishes a JSON `null` from a SQL `NULL` on a nullable Json column, so "this field has
 * no default" has to be spelled out rather than passed as a bare `null`.
 */
const toStoredDefaultValue = (
  defaultValue: TEmbeddedDataDefaultValue
): TEmbeddedDataDefaultValue | typeof Prisma.DbNull => (defaultValue === null ? Prisma.DbNull : defaultValue);

/**
 * Works out what has to change for a survey's Embedded Data to match `desired`.
 *
 * Pure, so the branching that actually matters — what may be edited, what may be deleted — is
 * testable without a database.
 *
 * Two rules protect the shared library, which the legacy Variables and Hidden Fields cards know
 * nothing about. A shared definition is workspace-owned, so removing it from a survey **unlinks**
 * it and leaves the row alone, and a change to its name or type is ignored rather than written back.
 * In v1 no shared rows exist yet (the manager is ENG-1851), but this reconcile keeps running once
 * they do.
 */
export const planEmbeddedDataReconcile = (
  surveyId: string,
  current: TCurrentEmbeddedField[],
  desired: TDesiredEmbeddedField[]
): TEmbeddedDataReconcilePlan => {
  const currentByKey = new Map(current.map((entry) => [entry.storageKey, entry]));
  const desiredByKey = new Map(desired.map((entry) => [entry.storageKey, entry]));

  const plan: TEmbeddedDataReconcilePlan = { toCreate: [], toUpdate: [], toUnlink: [] };

  for (const entry of current) {
    const wanted = desiredByKey.get(entry.storageKey);
    // A definition may only be deleted when this survey owns it. Checking the owner rather than just
    // "is it local" also stops one survey deleting another's local row, which the schema permits.
    const isOwnedByThisSurvey = isLocalEmbeddedData(entry.field) && entry.field.surveyId === surveyId;

    // A storage key whose source changed is a different field wearing the same address — replace it
    // rather than mutating a computed field into an ingested one.
    if (!wanted || wanted.source !== entry.field.source) {
      plan.toUnlink.push({
        linkId: entry.linkId,
        fieldIdToDelete: isOwnedByThisSurvey ? entry.field.id : null,
      });
      continue;
    }

    if (!isOwnedByThisSurvey) continue;

    const changed =
      wanted.name !== entry.field.name ||
      wanted.dataType !== entry.field.dataType ||
      wanted.defaultValue !== entry.field.defaultValue;

    if (changed) {
      plan.toUpdate.push({
        fieldId: entry.field.id,
        name: wanted.name,
        dataType: wanted.dataType,
        defaultValue: wanted.defaultValue,
      });
    }
  }

  for (const entry of desired) {
    const existing = currentByKey.get(entry.storageKey);
    if (!existing || existing.field.source !== entry.source) {
      plan.toCreate.push(entry);
    }
  }

  return plan;
};

/**
 * Brings a survey's `EmbeddedData` rows and links in step with the legacy shape it was just saved
 * with.
 *
 * Runs inside the caller's transaction so a survey never commits without its fields, and takes
 * `workspaceId` explicitly because the copy flow writes into a *different* workspace than the one it
 * read from. Both foreign keys are workspace-scoped, so passing the wrong one fails loudly.
 *
 * Never reads or writes `Response`: a response stores values under the same `storageKey`, so moving
 * definitions leaves stored data untouched by construction.
 */
export const reconcileEmbeddedData = async (
  tx: Prisma.TransactionClient,
  {
    surveyId,
    workspaceId,
    desired,
  }: { surveyId: string; workspaceId: string; desired: TDesiredEmbeddedField[] }
): Promise<void> => {
  assertNoDuplicateStorageKeys(desired);

  const links = await tx.surveyEmbeddedData.findMany({
    where: { surveyId },
    select: SELECT_CURRENT_FIELDS,
  });

  const current: TCurrentEmbeddedField[] = links.map((link) => ({
    linkId: link.id,
    storageKey: link.storageKey,
    field: link.embeddedData,
  }));

  const plan = planEmbeddedDataReconcile(surveyId, current, desired);

  // Unlink before creating: a field whose source changed keeps its storage key, and
  // `@@unique([surveyId, storageKey])` would reject the replacement while the old link still exists.
  if (plan.toUnlink.length > 0) {
    await tx.surveyEmbeddedData.deleteMany({
      where: { id: { in: plan.toUnlink.map((entry) => entry.linkId) } },
    });

    const fieldIdsToDelete = plan.toUnlink
      .map((entry) => entry.fieldIdToDelete)
      .filter((fieldId): fieldId is string => fieldId !== null);

    if (fieldIdsToDelete.length > 0) {
      await tx.embeddedData.deleteMany({ where: { id: { in: fieldIdsToDelete }, surveyId } });
    }
  }

  for (const entry of plan.toUpdate) {
    await tx.embeddedData.update({
      where: { id: entry.fieldId },
      data: {
        name: entry.name,
        dataType: entry.dataType,
        defaultValue: toStoredDefaultValue(entry.defaultValue),
      },
    });
  }

  // Sequential rather than batched: the link needs the id of the row it points at, and a survey
  // holds a handful of fields, not thousands.
  for (const entry of plan.toCreate) {
    const field = await tx.embeddedData.create({
      data: {
        // Local: owned by this survey, absent from the shared library, so no library key.
        key: null,
        surveyId,
        workspaceId,
        name: entry.name,
        source: entry.source,
        dataType: entry.dataType,
        defaultValue: toStoredDefaultValue(entry.defaultValue),
      },
      select: { id: true },
    });

    await tx.surveyEmbeddedData.create({
      data: { surveyId, workspaceId, embeddedDataId: field.id, storageKey: entry.storageKey },
    });
  }
};

/**
 * `@@unique([surveyId, storageKey])` would reject a repeated address anyway, but as an opaque
 * database error. Naming the offending key turns it into a 400 the editor can act on.
 */
const assertNoDuplicateStorageKeys = (desired: TDesiredEmbeddedField[]): void => {
  const seen = new Set<string>();
  for (const entry of desired) {
    if (seen.has(entry.storageKey)) {
      throw new InvalidInputError(`Duplicate embedded data field: ${entry.storageKey}`);
    }
    seen.add(entry.storageKey);
  }
};
