import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TEmbeddedDataDefaultValue } from "@formbricks/types/embedded-data";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { type TV3SurveyEmbeddedField, unknownLibraryKeyIssue } from "./embedded-fields";

type TResolution<TInput> = { ok: true; input: TInput } | { ok: false; invalidParams: InvalidParam[] };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const linksLibraryKey = (entry: unknown): entry is Record<string, unknown> & { key: string } =>
  isPlainObject(entry) && typeof entry.key === "string" && entry.key.length > 0;

/**
 * Links workspace library fields by key (ENG-6930, P14): every `embeddedFields` entry that names a
 * `key` gets the library's definition, so a client can link a field without restating it — and a
 * definition it does restate cannot change a field the workspace owns.
 *
 * Runs on the request before it is validated, because what the document then says about the field —
 * its source, type and default, and so the legacy projection it is held to — is the library's. The
 * input is otherwise left as it came: a malformed entry stays malformed for the schema to report, and
 * a key the caller sent beside the library key stays for the strict schema to refuse.
 *
 * The survey's address for the field is the payload's `storageKey` when it sends one; else the one
 * the survey already links the field at (`currentFields`), so echoing a field back never moves the
 * responses stored under it; else a new one — a cuid2 for a computed field, the key for an ingested
 * one, as the editor does.
 *
 * The lookup is scoped to the workspace: a key from another workspace is unknown here.
 */
export async function resolveV3EmbeddedFieldLibraryKeys<TInput>(
  workspaceId: string,
  input: TInput,
  currentFields: readonly TLinkedEmbeddedField[] = []
): Promise<TResolution<TInput>> {
  if (!isPlainObject(input) || !Array.isArray(input.embeddedFields)) {
    return { ok: true, input };
  }

  const entries: unknown[] = input.embeddedFields;
  const keys = [...new Set(entries.filter(linksLibraryKey).map((entry) => entry.key))];
  if (keys.length === 0) {
    return { ok: true, input };
  }

  const rows = await prisma.embeddedData.findMany({
    where: { workspaceId, key: { in: keys } },
    select: {
      id: true,
      key: true,
      name: true,
      source: true,
      dataType: true,
      defaultValue: true,
      locked: true,
    },
  });
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const currentStorageKeyById = new Map(
    currentFields
      .filter((entry) => entry.field.id !== undefined)
      .map((entry) => [entry.field.id, entry.link.storageKey])
  );

  const invalidParams: InvalidParam[] = [];
  const resolved = entries.map((entry, index) => {
    if (!linksLibraryKey(entry)) return entry;

    const row = rowByKey.get(entry.key);
    if (!row || row.source === "reserved") {
      invalidParams.push(unknownLibraryKeyIssue(index, entry.key));
      return entry;
    }
    if (entry.source !== undefined && entry.source !== row.source) {
      invalidParams.push({
        name: `embeddedFields.${index}.source`,
        reason: `Library field '${row.key}' is ${row.source}, not ${String(entry.source)}`,
        code: "invalid_reference",
        identifier: row.key ?? undefined,
      });
      return entry;
    }

    const storageKey =
      typeof entry.storageKey === "string"
        ? entry.storageKey
        : (currentStorageKeyById.get(row.id) ?? (row.source === "computed" ? createId() : entry.key));

    // The caller's other keys stay, so the strict schema still refuses a typo'd or unknown one; the
    // library's definition keys win over the ones it sent.
    return {
      ...entry,
      storageKey,
      key: entry.key,
      name: row.name,
      source: row.source,
      dataType: row.dataType,
      defaultValue: row.defaultValue as TEmbeddedDataDefaultValue,
      locked: row.locked,
    } satisfies TV3SurveyEmbeddedField & Record<string, unknown>;
  });

  if (invalidParams.length > 0) {
    return { ok: false, invalidParams };
  }

  return { ok: true, input: { ...input, embeddedFields: resolved } };
}

/**
 * The library row each linked key names, for the write. Read again rather than carried over from
 * {@link resolveV3EmbeddedFieldLibraryKeys} so it can run inside the write's own transaction; a key
 * deleted in between is missing from the map and refused by `toLinkedEmbeddedFields`.
 */
export async function getV3LibraryFieldIdsByKey(
  client: Prisma.TransactionClient | typeof prisma,
  workspaceId: string,
  entries: readonly TV3SurveyEmbeddedField[]
): Promise<Map<string, string>> {
  const keys = [...new Set(entries.flatMap((entry) => (entry.key === null ? [] : [entry.key])))];
  if (keys.length === 0) {
    return new Map();
  }

  const rows = await client.embeddedData.findMany({
    where: { workspaceId, key: { in: keys } },
    select: { id: true, key: true },
  });

  return new Map(rows.flatMap((row) => (row.key === null ? [] : [[row.key, row.id] as const])));
}
