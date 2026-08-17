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
  /** On the link, not on `field`: one shared definition sits at a different position per survey. */
  order: number;
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
  toCreate: (TDesiredEmbeddedField & { order: number })[];
  toUpdate: {
    fieldId: string;
    name: string;
    dataType: TEmbeddedDataType;
    defaultValue: TEmbeddedDataDefaultValue;
  }[];
  /** Links whose position moved. Separate from `toUpdate`, which is keyed by definition, not link. */
  toReorder: { linkId: string; order: number }[];
  /** Links to drop. `fieldIdToDelete` is null when the definition must outlive the link. */
  toUnlink: { linkId: string; fieldIdToDelete: string | null }[];
}

const SELECT_CURRENT_FIELDS = {
  id: true,
  storageKey: true,
  order: true,
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
): TEmbeddedDataDefaultValue | typeof Prisma.DbNull => defaultValue ?? Prisma.DbNull;

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
 *
 * A field's position is its index in `desired`, and it is compared against the stored one rather
 * than against how the other links are arranged. That makes every save self-healing: a link left at
 * the wrong position by any route repairs itself the next time the survey is saved, so the ENG-1835
 * backfill is not the only thing standing between a survey and a correct order. It matters on a
 * fresh database in particular, where data migrations are baselined as applied without ever running.
 */
export const planEmbeddedDataReconcile = (
  surveyId: string,
  current: TCurrentEmbeddedField[],
  desired: TDesiredEmbeddedField[]
): TEmbeddedDataReconcilePlan => {
  const currentByKey = new Map(current.map((entry) => [entry.storageKey, entry]));
  const desiredByKey = new Map(desired.map((entry, order) => [entry.storageKey, { entry, order }] as const));

  const plan: TEmbeddedDataReconcilePlan = { toCreate: [], toUpdate: [], toReorder: [], toUnlink: [] };

  for (const entry of current) {
    const wanted = desiredByKey.get(entry.storageKey);
    // A definition may only be deleted when this survey owns it. Checking the owner rather than just
    // "is it local" also stops one survey deleting another's local row, which the schema permits.
    const isOwnedByThisSurvey = isLocalEmbeddedData(entry.field) && entry.field.surveyId === surveyId;

    // Two cases, one test: the field is gone, or a storage key whose source changed is a different
    // field wearing the same address — replace it rather than mutating a computed field into an
    // ingested one. `wanted?.entry.source` is undefined in the first case, which no source ever equals.
    if (wanted?.entry.source !== entry.field.source) {
      plan.toUnlink.push({
        linkId: entry.linkId,
        fieldIdToDelete: isOwnedByThisSurvey ? entry.field.id : null,
      });
      continue;
    }

    // Above the ownership guard on purpose: position belongs to the link, not to the definition, so
    // a shared field this survey does not own still moves when the fields around it change.
    if (entry.order !== wanted.order) {
      plan.toReorder.push({ linkId: entry.linkId, order: wanted.order });
    }

    if (!isOwnedByThisSurvey) continue;

    const changed =
      wanted.entry.name !== entry.field.name ||
      wanted.entry.dataType !== entry.field.dataType ||
      wanted.entry.defaultValue !== entry.field.defaultValue;

    if (changed) {
      plan.toUpdate.push({
        fieldId: entry.field.id,
        name: wanted.entry.name,
        dataType: wanted.entry.dataType,
        defaultValue: wanted.entry.defaultValue,
      });
    }
  }

  for (const [order, entry] of desired.entries()) {
    const existing = currentByKey.get(entry.storageKey);
    // Mirror of the test above: absent, or present under a different source, both mean create.
    // `order` is carried on the plan item rather than re-derived when the row is written, because
    // `toCreate` is a filtered subset of `desired` and its own index is not the field's position.
    if (existing?.field.source !== entry.source) {
      plan.toCreate.push({ ...entry, order });
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
    order: link.order,
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
      await tx.embeddedData.deleteMany({
        where: {
          id: { in: fieldIdsToDelete },
          surveyId,
          // This survey's links are already gone, so any link still standing belongs to another
          // survey — and deleting the row would cascade that link away, silently costing that survey
          // a field. Nothing creates such a link today (the reconcile only ever links to rows it just
          // created), so this guards an invariant rather than a live path; leaving an orphaned row
          // behind is the better failure of the two.
          surveyLinks: { none: {} },
        },
      });
    }
  }

  for (const entry of plan.toUpdate) {
    // Scoped by `surveyId` to match the delete above. The id provably came from a link this survey
    // owns, so the extra clause changes nothing — it just keeps every write here tenant-scoped on its
    // face rather than by argument.
    await tx.embeddedData.updateMany({
      where: { id: entry.fieldId, surveyId },
      data: {
        name: entry.name,
        dataType: entry.dataType,
        defaultValue: toStoredDefaultValue(entry.defaultValue),
      },
    });
  }

  // Only links that actually moved. Rewriting every position on every save would turn a one-word
  // rename on a field-heavy survey into an UPDATE per field, and survey saves are a hot path.
  for (const entry of plan.toReorder) {
    await tx.surveyEmbeddedData.updateMany({
      where: { id: entry.linkId, surveyId },
      data: { order: entry.order },
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
      data: {
        surveyId,
        workspaceId,
        embeddedDataId: field.id,
        storageKey: entry.storageKey,
        order: entry.order,
      },
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
