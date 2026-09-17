import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import {
  type TEmbeddedDataDefaultValue,
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
  isLocalEmbeddedData,
} from "@formbricks/types/embedded-data";
import {
  type TDesiredEmbeddedField,
  type TLegacyEmbeddedFields,
  linkedToDesiredEmbeddedFields,
  toDesiredEmbeddedFields,
} from "@formbricks/types/embedded-data-mapping";
import { type TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
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
    /** The library name for a shared definition, null for a local one. */
    key: string | null;
    name: string;
    source: TEmbeddedDataSource;
    dataType: TEmbeddedDataType;
    defaultValue: TEmbeddedDataDefaultValue;
    locked: boolean;
  };
}

/**
 * What a write says a survey's Embedded Data should be.
 *
 * Three carriers, and `embeddedFields` wins whenever it is present (ENG-3228): it declares every
 * field of both sources, while the two legacy keys each declare one source and are merged over the
 * survey's current rows.
 */
export interface TEmbeddedDataPatch extends Partial<TLegacyEmbeddedFields> {
  embeddedFields?: TLinkedEmbeddedField[];
}

export interface TEmbeddedDataReconcilePlan {
  toCreate: (TDesiredEmbeddedField & { order: number })[];
  toUpdate: {
    fieldId: string;
    name: string;
    dataType: TEmbeddedDataType;
    defaultValue: TEmbeddedDataDefaultValue;
    locked: boolean;
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
    select: {
      id: true,
      surveyId: true,
      key: true,
      name: true,
      source: true,
      dataType: true,
      defaultValue: true,
      locked: true,
    },
  },
} satisfies Prisma.SurveyEmbeddedDataSelect;

/** A desired entry that links a workspace-owned definition rather than declaring one of its own. */
type TSharedDesiredEmbeddedField = TDesiredEmbeddedField & { key: string; embeddedDataId: string };

/**
 * Whether a desired entry links the shared library.
 *
 * `key !== null` is the whole test — ownership is derived per entry, never sent as a flag, exactly
 * as {@link isLocalEmbeddedData} derives it from a stored row. The `embeddedDataId` half of the
 * predicate is enforced rather than assumed: {@link assertWritableEmbeddedFields} refuses a shared
 * entry that names no row, so by the time the plan is built the two always travel together.
 */
const isSharedDesiredField = (entry: TDesiredEmbeddedField): entry is TSharedDesiredEmbeddedField =>
  entry.key !== null && entry.embeddedDataId !== undefined;

/**
 * Works out what a survey should have after a save: the fields the payload declared, plus — for a
 * legacy payload — the current rows of whichever group it did not carry.
 *
 * This is what makes the rows the write source of truth rather than a copy of the columns. It has to
 * be a merge rather than a straight read of the payload, because `updateSurveyInternal` and the v3
 * patch both accept partial updates: a call carrying only `{ name }` would otherwise resolve to an
 * empty set and delete every field the survey has. Renaming a survey would wipe its Embedded Data.
 *
 * **Presence is `!== undefined`, not the `in` operator.** Every write seam builds one object literal
 * with all three keys spelled out and lets Prisma ignore the undefined ones, so `"variables" in patch`
 * is true even for a payload that never mentioned variables — and would clear them.
 *
 * ## `embeddedFields` is the complete set (ENG-3228)
 *
 * A payload that declares its fields as rows declares all of them, both sources, so `variables` and
 * `hiddenFields` arriving beside it are ignored here and re-derived from this result instead
 * (`toLegacyEmbeddedFields`). There is no merge to do: nothing a survey holds is unrepresentable in
 * this carrier.
 *
 * ## The legacy branch may only say what the columns can carry
 *
 * The two groups are merged independently because they arrive independently: a payload carrying
 * `variables` alone must leave the ingested rows exactly where they are. Within a group, an entry
 * that already exists at the same `(storageKey, source)` keeps everything the legacy columns have no
 * word for — its ownership, its `locked`, and for an ingested field its `dataType` and
 * `defaultValue`. So a v1 PUT can add, remove, and rename or retype the variables it owns, and can
 * *not* unlink a shared field, unlock a locked one, or untype a typed one. Without this a
 * read-modify-write PUT from an integration that has never heard of the library would quietly
 * localize every shared field the editor had linked.
 *
 * `computed` and `ingested` are the only two sources carried over, and that is the whole set a row
 * can have: `ZEmbeddedData` rejects `source: "reserved"` outright, because reserved fields are a
 * code catalog projected at read time rather than anything stored. A `reserved` row is therefore
 * unrepresentable through every write path — and if one ever appeared through raw SQL, this would
 * drop it, which is the correct outcome for a row the schema says cannot exist.
 */
export const resolveDesiredEmbeddedFields = (
  current: TDesiredEmbeddedField[],
  patch: TEmbeddedDataPatch
): TDesiredEmbeddedField[] => {
  if (patch.embeddedFields !== undefined) {
    return linkedToDesiredEmbeddedFields(patch.embeddedFields);
  }

  const currentByAddress = new Map(current.map((entry) => [`${entry.source}:${entry.storageKey}`, entry]));

  const carriedOver = (source: TEmbeddedDataSource): TDesiredEmbeddedField[] =>
    current.filter((entry) => entry.source === source);

  const fromLegacy = (entries: TDesiredEmbeddedField[]): TDesiredEmbeddedField[] =>
    entries.map((entry) => {
      const existing = currentByAddress.get(`${entry.source}:${entry.storageKey}`);
      if (existing === undefined) return entry;
      // A shared definition is workspace-owned and the columns cannot describe it at all, so a
      // legacy write's only options are to keep the link or drop it.
      if (existing.key !== null) return existing;
      // A hidden field id is a name and nothing else; a variable additionally carries its type and
      // its value. Everything outside that stays as stored.
      return entry.source === "computed"
        ? { ...existing, name: entry.name, dataType: entry.dataType, defaultValue: entry.defaultValue }
        : existing;
    });

  // Order matters: the index in this list becomes each field's stored position, and
  // `toDesiredEmbeddedFields` puts every computed field before every ingested one.
  return [
    ...(patch.variables !== undefined
      ? fromLegacy(toDesiredEmbeddedFields({ variables: patch.variables }))
      : carriedOver("computed")),
    ...(patch.hiddenFields !== undefined
      ? fromLegacy(toDesiredEmbeddedFields({ hiddenFields: patch.hiddenFields }))
      : carriedOver("ingested")),
  ];
};

/**
 * Prisma distinguishes a JSON `null` from a SQL `NULL` on a nullable Json column, so "this field has
 * no default" has to be spelled out rather than passed as a bare `null`.
 */
const toStoredDefaultValue = (
  defaultValue: TEmbeddedDataDefaultValue
): TEmbeddedDataDefaultValue | typeof Prisma.DbNull => defaultValue ?? Prisma.DbNull;

/**
 * Whether the stored definition says something different from what the survey now declares. Named
 * apart from a position change on purpose: the two live on different rows — this one on
 * `EmbeddedData`, position on the link — and take different writes.
 */
const definitionDiffers = (wanted: TDesiredEmbeddedField, field: TCurrentEmbeddedField["field"]): boolean =>
  wanted.name !== field.name ||
  wanted.dataType !== field.dataType ||
  wanted.defaultValue !== field.defaultValue ||
  wanted.locked !== field.locked;

/**
 * What identifies one field within one survey, for both sides of the reconcile.
 *
 * `(storageKey, source, ownership)` (ENG-3228), where ownership is local, or the shared row the link
 * points at. Address and source alone were enough while every row was local: they distinguish a
 * computed and an ingested field wearing the same address, which are different fields. Ownership is
 * the third axis a V2 payload can move along — clone-to-edit replaces a shared field with a local
 * copy under the same storage key, and "replace with the library field" does the reverse — and both
 * have to read as a swap rather than as an edit, because a link to a workspace-owned row and a row
 * this survey owns are not the same thing however alike their contents look. Naming the row rather
 * than just "shared" also catches a re-point from one library field to another at the same address.
 */
const ownershipIdentity = (embeddedDataId: string | null): string =>
  embeddedDataId === null ? "local" : `shared:${embeddedDataId}`;

const currentIdentity = (entry: TCurrentEmbeddedField): string =>
  // Ownership off `key` on BOTH sides, deliberately. `surveyId` would say the same thing about any
  // row the schema admits (exactly one of the two is set), but the desired set is built from this
  // row's own `key`, so reading the same column back is what makes a survey that changed nothing
  // resolve to an identical identity — the difference between a no-op save and an unlink.
  [
    entry.field.source,
    ownershipIdentity(entry.field.key === null ? null : entry.field.id),
    entry.storageKey,
  ].join("|");

const desiredIdentity = (entry: TDesiredEmbeddedField): string =>
  [
    entry.source,
    ownershipIdentity(isSharedDesiredField(entry) ? entry.embeddedDataId : null),
    entry.storageKey,
  ].join("|");

/**
 * Works out what has to change for a survey's Embedded Data to match `desired`.
 *
 * Pure, so the branching that actually matters — what may be edited, what may be deleted — is
 * testable without a database.
 *
 * Two rules protect the shared library, which the legacy Variables and Hidden Fields cards know
 * nothing about. A shared definition is workspace-owned, so removing it from a survey **unlinks**
 * it and leaves the row alone, and a change to its name or type is ignored rather than written back.
 * A shared entry therefore only ever yields a link create, a reorder or an unlink — never a
 * definition write, whatever the payload claims about it.
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
  const desiredByIdentity = new Map(
    desired.map((entry, order) => [desiredIdentity(entry), { entry, order }] as const)
  );
  const currentIdentities = new Set(current.map(currentIdentity));

  const plan: TEmbeddedDataReconcilePlan = { toCreate: [], toUpdate: [], toReorder: [], toUnlink: [] };

  for (const entry of current) {
    const wanted = desiredByIdentity.get(currentIdentity(entry));
    // A definition may only be deleted when this survey owns it. Checking the owner rather than just
    // "is it local" also stops one survey deleting another's local row, which the schema permits.
    const isOwnedByThisSurvey = isLocalEmbeddedData(entry.field) && entry.field.surveyId === surveyId;

    // Nothing in `desired` identifies this field: it is gone, or something else now wears its
    // address — a different source, or a local copy where a library link used to be. Either way the
    // link goes, and the create pass below puts the replacement in.
    if (wanted === undefined) {
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

    if (definitionDiffers(wanted.entry, entry.field)) {
      plan.toUpdate.push({
        fieldId: entry.field.id,
        name: wanted.entry.name,
        dataType: wanted.entry.dataType,
        defaultValue: wanted.entry.defaultValue,
        locked: wanted.entry.locked,
      });
    }
  }

  // `order` is stamped from the index in the **full** desired list and only then filtered, because a
  // field's position is where it sits among everything the survey declares, not among the subset
  // that happens to need creating.
  plan.toCreate.push(
    ...desired
      .map((entry, order) => ({ ...entry, order }))
      .filter((entry) => !currentIdentities.has(desiredIdentity(entry)))
  );

  return plan;
};

/**
 * Brings a survey's `EmbeddedData` rows and links in step with the payload it was just saved with.
 *
 * **The payload, not the persisted survey** (ENG-2412). The rows are the write source of truth now;
 * `survey.variables` / `survey.hiddenFields` are written from the same payload in the same
 * transaction and kept only as a rollback path until they are dropped. Reading the persisted survey
 * here instead would put the columns back in charge, and reading the rows would be circular — the
 * target would always equal the current state and no edit would ever persist.
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
  { surveyId, workspaceId, patch }: { surveyId: string; workspaceId: string; patch: TEmbeddedDataPatch }
): Promise<void> => {
  const links = await tx.surveyEmbeddedData.findMany({
    where: { surveyId },
    // The group the payload did not carry keeps its stored positions, and those become indexes in
    // `desired` — so the rows have to arrive in the order they are stored in, not in Postgres' whim.
    orderBy: [{ order: "asc" }, { storageKey: "asc" }],
    select: SELECT_CURRENT_FIELDS,
  });

  const current: TCurrentEmbeddedField[] = links.map((link) => ({
    linkId: link.id,
    storageKey: link.storageKey,
    order: link.order,
    field: link.embeddedData,
  }));

  const desired = resolveDesiredEmbeddedFields(
    current.map(({ storageKey, field }) => ({
      storageKey,
      name: field.name,
      source: field.source,
      dataType: field.dataType,
      defaultValue: field.defaultValue,
      locked: field.locked,
      key: field.key,
      ...(field.key !== null ? { embeddedDataId: field.id } : {}),
    })),
    patch
  );
  assertNoDuplicateStorageKeys(desired);

  // Only for the V2 carrier. The legacy branch above returns entries built either from the columns —
  // whose own schemas already gate them — or from rows this survey already holds, and re-checking
  // those would refuse a survey stored before a rule existed. Both run before the first write, so a
  // refusal rolls the caller's transaction back with nothing persisted.
  if (patch.embeddedFields !== undefined) {
    assertWritableEmbeddedFields(desired);
    await assertLinkableEmbeddedFields(tx, { workspaceId, desired });
  }

  const plan = planEmbeddedDataReconcile(surveyId, current, desired);

  // Unlink before creating: a field whose source or ownership changed keeps its storage key, and
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
          // a field. Since ENG-3228 this guards a live path rather than an invariant: a shared entry
          // links a row this survey did not create, so a second survey's link can genuinely still
          // stand here. Leaving an orphaned row behind is the better failure of the two.
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
        locked: entry.locked,
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
    // A shared entry links a definition the workspace already owns — validated just above — so it
    // creates the link and nothing else. Only a local entry brings a row into being.
    const embeddedDataId = isSharedDesiredField(entry)
      ? entry.embeddedDataId
      : (
          await tx.embeddedData.create({
            data: {
              // Local: owned by this survey, absent from the shared library, so no library key.
              key: null,
              surveyId,
              workspaceId,
              name: entry.name,
              source: entry.source,
              dataType: entry.dataType,
              defaultValue: toStoredDefaultValue(entry.defaultValue),
              locked: entry.locked,
            },
            select: { id: true },
          })
        ).id;

    await tx.surveyEmbeddedData.create({
      data: {
        surveyId,
        workspaceId,
        embeddedDataId,
        storageKey: entry.storageKey,
        order: entry.order,
      },
    });
  }
};

/**
 * `@@unique([surveyId, storageKey])` would reject a repeated address anyway, but as an opaque
 * database error. Naming the offending key turns it into a 400 the editor can act on.
 *
 * A survey linking the same definition twice under two addresses is left to
 * `@@unique([surveyId, embeddedDataId])`, which already exists in the schema.
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

/**
 * The two shapes an `embeddedFields` entry may never have, whoever built it.
 *
 * Nothing here mints or rewrites a storage key, and nothing here judges one: a storage key is the
 * address responses are already keyed by, a promoted field deliberately keeps the one it had even
 * after it gains a different library key, and the survey copy feeds this the storage keys of rows
 * that already exist — including ones the ENG-1835 backfill moved across from columns no schema
 * ever vetted. A charset or cuid rule here would therefore refuse to duplicate a survey that works.
 * Whether the keys a *client* sent can be written back as legacy columns is checked where those
 * columns are derived, against the schemas that will have to parse them (`lib/survey/service.ts`).
 *
 * What is left are the two the data model cannot represent at all:
 *
 * - `reserved` is a code catalog, never a row (`ZEmbeddedData` refuses it too).
 * - A shared entry has to name the row it links. Without the id there is nothing to link, and
 *   treating it as local would silently fork a private copy of a library field.
 */
/**
 * The shape refusals, exported so a caller can spend them before it writes anything else.
 *
 * `reconcileEmbeddedData` runs this inside its transaction, which is too late for a caller whose
 * earlier writes are not in that transaction: the rollback would undo the survey update and leave
 * theirs committed. Pure and idempotent, so running it twice costs nothing.
 */
export const assertWritableEmbeddedFields = (desired: TDesiredEmbeddedField[]): void => {
  for (const entry of desired) {
    if (entry.source === "reserved") {
      throw new InvalidInputError(
        `Reserved fields are a code catalog and cannot be stored: ${entry.storageKey}`
      );
    }

    if (entry.key !== null && entry.embeddedDataId === undefined) {
      throw new InvalidInputError(`Shared embedded data field is missing its id: ${entry.storageKey}`);
    }
  }
};

/**
 * Refuses a shared link the workspace cannot honour, before anything is written.
 *
 * Three ways a link the editor holds can be stale or wrong by the time it is saved: the library row
 * was deleted, it was never shared in the first place (`key IS NULL` means a local row, which
 * belongs to one survey and must never be linked from another), or it answers a different source
 * than the entry claims — linking a computed definition where the survey declares an ingested field
 * would resolve its value out of the wrong half of the response.
 *
 * Cross-workspace is covered by the `workspaceId` filter rather than by a separate check: the
 * composite foreign key on `SurveyEmbeddedData` makes such a pair unrepresentable anyway, so the
 * only question is whether the caller gets a 400 naming the field or a foreign-key violation.
 */
export const assertLinkableEmbeddedFields = async (
  tx: Prisma.TransactionClient,
  { workspaceId, desired }: { workspaceId: string; desired: TDesiredEmbeddedField[] }
): Promise<void> => {
  const shared = desired.filter(isSharedDesiredField);
  if (shared.length === 0) return;

  const rows = await tx.embeddedData.findMany({
    where: { id: { in: [...new Set(shared.map((entry) => entry.embeddedDataId))] }, workspaceId },
    select: { id: true, key: true, source: true },
  });
  const rowById = new Map(rows.map((row) => [row.id, row]));

  for (const entry of shared) {
    const row = rowById.get(entry.embeddedDataId);
    if (row?.key == null) {
      throw new InvalidInputError(`Unknown shared embedded data field: ${entry.storageKey}`);
    }
    if (row.source !== entry.source) {
      throw new InvalidInputError(
        `Shared embedded data field ${row.key} is ${row.source}, not ${entry.source}`
      );
    }
  }
};
