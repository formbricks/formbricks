import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  type TEmbeddedData,
  type TEmbeddedDataDefaultValue,
  ZEmbeddedData,
} from "@formbricks/types/embedded-data";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import {
  EmbeddedDataInUseError,
  EmbeddedDataKeyConflictError,
  type TCreateSharedEmbeddedDataInput,
  type TEmbeddedDataUsageItem,
  type TPromoteEmbeddedDataInput,
  type TSharedEmbeddedData,
  type TSharedEmbeddedDataListItem,
  type TUpdateSharedEmbeddedDataInput,
} from "../types";

/**
 * The shared Embedded Data library — the one place that creates, edits, promotes and deletes a row
 * with a `key`.
 *
 * Until this existed nothing wrote such a row: `reconcileEmbeddedData` only ever creates local ones
 * (`key: null`), because the legacy Variables and Hidden Fields cards it serves know nothing about a
 * workspace library. Every invariant that separates a library field from a local one therefore lives
 * here rather than being re-derived by the manager page, the editor's library picker and promote.
 *
 * **Every read and write is scoped by `workspaceId`, and none of them takes it on trust from the
 * caller's request** — the actions resolve it from the row. The composite foreign keys back the same
 * boundary at the database (`@@unique([id, workspaceId])`), so a query missing the scope is a bug in
 * one layer rather than a hole in two.
 */

/** Columns a library row exposes. Mirrors `TSharedEmbeddedData` so a reader needs no second narrowing. */
const SELECT_SHARED_FIELD = {
  id: true,
  createdAt: true,
  updatedAt: true,
  key: true,
  name: true,
  description: true,
  source: true,
  dataType: true,
  defaultValue: true,
  locked: true,
  surveyId: true,
  workspaceId: true,
} satisfies Prisma.EmbeddedDataSelect;

/**
 * Prisma distinguishes a JSON `null` from a SQL `NULL` on a nullable Json column, so "this field has
 * no default" has to be spelled out rather than passed as a bare `null` — same reason as
 * `reconcileEmbeddedData`'s helper of this name.
 */
const toStoredDefaultValue = (
  defaultValue: TEmbeddedDataDefaultValue
): TEmbeddedDataDefaultValue | typeof Prisma.DbNull => defaultValue ?? Prisma.DbNull;

/**
 * A row read back from a `where` that already pinned `key: { not: null }` and `surveyId: null`.
 * Prisma cannot express that in its types, so the narrowing is asserted in exactly this one place
 * rather than at each call site.
 */
const asSharedField = (row: TEmbeddedData): TSharedEmbeddedData => row as TSharedEmbeddedData;

/**
 * Runs the prospective row through `ZEmbeddedData` before it reaches the database.
 *
 * This is what keeps one definition of a valid field. `ZEmbeddedData` already refuses a key outside
 * the safe-identifier charset or on the reserved list, a default whose runtime type disagrees with
 * `dataType`, `locked` on anything but an ingested field, a computed field typed `boolean` or
 * `date`, and a `source` of `reserved`. Restating any of that here would mean two rules to keep in
 * step, and the one that drifts is the one nobody reads.
 *
 * The issue message is forwarded verbatim: the editor renders it, and "Key is reserved" is more use
 * than "invalid input".
 */
const assertValidRow = (candidate: unknown): void => {
  const parsed = ZEmbeddedData.safeParse(candidate);
  if (parsed.success) return;

  const [issue] = parsed.error.issues;
  throw new InvalidInputError(issue.message);
};

/**
 * A prospective row, as `ZEmbeddedData` wants to see it.
 *
 * `createdAt` / `updatedAt` are stamped by Postgres, and `id` by `createId()` on the create path, so
 * validation has to be handed values for all three. None of them participates in a cross-field rule,
 * so supplying the real id and the current time is faithful for the columns that are checked.
 */
const candidateRow = (row: Omit<TEmbeddedData, "createdAt" | "updatedAt">): TEmbeddedData => ({
  ...row,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * Whether a Prisma error is the unique violation on `@@unique([workspaceId, key])`.
 *
 * Keyed on the code rather than on `instanceof PrismaClientKnownRequestError`, matching
 * `createContactAttributeKey`: the class identity is the Prisma runtime's, and this has to hold for
 * an error that crossed a module boundary as well as one thrown in process.
 */
const isKeyConflict = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === PrismaErrorType.UniqueConstraintViolation;

/**
 * The workspace's library, each row with the number of surveys linking it.
 *
 * `key: { not: null }` is the whole definition of "shared", so a local row can never reach the
 * manager page. Ordered by `key` because that is the column the list is read by, and the unique
 * index on `[workspaceId, key]` already sorts it.
 */
export const getSharedEmbeddedData = reactCache(
  async (workspaceId: string): Promise<TSharedEmbeddedDataListItem[]> => {
    const rows = await prisma.embeddedData.findMany({
      where: { workspaceId, key: { not: null } },
      select: { ...SELECT_SHARED_FIELD, _count: { select: { surveyLinks: true } } },
      orderBy: { key: "asc" },
    });

    return rows.map(({ _count, ...row }) => ({ ...asSharedField(row), surveyCount: _count.surveyLinks }));
  }
);

/**
 * The surveys currently linking a field, for the usage popover and for the two refusals that name
 * them. Ordered by name so the popover does not reshuffle between reads.
 *
 * Scoped by `workspaceId` like every other query here, so a caller authorized for one workspace
 * cannot read another's usage by guessing an id.
 */
export const getEmbeddedDataUsage = async (
  id: string,
  workspaceId: string
): Promise<TEmbeddedDataUsageItem[]> => {
  const links = await prisma.surveyEmbeddedData.findMany({
    where: { embeddedDataId: id, workspaceId },
    select: { survey: { select: { id: true, name: true, status: true } } },
    orderBy: { survey: { name: "asc" } },
  });

  return links.map((link) => link.survey);
};

/**
 * The workspace owning a row, or null when no row has that id.
 *
 * The one lookup here that is *not* workspace-scoped, and deliberately so: it is what establishes the
 * scope. An action takes a globally unique field id, resolves the workspace from the row itself and
 * authorizes against that, so the caller can never pair someone else's id with a workspace it happens
 * to have access to. It reads nothing but the ownership column — the row the caller is allowed to see
 * is loaded afterwards, by a query that carries the workspace.
 *
 * Local rows answer too: promote starts from one.
 */
export const getEmbeddedDataWorkspaceId = async (id: string): Promise<string | null> => {
  const row = await prisma.embeddedData.findUnique({ where: { id }, select: { workspaceId: true } });

  return row?.workspaceId ?? null;
};

/** One library row, or null when the id names a local row, another workspace's row, or nothing. */
export const getSharedEmbeddedDataById = async (
  id: string,
  workspaceId: string
): Promise<TSharedEmbeddedData | null> => {
  const row = await prisma.embeddedData.findFirst({
    where: { id, workspaceId, key: { not: null } },
    select: SELECT_SHARED_FIELD,
  });

  return row ? asSharedField(row) : null;
};

/**
 * One survey-local row, or null when the id names a shared row, another workspace's row, or nothing.
 *
 * The mirror of {@link getSharedEmbeddedDataById} — `surveyId` where that one reads `key` — and the
 * only way to see a field as it was before a promote, since promoting is what makes it shared.
 */
export const getLocalEmbeddedDataById = async (
  id: string,
  workspaceId: string
): Promise<TSharedEmbeddedData | null> => {
  const row = await prisma.embeddedData.findFirst({
    where: { id, workspaceId, surveyId: { not: null } },
    select: SELECT_SHARED_FIELD,
  });

  return row ? asSharedField(row) : null;
};

/** {@link getSharedEmbeddedDataById}, refusing rather than returning null. */
const requireSharedField = async (id: string, workspaceId: string): Promise<TSharedEmbeddedData> => {
  const existing = await getSharedEmbeddedDataById(id, workspaceId);
  if (!existing) throw new ResourceNotFoundError("embeddedData", id);
  return existing;
};

/**
 * Adds a field to the workspace library.
 *
 * `surveyId: null` is not a default anyone may override — it is the other half of what makes the row
 * shared, and `ZEmbeddedData` refuses a row that sets both it and `key`.
 *
 * The id is minted here rather than left to Postgres so the row that is validated is the row that is
 * written, id included.
 */
export const createSharedEmbeddedData = async (
  workspaceId: string,
  input: TCreateSharedEmbeddedDataInput
): Promise<TSharedEmbeddedData> => {
  const row = candidateRow({
    id: createId(),
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    source: input.source,
    dataType: input.dataType ?? "string",
    defaultValue: input.defaultValue ?? null,
    locked: input.locked ?? false,
    surveyId: null,
    workspaceId,
  });
  assertValidRow(row);

  try {
    const created = await prisma.embeddedData.create({
      data: {
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        source: row.source,
        dataType: row.dataType,
        defaultValue: toStoredDefaultValue(row.defaultValue),
        locked: row.locked,
        surveyId: null,
        workspaceId,
      },
      select: SELECT_SHARED_FIELD,
    });

    return asSharedField(created);
  } catch (error) {
    // In practice the only unique index a fresh row can violate: the other two are on `id`, which
    // was just minted.
    if (isKeyConflict(error)) throw new EmbeddedDataKeyConflictError();
    throw error;
  }
};

/**
 * Edits a library field.
 *
 * `key` and `source` are not editable, and that is a storage constraint rather than a policy: a
 * survey addresses a field's value by `storageKey`, whose shape follows the source, so changing
 * either would leave every linked survey reading an address that no longer holds the value.
 *
 * `dataType` is editable, but only while nothing has been collected under it. A field typed `number`
 * that becomes `string` reinterprets every value already stored against it, so the change is refused
 * as long as any linked survey has a response — unless the caller has seen that list and says to go
 * ahead (`acknowledgeExistingResponses`), which is the confirmation dialog on the manager page.
 * Re-declaring the same `dataType` is not a change and is never refused.
 *
 * The merged row goes back through `ZEmbeddedData`, so a patch cannot reach a combination a create
 * would have rejected — clearing a `boolean` field's default to a string, say, or locking a computed
 * one.
 */
export const updateSharedEmbeddedData = async (
  id: string,
  workspaceId: string,
  patch: TUpdateSharedEmbeddedDataInput,
  options?: { acknowledgeExistingResponses?: boolean }
): Promise<TSharedEmbeddedData> => {
  const existing = await requireSharedField(id, workspaceId);

  const merged = candidateRow({
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description === undefined ? existing.description : (patch.description ?? null),
    dataType: patch.dataType ?? existing.dataType,
    defaultValue: patch.defaultValue === undefined ? existing.defaultValue : patch.defaultValue,
    locked: patch.locked ?? existing.locked,
  });
  assertValidRow(merged);

  if (merged.dataType !== existing.dataType && !options?.acknowledgeExistingResponses) {
    await assertNoResponsesUnderField(id, workspaceId);
  }

  const updated = await prisma.embeddedData.update({
    where: { id, workspaceId },
    data: {
      name: merged.name,
      description: merged.description,
      dataType: merged.dataType,
      defaultValue: toStoredDefaultValue(merged.defaultValue),
      locked: merged.locked,
    },
    select: SELECT_SHARED_FIELD,
  });

  return asSharedField(updated);
};

/**
 * Refuses a `dataType` change while any linked survey holds a response.
 *
 * Existence, not a count: one response is enough to refuse, and `Response` is the largest table in
 * the product. The usage list is loaded only once the refusal is certain, so the common case pays a
 * single indexed lookup.
 */
const assertNoResponsesUnderField = async (id: string, workspaceId: string): Promise<void> => {
  const links = await prisma.surveyEmbeddedData.findMany({
    where: { embeddedDataId: id, workspaceId },
    select: { surveyId: true },
  });
  if (links.length === 0) return;

  const response = await prisma.response.findFirst({
    where: { surveyId: { in: links.map((link) => link.surveyId) } },
    select: { id: true },
  });
  if (!response) return;

  throw new EmbeddedDataInUseError(
    "Cannot change the data type of a field that already has responses",
    await getEmbeddedDataUsage(id, workspaceId)
  );
};

/**
 * Removes a field from the library, but only while nothing links it.
 *
 * The refusal is the point. `SurveyEmbeddedData` cascades on `embeddedDataId`, so deleting a linked
 * field would silently strip it from every survey that uses it — the responses already stored under
 * its `storageKey` would stay, addressed by a definition that no longer exists. Same guard, and same
 * reason, as `deleteSegment`.
 */
export const deleteSharedEmbeddedData = async (
  id: string,
  workspaceId: string
): Promise<TSharedEmbeddedData> => {
  const existing = await requireSharedField(id, workspaceId);

  const usage = await getEmbeddedDataUsage(id, workspaceId);
  if (usage.length > 0) {
    throw new EmbeddedDataInUseError("Cannot delete a field that is used by a survey", usage);
  }

  await prisma.embeddedData.delete({ where: { id, workspaceId } });

  return existing;
};

/**
 * Moves a survey's local field into the workspace library, keeping it exactly where it is.
 *
 * Only the ownership columns move: `key` is set and `surveyId` cleared, in one update. The survey's
 * link row and its `storageKey` are untouched on purpose — that is what makes promote non-destructive
 * for the survey doing it. Its stored responses keep resolving, because they were never addressed by
 * anything this changes.
 *
 * A key that is already taken answers with the row holding it, so the editor can offer to replace the
 * local field with the library one instead of asking for a different name.
 */
export const promoteEmbeddedDataToShared = async (
  id: string,
  workspaceId: string,
  input: TPromoteEmbeddedDataInput
): Promise<TSharedEmbeddedData> => {
  const existing = await prisma.embeddedData.findFirst({
    where: { id, workspaceId, surveyId: { not: null } },
    select: SELECT_SHARED_FIELD,
  });
  if (!existing) throw new ResourceNotFoundError("embeddedData", id);

  const promoted = candidateRow({
    ...existing,
    key: input.key,
    description: input.description === undefined ? existing.description : (input.description ?? null),
    surveyId: null,
  });
  assertValidRow(promoted);

  try {
    const updated = await prisma.embeddedData.update({
      // `surveyId: { not: null }` a second time, so the write enforces what the read above checked
      // rather than trusting it to still hold. Two authors promoting the same field would otherwise
      // both pass that read and the later write would land its key and description on a row the
      // earlier one had already shared, with no constraint to catch it.
      where: { id, workspaceId, surveyId: { not: null } },
      data: { key: promoted.key, description: promoted.description, surveyId: null },
      select: SELECT_SHARED_FIELD,
    });

    return asSharedField(updated);
  } catch (error) {
    // Nothing matched the predicate: the row was promoted or deleted between the read and the write.
    if (error instanceof Error && "code" in error && error.code === PrismaErrorType.RecordNotFound) {
      throw new ResourceNotFoundError("embeddedData", id);
    }

    if (!isKeyConflict(error)) throw error;

    // The id of the row already holding the key, not just the fact of the clash: it is what the
    // editor needs to offer "use the library field instead". A second read rather than a lookup
    // before the write, so the common case stays one statement and the check cannot race the insert.
    const conflicting = await prisma.embeddedData.findUnique({
      where: { workspaceId_key: { workspaceId, key: input.key } },
      select: { id: true },
    });
    throw new EmbeddedDataKeyConflictError(conflicting?.id ?? null);
  }
};
