import "server-only";
import { prisma } from "@formbricks/database";
import { MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE } from "./embedded-field-label-limits";

/**
 * A workspace's names for its imported (embedded-data) keys: one per key, shown in place of the key in chart
 * legends, headers and the builder's field pickers across the workspace. Built-in fields are never renamed
 * here; they keep their translated names.
 */

/** The names a workspace gave to `keys`, by key. Keys without one are absent. One indexed read. */
export const getEmbeddedFieldLabels = async (
  workspaceId: string,
  keys: readonly string[]
): Promise<Map<string, string>> => {
  if (keys.length === 0) return new Map();
  const rows = await prisma.embeddedFieldLabel.findMany({
    where: { workspaceId, key: { in: [...new Set(keys)] } },
    select: { key: true, label: true },
  });
  return new Map(rows.map(({ key, label }) => [key, label]));
};

export type TEmbeddedFieldLabelRow = { id: string; key: string; label: string };

export type TSetEmbeddedFieldLabelResult =
  | { kind: "saved"; previous: TEmbeddedFieldLabelRow | null; current: TEmbeddedFieldLabelRow | null }
  | { kind: "workspaceGone" }
  | { kind: "limitReached" }
  | { kind: "stale"; current: TEmbeddedFieldLabelRow | null };

/**
 * Give `key` the name `label` across the workspace, or clear it (`label: null`), which deletes the row so the
 * key shows as collected again. Idempotent: setting the same name twice, or clearing a key without one,
 * changes nothing.
 *
 * The per-workspace cap is checked in the same transaction as the insert, with the workspace row held
 * `FOR NO KEY UPDATE` — that serializes concurrent renames in one workspace without blocking the foreign-key
 * locks other tables' inserts take on it, so two requests cannot both pass the count.
 *
 * `expectedLabel` is the name the editor saw (`null`: none). If the stored name moved on since — another
 * editor renamed the key in between — nothing is written and the result is `stale`, so a rename never
 * silently replaces one the editor never saw. Asking for the name already stored is not stale: both editors
 * wanted the same thing.
 */
export const setEmbeddedFieldLabel = ({
  workspaceId,
  key,
  label,
  expectedLabel,
}: {
  workspaceId: string;
  key: string;
  label: string | null;
  expectedLabel: string | null;
}): Promise<TSetEmbeddedFieldLabelResult> =>
  prisma.$transaction(async (tx): Promise<TSetEmbeddedFieldLabelResult> => {
    const locked = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR NO KEY UPDATE`;
    if (locked.length === 0) return { kind: "workspaceGone" };

    const select = { id: true, key: true, label: true } as const;
    const previous = await tx.embeddedFieldLabel.findUnique({
      where: { workspaceId_key: { workspaceId, key } },
      select,
    });

    const stored = previous?.label ?? null;
    if (stored !== expectedLabel && stored !== label) return { kind: "stale", current: previous };

    if (label === null) {
      if (previous) await tx.embeddedFieldLabel.delete({ where: { id: previous.id } });
      return { kind: "saved", previous, current: null };
    }

    if (previous) {
      const current =
        previous.label === label
          ? previous
          : await tx.embeddedFieldLabel.update({ where: { id: previous.id }, data: { label }, select });
      return { kind: "saved", previous, current };
    }

    const count = await tx.embeddedFieldLabel.count({ where: { workspaceId } });
    if (count >= MAX_EMBEDDED_FIELD_LABELS_PER_WORKSPACE) return { kind: "limitReached" };

    const current = await tx.embeddedFieldLabel.create({ data: { workspaceId, key, label }, select });
    return { kind: "saved", previous: null, current };
  });
