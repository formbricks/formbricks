import type { VisibilityState } from "@tanstack/react-table";
import { RESERVED_COLUMN_ENTRIES, isReservedColumnVisibleByDefault, reservedColumnId } from "./utils";

/**
 * Reconciles a persisted column order against the table's real columns (ENG-2540).
 *
 * The saved order used to be adopted wholesale, and two things followed from that. A column id the
 * saved order has never seen renders at the far right (`orderColumns` appends leftovers) — and, worse,
 * it gets **no toggle and no drag handle at all**, because the table-settings modal iterates the saved
 * order array rather than the table's columns. So for every author who had ever touched their column
 * settings, a newly added column was un-hideable. That already applied to a variable or hidden field
 * added after a first visit; adding thirteen reserved columns is what made it impossible to ignore.
 *
 * Two rules, and the second is why this is not just a concat:
 *
 * 1. Drop saved ids the table no longer has — a deleted question, or a renamed storage key. They
 *    would otherwise sit in the modal forever as rows that resolve to nothing.
 * 2. Insert an unknown id at the position it holds in `defaultOrder`, not at the end. Appending
 *    would move `Device` — which every existing table already shows — to the right of `Tags` the
 *    moment its column id changed, and would scatter new columns away from their group.
 *
 * Returns the saved order unchanged when nothing is missing or stale, so an author's arrangement is
 * never rewritten for no reason.
 */
export const reconcileColumnOrder = (savedOrder: string[], defaultOrder: string[]): string[] => {
  const known = new Set(defaultOrder);
  const kept = savedOrder.filter((id) => known.has(id));
  const seen = new Set(kept);
  const missing = defaultOrder.filter((id) => !seen.has(id));

  if (missing.length === 0) return kept;

  // Walk the default order and splice each missing id in after the last kept id that precedes it
  // there, which keeps a new column beside the ones it was declared with.
  const result: string[] = [];
  const remaining = [...kept];

  for (const id of defaultOrder) {
    if (seen.has(id)) {
      // Emit every kept id up to and including this one, preserving the author's relative order.
      const index = remaining.indexOf(id);
      if (index !== -1) {
        result.push(...remaining.splice(0, index + 1));
      }
      continue;
    }
    result.push(id);
  }

  // Anything the author ordered after the last default-order match.
  result.push(...remaining);
  return result;
};

/**
 * Seeds visibility for reserved columns the persisted state has never seen.
 *
 * `secondary` columns start hidden, so a survey's table does not silently grow thirteen columns —
 * several of them empty for every response collected before ENG-1841. `primary` columns are left
 * alone: absent from `columnVisibility` already means visible in TanStack, and writing `true` for them
 * would only add noise to what gets persisted.
 *
 * Only ever fills gaps. An explicit choice the author has already made — including hiding a primary
 * column or revealing a secondary one — is never overwritten.
 */
export const seedReservedColumnVisibility = (saved: VisibilityState): VisibilityState => {
  const seeded: VisibilityState = { ...saved };

  for (const entry of RESERVED_COLUMN_ENTRIES) {
    const columnId = reservedColumnId(entry.name);
    if (columnId in seeded) continue;
    if (!isReservedColumnVisibleByDefault(entry.display)) seeded[columnId] = false;
  }

  return seeded;
};
